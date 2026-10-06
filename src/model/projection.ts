// Projection engine. Pure functions of (state, now): no timers, recomputed on render.
import { RACES, RUNNERS, raceOf, runnerById, type Race, type Station } from '../data/course'
import type { Ask, Meet, RaceState } from './events'

const MIN = 60_000
/** Crew aim to arrive this long before the earliest likely arrival. */
export const BE_EARLY_MS = 15 * MIN
/** "Not logged yet" grace after the expected arrival. */
export const OVERDUE_GRACE_MS = 30 * MIN
/** Extra buffer between two meetings for the same crew (dwell + driving between lots). */
export const CLASH_BUFFER_MS = 30 * MIN

export interface StationProj {
  st: Station
  idx: number
  /** planned clock time (given, or filled in by mileage between given times) */
  plan: number | null
  planGiven: boolean
  actual: number | null
  /** projection from actual pace */
  proj: number | null
  /** cautious projection: never assumes the runner keeps beating plan (used for cut-off warnings) */
  projSafe: number | null
  /** earliest likely arrival (their projection, or plan pace from their last check-in if that's sooner) — for crew */
  earliest: number | null
  /** latest likely arrival — for crew clash checks */
  latest: number | null
  cutoff: number | null
  /** cut-off minus cautious projection (future) or minus actual (passed) */
  spare: number | null
  meet: Meet | null
  note: string
}

export interface RunnerProj {
  runnerId: string
  name: string
  race: Race
  stations: StationProj[]
  lastIdx: number
  actualStart: number
  startLogged: boolean
  planStart: number
  ratio: number | null
  /** ms vs plan at the last station (positive = behind) */
  delta: number | null
  earlyEstimate: boolean
  hasPlan: boolean
  dropped: boolean
  droppedAt: string | null
  finished: boolean
  started: boolean
  next: StationProj | null
  nextCutoff: StationProj | null
  /** next stop where crew will meet (or, if no meetings are planned, the next crew-accessible stop) */
  nextMeet: StationProj | null
  meetingsPlanned: boolean
  overdue: StationProj | null
}

function fillPlan(stations: Station[], given: Record<string, number>, planStart: number): { plan: (number | null)[]; given: boolean[] } {
  const raw = stations.map((st, i) => (i === 0 ? given[st.id] ?? planStart : given[st.id] ?? null))
  const isGiven = stations.map((st, i) => i === 0 || given[st.id] != null)
  const plan = [...raw]
  // interpolate gaps by mileage between known plan points
  let prev = 0
  for (let i = 1; i < stations.length; i++) {
    if (raw[i] == null) continue
    if (i - prev > 1) {
      const m0 = stations[prev].mile, m1 = stations[i].mile, t0 = raw[prev]!, t1 = raw[i]!
      for (let k = prev + 1; k < i; k++) plan[k] = Math.round(t0 + ((stations[k].mile - m0) / (m1 - m0)) * (t1 - t0))
    }
    prev = i
  }
  return { plan, given: isGiven }
}

export function projectRunner(runnerId: string, s: RaceState, now: number): RunnerProj {
  const runner = runnerById(runnerId)!
  const race = raceOf(runnerId)
  const sts = race.stations
  const checkins = s.checkins[runnerId] ?? {}
  const planStart = s.plans[runnerId]?.start ?? race.start
  const { plan, given } = fillPlan(sts, s.plans[runnerId] ?? {}, planStart)
  const actual = sts.map(st => checkins[st.id]?.at ?? null)
  const startLogged = actual[0] != null
  const actualStart = actual[0] ?? race.start
  let lastIdx = 0
  for (let i = 1; i < sts.length; i++) if (actual[i] != null) lastIdx = i
  const status = s.status[runnerId]
  const dropped = !!status?.dropped
  const finished = actual[sts.length - 1] != null
  const meets = s.meets[runnerId] ?? {}
  const meetingsPlanned = Object.values(meets).some(m => m.meeting)

  let ratio: number | null = null
  let delta: number | null = null
  if (lastIdx > 0 && plan[lastIdx] != null) {
    const act = actual[lastIdx]! - actualStart
    const pl = plan[lastIdx]! - planStart
    if (pl > 0) ratio = Math.min(3, Math.max(0.5, act / pl))
    delta = act - pl
  }

  const base = lastIdx > 0 ? actual[lastIdx]! : actualStart
  const baseP = lastIdx > 0 ? plan[lastIdx] : planStart
  const r = lastIdx > 0 ? ratio : 1
  const stations: StationProj[] = sts.map((st, i) => {
    let proj: number | null = null, projSafe: number | null = null, projFast: number | null = null
    if (i > lastIdx && !dropped && plan[i] != null && baseP != null && r != null) {
      proj = Math.round(base + r * (plan[i]! - baseP))
      projSafe = Math.round(base + Math.max(r, 1) * (plan[i]! - baseP))
      // earliest realistic: if they run the rest at plan pace from here (or faster, if they're already faster)
      projFast = Math.round(base + Math.min(r, 1) * (plan[i]! - baseP))
    }
    const cutoff = s.cutoffs[race.id][st.id] ?? null
    const ref = actual[i] ?? projSafe
    return {
      st, idx: i, plan: plan[i], planGiven: given[i], actual: actual[i], proj, projSafe,
      earliest: projFast,
      latest: projSafe,
      cutoff, spare: cutoff != null && ref != null ? cutoff - ref : null,
      meet: meets[st.id] ?? null, note: s.notes[runnerId]?.[st.id] ?? '',
    }
  })

  const live = !dropped && !finished
  const next = live && lastIdx + 1 < sts.length ? stations[lastIdx + 1] : null
  const nextCutoff = live ? stations.find(x => x.idx > lastIdx && x.cutoff != null) ?? null : null
  const nextMeet = live
    ? stations.find(x => x.idx > lastIdx && (meetingsPlanned ? !!x.meet?.meeting : x.st.crew)) ?? null
    : null
  const started = startLogged || lastIdx > 0 || now >= race.start
  let overdue: StationProj | null = null
  if (live && started && next?.proj != null && now > next.proj + OVERDUE_GRACE_MS) overdue = next

  return {
    runnerId, name: runner.name, race, stations, lastIdx, actualStart, startLogged, planStart, ratio, delta,
    earlyEstimate: lastIdx === 1, hasPlan: plan[sts.length - 1] != null, dropped, droppedAt: status?.station ?? null,
    finished, started, next, nextCutoff, nextMeet, meetingsPlanned, overdue,
  }
}

export function projectAll(s: RaceState, now: number): RunnerProj[] {
  return RUNNERS.map(r => projectRunner(r.id, s, now))
}

// ---------- crew meetings ----------

export interface Meeting {
  runnerId: string
  name: string
  sp: StationProj
  who: string
  /** crew should be there by */
  beThereBy: number | null
  /** leave the lot by (beThereBy − lead time) */
  leaveBy: number | null
  leadMin: number
  planned: boolean
  /** other meeting(s) this one clashes with */
  clashes: Meeting[]
  asks: Ask[]
}

export function leadMinFor(s: RaceState, st: Station): number {
  return s.leads[st.id] ?? st.leadMin ?? 10
}

function toMeeting(p: RunnerProj, sp: StationProj, s: RaceState, planned: boolean): Meeting {
  const leadMin = leadMinFor(s, sp.st)
  const beThereBy = sp.earliest != null ? sp.earliest - BE_EARLY_MS : null
  return {
    runnerId: p.runnerId, name: p.name, sp, who: sp.meet?.who ?? '', planned,
    beThereBy, leaveBy: beThereBy != null ? beThereBy - leadMin * MIN : null, leadMin, clashes: [], asks: [],
  }
}

/** Upcoming planned meetings across all runners, soonest first, with clash warnings and runner requests attached. */
export function upcomingMeetings(projs: RunnerProj[], s: RaceState): Meeting[] {
  const out: Meeting[] = []
  for (const p of projs) {
    if (p.dropped || p.finished) continue
    for (const sp of p.stations) {
      if (sp.idx <= p.lastIdx) continue
      if (sp.meet?.meeting) out.push(toMeeting(p, sp, s, true))
    }
  }
  out.sort((a, b) => (a.beThereBy ?? Infinity) - (b.beThereBy ?? Infinity))
  // clash: the same crew can't leave one meeting and reach their NEXT one in time (back-to-back meetings only)
  const byWho = new Map<string, Meeting[]>()
  for (const m of out) {
    const k = m.who.trim().toLowerCase()
    if (!k) continue
    byWho.set(k, [...(byWho.get(k) ?? []), m])
  }
  for (const list of byWho.values()) {
    for (let i = 0; i + 1 < list.length; i++) {
      const a = list[i], b = list[i + 1]
      if (a.sp.st.id === b.sp.st.id) continue   // several runners at the same stop: crew just stay
      if (isClash(a, b)) { a.clashes.push(b); b.clashes.push(a) }
    }
  }
  for (const m of out) m.asks = openAsks(s, projs).filter(x => x.runner === m.runnerId && x.target === m.sp.st.id)
  return out
}

/** Minutes for crew to get from one stop to the next (leave the first, reach the second). */
export function travelMin(from: Meeting, to: Meeting): number {
  // Aspen Glen → Finish is one hop on the same crew shuttle (~15 min + waiting)
  if (from.sp.st.id === 'ag' && to.sp.st.id === 'fin') return 30
  return from.leadMin + to.leadMin
}

export function isClash(a: Meeting, b: Meeting): boolean {
  const [first, second] = (a.beThereBy ?? 0) <= (b.beThereBy ?? 0) ? [a, b] : [b, a]
  if (first.sp.latest == null || second.beThereBy == null) return false
  const gap = second.beThereBy - first.sp.latest
  const need = travelMin(first, second) * MIN + CLASH_BUFFER_MS
  return gap < need
}

/** The meeting for a runner's next crew stop (planned meeting, or next crew-accessible stop if none planned). */
export function nextMeetingFor(p: RunnerProj, s: RaceState): Meeting | null {
  if (!p.nextMeet) return null
  const m = toMeeting(p, p.nextMeet, s, p.meetingsPlanned)
  m.asks = openAsks(s, [p]).filter(x => x.runner === p.runnerId && x.target === p.nextMeet!.st.id)
  return m
}

// ---------- ask crew ----------

/** Requests still open: the runner hasn't yet been logged at the target stop or any later one. Worked out from the whole log. */
export function openAsks(s: RaceState, projs: RunnerProj[]): Ask[] {
  return s.asks.filter(a => {
    const p = projs.find(x => x.runnerId === a.runner)
    if (!p) return false
    if (p.dropped || p.finished) return false
    if (!a.target) return true
    const tIdx = p.race.stations.findIndex(st => st.id === a.target)
    if (tIdx < 0) return true
    return !p.stations.some(sp => sp.idx >= tIdx && sp.actual != null)
  })
}

export function askMeetingMoved(a: Ask, s: RaceState, p: RunnerProj): boolean {
  if (!a.target || !p.meetingsPlanned) return false
  return !s.meets[a.runner]?.[a.target]?.meeting
}

/** Target for a new request: the next meeting AFTER where the runner is now (never the stop they're standing at). */
export function askTarget(p: RunnerProj): { station: string | null; name: string; isMeeting: boolean } {
  if (!p.nextMeet) return { station: null, name: 'crew', isMeeting: false }
  return { station: p.nextMeet.st.id, name: p.nextMeet.st.name, isMeeting: p.meetingsPlanned }
}

/** Target for a request sent while checking in at station `idx`: the next meeting after that station. */
export function askTargetAfter(p: RunnerProj, idx: number): { station: string | null; name: string; isMeeting: boolean } {
  const sp = p.stations.find(x => x.idx > idx && (p.meetingsPlanned ? !!x.meet?.meeting : x.st.crew))
  if (!sp) return { station: null, name: 'crew', isMeeting: false }
  return { station: sp.st.id, name: sp.st.name, isMeeting: p.meetingsPlanned }
}

export function stationName(raceId: string, stationId: string | null): string {
  if (!stationId) return '—'
  const race = RACES[raceId as keyof typeof RACES]
  return race?.stations.find(s => s.id === stationId)?.name ?? stationId
}

// ---------- goal-time helper ----------

/** Planned times from a goal finish time. 100K: 2025-finisher shares. 50K: effort = miles + gain/528. */
export function planFromGoal(race: Race, startAt: number, finishMs: number, shares100k: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  if (race.id === '100k') {
    for (const st of race.stations) out[st.id] = Math.round(startAt + shares100k[st.id] * finishMs)
    return out
  }
  const sts = race.stations
  const effort = sts.map(st => (st.nextMi ?? 0) + (st.gain ?? 0) / 528)
  const total = effort.reduce((a, b) => a + b, 0)
  let acc = 0
  for (let i = 0; i < sts.length; i++) {
    out[sts[i].id] = Math.round(startAt + (acc / total) * finishMs)
    acc += effort[i]
  }
  return out
}

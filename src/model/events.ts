// Shared event log. Every action is a small dated event; nothing is ever edited or deleted.
// The current state is recomputed from the whole log, so every phone reaches the same answer
// no matter what order events arrive in.
import { RACES, RUNNERS, type RaceId } from '../data/course'
import { SEED_PLANS } from '../data/plans'

export interface KEvent {
  id: string
  v: 1
  /** device clock when created (ms) */
  ts: number
  /** newest effective time this device had seen when it created the event (orders edits made after seeing others) */
  seenTs: number
  deviceId: string
  /** who entered it (crew name or runner name) */
  by: string
  type: string
  payload: Record<string, unknown>
}

export type EventType =
  | 'checkin_set' | 'checkin_cleared' | 'status_set' | 'plan_set' | 'note_set' | 'meet_set'
  | 'cutoff_set' | 'lead_set' | 'crew_name_set' | 'ask_sent' | 'ask_ack' | 'link_set' | 'undo'

/** Effective order time: an event made after seeing another always sorts after it, even if this phone's clock is slow. */
export function eff(e: KEvent): number { return Math.max(e.ts, e.seenTs + 1) }

export function cmp(a: KEvent, b: KEvent): number {
  return (eff(a) - eff(b)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

export function keyOf(e: KEvent): string | null {
  const p = e.payload
  switch (e.type) {
    case 'checkin_set':
    case 'checkin_cleared': return `checkin:${p.runner}:${p.station}`
    case 'status_set': return `status:${p.runner}`
    case 'plan_set': return `plan:${p.runner}:${p.station}`
    case 'note_set': return `note:${p.runner}:${p.station}`
    case 'meet_set': return `meet:${p.runner}:${p.station}`
    case 'cutoff_set': return `cutoff:${p.race}:${p.station}`
    case 'lead_set': return `lead:${p.station}`
    case 'crew_name_set': return `crewname:${String(p.name ?? '').trim().toLowerCase()}`
    case 'ask_sent': return `ask:${e.id}`
    case 'ask_ack': return `askack:${p.askId}`
    case 'link_set': return `link:${p.runner}`
    default: return null
  }
}

export interface Checkin { at: number; note: string; by: string; ev: KEvent }
export interface Meet { meeting: boolean; who: string }
export interface Ask {
  id: string; runner: string; items: string[]; text: string
  /** station the request is for (frozen when sent) */
  target: string | null
  /** furthest station the runner had reached when they sent it */
  from: string | null
  at: number; by: string
  ackBy: string | null; ackAt: number | null
}

export interface RaceState {
  checkins: Record<string, Record<string, Checkin>>
  status: Record<string, { dropped: boolean; station: string | null; by: string; at: number } | undefined>
  plans: Record<string, Record<string, number>>
  notes: Record<string, Record<string, string>>
  meets: Record<string, Record<string, Meet>>
  cutoffs: Record<RaceId, Record<string, number>>
  lastCutoffEdit: KEvent | null
  leads: Record<string, number>
  crewNames: string[]
  asks: Ask[]
  links: Record<string, string>
  /** every event per key, oldest first (for history views) */
  history: Map<string, KEvent[]>
  undone: Set<string>
}

export function resolve(events: KEvent[]): { winners: Map<string, KEvent>; history: Map<string, KEvent[]>; undone: Set<string> } {
  const undone = new Set<string>()
  for (const e of events) if (e.type === 'undo') undone.add(String(e.payload.targetEventId))
  const history = new Map<string, KEvent[]>()
  for (const e of events) {
    const k = keyOf(e)
    if (!k) continue
    const g = history.get(k) ?? []
    g.push(e); history.set(k, g)
  }
  const winners = new Map<string, KEvent>()
  for (const [k, g] of history) {
    g.sort(cmp)
    for (let i = g.length - 1; i >= 0; i--) if (!undone.has(g[i].id)) { winners.set(k, g[i]); break }
  }
  return { winners, history, undone }
}

export function reduce(events: KEvent[]): RaceState {
  const { winners, history, undone } = resolve(events)
  const s: RaceState = {
    checkins: {}, status: {}, plans: {}, notes: {}, meets: {},
    cutoffs: { '100k': {}, '50k': {} }, lastCutoffEdit: null, leads: {}, crewNames: [], asks: [], links: {},
    history, undone,
  }
  for (const r of RUNNERS) {
    s.checkins[r.id] = {}; s.notes[r.id] = {}; s.meets[r.id] = {}
    s.plans[r.id] = { ...(SEED_PLANS[r.id] ?? {}) }
  }
  for (const race of Object.values(RACES)) for (const st of race.stations) {
    if (st.cutoff != null) s.cutoffs[race.id][st.id] = st.cutoff
    if (st.leadMin != null && s.leads[st.id] == null) s.leads[st.id] = st.leadMin
  }
  const acks = new Map<string, KEvent>()
  const crew = new Map<string, string>()
  for (const [, e] of winners) {
    const p = e.payload
    const runner = String(p.runner ?? '')
    const station = String(p.station ?? '')
    switch (e.type) {
      case 'checkin_set':
        if (s.checkins[runner]) s.checkins[runner][station] = { at: p.at as number, note: String(p.note ?? ''), by: e.by, ev: e }
        break
      case 'checkin_cleared': break
      case 'status_set':
        if (p.dropped) s.status[runner] = { dropped: true, station: (p.station as string) ?? null, by: e.by, at: e.ts }
        break
      case 'plan_set':
        if (!s.plans[runner]) break
        if (typeof p.at === 'number') s.plans[runner][station] = p.at
        else delete s.plans[runner][station]
        break
      case 'note_set': if (s.notes[runner]) s.notes[runner][station] = String(p.text ?? ''); break
      case 'meet_set': if (s.meets[runner]) s.meets[runner][station] = { meeting: !!p.meeting, who: String(p.who ?? '') }; break
      case 'cutoff_set': {
        const race = p.race as RaceId
        if (s.cutoffs[race] && typeof p.at === 'number') s.cutoffs[race][station] = p.at
        if (!s.lastCutoffEdit || cmp(e, s.lastCutoffEdit) > 0) s.lastCutoffEdit = e
        break
      }
      case 'lead_set': if (typeof p.minutes === 'number') s.leads[station] = p.minutes; break
      case 'crew_name_set': {
        const name = String(p.name ?? '').trim()
        if (name) { if (p.active === false) crew.delete(name.toLowerCase()); else crew.set(name.toLowerCase(), name) }
        break
      }
      case 'ask_sent':
        s.asks.push({
          id: e.id, runner, items: (p.items as string[]) ?? [], text: String(p.text ?? ''),
          target: (p.target as string) ?? null, from: (p.from as string) ?? null, at: (p.at as number) ?? e.ts, by: e.by, ackBy: null, ackAt: null,
        })
        break
      case 'ask_ack': acks.set(String(p.askId), e); break
      case 'link_set': if (runner) s.links[runner] = String(p.url ?? ''); break
    }
  }
  for (const a of s.asks) {
    const ack = acks.get(a.id)
    if (ack) { a.ackBy = ack.by; a.ackAt = ack.ts }
  }
  s.asks.sort((a, b) => a.at - b.at)
  s.crewNames = [...crew.values()].sort((a, b) => a.localeCompare(b))
  return s
}

export interface EventCtx { deviceId: string; by: string; log: KEvent[]; now: number; id?: string }

/** Create an event; seenTs = the newest effective time in the local log. */
export function makeEvent(type: EventType, payload: Record<string, unknown>, ctx: EventCtx): KEvent {
  let seenTs = 0
  for (const e of ctx.log) { const t = eff(e); if (t > seenTs) seenTs = t }
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(payload)) if (v !== undefined) clean[k] = v
  return { id: ctx.id ?? newId(), v: 1, ts: ctx.now, seenTs, deviceId: ctx.deviceId, by: ctx.by, type, payload: clean }
}

export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c?.randomUUID) return c.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** Basic shape check for events arriving from the network. */
export function isValidEvent(e: unknown): e is KEvent {
  if (!e || typeof e !== 'object') return false
  const x = e as Record<string, unknown>
  return typeof x.id === 'string' && x.v === 1 && typeof x.ts === 'number' && typeof x.seenTs === 'number'
    && typeof x.deviceId === 'string' && typeof x.type === 'string' && !!x.payload && typeof x.payload === 'object'
}

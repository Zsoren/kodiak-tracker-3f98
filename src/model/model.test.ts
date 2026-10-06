import { describe, it, expect } from 'vitest'
import { pt, RACES } from '../data/course'
import { makeEvent, reduce, type EventType, type KEvent } from './events'
import { projectRunner, projectAll, upcomingMeetings, openAsks, askTarget, askTargetAfter, askMeetingMoved, planFromGoal } from './projection'
import { SHARES_100K } from '../data/course'
import { parseDigits, resolveTime, flipAmPm, flipDay, toDigits } from './timeEntry'
import { checkCheckin } from './checks'
import { fmtT, fmtAheadBehind, fmtSpare } from './time'
import { sampleEvents } from './sample'

const MIN = 60_000
let n = 0
function ev(type: EventType, payload: Record<string, unknown>, opts: { ts?: number; device?: string; by?: string; log?: KEvent[] } = {}): KEvent {
  return makeEvent(type, payload, { deviceId: opts.device ?? 'd1', by: opts.by ?? 'Mom', log: opts.log ?? [], now: opts.ts ?? pt(10, 12, 0), id: `e${++n}` })
}
const ci = (runner: string, station: string, at: number, o: { ts?: number; device?: string; log?: KEvent[] } = {}) => ev('checkin_set', { runner, station, at }, { ts: o.ts ?? at + MIN, ...o })

describe('time entry (colon-free)', () => {
  it('parses digits without a colon', () => {
    expect(parseDigits('9')).toEqual({ h: 9, m: 0, is24: false })
    expect(parseDigits('930')).toEqual({ h: 9, m: 30, is24: false })
    expect(parseDigits('0930')).toEqual({ h: 9, m: 30, is24: true })
    expect(parseDigits('1030')).toEqual({ h: 10, m: 30, is24: false })
    expect(parseDigits('2130')).toEqual({ h: 21, m: 30, is24: true })
    expect(parseDigits('9:30')).toEqual({ h: 9, m: 30, is24: false })   // a typed colon is simply ignored
    expect(parseDigits('975')).toBe('invalid')
    expect(parseDigits('2560')).toBe('invalid')
    expect(parseDigits('')).toBe('empty')
  })
  it('plans: picks the first time after the previous station (replaces "before 5 AM = Sunday")', () => {
    const p = parseDigits('145') as Exclude<ReturnType<typeof parseDigits>, string>
    expect(resolveTime(p, { after: pt(10, 23, 12) })).toBe(pt(11, 1, 45))   // Sun 1:45 AM
    expect(resolveTime(p, { after: pt(10, 12, 8) })).toBe(pt(10, 13, 45))   // Sat 1:45 PM
    const p2 = parseDigits('1212') as Exclude<ReturnType<typeof parseDigits>, string>
    expect(resolveTime(p2, { after: pt(10, 23, 0) })).toBe(pt(11, 0, 12))   // Sun 12:12 AM
  })
  it('check-ins: picks the moment closest to the expected time', () => {
    const p = parseDigits('1240') as Exclude<ReturnType<typeof parseDigits>, string>
    expect(resolveTime(p, { near: pt(11, 0, 30) })).toBe(pt(11, 0, 40))     // Sun 12:40 AM
    expect(resolveTime(p, { near: pt(10, 12, 30) })).toBe(pt(10, 12, 40))   // Sat 12:40 PM
  })
  it('flips AM/PM and Sat/Sun', () => {
    expect(flipAmPm(pt(10, 9, 30))).toBe(pt(10, 21, 30))
    expect(flipAmPm(pt(10, 21, 30))).toBe(pt(10, 9, 30))
    expect(flipDay(pt(10, 1, 0))).toBe(pt(11, 1, 0))
    expect(flipDay(pt(11, 1, 0))).toBe(pt(10, 1, 0))
    expect(toDigits(pt(10, 22, 5))).toBe('1005')
  })
  it('labels after-midnight times with Sun', () => {
    expect(fmtT(pt(10, 23, 12))).toBe('11:12 PM')
    expect(fmtT(pt(11, 1, 45))).toBe('Sun 1:45 AM')
  })
})

describe('projections', () => {
  it('before any check-in, projection = plan', () => {
    const p = projectRunner('zane', reduce([]), pt(10, 5, 0))
    expect(p.stations[2].proj).toBe(pt(10, 8, 10))
    expect(p.delta).toBeNull()
  })
  it('runner ahead: scales remaining legs by actual ÷ planned elapsed', () => {
    const s = reduce([ci('zane', 'start', pt(10, 6, 0)), ci('zane', 'sl2', pt(10, 11, 40))])
    const p = projectRunner('zane', s, pt(10, 11, 45))
    // plan SL2 = 6h08m elapsed; actual 5h40m → ratio 340/368
    expect(p.delta).toBe(-28 * MIN)
    expect(fmtAheadBehind(p.delta!)).toBe('28 min ahead')
    const r = 340 / 368
    expect(p.stations[5].proj).toBe(Math.round(pt(10, 11, 40) + r * 96 * MIN))   // BM2 leg 1h36 planned
    expect(p.stations[5].plan).toBe(pt(10, 13, 44))
    // cut-off margin is cautious: never assumes he keeps beating plan
    expect(p.stations[5].projSafe).toBe(pt(10, 11, 40) + 96 * MIN)
    expect(p.stations[5].spare).toBe(pt(10, 16, 0) - (pt(10, 11, 40) + 96 * MIN))
  })
  it('runner behind', () => {
    const s = reduce([ci('zane', 'start', pt(10, 6, 0)), ci('zane', 'sl2', pt(10, 12, 45))])
    const p = projectRunner('zane', s, pt(10, 12, 50))
    expect(fmtAheadBehind(p.delta!)).toBe('37 min behind')
    expect(p.ratio).toBeCloseTo(405 / 368, 6)
    expect(p.stations[5].proj).toBe(Math.round(pt(10, 12, 45) + (405 / 368) * 96 * MIN))
  })
  it('late start: ahead/behind measured from the actual crossing, cut-offs stay on the clock', () => {
    const s = reduce([ci('zane', 'start', pt(10, 6, 10)), ci('zane', 'bm1', pt(10, 7, 9))])
    const p = projectRunner('zane', s, pt(10, 7, 10))
    expect(p.delta).toBe(0)                                 // 59 min elapsed = plan
    expect(p.stations[2].proj).toBe(pt(10, 8, 20))           // 10 min later than plan clock
    expect(p.stations[2].spare).toBe(pt(10, 9, 30) - pt(10, 8, 20))
    expect(p.earlyEstimate).toBe(true)
  })
  it('a start delay with no check-ins yet shifts projections', () => {
    const s = reduce([ci('zane', 'start', pt(10, 6, 7))])
    const p = projectRunner('zane', s, pt(10, 6, 30))
    expect(p.stations[1].proj).toBe(pt(10, 7, 6))
  })
  it('projected cut-off miss is flagged with negative spare', () => {
    const s = reduce([ci('zane', 'start', pt(10, 6, 0)), ci('zane', 'bm2', pt(10, 15, 30))])
    const p = projectRunner('zane', s, pt(10, 15, 40))
    expect(p.nextCutoff?.st.id).toBe('bl')
    expect(p.nextCutoff!.spare!).toBeLessThan(0)
    expect(fmtSpare(p.nextCutoff!.spare!)).toMatch(/late/)
  })
  it('finish after midnight', () => {
    const s = reduce([ci('zane', 'start', pt(10, 6, 0)), ci('zane', 'ag', pt(10, 23, 50))])
    const p = projectRunner('zane', s, pt(11, 0, 0))
    expect(fmtT(p.stations[11].proj!)).toMatch(/^Sun /)
    expect(p.stations[11].proj!).toBeGreaterThan(pt(11, 2, 0))
    const done = projectRunner('zane', reduce([ci('zane', 'start', pt(10, 6, 0)), ci('zane', 'fin', pt(11, 1, 58))]), pt(11, 2, 0))
    expect(done.finished).toBe(true)
    expect(done.next).toBeNull()
  })
  it('dropped runner: no projections, no next station', () => {
    const s = reduce([ci('ryan', 'start', pt(10, 7, 30)), ev('status_set', { runner: 'ryan', dropped: true, station: 'co' })])
    const p = projectRunner('ryan', s, pt(10, 13, 0))
    expect(p.dropped).toBe(true)
    expect(p.stations.every(x => x.proj == null)).toBe(true)
    expect(p.next).toBeNull()
    const undrop = reduce([...[ev('status_set', { runner: 'ryan', dropped: true, station: 'co' }, { ts: 1 })], ev('status_set', { runner: 'ryan', dropped: false }, { ts: 2 })])
    expect(projectRunner('ryan', undrop, pt(10, 13, 0)).dropped).toBe(false)
  })
  it('runner with no plan yet gets no projections but still shows check-ins', () => {
    const s = reduce([ci('john', 'start', pt(10, 6, 0)), ci('john', 'sl1', pt(10, 8, 30))])
    const p = projectRunner('john', s, pt(10, 8, 40))
    expect(p.hasPlan).toBe(false)
    expect(p.delta).toBeNull()
    expect(p.stations[3].proj).toBeNull()
    expect(p.lastIdx).toBe(2)
  })
  it('missing plan times are filled by mileage between given ones', () => {
    const s = reduce([
      ev('plan_set', { runner: 'john', station: 'sl1', at: pt(10, 8, 0) }),
      ev('plan_set', { runner: 'john', station: 'sl2', at: pt(10, 12, 0) }),
    ])
    const p = projectRunner('john', s, pt(10, 5, 0))
    const bh = p.stations[3]
    expect(bh.planGiven).toBe(false)
    expect(bh.plan).toBe(Math.round(pt(10, 8, 0) + ((19.1 - 10.4) / (24.2 - 10.4)) * 4 * 3600_000))
  })
  it('"not logged yet" only after a 30-minute grace', () => {
    const s = reduce([ci('zane', 'start', pt(10, 6, 0))])
    expect(projectRunner('zane', s, pt(10, 7, 20)).overdue).toBeNull()
    expect(projectRunner('zane', s, pt(10, 7, 30))?.overdue?.st.id).toBe('bm1')
  })
})

describe('conflicts and history', () => {
  it('two people logging the same arrival: latest edit wins, same result in any order, history kept', () => {
    const a = ci('kevy', 'sl1', pt(10, 8, 20), { ts: pt(10, 8, 21), device: 'A' })
    const b = ci('kevy', 'sl1', pt(10, 8, 22), { ts: pt(10, 8, 25), device: 'B' })
    const s1 = reduce([a, b]), s2 = reduce([b, a])
    expect(s1.checkins.kevy.sl1.at).toBe(pt(10, 8, 22))
    expect(s2.checkins.kevy.sl1.at).toBe(pt(10, 8, 22))
    expect(s1.history.get('checkin:kevy:sl1')!.length).toBe(2)
  })
  it('a phone with a slow clock that saw an entry still overrides it (edit made after seeing it)', () => {
    const a = ci('kevy', 'sl1', pt(10, 8, 20), { ts: pt(10, 8, 21), device: 'A' })
    // B's clock is 5 minutes slow; it edits 2 minutes later after syncing A's entry
    const b = ci('kevy', 'sl1', pt(10, 8, 18), { ts: pt(10, 8, 23) - 5 * MIN, device: 'B', log: [a] })
    expect(reduce([a, b]).checkins.kevy.sl1.at).toBe(pt(10, 8, 18))
    expect(reduce([b, a]).checkins.kevy.sl1.at).toBe(pt(10, 8, 18))
  })
  it('undo brings back the previous value; remove clears a check-in', () => {
    const a = ci('zane', 'sl1', pt(10, 8, 10), { ts: 1 })
    const b = ci('zane', 'sl1', pt(10, 8, 40), { ts: 2 })
    const u = ev('undo', { targetEventId: b.id }, { ts: 3 })
    expect(reduce([a, b, u]).checkins.zane.sl1.at).toBe(pt(10, 8, 10))
    const c = ev('checkin_cleared', { runner: 'zane', station: 'sl1' }, { ts: 4 })
    expect(reduce([a, b, u, c]).checkins.zane.sl1).toBeUndefined()
  })
  it('duplicate re-sends of the same event change nothing', () => {
    const a = ci('zane', 'sl1', pt(10, 8, 10))
    expect(reduce([a, a, a]).checkins.zane.sl1.at).toBe(pt(10, 8, 10))
  })
  it('cut-off shifts are absolute: two people tapping "shift +15" at once shift it once', () => {
    const base = RACES['100k'].stations.find(s => s.id === 'bl')!.cutoff!
    const a = ev('cutoff_set', { race: '100k', station: 'bl', at: base + 15 * MIN }, { device: 'A', ts: 10 })
    const b = ev('cutoff_set', { race: '100k', station: 'bl', at: base + 15 * MIN }, { device: 'B', ts: 11 })
    expect(reduce([a, b]).cutoffs['100k'].bl).toBe(base + 15 * MIN)
    // 100K and 50K keep separate cut-offs at shared stations
    expect(reduce([a, b]).cutoffs['50k'].co).toBe(pt(10, 14, 0))
  })
})

describe('check-in safety checks', () => {
  const s = reduce([ci('zane', 'start', pt(10, 6, 0)), ci('zane', 'sl1', pt(10, 8, 10))])
  const p = projectRunner('zane', s, pt(10, 9, 0))
  it('same station within 10 min = duplicate; more = replaces', () => {
    expect(checkCheckin(p, 2, pt(10, 8, 15), { at: pt(10, 8, 10), by: 'Mom' }).duplicate).not.toBeNull()
    expect(checkCheckin(p, 2, pt(10, 8, 30), { at: pt(10, 8, 10), by: 'Mom' }).replaces).not.toBeNull()
  })
  it('warns (never blocks) on earlier-than-previous and impossibly fast', () => {
    expect(checkCheckin(p, 3, pt(10, 8, 0), null).warnings.join()).toMatch(/earlier than their Sugarloaf 1/)
    expect(checkCheckin(p, 3, pt(10, 9, 0), null).warnings.join()).toMatch(/very fast/)
    expect(checkCheckin(p, 3, pt(10, 11, 0), null).warnings).toEqual([])
  })
})

describe('crew meetings and requests', () => {
  const meet = (runner: string, station: string, who: string, ts = 1) => ev('meet_set', { runner, station, meeting: true, who }, { ts })
  it('next crew = next planned meeting (or any crew stop if none planned)', () => {
    const none = projectRunner('zane', reduce([]), pt(10, 5, 0))
    expect(none.nextMeet?.st.id).toBe('sl1')
    const s = reduce([meet('zane', 'bm2', 'Mom'), ci('zane', 'start', pt(10, 6, 0))])
    expect(projectRunner('zane', s, pt(10, 6, 5)).nextMeet?.st.id).toBe('bm2')
  })
  it('flags a clash when the same crew cannot leave one stop and reach the next (counts the trip out)', () => {
    const s = reduce([
      ev('plan_set', { runner: 'kevy', station: 'sl2', at: pt(10, 13, 30) }),
      ev('plan_set', { runner: 'kevy', station: 'fin', at: pt(11, 1, 0) }),
      meet('kevy', 'sl2', 'Mom'), meet('zane', 'bm2', 'Mom'),
    ])
    // Zane's BM2 plan 1:44 PM; Kevy's SL2 1:30 PM → leaving Sugarloaf (60) + BM2 (10) + 30 > gap
    const ms = upcomingMeetings(projectAll(s, pt(10, 6, 0)), s)
    expect(ms.find(m => m.runnerId === 'kevy')!.clashes.length).toBe(1)
    // different crew → no clash; same stop → never a clash
    const s2 = reduce([meet('kevy', 'sl2', 'Sam'), meet('zane', 'bm2', 'Mom'), ev('plan_set', { runner: 'kevy', station: 'sl2', at: pt(10, 13, 30) }), ev('plan_set', { runner: 'kevy', station: 'fin', at: pt(11, 1, 0) })])
    expect(upcomingMeetings(projectAll(s2, pt(10, 6, 0)), s2).every(m => m.clashes.length === 0)).toBe(true)
  })
  it('"be there by" for a runner who is behind uses plan pace from their last check-in, not the stale plan time', () => {
    const s = reduce([ci('zane', 'start', pt(10, 6, 0)), ci('zane', 'bm2', pt(10, 14, 44)), meet('zane', 'ss', 'Sam')])
    const p = projectRunner('zane', s, pt(10, 14, 50))
    const ss = p.stations[6]
    expect(ss.earliest).toBe(pt(10, 14, 44) + (16 * 60 + 6 - (13 * 60 + 44)) * MIN)   // BM2 + planned leg (2h22)
    expect(ss.earliest!).toBeGreaterThan(ss.plan!)
  })
  it('Aspen Glen → Finish is one shuttle hop: not a clash when there is time for it', () => {
    const s = reduce([
      ev('plan_set', { runner: 'john', station: 'ag', at: pt(10, 23, 50) }),
      ev('plan_set', { runner: 'john', station: 'fin', at: pt(11, 3, 0) }),
      meet('john', 'ag', 'Sam'), meet('zane', 'fin', 'Sam'),
    ])
    // Zane's plan finish 2:00 AM → be there 1:45; John at Aspen Glen ~11:50 PM → gap 1h55 > 30 + 30
    const ms = upcomingMeetings(projectAll(s, pt(10, 6, 0)), s)
    expect(ms.every(m => m.clashes.length === 0)).toBe(true)
  })
  it('requests go to the NEXT meeting after where the runner is, never the current stop', () => {
    const s = reduce([meet('zane', 'sl2', 'Mom'), meet('zane', 'bm2', 'Mom'), ci('zane', 'start', pt(10, 6, 0)), ci('zane', 'sl2', pt(10, 12, 0))])
    const p = projectRunner('zane', s, pt(10, 12, 5))
    expect(askTarget(p).station).toBe('bm2')
    expect(askTargetAfter(p, 4).station).toBe('bm2')
    expect(askTargetAfter(p, 8).station).toBeNull()       // no meeting after Bluff Lake
  })
  it('request clears only when the runner reaches the target or later — a late-syncing earlier check-in cannot clear it', () => {
    const base = [meet('zane', 'ag', 'Sam'), ci('zane', 'start', pt(10, 6, 0)), ci('zane', 'bl', pt(10, 19, 30))]
    const ask = ev('ask_sent', { runner: 'zane', items: ['Warm layer'], target: 'ag', targetWasMeeting: true, from: 'bl', at: pt(10, 19, 31) }, { ts: pt(10, 19, 31) })
    const lateCo = ci('zane', 'co', pt(10, 21, 20), { ts: pt(10, 23, 0) })
    let s = reduce([...base, ask, lateCo])
    expect(openAsks(s, projectAll(s, pt(10, 23, 0))).length).toBe(1)
    s = reduce([...base, ask, lateCo, ci('zane', 'ag', pt(10, 22, 50))])
    expect(openAsks(s, projectAll(s, pt(10, 23, 0))).length).toBe(0)
  })
  it('request target is frozen; "meeting moved" if the plan changes', () => {
    const m1 = meet('zane', 'ag', 'Sam', 1)
    const ask = ev('ask_sent', { runner: 'zane', items: ['Food'], target: 'ag', targetWasMeeting: true, at: pt(10, 19, 0) }, { ts: 2 })
    const moved = ev('meet_set', { runner: 'zane', station: 'ag', meeting: false, who: '' }, { ts: 3 })
    const m2 = meet('zane', 'fin', 'Sam', 4)
    const s = reduce([m1, ask, moved, m2])
    const p = projectRunner('zane', s, pt(10, 19, 5))
    expect(s.asks[0].target).toBe('ag')
    expect(askMeetingMoved(s.asks[0], s, p)).toBe(true)
  })
  it('"Got it" acknowledgement is recorded', () => {
    const ask = ev('ask_sent', { runner: 'zane', items: ['Food'], target: 'ag', at: 5 }, { ts: 5 })
    const ack = ev('ask_ack', { askId: ask.id }, { ts: 6, by: 'Sam' })
    expect(reduce([ask, ack]).asks[0].ackBy).toBe('Sam')
  })
})

describe('goal-time helper', () => {
  it('100K uses the 2025 finisher shares', () => {
    const p = planFromGoal(RACES['100k'], RACES['100k'].start, 20 * 3600_000, SHARES_100K)
    expect(p.fin).toBe(pt(11, 2, 0))
    expect(p.sl1).toBe(Math.round(pt(10, 6, 0) + 0.12046 * 20 * 3600_000))
  })
  it('50K spreads by distance + climbing and ends at the goal', () => {
    const p = planFromGoal(RACES['50k'], RACES['50k'].start, 7 * 3600_000, SHARES_100K)
    expect(p.start).toBe(pt(10, 7, 30))
    expect(p.fin).toBe(pt(10, 14, 30))
    expect(p.ss).toBeGreaterThan(p.start)
    expect(p.co).toBeGreaterThan(p.bl)
  })
})

describe('sample race day (test mode)', () => {
  it('produces the simulation scenario', () => {
    const at4pm = reduce(sampleEvents(pt(10, 16, 45)))
    const ps = projectAll(at4pm, pt(10, 16, 45))
    const by = (id: string) => ps.find(p => p.runnerId === id)!
    expect(by('zane').delta!).toBeLessThan(0)                     // ahead
    expect(by('john').delta!).toBeGreaterThan(0)                  // behind
    expect(by('kevy').nextCutoff?.st.id).toBe('bl')
    expect(by('kevy').nextCutoff!.spare!).toBeLessThan(0)          // projected to miss Bluff Lake
    expect(by('ryan').dropped).toBe(true)
    const late = reduce(sampleEvents(pt(11, 2, 0)))
    const lp = projectAll(late, pt(11, 2, 0))
    expect(lp.find(p => p.runnerId === 'zane')!.finished).toBe(true)
    expect(fmtT(late.checkins.zane.fin.at)).toBe('Sun 1:38 AM')
    expect(upcomingMeetings(projectAll(reduce(sampleEvents(pt(10, 9, 0))), pt(10, 9, 0)), reduce(sampleEvents(pt(10, 9, 0)))).some(m => m.clashes.length > 0)).toBe(true)
  })
})

// Sample race day for test mode and the simulation script (never used in real race data).
// Zane ahead of plan after a late start · John behind · Kevy projected to miss Bluff Lake's 9:00 PM cut-off ·
// Ryan dropped at Camp Osito · finishes after midnight · crew meetings (with one clash) · runner requests.
import { pt, RACES, SHARES_100K } from '../data/course'
import { planFromGoal } from './projection'
import type { KEvent } from './events'

type Item = { at: number; by: string; type: string; payload: Record<string, unknown> }

const h = (hh: number, mm: number) => pt(10, hh, mm)
const sun = (hh: number, mm: number) => pt(11, hh, mm)

function items(): Item[] {
  const out: Item[] = []
  const setup = pt(9, 20, 0)   // plans + meetings entered Friday night
  const plan = (runner: string, race: '100k' | '50k', goalH: number, goalM: number, by: string) => {
    const p = planFromGoal(RACES[race], RACES[race].start, (goalH * 60 + goalM) * 60_000, SHARES_100K)
    for (const [station, at] of Object.entries(p)) out.push({ at: setup, by, type: 'plan_set', payload: { runner, station, at } })
  }
  plan('john', '100k', 18, 30, 'John')
  plan('kevy', '100k', 19, 30, 'Kevy')
  plan('ryan', '50k', 7, 0, 'Ryan')
  const meet = (runner: string, station: string, who: string) => out.push({ at: setup + 60_000, by: 'Zane', type: 'meet_set', payload: { runner, station, meeting: true, who } })
  for (const n of ['Mom & Dad', 'Sam']) out.push({ at: setup, by: 'Zane', type: 'crew_name_set', payload: { name: n, active: true } })
  meet('zane', 'sl1', 'Mom & Dad'); meet('zane', 'sl2', 'Mom & Dad'); meet('zane', 'bm2', 'Sam'); meet('zane', 'ss', 'Sam'); meet('zane', 'ag', 'Sam'); meet('zane', 'fin', 'Sam')
  meet('john', 'sl2', 'Mom & Dad'); meet('john', 'ss', 'Sam'); meet('john', 'ag', 'Sam')
  meet('kevy', 'sl2', 'Mom & Dad'); meet('kevy', 'ss', 'Sam')
  meet('ryan', 'ss', 'Sam')
  meet('ryan', 'ag', 'Mom & Dad')        // the one clash: Mom & Dad can't be at Sugarloaf 2 and Aspen Glen at the same time

  const ci = (runner: string, station: string, at: number, by: string, note = '') => out.push({ at: at + 60_000, by, type: 'checkin_set', payload: { runner, station, at, note } })
  // Zane: started 4 min late, then ahead of plan
  ci('zane', 'start', h(6, 4), 'Mom & Dad'); ci('zane', 'bm1', h(6, 58), 'Zane'); ci('zane', 'sl1', h(8, 2), 'Mom & Dad'); ci('zane', 'bh', h(10, 52), 'Zane')
  ci('zane', 'sl2', h(11, 55), 'Mom & Dad'); ci('zane', 'bm2', h(13, 30), 'Mom & Dad'); ci('zane', 'ss', h(15, 50), 'Sam'); ci('zane', 'hg', h(17, 25), 'Zane')
  ci('zane', 'bl', h(19, 31), 'Zane'); ci('zane', 'co', h(21, 22), 'Zane'); ci('zane', 'ag', h(22, 48), 'Sam'); ci('zane', 'fin', sun(1, 38), 'Sam')
  // John: behind plan
  ci('john', 'start', h(6, 4), 'Mom & Dad'); ci('john', 'bm1', h(7, 9), 'John'); ci('john', 'sl1', h(8, 38), 'Mom & Dad'); ci('john', 'bh', h(11, 52), 'John')
  ci('john', 'sl2', h(13, 2), 'Mom & Dad'); ci('john', 'bm2', h(14, 52), 'Mom & Dad'); ci('john', 'ss', h(17, 31), 'Sam')
  ci('john', 'bl', h(20, 5), 'Sam'); ci('john', 'ag', h(22, 50), 'Sam'); ci('john', 'fin', sun(1, 12), 'Sam')
  // Kevy: falling behind → projected to miss Bluff Lake (9:00 PM), then pulled there
  ci('kevy', 'start', h(6, 4), 'Mom & Dad'); ci('kevy', 'bm1', h(7, 16), 'Kevy'); ci('kevy', 'sl1', h(8, 52), 'Mom & Dad'); ci('kevy', 'bh', h(12, 22), 'Kevy')
  ci('kevy', 'sl2', h(13, 38), 'Mom & Dad'); ci('kevy', 'bm2', h(15, 31), 'Kevy')
  out.push({ at: h(21, 25), by: 'Kevy', type: 'status_set', payload: { runner: 'kevy', dropped: true, station: 'bl' } })
  // Ryan: 50K, dropped at Camp Osito
  ci('ryan', 'start', h(7, 31), 'Sam'); ci('ryan', 'ss', h(8, 52), 'Sam'); ci('ryan', 'hg', h(9, 41), 'Ryan'); ci('ryan', 'bl', h(10, 50), 'Ryan'); ci('ryan', 'co', h(12, 36), 'Ryan')
  out.push({ at: h(12, 50), by: 'Ryan', type: 'status_set', payload: { runner: 'ryan', dropped: true, station: 'co' } })
  // Requests
  out.push({ at: h(11, 0), by: 'John', type: 'ask_sent', payload: { runner: 'john', items: ['Dry socks'], text: '', target: 'sl2', targetWasMeeting: true, from: 'bh', at: h(11, 0) } })
  out.push({ at: h(19, 32), by: 'Zane', type: 'ask_sent', payload: { runner: 'zane', items: ['Warm layer', 'Caffeine'], text: '', target: 'ag', targetWasMeeting: true, from: 'bl', at: h(19, 32) } })
  out.push({ at: h(20, 10), by: 'Sam', type: 'ask_ack', payload: { askId: 'sample-ask-zane' } })
  return out
}

/** Sample events up to `upTo` (the test clock), with fixed ids so loading twice never duplicates. */
export function sampleEvents(upTo: number): KEvent[] {
  const evs: KEvent[] = []
  let seen = 0
  const list = items().sort((a, b) => a.at - b.at)
  list.forEach((it, i) => {
    if (it.at > upTo) return
    const id = it.type === 'ask_sent' ? `sample-ask-${it.payload.runner}` : `sample-${String(i).padStart(3, '0')}`
    evs.push({ id, v: 1, ts: it.at, seenTs: seen, deviceId: 'sample', by: it.by, type: it.type, payload: it.payload })
    seen = Math.max(seen, it.at)
  })
  return evs
}

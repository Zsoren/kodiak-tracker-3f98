import type { RunnerProj } from './projection'
import { fmtT } from './time'

export const DUPLICATE_WINDOW_MS = 10 * 60_000

export interface CheckinCheck {
  /** same runner + station already logged within 10 min of this time → treat as a duplicate */
  duplicate: { at: number; by: string } | null
  /** an existing check-in this would replace (more than 10 min different) */
  replaces: { at: number; by: string } | null
  /** warnings, never blocks */
  warnings: string[]
}

export function checkCheckin(p: RunnerProj, stationIdx: number, at: number, existing: { at: number; by: string } | null): CheckinCheck {
  const out: CheckinCheck = { duplicate: null, replaces: null, warnings: [] }
  if (existing) {
    if (Math.abs(existing.at - at) <= DUPLICATE_WINDOW_MS) out.duplicate = existing
    else out.replaces = existing
  }
  // earlier than a previous station's check-in?
  for (const sp of p.stations) {
    if (sp.idx >= stationIdx || sp.actual == null) continue
    if (at < sp.actual) { out.warnings.push(`That's earlier than their ${sp.st.name} check-in (${fmtT(sp.actual)}). Right station?`); break }
  }
  // later station already logged earlier than this?
  for (const sp of p.stations) {
    if (sp.idx <= stationIdx || sp.actual == null) continue
    if (at > sp.actual) { out.warnings.push(`They're already logged at ${sp.st.name} (${fmtT(sp.actual)}), which is earlier than this. Right station?`); break }
  }
  // impossibly fast section (under 60% of plan) from the previous logged station
  let prev = null as null | (typeof p.stations)[number]
  for (const sp of p.stations) if (sp.idx < stationIdx && (sp.actual != null || sp.idx === 0)) prev = sp
  const here = p.stations[stationIdx]
  if (prev && here?.plan != null && prev.plan != null) {
    const prevAt = prev.actual ?? p.actualStart
    const planLeg = here.plan - prev.plan
    const actLeg = at - prevAt
    if (planLeg > 20 * 60_000 && actLeg > 0 && actLeg < 0.6 * planLeg) {
      out.warnings.push(`That's very fast from ${prev.st.name} (${Math.round(actLeg / 60000)} min vs ${Math.round(planLeg / 60000)} planned). Right station?`)
    }
  }
  if (stationIdx > 0 && at < p.race.start - 30 * 60_000) out.warnings.push('That time is before the race starts.')
  return out
}

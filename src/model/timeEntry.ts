// Colon-free time entry: people type digits only ("1030" → 10:30), so a numbers-only phone keypad always works.
// AM/PM and the day (Fri/Sat/Sun of race weekend) are inferred, then shown in words so the person confirms by reading.
import { pt } from '../data/course'

export interface ParsedTime { h: number; m: number; is24: boolean }
export type ParseResult = ParsedTime | 'empty' | 'incomplete' | 'invalid'

/** Digits → hour/minute. 1–2 digits = hour ("9" = 9:00), 3 = H:MM ("930"), 4 = HH:MM ("0930", "2130"). */
export function parseDigits(raw: string): ParseResult {
  const d = raw.replace(/\D/g, '')
  if (d.length === 0) return 'empty'
  if (d.length > 4) return 'invalid'
  let h: number, m: number, leadingZero = false
  if (d.length <= 2) {
    h = +d; m = 0
    if (h > 23) return d.length === 2 ? 'incomplete' : 'invalid'
    leadingZero = d.length === 2 && d[0] === '0'
  } else if (d.length === 3) {
    h = +d[0]; m = +d.slice(1)
  } else {
    h = +d.slice(0, 2); m = +d.slice(2)
    leadingZero = d[0] === '0'
    if (h > 23) return 'invalid'
  }
  if (m > 59) return 'invalid'
  const is24 = h === 0 || h >= 13 || leadingZero
  return { h, m, is24 }
}

const DAYS = [9, 10, 11] as const

/** Every race-weekend moment this entry could mean. */
export function candidates(p: ParsedTime): number[] {
  const hours = p.is24 ? [p.h] : [p.h % 12, (p.h % 12) + 12]
  const out: number[] = []
  for (const day of DAYS) for (const h of hours) out.push(pt(day, h, p.m))
  return out.sort((a, b) => a - b)
}

/**
 * Pick the most likely moment.
 * - `after` (plans): the first moment at or after the previous station's time.
 * - `near` (check-ins): the moment closest to the runner's expected time / now.
 */
export function resolveTime(p: ParsedTime, opts: { after?: number | null; near?: number | null }): number {
  const c = candidates(p)
  if (opts.after != null) {
    const hit = c.find(t => t >= opts.after!)
    if (hit != null) return hit
    return c[c.length - 1]
  }
  const near = opts.near ?? pt(10, 12, 0)
  let best = c[0]
  for (const t of c) if (Math.abs(t - near) < Math.abs(best - near)) best = t
  return best
}

/** Flip AM/PM (±12 h) keeping the same calendar day where possible. */
export function flipAmPm(ts: number): number {
  const h = new Date(ts - 7 * 3600_000).getUTCHours()
  return h >= 12 ? ts - 12 * 3600_000 : ts + 12 * 3600_000
}

/** Move to the other race day: Sat ↔ Sun (Fri → Sat). */
export function flipDay(ts: number): number {
  const day = new Date(ts - 7 * 3600_000).getUTCDate()
  return day >= 11 ? ts - 24 * 3600_000 : ts + 24 * 3600_000
}

/** Digits for an existing time, for editing ("10:30 PM" → "1030" in 12-hour form). */
export function toDigits(ts: number): string {
  const d = new Date(ts - 7 * 3600_000)
  const h = d.getUTCHours() % 12 || 12
  return `${h}${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export const TZ = 'America/Los_Angeles'

const partsFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
const clockFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true })

function parts(ts: number) {
  const out: Record<string, string> = {}
  for (const p of partsFmt.formatToParts(new Date(ts))) out[p.type] = p.value
  return out
}

/** "4:31 PM" */
export function fmtClock(ts: number): string {
  return clockFmt.format(new Date(ts)).replace(/\s/g, ' ')
}

/** Race Saturday is Oct 10. */
export function isRaceSat(ts: number): boolean {
  const p = parts(ts)
  return p.month === '10' && p.day === '10'
}

export function weekday(ts: number): string {
  return parts(ts).weekday
}

/** "4:31 PM" on race Saturday, otherwise prefixed with the day: "Sun 1:45 AM". */
export function fmtT(ts: number | null | undefined): string {
  if (ts == null || !isFinite(ts)) return '—'
  return isRaceSat(ts) ? fmtClock(ts) : `${weekday(ts)} ${fmtClock(ts)}`
}

/** Always with day: "Sat 9:30 PM" */
export function fmtDayT(ts: number): string {
  return `${weekday(ts)} ${fmtClock(ts)}`
}

/** "just now" / "12 min ago" / "2h 05m ago" */
export function fmtAgo(ts: number | null, now: number): string {
  if (ts == null) return 'never'
  const m = Math.round((now - ts) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m ago`
}

/** Duration in ms → "38 min" / "2h 05m" */
export function fmtDur(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000))
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

/** Signed minutes vs plan (positive = behind). → { word: 'AHEAD'|'BEHIND'|'ON PLAN', text: '12 MIN' } */
export function aheadBehind(deltaMs: number): { sign: '+' | '−' | '', mins: number, word: 'ahead' | 'behind' | 'on plan' } {
  const m = Math.round(deltaMs / 60000)
  if (m === 0) return { sign: '', mins: 0, word: 'on plan' }
  return m > 0 ? { sign: '−', mins: m, word: 'behind' } : { sign: '+', mins: -m, word: 'ahead' }
}

/** "12 min ahead" / "1h 05m behind" / "on plan" */
export function fmtAheadBehind(deltaMs: number): string {
  const ab = aheadBehind(deltaMs)
  if (ab.word === 'on plan') return 'on plan'
  const body = ab.mins < 60 ? `${ab.mins} min` : `${Math.floor(ab.mins / 60)}h ${String(ab.mins % 60).padStart(2, '0')}m`
  return `${body} ${ab.word}`
}

/** Spare minutes → "47 min spare" / "12 min LATE" */
export function fmtSpare(ms: number): string {
  const m = Math.round(ms / 60000)
  if (m >= 0) return m < 60 ? `${m} min spare` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m spare`
  const a = -m
  return a < 60 ? `${a} min late` : `${Math.floor(a / 60)}h ${String(a % 60).padStart(2, '0')}m late`
}

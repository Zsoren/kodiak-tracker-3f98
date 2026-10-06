import { useState } from 'react'
import { flipAmPm, flipDay, parseDigits, resolveTime, toDigits } from '../model/timeEntry'
import { fmtDayT, fmtT } from '../model/time'
import { store } from '../state/store'

/**
 * Colon-free time typing. Works with any phone keypad (digits only): "1030" → 10:30.
 * The full reading ("Sat 9:30 PM") is shown in words with one-tap AM/PM and day flips.
 */
export function TimeEntry({ initial, after, near, onChange, autoFocus = true }: {
  initial?: number | null
  /** plans: first time at/after this */
  after?: number | null
  /** check-ins: closest to this */
  near?: number | null
  onChange: (ts: number | null) => void
  autoFocus?: boolean
}) {
  const [digits, setDigits] = useState(initial != null ? toDigits(initial) : '')
  const [override, setOverride] = useState<number | null>(initial ?? null)
  const parsed = parseDigits(digits)
  const resolved = typeof parsed === 'object' ? resolveTime(parsed, { after, near }) : null
  const value = override ?? resolved

  const set = (d: string) => {
    const clean = d.replace(/\D/g, '').slice(0, 4)
    setDigits(clean)
    setOverride(null)
    const p = parseDigits(clean)
    onChange(typeof p === 'object' ? resolveTime(p, { after, near }) : null)
  }
  const flip = (f: (t: number) => number) => {
    if (value == null) return
    const v = f(value)
    setOverride(v); onChange(v)
  }

  return (
    <div>
      <input
        className="digits" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" enterKeyHint="done"
        placeholder="e.g. 930 or 2130" aria-label="Time, digits only" value={digits} autoFocus={autoFocus}
        onChange={e => set(e.target.value)}
      />
      {parsed === 'invalid'
        ? <div className="reading bad">That isn't a time — minutes must be 00–59 (e.g. 930 = 9:30).</div>
        : value != null
          ? <div className="reading">{fmtDayT(value)}</div>
          : <div className="reading muted small" style={{ fontSize: 16 }}>Type digits only — no colon needed. 930 = 9:30, 1030 = 10:30, 2130 = 9:30 PM.</div>}
      {value != null && (
        <div className="chips">
          <button className="chip sm" onClick={() => flip(flipAmPm)}>AM ⇄ PM</button>
          <button className="chip sm" onClick={() => flip(flipDay)}>Sat ⇄ Sun</button>
        </div>
      )}
    </div>
  )
}

/** Big time with quick-adjust chips (−15 −5 −1 +1 +5 Now) and a "type exact time" fallback. */
export function TimeEdit({ value, onChange, near }: { value: number; onChange: (ts: number) => void; near?: number | null }) {
  const [typing, setTyping] = useState(false)
  const adj = (m: number) => onChange(value + m * 60_000)
  return (
    <div>
      <div className="row">
        <div className="bigtime grow">{fmtT(value)}</div>
        <button className="link" onClick={() => setTyping(t => !t)}>{typing ? 'Done' : 'Type exact time'}</button>
      </div>
      {typing
        ? <div style={{ marginTop: 8 }}><TimeEntry initial={value} near={near ?? value} onChange={t => { if (t != null) onChange(t) }} /></div>
        : (
          <div className="tchips">
            <button className="chip" onClick={() => adj(-15)}>−15</button>
            <button className="chip" onClick={() => adj(-5)}>−5</button>
            <button className="chip" onClick={() => adj(-1)}>−1</button>
            <button className="chip" onClick={() => adj(1)}>+1</button>
            <button className="chip" onClick={() => adj(5)}>+5</button>
            <button className="chip" onClick={() => onChange(roundMin(store.now()))}>Now</button>
          </div>
        )}
    </div>
  )
}

export function roundMin(ts: number): number { return Math.floor(ts / 60_000) * 60_000 }

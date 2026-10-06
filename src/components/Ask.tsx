import { useState } from 'react'
import type { RunnerProj } from '../model/projection'
import { askTarget, nextMeetingFor } from '../model/projection'
import { fmtT } from '../model/time'
import { store, type Snapshot } from '../state/store'
import { Overlay } from './Sheet'
import { go } from '../state/router'

export const PRESETS = ['Dry socks', 'Warm layer', 'Headlamp/ batteries', 'Food', 'Caffeine', 'Blister/ chafe']

export function cleanPreset(p: string): string { return p.replace(/\/ /g, '/') }

/** 2×3 preset grid + "Type…" link. Pocket-safe: toggling a preset is harmless. */
export function AskPicker({ selected, onToggle, text, onText }: { selected: string[]; onToggle: (p: string) => void; text: string; onText: (t: string) => void }) {
  const [typing, setTyping] = useState(!!text)
  return (
    <div>
      {typing && <input className="plain" type="text" placeholder="e.g. new shirt" value={text} onChange={e => onText(e.target.value)} style={{ marginBottom: 8 }} autoFocus />}
      <div className="presets">
        {PRESETS.map(p => {
          const v = cleanPreset(p)
          return <button key={p} className={`chip ${selected.includes(v) ? 'sel' : ''}`} aria-pressed={selected.includes(v)} onClick={() => onToggle(v)}>{p}</button>
        })}
      </div>
      {!typing && <button className="link" style={{ minHeight: 44 }} onClick={() => setTyping(true)}>Type…</button>}
    </div>
  )
}

export function askSummary(items: string[], text: string): string {
  return [...items.map(i => i.toLowerCase()), text.trim()].filter(Boolean).join(', ')
}

/** Phone number to text: whoever is going to that meeting, else the crew chief. One number only. */
export function textNumber(snap: Snapshot, p: RunnerProj): string {
  const who = nextMeetingFor(p, snap.state)?.who.trim().toLowerCase()
  if (who) for (const [name, num] of Object.entries(snap.settings.crewPhones)) if (name.trim().toLowerCase() === who && num.trim()) return num.trim()
  return snap.settings.crewChief.trim()
}

export function smsHref(number: string, body: string): string {
  // "?&body=" is understood by both iPhone and Android Messages.
  return `sms:${number.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(body)}`
}

export function smsBody(p: RunnerProj, summary: string, at: number, targetName: string): string {
  const last = p.stations[p.lastIdx]
  const where = p.lastIdx > 0 ? `after ${last.st.name}` : 'pre-start'
  return `${p.name} (${where}, ${fmtT(at)}): ${summary} — for ${targetName}`
}

/** Result after sending: ✓ Sent / ⧗ Not sent yet, plus the "Also send as text" button. */
export function AskResult({ snap, eventId, body, number }: { snap: Snapshot; eventId: string; body: string; number: string }) {
  const sent = snap.synced.has(eventId)
  let line: string
  if (sent) line = '✓ Sent — crew will see it when they open the app.'
  else if (snap.sync.mode === 'off') line = '⧗ Not sent — sharing isn\'t set up on this phone yet.'
  else if (snap.sync.syncing) line = 'Sending…'
  else line = '⧗ Not sent yet — will send next time you open the app with signal.'
  return (
    <div className="logged">
      <div className={sent ? 'bold' : 'notsent'} style={{ fontSize: 18 }}>{line}</div>
      {!sent && <div className="muted small">Not sent and it matters? Tap <b>Also send as text</b> — your phone keeps trying even when locked.</div>}
      {number
        ? <a className={sent ? 'btn wide' : 'bigbtn'} style={{ textDecoration: 'none', minHeight: 60, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }} href={smsHref(number, body)}>Also send as text</a>
        : <button className="btn wide" onClick={() => go('more')}>Add your crew chief's number (More) to text</button>}
    </div>
  )
}

/** Full-screen "Ask crew" (from My Race). SEND sits mid-screen; presets sit in the bottom thumb zone. */
export function AskOverlay({ snap, p, onClose }: { snap: Snapshot; p: RunnerProj; onClose: () => void }) {
  const [items, setItems] = useState<string[]>([])
  const [text, setText] = useState('')
  const [sentId, setSentId] = useState<string | null>(null)
  const [sentAt, setSentAt] = useState(0)
  const target = askTarget(p)
  const toggle = (v: string) => setItems(xs => (xs.includes(v) ? xs.filter(x => x !== v) : [...xs, v]))
  const summary = askSummary(items, text)
  const send = () => {
    const at = store.now()
    const e = store.dispatch('ask_sent', { runner: p.runnerId, items, text: text.trim(), target: target.station, targetWasMeeting: target.isMeeting, from: p.stations[p.lastIdx]?.st.id ?? null, at })
    setSentId(e.id); setSentAt(at)
  }
  return (
    <Overlay label="Ask crew">
      <div className="top">
        <h2 style={{ fontSize: 28 }}>{target.station ? `Ask crew for ${target.name}` : 'Ask crew'}</h2>
        <div className="muted">{target.station
          ? (target.isMeeting ? 'Your next planned crew meeting.' : 'Next stop where crew can meet you (no meetings planned yet).')
          : 'No crew planned before the Finish — you can still send it.'}</div>
      </div>
      <div className="mid">
        {sentId
          ? <AskResult snap={snap} eventId={sentId} body={smsBody(p, askSummary(items, text), sentAt, target.name)} number={textNumber(snap, p)} />
          : <>
            <div className="reading" style={{ minHeight: 30 }}>{summary || <span className="muted" style={{ fontSize: 18 }}>Pick what you need below</span>}</div>
            <button className="confirmbtn" disabled={!summary} onClick={send}>Send to crew</button>
          </>}
        <button className="cancelbtn" onClick={onClose}>{sentId ? 'Done' : 'Cancel'}</button>
      </div>
      {!sentId && <div className="bottom"><AskPicker selected={items} onToggle={toggle} text={text} onText={setText} /></div>}
    </Overlay>
  )
}

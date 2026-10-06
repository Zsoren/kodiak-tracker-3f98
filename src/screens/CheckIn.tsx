import { useState } from 'react'
import { store, type Snapshot } from '../state/store'
import { RUNNERS } from '../data/course'
import { fmtT } from '../model/time'
import { checkCheckin } from '../model/checks'
import { TimeEdit, roundMin } from '../components/TimeEntry'
import { StatusLine } from '../components/StatusLine'
import { Sheet } from '../components/Sheet'
import { EditCheckin } from './RunnerDetail'
import { go } from '../state/router'

/** Crew check-in, built for one hand: runner → (pre-selected) station → ARRIVED. */
export function CheckIn({ snap, runner }: { snap: Snapshot; runner?: string }) {
  const runnerId = runner && RUNNERS.some(r => r.id === runner) ? runner : null
  const p = runnerId ? snap.projs.find(x => x.runnerId === runnerId)! : null
  const expected = p ? (!p.startLogged && p.lastIdx === 0 ? 0 : Math.min(p.lastIdx + 1, p.stations.length - 1)) : 0
  const [sel, setSel] = useState<{ runner: string; idx: number } | null>(null)
  const idx = sel && sel.runner === runnerId ? sel.idx : expected
  const [at, setAt] = useState(() => roundMin(store.now()))
  const [note, setNote] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [banner, setBanner] = useState<{ ids: string[]; text: string; runner: string; idx: number } | null>(null)
  const [editing, setEditing] = useState<{ runner: string; idx: number } | null>(null)

  const sp = p?.stations[idx]
  const existing = p && sp ? snap.state.checkins[p.runnerId]?.[sp.st.id] : undefined
  const chk = p && sp ? checkCheckin(p, idx, at, existing ? { at: existing.at, by: existing.by } : null) : null

  const pickRunner = (id: string) => { setBanner(null); setSel(null); setAt(roundMin(store.now())); setNote(''); setNoteOpen(false); go('checkin/' + id) }
  const pickStation = (i: number) => { setBanner(null); setSel({ runner: runnerId!, idx: i }); setAt(roundMin(store.now())) }

  const log = () => {
    if (!p || !sp || !chk) return
    if (chk.duplicate) { setBanner({ ids: [], text: `Already logged ${p.name} · ${sp.st.name} · ${fmtT(chk.duplicate.at)} (${chk.duplicate.by})`, runner: p.runnerId, idx }); return }
    const e = store.dispatch('checkin_set', { runner: p.runnerId, station: sp.st.id, at, note: note.trim() })
    setBanner({ ids: [e.id], text: `Logged ${p.name} · ${sp.st.name} · ${fmtT(at)}`, runner: p.runnerId, idx })
    setSel(null); setNote(''); setNoteOpen(false)
  }

  const label = !sp ? '' : chk?.duplicate ? 'ALREADY LOGGED' : chk?.replaces ? `UPDATE TO ${fmtT(at)}` : idx === 0 ? 'STARTED' : idx === (p?.stations.length ?? 0) - 1 ? 'FINISHED' : 'ARRIVED'

  return (
    <div className="page">
      <h1 className="title">Check in</h1>
      <StatusLine snap={snap} compact />
      {banner && (
        <div className="banner amber" role="status">
          <span className="grow bold">{banner.text}</span>
          {banner.ids.length > 0 && <button onClick={() => { store.undo(banner.ids); setBanner(null) }}>Undo</button>}
          {banner.ids.length > 0 && <button onClick={() => { setEditing({ runner: banner.runner, idx: banner.idx }); setBanner(null) }}>Edit</button>}
        </div>
      )}
      <div className="runners">
        {snap.projs.map(r => (
          <button key={r.runnerId} className={`chip ${r.runnerId === runnerId ? 'sel' : ''}`} onClick={() => pickRunner(r.runnerId)} style={r.dropped ? { opacity: 0.55 } : undefined}>
            {r.name}
          </button>
        ))}
      </div>
      {!p && <div className="muted" style={{ marginTop: 14 }}>Pick a runner.</div>}
      {p && (
        <>
          {p.dropped && <div className="warnbox">{p.name} is marked dropped.</div>}
          <div className="slist" style={{ marginTop: 10 }}>
            {p.stations.map(s => (
              <button key={s.st.id} className={`srow ${s.actual != null ? 'done' : ''} ${s.idx === idx ? 'sel' : ''}`} onClick={() => pickStation(s.idx)} aria-pressed={s.idx === idx}>
                <span className="sn">{s.st.name} {s.st.crew && <span className="tag crew">CREW</span>}</span>
                <span className="st">{s.actual != null ? `✓ ${fmtT(s.actual)}` : s.proj != null ? `~${fmtT(s.proj)}` : ''}</span>
                {s.idx === expected && s.actual == null && <span className="sm amber">expected next</span>}
              </button>
            ))}
          </div>
          <div className="ci-panel">
            <div className="muted small">{p.name} · <b style={{ color: '#fff' }}>{sp?.st.name}</b>{existing ? ` · logged ${fmtT(existing.at)} by ${existing.by}` : ''}</div>
            <TimeEdit value={at} onChange={t => { setBanner(null); setAt(t) }} near={sp?.proj ?? sp?.plan ?? store.now()} />
            {chk?.replaces && <div className="warnbox">Replaces {fmtT(chk.replaces.at)} (logged by {chk.replaces.by}).</div>}
            {chk?.warnings.map(w => <div key={w} className="warnbox">{w}</div>)}
            {noteOpen
              ? <input className="plain" type="text" placeholder='Note, e.g. "needs new socks"' value={note} onChange={e => setNote(e.target.value)} style={{ marginBottom: 8 }} autoFocus />
              : <button className="link" onClick={() => setNoteOpen(true)}>+ Add a note</button>}
            <button className="bigbtn" onClick={log}>{label}</button>
          </div>
        </>
      )}
      <Sheet open={!!editing} onClose={() => setEditing(null)}>
        {editing && <EditCheckin snap={snap} runnerId={editing.runner} sp={snap.projs.find(x => x.runnerId === editing.runner)!.stations[editing.idx]} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  )
}

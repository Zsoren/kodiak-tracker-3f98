import { useState } from 'react'
import { store, type Snapshot } from '../state/store'
import { openAsks, stationName, type StationProj } from '../model/projection'
import { fmtAheadBehind, fmtSpare, fmtT } from '../model/time'
import { LIVETRAIL_URL } from '../data/course'
import { Sheet } from '../components/Sheet'
import { TimeEdit, roundMin } from '../components/TimeEntry'
import { MeetEditor } from '../components/MeetEditor'
import { AskLine } from './Crew'
import { checkCheckin } from '../model/checks'

/** "All stations" for one runner: projections, plan, cut-offs, check-ins (edit/remove), meetings, drop. */
export function RunnerDetail({ snap, id }: { snap: Snapshot; id: string }) {
  const p = snap.projs.find(x => x.runnerId === id)
  const [edit, setEdit] = useState<StationProj | null>(null)
  const [meetEdit, setMeetEdit] = useState<string | null>(null)
  const [dropOpen, setDropOpen] = useState(false)
  if (!p) return <div className="page">Unknown runner</div>
  const asks = openAsks(snap.state, [p]).filter(a => a.runner === id)
  const link = snap.state.links[id] || LIVETRAIL_URL
  const hist = [...snap.state.history.entries()].filter(([k]) => k.startsWith(`checkin:${id}:`)).flatMap(([, evs]) => evs).sort((a, b) => b.ts - a.ts).slice(0, 12)

  return (
    <div className="page">
      <a className="link" href="#/crew">‹ Crew</a>
      <div className="row"><h1 className="title grow">{p.name} <span className="tag out">{p.race.name}</span></h1>{p.delta != null && <span className="bold">{fmtAheadBehind(p.delta)}</span>}</div>
      {p.dropped && <div className="banner red"><span className="grow">Dropped{p.droppedAt ? ` at ${stationName(p.race.id, p.droppedAt)}` : ''} (by {snap.state.status[id]?.by})</span><button className="plain" onClick={() => store.dispatch('status_set', { runner: id, dropped: false })}>Undo drop</button></div>}
      {asks.map(a => <AskLine key={a.id} snap={snap} a={a} p={p} />)}
      <div className="slist" style={{ marginTop: 10 }}>
        {p.stations.map(sp => {
          const meeting = sp.meet?.meeting
          const cutCls = sp.spare == null || sp.actual != null ? '' : sp.spare < 0 ? 'bad' : sp.spare < 3600_000 ? 'amber' : ''
          return (
            <div key={sp.st.id} className={`srow ${sp.actual != null ? 'done' : ''} ${sp.idx === p.lastIdx + 1 && !p.dropped ? 'sel' : ''}`} onClick={() => setEdit(sp)} role="button" tabIndex={0}>
              <span className="sn">
                {sp.st.name}{' '}
                {sp.st.crew && <span className={`tag ${meeting ? 'crew' : 'out'}`}>{meeting ? `MEET${sp.meet?.who ? ' · ' + sp.meet.who : ''}` : 'CREW OK'}</span>}{' '}
                {sp.st.dropBag && <span className="tag">BAG</span>}
              </span>
              <span className="st">{sp.actual != null ? `✓ ${fmtT(sp.actual)}` : sp.proj != null ? `~${fmtT(sp.proj)}` : '—'}</span>
              <span className="sm">mi {sp.st.mile}{sp.plan != null && <> · plan {fmtT(sp.plan)}{!sp.planGiven && ' (est.)'}</>}{sp.st.tag && <> · {sp.st.tag}</>}</span>
              <span className={`sm cutline ${cutCls}`} style={{ textAlign: 'right' }}>{sp.cutoff != null ? <>cut {fmtT(sp.cutoff)}{sp.spare != null && sp.actual == null && <> · {fmtSpare(sp.spare)}</>}</> : ''}</span>
              {sp.st.crew && <span className="tiny muted" style={{ gridColumn: '1 / -1' }}>{sp.st.crewNote}</span>}
              {sp.st.crew && <button className="link" style={{ gridColumn: '1 / -1', justifySelf: 'start', minHeight: 40 }} onClick={e => { e.stopPropagation(); setMeetEdit(sp.st.id) }}>{meeting ? 'Change meeting' : 'Plan a meeting here'}</button>}
            </div>
          )
        })}
      </div>

      <div className="btnrow" style={{ marginTop: 14 }}>
        {!p.dropped && <button className="btn danger" onClick={() => setDropOpen(true)}>Mark dropped</button>}
        <a className="btn" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} href={link} target="_blank" rel="noreferrer">LiveTrail ↗</a>
      </div>
      <div className="tiny muted">LiveTrail shows official times at some checkpoints only and can lag up to 2 hours. Use it to fill in no-crew stations: tap a station above and set the time.</div>

      {hist.length > 0 && <>
        <h2 className="sub">Check-in history</h2>
        {hist.map(e => (
          <div key={e.id} className="line small">
            <span className="grow">{e.type === 'checkin_cleared' ? 'Removed' : fmtT(e.payload.at as number)} · {stationName(p.race.id, e.payload.station as string)}{snap.state.undone.has(e.id) ? ' (undone)' : ''}</span>
            <span className="muted">{e.by} · {fmtT(e.ts)}{snap.synced.has(e.id) ? '' : ' · ⧗'}</span>
          </div>
        ))}
      </>}

      <Sheet open={!!edit} onClose={() => setEdit(null)}>{edit && <EditCheckin snap={snap} runnerId={id} sp={edit} onDone={() => setEdit(null)} />}</Sheet>
      <Sheet open={!!meetEdit} onClose={() => setMeetEdit(null)}>{meetEdit && <MeetEditor snap={snap} runnerId={id} stationId={meetEdit} onDone={() => setMeetEdit(null)} />}</Sheet>
      <Sheet open={dropOpen} onClose={() => setDropOpen(false)}>
        <h2>Mark {p.name} dropped?</h2>
        <div className="muted">Stops projections and meetings for {p.name}. You can undo it.</div>
        <div className="sec">Dropped at</div>
        <div className="chips">
          {p.stations.filter(sp => sp.idx > 0).map(sp => <button key={sp.st.id} className="chip sm" onClick={() => { store.dispatch('status_set', { runner: id, dropped: true, station: sp.st.id }); setDropOpen(false) }}>{sp.st.name}</button>)}
        </div>
        <button className="cancelbtn" style={{ marginTop: 12 }} onClick={() => setDropOpen(false)}>Cancel</button>
      </Sheet>
    </div>
  )
}

export function EditCheckin({ snap, runnerId, sp, onDone }: { snap: Snapshot; runnerId: string; sp: StationProj; onDone: () => void }) {
  const p = snap.projs.find(x => x.runnerId === runnerId)!
  const existing = snap.state.checkins[runnerId]?.[sp.st.id]
  const [at, setAt] = useState(() => existing?.at ?? roundMin(store.now()))
  const [note, setNote] = useState(existing?.note ?? '')
  const chk = checkCheckin(p, sp.idx, at, null)
  return (
    <div>
      <h2>{p.name} · {sp.st.name}</h2>
      <div className="muted small">{existing ? `Logged ${fmtT(existing.at)} by ${existing.by}` : 'Not logged yet'}{sp.plan != null && ` · plan ${fmtT(sp.plan)}`}</div>
      <div style={{ marginTop: 10 }}><TimeEdit value={at} onChange={setAt} near={sp.proj ?? sp.plan ?? store.now()} /></div>
      {chk.warnings.map(w => <div key={w} className="warnbox">{w}</div>)}
      <input className="plain" type="text" placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} style={{ marginTop: 8 }} />
      <button className="confirmbtn" style={{ marginTop: 12 }} onClick={() => { store.dispatch('checkin_set', { runner: runnerId, station: sp.st.id, at, note: note.trim() }); onDone() }}>{existing ? 'Save time' : 'Log arrival'}</button>
      {existing && <button className="btn wide danger" style={{ marginTop: 8 }} onClick={() => { store.dispatch('checkin_cleared', { runner: runnerId, station: sp.st.id }); onDone() }}>Remove this check-in</button>}
      <button className="cancelbtn" style={{ marginTop: 8 }} onClick={onDone}>Cancel</button>
    </div>
  )
}

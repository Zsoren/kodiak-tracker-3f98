import { useState } from 'react'
import { store, type Snapshot } from '../state/store'
import { runnerById, raceOf } from '../data/course'
import { fmtT } from '../model/time'

/** Meet here / Not meeting + who's going. Shared by Timeline, Plans and the runner page. */
export function MeetEditor({ snap, runnerId, stationId, onDone }: { snap: Snapshot; runnerId: string; stationId: string; onDone: () => void }) {
  const cur = snap.state.meets[runnerId]?.[stationId]
  const [meeting, setMeeting] = useState(cur?.meeting ?? true)
  const [who, setWho] = useState(cur?.who ?? '')
  const [adding, setAdding] = useState(false)
  const st = raceOf(runnerId).stations.find(s => s.id === stationId)!
  const sp = snap.projs.find(p => p.runnerId === runnerId)?.stations.find(s => s.st.id === stationId)
  const names = snap.state.crewNames
  const save = () => {
    const w = who.trim()
    store.dispatchMany([
      { type: 'meet_set', payload: { runner: runnerId, station: stationId, meeting, who: meeting ? w : '' } },
      ...(meeting && w && !names.some(n => n.toLowerCase() === w.toLowerCase()) ? [{ type: 'crew_name_set' as const, payload: { name: w, active: true } }] : []),
    ])
    onDone()
  }
  return (
    <div>
      <h2>{runnerById(runnerId)?.name} · {st.name}</h2>
      <div className="muted small">{sp?.proj != null ? `Expected ~${fmtT(sp.proj)}` : sp?.plan != null ? `Plan ${fmtT(sp.plan)}` : 'No plan time yet'} · {st.crewNote}</div>
      <div className="sec">Crew meeting</div>
      <div className="chips">
        <button className={`chip ${meeting ? 'sel' : ''}`} onClick={() => setMeeting(true)}>Meet here</button>
        <button className={`chip ${!meeting ? 'sel' : ''}`} onClick={() => setMeeting(false)}>Not meeting</button>
      </div>
      {meeting && <>
        <div className="sec">Who's going?</div>
        <div className="chips">
          {names.map(n => <button key={n} className={`chip sm ${who.toLowerCase() === n.toLowerCase() ? 'sel' : ''}`} onClick={() => setWho(n)}>{n}</button>)}
          <button className="chip sm" onClick={() => setAdding(true)}>+ New</button>
        </div>
        {(adding || (who && !names.some(n => n.toLowerCase() === who.toLowerCase()))) &&
          <input className="plain" type="text" placeholder='e.g. "Mom & Dad" or "Car 2"' value={who} onChange={e => setWho(e.target.value)} style={{ marginTop: 8 }} autoFocus />}
      </>}
      <button className="confirmbtn" style={{ marginTop: 14 }} onClick={save}>Save</button>
      <button className="cancelbtn" style={{ marginTop: 8 }} onClick={onDone}>Cancel</button>
    </div>
  )
}

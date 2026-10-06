import { useState } from 'react'
import { store, type Snapshot } from '../state/store'
import { SHARES_100K, RUNNERS, runnerById } from '../data/course'
import { planFromGoal, type StationProj } from '../model/projection'
import { parseDigits } from '../model/timeEntry'
import { fmtDur, fmtT } from '../model/time'
import { Sheet } from '../components/Sheet'
import { TimeEntry } from '../components/TimeEntry'
import { MeetEditor } from '../components/MeetEditor'

export function Plans({ snap, runner }: { snap: Snapshot; runner?: string }) {
  if (runner && runnerById(runner)) return <PlanEdit snap={snap} runnerId={runner} />
  return (
    <div className="page">
      <h1 className="title">Plans</h1>
      <div className="muted small" style={{ marginBottom: 10 }}>Each runner's planned arrival time at every aid station, plus personal notes and crew meetings. Anyone can edit; every change is kept in history.</div>
      {snap.projs.map(p => {
        const n = p.stations.filter(s => s.planGiven && s.idx > 0).length
        const fin = p.stations[p.stations.length - 1]
        return (
          <a key={p.runnerId} className="card tap" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }} href={`#/plans/${p.runnerId}`}>
            <div className="row"><span className="bold grow" style={{ fontSize: 20 }}>{p.name} <span className="tag out">{p.race.name}</span></span><span className="amber bold">Edit ›</span></div>
            <div className="small muted">{n === 0 ? 'No plan yet' : `${n} of ${p.stations.length - 1} stations planned`}{fin.plan != null && ` · finish ${fmtT(fin.plan)}`}</div>
          </a>
        )
      })}
    </div>
  )
}

function PlanEdit({ snap, runnerId }: { snap: Snapshot; runnerId: string }) {
  const p = snap.projs.find(x => x.runnerId === runnerId)!
  const [timeFor, setTimeFor] = useState<StationProj | null>(null)
  const [noteFor, setNoteFor] = useState<StationProj | null>(null)
  const [meetFor, setMeetFor] = useState<string | null>(null)
  const [goalOpen, setGoalOpen] = useState(false)
  const others = RUNNERS.filter(r => r.id !== runnerId)
  return (
    <div className="page">
      <a className="link" href="#/plans">‹ Plans</a>
      <div className="row"><h1 className="title grow">{p.name}'s plan <span className="tag out">{p.race.name}</span></h1></div>
      <div className="chips" style={{ marginBottom: 8 }}>
        <button className="chip sm" onClick={() => setGoalOpen(true)}>Fill from goal finish time</button>
        {others.map(r => <a key={r.id} className="chip sm" style={{ textDecoration: 'none' }} href={`#/plans/${r.id}`}>{r.name} ›</a>)}
      </div>
      <div className="muted tiny" style={{ marginBottom: 8 }}>Times are planned ARRIVAL times. Type digits only (e.g. 1145); the day and AM/PM are filled in for you.</div>
      {p.stations.map(sp => (
        <div key={sp.st.id} className="prow">
          <div>
            <div className="bold">{sp.st.name} {sp.st.crew && <span className={`tag ${sp.meet?.meeting ? 'crew' : 'out'}`}>{sp.meet?.meeting ? `MEET${sp.meet.who ? ' · ' + sp.meet.who : ''}` : 'CREW OK'}</span>}</div>
            <div className="tiny muted">mi {sp.st.mile}{sp.cutoff != null && ` · cut-off ${fmtT(sp.cutoff)}`}{sp.st.dropBag && ' · drop bag'}</div>
          </div>
          <button className={`pt ${sp.planGiven ? '' : 'empty'}`} onClick={() => setTimeFor(sp)}>
            {sp.plan != null ? fmtT(sp.plan) : 'Add time'}{!sp.planGiven && sp.plan != null ? ' (est.)' : ''}
          </button>
          <div style={{ gridColumn: '1 / -1' }} className="row wrap">
            <button className="link" style={{ minHeight: 40 }} onClick={() => setNoteFor(sp)}>{sp.note ? `📝 ${sp.note}` : '+ Note'}</button>
            {sp.st.crew && <button className="link" style={{ minHeight: 40 }} onClick={() => setMeetFor(sp.st.id)}>{sp.meet?.meeting ? 'Change meeting' : '+ Crew meeting'}</button>}
          </div>
        </div>
      ))}
      <Sheet open={!!timeFor} onClose={() => setTimeFor(null)}>{timeFor && <PlanTime p={p} sp={timeFor} onDone={() => setTimeFor(null)} />}</Sheet>
      <Sheet open={!!noteFor} onClose={() => setNoteFor(null)}>{noteFor && <NoteEdit runnerId={runnerId} sp={noteFor} onDone={() => setNoteFor(null)} />}</Sheet>
      <Sheet open={!!meetFor} onClose={() => setMeetFor(null)}>{meetFor && <MeetEditor snap={snap} runnerId={runnerId} stationId={meetFor} onDone={() => setMeetFor(null)} />}</Sheet>
      <Sheet open={goalOpen} onClose={() => setGoalOpen(false)}>{goalOpen && <GoalHelper p={p} onDone={() => setGoalOpen(false)} />}</Sheet>
    </div>
  )
}

function PlanTime({ p, sp, onDone }: { p: Snapshot['projs'][number]; sp: StationProj; onDone: () => void }) {
  const prev = [...p.stations].reverse().find(x => x.idx < sp.idx && x.planGiven && x.plan != null)
  const [val, setVal] = useState<number | null>(sp.planGiven ? sp.plan : null)
  return (
    <div>
      <h2>{p.name} · {sp.st.name}</h2>
      <div className="muted small">Planned arrival{prev ? ` (after ${prev.st.name} at ${fmtT(prev.plan!)})` : ''}</div>
      <div style={{ marginTop: 10 }}><TimeEntry initial={sp.planGiven ? sp.plan : null} after={sp.idx === 0 ? null : prev?.plan ?? p.race.start} near={p.race.start} onChange={setVal} /></div>
      <button className="confirmbtn" style={{ marginTop: 12 }} disabled={val == null} onClick={() => { store.dispatch('plan_set', { runner: p.runnerId, station: sp.st.id, at: val }); onDone() }}>Save {val != null ? fmtT(val) : ''}</button>
      {sp.planGiven && sp.idx > 0 && <button className="btn wide" style={{ marginTop: 8 }} onClick={() => { store.dispatch('plan_set', { runner: p.runnerId, station: sp.st.id, at: null }); onDone() }}>Clear this time</button>}
      <button className="cancelbtn" style={{ marginTop: 8 }} onClick={onDone}>Cancel</button>
    </div>
  )
}

function NoteEdit({ runnerId, sp, onDone }: { runnerId: string; sp: StationProj; onDone: () => void }) {
  const [text, setText] = useState(sp.note)
  return (
    <div>
      <h2>Note · {sp.st.name}</h2>
      <div className="muted small">Shown on {runnerById(runnerId)?.name}'s screen as they head to this station (e.g. what to grab from the drop bag).</div>
      <textarea className="plain" style={{ marginTop: 10 }} value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Fill 2 flasks. Grab headlamp from drop bag." autoFocus />
      <button className="confirmbtn" style={{ marginTop: 12 }} onClick={() => { store.dispatch('note_set', { runner: runnerId, station: sp.st.id, text: text.trim() }); onDone() }}>Save note</button>
      <button className="cancelbtn" style={{ marginTop: 8 }} onClick={onDone}>Cancel</button>
    </div>
  )
}

function GoalHelper({ p, onDone }: { p: Snapshot['projs'][number]; onDone: () => void }) {
  const [digits, setDigits] = useState('')
  const parsed = parseDigits(digits)
  const ms = typeof parsed === 'object' ? (parsed.h * 60 + parsed.m) * 60_000 : null
  const limit = p.race.id === '100k' ? 20.25 * 3600_000 : 10 * 3600_000
  const plan = ms != null && ms > 2 * 3600_000 ? planFromGoal(p.race, p.race.start, ms, SHARES_100K) : null
  return (
    <div>
      <h2>Goal finish time</h2>
      <div className="muted small">Total hours and minutes, digits only: 1800 = 18 h 00 m, 930 = 9 h 30 m. {p.race.id === '100k' ? 'Uses how 2025 finishers paced Kodiak.' : 'Spreads time by distance and climbing.'} You can fine-tune each station afterwards.</div>
      <input className="digits" style={{ marginTop: 10 }} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder={p.race.id === '100k' ? 'e.g. 1800' : 'e.g. 730'} value={digits} onChange={e => setDigits(e.target.value.replace(/\D/g, '').slice(0, 4))} autoFocus />
      {ms != null && <div className="reading">{fmtDur(ms)}{ms > limit && <span className="amber small"> · over the {p.race.id === '100k' ? '20:15' : '10:00'} limit</span>}</div>}
      {plan && <div className="infobox tiny">{p.race.stations.map(st => `${st.code} ${fmtT(plan[st.id])}`).join(' · ')}</div>}
      <button className="confirmbtn" style={{ marginTop: 12 }} disabled={!plan} onClick={() => {
        if (!plan) return
        store.dispatchMany(p.race.stations.map(st => ({ type: 'plan_set' as const, payload: { runner: p.runnerId, station: st.id, at: plan[st.id] } })))
        onDone()
      }}>Replace {p.name}'s plan</button>
      <button className="cancelbtn" style={{ marginTop: 8 }} onClick={onDone}>Cancel</button>
    </div>
  )
}

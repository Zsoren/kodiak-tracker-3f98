import { store, type Snapshot } from '../state/store'
import { askMeetingMoved, nextMeetingFor, openAsks, stationName, upcomingMeetings, type Meeting, type RunnerProj } from '../model/projection'
import { fmtAheadBehind, fmtSpare, fmtT } from '../model/time'
import { LOTS, SUNSET } from '../data/course'
import type { Ask } from '../model/events'
import { StatusLine } from '../components/StatusLine'
import { go } from '../state/router'

export function Crew({ snap }: { snap: Snapshot }) {
  const meetings = upcomingMeetings(snap.projs, snap.state)
  const anyPlanned = snap.projs.some(p => p.meetingsPlanned)
  return (
    <div className="page">
      <div className="row"><h1 className="title grow">Crew</h1></div>
      <StatusLine snap={snap} />
      {snap.state.lastCutoffEdit && <div className="infobox tiny">Cut-offs edited by {snap.state.lastCutoffEdit.by} at {fmtT(snap.state.lastCutoffEdit.ts)} — see More.</div>}

      <h2 className="sub">Next crew meetings</h2>
      {!anyPlanned && <div className="infobox">No meetings planned yet. On the <a href="#/timeline">Timeline</a>, tap a cyan stop to say who's meeting which runner.</div>}
      <div className="strip">
        {meetings.slice(0, 3).map(m => <MeetingCard key={m.runnerId + m.sp.st.id} snap={snap} m={m} />)}
        {anyPlanned && meetings.length === 0 && <div className="muted small">No more planned meetings.</div>}
      </div>

      <h2 className="sub">Runners</h2>
      {snap.projs.map(p => <RunnerCard key={p.runnerId} snap={snap} p={p} />)}
    </div>
  )
}

function lotName(id?: string) { return LOTS.find(l => l.id === id)?.name ?? '' }

export function MeetingCard({ snap, m }: { snap: Snapshot; m: Meeting }) {
  const p = snap.projs.find(x => x.runnerId === m.runnerId)!
  return (
    <div className={`mtg ${m.clashes.length ? 'tight' : ''}`}>
      <div className="row">
        <span className="grow bold" style={{ fontSize: 18 }}>{m.name} · {m.sp.st.name}</span>
        {m.who && <span className="tag crew">{m.who}</span>}
      </div>
      <div className="meetline">
        {m.beThereBy != null
          ? <>Be there by <span className="when">{fmtT(m.beThereBy)}</span>{m.sp.st.shuttle && m.leaveBy != null && <> · leave {lotName(m.sp.st.lot)} by <span className="when">{fmtT(m.leaveBy)}</span></>}</>
          : <span className="muted">No plan time yet for {m.name} here</span>}
      </div>
      <div className="small muted">
        {m.sp.proj != null && <>Expected ~{fmtT(m.sp.proj)}</>}{m.sp.plan != null && <> (plan {fmtT(m.sp.plan)})</>}
        {m.sp.st.id === 'ss' && p.race.id === '100k' && <> · last crew stop before dark ({fmtT(SUNSET)})</>}
      </div>
      {m.clashes.map(c => <div key={c.runnerId + c.sp.st.id} className="cutline amber">⚠ tight: {m.who} also meets {c.name} at {c.sp.st.name} ~{fmtT(c.sp.proj ?? c.sp.plan)} — probably not enough time.</div>)}
      {m.asks.map(a => <AskLine key={a.id} snap={snap} a={a} p={p} />)}
    </div>
  )
}

export function AskLine({ snap, a, p }: { snap: Snapshot; a: Ask; p: RunnerProj }) {
  const moved = askMeetingMoved(a, snap.state, p)
  const from = a.from && a.from !== 'start' ? ` at ${stationName(p.race.id, a.from)}` : ''
  const what = [...a.items.map(i => i.toLowerCase()), a.text].filter(Boolean).join(', ')
  return (
    <div className={`askline ${a.ackBy ? 'seen' : ''}`}>
      <span className="grow">
        {p.name} wants{a.target ? ` at ${stationName(p.race.id, a.target)}` : ''}: {what}
        <span style={{ fontWeight: 600 }}> · {fmtT(a.at)}{from}</span>
        {moved && <span> · meeting moved</span>}
        {a.ackBy && <span style={{ fontWeight: 600 }}> · ✓ {a.ackBy} saw it</span>}
      </span>
      {!a.ackBy && <button onClick={() => store.dispatch('ask_ack', { askId: a.id })}>Got it</button>}
    </div>
  )
}

export function RunnerCard({ snap, p }: { snap: Snapshot; p: RunnerProj }) {
  const m = nextMeetingFor(p, snap.state)
  const asks = openAsks(snap.state, [p]).filter(a => a.runner === p.runnerId)
  const nc = p.nextCutoff
  const cutCls = nc?.spare == null ? '' : nc.spare < 0 ? 'bad' : nc.spare < 60 * 60_000 ? 'amber' : ''
  const last = p.stations[p.lastIdx]
  const ssAhead = p.race.id === '100k' && p.stations.some(s => s.st.id === 'ss' && s.idx > p.lastIdx) && !p.dropped
  return (
    <div className={`card rcard tap ${cutCls === 'bad' ? 'bad' : cutCls === 'amber' ? 'warn' : ''}`} onClick={e => { if ((e.target as HTMLElement).closest('button,a')) return; go('runner/' + p.runnerId) }}>
      <div className="row">
        <span className="name grow">{p.name} <span className="tag out">{p.race.name}</span></span>
        {p.dropped ? <span className="tag red">DROPPED</span>
          : p.finished ? <span className="tag">FINISHED</span>
            : p.delta != null ? <span className="delta">{fmtAheadBehind(p.delta)}</span> : null}
      </div>
      <div className="lastst">
        {p.dropped ? `Dropped${p.droppedAt ? ` at ${stationName(p.race.id, p.droppedAt)}` : ''}`
          : p.lastIdx > 0 ? `${p.finished ? 'Finished' : `At ${last.st.name}`} · ${fmtT(last.actual)}${p.earlyEstimate ? ' · early estimate' : ''}`
            : p.startLogged ? `Started ${fmtT(p.actualStart)}` : `Starts ${fmtT(p.race.start)}`}
        {!p.hasPlan && !p.dropped && <span className="amber"> · no plan yet</span>}
      </div>
      {p.overdue && <div className="cutline amber">Expected at {p.overdue.st.name} ~{fmtT(p.overdue.proj)} — not logged yet</div>}
      {m && !p.dropped && !p.finished && (
        <div className="meetline">
          <span className="tag crew">{m.planned ? 'MEET' : 'CREW OK'}</span>{' '}
          <b>{m.sp.st.name}</b>{m.who && <> · {m.who}</>}
          {m.sp.proj != null && <> · ~{fmtT(m.sp.proj)}</>}
          {m.beThereBy != null && <div className="small">Be there by <b>{fmtT(m.beThereBy)}</b>{m.sp.st.shuttle && m.leaveBy != null && <> · leave {lotName(m.sp.st.lot)} by <b>{fmtT(m.leaveBy)}</b></>}</div>}
          {m.sp.st.crewNote && <div className="tiny muted">{m.sp.st.crewNote}</div>}
        </div>
      )}
      {asks.map(a => <AskLine key={a.id} snap={snap} a={a} p={p} />)}
      {nc && nc.spare != null && (
        <div className={`cutline ${cutCls}`}>{nc.spare < 0 ? '⚠ PROJECTED MISS · ' : ''}{nc.st.name} · must leave by {fmtT(nc.cutoff!)} · {fmtSpare(nc.spare)}</div>
      )}
      {ssAhead && <div className="tiny muted">Snow Summit is the last crew stop before dark and before Aspen Glen (18.6 mi): headlamp, batteries, warm layers.</div>}
      <div className="row" style={{ justifyContent: 'flex-end' }}><a className="link" href={`#/runner/${p.runnerId}`}>All stations ›</a></div>
    </div>
  )
}

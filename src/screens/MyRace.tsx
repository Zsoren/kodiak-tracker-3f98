import { useState, type ReactNode } from 'react'
import { store, type Snapshot } from '../state/store'
import { askTargetAfter, type RunnerProj, type StationProj } from '../model/projection'
import { aheadBehind, fmtSpare, fmtT } from '../model/time'
import { checkCheckin } from '../model/checks'
import { AskOverlay, AskPicker, AskResult, askSummary, smsBody, textNumber } from '../components/Ask'
import { Overlay, Sheet } from '../components/Sheet'
import { roundMin } from '../components/TimeEntry'
import { syncNow } from '../sync'
import { fmtAgo, fmtClock } from '../model/time'

interface Logged { ids: string[]; station: string; at: number; askId: string | null; body: string; duplicate: boolean }

/** Runner view. Never scrolls; the buttons are pinned to the bottom thumb zone. */
export function MyRace({ snap, runnerId, banner }: { snap: Snapshot; runnerId: string; banner?: ReactNode }) {
  const p = snap.projs.find(x => x.runnerId === runnerId)!
  const [confirm, setConfirm] = useState<StationProj | null>(null)
  const [pickOther, setPickOther] = useState(false)
  const [asking, setAsking] = useState(false)
  const [logged, setLogged] = useState<Logged | null>(null)

  const nc = p.nextCutoff
  const alarm = nc && nc.spare != null && nc.spare < 60 * 60_000 ? nc : null
  const cur = p.stations[p.lastIdx]
  const notStarted = !p.startLogged && p.lastIdx === 0
  const mainStation = notStarted ? p.stations[0] : p.next

  return (
    <div className="myrace">
      {banner}
      <div className="mr-top">
        <div className="mr-head">
          <span className="grow ellip">Kodiak {p.race.name} · <b style={{ color: '#fff' }}>{p.name}</b></span>
          <button className="link" onClick={() => store.setSettings({ crewView: true })}>Crew view ›</button>
        </div>

        {alarm && (
          <div className="alarm" role="alert">
            {alarm.st.name.toUpperCase()} · LEAVE BY {fmtT(alarm.cutoff!).toUpperCase()} · {alarm.spare! >= 0 ? `${Math.round(alarm.spare! / 60000)} MIN SPARE` : `PROJECTED ${Math.round(-alarm.spare! / 60000)} MIN LATE`}
          </div>
        )}

        <Headline p={p} />

        {p.next && !p.dropped && (
          <div className="next">
            <div className="row">
              <span className="nm grow ellip">Next: {p.next.st.name}</span>
              {p.next.st.crew && <span className="tag crew">CREW</span>}
            </div>
            {p.next.proj != null
              ? <div className="etarow">
                  <span className="eta">~{fmtT(p.next.proj)}</span>
                  {p.next.plan != null && <span className="plan">plan {fmtT(p.next.plan)}</span>}
                </div>
              : <div className="plan">No plan time yet — add one in Plans</div>}
            <div className="facts">
              {cur.st.nextMi != null && <>{cur.st.nextMi.toFixed(1)} mi · +{cur.st.gain} ft</>}
              {' · '}{p.next.st.crew ? 'crew access' : 'no crew'}{p.next.st.tag ? ` · ${p.next.st.tag}` : ''}
            </div>
            <div className="crewline">
              {p.nextMeet
                ? <>Crew {p.meetingsPlanned ? 'meets you at' : 'can meet you at'}: <b>{p.nextMeet.st.name}</b> · {(p.nextMeet.st.mile - cur.st.mile).toFixed(1)} mi</>
                : <span className="muted">No crew planned until the Finish</span>}
            </div>
          </div>
        )}

        {p.next?.note && <div className="mynote clamp2">📝 {p.next.note}</div>}

        {nc && !alarm && nc.spare != null && (
          <div className="cut">Next cut-off: <b>{nc.st.name}</b> · leave by {fmtT(nc.cutoff!)} · <b>{fmtSpare(nc.spare)}</b></div>
        )}
      </div>

      <div className="mr-bottom">
        {logged
          ? <LoggedBanner snap={snap} p={p} logged={logged} onDone={() => setLogged(null)} />
          : mainStation && !p.dropped && !p.finished && (
            <button className="bigbtn" onClick={() => setConfirm(mainStation)}>
              {mainStation.idx === 0 ? 'STARTED' : `I'M AT ${mainStation.st.name}`}
              <span className="sub">{mainStation.idx === 0 ? 'Tap when you cross the start line' : `mile ${mainStation.st.mile}`}</span>
            </button>
          )}
        {!logged && (
          <div className="pair">
            <button className="btn" onClick={() => setPickOther(true)}>Different station</button>
            <button className="btn" onClick={() => setAsking(true)} disabled={p.dropped || p.finished}>Ask crew</button>
          </div>
        )}
        <RunnerStatus snap={snap} />
      </div>

      <Sheet open={pickOther} onClose={() => setPickOther(false)}>
        <h2>Where are you?</h2>
        <div className="slist">
          {p.stations.map(sp => (
            <button key={sp.st.id} className={`srow ${sp.actual != null ? 'done' : ''}`} onClick={() => { setPickOther(false); setConfirm(sp) }}>
              <span className="sn">{sp.st.name}</span>
              <span className="st">{sp.actual != null ? `✓ ${fmtT(sp.actual)}` : `mi ${sp.st.mile}`}</span>
            </button>
          ))}
        </div>
        <button className="cancelbtn" style={{ marginTop: 10 }} onClick={() => setPickOther(false)}>Cancel</button>
      </Sheet>

      {confirm && <ConfirmCheckin snap={snap} p={p} sp={confirm} onCancel={() => setConfirm(null)} onDone={l => { setConfirm(null); setLogged(l) }} />}
      {asking && <AskOverlay snap={snap} p={p} onClose={() => setAsking(false)} />}
    </div>
  )
}

function Headline({ p }: { p: RunnerProj }) {
  if (p.dropped) return <div><div className="ab">DROPPED</div><div className="ab-sub">{p.droppedAt ? `at ${p.stations.find(s => s.st.id === p.droppedAt)?.st.name ?? p.droppedAt}` : ''} · Switch to crew view to follow the others</div></div>
  if (p.finished) {
    const fin = p.stations[p.stations.length - 1]
    return <div><div className="ab">FINISHED</div><div className="ab-sub">{fmtT(fin.actual)} · {p.delta != null ? (aheadBehind(p.delta).word === 'on plan' ? 'on plan' : `${aheadBehind(p.delta).mins} min ${aheadBehind(p.delta).word}`) : ''}</div></div>
  }
  if (p.delta == null) {
    if (!p.startLogged && p.lastIdx === 0) return <div><div className="ab" style={{ fontSize: 40 }}>Starts {fmtT(p.race.start)}</div><div className="ab-sub">Tap STARTED when you cross the start line.</div></div>
    return <div><div className="ab" style={{ fontSize: 40 }}>Started {fmtT(p.actualStart)}</div><div className="ab-sub">Check in at each aid station to see how you're doing.</div></div>
  }
  const ab = aheadBehind(p.delta)
  return (
    <div>
      <div className="ab">{ab.word === 'on plan' ? 'ON PLAN' : <>{ab.sign}{ab.mins} MIN <span className="w">{ab.word.toUpperCase()}</span></>}</div>
      <div className="ab-sub">at {p.stations[p.lastIdx].st.name} ({fmtT(p.stations[p.lastIdx].actual)}){p.earlyEstimate ? ' · early estimate' : ''}</div>
    </div>
  )
}

function RunnerStatus({ snap }: { snap: Snapshot }) {
  const { sync, pending, now } = snap
  return (
    <div className="mr-status">
      <span className="grow ellip">
        {sync.mode === 'off' ? 'Saved on this phone' : sync.syncing ? 'Updating…' : sync.lastPulled ? `Updated ${fmtClock(sync.lastPulled)} (${fmtAgo(sync.lastPulled, now)})` : 'Not updated yet'}
        {pending > 0 && <> · <span className="notsent">⧗ {pending} not sent</span></>}
      </span>
      {sync.mode === 'on' && <button className="link" style={{ minHeight: 36, padding: '0 6px' }} onClick={() => void syncNow()}>↻ Refresh</button>}
    </div>
  )
}

/** Pocket-safe confirm: CONFIRM sits mid-screen; the bottom thumb zone holds harmless request toggles. */
function ConfirmCheckin({ snap, p, sp, onCancel, onDone }: { snap: Snapshot; p: RunnerProj; sp: StationProj; onCancel: () => void; onDone: (l: Logged) => void }) {
  const [at, setAt] = useState(() => roundMin(store.now()))
  const [items, setItems] = useState<string[]>([])
  const [text, setText] = useState('')
  const existing = snap.state.checkins[p.runnerId]?.[sp.st.id]
  const chk = checkCheckin(p, sp.idx, at, existing ? { at: existing.at, by: existing.by } : null)
  const target = askTargetAfter(p, sp.idx)
  const summary = askSummary(items, text)
  const isFinish = sp.idx === p.stations.length - 1

  const go = () => {
    if (chk.duplicate) { onDone({ ids: [], station: sp.st.name, at: chk.duplicate.at, askId: null, body: '', duplicate: true }); return }
    const evs = store.dispatchMany([
      { type: 'checkin_set', payload: { runner: p.runnerId, station: sp.st.id, at } },
      ...(summary && !isFinish ? [{ type: 'ask_sent' as const, payload: { runner: p.runnerId, items, text: text.trim(), target: target.station, targetWasMeeting: target.isMeeting, from: sp.st.id, at } }] : []),
    ])
    const ask = evs.find(e => e.type === 'ask_sent') ?? null
    onDone({ ids: evs.map(e => e.id), station: sp.st.name, at, askId: ask?.id ?? null, body: ask ? smsBody({ ...p, lastIdx: sp.idx }, summary, at, target.name) : '', duplicate: false })
  }

  return (
    <Overlay label="Confirm check-in">
      <div className="top">
        <h2 style={{ fontSize: 28 }}>{sp.idx === 0 ? 'Started?' : `At ${sp.st.name}?`}</h2>
        <div className="row" style={{ marginTop: 6 }}>
          <span className="bigtime grow">{fmtT(at)}</span>
          <button className="chip sm" onClick={() => setAt(a => a - 5 * 60_000)}>−5</button>
          <button className="chip sm" onClick={() => setAt(a => a - 60_000)}>−1</button>
          <button className="chip sm" onClick={() => setAt(roundMin(store.now()))}>Now</button>
        </div>
        {chk.duplicate && <div className="infobox">Already logged at {fmtT(chk.duplicate.at)} by {chk.duplicate.by}.</div>}
        {chk.replaces && <div className="warnbox">Replaces {fmtT(chk.replaces.at)} (logged by {chk.replaces.by}).</div>}
        {chk.warnings.map(w => <div key={w} className="warnbox">{w}</div>)}
        {sp.note && <div className="infobox clamp2">📝 {sp.note}</div>}
      </div>
      <div className="mid">
        <button className="confirmbtn" onClick={go}>{chk.duplicate ? 'OK — already logged' : 'CONFIRM'}</button>
        <button className="cancelbtn" onClick={onCancel}>Cancel</button>
      </div>
      {!isFinish && !chk.duplicate && (
        <div className="bottom">
          <div className="muted small">{target.station ? <>Optional: ask crew for <b style={{ color: '#fff' }}>{target.name}</b></> : 'Optional: ask crew (none planned before Finish)'}</div>
          <AskPicker selected={items} onToggle={v => setItems(xs => (xs.includes(v) ? xs.filter(x => x !== v) : [...xs, v]))} text={text} onText={setText} />
        </div>
      )}
    </Overlay>
  )
}

function LoggedBanner({ snap, p, logged, onDone }: { snap: Snapshot; p: RunnerProj; logged: Logged; onDone: () => void }) {
  return (
    <div className="logged" role="status">
      <div className="row">
        <span className="grow" style={{ fontSize: 18 }}>{logged.duplicate ? 'Already logged' : 'Logged'} <b>{logged.station}</b> · {fmtT(logged.at)}</span>
        {!logged.duplicate && <button className="btn sm" onClick={() => { store.undo(logged.ids); onDone() }}>Undo</button>}
        <button className="btn sm primary" onClick={onDone}>Done</button>
      </div>
      {logged.askId && <AskResult snap={snap} eventId={logged.askId} body={logged.body} number={textNumber(snap, p)} />}
    </div>
  )
}

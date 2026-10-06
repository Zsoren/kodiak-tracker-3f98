import { useState } from 'react'
import { store, RACE_ID, type Snapshot } from '../state/store'
import { CREW_RULES, LIVETRAIL_URL, LOTS, RACES, RUNNERS, runnerById, type RaceId } from '../data/course'
import type { KEvent } from '../model/events'
import { stationName } from '../model/projection'
import { sampleEvents } from '../model/sample'
import { fmtT, fmtDayT } from '../model/time'
import { Sheet } from '../components/Sheet'
import { TimeEntry } from '../components/TimeEntry'
import { isIOS } from '../state/hooks'
import { go } from '../state/router'

const VERSION = `${__APP_VERSION__} · built ${__BUILD_TIME__}`

export function More({ snap, section }: { snap: Snapshot; section?: string }) {
  if (section === 'crewinfo') return <CrewInfo />
  const s = snap.settings
  return (
    <div className="page">
      <h1 className="title">More</h1>

      <h2 className="sub">You</h2>
      <div className="card">
        <div className="row">
          <span className="grow">{s.role === 'runner' ? <>Runner: <b>{runnerById(s.me)?.name}</b></> : <>Crew: <b>{s.name || '—'}</b></>}</span>
          <button className="btn sm" onClick={() => store.setSettings({ role: null })}>Change</button>
        </div>
        {s.role === 'runner' && <button className="btn wide" style={{ marginTop: 8 }} onClick={() => { store.setSettings({ crewView: false }); go('me') }}>Back to My Race</button>}
      </div>

      {s.role === 'runner' && <TextNumbers snap={snap} />}

      <h2 className="sub">Crew</h2>
      <a className="card tap" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }} href="#/more/crewinfo">
        <div className="row"><span className="grow bold">Crew info: lots, shuttles, rules</span><span className="amber bold">›</span></div>
        <div className="small muted">Addresses (tap for Maps), shuttle routes and hours, chairlift, Sugarloaf walk, parking.</div>
      </a>
      <CrewNames snap={snap} />
      <LeadTimes snap={snap} />

      <h2 className="sub">Cut-offs</h2>
      <Cutoffs snap={snap} />

      <h2 className="sub">Official tracking (LiveTrail)</h2>
      <Links snap={snap} />

      <h2 className="sub">Recent changes</h2>
      <Recent snap={snap} />

      <h2 className="sub">Install on your phone</h2>
      <div className="card small">
        {isIOS()
          ? <>Open <b>kodiak.zanesorenson.com</b> in <b>Safari</b> → tap <b>Share ⬆</b> → <b>Add to Home Screen</b>. Then open it from the icon and set up who you are there (Safari and the home-screen app keep separate data).</>
          : <>Open <b>kodiak.zanesorenson.com</b> in <b>Chrome</b> → tap <b>⋮</b> → <b>Install app</b> (or <b>Add to Home screen</b>).</>}
        <div style={{ marginTop: 6 }}>Open it once on Wi-Fi: it shows <b>✓ Ready offline</b> when it's saved on the phone. {snap.flags.offlineReady ? <b>This phone: ✓ ready offline.</b> : <span className="amber">This phone: not saved for offline yet.</span>}</div>
      </div>

      <h2 className="sub">Test mode</h2>
      <TestMode snap={snap} />

      <div className="tiny muted" style={{ marginTop: 18 }}>
        Version {VERSION}<br />
        Data: {snap.dataKey === RACE_ID ? 'race day' : 'TEST area'} · {snap.events.length} entries · {snap.sync.mode === 'on' ? 'sharing on' : 'this phone only'}{!snap.storageOk && ' · ⚠ storage blocked'}
        {snap.sync.error && <><br />Last problem: {snap.sync.error}</>}
      </div>
    </div>
  )
}

function TextNumbers({ snap }: { snap: Snapshot }) {
  const s = snap.settings
  return (
    <>
      <h2 className="sub">"Also send as text"</h2>
      <div className="card">
        <div className="small muted">When a request can't be sent (no signal), the app offers to text it. These numbers stay on this phone only.</div>
        <label className="small bold" style={{ display: 'block', marginTop: 8 }}>Crew chief's phone</label>
        <input className="plain" type="tel" inputMode="tel" placeholder="(555) 123-4567" value={s.crewChief} onChange={e => store.setSettings({ crewChief: e.target.value })} />
        {snap.state.crewNames.length > 0 && <div className="small muted" style={{ marginTop: 10 }}>Optional: a number per crew person/car — the text goes to whoever is going to that meeting.</div>}
        {snap.state.crewNames.map(n => (
          <div key={n} className="row" style={{ marginTop: 6 }}>
            <span className="small" style={{ width: 110 }}>{n}</span>
            <input className="plain" type="tel" inputMode="tel" placeholder="phone" value={s.crewPhones[n] ?? ''} onChange={e => store.setSettings({ crewPhones: { ...s.crewPhones, [n]: e.target.value } })} />
          </div>
        ))}
        {isIOS() && <div className="infobox tiny"><b>iPhone:</b> turn on Settings → Messages → <b>Send as SMS</b>, so texts still go out when there's no data.</div>}
      </div>
    </>
  )
}

function CrewNames({ snap }: { snap: Snapshot }) {
  const [name, setName] = useState('')
  return (
    <div className="card" style={{ marginTop: 10 }}>
      <div className="bold">Crew people / cars</div>
      <div className="small muted">Used for "who's going" on crew meetings.</div>
      <div className="chips" style={{ marginTop: 6 }}>
        {snap.state.crewNames.map(n => <button key={n} className="chip sm" onClick={() => store.dispatch('crew_name_set', { name: n, active: false })}>{n} ✕</button>)}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <input className="plain" type="text" placeholder='e.g. "Mom & Dad"' value={name} onChange={e => setName(e.target.value)} />
        <button className="btn" disabled={!name.trim()} onClick={() => { store.dispatch('crew_name_set', { name: name.trim(), active: true }); setName('') }}>Add</button>
      </div>
    </div>
  )
}

function LeadTimes({ snap }: { snap: Snapshot }) {
  const stations = new Map<string, { name: string; lot?: string }>()
  for (const race of Object.values(RACES)) for (const st of race.stations) if (st.crew && st.id !== 'start') stations.set(st.id, { name: st.name, lot: LOTS.find(l => l.id === st.lot)?.name })
  return (
    <div className="card" style={{ marginTop: 10 }}>
      <div className="bold">Getting-there time (minutes)</div>
      <div className="small muted">From the crew lot to the aid station, incl. waiting for the shuttle and walking. Used for "leave the lot by" and clash warnings.</div>
      {[...stations.entries()].map(([id, st]) => {
        const v = snap.state.leads[id] ?? 10
        return (
          <div key={id} className="line">
            <span className="grow">{st.name}<div className="tiny muted">{st.lot}</div></span>
            <button className="chip sm" onClick={() => store.dispatch('lead_set', { station: id, minutes: Math.max(0, v - 5) })}>−5</button>
            <span className="bold" style={{ width: 44, textAlign: 'center' }}>{v}</span>
            <button className="chip sm" onClick={() => store.dispatch('lead_set', { station: id, minutes: v + 5 })}>+5</button>
          </div>
        )
      })}
    </div>
  )
}

function Cutoffs({ snap }: { snap: Snapshot }) {
  const [edit, setEdit] = useState<{ race: RaceId; station: string; at: number } | null>(null)
  const [val, setVal] = useState<number | null>(null)
  const [shift, setShift] = useState<RaceId | null>(null)
  const last = snap.state.lastCutoffEdit
  const shiftAll = (race: RaceId, mins: number) => {
    const cur = snap.state.cutoffs[race]
    const batch = `b${Date.now()}`
    // Saved as the NEW clock time for each station (never "+15"), so two people tapping at once can't double-shift.
    store.dispatchMany(Object.entries(cur).map(([station, at]) => ({ type: 'cutoff_set' as const, payload: { race, station, at: at + mins * 60_000, batch } })))
    setShift(null)
  }
  const undoLast = () => {
    if (!last) return
    const batch = last.payload.batch
    const ids = batch ? snap.events.filter(e => e.type === 'cutoff_set' && e.payload.batch === batch).map(e => e.id) : [last.id]
    store.undo(ids)
  }
  return (
    <div>
      <div className="small muted" style={{ marginBottom: 6 }}>Runners must LEAVE an aid station by its cut-off. Officials may extend them if the start runs late — update them here if announced.</div>
      {last && <div className="infobox small row"><span className="grow">Cut-offs edited by {last.by} at {fmtT(last.ts)}</span><button className="btn sm" onClick={undoLast}>Undo</button></div>}
      {(Object.keys(RACES) as RaceId[]).map(race => (
        <div key={race} className="card">
          <div className="row"><span className="bold grow">{RACES[race].name}</span><button className="btn sm" onClick={() => setShift(race)}>Shift all…</button></div>
          {RACES[race].stations.filter(st => snap.state.cutoffs[race][st.id] != null).map(st => {
            const at = snap.state.cutoffs[race][st.id]
            const changed = st.cutoff !== at
            return (
              <div key={st.id} className="line">
                <span className="grow">{st.name}</span>
                <button className="link" onClick={() => { setEdit({ race, station: st.id, at }); setVal(at) }}>{fmtT(at)}{changed ? ' *' : ''}</button>
              </div>
            )
          })}
        </div>
      ))}
      <Sheet open={!!edit} onClose={() => setEdit(null)}>
        {edit && <>
          <h2>{stationName(edit.race, edit.station)} cut-off</h2>
          <div className="muted small">{RACES[edit.race].name} · official: {fmtT(RACES[edit.race].stations.find(s => s.id === edit.station)?.cutoff ?? edit.at)}</div>
          <div style={{ marginTop: 10 }}><TimeEntry initial={edit.at} near={edit.at} onChange={setVal} /></div>
          <button className="confirmbtn" style={{ marginTop: 12 }} disabled={val == null} onClick={() => { store.dispatch('cutoff_set', { race: edit.race, station: edit.station, at: val }); setEdit(null) }}>Save {val != null ? fmtT(val) : ''}</button>
          <button className="cancelbtn" style={{ marginTop: 8 }} onClick={() => setEdit(null)}>Cancel</button>
        </>}
      </Sheet>
      <Sheet open={!!shift} onClose={() => setShift(null)}>
        {shift && <>
          <h2>Shift all {RACES[shift].name} cut-offs</h2>
          <div className="muted small">Moves every {RACES[shift].name} cut-off later (or earlier). Each one is saved as its new clock time.</div>
          <div className="chips" style={{ marginTop: 10 }}>
            {[5, 10, 15, 30].map(m => <button key={m} className="chip" onClick={() => shiftAll(shift, m)}>+{m} min</button>)}
            <button className="chip" onClick={() => shiftAll(shift, -5)}>−5 min</button>
          </div>
          <button className="cancelbtn" style={{ marginTop: 12 }} onClick={() => setShift(null)}>Cancel</button>
        </>}
      </Sheet>
    </div>
  )
}

function Links({ snap }: { snap: Snapshot }) {
  return (
    <div className="card">
      <a className="link" href={LIVETRAIL_URL} target="_blank" rel="noreferrer">kodiak.livetrail.net ↗</a>
      <div className="tiny muted">Official splits at some checkpoints only; up to a 2-hour delay. If you find a runner's own page, paste it below.</div>
      {RUNNERS.map(r => (
        <div key={r.id} className="row" style={{ marginTop: 6 }}>
          <span className="small" style={{ width: 52 }}>{r.name}</span>
          <input className="plain" type="url" placeholder="LiveTrail link (optional)" defaultValue={snap.state.links[r.id] ?? ''}
            onBlur={e => { const v = e.target.value.trim(); if (v !== (snap.state.links[r.id] ?? '')) store.dispatch('link_set', { runner: r.id, url: v }) }} />
        </div>
      ))}
    </div>
  )
}

export function describe(e: KEvent): string {
  const p = e.payload
  const who = runnerById(p.runner as string)?.name ?? ''
  const race = RUNNERS.find(r => r.id === p.runner)?.race ?? '100k'
  switch (e.type) {
    case 'checkin_set': return `${who} at ${stationName(race, p.station as string)} ${fmtT(p.at as number)}`
    case 'checkin_cleared': return `Removed ${who}'s ${stationName(race, p.station as string)} check-in`
    case 'status_set': return p.dropped ? `${who} marked dropped` : `${who} un-dropped`
    case 'plan_set': return `${who}'s plan: ${stationName(race, p.station as string)} ${p.at == null ? 'cleared' : fmtT(p.at as number)}`
    case 'note_set': return `${who}'s note for ${stationName(race, p.station as string)}`
    case 'meet_set': return `${p.meeting ? 'Meeting' : 'No meeting'}: ${who} at ${stationName(race, p.station as string)}${p.who ? ` (${p.who})` : ''}`
    case 'cutoff_set': return `Cut-off ${stationName(p.race as string, p.station as string)} → ${fmtT(p.at as number)}`
    case 'lead_set': return `Getting-there time ${stationName('100k', p.station as string)} → ${p.minutes} min`
    case 'crew_name_set': return `${p.active === false ? 'Removed' : 'Added'} crew "${p.name}"`
    case 'ask_sent': return `${who} asked crew: ${[...(p.items as string[] ?? []), p.text].filter(Boolean).join(', ')}`
    case 'ask_ack': return 'Request marked "Got it"'
    case 'link_set': return `${who}'s LiveTrail link`
    case 'undo': return 'Undo'
    default: return e.type
  }
}

function Recent({ snap }: { snap: Snapshot }) {
  const [n, setN] = useState(15)
  const list = [...snap.events].filter(e => e.type !== 'undo').sort((a, b) => b.ts - a.ts).slice(0, n)
  if (!list.length) return <div className="muted small">Nothing yet.</div>
  return (
    <div className="card">
      {list.map(e => {
        const undone = snap.state.undone.has(e.id)
        return (
          <div key={e.id} className="line small">
            <span className="grow" style={undone ? { textDecoration: 'line-through', color: 'var(--fg2)' } : undefined}>
              {describe(e)}<div className="tiny muted">{e.by} · {fmtT(e.ts)}{snap.synced.has(e.id) ? '' : ' · ⧗ not sent'}</div>
            </span>
            {!undone && <button className="btn sm" onClick={() => store.undo([e.id])}>Undo</button>}
          </div>
        )
      })}
      {snap.events.length > n && <button className="link" onClick={() => setN(n + 30)}>Show more</button>}
    </div>
  )
}

function TestMode({ snap }: { snap: Snapshot }) {
  const s = snap.settings
  const [clockOpen, setClockOpen] = useState(false)
  const [val, setVal] = useState<number | null>(null)
  return (
    <div className="card">
      <div className="switch">
        <span>Test mode<div className="tiny muted">Uses a separate practice area — nothing touches race-day data.</div></span>
        <input type="checkbox" checked={s.testMode} onChange={e => store.setSettings({ testMode: e.target.checked })} />
      </div>
      {s.testMode && <>
        <div className="small" style={{ marginTop: 6 }}>Test clock: <b>{fmtDayT(snap.now)}</b></div>
        <div className="btnrow">
          <button className="btn sm" onClick={() => setClockOpen(true)}>Set test clock…</button>
          <button className="btn sm" onClick={() => store.setSettings({ timeOffsetMs: 0 })}>Real time</button>
          <button className="btn sm primary" onClick={() => store.injectLocal(sampleEvents(snap.now))}>Load sample race day (up to the test clock)</button>
        </div>
      </>}
      <Sheet open={clockOpen} onClose={() => setClockOpen(false)}>
        <h2>Test clock</h2>
        <div className="muted small">Pretend it's this time on race weekend.</div>
        <div style={{ marginTop: 10 }}><TimeEntry near={snap.now} onChange={setVal} /></div>
        <button className="confirmbtn" style={{ marginTop: 12 }} disabled={val == null} onClick={() => { store.setSettings({ timeOffsetMs: val! - Date.now() }); setClockOpen(false) }}>Set</button>
      </Sheet>
    </div>
  )
}

function mapsUrl(address: string) { return `https://maps.google.com/?q=${encodeURIComponent(address)}` }

export function CrewInfo() {
  return (
    <div className="page">
      <a className="link" href="#/more">‹ More</a>
      <h1 className="title">Crew info</h1>
      <div className="small muted" style={{ marginBottom: 8 }}>From the official 2026 Runner Guide and aid station charts.</div>
      {LOTS.map(l => (
        <div key={l.id} className="card">
          <div className="bold" style={{ fontSize: 19 }}>{l.name}</div>
          <div className="small">{l.serves}</div>
          <a className="link" href={mapsUrl(l.address)} target="_blank" rel="noreferrer">{l.address} ↗</a>
          <ul className="plain">{l.notes.map(n => <li key={n}>{n}</li>)}</ul>
        </div>
      ))}
      <h2 className="sub">Where crew can go</h2>
      {(Object.values(RACES)).map(r => (
        <div key={r.id} className="card">
          <div className="bold">{r.name}</div>
          {r.stations.filter(s => s.crew).map(s => <div key={s.id} className="line small"><span className="tag crew">CREW</span><span className="grow">{s.name} (mi {s.mile})<div className="tiny muted">{s.crewNote}</div></span></div>)}
        </div>
      ))}
      <h2 className="sub">Rules</h2>
      <div className="card"><ul className="plain">{CREW_RULES.map(r => <li key={r}>{r}</li>)}</ul></div>
    </div>
  )
}

import { useState } from 'react'
import { store, type Snapshot } from '../state/store'
import { RUNNERS, runnerById } from '../data/course'
import { isInAppBrowser, isIOS, isPreviewHost, isStandalone } from '../state/hooks'
import { go } from '../state/router'

/** First run: I'm running / I'm crew → name → install steps → done once "Ready offline". */
export function FirstRun({ snap }: { snap: Snapshot }) {
  const [role, setRole] = useState<'runner' | 'crew' | null>(null)
  const [runner, setRunner] = useState<string | null>(null)
  const [name, setName] = useState(snap.settings.name)
  const [step, setStep] = useState<'who' | 'install'>('who')
  const standalone = isStandalone()

  const finish = () => {
    if (role === 'runner' && runner) { store.setSettings({ role: 'runner', me: runner, crewView: false }); go('me') }
    else if (role === 'crew') { store.setSettings({ role: 'crew', me: null, name: name.trim(), crewView: false }); go('crew') }
  }

  if (step === 'install') {
    const showInstall = !standalone && !isPreviewHost()
    return (
      <div className="page">
        <h1 className="title">{role === 'runner' ? `This phone opens to ${runnerById(runner)?.name}'s race` : `Hi ${name.trim()}`}</h1>
        {showInstall && isInAppBrowser() && <div className="warnbox">This link opened inside another app. Open it in {isIOS() ? 'Safari' : 'Chrome'} to add it to your home screen.</div>}
        {showInstall && (
          <div className="card">
            <div className="bold">Add it to your home screen</div>
            {isIOS()
              ? <ol className="small"><li>In <b>Safari</b>, tap <b>Share ⬆</b></li><li>Tap <b>Add to Home Screen</b></li><li>Open Kodiak from the new icon and set up who you are there (Safari and the icon keep separate data).</li></ol>
              : <ol className="small"><li>In <b>Chrome</b>, tap <b>⋮</b></li><li>Tap <b>Install app</b> (or <b>Add to Home screen</b>)</li><li>Open Kodiak from the new icon.</li></ol>}
          </div>
        )}
        {isPreviewHost() && <div className="infobox">This is a <b>preview</b> — please don't install it. The real one will be at kodiak.zanesorenson.com.</div>}
        <div className="card" style={{ marginTop: 10 }}>
          {snap.flags.offlineReady
            ? <div className="bold">✓ Ready offline — the app is saved on this phone.</div>
            : snap.flags.noSW ? <div className="amber">This browser can't save the app for offline use.</div>
              : <div className="amber">Saving the app for offline use… keep this open on Wi-Fi for a moment.</div>}
        </div>
        <button className="confirmbtn" style={{ marginTop: 14 }} onClick={finish}>{snap.flags.offlineReady || snap.flags.noSW ? 'Done' : 'Continue anyway'}</button>
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="title">Kodiak 2026</h1>
      <div className="muted" style={{ marginBottom: 12 }}>Race-day tracker for Zane, John, Kevy and Ryan · Sat Oct 10</div>
      <div className="chips" style={{ marginBottom: 14 }}>
        <button className={`chip ${role === 'runner' ? 'sel' : ''}`} style={{ flex: 1, minHeight: 64, fontSize: 20 }} onClick={() => setRole('runner')}>I'm running</button>
        <button className={`chip ${role === 'crew' ? 'sel' : ''}`} style={{ flex: 1, minHeight: 64, fontSize: 20 }} onClick={() => setRole('crew')}>I'm crew</button>
      </div>
      {role === 'runner' && <>
        <div className="bold" style={{ marginBottom: 6 }}>Who are you?</div>
        <div className="runners">
          {RUNNERS.map(r => <button key={r.id} className={`chip ${runner === r.id ? 'sel' : ''}`} onClick={() => setRunner(r.id)}>{r.name}</button>)}
        </div>
      </>}
      {role === 'crew' && <>
        <div className="bold" style={{ marginBottom: 6 }}>Your name (shows who logged what)</div>
        <input className="plain" type="text" placeholder="e.g. Mom" value={name} onChange={e => setName(e.target.value)} autoFocus />
      </>}
      <button className="confirmbtn" style={{ marginTop: 16 }} disabled={!(role === 'runner' ? runner : role === 'crew' ? name.trim() : false)} onClick={() => setStep('install')}>Next</button>
    </div>
  )
}

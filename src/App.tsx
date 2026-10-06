import { useEffect, useState } from 'react'
import { useStore, useStandalone, isIOS, isPreviewHost } from './state/hooks'
import { useRoute, go } from './state/router'
import { store } from './state/store'
import { FirstRun } from './screens/FirstRun'
import { MyRace } from './screens/MyRace'
import { Crew } from './screens/Crew'
import { CheckIn } from './screens/CheckIn'
import { Timeline } from './screens/Timeline'
import { Plans } from './screens/Plans'
import { More } from './screens/More'
import { RunnerDetail } from './screens/RunnerDetail'
import { applyUpdate } from './pwa'

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void> }

export default function App() {
  const snap = useStore()
  const route = useRoute()
  const standalone = useStandalone()
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const { settings, flags } = snap
  useEffect(() => { document.documentElement.classList.toggle('test', settings.testMode) }, [settings.testMode])

  useEffect(() => {
    const onBip = (e: Event) => { e.preventDefault(); if (!isPreviewHost()) setInstallEvt(e as BeforeInstallPromptEvent) }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])
  // Every screen change starts at the top.
  const routeKey = JSON.stringify(route)
  useEffect(() => { if (route.tab !== 'timeline') window.scrollTo({ top: 0, left: 0 }) }, [routeKey, route.tab])

  const top = (
    <>
      {settings.testMode && <div className="testbar">TEST MODE — practice data, not race day</div>}
      {isPreviewHost() && <div className="previewbar">PREVIEW — look, don't install. The real app will be at kodiak.zanesorenson.com</div>}
      {!snap.storageOk && <div className="banner red" style={{ margin: 8 }}><span className="grow">This browser is blocking storage — entries will be lost when you close it. Open the site in Safari/Chrome (not private mode).</span></div>}
      {flags.updateReady && <div className="banner amber" style={{ margin: 8 }}><span className="grow bold">A new version is ready.</span><button onClick={applyUpdate}>Update now</button></div>}
    </>
  )

  if (!settings.role) return <div className="app">{top}<FirstRun snap={snap} /></div>

  const runnerHome = settings.role === 'runner' && !settings.crewView
  if (runnerHome && settings.me) return <div className="app">{top}<MyRace snap={snap} runnerId={settings.me} /></div>

  const tab = route.tab === 'default' || route.tab === 'me' ? 'crew' : route.tab
  const showInstall = !standalone && !settings.installDismissed && !isPreviewHost() && (isIOS() || installEvt)
  return (
    <div className="app tabs">
      {top}
      {showInstall && (
        <div className="banner" style={{ margin: '8px 12px 0' }}>
          <span className="grow small">{isIOS() ? <>Add to your home screen: tap Share <b>⬆</b> → <b>Add to Home Screen</b>, then open it from the icon.</> : <>Install this app for an offline copy and a home-screen icon.</>}</span>
          {installEvt && <button onClick={() => installEvt.prompt()}>Install</button>}
          <button className="plain" onClick={() => store.setSettings({ installDismissed: true })}>Not now</button>
        </div>
      )}
      {settings.role === 'runner' && (
        <div className="banner" style={{ margin: '8px 12px 0' }}><span className="grow small">Crew view</span><button onClick={() => { store.setSettings({ crewView: false }); go('me') }}>Back to My Race</button></div>
      )}
      {tab === 'crew' && <Crew snap={snap} />}
      {tab === 'checkin' && <CheckIn snap={snap} runner={route.tab === 'checkin' ? route.runner : undefined} />}
      {tab === 'timeline' && <Timeline snap={snap} />}
      {tab === 'plans' && <Plans snap={snap} runner={route.tab === 'plans' ? route.runner : undefined} />}
      {tab === 'more' && <More snap={snap} section={route.tab === 'more' ? route.section : undefined} />}
      {tab === 'runner' && route.tab === 'runner' && <RunnerDetail snap={snap} id={route.id} />}
      <nav className="tabbar">
        <Tab path="crew" label="Crew" ico="◉" active={tab === 'crew' || tab === 'runner'} />
        <Tab path="checkin" label="Check in" ico="✓" active={tab === 'checkin'} />
        <Tab path="timeline" label="Timeline" ico="☰" active={tab === 'timeline'} />
        <Tab path="plans" label="Plans" ico="✎" active={tab === 'plans'} />
        <Tab path="more" label="More" ico="⋯" active={tab === 'more'} />
      </nav>
    </div>
  )
}

function Tab({ path, label, ico, active }: { path: string; label: string; ico: string; active: boolean }) {
  return <button className={active ? 'active' : ''} onClick={() => go(path)} aria-current={active ? 'page' : undefined}><span className="ico">{ico}</span>{label}</button>
}

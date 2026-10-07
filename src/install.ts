// Home-screen install: catch Chrome's install prompt as early as possible, and detect whether the app is installed.
import { store } from './state/store'

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: string }> }
let deferred: BeforeInstallPromptEvent | null = null

export function startInstall() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    store.setFlags({ canInstall: true })
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    store.setFlags({ canInstall: false })
    store.setSettings({ installed: true })
  })
  // Android Chrome can tell us if this web app is already on the home screen (manifest related_applications).
  const nav = navigator as unknown as { getInstalledRelatedApps?: () => Promise<unknown[]> }
  nav.getInstalledRelatedApps?.().then(apps => store.setSettings({ installed: apps.length > 0 })).catch(() => {})
}

export async function promptInstall() {
  if (!deferred) return
  await deferred.prompt()
  const choice = await deferred.userChoice?.catch(() => null)
  if (choice?.outcome === 'accepted') { deferred = null; store.setFlags({ canInstall: false }); store.setSettings({ installed: true }) }
}

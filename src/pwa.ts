import { registerSW } from 'virtual:pwa-register'
import { store } from './state/store'

let update: ((reload?: boolean) => Promise<void>) | null = null

/** Register the service worker. New versions wait for a tap ("Update now") so nobody loses a half-typed check-in. */
export function startPWA() {
  if (!('serviceWorker' in navigator)) { store.setFlags({ noSW: true }); return }
  if (navigator.serviceWorker.controller) store.setFlags({ offlineReady: true })
  // An active worker means the whole app finished saving to the phone (also covers a reload mid-install).
  void navigator.serviceWorker.ready.then(reg => { if (reg.active) store.setFlags({ offlineReady: true }) })
  update = registerSW({
    immediate: true,
    onOfflineReady() { store.setFlags({ offlineReady: true }) },
    onNeedRefresh() { store.setFlags({ updateReady: true }) },
    onRegisteredSW() { if (navigator.serviceWorker.controller) store.setFlags({ offlineReady: true }) },
  })
}

export function applyUpdate() { void update?.(true) }

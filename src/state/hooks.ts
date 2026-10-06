import { useEffect, useState, useSyncExternalStore } from 'react'
import { store, type Snapshot } from './store'

export function useStore(): Snapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}

export function useStandalone(): boolean {
  const [v, setV] = useState(() => isStandalone())
  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    const on = () => setV(isStandalone())
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return v
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** Links opened inside Gmail, WhatsApp, Instagram, Facebook, etc. can't install to the home screen. */
export function isInAppBrowser(): boolean {
  return /FBAN|FBAV|Instagram|Line\/|GSA\/|WhatsApp|Snapchat|Twitter|LinkedInApp|Messenger|wv\)/i.test(navigator.userAgent)
}

/** The temporary GitHub preview address: look, don't install. */
export function isPreviewHost(): boolean {
  return location.hostname.endsWith('github.io')
}

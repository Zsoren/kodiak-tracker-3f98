import type { Snapshot } from '../state/store'
import { isInAppBrowser, isIOS, isPreviewHost, useStandalone } from '../state/hooks'
import { promptInstall } from '../install'

/** Shown at the top of every screen until the app is on the home screen. */
export function InstallBanner({ snap, compact = false }: { snap: Snapshot; compact?: boolean }) {
  const standalone = useStandalone()
  if (standalone || isPreviewHost()) return null
  if (snap.settings.installed) {
    return <div className="banner small" style={{ margin: compact ? 0 : undefined }}><span className="grow">✓ Installed — open <b>Kodiak</b> from your home screen icon.</span></div>
  }
  let body
  if (isInAppBrowser()) body = <>Open this link in <b>{isIOS() ? 'Safari' : 'Chrome'}</b> to add it to your home screen.</>
  else if (isIOS()) body = <>Add to your home screen: tap <b>Share ⬆</b> → <b>Add to Home Screen</b>, then open Kodiak from the icon.</>
  else if (snap.flags.canInstall) body = <>Add Kodiak to your home screen.</>
  else body = <>Add to your home screen: in Chrome tap <b>⋮</b> → <b>Install app</b> (or <b>Add to Home screen</b>).</>
  return (
    <div className="banner amber" style={{ margin: compact ? 0 : undefined }} role="note">
      <span className="grow small">{body}</span>
      {snap.flags.canInstall && !isIOS() && <button onClick={() => void promptInstall()}>Install app</button>}
    </div>
  )
}

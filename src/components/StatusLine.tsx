import type { Snapshot } from '../state/store'
import { fmtAgo, fmtClock } from '../model/time'
import { syncNow } from '../sync'

/** "Updated 3:42 PM (12 min ago) · Live / Offline · ⧗ 2 not sent · [Refresh]" — recomputed on render, never on a timer. */
export function StatusLine({ snap, compact = false }: { snap: Snapshot; compact?: boolean }) {
  const { sync, pending, now } = snap
  if (sync.mode === 'off') {
    return (
      <div className="status">
        <span className="dot off" />
        <span className="grow">{compact ? 'This phone only' : 'Sharing not set up yet — saved on this phone only'}</span>
      </div>
    )
  }
  const offline = !sync.online || (!!sync.error && !sync.syncing)
  const updated = sync.lastPulled ? `Updated ${fmtClock(sync.lastPulled)} (${fmtAgo(sync.lastPulled, now)})` : 'Not updated yet'
  return (
    <div className="status" aria-live="polite">
      <span className={`dot ${sync.live && !offline ? 'on' : offline ? 'off' : ''}`} />
      <span className="grow">
        {sync.syncing ? 'Updating…' : updated}
        {!compact && (sync.live && !offline ? ' · Live' : offline ? ' · Offline' : '')}
        {pending > 0 && <> · <span className="notsent">⧗ {pending} not sent</span></>}
      </span>
      <button className="refresh" onClick={() => { void syncNow() }} disabled={sync.syncing} aria-label="Refresh">↻{compact ? '' : ' Refresh'}</button>
    </div>
  )
}

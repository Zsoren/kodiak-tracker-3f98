// Sync orchestration. Battery rules: work happens ONLY when the app opens, comes back to the screen,
// the phone comes back online, something is entered on this phone, or Refresh is tapped.
// No repeating timers, no background sync. Live updates only on crew phones and only while on screen.
import { store } from '../state/store'
import { loadJSON, saveJSON } from '../state/storage'
import { parseFirebaseConfig } from './config'
import { withTimeout, type Backend } from './backend'
import { firestoreBackend } from './firestore'
import { fakeHttpBackend } from './fakeHttp'

const NET_TIMEOUT_MS = 15_000
const LIVE_ENABLED = (import.meta.env.VITE_LIVE as string | undefined) !== '0'

let backend: Backend | null = null
let cursorMs = 0
let running = false
let again = false
let liveStop: (() => Promise<void>) | null = null
let liveStarting = false
let liveGen = 0

function loadCursor() { cursorMs = loadJSON<number>(store.key('cursor'), 0) }
function saveCursor(ms: number) { if (ms > cursorMs) { cursorMs = ms; saveJSON(store.key('cursor'), ms) } }

function friendly(e: unknown): string {
  const m = String((e as Error)?.message ?? e)
  if (/timed out/i.test(m)) return 'No connection (timed out)'
  if (/failed to fetch|network|offline|unavailable/i.test(m)) return 'No connection'
  return m
}

/** Send anything waiting, then fetch everyone else's updates. */
export async function syncNow(): Promise<void> {
  if (!backend) return
  if (running) { again = true; return }
  running = true
  store.setSync({ syncing: true })
  try {
    const out = store.unsyncedEvents()
    if (out.length) {
      const r = await withTimeout(backend.push(store.dataKey, out), NET_TIMEOUT_MS, 'Sending')
      store.markSynced(r.ok)
      if (r.error) store.setSync({ error: r.error })
    }
    const key = store.dataKey
    const p = await withTimeout(backend.pull(key, cursorMs), NET_TIMEOUT_MS, 'Fetching')
    if (key === store.dataKey) {
      store.merge(p.events)
      saveCursor(p.cursorMs)
      store.setPulled(store.now())
    }
  } catch (e) {
    store.setSync({ error: friendly(e) })
  } finally {
    running = false
    store.setSync({ syncing: false })
    if (again) { again = false; void syncNow() }
  }
}

function wantLive(): boolean {
  const s = store.getSnapshot().settings
  return !!backend?.live && LIVE_ENABLED && s.role === 'crew' && document.visibilityState === 'visible'
}

async function startLive() {
  if (!wantLive() || liveStop || liveStarting || !backend?.live) return
  liveStarting = true
  const gen = ++liveGen
  try {
    const key = store.dataKey
    const stop = await backend.live(key, cursorMs, (events, cur) => {
      if (key !== store.dataKey) return
      store.merge(events); saveCursor(cur); store.setPulled(store.now())
    }, e => { store.setSync({ error: friendly(e) }); void stopLive() })
    if (gen !== liveGen || !wantLive()) { await stop(); return }
    liveStop = stop
    store.setSync({ live: true })
  } catch (e) {
    store.setSync({ error: friendly(e) })
  } finally {
    liveStarting = false
  }
}

/** Close the live connection immediately (screen off / app hidden). */
export async function stopLive() {
  liveGen++
  const s = liveStop
  liveStop = null
  if (store.getSnapshot().sync.live) store.setSync({ live: false })
  if (s) await s().catch(() => {})
}

export function liveSupported(): boolean { return !!backend?.live && LIVE_ENABLED }

export function startSync() {
  const fake = import.meta.env.VITE_FAKE_REMOTE as string | undefined
  const cfg = parseFirebaseConfig(import.meta.env.VITE_FIREBASE_CONFIG as string | undefined)
  if (cfg) backend = firestoreBackend(cfg)
  else if (fake) backend = fakeHttpBackend(fake)
  if (!backend) { store.setSync({ mode: 'off' }); return }
  store.setSync({ mode: 'on' })
  loadCursor()

  store.onLocalEvents(() => { queueMicrotask(() => void syncNow()) })
  store.onReset(() => { loadCursor(); void stopLive().then(() => { void syncNow(); void startLive() }) })
  window.addEventListener('online', () => { void syncNow(); void startLive() })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { store.touch(); void syncNow(); void startLive() }
    else void stopLive()
  })
  window.addEventListener('pagehide', () => void stopLive())
  // role switch (crew ↔ runner) turns live updates on/off
  let lastWant = wantLive()
  store.subscribe(() => {
    const w = wantLive()
    if (w === lastWant) return
    lastWant = w
    if (w) void startLive(); else void stopLive()
  })

  void syncNow()
  void startLive()
}

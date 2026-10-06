// Firebase backend.
// - All sends and fetches use Firestore *Lite*: plain one-shot web requests, nothing stays open.
// - Live updates (crew phones, only while on screen) use the full SDK in its own throw-away app instance,
//   which is deleted the moment the screen is hidden, so its connection is torn down immediately.
import type { Backend } from './backend'
import { toWire } from './backend'

type Cfg = Record<string, string>
let liteP: Promise<{ fs: typeof import('firebase/firestore/lite'); db: import('firebase/firestore/lite').Firestore }> | null = null
let liveN = 0

function lite(config: Cfg) {
  if (!liteP) {
    liteP = (async () => {
      const { initializeApp } = await import('firebase/app')
      const fs = await import('firebase/firestore/lite')
      const app = initializeApp(config, 'kodiak-lite')
      return { fs, db: fs.getFirestore(app) }
    })()
    liteP.catch(() => { liteP = null })
  }
  return liteP
}

function code(e: unknown): string { return String((e as { code?: string })?.code ?? (e as Error)?.message ?? e) }

export function firestoreBackend(config: Cfg): Backend {
  return {
    name: 'firestore',
    async push(key, events) {
      const { fs, db } = await lite(config)
      const ok: string[] = [], failed: string[] = []
      let error: string | undefined
      const res = await Promise.allSettled(events.map(e => fs.setDoc(fs.doc(db, 'races', key, 'events', e.id), { ...toWire(e), serverTs: fs.serverTimestamp() })))
      for (let i = 0; i < res.length; i++) {
        const r = res[i], e = events[i]
        if (r.status === 'fulfilled') { ok.push(e.id); continue }
        // Rules are create-only, so a re-send of an event that already exists is refused.
        // Only count it as sent if it is really there; otherwise keep it queued and report the problem.
        if (code(r.reason).includes('permission-denied')) {
          try {
            const snap = await fs.getDoc(fs.doc(db, 'races', key, 'events', e.id))
            if (snap.exists()) { ok.push(e.id); continue }
          } catch { /* fall through */ }
          error = 'The database refused a change (permission denied).'
        } else error = code(r.reason)
        failed.push(e.id)
      }
      return { ok, failed, error }
    },
    async pull(key, cursorMs) {
      const { fs, db } = await lite(config)
      const since = fs.Timestamp.fromMillis(Math.max(0, cursorMs - 3600_000))
      const snap = await fs.getDocs(fs.query(fs.collection(db, 'races', key, 'events'), fs.where('serverTs', '>', since), fs.orderBy('serverTs')))
      let cur = cursorMs
      const events: unknown[] = []
      for (const d of snap.docs) {
        const data = d.data() as Record<string, unknown> & { serverTs?: { toMillis(): number } }
        events.push(data)
        const ms = data.serverTs?.toMillis?.()
        if (ms && ms > cur) cur = ms
      }
      return { events, cursorMs: cur }
    },
    async live(key, cursorMs, onEvents, onError) {
      const { initializeApp, deleteApp } = await import('firebase/app')
      const f = await import('firebase/firestore')
      const app = initializeApp(config, `kodiak-live-${++liveN}`)
      const db = f.initializeFirestore(app, { localCache: f.memoryLocalCache() })
      const since = f.Timestamp.fromMillis(Math.max(0, cursorMs - 3600_000))
      const q = f.query(f.collection(db, 'races', key, 'events'), f.where('serverTs', '>', since), f.orderBy('serverTs'))
      const unsub = f.onSnapshot(q, snap => {
        let cur = cursorMs
        const events: unknown[] = []
        for (const d of snap.docs) {
          if (d.metadata.hasPendingWrites) continue
          const data = d.data() as Record<string, unknown> & { serverTs?: { toMillis(): number } }
          events.push(data)
          const ms = data.serverTs?.toMillis?.()
          if (ms && ms > cur) cur = ms
        }
        onEvents(events, cur)
      }, onError)
      return async () => {
        unsub()
        await deleteApp(app)   // terminates Firestore and closes its network connection now, not after an idle timeout
      }
    },
  }
}

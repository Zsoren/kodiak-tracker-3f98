// Test-only backend: a tiny local server (scripts/fake-server.mjs) standing in for the shared database,
// so sharing and the offline queue can be tested before Firebase exists.
import type { Backend } from './backend'
import { toWire } from './backend'

export function fakeHttpBackend(base: string): Backend {
  const url = (key: string) => `${base.replace(/\/$/, '')}/races/${encodeURIComponent(key)}/events`
  return {
    name: 'fake',
    async push(key, events) {
      const r = await fetch(url(key), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(events.map(toWire)) })
      if (!r.ok) return { ok: [], failed: events.map(e => e.id), error: `server ${r.status}` }
      const body = await r.json() as { stored: string[] }
      const ok = new Set(body.stored)
      return { ok: events.filter(e => ok.has(e.id)).map(e => e.id), failed: events.filter(e => !ok.has(e.id)).map(e => e.id) }
    },
    async pull(key, cursorMs) {
      const r = await fetch(`${url(key)}?since=${Math.max(0, cursorMs - 3600_000)}`)
      if (!r.ok) throw new Error(`server ${r.status}`)
      const body = await r.json() as { events: (Record<string, unknown> & { serverTs: number })[] }
      let cur = cursorMs
      for (const e of body.events) if (e.serverTs > cur) cur = e.serverTs
      return { events: body.events, cursorMs: cur }
    },
  }
}

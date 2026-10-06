// Stand-in for the shared database during local tests (no Firebase needed).
// Append-only like the real rules: an event id can be created once; re-sends are acknowledged, never overwritten.
// Usage: node scripts/fake-server.mjs [port]   — or import { startFakeServer } from a test script.
import http from 'node:http'

export function startFakeServer(port = 8787) {
  const races = new Map()   // key → Map(id → event with serverTs)
  let last = 0
  const stats = { posts: 0, gets: 0 }
  const server = http.createServer(async (req, res) => {
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('access-control-allow-headers', 'content-type')
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
    const m = /^\/races\/([^/]+)\/events(\?.*)?$/.exec(req.url ?? '')
    if (!m) { res.writeHead(404); res.end(); return }
    const key = decodeURIComponent(m[1])
    if (!races.has(key)) races.set(key, new Map())
    const store = races.get(key)
    if (req.method === 'POST') {
      stats.posts++
      let body = ''
      for await (const chunk of req) body += chunk
      const events = JSON.parse(body || '[]')
      const stored = []
      for (const e of events) {
        if (!e || typeof e.id !== 'string') continue
        if (!store.has(e.id)) { last = Math.max(Date.now(), last + 1); store.set(e.id, { ...e, serverTs: last }) }
        stored.push(e.id)
      }
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ stored }))
      return
    }
    stats.gets++
    const since = Number(new URL(req.url, 'http://x').searchParams.get('since') ?? 0)
    const events = [...store.values()].filter(e => e.serverTs > since).sort((a, b) => a.serverTs - b.serverTs)
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ events }))
  })
  return new Promise(resolve => server.listen(port, () => resolve({ server, races, stats, close: () => new Promise(r => server.close(r)) })))
}

if (process.argv[1]?.endsWith("fake-server.mjs")) {
  const port = Number(process.argv[2] ?? 8787)
  startFakeServer(port).then(() => console.log(`fake shared database on http://localhost:${port}`))
}

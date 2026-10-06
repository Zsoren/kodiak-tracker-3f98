// "Nothing runs while hidden": counts every timer, network request and animation frame while the app is hidden.
// Runs a crew phone and a runner phone. Must be zero. Then brings the app back and expects exactly one refresh.
// Usage: HIDDEN_SECONDS=180 node scripts/hidden-test.mjs   (default 180 s)
import { startServers, phone, pt, sleep } from './lib.mjs'

const SECONDS = Number(process.env.HIDDEN_SECONDS ?? 180)
const S = await startServers()
const out = []
let fail = false

const INSTRUMENT = () => {
  const c = { setTimeout: 0, setInterval: 0, timerFired: 0, rAF: 0, fetch: 0, xhr: 0, socket: 0, beacon: 0 }
  window.__counts = c
  window.__vis = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis })
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__vis === 'hidden' })
  const st = window.setTimeout, si = window.setInterval, raf = window.requestAnimationFrame, f = window.fetch
  window.setTimeout = (fn, ms, ...a) => { c.setTimeout++; return st((...x) => { c.timerFired++; return typeof fn === 'function' ? fn(...x) : undefined }, ms, ...a) }
  window.setInterval = (fn, ms, ...a) => { c.setInterval++; return si((...x) => { c.timerFired++; return fn(...x) }, ms, ...a) }
  window.requestAnimationFrame = cb => { c.rAF++; return raf(cb) }
  window.fetch = (...a) => { c.fetch++; return f(...a) }
  const open = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (...a) { c.xhr++; return open.apply(this, a) }
  const WS = window.WebSocket
  window.WebSocket = function (...a) { c.socket++; return new WS(...a) }
  const ES = window.EventSource
  window.EventSource = function (...a) { c.socket++; return new ES(...a) }
  const sb = navigator.sendBeacon?.bind(navigator)
  if (sb) navigator.sendBeacon = (...a) => { c.beacon++; return sb(...a) }
}

async function run(label, opts) {
  const p = await phone(S.browser, S.url, { ...opts, clock: pt(10, 15, 0) })
  await p.page.addInitScript(INSTRUMENT)
  await p.page.reload(); await p.page.waitForSelector('.app')
  await p.page.waitForFunction(() => !window.__kodiak.store.getSnapshot().sync.syncing)
  await sleep(1500)
  const requests = []
  p.page.on('request', r => requests.push(r.url()))
  // hide the app (like switching apps / screen off)
  await p.page.evaluate(() => {
    window.__vis = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    for (const k of Object.keys(window.__counts)) window.__counts[k] = 0
  })
  requests.length = 0
  const t0 = Date.now()
  await sleep(SECONDS * 1000)
  const hidden = await p.page.evaluate(() => ({ ...window.__counts }))
  const hiddenReq = requests.length
  const total = Object.values(hidden).reduce((a, b) => a + b, 0) + hiddenReq
  out.push(`${label}: hidden ${Math.round((Date.now() - t0) / 1000)} s → ${total === 0 ? 'NOTHING ran' : 'ACTIVITY: ' + JSON.stringify(hidden) + ` + ${hiddenReq} requests ${requests.slice(0, 3).join(', ')}`}`)
  if (total !== 0) fail = true
  // come back: one refresh should happen
  await p.page.evaluate(() => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')) })
  await sleep(1500)
  const back = await p.page.evaluate(() => ({ ...window.__counts }))
  const refreshed = requests.filter(u => u.includes('/races/')).length
  out.push(`${label}: back on screen → ${refreshed} request(s) to fetch updates ${refreshed >= 1 ? '(refresh happened)' : '(NO refresh!)'}; timers since: ${back.setTimeout} one-shot (network time limits), ${back.setInterval} repeating`)
  if (refreshed < 1 || back.setInterval > 0) fail = true
  await p.ctx.close()
}

await Promise.all([
  run('crew phone', { role: 'crew', name: 'Mom' }),
  run('runner phone', { role: 'runner', me: 'zane' }),
])
await S.close()
console.log(out.join('\n'))
console.log(fail ? 'HIDDEN TEST FAILED' : 'HIDDEN TEST PASSED')
process.exit(fail ? 1 : 0)

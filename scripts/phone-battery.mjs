// Real-phone screen-off test WITHOUT DevTools attached (an attached debugger keeps Chrome treating the page as visible).
// The page records every network call, timer and visibility change with timestamps in memory; DevTools disconnects;
// the screen goes off for N minutes; then we reconnect and count what happened while hidden.
// Usage: node scripts/phone-battery.mjs <crew|runner> [minutes]
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'

const ADB = `${process.env.LOCALAPPDATA}/Android/Sdk/platform-tools/adb.exe`
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8' })
const mode = process.argv[2] ?? 'crew'
const MIN = Number(process.argv[3] ?? 10)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const log = m => console.log(`[${new Date().toLocaleTimeString()}] ${m}`)
async function getPage() {
  const browser = await chromium.connectOverCDP('http://localhost:9222')
  for (const p of browser.contexts().flatMap(c => c.pages()))
    if (p.url().startsWith('https://kodiak.zanesorenson.com') && await p.evaluate(() => matchMedia('(display-mode: standalone)').matches).catch(() => false)) return { browser, page: p }
  throw new Error('installed Kodiak app not open')
}

let { browser, page } = await getPage()
await page.evaluate(m => {
  const s = JSON.parse(localStorage.getItem('kodiak:settings:v1') || '{}')
  Object.assign(s, m === 'crew' ? { role: 'crew', name: 'Battery test', crewView: false, testMode: true } : { role: 'runner', me: 'zane', crewView: false, testMode: true })
  localStorage.setItem('kodiak:settings:v1', JSON.stringify(s))
}, mode)
await page.reload(); await page.waitForSelector('.app'); await sleep(6000)
log(`${mode} phone ready · status: ${(await page.innerText('.status, .mr-status').catch(() => '?')).replace(/\s+/g, ' ')}`)
await page.evaluate(() => {
  const L = window.__L = []
  const rec = (k, d = '') => L.push([Date.now(), document.visibilityState, k, String(d).slice(0, 80)])
  const st = window.setTimeout, si = window.setInterval, f = window.fetch, raf = window.requestAnimationFrame
  window.setTimeout = (fn, ms, ...a) => { rec('setTimeout', ms); return st((...x) => { rec('timerFired', ms); return typeof fn === 'function' ? fn(...x) : undefined }, ms, ...a) }
  window.setInterval = (fn, ms, ...a) => { rec('setInterval', ms); return si(fn, ms, ...a) }
  window.fetch = (...a) => { rec('fetch', typeof a[0] === 'string' ? a[0] : a[0]?.url); return f(...a) }
  window.requestAnimationFrame = cb => { rec('rAF'); return raf(cb) }
  const open = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (...a) { rec('xhr', a[1]); return open.apply(this, a) }
  document.addEventListener('visibilitychange', () => rec('VIS', document.visibilityState), true)
  rec('start')
})
await browser.close()                                   // DevTools fully disconnected from here on
const tDisconnect = Date.now()
log('DevTools disconnected · screen on for 10 s')
await sleep(10_000)
adb('shell', 'input', 'keyevent', 'KEYCODE_SLEEP')
const tSleep = Date.now()
log(`screen OFF for ${MIN} min`)
for (let m = 1; m <= MIN; m++) { await sleep(60_000); log(`  ${m} min`) }
adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP')
await sleep(4000);
({ browser, page } = await getPage())
const L = await page.evaluate(() => window.__L)
const hideAt = L.find(e => e[2] === 'VIS' && e[3] === 'hidden')?.[0]
const showAt = L.find(e => e[2] === 'VIS' && e[3] === 'visible' && (!hideAt || e[0] > hideAt))?.[0]
const before = L.filter(e => hideAt && e[0] < hideAt && e[2] !== 'start' && e[2] !== 'VIS')
const during = L.filter(e => hideAt && e[0] > hideAt + 1000 && (!showAt || e[0] < showAt))
const kinds = arr => arr.reduce((m, e) => { m[e[2]] = (m[e[2]] ?? 0) + 1; return m }, {})
log(`hidden ${hideAt ? Math.round((hideAt - tDisconnect) / 100) / 10 + ' s after DevTools disconnected, ' + Math.round((hideAt - tSleep) / 100) / 10 + ' s after the screen turned off' : 'NEVER'}`)
log(`page told it was hidden: ${hideAt ? 'yes' : 'NO'} · back on screen: ${showAt ? 'yes, after ' + Math.round((showAt - hideAt) / 60000) + ' min' : 'no'}`)
log(`screen ON (10 s before): ${JSON.stringify(kinds(before))}`)
log(`screen OFF (${MIN} min, from 1 s after hiding): ${during.length ? JSON.stringify(kinds(during)) + ' ' + during.slice(0, 4).map(e => e[2] + ':' + e[3]).join(' | ') : 'NOTHING'}`)
const after = L.filter(e => showAt && e[0] >= showAt)
log(`back on screen: ${JSON.stringify(kinds(after))}`)
log(hideAt && during.length === 0 ? 'PASS — Kodiak did nothing while the screen was off' : 'CHECK — see above')
await browser.close().catch(() => {}); process.exit(0)

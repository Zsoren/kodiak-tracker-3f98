// Real-phone screen-off test (Android over USB). Turns the screen off for N minutes and records everything the
// Kodiak page does: network requests (via Chrome DevTools), timers and fetches (counted inside the page).
// Usage: node scripts/phone-battery.mjs <crew|runner> [minutes]     (needs adb + adb forward tcp:9222 localabstract:chrome_devtools_remote)
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'

const ADB = `${process.env.LOCALAPPDATA}/Android/Sdk/platform-tools/adb.exe`
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8' })
const mode = process.argv[2] ?? 'runner'
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
// set the phone up as crew (test mode) or as Zane (test mode)
await page.evaluate(m => {
  const s = JSON.parse(localStorage.getItem('kodiak:settings:v1') || '{}')
  Object.assign(s, m === 'crew' ? { role: 'crew', name: 'Battery test', crewView: false, testMode: true } : { role: 'runner', me: 'zane', crewView: false, testMode: true })
  localStorage.setItem('kodiak:settings:v1', JSON.stringify(s))
}, mode)
await page.reload(); await page.waitForSelector('.app'); await sleep(6000)
log(`${mode} phone ready · status: ${(await page.innerText('.status, .mr-status').catch(() => '?')).replace(/\s+/g, ' ')}`)

// count inside the page
await page.evaluate(() => {
  const c = { setTimeout: 0, setInterval: 0, timerFired: 0, fetch: 0, xhr: 0, rAF: 0 }
  window.__c = c
  const st = window.setTimeout, si = window.setInterval, f = window.fetch, raf = window.requestAnimationFrame
  window.setTimeout = (fn, ms, ...a) => { c.setTimeout++; return st((...x) => { c.timerFired++; return typeof fn === 'function' ? fn(...x) : undefined }, ms, ...a) }
  window.setInterval = (fn, ms, ...a) => { c.setInterval++; return si(fn, ms, ...a) }
  window.fetch = (...a) => { c.fetch++; return f(...a) }
  window.requestAnimationFrame = cb => { c.rAF++; return raf(cb) }
  const open = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (...a) { c.xhr++; return open.apply(this, a) }
})
// watch the network from Chrome DevTools
const cdp = await page.context().newCDPSession(page)
await cdp.send('Network.enable')
const open = new Map(), started = []
cdp.on('Network.requestWillBeSent', e => { started.push({ t: Date.now(), url: e.request.url }); open.set(e.requestId, e.request.url) })
for (const ev of ['Network.loadingFinished', 'Network.loadingFailed']) cdp.on(ev, e => open.delete(e.requestId))
await sleep(1500)
const openBefore = [...open.values()].filter(u => /firestore/.test(u)).length
log(`Firebase connections open with screen ON: ${openBefore}`)

// screen off
const tOff = Date.now()
adb('shell', 'input', 'keyevent', 'KEYCODE_SLEEP')
await page.evaluate(() => { for (const k of Object.keys(window.__c)) window.__c[k] = 0 }).catch(() => {})
await sleep(5000)
const openAfter5 = [...open.values()].filter(u => /firestore/.test(u)).length
log(`screen OFF · 5 s later, Firebase connections open: ${openAfter5}`)
const baseline = started.length
for (let m = 1; m <= MIN; m++) {
  await sleep(60_000)
  log(`screen off ${m} min · new requests: ${started.length - baseline} · open: ${open.size}`)
}
const counts = await page.evaluate(() => ({ ...window.__c })).catch(e => ({ error: String(e) }))
const reqs = started.slice(baseline)
log(`RESULT (${mode}, ${MIN} min screen off): ${reqs.length} network requests, ${open.size} connections open, inside the page: ${JSON.stringify(counts)}`)
if (reqs.length) log('requests: ' + reqs.slice(0, 5).map(r => r.url.slice(0, 90)).join(' | '))
adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP')
const pass = reqs.length === 0 && open.size === 0 && !counts.error && Object.values(counts).every(v => v === 0)
log(pass ? 'PASS — Kodiak did nothing while the screen was off' : 'CHECK — activity while the screen was off (see above)')
await browser.close().catch(() => {})
process.exit(0)

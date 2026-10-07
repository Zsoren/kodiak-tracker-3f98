// Live test on the real site (test mode → practice area only, never race data).
// 1) crew phone A logs a check-in → crew phone B sees it WITHOUT tapping refresh (live while on screen)
// 2) runner phone sees it when opened (one-shot fetch, no live connection)
// 3) go/no-go: when B is hidden, its live Firebase connection must close within ~5 s and nothing may reopen while hidden
// Usage: node scripts/live-sync-test.mjs [url]
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'https://kodiak.zanesorenson.com/'
const pt = (day, h, m = 0) => Date.UTC(2026, 9, day, h + 7, m)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const out = []
let fail = false
const ok = (c, m) => { out.push(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fail = true }
const stamp = Date.now()

const VIS = () => {
  window.__vis = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis })
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__vis === 'hidden' })
}

const browser = await chromium.launch()
async function phone(name, settings) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Los_Angeles' })
  const page = await ctx.newPage()
  await page.addInitScript(VIS)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  const net = { open: new Map(), started: [] }
  page.on('request', r => { if (/firestore\.googleapis\.com/.test(r.url())) { net.open.set(r, Date.now()); net.started.push({ t: Date.now(), url: r.url() }) } })
  const done = r => net.open.delete(r)
  page.on('requestfinished', done); page.on('requestfailed', done)
  await page.goto(url)
  await page.evaluate(s => { localStorage.clear(); localStorage.setItem('kodiak:settings:v1', JSON.stringify(s)) }, {
    deviceId: `live-${name}-${stamp}`, testMode: true, timeOffsetMs: pt(10, 8, 30) - Date.now(), installDismissed: true, crewView: false, crewChief: '', crewPhones: {}, ...settings,
  })
  await page.reload(); await page.waitForSelector('.app')
  return { ctx, page, errors, net, name }
}
const statusText = p => p.page.innerText('.status, .mr-status').catch(() => '')

const A = await phone('A', { role: 'crew', name: 'LiveTest A', me: null })
const B = await phone('B', { role: 'crew', name: 'LiveTest B', me: null })
await sleep(4000)
ok(/Live/.test(await statusText(B)), `crew phone B shows "Live": "${(await statusText(B)).replace(/\s+/g, ' ')}"`)

// 1) A logs Ryan at Snow Summit with a distinctive minute; B must see it without refresh
await A.page.goto(url + '#/checkin/ryan'); await sleep(500)
await A.page.click('.srow >> text=Snow Summit')
await A.page.click('.tchips >> text=−15')
await A.page.click('.ci-panel .bigbtn')
const loggedAt = await A.page.evaluate(() => window.localStorage && JSON.parse(localStorage.getItem('kodiak:kodiak2026-b7f3q9xk2m4w8r1z-test:events') || '[]').filter(e => e.type === 'checkin_set').pop()?.id)
await sleep(3000)
ok(!/not sent/.test(await statusText(A)), 'phone A: check-in sent to Firebase')
await B.page.goto(url + '#/runner/ryan')
let seen = false
for (let i = 0; i < 20 && !seen; i++) { await sleep(500); seen = await B.page.evaluate(id => JSON.parse(localStorage.getItem('kodiak:kodiak2026-b7f3q9xk2m4w8r1z-test:events') || '[]').some(e => e.id === id), loggedAt) }
ok(seen, 'phone B received it live (no refresh tapped)')

// 2) runner phone: fetch on open, never live
const R = await phone('R', { role: 'runner', me: 'ryan', name: '' })
await sleep(4000)
const rHas = await R.page.evaluate(id => JSON.parse(localStorage.getItem('kodiak:kodiak2026-b7f3q9xk2m4w8r1z-test:events') || '[]').some(e => e.id === id), loggedAt)
ok(rHas, 'runner phone got it on open')
ok(!(await R.page.evaluate(() => /Live/.test(document.body.innerText))), 'runner phone never shows Live')
const rListen = R.net.started.filter(x => /Listen/.test(x.url)).length
ok(rListen === 0, `runner phone opened ${rListen} live-listen connections (must be 0)`)
ok(R.net.open.size === 0, `runner phone: ${R.net.open.size} Firebase requests still open after loading (must be 0)`)

// 3) go/no-go: hide B → its live connection must close within ~5 s, and nothing reopens while hidden
const openBefore = B.net.open.size
const tHide = Date.now()
await B.page.evaluate(() => { window.__vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange')) })
let closedAt = null
for (let i = 0; i < 40; i++) { await sleep(250); if (B.net.open.size === 0) { closedAt = Date.now(); break } }
const closeMs = closedAt ? closedAt - tHide : null
ok(closeMs != null && closeMs <= 5000, `hidden: live connection closed in ${closeMs == null ? 'NEVER (>10 s)' : (closeMs / 1000).toFixed(1) + ' s'} (had ${openBefore} open)`)
const startedBefore = B.net.started.length
await sleep(60_000)
const newWhileHidden = B.net.started.slice(startedBefore)
ok(newWhileHidden.length === 0 && B.net.open.size === 0, `hidden 60 s: ${newWhileHidden.length} new Firebase requests, ${B.net.open.size} open (must be 0, 0)`)
await B.page.evaluate(() => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')) })
await sleep(4000)
await B.page.goto(url + '#/crew'); await sleep(500)
ok(/Live/.test(await statusText(B)), `back on screen: B is Live again: "${(await statusText(B)).replace(/\s+/g, ' ')}"`)
ok(B.net.open.size >= 1, `back on screen: live connection reopened (${B.net.open.size} open)`)

out.push(`errors: ${[...A.errors, ...B.errors, ...R.errors].join(' | ') || 'none'}`)
await browser.close()
console.log(out.join('\n'))
console.log(fail ? 'LIVE TEST FAILED' : 'LIVE TEST PASSED')
process.exit(fail ? 1 : 0)

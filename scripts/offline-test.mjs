// Offline queue test with two "phones" and the local stand-in database.
// 1) app shell loads with no signal  2) check-in while offline shows "not sent"  3) force-close + reopen offline keeps it
// 4) "signal bars but nothing gets through" → still queued, no hang  5) signal back → sent, appears on the other phone
// 6) two phones log the same arrival offline → both come online → both show the same answer
import fs from 'node:fs'
import { startServers, phone, pt, SHOTS, sleep } from './lib.mjs'

fs.mkdirSync(SHOTS, { recursive: true })
const S = await startServers()
const out = []
let fail = false
const ok = (cond, msg) => { out.push(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) fail = true }
const clock = pt(10, 8, 30)
const status = page => page.innerText('.status').catch(() => '')
const pending = page => page.evaluate(() => window.__kodiak.store.getSnapshot().pending)

const A = await phone(S.browser, S.url, { role: 'crew', name: 'Mom', clock, deviceId: 'A' })
const B = await phone(S.browser, S.url, { role: 'crew', name: 'Sam', clock, deviceId: 'B' })
ok(await A.page.evaluate(async () => !!(await navigator.serviceWorker.ready).active), 'service worker saved the app on phone A')
await A.page.waitForFunction(() => window.__kodiak.store.getSnapshot().flags.offlineReady, null, { timeout: 20000 }).catch(() => {})
ok(await A.page.evaluate(() => window.__kodiak.store.getSnapshot().flags.offlineReady), 'phone A shows "Ready offline"')

// 1) no signal: reload still opens the app
await A.ctx.setOffline(true)
await A.page.reload({ waitUntil: 'load' })
ok(await A.page.$('.app') != null, 'app opens with NO signal (app shell from the phone)')

// 2) log a check-in offline
await A.page.goto(S.url + '#/checkin/zane'); await sleep(300)
await A.page.click('.srow >> text=Sugarloaf 1')
await A.page.click('.ci-panel .bigbtn'); await sleep(500)
ok(/not sent/.test(await status(A.page)), `offline check-in marked not sent: "${(await status(A.page)).replace(/\s+/g, ' ')}"`)
await A.page.screenshot({ path: `${SHOTS}/offline-1-not-sent.png` })

// 3) force-close and reopen while still offline
await A.page.close()
const A2 = await A.ctx.newPage()
await A2.goto(S.url + '#/crew', { waitUntil: 'load' })
await A2.waitForSelector('.app')
ok(await pending(A2) === 1, 'after force-close + reopen offline: check-in still saved and queued (1 not sent)')
ok(/Sugarloaf 1/.test(await A2.innerText('.page')), 'reopened app still shows the check-in')

// 4) "signal bars but nothing gets through": requests hang
await A.ctx.setOffline(false)
await A2.route('**/races/**', () => { /* never answer */ })
const t0 = Date.now()
await A2.click('.status .refresh')
await A2.waitForFunction(() => !window.__kodiak.store.getSnapshot().sync.syncing, null, { timeout: 30000 })
const waited = Math.round((Date.now() - t0) / 1000)
ok(await pending(A2) === 1, `fake signal: still queued, app gave up after ~${waited}s instead of hanging`)
ok(/timed out|No connection|Offline/i.test(JSON.stringify(await A2.evaluate(() => window.__kodiak.store.getSnapshot().sync))), 'fake signal: shows a no-connection problem')
await A2.unroute('**/races/**')

// 5) signal back: coming back to the app sends it; the other phone sees it
await A2.evaluate(() => window.dispatchEvent(new Event('online'))); await sleep(800)
ok(await pending(A2) === 0, 'signal back: queued check-in sent (0 not sent)')
await B.page.click('.status .refresh'); await sleep(600)
await B.page.goto(S.url + '#/runner/zane'); await sleep(300)
ok(/✓ 8:30 AM/.test(await B.page.innerText('.page')), 'phone B sees the check-in made offline on phone A')

// 6) both phones offline, both log Kevy at Sugarloaf 1 with different times
await A.ctx.setOffline(true); await B.ctx.setOffline(true)
for (const [p, adj] of [[A2, '−5'], [B.page, '+1']]) {
  await p.goto(S.url + '#/checkin/kevy'); await sleep(200)
  await p.click('.srow >> text=Sugarloaf 1')
  await p.click(`.tchips >> text=${adj}`)
  await p.click('.ci-panel .bigbtn'); await sleep(200)
}
await A.ctx.setOffline(false); await B.ctx.setOffline(false)
for (const p of [A2, B.page]) { await p.evaluate(() => window.dispatchEvent(new Event('online'))); await sleep(700) }
for (const p of [A2, B.page]) { await p.evaluate(() => window.dispatchEvent(new Event('online'))); await sleep(700) }
const vA = await A2.evaluate(() => window.__kodiak.store.getSnapshot().state.checkins.kevy.sl1?.at)
const vB = await B.page.evaluate(() => window.__kodiak.store.getSnapshot().state.checkins.kevy.sl1?.at)
const hA = await A2.evaluate(() => window.__kodiak.store.getSnapshot().state.history.get('checkin:kevy:sl1')?.length)
ok(vA != null && vA === vB, `two phones logged the same arrival offline → both show the same time (${new Date(vA).toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles' })})`)
ok(hA === 2, 'both entries kept in history (nothing lost)')

out.push(`page errors (excluding expected no-signal messages): ${[...A.errors, ...B.errors].filter(e => !/ERR_INTERNET_DISCONNECTED/.test(e)).join(' | ') || 'none'}`)
await S.close()
console.log(out.join('\n'))
console.log(fail ? 'OFFLINE TEST FAILED' : 'OFFLINE TEST PASSED')
process.exit(fail ? 1 : 0)

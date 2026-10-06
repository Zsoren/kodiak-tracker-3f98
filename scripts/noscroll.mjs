// No-scroll check on a small screen (375×553): My Race and the check-in confirm screen, worst case
// (red cut-off box showing, longest note, all request buttons visible). The main buttons must be fully on screen.
import fs from 'node:fs'
import { startServers, phone, pt, SHOTS, sleep } from './lib.mjs'

fs.mkdirSync(SHOTS, { recursive: true })
const S = await startServers()
const out = []
let fail = false
const vp = { width: 375, height: 553 }
const kevy = await phone(S.browser, S.url, { role: 'runner', me: 'kevy', clock: pt(10, 16, 45), viewport: vp })
const page = kevy.page
// sample data + a long note for Kevy's next station (runner phone: switch to crew view to reach More)
await page.evaluate(() => window.__kodiak.store.setSettings({ crewView: true }))
await page.goto(S.url + '#/more'); await page.waitForSelector('text=Load sample race day'); await page.click('text=Load sample race day'); await sleep(400)
await page.evaluate(() => {
  const { store } = window.__kodiak
  store.dispatch('note_set', { runner: 'kevy', station: 'ss', text: 'Grab headlamp + spare batteries, warm jacket and gloves from crew. Refill both flasks with Tailwind, eat a PB&J, swap socks, re-lube feet, take caffeine. Do NOT sit down for more than 5 minutes.' })
  store.setSettings({ crewView: false })
})
await sleep(300)

async function check(name) {
  const r = await page.evaluate(() => {
    const vis = sel => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), ok: b.top >= 0 && b.bottom <= innerHeight + 0.5 } }
    return {
      docScroll: document.documentElement.scrollHeight > innerHeight + 1,
      alarm: !!document.querySelector('.alarm'), note: !!document.querySelector('.mynote, .infobox'),
      main: vis('.myrace .bigbtn'), pair: vis('.myrace .pair'), status: vis('.mr-status'),
      confirm: vis('.overlay .confirmbtn'), presets: vis('.overlay .presets'), type: vis('.overlay .link'),
      overlayScroll: (() => { const o = document.querySelector('.overlay'); return o ? o.scrollHeight > o.clientHeight + 1 : null })(),
    }
  })
  await page.screenshot({ path: `${SHOTS}/noscroll-${name}.png` })
  out.push(`${name}: ${JSON.stringify(r)}`)
  return r
}
const a = await check('myrace')
if (a.docScroll || !a.alarm || !a.main?.ok || !a.pair?.ok || !a.status?.ok) fail = true
await page.click('.myrace .bigbtn'); await sleep(200)
const b = await check('confirm')
if (b.overlayScroll || !b.confirm?.ok || !b.presets?.ok || !b.type?.ok) fail = true
await page.click('text=Cancel'); await page.click('text=Ask crew'); await sleep(200)
const c = await check('askcrew')
if (c.overlayScroll || !c.confirm?.ok || !c.presets?.ok) fail = true
out.push(`page errors: ${kevy.errors.length ? kevy.errors.join(' | ') : 'none'}`)
await S.close()
console.log(out.join('\n'))
console.log(fail ? 'NO-SCROLL CHECK FAILED' : 'NO-SCROLL CHECK PASSED')
process.exit(fail ? 1 : 0)

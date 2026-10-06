// Race-day simulation with screenshots. Uses the test build (dist-test) + the local stand-in database.
// Scenario (test mode): Zane ahead after a late start · John behind · Kevy projected to miss Bluff Lake ·
// Ryan dropped at Camp Osito · finishes after midnight · crew meetings with a clash · runner requests.
// Usage: npm run build:test && node scripts/sim.mjs
import fs from 'node:fs'
import { startServers, phone, setClock, pt, SHOTS, sleep } from './lib.mjs'

fs.mkdirSync(SHOTS, { recursive: true })
const S = await startServers()
const out = []
const shot = async (page, name, full = false) => { await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full }); out.push(`shot ${name}`) }
const loadSample = async page => {
  await page.goto(S.url + '#/more'); await page.waitForSelector('text=Load sample race day')
  await page.click('text=Load sample race day'); await sleep(600)
}

// --- Saturday 9:00 AM: morning meetings, with a clash for "Mom & Dad" ---
const mom = await phone(S.browser, S.url, { role: 'crew', name: 'Mom', clock: pt(10, 9, 0) })
await loadSample(mom.page)
await mom.page.goto(S.url + '#/crew'); await sleep(400)
await shot(mom.page, '00-crew-9am', true)
out.push('9 AM: tight clash shown for Mom & Dad: ' + /tight: Mom & Dad/.test(await mom.page.innerText('.page')))

// --- Saturday 4:45 PM ---
await setClock(mom.page, pt(10, 16, 45)); await loadSample(mom.page)
await mom.page.goto(S.url + '#/crew'); await sleep(400)
await shot(mom.page, '01-crew-445pm', true)
const crewText = await mom.page.innerText('.page')
out.push('crew screen mentions PROJECTED MISS: ' + /PROJECTED MISS/.test(crewText))
out.push('John\'s Sugarloaf 2 request cleared once he got there: ' + !/John wants/.test(crewText))
await mom.page.goto(S.url + '#/timeline'); await sleep(400)
await shot(mom.page, '02-timeline-445pm')
await shot(mom.page, '02b-timeline-full', true)
await mom.page.goto(S.url + '#/runner/kevy'); await sleep(300)
await shot(mom.page, '03-kevy-all-stations', true)
await mom.page.goto(S.url + '#/checkin/john'); await sleep(300)
await shot(mom.page, '04-checkin-john', true)
await mom.page.goto(S.url + '#/plans/john'); await sleep(300)
await shot(mom.page, '05-plans-john', true)
await mom.page.goto(S.url + '#/more'); await sleep(300)
await shot(mom.page, '06-more', true)
await mom.page.goto(S.url + '#/more/crewinfo'); await sleep(300)
await shot(mom.page, '07-crewinfo', true)

// Runner phone (Zane) at 4:45 PM: fetches everything from the shared database
const zane = await phone(S.browser, S.url, { role: 'runner', me: 'zane', clock: pt(10, 16, 45) })
await sleep(800)
await shot(zane.page, '10-myrace-zane-445pm')
out.push('Zane screen: ' + (await zane.page.innerText('.myrace')).replace(/\s+/g, ' ').slice(0, 220))
await zane.page.click('.bigbtn'); await sleep(200)
await shot(zane.page, '11-confirm-checkin')
await zane.page.click('text=Cancel'); await sleep(100)
await zane.page.click('text=Ask crew'); await sleep(200)
await shot(zane.page, '12-ask-crew')
await zane.page.click('.presets >> text=Food'); await zane.page.click('text=Send to crew'); await sleep(800)
await shot(zane.page, '13-ask-sent')
await zane.page.click('text=Done')

// Crew sees the request after coming back to the app
await mom.page.goto(S.url + '#/crew'); await mom.page.click('.status .refresh'); await sleep(800)
await shot(mom.page, '14-crew-sees-request', true)
out.push('crew sees Zane request (food): ' + /Zane wants.*food/i.test(await mom.page.innerText('.page')))

// --- Saturday 9:15 PM ---
await setClock(mom.page, pt(10, 21, 15)); await loadSample(mom.page)
await mom.page.goto(S.url + '#/crew'); await sleep(500)
await shot(mom.page, '20-crew-915pm', true)
await setClock(zane.page, pt(10, 21, 15)); await sleep(800)
await shot(zane.page, '21-myrace-zane-915pm')

// John's phone at 9:15 PM (behind, heading to Aspen Glen)
const john = await phone(S.browser, S.url, { role: 'runner', me: 'john', clock: pt(10, 21, 15) })
await sleep(800)
await shot(john.page, '22-myrace-john-915pm')

// --- Sunday 1:45 AM ---
await setClock(mom.page, pt(11, 1, 45)); await loadSample(mom.page)
await mom.page.goto(S.url + '#/crew'); await sleep(500)
await shot(mom.page, '30-crew-sun-145am', true)
out.push('after midnight shows "Sun": ' + /Sun 1:38 AM/.test(await mom.page.innerText('.page')))
await setClock(zane.page, pt(11, 1, 45)); await sleep(800)
await shot(zane.page, '31-myrace-zane-finished')

for (const [n, p] of [['mom', mom], ['zane', zane], ['john', john]]) out.push(`${n} page errors: ${p.errors.length ? p.errors.join(' | ') : 'none'}`)
out.push(`stand-in database: ${S.fake.stats.posts} sends, ${S.fake.stats.gets} fetches, ${[...S.fake.races.values()].reduce((n, m) => n + m.size, 0)} events stored · per area: ${[...S.fake.races.entries()].map(([k, m]) => k + ' = ' + m.size).join(', ')}`)
await S.close()
console.log(out.join('\n'))

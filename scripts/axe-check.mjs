// Contrast audit with axe-core across the main screens, mid-race (test mode sample).
// My Race must pass the strictest level (AAA, 7:1); other screens AA (4.5:1).
import fs from 'node:fs'
import { startServers, phone, pt, sleep } from './lib.mjs'

const axeSrc = fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf8')
const S = await startServers({ port: 4181, fakePort: 8788 })
const out = []
let fail = false

async function audit(page, name, strict) {
  await page.addScriptTag({ content: axeSrc })
  const rules = strict ? ['color-contrast', 'color-contrast-enhanced'] : ['color-contrast']
  const res = await page.evaluate(async r => await window.axe.run(document, { runOnly: { type: 'rule', values: r } }), rules)
  let n = 0
  for (const v of res.violations) for (const node of v.nodes) {
    const d = node.any[0]?.data || {}
    n++
    out.push(`  [${name}] ${v.id}: ${d.contrastRatio}:1 (need ${d.expectedContrastRatio}) fg ${d.fgColor} on ${d.bgColor} — "${(node.html || '').replace(/\s+/g, ' ').slice(0, 80)}"`)
  }
  out.push(`[${name}] ${strict ? 'AAA' : 'AA'}: ${n ? n + ' problem(s)' : 'no contrast problems'}`)
  if (n) fail = true
}

const crew = await phone(S.browser, S.url, { role: 'crew', name: 'Mom', clock: pt(10, 16, 45), testMode: true })
await crew.page.goto(S.url + '#/more'); await crew.page.click('text=Load sample race day'); await sleep(400)
// Turn test mode off for the audit so the red TEST banner isn't part of it (data stays on this phone in the test area… so re-enable after)
for (const [name, path] of [['crew', '#/crew'], ['checkin', '#/checkin/john'], ['timeline', '#/timeline'], ['kevy', '#/runner/kevy'], ['plans', '#/plans/zane'], ['more', '#/more'], ['crewinfo', '#/more/crewinfo']]) {
  await crew.page.goto(S.url + path); await sleep(250)
  await audit(crew.page, name, false)
}
const runner = await phone(S.browser, S.url, { role: 'runner', me: 'kevy', clock: pt(10, 16, 45), testMode: true })
await runner.page.evaluate(() => window.__kodiak.store.setSettings({ crewView: true }))
await runner.page.goto(S.url + '#/more'); await runner.page.click('text=Load sample race day'); await sleep(300)
await runner.page.evaluate(() => window.__kodiak.store.setSettings({ crewView: false }))
await sleep(300)
await audit(runner.page, 'my race', true)
await runner.page.click('.myrace .bigbtn'); await sleep(200)
await audit(runner.page, 'confirm', true)
await S.close()
console.log(out.join('\n'))
console.log(fail ? 'CONTRAST CHECK FOUND PROBLEMS' : 'CONTRAST CHECK PASSED')
process.exit(fail ? 1 : 0)

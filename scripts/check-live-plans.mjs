// READ-ONLY: open the live site as a fresh crew phone and compare every runner's Plans page with the spreadsheet export.
// Usage: node scripts/check-live-plans.mjs <sheet-plans.json>
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const sheet = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const to12 = hhmm => { const [h, m] = hhmm.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }
const browser = await chromium.launch()
const page = await (await browser.newContext({ timezoneId: 'America/Los_Angeles' })).newPage()
await page.goto('https://kodiak.zanesorenson.com/')
await page.evaluate(() => localStorage.setItem('kodiak:settings:v1', JSON.stringify({ deviceId: 'read-only-check', role: 'crew', name: 'Read-only check', installDismissed: true })))
await page.reload(); await page.waitForSelector('.app')
let bad = 0
for (const [runner, rows] of Object.entries(sheet)) {
  await page.evaluate(r => { location.hash = '#/plans/' + r }, runner); await page.waitForTimeout(400)
  const shown = await page.$$eval('.prow', els => els.map(e => [e.querySelector('.bold')?.childNodes[0]?.textContent?.trim(), e.querySelector('.pt')?.textContent?.trim()]))
  let ok = 0
  for (const [name, hhmm] of rows) {
    const row = shown.find(([n]) => n === name)
    const want = to12(hhmm)
    if (row && row[1]?.replace(/^(Sun|Sat) /, '') === want) ok++
    else { bad++; console.log(`  MISMATCH ${runner} · ${name}: sheet ${want} vs live site "${row?.[1]}"`) }
  }
  console.log(`${runner}: ${ok} of ${rows.length} match on the live site`)
}
console.log(bad ? `${bad} PROBLEM(S)` : 'LIVE SITE MATCHES THE SPREADSHEET')
await browser.close()

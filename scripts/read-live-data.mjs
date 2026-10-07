// READ-ONLY: open the live site as a fresh crew phone (no entries made) and list what's in the shared race data.
// Usage: node scripts/read-live-data.mjs [test]
import { chromium } from 'playwright'
const test = process.argv[2] === 'test'
const browser = await chromium.launch()
const ctx = await browser.newContext({ timezoneId: 'America/Los_Angeles' })
const page = await ctx.newPage()
await page.goto('https://kodiak.zanesorenson.com/')
await page.evaluate(t => localStorage.setItem('kodiak:settings:v1', JSON.stringify({ deviceId: 'read-only-check', role: 'crew', name: 'Read-only check', testMode: t, installDismissed: true })), test)
await page.reload(); await page.waitForSelector('.app')
await page.waitForFunction(() => /Updated \d/.test(document.body.innerText), null, { timeout: 30000 })
const key = test ? 'kodiak:kodiak2026-b7f3q9xk2m4w8r1z-test:events' : 'kodiak:kodiak2026-b7f3q9xk2m4w8r1z:events'
const events = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || '[]'), key)
const byType = events.reduce((m, e) => { m[e.type] = (m[e.type] ?? 0) + 1; return m }, {})
console.log(`${test ? 'TEST' : 'RACE'} area: ${events.length} entries ${JSON.stringify(byType)}`)
for (const e of events.filter(e => e.type === 'plan_set')) console.log(`  plan_set ${e.payload.runner} ${e.payload.station} → ${e.payload.at == null ? 'cleared' : new Date(e.payload.at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} by ${e.by}`)
await browser.close()

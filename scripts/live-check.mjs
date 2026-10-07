// Smoke test of the deployed site: loads, no errors, first-run screen, service worker saves the app, manifest OK.
// Usage: node scripts/live-check.mjs [url]
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'https://kodiak.zanesorenson.com/'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Los_Angeles' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
const res = await page.goto(url)
await page.waitForSelector('.app')
const text = (await page.innerText('body')).replace(/\s+/g, ' ')
const sw = await page.evaluate(async () => !!(await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(r, 15000))]))?.active)
const manifest = await page.evaluate(async () => (await (await fetch(document.querySelector('link[rel=manifest]').href)).json()))
console.log(`status ${res.status()} · first run shown: ${/I'm running/.test(text)} · preview banner: ${/PREVIEW/.test(text)} · app saved for offline: ${sw}`)
console.log(`manifest: ${manifest.name} · start_url ${manifest.start_url} · ${manifest.icons.length} icons`)
console.log(`errors: ${errors.join(' | ') || 'none'}`)
await browser.close()

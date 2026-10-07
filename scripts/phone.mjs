// Real-phone testing over USB: drives ONLY the Kodiak page on a connected Android phone (Chrome remote debugging).
// Needs: adb forward tcp:9222 localabstract:chrome_devtools_remote
// Usage: node scripts/phone.mjs <command> [...args]
import { chromium } from 'playwright'

const browser = await chromium.connectOverCDP('http://localhost:9222')
const candidates = browser.contexts().flatMap(c => c.pages()).filter(p => p.url().startsWith('https://kodiak.zanesorenson.com'))
let page = null
// prefer the installed (home-screen) app over a Chrome tab
for (const p of candidates) if (await p.evaluate(() => matchMedia('(display-mode: standalone)').matches).catch(() => false)) page = p
page = page ?? candidates[0]
if (!page) { console.log('Kodiak page not found'); process.exit(1) }
const [cmd, ...args] = process.argv.slice(2)
const settings = () => page.evaluate(() => JSON.parse(localStorage.getItem('kodiak:settings:v1') || '{}'))
const out = async () => console.log(JSON.stringify({ url: page.url(), standalone: await page.evaluate(() => matchMedia('(display-mode: standalone)').matches), settings: await settings() }))

if (cmd === 'state') await out()
else if (cmd === 'go') { await page.evaluate(h => { location.hash = h }, args[0]); await page.waitForTimeout(500); await out() }
else if (cmd === 'click') { await page.locator(args[0]).first().click(); await page.waitForTimeout(500) }
else if (cmd === 'text') console.log((await page.innerText(args[0] ?? 'body')).replace(/\s+/g, ' ').slice(0, 1200))
else if (cmd === 'eval') console.log(JSON.stringify(await page.evaluate(args[0])))
await browser.close().catch(() => {})
process.exit(0)

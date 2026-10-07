// Install banner: on the very first screen, with Chrome's install prompt (simulated) → "Install app" button;
// after install → "Installed" note; when running as the installed app → no banner.
import { startServers, SHOTS, sleep } from './lib.mjs'
const S = await startServers()
const ctx = await S.browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' })
const page = await ctx.newPage()
await page.goto(S.url); await page.waitForSelector('.app')
const out = []
out.push('first screen, before Chrome offers install: ' + (await page.innerText('.banner')).replace(/\s+/g, ' '))
await page.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = async () => {}; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e) })
await sleep(200)
out.push('after Chrome offers install: ' + (await page.innerText('.banner')).replace(/\s+/g, ' '))
await page.screenshot({ path: `${SHOTS}/install-first-screen.png` })
await page.click('.banner >> text=Install app'); await sleep(200)
out.push('after tapping Install: ' + (await page.innerText('.banner')).replace(/\s+/g, ' '))
await S.close()
console.log(out.join('\n'))

// Shared helpers for the browser test scripts.
import { preview } from 'vite'
import { chromium } from 'playwright'
import { startFakeServer } from './fake-server.mjs'

export const RACE_ID = 'kodiak2026-b7f3q9xk2m4w8r1z'
export const SHOTS = process.env.SHOTS ?? 'shots'

/** Pacific time on race weekend (PDT) → epoch ms. */
export const pt = (day, h, m = 0) => Date.UTC(2026, 9, day, h + 7, m)

export async function startServers({ outDir = 'dist-test', port = 4180, fakePort = 8787 } = {}) {
  const fake = await startFakeServer(fakePort)
  const server = await preview({ build: { outDir }, preview: { port, strictPort: true }, logLevel: 'silent' })
  const browser = await chromium.launch()
  return {
    url: `http://localhost:${port}/`, fake, browser,
    async close() { await browser.close(); await server.close(); await fake.close() },
  }
}

/** A "phone": its own browser context (own storage), already set up as runner or crew. */
export async function phone(browser, url, { role, me = null, name = '', testMode = true, clock = null, viewport = { width: 390, height: 844 }, deviceId }) {
  const ctx = await browser.newContext({ viewport, timezoneId: 'America/Los_Angeles', hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(url)
  await page.evaluate(s => { localStorage.clear(); localStorage.setItem('kodiak:settings:v1', JSON.stringify(s)) }, {
    deviceId: deviceId ?? `${role}-${me ?? name}`, role, me, name, testMode, timeOffsetMs: clock != null ? clock - Date.now() : 0,
    crewChief: role === 'runner' ? '555-123-4567' : '', crewPhones: {}, installDismissed: true, crewView: false,
  })
  await page.goto(url + '?r=' + Math.random() + (role === 'runner' ? '#/me' : '#/crew'))
  await page.waitForSelector('.app')
  return { ctx, page, errors }
}

export async function setClock(page, clock) {
  await page.evaluate(off => {
    const s = JSON.parse(localStorage.getItem('kodiak:settings:v1'))
    s.timeOffsetMs = off
    localStorage.setItem('kodiak:settings:v1', JSON.stringify(s))
  }, clock - Date.now())
  await page.reload()
  await page.waitForSelector('.app')
}

export const sleep = ms => new Promise(r => setTimeout(r, ms))

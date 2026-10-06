// Battery guard (runs before every build): fails if anything that could run in the background sneaks into the app.
// Repeating timers, animation frames, CSS animations/transitions, location, wake lock, background sync, push, sockets.
import fs from 'node:fs'
import path from 'node:path'

const BANNED = [
  [/\bsetInterval\s*\(/, 'setInterval (repeating timer)'],
  [/requestAnimationFrame/, 'requestAnimationFrame'],
  [/@keyframes/, 'CSS @keyframes animation'],
  [/(^|[\s;{])animation(-name)?\s*:/m, 'CSS animation'],
  [/(^|[\s;{])transition\s*:/m, 'CSS transition'],
  [/geolocation/, 'location tracking'],
  [/wakeLock/, 'screen wake lock'],
  [/periodicSync|\.sync\.register/, 'background sync'],
  [/PushManager|pushManager/, 'push notifications'],
  [/new\s+WebSocket|new\s+EventSource/, 'always-on socket'],
  [/behavior:\s*['"]smooth['"]/, 'smooth (animated) scrolling'],
  [/\buseNow\b/, 'ticking clock hook'],
]
// One-shot timeouts are allowed only where a network call needs a time limit.
const TIMEOUT_ALLOWED = new Set(['src/sync/backend.ts'])

const bad = []
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f)
    if (fs.statSync(p).isDirectory()) { walk(p); continue }
    if (!/\.(ts|tsx|css)$/.test(f) || /\.test\.ts$/.test(f)) continue
    const rel = p.split(path.sep).join('/')
    const src = fs.readFileSync(p, 'utf8')
    for (const [re, what] of BANNED) if (re.test(src)) bad.push(`${rel}: ${what}`)
    if (/\bsetTimeout\s*\(/.test(src) && !TIMEOUT_ALLOWED.has(rel)) bad.push(`${rel}: setTimeout outside the network time-limit helper`)
  }
}
walk('src')
if (bad.length) {
  console.error('Battery check FAILED:\n  ' + bad.join('\n  '))
  process.exit(1)
}
console.log('Battery check passed: no repeating timers, animations, location, wake lock or background sync in src/.')

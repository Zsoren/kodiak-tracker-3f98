import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { store } from './state/store'
import { startSync } from './sync'
import { startPWA } from './pwa'
import { startInstall } from './install'
import './styles.css'

startInstall()   // before rendering, so Chrome's install prompt is never missed

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// "X min ago" and "not logged yet" are recomputed when the app comes back to the screen and on taps — never on a timer.
let lastTouch = 0
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { lastTouch = Date.now(); store.touch() } })
document.addEventListener('pointerdown', () => { if (Date.now() - lastTouch > 20_000) { lastTouch = Date.now(); store.touch() } }, { passive: true })

startSync()
startPWA()

// Test builds only (local stand-in database): let browser test scripts reach the store.
if (import.meta.env.VITE_FAKE_REMOTE) (window as unknown as { __kodiak: unknown }).__kodiak = { store }

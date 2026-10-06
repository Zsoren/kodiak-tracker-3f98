# Kodiak 2026 — race-day tracker

Home-screen web app for tracking Zane, John and Kevy (100K) and Ryan (50K) at the Kodiak Ultra Marathons, Big Bear Lake, **Sat Oct 10, 2026**. Lives at **kodiak.zanesorenson.com**. Built on the same setup as the H2C app.

## What it does
- **Crew** (home): next planned crew meetings ("be there by", "leave the lot by", clash warnings), one card per runner (ahead/behind, next meeting, next cut-off, requests from the runner).
- **Check in**: runner → station (expected one pre-selected) → time (−15/−5/−1/+1/+5/Now, or type digits) → ARRIVED. Undo/edit, duplicate guard, "right station?" warnings.
- **Timeline**: Sat 6 AM → Sun 2:15 AM. Cyan = crew can meet, grey outline = aid station without crew. Tap a cyan stop to plan who meets that runner there.
- **My Race** (runner phones): big ahead/behind, next station projected vs plan, next cut-off, crew meeting, one-tap check-in with a pocket-safe confirm, "Ask crew".
- **Plans**: planned arrival per station (digits only — no colon needed), notes, crew meetings, "fill from goal finish time".
- **More**: crew info (lots, shuttles, rules), cut-off edits, getting-there times, LiveTrail links, recent changes with undo, test mode.

## How it works
- React + TypeScript + Vite, installed as a PWA (vite-plugin-pwa / Workbox precache). One stylesheet, true black.
- Shared data: Firebase Firestore, append-only event log at `races/{RACE_ID}/events` (rules in `firebase/firestore.rules`). Latest edit per runner + station wins; history is kept; every phone computes the same answer.
- Sends and fetches use **Firestore Lite** (one-shot requests). Crew phones add a live listener **only while the app is on screen** (deleted the moment it's hidden). Runner phones never hold a connection.
- **Battery rules** (enforced by `scripts/no-timers-check.mjs` on every build): no repeating timers, animations, location, wake lock or background sync. Work happens only on open, return to the screen, back online, a tap, or Refresh.
- Offline: everything is saved on the phone first and marked "⧗ not sent" until confirmed by the server.
- Test mode writes to `RACE_ID-test`, so practice data never touches race data.

## Commands
```
npm run dev            # local dev
npm test               # logic tests (projections, conflicts, time entry, meetings, requests)
npm run build          # battery check + type check + production build
# browser tests use a test build pointed at a local stand-in database:
VITE_FAKE_REMOTE=http://localhost:8787 npm run build:test
npm run sim            # race-day simulation with screenshots (SHOTS=dir)
npm run test:offline   # offline queue, fake signal, two phones offline
npm run test:hidden    # nothing runs while hidden (HIDDEN_SECONDS=180)
npm run test:noscroll  # My Race + confirm fit a small screen
npm run test:contrast  # contrast (AAA on runner screens)
npm run course-table   # regenerate docs/COURSE-CHECK.md from the course data
```

## Docs
- `docs/SETUP.md` — Zane's setup steps (Cloudflare, Firebase, GitHub secret).
- `docs/COURSE-CHECK.md` — every station, cut-off and crew note, for Zane to confirm.
- `docs/race-info/` — official charts, Runner Guide, Regulations, GPX, spreadsheets.

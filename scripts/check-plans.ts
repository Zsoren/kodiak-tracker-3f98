// Compares the app's plans with the spreadsheet (exported to JSON), station by station.
// Each sheet time is read the app's way: the first time at or after the previous station.
// Usage: node scripts/check-plans.ts <sheet-plans.json>
import { readFileSync } from 'node:fs'
import { RACES, RUNNERS } from '../src/data/course.ts'
import { SEED_PLANS } from '../src/data/plans.ts'

const sheet: Record<string, [string, string][]> = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const fmt = (t: number) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(t))
let bad = 0
for (const r of RUNNERS) {
  const race = RACES[r.race]
  const rows = sheet[r.id] ?? []
  let prev = race.start
  let ok = 0
  for (const [name, hhmm] of rows) {
    const st = race.stations.find(s => s.name === name)
    if (!st) { console.log(`  ${r.name}: unknown station "${name}"`); bad++; continue }
    const [h, m] = hhmm.split(':').map(Number)
    let t = Date.UTC(2026, 9, 10, h + 7, m)
    while (t < prev) t += 24 * 3600_000
    prev = t
    const app = SEED_PLANS[r.id]?.[st.id]
    if (app !== t) { console.log(`  MISMATCH ${r.name} · ${name}: sheet ${fmt(t)} vs app ${app ? fmt(app) : '(none)'}`); bad++ } else ok++
  }
  const extra = Object.keys(SEED_PLANS[r.id] ?? {}).filter(id => !rows.some(([n]) => race.stations.find(s => s.name === n)?.id === id))
  if (extra.length) { console.log(`  ${r.name}: app has times the sheet doesn't: ${extra.join(', ')}`); bad += extra.length }
  console.log(`${r.name} (${race.name}): ${ok} of ${rows.length} stations match · finish ${fmt(SEED_PLANS[r.id].fin)}`)
}
console.log(bad ? `${bad} PROBLEM(S)` : 'ALL PLANS MATCH THE SPREADSHEET')
process.exit(bad ? 1 : 0)

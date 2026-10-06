// Prints docs/COURSE-CHECK.md straight from the app's course data, so what Zane checks is exactly what the app uses.
// Usage: node scripts/course-table.ts > docs/COURSE-CHECK.md
import { RACES, LOTS, CREW_RULES } from '../src/data/course.ts'
import { SEED_PLANS } from '../src/data/plans.ts'

const clock = (ts: number) => {
  const s = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(ts))
  return s.startsWith('Sat') ? s.slice(4) : s
}
const lines: string[] = []
lines.push('# Course check — please confirm (Zane)', '')
lines.push('Everything below is generated from the app itself (`src/data/course.ts`). If anything is wrong, tell me the station and the right value.', '')
lines.push('Source: 2026 OFFICIAL FINAL aid station charts + 2026 Runner Guide (in `docs/race-info/`). Cut-offs are **must leave by** times.', '')
for (const r of Object.values(RACES)) {
  lines.push(`## ${r.name} — start ${clock(r.start)} Sat Oct 10`, '')
  lines.push('| Station | Mile | Next leg | Cut-off (leave by) | Crew? | Getting there (min) | Drop bag | Crew note |', '|---|---|---|---|---|---|---|---|')
  for (const s of r.stations) {
    lines.push(`| ${s.name} | ${s.mile} | ${s.nextMi != null ? `${s.nextMi.toFixed(1)} mi, +${s.gain}/−${s.loss} ft` : '—'} | ${s.cutoff ? clock(s.cutoff) : '—'} | ${s.crew ? '**Yes**' : 'No'} | ${s.crew ? s.leadMin ?? '' : ''} | ${s.dropBag ? 'Yes' : ''} | ${s.crewNote ?? s.tag ?? ''} |`)
  }
  lines.push('')
}
lines.push("## Zane's starting plan (from the Runner Plans tab)", '', '| Station | Planned arrival |', '|---|---|')
for (const s of RACES['100k'].stations) lines.push(`| ${s.name} | ${SEED_PLANS.zane[s.id] ? clock(SEED_PLANS.zane[s.id]) : ''} |`)
lines.push('', 'John, Kevy and Ryan start blank and enter theirs in the app (Plans tab).', '')
lines.push('## Crew lots', '')
for (const l of LOTS) { lines.push(`**${l.name}** — ${l.address}  `, `Serves: ${l.serves}`, ...l.notes.map(n => `- ${n}`), '') }
lines.push('## Crew rules shown in the app', '', ...CREW_RULES.map(r => `- ${r}`), '')
lines.push('## Things I had to decide (tell me if any are wrong)', '',
  '- **Getting-there times** (shuttle wait + ride + walk) are my estimates from the guide: Sugarloaf 60 min, Aspen Glen 60, Finish 30, places with parking 10. Editable in the app (More).',
  '- **Bear Mountain 1 → Sugarloaf 1** leg uses 5.5 mi (the mile markers) — the chart rounds it to 5.6.',
  '- **Hydration-Grandview** is shown as "self-serve water"; the guide says it *may* be self-serve.',
  '- **Sunset** ≈ 6:20 PM (not in the guide; standard almanac time for Big Bear on Oct 10).',
  '- **100K Start**: the chart says supporters are not allowed (spectators only), so it is not a crew stop in the app. The 50K start is.',
  '- **Finish shuttle** hours: the guide\'s table says until 3:00 PM but its text says until 3 AM Sunday; the app says ~3 AM.',
  '- **Snow Summit** chairlift: 6 AM–midnight (2026 guide). The race website\'s /crew page still shows 2025 info (until 6 PM).', '')
console.log(lines.join('\n'))

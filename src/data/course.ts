// Course data from the 2026 "OFFICIAL FINAL" aid station charts + 2026 Runner Guide (docs/race-info/).
// All clock times are Pacific Daylight Time (UTC-7) on race weekend.

export type RaceId = '100k' | '50k'
export type LotId = 'bear' | 'snow' | 'village'

export interface Station {
  id: string
  name: string
  /** 2–3 letter code for timeline chips */
  code: string
  mile: number
  /** the leg from here to the next station */
  nextMi?: number
  gain?: number
  loss?: number
  /** official cut-off (must LEAVE by), epoch ms */
  cutoff?: number
  /** crew (supporters) allowed to assist here */
  crew: boolean
  crewNote?: string
  /** where crew start from to get here, and default minutes from that lot to the aid station */
  lot?: LotId
  leadMin?: number
  shuttle?: boolean
  dropBag: boolean
  /** short fact shown in leg lines, e.g. "self-serve water" */
  tag?: string
}

export interface Race {
  id: RaceId
  name: string
  start: number
  stations: Station[]
}

/** Pacific time on race weekend → epoch ms. day: 9 = Fri, 10 = Sat, 11 = Sun (October 2026, PDT). */
export function pt(day: 9 | 10 | 11, h: number, m = 0): number {
  return Date.UTC(2026, 9, day, h + 7, m)
}

const SUGARLOAF_NOTE = 'Mandatory crew shuttle from the Bear Mountain lot (~20 min ride, then a 0.5 mi walk each way). No parking at Sugarloaf. Shuttles run until 7 PM Sat.'
const ASPEN_NOTE = 'Mandatory crew shuttle from the Snow Summit lot (route: Finish → Aspen Glen, ~15 min per hop; runs until 12:30 AM Sun). No parking at Aspen Glen.'
const SNOW_NOTE = 'Aid station is at the PEAK. Crew can meet at the base (park at the Snow Summit lot) or ride the chairlift up (lift ticket from the Snow Summit ticket window, Sat 6 AM–midnight).'
const FINISH_NOTE = 'No parking in the Village after 11 AM Sat. Take the shuttle from the Snow Summit lot to Pennsylvania Lot, 1 block from the finish (runs until ~3 AM Sun).'

export const RACES: Record<RaceId, Race> = {
  '100k': {
    id: '100k',
    name: '100K',
    start: pt(10, 6, 0),
    stations: [
      { id: 'start', name: 'Start', code: 'ST', mile: 0, nextMi: 4.9, gain: 818, loss: 483, crew: false, crewNote: 'Spectators only (no crew help). Village parking 4–11 AM Sat only.', lot: 'village', leadMin: 10, dropBag: true },
      { id: 'bm1', name: 'Bear Mountain 1', code: 'BM1', mile: 4.9, nextMi: 5.5, gain: 778, loss: 637, crew: false, crewNote: 'No crew or spectators allowed.', dropBag: false },
      { id: 'sl1', name: 'Sugarloaf 1', code: 'SL1', mile: 10.4, nextMi: 8.7, gain: 3075, loss: 1663, cutoff: pt(10, 9, 30), crew: true, crewNote: SUGARLOAF_NOTE, lot: 'bear', leadMin: 60, shuttle: true, dropBag: true },
      { id: 'bh', name: 'Balky Horse', code: 'BH', mile: 19.1, nextMi: 5.1, gain: 22, loss: 1435, crew: false, dropBag: false },
      { id: 'sl2', name: 'Sugarloaf 2', code: 'SL2', mile: 24.2, nextMi: 6.1, gain: 682, loss: 826, cutoff: pt(10, 14, 0), crew: true, crewNote: SUGARLOAF_NOTE, lot: 'bear', leadMin: 60, shuttle: true, dropBag: true },
      { id: 'bm2', name: 'Bear Mountain 2', code: 'BM2', mile: 30.3, nextMi: 6.4, gain: 1821, loss: 825, cutoff: pt(10, 16, 0), crew: true, crewNote: 'Park at the Bear Mountain lot (43101 Goldmine Dr); the aid station is right there.', lot: 'bear', leadMin: 10, dropBag: false },
      { id: 'ss', name: 'Snow Summit', code: 'SS', mile: 36.7, nextMi: 4.2, gain: 327, loss: 841, crew: true, crewNote: SNOW_NOTE, lot: 'snow', leadMin: 10, dropBag: false },
      { id: 'hg', name: 'Hydration-Grandview', code: 'HG', mile: 40.9, nextMi: 5.3, gain: 731, loss: 730, crew: false, tag: 'self-serve water', dropBag: false },
      { id: 'bl', name: 'Bluff Lake', code: 'BL', mile: 46.2, nextMi: 5.4, gain: 646, loss: 747, cutoff: pt(10, 21, 0), crew: false, dropBag: false },
      { id: 'co', name: 'Camp Osito', code: 'CO', mile: 51.6, nextMi: 3.7, gain: 259, loss: 916, cutoff: pt(10, 22, 45), crew: false, dropBag: true },
      { id: 'ag', name: 'Aspen Glen', code: 'AG', mile: 55.3, nextMi: 7.5, gain: 1154, loss: 1209, cutoff: pt(11, 0, 0), crew: true, crewNote: ASPEN_NOTE, lot: 'snow', leadMin: 60, shuttle: true, dropBag: false },
      { id: 'fin', name: 'Finish', code: 'FIN', mile: 62.8, cutoff: pt(11, 2, 15), crew: true, crewNote: FINISH_NOTE, lot: 'snow', leadMin: 30, shuttle: true, dropBag: true },
    ],
  },
  '50k': {
    id: '50k',
    name: '50K',
    start: pt(10, 7, 30),
    stations: [
      { id: 'start', name: 'Start', code: 'ST', mile: 0, nextMi: 6.3, gain: 1713, loss: 385, crew: true, crewNote: 'The Village. Village parking 4–11 AM Sat only.', lot: 'village', leadMin: 10, dropBag: true },
      { id: 'ss', name: 'Snow Summit', code: 'SS', mile: 6.3, nextMi: 3.2, gain: 258, loss: 777, crew: true, crewNote: SNOW_NOTE, lot: 'snow', leadMin: 10, dropBag: false },
      { id: 'hg', name: 'Hydration-Grandview', code: 'HG', mile: 9.5, nextMi: 4.3, gain: 455, loss: 448, crew: false, tag: 'self-serve water', dropBag: false },
      { id: 'bl', name: 'Bluff Lake', code: 'BL', mile: 13.8, nextMi: 5.4, gain: 648, loss: 750, crew: false, dropBag: false },
      { id: 'co', name: 'Camp Osito', code: 'CO', mile: 19.2, nextMi: 3.6, gain: 259, loss: 915, cutoff: pt(10, 14, 0), crew: false, dropBag: false },
      { id: 'ag', name: 'Aspen Glen', code: 'AG', mile: 22.8, nextMi: 7.6, gain: 1143, loss: 1205, crew: true, crewNote: ASPEN_NOTE, lot: 'snow', leadMin: 60, shuttle: true, dropBag: false },
      { id: 'fin', name: 'Finish', code: 'FIN', mile: 30.4, cutoff: pt(10, 17, 30), crew: true, crewNote: FINISH_NOTE, lot: 'snow', leadMin: 30, shuttle: true, dropBag: true },
    ],
  },
}

export interface Runner { id: string; name: string; race: RaceId }

export const RUNNERS: Runner[] = [
  { id: 'zane', name: 'Zane', race: '100k' },
  { id: 'john', name: 'John', race: '100k' },
  { id: 'kevy', name: 'Kevy', race: '100k' },
  { id: 'ryan', name: 'Ryan', race: '50k' },
]

export function runnerById(id: string | null | undefined): Runner | undefined {
  return RUNNERS.find(r => r.id === id)
}
export function raceOf(runnerId: string): Race {
  return RACES[runnerById(runnerId)?.race ?? '100k']
}

/** Sunset in Big Bear Lake on Oct 10, 2026 (approximate). */
export const SUNSET = pt(10, 18, 20)
/** Timeline window */
export const DAY_START = pt(10, 6, 0)
export const DAY_END = pt(11, 2, 15)

export const LIVETRAIL_URL = 'https://kodiak.livetrail.net/'

/** 2025-finisher model: share of finish time at each 100K station (from Kodiak_2026_Race_Day_Splits.xlsx, Model tab). */
export const SHARES_100K: Record<string, number> = {
  start: 0, bm1: 0.05483, sl1: 0.12046, bh: 0.28162, sl2: 0.3405, bm2: 0.42939, ss: 0.54001,
  hg: 0.61371, bl: 0.71243, co: 0.80139, ag: 0.86952, fin: 1,
}

export interface Lot { id: LotId; name: string; address: string; serves: string; notes: string[] }

export const LOTS: Lot[] = [
  {
    id: 'bear', name: 'Bear Mountain lot', address: '43101 Goldmine Dr, Big Bear Lake, CA 92315',
    serves: 'Bear Mountain 2 (walk) · Sugarloaf 1 & 2 (shuttle)',
    notes: [
      'Crew parking (plus a dirt overflow lot).',
      'Mandatory shuttle to Sugarloaf: ~20 min ride, then a 0.5 mi walk each way (station moved Oct 3).',
      'Sugarloaf shuttles run Fri 9 PM – Sat 7 PM.',
    ],
  },
  {
    id: 'snow', name: 'Snow Summit lot', address: '880 Summit Blvd, Big Bear Lake, CA 92315',
    serves: 'Snow Summit (base / chairlift) · Aspen Glen & Finish (shuttle)',
    notes: [
      'Crew parking at the base of Snow Summit.',
      'Chairlift to the peak aid station: Sat 6 AM – midnight, lift ticket from the Snow Summit ticket window.',
      'Purple Route shuttle: Finish → Aspen Glen → Finish → Snow Summit, ~15 min per hop, Sat 10 AM – Sun ~3 AM (Aspen Glen until 12:30 AM). You can ride from Aspen Glen straight to the Finish.',
    ],
  },
  {
    id: 'village', name: 'The Village (Start / Finish)', address: '40803 Village Dr, Big Bear Lake, CA 92315',
    serves: 'Start · Finish',
    notes: [
      'Spectator parking Sat 4 AM – 11 AM only. No spectator parking in the Village after 11 AM Sat.',
      'Shuttle drop-off is Pennsylvania Lot, 1 block from the finish line.',
    ],
  },
]

export const CREW_RULES: string[] = [
  'Crew may help only at crew stations, inside the assistance zone (500 m before to 500 m after the aid station). One helper per runner in the zone.',
  'No help outside the zones — penalty 1 hour (100K) / 30 min (50K). Walking alongside your runner outside a zone: 15 / 10 min.',
  'Small care only (e.g. a blister fix) while the runner is seated. No medical help.',
  'Crew may NOT go to Bear Mountain 1. Balky Horse, Hydration-Grandview, Bluff Lake and Camp Osito are off-limits to crew.',
  'No pacers in the 100K or 50K.',
  'Parking violations or rude crew can get your runner disqualified. An Adventure Pass ($5/day) may be needed where posted.',
  'Cut-offs: a runner must LEAVE an aid station before its cut-off; arriving after it counts as a drop. Officials may extend cut-offs if the start runs late.',
  'Race Command Center: 813-422-9195 (also printed on the bib).',
]

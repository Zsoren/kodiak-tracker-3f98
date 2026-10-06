import { isValidEvent, makeEvent, newId, reduce, type EventType, type KEvent, type RaceState } from '../model/events'
import { projectAll, type RunnerProj } from '../model/projection'
import { runnerById } from '../data/course'
import { loadJSON, saveJSON, storageOk } from './storage'

/**
 * The real race's shared-data id. Fixed from day one so test entries can never leak into race data:
 * test mode writes to RACE_ID + '-test' instead. (≥ 20 chars: the database rules require it.)
 */
export const RACE_ID = 'kodiak2026-b7f3q9xk2m4w8r1z'

export type Role = 'runner' | 'crew'

export interface Settings {
  deviceId: string
  role: Role | null
  /** runner id when role = runner */
  me: string | null
  /** crew name (crew) — runners use their runner name */
  name: string
  testMode: boolean
  /** test clock offset (test mode only) */
  timeOffsetMs: number
  /** runner phones: crew chief's number for "Also send as text" (stays on this phone) */
  crewChief: string
  /** runner phones: optional number per crew name (stays on this phone) */
  crewPhones: Record<string, string>
  installDismissed: boolean
  /** runner phone temporarily showing the crew screens */
  crewView: boolean
}

export interface SyncStatus {
  /** off = single-phone mode (no shared database configured) */
  mode: 'off' | 'on'
  online: boolean
  syncing: boolean
  /** last time this phone successfully fetched everyone's updates */
  lastPulled: number | null
  error: string | null
  /** a live listener is open right now (crew phones, only while on screen) */
  live: boolean
}

export interface Flags {
  offlineReady: boolean
  noSW: boolean
  updateReady: boolean
}

export interface Snapshot {
  events: KEvent[]
  state: RaceState
  projs: RunnerProj[]
  /** time the snapshot was computed (wall clock + test offset) */
  now: number
  settings: Settings
  sync: SyncStatus
  flags: Flags
  synced: Set<string>
  pending: number
  storageOk: boolean
  dataKey: string
}

const SETTINGS_KEY = 'kodiak:settings:v1'

type Listener = () => void

class Store {
  private settings: Settings
  private events: KEvent[] = []
  private synced = new Set<string>()
  private sync: SyncStatus = { mode: 'off', online: typeof navigator !== 'undefined' ? navigator.onLine : true, syncing: false, lastPulled: null, error: null, live: false }
  private flags: Flags = { offlineReady: false, noSW: false, updateReady: false }
  private listeners = new Set<Listener>()
  private localListeners = new Set<(events: KEvent[]) => void>()
  private resetListeners = new Set<() => void>()
  snapshot!: Snapshot

  constructor() {
    const def: Settings = {
      deviceId: newId(), role: null, me: null, name: '', testMode: false, timeOffsetMs: 0,
      crewChief: '', crewPhones: {}, installDismissed: false, crewView: false,
    }
    this.settings = { ...def, ...loadJSON<Partial<Settings>>(SETTINGS_KEY, {}) }
    if (!this.settings.testMode) this.settings.timeOffsetMs = 0
    saveJSON(SETTINGS_KEY, this.settings)
    this.loadData()
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.setSync({ online: true }))
      window.addEventListener('offline', () => this.setSync({ online: false }))
    }
  }

  /** Everything stored on the phone is kept separate per race id (real vs test). */
  get dataKey(): string { return this.settings.testMode ? `${RACE_ID}-test` : RACE_ID }
  key(name: string): string { return `kodiak:${this.dataKey}:${name}` }

  private loadData() {
    this.events = loadJSON<KEvent[]>(this.key('events'), []).filter(isValidEvent)
    this.synced = new Set(loadJSON<string[]>(this.key('synced'), []))
    this.sync = { ...this.sync, lastPulled: loadJSON<number | null>(this.key('lastPulled'), null), error: null }
    this.recompute()
  }

  private recompute() {
    const now = this.now()
    const state = reduce(this.events)
    const pending = this.events.reduce((n, e) => n + (this.synced.has(e.id) ? 0 : 1), 0)
    this.snapshot = {
      events: this.events, state, projs: projectAll(state, now), now, settings: this.settings, sync: this.sync,
      flags: this.flags, synced: this.synced, pending, storageOk, dataKey: this.dataKey,
    }
  }

  private emit() { for (const l of this.listeners) l() }
  subscribe = (l: Listener) => { this.listeners.add(l); return () => { this.listeners.delete(l) } }
  getSnapshot = () => this.snapshot

  /** Wall clock plus the optional test-mode offset. */
  now(): number { return Date.now() + (this.settings.testMode ? this.settings.timeOffsetMs : 0) }

  /** Recompute "now"-dependent things (minutes ago, overdue). Called on return to the screen and on taps — never on a timer. */
  touch() { this.recompute(); this.emit() }

  /** Who is entering things on this phone. */
  get by(): string {
    if (this.settings.role === 'runner') return runnerById(this.settings.me)?.name ?? 'Runner'
    return this.settings.name.trim() || 'Crew'
  }

  dispatch(type: EventType, payload: Record<string, unknown>): KEvent {
    return this.dispatchMany([{ type, payload }])[0]
  }

  dispatchMany(items: { type: EventType; payload: Record<string, unknown> }[]): KEvent[] {
    const made: KEvent[] = []
    for (const it of items) {
      const e = makeEvent(it.type, it.payload, { deviceId: this.settings.deviceId, by: this.by, log: [...this.events, ...made], now: this.now() })
      made.push(e)
    }
    this.events = [...this.events, ...made]
    saveJSON(this.key('events'), this.events)
    this.recompute(); this.emit()
    for (const l of this.localListeners) l(made)
    return made
  }

  /** Test mode only: add prepared events (e.g. the sample race day) as if entered on this phone. */
  injectLocal(events: KEvent[]): number {
    if (!this.settings.testMode) return 0
    const have = new Set(this.events.map(e => e.id))
    const fresh = events.filter(e => !have.has(e.id))
    if (!fresh.length) return 0
    this.events = [...this.events, ...fresh]
    saveJSON(this.key('events'), this.events)
    this.recompute(); this.emit()
    for (const l of this.localListeners) l(fresh)
    return fresh.length
  }

  undo(ids: string[]): void {
    this.dispatchMany(ids.map(targetEventId => ({ type: 'undo' as const, payload: { targetEventId } })))
  }

  /** Merge events from the shared database. They count as synced. Returns how many were new. */
  merge(incoming: unknown[]): number {
    const have = new Set(this.events.map(e => e.id))
    const fresh: KEvent[] = []
    for (const raw of incoming) {
      if (!isValidEvent(raw)) continue
      this.synced.add(raw.id)
      if (have.has(raw.id)) continue
      have.add(raw.id)
      const { id, v, ts, seenTs, deviceId, by, type, payload } = raw
      fresh.push({ id, v, ts, seenTs, deviceId, by: String(by ?? ''), type, payload })
    }
    if (fresh.length) {
      this.events = [...this.events, ...fresh]
      saveJSON(this.key('events'), this.events)
    }
    saveJSON(this.key('synced'), [...this.synced])
    this.recompute(); this.emit()
    return fresh.length
  }

  markSynced(ids: string[]) {
    if (!ids.length) return
    for (const id of ids) this.synced.add(id)
    saveJSON(this.key('synced'), [...this.synced])
    this.recompute(); this.emit()
  }

  unsyncedEvents(): KEvent[] { return this.events.filter(e => !this.synced.has(e.id)) }

  setPulled(ts: number) {
    saveJSON(this.key('lastPulled'), ts)
    this.setSync({ lastPulled: ts, error: null })
  }

  setSettings(patch: Partial<Settings>) {
    const before = this.dataKey
    this.settings = { ...this.settings, ...patch }
    if (!this.settings.testMode) this.settings.timeOffsetMs = 0
    saveJSON(SETTINGS_KEY, this.settings)
    if (this.dataKey !== before) { this.loadData(); for (const l of this.resetListeners) l() }
    this.recompute(); this.emit()
  }

  setSync(patch: Partial<SyncStatus>) {
    this.sync = { ...this.sync, ...patch }
    this.recompute(); this.emit()
  }

  setFlags(patch: Partial<Flags>) {
    this.flags = { ...this.flags, ...patch }
    this.recompute(); this.emit()
  }

  onLocalEvents(l: (events: KEvent[]) => void) { this.localListeners.add(l); return () => { this.localListeners.delete(l) } }
  /** Fires when the data set changes (test mode on/off). */
  onReset(l: () => void) { this.resetListeners.add(l); return () => { this.resetListeners.delete(l) } }
}

export const store = new Store()

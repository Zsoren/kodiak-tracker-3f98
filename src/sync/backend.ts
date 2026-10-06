import type { KEvent } from '../model/events'

export interface PushResult { ok: string[]; failed: string[]; error?: string }
export interface PullResult { events: unknown[]; cursorMs: number }

/** A shared database the app can talk to with one-shot requests (nothing stays open). */
export interface Backend {
  name: string
  push(dataKey: string, events: KEvent[]): Promise<PushResult>
  pull(dataKey: string, cursorMs: number): Promise<PullResult>
  /** Optional live updates. Returns a stop function that fully closes the connection. */
  live?(dataKey: string, cursorMs: number, onEvents: (events: unknown[], cursorMs: number) => void, onError: (e: unknown) => void): Promise<() => Promise<void>>
}

export const WIRE_KEYS = ['id', 'v', 'ts', 'seenTs', 'deviceId', 'by', 'type', 'payload'] as const

export function toWire(e: KEvent): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of WIRE_KEYS) out[k] = e[k]
  return out
}

/** Every network call gets a time limit, so one bar of "fake" signal can never hang the app. */
export function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error(`${what} timed out`)), ms) })
  return Promise.race([p, timeout]).finally(() => clearTimeout(t))
}

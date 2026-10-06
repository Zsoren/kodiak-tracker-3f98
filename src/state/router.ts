import { useSyncExternalStore } from 'react'

export type Route =
  | { tab: 'default' }
  | { tab: 'crew' }
  | { tab: 'checkin'; runner?: string }
  | { tab: 'timeline' }
  | { tab: 'plans'; runner?: string }
  | { tab: 'more'; section?: string }
  | { tab: 'runner'; id: string }
  | { tab: 'me' }

export function parseRoute(hash: string): Route {
  const p = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  switch (p[0]) {
    case 'crew': return { tab: 'crew' }
    case 'checkin': return { tab: 'checkin', runner: p[1] }
    case 'timeline': return { tab: 'timeline' }
    case 'plans': return { tab: 'plans', runner: p[1] }
    case 'more': return { tab: 'more', section: p[1] }
    case 'runner': return p[1] ? { tab: 'runner', id: p[1] } : { tab: 'crew' }
    case 'me': return { tab: 'me' }
    default: return { tab: 'default' }
  }
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash, () => '')
  return parseRoute(hash)
}

export function go(path: string) {
  location.hash = '#/' + path
}

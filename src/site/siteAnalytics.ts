import { analyticsLive } from '../liveHosts'

/**
 * The site's few PostHog events, without posthog-js: one small POST each to
 * the Worker's `/ingest` proxy (`worker/worker.ts`), on production domains
 * only (`analyticsLive`). The free tier is 1M events a month, so only the
 * support page reports, a handful of events a visit at most. `from` is where
 * the visitor came from in the game (`?from=`: `hall`, `ask`, `victory`, `gems`).
 */
export type SiteEvents = {
  /** A visit to the support page (not a return from a checkout). `handle`: the @ came filled. */
  support_view: { from: string | null; handle: 0 | 1 }
  /** A way to support picked: Patreon's button, or a donation's checkout opening with its amount in reais. */
  support_choice: { way: 'patreon'; from: string | null } | { way: 'donation'; amount: number; handle: 0 | 1; from: string | null }
  /** Back from a donation's checkout, once the API said where it went (`late`: not confirmed while the page waited). */
  support_thanks: { outcome: 'account' | 'code' | 'used' | 'late' }
}

const KEY = import.meta.env.VITE_POSTHOG_KEY

/**
 * Who's visiting: the game's PostHog id on this browser (posthog-js keeps it
 * under `ph_ps`, `persistence_name` in `analytics.ts`), so a visit from the
 * game joins that player's events; else an id of the site's own.
 */
const distinctId = () => {
  try {
    const game: unknown = JSON.parse(localStorage.getItem('ph_ps') ?? 'null')
    if (typeof game === 'object' && game !== null && 'distinct_id' in game && typeof game.distinct_id === 'string') return game.distinct_id
    const own = localStorage.getItem('ps:siteId') ?? crypto.randomUUID()
    localStorage.setItem('ps:siteId', own)
    return own
  } catch {
    return crypto.randomUUID()
  }
}

/** Sends one event, fire and forget: a beacon, so it still goes out as the page leaves for a checkout. */
export const track = <E extends keyof SiteEvents>(event: E, props: SiteEvents[E]) => {
  if (!analyticsLive(KEY)) return
  const body = JSON.stringify({
    api_key: KEY,
    event,
    distinct_id: distinctId(),
    timestamp: new Date().toISOString(),
    properties: { ...props, $current_url: location.href, $pathname: location.pathname, $referrer: document.referrer || '$direct', $lib: 'site', locale: document.documentElement.lang },
  })
  const url = '/ingest/i/v0/e/'
  try {
    if (navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) return
  } catch {}
  void fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {})
}

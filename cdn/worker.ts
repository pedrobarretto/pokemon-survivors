/**
 * The script of the asset CDN (`cdn/wrangler.jsonc`) and of the site's Worker (`cdn/site.wrangler.jsonc`).
 * Static files never reach it: the Worker serves them first, for free. It only runs for PostHog's proxy
 * under `/ingest/`, the same rewrites `vercel.json` has, so the game's analytics (`ingestHost` in
 * `src/analytics.ts`) cost Vercel nothing. Anything else that reaches it is a 404 (the site's Worker
 * sends only `/ingest/*` here, and answers its other misses with its 404 page).
 */

const API = 'https://us.i.posthog.com'
const ASSETS = 'https://us-assets.i.posthog.com'

/** PostHog's URL for a request to the proxy (`/ingest/...`, its query kept), or null when it isn't one. */
export const ingestTarget = (url: URL) => {
  if (!url.pathname.startsWith('/ingest/')) return null
  const path = url.pathname.slice('/ingest'.length)
  const host = path.startsWith('/static/') || path.startsWith('/array/') ? ASSETS : API
  return `${host}${path}${url.search}`
}

/**
 * Forwards a request to PostHog as it came, minus its cookies, with the player's address
 * for PostHog's GeoIP (it would see Cloudflare's otherwise). PostHog's CORS headers come back as they are.
 */
const proxy = (request: Request, target: string) => {
  const headers = new Headers(request.headers)
  headers.delete('cookie')
  const ip = request.headers.get('cf-connecting-ip')
  if (ip) headers.set('x-forwarded-for', ip)
  const body = request.method === 'GET' || request.method === 'HEAD' ? null : request.body
  return fetch(target, { method: request.method, headers, body, redirect: 'manual' })
}

export default {
  fetch: (request: Request) => {
    const target = ingestTarget(new URL(request.url))
    return target ? proxy(request, target) : new Response('Not found', { status: 404 })
  },
}

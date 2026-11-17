// Compares how two origins answer the site's URLs: the status, where a redirect goes, the headers that matter
// (type, caching, HSTS, CORS) and an HTML page's <title>. For moving the site between hosts (Vercel's
// to the Cloudflare Worker, cdn/site.wrangler.jsonc): run it against both before the cutover, and after.
//
//   node scripts/site-parity.mjs <reference> <candidate> [--sitemap <origin>] [--examples <n>]
//   npm run site:parity -- https://www.pokemonsurvivors.com http://localhost:8797   (after `npm run site:build` and `npm run site:dev`)
//
// The URLs: every path in the sitemap (read from `--sitemap`, the reference by default) on both origins,
// plus `EDGES`. Prints the differences grouped, with a few example paths each, and exits 1 if any.
const KEYS = ['content-type', 'cache-control', 'strict-transport-security', 'access-control-allow-origin']

/** A chunk of the origin's own build (each build names its chunks), found in its home page. */
const chunk = async (origin) => {
  const html = await (await fetch(`${origin}/`)).text()
  const path = html.match(/\/assets\/main-[\w-]+\.js/)?.[0]
  if (!path) throw new Error(`${origin}/ names no main chunk`)
  return path
}

/** The paths besides the sitemap's: a string, or how to find the path on an origin. */
const EDGES = [
  '/guia',
  '/en/pokedex/charmander',
  '/en/pokedex/charmander?ref=x',
  '/pokedex/index.html',
  '/nao-existe/',
  '/nao-existe',
  '/en/nao-existe/',
  '/og.png',
  '/ingest/flags/?v=2',
  '/ingest/static/array.js',
  chunk,
  '/assets/nope-AAAAAAAA.js',
  '/assets/pokemon/25/Walk.png',
  '/assets/items/',
  '/fonts/cubic-11/Cubic_11.woff2',
  '/icons/icon-192.png',
  '/manifest.webmanifest',
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
  '/sim-build.json',
  '/dc1786117f82447dcee99fe732eac967.txt',
]

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i < 0 ? undefined : args.splice(i, 2)[1]
}
const examples = Number(flag('--examples') ?? 3)
const trim = (o) => o?.replace(/\/+$/, '')
const sitemapOrigin = trim(flag('--sitemap'))
const [reference, candidate] = args.map(trim)
if (!reference || !candidate) throw new Error('Usage: node scripts/site-parity.mjs <reference> <candidate> [--sitemap <origin>] [--examples <n>]')

/** How `origin` answers `path`: the status, the redirect's target (a path when it stays on the origin) and `KEYS`. */
const answer = async (origin, path) => {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${origin}${path}`, { redirect: 'manual', headers: { accept: 'text/html,*/*', 'user-agent': 'site-parity' } })
      const location = res.headers.get('location')
      const to = location && new URL(location, `${origin}${path}`)
      const type = res.headers.get('content-type') ?? ''
      const html = res.status === 200 && type.startsWith('text/html') ? await res.text() : (await res.body?.cancel(), '')
      return {
        status: String(res.status),
        location: to ? (to.origin === origin ? `${to.pathname}${to.search}` : to.href) : '',
        ...Object.fromEntries(KEYS.map((k) => [k, res.headers.get(k) ?? ''])),
        title: html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '',
      }
    } catch (error) {
      if (attempt === 3) return { status: `error: ${error}` }
    }
  }
}

/** Runs `fn` over `items`, `n` at a time, keeping their order. */
const pool = async (items, n, fn) => {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }))
  return out
}

const xml = await (await fetch(`${sitemapOrigin ?? reference}/sitemap.xml`)).text()
const sitemap = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => {
  const url = new URL(loc)
  return `${url.pathname}${url.search}`
})
const edges = await Promise.all(EDGES.map(async (e) => (typeof e === 'string' ? { ref: e, cand: e } : { ref: await e(reference), cand: await e(candidate) })))
const cases = [...sitemap.map((p) => ({ ref: p, cand: p })), ...edges]

const results = await pool(cases, 12, async (c) => {
  const [a, b] = await Promise.all([answer(reference, c.ref), answer(candidate, c.cand)])
  const diffs = Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]).map((k) => `${k}: ${JSON.stringify(a[k] ?? '')} → ${JSON.stringify(b[k] ?? '')}`)
  return { path: c.ref === c.cand ? c.ref : `${c.ref} / ${c.cand}`, status: a.status, diffs }
})

const groups = new Map()
for (const r of results.filter((r) => r.diffs.length)) {
  const key = r.diffs.join('\n    ')
  groups.set(key, [...(groups.get(key) ?? []), r.path])
}
const differ = results.filter((r) => r.diffs.length).length
const statuses = Object.entries(Object.groupBy(results, (r) => r.status)).map(([s, rs]) => `${s} ×${rs.length}`).join(', ')
console.log(`${reference} vs ${candidate}: ${results.length} URLs (${sitemap.length} from the sitemap, ${edges.length} edge cases)`)
console.log(`reference statuses: ${statuses}`)
console.log(`${results.length - differ} the same, ${differ} differ${groups.size ? ':' : ''}`)
for (const [key, paths] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n  ${paths.length} URL${paths.length > 1 ? 's' : ''}, e.g. ${paths.slice(0, examples).join(', ')}\n    ${key}`)
}
process.exit(differ ? 1 : 0)

// Readies the site build (`dist/`, after `vite build` and scripts/sourcemaps.mjs) for the site's Worker
// (`cdn/site.wrangler.jsonc`, `ps-site`): part of `npm run site:build`, which the Site workflow deploys.
// - writes `_headers` and `_redirects` (`cdn/siteRules.ts`: vercel.json's rules, as Cloudflare reads them);
// - carries the chunks of the builds the live Worker keeps (`builds.json`, `keptBuilds` in cdn/builds.ts), so a
//   tab opened before the deploy still lazy-loads its own; fetched from `SITE_ORIGIN` and cached in node_modules/.cache;
// - checks the version fits the Free plan: at most 20,000 files, none over 25 MiB.
// `--fresh` keeps no older builds (a local try). It never deploys, and it never touches the asset CDN
// (`ps-assets`, `cdn/deploy.mjs`), which Vercel's builds keep deploying until the cutover.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { carryBuilds, commit, MAX_FILE_BYTES, MAX_FILES } from './build.mjs'
import { REDIRECT_LIMITS, SITE_HEADERS, siteRedirects } from './siteRules.ts'
import { filesUnder } from './versions.mjs'

const ROOT = join(import.meta.dirname, '..')
const DIST = join(ROOT, 'dist')
const CACHE = join(ROOT, 'node_modules', '.cache', 'site-builds')
/**
 * Where the live Worker answers whatever DNS says: its `workers.dev` address (`workers_dev` in its config).
 * After the cutover `https://www.pokemonsurvivors.com` is the same Worker; set `SITE_ORIGIN` to read from it.
 */
const ORIGIN = (process.env.SITE_ORIGIN ?? 'https://ps-site.pedrobarretto.workers.dev').replace(/\/+$/, '')

// A build pointed at the asset CDN would load its chunks and assets from `*.workers.dev`, which this Worker exists to stop.
if (process.env.VITE_ASSET_ORIGIN) throw new Error('VITE_ASSET_ORIGIN is set: the site serves its own assets, build it without')
if (readFileSync(join(DIST, 'index.html'), 'utf8').includes('__psCdnOk')) throw new Error('dist/ loads from the asset CDN (cdn/loader.ts): build it with `npm run site:build`')

const files = filesUnder(DIST)
const redirects = siteRedirects(files)
if (redirects.fixed.length > REDIRECT_LIMITS.fixed || redirects.dynamic.length > REDIRECT_LIMITS.dynamic) {
  throw new Error(`_redirects has ${redirects.fixed.length} fixed and ${redirects.dynamic.length} dynamic rules, over Cloudflare's ${REDIRECT_LIMITS.fixed} and ${REDIRECT_LIMITS.dynamic}`)
}
writeFileSync(join(DIST, '_headers'), SITE_HEADERS)
writeFileSync(join(DIST, '_redirects'), `${[...redirects.fixed, ...redirects.dynamic].join('\n')}\n`)

// The chunks: `dist/assets/`'s own files (the folders under it are `public/assets/`).
const chunks = readdirSync(join(DIST, 'assets'), { withFileTypes: true }).filter((e) => e.isFile() && !e.name.endsWith('.map')).map((e) => `assets/${e.name}`)
const next = { id: commit(), at: Date.now(), files: chunks }
const builds = process.argv.includes('--fresh') ? [next] : await carryBuilds({ origin: ORIGIN, next, outDir: DIST, cacheDir: CACHE })
writeFileSync(join(DIST, 'builds.json'), JSON.stringify(builds))

const served = filesUnder(DIST).map((file) => ({ file, size: statSync(join(DIST, file)).size }))
const heavy = served.filter((f) => f.size > MAX_FILE_BYTES).map((f) => f.file)
if (heavy.length) throw new Error(`Over ${MAX_FILE_BYTES / 1024 / 1024} MiB, which a Worker's asset can't be: ${heavy.join(', ')}`)
if (served.length > MAX_FILES) throw new Error(`dist/ has ${served.length} files, over the ${MAX_FILES} a Worker version takes`)
const largest = served.reduce((a, b) => (b.size > a.size ? b : a))
console.log(
  `[site] dist/: ${served.length} of ${MAX_FILES} files (largest ${largest.file}, ${(largest.size / 1024 / 1024).toFixed(2)} MiB), ` +
    `${redirects.fixed.length}+${redirects.dynamic.length} redirects, builds ${builds.map((b) => b.id).join(', ')}`,
)

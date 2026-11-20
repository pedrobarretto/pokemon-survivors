// Readies the site build (`dist/`, after `vite build` and scripts/sourcemaps.mjs) for the site's Worker
// (`worker/wrangler.jsonc`, `ps-site`): the last step of `npm run build`.
// - writes `_headers` and `_redirects` (`worker/siteRules.ts`);
// - with `--keep` (the Site workflow's deploys), carries the chunks of the builds the live Worker keeps (`builds.json`,
//   `keptBuilds` in worker/builds.ts), so a tab opened before the deploy still lazy-loads its own; fetched from
//   `SITE_ORIGIN` and cached in node_modules/.cache. Without it, `builds.json` lists this build only;
// - checks the version fits the Free plan: at most 20,000 files, none over 25 MiB.
// It never deploys.
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { keptBuilds } from './builds.ts'
import { REDIRECT_LIMITS, SITE_HEADERS, siteRedirects } from './siteRules.ts'

const ROOT = join(import.meta.dirname, '..')
const DIST = join(ROOT, 'dist')
const CACHE = join(ROOT, 'node_modules', '.cache', 'site-builds')
/** Where the live Worker answers whatever DNS says: its `workers.dev` address (`workers_dev` in its config). */
const ORIGIN = (process.env.SITE_ORIGIN ?? 'https://ps-site.pedrobarretto.workers.dev').replace(/\/+$/, '')
/** The most files a Worker version holds on the Free plan, and the most bytes in each. */
const MAX_FILES = 20_000
const MAX_FILE_BYTES = 25 * 1024 * 1024

/** Every file under `dir`, as `/`-separated paths relative to it, sorted. */
const filesUnder = (dir) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith('.'))
    .map((e) => relative(dir, join(e.parentPath, e.name)).split(sep).join('/'))
    .sort()

/** The commit being built, as `__GAME_VERSION__` names it (vite.config.ts): GitHub's, else git's. */
const commit = () => process.env.GITHUB_SHA?.slice(0, 7) ?? execSync('git rev-parse --short HEAD').toString().trim()

/** The builds the live Worker lists (`builds.json`): none when it has no list yet; throws when it can't be read. */
const liveBuilds = async () => {
  const res = await fetch(`${ORIGIN}/builds.json`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`${ORIGIN}/builds.json: HTTP ${res.status}`)
  const builds = await res.json()
  if (!Array.isArray(builds)) throw new Error(`${ORIGIN}/builds.json isn't a list`)
  return builds
}

/** Puts a kept build's file in `dist/`: from this build, the cache or the live Worker (then cached). */
const fetchFile = async (file) => {
  const out = join(DIST, file)
  if (existsSync(out)) return
  const cached = join(CACHE, file)
  if (!existsSync(cached)) {
    const res = await fetch(`${ORIGIN}/${file}`, { signal: AbortSignal.timeout(60_000) })
    if (!res.ok) throw new Error(`${ORIGIN}/${file}: HTTP ${res.status}`)
    mkdirSync(dirname(cached), { recursive: true })
    writeFileSync(cached, Buffer.from(await res.arrayBuffer()))
  }
  mkdirSync(dirname(out), { recursive: true })
  copyFileSync(cached, out)
}

/** Runs `fn` over `items`, `n` at a time. */
const pool = async (items, n, fn) => {
  const queue = [...items]
  await Promise.all(Array.from({ length: n }, async () => {
    while (queue.length) await fn(queue.shift())
  }))
}

/**
 * The builds the deploy serves (`keptBuilds`): `next` (this build, already in `dist/`) and the ones the live
 * Worker lists, their files fetched into `dist/` while they fit the files a version takes.
 */
const carryBuilds = async (next) => {
  const budget = MAX_FILES - filesUnder(DIST).length - 100
  const kept = keptBuilds(await liveBuilds(), next, Date.now(), budget)
  // A build whose files the live Worker can't give back is dropped whole: half a build is no use to a page.
  const failed = new Set()
  await pool(kept.filter((b) => b !== next), 16, async (build) => {
    try {
      for (const file of build.files) await fetchFile(file)
    } catch (error) {
      console.warn(`[builds] Dropped build ${build.id}: ${error}`)
      failed.add(build)
    }
  })
  return kept.filter((b) => !failed.has(b))
}

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
const builds = process.argv.includes('--keep') ? await carryBuilds(next) : [next]
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

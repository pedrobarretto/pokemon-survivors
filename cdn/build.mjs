// Builds the asset CDN's directory (`cdn/dist`, what `cdn/wrangler.jsonc` deploys):
// - `public/assets/` under `assets/`, and `public/fonts/` under `fonts/` (the stylesheets name it, and load from the CDN);
// - with `--site`, the site build's chunks (`dist/assets/`'s own files, after `vite build`) as a new build;
// - the builds the live CDN keeps (`keptBuilds` in cdn/builds.ts), their chunks fetched from it (and cached in
//   node_modules/.cache, which Vercel keeps between builds), unless `--fresh`;
// - the share image (`public/og.png`, `OG_PATH`), in every deploy: `vercel.json` redirects the site's copy to it;
// - its `versions.json`, `builds.json` and the `_headers` the Worker serves them with.
// `npm run cdn:build`; `cdn/deploy.mjs` builds it before each deploy.
import { execSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { keptBuilds } from './builds.ts'
import { ASSETS_DIR, assetVersions, filesUnder } from './versions.mjs'

const ROOT = join(import.meta.dirname, '..')
/**
 * The share image's path, on the site and on the CDN. The pages keep naming the site's copy, so previews
 * fetched from mainland China (where `*.workers.dev` is blocked) still get it; `vercel.json` redirects
 * everyone else to the CDN's, so a hotlinked preview costs Vercel a redirect instead of the file.
 */
export const OG_PATH = '/og.png'
const OUT = join(import.meta.dirname, 'dist')
const SITE_ASSETS = join(ROOT, 'dist', 'assets')
const CACHE = join(ROOT, 'node_modules', '.cache', 'cdn-builds')
/** The most files a Worker version holds on the Free plan, and the most bytes in each. */
export const MAX_FILES = 20_000
export const MAX_FILE_BYTES = 25 * 1024 * 1024

// Asset URLs carry their group's version (`?v=`) and chunks a hash in their names, so both are cached for
// good; the CORS header keeps a canvas that draws an image readable, and lets the module scripts, the
// stylesheets' fonts, the workers and `fetch` read them from the site's pages.
const HEADERS = `/assets/*
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=31536000, stale-while-revalidate=604800, immutable
  X-Content-Type-Options: nosniff

/fonts/*
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800

/versions.json
  Access-Control-Allow-Origin: *
  Cache-Control: no-cache

${OG_PATH}
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800

/builds.json
  Cache-Control: no-cache
`

/** The CDN's origin, as the game's build reads it (`VITE_ASSET_ORIGIN`, set in the environment where it deploys), or empty. */
export const cdnOrigin = () => (process.env.VITE_ASSET_ORIGIN ?? '').replace(/\/+$/, '')

/** The commit being built, as `__GAME_VERSION__` names it (vite.config.ts): Vercel's or GitHub's, else git's. */
export const commit = () =>
  (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA)?.slice(0, 7) ?? execSync('git rev-parse --short HEAD').toString().trim()

/** The builds the Worker at `origin` lists (`builds.json`): none when it has no list yet; throws when it can't be read. */
const liveBuilds = async (origin) => {
  const res = await fetch(`${origin}/builds.json`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`${origin}/builds.json: HTTP ${res.status}`)
  const builds = await res.json()
  if (!Array.isArray(builds)) throw new Error(`${origin}/builds.json isn't a list`)
  return builds
}

/** Puts a kept build's file in `outDir`: from this build, the cache or the live origin (then cached in `cacheDir`). */
const fetchFile = async (origin, file, outDir, cacheDir) => {
  const out = join(outDir, file)
  if (existsSync(out)) return
  const cached = join(cacheDir, file)
  if (!existsSync(cached)) {
    const res = await fetch(`${origin}/${file}`, { signal: AbortSignal.timeout(60_000) })
    if (!res.ok) throw new Error(`${origin}/${file}: HTTP ${res.status}`)
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
 * The builds a deploy of `outDir` serves (`keptBuilds`): `next` (this build, already in `outDir`, or null) and
 * the ones the live Worker at `origin` lists in its `builds.json`, their files fetched into `outDir` while they
 * fit the files a version takes. Shared by the asset CDN and the site's Worker (`cdn/site.mjs`).
 */
export const carryBuilds = async ({ origin, next, outDir, cacheDir }) => {
  const budget = MAX_FILES - filesUnder(outDir).length - 100
  const kept = keptBuilds(await liveBuilds(origin), next, Date.now(), budget)
  // A build whose files the live Worker can't give back is dropped whole: half a build is no use to a page.
  const failed = new Set()
  await pool(kept.filter((b) => b !== next), 16, async (build) => {
    try {
      for (const file of build.files) await fetchFile(origin, file, outDir, cacheDir)
    } catch (error) {
      console.warn(`[builds] Dropped build ${build.id}: ${error}`)
      failed.add(build)
    }
  })
  return kept.filter((b) => !failed.has(b))
}

/**
 * Builds `cdn/dist`. `site`: add this checkout's site build (`dist/assets`) as a new build. `keep`: carry the
 * live CDN's builds along (needs `origin`; a deploy must, or the pages opened before it lose their chunks).
 * Returns the builds it holds.
 */
export const assemble = async ({ site = false, keep = true, origin = cdnOrigin() } = {}) => {
  rmSync(OUT, { recursive: true, force: true })
  const hidden = (src) => !src.split(/[\\/]/).pop()?.startsWith('.')
  cpSync(ASSETS_DIR, join(OUT, 'assets'), { recursive: true, filter: hidden })
  cpSync(join(ROOT, 'public', 'fonts'), join(OUT, 'fonts'), { recursive: true, filter: hidden })
  copyFileSync(join(ROOT, 'public', OG_PATH), join(OUT, OG_PATH))
  const versions = assetVersions()
  writeFileSync(join(OUT, 'versions.json'), JSON.stringify(versions))
  writeFileSync(join(OUT, '_headers'), HEADERS)

  let next = null
  if (site) {
    if (!existsSync(SITE_ASSETS)) throw new Error('No site build in dist/assets: run vite build first')
    const files = readdirSync(SITE_ASSETS, { withFileTypes: true }).filter((e) => e.isFile() && !e.name.endsWith('.map')).map((e) => `assets/${e.name}`)
    for (const file of files) copyFileSync(join(ROOT, 'dist', file), join(OUT, file))
    next = { id: commit(), at: Date.now(), files }
  }

  let builds = next ? [next] : []
  if (keep) {
    if (!origin) throw new Error('VITE_ASSET_ORIGIN is unset: no CDN to keep builds from')
    builds = await carryBuilds({ origin, next, outDir: OUT, cacheDir: CACHE })
  }
  writeFileSync(join(OUT, 'builds.json'), JSON.stringify(builds))

  const files = filesUnder(OUT).length
  if (files > MAX_FILES) throw new Error(`cdn/dist has ${files} files, over the ${MAX_FILES} a Worker version takes`)
  console.log(`cdn/dist: ${files} files, ${Object.keys(versions).length} asset groups, builds ${builds.map((b) => b.id).join(', ') || 'none'}`)
  return builds
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2)
  await assemble({ site: args.includes('--site'), keep: !args.includes('--fresh') })
}

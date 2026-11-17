// Deploys the asset CDN (`cdn/`) from the site's build, where its token is set (Vercel's production builds:
// CLOUDFLARE_API_TOKEN, plus VITE_ASSET_ORIGIN, the CDN's address). Without them it does nothing, and the
// site serves its own chunks and the assets the CDN doesn't have, as before. Part of `npm run build`:
//
//   node cdn/deploy.mjs assets   Before `vite build`: deploys public/assets/ when the CDN serves other versions of
//                                them, so the build points every group at it (`servedVersions` in cdn/versions.mjs).
//                                A failure only leaves the changed groups on the site until the next build.
//   node cdn/deploy.mjs site     After it and scripts/sourcemaps.mjs (which rewrites the chunks): deploys the build's
//                                chunks next to the ones the CDN keeps (cdn/builds.ts), and only once they're live
//                                rewrites the pages to load them from it (cdn/loader.ts). On a failure the pages
//                                keep loading from the site. Vercel publishes the pages only after the build, so a
//                                page never names chunks the CDN doesn't have yet.
//                                On Vercel, it then fails the build unless the CDN serves the image `vercel.json`
//                                redirects /og.png to (`OG_PATH` in cdn/build.mjs), so the redirect never goes live
//                                naming a missing file.
//
// `--force` deploys the assets whatever the CDN has, and fails loudly (`npm run cdn:deploy`, the manual workflow).
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { assemble, cdnOrigin, OG_PATH } from './build.mjs'
import { withCdnLoader } from './loader.ts'
import { assetVersions, servedVersions } from './versions.mjs'

const ROOT = join(import.meta.dirname, '..')
const DIST = join(ROOT, 'dist')
const WRANGLER = 'wrangler@4.154.0'

const [mode, ...flags] = process.argv.slice(2)
const force = flags.includes('--force')
const origin = cdnOrigin()

/** `wrangler deploy` of cdn/dist, tried twice; whether it went live. */
const deploy = () => {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const run = spawnSync('npx', ['--yes', WRANGLER, 'deploy', '--config', 'cdn/wrangler.jsonc'], { cwd: ROOT, stdio: 'inherit' })
    if (run.status === 0) return true
    console.warn(`[cdn] wrangler deploy failed (attempt ${attempt})`)
  }
  return false
}

/** Every page the build wrote. */
const pages = () => readdirSync(DIST, { recursive: true }).filter((f) => f.endsWith('.html')).map((f) => join(DIST, f))

const deployAssets = async () => {
  if (!force) {
    const local = assetVersions()
    const served = await servedVersions(origin, local)
    if (Object.keys(served).length === Object.keys(local).length) return console.log('[cdn] The CDN serves these assets already.')
  }
  await assemble()
  if (!deploy()) throw new Error('the assets deploy failed')
}

const deploySite = async () => {
  await assemble({ site: true })
  if (!deploy()) throw new Error('the chunks deploy failed: the pages load them from the site')
  let rewritten = 0
  for (const page of pages()) {
    const html = withCdnLoader(readFileSync(page, 'utf8'), origin)
    if (html === null) continue
    writeFileSync(page, html)
    rewritten++
  }
  console.log(`[cdn] ${rewritten} pages load their chunks from ${origin}`)
}

/** Whether `url` serves a PNG, tried three times. */
const servesPng = async (url) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
      if (res.ok && res.headers.get('content-type')?.startsWith('image/png')) return true
      console.warn(`[cdn] ${url}: HTTP ${res.status} ${res.headers.get('content-type')} (attempt ${attempt})`)
    } catch (error) {
      console.warn(`[cdn] ${url}: ${error} (attempt ${attempt})`)
    }
  }
  return false
}

/** The address `vercel.json` redirects the site's share image to, if it does. */
const ogRedirect = () => {
  const { redirects = [] } = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'))
  return redirects.find((r) => r.source === OG_PATH)?.destination
}

if (mode !== 'assets' && mode !== 'site') throw new Error('Usage: node cdn/deploy.mjs assets|site [--force]')
if (!process.env.CLOUDFLARE_API_TOKEN || !origin) {
  console.log('[cdn] CLOUDFLARE_API_TOKEN or VITE_ASSET_ORIGIN unset: the CDN is not deployed, the site serves its chunks.')
  if (force) process.exit(1)
} else {
  try {
    await (mode === 'assets' ? deployAssets() : deploySite())
  } catch (error) {
    console.warn(`[cdn] ${error instanceof Error ? error.message : error}`)
    // A failed deploy never fails a site build: it ships loading from the site, as before (only the check below can).
    if (force) process.exit(1)
  }
}

// The one way the CDN fails a build: a deployment whose /og.png redirects to a file the CDN lacks would break
// every link preview of the game, so it stays unpublished and the live one keeps serving.
const ogTarget = ogRedirect()
if (mode === 'site' && process.env.VERCEL && ogTarget && !(await servesPng(ogTarget))) {
  console.error(`[cdn] vercel.json redirects ${OG_PATH} to ${ogTarget}, which doesn't serve it: not publishing that redirect.`)
  process.exit(1)
}

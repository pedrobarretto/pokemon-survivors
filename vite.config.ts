import { execSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, runnerImport, type Plugin } from 'vite'
import { SIM_ROOTS, simBuildId } from './src/coop/simBuild'

type Site = typeof import('./src/site/index.ts')

const SITE_ENTRY = '/src/site/index.ts'

/**
 * Static site pages (Pokédex, guide, changelog, legal) rendered from `src/site`.
 * In the build each page is a virtual HTML entry, so Vite bundles its CSS/JS and
 * writes `dist/<path>/index.html` with the content already in the markup. In dev
 * the same render runs per request (fresh after every edit). Also serves and
 * emits `sitemap.xml` from the route table.
 */
const sitePages = (): Plugin => {
  let site: Site | null = null
  let root = process.cwd()
  /** Every document the site renders: its pages and the 404. */
  const documents = (of: Site) => [...of.SITE_PAGES, of.NOT_FOUND_PAGE]
  /** The build's documents by absolute file, looked up on every module Vite resolves. */
  let pages = new Map<string, ReturnType<typeof documents>[number]>()
  const pageFor = (id: string) => pages.get(id)
  return {
    name: 'site-pages',
    enforce: 'pre',
    async config(config, { command }) {
      if (command !== 'build') return
      root = resolve(config.root ?? process.cwd())
      site = (await runnerImport<Site>(SITE_ENTRY, { configFile: false, root })).module
      pages = new Map(documents(site).map((p) => [resolve(root, p.file), p]))
      // Entry names from the output file: `en/guide/index.html` → `en-guide`, `404.html` → `404`.
      const name = (file: string) => file.replace(/(\/?index)?\.html$/, '').replace(/\//g, '-')
      return { build: { rolldownOptions: { input: Object.fromEntries(documents(site).map((p) => [name(p.file), p.file])) } } }
    },
    resolveId(id) {
      const file = resolve(root, id.replace(/^\//, ''))
      return pageFor(file) ? file : null
    },
    load(id) {
      return pageFor(id)?.render() ?? null
    },
    generateBundle() {
      if (site) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: site.sitemap() })
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? '/').split(/[?#]/)[0] ?? '/'
        const dev = (await server.ssrLoadModule(SITE_ENTRY)) as Site
        if (path === '/sitemap.xml') {
          res.setHeader('Content-Type', 'application/xml')
          return res.end(dev.sitemap())
        }
        // Like Vercel's `trailingSlash: true`: /guia → /guia/
        const page = documents(dev).find((p) => p.path === path || p.path === `${path}/`)
        if (!page) {
          if (!missing(path, req.headers.accept)) return next()
          // Like Vercel: a page that doesn't exist gets the 404 page, with its status.
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/html')
          return res.end(await server.transformIndexHtml(path, dev.NOT_FOUND_PAGE.render(), req.originalUrl))
        }
        if (page.path !== path) {
          res.statusCode = 308
          res.setHeader('Location', page.path)
          return res.end()
        }
        res.setHeader('Content-Type', 'text/html')
        res.end(await server.transformIndexHtml(path, page.render(), req.originalUrl))
      })
    },
  }
}

/**
 * Whether a dev request is a page navigation Vercel would answer with the 404:
 * HTML, not Vite's own paths or a file (an extension), and no game page on disk.
 */
const missing = (path: string, accept: string | undefined) =>
  (accept ?? '').includes('text/html') &&
  !/^\/(@|src\/|node_modules\/|ingest|__)/.test(path) &&
  !/\.[a-z0-9]+$/i.test(path) &&
  !statSafe(resolve(import.meta.dirname, `.${path.endsWith('/') ? path : `${path}/`}index.html`))

const statSafe = (file: string) => {
  try {
    return statSync(file).isFile()
  } catch {
    return false
  }
}

/** The commit being built (Vercel says which; locally, git), for `__GAME_VERSION__`. */
const gameVersion = () => {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA
  if (sha) return sha.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev'
  } catch {
    return 'dev'
  }
}

/** A repo file's text, or null when it isn't a file. */
const readRepoFile = (path: string) => {
  try {
    const file = resolve(import.meta.dirname, path)
    return statSync(file).isFile() ? readFileSync(file, 'utf8') : null
  } catch {
    return null
  }
}

/** A constant `export const NAME = <integer>` read from a source file (no module loading, the config stays light). */
const constantIn = (path: string, name: string) => Number(new RegExp(`export const ${name} = (\\d+)`).exec(readRepoFile(path) ?? '')?.[1] ?? NaN)

/**
 * The co-op build id (`__SIM_BUILD__`): a hash of the simulation's modules only
 * (`src/coop/simBuild.ts`), so the relay pins rooms to the simulation, not to
 * the app, and a deploy that doesn't touch the simulation never splits a room.
 */
export const simBuild = () =>
  simBuildId(SIM_ROOTS, readRepoFile, { rules: constantIn('src/game/replay.ts', 'RULES_VERSION'), protocol: constantIn('src/net/protocol.ts', 'PROTOCOL') }).id

const SIM_BUILD = simBuild()

/**
 * `/sim-build.json`: the co-op build id the site serves now (`{ build }`), so a
 * page refused by a room on another build can tell an older room from its own
 * page being behind (`coop/lobby.ts`, `buildAdvice`). Emitted by the build, served in dev.
 */
const simBuildFile = (): Plugin => {
  const body = JSON.stringify({ build: SIM_BUILD })
  return {
    name: 'sim-build-file',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sim-build.json', source: body })
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if ((req.url ?? '').split('?')[0] !== '/sim-build.json') return next()
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(body)
      })
    },
  }
}

// One page per language for the game (index.html, en/, es/, fr/, zh-tw/ and tr/index.html); the site pages are added by `sitePages`.
export default defineConfig({
  plugins: [sitePages(), simBuildFile()],
  // The co-op relay (`relay/`) is its own package with its own Workers test runner.
  test: { exclude: ['**/node_modules/**', '**/.git/**', 'relay/**'] },
  define: { __GAME_VERSION__: JSON.stringify(gameVersion()), __SIM_BUILD__: JSON.stringify(SIM_BUILD) },
  // PostHog's proxy, as vercel.json has it, to try analytics locally (`ps:analytics` set to `on` in localStorage).
  server: { proxy: { '/ingest': { target: 'https://us.i.posthog.com', changeOrigin: true, rewrite: (path) => path.replace(/^\/ingest/, '') } } },
  build: {
    // Hidden source maps, for `scripts/sourcemaps.mjs` to upload to PostHog, only where it will.
    sourcemap: process.env.POSTHOG_CLI_API_KEY ? 'hidden' : false,
    rolldownOptions: {
      input: { main: 'index.html', en: 'en/index.html', es: 'es/index.html', fr: 'fr/index.html', zh: 'zh-tw/index.html', tr: 'tr/index.html' },
    },
  },
})

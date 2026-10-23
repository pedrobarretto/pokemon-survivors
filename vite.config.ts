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
  const pageFor = (id: string) => site?.SITE_PAGES.find((p) => resolve(root, p.file) === id)
  return {
    name: 'site-pages',
    enforce: 'pre',
    async config(config, { command }) {
      if (command !== 'build') return
      root = resolve(config.root ?? process.cwd())
      site = (await runnerImport<Site>(SITE_ENTRY, { configFile: false, root })).module
      return { build: { rolldownOptions: { input: Object.fromEntries(site.SITE_PAGES.map((p) => [p.path.slice(1, -1).replace(/\//g, '-'), p.file])) } } }
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
        const page = dev.SITE_PAGES.find((p) => p.path === path || p.path === `${path}/`)
        if (!page) return next()
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

// One page per language for the game (index.html, en/, es/, fr/ and zh-tw/index.html); the site pages are added by `sitePages`.
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
      input: { main: 'index.html', en: 'en/index.html', es: 'es/index.html', fr: 'fr/index.html', zh: 'zh-tw/index.html' },
    },
  },
})

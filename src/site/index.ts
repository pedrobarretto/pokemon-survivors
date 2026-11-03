import { TIER_SNAPSHOT } from '../data/tierRuns'
import { LOCALE_IDS, type Locale } from '../i18n'
import { CHANGELOG } from './changelog'
import { alternativesPage } from './pages/alternatives'
import { changelogPage } from './pages/changelog'
import { comparePage } from './pages/compare'
import { creatorsPage } from './pages/creators'
import { dexPage } from './pages/dexPage'
import { guidePage } from './pages/guide'
import { legalPage } from './pages/legal'
import { notFoundPage } from './pages/notFound'
import { pokedexPage } from './pages/pokedex'
import { supportPage } from './pages/support'
import { tierListPage } from './pages/tierList'
import { dexPages } from './pokedex'
import { dexPaths, PAGE_IDS, ROUTE_IDS, ROUTES, sitemap as routesSitemap, type PageId, type Paths, type RouteId } from './routes'

const RENDER: Record<PageId, (locale: Locale) => string> = {
  pokedex: pokedexPage,
  tierList: tierListPage,
  guide: guidePage,
  changelog: changelogPage,
  legal: legalPage,
  support: supportPage,
  creators: creatorsPage,
  compare: comparePage,
  alternatives: alternativesPage,
}

export type SitePage = {
  /** URL path, e.g. `/en/guide/`. */
  path: string
  /** The same page's path in every language (its hreflang alternates). */
  paths: Paths
  /** Output file relative to the project root, e.g. `en/guide/index.html`. */
  file: string
  render: () => string
}

const pagesOf = (paths: Paths, render: (locale: Locale) => string): SitePage[] =>
  LOCALE_IDS.map((locale) => ({ path: paths[locale], paths, file: `${paths[locale].slice(1)}index.html`, render: () => render(locale) }))

/**
 * Every static page in every language: the routes, then one page per playable
 * Pokémon (`dexPages`). `vite.config.ts` renders them at build time (and on
 * request in dev), so the HTML ships complete, without client JS.
 */
export const SITE_PAGES: readonly SitePage[] = [
  ...PAGE_IDS.flatMap((id) => pagesOf(ROUTES[id], RENDER[id])),
  ...dexPages().flatMap((page) => pagesOf(dexPaths(page.slug), (locale) => dexPage(page, locale))),
]

/**
 * The 404 page: `404.html` at the root, which Vercel serves (status 404) for any
 * path that doesn't exist. Not a route: no hreflang, not in the sitemap, never indexed.
 */
export const NOT_FOUND_PAGE = { path: '/404.html', file: '404.html', render: notFoundPage } as const

/**
 * `<lastmod>` of the routes whose last change we know: the game and the changelog
 * change with each update, the tier list with its snapshot. Every other page goes
 * without one, since a date that moves when the page didn't teaches Google to ignore them all.
 */
const LASTMOD: Partial<Record<RouteId, string>> = {
  play: CHANGELOG[0]?.date,
  changelog: CHANGELOG[0]?.date,
  tierList: TIER_SNAPSHOT.date,
}

/** sitemap.xml: every route and every Pokémon page. */
export const sitemap = () =>
  routesSitemap([...ROUTE_IDS.map((id) => ({ paths: ROUTES[id], lastmod: LASTMOD[id] })), ...dexPages().map((p) => ({ paths: dexPaths(p.slug) }))])

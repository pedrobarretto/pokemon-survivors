import { LOCALE_IDS, type Locale } from '../i18n'
import { changelogPage } from './pages/changelog'
import { dexPage } from './pages/dexPage'
import { guidePage } from './pages/guide'
import { legalPage } from './pages/legal'
import { pokedexPage } from './pages/pokedex'
import { supportPage } from './pages/support'
import { tierListPage } from './pages/tierList'
import { dexPages } from './pokedex'
import { dexPaths, PAGE_IDS, ROUTES, sitemap as routesSitemap, type PageId, type Paths } from './routes'

const RENDER: Record<PageId, (locale: Locale) => string> = {
  pokedex: pokedexPage,
  tierList: tierListPage,
  guide: guidePage,
  changelog: changelogPage,
  legal: legalPage,
  support: supportPage,
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

/** sitemap.xml: every route and every Pokémon page. */
export const sitemap = () => routesSitemap(dexPages().map((p) => dexPaths(p.slug)))

import { LOCALE_IDS, type Locale } from '../i18n'
import { changelogPage } from './pages/changelog'
import { creatorsPage } from './pages/creators'
import { guidePage } from './pages/guide'
import { legalPage } from './pages/legal'
import { pokedexPage } from './pages/pokedex'
import { supportPage } from './pages/support'
import { PAGE_IDS, ROUTES, type PageId } from './routes'

export { sitemap } from './routes'

const RENDER: Record<PageId, (locale: Locale) => string> = {
  pokedex: pokedexPage,
  guide: guidePage,
  changelog: changelogPage,
  legal: legalPage,
  support: supportPage,
  creators: creatorsPage,
}

export type SitePage = {
  /** URL path, e.g. `/en/guide/`. */
  path: string
  /** Output file relative to the project root, e.g. `en/guide/index.html`. */
  file: string
  render: () => string
}

/**
 * Every static page in every language. `vite.config.ts` renders them at build
 * time (and on request in dev), so the HTML ships complete, without client JS.
 */
export const SITE_PAGES: readonly SitePage[] = PAGE_IDS.flatMap((id) =>
  LOCALE_IDS.map((locale) => {
    const path = ROUTES[id][locale]
    return { path, file: `${path.slice(1)}index.html`, render: () => RENDER[id](locale) }
  }),
)

import { LOCALE_IDS, type Locale } from '../i18n'
import { SITE_MESSAGES } from '../i18n/site'
import { html, jsonLd, raw, type Html } from './html'
import { absolute, alternatesOf, HREFLANG, REPO_URL, ROUTES, SOCIAL_IDS, SOCIALS, type PageId, type Paths, type RouteId } from './routes'

export type PageMeta = {
  id: PageId
  locale: Locale
  title: string
  description: string
  /** schema.org nodes for this page, merged into one `@graph` with the breadcrumbs. */
  schema?: readonly Record<string, unknown>[]
  /** Page-specific CSS generated from data (the Pokédex sprite sheets), inlined as is. */
  css?: string
  /** A page below the section `id` (a Pokémon's page under the Pokédex): its name in the breadcrumbs and its paths. */
  sub?: { name: string; paths: Paths }
}

const pathsOf = ({ id, sub }: Pick<PageMeta, 'id' | 'sub'>): Paths => sub?.paths ?? ROUTES[id]

const NAV: readonly RouteId[] = ['play', 'pokedex', 'tierList', 'guide', 'changelog']

const others = (locale: Locale) => LOCALE_IDS.filter((l) => l !== locale)

/**
 * Paints the game's theme (Settings → Jogo → Tema, in `ps:settings`) on <html> before the page draws, by
 * `ui/theme.ts`'s rule: `dark`, `light`, or the system's for `system` and no choice yet. Inline, so the cards
 * never flash light, and standalone, since the site never loads game code.
 */
const THEME_SCRIPT = `try{var t=JSON.parse(localStorage.getItem('ps:settings')||'{}').theme;document.documentElement.dataset.theme=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch(e){}`

const head = ({ id, locale, title, description, schema = [], css, sub }: PageMeta) => {
  const m = SITE_MESSAGES[locale]
  const paths = pathsOf({ id, sub })
  const url = absolute(paths[locale])
  const section = absolute(ROUTES[id][locale])
  const graph = [
    {
      '@type': 'WebPage',
      '@id': `${url}#page`,
      url,
      name: title,
      description,
      inLanguage: m.lang.tag,
      isPartOf: { '@id': `${absolute('/')}#website` },
      about: { '@id': `${absolute('/')}#game` },
      breadcrumb: { '@id': `${url}#breadcrumb` },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Pokémon Survivors', item: absolute(ROUTES.play[locale]) },
        { '@type': 'ListItem', position: 2, name: m.nav[id], item: section },
        ...(sub ? [{ '@type': 'ListItem', position: 3, name: sub.name, item: url }] : []),
      ],
    },
    ...schema,
  ]
  return html`<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#101820" />
    <meta name="color-scheme" content="dark" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${url}" />
    ${alternatesOf(paths).map((a) => html`<link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />\n    `)}<meta property="og:type" content="website" />
    <meta property="og:site_name" content="Pokémon Survivors" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${absolute('/og.png')}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="${m.lang.og}" />
    ${others(locale).map((l) => html`<meta property="og:locale:alternate" content="${SITE_MESSAGES[l].lang.og}" />\n    `)}    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/assets/pokemon/4/portrait.png" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <script>${raw(THEME_SCRIPT)}</script>
    <link rel="stylesheet" href="/src/site/site.css" />
    ${css && html`<style>${raw(css)}</style>`}
    <script type="application/ld+json">${jsonLd({ '@context': 'https://schema.org', '@graph': graph })}</script>
    <script type="module" src="/src/site/client.ts"></script>
  </head>`
}

/** The site's header: brand, nav (`current` marked as the page shown) and the language switch to `paths`. */
export const header = (locale: Locale, paths: Paths, current: RouteId | null) => {
  const m = SITE_MESSAGES[locale]
  return html`<a class="skip" href="#content">${m.skip}</a>
  <header class="site-header">
    <a class="brand" href="${ROUTES.play[locale]}"><img src="/assets/pokemon/4/portrait.png" width="40" height="40" alt="" /><span>Pokémon<br />Survivors</span></a>
    <nav class="site-nav" aria-label="${m.nav.label}">
      ${NAV.map(
        (r) => html`<a href="${ROUTES[r][locale]}" class="${r === 'play' ? 'nav-play' : ''}"${r === current ? html` aria-current="page"` : ''}>${m.nav[r]}</a>`,
      )}
    </nav>
    <nav class="lang" aria-label="${m.nav.language}">
      ${LOCALE_IDS.map(
        (l) =>
          html`<a href="${paths[l]}" hreflang="${HREFLANG[l]}" lang="${SITE_MESSAGES[l].lang.tag}" data-lang="${l}"${l === locale ? html` aria-current="true"` : html` title="${SITE_MESSAGES[l].lang.switchTo}"`}>${SITE_MESSAGES[l].lang.short}</a>`,
      )}
    </nav>
  </header>`
}

/** The site's footer: the disclaimer and the legal, credits, source, social and support links. */
export const footer = (locale: Locale) => {
  const m = SITE_MESSAGES[locale]
  return html`<footer class="site-footer">
    <p>${m.footer.disclaimer}</p>
    <p class="footer-links">
      <a href="${ROUTES.legal[locale]}">${m.footer.legal}</a>
      <a href="${REPO_URL}/blob/main/CREDITS.md">${m.footer.credits}</a>
      <a href="${REPO_URL}">${m.footer.source}</a>
      ${SOCIAL_IDS.map((id) => html`<a href="${SOCIALS[id].url}" rel="me">${SOCIALS[id].name}</a>`)}
      <a class="support-link" href="${ROUTES.support[locale]}">♥ ${m.footer.support}</a>
    </p>
  </footer>`
}

/** Full HTML document of a site page: head (SEO, hreflang, JSON-LD), shared header and footer. */
export const layout = (meta: PageMeta, main: Html) => {
  const m = SITE_MESSAGES[meta.locale]
  return `<!doctype html>
<html lang="${m.lang.tag}">
  ${head(meta).__html}
  <body>
  ${header(meta.locale, pathsOf(meta), meta.sub ? null : meta.id).__html}
  <main id="content" class="site-main">
${main.__html}
  </main>
  ${footer(meta.locale).__html}
  </body>
</html>
`
}

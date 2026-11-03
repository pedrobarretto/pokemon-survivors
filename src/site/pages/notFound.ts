import { LOCALE_IDS, type Locale } from '../../i18n'
import { SITE_MESSAGES } from '../../i18n/site'
import { escape, html, jsonLd } from '../html'
import { footer, header } from '../layout'
import type { NotFoundIndex } from '../notFound'
import { dexPages, pokedex, type DexEntry } from '../pokedex'
import { ROUTE_IDS, ROUTES } from '../routes'

/** The horde of the Rota 404 mini game. */
const FOE_DEX = 41

const byLocale = <T>(of: (l: Locale) => T): Readonly<Record<Locale, T>> => ({ pt: of('pt'), en: of('en'), es: of('es'), fr: of('fr'), zh: of('zh') })

const walkOf = (entry: DexEntry) => ({ dex: entry.dex, walk: entry.sprites.normal.walk })

/** What the page's client needs to suggest a page and stage the mini game, from the routes and `data/*`. */
export const notFoundIndex = (): NotFoundIndex => {
  const foe = pokedex().find((e) => e.dex === FOE_DEX)
  if (!foe) throw new Error(`No Pokédex entry for the 404's horde (#${FOE_DEX})`)
  return {
    prefixes: ROUTES.play,
    routes: ROUTE_IDS.map((id) => ({ paths: ROUTES[id], name: byLocale((l) => SITE_MESSAGES[l].nav[id]) })),
    pokedex: ROUTES.pokedex,
    dex: dexPages().map((page) => {
      const first = page.entries[0]!
      return { slug: page.slug, name: first.name, ...walkOf(first), species: page.entries.map((e) => e.slug) }
    }),
    foe: walkOf(foe),
  }
}

const EXITS = ['play', 'pokedex', 'guide'] as const

const main = (locale: Locale) => {
  const m = SITE_MESSAGES[locale]
  const nf = m.notFound
  return html`<section class="nf">
      <div class="page-head">
        <p class="nf-eyebrow">${nf.eyebrow}</p>
        <h1>${nf.h1}</h1>
        <p class="lead">${nf.lead}</p>
        <p class="nf-url" hidden>${nf.url} <code></code></p>
      </div>
      <div class="nf-game" data-over="${nf.over}">
        <canvas role="img" aria-label="${nf.game}"></canvas>
        <p class="nf-start">${nf.start}</p>
        <a class="nf-go" href="${ROUTES.play[locale]}" hidden>${nf.go} <b></b> <kbd>Enter</kbd></a>
        <div class="nf-over" hidden>
          <div class="box">
            <p class="nf-over-title"></p>
            <dl class="nf-stats">
              <div><dt>${nf.time}</dt><dd data-stat="time"></dd></div>
              <div><dt>${nf.ko}</dt><dd data-stat="ko"></dd></div>
              <div><dt>${nf.best}</dt><dd data-stat="best"></dd></div>
            </dl>
            <button type="button" class="btn-play">${nf.retry}</button>
          </div>
        </div>
      </div>
      <p class="nf-hint">${nf.hint}</p>
      <a class="nf-mean box" href="${ROUTES.play[locale]}" hidden><img alt="" width="40" height="40" /><span>${nf.mean.before}<b></b>${nf.mean.after}</span></a>
      <nav class="nf-links" aria-label="${m.nav.label}">
        ${EXITS.map((id) => html`<a class="box" href="${ROUTES[id][locale]}" data-exit="${id}"><span class="nf-exit">${m.nav[id]}</span>${nf.notes[id]}</a>`)}
      </nav>
    </section>`
}

const body = (locale: Locale) =>
  html`${header(locale, ROUTES.play, null)}
  <main id="content" class="site-main">
    ${main(locale)}
  </main>
  ${footer(locale)}`

/**
 * Picks the page's language before it paints: the path's prefix (`/es/…`), else
 * the language saved by the game or the site (`ps:lang`), else the browser's,
 * else English, as the game does. Portuguese is in the markup (what shows
 * without JS); any other swaps in from its `<template>`.
 */
const pickLocale = () => {
  const prefixes = Object.fromEntries(LOCALE_IDS.filter((l) => l !== 'pt').map((l) => [l, ROUTES.play[l]]))
  return `(() => {
  const prefixes = ${JSON.stringify(prefixes)}
  const known = ${JSON.stringify(LOCALE_IDS)}
  const path = location.pathname.toLowerCase()
  let locale = Object.keys(prefixes).find((l) => path.startsWith(prefixes[l]))
  if (!locale) {
    let saved = null
    try { saved = localStorage.getItem('ps:lang') } catch {}
    locale = known.includes(saved) ? saved : ((navigator.languages || []).map((l) => l.slice(0, 2).toLowerCase()).find((l) => known.includes(l)) || 'en')
  }
  const root = document.documentElement
  root.classList.add('js')
  root.dataset.locale = locale
  const template = document.querySelector('template[data-locale="' + locale + '"]')
  if (!template) return
  const page = document.getElementById('nf-root')
  page.textContent = ''
  page.appendChild(template.content.cloneNode(true))
  root.lang = template.dataset.tag
  document.title = template.dataset.title
})()`
}

/**
 * The 404 page (`404.html` at the root, which Vercel serves for any path that
 * doesn't exist): every language in one file, never indexed, and the Rota 404
 * mini game (`notFoundClient.ts`) whose signs are the page's links.
 */
export const notFoundPage = () => {
  const pt = SITE_MESSAGES.pt
  const others = LOCALE_IDS.filter((l) => l !== 'pt')
  return `<!doctype html>
<html lang="${pt.lang.tag}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#101820" />
    <meta name="color-scheme" content="dark" />
    <meta name="robots" content="noindex" />
    <title>${escape(pt.notFound.title)}</title>
    <link rel="icon" href="/assets/pokemon/4/portrait.png" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <link rel="stylesheet" href="/src/site/site.css" />
    <script type="module" src="/src/site/client.ts"></script>
  </head>
  <body>
  ${others.map((l) => html`<template data-locale="${l}" data-tag="${SITE_MESSAGES[l].lang.tag}" data-title="${SITE_MESSAGES[l].notFound.title}">${body(l)}</template>`).map((t) => t.__html).join('\n  ')}
  <div id="nf-root">${body('pt').__html}</div>
  <script>${pickLocale()}</script>
  <script type="application/json" id="nf-index">${jsonLd(notFoundIndex()).__html}</script>
  </body>
</html>
`
}

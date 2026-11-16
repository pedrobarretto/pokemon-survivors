import { assetUrl } from '../assets'
import type { Locale } from '../i18n'
import { suggest, type NotFoundIndex, type Walker } from './notFound'
import { startRoute404, type Exit, type SignIcon } from './route404'

/**
 * The 404 page's client, loaded by `client.ts` only there: shows the URL that
 * was asked for, the page it most likely meant ("Você quis dizer…?") and starts
 * the Rota 404 with the page's links as its signs. The language was already
 * picked by the page's inline script (`pages/notFound.ts`), which sets
 * `data-locale` on `<html>`.
 */

const EXIT_ICONS: Readonly<Record<string, SignIcon>> = { play: 'ball', pokedex: 'dex', guide: 'book' }

/** The walker used when the URL meant no Pokémon: the site's own Charmander. */
const DEFAULT_SLUG = 'charmander'

const sprite = ({ dex, walk }: Walker) => ({ src: assetUrl(`pokemon/${dex}/Walk.png`), sheet: walk })

const indexEl = document.getElementById('nf-index')
const index: NotFoundIndex | null = indexEl?.textContent ? JSON.parse(indexEl.textContent) : null

const isLocale = (value: string | undefined, of: NotFoundIndex): value is Locale => value !== undefined && value in of.prefixes

/** The path as typed, shortened in the middle past 60 characters. */
const shown = (pathname: string) => {
  let path = pathname
  try {
    path = decodeURI(pathname)
  } catch {
    // Keep the raw path.
  }
  return path.length > 60 ? `${path.slice(0, 30)}…${path.slice(-29)}` : path
}

if (index) {
  const page = document.documentElement.dataset.locale
  const locale = isLocale(page, index) ? page : 'pt'

  const url = document.querySelector<HTMLElement>('.nf-url')
  const code = url?.querySelector('code')
  if (url && code) {
    code.textContent = shown(location.pathname)
    url.hidden = false
  }

  const meant = suggest(location.pathname, index, locale)
  const mean = document.querySelector<HTMLAnchorElement>('.nf-mean')
  if (meant && mean) {
    mean.href = meant.path
    const name = mean.querySelector('b')
    if (name) name.textContent = meant.name
    const portrait = mean.querySelector('img')
    if (portrait && meant.dex !== null) portrait.src = assetUrl(`pokemon/${meant.dex}/portrait.png`)
    else portrait?.remove()
    mean.hidden = false
  }

  const exits: Exit[] = [...document.querySelectorAll<HTMLAnchorElement>('.nf-links a[data-exit]')].map((a) => ({
    href: a.href,
    label: a.querySelector('.nf-exit')?.textContent ?? '',
    icon: EXIT_ICONS[a.dataset.exit ?? ''] ?? 'ball',
    gold: false,
  }))
  const meantHref = meant ? new URL(meant.path, location.href).href : null
  if (meant && meantHref && !exits.some((e) => e.href === meantHref)) exits.push({ href: meantHref, label: meant.name, icon: 'mystery', gold: true })

  // Lost looking for a Pokémon? Walk the route as that Pokémon.
  const walker = index.dex.find((d) => d.dex === meant?.dex) ?? index.dex.find((d) => d.slug === DEFAULT_SLUG) ?? index.dex[0]
  const box = document.querySelector<HTMLElement>('.nf-game')
  if (box && walker) void startRoute404(box, { player: { ...sprite(walker), name: walker.name }, foe: sprite(index.foe), exits })
}

import type { Locale } from '../i18n'
import type { Paths } from './routes'
import type { Sheet } from './pokedex'

/**
 * What the 404 page knows about the site, serialized into the page at build time
 * (`pages/notFound.ts`) and read by its client (`notFoundClient.ts`). Plain data
 * only: the client must not import `routes.ts`, which pulls in the game's messages.
 */
export type NotFoundIndex = {
  /** Each language's home (`ROUTES.play`): its prefix in every path. */
  prefixes: Paths
  /** The site's routes with their nav names. */
  routes: readonly { paths: Paths; name: Readonly<Record<Locale, string>> }[]
  /** The Pokédex's path: a Pokémon's page is `pokedex[locale] + slug + '/'`. */
  pokedex: Paths
  /** One per Pokémon page: its slug, name, first species (dex number and walk sheet) and every species slug on it. */
  dex: readonly (Walker & { slug: string; name: string; species: readonly string[] })[]
  /** The mini game's horde. */
  foe: Walker
}

/** A species the mini game can draw: `/assets/pokemon/<dex>/Walk.png`, cut by its sheet. */
export type Walker = { dex: number; walk: Sheet }

export type Suggestion = { path: string; name: string; dex: number | null }

/** Lowercase, no accents, spaces as dashes, one slash between segments and a trailing one, no `index.html`. */
export const cleanPath = (pathname: string) => {
  let path = pathname
  try {
    path = decodeURIComponent(pathname)
  } catch {
    // A malformed escape: compare the raw path.
  }
  path = path
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(index)?\.html?$/, '')
    .replace(/[\s_+]+/g, '-')
    .replace(/\/+/g, '/')
  if (!path.startsWith('/')) path = `/${path}`
  return path.endsWith('/') ? path : `${path}/`
}

const LOCALES = ['pt', 'en', 'es', 'fr', 'zh', 'tr'] as const satisfies readonly Locale[]

/** The language a path's prefix names (`/es/…` → es), or null without one (the Portuguese pages live at the root). */
export const localeOfPath = (pathname: string, prefixes: Paths): Locale | null => {
  const path = cleanPath(pathname)
  return LOCALES.find((l) => prefixes[l] !== '/' && path.startsWith(prefixes[l])) ?? null
}

/** Edit distance (insertions, deletions, substitutions). */
export const distance = (a: string, b: string) => {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) row.push(Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)))
    prev = row
  }
  return prev[b.length]!
}

/** Typos a word may carry and still match: one per four letters, at least one. */
const tolerance = (word: string) => Math.max(1, Math.floor(word.length / 4))

/**
 * The page a missing URL most likely meant, in `locale`: the same path in any
 * language (`/en/guia/` → `/en/guide/`), a near one (`/pokedex/charmandr/`), a
 * Pokémon's name anywhere in it (`/pikachu`, `/en/pokedex/charmeleon/`), or the
 * deepest page the path starts with. Null when nothing is close.
 */
export const suggest = (pathname: string, index: NotFoundIndex, locale: Locale): Suggestion | null => {
  const path = cleanPath(pathname)
  const from = localeOfPath(path, index.prefixes) ?? 'pt'
  const rest = path.slice(index.prefixes[from].length)
  const restOf = (target: string, l: Locale) => target.slice(index.prefixes[l].length)

  type Match = { score: number; suggestion: Suggestion }
  const matches: Match[] = []
  const consider = (candidate: string, suggestion: Suggestion) => {
    const d = distance(rest, candidate)
    if (d <= tolerance(candidate)) matches.push({ score: d, suggestion })
    // An existing page the path goes below (`/pokedex/charmander/moves/`): the deeper, the better, after any near match.
    else if (candidate && rest.startsWith(candidate)) matches.push({ score: 100 - candidate.length, suggestion })
  }

  for (const route of index.routes)
    for (const l of LOCALES) consider(restOf(route.paths[l], l), { path: route.paths[locale], name: route.name[locale], dex: null })

  const last = rest.split('/').filter(Boolean).at(-1)
  for (const page of index.dex) {
    const suggestion = { path: `${index.pokedex[locale]}${page.slug}/`, name: page.name, dex: page.dex }
    for (const l of LOCALES) consider(`${restOf(index.pokedex[l], l)}${page.slug}/`, suggestion)
    if (!last) continue
    // A Pokémon's name as the path's last word, a stage of its family included (`/charmeleon` → Charmander's page).
    for (const species of page.species) {
      const d = distance(last, species)
      if (d <= tolerance(species)) matches.push({ score: d + 0.5, suggestion })
    }
  }

  return matches.reduce<Match | null>((best, m) => (best === null || m.score < best.score ? m : best), null)?.suggestion ?? null
}

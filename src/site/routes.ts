import { LOCALE_IDS, type Locale } from '../i18n'

export const SITE_URL = 'https://www.pokemonsurvivors.com'

export const REPO_URL = 'https://github.com/pedrobarretto/pokemon-survivors'

/**
 * The game's official profiles: the lobby's follow cards, Ajustes → Sobre and
 * the site's footer list them in this order. A new network (Instagram,
 * YouTube) is a row here, an icon in `render/art.ts` and a line in the static HTML.
 */
export const SOCIALS = {
  tiktok: { name: 'TikTok', handle: '@pokemonsurvivors', url: 'https://www.tiktok.com/@pokemonsurvivors' },
} as const satisfies Record<string, { name: string; handle: string; url: string }>

export type SocialId = keyof typeof SOCIALS

/** The community Discord's permanent invite (made by the bot, on #welcome). */
export const DISCORD_INVITE = 'https://discord.gg/Vx3RWFsjaD'

export const SOCIAL_IDS = Object.keys(SOCIALS) as SocialId[]

/**
 * Stripe Payment Link for donations from outside Brazil (cards, Apple Pay and
 * Google Pay, in US$; the donor picks the amount there). Linked from the support
 * page with the account's handle as `client_reference_id`; once paid it redirects to
 * the support page with `?thanks={CHECKOUT_SESSION_ID}` (set in Stripe's dashboard).
 */
export const STRIPE_DONATION_URL = 'https://donate.stripe.com/5kQ28l1x45My6ci4ibcjS00'

/**
 * Every public URL, per language. `play` is the game itself (`index.html`,
 * `en/index.html`); the others are the static pages generated at build time.
 * These paths are linked from the game's title screen, so keep them stable.
 */
export const ROUTES = {
  play: { pt: '/', en: '/en/', es: '/es/' },
  pokedex: { pt: '/pokedex/', en: '/en/pokedex/', es: '/es/pokedex/' },
  guide: { pt: '/guia/', en: '/en/guide/', es: '/es/guia/' },
  changelog: { pt: '/novidades/', en: '/en/changelog/', es: '/es/novedades/' },
  legal: { pt: '/legal/', en: '/en/legal/', es: '/es/legal/' },
  support: { pt: '/apoie/', en: '/en/support/', es: '/es/apoya/' },
  creators: { pt: '/criadores/', en: '/en/creators/', es: '/es/creadores/' },
} as const satisfies Record<string, Record<Locale, string>>

export type RouteId = keyof typeof ROUTES

export const ROUTE_IDS = Object.keys(ROUTES) as RouteId[]

/** Pages rendered by `src/site` (everything but the game). */
export const PAGE_IDS = ROUTE_IDS.filter((id): id is Exclude<RouteId, 'play'> => id !== 'play')

export type PageId = (typeof PAGE_IDS)[number]

export const absolute = (path: string) => `${SITE_URL}${path}`

/** hreflang of each language (Spanish for all of Latin America and beyond, not one country). */
export const HREFLANG = { pt: 'pt-BR', en: 'en', es: 'es' } as const satisfies Record<Locale, string>

/** hreflang alternates of a route; English is the default for other languages, like the game pages. */
export const alternates = (id: RouteId) => [
  ...LOCALE_IDS.map((l) => ({ hreflang: HREFLANG[l], href: absolute(ROUTES[id][l]) })),
  { hreflang: 'x-default', href: absolute(ROUTES[id].en) },
]

/** sitemap.xml with every URL in every language, each listing its alternates. */
export const sitemap = () => {
  const urls = ROUTE_IDS.flatMap((id) =>
    LOCALE_IDS.map((l) => ROUTES[id][l]).map((path) =>
      [
        '  <url>',
        `    <loc>${absolute(path)}</loc>`,
        ...alternates(id).map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`),
        '  </url>',
      ].join('\n'),
    ),
  )
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}

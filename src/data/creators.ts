/**
 * Content creators: players who stream or post videos of the game. The
 * lobby's Criadores card features one a day (whoever is live first), the
 * site's `/criadores/` page lists them all, and the API keeps who is live
 * now (`creator_live`, `server/src/creators.ts`). Plain data and pure rules,
 * shared by the game, the site's client and the API (no game imports here).
 *
 * A new creator is a row in `CREATORS`. Their `account` is their in-game @
 * (without the `@`), which lets them say they're live from the Trainer Card;
 * until they have one, the admin desk can say it for them.
 */

/**
 * Where creators stream: the name players know, the channel and its live
 * page, from the creator's handle there. A new one (YouTube, Twitch) is a row
 * here and its icon (`platformIcon` in `render/art.ts`).
 */
export const PLATFORMS = {
  tiktok: { name: 'TikTok', profile: (handle: string) => `https://www.tiktok.com/@${handle}`, live: (handle: string) => `https://www.tiktok.com/@${handle}/live` },
} as const

export type PlatformId = keyof typeof PLATFORMS

export type Creator = {
  /** How they call themselves. */
  name: string
  platform: PlatformId
  /** Their handle on the platform, without the `@`. */
  handle: string
  /** The language they stream in (one of the game's). */
  lang: 'pt' | 'en' | 'es'
  /** The Pokémon that walks beside their name (a national dex number with sprites in the game, and its English name). */
  partner: { dex: number; name: string; shiny?: boolean }
  /** Their in-game @ (no `@`), once they have an account: they can go live from the Trainer Card. */
  account: string | null
}

/** Every creator, in the order they joined: the site lists them so, and the lobby rotates through them. */
export const CREATORS = {
  birdseyegames: {
    name: 'Birdseye Games',
    platform: 'tiktok',
    handle: 'birdseyegames',
    lang: 'en',
    partner: { dex: 18, name: 'Pidgeot' },
    account: null,
  },
} as const satisfies Record<string, Creator>

export type CreatorId = keyof typeof CREATORS

export const CREATOR_IDS = Object.keys(CREATORS) as CreatorId[]

export const isCreatorId = (v: unknown): v is CreatorId => typeof v === 'string' && Object.hasOwn(CREATORS, v)

/** A creator's own row, typed as the wider `Creator` (so `account` reads as `string | null`, `shiny` as optional). */
export const creatorOf = (id: CreatorId): Creator => CREATORS[id]

/** How long "live" holds after a creator turns it on: streams rarely run longer, and a forgotten one switches off on its own. */
export const LIVE_HOURS = 4

/** A creator live now, until when (ISO): `GET /creators/live`. */
export type CreatorLive = { id: CreatorId; until: string }

/** `GET /creators/live`'s `live`, keeping creators this build knows that are still live at `now`. */
export const parseLive = (v: unknown, now: number): CreatorLive[] =>
  Array.isArray(v)
    ? v.flatMap((e: unknown) => {
        if (typeof e !== 'object' || e === null || !('id' in e) || !('until' in e)) return []
        const { id, until } = e
        return isCreatorId(id) && typeof until === 'string' && Date.parse(until) > now ? [{ id, until }] : []
      })
    : []

/** The creator whose in-game @ is `handle`, or null. */
export const creatorOfAccount = (handle: string | null | undefined): CreatorId | null =>
  (handle && CREATOR_IDS.find((id) => creatorOf(id).account === handle)) || null

/** Where to send a viewer: the live page while live, else the channel. */
export const creatorUrl = (id: CreatorId, live: boolean) => {
  const c = creatorOf(id)
  return live ? PLATFORMS[c.platform].live(c.handle) : PLATFORMS[c.platform].profile(c.handle)
}

/**
 * Who the lobby features: the first of `live` (as the API lists them, newest
 * stream first), else one creator a day in turn. `day` is any whole number
 * that goes up by one a day (days since the epoch).
 */
export const featuredCreator = (day: number, live: readonly CreatorId[]): CreatorId =>
  live[0] ?? CREATOR_IDS[((day % CREATOR_IDS.length) + CREATOR_IDS.length) % CREATOR_IDS.length]!

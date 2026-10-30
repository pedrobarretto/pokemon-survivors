import type { Locale } from '../i18n'

/**
 * Content creators who make videos or stream Pokémon Survivors, and their
 * videos: the site's Criadores page (`site/pages/creators.ts`) lists them.
 * Plain data and pure rules, no game imports (`scripts/creators.mjs` reads it too).
 *
 * A new creator is a row in `CREATORS`. A new video is a line in
 * `CREATOR_VIDEOS` with its URL; then `npm run creators` fetches its title,
 * date and thumbnail into `creatorVideos.generated.ts` and `public/creators/`
 * (the build never goes online). The creator's reward, the Criador(a) de
 * Conteúdo title and the creator frame, goes from the admin desk.
 */

/** Where creators post: the name players know. A new one needs `videoOf` to read its URLs. */
export const PLATFORMS = {
  youtube: { name: 'YouTube' },
  tiktok: { name: 'TikTok' },
} as const satisfies Record<string, { name: string }>

export type PlatformId = keyof typeof PLATFORMS

export const PLATFORM_IDS = Object.keys(PLATFORMS) as PlatformId[]

export type Creator = {
  /** How they call themselves. */
  name: string
  /** The language they speak in their videos. */
  lang: Locale
  /** The Pokémon beside their name: a national dex number with a portrait in the game, and its English name. */
  partner: { dex: number; name: string }
  /** Their channels, as full URLs. */
  links: Partial<Record<PlatformId, string>>
}

/** Every creator, in the order they joined. */
export const CREATORS = {
  birdseyegames: {
    name: 'BirdseyeGaming',
    lang: 'en',
    partner: { dex: 18, name: 'Pidgeot' },
    links: { tiktok: 'https://www.tiktok.com/@birdseyegames' },
  },
  weplayZ: {
    name: 'WePlay Z',
    lang: 'pt',
    partner: { dex: 25, name: 'Pikachu' },
    links: { youtube: 'https://www.youtube.com/@WePlay-Z' },
  },
  sonTitanGames: {
    name: 'Son Titan Games',
    lang: 'es',
    partner: { dex: 248, name: 'Tyranitar' },
    links: { youtube: 'https://www.youtube.com/@SonTitanGames' },
  },
} as const satisfies Record<string, Creator>

export type CreatorId = keyof typeof CREATORS

export const CREATOR_IDS = Object.keys(CREATORS) as CreatorId[]

/** A creator's row, typed as the wider `Creator` (so `links` reads as every platform, maybe missing). */
export const creatorOf = (id: CreatorId): Creator => CREATORS[id]

/** Videos about the game, by URL (any form a share button gives). The page sorts them newest first. */
export const CREATOR_VIDEOS: readonly { creator: CreatorId; url: string }[] = [
  { creator: 'weplayZ', url: 'https://www.youtube.com/watch?v=hQpzB5sl2xA' },
  { creator: 'sonTitanGames', url: 'https://www.youtube.com/watch?v=0hMWUF4FyCo' },
]

/** A video as a platform knows it. `vertical` for Shorts and TikToks, which play 9:16. */
export type VideoRef = { platform: PlatformId; id: string; vertical: boolean }

const YOUTUBE_ID = /^[\w-]{11}$/

/**
 * The video a URL points at, or null for one we can't read: YouTube's
 * `watch?v=`, `youtu.be/`, `/shorts/`, `/live/` and `/embed/`, and TikTok's
 * `@user/video/<id>`.
 */
export const videoOf = (url: string): VideoRef | null => {
  const u = URL.parse(url)
  if (!u) return null
  const host = u.hostname.replace(/^(www|m)\./, '')
  const [first, second] = u.pathname.split('/').filter(Boolean)
  if (host === 'youtu.be' && first && YOUTUBE_ID.test(first)) return { platform: 'youtube', id: first, vertical: false }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id = first === 'watch' ? u.searchParams.get('v') : first === 'shorts' || first === 'live' || first === 'embed' ? second : null
    return id && YOUTUBE_ID.test(id) ? { platform: 'youtube', id, vertical: first === 'shorts' } : null
  }
  if (host === 'tiktok.com' && first?.startsWith('@') && second === 'video') {
    const id = u.pathname.split('/').filter(Boolean)[2]
    return id && /^\d+$/.test(id) ? { platform: 'tiktok', id, vertical: true } : null
  }
  return null
}

/** Where a video plays inside our page, started at once (the page loads it only on a tap). */
export const embedUrl = ({ platform, id }: VideoRef) =>
  platform === 'youtube' ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1` : `https://www.tiktok.com/player/v1/${id}?autoplay=1`

/** What `npm run creators` keeps of a video: its title, when it went up (ISO, if the platform says), its length (ISO 8601) and thumbnail's path under `public/`. */
export type VideoMeta = { title: string; date: string | null; duration: string | null; thumb: string }

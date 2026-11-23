/**
 * The verified content creator's tag (STREAMER): a player with a @handle asks
 * for it from the Trainer Card with their channel links (`POST /creator`),
 * staff approve or reject it from the admin's desk (`server/src/creators.ts`),
 * and an approved account shows the tag and its links on its profile, its
 * Trainer Card and over its trainer in the Poké Realm (`RealmIdentity.creator`,
 * the API's word, never the client's). Approving also sends the Criador(a) de
 * Conteúdo title and the creator frame through the gift path.
 *
 * Links are untrusted input: only https URLs on `CREATOR_PLATFORMS`' hosts,
 * normalized (`normalizeCreatorUrl`), and only approved ones ever reach other
 * players. Pure and import-free: the realm relay bundles it
 * (`relay/node/Dockerfile`).
 */

/** Where a creator streams or posts, and the hosts its links may name (a `www.` or `m.` before them is dropped). */
export const CREATOR_PLATFORMS = {
  twitch: { name: 'Twitch', hosts: ['twitch.tv'] },
  youtube: { name: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
  kick: { name: 'Kick', hosts: ['kick.com'] },
  tiktok: { name: 'TikTok', hosts: ['tiktok.com'] },
} as const satisfies Record<string, { name: string; hosts: readonly string[] }>

export type CreatorPlatform = keyof typeof CREATOR_PLATFORMS

export const CREATOR_PLATFORM_IDS = Object.keys(CREATOR_PLATFORMS) as CreatorPlatform[]

/** A channel link, normalized: `https://<host><path>`, no query, no fragment. */
export type CreatorLink = { platform: CreatorPlatform; url: string }

export const CREATOR = {
  /** Links a request carries at most. */
  links: 3,
  /** The longest link kept, normalized (a raw one may be a little longer before it's trimmed). */
  urlMax: 160,
} as const

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** A path's characters: what a channel's URL needs, nothing that could break out of an attribute or a Discord line. */
const PATH = /^\/[A-Za-z0-9_\-.~@%/]+$/

/** The platform a host belongs to, `www.` and `m.` dropped, or null when it's on none. */
const platformOf = (host: string): { platform: CreatorPlatform; host: string } | null => {
  const bare = host.replace(/^(www|m)\./, '')
  const platform = CREATOR_PLATFORM_IDS.find((id) => CREATOR_PLATFORMS[id].hosts.some((h) => h === bare))
  return platform ? { platform, host: bare } : null
}

/**
 * A channel link as typed (`twitch.tv/name`, `https://www.youtube.com/@name/`),
 * normalized, or null: only https (a link without a scheme gets it), no
 * credentials or port, a host on `CREATOR_PLATFORMS`, and a path past the
 * site's front page. The query and the fragment are dropped, so is a trailing `/`.
 */
export const normalizeCreatorUrl = (raw: string): CreatorLink | null => {
  const text = raw.trim()
  if (text.length === 0 || text.length > CREATOR.urlMax + 40) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text.replace(/^\/+/, '')}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.port !== '') return null
  const found = platformOf(url.hostname.toLowerCase())
  if (!found) return null
  const path = url.pathname.replace(/\/+$/, '')
  if (!PATH.test(path)) return null
  const out = `https://${found.host}${path}`
  return out.length <= CREATOR.urlMax ? { platform: found.platform, url: out } : null
}

/** Why a request's links don't go: none, too many, or one (`index`, as sent) that isn't a channel link on a known platform. */
export type CreatorLinksError = { error: 'empty' } | { error: 'many' } | { error: 'invalid'; index: number }

/**
 * The links a player sent (`POST /creator`'s `links`, strings as typed),
 * normalized, blanks skipped and repeats merged: at least one, at most
 * `CREATOR.links`, every one valid.
 */
export const parseCreatorRequest = (v: unknown): { ok: true; links: CreatorLink[] } | ({ ok: false } & CreatorLinksError) => {
  if (!Array.isArray(v) || v.length > CREATOR.links * 2) return { ok: false, error: 'many' }
  const links: CreatorLink[] = []
  for (const [index, raw] of v.entries()) {
    if (typeof raw !== 'string') return { ok: false, error: 'invalid', index }
    if (raw.trim() === '') continue
    const link = normalizeCreatorUrl(raw)
    if (!link) return { ok: false, error: 'invalid', index }
    if (!links.some((l) => l.url === link.url)) links.push(link)
  }
  if (links.length === 0) return { ok: false, error: 'empty' }
  return links.length > CREATOR.links ? { ok: false, error: 'many' } : { ok: true, links }
}

/**
 * Links as stored or sent along (`{ platform, url }[]`), each normalized
 * again and kept only when it comes out the same: what the relay, the game
 * and the API read from each other or from the database. Null when none is left.
 */
export const parseCreatorLinks = (v: unknown): CreatorLink[] | null => {
  if (!Array.isArray(v)) return null
  const links = v
    .slice(0, CREATOR.links)
    .flatMap((l: unknown) => {
      if (!isRecord(l) || typeof l.url !== 'string') return []
      const link = normalizeCreatorUrl(l.url)
      return link && link.url === l.url ? [link] : []
    })
  return links.length > 0 ? links : null
}

/** Where a request stands: waiting for staff, approved (the tag shows), rejected, or approved once and taken back. */
export type CreatorStatus = 'pending' | 'approved' | 'rejected' | 'revoked'

export const CREATOR_STATUSES = ['pending', 'approved', 'rejected', 'revoked'] as const satisfies readonly CreatorStatus[]

/** What staff do with a request: approve or reject a pending one, revoke an approved one. */
export type CreatorReview = 'approve' | 'reject' | 'revoke'

export const CREATOR_REVIEWS = ['approve', 'reject', 'revoke'] as const satisfies readonly CreatorReview[]

/** Whether a player may send a request now: never asked, or the last one was rejected or revoked. One waits at a time. */
export const mayRequest = (status: CreatorStatus | null) => status === null || status === 'rejected' || status === 'revoked'

/** Where `action` takes a request in `status`, or null when it can't (approving one already approved, revoking one pending…). */
export const reviewed = (status: CreatorStatus | null, action: CreatorReview): CreatorStatus | null => {
  if (action === 'revoke') return status === 'approved' ? 'revoked' : null
  if (status !== 'pending') return null
  return action === 'approve' ? 'approved' : 'rejected'
}

/** The player's own request (`GET /creator`): its status, the links it carries and when it was sent and reviewed. */
export type CreatorRequest = { status: CreatorStatus; links: CreatorLink[]; at: string; reviewedAt: string | null }

const isStatus = (v: unknown): v is CreatorStatus => CREATOR_STATUSES.some((s) => s === v)

const text = (v: unknown) => (typeof v === 'string' ? v : null)

/** `GET /creator`'s `request`, or null (none, or not one this build reads). */
export const parseCreatorStatus = (v: unknown): CreatorRequest | null => {
  if (!isRecord(v)) return null
  const links = parseCreatorLinks(v.links)
  if (!isStatus(v.status) || typeof v.at !== 'string' || !links) return null
  return { status: v.status, links, at: v.at, reviewedAt: text(v.reviewedAt) }
}

/** A request on the admin's desk (`GET /admin/creators`): who asked, its links and status, when, and who reviewed it. */
export type CreatorDeskEntry = CreatorRequest & { userId: string; handle: string | null; name: string | null; reviewedBy: string | null }

/** `GET /admin/creators`: the requests waiting, oldest first, and the approved creators (to revoke), newest first. */
export type CreatorDesk = { pending: CreatorDeskEntry[]; approved: CreatorDeskEntry[] }

const parseEntry = (v: unknown): CreatorDeskEntry | null => {
  const request = parseCreatorStatus(v)
  if (!request || !isRecord(v) || typeof v.userId !== 'string') return null
  return { ...request, userId: v.userId, handle: text(v.handle), name: text(v.name), reviewedBy: text(v.reviewedBy) }
}

const entries = (v: unknown) => (Array.isArray(v) ? v.map(parseEntry).filter((e): e is CreatorDeskEntry => e !== null) : [])

/** `GET /admin/creators`'s answer, or null. */
export const parseCreatorDesk = (v: unknown): CreatorDesk | null => (isRecord(v) ? { pending: entries(v.pending), approved: entries(v.approved) } : null)

import { TITLE_IDS, type TitleId } from '../data/achievements'
import { isSpecialCompanion, SPECIAL_COMPANION_IDS, SPECIAL_COMPANIONS, type SpecialCompanionId } from '../data/companions'
import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { isLegend } from '../data/legends'
import { isCaptured } from './capture'
import { isUnlocked } from './eggs'
import { ownsStyle } from './style'
import { isPollOptionOf, PATREON_TIERS, POLLS, pollOptionIds, SUPPORTER, type PollKind, type PollOption } from '../data/supporters'
import type { GiftContent } from './gifts'
import type { Save } from './meta'
import { isRecord, wholeNumber } from './parse'
import { isPlayable } from './ranking'
import { ownsShiny } from './shinyPicks'
import * as dm from '../engine/dmath'

/**
 * Apoiadores. Three tiers: Supporter, Gold and Diamond. A one-time donation
 * linked to an account (by its handle, or a code redeemed in the game) makes
 * it a Supporter for good; Gold and Diamond come only from the Patreon pledge
 * a member keeps active (US$ 10 and 20 a month), so they end with it. Whoever
 * supported before Patreon is an OG: the tier they had then (`og`, Gold at
 * R$ 50 in all) stays theirs forever. The account's tier is the highest of
 * those (`effectiveTier`); the API counts it and sends each tier's thank-you
 * once as Mystery Gifts. Everything here is cosmetic, so it never touches a
 * run. Pure; shared with the API.
 */

export const SUPPORTER_TIERS = ['supporter', 'gold', 'diamond'] as const

export type SupporterTier = (typeof SUPPORTER_TIERS)[number]

export const isSupporterTier = (v: unknown): v is SupporterTier => SUPPORTER_TIERS.some((t) => t === v)

/** A tier from the database or the API, or null. */
export const parseTier = (v: unknown): SupporterTier | null => (isSupporterTier(v) ? v : null)

/** 0 for no tier, then 1, 2, 3 up the list. */
export const tierRank = (tier: SupporterTier | null) => (tier === null ? 0 : SUPPORTER_TIERS.indexOf(tier) + 1)

/** Whether `tier` is `min` or above. */
export const atLeast = (tier: SupporterTier | null, min: SupporterTier) => tierRank(tier) >= tierRank(min)

export const highestTier = (a: SupporterTier | null, b: SupporterTier | null) => (tierRank(a) >= tierRank(b) ? a : b)

/** Points of a donation of `cents` in `currency` (ISO code, any case): one per centavo, five per US cent. */
export const donationPoints = (cents: number, currency: string) => {
  const rate = currency.toLowerCase() === 'brl' ? SUPPORTER.perCent.brl : SUPPORTER.perCent.usd
  return Math.max(0, dm.round(cents)) * rate
}

/** The tier an OG supporter keeps, from what they had donated when Patreon tiers came (the migration's rule). */
export const ogTier = (points: number): SupporterTier | null => (points >= SUPPORTER.gold ? 'gold' : points > 0 ? 'supporter' : null)

/** The tier of a Patreon pledge of `cents` a month (`PATREON_TIERS`), or null under the lowest. */
export const pledgeTier = (cents: number): SupporterTier | null => SUPPORTER_TIERS.findLast((tier) => cents >= PATREON_TIERS[tier]) ?? null

/**
 * An account's support, as the API keeps it: one-time `points`, the `og`
 * tier (null for whoever came after Patreon), the active Patreon tier and the
 * highest one Patreon ever gave it (`patreonBest`).
 */
export type Standing = { points: number; og: SupporterTier | null; patreon: SupporterTier | null; patreonBest: SupporterTier | null }

export const NO_STANDING: Standing = { points: 0, og: null, patreon: null, patreonBest: null }

/**
 * The account's tier: the highest of its OG tier (or Supporter for any
 * one-time donation) and its active Patreon tier. The badge, the Discord
 * role, the companion and the polls follow it.
 */
export const effectiveTier = (s: Standing) => highestTier(s.og ?? (s.points > 0 ? 'supporter' : null), s.patreon)

/**
 * The tier the account stands at on the Hall da Fama, or null off it: its
 * tier while it has one, and Gold for good once Patreon made it Gold or
 * Diamond (a former Diamond stays among the Gold, without the diamond).
 */
export const hallTier = (s: Standing) => highestTier(effectiveTier(s), atLeast(s.patreonBest, 'gold') ? 'gold' : null)

/**
 * What each tier sends once: the title, the frame and a shiny of one's
 * choice for a Supporter; the background and the PC wallpaper at Gold.
 * Diamond's perks (badge, legendary companion, its poll) follow the tier itself.
 */
export const TIER_GIFTS: Readonly<Record<SupporterTier, readonly GiftContent[]>> = {
  supporter: [{ kind: 'title', title: 'supporter' }, { kind: 'style', style: { slot: 'frame', id: 'supporter' } }, { kind: 'shinyPick' }],
  gold: [{ kind: 'style', style: { slot: 'background', id: 'supporter' } }, { kind: 'style', style: { slot: 'wallpaper', id: 'supporter' } }],
  diamond: [],
}

/**
 * The OG Supporters' own thank-you: their title, sent once to every account
 * with an OG tier under `key` (the API's boot backfill, `ogGifts`), so it
 * never lands twice.
 */
export const OG_GIFT = { content: { kind: 'title', title: 'ogSupporter' }, key: 'og:title' } as const satisfies { content: GiftContent; key: string }

/**
 * The badges a player wears by their name (boards, profiles): their tier's
 * heart and, for an OG, the OG plate beside it. None while they hide them
 * (`shown` false, `users.supporter_public`).
 */
export const badgesOf = (s: Standing, shown: boolean): { supporter: SupporterTier | null; og: boolean } => {
  const supporter = shown ? effectiveTier(s) : null
  return { supporter, og: supporter !== null && s.og !== null }
}

/** Tiers going from `before` to `after` reaches, lowest first (a new Gold patron reaches Supporter and Gold). */
export const tiersReached = (before: SupporterTier | null, after: SupporterTier | null): SupporterTier[] =>
  SUPPORTER_TIERS.filter((tier) => tierRank(tier) > tierRank(before) && tierRank(tier) <= tierRank(after))

/** Whether the save got the supporter's thank-you (its title). */
export const isSupporter = (save: Save) => save.titles.includes('supporter')

/** Whether the save got the Gold tier's thank-you too (its background), without asking the API. */
export const isGoldSupporter = (save: Save) => isSupporter(save) && ownsStyle(save.style, 'background', 'supporter')

/**
 * The tier this save got the thank-you of, without asking the API: the
 * Supporter title, and the gold background on top of it at Gold. Never
 * Diamond (it has no gift): the device learns that from the API.
 */
export const savedSupporterTier = (save: Save): SupporterTier | null => (!isSupporter(save) ? null : isGoldSupporter(save) ? 'gold' : 'supporter')

/* ---------------- Codes ---------------- */

/** Letters and digits that can't be mistaken for each other (no 0/O, 1/I/L). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

const CODE_LENGTH = 8

/** A code as the player sees it: `PS-ABCD-EFGH`. */
export const formatCode = (raw: string) => `PS-${raw.slice(0, 4)}-${raw.slice(4, 8)}`

/** A fresh code from `random`'s bytes (the server passes `crypto.getRandomValues`). */
export const newCode = (random: (bytes: Uint8Array) => Uint8Array) =>
  formatCode([...random(new Uint8Array(CODE_LENGTH))].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(''))

/** A typed code, normalized (`ps abcd efgh` → `PS-ABCD-EFGH`), or null when it can't be one. */
export const parseCode = (raw: unknown) => {
  if (typeof raw !== 'string') return null
  const body = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^PS/, '')
  return body.length === CODE_LENGTH && [...body].every((c) => CODE_ALPHABET.includes(c)) ? formatCode(body) : null
}

/* ---------------- Companion ---------------- */

/** A companion's species: any playable family (legends included), or one of the gift-only ones (`SPECIAL_COMPANIONS`). */
export type CompanionId = PlayableId | SpecialCompanionId

/** A Pokémon that walks after the player in runs, only drawn (it never touches the simulation). */
export type Companion = { id: CompanionId; shiny: boolean }

/**
 * Whether an account of `tier` may take `id` along shiny: a playable family
 * (or a captured legend) the save owns shiny, or a gift-only one shiny for
 * its tier (`SPECIAL_COMPANIONS`, Gold and up).
 */
export const walksShiny = (save: Save, id: CompanionId, tier: SupporterTier | null) => {
  if (!isSpecialCompanion(id)) return ownsShiny(save, id)
  const def: { shiny?: 'gold' } = SPECIAL_COMPANIONS[id]
  return def.shiny === 'gold' && atLeast(tier, 'gold')
}

/**
 * Pokémon an account of `tier` may take along (none without a tier): every
 * starter and each family hatched, the gift-only ones it got
 * (`save.companions`) and, for Diamond, each legend the save captured; shiny
 * only when it may (`walksShiny`). `tier` is the API's word (`knownTier` on
 * the device): a companion is only drawn, so it never needs more trust.
 */
export const canWalkWith = (save: Save, c: Companion, tier: SupporterTier | null) => {
  if (tier === null) return false
  const owned = isSpecialCompanion(c.id)
    ? save.companions.includes(c.id)
    : isLegend(c.id)
      ? tier === 'diamond' && isCaptured(save.legends, c.id)
      : isUnlocked(save.hatched, c.id)
  return owned && (!c.shiny || walksShiny(save, c.id, tier))
}

/** The name and dex a companion walks as (a playable family's first stage, or the gift-only one's), and the sparkles it leaves. */
export const companionForm = (id: CompanionId): { name: string; dex: number; sparkles?: 'candy' } => (isSpecialCompanion(id) ? SPECIAL_COMPANIONS[id] : PLAYABLE[id].line[0])

/** The save's gift-only companions: known ids, once each. */
export const parseCompanions = (v: unknown): SpecialCompanionId[] => (Array.isArray(v) ? SPECIAL_COMPANION_IDS.filter((id) => v.includes(id)) : [])

/** Two saves' gift-only companions: a union. */
export const mergeCompanions = (a: readonly SpecialCompanionId[], b: readonly SpecialCompanionId[]): SpecialCompanionId[] => SPECIAL_COMPANION_IDS.filter((id) => a.includes(id) || b.includes(id))

/** The save's `companion`, or null. */
export const parseCompanion = (v: unknown): Companion | null =>
  isRecord(v) && (isPlayable(v.id) || isSpecialCompanion(v.id)) ? { id: v.id, shiny: v.shiny === true } : null

/* ---------------- API shapes ---------------- */

/** `GET /donations/:ref`, for the thank-you page: paid yet, the account it went to, or the code to redeem (null once redeemed). */
export type DonationStatus = { paid: boolean; handle: string | null; code: string | null; redeemed: boolean }

/**
 * `GET /me/supporter`: the player's tier (`effectiveTier`, null for none),
 * since when, whether they show it, whether they're an OG, their vote in each
 * poll, and whether they linked a Patreon (null when the API has no Patreon,
 * or is older than it).
 */
export type SupporterStatus = {
  tier: SupporterTier | null
  since: string | null
  public: boolean
  og: boolean
  vote: PollOption<'supporters'> | null
  diamondVote: PollOption<'diamond'> | null
  patreon: boolean | null
}

/**
 * One name on the wall (`GET /supporters`): their tier on the Hall
 * (`hallTier`), since their first support, whether they're an OG, with their
 * equipped title and the Pokémon they stand with on the Hall da Fama
 * (`hallPokemon`). An API from before the Hall sends neither: both are null then.
 */
export type WallEntry = { handle: string; name: string; tier: SupporterTier; since: string; og: boolean; title: TitleId | null; pokemon: Companion | null }

/** Supporters per tier who chose to stay off the wall: only counted, never named. */
export type HiddenSupporters = Record<SupporterTier, number>

/** `GET /supporters`: the wall and how many supporters stay off it. */
export type Wall = { entries: WallEntry[]; hidden: HiddenSupporters }

/** `GET /poll`, `GET /poll/diamond`: a poll and its votes per option. */
export type Poll<K extends PollKind = 'supporters'> = { id: string; votes: Record<PollOption<K>, number> }

/** Whether `s` may vote in the `kind` poll: any supporter in the supporters', only Diamond in Diamond's. Anyone sees both. */
export const mayVote = (s: SupporterStatus | null, kind: PollKind) => (kind === 'diamond' ? s?.tier === 'diamond' : Boolean(s?.tier))

/** The player's vote in the `kind` poll, as their standing says (null for none). */
export const voteIn = (s: SupporterStatus | null, kind: PollKind) => (kind === 'diamond' ? s?.diamondVote : s?.vote) ?? null

/** `s` after a vote for `choice` in the `kind` poll, so the device knows it until the API next answers. */
export const withVote = (s: SupporterStatus, kind: PollKind, choice: string): SupporterStatus =>
  kind === 'diamond' ? { ...s, diamondVote: isPollOptionOf('diamond', choice) ? choice : s.diamondVote } : { ...s, vote: isPollOptionOf('supporters', choice) ? choice : s.vote }

/** The poll a supporter may vote in but hasn't yet (the supporters', then Diamond's): the lobby's Hall card calls them to it. */
export const pollToVote = (s: SupporterStatus | null): PollKind | null =>
  (['supporters', 'diamond'] as const).find((kind) => mayVote(s, kind) && voteIn(s, kind) === null) ?? null

const isoOrNull = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null)

/** The player's standing from the API, or null when the answer isn't one. */
export const parseSupporterStatus = (v: unknown): SupporterStatus | null =>
  isRecord(v)
    ? {
        tier: parseTier(v.tier),
        since: isoOrNull(v.since),
        public: v.public !== false,
        og: v.og === true,
        vote: isPollOptionOf('supporters', v.vote) ? v.vote : null,
        diamondVote: isPollOptionOf('diamond', v.diamondVote) ? v.diamondVote : null,
        patreon: typeof v.patreon === 'boolean' ? v.patreon : null,
      }
    : null

/** The wall from the API: its valid entries. */
export const parseWall = (v: unknown): WallEntry[] =>
  Array.isArray(v)
    ? v.flatMap((e: unknown) => {
        if (!isRecord(e) || typeof e.handle !== 'string' || typeof e.name !== 'string' || !isSupporterTier(e.tier)) return []
        const since = isoOrNull(e.since)
        const title = TITLE_IDS.find((id) => id === e.title) ?? null
        return since ? [{ handle: e.handle, name: e.name, tier: e.tier, since, og: e.og === true, title, pokemon: parseCompanion(e.pokemon) }] : []
      })
    : []

/** The hidden supporters' counts from the API. An API from before them sends none: zero then. */
export const parseHidden = (v: unknown): HiddenSupporters => {
  const counts = isRecord(v) ? v : {}
  return { supporter: wholeNumber(counts.supporter), gold: wholeNumber(counts.gold), diamond: wholeNumber(counts.diamond) }
}

/** Every supporter, on the wall or off it. */
export const supporterCount = (wall: Wall) => wall.entries.length + SUPPORTER_TIERS.reduce((n, tier) => n + wall.hidden[tier], 0)

/**
 * The Hall da Fama from the wall: the Lendas (Diamond first, then Gold) and
 * the other supporters, each newest first (a new name shows up front); and
 * the OGs, the game's first supporters, in the order they came.
 */
export const hallOf = (wall: readonly WallEntry[]) => {
  const newest = [...wall].sort((a, b) => b.since.localeCompare(a.since) || a.handle.localeCompare(b.handle))
  return {
    legends: [...newest.filter((e) => e.tier === 'diamond'), ...newest.filter((e) => e.tier === 'gold')],
    supporters: newest.filter((e) => e.tier === 'supporter'),
    og: newest.filter((e) => e.og).reverse(),
  }
}

/** The `kind` poll from the API, or null when it isn't the current one. */
export const parsePoll = <K extends PollKind>(v: unknown, kind: K): Poll<K> | null => {
  const poll = POLLS[kind]
  if (!isRecord(v) || v.id !== poll.id || !isRecord(v.votes)) return null
  const votes = v.votes
  return { id: poll.id, votes: Object.fromEntries(pollOptionIds(kind).map((id) => [id, wholeNumber(votes[id])])) as Record<PollOption<K>, number> }
}

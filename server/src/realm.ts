import type { Fragment, TransactionSql } from 'postgres'
import { FURNITURE, isFurnitureId, type FurnitureCounts, type FurnitureId } from '../../src/data/furniture'
import { checkLayout, EMPTY_BASE, isBaseVisibility, parseLayout, type BaseVisibility, type LayoutError } from '../../src/data/secretBases'
import { brasiliaDay, type DayKey } from '../../src/game/day'
import { donateFrom } from '../../src/game/festival'
import type { HatchlingId } from '../../src/data/hatchlings'
import { newFeatFamily } from '../../src/game/seasonOneUnlocks'
import { sendGift } from './gifts'
import { parseSaveData, type Save } from '../../src/game/meta'
import { isRecord } from '../../src/game/parse'
import { parseHandle } from '../../src/game/ranking'
import { REPORT } from '../../src/game/reports'
import { playsShiny } from '../../src/game/shinyPicks'
import { FRIENDS, type Activity } from '../../src/game/friends'
import { isCityId, REALM, REALM_CITIES, type CityId, type RealmHome, type RealmIdentity, type RoomKey } from '../../src/net/realm'
import {
  REPORT_REASONS,
  type BaseCard,
  type BaseSave,
  type BaseView,
  type FurnitureBuy,
  type GameClaim,
  type RealmBook,
  type RealmFriends,
  type RealmReport,
  type RealmSettings,
  type ReportReason,
} from '../../src/net/realmApi'
import { cityCounts, friendsFrom, parseReportRoom, walking, type HeldPresence } from '../../src/realm/friends'
import { capped, claimable, isMinigameId, MINIGAME_DAILY, MINIGAMES, trophiesEarned, type GameOutcome, type GameStats, type MinigameId } from '../../src/data/minigames'
import type { DeedsAnswer, IdentityResponse, PresenceReport, VisitResponse } from '../../src/net/realmRelay'
import { FURNISHED, isDeed, type Deed } from '../../src/data/realmStamps'
import type { RealmBan, RealmDesk, RealmModeration, RealmReportGroup } from '../../src/realm/moderation'
import { addFurniture, trophyFurniture } from '../../src/realm/trophies'
import { boardKeeps, boardPoints, GAME_BOARD_PERIODS, GAME_BOARD_SIZE, periodStart, type GameBoard, type GameBoardPeriod } from '../../src/realm/boards'
import type { Sql } from './db'
import { bareName, idsByName, NAMES, restClient } from './discord'
import { moveGems, vouchedLooks } from './gems'
import { rateLimiter } from './rateLimit'
import { applyDeeds, bookOf, claimPay, collectErrand, groupDeeds, hasCompany, NOTHING, type DeedEntry, type Earned, type ErrandOutcome } from './realmDeeds'
import { tierOfRow, type StandingRow } from './supporters'

/**
 * The Poké Realm's API side (`net/realmApi.ts` and `net/realmRelay.ts` list
 * the routes): who a trainer is for the relay (`identity`: handle, partner,
 * vouched look, supporter badge; no handle or a realm ban keeps them out),
 * who may come into a secret base (`visit`, counting each visitor once a
 * Brasília day), the cities' presence (kept in memory, the newest report per
 * relay), the bases (`bases`), furniture bought at Bibarel's carpentry with
 * gems (the gem ledger) or ₽ (out of the stored save, like a Festival
 * donation) plus what the save earned (`trophyFurniture`), the mini games'
 * claims (₽ under the daily caps, stats, trophies, the boards), the Estampas
 * and Recados (`realmDeeds.ts`), and the realm's own reports and bans. Nothing
 * here reaches `src/game`'s rules.
 */

type Q = Sql | TransactionSql

/** Brakes per account, per instance: base saves, likes, buys and mini game claims a minute (a script's, never a player's). */
/** How long a guest's read of a mini game board is kept (`board`). */
const BOARD_CACHE_MS = 15_000

const LIMITS = {
  save: { n: 20, ms: 60_000 },
  like: { n: 60, ms: 60_000 },
  buy: { n: 30, ms: 60_000 },
  game: { n: 12, ms: 60_000 },
  errand: { n: 30, ms: 60_000 },
  // The friends panel asks every `FRIENDS_POLL_MS` while open; the picker and the lobby's tile once each.
  friends: { n: 12, ms: 60_000 },
  settings: { n: 10, ms: 60_000 },
} as const

/** Bases a board answers at most. */
export const BASE_LIST = 30

/** Open realm reports the admin's tab reads at most, and bans it lists. */
const DESK_LIST = { reports: 500, bans: 200 } as const

/** Identities one lookup answers at most (a city's worth arriving together). */
export const IDENTITY_BATCH = 64

/** Accounts whose API-seen stamps and errands wait at most for the relay's next ask: without a relay asking they'd pile up. */
const EARNED_HELD = 2000

/* ---------------- Pure rules ---------------- */

const HOMES: ReadonlySet<string> = new Set(Object.values(REALM_CITIES).map((c) => c.home))

const isRealmHome = (v: unknown): v is RealmHome => typeof v === 'string' && HOMES.has(v)

/** A handle on the wire: what `parseHandle` takes, lower case. */
const wireHandle = (v: unknown) => (typeof v === 'string' && v.length <= 32 ? parseHandle(v) : null)

/**
 * A relay's presence report, or null when it's malformed: a known home, and
 * known cities only from that home, each with at most `REALM.cityCap` handles (a
 * little slack for one landing as another leaves). Each handle's room comes
 * along when the relay sends them, one per handle (`rooms`); a city whose
 * rooms don't line up with its handles keeps none.
 */
export const parsePresenceReport = (v: unknown): PresenceReport | null => {
  if (!isRecord(v) || !isRealmHome(v.home) || typeof v.at !== 'number' || !Number.isFinite(v.at) || !isRecord(v.cities)) return null
  const home = v.home
  const sentRooms = isRecord(v.rooms) ? v.rooms : {}
  const cities: Partial<Record<CityId, string[]>> = {}
  const rooms: Partial<Record<CityId, RoomKey[]>> = {}
  for (const [city, list] of Object.entries(v.cities)) {
    // A city this API doesn't list is skipped, not refused: a relay deployed before it may still hold trainers in one that was retired.
    if (!isCityId(city)) continue
    if (REALM_CITIES[city].home !== home || !Array.isArray(list) || list.length > REALM.cityCap * 2) return null
    const where = sentRooms[city]
    const paired = Array.isArray(where) && where.length === list.length ? where : null
    const seen = new Map<string, RoomKey | null>()
    list.forEach((h, i) => {
      const handle = wireHandle(h)
      if (handle && !seen.has(handle)) seen.set(handle, paired ? parseReportRoom(paired[i]) : null)
    })
    cities[city] = [...seen.keys()]
    const known = [...seen.values()]
    if (paired && known.every((r) => r !== null)) rooms[city] = known.filter((r) => r !== null)
  }
  return Object.keys(rooms).length > 0 ? { home, at: v.at, cities, rooms } : { home, at: v.at, cities }
}

/** `PUT /realm/settings`'s body, or null. */
export const parseRealmSettings = (v: unknown): RealmSettings | null => (isRecord(v) && typeof v.showWhere === 'boolean' ? { showWhere: v.showWhere } : null)

/** `POST /realm/furniture/buy`'s body, or null. */
export const parseFurnitureBuy = (v: unknown): FurnitureBuy | null => {
  if (!isRecord(v) || !isFurnitureId(v.id)) return null
  if (v.pay === 'gems') return { id: v.id, pay: 'gems' }
  return v.pay === 'coins' && typeof v.base === 'number' && Number.isSafeInteger(v.base) ? { id: v.id, pay: 'coins', base: v.base } : null
}

/** What piece `id` costs paid with `pay` on Brasília `day`: null when it isn't sold that way (never sold, the other currency, or not out yet, `from`). */
export const furniturePrice = (id: FurnitureId, pay: FurnitureBuy['pay'], day: DayKey): number | null => {
  const f = FURNITURE[id]
  if (!f.price || (f.from !== undefined && day < f.from)) return null
  if (pay === 'gems') return 'gems' in f.price ? f.price.gems : null
  return 'coins' in f.price ? f.price.coins : null
}

/** A game the API takes as lasting at most this long (ms): a claim past it is made up. */
const GAME_MAX_MS = 3_600_000

/** Feats a claim names at most, and how long each may be. */
const CLAIM_FEATS = { n: 16, len: 32 } as const

/** A claimed outcome: a solo score (a whole number of points), or a table result against a person or the bot. */
const parseOutcome = (v: unknown): GameOutcome | null => {
  if (!isRecord(v)) return null
  if ('score' in v) return typeof v.score === 'number' && Number.isSafeInteger(v.score) && v.score >= 0 ? { score: v.score } : null
  const result = (['win', 'draw', 'loss'] as const).find((r) => r === v.result)
  const vs = (['human', 'bot'] as const).find((w) => w === v.vs)
  return result && vs ? { result, vs } : null
}

/**
 * `POST /realm/game/claim`'s body, or null: a known game that pays through
 * claims (never one the API runs itself, `claimable`, or a claim could make up
 * its deeds), an outcome of either shape, how long it took (ms) and the feats
 * it hit (strings; the ones the game doesn't declare are dropped later,
 * `statsAfter`). Whether the outcome fits the game is `coinsFor`'s call.
 */
export const parseGameClaim = (v: unknown): GameClaim | null => {
  if (!isRecord(v) || !isMinigameId(v.game) || !claimable(v.game) || typeof v.ms !== 'number' || !Number.isFinite(v.ms) || v.ms < 0 || v.ms > GAME_MAX_MS) return null
  const outcome = parseOutcome(v.outcome)
  const feats = v.feats === undefined ? [] : v.feats
  if (!outcome || !Array.isArray(feats) || feats.length > CLAIM_FEATS.n) return null
  const named = feats.filter((f): f is string => typeof f === 'string' && f.length > 0 && f.length <= CLAIM_FEATS.len)
  return named.length === feats.length ? { game: v.game, outcome, ms: Math.round(v.ms), feats: named } : null
}

/**
 * A game's stats after one more finished game: a play, a win when it was
 * one, the best score, and the feats it hit that the game declares (never
 * one it doesn't, so a made-up feat can't open a trophy).
 */
export const statsAfter = (game: MinigameId, was: GameStats, outcome: GameOutcome, feats: readonly string[]): GameStats => {
  const known: readonly string[] = MINIGAMES[game].feats
  return {
    plays: was.plays + 1,
    wins: was.wins + ('result' in outcome && outcome.result === 'win' ? 1 : 0),
    best: Math.max(was.best, 'score' in outcome ? outcome.score : 0),
    feats: [...new Set([...was.feats, ...feats.filter((f) => known.includes(f))])],
  }
}

/** `PUT /realm/base`'s body, or null. The layout's pieces go through `parseLayout`; one that doesn't parse is refused, never dropped quietly. */
export const parseBaseSave = (v: unknown): BaseSave | null => {
  if (!isRecord(v) || !isBaseVisibility(v.visibility) || !isRecord(v.layout) || !Array.isArray(v.layout.items)) return null
  const layout = parseLayout(v.layout)
  return layout.items.length === v.layout.items.length ? { layout, visibility: v.visibility } : null
}

/** `POST /realm/report`'s body, or null. */
export const parseRealmReport = (v: unknown): RealmReport | null => {
  if (!isRecord(v)) return null
  const handle = wireHandle(v.handle)
  const reason = REPORT_REASONS.find((r) => r === v.reason)
  const city = v.city === null || v.city === undefined ? null : isCityId(v.city) ? v.city : undefined
  return handle && reason && city !== undefined ? { handle, reason, city } : null
}

/** An open realm report as the admin's tab reads it, before grouping. */
export type OpenRealmReport = { targetId: string; handle: string | null; reason: ReportReason; city: string | null; at: string; reporter: string | null }

/** The open reports grouped by trainer, most reported first (then the latest), each with its realm ban if any. */
export const groupRealmReports = (rows: readonly OpenRealmReport[], bans: readonly RealmBan[]): RealmReportGroup[] => {
  const groups = new Map<string, RealmReportGroup>()
  for (const r of rows) {
    const g = groups.get(r.targetId) ?? { userId: r.targetId, handle: r.handle, count: 0, reasons: {}, cities: [], latest: r.at, reporters: [], ban: bans.find((b) => b.userId === r.targetId) ?? null }
    g.count++
    g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1
    if (isCityId(r.city) && !g.cities.includes(r.city)) g.cities.push(r.city)
    if (r.reporter && !g.reporters.includes(r.reporter)) g.reporters.push(r.reporter)
    if (r.at > g.latest) g.latest = r.at
    groups.set(r.targetId, g)
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest))
}

/** The staff channel's line for a realm report (English: the community Discord is). */
export const realmReportLine = (r: { target: string; reporter: string | null; reason: ReportReason; city: CityId | null; open: number }) =>
  `🚩 **Poké Realm** report: @${r.target} for **${r.reason}** by ${r.reporter ? `@${r.reporter}` : 'a player without a handle'}${r.city ? ` in ${REALM_CITIES[r.city].name}` : ''} · ${r.open} open on them. The admin desk's Realm tab bans or dismisses.`

/* ---------------- The store ---------------- */

/**
 * The save's fields the realm reads (the partner and its shiny, the
 * captures, and the version `parseSaveData` needs), without the rest of a
 * save that may weigh hundreds of KB.
 */
const slimSave = (q: Q) => q`jsonb_build_object('version', s.data->'version', 'partner', s.data->'partner', 'shinyStarters', s.data->'shinyStarters', 'hatched', s.data->'hatched', 'legends', s.data->'legends')`

/** The partner a save walks as, and whether shiny. */
const partnerOf = (save: Save) => ({ partner: save.partner, shiny: playsShiny(save, save.partner) })

/** A realm ban in force (`until` null or ahead), as a SQL condition on `rb`. */
const banInForce = (q: Q) => q`(rb.until is null or rb.until > now())`

/** Whether `viewer` and the account in column `other` follow each other (mutual friends, `friends.ts`). */
const mutual = (q: Q, viewer: string, other: Fragment) =>
  q`(exists (select 1 from follows x join follows y on y.follower_id = x.followee_id and y.followee_id = x.follower_id where x.follower_id = ${viewer} and x.followee_id = ${other}))`

/** The furniture `userId` owns: what it bought or was given, plus what its save earned. */
const ownedBy = async (q: Q, userId: string, save: Save): Promise<FurnitureCounts> => {
  const rows = await q<{ furniture: string; n: number }[]>`select furniture, sum(count)::int as n from furniture_owned where user_id = ${userId} group by furniture`
  const bought: FurnitureCounts = Object.fromEntries(rows.flatMap((r) => (isFurnitureId(r.furniture) ? [[r.furniture, r.n] as const] : [])))
  return addFurniture(bought, trophyFurniture(save))
}

type OwnerRow = {
  id: string
  handle: string
  save: unknown
  layout: unknown
  visibility: BaseVisibility | null
  visits: number | null
  likes: number | null
  updated_at: Date | null
  closed: boolean
  friend: boolean
  liked: boolean
}

/** The account with `handle`, its base (null fields before it saved one) and how it stands with `viewer`. */
const ownerOf = async (q: Q, handle: string, viewer: string, lock = false): Promise<OwnerRow | null> => {
  const [row] = await q<OwnerRow[]>`
    select u.id, u.handle, ${slimSave(q)} as save, b.layout, b.visibility, b.visits, b.likes, b.updated_at,
      (u.banned_at is not null or exists (select 1 from realm_bans rb where rb.user_id = u.id and ${banInForce(q)})) as closed,
      ${mutual(q, viewer, q`u.id`)} as friend,
      exists (select 1 from base_likes l where l.base_id = u.id and l.user_id = ${viewer}) as liked
    from users u left join saves s on s.user_id = u.id left join bases b on b.user_id = u.id
    where u.handle = ${handle} ${lock ? q`for update of u` : q``}`
  return row ?? null
}

/** Whether `viewer` may come into `o`'s base: its owner always; anyone else only into a saved base, by its visibility (never a banned owner's). */
const mayEnter = (o: OwnerRow, viewer: string): VisitResponse => {
  if (o.id === viewer) return { allowed: true }
  if (o.visibility === null || o.closed) return { allowed: false, why: 'missing' }
  return o.visibility === 'public' || (o.visibility === 'friends' && o.friend) ? { allowed: true } : { allowed: false, why: 'private' }
}

const toView = (o: OwnerRow): BaseView => ({
  handle: o.handle,
  ...partnerOf(parseSaveData(o.save)),
  layout: o.layout === null ? EMPTY_BASE : parseLayout(o.layout),
  visibility: o.visibility ?? 'public',
  visits: o.visits ?? 0,
  likes: o.likes ?? 0,
  liked: o.liked,
  updatedAt: o.updated_at?.getTime() ?? 0,
})

export type RealmMeOutcome = { ok: true; handle: string; furniture: FurnitureCounts; base: BaseView | null } | { ok: false; error: 'profile' }

export type BaseOutcome = { ok: true; base: BaseView } | { ok: false; error: 'private' | 'missing' }

export type SaveOutcome = { ok: true; base: BaseView } | { ok: false; error: 'profile' | 'banned' } | { ok: false; error: 'layout'; layout: LayoutError }

export type LikeOutcome = { ok: true; likes: number } | { ok: false; error: 'private' | 'missing' | 'self' }

/** The book (`GET /realm/book`), or `profile` without a @handle. */
export type BookOutcome = { ok: true; book: RealmBook } | { ok: false; error: 'profile' }

/** A claimed errand, or why not: no @handle, kept out of the realm, or `collectErrand`'s refusals. */
export type ErrandClaimOutcome = ErrandOutcome | { ok: false; error: 'profile' | 'banned' }

export type BuyError = 'profile' | 'gems' | 'funds' | 'nosave' | 'stale'

/** What a mini game claim came to (`GameClaimed`), or why it was refused: no @handle, or kept out of the realm. */
export type ClaimOutcome = { ok: true; coins: number; today: number; trophies: FurnitureId[]; furniture: FurnitureCounts | null; family: HatchlingId | null } | { ok: false; error: 'profile' | 'banned' }

export type FurnitureOutcome =
  | { ok: true; furniture: FurnitureCounts; pay: 'gems'; balance: number }
  | { ok: true; furniture: FurnitureCounts; pay: 'coins'; save: Save; revision: number }
  | { ok: false; error: BuyError }

/** What a realm report came to; `stored` also covers the ones dropped without a word (an unknown handle, one already open). */
export type RealmReported = 'stored' | 'self' | 'limit'

/** Posts a line in the staff's Discord channel. */
export type StaffChannel = { post: (content: string) => Promise<void> }

/**
 * The staff's #mod-chat (`NAMES.staffLog` in `discord.ts`) through the bot,
 * found by name once (a lookup that fails is tried again on the next post).
 * Mentions never ping.
 */
export const discordStaffChannel = (config: { token: string; guildId: string }): StaffChannel => {
  const call = restClient(config.token)
  let found: Promise<string> | null = null
  const find = async () => {
    const id = idsByName(await call('GET', `/guilds/${config.guildId}/channels`)).get(bareName(NAMES.staffLog))
    if (!id) throw new Error(`discord: no #${NAMES.staffLog}`)
    return id
  }
  return {
    post: async (content) => {
      found ??= find().catch((err: unknown) => {
        found = null
        throw err
      })
      await call('POST', `/channels/${await found}/messages`, { content, allowed_mentions: { parse: [] } })
    },
  }
}

export const realmStore = (sql: Sql, deps: { staff?: StaffChannel | null; now?: () => Date } = {}) => {
  const now = deps.now ?? (() => new Date())
  const limits = {
    save: rateLimiter(LIMITS.save.n, LIMITS.save.ms),
    like: rateLimiter(LIMITS.like.n, LIMITS.like.ms),
    buy: rateLimiter(LIMITS.buy.n, LIMITS.buy.ms),
    game: rateLimiter(LIMITS.game.n, LIMITS.game.ms),
    errand: rateLimiter(LIMITS.errand.n, LIMITS.errand.ms),
    friends: rateLimiter(LIMITS.friends.n, LIMITS.friends.ms),
    settings: rateLimiter(LIMITS.settings.n, LIMITS.settings.ms),
  }
  const presence = new Map<RealmHome, HeldPresence>()
  /** The boards as a guest reads them, by game, period and start, kept `BOARD_CACHE_MS` (a signed-in read asks for its own line). */
  const boardCache = new Map<string, { board: GameBoard; until: number }>()

  /** Whether `userId` is kept out of the realm now (a realm ban in force, or banned from the game). */
  const closed = async (q: Q, userId: string) => {
    const [row] = await q<{ closed: boolean }[]>`
      select (u.banned_at is not null or exists (select 1 from realm_bans rb where rb.user_id = u.id and ${banInForce(q)})) as closed from users u where u.id = ${userId}`
    return row?.closed ?? false
  }

  const handleOf = async (q: Q, userId: string) => (await q<{ handle: string | null }[]>`select handle from users where id = ${userId}`)[0]?.handle ?? null

  const slimOf = async (q: Q, userId: string) => parseSaveData((await q<{ save: unknown }[]>`select ${slimSave(q)} as save from saves s where s.user_id = ${userId}`)[0]?.save ?? {})

  /** What the API's own routes earned (a claim, a like, a saved base), waiting for the relay's next ask to reach the trainer's room. */
  const heldEarned = new Map<string, Earned>()

  const holdEarned = (userId: string, earned: Earned) => {
    if ((earned.stamps.length === 0 && earned.errands.length === 0) || (heldEarned.size >= EARNED_HELD && !heldEarned.has(userId))) return
    const was = heldEarned.get(userId) ?? NOTHING
    heldEarned.set(userId, { stamps: [...was.stamps, ...earned.stamps], errands: [...was.errands, ...earned.errands] })
  }

  /**
   * Deeds the API saw itself, once the route's own work is committed, in a
   * transaction of their own: a failure here is logged and costs only the deed,
   * never the claim or the like that caused it.
   */
  const earn = async (userId: string, deeds: ReadonlyMap<Deed, number>, day: DayKey = brasiliaDay(now())) => {
    try {
      holdEarned(userId, await sql.begin((tx) => applyDeeds(tx, userId, deeds, day)))
    } catch (err) {
      console.error(`realm: deeds of ${userId} not applied`, err)
    }
  }

  return {
    /**
     * `POST /realm/identity`: each account that may walk the realm, by user
     * id (a @handle, not banned), with its partner, vouched look and
     * supporter badge (only when it shows it); the banned ones listed apart.
     */
    identity: async (userIds: readonly string[]): Promise<IdentityResponse> => {
      const ids = [...new Set(userIds)]
      const rows = await sql<(StandingRow & { id: string; handle: string | null; closed: boolean; supporter_public: boolean; save: unknown })[]>`
        select u.id, u.handle, u.supporter_points, u.og_tier, u.patreon_tier, u.patreon_best, u.supporter_public, ${slimSave(sql)} as save,
          (u.banned_at is not null or exists (select 1 from realm_bans rb where rb.user_id = u.id and ${banInForce(sql)})) as closed
        from users u left join saves s on s.user_id = u.id
        where u.id = any(${ids}::text[])`
      const open = rows.flatMap((r) => (!r.closed && r.handle !== null ? [{ ...r, handle: r.handle }] : []))
      const openIds = open.map((r) => r.id)
      const [looks, stamps, mutuals] = await Promise.all([
        vouchedLooks(sql, openIds),
        sql<{ user_id: string; n: number }[]>`select user_id, count(*)::int as n from realm_stamps where user_id = any(${openIds}::text[]) group by user_id`,
        // Each one's mutual friends (who it may invite to its base), `FRIENDS.list` at most.
        sql<{ id: string; handle: string }[]>`
          select a.follower_id as id, u.handle from follows a
          join follows b on b.follower_id = a.followee_id and b.followee_id = a.follower_id
          join users u on u.id = a.followee_id
          where a.follower_id = any(${openIds}::text[]) and u.handle is not null`,
      ])
      const identities: Record<string, RealmIdentity> = {}
      const friends: Record<string, string[]> = {}
      for (const r of open) {
        identities[r.id] = { userId: r.id, handle: r.handle, ...partnerOf(parseSaveData(r.save)), look: looks.get(r.id) ?? {}, supporter: r.supporter_public ? tierOfRow(r) : null, stamps: stamps.find((s) => s.user_id === r.id)?.n ?? 0 }
        friends[r.id] = []
      }
      for (const m of mutuals) {
        const list = friends[m.id]
        if (list && list.length < FRIENDS.list) list.push(m.handle.toLowerCase())
      }
      return { identities, banned: rows.filter((r) => r.closed).map((r) => r.id), friends }
    },

    /**
     * `POST /realm/visit`: whether `visitor` (a user id; a handle works too)
     * may come into `owner`'s base (a handle), counting the visit once per
     * visitor per Brasília day when it's someone else's.
     */
    visit: (visitor: string, owner: string): Promise<VisitResponse> =>
      sql.begin(async (tx) => {
        const [v] = await tx<{ id: string }[]>`select id from users where id = ${visitor} or handle = ${visitor.toLowerCase()} order by (id = ${visitor}) desc limit 1`
        const handle = wireHandle(owner)
        const o = handle ? await ownerOf(tx, handle, v?.id ?? '') : null
        if (!o) return { allowed: false, why: 'missing' }
        if (!v) return o.visibility === 'public' && !o.closed ? { allowed: true } : { allowed: false, why: o.visibility === null || o.closed ? 'missing' : 'private' }
        const may = mayEnter(o, v.id)
        if (may.allowed && o.id !== v.id && o.visibility !== null) {
          const [counted] = await tx`
            insert into base_visits (base_id, visitor_id, day) values (${o.id}, ${v.id}, ${brasiliaDay(now())}::date) on conflict do nothing returning base_id`
          if (counted) await tx`update bases set visits = visits + 1 where user_id = ${o.id}`
        }
        return may
      }),

    /** `POST /realm/presence`: keeps the relay's newest report. */
    presence: (report: PresenceReport) => {
      const held = presence.get(report.home)
      if (!held || held.report.at <= report.at) presence.set(report.home, { report, at: now().getTime() })
    },

    /**
     * `POST /realm/deeds`: applies what a relay saw, each account in its own
     * transaction (one that fails is logged and the others land), and answers
     * what they earned, plus what the API's own routes earned since the last
     * ask. The relay never retries, so a report counts once.
     */
    deeds: async (entries: readonly DeedEntry[]): Promise<DeedsAnswer> => {
      const day = brasiliaDay(now())
      for (const [userId, deeds] of groupDeeds(entries)) {
        try {
          holdEarned(userId, await sql.begin(async (tx) => ((await closed(tx, userId)) ? NOTHING : applyDeeds(tx, userId, deeds, day))))
        } catch (err) {
          console.error(`realm: deeds of ${userId} not applied`, err)
        }
      }
      const answer: DeedsAnswer = { stamps: {}, errands: {} }
      for (const [userId, earned] of heldEarned) {
        if (earned.stamps.length > 0) answer.stamps[userId] = earned.stamps
        if (earned.errands.length > 0) answer.errands[userId] = earned.errands
      }
      heldEarned.clear()
      return answer
    },

    /** `GET /realm/book`: the player's Estampas and the day's Recados; `profile` without a handle. */
    book: async (userId: string): Promise<BookOutcome> => {
      if (!(await handleOf(sql, userId))) return { ok: false, error: 'profile' }
      return { ok: true, book: await bookOf(sql, userId, brasiliaDay(now())) }
    },

    /** `POST /realm/errands/claim`: collects a finished errand of the Brasília day, once, behind the account's row lock. */
    claimErrand: (userId: string, id: string): Promise<ErrandClaimOutcome> =>
      sql.begin(async (tx): Promise<ErrandClaimOutcome> => {
        const [user] = await tx<{ handle: string | null }[]>`select handle from users where id = ${userId} for update`
        if (!user?.handle) return { ok: false, error: 'profile' }
        if (await closed(tx, userId)) return { ok: false, error: 'banned' }
        return collectErrand(tx, userId, id, brasiliaDay(now()))
      }),

    /** Takes one `GET /realm/friends` from the player's budget, and one `PUT /realm/settings`. */
    takeFriends: (userId: string) => limits.friends.take([userId], now().getTime()),
    takeSettings: (userId: string) => limits.settings.take([userId], now().getTime()),

    /** `GET /realm/cities`: trainers in each city now. */
    cities: () => ({ cities: cityCounts(presence.values(), now().getTime()), at: now().getTime() }),

    /**
     * `GET /realm/friends`: the players `userId` follows, each as far as they
     * let them see (`friendWhere`: a one-way follow shows nothing, appearing
     * offline reads offline, a hidden one is in the Realm somewhere), with
     * the asker's own "show where I am".
     */
    friends: async (userId: string): Promise<RealmFriends> => {
      const [rows, me] = await Promise.all([
        sql<{ handle: string; name: string; follows_back: boolean; appear_offline: boolean; realm_show_where: boolean; activity: Activity | null; ago: number | null }[]>`
          select u.handle, coalesce(u.name, u.handle) as name, u.appear_offline, u.realm_show_where,
            exists (select 1 from follows b where b.follower_id = u.id and b.followee_id = ${userId}) as follows_back,
            p.activity, (extract(epoch from (now() - p.seen_at)) * 1000)::float8 as ago
          from follows a join users u on u.id = a.followee_id left join presence p on p.user_id = u.id
          where a.follower_id = ${userId} and u.handle is not null and u.banned_at is null
          order by u.handle limit ${FRIENDS.list}`,
        sql<{ realm_show_where: boolean }[]>`select realm_show_where from users where id = ${userId}`,
      ])
      const followed = rows.map((r) => ({ handle: r.handle, name: r.name, followsBack: r.follows_back, appearOffline: r.appear_offline, showWhere: r.realm_show_where, activity: r.activity, ago: r.ago }))
      return { friends: friendsFrom(followed, presence.values(), now().getTime()), showWhere: me[0]?.realm_show_where ?? true }
    },

    /** `PUT /realm/settings`: stores "show where I am" for friends. */
    settings: async (userId: string, next: RealmSettings): Promise<RealmSettings> => {
      await sql`insert into users (id, realm_show_where) values (${userId}, ${next.showWhere}) on conflict (id) do update set realm_show_where = ${next.showWhere}`
      return next
    },

    /** `GET /realm/me`: the player's handle, furniture and base (null before the first save); `profile` without a handle. */
    me: async (userId: string): Promise<RealmMeOutcome> => {
      const handle = await handleOf(sql, userId)
      if (!handle) return { ok: false, error: 'profile' }
      const o = await ownerOf(sql, handle, userId)
      const save = parseSaveData(o?.save ?? {})
      return { ok: true, handle, furniture: await ownedBy(sql, userId, save), base: o && o.visibility !== null ? toView(o) : null }
    },

    /** `GET /realm/base/:handle`: the base as `viewer` sees it (its owner sees an empty one before saving it). */
    base: async (viewer: string, handle: string): Promise<BaseOutcome> => {
      const h = wireHandle(handle)
      const o = h ? await ownerOf(sql, h, viewer) : null
      if (!o) return { ok: false, error: 'missing' }
      const may = mayEnter(o, viewer)
      return may.allowed ? { ok: true, base: toView(o) } : { ok: false, error: may.why }
    },

    /**
     * `PUT /realm/base`: saves the player's base once `checkLayout` passes
     * against what it owns now, behind the account's row lock (a buy and a
     * save take turns).
     */
    save: async (userId: string, next: BaseSave): Promise<SaveOutcome> => {
      const saved = await sql.begin(async (tx): Promise<SaveOutcome> => {
        const [user] = await tx<{ handle: string | null }[]>`select handle from users where id = ${userId} for update`
        if (!user?.handle) return { ok: false, error: 'profile' }
        if (await closed(tx, userId)) return { ok: false, error: 'banned' }
        const refused = checkLayout(next.layout, await ownedBy(tx, userId, await slimOf(tx, userId)))
        if (refused) return { ok: false, error: 'layout', layout: refused }
        const { layout, visibility } = next
        await tx`
          insert into bases (user_id, layout, visibility, exterior, items, updated_at)
          values (${userId}, ${tx.json(layout)}, ${visibility}, ${layout.exterior}, ${layout.items.length}, now())
          on conflict (user_id) do update set layout = excluded.layout, visibility = excluded.visibility, exterior = excluded.exterior, items = excluded.items, updated_at = now()`
        return { ok: true, base: toView((await ownerOf(tx, user.handle, userId))!) }
      })
      if (saved.ok && next.layout.items.length >= FURNISHED) await earn(userId, new Map([['furnish', 1]]))
      return saved
    },

    /**
     * `GET /realm/bases`: the board. `top` and `new`, public bases with
     * something in them; `friends`, the mutual friends' bases the viewer may
     * enter. Never a banned owner's, nor one without a handle.
     */
    list: async (viewer: string, sort: 'top' | 'new' | 'friends'): Promise<BaseCard[]> => {
      const where =
        sort === 'friends' ? sql`b.visibility in ('public', 'friends') and ${mutual(sql, viewer, sql`b.user_id`)}` : sql`b.visibility = 'public' and b.items > 0`
      const order = sort === 'top' ? sql`b.likes desc, b.visits desc, b.updated_at desc` : sql`b.updated_at desc`
      const rows = await sql<{ handle: string; exterior: string; visits: number; likes: number; items: number; save: unknown; layout: unknown }[]>`
        select u.handle, b.exterior, b.visits, b.likes, b.items, b.layout, ${slimSave(sql)} as save
        from bases b join users u on u.id = b.user_id left join saves s on s.user_id = b.user_id
        where u.handle is not null and u.banned_at is null
          and not exists (select 1 from realm_bans rb where rb.user_id = b.user_id and ${banInForce(sql)})
          and ${where}
        order by ${order} limit ${BASE_LIST}`
      return rows.map((r) => ({ handle: r.handle, ...partnerOf(parseSaveData(r.save)), exterior: parseLayout(r.layout).exterior, visits: r.visits, likes: r.likes, items: r.items }))
    },

    /** `POST /realm/base/:handle/like`: likes a base the viewer may enter, or takes the like back. */
    like: async (viewer: string, handle: string): Promise<LikeOutcome> => {
      const done = await sql.begin(async (tx) => {
        const h = wireHandle(handle)
        const o = h ? await ownerOf(tx, h, viewer, true) : null
        if (!o || o.visibility === null) return { ok: false, error: 'missing' } as const
        if (o.id === viewer) return { ok: false, error: 'self' } as const
        const may = mayEnter(o, viewer)
        if (!may.allowed) return { ok: false, error: may.why } as const
        const taken = await tx`delete from base_likes where base_id = ${o.id} and user_id = ${viewer} returning base_id`
        if (taken.length === 0) await tx`insert into base_likes (base_id, user_id) values (${o.id}, ${viewer})`
        const [b] = await tx<{ likes: number }[]>`update bases set likes = greatest(0, likes + ${taken.length > 0 ? -1 : 1}) where user_id = ${o.id} returning likes`
        return { ok: true, likes: b?.likes ?? 0, added: taken.length === 0 } as const
      })
      if (!done.ok) return done
      // Its own transaction, after this one: here the owner's row is locked, and two players liking each other's bases must not wait on each other.
      if (done.added) await earn(viewer, new Map([['like', 1]]))
      return { ok: true, likes: done.likes }
    },

    /**
     * `POST /realm/furniture/buy`: one piece of `id` for `price`, in one
     * transaction behind the account's row lock. Gems through the ledger
     * (`furniture:<buy id>`); ₽ out of the stored save at revision `base`
     * (moved to `spent`, so a merge never refunds it), the new save stored at
     * the next revision and sent back for the device to keep.
     */
    buy: (userId: string, buy: FurnitureBuy, price: number): Promise<FurnitureOutcome> =>
      sql.begin(async (tx): Promise<FurnitureOutcome> => {
        const [user] = await tx<{ handle: string | null; gems: number }[]>`select handle, gems from users where id = ${userId} for update`
        if (!user?.handle) return { ok: false, error: 'profile' }
        const [row] = await tx<{ data: unknown; revision: number }[]>`select data, revision from saves where user_id = ${userId} for update`
        const save = row ? parseSaveData(row.data) : null
        let paid: { pay: 'gems'; balance: number } | { pay: 'coins'; save: Save; revision: number }
        if (buy.pay === 'gems') {
          if (user.gems < price) return { ok: false, error: 'gems' }
          const [b] = await tx<{ id: string }[]>`insert into furniture_buys (user_id, furniture, pay, price) values (${userId}, ${buy.id}, 'gems', ${price}) returning id`
          await moveGems(tx, userId, -price, 'furniture', `furniture:${b!.id}`)
          paid = { pay: 'gems', balance: user.gems - price }
        } else {
          if (!row || !save) return { ok: false, error: 'nosave' }
          if (buy.base !== row.revision) return { ok: false, error: 'stale' }
          if (save.wallet < price) return { ok: false, error: 'funds' }
          const next = donateFrom(save, price)
          const revision = row.revision + 1
          await tx`insert into furniture_buys (user_id, furniture, pay, price) values (${userId}, ${buy.id}, 'coins', ${price})`
          await tx`update saves set version = ${next.version}, revision = ${revision}, data = ${tx.json(next)}, updated_at = now() where user_id = ${userId}`
          paid = { pay: 'coins', save: next, revision }
        }
        await tx`
          insert into furniture_owned (user_id, furniture, source, count) values (${userId}, ${buy.id}, 'buy', 1)
          on conflict (user_id, furniture, source) do update set count = furniture_owned.count + 1`
        console.log(`realm: ${userId} bought ${buy.id} for ${price} ${buy.pay}`)
        return { ok: true, furniture: await ownedBy(tx, userId, save ?? parseSaveData({})), ...paid }
      }),

    /**
     * `POST /realm/game/claim`: one finished mini game worth `coins` (its
     * `coinsFor`, priced by the route), in one transaction behind the
     * account's row lock: the Brasília `day`'s caps (`capped`: the game's and
     * all games'), the game's stats (`statsAfter`) and the trophies they
     * reach for the first time (`trophiesEarned`, into `furniture_owned` as
     * source `game`) and the family a feat brings (`newFeatFamily`, as a
     * gift). The price grows before the caps with company in the
     * room (the relays' presence, never the client's word) and during the
     * game's Hora do Realm (`claimPay`). The ₽ goes to the wallet on the
     * device, like a run's. Then the game's deeds (`game:*`, `feat:*`).
     */
    claim: async (userId: string, claim: GameClaim, coins: number, day: DayKey): Promise<ClaimOutcome> => {
      const claimed = await sql.begin(async (tx): Promise<ClaimOutcome> => {
        const [user] = await tx<{ handle: string | null }[]>`select handle from users where id = ${userId} for update`
        if (!user?.handle) return { ok: false, error: 'profile' }
        if (await closed(tx, userId)) return { ok: false, error: 'banned' }
        const days = await tx<{ game: string; paid: number }[]>`select game, paid from realm_game_days where user_id = ${userId} and day = ${day}::date`
        const paidAll = days.reduce((sum, d) => sum + d.paid, 0)
        const at = now().getTime()
        const priced = claimPay(coins, claim.game, hasCompany(walking(presence.values(), at), user.handle), at)
        const paid = capped(claim.game, priced, days.find((d) => d.game === claim.game)?.paid ?? 0, paidAll)
        await tx`
          insert into realm_game_days (user_id, day, game, paid, plays) values (${userId}, ${day}::date, ${claim.game}, ${paid}, 1)
          on conflict (user_id, day, game) do update set paid = realm_game_days.paid + excluded.paid, plays = realm_game_days.plays + 1`
        const [row] = await tx<{ plays: number; wins: number; best: number; feats: string[] }[]>`
          select plays, wins, best, feats from realm_game_stats where user_id = ${userId} and game = ${claim.game}`
        const was: GameStats = row ?? { plays: 0, wins: 0, best: 0, feats: [] }
        const stats = statsAfter(claim.game, was, claim.outcome, claim.feats)
        await tx`
          insert into realm_game_stats (user_id, game, plays, wins, best, feats, updated_at)
          values (${userId}, ${claim.game}, ${stats.plays}, ${stats.wins}, ${stats.best}, ${[...stats.feats]}::text[], now())
          on conflict (user_id, game) do update set plays = excluded.plays, wins = excluded.wins, best = excluded.best, feats = excluded.feats, updated_at = now()`
        const before = new Set(trophiesEarned(claim.game, was))
        const trophies = trophiesEarned(claim.game, stats).filter((id): id is FurnitureId => !before.has(id) && isFurnitureId(id))
        for (const id of trophies) {
          await tx`insert into furniture_owned (user_id, furniture, source, count) values (${userId}, ${id}, 'game', 1) on conflict (user_id, furniture, source) do nothing`
        }
        if (trophies.length > 0) console.log(`realm: ${userId} earned ${trophies.join(', ')} at ${claim.game}`)
        // A feat's family, once per account: the first claim that hits it sends the gift (the key keeps a retry from sending two).
        const family = newFeatFamily(claim.game, was.feats, stats.feats)
        if (family) await sendGift(tx, userId, { kind: 'family', family }, { kind: 'season', way: 'fishing' }, `feat:${claim.game}:${family}`)
        const points = boardPoints(claim.game, claim.outcome)
        if (points !== null) {
          for (const period of GAME_BOARD_PERIODS) {
            const start = periodStart(period, day)
            // A solo game keeps the period's best (and when it was set); a table game adds a win.
            await (boardKeeps(claim.game) === 'best'
              ? tx`
                insert into realm_game_boards (game, period, start, user_id, score) values (${claim.game}, ${period}, ${start}::date, ${userId}, ${points})
                on conflict (game, period, start, user_id) do update set score = excluded.score, at = now() where realm_game_boards.score < excluded.score`
              : tx`
                insert into realm_game_boards (game, period, start, user_id, score) values (${claim.game}, ${period}, ${start}::date, ${userId}, ${points})
                on conflict (game, period, start, user_id) do update set score = realm_game_boards.score + excluded.score, at = now()`)
          }
        }
        return {
          ok: true,
          coins: paid,
          today: Math.min(MINIGAME_DAILY, paidAll + paid),
          trophies,
          furniture: trophies.length > 0 ? await ownedBy(tx, userId, await slimOf(tx, userId)) : null,
          family,
        }
      })
      if (claimed.ok) {
        const deeds = [`game:${claim.game}`, ...claim.feats.map((f) => `feat:${claim.game}:${f}`)].filter(isDeed)
        await earn(userId, new Map(deeds.map((d) => [d, 1])), day)
      }
      return claimed
    },

    /**
     * `GET /realm/boards/:game`: the game's board for the period holding the
     * Brasília `day` (`GameBoard`): the top `GAME_BOARD_SIZE`, best first and
     * the earlier first on a tie, and `viewer`'s own line wherever it is.
     * Trainers without a handle, banned or kept out of the realm don't show.
     */
    board: async (game: MinigameId, period: GameBoardPeriod, day: DayKey, viewer: string | null): Promise<GameBoard> => {
      const start = periodStart(period, day)
      const key = `${game}:${period}:${start}`
      const kept = viewer ? undefined : boardCache.get(key)
      if (kept && kept.until > now().getTime()) return kept.board
      const rows = await sql<{ user_id: string; handle: string; score: number; rank: number; total: number }[]>`
        select * from (
          select b.user_id, u.handle, b.score,
            (row_number() over (order by b.score desc, b.at, b.user_id))::int as rank,
            (count(*) over ())::int as total
          from realm_game_boards b join users u on u.id = b.user_id
          where b.game = ${game} and b.period = ${period} and b.start = ${start}::date
            and u.handle is not null and u.banned_at is null
            and not exists (select 1 from realm_bans rb where rb.user_id = b.user_id and ${banInForce(sql)})
        ) x
        where x.rank <= ${GAME_BOARD_SIZE} or x.user_id = ${viewer ?? ''}
        order by x.rank`
      const line = (r: (typeof rows)[number]) => ({ rank: r.rank, handle: r.handle, score: r.score })
      const mine = viewer ? rows.find((r) => r.user_id === viewer) : undefined
      const board: GameBoard = { game, period, start, entries: rows.filter((r) => r.rank <= GAME_BOARD_SIZE).map(line), me: mine ? line(mine) : null, total: rows[0]?.total ?? 0 }
      if (!viewer) boardCache.set(key, { board, until: now().getTime() + BOARD_CACHE_MS })
      return board
    },

    /**
     * `POST /realm/report`: stores the report (one open per reporter and
     * target) and posts it to the staff's channel. Nothing about the target
     * comes back: only reporting oneself and the daily limit (`REPORT.perDay`).
     */
    report: async (reporterId: string, r: RealmReport): Promise<RealmReported> => {
      const done = await sql.begin(async (tx) => {
        await tx`insert into users (id) values (${reporterId}) on conflict (id) do nothing`
        const [reporter] = await tx<{ handle: string | null }[]>`select handle from users where id = ${reporterId} for update`
        const [target] = await tx<{ id: string }[]>`select id from users where handle = ${r.handle}`
        if (target?.id === reporterId) return { outcome: 'self' } as const
        const [recent] = await tx<{ n: number }[]>`select count(*)::int as n from realm_reports where reporter_id = ${reporterId} and created_at > now() - interval '1 day'`
        if ((recent?.n ?? 0) >= REPORT.perDay) return { outcome: 'limit' } as const
        if (!target) return { outcome: 'stored', post: null } as const
        const [stored] = await tx`
          insert into realm_reports (reporter_id, target_id, reason, city) values (${reporterId}, ${target.id}, ${r.reason}, ${r.city})
          on conflict (reporter_id, target_id) where resolved_at is null do nothing returning id`
        if (!stored) return { outcome: 'stored', post: null } as const
        const [open] = await tx<{ n: number }[]>`select count(*)::int as n from realm_reports where target_id = ${target.id} and resolved_at is null`
        console.log(`realm report on ${target.id} (${r.reason}) by ${reporterId}`)
        return { outcome: 'stored', post: realmReportLine({ target: r.handle, reporter: reporter?.handle ?? null, reason: r.reason, city: r.city, open: open?.n ?? 1 }) } as const
      })
      const staff = deps.staff
      if (done.outcome === 'stored' && done.post && staff) void staff.post(done.post).catch((err: unknown) => console.error('realm report did not reach Discord', err))
      return done.outcome
    },

    /** `GET /admin/realm`: the open reports grouped by trainer and the bans in force. */
    desk: async (): Promise<RealmDesk> => {
      const [rows, banRows] = await Promise.all([
        sql<{ target_id: string; handle: string | null; reason: ReportReason; city: string | null; created_at: Date; reporter: string | null }[]>`
          select r.target_id, t.handle, r.reason, r.city, r.created_at, p.handle as reporter
          from realm_reports r join users t on t.id = r.target_id left join users p on p.id = r.reporter_id
          where r.resolved_at is null order by r.created_at limit ${DESK_LIST.reports}`,
        sql<{ user_id: string; handle: string | null; until: Date | null; reason: string; at: Date }[]>`
          select rb.user_id, u.handle, rb.until, rb.reason, rb.at from realm_bans rb join users u on u.id = rb.user_id
          where ${banInForce(sql)} order by rb.at desc limit ${DESK_LIST.bans}`,
      ])
      const bans = banRows.map((b): RealmBan => ({ userId: b.user_id, handle: b.handle, until: b.until?.toISOString() ?? null, reason: b.reason, at: b.at.toISOString() }))
      const open = rows.map((r): OpenRealmReport => ({ targetId: r.target_id, handle: r.handle, reason: r.reason, city: r.city, at: r.created_at.toISOString(), reporter: r.reporter }))
      return { groups: groupRealmReports(open, bans), bans }
    },

    /**
     * The admin acts on a trainer (`RealmModeration`), resolving their open
     * realm reports: a ban (for `days`, or for good) or its lifting, or a
     * dismissal. A ban keeps them out from their next `hello` (the relay asks
     * at each). Null for an unknown player, or an unban of someone not banned.
     */
    act: (adminId: string, m: RealmModeration): Promise<{ resolved: number } | null> =>
      sql.begin(async (tx) => {
        await tx`insert into users (id) values (${adminId}) on conflict (id) do nothing`
        const [user] = await tx`select 1 from users where id = ${m.userId}`
        if (!user) return null
        if (m.action === 'ban') {
          const until = m.days === null ? null : new Date(now().getTime() + m.days * 86_400_000)
          await tx`
            insert into realm_bans (user_id, until, reason, by) values (${m.userId}, ${until}, ${m.reason}, ${adminId})
            on conflict (user_id) do update set until = excluded.until, reason = excluded.reason, by = excluded.by, at = now()`
        } else if (m.action === 'unban') {
          const lifted = await tx`delete from realm_bans where user_id = ${m.userId} returning user_id`
          if (lifted.length === 0) return null
        }
        const resolved = await tx`
          update realm_reports set resolved_at = now(), resolved_by = ${adminId}, resolution = ${m.action}
          where resolved_at is null and target_id = ${m.userId} returning id`
        console.log(`admin ${adminId}: realm ${m.action} on ${m.userId}${m.action === 'ban' ? ` (${m.days ?? 'for good'} days: ${m.reason})` : ''}, ${resolved.length} reports resolved`)
        return { resolved: resolved.length }
      }),

    /** Whether `userId` is kept out of the realm now (the realm's writes ask). */
    closed: (userId: string) => closed(sql, userId),
    /** The same inside a transaction (the claw machine's, the Safári's and the Escavação's). */
    closedIn: closed,
    /** The deeds those games settle, as the claim's go (`EarnDeeds`). */
    earn,

    /** Counts a base save against the account's limit; false past it. */
    takeSave: (userId: string) => limits.save.take([userId], now().getTime()),
    /** Counts a like against the account's limit; false past it. */
    takeLike: (userId: string) => limits.like.take([userId], now().getTime()),
    /** Counts a buy against the account's limit; false past it. */
    takeBuy: (userId: string) => limits.buy.take([userId], now().getTime()),
    /** Counts a mini game claim against the account's limit; false past it. */
    takeGame: (userId: string) => limits.game.take([userId], now().getTime()),
    /** Counts an errand claim against the account's limit; false past it. */
    takeErrand: (userId: string) => limits.errand.take([userId], now().getTime()),
  }
}

export type RealmStore = ReturnType<typeof realmStore>

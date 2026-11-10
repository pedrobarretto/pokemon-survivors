import type { BaseExterior, BaseLayout, BaseVisibility } from '../data/secretBases'
import type { FurnitureCounts, FurnitureId } from '../data/furniture'
import type { Activity } from '../game/friends'
import type { CityId, RoomKey } from './realm'
import type { GameOutcome, MinigameId } from '../data/minigames'
import type { HatchlingId, PlayableId } from '../data/hatchlings'
import type { PlushFamily } from '../data/plushes'
import type { SafariHabitat } from '../data/safari'
import type { DigPrize, DigTreasureId } from '../data/digTreasures'
import type { Gift, GiftContent, GiftReason } from '../game/gifts'
import type { SafariCatch, SafariTurn } from '../realm/games/safari.rules'
import type { DigCell, DigHint, DigPattern, DigPowers, DigTreasure } from '../realm/games/dig.rules'

/**
 * The Poké Realm's API (game → `server/`, Clerk-authenticated like the rest).
 * The routes:
 *
 * - `GET /realm/me` (auth): `RealmMe`, what the realm needs about the player.
 *   403 `{ error: 'profile' }` without a @handle.
 * - `GET /realm/cities`: `RealmCities`, each city's trainers now (from the
 *   relays' presence). Public, cached a few seconds.
 * - `GET /realm/friends` (auth): `RealmFriends`, the players the asker follows and where each is, as
 *   far as they let them see (`friendWhere`, `realm/friends.ts`); 429 past the route's rate limit.
 * - `PUT /realm/settings` (auth) `RealmSettings`: "Mostrar onde estou para amigos". `RealmSettings`; 429 past the rate limit.
 * - `GET /realm/base/:handle` (auth): `BaseView`; 403 `{ error: 'private' }`
 *   when the player may not come in, 404 for no such base.
 * - `PUT /realm/base` (auth) `BaseSave`: saves the player's base after
 *   `checkLayout` against what it owns. `{ base: BaseView }`; 400
 *   `{ error: LayoutError }`; 429 past the rate limit.
 * - `GET /realm/bases?sort=top|new|friends` (auth): `BaseList`, public bases
 *   (or the friends' a player may enter), 30 at most.
 * - `POST /realm/base/:handle/like` (auth): likes a base once (`{ likes }`); a second call takes it back.
 * - `POST /realm/furniture/buy` (auth) `FurnitureBuy`: one piece, paid in gems (the gem ledger, ref
 *   `furniture:<uuid>`) or ₽ (out of the stored save at revision `base`, like `POST /festival/donate`).
 *   `FurnitureBought`; 402 `{ error: 'gems' | 'funds' }`, 404 not sold, 409 `nosave`/`stale` (sync first).
 * - `POST /realm/report` (auth) `RealmReport`: reports a trainer (to the moderation queue and the staff's Discord channel).
 * - `POST /realm/game/claim` (auth) `GameClaim`: a finished mini game (`data/minigames.ts`). The API
 *   prices it (`coinsFor`), caps it for the Brasília day (`capped`, kept per account and game), updates
 *   the game's stats (`GameStats`) and grants the trophies they reach (`trophiesEarned`, into
 *   `furniture_owned` with source `game`). `GameClaimed`; 400 for an outcome that doesn't fit the game,
 *   429 past the route's rate limit. The client adds `coins` to the wallet like a run's ₽.
 * - `GET /realm/dig` (auth): `DigState`, the Escavação as the player sees it (the open wall's view, never its layout). 403 `profile` without a @handle.
 * - `POST /realm/dig/start` (auth) `{ partner?, base? }`: a wall (`wallPrice`: free, or ₽ out of the stored save at revision `base`). `DigStarted`, with `{ save, revision }` when it spent; a wall open already comes back uncharged. 403 `cap`/`profile`/`banned`, 402 `funds`, 409 `nosave`/`stale`.
 * - `POST /realm/dig/hit` (auth) `{ id, seq, tool, cell }`: one hit, numbered from 1: `DigHitAnswer` (only the cells it opened and the crack). A number already answered gets its stored answer back. 409 `seq`/`empty`/`over`.
 * - `POST /realm/dig/stop` (auth) `{ id }`: leaves with what's dug out. `{ end: DigEnd }`; a wall already ended answers the same.
 * - `GET /realm/claw` (auth): `ClawState`, the Máquina de Pelúcias as the player sees it. 403 `profile` without a @handle.
 * - `POST /realm/claw/insert` (auth) `{ base? }`: a credit (`creditPrice`: free, or ₽ out of the stored save at revision
 *   `base`, like `POST /realm/furniture/buy`). `ClawInserted`, with `{ save, revision }` when it spent; an open credit
 *   comes back uncharged. 402 `funds`, 403 `profile`/`banned`/`cap`, 409 `nosave`/`stale`, 429 past the route's limit.
 * - `POST /realm/claw/drop` (auth) `{ id, x, y }`: the API decides the credit (`realm/games/claw.rules.ts`). `ClawDropped`;
 *   the same drop again answers the same. 404 for a credit that isn't this player's.
 * - `GET /realm/boards/:game?period=day|week` (public; signed in adds the player's line): `GameBoard`
 *   (`realm/boards.ts`), the game's best of the Brasília day or week, from the claims. Cached a few seconds.
 *
 * - `GET /realm/book` (auth): `RealmBook`, the player's Estampas and the day's Recados.
 * - `POST /realm/errands/claim` (auth) `ErrandClaim`: `ErrandClaimed`.
 *
 * And the relay's (signed), `net/realmRelay.ts`: `POST /realm/identity`, `POST /realm/visit`, `POST /realm/presence`, `POST /realm/deeds`.
 */

/** What the realm needs about the signed-in player: its handle, its furniture (bought plus earned, `trophyFurniture`) and its base (null until first saved). */
export type RealmMe = { handle: string; furniture: FurnitureCounts; base: BaseView | null }

export type RealmCities = { cities: Partial<Record<CityId, number>>; at: number }

/**
 * A player the asker follows, as far as they let them see: `realm` walking a
 * city (its room, null from an older relay, and `full`: the city or the room
 * holds its cap), `hidden` in the Realm but showing nobody where, `game`
 * online in the game outside it, `offline` (or appearing so), `pending` not
 * following back (nothing shown: following needs no consent). Flat, so a
 * client that only reads `handle` and `city` still lists who walks where.
 */
export type RealmFriend = { handle: string; name: string } & (
  | { state: 'realm'; city: CityId; room: RoomKey | null; full: 'city' | 'room' | null }
  | { state: 'game'; activity: Activity }
  | { state: 'hidden' | 'offline' | 'pending' }
)

export type FriendState = RealmFriend['state']

/** The followed players (mutual friends first, then by where they are, `sortFriends`) and the asker's own setting. */
export type RealmFriends = { friends: RealmFriend[]; showWhere: boolean }

/** The realm's own settings: whether mutual friends see where the player walks (on by default). */
export type RealmSettings = { showWhere: boolean }

/** A base as a visitor sees it. `liked`: whether the asking player likes it. */
export type BaseView = {
  handle: string
  partner: string
  shiny: boolean
  layout: BaseLayout
  visibility: BaseVisibility
  visits: number
  likes: number
  liked: boolean
  updatedAt: number
}

export type BaseSave = { layout: BaseLayout; visibility: BaseVisibility }

export type BaseCard = { handle: string; partner: string; shiny: boolean; exterior: BaseExterior; visits: number; likes: number; items: number }

export type BaseList = { bases: BaseCard[] }

/** `pay`: gems, or ₽ with the save revision it spends from (`base`). */
export type FurnitureBuy = { id: FurnitureId } & ({ pay: 'gems' } | { pay: 'coins'; base: number })

/** The new counts; a gem purchase brings the balance, a ₽ one the save (with the ₽ moved to `spent`) and its revision, for the device to keep. */
export type FurnitureBought = { furniture: FurnitureCounts } & ({ pay: 'gems'; balance: number } | { pay: 'coins'; save: unknown; revision: number })

export const REPORT_REASONS = ['spam', 'name', 'base', 'harassment', 'other'] as const

export type ReportReason = (typeof REPORT_REASONS)[number]

export type RealmReport = { handle: string; reason: ReportReason; city: CityId | null }

/**
 * A finished mini game: which, how it ended, how long it took (ms) and the
 * feats it hit (ids of the game's `feats`; unknown ones are ignored).
 */
export type GameClaim = { game: MinigameId; outcome: GameOutcome; ms: number; feats: readonly string[] }

/**
 * `GET /realm/book` (auth): the player's Estampas and today's Recados. `counts`
 * is the deed counts (`realm/stamps.ts` shows progress from them); `stamps` the
 * earned ones with when (ms); `milestones` the `at`s already rewarded.
 */
export type RealmBook = {
  stamps: readonly { id: string; at: number }[]
  counts: Readonly<Record<string, number>>
  milestones: readonly number[]
  errands: readonly ErrandView[]
  /** The Brasília day the errands belong to. */
  day: string
}

/** One of the day's errands (`realm/errands.ts`): how far along, and whether its reward was collected. */
export type ErrandView = { id: string; deed: string; target: number; reward: number; progress: number; claimed: boolean }

/** `POST /realm/errands/claim` (auth) `{ id }`: collects a finished errand. */
export type ErrandClaim = { id: string }

/** ₽ paid (the day's bonus included when this was the last one, `ERRANDS_BONUS`), and the book as it stands. 409 `{ error: 'unfinished' | 'claimed' }`. */
export type ErrandClaimed = { coins: number; book: RealmBook }

/**
 * What the game paid (₽ after the caps), what the account's mini games paid
 * today in all (`today`, out of `MINIGAME_DAILY`), the trophies it just
 * earned (new furniture ids), when it earned any, the new furniture counts,
 * and the family it brought for the first time (a `HatchlingId`, on its way as a gift), if any.
 */
export type GameClaimed = { coins: number; today: number; trophies: readonly FurnitureId[]; furniture: FurnitureCounts | null; family: string | null }

/** A credit in play: the seed that shakes the plushes and the week it was put in on. */
export type ClawPlay = { id: string; seed: number; week: string }

/** The machine for this account: the week's plushes, the misses on each (in that order), the credits used today and the credit left open, if any. */
export type ClawState = { week: string; prizes: PlushFamily[]; misses: number[]; used: number; open: ClawPlay | null }

export type ClawInserted = { play: ClawPlay; used: number }

/** What a drop came to: the plush it went for (its place in `prizes`), the grip, whether it held and every plush's misses after it. */
export type ClawDropped = { target: number; grip: number; won: boolean; family: PlushFamily; misses: number[] }

/** A silhouette: one bit per pixel, row by row (`npm run safari-shapes`). All a client gets of who's in a bush. */
export type SafariShape = { w: number; h: number; bits: string }

export type SafariBushView = { shape: SafariShape; sure: boolean; done: boolean }

/** The Pokémon being faced, known once it's been approached. */
export type SafariEncounterView = { bush: number; family: HatchlingId; shiny: boolean; calm: number; sure: boolean }

/** A session as its owner sees it. `turn`: how many actions the API has answered (what the next action sends). */
export type SafariSession = {
  id: string
  week: string
  habitat: SafariHabitat
  balls: number
  berries: number
  bushes: SafariBushView[]
  encounter: SafariEncounterView | null
  catches: SafariCatch<HatchlingId>[]
  over: boolean
  turn: number
}

/** The Zona Safári for this account: the habitat, the sessions used today, the sessions without a new family, whether the next one is the guarantee's, the partner the API counts and the session left open, if any. */
export type SafariState = { week: string; habitat: SafariHabitat; used: number; dry: number; sure: boolean; partner: PlayableId | null; open: SafariSession | null }

export type SafariStarted = { session: SafariSession; used: number }

/** What an action came to, the session after it and, for a catch, the gift that brings the Pokémon. */
export type SafariActed = { turn: SafariTurn<HatchlingId>; gift: Gift | null; session: SafariSession }

/** The Escavação's wall as its owner sees it: the rock's look, what's dug out so far and how cracked it is. Never where anything still buried lies. */
export type DigWallView = {
  id: string
  week: string
  golden: boolean
  pattern: DigPattern
  cap: number
  powers: DigPowers
  hint: DigHint | null
  depths: number[]
  left: number[]
  crack: number
  seq: number
  tiles: DigCell[]
  freed: number[]
}

/** The mine for this account: the week it's on, walls used today, the dry streak toward a guaranteed fossil, the fossils it lacks and the wall left open. */
export type DigState = { week: string; used: number; dry: number; lacking: string[]; open: DigWallView | null }

export type DigStarted = { wall: DigWallView; used: number }

/** A prize dug out: its treasure, what it pays, whether a fossil was a repeat and the ₽ it paid in coins. */
export type DigReward = { id: DigTreasureId; prize: DigPrize; repeat: boolean; coins: number }

/** A prize's gift as the API sends it (`parseGift` reads it). */
export type DigGift = { id: string; content: GiftContent; reason: GiftReason | null; at: string }

/** How a wall ended: what was kept, what got buried (every treasure's place, now it's over), the gifts carrying the prizes and the dry streak after. */
export type DigEnd = { outcome: 'collapse' | 'stopped'; kept: DigReward[]; buried: DigTreasure[]; treasures: DigTreasure[]; gifts: DigGift[]; dry: number }

/** One hit's answer: the cells it changed, the crack now, the treasures it finished and, if it ended the wall, how. */
export type DigHitAnswer = { seq: number; cells: DigCell[]; crack: number; freed: number[]; end: DigEnd | null }

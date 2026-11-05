import type { BaseExterior, BaseLayout, BaseVisibility } from '../data/secretBases'
import type { FurnitureCounts, FurnitureId } from '../data/furniture'
import type { CityId } from './realm'
import type { GameOutcome, MinigameId } from '../data/minigames'

/**
 * The Poké Realm's API (game → `server/`, Clerk-authenticated like the rest).
 * The routes:
 *
 * - `GET /realm/me` (auth): `RealmMe`, what the realm needs about the player.
 *   403 `{ error: 'profile' }` without a @handle.
 * - `GET /realm/cities`: `RealmCities`, each city's trainers now (from the
 *   relays' presence). Public, cached a few seconds.
 * - `GET /realm/friends` (auth): `RealmFriends`, the mutual friends walking a city now.
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
 *
 * And the relay's (signed), `net/realmRelay.ts`: `POST /realm/identity`, `POST /realm/visit`, `POST /realm/presence`.
 */

/** What the realm needs about the signed-in player: its handle, its furniture (bought plus earned, `trophyFurniture`) and its base (null until first saved). */
export type RealmMe = { handle: string; furniture: FurnitureCounts; base: BaseView | null }

export type RealmCities = { cities: Partial<Record<CityId, number>>; at: number }

export type RealmFriends = { friends: { handle: string; city: CityId }[] }

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
 * What the game paid (₽ after the caps), what the account's mini games paid
 * today in all (`today`, out of `MINIGAME_DAILY`), the trophies it just
 * earned (new furniture ids) and, when it earned any, the new furniture counts.
 */
export type GameClaimed = { coins: number; today: number; trophies: readonly FurnitureId[]; furniture: FurnitureCounts | null }

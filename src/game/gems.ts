import { GEM_PLAY, type GemCurrency, type GemMethod, type GemPackId } from '../data/gems'
import { COSMETICS, COSMETIC_SLOTS, cosmeticPrice, isCosmeticId, parseLook, type Look, type CosmeticBase, type CosmeticId } from '../data/cosmetics'
import type { DayKey } from './day'

/**
 * The gem shop's rules, shared by the API (`server/src/gems.ts`, which keeps
 * the ledger) and the game. Pure: no clock, no storage.
 */

/** Why the ledger moved: a pack bought, a Patreon charge, an Arena match, a cosmetic bought, a refund or dispute taking a pack back, a dispute won giving it back, a grant by hand. */
export const GEM_REASONS = ['pack', 'patreon', 'play', 'buy', 'refund', 'dispute', 'disputeWon', 'grant'] as const

export type GemReason = (typeof GEM_REASONS)[number]

export const isGemReason = (v: unknown): v is GemReason => typeof v === 'string' && (GEM_REASONS as readonly string[]).includes(v)

/** `GET /gems`: the balance (negative after a refund of spent gems, which blocks buying), what the account owns and its equipped look. */
export type GemsStatus = { balance: number; owned: readonly CosmeticId[]; look: Look }

/** One line of `GET /gems/ledger`: `amount` signed, `at` in ms. */
export type GemLedgerEntry = { amount: number; reason: GemReason; ref: string; at: number }

/** `POST /gems/checkout`'s body. */
export type GemCheckoutRequest = { pack: GemPackId; method: GemMethod; currency: GemCurrency }

/** `POST /gems/buy`'s answer. */
export type GemBuyResponse = { balance: number; owned: readonly CosmeticId[] }

/**
 * A pack's row on the API (`gem_purchases.state`): `open` until paid; `paid`
 * credited; `mismatch` paid a different amount or currency than the pack's
 * price, so held for support, never credited; `refunded` or `disputed` taken
 * back (a won dispute makes it `paid` again).
 */
export type PurchaseState = 'open' | 'paid' | 'mismatch' | 'refunded' | 'disputed'

/** Where a checkout's pack stands for its buyer: a held one (`mismatch`) still waits, as support settles it. */
export type GemPurchaseStatus = 'pending' | 'paid' | 'refunded' | 'disputed'

export const purchaseStatus = (state: PurchaseState): GemPurchaseStatus => (state === 'open' || state === 'mismatch' ? 'pending' : state)

export const isGemPurchaseStatus = (v: unknown): v is GemPurchaseStatus => v === 'pending' || v === 'paid' || v === 'refunded' || v === 'disputed'

/** `GET /gems/purchase/:ref`'s answer: where the account's pack stands, the gems it brings and the balance now. */
export type GemPurchaseResponse = { status: GemPurchaseStatus; gems: number; balance: number }

/** Whether a cosmetic is free: price 0 counts as owned by every account. */
export const isFree = (id: CosmeticId) => cosmeticPrice(id) === 0

/**
 * Whether `id` is on sale on Brasília `day`: it has a price above 0 and its
 * drop day (`from`) came.
 */
export const onSale = (id: CosmeticId, day: DayKey) => {
  const price = cosmeticPrice(id)
  const { from }: CosmeticBase = COSMETICS[id]
  return price !== null && price > 0 && (from === undefined || from <= day)
}

/**
 * The look an account may wear: `raw` parsed (`parseLook`), keeping only
 * what it owns or what's free. Ids the catalog dropped are dropped too.
 */
export const wearableLook = (raw: unknown, owned: ReadonlySet<string>): Look => {
  const look = parseLook(raw)
  for (const slot of COSMETIC_SLOTS) {
    const id = look[slot]
    if (id !== undefined && !owned.has(id) && !isFree(id)) delete look[slot]
  }
  return look
}

/** Owned ids the catalog still has (rows outlive entries), in a stable order. */
export const knownOwned = (ids: readonly string[]): CosmeticId[] => ids.filter(isCosmeticId).sort()

/**
 * Gems an Arena match gives a player who played it out: `GEM_PLAY.match`,
 * plus `GEM_PLAY.win` for a win, never past `GEM_PLAY.daily` with what
 * `earnedToday` (the Brasília day's play gems so far) already holds.
 */
export const playGems = (won: boolean, earnedToday: number) =>
  Math.max(0, Math.min(GEM_PLAY.match + (won ? GEM_PLAY.win : 0), GEM_PLAY.daily - earnedToday))

/**
 * Gems a refund takes back from a pack of `gems` paid `amount` cents, once
 * `refunded` cents of it went back: in proportion, rounded up, so a full
 * refund takes the whole pack.
 */
export const refundedGems = (gems: number, amount: number, refunded: number) =>
  amount <= 0 ? gems : Math.min(gems, Math.ceil((gems * Math.min(refunded, amount)) / amount))

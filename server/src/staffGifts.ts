import { EGG_TIER_IDS, type EggTier } from '../../src/game/eggs'
import type { GiftContent } from '../../src/game/gifts'

/**
 * What Discord staff may send players through the bot (`staffDesk.ts`), as
 * pure rules: eggs and ₽ only, never shinies, titles or styles. The server's
 * owner sends any egg with no daily cap. A Dev or Moderator gets a daily
 * allowance per Brasília day. Tune the numbers here.
 */
export const STAFF_GIFTS = {
  /** The egg tiers each rank may send. */
  tiers: { owner: ['common', 'rare', 'ultra'], staff: ['common', 'rare'] },
  /** A staff member's allowance per Brasília day (the owner has none). */
  perDay: { eggs: 5, coins: 5000 },
  /** The most ₽ one gift carries, per rank: a typo never sends a fortune. */
  coinsPerGift: { owner: 50_000, staff: 2000 },
} as const satisfies {
  tiers: Record<StaffRank, readonly EggTier[]>
  perDay: { eggs: number; coins: number }
  coinsPerGift: Record<StaffRank, number>
}

/** The guild's owner, or a Dev or Moderator. */
export type StaffRank = 'owner' | 'staff'

/** A gift staff may send. */
export type StaffGift = { kind: 'egg'; tier: EggTier } | { kind: 'coins'; amount: number }

/** What a staff member sent so far today. */
export type SentToday = { eggs: number; coins: number }

/** Why a gift can't go: a tier the rank can't send, a bad or too big ₽ amount, or past today's allowance. */
export type GiftRefusal = 'tier' | 'amount' | 'eggs' | 'coins'

/** The gift a command or a tool asked for (`kind` an egg tier or `coins`), or null when it isn't one staff can send. */
export const parseStaffGift = (kind: string, amount: number | null): StaffGift | null => {
  if (kind === 'coins') return amount !== null && Number.isInteger(amount) ? { kind: 'coins', amount } : null
  const tier = EGG_TIER_IDS.find((t) => t === kind)
  return tier ? { kind: 'egg', tier } : null
}

/** Adds up the gifts already sent today. */
export const tally = (sent: readonly GiftContent[]): SentToday => ({
  eggs: sent.filter((g) => g.kind === 'egg').length,
  coins: sent.reduce((sum, g) => sum + (g.kind === 'coins' ? g.amount : 0), 0),
})

/** Why `gift` can't go from someone of `rank` who already sent `today`, or null when it can. */
export const giftRefusal = (rank: StaffRank, gift: StaffGift, today: SentToday): GiftRefusal | null => {
  if (gift.kind === 'egg') {
    const tiers: readonly EggTier[] = STAFF_GIFTS.tiers[rank]
    if (!tiers.includes(gift.tier)) return 'tier'
    return rank === 'staff' && today.eggs + 1 > STAFF_GIFTS.perDay.eggs ? 'eggs' : null
  }
  if (gift.amount <= 0 || gift.amount > STAFF_GIFTS.coinsPerGift[rank]) return 'amount'
  return rank === 'staff' && today.coins + gift.amount > STAFF_GIFTS.perDay.coins ? 'coins' : null
}

/** What's left of a staff member's allowance today (the owner's is unlimited: null). */
export const allowanceLeft = (rank: StaffRank, today: SentToday): SentToday | null =>
  rank === 'owner' ? null : { eggs: Math.max(0, STAFF_GIFTS.perDay.eggs - today.eggs), coins: Math.max(0, STAFF_GIFTS.perDay.coins - today.coins) }

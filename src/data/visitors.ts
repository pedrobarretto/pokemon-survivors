import type { EggTier } from '../game/eggs'
import type { GiftContent } from '../game/gifts'
import { HALLOWEEN } from './halloween'
import type { PokeType } from './types'

/**
 * Who comes by the Kecleon plaza besides the two Kecleon, as data: Meowth's
 * weekend caravan (from the Kecleon Mart, Lv 4), the loyalty card's
 * milestones and the seasonal stalls. The rules that read it live in
 * `game/caravan.ts` and `game/loyalty.ts`; the plaza draws them
 * (`render/plaza.ts`). Lines live in `i18n` (`plaza.meowth`, `plaza.stalls`).
 */

/**
 * Meowth's caravan: it parks at the plaza on the Brasília `days` (Friday to
 * Sunday) of a shop at `minLevel` or up, with a stock drawn from the ISO week
 * (`caravanStock`): every weekend the ultra egg, the Gold Bottle Cap and
 * Meowth's frame, plus `tms` of the shop-exclusive TMs. One of each per
 * weekend per save. With `haggle.stamps` loyalty stamps or more, haggling
 * takes `haggle.off` off the whole weekend; without them Meowth refuses.
 */
/** Leavanny, the Boutique's tailor at the plaza's east end (`render/plaza.ts`, `ui/boutique.ts`): it sews clothes from leaves, and lives only there. */
export const TAILOR = { dex: 542, name: 'Leavanny', types: ['bug', 'grass'] } as const satisfies { dex: number; name: string; types: readonly PokeType[] }

export const CARAVAN = {
  dex: 52,
  name: 'Meowth',
  /** Brasília weekdays (0 Sunday … 6 Saturday) the caravan parks. */
  days: [5, 6, 0],
  minLevel: 4,
  haggle: { stamps: 7, off: 0.2 },
  /** The ultra egg (dearer than the Vitrine's, as a travelling merchant would have it). */
  egg: { tier: 'ultra', price: 12_000 },
  /** One Pokémon of the player's straight to the top Bottle Cap level (`grantCaps`). */
  goldCap: { name: 'Gold Bottle Cap', price: 22_000 },
  /** Meowth's own card frame (`render/cosmetics.ts`), sold only here. */
  frame: { id: 'meowth', price: 8_000 },
  /** Shop-exclusive TMs the caravan brings each weekend, at their shelf price. */
  tms: 2,
} as const satisfies {
  dex: number
  name: string
  days: readonly number[]
  minLevel: number
  haggle: { stamps: number; off: number }
  egg: { tier: EggTier; price: number }
  goldCap: { name: string; price: number }
  frame: { id: string; price: number }
  tms: number
}

/** A loyalty milestone's reward: a Mystery Gift, or the golden statue on the plaza. */
export type LoyaltyReward = GiftContent | 'statue'

/**
 * The loyalty card (Cartão fidelidade): one stamp per Brasília day the player
 * visits the shop, no purchase needed, and missing days never reset it. Each
 * milestone pays once: a rare egg (which also lets Meowth haggle), the Freguês
 * frame, the Freguês VIP title, the golden Kecleon statue on the plaza, and at
 * 100 a Kecleon Egg sure to hatch shiny (`EGG_TIERS.kecleonShiny`).
 */
export const LOYALTY = {
  /** Stamps per row of the card. */
  perRow: 10,
  milestones: [
    { stamps: 7, reward: { kind: 'egg', tier: 'rare' } },
    { stamps: 14, reward: { kind: 'style', style: { slot: 'frame', id: 'regular' } } },
    { stamps: 30, reward: { kind: 'title', title: 'vipCustomer' } },
    { stamps: 60, reward: 'statue' },
    { stamps: 100, reward: { kind: 'egg', tier: 'kecleonShiny' } },
  ],
} as const satisfies { perRow: number; milestones: readonly { stamps: number; reward: LoyaltyReward }[] }

/** What reaching the Department Store (Lv 5) pays: the Tycoon title and the gold Kecleon frame, as Mystery Gifts. */
export const TYCOON_REWARDS = [
  { kind: 'title', title: 'tycoon' },
  { kind: 'style', style: { slot: 'frame', id: 'kecleon' } },
] as const satisfies readonly GiftContent[]

/**
 * What a stall sells, by key: an egg of `egg`'s tier at `price`, paid in ₽
 * (`coins`) or in the Noite das Bruxas' candies (`candies`, from the jar's
 * spendable side, `candiesLeft`). No stock: as many as the incubator takes.
 */
type StallGoods = Readonly<Record<string, { egg: EggTier; price: number; pay: 'coins' | 'candies' }>>

/**
 * Seasonal stalls: during an event's Brasília days (`from` to `to`, both
 * included) its stall stands on the plaza, its keeper (`dex`) beside it, and a
 * talk gets its lines (`plaza.stalls` in `i18n`). A stall with `goods` opens
 * its shelf in the shop after the talk (`game/stalls.ts`). A new event is a
 * new entry here, with its art in `public/assets/shop/stall-<id>.png` and its lines.
 */
export const STALLS = {
  /**
   * Noite das Bruxas: Duskull sells the Haunted Egg, the only way to its four
   * ghosts (`HATCHLINGS` with `egg: 'haunted'`), for ₽ or for candies (a run
   * brings about 200, but the keenest players banked tens of thousands), as
   * many as the incubator takes. It's back next year.
   */
  halloween: {
    from: HALLOWEEN.from,
    to: HALLOWEEN.to,
    dex: 355,
    name: 'Duskull',
    art: 'stall-duskull',
    goods: { hauntedEgg: { egg: 'haunted', price: 6_000, pay: 'coins' }, hauntedEggCandies: { egg: 'haunted', price: 1_000, pay: 'candies' } },
  },
  /** Christmas: Delibird Presentes (a talk for now, no shop). */
  christmas: { from: '2026-12-15', to: '2026-12-31', dex: 225, name: 'Delibird', art: 'stall-delibird', goods: {} },
} as const satisfies Record<string, { from: string; to: string; dex: number; name: string; art: string; goods: StallGoods }>

export type StallId = keyof typeof STALLS

export const STALL_IDS = Object.keys(STALLS) as StallId[]

/** Every good any stall sells. */
export type StallGoodId = { [K in StallId]: keyof (typeof STALLS)[K]['goods'] }[StallId]

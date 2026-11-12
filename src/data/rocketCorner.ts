import type { BagItem } from './shop'
import type { RocketFamilyId } from './rocketFamilies'
import type { CornerFamilyId } from './scFamilies'

/**
 * The Rocket Game Corner's prize counter (`ui/cornerCounter.ts`; the API
 * redeems, `server/src/corner.ts`): what tokens buy. The player picks the
 * prize; the slots and Koffing Sweep only get them there sooner. Prices are a
 * goal of days: a day's tokens (`CORNER.buyDaily` bought, plus a fair day at
 * the games) is about 700, so a family is four to seven days.
 *
 * - `family`: one of the prize families, once: Team Rocket's four
 *   (`data/rocketFamilies.ts`) or the classic Celadon prizes, both Nidoran
 *   lines and Cleffa's (`CORNER_FAMILY_IDS`, `data/scFamilies.ts`).
 * - `shadow`: that family as a Shadow (`game/shadow.ts`), the family too if it
 *   isn't owned yet, once.
 * - `bag`: Bag items, as often as the tokens last.
 * - `title` and `frame`: Team Rocket's title and card frame, once.
 *
 * Names and blurbs live in i18n `rocket.prizes`, keyed by these ids.
 */
/** A family the counter sells: Team Rocket's or a Celadon prize. */
export type PrizeFamilyId = RocketFamilyId | CornerFamilyId

export type CornerPrize =
  | { kind: 'family'; family: PrizeFamilyId; price: number }
  | { kind: 'shadow'; family: PrizeFamilyId; price: number }
  | { kind: 'bag'; item: BagItem; count: number; price: number }
  | { kind: 'title'; price: number }
  | { kind: 'frame'; price: number }

export const CORNER_PRIZES = {
  ditto: { kind: 'family', family: 'ditto', price: 3000 },
  gimmighoul: { kind: 'family', family: 'gimmighoul', price: 4000 },
  mawile: { kind: 'family', family: 'mawile', price: 4000 },
  absol: { kind: 'family', family: 'absol', price: 5000 },
  nidoranF: { kind: 'family', family: 'nidoranF', price: 4500 },
  nidoranM: { kind: 'family', family: 'nidoranM', price: 4500 },
  cleffa: { kind: 'family', family: 'cleffa', price: 6000 },
  shadowDitto: { kind: 'shadow', family: 'ditto', price: 6500 },
  shadowGimmighoul: { kind: 'shadow', family: 'gimmighoul', price: 8000 },
  shadowMawile: { kind: 'shadow', family: 'mawile', price: 8000 },
  shadowAbsol: { kind: 'shadow', family: 'absol', price: 9500 },
  shadowNidoranF: { kind: 'shadow', family: 'nidoranF', price: 8500 },
  shadowNidoranM: { kind: 'shadow', family: 'nidoranM', price: 8500 },
  shadowCleffa: { kind: 'shadow', family: 'cleffa', price: 10500 },
  rareCandy: { kind: 'bag', item: 'rareCandy', count: 3, price: 450 },
  xAttack: { kind: 'bag', item: 'xAttack', count: 3, price: 500 },
  luckyEgg: { kind: 'bag', item: 'luckyEgg', count: 2, price: 450 },
  maxRevive: { kind: 'bag', item: 'maxRevive', count: 1, price: 700 },
  rocketTitle: { kind: 'title', price: 1500 },
  rocketFrame: { kind: 'frame', price: 2500 },
} as const satisfies Record<string, CornerPrize>

export type CornerPrizeId = keyof typeof CORNER_PRIZES

export const CORNER_PRIZE_IDS = Object.keys(CORNER_PRIZES) as CornerPrizeId[]

export const isCornerPrize = (v: unknown): v is CornerPrizeId => typeof v === 'string' && Object.hasOwn(CORNER_PRIZES, v)

/** Whether a prize is bought once (everything but Bag items). */
export const prizeOnce = (id: CornerPrizeId) => CORNER_PRIZES[id].kind !== 'bag'

/** The title and the card frame the counter sells (`GIFT_TITLES`, `STYLE_SHELF.frame`). */
export const ROCKET_TITLE = 'rocketRecruit' as const
export const ROCKET_FRAME = 'rocket' as const

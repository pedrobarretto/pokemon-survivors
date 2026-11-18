import type { GiftContent } from '../game/gifts'
import type { PlayableId } from './hatchlings'
import type { BagItem } from './shop'
import type { RocketFamilyId } from './rocketFamilies'
import type { CornerFamilyId } from './scFamilies'

/**
 * The Rocket Game Corner's prize counter (`ui/cornerCounter.ts`; the API
 * redeems, `server/src/corner.ts`): what tokens buy. The player picks the
 * prize; the slots and Koffing Sweep only get them there sooner. Prices are a
 * goal of days: playing only, Koffing Sweep's paid day (`CORNER.sweepDay`) is
 * up to 2,250 tokens, so a family is two to five full days; tokens cost ₽20
 * at the counter, so a family is ₽60k to ₽120k, a day or two of buying at
 * most (`CORNER.buyDaily`).
 *
 * - `family`: one of the prize families, once: Team Rocket's four
 *   (`data/rocketFamilies.ts`) or the classic Celadon prizes, both Nidoran
 *   lines, Cleffa's, Plusle and Minun (`CORNER_FAMILY_IDS`, `data/scFamilies.ts`).
 * - `shiny`: that family hatched shiny, once (the family too if it isn't
 *   owned yet): the counter's chase, priced at two and a half times its family
 *   (a week or so of play for the dearest), since no egg, ticket or run brings
 *   a prize family's shiny. Bought after the family, it costs only the rest
 *   (`prizePrice`), so either order adds up to the same.
 * - `shadow`: that family as a Shadow (`game/shadow.ts`), the family too if it
 *   isn't owned yet, once.
 * - `reshadow`: the Shadow Serum, which turns one Purified Pokémon (the player
 *   picks it at the counter; the API checks the stored save) back into a
 *   Shadow, as often as the tokens last. Priced like the dearest prizes
 *   (`SHADOW_SERUM_PRICE`), so purifying stays a choice.
 * - `bag`: Bag items, as often as the tokens last.
 * - `title` and `frame`: Team Rocket's title and card frame, once.
 *
 * Names and blurbs live in i18n `rocket.corner`, keyed by these ids (a shiny
 * prize's name is `shinyName` of its family's).
 */
/** A family the counter sells: Team Rocket's or a Celadon prize. */
export type PrizeFamilyId = RocketFamilyId | CornerFamilyId

export type CornerPrize =
  | { kind: 'family'; family: PrizeFamilyId; price: number }
  | { kind: 'shiny'; family: PrizeFamilyId; price: number }
  | { kind: 'shadow'; family: PrizeFamilyId; price: number }
  | { kind: 'reshadow'; price: number }
  | { kind: 'bag'; item: BagItem; count: number; price: number }
  | { kind: 'title'; price: number }
  | { kind: 'frame'; price: number }

/** What the Shadow Serum costs in tokens: about a Shadow Cleffa's, the dearest Shadow. */
export const SHADOW_SERUM_PRICE = 11000

export const CORNER_PRIZES = {
  ditto: { kind: 'family', family: 'ditto', price: 3000 },
  gimmighoul: { kind: 'family', family: 'gimmighoul', price: 4000 },
  mawile: { kind: 'family', family: 'mawile', price: 4000 },
  absol: { kind: 'family', family: 'absol', price: 5000 },
  nidoranF: { kind: 'family', family: 'nidoranF', price: 4500 },
  nidoranM: { kind: 'family', family: 'nidoranM', price: 4500 },
  cleffa: { kind: 'family', family: 'cleffa', price: 6000 },
  plusle: { kind: 'family', family: 'plusle', price: 4000 },
  minun: { kind: 'family', family: 'minun', price: 4000 },
  shinyDitto: { kind: 'shiny', family: 'ditto', price: 7500 },
  shinyGimmighoul: { kind: 'shiny', family: 'gimmighoul', price: 10000 },
  shinyMawile: { kind: 'shiny', family: 'mawile', price: 10000 },
  shinyAbsol: { kind: 'shiny', family: 'absol', price: 12500 },
  shinyNidoranF: { kind: 'shiny', family: 'nidoranF', price: 11000 },
  shinyNidoranM: { kind: 'shiny', family: 'nidoranM', price: 11000 },
  shinyCleffa: { kind: 'shiny', family: 'cleffa', price: 15000 },
  shinyPlusle: { kind: 'shiny', family: 'plusle', price: 10000 },
  shinyMinun: { kind: 'shiny', family: 'minun', price: 10000 },
  shadowDitto: { kind: 'shadow', family: 'ditto', price: 6500 },
  shadowGimmighoul: { kind: 'shadow', family: 'gimmighoul', price: 8000 },
  shadowMawile: { kind: 'shadow', family: 'mawile', price: 8000 },
  shadowAbsol: { kind: 'shadow', family: 'absol', price: 9500 },
  shadowNidoranF: { kind: 'shadow', family: 'nidoranF', price: 8500 },
  shadowNidoranM: { kind: 'shadow', family: 'nidoranM', price: 8500 },
  shadowCleffa: { kind: 'shadow', family: 'cleffa', price: 10500 },
  shadowPlusle: { kind: 'shadow', family: 'plusle', price: 8000 },
  shadowMinun: { kind: 'shadow', family: 'minun', price: 8000 },
  shadowSerum: { kind: 'reshadow', price: SHADOW_SERUM_PRICE },
  rareCandy: { kind: 'bag', item: 'rareCandy', count: 3, price: 450 },
  xAttack: { kind: 'bag', item: 'xAttack', count: 3, price: 500 },
  luckyEgg: { kind: 'bag', item: 'luckyEgg', count: 2, price: 450 },
  maxRevive: { kind: 'bag', item: 'maxRevive', count: 1, price: 700 },
  rocketTitle: { kind: 'title', price: 1500 },
  rocketFrame: { kind: 'frame', price: 2500 },
} as const satisfies Record<string, CornerPrize>

export type CornerPrizeId = keyof typeof CORNER_PRIZES

export const CORNER_PRIZE_IDS = Object.keys(CORNER_PRIZES) as CornerPrizeId[]

/** The shiny prizes, named from their family's name (`rocket.corner.shinyName`) rather than one line each. */
export type ShinyPrizeId = { [K in CornerPrizeId]: (typeof CORNER_PRIZES)[K]['kind'] extends 'shiny' ? K : never }[CornerPrizeId]

export const isShinyPrize = (id: CornerPrizeId): id is ShinyPrizeId => CORNER_PRIZES[id].kind === 'shiny'

export const isCornerPrize = (v: unknown): v is CornerPrizeId => typeof v === 'string' && Object.hasOwn(CORNER_PRIZES, v)

/** The prize that sells `family` in its normal colors. */
const familyPrizeOf = (family: PrizeFamilyId) =>
  CORNER_PRIZE_IDS.find((id) => {
    const def: CornerPrize = CORNER_PRIZES[id]
    return def.kind === 'family' && def.family === family
  })

/**
 * What a prize costs an account that has redeemed `taken` (prize ids, the API's
 * `corner_redemptions`): a shiny prize whose family was bought already costs its
 * price less the family's, so the family then its shiny costs what the shiny alone does.
 */
export const prizePrice = (id: CornerPrizeId, taken: readonly string[]) => {
  const def: CornerPrize = CORNER_PRIZES[id]
  if (def.kind !== 'shiny') return def.price
  const family = familyPrizeOf(def.family)
  return family !== undefined && taken.includes(family) ? def.price - CORNER_PRIZES[family].price : def.price
}

/** Whether a prize is bought once (everything but Bag items and the Shadow Serum). */
export const prizeOnce = (id: CornerPrizeId) => CORNER_PRIZES[id].kind !== 'bag' && CORNER_PRIZES[id].kind !== 'reshadow'

/** Whether a prize needs a Pokémon picked with it (the Shadow Serum's Purified one). */
export const prizeTargets = (id: CornerPrizeId) => CORNER_PRIZES[id].kind === 'reshadow'

/** The title and the card frame the counter sells (`GIFT_TITLES`, `STYLE_SHELF.frame`). */
export const ROCKET_TITLE = 'rocketRecruit' as const
export const ROCKET_FRAME = 'rocket' as const

/** The gift a prize sends; the Shadow Serum's names its Pokémon (`target`), and is null without one. */
export const prizeContent = (id: CornerPrizeId, target: PlayableId | null): GiftContent | null => {
  const def: CornerPrize = CORNER_PRIZES[id]
  switch (def.kind) {
    case 'family': return { kind: 'family', family: def.family }
    case 'shiny': return { kind: 'shinyHatch', family: def.family }
    case 'shadow': return { kind: 'shadow', family: def.family }
    case 'reshadow': return target && { kind: 'reshadow', id: target }
    case 'bag': return { kind: 'bag', item: def.item, count: def.count }
    case 'title': return { kind: 'title', title: ROCKET_TITLE }
    case 'frame': return { kind: 'style', style: { slot: 'frame', id: ROCKET_FRAME } }
  }
}

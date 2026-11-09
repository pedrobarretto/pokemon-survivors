import type { HatchlingId } from './hatchlings'
import type { BagItem, EvoItemId } from './shop'

/**
 * What can lie buried at the Escavação (`realm/games/dig.rules.ts`): the art
 * (an icon the game already uses, or a mine piece of furniture), how much it's
 * scaled up (bigger art is a bigger shape, so what's rare is what's large) and
 * what it pays. `worth` is a treasure's ₽ value to the economy check in
 * `dig.rules.test.ts` (what the Kecleon shop asks for it, or what a repeat
 * pays), not a price anyone sees.
 *
 * Import-free but for types, so the API and the client read the same table.
 */

export type FossilFamily = Extract<HatchlingId, 'cranidos' | 'shieldon' | 'archen' | 'tyrunt' | 'amaura'>

/** A piece of furniture only the mine gives (`source: 'dig'`, `data/furniture.ts`). */
export const DIG_PIECES = ['digFossilDisplay', 'digGeodeLamp', 'digCrystals', 'digMinecart'] as const

export type DigPiece = (typeof DIG_PIECES)[number]

/** What a treasure brings: ₽, one Bag item, an evolution stone, a piece of furniture, or a fossil's family. */
export type DigPrize =
  | { kind: 'coins'; amount: number }
  | { kind: 'bag'; item: BagItem }
  | { kind: 'stone'; item: EvoItemId }
  | { kind: 'furniture'; piece: DigPiece }
  | { kind: 'fossil'; family: FossilFamily }

export type DigGroup = 'coins' | 'bag' | 'stone' | 'furniture' | 'fossil'

/** What a repeat fossil pays: its family's Fossil Egg refund. */
export const DIG_FOSSIL_REPEAT = 800

type DigDef = { group: DigGroup; art: string; scale: 1 | 2 | 3; worth: number; weight: number; prize: DigPrize; name: string }

const coins = (art: string, name: string, amount: number, scale: 2 | 3, weight: number): DigDef => ({ group: 'coins', art: `items/${art}`, scale, worth: amount, weight, prize: { kind: 'coins', amount }, name })

const bag = (item: BagItem, worth: number, scale: 2, weight: number): DigDef => ({ group: 'bag', art: `items/${item}`, scale, worth, weight, prize: { kind: 'bag', item }, name: item })

const stone = (item: EvoItemId): DigDef => ({ group: 'stone', art: `items/${item}`, scale: 2, worth: 10_000, weight: 1, prize: { kind: 'stone', item }, name: item })

const piece = (id: DigPiece, weight: number): DigDef => ({ group: 'furniture', art: `furniture/${id}`, scale: 1, worth: 1500, weight, prize: { kind: 'furniture', piece: id }, name: id })

const fossil = (art: string, name: string, family: FossilFamily): DigDef => ({ group: 'fossil', art: `items/${art}`, scale: 3, worth: DIG_FOSSIL_REPEAT, weight: 1, prize: { kind: 'fossil', family }, name })

/** Every treasure. `weight` ranks it inside its group (a Max Revive is rarer than a Lure); the odds are `digOdds`'s. */
export const DIG_TREASURES = {
  nugget: coins('nugget', 'Nugget', 100, 2, 70),
  bigNugget: coins('bigNugget', 'Big Nugget', 400, 3, 24),
  relicGold: coins('relicGold', 'Relic Gold', 1000, 3, 6),
  lure: bag('lure', 800, 2, 28),
  incense: bag('incense', 600, 2, 28),
  honey: bag('honey', 700, 2, 28),
  rareCandy: bag('rareCandy', 1200, 2, 18),
  xAttack: bag('xAttack', 1500, 2, 14),
  luckyEgg: bag('luckyEgg', 1500, 2, 14),
  luckIncense: bag('luckIncense', 2000, 2, 9),
  everstone: bag('everstone', 3000, 2, 5),
  maxRevive: bag('maxRevive', 5000, 2, 3),
  waterStone: stone('waterStone'),
  thunderStone: stone('thunderStone'),
  fireStone: stone('fireStone'),
  sunStone: stone('sunStone'),
  moonStone: stone('moonStone'),
  leafStone: stone('leafStone'),
  iceStone: stone('iceStone'),
  shinyStone: stone('shinyStone'),
  dawnStone: stone('dawnStone'),
  digCrystals: piece('digCrystals', 40),
  digGeodeLamp: piece('digGeodeLamp', 30),
  digFossilDisplay: piece('digFossilDisplay', 18),
  digMinecart: piece('digMinecart', 12),
  skullFossil: fossil('skullFossil', 'Skull Fossil', 'cranidos'),
  armorFossil: fossil('armorFossil', 'Armor Fossil', 'shieldon'),
  plumeFossil: fossil('plumeFossil', 'Plume Fossil', 'archen'),
  jawFossil: fossil('jawFossil', 'Jaw Fossil', 'tyrunt'),
  sailFossil: fossil('sailFossil', 'Sail Fossil', 'amaura'),
} as const satisfies Record<string, DigDef>

export type DigTreasureId = keyof typeof DIG_TREASURES

export const DIG_TREASURE_IDS = Object.keys(DIG_TREASURES) as DigTreasureId[]

export const DIG_FOSSILS = ['skullFossil', 'armorFossil', 'plumeFossil', 'jawFossil', 'sailFossil'] as const satisfies readonly DigTreasureId[]

/** The family each fossil restores. */
const FOSSIL_FAMILY: Record<(typeof DIG_FOSSILS)[number], FossilFamily> = { skullFossil: 'cranidos', armorFossil: 'shieldon', plumeFossil: 'archen', jawFossil: 'tyrunt', sailFossil: 'amaura' }

/** The five fossil families, for what the account lacks. */
export const DIG_FOSSIL_FAMILIES: readonly FossilFamily[] = DIG_FOSSILS.map((id) => FOSSIL_FAMILY[id])

export const isDigTreasureId = (v: unknown): v is DigTreasureId => typeof v === 'string' && Object.hasOwn(DIG_TREASURES, v)


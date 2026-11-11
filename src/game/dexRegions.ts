import { EVENT_LEGENDS } from '../data/legends'
import { ENEMIES } from '../data/enemies'
import { DEX_REGIONS, dexRegionOf, MYTHICAL_DEX, type DexRegion } from '../data/nationalDex'
import { GAME_SPECIES } from '../data/species'
import type { Pokedex } from './dex'
import type { Gift, GiftContent } from './gifts'
import type { Save } from './meta'

/**
 * The regional Pokédexes: each region asks for every species of it a run can
 * bring (`GAME_SPECIES`), but the mythicals and the event legends (Darkrai),
 * which the games never ask either. Seeing them all completes the region: its
 * title comes as a game-made Mystery Gift (`game/gameGifts.ts`), and every
 * region complete brings the National Dex frame. Seen, not caught: a wild
 * species is caught only by defeating a shiny (`game/dex.ts`), which no region
 * of hundreds could ask. Pure; shared with the API.
 */

const EVENT_DEX: ReadonlySet<number> = new Set(EVENT_LEGENDS.map((id) => ENEMIES[id].dex))

/** Whether a species counts towards its region's Pokédex. */
export const inDexGoal = (n: number) => GAME_SPECIES.has(n) && !MYTHICAL_DEX.has(n) && !EVENT_DEX.has(n)

const GOALS: ReadonlyMap<DexRegion, readonly number[]> = new Map(
  DEX_REGIONS.map((region) => [region, [...GAME_SPECIES].filter((n) => inDexGoal(n) && dexRegionOf(n) === region).sort((a, b) => a - b)] as const),
)

/** A region's goal: the species (dex numbers, regional forms included) seeing it asks for, in number order. */
export const dexGoal = (region: DexRegion): readonly number[] => GOALS.get(region) ?? []

/** A region's goal species seen so far, and how many it asks for. */
export const regionProgress = (dex: Pokedex, region: DexRegion) => {
  const goal = dexGoal(region)
  return { seen: goal.filter((n) => dex[n] !== undefined).length, total: goal.length }
}

/** Whether every species of the region's goal has been seen (a region with no goal yet never completes). */
export const regionDone = (dex: Pokedex, region: DexRegion) => {
  const { seen, total } = regionProgress(dex, region)
  return total > 0 && seen === total
}

/** What completing each region brings: its title. */
export const DEX_REWARDS = {
  kanto: { kind: 'title', title: 'kantoDex' },
  johto: { kind: 'title', title: 'johtoDex' },
  hoenn: { kind: 'title', title: 'hoennDex' },
  sinnoh: { kind: 'title', title: 'sinnohDex' },
  unova: { kind: 'title', title: 'unovaDex' },
  kalos: { kind: 'title', title: 'kalosDex' },
  alola: { kind: 'title', title: 'alolaDex' },
  galar: { kind: 'title', title: 'galarDex' },
  paldea: { kind: 'title', title: 'paldeaDex' },
} as const satisfies Record<DexRegion, GiftContent>

/** What completing every region brings: the National Dex frame. */
export const NATIONAL_REWARD = { kind: 'style', style: { slot: 'frame', id: 'nationalDex' } } as const satisfies GiftContent

const PREFIX = 'dex:'

/** The Mystery Gift id of a region's reward, or the National Dex's. */
export const dexGiftId = (region: DexRegion | 'national') => `${PREFIX}${region}`

export const isDexGift = (id: string) => id.startsWith(PREFIX)

/** Every Pokédex reward, earned or not, as the API vouches for them once applied (a goal that grows later never takes one back). */
export const dexGiftContents = (): Array<readonly [string, GiftContent]> => [
  ...DEX_REGIONS.map((region) => [dexGiftId(region), DEX_REWARDS[region]] as const),
  [dexGiftId('national'), NATIONAL_REWARD],
]

/** The Pokédex rewards the save earned, applied or not: each region complete, and the National Dex once they all are. */
export const dexGiftList = (save: Save): Gift[] => {
  const done = DEX_REGIONS.filter((region) => regionDone(save.dex, region))
  return [
    ...done.map((region): Gift => ({ id: dexGiftId(region), content: DEX_REWARDS[region], reason: { kind: 'dex', region } })),
    ...(done.length === DEX_REGIONS.length ? [{ id: dexGiftId('national'), content: NATIONAL_REWARD, reason: { kind: 'dex', region: 'national' } } satisfies Gift] : []),
  ]
}

/** The Pokédex's gifts waiting to be opened. */
export const dexGifts = (save: Save): Gift[] => dexGiftList(save).filter((g) => !save.gifts.includes(g.id))

import national from './nationalDex.generated.json'
import { regionalGen } from './regionalForms'
import { REGIONS, type Region } from './starters'

/**
 * The National Dex as the game's Pokédex lays it out: numbers 1 to `NATIONAL_LAST`,
 * grouped by the region each species debuted in. `npm run roster` writes the
 * generated half from PokeAPI and the SpriteCollab tracker: the mythicals (never
 * part of a region's goal, as in the games) and the species SpriteCollab's
 * artists haven't drawn yet, which the Pokédex shows as a thank-you card.
 */

export const NATIONAL_LAST: number = national.last

/** The regions' ids, Kanto to Paldea, in `REGIONS` order (a region's `gen` is its index + 1). */
export const DEX_REGIONS = ['kanto', 'johto', 'hoenn', 'sinnoh', 'unova', 'kalos', 'alola', 'galar', 'paldea'] as const

export type DexRegion = (typeof DEX_REGIONS)[number]

/** Last national dex number of each generation, in `REGIONS` order. */
const LAST_DEX = [151, 251, 386, 493, 649, 721, 809, 905, 1025] as const

/** Main-series region a species debuted in, from its national dex number (a regional form's, from its form). */
export const regionOf = (dex: number): Region => {
  const gen = regionalGen(dex)
  return REGIONS.find((r) => (gen === undefined ? dex <= (LAST_DEX[r.gen - 1] ?? Infinity) : r.gen === gen)) ?? REGIONS[REGIONS.length - 1]!
}

/** `regionOf` as a `DexRegion`. */
export const dexRegionOf = (dex: number): DexRegion => DEX_REGIONS[regionOf(dex).gen - 1] ?? 'paldea'

/** Mythical species (Mew, Celebi…): seen at events and rare finales, never asked of a region. */
export const MYTHICAL_DEX: ReadonlySet<number> = new Set(national.mythical)

/** Species SpriteCollab hasn't drawn Walk, Idle and Hurt for yet, by number, with their official names. */
export const SHEETLESS: ReadonlyMap<number, string> = new Map(Object.entries(national.sheetless).map(([dex, name]) => [Number(dex), name]))

/** Where to help SpriteCollab draw the species still missing. */
export const SPRITECOLLAB_URL = 'https://sprites.pmdcollab.org/'

import { HATCHLINGS, HATCHLING_IDS, type HatchlingId } from './hatchlings'
import type { SafariEntry, SafariRarity } from '../realm/games/safari.rules'
import { regionFamilies, regionOfWeek } from '../game/travel'
import { isRegion } from './regionalForms'

/**
 * The Zona Safári's habitats and who lives in them (`realm/games/safari.rules.ts`
 * has the rules, `server/src/safari.ts` the dice). A habitat is a type theme
 * over the regular egg families, plus the one Safari-only family it shelters
 * and the families of the week's trip (`regionOfWeek`, `game/travel.ts`).
 */

/** The families only the Safari brings: Lapras swims in the cove alone. */
export const SAFARI_ONLY = ['mimikyu', 'morpeko', 'tandemaus', 'lapras'] as const satisfies readonly HatchlingId[]

/**
 * Regular egg families the Safari leaves out because their shiny is someone's
 * reward: Togepi (the Festival's top prize), Gastly (the Halloween jar), Noibat
 * (the Discord gift) and Dratini (bringing 10 friends). Munchlax, the invite's
 * family, isn't a regular egg's at all.
 */
const PROMISED: ReadonlySet<HatchlingId> = new Set(['togepi', 'gastly', 'noibat', 'dratini'])

const REGULAR = HATCHLING_IDS.filter((id) => (['common', 'rare', 'ultra'] as const).some((tier) => tier === HATCHLINGS[id].egg) && !PROMISED.has(id))

/** The habitats, in the weekly order (`habitatOfWeek`). */
export const SAFARI_HABITATS = {
  meadow: { types: ['normal', 'flying', 'grass', 'bug', 'fairy'], only: 'tandemaus' },
  marsh: { types: ['ghost', 'dark', 'poison', 'psychic'], only: 'mimikyu' },
  ridge: { types: ['electric', 'rock', 'ground', 'steel', 'fighting', 'fire', 'dragon'], only: 'morpeko' },
  cove: { types: ['water', 'ice'], only: 'lapras' },
} as const satisfies Record<string, { types: readonly string[]; only: (typeof SAFARI_ONLY)[number] }>

export type SafariHabitat = keyof typeof SAFARI_HABITATS

export const SAFARI_HABITAT_IDS = Object.keys(SAFARI_HABITATS) as SafariHabitat[]

export const isSafariHabitat = (v: unknown): v is SafariHabitat => typeof v === 'string' && Object.hasOwn(SAFARI_HABITATS, v)

const typesOf = (id: HatchlingId): readonly string[] => HATCHLINGS[id].line[0].types

const rarityOf = (id: HatchlingId): SafariRarity => {
  if ((SAFARI_ONLY as readonly HatchlingId[]).includes(id)) return 'special'
  const tier = HATCHLINGS[id].egg
  // The trip's visitors are as rare as a rare egg's.
  if (isRegion(tier)) return 'rare'
  return tier === 'ultra' ? 'ultra' : tier === 'rare' ? 'rare' : 'common'
}

/** A family as the Safari weighs it (the guarantee can bring one from outside the week's pool). */
export const safariEntry = (id: HatchlingId): SafariEntry<HatchlingId> => ({ family: id, rarity: rarityOf(id), types: typesOf(id) })

/** Every family a Safari can hold, in the dex's order: the regular eggs' and the Safari-only four. */
export const SAFARI_FAMILIES: readonly HatchlingId[] = [...REGULAR, ...SAFARI_ONLY]

/** Who can turn up in a habitat's tall grass in the week starting on `week`: its types' families, its Safari-only one and the trip's region's families. */
export const habitatPool = (habitat: SafariHabitat, week: string): SafariEntry<HatchlingId>[] => {
  const { types, only } = SAFARI_HABITATS[habitat]
  return [...REGULAR.filter((id) => typesOf(id).some((type) => (types as readonly string[]).includes(type))), only, ...regionFamilies(regionOfWeek(week))].map(safariEntry)
}

/** The Safari families an account still lacks, given what it hatched and the family gifts it already has waiting. */
export const lackingFamilies = (hatched: Readonly<Record<string, unknown>>, gifted: readonly string[]) => SAFARI_FAMILIES.filter((id) => hatched[id] === undefined && !gifted.includes(id)).map(safariEntry)

/** A family's first form, the one met in the grass. */
export const safariForm = (family: HatchlingId) => HATCHLINGS[family].line[0]

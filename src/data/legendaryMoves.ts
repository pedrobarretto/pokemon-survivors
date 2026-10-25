import type { LegendaryMoveId } from '../game/legendaryMoves'
import type { LegendaryMove2Id } from '../game/legendaryMoves2'
import type { BiomeId } from './biomes'
import type { LegendId } from './legends'
import type { PokeType } from './types'

/**
 * The capstone move each legendary (`LEGEND_IDS`, the event's Darkrai and the festival's Cresselia too) teaches
 * (`game/legendaryMoves.ts`, the trios', Mewtwo's and Arceus's in
 * `game/legendaryMoves2.ts`): its official signature where it's free; where
 * the name already belongs to a special tier (Aeroblast, Doom Desire), a
 * starter's move (Precipice Blades, Eruption, Leaf Storm) or another move
 * (Mewtwo's boss TM Psystrike, Sheer Cold, Blizzard, Stone Edge, Flash
 * Cannon), another iconic move of theirs, or of its paradox form (Raikou's
 * Thunderclap from Raging Bolt, Entei's Burning Bulwark from Gouging Fire).
 */
export const LEGENDARY_MOVE_OF = {
  lugia: 'whirlwind',
  hoOh: 'sacredFire',
  kyogre: 'originPulse',
  groudon: 'scorchingSands',
  rayquaza: 'dragonAscent',
  dialga: 'roarOfTime',
  latias: 'mistBall',
  latios: 'lusterPurge',
  deoxys: 'psychoBoost',
  mew: 'ancientPower',
  celebi: 'magicalLeaf',
  jirachi: 'wish',
  articuno: 'snowscape',
  zapdos: 'electricTerrain',
  moltres: 'overheat',
  raikou: 'thunderclap',
  entei: 'burningBulwark',
  suicune: 'aquaRing',
  regirock: 'rockWrecker',
  regice: 'glaciate',
  registeel: 'metalBurst',
  mewtwo: 'telekinesis',
  arceus: 'judgment',
  darkrai: 'darkVoid',
  cresselia: 'lunarBlessing',
} as const satisfies Record<LegendId, LegendaryMoveId | LegendaryMove2Id>

export type LegendaryId = keyof typeof LEGENDARY_MOVE_OF

/**
 * Multitype: the plate Arceus's Judgment takes in each biome, so its type
 * follows the land (the Meadow, Insect, Stone, Icicle and Spooky Plates).
 */
export const JUDGMENT_PLATES = {
  meadow: 'grass',
  forest: 'bug',
  cave: 'rock',
  snow: 'ice',
  tower: 'ghost',
} as const satisfies Record<BiomeId, PokeType>

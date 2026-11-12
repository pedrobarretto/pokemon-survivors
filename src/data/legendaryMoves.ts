import type { LegendaryMoveId } from '../game/legendaryMoves'
import type { LegendaryMove2Id } from '../game/legendaryMoves2'
import type { UltraMoveId } from '../game/ultraMoves'
import type { PathLegendMoveId } from '../game/pathLegendMoves'
import type { LegendaryMove3Id } from '../game/legendaryMoves3'
import type { LegendaryMove4Id } from '../game/legendaryMoves4'
import type { LegendaryMove5Id } from '../game/legendaryMoves5'
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
  terapagos: 'teraStarstorm',
  // The Ultra Beasts' (`game/ultraMoves.ts`): Blacephalon's own Mind Blown, and a move each is known by.
  nihilego: 'acidSpray',
  buzzwole: 'powerUpPunch',
  pheromosa: 'skitterSmack',
  xurkitree: 'tailGlow',
  celesteela: 'autotomize',
  kartana: 'guillotine',
  guzzlord: 'belch',
  stakataka: 'wideGuard',
  blacephalon: 'mindBlown',
  naganadel: 'fellStinger',
  poipole: 'poisonTail',
  zygarde: 'coreEnforcer',
  solgaleo: 'sunsteelStrike',
  lunala: 'moongeistBeam',
  kubfu: 'wickedBlow',
  meltan: 'doubleIronBash',
  regigigas: 'crushGrip',
  // The legends with a road of their own: the trios share their move, as the lake trio and the Swords do in the games.
  palkia: 'spacialRend',
  uxie: 'mysticalPower',
  mesprit: 'mysticalPower',
  azelf: 'mysticalPower',
  cobalion: 'retaliate',
  terrakion: 'retaliate',
  virizion: 'retaliate',
  keldeo: 'secretSword',
  hoopa: 'hyperspaceFury',
  // The Safári's: Manaphy's own Heart Swap.
  manaphy: 'heartSwap',
  // The Grande Atualização's mythicals (`game/legendaryMoves5.ts`): each its own signature.
  diancie: 'diamondStorm',
  zeraora: 'plasmaFists',
  ogerpon: 'ivyCudgel',
} as const satisfies Record<LegendId, LegendaryMoveId | LegendaryMove2Id | UltraMoveId | PathLegendMoveId | LegendaryMove3Id | LegendaryMove4Id | LegendaryMove5Id>

export type LegendaryId = keyof typeof LEGENDARY_MOVE_OF

/**
 * Multitype: the plate Arceus's Judgment takes in each biome, so its type
 * follows the land (the Meadow, Insect, Stone, Icicle and Spooky Plates; the Splash, Zap, Earth and Flame Plates on the beach, in the Power Plant, the desert and Mt. Chimney).
 */
export const JUDGMENT_PLATES = {
  meadow: 'grass',
  forest: 'bug',
  cave: 'rock',
  snow: 'ice',
  tower: 'ghost',
  beach: 'water',
  plant: 'electric',
  desert: 'ground',
  volcano: 'fire',
} as const satisfies Record<BiomeId, PokeType>

import type { MoveId } from '../game/moves'
import type { SpecialId } from '../game/special'
import type { StatDelta } from '../game/stats'
import type { BiomeId, WeatherId } from './biomes'
import { playableDex, type PlayableId } from './hatchlings'
import type { MegaId } from './megas'
import type { EvolutionStage } from './starters'
import type { PokeType } from './types'

/**
 * Branching evolutions: a family whose evolution can go more than one way
 * (Eevee's eight, Kirlia's Gardevoir or Gallade…), and the branch taken
 * replaces the line's stage from there on: its form, types, stat bonus,
 * special and a few more moves to learn. A branch that needs an item in the
 * official games (its item in `EVO_ITEMS`, `data/shop.ts`) needs it in a run
 * too, owned or found (`game/branch.ts` `evolutionOffers`): the others are
 * free (Gardevoir, Glalie, Poliwrath, and Eevee's three marked `free`, of
 * which a run without items gets one, drawn). The line in
 * `starters.ts`/`hatchlings.ts` keeps its usual form, which is what the
 * select screen shows first.
 */
export type BranchDef = {
  /** The family it branches off. */
  line: PlayableId
  /** Index of the stage it replaces in the line (1: the first evolution). */
  stage: number
  name: string
  dex: number
  types: readonly PokeType[]
  /** Stat bonus of the stage, in place of the line's. */
  bonus: StatDelta
  /** Moves the branch adds to the family's learnset once it evolves into it (on top of the line's lists). */
  moves: readonly MoveId[]
  /** The weather or biome that makes it the likelier draw among the free branches (`evolutionOffers`). */
  favors?: { weather?: readonly WeatherId[]; biome?: readonly BiomeId[] }
  /** Its special, when it isn't the one of its first type (`resolveSpecial`). */
  special?: SpecialId
  /** Free even though an item names it (Eevee's Water, Thunder and Fire Stones): the item only adds it to the choice. */
  free?: true
}

export const BRANCHES = {
  /* ---------- Eevee at Lv 20: one of the three free ones, drawn, or a choice with stones ---------- */
  vaporeon: {
    line: 'eevee', stage: 1, free: true, name: 'Vaporeon', dex: 134, types: ['water'],
    bonus: { maxHp: 90, regen: 0.4, armor: 1, might: 0.12 },
    moves: ['waterGun', 'whirlpool', 'brine', 'iceShard'],
    favors: { weather: ['rain'], biome: ['beach'] },
  },
  jolteon: {
    line: 'eevee', stage: 1, free: true, name: 'Jolteon', dex: 135, types: ['electric'],
    bonus: { maxHp: 40, speed: 10, cooldown: -0.08, might: 0.18 },
    moves: ['thunder', 'shockWave', 'electroBall', 'pinMissile'],
    favors: { weather: ['clear'], biome: ['plant'] },
  },
  flareon: {
    line: 'eevee', stage: 1, free: true, name: 'Flareon', dex: 136, types: ['fire'],
    bonus: { maxHp: 50, might: 0.3, statusDamage: 0.15 },
    moves: ['ember', 'fireSpin', 'willOWisp'],
    favors: { weather: ['sun'], biome: ['volcano'] },
  },
  espeon: {
    line: 'eevee', stage: 1, name: 'Espeon', dex: 196, types: ['psychic'],
    bonus: { maxHp: 45, might: 0.2, cooldown: -0.06, area: 0.1 },
    moves: ['psyshock', 'futureSight', 'spiritShackle'],
    favors: { weather: ['clear'] },
  },
  umbreon: {
    line: 'eevee', stage: 1, name: 'Umbreon', dex: 197, types: ['dark'],
    bonus: { maxHp: 60, armor: 2, might: 0.2, regen: 0.4 },
    moves: ['foulPlay', 'suckerPunch', 'toxicSpikes'],
    favors: { weather: ['fog'], biome: ['cave', 'tower'] },
  },
  leafeon: {
    line: 'eevee', stage: 1, name: 'Leafeon', dex: 470, types: ['grass'],
    bonus: { maxHp: 55, armor: 2, might: 0.22 },
    moves: ['leafBlade', 'razorLeaf', 'vineWhip'],
    favors: { biome: ['forest'] },
  },
  glaceon: {
    line: 'eevee', stage: 1, name: 'Glaceon', dex: 471, types: ['ice'],
    bonus: { maxHp: 45, might: 0.25, area: 0.1 },
    moves: ['iceShard', 'sheerCold', 'whirlpool'],
    favors: { weather: ['snow'], biome: ['snow'] },
  },
  sylveon: {
    line: 'eevee', stage: 1, name: 'Sylveon', dex: 700, types: ['fairy'],
    bonus: { maxHp: 55, regen: 0.6, might: 0.18, area: 0.05 },
    moves: ['disarmingVoice', 'psyshock', 'futureSight'],
    favors: { weather: ['clear'] },
  },

  /* ---------- Two ways ---------- */
  gardevoir: {
    line: 'ralts', stage: 2, name: 'Gardevoir', dex: 282, types: ['psychic', 'fairy'],
    bonus: { maxHp: 40, regen: 0.3, might: 0.2, area: 0.1 },
    moves: ['iceShard', 'shockWave', 'solarBeam'],
  },
  gallade: {
    line: 'ralts', stage: 2, name: 'Gallade', dex: 475, types: ['psychic', 'fighting'],
    bonus: { maxHp: 45, might: 0.28, speed: 5, armor: 1 },
    moves: ['sacredSword', 'leafBlade', 'machPunch'],
    special: 'closeCombat',
  },
  glalie: {
    line: 'snorunt', stage: 1, name: 'Glalie', dex: 362, types: ['ice'],
    bonus: { maxHp: 50, might: 0.22, area: 0.1, armor: 1 },
    moves: ['earthquake', 'rockTomb', 'crunch'],
  },
  froslass: {
    line: 'snorunt', stage: 1, name: 'Froslass', dex: 478, types: ['ice', 'ghost'],
    bonus: { maxHp: 40, might: 0.25, speed: 6, statusChance: 0.04 },
    moves: ['hex', 'willOWisp', 'disarmingVoice'],
    special: 'astralBarrage',
  },
  poliwrath: {
    line: 'poliwag', stage: 2, name: 'Poliwrath', dex: 62, types: ['water', 'fighting'],
    bonus: { maxHp: 50, might: 0.2, armor: 1, area: 0.05 },
    moves: ['dynamicPunch', 'machPunch', 'focusPunch'],
  },
  politoed: {
    line: 'poliwag', stage: 2, name: 'Politoed', dex: 186, types: ['water'],
    bonus: { maxHp: 50, regen: 0.5, might: 0.15, area: 0.1 },
    moves: ['sheerCold', 'waterShuriken', 'disarmingVoice'],
  },
  scizor: {
    line: 'scyther', stage: 1, name: 'Scizor', dex: 212, types: ['bug', 'steel'],
    bonus: { maxHp: 55, armor: 2, might: 0.22 },
    moves: ['machPunch', 'gyroBall', 'flashCannon'],
  },
  kleavor: {
    line: 'scyther', stage: 1, name: 'Kleavor', dex: 900, types: ['bug', 'rock'],
    bonus: { maxHp: 50, might: 0.3, area: 0.1 },
    moves: ['rockTomb', 'stealthRock', 'earthquake'],
    special: 'diamondStorm',
  },
  armarouge: {
    line: 'charcadet', stage: 1, name: 'Armarouge', dex: 936, types: ['fire', 'psychic'],
    bonus: { maxHp: 50, might: 0.25, area: 0.1, projectileSpeed: 0.15 },
    moves: ['psyshock', 'flashCannon', 'pyroBall'],
  },
  ceruledge: {
    line: 'charcadet', stage: 1, name: 'Ceruledge', dex: 937, types: ['fire', 'ghost'],
    bonus: { maxHp: 55, might: 0.3, speed: 4 },
    moves: ['solarBeam', 'spiritShackle', 'leafBlade'],
  },
} as const satisfies Record<string, BranchDef>

export type BranchId = keyof typeof BRANCHES

export const BRANCH_IDS = Object.keys(BRANCHES) as BranchId[]

/** The Megas only one branch can reach: Glalie's, Gardevoir's, Gallade's and Scizor's. */
export const MEGA_BRANCH: Partial<Record<MegaId, BranchId>> = { glalie: 'glalie', gardevoir: 'gardevoir', gallade: 'gallade', scizor: 'scizor' }

/** How much likelier a free branch the run's weather or biome favors is drawn than the others (`evolutionOffers`). */
export const BRANCH_FAVOR_WEIGHT = 3

/** A family's branches, in data order (empty for the lines that don't branch). */
export const branchesOf = (line: PlayableId): readonly BranchId[] => BRANCH_IDS.filter((id) => BRANCHES[id].line === line)

/** The branches the evolution into `stage` chooses between. */
export const branchesAt = (line: PlayableId, stage: number): readonly BranchId[] => branchesOf(line).filter((id) => BRANCHES[id].stage === stage)

/** A branch as a stage of its line. */
export const branchStage = (id: BranchId): EvolutionStage => {
  const b = BRANCHES[id]
  return { dex: b.dex, name: b.name, types: b.types, bonus: b.bonus }
}

/** Every dex number a family can show: its line and its branches (preloads). */
export const familyDex = (line: PlayableId) => [...new Set([...playableDex(line), ...branchesOf(line).map((id) => BRANCHES[id].dex)])]

export const isBranch = (v: unknown): v is BranchId => typeof v === 'string' && Object.hasOwn(BRANCHES, v)

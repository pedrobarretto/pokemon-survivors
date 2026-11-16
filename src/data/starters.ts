import type { MoveId } from '../game/moves'
import type { StatDelta } from '../game/stats'
import type { EvoItemId } from './shop'
import type { PokeType } from './types'

export type EvolutionStage = {
  dex: number
  name: string
  types: readonly PokeType[]
  /** Level at which this stage evolves into the next one. */
  evolveAt?: number
  /**
   * The evolution item the line needs to evolve into this stage (Porygon2's
   * Up-Grade): without it the run holds the stage before, as strong as with
   * an Everstone, until it's owned or found (`game/evoGate.ts`).
   */
  item?: EvoItemId
  /** Stat bonus granted when reaching this stage. */
  bonus: StatDelta
}

/** What every playable Pokémon shares: the 27 starters, the families that hatch from eggs (`hatchlings.ts`) and the legends (`legends.ts`). */
export type PlayableDef = {
  name: string
  color: string
  stats: StatDelta
  /** Move the run starts with (in the first stage's list). */
  signature: MoveId
  /**
   * Moves it learns on level up, one list per stage of `line`: the first is
   * there from the start, each evolution adds the next (`runLearnset`), the
   * way a Charmeleon learns what a Charmander can't. The rules every family
   * follows (sizes, signature, types, how widely a move is shared) are tested
   * in `learnsets.test.ts`.
   */
  learnset:
    | readonly [readonly MoveId[]]
    | readonly [readonly MoveId[], readonly MoveId[]]
    | readonly [readonly MoveId[], readonly MoveId[], readonly MoveId[]]
  /** Two or three stages, the last one the final evolution; a legend's single stage never evolves (it awakens, `game/legend.ts`). */
  line: readonly [EvolutionStage] | readonly [EvolutionStage, EvolutionStage] | readonly [EvolutionStage, EvolutionStage, EvolutionStage]
}

export type StarterDef = PlayableDef & {
  learnset: readonly [readonly MoveId[], readonly MoveId[], readonly MoveId[]]
  line: readonly [EvolutionStage, EvolutionStage, EvolutionStage]
}

/** Builds a 3-stage line that evolves at Lv 12 and Lv 28. */
const line = (
  [a, b, c]: readonly [string, string, string],
  dex: number,
  types: readonly [readonly PokeType[], readonly PokeType[], readonly PokeType[]],
  bonuses: readonly [StatDelta, StatDelta],
) =>
  [
    { dex, name: a, types: types[0], evolveAt: 12, bonus: {} },
    { dex: dex + 1, name: b, types: types[1], evolveAt: 28, bonus: bonuses[0] },
    { dex: dex + 2, name: c, types: types[2], bonus: bonuses[1] },
  ] as const satisfies StarterDef['line']

export const STARTERS = {
  /* ---------- Kanto ---------- */
  bulbasaur: {
    name: 'Bulbasaur',
    color: '#78c850',
    stats: { regen: 0.4, maxHp: 10 },
    signature: 'leechSeed',
    learnset: [['leechSeed', 'vineWhip', 'razorLeaf', 'sludgeBomb', 'solarBeam', 'drumBeating'], ['venoshock', 'toxicSpikes'], ['pinMissile', 'gyroBall']],
    line: line(['Bulbasaur', 'Ivysaur', 'Venusaur'], 1, [['grass', 'poison'], ['grass', 'poison'], ['grass', 'poison']], [
      { maxHp: 30, regen: 0.4, might: 0.08 },
      { maxHp: 45, regen: 0.6, might: 0.15, area: 0.15 },
    ]),
  },
  charmander: {
    name: 'Charmander',
    color: '#f08030',
    stats: { might: 0.15, maxHp: -10 },
    signature: 'ember',
    learnset: [['ember', 'fireSpin', 'dragonBreath', 'pyroBall', 'flameWheel', 'willOWisp'], ['dragonTail', 'solarBeam'], ['gust', 'roost']],
    line: line(['Charmander', 'Charmeleon', 'Charizard'], 4, [['fire'], ['fire'], ['fire', 'flying']], [
      { maxHp: 25, might: 0.1, speed: 3 },
      { maxHp: 40, might: 0.2, speed: 6, area: 0.1 },
    ]),
  },
  squirtle: {
    name: 'Squirtle',
    color: '#6890f0',
    stats: { maxHp: 20, armor: 1, speed: -3 },
    signature: 'rapidSpin',
    learnset: [['rapidSpin', 'waterGun', 'razorShell', 'iceShard', 'whirlpool', 'flashCannon'], ['brine', 'sheerCold'], ['gyroBall', 'waterShuriken']],
    line: line(['Squirtle', 'Wartortle', 'Blastoise'], 7, [['water'], ['water'], ['water']], [
      { maxHp: 35, armor: 1, might: 0.05 },
      { maxHp: 50, armor: 2, might: 0.15, amount: 1 },
    ]),
  },

  /* ---------- Johto ---------- */
  chikorita: {
    name: 'Chikorita',
    color: '#a8d868',
    stats: { maxHp: 25, regen: 0.3, speed: -4, might: -0.05 },
    signature: 'petalDance',
    learnset: [['petalDance', 'razorLeaf', 'vineWhip', 'disarmingVoice', 'solarBeam', 'drumBeating'], ['rockTomb', 'roost'], ['sludgeBomb', 'leafBlade']],
    line: line(['Chikorita', 'Bayleef', 'Meganium'], 152, [['grass'], ['grass'], ['grass']], [
      { maxHp: 30, regen: 0.3, area: 0.05 },
      { maxHp: 55, regen: 0.7, armor: 1, area: 0.15 },
    ]),
  },
  cyndaquil: {
    name: 'Cyndaquil',
    color: '#f8a040',
    stats: { area: 0.15, duration: 0.15, maxHp: -5 },
    signature: 'eruption',
    learnset: [['eruption', 'ember', 'flameWheel', 'swift', 'quickAttack', 'willOWisp'], ['fireSpin', 'solarBeam'], ['pyroBall', 'shockWave']],
    line: line(['Cyndaquil', 'Quilava', 'Typhlosion'], 155, [['fire'], ['fire'], ['fire']], [
      { maxHp: 25, might: 0.08, area: 0.1 },
      { maxHp: 40, might: 0.18, area: 0.15, speed: 4 },
    ]),
  },
  totodile: {
    name: 'Totodile',
    color: '#58a8e8',
    stats: { might: 0.12, armor: 1, speed: -2 },
    signature: 'thrash',
    learnset: [['thrash', 'waterGun', 'crunch', 'iceShard', 'razorShell', 'brine'], ['dragonTail', 'whirlpool'], ['sheerCold', 'waterShuriken']],
    line: line(['Totodile', 'Croconaw', 'Feraligatr'], 158, [['water'], ['water'], ['water']], [
      { maxHp: 30, might: 0.1, armor: 1 },
      { maxHp: 50, might: 0.22, armor: 1, speed: 3 },
    ]),
  },

  /* ---------- Hoenn ---------- */
  treecko: {
    name: 'Treecko',
    color: '#58b858',
    stats: { speed: 10, cooldown: -0.06, maxHp: -15 },
    signature: 'leafBlade',
    learnset: [['leafBlade', 'razorLeaf', 'pinMissile', 'quickAttack', 'solarBeam', 'drumBeating'], ['dragonTail', 'dragonBreath'], ['vineWhip', 'venoshock']],
    line: line(['Treecko', 'Grovyle', 'Sceptile'], 252, [['grass'], ['grass'], ['grass']], [
      { maxHp: 20, speed: 4, cooldown: -0.04 },
      { maxHp: 35, speed: 6, might: 0.15, cooldown: -0.06 },
    ]),
  },
  torchic: {
    name: 'Torchic',
    color: '#f87838',
    stats: { might: 0.1, speed: 4, maxHp: -5 },
    signature: 'doubleKick',
    learnset: [['doubleKick', 'ember', 'fireSpin', 'quickAttack', 'pyroBall', 'focusPunch'], ['machPunch', 'flameWheel'], ['gust', 'solarBeam']],
    line: line(['Torchic', 'Combusken', 'Blaziken'], 255, [['fire'], ['fire', 'fighting'], ['fire', 'fighting']], [
      { maxHp: 25, might: 0.12, speed: 3 },
      { maxHp: 40, might: 0.25, speed: 4 },
    ]),
  },
  mudkip: {
    name: 'Mudkip',
    color: '#4890d8',
    stats: { maxHp: 30, armor: 1, speed: -5 },
    signature: 'mudShot',
    learnset: [['mudShot', 'waterGun', 'whirlpool', 'rockTomb', 'earthquake', 'stealthRock'], ['brine', 'razorShell'], ['waterShuriken', 'sludgeBomb']],
    line: line(['Mudkip', 'Marshtomp', 'Swampert'], 258, [['water'], ['water', 'ground'], ['water', 'ground']], [
      { maxHp: 35, armor: 1, might: 0.05 },
      { maxHp: 60, armor: 2, might: 0.12, area: 0.1 },
    ]),
  },

  /* ---------- Sinnoh ---------- */
  turtwig: {
    name: 'Turtwig',
    color: '#88b848',
    stats: { maxHp: 40, armor: 2, speed: -9, cooldown: 0.05 },
    signature: 'woodHammer',
    learnset: [['woodHammer', 'razorLeaf', 'vineWhip', 'leafBlade', 'solarBeam', 'earthquake'], ['gyroBall', 'drumBeating'], ['stealthRock', 'pinMissile']],
    line: line(['Turtwig', 'Grotle', 'Torterra'], 387, [['grass'], ['grass'], ['grass', 'ground']], [
      { maxHp: 40, armor: 1, might: 0.05 },
      { maxHp: 70, armor: 2, might: 0.15, area: 0.2 },
    ]),
  },
  chimchar: {
    name: 'Chimchar',
    color: '#e86830',
    stats: { speed: 8, cooldown: -0.08, maxHp: 5 },
    signature: 'machPunch',
    learnset: [['machPunch', 'ember', 'flameWheel', 'torchSong', 'fireSpin', 'focusPunch'], ['uTurn', 'pyroBall'], ['stealthRock', 'shockWave']],
    line: line(['Chimchar', 'Monferno', 'Infernape'], 390, [['fire'], ['fire', 'fighting'], ['fire', 'fighting']], [
      { maxHp: 25, speed: 3, might: 0.1 },
      { maxHp: 35, speed: 5, might: 0.2, cooldown: -0.06 },
    ]),
  },
  piplup: {
    name: 'Piplup',
    color: '#5878c8',
    stats: { armor: 1, might: 0.05, projectileSpeed: 0.1 },
    signature: 'drillPeck',
    learnset: [['drillPeck', 'waterGun', 'brine', 'iceShard', 'whirlpool', 'flashCannon'], ['razorShell', 'sheerCold'], ['gyroBall', 'waterShuriken']],
    line: line(['Piplup', 'Prinplup', 'Empoleon'], 393, [['water'], ['water'], ['water', 'steel']], [
      { maxHp: 30, armor: 1, might: 0.06 },
      { maxHp: 45, armor: 2, might: 0.16, area: 0.1 },
    ]),
  },

  /* ---------- Unova ---------- */
  snivy: {
    name: 'Snivy',
    color: '#68b848',
    stats: { speed: 6, cooldown: -0.05, magnet: 12 },
    signature: 'leafTornado',
    learnset: [['leafTornado', 'vineWhip', 'razorLeaf', 'swift', 'leafBlade', 'solarBeam'], ['drumBeating', 'venoshock'], ['dragonBreath', 'dragonTail']],
    line: line(['Snivy', 'Servine', 'Serperior'], 495, [['grass'], ['grass'], ['grass']], [
      { maxHp: 25, speed: 3, cooldown: -0.04 },
      { maxHp: 40, speed: 5, might: 0.14, area: 0.1 },
    ]),
  },
  tepig: {
    name: 'Tepig',
    color: '#e86040',
    stats: { maxHp: 25, might: 0.08, speed: -4 },
    signature: 'flameCharge',
    learnset: [['flameCharge', 'ember', 'sludgeBomb', 'torchSong', 'machPunch', 'earthquake'], ['fireSpin', 'pyroBall'], ['focusPunch', 'selfDestruct']],
    line: line(['Tepig', 'Pignite', 'Emboar'], 498, [['fire'], ['fire', 'fighting'], ['fire', 'fighting']], [
      { maxHp: 30, might: 0.08 },
      { maxHp: 55, might: 0.2, armor: 1 },
    ]),
  },
  oshawott: {
    name: 'Oshawott',
    color: '#68a8e0',
    stats: { might: 0.06, armor: 1 },
    signature: 'razorShell',
    learnset: [['razorShell', 'waterGun', 'waterShuriken', 'swift', 'whirlpool', 'sheerCold'], ['brine', 'pinMissile'], ['suckerPunch', 'leafBlade']],
    line: line(['Oshawott', 'Dewott', 'Samurott'], 501, [['water'], ['water'], ['water']], [
      { maxHp: 30, might: 0.08, area: 0.05 },
      { maxHp: 45, might: 0.18, armor: 1, area: 0.1 },
    ]),
  },

  /* ---------- Kalos ---------- */
  chespin: {
    name: 'Chespin',
    color: '#80b050',
    stats: { maxHp: 15, armor: 1, speed: -6 },
    signature: 'needleArm',
    learnset: [['needleArm', 'vineWhip', 'pinMissile', 'toxicSpikes', 'machPunch', 'drumBeating'], ['gyroBall', 'razorLeaf'], ['leafBlade', 'stealthRock']],
    line: line(['Chespin', 'Quilladin', 'Chesnaught'], 650, [['grass'], ['grass'], ['grass', 'fighting']], [
      { maxHp: 35, armor: 1, might: 0.05 },
      { maxHp: 60, armor: 2, might: 0.15, area: 0.1 },
    ]),
  },
  fennekin: {
    name: 'Fennekin',
    color: '#f09048',
    stats: { area: 0.1, duration: 0.2, might: 0.05, maxHp: 5 },
    signature: 'psybeam',
    learnset: [['psybeam', 'ember', 'fireSpin', 'psyshock', 'willOWisp', 'futureSight'], ['flameWheel', 'torchSong'], ['disarmingVoice', 'spiritShackle']],
    line: line(['Fennekin', 'Braixen', 'Delphox'], 653, [['fire'], ['fire'], ['fire', 'psychic']], [
      { maxHp: 20, might: 0.1, area: 0.05 },
      { maxHp: 35, might: 0.2, area: 0.15, cooldown: -0.05 },
    ]),
  },
  froakie: {
    name: 'Froakie',
    color: '#58a0d8',
    stats: { speed: 12, projectileSpeed: 0.15, maxHp: -5 },
    signature: 'waterShuriken',
    learnset: [['waterShuriken', 'waterGun', 'quickAttack', 'razorShell', 'brine', 'futureSight'], ['uTurn', 'sludgeBomb'], ['toxicSpikes', 'spiritShackle']],
    line: line(['Froakie', 'Frogadier', 'Greninja'], 656, [['water'], ['water'], ['water', 'dark']], [
      { maxHp: 20, speed: 4, might: 0.08 },
      { maxHp: 30, speed: 6, might: 0.2, amount: 1 },
    ]),
  },

  /* ---------- Alola ---------- */
  rowlet: {
    name: 'Rowlet',
    color: '#a8a060',
    stats: { projectileSpeed: 0.1, magnet: 15, might: 0.05 },
    signature: 'spiritShackle',
    learnset: [['spiritShackle', 'razorLeaf', 'gust', 'leafBlade', 'roost', 'hex'], ['pinMissile', 'drumBeating'], ['solarBeam', 'suckerPunch']],
    line: line(['Rowlet', 'Dartrix', 'Decidueye'], 722, [['grass', 'flying'], ['grass', 'flying'], ['grass', 'ghost']], [
      { maxHp: 25, might: 0.08, projectileSpeed: 0.05 },
      { maxHp: 40, might: 0.18, projectileSpeed: 0.1, amount: 1 },
    ]),
  },
  litten: {
    name: 'Litten',
    color: '#d84848',
    stats: { might: 0.12, maxHp: 5, speed: -2 },
    signature: 'darkestLariat',
    learnset: [['darkestLariat', 'ember', 'fireSpin', 'torchSong', 'willOWisp', 'focusPunch'], ['uTurn', 'suckerPunch'], ['flameWheel', 'pyroBall']],
    line: line(['Litten', 'Torracat', 'Incineroar'], 725, [['fire'], ['fire'], ['fire', 'dark']], [
      { maxHp: 30, might: 0.1, armor: 1 },
      { maxHp: 55, might: 0.22, armor: 1 },
    ]),
  },
  popplio: {
    name: 'Popplio',
    color: '#78b8f0',
    stats: { regen: 0.25, area: 0.1, duration: 0.1 },
    signature: 'sparklingAria',
    learnset: [['sparklingAria', 'waterGun', 'disarmingVoice', 'echoedVoice', 'whirlpool', 'psyshock'], ['iceShard', 'razorShell'], ['sheerCold', 'torchSong']],
    line: line(['Popplio', 'Brionne', 'Primarina'], 728, [['water'], ['water'], ['water', 'fairy']], [
      { maxHp: 25, regen: 0.3, area: 0.05 },
      { maxHp: 40, regen: 0.5, might: 0.15, area: 0.1 },
    ]),
  },

  /* ---------- Galar ---------- */
  grookey: {
    name: 'Grookey',
    color: '#68b040',
    stats: { area: 0.15, maxHp: 10, cooldown: 0.03 },
    signature: 'drumBeating',
    learnset: [['drumBeating', 'razorLeaf', 'vineWhip', 'swift', 'woodHammer', 'earthquake'], ['uTurn', 'leafBlade'], ['machPunch', 'solarBeam']],
    line: line(['Grookey', 'Thwackey', 'Rillaboom'], 810, [['grass'], ['grass'], ['grass']], [
      { maxHp: 30, might: 0.08, area: 0.05 },
      { maxHp: 50, might: 0.18, area: 0.15, armor: 1 },
    ]),
  },
  scorbunny: {
    name: 'Scorbunny',
    color: '#f05838',
    stats: { speed: 10, might: 0.08, maxHp: -15 },
    signature: 'pyroBall',
    learnset: [['pyroBall', 'ember', 'quickAttack', 'doubleKick', 'uTurn', 'electroBall'], ['flameWheel', 'torchSong'], ['venoshock', 'sludgeBomb']],
    line: line(['Scorbunny', 'Raboot', 'Cinderace'], 813, [['fire'], ['fire'], ['fire']], [
      { maxHp: 25, speed: 3, might: 0.1 },
      { maxHp: 35, speed: 5, might: 0.22, area: 0.1 },
    ]),
  },
  sobble: {
    name: 'Sobble',
    color: '#5898e0',
    stats: { projectileSpeed: 0.25, might: 0.1, maxHp: -15, speed: -2 },
    signature: 'snipeShot',
    learnset: [['snipeShot', 'waterGun', 'uTurn', 'waterShuriken', 'spiritShackle', 'electroBall'], ['iceShard', 'razorShell'], ['gust', 'sheerCold']],
    line: line(['Sobble', 'Drizzile', 'Inteleon'], 816, [['water'], ['water'], ['water']], [
      { maxHp: 20, might: 0.1, projectileSpeed: 0.1 },
      { maxHp: 35, might: 0.22, projectileSpeed: 0.15, amount: 1 },
    ]),
  },

  /* ---------- Paldea ---------- */
  sprigatito: {
    name: 'Sprigatito',
    color: '#78c068',
    stats: { cooldown: -0.06, growth: 0.1, maxHp: -5 },
    signature: 'flowerTrick',
    learnset: [['flowerTrick', 'razorLeaf', 'leafBlade', 'swift', 'suckerPunch', 'vineWhip'], ['uTurn', 'drumBeating'], ['spiritShackle', 'gust']],
    line: line(['Sprigatito', 'Floragato', 'Meowscarada'], 906, [['grass'], ['grass'], ['grass', 'dark']], [
      { maxHp: 25, might: 0.08, cooldown: -0.03 },
      { maxHp: 35, might: 0.2, speed: 4, cooldown: -0.05 },
    ]),
  },
  fuecoco: {
    name: 'Fuecoco',
    color: '#f06848',
    stats: { maxHp: 30, regen: 0.15, speed: -6 },
    signature: 'torchSong',
    learnset: [['torchSong', 'ember', 'crunch', 'fireSpin', 'hex', 'spiritShackle'], ['willOWisp', 'pyroBall'], ['flameWheel', 'solarBeam']],
    line: line(['Fuecoco', 'Crocalor', 'Skeledirge'], 909, [['fire'], ['fire'], ['fire', 'ghost']], [
      { maxHp: 35, might: 0.08, regen: 0.15 },
      { maxHp: 60, might: 0.18, regen: 0.3, area: 0.1 },
    ]),
  },
  quaxly: {
    name: 'Quaxly',
    color: '#68a8f0',
    stats: { speed: 6, might: 0.06, duration: 0.1 },
    signature: 'aquaStep',
    learnset: [['aquaStep', 'waterGun', 'gust', 'quickAttack', 'waterShuriken', 'razorShell'], ['machPunch', 'roost'], ['focusPunch', 'uTurn']],
    line: line(['Quaxly', 'Quaxwell', 'Quaquaval'], 912, [['water'], ['water'], ['water', 'fighting']], [
      { maxHp: 25, speed: 3, might: 0.08 },
      { maxHp: 40, speed: 5, might: 0.2, cooldown: -0.05 },
    ]),
  },
} as const satisfies Record<string, StarterDef>

export type StarterId = keyof typeof STARTERS

export const STARTER_IDS = Object.keys(STARTERS) as StarterId[]

export const starterDex = (id: StarterId) => STARTERS[id].line.map((s) => s.dex)

export type Region = { name: string; gen: number; starters: readonly [StarterId, StarterId, StarterId] }

/** Main-series regions, in release order, each with its grass/fire/water trio. */
export const REGIONS: readonly Region[] = [
  { name: 'Kanto', gen: 1, starters: ['bulbasaur', 'charmander', 'squirtle'] },
  { name: 'Johto', gen: 2, starters: ['chikorita', 'cyndaquil', 'totodile'] },
  { name: 'Hoenn', gen: 3, starters: ['treecko', 'torchic', 'mudkip'] },
  { name: 'Sinnoh', gen: 4, starters: ['turtwig', 'chimchar', 'piplup'] },
  { name: 'Unova', gen: 5, starters: ['snivy', 'tepig', 'oshawott'] },
  { name: 'Kalos', gen: 6, starters: ['chespin', 'fennekin', 'froakie'] },
  { name: 'Alola', gen: 7, starters: ['rowlet', 'litten', 'popplio'] },
  { name: 'Galar', gen: 8, starters: ['grookey', 'scorbunny', 'sobble'] },
  { name: 'Paldea', gen: 9, starters: ['sprigatito', 'fuecoco', 'quaxly'] },
]

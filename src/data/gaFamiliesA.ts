import type { BranchDef } from './branches'
import { line2, line3, type HatchlingDef } from './playableLines'

/**
 * The big update's first 15 families, each with a mechanic of its own
 * (`game/gaKitARules.ts` has the numbers, `gaKitASystem.ts` runs them on
 * `Player.kitA`). Their signatures live in `game/gaKitAMoves.ts` and their
 * words in `i18n/gaFamiliesA.ts`. Sinistea's Polteageist and Nincada's
 * Ninjask and Shedinja are branches (`GA_BRANCHES_A`); Sableye has a Mega
 * (`data/megas.ts`). Lapras (the Safari's cove) and Spiritomb (the
 * graveyard's keystone) hatch from no egg: their way in is their own.
 */
export const GA_FAMILIES_A = {
  jangmoo: {
    name: 'Jangmo-o', color: '#c8b0a0', egg: 'ultra', stats: { armor: 1, might: 0.06, maxHp: -5 }, signature: 'clangingScales',
    learnset: [['clangingScales', 'dragonBreath', 'machPunch', 'rockTomb'], ['dragonTail', 'drumBeating', 'earthquake'], ['flashCannon', 'stealthRock', 'gyroBall']],
    line: line3(['Jangmo-o', 782, ['dragon']], ['Hakamo-o', 783, ['dragon', 'fighting']], ['Kommo-o', 784, ['dragon', 'fighting']], [
      { maxHp: 25, might: 0.12, armor: 1 },
      { maxHp: 45, might: 0.26 },
    ]),
  },
  axew: {
    name: 'Axew', color: '#90a050', egg: 'ultra', stats: { might: 0.08, speed: 2, maxHp: -5 }, signature: 'dualChop',
    learnset: [['dualChop', 'dragonBreath', 'xScissor', 'crunch'], ['dragonTail', 'shadowClaw', 'razorShell'], ['earthquake', 'stealthRock', 'rockTomb']],
    line: line3(['Axew', 610, ['dragon']], ['Fraxure', 611, ['dragon']], ['Haxorus', 612, ['dragon']], [
      { maxHp: 25, might: 0.12 },
      { maxHp: 40, might: 0.28, speed: 3 },
    ]),
  },
  lapras: {
    name: 'Lapras', color: '#5898d0', egg: 'found', stats: { maxHp: 45, might: 0.18, armor: 1, area: 0.08, speed: -4 }, signature: 'sing',
    learnset: [['sing', 'waterGun', 'iceShard', 'whirlpool', 'sheerCold', 'brine', 'thunder', 'dragonPulse', 'perishSong']],
    line: [{ name: 'Lapras', dex: 131, types: ['water', 'ice'], bonus: {} }],
  },
  sneasel: {
    name: 'Sneasel', color: '#404868', egg: 'rare', stats: { speed: 6, might: 0.04, maxHp: -10 }, signature: 'beatUp',
    learnset: [['beatUp', 'iceShard', 'quickAttack', 'suckerPunch'], ['sheerCold', 'nightSlash', 'poisonJab', 'uTurn', 'crunch']],
    line: line2(['Sneasel', 215, ['dark', 'ice']], ['Weavile', 461, ['dark', 'ice']], { maxHp: 40, speed: 4, might: 0.24 }),
  },
  heracross: {
    name: 'Heracross', color: '#3868b0', egg: 'rare', stats: { maxHp: 35, might: 0.2, armor: 1, speed: -3 }, signature: 'hornAttack',
    learnset: [['hornAttack', 'pinMissile', 'machPunch', 'focusPunch', 'uTurn', 'gust', 'rockTomb', 'leafBlade', 'razorLeaf']],
    line: [{ name: 'Heracross', dex: 214, types: ['bug', 'fighting'], bonus: {} }],
  },
  sableye: {
    name: 'Sableye', color: '#5848a0', egg: 'rare', stats: { maxHp: 20, might: 0.14, cooldown: -0.04, magnet: 0.15 }, signature: 'shadowSneak',
    learnset: [['shadowSneak', 'hex', 'suckerPunch', 'spiritShackle', 'willOWisp', 'flashCannon', 'psyshock', 'toxicSpikes', 'crunch']],
    line: [{ name: 'Sableye', dex: 302, types: ['dark', 'ghost'], bonus: {} }],
  },
  spiritomb: {
    name: 'Spiritomb', color: '#685088', egg: 'found', stats: { maxHp: 20, might: 0.12, area: 0.06, speed: -2 }, signature: 'ominousWind',
    learnset: [['ominousWind', 'hex', 'suckerPunch', 'spiritShackle', 'psyshock', 'futureSight', 'willOWisp', 'toxicSpikes', 'pinMissile']],
    line: [{ name: 'Spiritomb', dex: 442, types: ['ghost', 'dark'], bonus: {} }],
  },
  croagunk: {
    name: 'Croagunk', color: '#5878c8', egg: 'rare', stats: { statusChance: 0.04, speed: 2, maxHp: -5 }, signature: 'poisonJab',
    learnset: [['poisonJab', 'machPunch', 'suckerPunch', 'toxicSpikes'], ['venoshock', 'focusPunch', 'sludgeBomb', 'thunderPunch', 'earthquake']],
    line: line2(['Croagunk', 453, ['poison', 'fighting']], ['Toxicroak', 454, ['poison', 'fighting']], { maxHp: 45, might: 0.24, statusDamage: 0.1 }),
  },
  sinistea: {
    name: 'Sinistea', color: '#c89068', egg: 'rare', stats: { maxHp: -15, speed: 3, area: 0.06, cooldown: -0.03 }, signature: 'teatime',
    learnset: [['teatime', 'hex', 'spiritShackle', 'disarmingVoice'], ['ominousWind', 'razorLeaf', 'futureSight', 'solarBeam', 'whirlpool']],
    line: line2(['Sinistea', 854, ['ghost']], ['Polteageist', 855, ['ghost']], { maxHp: 40, might: 0.24, area: 0.1 }),
  },
  impidimp: {
    name: 'Impidimp', color: '#c05878', egg: 'rare', stats: { speed: 4, statusChance: 0.04, maxHp: -5 }, signature: 'falseSurrender',
    learnset: [['falseSurrender', 'disarmingVoice', 'suckerPunch', 'playRough'], ['crunch', 'machPunch', 'leafBlade'], ['focusPunch', 'venoshock', 'sludgeBomb']],
    line: line3(['Impidimp', 859, ['dark', 'fairy']], ['Morgrem', 860, ['dark', 'fairy']], ['Grimmsnarl', 861, ['dark', 'fairy']], [
      { maxHp: 25, might: 0.1, speed: 2 },
      { maxHp: 50, might: 0.24, armor: 1 },
    ]),
  },
  pawmi: {
    name: 'Pawmi', color: '#f0a040', egg: 'common', stats: { speed: 5, maxHp: -10 }, signature: 'nuzzle',
    learnset: [['nuzzle', 'electroBall', 'quickAttack', 'disarmingVoice'], ['shockWave', 'focusPunch', 'uTurn'], ['thunder', 'gyroBall', 'swift']],
    line: line3(['Pawmi', 921, ['electric']], ['Pawmo', 922, ['electric', 'fighting']], ['Pawmot', 923, ['electric', 'fighting']], [
      { maxHp: 20, might: 0.1, speed: 2 },
      { maxHp: 40, might: 0.24, speed: 3 },
    ]),
  },
  rookidee: {
    name: 'Rookidee', color: '#4870b8', egg: 'common', stats: { speed: 4, maxHp: -5 }, signature: 'steelWing',
    learnset: [['steelWing', 'gust', 'drillPeck', 'roost'], ['uTurn', 'suckerPunch', 'flashCannon'], ['gyroBall', 'ironDefense', 'heavySlam']],
    line: line3(['Rookidee', 821, ['flying']], ['Corvisquire', 822, ['flying']], ['Corviknight', 823, ['flying', 'steel']], [
      { maxHp: 25, might: 0.1, speed: 2 },
      { maxHp: 50, armor: 2, might: 0.2 },
    ]),
  },
  elekid: {
    name: 'Elekid', color: '#f0d040', egg: 'rare', stats: { speed: 3, might: 0.04, maxHp: -5 }, signature: 'thunderPunch',
    learnset: [['thunderPunch', 'electroBall', 'swift', 'firePunch'], ['shockWave', 'crossChop', 'thunder'], ['iceShard', 'gyroBall', 'fireSpin']],
    line: line3(['Elekid', 239, ['electric']], ['Electabuzz', 125, ['electric']], ['Electivire', 466, ['electric']], [
      { maxHp: 25, might: 0.12 },
      { maxHp: 45, might: 0.26, armor: 1 },
    ]),
  },
  magby: {
    name: 'Magby', color: '#e85838', egg: 'rare', stats: { might: 0.06, statusChance: 0.03, maxHp: -5 }, signature: 'flameBurst',
    learnset: [['flameBurst', 'ember', 'flameWheel', 'sludgeBomb'], ['fireSpin', 'willOWisp', 'pyroBall'], ['solarBeam', 'thunder', 'futureSight']],
    line: line3(['Magby', 240, ['fire']], ['Magmar', 126, ['fire']], ['Magmortar', 467, ['fire']], [
      { maxHp: 25, might: 0.12 },
      { maxHp: 45, might: 0.26, area: 0.08 },
    ]),
  },
  nincada: {
    name: 'Nincada', color: '#a8a868', egg: 'common', stats: { speed: 3, armor: 1, maxHp: -5 }, signature: 'bugBite',
    learnset: [['bugBite', 'pinMissile', 'earthquake', 'quickAttack'], ['dualWingbeat', 'gust', 'roost', 'rockTomb', 'swift']],
    line: line2(['Nincada', 290, ['bug', 'ground']], ['Ninjask', 291, ['bug', 'flying']], { maxHp: 25, speed: 10, might: 0.2, cooldown: -0.05 }),
  },
} as const satisfies Record<string, HatchlingDef>

export type GaFamilyAId = keyof typeof GA_FAMILIES_A

export const GA_FAMILY_A_IDS = Object.keys(GA_FAMILIES_A) as GaFamilyAId[]

export const GA_FAMILIES_A_ABILITIES = {
  jangmoo: ['bulletproof', 'punkRock', 'steadfast'],
  axew: ['moldBreaker', 'unnerve', 'hustle'],
  lapras: ['waterAbsorb', 'shellArmor', 'hydration'],
  sneasel: ['innerFocus', 'keenEye', 'pickup'],
  heracross: ['guts', 'swarm', 'moxie'],
  sableye: ['keenEye', 'pickup', 'unnerve'],
  spiritomb: ['pressure', 'infiltrator', 'cursedBody'],
  croagunk: ['poisonPoint', 'ironFist', 'hydration'],
  sinistea: ['weakArmor', 'cursedBody', 'regenerator'],
  impidimp: ['frisk', 'magician', 'unnerve'],
  pawmi: ['voltAbsorb', 'naturalCure', 'ironFist'],
  rookidee: ['keenEye', 'unnerve', 'pressure'],
  elekid: ['static', 'vitalSpirit', 'ironFist'],
  magby: ['flameBody', 'vitalSpirit', 'flashFire'],
  nincada: ['speedBoost', 'infiltrator', 'keenEye'],
} as const

/**
 * The families' branches. Ninjask is Nincada's own way (free); the Shed Shell
 * opens Shedinja beside it. Polteageist comes from the Cracked Pot or none
 * (free); the Chipped Pot opens its Antique Form, whose tea is the real thing.
 */
export const GA_BRANCHES_A = {
  ninjask: {
    line: 'nincada', stage: 1, name: 'Ninjask', dex: 291, types: ['bug', 'flying'],
    bonus: { maxHp: 25, speed: 10, might: 0.2, cooldown: -0.05 },
    moves: [],
  },
  shedinja: {
    line: 'nincada', stage: 1, name: 'Shedinja', dex: 292, types: ['bug', 'ghost'],
    bonus: { maxHp: -30, might: 0.3, area: 0.1, speed: 2 },
    moves: ['hex', 'spiritShackle'],
    special: 'astralBarrage',
  },
  polteageist: {
    line: 'sinistea', stage: 1, free: true, name: 'Polteageist', dex: 855, types: ['ghost'],
    bonus: { maxHp: 40, might: 0.24, area: 0.1 },
    moves: ['willOWisp'],
  },
  polteageistAntique: {
    line: 'sinistea', stage: 1, name: 'Antique Polteageist', dex: 855, types: ['ghost'],
    bonus: { maxHp: 45, might: 0.26, area: 0.12 },
    moves: ['willOWisp'],
  },
} as const satisfies Record<string, BranchDef>

export const GA_BRANCHES_A_ABILITIES = {
  ninjask: ['speedBoost', 'infiltrator', 'unburden'],
  shedinja: ['infiltrator', 'cursedBody', 'levitate'],
  polteageist: ['weakArmor', 'cursedBody', 'regenerator'],
  polteageistAntique: ['weakArmor', 'cursedBody', 'regenerator'],
} as const

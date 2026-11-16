import { line2, type HatchlingDef } from './playableLines'

/**
 * The fossil families the Grande Atualização restores, each with a mechanic
 * of its own (`game/fossilKitRules.ts` has the numbers, `fossilKitSystem.ts`
 * runs them on `Player.kitF`), a signature in `game/fossilKitMoves.ts` and its
 * words in `i18n/gaFossils.ts`. Aerodactyl comes out of Old Amber (the run's
 * Fossil Egg, or the Escavação's Old Amber); the others are restored from the
 * Escavação's fossils (`egg: 'dig'`, `data/digTreasures.ts`), the Galar ones
 * from two halves dug apart. Aerodactyl has a Mega (`data/megas.ts`).
 */
export const GA_FOSSILS = {
  aerodactyl: {
    name: 'Aerodactyl', color: '#a898b8', egg: 'fossil', stats: { maxHp: 30, might: 0.2, speed: 6 }, signature: 'wingAttack',
    learnset: [['wingAttack', 'rockTomb', 'crunch', 'roost', 'stealthRock', 'dragonBreath', 'earthquake', 'gust', 'fireFang']],
    line: [{ name: 'Aerodactyl', dex: 142, types: ['rock', 'flying'], bonus: {} }],
  },
  omanyte: {
    name: 'Omanyte', color: '#68a8d8', egg: 'dig', stats: { armor: 1, area: 0.04, speed: -3 }, signature: 'spikeCannon',
    learnset: [['spikeCannon', 'waterGun', 'rockTomb', 'brine'], ['whirlpool', 'stealthRock', 'iceShard', 'sludgeBomb', 'rockBlast']],
    line: line2(['Omanyte', 138, ['rock', 'water']], ['Omastar', 139, ['rock', 'water']], { maxHp: 45, might: 0.24, armor: 1 }),
  },
  lileep: {
    name: 'Lileep', color: '#c890c8', egg: 'dig', stats: { maxHp: 20, regen: 0.2, speed: -5 }, signature: 'ingrain',
    learnset: [['ingrain', 'razorLeaf', 'rockTomb', 'toxicSpikes'], ['solarBeam', 'stealthRock', 'sludgeBomb', 'earthquake', 'leafBlade']],
    line: line2(['Lileep', 345, ['rock', 'grass']], ['Cradily', 346, ['rock', 'grass']], { maxHp: 60, armor: 1, might: 0.18 }),
  },
  anorith: {
    name: 'Anorith', color: '#90b8a0', egg: 'dig', stats: { might: 0.08, armor: 1, speed: -2 }, signature: 'crushClaw',
    learnset: [['crushClaw', 'rockTomb', 'pinMissile', 'waterGun'], ['xScissor', 'stealthRock', 'earthquake', 'rockBlast', 'brine']],
    line: line2(['Anorith', 347, ['rock', 'bug']], ['Armaldo', 348, ['rock', 'bug']], { maxHp: 50, might: 0.26, armor: 1 }),
  },
  dracozolt: {
    name: 'Dracozolt', color: '#78a858', egg: 'dig', stats: { maxHp: 40, might: 0.22, speed: 2 }, signature: 'boltBeak',
    learnset: [['boltBeak', 'dragonBreath', 'shockWave', 'earthquake', 'dragonTail', 'electroBall', 'rockTomb', 'crunch', 'stealthRock']],
    line: [{ name: 'Dracozolt', dex: 880, types: ['electric', 'dragon'], bonus: {} }],
  },
  arctozolt: {
    name: 'Arctozolt', color: '#88c0d8', egg: 'dig', stats: { maxHp: 40, might: 0.18, area: 0.08, speed: -2 }, signature: 'icicleCrash',
    learnset: [['icicleCrash', 'iceShard', 'electroBall', 'shockWave', 'sheerCold', 'thunder', 'rockTomb', 'stealthRock', 'crunch']],
    line: [{ name: 'Arctozolt', dex: 881, types: ['electric', 'ice'], bonus: {} }],
  },
  dracovish: {
    name: 'Dracovish', color: '#5888a8', egg: 'dig', stats: { maxHp: 35, might: 0.2, speed: 4 }, signature: 'fishiousRend',
    learnset: [['fishiousRend', 'waterGun', 'dragonBreath', 'crunch', 'whirlpool', 'dragonTail', 'brine', 'rockTomb', 'iceShard']],
    line: [{ name: 'Dracovish', dex: 882, types: ['water', 'dragon'], bonus: {} }],
  },
} as const satisfies Record<string, HatchlingDef>

export const GA_FOSSILS_ABILITIES = {
  aerodactyl: ['rockHead', 'pressure', 'unnerve'],
  omanyte: ['swiftSwim', 'shellArmor', 'weakArmor'],
  lileep: ['sturdy', 'regenerator', 'leafGuard'],
  anorith: ['swiftSwim', 'shellArmor', 'sharpness'],
  dracozolt: ['voltAbsorb', 'hustle', 'sandRush'],
  arctozolt: ['voltAbsorb', 'static', 'slushRush'],
  dracovish: ['waterAbsorb', 'strongJaw', 'sandRush'],
} as const

/** The batch's families, for the draws that must keep their old picks (the determinism runs). */
export const GA_FOSSIL_IDS = Object.keys(GA_FOSSILS) as ReadonlyArray<keyof typeof GA_FOSSILS>

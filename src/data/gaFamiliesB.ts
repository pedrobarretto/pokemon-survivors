import { line2, line3, type HatchlingDef } from './playableLines'

/**
 * The Grande Atualização's second batch of families, each with a mechanic of
 * its own (`game/gaKitBRules.ts` has the numbers, `game/gaKitBSystem.ts` runs
 * them on `Player.kitB`), a signature in `game/gaKitBMoves.ts` and its words
 * in `i18n/gaFamiliesB.ts`. Onix is also a wave boss: the playable family and
 * the boss share only the species.
 */
export const GA_FAMILIES_B = {
  onix: {
    name: 'Onix', color: '#a8a090', egg: 'rare', stats: { maxHp: 15, armor: 1, speed: -4, might: -0.04 }, signature: 'ironTail',
    learnset: [['ironTail', 'rockBlast', 'stealthRock', 'dragonTail'], ['heavySlam', 'earthquake', 'headSmash', 'crunch', 'selfDestruct']],
    line: line2(['Onix', 95, ['rock', 'ground']], ['Steelix', 208, ['steel', 'ground']], { maxHp: 55, armor: 1, might: 0.18 }),
  },
  happiny: {
    name: 'Happiny', color: '#f0b0c0', egg: 'rare', stats: { maxHp: 25, might: -0.12, regen: 0.2 }, signature: 'eggBomb',
    learnset: [['eggBomb', 'disarmingVoice', 'swift', 'lastResort'], ['dazzlingGleam', 'psyshock', 'sludgeBomb'], ['thunder', 'torchSong', 'sheerCold']],
    line: line3(['Happiny', 440, ['normal']], ['Chansey', 113, ['normal']], ['Blissey', 242, ['normal']], [
      { maxHp: 40, might: 0.06 },
      { maxHp: 80, might: 0.14, regen: 0.3 },
    ]),
  },
  clauncher: {
    name: 'Clauncher', color: '#4878c8', egg: 'rare', stats: { might: 0.06, speed: -3 }, signature: 'auraSphere',
    learnset: [['auraSphere', 'waterPulse', 'waterGun', 'razorShell'], ['dragonPulse', 'sludgeBomb', 'whirlpool', 'sheerCold', 'snipeShot']],
    line: line2(['Clauncher', 692, ['water']], ['Clawitzer', 693, ['water']], { maxHp: 45, might: 0.26, area: 0.08 }),
  },
  fletchling: {
    name: 'Fletchling', color: '#e05838', egg: 'common', stats: { speed: 7, maxHp: -10 }, signature: 'acrobatics',
    learnset: [['acrobatics', 'quickAttack', 'gust', 'roost'], ['ember', 'flameWheel', 'uTurn'], ['braveBird', 'fireSpin', 'solarBeam']],
    line: line3(['Fletchling', 661, ['normal', 'flying']], ['Fletchinder', 662, ['fire', 'flying']], ['Talonflame', 663, ['fire', 'flying']], [
      { maxHp: 20, might: 0.1, speed: 2 },
      { maxHp: 35, might: 0.22, speed: 4 },
    ]),
  },
  golett: {
    name: 'Golett', color: '#58a0a0', egg: 'rare', stats: { maxHp: 10, speed: -4, might: 0.04 }, signature: 'shadowPunch',
    learnset: [['shadowPunch', 'earthquake', 'bonemerang', 'spiritShackle'], ['gyroBall', 'icePunch', 'willOWisp', 'selfDestruct', 'hex']],
    line: line2(['Golett', 622, ['ground', 'ghost']], ['Golurk', 623, ['ground', 'ghost']], { maxHp: 55, might: 0.24 }),
  },
  nacli: {
    name: 'Nacli', color: '#e8e0d8', egg: 'rare', stats: { maxHp: 15, speed: -4 }, signature: 'saltCure',
    learnset: [['saltCure', 'rockTomb', 'ironDefense', 'accelerock'], ['crossChop', 'roost', 'venoshock'], ['gyroBall', 'gigatonHammer', 'psyshock']],
    line: line3(['Nacli', 932, ['rock']], ['Naclstack', 933, ['rock']], ['Garganacl', 934, ['rock']], [
      { maxHp: 30, armor: 1, might: 0.08 },
      { maxHp: 55, armor: 1, might: 0.18 },
    ]),
  },
  inkay: {
    name: 'Inkay', color: '#5868c8', egg: 'rare', stats: { area: 0.06, maxHp: -5 }, signature: 'psychoCut',
    learnset: [['psychoCut', 'suckerPunch', 'psyshock', 'nightSlash'], ['futureSight', 'sludgeBomb', 'hex', 'electroBall', 'pinMissile']],
    line: line2(['Inkay', 686, ['dark', 'psychic']], ['Malamar', 687, ['dark', 'psychic']], { maxHp: 45, might: 0.22, area: 0.08 }),
  },
  skorupi: {
    name: 'Skorupi', color: '#7858a8', egg: 'rare', stats: { armor: 1, speed: -2, statusChance: 0.03 }, signature: 'poisonFang',
    learnset: [['poisonFang', 'pinMissile', 'toxicSpikes', 'venoshock'], ['crossPoison', 'xScissor', 'suckerPunch', 'fireFang', 'iceShard']],
    line: line2(['Skorupi', 451, ['poison', 'bug']], ['Drapion', 452, ['poison', 'dark']], { maxHp: 50, armor: 1, might: 0.22 }),
  },
  snover: {
    name: 'Snover', color: '#a8d0b0', egg: 'common', stats: { maxHp: 10, speed: -4, area: 0.04 }, signature: 'icePunch',
    learnset: [['icePunch', 'razorLeaf', 'powderSnow', 'iceShard'], ['avalanche', 'leafBlade', 'sheerCold', 'spiritShackle', 'swift']],
    line: line2(['Snover', 459, ['grass', 'ice']], ['Abomasnow', 460, ['grass', 'ice']], { maxHp: 55, might: 0.2, area: 0.06 }),
  },
  tynamo: {
    name: 'Tynamo', color: '#d8d0a0', egg: 'ultra', stats: { maxHp: -10, speed: 3, cooldown: -0.03 }, signature: 'spark',
    learnset: [['spark', 'electroBall', 'electroweb', 'shockWave'], ['bite', 'thunder', 'sludgeBomb'], ['dragonTail', 'firePunch', 'venoshock']],
    line: line3(['Tynamo', 602, ['electric']], ['Eelektrik', 603, ['electric']], ['Eelektross', 604, ['electric']], [
      { maxHp: 30, might: 0.12 },
      { maxHp: 55, might: 0.3 },
    ]),
  },
  dewpider: {
    name: 'Dewpider', color: '#90c0d8', egg: 'rare', stats: { maxHp: 5, speed: -2 }, signature: 'lunge',
    learnset: [['lunge', 'bubbleBeam', 'waterGun', 'leechLife'], ['whirlpool', 'crunch', 'iceShard', 'waterShuriken', 'pinMissile']],
    line: line2(['Dewpider', 751, ['water', 'bug']], ['Araquanid', 752, ['water', 'bug']], { maxHp: 55, armor: 1, might: 0.2 }),
  },
  duraludon: {
    name: 'Duraludon', color: '#b8c0c8', egg: 'ultra', stats: { might: 0.06, armor: 1, speed: -3 }, signature: 'electroShot',
    learnset: [['electroShot', 'dragonTail', 'flashCannon', 'shockWave'], ['dragonBreath', 'stealthRock', 'rockTomb', 'electroBall', 'machPunch']],
    line: line2(['Duraludon', 884, ['steel', 'dragon']], ['Archaludon', 1018, ['steel', 'dragon']], { maxHp: 55, armor: 1, might: 0.28 }),
  },
  bounsweet: {
    name: 'Bounsweet', color: '#e86878', egg: 'common', stats: { speed: 3, maxHp: -5 }, signature: 'tropKick',
    learnset: [['tropKick', 'razorLeaf', 'vineWhip', 'playRough'], ['leafBlade', 'quickAttack'], ['solarBeam', 'uTurn', 'drumBeating', 'focusPunch']],
    line: line3(['Bounsweet', 761, ['grass']], ['Steenee', 762, ['grass']], ['Tsareena', 763, ['grass']], [
      { maxHp: 20, might: 0.1, speed: 2 },
      { maxHp: 40, might: 0.24, speed: 3 },
    ]),
  },
} as const satisfies Record<string, HatchlingDef>

export const GA_FAMILIES_B_ABILITIES = {
  onix: ['sturdy', 'rockHead', 'heavyMetal'],
  happiny: ['naturalCure', 'sereneGrace', 'regenerator'],
  clauncher: ['sniper', 'keenEye', 'adaptability'],
  fletchling: ['keenEye', 'flameBody', 'speedBoost'],
  golett: ['ironFist', 'noGuard', 'clearBody'],
  nacli: ['sturdy', 'clearBody', 'rockHead'],
  inkay: ['contrary', 'infiltrator', 'keenEye'],
  skorupi: ['sniper', 'keenEye', 'poisonPoint'],
  snover: ['snowCloak', 'iceBody', 'slushRush'],
  tynamo: ['levitate', 'static', 'voltAbsorb'],
  dewpider: ['waterAbsorb', 'swiftSwim', 'hydration'],
  duraludon: ['lightMetal', 'heavyMetal', 'sturdy'],
  bounsweet: ['leafGuard', 'chlorophyll', 'quickFeet'],
} as const

/** The batch's families, for the draws that must keep their old picks (the Desafio do dia, the determinism runs). */
export const GA_FAMILY_B_IDS = Object.keys(GA_FAMILIES_B) as ReadonlyArray<keyof typeof GA_FAMILIES_B>

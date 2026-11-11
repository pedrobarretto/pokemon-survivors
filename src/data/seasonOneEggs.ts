import { line2, line3, type HatchlingDef } from './playableLines'

/**
 * Temporada 1's new egg and fossil families. A regional form is a family of its own under PokeAPI's id for it (`data/regionalForms.ts`). Their abilities are
 * `SEASON_ONE_EGG_ABILITIES`, their moves live in `game/seasonOneEggMoves.ts`
 * and their words in `i18n/seasonOne/eggs.ts`. Applin's Dipplin, Flapple and
 * Appletun are branches (`data/branches.ts`).
 */
export const SEASON_ONE_EGGS = {
  snom: {
    name: 'Snom', color: '#b8e0f0', egg: 'common', stats: { cooldown: -0.03, maxHp: -5 }, signature: 'powderSnow',
    learnset: [['powderSnow', 'iceShard', 'pinMissile', 'disarmingVoice'], ['sheerCold', 'gust', 'roost', 'uTurn', 'swift']],
    line: line2(['Snom', 872, ['ice', 'bug']], ['Frosmoth', 873, ['ice', 'bug']], { maxHp: 45, might: 0.2, area: 0.12 }),
  },
  joltik: {
    name: 'Joltik', color: '#e8d040', egg: 'common', stats: { speed: 6, maxHp: -10 }, signature: 'electroweb',
    learnset: [['electroweb', 'pinMissile', 'quickAttack', 'electroBall'], ['thunder', 'venoshock', 'uTurn', 'gyroBall', 'razorLeaf']],
    line: line2(['Joltik', 595, ['bug', 'electric']], ['Galvantula', 596, ['bug', 'electric']], { maxHp: 45, speed: 4, might: 0.22 }),
  },
  salandit: {
    name: 'Salandit', color: '#584858', egg: 'rare', stats: { speed: 4, statusDamage: 0.1 }, signature: 'corrosiveGas',
    learnset: [['corrosiveGas', 'ember', 'toxicSpikes', 'hex'], ['sludgeBomb', 'venoshock', 'willOWisp', 'flameWheel', 'dragonBreath']],
    line: line2(['Salandit', 757, ['poison', 'fire']], ['Salazzle', 758, ['poison', 'fire']], { maxHp: 45, speed: 3, might: 0.22, statusChance: 0.03 }),
  },
  hatenna: {
    name: 'Hatenna', color: '#e090c0', egg: 'rare', stats: { area: 0.06, maxHp: -5 }, signature: 'magicCoat',
    learnset: [['magicCoat', 'psyshock', 'disarmingVoice', 'swift'], ['futureSight', 'hex', 'flashCannon'], ['shockWave', 'solarBeam', 'spiritShackle']],
    line: line3(['Hatenna', 856, ['psychic']], ['Hattrem', 857, ['psychic']], ['Hatterene', 858, ['psychic', 'fairy']], [
      { maxHp: 20, might: 0.1 },
      { maxHp: 35, might: 0.2, area: 0.1 },
    ]),
  },
  applin: {
    name: 'Applin', color: '#d84838', egg: 'rare', stats: { maxHp: 10, speed: -3 }, signature: 'appleAcid',
    learnset: [['appleAcid', 'razorLeaf', 'dragonBreath', 'swift'], ['leafBlade', 'crunch', 'toxicSpikes', 'vineWhip'], ['sludgeBomb', 'whirlpool']],
    line: line3(['Applin', 840, ['grass', 'dragon']], ['Dipplin', 1011, ['grass', 'dragon']], ['Hydrapple', 1019, ['grass', 'dragon']], [
      { maxHp: 25, might: 0.1 },
      { maxHp: 40, might: 0.22, area: 0.1 },
    ]),
  },
  ponyta: {
    name: 'Ponyta', color: '#f09838', egg: 'common', stats: { speed: 6, maxHp: -5 }, signature: 'flareBlitz',
    // Built around a player's list (High Horsepower, Low Kick, Horn Drill, Morning Sun and Bounce are `gallopMoves.ts`; Flamethrower is Ember's evolution).
    learnset: [['flareBlitz', 'ember', 'bounce', 'lowKick', 'morningSun'], ['highHorsepower', 'hornDrill', 'wildCharge', 'flameWheel', 'fireSpin']],
    line: line2(['Ponyta', 77, ['fire']], ['Rapidash', 78, ['fire']], { maxHp: 45, speed: 4, might: 0.22 }),
  },
  ponytaGalar: {
    name: 'Galarian Ponyta', color: '#e0b8f0', egg: 'rare', stats: { speed: 4, area: 0.05, maxHp: -5 }, signature: 'dazzlingGleam',
    learnset: [['dazzlingGleam', 'psyshock', 'disarmingVoice', 'gust'], ['futureSight', 'shockWave', 'solarBeam', 'iceShard', 'venoshock']],
    line: line2(['Galarian Ponyta', 10162, ['psychic']], ['Galarian Rapidash', 10163, ['psychic', 'fairy']], { maxHp: 45, speed: 3, might: 0.24, area: 0.08 }),
  },
  frigibax: {
    name: 'Frigibax', color: '#70a8c8', egg: 'ultra', stats: { might: 0.08, maxHp: -5 }, signature: 'icicleSpear',
    learnset: [['icicleSpear', 'iceShard', 'machPunch', 'dragonBreath'], ['dragonTail', 'rockTomb', 'sheerCold'], ['earthquake', 'flashCannon', 'suckerPunch']],
    line: line3(['Frigibax', 996, ['dragon', 'ice']], ['Arctibax', 997, ['dragon', 'ice']], ['Baxcalibur', 998, ['dragon', 'ice']], [
      { maxHp: 25, might: 0.12 },
      { maxHp: 45, might: 0.28, area: 0.1 },
    ]),
  },
  cranidos: {
    name: 'Cranidos', color: '#6090c8', egg: 'fossil', stats: { might: 0.12, armor: -1 }, signature: 'headSmash',
    learnset: [['headSmash', 'rockTomb', 'crunch', 'focusPunch'], ['stealthRock', 'earthquake', 'machPunch', 'pyroBall', 'gyroBall']],
    line: line2(['Cranidos', 408, ['rock']], ['Rampardos', 409, ['rock']], { maxHp: 40, might: 0.3 }),
  },
  shieldon: {
    name: 'Shieldon', color: '#a8a078', egg: 'fossil', stats: { maxHp: 15, speed: -5 }, signature: 'ironDefense',
    learnset: [['ironDefense', 'rockTomb', 'flashCannon', 'gyroBall'], ['stealthRock', 'earthquake', 'crunch', 'fireSpin', 'thunder']],
    line: line2(['Shieldon', 410, ['rock', 'steel']], ['Bastiodon', 411, ['rock', 'steel']], { maxHp: 55, armor: 1, might: 0.16 }),
  },
  archen: {
    name: 'Archen', color: '#e8c848', egg: 'fossil', stats: { speed: 7, maxHp: -10 }, signature: 'dualWingbeat',
    learnset: [['dualWingbeat', 'rockTomb', 'gust', 'suckerPunch'], ['stealthRock', 'roost', 'dragonBreath', 'quickAttack', 'pinMissile']],
    line: line2(['Archen', 566, ['rock', 'flying']], ['Archeops', 567, ['rock', 'flying']], { maxHp: 40, speed: 4, might: 0.26 }),
  },
  tyrunt: {
    name: 'Tyrunt', color: '#a07858', egg: 'fossil', stats: { might: 0.08, speed: -2 }, signature: 'bite',
    learnset: [['bite', 'rockTomb', 'dragonBreath', 'crunch'], ['stealthRock', 'dragonTail', 'earthquake', 'ember', 'pyroBall']],
    line: line2(['Tyrunt', 696, ['rock', 'dragon']], ['Tyrantrum', 697, ['rock', 'dragon']], { maxHp: 50, might: 0.24 }),
  },
  amaura: {
    name: 'Amaura', color: '#88c8e8', egg: 'fossil', stats: { area: 0.08, speed: -3 }, signature: 'auroraVeil',
    learnset: [['auroraVeil', 'iceShard', 'rockTomb', 'brine'], ['stealthRock', 'sheerCold', 'thunder', 'waterGun', 'gyroBall']],
    line: line2(['Amaura', 698, ['rock', 'ice']], ['Aurorus', 699, ['rock', 'ice']], { maxHp: 50, might: 0.2, area: 0.1 }),
  },
} as const satisfies Record<string, HatchlingDef>

export const SEASON_ONE_EGG_ABILITIES = {
  snom: ['snowCloak', 'iceBody', 'shedSkin'],
  joltik: ['swarm', 'static', 'unnerve'],
  salandit: ['poisonPoint', 'flameBody', 'quickFeet'],
  hatenna: ['synchronize', 'sereneGrace', 'magicBounce'],
  applin: ['overgrow', 'chlorophyll', 'multiscale'],
  frigibax: ['snowCloak', 'iceBody', 'moldBreaker'],
  cranidos: ['moldBreaker', 'rockHead', 'sheerForce'],
  shieldon: ['sturdy', 'bulletproof', 'roughSkin'],
  archen: ['rockHead', 'keenEye', 'unburden'],
  tyrunt: ['strongJaw', 'rockHead', 'sturdy'],
  amaura: ['snowCloak', 'iceBody', 'sandVeil'],
  ponyta: ['flashFire', 'flameBody', 'speedBoost'],
  ponytaGalar: ['pastelVeil', 'sereneGrace', 'cuteCharm'],
} as const

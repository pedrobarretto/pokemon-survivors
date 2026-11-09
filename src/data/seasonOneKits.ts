import { line2, line3, type HatchlingDef } from './playableLines'

/**
 * Temporada 1's families with a mechanic of their own, and how they play:
 * their abilities are `SEASON_ONE_KIT_ABILITIES`, their moves live in
 * `game/seasonOneKitMoves.ts` and their words in `i18n/seasonOne/kits.ts`.
 * `egg: 'found'` families hatch from no egg: their way in is their own.
 */
export const SEASON_ONE_KITS = {
  mankey: {
    name: 'Mankey', color: '#c8a078', egg: 'found', stats: { speed: 3, might: 0.08 }, signature: 'crossChop',
    learnset: [['crossChop', 'machPunch', 'focusPunch', 'quickAttack'], ['toxicSpikes', 'selfDestruct', 'earthquake'], ['hex', 'spiritShackle', 'psyshock']],
    line: line3(['Mankey', 56, ['fighting']], ['Primeape', 57, ['fighting']], ['Annihilape', 979, ['fighting', 'ghost']], [
      { maxHp: 25, might: 0.1 },
      { maxHp: 40, might: 0.24, speed: 3 },
    ]),
  },
  pawniard: {
    name: 'Pawniard', color: '#c04848', egg: 'ultra', stats: { might: 0.08, maxHp: -5 }, signature: 'nightSlash',
    learnset: [['nightSlash', 'flashCannon', 'suckerPunch', 'selfDestruct'], ['focusPunch', 'gyroBall', 'toxicSpikes'], ['razorShell', 'machPunch', 'stealthRock']],
    line: line3(['Pawniard', 624, ['dark', 'steel']], ['Bisharp', 625, ['dark', 'steel']], ['Kingambit', 983, ['dark', 'steel']], [
      { maxHp: 25, might: 0.12 },
      { maxHp: 45, might: 0.28 },
    ]),
  },
  goomy: {
    name: 'Goomy', color: '#a890c8', egg: 'found', stats: { maxHp: 10, speed: -3, might: -0.06 }, signature: 'dragonPulse',
    learnset: [['dragonPulse', 'dragonBreath', 'dragonTail', 'brine'], ['venoshock', 'sludgeBomb', 'whirlpool'], ['thunder', 'solarBeam', 'electroBall']],
    line: line3(['Goomy', 704, ['dragon']], ['Sliggoo', 705, ['dragon']], ['Goodra', 706, ['dragon']], [
      { maxHp: 30, might: 0.1 },
      { maxHp: 50, might: 0.24, regen: 0.3 },
    ]),
  },
  wishiwashi: {
    name: 'Wishiwashi', color: '#7088c8', egg: 'found', stats: { maxHp: -15, speed: 4, might: -0.1 }, signature: 'waterPulse',
    learnset: [['waterPulse', 'waterGun', 'brine', 'whirlpool', 'razorShell', 'waterShuriken', 'swift', 'venoshock', 'disarmingVoice']],
    line: [{ name: 'Wishiwashi', dex: 746, types: ['water'], bonus: {} }],
  },
  tandemaus: {
    name: 'Tandemaus', color: '#e8e0d0', egg: 'found', stats: { speed: 5, maxHp: -5, might: -0.04 }, signature: 'populationBomb',
    learnset: [['populationBomb', 'quickAttack', 'swift', 'selfDestruct'], ['machPunch', 'disarmingVoice', 'shockWave', 'electroBall', 'gust']],
    line: line2(['Tandemaus', 924, ['normal']], ['Maushold', 925, ['normal']], { maxHp: 45, speed: 3, might: 0.2 }),
  },
  finizen: {
    name: 'Finizen', color: '#58b0e8', egg: 'rare', stats: { speed: 5, maxHp: -10, might: -0.05 }, signature: 'jetPunch',
    learnset: [['jetPunch', 'waterGun', 'brine', 'machPunch'], ['whirlpool', 'razorShell', 'quickAttack', 'waterShuriken', 'focusPunch']],
    line: line2(['Finizen', 963, ['water']], ['Palafin', 964, ['water']], { maxHp: 45, speed: 3, might: 0.22 }),
  },
  morpeko: {
    name: 'Morpeko', color: '#d8b048', egg: 'found', stats: { speed: 4, might: 0.06, cooldown: -0.03 }, signature: 'auraWheel',
    learnset: [['auraWheel', 'electroBall', 'thunder', 'shockWave', 'crunch', 'suckerPunch', 'uTurn', 'hex', 'disarmingVoice']],
    line: [{ name: 'Morpeko', dex: 877, types: ['electric', 'dark'], bonus: {} }],
  },
  rotom: {
    name: 'Rotom', color: '#e88048', egg: 'found', stats: { speed: 3, area: 0.06, might: 0.05 }, signature: 'discharge',
    learnset: [['discharge', 'thunder', 'shockWave', 'hex', 'spiritShackle', 'flashCannon', 'futureSight', 'willOWisp', 'pinMissile']],
    line: [{ name: 'Rotom', dex: 479, types: ['electric', 'ghost'], bonus: {} }],
  },
  castform: {
    name: 'Castform', color: '#c8d0d8', egg: 'found', stats: { area: 0.08, might: 0.04, maxHp: 10 }, signature: 'forecast',
    learnset: [['forecast', 'swift', 'quickAttack', 'selfDestruct', 'gust', 'brine', 'ember', 'iceShard', 'electroBall']],
    line: [{ name: 'Castform', dex: 351, types: ['normal'], bonus: {} }],
  },
  darumaka: {
    name: 'Darumaka', color: '#e06838', egg: 'rare', stats: { might: 0.08, speed: -2 }, signature: 'firePunch',
    learnset: [['firePunch', 'ember', 'flameWheel', 'fireSpin'], ['focusPunch', 'drumBeating', 'futureSight', 'psyshock', 'willOWisp']],
    line: line2(['Darumaka', 554, ['fire']], ['Darmanitan', 555, ['fire']], { maxHp: 50, might: 0.26 }),
  },
  wimpod: {
    name: 'Wimpod', color: '#a0a8b0', egg: 'rare', stats: { speed: 8, maxHp: -10 }, signature: 'xScissor',
    learnset: [['xScissor', 'waterGun', 'pinMissile', 'selfDestruct'], ['uTurn', 'razorShell', 'brine', 'whirlpool', 'venoshock']],
    line: line2(['Wimpod', 767, ['bug', 'water']], ['Golisopod', 768, ['bug', 'water']], { maxHp: 55, armor: 1, might: 0.2 }),
  },
  mimikyu: {
    name: 'Mimikyu', color: '#d8c890', egg: 'found', stats: { might: 0.06, maxHp: -5 }, signature: 'shadowClaw',
    learnset: [['shadowClaw', 'hex', 'spiritShackle', 'disarmingVoice', 'psyshock', 'futureSight', 'venoshock', 'willOWisp', 'uTurn']],
    line: [{ name: 'Mimikyu', dex: 778, types: ['ghost', 'fairy'], bonus: {} }],
  },
  tatsugiri: {
    name: 'Tatsugiri', color: '#e87858', egg: 'found', stats: { speed: 3, might: 0.06, cooldown: -0.03 }, signature: 'orderUp',
    learnset: [['orderUp', 'dragonBreath', 'dragonTail', 'waterGun', 'brine', 'whirlpool', 'waterShuriken', 'sheerCold', 'selfDestruct']],
    line: [{ name: 'Tatsugiri', dex: 978, types: ['dragon', 'water'], bonus: {} }],
  },
} as const satisfies Record<string, HatchlingDef>

export const SEASON_ONE_KIT_ABILITIES = {
  mankey: ['vitalSpirit', 'guts', 'unburden'],
  pawniard: ['moxie', 'pressure', 'sharpness'],
  goomy: ['hydration', 'shedSkin', 'marvelScale'],
  wishiwashi: ['swiftSwim', 'rainDish', 'damp'],
  tandemaus: ['pickup', 'technician', 'cuteCharm'],
  finizen: ['swiftSwim', 'waterAbsorb', 'guts'],
  morpeko: ['static', 'unnerve', 'quickFeet'],
  rotom: ['levitate', 'static', 'infiltrator'],
  castform: ['cloudNine', 'hydration', 'solarPower'],
  darumaka: ['flashFire', 'guts', 'hustle'],
  wimpod: ['swarm', 'shellArmor', 'unburden'],
  mimikyu: ['cursedBody', 'cuteCharm', 'unnerve'],
  tatsugiri: ['swiftSwim', 'liquidVoice', 'adaptability'],
} as const

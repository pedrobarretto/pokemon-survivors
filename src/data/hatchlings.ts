import type { EggTier } from '../game/eggs'
import { isLegend, LEGENDS, type LegendDef, type LegendId } from './legends'
import { line2, line3, type HatchlingDef } from './playableLines'
import { SEASON_ONE_EGGS } from './seasonOneEggs'
import { SEASON_ONE_KITS } from './seasonOneKits'
import { GA_FAMILIES_B } from './gaFamiliesB'
import { GA_FOSSILS } from './gaFossils'
import { GA_FAMILIES_A } from './gaFamiliesA'
import { REGIONAL_FAMILIES } from './regionalFamilies'
import { ROCKET_FAMILIES } from './rocketFamilies'
import { GA_MEGA_FAMILIES_A } from './gaMegaFamiliesA'
import { MEGA_FAMILIES_B } from './megaFamiliesB'
import { SC_FAMILIES } from './scFamilies'
import { STARTER_IDS, STARTERS, type StarterId } from './starters'

export const HATCHLINGS = {
  /* ---------- Common eggs ---------- */
  pichu: {
    name: 'Pichu',
    color: '#f8d030',
    egg: 'common',
    stats: { speed: 6, cooldown: -0.05, maxHp: -15 },
    signature: 'electroBall',
    learnset: [['electroBall', 'shockWave', 'disarmingVoice', 'quickAttack', 'thunder', 'futureSight'], ['swift', 'flashCannon'], ['brine', 'selfDestruct']],
    line: line3(['Pichu', 172, ['electric']], ['Pikachu', 25, ['electric']], ['Raichu', 26, ['electric']], [
      { maxHp: 20, speed: 3, might: 0.1 },
      { maxHp: 35, speed: 4, might: 0.2, area: 0.1 },
    ]),
  },
  machop: {
    name: 'Machop',
    color: '#8098b8',
    egg: 'common',
    stats: { might: 0.1, maxHp: 15, speed: -4 },
    signature: 'dynamicPunch',
    learnset: [['dynamicPunch', 'machPunch', 'rockTomb', 'venoshock', 'focusPunch', 'shockWave'], ['earthquake', 'stealthRock'], ['pyroBall', 'iceShard']],
    line: line3(['Machop', 66, ['fighting']], ['Machoke', 67, ['fighting']], ['Machamp', 68, ['fighting']], [
      { maxHp: 30, might: 0.1, armor: 1 },
      { maxHp: 50, might: 0.22, area: 0.1 },
    ]),
  },
  eevee: {
    name: 'Eevee',
    color: '#c89058',
    egg: 'common',
    stats: { growth: 0.1, regen: 0.15 },
    signature: 'swift',
    learnset: [['lastResort', 'swift', 'quickAttack', 'crunch', 'selfDestruct'], ['hex']],
    line: line2(['Eevee', 133, ['normal']], ['Umbreon', 197, ['dark']], { maxHp: 60, armor: 2, might: 0.2, regen: 0.4 }),
  },
  togepi: {
    name: 'Togepi',
    color: '#f0e0c8',
    egg: 'common',
    stats: { regen: 0.3, growth: 0.05, maxHp: 5, speed: -2 },
    signature: 'metronome',
    learnset: [['metronome', 'disarmingVoice', 'rockTomb', 'swift', 'psyshock', 'futureSight'], ['roost', 'gust'], ['electroBall', 'pyroBall']],
    line: line3(['Togepi', 175, ['fairy']], ['Togetic', 176, ['fairy', 'flying']], ['Togekiss', 468, ['fairy', 'flying']], [
      { maxHp: 25, regen: 0.3, area: 0.05 },
      { maxHp: 40, regen: 0.5, might: 0.16, area: 0.1 },
    ]),
  },
  spheal: {
    name: 'Spheal',
    color: '#78b8e8',
    egg: 'common',
    stats: { maxHp: 30, armor: 1, speed: -6 },
    signature: 'iceBall',
    learnset: [['iceBall', 'waterGun', 'iceShard', 'brine', 'whirlpool', 'pinMissile'], ['sheerCold', 'razorShell'], ['gyroBall', 'waterShuriken']],
    line: line3(['Spheal', 363, ['ice', 'water']], ['Sealeo', 364, ['ice', 'water']], ['Walrein', 365, ['ice', 'water']], [
      { maxHp: 35, armor: 1, might: 0.05 },
      { maxHp: 65, armor: 2, might: 0.15, area: 0.1 },
    ]),
  },
  starly: {
    name: 'Starly',
    color: '#a08868',
    egg: 'common',
    stats: { speed: 8, magnet: 10, maxHp: 5 },
    signature: 'braveBird',
    learnset: [['braveBird', 'gust', 'electroBall', 'swift', 'roost', 'uTurn'], ['gyroBall', 'flashCannon'], ['focusPunch', 'selfDestruct']],
    line: line3(['Starly', 396, ['normal', 'flying']], ['Staravia', 397, ['normal', 'flying']], ['Staraptor', 398, ['normal', 'flying']], [
      { maxHp: 25, speed: 3, might: 0.08 },
      { maxHp: 40, speed: 4, might: 0.2, projectileSpeed: 0.1 },
    ]),
  },
  budew: {
    name: 'Budew',
    color: '#68b868',
    egg: 'common',
    stats: { statusChance: 0.05, statusDamage: 0.15, maxHp: -5 },
    signature: 'weatherBall',
    learnset: [['weatherBall', 'razorLeaf', 'sludgeBomb', 'disarmingVoice', 'vineWhip', 'toxicSpikes'], ['drumBeating', 'petalDance'], ['venoshock', 'spiritShackle', 'leafBlade']],
    line: line3(['Budew', 406, ['grass', 'poison']], ['Roselia', 315, ['grass', 'poison']], ['Roserade', 407, ['grass', 'poison']], [
      { maxHp: 20, might: 0.08, statusChance: 0.03 },
      { maxHp: 35, might: 0.18, area: 0.1, statusDamage: 0.15 },
    ]),
  },
  rockruff: {
    name: 'Rockruff',
    color: '#c0a070',
    egg: 'common',
    stats: { speed: 5, might: 0.08 },
    signature: 'accelerock',
    learnset: [['accelerock', 'crunch', 'rockTomb', 'quickAttack', 'stealthRock', 'flameWheel'], ['futureSight', 'electroBall', 'swift']],
    line: line2(['Rockruff', 744, ['rock']], ['Lycanroc', 745, ['rock']], { maxHp: 55, might: 0.25, speed: 5, armor: 1 }),
  },
  grubbin: {
    name: 'Grubbin',
    color: '#5878c0',
    egg: 'common',
    stats: { area: 0.1, duration: 0.1, maxHp: 10, speed: -5 },
    signature: 'zapCannon',
    learnset: [['zapCannon', 'flashCannon', 'pinMissile', 'toxicSpikes', 'uTurn', 'thunder'], ['shockWave', 'electroBall'], ['gust', 'solarBeam']],
    line: line3(['Grubbin', 736, ['bug']], ['Charjabug', 737, ['bug', 'electric']], ['Vikavolt', 738, ['bug', 'electric']], [
      { maxHp: 35, armor: 1, might: 0.06 },
      { maxHp: 45, might: 0.2, area: 0.15 },
    ]),
  },

  /* Gen 1-3 families */
  pidgey: {
    name: 'Pidgey',
    color: '#c8a868',
    egg: 'common',
    stats: { speed: 5, projectileSpeed: 0.1, magnet: 6, maxHp: -10 },
    signature: 'aerialAce',
    learnset: [['aerialAce', 'gust', 'quickAttack', 'swift', 'roost', 'uTurn'], ['gyroBall', 'pinMissile'], ['electroBall', 'selfDestruct']],
    line: line3(['Pidgey', 16, ['normal', 'flying']], ['Pidgeotto', 17, ['normal', 'flying']], ['Pidgeot', 18, ['normal', 'flying']], [
      { maxHp: 20, speed: 3, might: 0.08 },
      { maxHp: 35, speed: 4, might: 0.18, area: 0.1 },
    ]),
  },
  zubat: {
    name: 'Zubat',
    color: '#5878c8',
    egg: 'common',
    stats: { speed: 6, statusDamage: 0.1, maxHp: 5 },
    signature: 'crossPoison',
    learnset: [['crossPoison', 'crunch', 'gust', 'venoshock', 'swift', 'sludgeBomb'], ['uTurn', 'hex'], ['roost', 'toxicSpikes', 'pinMissile']],
    line: line3(['Zubat', 41, ['poison', 'flying']], ['Golbat', 42, ['poison', 'flying']], ['Crobat', 169, ['poison', 'flying']], [
      { maxHp: 25, speed: 3, might: 0.08 },
      { maxHp: 35, speed: 6, might: 0.18, cooldown: -0.05 },
    ]),
  },
  poliwag: {
    name: 'Poliwag',
    color: '#5870c8',
    egg: 'common',
    stats: { cooldown: -0.04, maxHp: 10, speed: -2 },
    signature: 'bubbleBeam',
    learnset: [['bubbleBeam', 'waterGun', 'whirlpool', 'iceShard', 'dreamEater'], ['brine', 'futureSight'], []],
    line: line3(['Poliwag', 60, ['water']], ['Poliwhirl', 61, ['water']], ['Poliwrath', 62, ['water', 'fighting']], [
      { maxHp: 30, might: 0.08, armor: 1 },
      { maxHp: 50, might: 0.2, armor: 1, area: 0.05 },
    ]),
  },
  geodude: {
    name: 'Geodude',
    color: '#a09078',
    egg: 'common',
    stats: { armor: 1, maxHp: 20, might: 0.05, speed: -6 },
    signature: 'rollout',
    learnset: [['rollout', 'rockTomb', 'stealthRock', 'selfDestruct', 'earthquake', 'focusPunch'], ['gyroBall', 'pyroBall'], ['flashCannon', 'shockWave']],
    line: line3(['Geodude', 74, ['rock', 'ground']], ['Graveler', 75, ['rock', 'ground']], ['Golem', 76, ['rock', 'ground']], [
      { maxHp: 30, armor: 1, might: 0.08 },
      { maxHp: 55, armor: 1, might: 0.2, area: 0.1 },
    ]),
  },
  roggenrola: {
    name: 'Roggenrola',
    color: '#4868a8',
    egg: 'common',
    // Sturdy and slow like Geodude, but leaner; Gigalith's glowing crystals widen every blow.
    stats: { armor: 2, maxHp: 10, speed: -5 },
    signature: 'rockBlast',
    learnset: [['rockBlast', 'rockTomb', 'flashCannon', 'stealthRock', 'earthquake', 'selfDestruct'], ['gyroBall', 'psyshock'], ['solarBeam', 'electroBall']],
    line: line3(['Roggenrola', 524, ['rock']], ['Boldore', 525, ['rock']], ['Gigalith', 526, ['rock']], [
      { maxHp: 30, armor: 1, might: 0.08 },
      { maxHp: 50, might: 0.2, area: 0.15 },
    ]),
  },
  mareep: {
    name: 'Mareep',
    color: '#f0d070',
    egg: 'common',
    stats: { maxHp: 15, regen: 0.1, statusChance: 0.03, speed: -3 },
    signature: 'shockWave',
    learnset: [['cottonSpore', 'shockWave', 'electroBall', 'rockTomb', 'flashCannon', 'thunder'], ['flameWheel', 'focusPunch'], ['dragonBreath', 'dragonTail']],
    line: line3(['Mareep', 179, ['electric']], ['Flaaffy', 180, ['electric']], ['Ampharos', 181, ['electric']], [
      { maxHp: 25, might: 0.08, statusChance: 0.02 },
      { maxHp: 40, might: 0.18, area: 0.12 },
    ]),
  },
  shinx: {
    name: 'Shinx',
    color: '#4888d0',
    egg: 'common',
    // A lynx that hunts with its fangs; Luxray's glare makes the shocks paralyze more often.
    stats: { might: 0.06, speed: 3, statusChance: 0.02, maxHp: -5 },
    signature: 'wildCharge',
    learnset: [['wildCharge', 'shockWave', 'crunch', 'quickAttack', 'electroBall', 'thunder'], ['suckerPunch', 'iceShard'], ['flameWheel', 'uTurn']],
    line: line3(['Shinx', 403, ['electric']], ['Luxio', 404, ['electric']], ['Luxray', 405, ['electric']], [
      { maxHp: 25, might: 0.1, speed: 2 },
      { maxHp: 40, might: 0.22, statusChance: 0.04 },
    ]),
  },
  azurill: {
    name: 'Azurill',
    color: '#68a8e8',
    egg: 'common',
    stats: { regen: 0.15, maxHp: 10, might: -0.05 },
    signature: 'playRough',
    learnset: [['playRough', 'disarmingVoice', 'waterGun', 'rollout', 'iceShard', 'whirlpool'], ['razorShell', 'brine'], ['focusPunch', 'waterShuriken']],
    // Azumarill's Huge Power: a soft start, a heavy hitter at the end.
    line: line3(['Azurill', 298, ['normal', 'fairy']], ['Marill', 183, ['water', 'fairy']], ['Azumarill', 184, ['water', 'fairy']], [
      { maxHp: 25, might: 0.08 },
      { maxHp: 45, might: 0.3 },
    ]),
  },
  shroomish: {
    name: 'Shroomish',
    color: '#88b070',
    egg: 'common',
    stats: { statusChance: 0.05, regen: 0.15, speed: -3 },
    signature: 'razorLeaf',
    learnset: [['spore', 'razorLeaf', 'venoshock', 'leechSeed', 'toxicSpikes', 'machPunch'], ['focusPunch', 'vineWhip', 'forcePalm']],
    line: line2(['Shroomish', 285, ['grass']], ['Breloom', 286, ['grass', 'fighting']], { maxHp: 40, might: 0.25, speed: 5, cooldown: -0.04 }),
  },
  swinub: {
    name: 'Swinub',
    color: '#a07858',
    egg: 'common',
    stats: { maxHp: 20, armor: 1, speed: -5 },
    signature: 'avalanche',
    learnset: [['avalanche', 'iceShard', 'earthquake', 'rockTomb', 'sludgeBomb', 'stealthRock'], ['sheerCold', 'whirlpool'], ['gyroBall', 'crunch']],
    // The only Gen 4 member of these families: Mamoswine completes the line, a slow, heavy-hitting tank.
    line: line3(['Swinub', 220, ['ice', 'ground']], ['Piloswine', 221, ['ice', 'ground']], ['Mamoswine', 473, ['ice', 'ground']], [
      { maxHp: 30, armor: 1, might: 0.08 },
      { maxHp: 55, armor: 1, might: 0.22, area: 0.1 },
    ]),
  },
  snorunt: {
    name: 'Snorunt',
    color: '#88a8c8',
    egg: 'common',
    stats: { area: 0.08, might: 0.05, maxHp: -5 },
    signature: 'frostBreath',
    learnset: [['frostBreath', 'iceShard', 'gust', 'sheerCold', 'spiritShackle'], ['selfDestruct']],
    line: line2(['Snorunt', 361, ['ice']], ['Glalie', 362, ['ice']], { maxHp: 50, might: 0.22, area: 0.1, armor: 1 }),
  },

  /* ---------- Rare eggs ---------- */
  gastly: {
    name: 'Gastly',
    color: '#7058a0',
    egg: 'rare',
    stats: { might: 0.1, speed: 4, maxHp: -15 },
    signature: 'dreamEater',
    learnset: [['dreamEater', 'hex', 'suckerPunch', 'venoshock', 'sludgeBomb', 'thunder'], ['spiritShackle', 'curse'], ['psyshock', 'willOWisp']],
    line: line3(['Gastly', 92, ['ghost', 'poison']], ['Haunter', 93, ['ghost', 'poison']], ['Gengar', 94, ['ghost', 'poison']], [
      { maxHp: 20, might: 0.1, speed: 3 },
      { maxHp: 35, might: 0.24, area: 0.1 },
    ]),
  },
  abra: {
    name: 'Abra',
    color: '#e8c040',
    egg: 'rare',
    stats: { cooldown: -0.08, area: 0.05, maxHp: -20 },
    signature: 'futureSight',
    learnset: [['futureSight', 'psyshock', 'psybeam', 'shockWave', 'fireSpin', 'hex'], ['electroBall', 'spiritShackle'], ['disarmingVoice', 'pyroBall']],
    line: line3(['Abra', 63, ['psychic']], ['Kadabra', 64, ['psychic']], ['Alakazam', 65, ['psychic']], [
      { maxHp: 20, might: 0.1, cooldown: -0.03 },
      { maxHp: 30, might: 0.22, cooldown: -0.05, area: 0.1 },
    ]),
  },
  ralts: {
    name: 'Ralts',
    color: '#78c878',
    egg: 'rare',
    stats: { area: 0.12, regen: 0.15, maxHp: -5 },
    signature: 'moonblast',
    learnset: [['moonblast', 'psyshock', 'disarmingVoice', 'hex', 'razorLeaf', 'futureSight'], ['thunder', 'willOWisp'], []],
    line: line3(['Ralts', 280, ['psychic', 'fairy']], ['Kirlia', 281, ['psychic', 'fairy']], ['Gardevoir', 282, ['psychic', 'fairy']], [
      { maxHp: 25, regen: 0.15, might: 0.08 },
      { maxHp: 40, regen: 0.3, might: 0.2, area: 0.1 },
    ]),
  },
  riolu: {
    name: 'Riolu',
    color: '#4878c0',
    egg: 'rare',
    stats: { speed: 6, might: 0.08, cooldown: -0.04, maxHp: -10 },
    signature: 'forcePalm',
    learnset: [['forcePalm', 'quickAttack', 'machPunch', 'focusPunch', 'selfDestruct', 'flashCannon'], ['boneRush', 'dragonBreath', 'meteorMash']],
    line: line2(['Riolu', 447, ['fighting']], ['Lucario', 448, ['fighting', 'steel']], { maxHp: 50, might: 0.25, speed: 5, cooldown: -0.05, armor: 1 }),
  },
  zorua: {
    name: 'Zorua',
    color: '#584868',
    egg: 'rare',
    stats: { speed: 7, might: 0.1, maxHp: -15 },
    signature: 'foulPlay',
    learnset: [['foulPlay', 'suckerPunch', 'spiritShackle', 'hex', 'snarl', 'uTurn'], ['psyshock', 'torchSong', 'focusPunch']],
    line: line2(['Zorua', 570, ['dark']], ['Zoroark', 571, ['dark']], { maxHp: 45, might: 0.28, speed: 6, area: 0.05 }),
  },
  larvesta: {
    name: 'Larvesta',
    color: '#f0a040',
    egg: 'rare',
    stats: { area: 0.1, statusChance: 0.05, speed: -2 },
    signature: 'fieryDance',
    learnset: [['fieryDance', 'fireSpin', 'ember', 'pinMissile', 'flameWheel', 'futureSight'], ['gust', 'roost', 'psyshock']],
    line: line2(['Larvesta', 636, ['bug', 'fire']], ['Volcarona', 637, ['bug', 'fire']], { maxHp: 50, might: 0.25, area: 0.15, regen: 0.2 }),
  },
  noibat: {
    name: 'Noibat',
    color: '#8858a8',
    egg: 'rare',
    stats: { area: 0.12, speed: 4, maxHp: -10 },
    signature: 'echoedVoice',
    learnset: [['echoedVoice', 'gust', 'dragonBreath', 'pinMissile', 'roost', 'uTurn'], ['dragonTail', 'torchSong', 'psyshock']],
    line: line2(['Noibat', 714, ['flying', 'dragon']], ['Noivern', 715, ['flying', 'dragon']], { maxHp: 45, might: 0.22, area: 0.15, speed: 4 }),
  },
  honedge: {
    name: 'Honedge',
    color: '#8890b0',
    egg: 'rare',
    stats: { armor: 2, might: 0.05, speed: -4 },
    signature: 'sacredSword',
    learnset: [['sacredSword', 'flashCannon', 'hex', 'suckerPunch', 'spiritShackle', 'stealthRock'], ['gyroBall', 'furyCutter'], ['razorShell', 'leafBlade']],
    line: line3(['Honedge', 679, ['steel', 'ghost']], ['Doublade', 680, ['steel', 'ghost']], ['Aegislash', 681, ['steel', 'ghost']], [
      { maxHp: 30, armor: 1, might: 0.08 },
      { maxHp: 45, armor: 1, might: 0.2, area: 0.1 },
    ]),
  },
  toxel: {
    name: 'Toxel',
    color: '#a068c0',
    egg: 'rare',
    stats: { statusChance: 0.06, cooldown: -0.03, maxHp: -5 },
    signature: 'overdrive',
    learnset: [['overdrive', 'sludgeBomb', 'shockWave', 'venoshock', 'electroBall', 'thunder'], ['toxicSpikes', 'torchSong', 'suckerPunch']],
    line: line2(['Toxel', 848, ['electric', 'poison']], ['Toxtricity', 849, ['electric', 'poison']], { maxHp: 45, might: 0.24, area: 0.1, statusDamage: 0.2 }),
  },
  tinkatink: {
    name: 'Tinkatink',
    color: '#e890b0',
    egg: 'rare',
    stats: { might: 0.1, area: 0.1, cooldown: 0.05, maxHp: 5 },
    signature: 'gigatonHammer',
    learnset: [['gigatonHammer', 'earthquake', 'disarmingVoice', 'flashCannon', 'rockTomb', 'gyroBall'], ['suckerPunch', 'stealthRock'], ['machPunch', 'iceShard']],
    line: line3(['Tinkatink', 957, ['fairy', 'steel']], ['Tinkatuff', 958, ['fairy', 'steel']], ['Tinkaton', 959, ['fairy', 'steel']], [
      { maxHp: 30, might: 0.1, area: 0.05 },
      { maxHp: 50, might: 0.22, area: 0.15, armor: 1 },
    ]),
  },
  charcadet: {
    name: 'Charcadet',
    color: '#e86040',
    egg: 'rare',
    stats: { might: 0.08, duration: 0.1 },
    signature: 'bitterBlade',
    learnset: [['bitterBlade', 'ember', 'fireSpin', 'willOWisp', 'hex', 'flameCharge'], []],
    line: line2(['Charcadet', 935, ['fire']], ['Armarouge', 936, ['fire', 'psychic']], { maxHp: 50, might: 0.25, area: 0.1, projectileSpeed: 0.15 }),
  },

  /* Gen 1-3 families */
  growlithe: {
    name: 'Growlithe',
    color: '#f09040',
    egg: 'rare',
    stats: { speed: 5, might: 0.08, maxHp: 5 },
    signature: 'flameWheel',
    learnset: [['flameWheel', 'ember', 'crunch', 'quickAttack', 'fireSpin', 'dragonBreath'], ['electroBall', 'pyroBall', 'torchSong']],
    line: line2(['Growlithe', 58, ['fire']], ['Arcanine', 59, ['fire']], { maxHp: 55, might: 0.22, speed: 6, area: 0.05 }),
  },
  vulpix: {
    name: 'Vulpix',
    color: '#d87850',
    egg: 'rare',
    stats: { statusChance: 0.05, duration: 0.1, maxHp: -5 },
    signature: 'willOWisp',
    learnset: [['willOWisp', 'ember', 'fireSpin', 'hex', 'torchSong', 'psyshock'], ['solarBeam', 'futureSight', 'sheerCold']],
    line: line2(['Vulpix', 37, ['fire']], ['Ninetales', 38, ['fire']], { maxHp: 45, might: 0.22, duration: 0.1, statusDamage: 0.2 }),
  },
  cubone: {
    name: 'Cubone',
    color: '#c8b090',
    egg: 'rare',
    stats: { might: 0.1, armor: 1, speed: -3 },
    signature: 'bonemerang',
    learnset: [['bonemerang', 'boneRush', 'rockTomb', 'thrash', 'stealthRock', 'earthquake'], ['flameWheel', 'hex', 'willOWisp']],
    line: line2(['Cubone', 104, ['ground']], ['Marowak', 105, ['ground']], { maxHp: 50, might: 0.25, armor: 1, area: 0.1 }),
  },
  scyther: {
    name: 'Scyther',
    color: '#78c058',
    egg: 'rare',
    stats: { speed: 7, cooldown: -0.05, maxHp: -15 },
    signature: 'furyCutter',
    learnset: [['furyCutter', 'quickAttack', 'gust', 'razorLeaf', 'pinMissile', 'roost'], []],
    line: line2(['Scyther', 123, ['bug', 'flying']], ['Scizor', 212, ['bug', 'steel']], { maxHp: 55, armor: 2, might: 0.22 }),
  },
  magikarp: {
    name: 'Magikarp',
    color: '#e87848',
    egg: 'rare',
    // Splash: weak (but quick to level) until Gyarados.
    stats: { maxHp: -25, might: -0.3, speed: -2, growth: 0.2 },
    signature: 'waterGun',
    learnset: [['waterfall', 'waterGun', 'flail', 'whirlpool', 'swift', 'crunch'], ['thunder', 'twister', 'dragonTail']],
    line: line2(['Magikarp', 129, ['water']], ['Gyarados', 130, ['water', 'flying']], { maxHp: 90, might: 0.6, armor: 2, area: 0.15 }),
  },
  horsea: {
    name: 'Horsea',
    color: '#6898d8',
    egg: 'rare',
    stats: { projectileSpeed: 0.15, might: 0.05, maxHp: -10 },
    signature: 'brine',
    learnset: [['brine', 'waterGun', 'iceShard', 'sludgeBomb', 'whirlpool', 'sheerCold'], ['flashCannon', 'dragonBreath'], ['dragonTail', 'waterShuriken']],
    line: line3(['Horsea', 116, ['water']], ['Seadra', 117, ['water']], ['Kingdra', 230, ['water', 'dragon']], [
      { maxHp: 25, might: 0.1, projectileSpeed: 0.05 },
      { maxHp: 45, might: 0.22, area: 0.1, armor: 1 },
    ]),
  },
  kabuto: {
    name: 'Kabuto',
    color: '#b08848',
    // The Escavação's Dome Fossil restores it (it left the Rare Egg; those who hatched it keep it).
    egg: 'dig',
    stats: { armor: 2, maxHp: 10, speed: -4 },
    signature: 'leechLife',
    learnset: [['leechLife', 'rockTomb', 'waterGun', 'razorShell', 'mudShot', 'stealthRock'], ['brine', 'pinMissile', 'leafBlade']],
    line: line2(['Kabuto', 140, ['rock', 'water']], ['Kabutops', 141, ['rock', 'water']], { maxHp: 45, might: 0.25, speed: 5, armor: 1 }),
  },
  houndour: {
    name: 'Houndour',
    color: '#c86838',
    egg: 'rare',
    stats: { statusDamage: 0.15, might: 0.06, maxHp: -5 },
    signature: 'fireFang',
    learnset: [['fireFang', 'ember', 'crunch', 'sludgeBomb', 'suckerPunch', 'willOWisp'], ['flameWheel', 'toxicSpikes', 'solarBeam']],
    line: line2(['Houndour', 228, ['dark', 'fire']], ['Houndoom', 229, ['dark', 'fire']], { maxHp: 45, might: 0.24, statusDamage: 0.15, speed: 3 }),
  },
  teddiursa: {
    name: 'Teddiursa',
    color: '#b07040',
    egg: 'rare',
    stats: { maxHp: 15, might: 0.08, speed: -4 },
    signature: 'furySwipes',
    learnset: [['furySwipes', 'crunch', 'suckerPunch', 'swift', 'quickAttack', 'focusPunch'], ['venoshock', 'machPunch', 'gigaImpact']],
    line: line2(['Teddiursa', 216, ['normal']], ['Ursaring', 217, ['normal']], { maxHp: 65, might: 0.24, armor: 1, area: 0.05 }),
  },
  aron: {
    name: 'Aron',
    color: '#a8a8b8',
    egg: 'rare',
    stats: { armor: 3, maxHp: 10, might: -0.05, speed: -7 },
    signature: 'heavySlam',
    learnset: [['heavySlam', 'flashCannon', 'rockTomb', 'gyroBall', 'stealthRock', 'earthquake'], ['dragonTail', 'selfDestruct'], ['thunder', 'sheerCold']],
    line: line3(['Aron', 304, ['steel', 'rock']], ['Lairon', 305, ['steel', 'rock']], ['Aggron', 306, ['steel', 'rock']], [
      { maxHp: 35, armor: 1, might: 0.08 },
      { maxHp: 60, armor: 2, might: 0.22, area: 0.05 },
    ]),
  },
  trapinch: {
    name: 'Trapinch',
    color: '#d88848',
    egg: 'rare',
    stats: { area: 0.1, might: 0.05, speed: -4 },
    signature: 'bulldoze',
    learnset: [['bulldoze', 'earthquake', 'sandTomb', 'pinMissile', 'rockTomb', 'dragonBreath'], ['shockWave', 'dig'], ['dragonTail', 'flameWheel']],
    // The pit-digger takes wing: each stage is faster.
    line: line3(['Trapinch', 328, ['ground']], ['Vibrava', 329, ['ground', 'dragon']], ['Flygon', 330, ['ground', 'dragon']], [
      { maxHp: 20, speed: 4, might: 0.08 },
      { maxHp: 40, speed: 5, might: 0.2, area: 0.1 },
    ]),
  },
  swablu: {
    name: 'Swablu',
    color: '#78c8f0',
    egg: 'rare',
    stats: { regen: 0.2, area: 0.06, maxHp: 5, speed: -2 },
    signature: 'gust',
    learnset: [['perishSong', 'gust', 'disarmingVoice', 'roost', 'swift', 'dragonBreath'], ['dragonTail', 'fireSpin', 'sheerCold']],
    line: line2(['Swablu', 333, ['normal', 'flying']], ['Altaria', 334, ['dragon', 'flying']], { maxHp: 55, might: 0.2, regen: 0.3, area: 0.1 }),
  },
  electrike: {
    name: 'Electrike',
    color: '#58b868',
    egg: 'rare',
    stats: { speed: 7, cooldown: -0.04, maxHp: -10 },
    signature: 'chargeBeam',
    learnset: [['chargeBeam', 'thunder', 'shockWave', 'quickAttack', 'crunch', 'electroBall'], ['uTurn', 'flameWheel', 'torchSong']],
    line: line2(['Electrike', 309, ['electric']], ['Manectric', 310, ['electric']], { maxHp: 45, speed: 5, might: 0.22, cooldown: -0.04 }),
  },
  shuppet: {
    name: 'Shuppet',
    color: '#585878',
    egg: 'rare',
    stats: { statusChance: 0.05, might: 0.06, maxHp: -10 },
    signature: 'hex',
    learnset: [['hex', 'curse', 'willOWisp', 'suckerPunch', 'spiritShackle', 'thunder'], ['psyshock', 'sludgeBomb', 'futureSight']],
    line: line2(['Shuppet', 353, ['ghost']], ['Banette', 354, ['ghost']], { maxHp: 40, might: 0.25, statusChance: 0.04, statusDamage: 0.15 }),
  },

  /* ---------- Ultra rare eggs: the pseudo-legendaries ---------- */
  dratini: {
    name: 'Dratini',
    color: '#6890e0',
    egg: 'ultra',
    stats: { maxHp: 10, regen: 0.15, might: 0.05 },
    signature: 'twister',
    learnset: [['twister', 'dragonTail', 'whirlpool', 'shockWave', 'dragonBreath', 'thunder'], ['sheerCold', 'pyroBall'], ['roost', 'gust']],
    line: line3(['Dratini', 147, ['dragon']], ['Dragonair', 148, ['dragon']], ['Dragonite', 149, ['dragon', 'flying']], [
      { maxHp: 35, might: 0.1, area: 0.05 },
      { maxHp: 60, might: 0.25, armor: 1, speed: 4 },
    ]),
  },
  larvitar: {
    name: 'Larvitar',
    color: '#88a058',
    egg: 'ultra',
    stats: { maxHp: 20, armor: 1, speed: -7 },
    signature: 'sandTomb',
    learnset: [['sandTomb', 'crunch', 'rockTomb', 'earthquake', 'stealthRock', 'focusPunch'], ['suckerPunch', 'pyroBall'], ['thunder', 'dragonTail']],
    line: line3(['Larvitar', 246, ['rock', 'ground']], ['Pupitar', 247, ['rock', 'ground']], ['Tyranitar', 248, ['rock', 'dark']], [
      { maxHp: 40, armor: 1, might: 0.08 },
      { maxHp: 75, armor: 2, might: 0.25, area: 0.1 },
    ]),
  },
  beldum: {
    name: 'Beldum',
    color: '#5880c0',
    egg: 'ultra',
    stats: { armor: 2, might: 0.05, maxHp: 10, speed: -5 },
    signature: 'meteorMash',
    learnset: [['meteorMash', 'flashCannon', 'psyshock', 'gyroBall', 'zenHeadbutt', 'shockWave'], ['earthquake', 'selfDestruct'], ['futureSight', 'machPunch']],
    line: line3(['Beldum', 374, ['steel', 'psychic']], ['Metang', 375, ['steel', 'psychic']], ['Metagross', 376, ['steel', 'psychic']], [
      { maxHp: 35, armor: 1, might: 0.1 },
      { maxHp: 60, armor: 2, might: 0.25, area: 0.1 },
    ]),
  },
  gible: {
    name: 'Gible',
    color: '#5868a0',
    egg: 'ultra',
    stats: { might: 0.1, speed: 3, maxHp: 5 },
    signature: 'dragonBreath',
    learnset: [['dragonBreath', 'dig', 'crunch', 'venoshock', 'dragonTail', 'flameWheel'], ['earthquake', 'stealthRock'], ['sludgeBomb', 'gyroBall']],
    line: line3(['Gible', 443, ['dragon', 'ground']], ['Gabite', 444, ['dragon', 'ground']], ['Garchomp', 445, ['dragon', 'ground']], [
      { maxHp: 30, might: 0.1, speed: 3 },
      { maxHp: 55, might: 0.25, speed: 6, armor: 1 },
    ]),
  },
  dreepy: {
    name: 'Dreepy',
    color: '#58a088',
    egg: 'ultra',
    stats: { projectileSpeed: 0.2, speed: 6, maxHp: -15 },
    signature: 'dragonDarts',
    learnset: [['dragonDarts', 'quickAttack', 'hex', 'uTurn', 'dragonBreath', 'thunder'], ['suckerPunch', 'spiritShackle'], ['willOWisp', 'dragonTail']],
    line: line3(['Dreepy', 885, ['dragon', 'ghost']], ['Drakloak', 886, ['dragon', 'ghost']], ['Dragapult', 887, ['dragon', 'ghost']], [
      { maxHp: 20, might: 0.1, projectileSpeed: 0.1 },
      { maxHp: 35, might: 0.22, speed: 6, amount: 1 },
    ]),
  },

  bagon: {
    name: 'Bagon',
    color: '#68a8d8',
    egg: 'ultra',
    stats: { might: 0.1, maxHp: 10, speed: -2 },
    signature: 'zenHeadbutt',
    learnset: [['zenHeadbutt', 'ember', 'crunch', 'dragonBreath', 'dragonTail', 'fireSpin'], ['futureSight', 'brine'], ['roost', 'gust']],
    // Shelgon hides in its shell; Salamence finally flies.
    line: line3(['Bagon', 371, ['dragon']], ['Shelgon', 372, ['dragon']], ['Salamence', 373, ['dragon', 'flying']], [
      { maxHp: 40, armor: 2, might: 0.08 },
      { maxHp: 60, might: 0.28, speed: 7, area: 0.1 },
    ]),
  },
  slakoth: {
    name: 'Slakoth',
    color: '#b89878',
    egg: 'ultra',
    // Truant: slow to act but hits hard and dozes back to health. Vigoroth can't sit still.
    stats: { might: 0.15, cooldown: 0.12, speed: -4, regen: 0.2 },
    signature: 'suckerPunch',
    learnset: [['suckerPunch', 'gigaImpact', 'roost', 'selfDestruct', 'focusPunch', 'pinMissile'], ['machPunch', 'shockWave'], ['pyroBall', 'swift']],
    line: line3(['Slakoth', 287, ['normal']], ['Vigoroth', 288, ['normal']], ['Slaking', 289, ['normal']], [
      { maxHp: 30, cooldown: -0.14, speed: 7, might: 0.05 },
      { maxHp: 75, might: 0.3, cooldown: 0.1, speed: -5 },
    ]),
  },
  feebas: {
    name: 'Feebas',
    color: '#d8a8a0',
    egg: 'ultra',
    // The plainest Pokémon around, until it becomes the most beautiful.
    stats: { maxHp: -20, might: -0.25, regen: 0.1, growth: 0.15 },
    signature: 'flail',
    learnset: [['flail', 'waterGun', 'whirlpool', 'iceShard', 'disarmingVoice', 'dragonTail'], ['roost', 'brine', 'sheerCold']],
    line: line2(['Feebas', 349, ['water']], ['Milotic', 350, ['water']], { maxHp: 95, might: 0.5, regen: 0.8, area: 0.2, armor: 1 }),
  },
  deino: {
    name: 'Deino',
    color: '#3f5890',
    egg: 'ultra',
    // Blind, so it bites whatever is near; Hydreigon's three heads fire one more shot.
    stats: { might: 0.12, maxHp: 10, speed: -3 },
    signature: 'snarl',
    learnset: [['snarl', 'crunch', 'dragonBreath', 'dragonTail', 'ember', 'uTurn'], ['flashCannon', 'suckerPunch'], ['torchSong', 'brine']],
    line: line3(['Deino', 633, ['dark', 'dragon']], ['Zweilous', 634, ['dark', 'dragon']], ['Hydreigon', 635, ['dark', 'dragon']], [
      { maxHp: 35, might: 0.1, armor: 1 },
      { maxHp: 50, might: 0.22, speed: 5, amount: 1 },
    ]),
  },
  /* ---------- Friendship Egg (only from an invite's Mystery Gift) ---------- */
  munchlax: {
    name: 'Munchlax',
    color: '#3f6f80',
    egg: 'friend',
    stats: { maxHp: 40, armor: 2, regen: 0.25, magnet: 10, speed: -8 },
    signature: 'gyroBall',
    learnset: [['gyroBall', 'bodySlam', 'metronome', 'sludgeBomb', 'crunch', 'focusPunch'], ['selfDestruct', 'pyroBall', 'roost']],
    line: line2(['Munchlax', 446, ['normal']], ['Snorlax', 143, ['normal']], { maxHp: 90, armor: 2, might: 0.22, regen: 0.4, area: 0.1 }),
  },
  /* ---------- Haunted Egg (only Duskull's stall sells it, during the Noite das Bruxas) ---------- */
  litwick: {
    name: 'Litwick',
    color: '#9068d0',
    egg: 'haunted',
    // A candle that feeds on life force: frail, but its flames burn longer and Chandelure's reach wider.
    stats: { might: 0.08, duration: 0.1, statusDamage: 0.1, maxHp: -15 },
    signature: 'fireSpin',
    learnset: [['fireSpin', 'ember', 'hex', 'willOWisp', 'psyshock'], ['torchSong', 'spiritShackle', 'toxicSpikes'], ['futureSight', 'sludgeBomb']],
    line: line3(['Litwick', 607, ['ghost', 'fire']], ['Lampent', 608, ['ghost', 'fire']], ['Chandelure', 609, ['ghost', 'fire']], [
      { maxHp: 20, might: 0.1, duration: 0.05 },
      { maxHp: 35, might: 0.25, area: 0.15 },
    ]),
  },
  phantump: {
    name: 'Phantump',
    color: '#6a8a48',
    egg: 'haunted',
    // A stump with a lost spirit inside: sturdy and slow to wilt; Trevenant's roots heal it as it fights.
    stats: { maxHp: 20, regen: 0.2, speed: -3 },
    signature: 'vineWhip',
    learnset: [['vineWhip', 'razorLeaf', 'hex', 'willOWisp', 'venoshock'], ['leafBlade', 'drumBeating', 'toxicSpikes', 'solarBeam']],
    line: line2(['Phantump', 708, ['ghost', 'grass']], ['Trevenant', 709, ['ghost', 'grass']], { maxHp: 65, might: 0.22, armor: 1, regen: 0.4 }),
  },
  drifloon: {
    name: 'Drifloon',
    color: '#9070c0',
    egg: 'haunted',
    // A balloon that drifts off with whoever holds its string: light, quick to pull pickups, quicker once Drifblim.
    stats: { speed: 5, magnet: 10, maxHp: -10 },
    signature: 'spiritShackle',
    learnset: [['spiritShackle', 'roost', 'swift', 'selfDestruct', 'thunder'], ['aerialAce', 'shockWave', 'futureSight', 'disarmingVoice']],
    line: line2(['Drifloon', 425, ['ghost', 'flying']], ['Drifblim', 426, ['ghost', 'flying']], { maxHp: 60, might: 0.22, speed: 4, area: 0.1 }),
  },
  sandygast: {
    name: 'Sandygast',
    color: '#d8b070',
    egg: 'haunted',
    // A sandcastle that drains whoever builds it: tough, slow, its quakes ever wider as Palossand.
    stats: { maxHp: 25, armor: 1, area: 0.05, speed: -5 },
    signature: 'bulldoze',
    learnset: [['bulldoze', 'hex', 'earthquake', 'whirlpool', 'stealthRock'], ['brine', 'psyshock', 'razorLeaf', 'flashCannon']],
    line: line2(['Sandygast', 769, ['ghost', 'ground']], ['Palossand', 770, ['ghost', 'ground']], { maxHp: 70, armor: 2, might: 0.2, area: 0.15 }),
  },
  /* ---------- Kecleon Egg (only the Vitrine's fixed card sells it, one a day) ---------- */
  porygon: {
    name: 'Porygon',
    color: '#e8708a',
    egg: 'kecleon',
    // Made of code: it levels up and recharges fast; Porygon-Z's glitchy upgrade trades armor for raw power.
    stats: { cooldown: -0.05, growth: 0.1, maxHp: -5 },
    signature: 'zapCannon',
    learnset: [['zapCannon', 'swift', 'quickAttack', 'electroBall', 'futureSight'], ['thunder', 'chargeBeam', 'iceShard'], ['selfDestruct', 'torchSong']],
    // Both evolutions need their item (the Up-Grade, then the Dubious Disc): without it, it stays (`game/evoGate.ts`).
    line: [
      { name: 'Porygon', dex: 137, types: ['normal'], evolveAt: 12, bonus: {} },
      { name: 'Porygon2', dex: 233, types: ['normal'], evolveAt: 28, item: 'upgrade', bonus: { maxHp: 35, armor: 1, regen: 0.3, might: 0.08 } },
      { name: 'Porygon-Z', dex: 474, types: ['normal'], item: 'dubiousDisc', bonus: { maxHp: 20, might: 0.3, cooldown: -0.08, speed: 4, armor: -1 } },
    ],
  },
  exeggcute: {
    name: 'Exeggcute',
    color: '#f0c8b8',
    egg: 'kecleon',
    // Six eggs that think as one: wide reach and slow healing; Exeggutor, grown under a Leaf Stone, towers over the horde.
    stats: { area: 0.1, regen: 0.15, speed: -4 },
    signature: 'razorLeaf',
    learnset: [['razorLeaf', 'vineWhip', 'futureSight', 'selfDestruct', 'toxicSpikes'], ['leafBlade', 'drumBeating', 'dragonBreath', 'sludgeBomb']],
    // Exeggutor needs the Leaf Stone (the one that opens Leafeon too), Alolan Exeggutor the Sparkling Stone (`data/branches.ts`).
    line: line2(['Exeggcute', 102, ['grass', 'psychic']], ['Exeggutor', 103, ['grass', 'psychic']], { maxHp: 70, might: 0.25, area: 0.15, armor: 1 }),
  },
  scraggy: {
    name: 'Scraggy',
    color: '#e8c040',
    egg: 'kecleon',
    // Pulls its shed skin up like pants: hard to knock down; Scrafty brawls harder.
    stats: { armor: 1, maxHp: 15, might: 0.05, speed: -2 },
    signature: 'focusPunch',
    learnset: [['focusPunch', 'machPunch', 'crunch', 'bodySlam', 'rockTomb'], ['venoshock', 'electroBall', 'torchSong', 'toxicSpikes']],
    line: line2(['Scraggy', 559, ['dark', 'fighting']], ['Scrafty', 560, ['dark', 'fighting']], { maxHp: 65, might: 0.25, armor: 1 }),
  },
  smeargle: {
    name: 'Smeargle',
    color: '#58a838',
    egg: 'kecleon',
    // Never evolves: it starts strong, and its tail paints whatever move it sees (Sketch, `game/sketch.ts`).
    stats: { maxHp: 35, might: 0.2, cooldown: -0.06, area: 0.1 },
    signature: 'sketch',
    learnset: [['sketch', 'weatherBall', 'furySwipes', 'selfDestruct', 'waterShuriken', 'torchSong', 'drumBeating', 'dragonBreath', 'disarmingVoice', 'venoshock']],
    line: [{ name: 'Smeargle', dex: 235, types: ['normal'], bonus: {} }],
  },
  ...SEASON_ONE_EGGS,
  ...SEASON_ONE_KITS,
  ...GA_FAMILIES_B,
  ...GA_FAMILIES_A,
  ...REGIONAL_FAMILIES,
  ...ROCKET_FAMILIES,
  ...GA_FOSSILS,
  ...GA_MEGA_FAMILIES_A,
  ...MEGA_FAMILIES_B,
  ...SC_FAMILIES,
} as const satisfies Record<string, HatchlingDef>

export type HatchlingId = keyof typeof HATCHLINGS

export const HATCHLING_IDS = Object.keys(HATCHLINGS) as HatchlingId[]

/** Every Pokémon a run can start with: the starters, the hatched families and the legends (Legend mode only). */
export const PLAYABLE = { ...STARTERS, ...HATCHLINGS, ...LEGENDS }

export type PlayableId = StarterId | HatchlingId | LegendId

/**
 * The starters and hatched families, the regular runs' cast. The legends
 * stay out: they only play in the Legend mode, and the Desafio do dia draws
 * its Pokémon from this list.
 */
export const PLAYABLE_IDS: readonly (StarterId | HatchlingId)[] = [...STARTER_IDS, ...HATCHLING_IDS]

export const isHatchling = (id: PlayableId): id is HatchlingId => id in HATCHLINGS

/** The eggs whose families come from nowhere else: the Haunted Egg (Duskull's stall), the Kecleon Egg (the Vitrine's fixed card), the Fossil Egg (the Underground's Old Amber), the Ovo de Viagem's regions (the Vitrine's travel card), the families found without one and the Escavação's fossils. */
const EXCLUSIVE_EGGS: readonly EggTier[] = ['haunted', 'kecleon', 'fossil', 'alola', 'galar', 'hisui', 'paldea', 'found', 'dig']

/**
 * A family only its own egg brings (the Haunted Egg's ghosts, the Kecleon
 * Egg's four): the Desafio do dia never draws it and shiny tickets can't pick
 * it, so the egg stays its only way in.
 */
export const isExclusiveFamily = (id: PlayableId) => isHatchling(id) && EXCLUSIVE_EGGS.includes(HATCHLINGS[id].egg)

/** A starter: neither a hatched family nor a legend. */
export const isStarter = (id: PlayableId): id is StarterId => id in STARTERS

/** Dex numbers of a playable Pokémon's whole evolution line (a legend's evolution too: Poipole's Naganadel). */
export const playableDex = (id: PlayableId) => {
  const own = PLAYABLE[id].line.map((s) => s.dex)
  if (!isLegend(id)) return own
  const legend: LegendDef = LEGENDS[id]
  return legend.evolve ? [...own, legend.evolve.dex] : own
}

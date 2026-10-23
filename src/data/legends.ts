import type { MoveId } from '../game/moves'
import type { StatDelta } from '../game/stats'
import type { AbilityEffect, AbilityId } from './abilities'
import type { EnemyId } from './enemies'
import { LEGENDARY_MOVE_OF } from './legendaryMoves'
import type { EvolutionStage, PlayableDef } from './starters'
import type { PokeType } from './types'

/**
 * Playable legendaries, played only in the Legend mode (Modo Lendário). A
 * legend never evolves: it awakens at `AWAKEN_AT` instead (an Ability pick on
 * the first, a stat boost and an Esquecer charge on both, and on the second
 * its `form` where it has one), carries an `innate` from the start (its real
 * ability) and opens the run with its legendary move. The rules live in
 * `game/legend.ts`. Unlocking (`unlock`) is the save's side: beating the
 * legendary as a boss `wins` times.
 */

/** The 23 regular legendaries, by their `EnemyId`: the ones Arceus waits for and the "every legend" counts. */
export const REGULAR_LEGENDS = [
  'articuno', 'zapdos', 'moltres', 'raikou', 'entei', 'suicune', 'regirock', 'regice', 'registeel',
  'mew', 'celebi', 'jirachi', 'mewtwo', 'lugia', 'hoOh', 'kyogre', 'groudon', 'rayquaza', 'dialga',
  'latias', 'latios', 'deoxys', 'arceus',
] as const satisfies readonly EnemyId[]

/**
 * Event legends: captured only while their event runs (`LegendUnlock.event`),
 * then played for good. They stay out of `REGULAR_LEGENDS`: Arceus never
 * waits for them and no "every legend" count needs them. Darkrai comes from
 * the Noite das Bruxas' nightmare rift.
 */
export const EVENT_LEGENDS = ['darkrai'] as const satisfies readonly EnemyId[]

/** Every playable legend: the regular ones, then the event ones. */
export const LEGEND_IDS = [...REGULAR_LEGENDS, ...EVENT_LEGENDS] as const

export type LegendId = (typeof LEGEND_IDS)[number]

/** Levels of the two awakenings (the starters' evolution levels). */
export const AWAKEN_AT = [12, 28] as const

/** Asset folder of a legend's alternate form (`<dex>/<form>/`), like the Megas'. Deoxys's formes come with its stance. */
export type LegendForm = 'primal' | 'mega' | 'attack' | 'defense' | 'speed'

/**
 * The innate: an ability in play from Lv 1, on top of the one picked at the
 * first awakening. `extra` adds what the Legend mode gives it beyond the
 * ability itself (Serene Grace's lucky cards, Snow Cloak's chill).
 */
export type Innate = { ability: AbilityId; extra?: readonly AbilityEffect[] }

/** The events a legend can be captured in (their days live in `data/halloween.ts`). */
export type LegendEvent = 'halloween'

/**
 * How a legend is unlocked: beat it as a boss `wins` times, in any mode.
 * `endless`: the win must come in the endless mode; `last`: only once every
 * regular legend is unlocked (Arceus, the final trophy); `event`: it only
 * shows up while that event runs (Darkrai, the Noite das Bruxas').
 */
export type LegendUnlock = { wins: number; endless?: true; last?: true; event?: LegendEvent }

export type LegendDef = Omit<PlayableDef, 'learnset' | 'line'> & {
  /** One list: every move it can learn is there from Lv 1, its legendary move first. */
  learnset: readonly [readonly MoveId[]]
  line: readonly [EvolutionStage]
  /** Stats each awakening adds, on top of `stats`. */
  awakenings: readonly [StatDelta, StatDelta]
  innate: Innate
  /** The form the second awakening lands in, for good (Primal Kyogre, Mega Rayquaza). */
  form?: { key: LegendForm; name: string; types?: readonly PokeType[] }
  unlock: LegendUnlock
}

const stage = (dex: number, name: string, types: readonly PokeType[]) => [{ dex, name, types, bonus: {} }] as const satisfies LegendDef['line']

/** Captured after this many wins: the rift legendaries and the trios. */
const RIFT_WINS = { wins: 3 } as const satisfies LegendUnlock
/** The finale's mythicals show up in one run in ten: one win does it. */
const MYTHICAL_WINS = { wins: 1 } as const satisfies LegendUnlock

const chill = { kind: 'aura', radius: 56, every: 1, status: { kind: 'slow', chance: 1, duration: 1.2, power: 0.3 } } as const satisfies AbilityEffect

/**
 * Every legend. Stats sit clearly above a final-stage starter's once both
 * awakenings land (a Charizard ends at +55 HP, +0.45 damage; a legend at about
 * +100 HP, +0.6), and the Legend mode's Pressure (`game/legend.ts`) pushes back.
 */
export const LEGENDS = {
  /* ---------- The legendary birds ---------- */
  articuno: {
    name: 'Articuno',
    color: '#88c8f0',
    stats: { maxHp: 35, might: 0.18, area: 0.1, speed: 4 },
    signature: LEGENDARY_MOVE_OF.articuno,
    learnset: [[LEGENDARY_MOVE_OF.articuno, 'iceShard', 'gust', 'sheerCold', 'roost', 'frostBreath', 'swift', 'futureSight']],
    line: stage(144, 'Articuno', ['ice', 'flying']),
    awakenings: [{ maxHp: 25, might: 0.12, area: 0.05 }, { maxHp: 40, might: 0.22, area: 0.1, cooldown: -0.05 }],
    innate: { ability: 'snowCloak', extra: [chill] },
    unlock: RIFT_WINS,
  },
  zapdos: {
    name: 'Zapdos',
    color: '#f8d030',
    stats: { maxHp: 30, might: 0.22, speed: 6, cooldown: -0.04 },
    signature: LEGENDARY_MOVE_OF.zapdos,
    learnset: [[LEGENDARY_MOVE_OF.zapdos, 'thunder', 'shockWave', 'electroBall', 'drillPeck', 'gust', 'roost', 'uTurn']],
    line: stage(145, 'Zapdos', ['electric', 'flying']),
    awakenings: [{ maxHp: 25, might: 0.12, speed: 3 }, { maxHp: 35, might: 0.24, cooldown: -0.05 }],
    innate: { ability: 'static' },
    unlock: RIFT_WINS,
  },
  moltres: {
    name: 'Moltres',
    color: '#f8a030',
    stats: { maxHp: 30, might: 0.25, area: 0.1, speed: 3 },
    signature: LEGENDARY_MOVE_OF.moltres,
    learnset: [[LEGENDARY_MOVE_OF.moltres, 'ember', 'fireSpin', 'flameWheel', 'gust', 'roost', 'willOWisp', 'solarBeam']],
    line: stage(146, 'Moltres', ['fire', 'flying']),
    awakenings: [{ maxHp: 25, might: 0.12, area: 0.05 }, { maxHp: 35, might: 0.25, area: 0.1 }],
    innate: { ability: 'flameBody' },
    unlock: RIFT_WINS,
  },

  /* ---------- The legendary beasts ---------- */
  raikou: {
    name: 'Raikou',
    color: '#f8c838',
    stats: { maxHp: 30, might: 0.2, speed: 10, cooldown: -0.05 },
    signature: LEGENDARY_MOVE_OF.raikou,
    learnset: [[LEGENDARY_MOVE_OF.raikou, 'thunder', 'shockWave', 'electroBall', 'crunch', 'quickAttack', 'wildCharge', 'futureSight']],
    line: stage(243, 'Raikou', ['electric']),
    awakenings: [{ maxHp: 25, might: 0.12, speed: 3 }, { maxHp: 35, might: 0.22, cooldown: -0.05 }],
    innate: { ability: 'innerFocus' },
    unlock: RIFT_WINS,
  },
  entei: {
    name: 'Entei',
    color: '#c86838',
    stats: { maxHp: 45, might: 0.25, speed: 6, area: 0.05 },
    signature: LEGENDARY_MOVE_OF.entei,
    learnset: [[LEGENDARY_MOVE_OF.entei, 'ember', 'fireSpin', 'flameWheel', 'pyroBall', 'crunch', 'stealthRock', 'earthquake']],
    line: stage(244, 'Entei', ['fire']),
    awakenings: [{ maxHp: 25, might: 0.12, armor: 1 }, { maxHp: 40, might: 0.22, area: 0.1 }],
    innate: { ability: 'pressure' },
    unlock: RIFT_WINS,
  },
  suicune: {
    name: 'Suicune',
    color: '#58b8e8',
    stats: { maxHp: 40, might: 0.18, speed: 8, regen: 0.3 },
    signature: LEGENDARY_MOVE_OF.suicune,
    learnset: [[LEGENDARY_MOVE_OF.suicune, 'waterGun', 'whirlpool', 'brine', 'iceShard', 'sheerCold', 'gust', 'bubbleBeam']],
    line: stage(245, 'Suicune', ['water']),
    awakenings: [{ maxHp: 25, might: 0.1, regen: 0.3 }, { maxHp: 40, might: 0.22, armor: 1 }],
    innate: { ability: 'innerFocus' },
    unlock: RIFT_WINS,
  },

  /* ---------- The legendary titans ---------- */
  regirock: {
    name: 'Regirock',
    color: '#c87848',
    stats: { maxHp: 60, armor: 2, might: 0.15, speed: -4 },
    signature: LEGENDARY_MOVE_OF.regirock,
    learnset: [[LEGENDARY_MOVE_OF.regirock, 'rockTomb', 'stealthRock', 'earthquake', 'focusPunch', 'machPunch', 'flashCannon', 'rockBlast']],
    line: stage(377, 'Regirock', ['rock']),
    awakenings: [{ maxHp: 35, armor: 1, might: 0.1 }, { maxHp: 50, armor: 1, might: 0.22, area: 0.1 }],
    innate: { ability: 'clearBody' },
    unlock: RIFT_WINS,
  },
  regice: {
    name: 'Regice',
    color: '#a8e0f8',
    stats: { maxHp: 50, armor: 1, might: 0.18, area: 0.1, speed: -4 },
    signature: LEGENDARY_MOVE_OF.regice,
    learnset: [[LEGENDARY_MOVE_OF.regice, 'iceShard', 'sheerCold', 'focusPunch', 'thunder', 'flashCannon', 'avalanche', 'rockTomb']],
    line: stage(378, 'Regice', ['ice']),
    awakenings: [{ maxHp: 30, armor: 1, might: 0.1 }, { maxHp: 45, might: 0.24, area: 0.1 }],
    innate: { ability: 'clearBody' },
    unlock: RIFT_WINS,
  },
  registeel: {
    name: 'Registeel',
    color: '#9098a8',
    stats: { maxHp: 55, armor: 3, might: 0.15, speed: -5 },
    signature: LEGENDARY_MOVE_OF.registeel,
    learnset: [[LEGENDARY_MOVE_OF.registeel, 'flashCannon', 'gyroBall', 'focusPunch', 'machPunch', 'stealthRock', 'heavySlam', 'earthquake']],
    line: stage(379, 'Registeel', ['steel']),
    awakenings: [{ maxHp: 35, armor: 1, might: 0.1 }, { maxHp: 50, armor: 1, might: 0.22, regen: 0.4 }],
    innate: { ability: 'clearBody' },
    unlock: RIFT_WINS,
  },

  /* ---------- The finale's mythicals ---------- */
  mew: {
    name: 'Mew',
    color: '#f8a8c8',
    stats: { maxHp: 30, might: 0.15, growth: 0.1, cooldown: -0.05, speed: 4 },
    signature: LEGENDARY_MOVE_OF.mew,
    learnset: [[LEGENDARY_MOVE_OF.mew, 'psyshock', 'futureSight', 'swift', 'metronome', 'shockWave', 'flameWheel', 'whirlpool']],
    line: stage(151, 'Mew', ['psychic']),
    awakenings: [{ maxHp: 25, might: 0.12, growth: 0.05 }, { maxHp: 35, might: 0.22, cooldown: -0.05 }],
    innate: { ability: 'synchronize' },
    unlock: MYTHICAL_WINS,
  },
  celebi: {
    name: 'Celebi',
    color: '#88d868',
    stats: { maxHp: 35, might: 0.15, regen: 0.4, duration: 0.1 },
    signature: LEGENDARY_MOVE_OF.celebi,
    learnset: [[LEGENDARY_MOVE_OF.celebi, 'razorLeaf', 'leafBlade', 'psyshock', 'futureSight', 'solarBeam', 'leechSeed', 'drumBeating']],
    line: stage(251, 'Celebi', ['psychic', 'grass']),
    awakenings: [{ maxHp: 25, might: 0.12, regen: 0.3 }, { maxHp: 35, might: 0.22, area: 0.1 }],
    innate: { ability: 'naturalCure' },
    unlock: MYTHICAL_WINS,
  },
  jirachi: {
    name: 'Jirachi',
    color: '#f8e878',
    stats: { maxHp: 35, might: 0.15, greed: 0.15, magnet: 10 },
    signature: LEGENDARY_MOVE_OF.jirachi,
    learnset: [[LEGENDARY_MOVE_OF.jirachi, 'flashCannon', 'psyshock', 'futureSight', 'swift', 'meteorMash', 'gyroBall', 'disarmingVoice']],
    line: stage(385, 'Jirachi', ['steel', 'psychic']),
    awakenings: [{ maxHp: 25, might: 0.12, armor: 1 }, { maxHp: 35, might: 0.22, area: 0.1 }],
    innate: { ability: 'sereneGrace', extra: [{ kind: 'luck', rare: 0.1, shiny: 2 }] },
    unlock: MYTHICAL_WINS,
  },

  /* ---------- The finale ---------- */
  mewtwo: {
    name: 'Mewtwo',
    color: '#a890c8',
    stats: { maxHp: 30, might: 0.3, area: 0.1, cooldown: -0.04 },
    signature: LEGENDARY_MOVE_OF.mewtwo,
    learnset: [[LEGENDARY_MOVE_OF.mewtwo, 'psyshock', 'futureSight', 'psybeam', 'shockWave', 'focusPunch', 'iceShard', 'flameWheel']],
    line: stage(150, 'Mewtwo', ['psychic']),
    awakenings: [{ maxHp: 25, might: 0.15, area: 0.05 }, { maxHp: 35, might: 0.25, cooldown: -0.06 }],
    innate: { ability: 'pressure' },
    unlock: { wins: 5 },
  },

  /* ---------- The rift legendaries ---------- */
  lugia: {
    name: 'Lugia',
    color: '#e0e0f0',
    stats: { maxHp: 55, might: 0.15, armor: 1, area: 0.1 },
    signature: LEGENDARY_MOVE_OF.lugia,
    learnset: [[LEGENDARY_MOVE_OF.lugia, 'gust', 'roost', 'psyshock', 'futureSight', 'whirlpool', 'waterGun', 'dragonTail']],
    line: stage(249, 'Lugia', ['psychic', 'flying']),
    awakenings: [{ maxHp: 30, might: 0.12, armor: 1 }, { maxHp: 45, might: 0.22, area: 0.1 }],
    innate: { ability: 'multiscale' },
    unlock: RIFT_WINS,
  },
  hoOh: {
    name: 'Ho-Oh',
    color: '#f87848',
    stats: { maxHp: 45, might: 0.22, regen: 0.3 },
    signature: LEGENDARY_MOVE_OF.hoOh,
    learnset: [[LEGENDARY_MOVE_OF.hoOh, 'ember', 'fireSpin', 'flameWheel', 'gust', 'roost', 'solarBeam', 'braveBird']],
    line: stage(250, 'Ho-Oh', ['fire', 'flying']),
    awakenings: [{ maxHp: 30, might: 0.12, regen: 0.2 }, { maxHp: 40, might: 0.22, area: 0.1 }],
    innate: { ability: 'regenerator' },
    unlock: RIFT_WINS,
  },
  kyogre: {
    name: 'Kyogre',
    color: '#3878d8',
    stats: { maxHp: 50, might: 0.22, area: 0.1, armor: 1, speed: -2 },
    signature: LEGENDARY_MOVE_OF.kyogre,
    learnset: [[LEGENDARY_MOVE_OF.kyogre, 'waterGun', 'whirlpool', 'brine', 'thunder', 'sheerCold', 'waterShuriken', 'razorShell']],
    line: stage(382, 'Kyogre', ['water']),
    awakenings: [{ maxHp: 25, might: 0.12, area: 0.05 }, { maxHp: 40, might: 0.25, area: 0.1, armor: 1 }],
    innate: { ability: 'drizzle' },
    form: { key: 'primal', name: 'Primal Kyogre' },
    unlock: RIFT_WINS,
  },
  groudon: {
    name: 'Groudon',
    color: '#d84838',
    stats: { maxHp: 55, might: 0.22, armor: 1, speed: -3 },
    signature: LEGENDARY_MOVE_OF.groudon,
    learnset: [[LEGENDARY_MOVE_OF.groudon, 'earthquake', 'rockTomb', 'stealthRock', 'ember', 'fireSpin', 'solarBeam', 'focusPunch']],
    line: stage(383, 'Groudon', ['ground']),
    awakenings: [{ maxHp: 30, might: 0.12, armor: 1 }, { maxHp: 40, might: 0.25, area: 0.1 }],
    innate: { ability: 'drought' },
    form: { key: 'primal', name: 'Primal Groudon', types: ['ground', 'fire'] },
    unlock: RIFT_WINS,
  },
  rayquaza: {
    name: 'Rayquaza',
    color: '#48a868',
    stats: { maxHp: 35, might: 0.25, speed: 6, projectileSpeed: 0.1 },
    signature: LEGENDARY_MOVE_OF.rayquaza,
    learnset: [[LEGENDARY_MOVE_OF.rayquaza, 'dragonBreath', 'dragonTail', 'twister', 'gust', 'crunch', 'earthquake', 'thunder']],
    line: stage(384, 'Rayquaza', ['dragon', 'flying']),
    awakenings: [{ maxHp: 25, might: 0.15, speed: 3 }, { maxHp: 40, might: 0.25, cooldown: -0.05 }],
    innate: { ability: 'airLock' },
    form: { key: 'mega', name: 'Mega Rayquaza' },
    unlock: RIFT_WINS,
  },
  dialga: {
    name: 'Dialga',
    color: '#5878b8',
    stats: { maxHp: 50, armor: 2, might: 0.18, duration: 0.1, speed: -3 },
    signature: LEGENDARY_MOVE_OF.dialga,
    learnset: [[LEGENDARY_MOVE_OF.dialga, 'flashCannon', 'dragonBreath', 'dragonTail', 'gyroBall', 'futureSight', 'earthquake', 'stealthRock']],
    line: stage(483, 'Dialga', ['steel', 'dragon']),
    awakenings: [{ maxHp: 30, armor: 1, might: 0.12 }, { maxHp: 45, might: 0.22, cooldown: -0.05 }],
    innate: { ability: 'pressure' },
    unlock: RIFT_WINS,
  },
  latias: {
    name: 'Latias',
    color: '#e87888',
    stats: { maxHp: 40, might: 0.15, speed: 8, regen: 0.3, cooldown: -0.04 },
    signature: LEGENDARY_MOVE_OF.latias,
    learnset: [[LEGENDARY_MOVE_OF.latias, 'dragonBreath', 'psyshock', 'futureSight', 'dragonTail', 'roost', 'disarmingVoice', 'swift']],
    line: stage(380, 'Latias', ['dragon', 'psychic']),
    awakenings: [{ maxHp: 25, might: 0.12, regen: 0.2 }, { maxHp: 35, might: 0.22, cooldown: -0.05 }],
    innate: { ability: 'levitate' },
    unlock: RIFT_WINS,
  },
  latios: {
    name: 'Latios',
    color: '#5878d8',
    stats: { maxHp: 30, might: 0.22, speed: 10, cooldown: -0.04 },
    signature: LEGENDARY_MOVE_OF.latios,
    learnset: [[LEGENDARY_MOVE_OF.latios, 'dragonBreath', 'psyshock', 'dragonTail', 'futureSight', 'roost', 'shockWave', 'iceShard']],
    line: stage(381, 'Latios', ['dragon', 'psychic']),
    awakenings: [{ maxHp: 25, might: 0.12, speed: 3 }, { maxHp: 35, might: 0.25, projectileSpeed: 0.1 }],
    innate: { ability: 'levitate' },
    unlock: RIFT_WINS,
  },
  deoxys: {
    name: 'Deoxys',
    color: '#e86838',
    stats: { maxHp: 30, might: 0.22, speed: 6, cooldown: -0.04 },
    signature: LEGENDARY_MOVE_OF.deoxys,
    learnset: [[LEGENDARY_MOVE_OF.deoxys, 'psyshock', 'futureSight', 'psybeam', 'machPunch', 'shockWave', 'swift', 'uTurn']],
    line: stage(386, 'Deoxys', ['psychic']),
    awakenings: [{ maxHp: 25, might: 0.12, speed: 3 }, { maxHp: 35, might: 0.24, cooldown: -0.05 }],
    innate: { ability: 'pressure' },
    unlock: RIFT_WINS,
  },

  /* ---------- The god ---------- */
  arceus: {
    name: 'Arceus',
    color: '#e8e0c8',
    stats: { maxHp: 50, might: 0.25, armor: 1, speed: 4 },
    signature: LEGENDARY_MOVE_OF.arceus,
    learnset: [[LEGENDARY_MOVE_OF.arceus, 'swift', 'gigaImpact', 'earthquake', 'futureSight', 'flashCannon', 'shockWave', 'roost']],
    line: stage(493, 'Arceus', ['normal']),
    awakenings: [{ maxHp: 30, might: 0.15, armor: 1 }, { maxHp: 45, might: 0.25, area: 0.1, cooldown: -0.05 }],
    innate: { ability: 'multitype' },
    unlock: { wins: 1, endless: true, last: true },
  },

  /* ---------- The Noite das Bruxas' nightmare ---------- */
  darkrai: {
    name: 'Darkrai',
    color: '#7058a0',
    stats: { maxHp: 30, might: 0.22, speed: 8, cooldown: -0.04 },
    signature: LEGENDARY_MOVE_OF.darkrai,
    learnset: [[LEGENDARY_MOVE_OF.darkrai, 'suckerPunch', 'crunch', 'hex', 'dreamEater', 'psyshock', 'futureSight', 'snarl']],
    line: stage(491, 'Darkrai', ['dark']),
    awakenings: [{ maxHp: 25, might: 0.12, speed: 3 }, { maxHp: 35, might: 0.24, area: 0.1 }],
    innate: { ability: 'badDreams' },
    unlock: { wins: 2, event: 'halloween' },
  },
} as const satisfies Record<LegendId, LegendDef>

export const isLegend = (id: unknown): id is LegendId => LEGEND_IDS.some((l) => l === id)

/** The event a legend is captured in, or null for a regular one. */
export const legendEvent = (id: LegendId): LegendEvent | null => {
  const unlock: LegendUnlock = LEGENDS[id].unlock
  return unlock.event ?? null
}

/** The legendary move a legend opens with, which stays its own (it never fuses into a duo); null for every other starter. */
export const legendSignature = (starter: string): MoveId | null => (isLegend(starter) ? LEGENDS[starter].signature : null)

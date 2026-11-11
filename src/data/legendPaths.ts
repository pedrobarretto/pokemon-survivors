import type { MoveId } from '../game/moves'
import type { StatDelta } from '../game/stats'
import type { PokeType } from './types'

/**
 * The legend paths: five long goals that each end in a Legend-mode legend,
 * the way the games hand them out, all automatic (nothing scheduled by hand).
 * The rules live in `game/legendPaths.ts` (the save's side, shared with the
 * API) and the run's side in `game/pathRun.ts`; these are their numbers, a
 * first rough pass to tune from play. Words live in `i18n` (`paths`).
 *
 * - Zygarde: Cells (and the rarer Cores) turn up in runs; the Zygarde Cube
 *   holds them. 10 pieces bring Zygarde 10%, 50 open its 50% Forme, 100 (all 5
 *   Cores among them) its Complete Forme, each worn from an awakening on.
 * - Cosmog: a research chain brings it; it walks beside the partner in the
 *   lobby and grows with the runs played, into Solgaleo or Lunala by the hours
 *   they were played at (the device's own clock).
 * - Kubfu: Machoke's Torre at the Dojo, three trials and then a tower: the
 *   Tower of Darkness or the Tower of Waters decides Urshifu's style.
 * - Meltan: a Mystery Box dug up at the Escavação (the API's), then Hex Nuts
 *   its own runs gather: 400 evolve it into Melmetal at its second awakening.
 * - Regigigas: wakes for whoever captured Regirock, Regice and Registeel, in a
 *   temple that turns up in their runs.
 */

export const PATH_IDS = ['zygarde', 'cosmog', 'kubfu', 'meltan', 'regigigas'] as const
export type PathId = (typeof PATH_IDS)[number]

/* ---------------- Zygarde ---------------- */

export const ZYGARDE = {
  /** Pieces in the Cube for each Forme: 10% (Zygarde comes), 50%, Complete (100%). */
  formes: { ten: 10, fifty: 50, complete: 100 },
  /** Cores among the 100: the Cube counts at most `cells` Cells, so Complete needs every Core. */
  cores: 5,
  cells: 95,
  /** A run's Cells, by the seed: the chance of each count (0, 1, 2, 3); about 1.5 a run. */
  perRun: [0.15, 0.35, 0.3, 0.2],
  /** Chance a run brings a Core too. */
  core: 1 / 7,
  /** When the pieces may turn up (run seconds), and at least this far apart. */
  from: 75,
  until: 810,
  apart: 120,
  /** Px from the player a piece settles at, and how long it waits there before it burrows away. */
  distance: [120, 175],
  lifetime: 40,
  /** How close counts as a touch (px, plus the player's body). */
  radius: 7,
  /** A Core creeps away from the player at this pace (px/s), the base walk being 68. */
  coreSpeed: 16,
} as const

/* ---------------- Cosmog ---------------- */

/**
 * Cosmog's research (each step once, in any order, at most one a run) and
 * then its growth: runs of at least `minRun` seconds count, by the hour on the
 * device's clock they ended at (`day` hours are the Sun's, the rest the Moon's).
 */
export const COSMOG = {
  research: ['night', 'day', 'rift'],
  minRun: 300,
  day: [6, 18],
  /** Counted runs to turn into Cosmoem, and to evolve. */
  cosmoem: 8,
  evolve: 24,
} as const

export type CosmogStep = (typeof COSMOG.research)[number]

/** Cosmog's line in the lobby: Cosmog, then Cosmoem. */
export const COSMOG_DEX = { cosmog: 789, cosmoem: 790 } as const

/* ---------------- Kubfu ---------------- */

/** The towers of the last trial, and the style each makes of Urshifu. */
export const TOWERS = ['dark', 'water'] as const
export type Tower = (typeof TOWERS)[number]

/** How a trial is won: damage dealt, hits landed, or dummies knocked out (their HP doesn't refill). */
export type TrialGoal = { kind: 'damage' | 'hits' | 'knockouts'; need: number }

/**
 * A trial at the Torre (`game/towerTrial.ts`): who plays it (Machoke's
 * student, or Kubfu for the towers) and with which moves, the dummies (how
 * many, their HP when they can be knocked out, how they move) and the goal
 * within `time` seconds. Fixed loadouts: the Dojo lets any build be set, so a
 * trial is won by how it's played, not by what's equipped.
 */
export type TrialDef = {
  starter: 'machop' | 'kubfu'
  moves: readonly { id: MoveId; level: number }[]
  dummies: { count: number; hp?: number; move?: 'circle' | 'dodge' }
  goal: TrialGoal
  time: number
}

export const TRIALS = {
  // The fist: one dummy, every hit counts. Stay close.
  fist: { starter: 'machop', moves: [{ id: 'dynamicPunch', level: 3 }, { id: 'machPunch', level: 3 }], dummies: { count: 1 }, goal: { kind: 'damage', need: 650 }, time: 15 },
  // The crowd: a pack of ten, only standing among them reaches enough of them.
  crowd: { starter: 'machop', moves: [{ id: 'dynamicPunch', level: 3 }, { id: 'earthquake', level: 3 }], dummies: { count: 10 }, goal: { kind: 'damage', need: 2500 }, time: 15 },
  // The chase: four dummies circling the yard; land the hits.
  chase: { starter: 'machop', moves: [{ id: 'machPunch', level: 4 }, { id: 'dynamicPunch', level: 2 }], dummies: { count: 4, move: 'circle' }, goal: { kind: 'hits', need: 60 }, time: 18 },
  // The Tower of Darkness: one strike at a time, heavy enough to break armored dummies.
  dark: { starter: 'kubfu', moves: [{ id: 'wickedBlow', level: 3 }], dummies: { count: 3, hp: 420, move: 'dodge' }, goal: { kind: 'knockouts', need: 3 }, time: 25 },
  // The Tower of Waters: blows like a current, many and quick.
  water: { starter: 'kubfu', moves: [{ id: 'wickedBlow', level: 3 }, { id: 'machPunch', level: 4 }], dummies: { count: 5, move: 'circle' }, goal: { kind: 'hits', need: 90 }, time: 18 },
} as const satisfies Record<string, TrialDef>

export type TrialId = keyof typeof TRIALS

/** The floors before the towers, in order: clearing all three brings Kubfu. */
export const FLOORS = ['fist', 'crowd', 'chase'] as const satisfies readonly TrialId[]

/* ---------------- Meltan ---------------- */

export const MELTAN = {
  /** Hex Nuts that evolve it into Melmetal (at its second awakening). */
  nuts: 400,
  /** A Hex Nut from a fainted foe in Meltan's runs: Steel types more often; a boss scatters a handful. */
  drop: 0.02,
  steel: 0.15,
  boss: 6,
  /** The Mystery Box at the Escavação: the chance a wall holds it while the account has no Meltan, and the walls after which one surely does. */
  box: 0.06,
  boxGuarantee: 12,
} as const

/* ---------------- Regigigas ---------------- */

export const REGIGIGAS = {
  /** The captures that wake it. */
  wakers: ['regirock', 'regice', 'registeel'],
  /** Chance a run brings its temple (by the seed): until Regigigas is captured, and after. */
  temple: 0.5,
  rematch: 0.12,
  /** When the temple stands (run seconds), how far ahead of the player, and how close wakes it. */
  at: [240, 540],
  distance: 210,
  wake: 46,
} as const

/* ---------------- The forms the paths open ---------------- */

/**
 * The forms a path opens, worn from the awakening `at` on (0: from the start)
 * in a run that starts with it open (`ReplayStart.forms`), each with stats of
 * its own on top of the awakenings'. `dex` when it's another species' sprite
 * (Urshifu, Melmetal), `key` the asset form (`<dex>/<key>/`).
 */
export type PathFormDef = {
  legend: 'zygarde' | 'kubfu' | 'meltan'
  at: 0 | 1 | 2
  dex?: number
  key?: 'ten' | 'complete' | 'rapid'
  name: string
  types?: readonly PokeType[]
  stats: StatDelta
}

export const PATH_FORMS = {
  zygarde10: { legend: 'zygarde', at: 0, key: 'ten', name: 'Zygarde 10%', stats: { speed: 6 } },
  zygarde50: { legend: 'zygarde', at: 1, name: 'Zygarde 50%', stats: { maxHp: 25, armor: 1 } },
  zygardeComplete: { legend: 'zygarde', at: 2, key: 'complete', name: 'Zygarde Complete', stats: { maxHp: 45, might: 0.1, area: 0.05 } },
  urshifuSingle: { legend: 'kubfu', at: 2, dex: 892, name: 'Urshifu', types: ['fighting', 'dark'], stats: { might: 0.15, maxHp: 15 } },
  urshifuRapid: { legend: 'kubfu', at: 2, dex: 892, key: 'rapid', name: 'Urshifu', types: ['fighting', 'water'], stats: { cooldown: -0.06, speed: 4, maxHp: 15 } },
  melmetal: { legend: 'meltan', at: 2, dex: 809, name: 'Melmetal', stats: { maxHp: 55, armor: 2, speed: -3 } },
} as const satisfies Record<string, PathFormDef>

export type PathFormId = keyof typeof PATH_FORMS

export const PATH_FORM_IDS = Object.keys(PATH_FORMS) as PathFormId[]

export const isPathForm = (v: unknown): v is PathFormId => typeof v === 'string' && Object.hasOwn(PATH_FORMS, v)

/** Urshifu's form for each tower. */
export const TOWER_FORM = { dark: 'urshifuSingle', water: 'urshifuRapid' } as const satisfies Record<Tower, PathFormId>

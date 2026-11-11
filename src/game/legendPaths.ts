import { hash2 } from '../engine/rng'
import { isLegend, type LegendId } from '../data/legends'
import { COSMOG, FLOORS, MELTAN, PATH_FORM_IDS, PATH_FORMS, REGIGIGAS, TOWER_FORM, TOWERS, TRIALS, ZYGARDE, type CosmogStep, type PathFormId, type PathId, type Tower, type TrialId } from '../data/legendPaths'
import type { Gift } from './gifts'
import { isRecord, wholeNumber } from './parse'

/**
 * The legend paths' save side (`data/legendPaths.ts`), pure and shared with
 * the API: what the save keeps of each path, how two saves merge, the forms a
 * run starts with open, and the game-made gifts each path earns (worked out
 * from the save, so guests get them too; the API vouches for them the same
 * way, `gameGiftsApplied`). Meltan's comes from the API (the Escavação's
 * Mystery Box) and Regigigas is caught by beating it, like any legend.
 */

/** The legends Cosmog grows into. */
export type CosmogLegend = Extract<LegendId, 'solgaleo' | 'lunala'>

/**
 * Cosmog: the research steps done (any order), then, once they're all done,
 * the runs counted since this Cosmog came and how many ended by day (`sun`)
 * or by night (`moon`); `raised`, the legends Cosmogs grew into so far.
 */
export type CosmogSave = { research: readonly CosmogStep[]; runs: number; sun: number; moon: number; raised: readonly CosmogLegend[] }

/**
 * Every path's progress: the Zygarde Cube's Cells and Cores, Cosmog's,
 * the Torre's trials cleared (a tower among them once climbed) and Meltan's
 * Hex Nuts. Counters only grow.
 */
export type PathsSave = { cells: number; cores: number; cosmog: CosmogSave; trials: readonly TrialId[]; nuts: number }

export const NO_COSMOG: CosmogSave = { research: [], runs: 0, sun: 0, moon: 0, raised: [] }

export const NO_PATHS: PathsSave = { cells: 0, cores: 0, cosmog: NO_COSMOG, trials: [], nuts: 0 }

const COSMOG_LEGENDS = ['solgaleo', 'lunala'] as const satisfies readonly CosmogLegend[]
const TRIAL_IDS = Object.keys(TRIALS) as TrialId[]

/* ---------------- Save field ---------------- */

const oneOf = <T extends string>(list: readonly T[], raw: unknown): T[] => (Array.isArray(raw) ? list.filter((id) => raw.includes(id)) : [])

/** The trials cleared, with one tower at most (the Tower of Darkness when a save somehow holds both). */
const oneTower = (trials: readonly TrialId[]): TrialId[] => {
  const tower = TOWERS.find((t) => trials.includes(t))
  return trials.filter((id) => !TOWERS.some((t) => t === id) || id === tower)
}

const parseCosmog = (raw: unknown): CosmogSave => {
  if (!isRecord(raw)) return NO_COSMOG
  return { research: oneOf(COSMOG.research, raw.research), runs: wholeNumber(raw.runs), sun: wholeNumber(raw.sun), moon: wholeNumber(raw.moon), raised: oneOf(COSMOG_LEGENDS, raw.raised) }
}

export const parsePaths = (raw: unknown): PathsSave => {
  if (!isRecord(raw)) return NO_PATHS
  return { cells: wholeNumber(raw.cells), cores: wholeNumber(raw.cores), cosmog: parseCosmog(raw.cosmog), trials: oneTower(oneOf(TRIAL_IDS, raw.trials)), nuts: wholeNumber(raw.nuts) }
}

/**
 * Both saves' paths in one, every counter at the larger side; Cosmog's
 * research and the legends raised are unions, and its run counts come with the
 * side further along (more raised, then more runs), so the two devices' Cosmogs
 * don't add up into one that was never raised. The trials are a union (one tower).
 */
export const mergePaths = (a: PathsSave, b: PathsSave): PathsSave => {
  const ahead = a.cosmog.raised.length !== b.cosmog.raised.length ? (a.cosmog.raised.length > b.cosmog.raised.length ? a.cosmog : b.cosmog) : a.cosmog.runs >= b.cosmog.runs ? a.cosmog : b.cosmog
  return {
    cells: Math.max(a.cells, b.cells),
    cores: Math.max(a.cores, b.cores),
    cosmog: {
      research: COSMOG.research.filter((s) => a.cosmog.research.includes(s) || b.cosmog.research.includes(s)),
      runs: ahead.runs,
      sun: ahead.sun,
      moon: ahead.moon,
      raised: COSMOG_LEGENDS.filter((l) => a.cosmog.raised.includes(l) || b.cosmog.raised.includes(l)),
    },
    trials: oneTower(TRIAL_IDS.filter((id) => a.trials.includes(id) || b.trials.includes(id))),
    nuts: Math.max(a.nuts, b.nuts),
  }
}

/* ---------------- Zygarde ---------------- */

/** The Cube's pieces: Cells up to `ZYGARDE.cells`, Cores up to `ZYGARDE.cores` (so 100% needs every Core). */
export const cubePieces = (p: Pick<PathsSave, 'cells' | 'cores'>) => Math.min(p.cells, ZYGARDE.cells) + Math.min(p.cores, ZYGARDE.cores)

/** How many Cells a run of `seed` brings (`ZYGARDE.perRun`), and whether a Core comes with them: drawn apart from the run's rng. */
export const runPieces = (seed: number) => {
  const roll = hash2(seed, 1, 7187)
  let acc = 0
  const cells = ZYGARDE.perRun.findIndex((p) => (acc += p) > roll)
  return { cells: cells < 0 ? ZYGARDE.perRun.length - 1 : cells, core: hash2(seed, 2, 7187) < ZYGARDE.core }
}

/* ---------------- Cosmog ---------------- */

/** Whether `hour` (0–23 on the device's clock) is the Sun's. */
export const sunHour = (hour: number) => hour >= COSMOG.day[0] && hour < COSMOG.day[1]

/** Cosmog's research is done: it's in the lobby, growing. */
export const cosmogHere = (c: CosmogSave) => COSMOG.research.every((s) => c.research.includes(s)) && c.raised.length < COSMOG_LEGENDS.length

/** What Cosmog is now: Cosmog, Cosmoem, or null while there's none (its research to do, or both legends raised). */
export const cosmogStage = (c: CosmogSave): 'cosmog' | 'cosmoem' | null => (!cosmogHere(c) ? null : c.runs >= COSMOG.cosmoem ? 'cosmoem' : 'cosmog')

/**
 * The legend this Cosmog leans toward: the second Cosmog grows into the one
 * still missing; the first follows the hours its runs ended at (the Sun's,
 * Solgaleo; the Moon's, Lunala; a tie goes to the run that tips it, `sunNow`).
 */
export const cosmogLean = (c: CosmogSave, sunNow: boolean): CosmogLegend => {
  const missing = COSMOG_LEGENDS.filter((l) => !c.raised.includes(l))
  if (missing.length === 1) return missing[0]!
  if (c.sun !== c.moon) return c.sun > c.moon ? 'solgaleo' : 'lunala'
  return sunNow ? 'solgaleo' : 'lunala'
}

/** What a run reads for Cosmog: how long it lasted, whether it won, whether it beat a rift's legendary. */
export type CosmogRun = { time: number; victory: boolean; rift: boolean }

/**
 * Cosmog after a run that ended at `hour` (the device's clock): a win by
 * night, a win by day and a rift's legendary beaten each tick a research step
 * off (one a run); once they're done, every run of `COSMOG.minRun` seconds or
 * more counts toward growing, and at `COSMOG.evolve` it becomes its legend
 * (`raised`) and a new Cosmog starts over. `first`: the run's first record
 * (a run recorded again, at endless or the way out, counts once).
 */
export const recordCosmog = (c: CosmogSave, run: CosmogRun, hour: number, first: boolean): CosmogSave => {
  if (!first) return c
  const sun = sunHour(hour)
  if (!cosmogHere(c)) {
    if (c.raised.length >= COSMOG_LEGENDS.length) return c
    const step = COSMOG.research.find((s) => !c.research.includes(s) && (s === 'rift' ? run.rift : run.victory && (s === 'day') === sun))
    return step ? { ...c, research: COSMOG.research.filter((s) => s === step || c.research.includes(s)) } : c
  }
  if (run.time < COSMOG.minRun) return c
  const grown = { ...c, runs: c.runs + 1, sun: c.sun + (sun ? 1 : 0), moon: c.moon + (sun ? 0 : 1) }
  if (grown.runs < COSMOG.evolve) return grown
  const legend = cosmogLean(grown, sun)
  return { ...c, runs: 0, sun: 0, moon: 0, raised: COSMOG_LEGENDS.filter((l) => l === legend || c.raised.includes(l)) }
}

/* ---------------- Kubfu ---------------- */

/** The tower climbed, if any. */
export const towerOf = (trials: readonly TrialId[]): Tower | null => TOWERS.find((t) => trials.includes(t)) ?? null

/** Whether the trial can be taken now: each floor after the one before it, a tower after every floor (and only one tower, ever). */
export const trialOpen = (trials: readonly TrialId[], id: TrialId) => {
  const floor = FLOORS.findIndex((f) => f === id)
  if (floor >= 0) return FLOORS.slice(0, floor).every((f) => trials.includes(f))
  const tower = towerOf(trials)
  return FLOORS.every((f) => trials.includes(f)) && (tower === null || tower === id)
}

/** Kubfu joined: every floor cleared. */
export const kubfuJoined = (trials: readonly TrialId[]) => FLOORS.every((f) => trials.includes(f))

/** The trials after clearing `id` (a trial not open yet changes nothing). */
export const clearTrial = (trials: readonly TrialId[], id: TrialId): TrialId[] =>
  trialOpen(trials, id) && !trials.includes(id) ? TRIAL_IDS.filter((t) => t === id || trials.includes(t)) : [...trials]

/* ---------------- Regigigas ---------------- */

/** Whether every waker is captured (`REGIGIGAS.wakers`): `captured` says whether a legend is. */
export const giantAwake = (captured: (id: LegendId) => boolean) => REGIGIGAS.wakers.every((id) => captured(id))

/** Whether the run of `seed` brings the temple: only once the trio is captured; often until Regigigas is, now and then after. */
export const templeRun = (seed: number, awake: boolean, caught: boolean) => awake && hash2(seed, 3, 7187) < (caught ? REGIGIGAS.rematch : REGIGIGAS.temple)

/* ---------------- Forms ---------------- */

/**
 * The path forms a run with `legend` starts with open, from the save: Zygarde's
 * by the Cube's pieces, Urshifu's by the tower climbed, Melmetal by the Hex Nuts.
 */
export const openForms = (paths: PathsSave, legend: string): PathFormId[] => {
  if (!isLegend(legend)) return []
  const pieces = cubePieces(paths)
  const tower = towerOf(paths.trials)
  const open: Record<PathFormId, boolean> = {
    zygarde10: pieces >= ZYGARDE.formes.ten,
    zygarde50: pieces >= ZYGARDE.formes.fifty,
    zygardeComplete: pieces >= ZYGARDE.formes.complete,
    urshifuSingle: tower !== null && TOWER_FORM[tower] === 'urshifuSingle',
    urshifuRapid: tower !== null && TOWER_FORM[tower] === 'urshifuRapid',
    melmetal: paths.nuts >= MELTAN.nuts,
  }
  return PATH_FORM_IDS.filter((id) => PATH_FORMS[id].legend === legend && open[id])
}

/* ---------------- Gifts ---------------- */

const PREFIX = 'path:'

export const isPathGift = (id: string) => id.startsWith(PREFIX)

const legendGift = (legend: LegendId, path: PathId): Gift => ({ id: `${PREFIX}${legend}`, content: { kind: 'legend', legend }, reason: { kind: 'path', path } })

/** Every legend the paths brought on this save, applied or not: Zygarde at 10%, Kubfu when it joins, the legends Cosmog grew into. */
export const pathGiftList = (save: { paths: PathsSave }): Gift[] => [
  ...(cubePieces(save.paths) >= ZYGARDE.formes.ten ? [legendGift('zygarde', 'zygarde')] : []),
  ...(kubfuJoined(save.paths.trials) ? [legendGift('kubfu', 'kubfu')] : []),
  ...COSMOG_LEGENDS.filter((l) => save.paths.cosmog.raised.includes(l)).map((l) => legendGift(l, 'cosmog')),
]

/** The gifts waiting to be opened. */
export const pathGifts = (save: { paths: PathsSave; gifts: readonly string[] }): Gift[] => pathGiftList(save).filter((g) => !save.gifts.includes(g.id))

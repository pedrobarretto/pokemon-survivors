import { isHatchling, isStarter, PLAYABLE, PLAYABLE_IDS, type PlayableId } from '../data/hatchlings'
import type { MinigameId } from '../data/minigames'
import { FEAT_FAMILIES, FIND_IDS, FIND_ODDS, RESEARCH, RESEARCH_IDS, RESEARCH_TYPES, type FindId, type ResearchId } from '../data/seasonOneUnlocks'
import { hash2 } from '../engine/rng'
import type { Gift } from './gifts'
import { isRecord, wholeNumber } from './parse'

/**
 * Temporada 1's ways into a family that aren't an egg, as pure rules shared
 * with the API: which encounters a run's seed brings, the research chains the
 * save tracks from run results, and the game-made gifts both earn
 * (`game/gameGifts.ts`), worked out from the save so guests get them too.
 */

/* ---------------- Encounters ---------------- */

const SALT = 8191

/** Whether the run of `seed` brings encounter `find`, drawn apart from the run's rng. */
export const rollFind = (seed: number, find: FindId) => hash2(seed, FIND_IDS.indexOf(find) + 1, SALT) < FIND_ODDS[find]

/** The save's `finds`: the encounters ever made, without duplicates. */
export const parseFinds = (v: unknown): FindId[] => (Array.isArray(v) ? FIND_IDS.filter((id) => v.includes(id)) : [])

/** Both lists in one, in the table's order so the merge comes out the same either way. */
export const mergeFinds = (a: readonly FindId[], b: readonly FindId[]): FindId[] => FIND_IDS.filter((id) => a.includes(id) || b.includes(id))

/* ---------------- Research ---------------- */

/** Steps done of the chains that count them, and the partners that won for Tatsugiri's (its steps are their number). */
export type ResearchSave = { mankey: number; goomy: number; partners: readonly PlayableId[] }

export const NO_RESEARCH: ResearchSave = { mankey: 0, goomy: 0, partners: [] }

/** How many steps a chain has. */
const STEPS = 3

const isPartner = (v: unknown): v is PlayableId => PLAYABLE_IDS.some((id) => id === v)

export const parseResearch = (v: unknown): ResearchSave => {
  if (!isRecord(v)) return NO_RESEARCH
  return {
    mankey: wholeNumber(v.mankey, STEPS),
    goomy: wholeNumber(v.goomy, STEPS),
    partners: Array.isArray(v.partners) ? [...new Set(v.partners.filter(isPartner))].slice(0, STEPS) : [],
  }
}

/** Each chain at the side further along; the partners a union (up to a chain's steps), sorted so the merge comes out the same either way. */
export const mergeResearch = (a: ResearchSave, b: ResearchSave): ResearchSave => ({
  mankey: Math.max(a.mankey, b.mankey),
  goomy: Math.max(a.goomy, b.goomy),
  partners: [...new Set([...a.partners, ...b.partners])].sort().slice(0, STEPS),
})

/** Whether a partner counts for Tatsugiri's chain: a regular Pokémon (no legend) with a Water or Dragon stage. */
export const countsAsPartner = (id: PlayableId) =>
  (isStarter(id) || isHatchling(id)) && PLAYABLE[id].line.some((stage) => stage.types.some((type) => RESEARCH_TYPES.some((wanted) => wanted === type)))

/** What research reads of a run (`RunSummary`). */
export type ResearchRun = { starter: PlayableId; victory: boolean; hits: number; wet: boolean }

/** How far a chain is along, 0 to its steps. */
const stepsDone = (r: ResearchSave, id: ResearchId) => (id === 'tatsugiri' ? r.partners.length : r[id])

/**
 * Research after a run, or what changed since `before` (the snapshot already
 * recorded for it): a win moves each chain by at most one step, once, however
 * many times the run is recorded (victory, endless, the way out).
 */
export const recordResearch = (r: ResearchSave, run: ResearchRun, before: ResearchRun | null): ResearchSave => {
  if (!run.victory || before?.victory) return r
  const mankeyNeeds = RESEARCH.mankey.steps[r.mankey]
  return {
    mankey: mankeyNeeds !== undefined && run.hits >= mankeyNeeds ? r.mankey + 1 : r.mankey,
    goomy: run.wet ? Math.min(STEPS, r.goomy + 1) : r.goomy,
    partners: countsAsPartner(run.starter) && !r.partners.includes(run.starter) && r.partners.length < STEPS ? [...r.partners, run.starter] : r.partners,
  }
}

/** A chain as the screen shows it: each step's number and whether it's done, the step under way marked `current`. */
export const researchStatus = (r: ResearchSave, id: ResearchId) => {
  const done = stepsDone(r, id)
  return {
    done,
    complete: done >= STEPS,
    steps: RESEARCH[id].steps.map((need, i) => ({ need, done: i < done, current: i === done })),
  }
}

/* ---------------- Gifts ---------------- */

const PREFIX = 'season:'

export const isSeasonGift = (id: string) => id.startsWith(PREFIX)

/** Every family these routes earned on this save, applied or not. */
export const seasonGiftList = (save: { finds: readonly FindId[]; research: ResearchSave }): Gift[] => [
  ...save.finds.map((family): Gift => ({ id: `${PREFIX}${family}`, content: { kind: 'family', family }, reason: { kind: 'season', way: 'find' } })),
  ...RESEARCH_IDS.filter((id) => researchStatus(save.research, id).complete).map((family): Gift => ({ id: `${PREFIX}${family}`, content: { kind: 'family', family }, reason: { kind: 'season', way: 'research' } })),
]

/** The gifts waiting to be opened. */
export const seasonGifts = (save: { finds: readonly FindId[]; research: ResearchSave; gifts: readonly string[] }): Gift[] => seasonGiftList(save).filter((g) => !save.gifts.includes(g.id))

/* ---------------- Mini game feats ---------------- */

/** The families that `feats` of `game` bring (`FEAT_FAMILIES`). */
export const featFamilies = (game: MinigameId, feats: readonly string[]) => feats.flatMap((feat) => FEAT_FAMILIES[game]?.[feat] ?? [])

/** The first family a claim brought for the first time: what `feats` holds and `was` didn't. */
export const newFeatFamily = (game: MinigameId, was: readonly string[], feats: readonly string[]) => {
  const had = featFamilies(game, was)
  return featFamilies(game, feats).find((family) => !had.includes(family)) ?? null
}

import { isRecord, wholeNumber } from './parse'

/**
 * The way into the Rocket Hideout, from the save's side: Team Rocket's poster
 * in the Game Corner (`ui/realm.ts`) gives a pass once a Brasília day, and the
 * next run started with it brings the Hideout's entrance onto its map
 * (`ReplayStart.hideout`, `data/rocketHideout.ts`). Kept as the day the
 * poster last gave one and the day of the pass a run used, so two devices
 * never use one pass twice once synced (both merge to the later day). Pure;
 * shared with the API through the save.
 */
export type HideoutSave = { given: string | null; used: string | null; clears: number }

export const NO_HIDEOUT: HideoutSave = { given: null, used: null, clears: 0 }

const DAY = /^\d{4}-\d{2}-\d{2}$/

const dayOf = (v: unknown): string | null => (typeof v === 'string' && DAY.test(v) ? v : null)

const later = (a: string | null, b: string | null) => (a === null ? b : b === null ? a : a > b ? a : b)

/** Whether a pass waits for the next run. */
export const holdsPass = (s: HideoutSave) => s.given !== null && s.used !== s.given

/** What reading the poster on `day` does: a new pass, the one still held, or none until tomorrow. */
export const readPoster = (s: HideoutSave, day: string): { save: HideoutSave; got: 'new' | 'held' | 'tomorrow' } =>
  holdsPass(s) ? { save: s, got: 'held' } : s.given === day ? { save: s, got: 'tomorrow' } : { save: { ...s, given: day }, got: 'new' }

/** A run started with the pass: it's spent. */
export const usePass = (s: HideoutSave): HideoutSave => (holdsPass(s) ? { ...s, used: s.given } : s)

/** Giovanni beaten once more. */
export const hideoutCleared = (s: HideoutSave): HideoutSave => ({ ...s, clears: s.clears + 1 })

export const mergeHideout = (a: HideoutSave, b: HideoutSave): HideoutSave => ({ given: later(a.given, b.given), used: later(a.used, b.used), clears: Math.max(a.clears, b.clears) })

export const parseHideout = (raw: unknown): HideoutSave =>
  isRecord(raw) ? { given: dayOf(raw.given), used: dayOf(raw.used), clears: wholeNumber(raw.clears) } : NO_HIDEOUT

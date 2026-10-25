import { isLegend, LEGEND_IDS, LEGENDS, REGULAR_LEGENDS, type LegendId, type LegendUnlock } from '../data/legends'
import { MYTHICALS, TRIO_IDS, TRIOS } from '../data/waves'
import type { PlayableId } from '../data/hatchlings'
import { isUnlocked } from './eggs'
import type { Save } from './meta'
import { isRecord, wholeNumber } from './parse'
import { unlockShinyStarter } from './shinyStarters'

/**
 * Capturing legends for the Legend mode: beating a legendary as a boss (any
 * mode) counts toward catching it, and once its `unlock.wins` are in, it's
 * playable. Arceus only counts in endless mode, and only once the other 22
 * regular legends are captured (an event legend, like Darkrai, never holds it
 * back). A festival legend (Cresselia) is never fought: its festival's
 * milestone gift captures it (`captureByGift`). A shiny one beaten on its
 * capturing win, or on any win after, also unlocks its shiny (kept in
 * `shinyStarters`, like any owned shiny). Pure: the shell banks each
 * `legendBeaten` event through `recordLegendWin`.
 */

/** Wins banked toward capturing each legend (a legend at its `unlock.wins` is captured). */
export type Captures = Readonly<Partial<Record<LegendId, number>>>

export const NO_CAPTURES: Captures = {}

/** Where a legend can be beaten: a rift, the trio's wave, the finale's rare guest, the finale itself, the endless mode's reaper, an event's rift; or the festival gift that brings it. */
export type LegendSource = 'rift' | 'trio' | 'mythical' | 'finale' | 'endless' | 'event' | 'festival'

const inList = (list: readonly string[], id: LegendId) => list.includes(id)

export const legendSource = (id: LegendId): LegendSource => {
  const unlock: LegendUnlock = LEGENDS[id].unlock
  if (unlock.festival) return 'festival'
  if (unlock.event) return 'event'
  if (unlock.endless) return 'endless'
  if (id === 'mewtwo') return 'finale'
  if (inList(MYTHICALS, id)) return 'mythical'
  if (TRIO_IDS.some((trio) => inList(TRIOS[trio], id))) return 'trio'
  return 'rift'
}

/** Wins a legend needs to be captured. */
export const winsNeeded = (id: LegendId) => LEGENDS[id].unlock.wins

export const isCaptured = (captures: Captures, id: LegendId) => (captures[id] ?? 0) >= winsNeeded(id)

/** How many legends of `ids` are captured (every legend by default; `REGULAR_LEGENDS` for the ones Arceus waits for). */
export const capturedCount = (captures: Captures, ids: readonly LegendId[] = LEGEND_IDS) => ids.filter((id) => isCaptured(captures, id)).length

/** Whether every regular legend but `id` is in (`unlock.last`: Arceus waits for the other 22, never for an event legend). */
const othersCaptured = (captures: Captures, id: LegendId) => REGULAR_LEGENDS.every((other) => other === id || isCaptured(captures, other))

/** Whether a win over `id` right now counts toward capturing it: Arceus' only in endless mode, after the other 22; a festival legend's never. */
export const winCounts = (captures: Captures, id: LegendId, endless: boolean) => {
  const unlock: LegendUnlock = LEGENDS[id].unlock
  return !unlock.festival && (!unlock.endless || endless) && (!unlock.last || othersCaptured(captures, id))
}

/** The captures with `id` captured, as a gift brings it (a festival legend's milestone gift). */
export const captureByGift = (captures: Captures, id: LegendId): Captures => ({ ...captures, [id]: Math.max(captures[id] ?? 0, winsNeeded(id)) })

/** One legendary boss beaten (`GameEvent` `legendBeaten`), and whether the run was in endless mode then. */
export type LegendWin = { legend: LegendId; shiny: boolean; endless: boolean }

/**
 * What a win did: `caught` on the capturing win, `escaped` before it (or when
 * it couldn't count yet, `counted: false`), `owned` once already captured.
 * `wins`/`need` for the "2/3" line; `shiny`: its shiny got unlocked by this win.
 */
export type CaptureResult = { legend: LegendId; outcome: 'caught' | 'escaped' | 'owned'; wins: number; need: number; counted: boolean; shiny: boolean }

/** Banks a win into the save: the capture count, and the shiny when a shiny one falls on or after the capturing win. */
export const recordLegendWin = (save: Save, win: LegendWin): { save: Save; result: CaptureResult } => {
  const { legend } = win
  const need = winsNeeded(legend)
  const before = save.legends[legend] ?? 0
  const owned = before >= need
  const counted = owned || winCounts(save.legends, legend, win.endless)
  const wins = counted ? before + 1 : before
  const caught = wins >= need
  const shiny = win.shiny && caught && !(legend in save.shinyStarters)
  const next: Save = {
    ...save,
    legends: counted ? { ...save.legends, [legend]: wins } : save.legends,
    shinyStarters: shiny ? unlockShinyStarter(save.shinyStarters, legend) : save.shinyStarters,
  }
  return { save: next, result: { legend, outcome: owned ? 'owned' : caught ? 'caught' : 'escaped', wins: Math.min(wins, need), need, counted, shiny } }
}

/**
 * The capture scene's verdict on the ball (the rift's, `captureOutcome` hook
 * on the render side): `caught` when the save holds the legend captured. Ask
 * it after the shell banked the defeat (`legendBeaten` is handled the frame
 * the boss falls), so the capturing win already reads `caught`.
 */
export const captureOutcome = (save: Pick<Save, 'legends'>, legend: string): 'caught' | 'escaped' =>
  isLegend(legend) && isCaptured(save.legends, legend) ? 'caught' : 'escaped'

/** Both sides' counts in one: per legend, the larger (safe to merge again). */
export const mergeCaptures = (a: Captures, b: Captures): Captures =>
  Object.fromEntries(LEGEND_IDS.flatMap((id) => (a[id] !== undefined || b[id] !== undefined ? [[id, Math.max(a[id] ?? 0, b[id] ?? 0)]] : [])))

/** The save's `legends`: known legends with a whole count above zero. */
export const parseCaptures = (raw: unknown): Captures =>
  isRecord(raw) ? Object.fromEntries(LEGEND_IDS.flatMap((id) => (wholeNumber(raw[id]) > 0 ? [[id, wholeNumber(raw[id])]] : []))) : NO_CAPTURES

/** Whether the save can start a run with `id`: a starter, a hatched family, or a captured legend. */
export const canPlay = (save: Pick<Save, 'hatched' | 'legends'>, id: PlayableId) => (isLegend(id) ? isCaptured(save.legends, id) : isUnlocked(save.hatched, id))

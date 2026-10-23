import { playCry, playSfx } from '../engine/audio'
import { isLegend, LEGEND_IDS, LEGENDS, REGULAR_LEGENDS, type LegendId } from '../data/legends'
import { capturedCount, recordLegendWin, winsNeeded, type CaptureResult, type LegendWin } from '../game/capture'
import { cryUrl, portraitUrl } from '../render/sprites'
import { t } from '../i18n'
import { h, rich } from './dom'
import { loadSave, updateSave, writeSave } from './save'
import { toast } from './toasts'

/**
 * The shell's side of capturing legends (`game/capture.ts`): banks each
 * legendary boss's defeat into the save the moment it falls (so the capture
 * scene and a closed tab both see it) and, once the scene's ball settles, says
 * how it went: escaped with its "2/3", captured, or its shiny unlocked.
 */

const legendName = (id: LegendId) => LEGENDS[id].line[0].name

/** The toast of a banked win; false (and silent) for a legend already captured, unless its shiny just came with it. */
const captureToast = (root: HTMLElement, r: CaptureResult): boolean => {
  const m = t().legend
  const name = legendName(r.legend)
  const dex = LEGENDS[r.legend].line[0].dex
  const say = (text: string, hint: string | null, shiny = false) => {
    toast(root, h('span', { class: 'item-toast' }, h('img', { src: portraitUrl(dex, shiny), alt: '' }), h('span', {}, rich(text), hint && h('small', {}, hint))), 4600, `capture-${r.legend}`)
    return true
  }
  if (r.outcome === 'escaped') {
    playSfx('pokeballOpen')
    return say(m.escaped(name, r.wins, r.need), r.counted ? m.escapedHint(r.need - r.wins) : m.arceusHint(REGULAR_LEGENDS.length - 1 - capturedCount(loadSave().legends, REGULAR_LEGENDS)))
  }
  if (r.outcome === 'owned' && !r.shiny) return false
  playSfx('unlock')
  playCry(cryUrl(dex), 0.6)
  if (r.outcome === 'owned') return say(m.shinyUnlocked(name), m.caughtHint, true)
  return say(r.shiny ? m.caughtShiny(name) : m.caught(name), m.caughtHint, r.shiny)
}

/** Wins banked as their legendary fell, whose toasts wait for the capture scene's ball to settle (`showCapture`). */
const waiting = new Map<LegendId, CaptureResult>()

const bank = (legend: LegendId, shiny: boolean, endless: boolean) => {
  const { save, result } = recordLegendWin(loadSave(), { legend, shiny, endless } satisfies LegendWin)
  writeSave(save)
  return result
}

/** Banks a `legendBeaten` event (`endless`: the run was in endless mode then); its toast waits for the capture scene. Species that aren't legends are skipped. */
export const bankCapture = (legend: string, shiny: boolean, endless: boolean) => {
  if (isLegend(legend)) waiting.set(legend, bank(legend, shiny, endless))
}

/**
 * A capture scene's ball settled (`riftCapture`, `bossCapture`): shows the toast
 * of the win banked as `legend` fell. False when it has nothing to say (none
 * waits, or the legend was already captured), so the scene's own toast shows.
 */
export const showCapture = (root: HTMLElement, legend: string) => {
  const r = isLegend(legend) ? waiting.get(legend) : undefined
  if (!r) return false
  waiting.delete(r.legend)
  return captureToast(root, r)
}

/**
 * Dev console: `ps.capture('kyogre')` banks one win as if it fell, toast
 * included (`ps.capture('kyogre', 'shiny')` a shiny one), `ps.capture('kyogre', n)`
 * sets its count, `ps.captureAll()` captures them all, the event's Darkrai too (`true`: their shinies too).
 */
export const captureDevTools = (root: HTMLElement, endless: () => boolean) => ({
  capture: (id?: string, n?: number | 'shiny') => {
    if (!isLegend(id)) return `Legends: ${LEGEND_IDS.join(', ')}`
    if (typeof n !== 'number') return captureToast(root, bank(id, n === 'shiny', endless()))
    updateSave((s) => ({ ...s, legends: { ...s.legends, [id]: Math.max(0, Math.floor(n)) } }))
    return `${id}: ${n}/${winsNeeded(id)}`
  },
  captureAll: (shiny = false) =>
    updateSave((s) => ({
      ...s,
      legends: Object.fromEntries(LEGEND_IDS.map((id) => [id, Math.max(s.legends[id] ?? 0, winsNeeded(id))])),
      shinyStarters: shiny ? { ...s.shinyStarters, ...Object.fromEntries(LEGEND_IDS.map((id) => [id, s.shinyStarters[id] ?? true])) } : s.shinyStarters,
    })),
})

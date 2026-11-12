import { playCry, playSfx } from '../engine/audio'
import { PATH_FORMS, ZYGARDE, type PathFormId } from '../data/legendPaths'
import { LEGENDS } from '../data/legends'
import { ENEMIES } from '../data/enemies'
import { cubePieces, openForms } from '../game/legendPaths'
import type { PathNotice } from '../game/pathRun'
import type { RuinsNotice } from '../game/splitRuins'
import type { Game } from '../game/types'
import { formatNumber, t } from '../i18n'
import { toIconUrl } from '../render/art'
import { PATH_ART } from '../render/pathLegendArt'
import { cryUrl, portraitUrl } from '../render/sprites'
import { h, rich } from './dom'
import { loadSave, updateSave } from './save'
import { runToast } from './toasts'
import type { Save } from '../game/meta'

/**
 * The shell's side of the legend paths in a run (`game/pathRun.ts`): a Zygarde
 * piece is banked into the Cube the moment it's taken, Meltan's Hex Nuts as
 * the run goes (`bankNuts`, like the candy jar), and each moment gets its
 * toast; a form a path just opened says so (its legend's gift waits in the
 * lobby's box, `pathGifts`).
 */

export const cellIcon = () => toIconUrl('path:cell', () => PATH_ART.cell()[0]!)
export const coreIcon = () => toIconUrl('path:core', () => PATH_ART.core()[0]!)
export const nutIcon = () => toIconUrl('path:nut', () => PATH_ART.nut())

const say = (root: HTMLElement, icon: string, text: string, ms: number, key: string | null = null) =>
  runToast(root, 'important', h('span', { class: 'item-toast path-toast' }, h('img', { src: icon, alt: '' }), rich(text)), ms, key)

/** The forms of `legend` a change of the save opened: each says so. */
const announceForms = (root: HTMLElement, before: Save, after: Save, legend: string) => {
  const was = new Set<PathFormId>(openForms(before.paths, legend))
  for (const id of openForms(after.paths, legend)) {
    if (was.has(id)) continue
    const def = PATH_FORMS[id]
    say(root, portraitUrl('dex' in def ? def.dex : LEGENDS[def.legend].line[0].dex), t().paths.run.formOpen(def.name), 4600)
  }
}

/** The Ruínas da Decisão's moments (`game/splitRuins.ts`): risen (which Regis still sleep there), quiet while a boss fights, a ruin picked. */
const ruinsFeedback = (root: HTMLElement, notice: RuinsNotice) => {
  const m = t().regisForces.ruins
  if (notice.moment === 'silent') return say(root, portraitUrl(ENEMIES.regieleki.dex), m.silent, 2600, 'ruins')
  if (notice.moment === 'chosen') {
    playSfx('quake')
    playCry(cryUrl(ENEMIES[notice.pick].dex), 0.7)
    const name = ENEMIES[notice.pick].name
    return say(root, portraitUrl(ENEMIES[notice.pick].dex), notice.sealed ? m.chosen(name, ENEMIES[notice.sealed].name) : m.woken(name), 3600, 'ruins')
  }
  playSfx('rumble')
  const only = notice.free.length === 1 ? notice.free[0]! : null
  return say(root, portraitUrl(ENEMIES[only ?? 'regigigas'].dex), only ? m.one(ENEMIES[only].name) : m.risen, 3600, 'ruins')
}

export const pathFeedback = (root: HTMLElement, notice: PathNotice) => {
  const m = t().paths.run
  if (notice.kind === 'temple') {
    if (notice.moment === 'silent') return say(root, portraitUrl(ENEMIES.regigigas.dex), m.templeSilent, 2600, 'temple')
    if (notice.moment === 'woken') {
      playSfx('quake')
      return say(root, portraitUrl(ENEMIES.regigigas.dex), m.templeWoken, 2200, 'temple')
    }
    playSfx('rumble')
    return say(root, portraitUrl(ENEMIES.regigigas.dex), m.templeRisen, 4200, 'temple')
  }
  if (notice.kind === 'ruins') return ruinsFeedback(root, notice)
  const icon = notice.core ? coreIcon() : cellIcon()
  if (notice.moment === 'sighted') {
    playSfx('ping')
    return say(root, icon, notice.core ? m.coreSighted : m.cellSighted, 3200, 'piece')
  }
  if (notice.moment === 'gone') return say(root, icon, notice.core ? m.coreGone : m.cellGone, 2200, 'piece')
  const before = loadSave()
  updateSave((s) => ({ ...s, paths: { ...s.paths, cells: s.paths.cells + (notice.core ? 0 : 1), cores: s.paths.cores + (notice.core ? 1 : 0) } }))
  const after = loadSave()
  playSfx('unlock')
  playCry(cryUrl(718, 'ten'), 0.5)
  const pieces = `${formatNumber(Math.min(100, cubePieces(after.paths)))}/${ZYGARDE.formes.complete}`
  say(root, icon, notice.core ? m.coreFound(`${Math.min(after.paths.cores, ZYGARDE.cores)}/${ZYGARDE.cores}`) : m.cellFound(pieces), 3600, 'piece')
  announceForms(root, before, after, 'zygarde')
}

/** A Hex Nut picked up: the first of the run says what they're for. */
export const nutFeedback = (root: HTMLElement, g: Game) => {
  playSfx('coin', 60)
  if (g.paths.nuts === 1) say(root, nutIcon(), t().paths.run.nutFirst, 3200, 'nut')
}

/** Moves the run's Hex Nuts not banked yet into the save (`banked` of them already are); returns the new banked count. */
export const bankNuts = (root: HTMLElement, g: Game, banked: number) => {
  if (g.paths.nuts <= banked) return banked
  const before = loadSave()
  updateSave((s) => ({ ...s, paths: { ...s.paths, nuts: s.paths.nuts + (g.paths.nuts - banked) } }))
  announceForms(root, before, loadSave(), 'meltan')
  return g.paths.nuts
}

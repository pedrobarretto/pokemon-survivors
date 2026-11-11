import { playCry, playSfx } from '../engine/audio'
import { HATCHLINGS, PLAYABLE_IDS } from '../data/hatchlings'
import type { LandmarkId } from '../data/landmarks'
import { CASTFORM_FIND, RESEARCH, type FindId, type ResearchId } from '../data/seasonOneUnlocks'
import { spawnMapEvent } from '../game/mapEvents'
import { countsAsPartner, mergeFinds } from '../game/seasonOneUnlocks'
import type { FindMoment } from '../game/seasonOneFinds'
import { setWeather } from '../game/weather'
import type { Landmark } from '../game/terrain'
import type { Game } from '../game/types'
import { t } from '../i18n'
import { cryUrl, loadSpecies, portraitUrl } from '../render/sprites'
import { h, rich } from './dom'
import { loadSave, updateSave, writeSave } from './save'
import { runToast } from './toasts'

/**
 * The shell's side of Temporada 1's map encounters (`game/seasonOneFinds.ts`):
 * a found one is banked on the spot (its family then waits as a game-made
 * gift, `seasonGifts`), and each moment gets its toast.
 */
export const seasonFindFeedback = (root: HTMLElement, find: FindId, moment: FindMoment) => {
  const m = t().seasonUnlocks.find
  const dex = HATCHLINGS[find].line[0].dex
  const say = (text: string, ms: number) => runToast(root, 'important', h('span', { class: 'item-toast' }, h('img', { src: portraitUrl(dex), alt: '' }), rich(text)), ms)
  if (moment === 'sighted') {
    playCry(cryUrl(dex))
    return say(m.castformSighted, 3000)
  }
  if (moment === 'gone') return say(m.castformGone, 2200)
  // Every graveyard win reports Spiritomb: only the first brings the family (the place's own toast tells the rest).
  if (find === 'spiritomb' && loadSave().finds.includes('spiritomb')) return
  updateSave((save) => ({ ...save, finds: mergeFinds(save.finds, [find]) }))
  playSfx('unlock')
  playCry(cryUrl(dex))
  return say(find === 'rotom' ? m.rotom : find === 'spiritomb' ? m.spiritomb : m.castformFound, 4200)
}

/** How many of a chain's steps a dev helper can set. */
const STEPS = 3

/** Dev console helpers (`ps.*` in dev builds). `landmark` walks to the nearest one of a kind (`devLandmark` in `main.ts`). */
export const seasonFindDevTools = (game: () => Game | undefined, landmark: (g: Game, id: LandmarkId, dy: number) => Landmark | null) => ({
  /** `ps.seasonFind('rotom')` makes this run's TV flicker and walks you next to the nearest cottage's; `ps.seasonFind('castform')` brings the rain and a Castform 70 px to the right. */
  seasonFind: (find: FindId) => {
    const g = game()
    if (!g) return console.warn('ps: start a run first')
    if (find === 'spiritomb') return console.warn('ps: Spiritomb comes from the graveyard: ps.enter("graveyard"), then ps.spirits(GRAVEYARD.spirits)')
    if (find === 'rotom') {
      g.finds.tv = true
      return landmark(g, 'cottage', -14)
    }
    g.finds.castform = false
    if (g.weather.id === 'clear') setWeather(g, 'rain')
    void loadSpecies(CASTFORM_FIND.dex).catch(() => {})
    return spawnMapEvent(g, 'castform', g.player.x + 70, g.player.y)
  },
  /** `ps.research('goomy', 2)` sets a chain's steps done (all of them without a number, which puts its family in the gift box). */
  research: (id: ResearchId, steps: number = STEPS) => {
    const save = loadSave()
    const partners = PLAYABLE_IDS.filter(countsAsPartner).slice(0, steps)
    writeSave({ ...save, research: id === 'tatsugiri' ? { ...save.research, partners } : { ...save.research, [id]: Math.min(steps, RESEARCH[id].steps.length) } })
    return loadSave().research
  },
})

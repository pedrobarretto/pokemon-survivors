import { playCry, playSfx } from '../engine/audio'
import { HATCHLINGS, PLAYABLE_IDS } from '../data/hatchlings'
import type { LandmarkId } from '../data/landmarks'
import { CASTFORM_FIND, RESEARCH, type FindId, type ResearchId } from '../data/seasonOneUnlocks'
import { spawnMapEvent } from '../game/mapEvents'
import { countsAsPartner, graveFind, mergeFinds, repeatShinyHit, repeatShinyOpen, tvShinyRoll } from '../game/seasonOneUnlocks'
import type { FindMoment } from '../game/seasonOneFinds'
import { setWeather } from '../game/weather'
import type { Landmark } from '../game/terrain'
import type { Game } from '../game/types'
import { t } from '../i18n'
import { cryUrl, loadSpecies, portraitUrl } from '../render/sprites'
import { h, rich } from './dom'
import { loadSave, updateSave, writeSave } from './save'
import { runToast } from './toasts'

/** `ps.seasonFind('rotom', 'shiny')` makes the next repeat TV find land Rotom's shiny, whatever the run's roll. */
const dev = { shiny: false }

/**
 * Whether this repeat TV find brings Rotom's shiny: the family owned and its
 * shiny not, nor already waiting, and the run's own roll (`tvShinyRoll`).
 * The roll is the seed's, so a run brings it or not however often it's reported.
 */
const tvShiny = (seed: number) => {
  const save = loadSave()
  if (save.shinyFinds.includes('rotom') || !repeatShinyOpen(save.hatched, 'rotom')) return false
  return dev.shiny || repeatShinyHit('rotom', tvShinyRoll(seed))
}

/**
 * The shell's side of Temporada 1's map encounters (`game/seasonOneFinds.ts`):
 * a found one is banked on the spot (its family then waits as a game-made
 * gift, `seasonGifts`), and each moment gets its toast. Found again by an
 * owner, Rotom may bring its shiny (`REPEAT_SHINY`), banked in `shinyFinds`,
 * as is a shiny graveyard Spiritomb's (`shiny`, `graveFind`);
 * `seed` is the run's terrain seed.
 */
export const seasonFindFeedback = (root: HTMLElement, find: FindId, moment: FindMoment, seed: number, shiny = false) => {
  const m = t().seasonUnlocks.find
  const dex = HATCHLINGS[find].line[0].dex
  const say = (text: string, ms: number) => runToast(root, 'important', h('span', { class: 'item-toast' }, h('img', { src: portraitUrl(dex), alt: '' }), rich(text)), ms)
  if (moment === 'sighted') {
    playCry(cryUrl(dex))
    return say(m.castformSighted, 3000)
  }
  if (moment === 'gone') return say(m.castformGone, 2200)
  // Every graveyard win reports Spiritomb: the first brings the family, a shiny one its shiny (the place's own toast tells the rest).
  if (find === 'spiritomb') {
    const got = graveFind(loadSave(), shiny)
    if (!got.family && !got.shiny) return
    updateSave((save) => ({ ...save, finds: mergeFinds(save.finds, ['spiritomb']), shinyFinds: got.shiny ? mergeFinds(save.shinyFinds, ['spiritomb']) : save.shinyFinds }))
    playSfx('unlock')
    playCry(cryUrl(dex))
    return say(got.shiny ? m.spiritombShiny : m.spiritomb, got.shiny ? 4800 : 4200)
  }
  if (find === 'rotom' && loadSave().finds.includes('rotom')) {
    if (!tvShiny(seed)) return say(m.rotomAgain, 3000)
    dev.shiny = false
    updateSave((save) => ({ ...save, shinyFinds: mergeFinds(save.shinyFinds, ['rotom']) }))
    playSfx('unlock')
    playCry(cryUrl(dex))
    return say(m.rotomShiny, 4800)
  }
  updateSave((save) => ({ ...save, finds: mergeFinds(save.finds, [find]) }))
  playSfx('unlock')
  playCry(cryUrl(dex))
  return say(find === 'rotom' ? m.rotom : m.castformFound, 4200)
}

/** How many of a chain's steps a dev helper can set. */
const STEPS = 3

/** Dev console helpers (`ps.*` in dev builds). `landmark` walks to the nearest one of a kind (`devLandmark` in `main.ts`). */
export const seasonFindDevTools = (game: () => Game | undefined, landmark: (g: Game, id: LandmarkId, dy: number) => Landmark | null) => ({
  /**
   * `ps.seasonFind('rotom')` makes this run's TV flicker and walks you next to the nearest cottage's (`'shiny'` second: a repeat
   * find there lands Rotom's shiny, for a save that owns Rotom and not its shiny); `ps.seasonFind('castform')` brings the rain and a Castform 70 px to the right.
   */
  seasonFind: (find: FindId, shiny?: 'shiny') => {
    const g = game()
    if (!g) return console.warn('ps: start a run first')
    if (find === 'spiritomb') return console.warn('ps: Spiritomb comes from the graveyard: ps.enter("graveyard"), then ps.spirits(GRAVEYARD.spirits)')
    if (find === 'rotom') {
      g.finds.tv = true
      dev.shiny = shiny === 'shiny'
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

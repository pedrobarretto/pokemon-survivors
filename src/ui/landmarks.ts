import { playCry, playSfx, type Sfx } from '../engine/audio'
import { ENEMIES } from '../data/enemies'
import type { LandmarkId, TreasureLandmark } from '../data/landmarks'
import type { LandmarkMoment } from '../game/landmarks'
import { t } from '../i18n'
import { pokeballIcon } from '../render/art'
import { cryUrl, portraitUrl } from '../render/sprites'
import { h, setText } from './dom'
import { runToast } from './toasts'

/**
 * The shell's side of landmarks (`game/landmarks.ts`): a wooden sign slides
 * in at the corner with the place's name as the player comes close (the way
 * the games name a route), a toast and a jingle for a treasure (the Pokémon
 * Center's own, MissingNo.'s static, Pay Day's coins), sounds for the way
 * into and out of a tunnel, the Snorlax's yawn and Mew's cry.
 */

/** The sign: one element, re-shown for each landmark named. */
const signOf = (root: HTMLElement) => {
  const found = root.querySelector<HTMLElement>(':scope > .landmark-sign')
  if (found) return found
  const sign = h('div', { class: 'landmark-sign hidden', 'aria-live': 'polite' }, h('b', {}), h('small', {}))
  root.append(sign)
  return sign
}

const showSign = (root: HTMLElement, id: LandmarkId) => {
  const m = t().landmarks
  const sign = signOf(root)
  setText(sign.querySelector('b')!, m.names[id])
  setText(sign.querySelector('small')!, m.hints[id])
  // Restarting the animation: off, a reflow, on.
  sign.classList.add('hidden')
  void sign.offsetWidth
  sign.classList.remove('hidden')
}

/** The sound of each treasure opening. */
const LOOT_SFX: Record<TreasureLandmark, Sfx> = {
  cottage: 'unlock',
  maze: 'unlock',
  ruins: 'ancientBoost',
  camp: 'unlock',
  snorlax: 'yawn',
  center: 'center',
  rocket: 'payDay',
  truck: 'denied',
  glitch: 'glitch',
}

const toast = (root: HTMLElement, text: string, icon: string = pokeballIcon()) =>
  runToast(root, 'minor', h('span', { class: 'item-toast' }, h('img', { src: icon, alt: '' }), text), 2800, 'landmark')

export const landmarkFeedback = (root: HTMLElement, id: LandmarkId, moment: LandmarkMoment) => {
  const m = t().landmarks
  switch (moment) {
    case 'spot':
      playSfx('select')
      return showSign(root, id)
    case 'loot':
    case 'wake':
      if (id === 'tunnel') return
      playSfx(LOOT_SFX[id])
      return toast(root, m.loot[id], id === 'snorlax' ? portraitUrl(ENEMIES.snorlax.dex) : undefined)
    case 'mew':
      playSfx('shiny')
      playCry(cryUrl(ENEMIES.mew.dex), 0.6)
      return toast(root, m.mew, portraitUrl(ENEMIES.mew.dex))
    case 'tunnelIn':
      return playSfx('dig')
    case 'tunnelOut':
      playSfx('whoosh')
      return runToast(root, 'minor', m.tunnelOut, 2200, 'landmark')
  }
}

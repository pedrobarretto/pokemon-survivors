import { playSfx } from '../engine/audio'
import type { LandmarkId } from '../data/landmarks'
import type { LandmarkMoment } from '../game/landmarks'
import { t } from '../i18n'
import { pokeballIcon } from '../render/art'
import { h, setText } from './dom'
import { runToast } from './toasts'

/**
 * The shell's side of landmarks (`game/landmarks.ts`): a wooden sign slides
 * in at the corner with the place's name as the player comes close (the way
 * the games name a route), a toast and a jingle for a treasure, sounds for
 * the way into and out of a tunnel.
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

export const landmarkFeedback = (root: HTMLElement, id: LandmarkId, moment: LandmarkMoment) => {
  const m = t().landmarks
  switch (moment) {
    case 'spot':
      playSfx('select')
      return showSign(root, id)
    case 'loot':
      playSfx(id === 'ruins' ? 'ancientBoost' : 'unlock')
      if (id === 'tunnel') return
      return runToast(root, 'minor', h('span', { class: 'item-toast' }, h('img', { src: pokeballIcon(), alt: '' }), m.loot[id]), 2800, 'landmark')
    case 'tunnelIn':
      return playSfx('dig')
    case 'tunnelOut':
      playSfx('whoosh')
      return runToast(root, 'minor', m.tunnelOut, 2200, 'landmark')
  }
}

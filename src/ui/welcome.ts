import { GUIDE } from '../data/guide'
import { playCry, playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { context2d } from '../engine/pixelart'
import { t } from '../i18n'
import { cryUrl, drawPokemon, loadedSprites, loadSpecies } from '../render/sprites'
import { dialogue, type Dialogue } from './dialogue'
import { h, later } from './dom'
import { menu, type Screen } from './screens'
import { guideSpeaker } from './visitors'
import './welcome.css'

/** The canvas Rotom idles on, in art px. */
const STAGE = 44

/**
 * Sizes a pixel-art canvas to whole device pixels per art pixel, near `want`
 * CSS px (the dialogue's portraits do the same), so it stays crisp on any DPR.
 */
export const fitPixels = (canvas: HTMLCanvasElement, want: number) => {
  const dpr = window.devicePixelRatio || 1
  const k = Math.max(1, Math.round((want * dpr) / canvas.width))
  canvas.style.width = `${(canvas.width * k) / dpr}px`
  canvas.style.height = `${(canvas.height * k) / dpr}px`
}

/** Draws a species idling, feet near the canvas' foot, bobbing by `bob` whole pixels; nothing until its sheets load. */
export const drawIdle = (canvas: HTMLCanvasElement, dex: number, time: number, bob = 0) => {
  const ctx = context2d(canvas)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const s = loadedSprites(dex)
  if (s) drawPokemon(ctx, s, 'Idle', 0, time, Math.round(canvas.width / 2), canvas.height - 4 + bob)
}

/**
 * Rotom's welcome on a first visit (arm `tour`, `firstTime.ts`): it pops
 * into the meadow, says 2 or 3 short lines in the dialogue box and offers the
 * training run ("Me mostra!", `show`) or the partner pick ("Já sei jogar",
 * `knows`). A tap, Enter or pad A goes through the lines; Esc skips to the choice.
 */
export const welcomeScreen = (root: HTMLElement, input: Input, actions: { show: () => void; knows: () => void }): Screen => {
  const m = t().welcome
  const rotom = h('canvas', { width: STAGE, height: STAGE, class: 'welcome-rotom pop' })
  const show = h('button', { class: 'btn selected', type: 'button' }, m.show)
  const knows = h('button', { class: 'btn', type: 'button' }, m.knows)
  const choices = h('div', { class: 'welcome-choices buttons waiting' }, show, knows)
  const el = h('div', { class: 'screen welcome-screen' }, h('div', { class: 'welcome-stage' }, rotom, choices))
  root.append(el)

  const fit = () => fitPixels(rotom, matchMedia('(max-height: 500px)').matches ? 112 : 176)
  fit()
  addEventListener('resize', fit)
  void loadSpecies(GUIDE.dex).catch(() => {})
  playCry(cryUrl(GUIDE.dex), 0.3)

  let nav: ReturnType<typeof menu> | null = null
  let answered = false
  const answer = (go: () => void) => {
    if (answered) return
    answered = true
    playSfx('select')
    go()
  }
  /** The lines are read (or skipped): the two buttons take the keys. */
  const offer = () => {
    if (nav) return
    choices.classList.remove('waiting')
    nav = menu(input, [show, knows], (i) => answer(i === 0 ? actions.show : actions.knows), { horizontal: true })
  }
  const talk: Dialogue = dialogue(el, input, {
    speaker: guideSpeaker(),
    lines: m.lines.map((text, i) => ({ text, emotion: i === 0 ? 'Joyous' : 'Happy' })),
    // After this key dispatch, or the press that read the last line would also pick "Me mostra!".
    onDone: () => later(offer),
  })

  const startedAt = performance.now()
  return {
    el,
    dim: 0.3,
    tick: (time) => {
      talk.tick?.(time)
      // A ghost in a gadget: it floats, a pixel up and down.
      drawIdle(rotom, GUIDE.dex, time, Math.round(Math.sin(((performance.now() - startedAt) / 1000) * 3) * 2))
    },
    dispose: () => {
      nav?.off()
      talk.dispose()
      removeEventListener('resize', fit)
      el.remove()
    },
  }
}

import { pinchStep, wheelStep, type ZoomStep } from '../engine/zoomGesture'
import type { Vec } from '../engine/math'
import { t } from '../i18n'
import { zoomIcon } from '../render/art'
import { h } from './dom'

/**
 * The camera's zoom, shell state only: the shell resizes the view (`main.ts`,
 * `resize`), which a solo run's replay records like a rotated phone. Runs
 * (solo and co-op) and the Poké Realm have it, never the Arena or the menus.
 * The levels of this screen and the one shown, as `resize` left them.
 */
export const zoomShown = { level: 0, levels: 1 }

/** Where gestures don't belong: a panel or a screen over the world (a pick, the pause menu), which keeps its own scroll. */
const OVER_MENU = '.box, .screen:not(.realm), .shop-sheet'
const overMenu = (target: EventTarget | null) => target instanceof Element && target.closest(OVER_MENU) !== null

/**
 * Wires the wheel (a trackpad's pinch comes as a wheel with `ctrlKey`, and
 * would zoom the page) and a two-finger pinch to `step`; `on` says whether
 * the current screen zooms at all.
 */
export const wireZoomGestures = (on: () => boolean, step: (dir: Exclude<ZoomStep, 0>) => void) => {
  let scrolled = 0
  window.addEventListener(
    'wheel',
    (e) => {
      if (!on() || overMenu(e.target)) return
      if (e.ctrlKey) e.preventDefault()
      const px = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 33 : e.deltaY
      const { acc, step: dir } = wheelStep(scrolled, px, e.ctrlKey)
      scrolled = acc
      if (dir !== 0) step(dir)
    },
    { passive: false },
  )

  /** Fingers down on the world (not on a control): where each started (or the last step left it) and where it is. */
  const fingers = new Map<number, { from: Vec; at: Vec }>()
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && on() && !overMenu(e.target) && !(e.target instanceof Element && e.target.closest('button'))) {
      const at = { x: e.clientX, y: e.clientY }
      fingers.set(e.pointerId, { from: at, at })
      for (const f of fingers.values()) f.from = f.at
    }
  })
  window.addEventListener('pointermove', (e) => {
    const finger = fingers.get(e.pointerId)
    if (!finger) return
    finger.at = { x: e.clientX, y: e.clientY }
    if (fingers.size !== 2) return
    const [a, b] = [...fingers.values()] as [typeof finger, typeof finger]
    const dir = pinchStep([a.from, b.from], [a.at, b.at])
    if (dir === 0) return
    step(dir)
    a.from = a.at
    b.from = b.at
  })
  const lift = (e: PointerEvent) => void fingers.delete(e.pointerId)
  window.addEventListener('pointerup', lift)
  window.addEventListener('pointercancel', lift)
}

/**
 * The zoom button (a run's HUD, the Realm's actions): a tap goes one level
 * out, wrapping back to the closest; pips show the level. `refresh` every
 * frame: a screen with a single level shows no button.
 */
export const zoomButton = (cycle: () => void) => {
  const pips = h('span', { class: 'zoom-pips' })
  const el = h('button', { class: 'zoom-btn box hidden', type: 'button', 'aria-label': t().hud.zoom, title: t().hud.zoom }, h('img', { src: zoomIcon(), alt: '' }), pips)
  // pointerdown (not click), like the pause button: instant on touch, and it never takes the keyboard's focus.
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    cycle()
  })
  let shown = ''
  const refresh = () => {
    const now = `${zoomShown.level}/${zoomShown.levels}`
    if (now === shown) return
    shown = now
    el.classList.toggle('hidden', zoomShown.levels < 2)
    pips.replaceChildren(...Array.from({ length: zoomShown.levels }, (_, i) => h('i', { class: i <= zoomShown.level ? 'on' : '' })))
  }
  return { el, refresh }
}

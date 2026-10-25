import { context2d, createCanvas } from '../engine/pixelart'
import type { Game } from '../game/types'
import { drawMinimap, MINIMAP } from '../render/minimap'
import { h } from './dom'
import type { MinimapMode } from './save'
import { settings } from './settings'
import { uiDpr } from './uiScale'

/** Redraws a second: the map moves a pixel every ~25 world px, so more would only cost. */
const FPS = 20
/** About how big (CSS px) the map shows on big screens and on phones; it lands on whole device px per map px. */
const SIZE = { wide: 132, narrow: 88 }
/** Seconds between measuring where the HUD's top bar (and co-op's row of cards) ends. */
const REMEASURE = 0.5

/**
 * The HUD's mini map (`render/minimap.ts`) in the top-right corner, under the
 * counters (and under co-op's cards on a phone held upright). Settings → Jogo
 * picks its shape or turns it off. `update` redraws it at most `FPS` times a
 * second. While it shows, `--minimap-w` on the HUD and `--minimap-bottom` on
 * the page let the boss bar and the toasts make room (`style.css`).
 */
export const createMinimap = (hud: HTMLElement) => {
  const canvas = createCanvas(MINIMAP.size, MINIMAP.size)
  const ctx = context2d(canvas)
  const el = h('div', { class: 'minimap hidden', 'aria-hidden': 'true' }, canvas)
  let mode: MinimapMode | null = null
  let drawn = -Infinity
  let measured = -Infinity

  /** Sizes the canvas to whole device px per map px, near its CSS size for the screen. */
  const fit = () => {
    const dpr = uiDpr()
    const want = matchMedia('(max-width: 759px), (max-height: 500px)').matches ? SIZE.narrow : SIZE.wide
    const k = Math.max(1, Math.round((want * dpr) / MINIMAP.size))
    const css = (MINIMAP.size * k) / dpr
    canvas.style.width = canvas.style.height = `${css}px`
    hud.style.setProperty('--minimap-w', `${css}px`)
    measured = -Infinity
  }

  /** Puts the map under the top bar, or under co-op's cards when they make a row across the top. */
  const place = () => {
    const row = hud.querySelector<HTMLElement>('.hud-row')
    const right = row?.querySelector<HTMLElement>('.hud-right')
    if (!row || !right) return
    let top = row.offsetTop + right.offsetTop + right.offsetHeight
    const team = hud.querySelector<HTMLElement>('.team-hud')
    if (team && team.offsetWidth > hud.offsetWidth / 2) top = Math.max(top, team.offsetTop + team.offsetHeight)
    el.style.top = `${top + 6}px`
    document.documentElement.style.setProperty('--minimap-bottom', `${top + 6 + canvas.offsetHeight}px`)
  }

  const show = (next: MinimapMode) => {
    mode = next
    const on = next !== 'off'
    el.classList.toggle('hidden', !on)
    el.classList.toggle('round', next === 'round')
    hud.classList.toggle('has-minimap', on)
    if (on) document.documentElement.dataset.minimap = 'on'
    else delete document.documentElement.dataset.minimap
    drawn = measured = -Infinity
  }

  const update = (g: Game) => {
    const next = settings().minimap
    if (next !== mode) show(next)
    if (next === 'off') return
    const now = performance.now() / 1000
    if (now - measured > REMEASURE) {
      measured = now
      place()
    }
    if (now - drawn < 1 / FPS) return
    drawn = now
    ctx.clearRect(0, 0, MINIMAP.size, MINIMAP.size)
    drawMinimap(ctx, g, next, g.now)
  }

  fit()
  window.addEventListener('resize', fit)
  const dispose = () => {
    window.removeEventListener('resize', fit)
    delete document.documentElement.dataset.minimap
  }
  return { el, update, dispose }
}

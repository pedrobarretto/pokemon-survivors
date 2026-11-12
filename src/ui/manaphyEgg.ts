import { playCry, playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { blitEllipse, context2d } from '../engine/pixelart'
import { LEGENDS, type LegendId } from '../data/legends'
import { t } from '../i18n'
import { manaphyEggSprite } from '../render/manaphyEggArt'
import { cryUrl, drawPokemon, loadedSprites, loadSpecies } from '../render/sprites'
import { h, later, rich } from './dom'
import { settings } from './settings'
import { menu, type Screen } from './screens'

/**
 * The Ovo de Manaphy hatching (the Safári cove's Pokédex prize, opened in the
 * gift box: `ui/gifts.ts`). Longer and warmer than an egg's (`hatchScene`):
 * the egg floats in the sea's light, its red core beating like a heart, a
 * stream of bubbles rising round it; it rocks three times, the core beats
 * faster, and it bursts in a ring of light and bubbles. Manaphy comes out
 * with hearts circling it. Any key or tap before that skips to it.
 */

/** The scene's beats, seconds: when the egg rocks (from, to, px), the burst and the reveal. */
const SCENE = {
  rocks: [
    [1.6, 2.0, 1],
    [2.6, 3.0, 2],
    [3.5, 3.95, 3],
  ],
  glow: 1.6,
  burst: 4.25,
  reveal: 4.55,
} as const

/** What the first key after the reveal can't do yet, ms: the key that skipped must not start a run. */
const GUARD_MS = 600

const W = 112
const H = 96
const EGG_SCALE = 3

/** The sea's light and the heart's colors. */
const SEA = { deep: '#0c2c58', mid: '#1c5890', bubble: '#a8e0f8', heart: '#f85878', flash: '232,248,255' } as const

export const manaphyEggScene = (root: HTMLElement, input: Input, legend: LegendId, actions: { play?: () => void; done: () => void }, holdAt?: number): Screen => {
  const m = t().scWave.egg
  const dex = LEGENDS[legend].line[0].dex
  void loadSpecies(dex).catch(() => {})

  const canvas = h('canvas', { class: 'hatch-canvas', width: W, height: H })
  const text = h('p', { class: 'hatch-text' }, m.hatching)
  const buttons = h('div', { class: 'buttons hidden' })
  const skipHint = h('p', { class: 'hint' }, m.skip)
  let start = -1
  let revealed = false
  let glowing = false
  let rocked = -1
  let nav: ReturnType<typeof menu> | null = null

  const reveal = () => {
    if (revealed) return
    revealed = true
    start = Math.min(start, performance.now() / 1000 - SCENE.reveal)
    playSfx('evolve')
    playCry(cryUrl(dex), 0.5)
    text.replaceChildren(rich(m.hatched), h('small', {}, rich(m.note)))
    const play = actions.play ? h('button', { class: 'btn' }, m.play) : null
    const ok = h('button', { class: 'btn' }, m.ok)
    buttons.replaceChildren(...(play ? [play, ok] : [ok]))
    buttons.classList.remove('hidden')
    skipHint.remove()
    nav = menu(input, play ? [play, ok] : [ok], (i) => later(play && i === 0 && actions.play ? actions.play : actions.done), { horizontal: true, initial: play ? 1 : 0, guard: GUARD_MS })
  }

  const offSkip = input.onKey(() => !revealed && start >= 0 && performance.now() / 1000 - start > 0.4 && reveal())
  const box = h('div', { class: 'dialog box pop hatch manaphy-egg' }, h('div', { class: 'dialog-title' }, m.name), canvas, text, buttons, skipHint)
  box.addEventListener('click', () => !revealed && reveal())
  const el = h('div', { class: 'screen dim' }, box)
  root.append(el)

  const ctx = context2d(canvas)
  const egg = manaphyEggSprite()
  const cx = W / 2
  const floor = H - 16

  /** The sea: deep blue, a band of light from above, bubbles rising. */
  const drawSea = (k: number) => {
    ctx.fillStyle = SEA.deep
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 0.35
    ctx.fillStyle = SEA.mid
    ctx.fillRect(Math.round(cx - 22 + Math.sin(k * 0.8) * 4), 0, 44, H)
    ctx.globalAlpha = 0.18
    ctx.fillRect(Math.round(cx - 34 + Math.sin(k * 0.6 + 1) * 6), 0, 68, H)
    ctx.globalAlpha = 1
    for (let i = 0; i < 14; i++) {
      const speed = 10 + (i % 5) * 4
      const y = Math.round(H - ((k * speed + i * 23) % (H + 10)))
      const x = Math.round(cx + Math.sin(i * 2.1 + k * 1.3) * (16 + (i % 4) * 9))
      ctx.fillStyle = SEA.bubble
      if (i % 3 === 0) {
        ctx.fillRect(x - 1, y, 3, 1)
        ctx.fillRect(x - 1, y + 2, 3, 1)
        ctx.fillRect(x - 2, y + 1, 1, 1)
        ctx.fillRect(x + 2, y + 1, 1, 1)
      } else ctx.fillRect(x, y, 1, 1)
    }
  }

  /** The egg, rocking on its beats, its core beating: slow, then faster once it glows. */
  const drawEgg = (k: number) => {
    const rock = SCENE.rocks.find(([from, to]) => k >= from && k < to)
    const dx = rock ? Math.round(Math.sin(k * 40) * rock[2]) : 0
    const bob = Math.round(Math.sin(k * 1.6) * 2)
    const x = Math.round(cx - (egg.width * EGG_SCALE) / 2) + dx
    const y = floor - egg.height * EGG_SCALE + bob
    blitEllipse(ctx, 16, 3, 'rgba(4,16,40,0.45)', cx, floor + 2)
    ctx.drawImage(egg, x, y, egg.width * EGG_SCALE, egg.height * EGG_SCALE)
    // The heartbeat: two quick pulses a beat, faster as it nears the burst.
    const rate = k < SCENE.glow ? 1.1 : 1.1 + (k - SCENE.glow) * 0.9
    const phase = (k * rate) % 1
    const beat = phase < 0.12 ? phase / 0.12 : phase < 0.24 ? 1 - (phase - 0.12) / 0.12 : phase < 0.34 ? (phase - 0.24) / 0.1 * 0.6 : phase < 0.44 ? 0.6 - (phase - 0.34) / 0.1 * 0.6 : 0
    const coreX = x + 7 * EGG_SCALE
    const coreY = y + 8 * EGG_SCALE
    blitEllipse(ctx, Math.round(5 + beat * 6), Math.round(5 + beat * 6), `rgba(248,88,120,${0.2 + beat * 0.45})`, coreX, coreY)
    if (k > SCENE.glow) blitEllipse(ctx, 26, 26, `rgba(248,232,200,${Math.min(0.25, (k - SCENE.glow) * 0.08)})`, coreX, coreY)
    // Sounds follow the animation: a soft tap per rock, a chime as it starts to glow.
    const r = rock ? SCENE.rocks.indexOf(rock) : -1
    if (r > rocked) (rocked = r), playSfx('move')
    if (k > SCENE.glow && !glowing) {
      glowing = true
      playSfx('item')
      text.replaceChildren(m.glow)
    }
  }

  /** Manaphy, at twice its size when it fits, with hearts circling it. */
  const drawNewborn = (k: number) => {
    const s = loadedSprites(dex)
    if (s) drawPokemon(ctx, s, 'Idle', 0, k, cx, floor, { scale: s.bodyH * 2 <= H - 30 ? 2 : 1 })
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + k * 1.3
      const hx = Math.round(cx + Math.cos(a) * 36)
      const hy = Math.round(floor - 30 + Math.sin(a) * 18)
      ctx.fillStyle = SEA.heart
      ctx.fillRect(hx - 2, hy - 1, 2, 2)
      ctx.fillRect(hx + 1, hy - 1, 2, 2)
      ctx.fillRect(hx - 1, hy + 1, 3, 1)
      ctx.fillRect(hx, hy + 2, 1, 1)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(hx - 1, hy - 1, 1, 1)
    }
  }

  /** The burst: a ring of light and bubbles flying out from the egg. */
  const drawBurst = (k: number) => {
    const u = (k - SCENE.burst) / 0.6
    if (u < 0 || u > 1) return
    const r = 6 + u * 44
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      ctx.fillStyle = i % 3 === 0 ? SEA.heart : i % 2 === 0 ? '#ffffff' : SEA.bubble
      ctx.globalAlpha = 1 - u
      ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(floor - 22 + Math.sin(a) * r * 0.75), i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1)
    }
    ctx.globalAlpha = 1
  }

  const tick = (now: number) => {
    if (start < 0) start = now
    const k = holdAt ?? now - start
    if (k >= SCENE.reveal && !revealed) reveal()
    drawSea(k)
    if (k < SCENE.burst) drawEgg(k)
    else drawNewborn(k)
    drawBurst(k)
    // The flash: a sea-white bloom in, then out over Manaphy (none with Flashes reduced).
    const flash = k < SCENE.burst - 0.25 ? 0 : k < SCENE.burst ? (k - SCENE.burst + 0.25) / 0.25 : Math.max(0, 1 - (k - SCENE.burst) / 0.6)
    if (flash > 0 && settings().flashes === 'normal') {
      ctx.fillStyle = `rgba(${SEA.flash},${flash})`
      ctx.fillRect(0, 0, W, H)
    }
  }

  return { el, tick, dispose: () => (offSkip(), nav?.off(), el.remove()) }
}

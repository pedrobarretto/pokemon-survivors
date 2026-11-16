import { playCry, playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { blitEllipse, context2d } from '../engine/pixelart'
import { COSMOG_DEX } from '../data/legendPaths'
import { LEGENDS } from '../data/legends'
import type { CosmogLegend } from '../game/legendPaths'
import { cryUrl, drawPokemon, loadedSprites, loadSpecies } from '../render/sprites'
import { t } from '../i18n'
import { h, later, rich } from './dom'
import { settings } from './settings'
import { menu, type Screen } from './screens'

/** Canvas size in pixels, the hatching scene's (`.hatch-canvas` scales it by a whole number). */
const W = 112
const H = 96

/** Seconds: Cosmoem glows, then flickers between its shape and the legend's, faster and faster, and the flash lands on the legend. */
const BEATS = { glow: 0.8, flicker: 3.4, flash: 3.7 } as const

/** Ms after the reveal before OK takes a press (the key that skipped the scene mustn't close it). */
const REVEAL_GUARD_MS = 600

/** Each legend's light: the sky behind it, and its motes. */
const SKY = {
  solgaleo: { glow: '#f8d878', mote: '#fff4c8', css: '#f6e2a8' },
  lunala: { glow: '#a890f8', mote: '#e8e0ff', css: '#cfc4f4' },
} as const satisfies Record<CosmogLegend, { glow: string; mote: string; css: string }>

/** Whether the flicker shows the legend's shape at `k` s: the swaps come quicker as it goes. */
const legendShape = (k: number) => {
  const p = (k - BEATS.glow) / (BEATS.flicker - BEATS.glow)
  return Math.floor(p * p * 14) % 2 === 1
}

/**
 * Cosmog's path ends (the gift `path:cosmog` opened): Cosmoem glows white,
 * flickers between its shape and Solgaleo's or Lunala's ever faster, and a
 * flash lands on the legend, in its sun or moon light, with its cry. A tap
 * or key skips to the reveal; OK goes on (`done`). `holdAt` freezes it at
 * that second (dev screenshots).
 */
export const cosmogEvolveScene = (root: HTMLElement, input: Input, legend: CosmogLegend, done: () => void, holdAt?: number): Screen => {
  const m = t().paths.cosmog
  const def = LEGENDS[legend]
  const dex = def.line[0].dex
  const sky = SKY[legend]
  void loadSpecies(COSMOG_DEX.cosmoem).catch(() => {})
  void loadSpecies(dex).catch(() => {})

  const canvas = h('canvas', { class: 'hatch-canvas', width: W, height: H })
  canvas.style.background = `radial-gradient(ellipse 34% 30% at 50% 66%, ${sky.css} 0 99%, transparent 100%)`
  const text = h('p', { class: 'hatch-text' }, rich(m.evolving))
  const buttons = h('div', { class: 'buttons hidden' })
  const skipHint = h('p', { class: 'hint' }, t().eggs.skip)
  let start = -1
  let revealed = false
  let nav: ReturnType<typeof menu> | null = null

  const reveal = () => {
    if (revealed) return
    revealed = true
    start = Math.min(start, performance.now() / 1000 - BEATS.flash)
    playSfx('legendary')
    playCry(cryUrl(dex), 0.6)
    text.replaceChildren(rich(m.became(def.name)), h('small', {}, m.becameNote))
    const ok = h('button', { class: 'btn' }, t().eggs.ok)
    buttons.replaceChildren(ok)
    buttons.classList.remove('hidden')
    skipHint.remove()
    nav = menu(input, [ok], () => later(done), { horizontal: true, guard: REVEAL_GUARD_MS })
  }

  const offSkip = input.onKey(() => !revealed && start >= 0 && performance.now() / 1000 - start > 0.4 && reveal())
  const box = h('div', { class: 'dialog box pop hatch' }, canvas, text, buttons, skipHint)
  box.addEventListener('click', () => !revealed && reveal())
  const el = h('div', { class: 'screen dim' }, box)
  root.append(el)

  const ctx = context2d(canvas)
  const cx = W / 2
  const floor = H - 16

  /** Light motes rising around it: the sky gathering while it glows, scattering once it's done. */
  const drawMotes = (k: number, spread: number) => {
    ctx.fillStyle = sky.mote
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + k * 0.9
      const r = 20 + spread * 16 + (i % 3) * 4
      const rise = (k * 14 + i * 9) % 30
      ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(floor - 22 + Math.sin(a) * r * 0.45 - rise * 0.4), 1, i % 2 === 0 ? 2 : 1)
    }
  }

  const tick = (now: number) => {
    if (start < 0) start = now
    const k = holdAt ?? now - start
    if (k >= BEATS.flash && !revealed) reveal()
    ctx.clearRect(0, 0, W, H)
    blitEllipse(ctx, 16, 3, 'rgba(24,24,48,0.3)', cx, floor)
    const before = loadedSprites(COSMOG_DEX.cosmoem)
    const after = loadedSprites(dex)
    if (k < BEATS.flicker) {
      // Glowing: Cosmoem whitens; then the two shapes trade places, white.
      const white = k < BEATS.glow ? k / BEATS.glow : 1
      const shape = k >= BEATS.glow && legendShape(k) ? after : before
      if (shape) drawPokemon(ctx, shape, 'Idle', 0, k, cx, floor, { flash: white })
      drawMotes(k, 0)
    } else if (after) {
      // Landed: the legend in its light (white for a beat, then itself).
      drawPokemon(ctx, after, 'Idle', 0, k, cx, floor, { flash: Math.max(0, 1 - (k - BEATS.flash) / 0.4) })
      drawMotes(k, Math.min(1, (k - BEATS.flash) / 0.8))
    }
    const flash = k < BEATS.flicker ? 0 : k < BEATS.flash ? (k - BEATS.flicker) / (BEATS.flash - BEATS.flicker) : Math.max(0, 1 - (k - BEATS.flash) / 0.5)
    if (flash > 0 && settings().flashes === 'normal') {
      ctx.fillStyle = `rgba(255,255,255,${flash})`
      ctx.fillRect(0, 0, W, H)
    }
  }

  return { el, tick, dispose: () => (offSkip(), nav?.off(), el.remove()) }
}

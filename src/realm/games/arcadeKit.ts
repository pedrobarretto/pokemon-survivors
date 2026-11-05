import { PLAYABLE } from '../../data/hatchlings'
import { drawPacked, drawable, fromStrings, lazy, textSprite, type Packed, type Palette } from '../../engine/pixelart'

/**
 * What the arcade's cabinets share (Berry Rain, `berryCatch.ts`, and
 * Whack-a-Diglett, `whackDiglett.ts`): the screen's size for the way the
 * phone is held, PNGs loaded on demand, particles and floating scores, the
 * in-world digits, the 3-2-1 count and the HUD's little icons. Plain data
 * and functions; the games own their state.
 */

type Size = { w: number; h: number }

/**
 * A cabinet's screen: `tall` when the window is (a phone held upright),
 * `wide` otherwise. Pick sizes that scale by a whole step on a phone either
 * way (the frame scales by whole steps): ≤ 176 wide upright for ×2, ≤ 124 for
 * ×3; ≤ 150 tall sideways for ×2, ≤ 104 for ×3.
 */
export const arcadeSize = (tall: Size, wide: Size): Size => (typeof window !== 'undefined' && window.innerHeight > window.innerWidth ? tall : wide)

/** A partner's species (its first form, as the realm walks it). */
export const partnerDex = (partner: string): number => (Object.hasOwn(PLAYABLE, partner) ? PLAYABLE[partner as keyof typeof PLAYABLE].line[0].dex : 25)

const images = new Map<string, HTMLImageElement>()

/** A PNG under `public/assets/` (no extension), loading on first ask: null until it can be drawn. */
export const image = (path: string): HTMLImageElement | null => {
  let img = images.get(path)
  if (!img) {
    img = new Image()
    img.src = `${import.meta.env.BASE_URL}assets/${path}.png`
    images.set(path, img)
  }
  return drawable(img) ? img : null
}

/** Draws an image centered on (x, y), whole pixels. */
export const drawCentered = (g: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number) =>
  g.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2))

/* ---------------- Particles and popups ---------------- */

/** A square of color flying off a hit; `g` its gravity (px/s²). */
export type Particle = { x: number; y: number; vx: number; vy: number; life: number; age: number; color: string; size: number; g: number }

/** `n` particles bursting from (x, y) in `colors`, at up to `speed` px/s. */
export const burst = (into: Particle[], x: number, y: number, colors: readonly string[], n: number, speed = 70, g = 160) => {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const v = speed * (0.35 + Math.random() * 0.65)
    into.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life: 0.35 + Math.random() * 0.35, age: 0, color: colors[i % colors.length]!, size: Math.random() < 0.3 ? 2 : 1, g })
  }
}

/** A number (or a short word in the in-world font) rising off a hit. */
export type Popup = { x: number; y: number; text: string; color: string; age: number; big: boolean }

/** Moves particles and popups along `dt` s, dropping the spent ones (in place). */
export const stepFx = (parts: Particle[], pops: Popup[], dt: number) => {
  let k = 0
  for (const p of parts) {
    p.age += dt
    if (p.age >= p.life) continue
    p.vy += p.g * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    parts[k++] = p
  }
  parts.length = k
  k = 0
  for (const p of pops) {
    p.age += dt
    if (p.age < 0.8) pops[k++] = p
  }
  pops.length = k
}

/** Draws particles and popups (popups ease up and blink out). */
export const drawFx = (g: CanvasRenderingContext2D, parts: readonly Particle[], pops: readonly Popup[]) => {
  for (const p of parts) {
    g.fillStyle = p.color
    g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size)
  }
  for (const p of pops) {
    if (p.age > 0.6 && Math.floor(p.age * 20) % 2 === 0) continue
    const rise = Math.round(14 * (1 - (1 - Math.min(1, p.age / 0.5)) ** 2))
    drawText(g, p.text, p.x, p.y - rise, p.color, 'center', p.big ? 2 : 1)
  }
}

/* ---------------- Text and icons ---------------- */

/** Draws in-world text (digits, capitals, `+ - ! ₽`) at `k` times, anchored by `align` at x, its top at y. */
export const drawText = (g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, align: 'left' | 'center' | 'right' = 'left', k = 1) => {
  const p: Packed = textSprite(text, color)
  const w = p.w * k
  const left = Math.round(align === 'left' ? x : align === 'center' ? x - w / 2 : x - w)
  if (k === 1) return drawPacked(g, p, left, Math.round(y))
  g.drawImage(p.canvas, p.x, p.y, p.w, p.h, left, Math.round(y), w, p.h * k)
}

/** The text's width at `k` times (px). */
export const textWidth = (text: string, k = 1) => textSprite(text, '#fff').w * k

const ICON_ROWS = {
  heart: ['.11.11.', '1221111', '1211111', '1111111', '.11111.', '..111..', '...1...'],
  empty: ['.11.11.', '1..1..1', '1.....1', '1.....1', '.1...1.', '..1.1..', '...1...'],
  clock: ['..111..', '.12221.', '1222122', '1222122', '1221122', '.12221.', '..111..'],
  star: ['...1...', '...1...', '1111111', '.11111.', '..111..', '.11.11.', '.1...1.'],
} as const

const ICON_PALETTES: Record<keyof typeof ICON_ROWS, Palette> = {
  heart: { 1: '#e83850', 2: '#ffb8c8' },
  empty: { 1: '#5a4058' },
  clock: { 1: '#283040', 2: '#f8f8f8' },
  star: { 1: '#f8d030' },
}

const ICONS = lazy(() => Object.fromEntries(Object.entries(ICON_ROWS).map(([k, rows]) => [k, fromStrings(rows, ICON_PALETTES[k as keyof typeof ICON_ROWS])])) as Record<keyof typeof ICON_ROWS, HTMLCanvasElement>)

/** Draws a 7×7 HUD icon with its top-left at (x, y). */
export const drawIcon = (g: CanvasRenderingContext2D, icon: keyof typeof ICON_ROWS, x: number, y: number) => g.drawImage(ICONS()[icon], Math.round(x), Math.round(y))

/** A dark rounded plate behind HUD text, so it reads over any background. */
export const plate = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  g.fillStyle = 'rgba(16,20,32,0.72)'
  g.fillRect(x + 1, y, w - 2, h)
  g.fillRect(x, y + 1, w, h - 2)
}

/* ---------------- The count in and the clock ---------------- */

/** Seconds the 3-2-1-GO count lasts before play starts. */
export const COUNT_IN = 3.6

/** What the count shows `t` s in: 3, 2, 1, GO!, then null once play started. */
export const countLabel = (t: number): string | null => (t < 0.9 ? '3' : t < 1.8 ? '2' : t < 2.7 ? '1' : t < COUNT_IN ? 'GO!' : null)

/** Draws the count big in the middle, each number popping in. */
export const drawCount = (g: CanvasRenderingContext2D, t: number, w: number, h: number) => {
  const label = countLabel(t)
  if (!label) return
  const into = label === 'GO!' ? (t - 2.7) / 0.9 : (t % 0.9) / 0.9
  const k = into < 0.12 ? 6 : 4
  drawText(g, label, w / 2, h / 2 - (7 * k) / 2, label === 'GO!' ? '#f8d030' : '#ffffff', 'center', k)
}

/** The play clock as whole seconds left (never below 0). */
export const secondsLeft = (played: number, length: number) => Math.max(0, Math.ceil(length - played))

/** A screen shake: an offset that fades over `left` s. */
export const shakeOffset = (left: number, power: number) =>
  left <= 0 ? { x: 0, y: 0 } : { x: Math.round((Math.random() * 2 - 1) * power * Math.min(1, left * 6)), y: Math.round((Math.random() * 2 - 1) * power * Math.min(1, left * 6)) }

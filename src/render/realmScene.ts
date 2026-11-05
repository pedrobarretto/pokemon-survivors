import type { Look } from '../data/cosmetics'
import type { RealmAct, RealmEmote } from '../net/realm'
import { blitCentered, blitEllipse, context2d, fromStrings, lazy, type Palette, type PixelSprite } from '../engine/pixelart'
import { lookEmoteFrame } from './arenaFx'
import { sprites } from './sprites'
import { drawDressed } from './wearables'
import type { Facing } from '../net/realm'

/**
 * The Poké Realm's trainers on the canvas (`ui/realm.ts` lays out the room
 * and the HTML over it): each one's partner Pokémon dressed in its look
 * (`drawDressed`), a shadow, and the PMD-style bubble of an emote over its
 * head; the `look` emote plays the trainer's emote cosmetic's animation, as
 * in the Arena (`lookEmoteFrame`).
 */

type Ctx = CanvasRenderingContext2D

/** How long an emote shows (s). */
export const EMOTE_SECONDS = 2.8

/** A trainer as the scene draws it: world px, the facing's sprite row, and the emote it plays (since `at`, s on the drawing clock). */
export type TrainerView = {
  dex: number
  shiny: boolean
  look: Look
  x: number
  y: number
  facing: Facing
  moving: boolean
  emote: { id: RealmEmote; at: number } | null
  /** What the trainer is busy at (a mini game, `RealmAct`): fishing draws the rod, its line and the bobber. */
  act?: RealmAct | null
}

/** The bubble every emote's icon sits in (as the lobby's, `render/art.ts`). */
const BUBBLE = [
  '..1111111..',
  '.122222221.',
  '12222222221',
  '12222222221',
  '12222222221',
  '12222222221',
  '12222222221',
  '12222222221',
  '12222222221',
  '.122222221.',
  '..1112111..',
  '....121....',
  '.....1.....',
]

/** Each free emote's 7×7 icon. */
const ICONS: Record<Exclude<RealmEmote, 'look'>, { rows: readonly string[]; palette: Palette }> = {
  wave: { rows: ['1.1.1..', '1.1.1.1', '1111111', '1111111', '.11111.', '.11111.', '..111..'], palette: { 1: '#e8a060' } },
  heart: { rows: ['.11.11.', '1211111', '1111111', '1111111', '.11111.', '..111..', '...1...'], palette: { 1: '#e83850', 2: '#ffb8c8' } },
  laugh: { rows: ['.......', '.1...1.', '1.1.1.1', '.......', '1111111', '.12221.', '..111..'], palette: { 1: '#283040', 2: '#e85868' } },
  music: { rows: ['...11..', '...1.1.', '...1..1', '...1...', '.111...', '1111...', '.11....'], palette: { 1: '#3868d0' } },
  sleep: { rows: ['1111...', '...1...', '..1....', '.1.....', '1111111', '.....1.', '....111'], palette: { 1: '#5878c8' } },
  angry: { rows: ['.1...1.', '1.1.1.1', '.1...1.', '.......', '.1...1.', '1.1.1.1', '.1...1.'], palette: { 1: '#e83838' } },
  question: { rows: ['..111..', '.1...1.', '.....1.', '....1..', '...1...', '.......', '...1...'], palette: { 1: '#3868d0' } },
  exclaim: { rows: ['..111..', '..111..', '..111..', '...1...', '.......', '..111..', '..111..'], palette: { 1: '#e83838' } },
}

const BUBBLES = lazy(() => {
  const build = (icon: { rows: readonly string[]; palette: Palette }): PixelSprite => {
    const sprite = fromStrings(BUBBLE, { 1: '#283040', 2: '#f8f8f8' })
    context2d(sprite).drawImage(fromStrings(icon.rows, icon.palette), 2, 2)
    return sprite
  }
  return Object.fromEntries(Object.entries(ICONS).map(([id, icon]) => [id, build(icon)])) as Record<Exclude<RealmEmote, 'look'>, PixelSprite>
})

const STAR = { rows: ['...1...', '..121..', '1112111', '.12221.', '..121..', '.12.21.', '.1...1.'], palette: { 1: '#a87000', 2: '#f8d030' } }
const DOTS = { rows: ['.......', '.......', '.......', '1.1.1..', '.......', '.......', '.......'], palette: { 1: '#283040' } }

const icons = new Map<string, string>()

/** A bubble's art as an image URL, for the HTML's buttons: each emote's (the `look` one a star) and `talk`'s dots. */
export const realmIconUrl = (id: RealmEmote | 'talk'): string => {
  let url = icons.get(id)
  if (!url) {
    const sprite = id === 'look' || id === 'talk' ? fromStrings(BUBBLE, { 1: '#283040', 2: '#f8f8f8' }) : BUBBLES()[id]
    if (id === 'look' || id === 'talk') context2d(sprite).drawImage(fromStrings((id === 'look' ? STAR : DOTS).rows, (id === 'look' ? STAR : DOTS).palette), 2, 2)
    icons.set(id, (url = sprite.toDataURL()))
  }
  return url
}

/** Whether an emote still shows at `now` (s). */
export const emoting = (t: TrainerView, now: number) => t.emote !== null && now - t.emote.at < EMOTE_SECONDS

/** A trainer's height over its feet (world px), for what goes over its head. */
export const headOf = (t: TrainerView) => sprites(t.dex, t.shiny).bodyH

/** Each facing's step (`Facing`: 0 down, then clockwise as seen from above: 2 right, 4 up, 6 left). */
const STEPS = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]] as const

/** A one-pixel line from a to b (Bresenham), whole pixels only. */
const pixelLine = (ctx: Ctx, ax: number, ay: number, bx: number, by: number, color: string) => {
  let x = Math.round(ax)
  let y = Math.round(ay)
  const x1 = Math.round(bx)
  const y1 = Math.round(by)
  const dx = Math.abs(x1 - x)
  const dy = -Math.abs(y1 - y)
  const sx = x < x1 ? 1 : -1
  const sy = y < y1 ? 1 : -1
  let err = dx + dy
  ctx.fillStyle = color
  for (let i = 0; i < 200; i++) {
    ctx.fillRect(x, y, 1, 1)
    if (x === x1 && y === y1) return
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
}

/**
 * A trainer fishing (`act === 'fishing'`, at the pier's platform): the rod
 * held out the way it faces, the line sagging to a red and white bobber on
 * the water that bobs, dips now and then, and rings the water around it.
 * Screen px of the trainer's feet; `now` the drawing clock (s).
 */
const drawFishingGear = (ctx: Ctx, t: TrainerView, x: number, y: number, now: number) => {
  const [fx, fy] = STEPS[t.facing]
  const len = Math.hypot(fx, fy)
  const ux = fx / len
  const uy = fy / len
  const body = headOf(t)
  const hand = { x: x + Math.round(ux * 5) + (fx === 0 ? 4 : 0), y: y - Math.round(body * 0.4) }
  const tip = { x: hand.x + Math.round(ux * 12), y: hand.y + Math.round(uy * 6) - 9 }
  // Its own pace per trainer, so a row of anglers doesn't bob in step.
  const phase = (t.x * 0.37 + t.y * 0.11) % 6
  const dip = Math.sin(now * 0.9 + phase) > 0.93 ? 2 : 0
  // Out past the name plate under the trainer's feet.
  const bob = { x: tip.x + Math.round(ux * 16), y: y + Math.round(uy * 28) + Math.round(Math.sin(now * 2.6 + phase)) + dip }
  pixelLine(ctx, hand.x, hand.y, (hand.x + tip.x) / 2, (hand.y + tip.y) / 2, '#7a4a20')
  pixelLine(ctx, (hand.x + tip.x) / 2, (hand.y + tip.y) / 2, tip.x, tip.y, '#384050')
  // The line: a few segments sagging between the tip and the bobber.
  let px = tip.x
  let py = tip.y
  for (let i = 1; i <= 4; i++) {
    const k = i / 4
    const nx = tip.x + (bob.x - tip.x) * k
    const ny = tip.y + (bob.y - tip.y) * k + Math.sin(k * Math.PI) * 3
    pixelLine(ctx, px, py, nx, ny, 'rgba(240,244,248,0.85)')
    px = nx
    py = ny
  }
  // Rings on the water, then the bobber.
  const ring = (now * 0.7 + phase) % 1.6
  if (ring < 1) {
    ctx.globalAlpha = 1 - ring
    ctx.fillStyle = '#e8f8ff'
    const r = Math.round(3 + ring * 6)
    ctx.fillRect(bob.x - r, bob.y + 1, 2, 1)
    ctx.fillRect(bob.x + r - 1, bob.y + 1, 2, 1)
    ctx.globalAlpha = 1
  }
  ctx.fillStyle = '#283040'
  ctx.fillRect(bob.x - 1, bob.y - 3, 3, 4)
  ctx.fillStyle = '#e83838'
  ctx.fillRect(bob.x, bob.y - 3, 1, 2)
  ctx.fillStyle = '#f8f8f8'
  ctx.fillRect(bob.x, bob.y - 1, 1, 1)
}

/** Draws a trainer at its feet, camera at (`camX`, `camY`); `now` is the drawing clock (s). */
export const drawTrainer = (ctx: Ctx, t: TrainerView, camX: number, camY: number, now: number) => {
  const x = Math.round(t.x - camX)
  const y = Math.round(t.y - camY)
  blitEllipse(ctx, 7, 3, 'rgba(16,24,16,0.3)', x, y)
  // The rod goes behind a trainer facing away, in front of one facing the water below.
  const fishing = t.act === 'fishing' && !t.moving
  if (fishing && STEPS[t.facing][1] < 0) drawFishingGear(ctx, t, x, y, now)
  if (fishing && STEPS[t.facing][1] >= 0) {
    drawBody(ctx, t, x, y, now)
    return drawFishingGear(ctx, t, x, y, now)
  }
  drawBody(ctx, t, x, y, now)
}

/** The trainer's partner, dressed in its look, playing its walk, idle or the look's emote. */
const drawBody = (ctx: Ctx, t: TrainerView, x: number, y: number, now: number) => {
  const s = sprites(t.dex, t.shiny)
  // The look's emote faces the camera on its own sheet (the Arena's), the walk cut short by it.
  const own = t.emote?.id === 'look' && emoting(t, now) && !t.moving ? lookEmoteFrame(t.dex, t.look.emote, now - t.emote.at) : null
  if (own) return drawDressed(ctx, s, t.look, 'Idle', 0, own.seconds, x, y, { sheet: own.sheet, loop: own.loop })
  drawDressed(ctx, s, t.look, t.moving ? 'Walk' : 'Idle', t.facing, now, x, y)
}

/** The bubble of a free emote over a trainer's head (the `look` emote has none: its animation is the show). */
export const drawEmoteBubble = (ctx: Ctx, t: TrainerView, camX: number, camY: number, now: number) => {
  if (!t.emote || t.emote.id === 'look' || !emoting(t, now)) return
  const age = now - t.emote.at
  // It pops: two px up for its first tenth of a second.
  const pop = age < 0.1 ? 2 : 0
  blitCentered(ctx, BUBBLES()[t.emote.id], Math.round(t.x - camX), Math.round(t.y - camY - headOf(t) - 9 - pop))
}

/** The colors an arcade screen flashes through while someone plays it. */
const SCREEN_COLORS = ['rgba(255,110,170,0.35)', 'rgba(90,230,250,0.35)', 'rgba(250,220,90,0.35)', 'rgba(130,240,130,0.35)'] as const

/**
 * The glow of the screen a trainer busy at a cabinet (`act === 'arcade'`)
 * stares into: a pool of flickering light at their feet and a lit rim
 * ahead of them, the colors changing with the game. Drawn under the trainer.
 */
export const drawScreenGlow = (ctx: Ctx, t: TrainerView, camX: number, camY: number, now: number) => {
  const x = Math.round(t.x - camX)
  const y = Math.round(t.y - camY)
  const color = SCREEN_COLORS[Math.floor(now * 3 + t.x) % SCREEN_COLORS.length]!
  blitEllipse(ctx, 11, 4, color, x, y - 4)
  if (Math.floor(now * 8) % 3 !== 0) blitEllipse(ctx, 7, 2, color, x, y - 9)
}

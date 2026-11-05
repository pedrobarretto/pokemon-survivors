import type { Look } from '../data/cosmetics'
import type { RealmEmote } from '../net/realm'
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

/** Draws a trainer at its feet, camera at (`camX`, `camY`); `now` is the drawing clock (s). */
export const drawTrainer = (ctx: Ctx, t: TrainerView, camX: number, camY: number, now: number) => {
  const x = Math.round(t.x - camX)
  const y = Math.round(t.y - camY)
  blitEllipse(ctx, 7, 3, 'rgba(16,24,16,0.3)', x, y)
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

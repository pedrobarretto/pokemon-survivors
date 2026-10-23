import { blitCentered, blitEllipse, context2d, createCanvas, glow, onCanvasReset, type PixelSprite } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import type { SupporterTier } from '../game/supporters'
import type { Game } from '../game/types'
import { art, lazy, toIconUrl } from './art'

/**
 * Noite das Bruxas art (`game/halloween.ts`): the candies a haunted run
 * drops, the jack-o'-lanterns among the breakables, bats, and the night
 * that falls over a haunted run and the lobby's meadow. Pure presentation.
 */

type Ctx = CanvasRenderingContext2D

/* ---------------- Sprites ---------------- */

/** A wrapped candy: 1 the wrapper's edge, 2 its color, 3 the twisted ends, 4 the shine. */
const TREAT = ['3..111..3', '331242133', '331222133', '3..111..3']
const TREAT_COLORS = [
  { 1: '#b04808', 2: '#f88820', 3: '#ffd060', 4: '#ffffff' },
  { 1: '#582890', 2: '#a058e0', 3: '#e0b8ff', 4: '#ffffff' },
  { 1: '#1c7038', 2: '#48c060', 3: '#c0f0a0', 4: '#ffffff' },
] as const

/** A jack-o'-lantern: 1 the ridges, 2 the pumpkin, 3 its shine, 4 the candle's glow through the face, 5 the stem. */
const JACK_O_LANTERN = [
  '......55.....',
  '......5......',
  '...1115111...',
  '.11222122211.',
  '1322212123221',
  '1244212124421',
  '1224212124221',
  '1222214122221',
  '1242444442421',
  '.12244244221.',
  '..111111111..',
]
const jack = (glow: string) => art(JACK_O_LANTERN, { 1: '#b04808', 2: '#f08020', 3: '#ffb860', 4: glow, 5: '#407028' }, '#2a1008')

/** A bat, wings up and down: 1 its body, 2 its eyes. */
const BAT = [
  ['1.......1', '11.1.1.11', '111212111', '.1111111.', '...1.1...'],
  ['.........', '...1.1...', '.1121211.', '111111111', '1..1.1..1'],
] as const

/** The Noite das Bruxas supporters' badge: a jack-o'-lantern with a heart carved in. 1 the ridges, 2 the pumpkin, 3 its shine, 4 the heart's glow, 5 the stem. */
const PUMPKIN_HEART = ['....5....', '..11511..', '.1221221.', '132424221', '124444421', '122444221', '122242221', '.1222221.', '..11111..']
const PUMPKIN_HEART_COLORS = {
  supporter: { 1: '#b04808', 2: '#f08020', 3: '#ffb860', 4: '#ff5878', 5: '#407028' },
  gold: { 1: '#a86808', 2: '#f0b018', 3: '#fff0a0', 4: '#fffbe0', 5: '#407028' },
} as const

/** The Noite das Bruxas 2026 badge on an event legend (Darkrai): a jack-o'-lantern under a crescent moon. 1 the ridges, 2 the pumpkin, 4 its glow, 5 the stem, 6 the moon, 7 its shade. */
const EVENT_BADGE = [
  '...6667....',
  '.667.......',
  '.66........',
  '667....5...',
  '667..11511.',
  '667.1222221',
  '.66.1242421',
  '.6671222221',
  '..661244421',
  '.....11111.',
]

export const HALLOWEEN_ART = {
  treats: lazy(() => TREAT_COLORS.map((pal) => art(TREAT, pal, '#181818'))),
  /** Lit, and the candle flickering low. */
  jack: lazy(() => [jack('#ffe060'), jack('#ffb030')] as const),
  bat: lazy(() => BAT.map((rows) => art(rows, { 1: '#1a0e24', 2: '#f04848' }))),
}

/** The candy icon (the HUD's counter, the event screen's jar). */
export const treatIcon = () => toIconUrl('halloween:treat', () => HALLOWEEN_ART.treats()[0]!)

/** The jack-o'-lantern icon (the lobby's card, the event screen). */
export const jackIcon = () => toIconUrl('halloween:jack', () => HALLOWEEN_ART.jack()[0])

/** The badge of a legend only the Noite das Bruxas brings (`LegendUnlock.event`), on the partner select. */
export const eventLegendIcon = () =>
  toIconUrl('halloween:eventLegend', () => art(EVENT_BADGE, { 1: '#b04808', 2: '#f08020', 4: '#ffe070', 5: '#407028', 6: '#f8f0b8', 7: '#c8b870' }, '#181818'))

/** The supporters' jack-o'-lantern badge, golden for the gold tier (`game/halloween.ts`, `pumpkinSupporter`). */
export const pumpkinHeartIcon = (tier: SupporterTier) =>
  toIconUrl(`halloween:heart:${tier}`, () => art(PUMPKIN_HEART, PUMPKIN_HEART_COLORS[tier], tier === 'gold' ? '#4a3008' : '#2a1008'))

/** How long a candy sparkle lasts, in seconds. */
export const CANDY_SPARK_LIFE = 0.7

/**
 * A candy sparkle a companion left behind (`render/companion.ts`), `age`
 * seconds old, in one of the candies' colors: a little cross with a white
 * heart, then a dot that dims and drifts up.
 */
export const drawCandySpark = (ctx: Ctx, x: number, y: number, age: number, color: number) => {
  const pal = TREAT_COLORS[color % TREAT_COLORS.length]!
  const k = age / CANDY_SPARK_LIFE
  const px = Math.round(x)
  const py = Math.round(y - k * 6)
  if (k < 0.35) {
    ctx.fillStyle = pal[2]
    ctx.fillRect(px - 1, py, 3, 1)
    ctx.fillRect(px, py - 1, 1, 3)
    ctx.fillStyle = pal[4]
    ctx.fillRect(px, py, 1, 1)
    return
  }
  ctx.fillStyle = k < 0.7 ? pal[3] : pal[1]
  ctx.fillRect(px, py, 1, 1)
}

/** A candy on the ground, bobbing; its color comes from its id. */
export const drawTreat = (ctx: Ctx, id: number, x: number, y: number) => {
  const sprites = HALLOWEEN_ART.treats()
  blitCentered(ctx, sprites[id % sprites.length]!, x, y)
}

/** The jack-o'-lantern among the breakables, on its warm glow; the candle flickers now and then. `x` carries the hit wobble. */
export const drawJack = (ctx: Ctx, x: number, y: number, id: number, t: number) => {
  blitEllipse(ctx, 9, 3, 'rgba(255,150,40,0.18)', Math.round(x), Math.round(y))
  blitEllipse(ctx, 6, 2, 'rgba(40,16,8,0.35)', Math.round(x), Math.round(y))
  const [lit, low] = HALLOWEEN_ART.jack()
  const s = (t * 3 + id * 0.61) % 4 < 0.25 ? low : lit
  ctx.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height + 2))
}

/* ---------------- The night ---------------- */

const GLOWS = lazy(() => ({ jack: glow(28, '#ff8020', 0.3), player: glow(50, '#ffe0b0', 0.12) }))

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const DUSK_RGB = [22, 6, 46] as const
/**
 * The night's moonlight, multiplied over everything (it turns the grass blue
 * rather than just darker), and the dusk's opacity in the middle of the view
 * and at its corners, in a few flat bands: light over a run (the fight must
 * read), deep over the lobby.
 */
const DUSKS = {
  run: { moon: '#c0b0e8', inner: 0.04, outer: 0.42 },
  lobby: { moon: '#9884d0', inner: 0.16, outer: 0.5 },
} as const
const DUSK_LEVELS = 4

type Dusk = keyof typeof DUSKS

/**
 * Night over a `w`×`h` view: a purple dusk, darker toward the corners than in
 * the middle, where the action is. Flat bands with a Bayer-dithered edge
 * between them (like the fog's veil), built once per view size.
 */
const duskVeil = (() => {
  const cache = new Map<Dusk, { w: number; h: number; canvas: PixelSprite }>()
  onCanvasReset(
    () => cache.clear(),
    () => cache,
  )
  return (kind: Dusk, w: number, h: number) => {
    const hit = cache.get(kind)
    if (hit && hit.w === w && hit.h === h) return hit.canvas
    const { inner, outer } = DUSKS[kind]
    const canvas = createCanvas(w, h)
    const vctx = context2d(canvas)
    const img = vctx.createImageData(w, h)
    const alphas = Array.from({ length: DUSK_LEVELS + 2 }, (_, band) => Math.round((inner + (Math.min(band, DUSK_LEVELS) / DUSK_LEVELS) * (outer - inner)) * 255))
    const [r, gr, b] = DUSK_RGB
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = Math.hypot((x - w / 2) / (w / 2), (y - h / 2) / (h / 2))
        const level = Math.min(1, Math.max(0, (d - 0.5) / 0.9)) * DUSK_LEVELS
        const band = Math.floor(level) + ((level % 1) * 16 > BAYER[(y % 4) * 4 + (x % 4)]! ? 1 : 0)
        const i = (y * w + x) * 4
        img.data[i] = r
        img.data[i + 1] = gr
        img.data[i + 2] = b
        img.data[i + 3] = alphas[band]!
      }
    }
    vctx.putImageData(img, 0, 0)
    cache.set(kind, { w, h, canvas })
    return canvas
  }
})()

/** Paints the night over a `w`×`h` view (screen space): moonlight, then the dusk's veil. */
const dusk = (ctx: Ctx, kind: Dusk, w: number, h: number) => {
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = DUSKS[kind].moon
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(duskVeil(kind, w, h), 0, 0)
}

/** Bats crossing the view in a loose flock now and then (screen space, on the clock alone). */
const drawBats = (ctx: Ctx, w: number, h: number, t: number) => {
  const frames = HALLOWEEN_ART.bat()
  const period = 14
  const cycle = Math.floor(t / period)
  const k = (t % period) / 6
  if (k > 1) return
  const fromLeft = hash2(cycle, 1, 77) < 0.5
  const baseY = h * (0.12 + hash2(cycle, 2, 77) * 0.35)
  for (let i = 0; i < 4; i++) {
    const lag = i * 0.06
    const p = k - lag
    if (p < 0 || p > 1) continue
    const x = fromLeft ? -12 + p * (w + 24) : w + 12 - p * (w + 24)
    const y = baseY + i * 7 + Math.sin(t * 5 + i * 1.7) * 4 - Math.sin(p * Math.PI) * 18
    blitCentered(ctx, frames[Math.floor(t * 8 + i) % 2]!, Math.round(x), Math.round(y))
  }
}

/**
 * The Noite das Bruxas over a haunted run, between the world and the
 * weather: the dusk, a lantern's light around the player so the fight stays
 * readable, the jack-o'-lanterns' glow and a few bats.
 */
export const drawHauntedNight = (ctx: Ctx, g: Game, camX: number, camY: number, t: number) => {
  const { w, h } = g.view
  dusk(ctx, 'run', w, h)
  const g2 = GLOWS()
  ctx.globalCompositeOperation = 'lighter'
  blitCentered(ctx, g2.player, Math.round(g.player.x - camX), Math.round(g.player.y - 8 - camY))
  for (const prop of g.props) {
    if (prop.kind !== 'pumpkin') continue
    const x = prop.x - camX
    const y = prop.y - 4 - camY
    if (x < -40 || y < -40 || x > w + 40 || y > h + 40) continue
    blitCentered(ctx, g2.jack, Math.round(x), Math.round(y + ((t * 3 + prop.id * 0.61) % 4 < 0.25 ? 1 : 0)))
  }
  ctx.globalCompositeOperation = 'source-over'
  drawBats(ctx, w, h, t)
}

/* ---------------- The lobby's meadow ---------------- */

const MEADOW_CELL = 120

/** Jack-o'-lanterns scattered over the meadow by world cell, so they stay put as the camera drifts. */
const meadowJacks = (camX: number, camY: number, w: number, h: number) => {
  const spots: { x: number; y: number; id: number }[] = []
  for (let cy = Math.floor(camY / MEADOW_CELL) - 1; cy <= Math.floor((camY + h) / MEADOW_CELL) + 1; cy++) {
    for (let cx = Math.floor(camX / MEADOW_CELL) - 1; cx <= Math.floor((camX + w) / MEADOW_CELL) + 1; cx++) {
      if (hash2(cx, cy, 31) > 0.42) continue
      spots.push({ x: cx * MEADOW_CELL + 16 + hash2(cx, cy, 32) * (MEADOW_CELL - 32), y: cy * MEADOW_CELL + 16 + hash2(cx, cy, 33) * (MEADOW_CELL - 32), id: cx * 7 + cy * 13 })
    }
  }
  return spots
}

/** The meadow's jack-o'-lanterns, on the ground under the wanderers. */
export const drawMeadowJacks = (ctx: Ctx, camX: number, camY: number, w: number, h: number, t: number) => {
  for (const s of meadowJacks(camX, camY, w, h)) drawJack(ctx, s.x - camX, s.y - camY, s.id, t)
}

/** The night over the lobby's meadow, after everyone is drawn: the dusk, the jack-o'-lanterns' glow and the bats. */
export const drawMeadowNight = (ctx: Ctx, camX: number, camY: number, w: number, h: number, t: number) => {
  dusk(ctx, 'lobby', w, h)
  const light = GLOWS().jack
  ctx.globalCompositeOperation = 'lighter'
  for (const s of meadowJacks(camX, camY, w, h)) blitCentered(ctx, light, Math.round(s.x - camX), Math.round(s.y - 4 - camY))
  ctx.globalCompositeOperation = 'source-over'
  drawBats(ctx, w, h, t)
}

/** A jack-o'-lantern the size of a Poké Ball, for the logo's corners. */
export const logoJack = (): PixelSprite => HALLOWEEN_ART.jack()[0]

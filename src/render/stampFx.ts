import { artImages, canvasCache } from '../engine/pixelart'
import { sceneStamp, type StampLook } from './stampArt'
import type { StampId } from '../data/realmStamps'

/**
 * The carimbo: a trainer just earned a stamp, so a rubber stamper comes down
 * over its head, thumps, and lifts off the new stamp, which hangs there a
 * moment and floats off. Drawn on the town's canvas, on the drawing clock.
 */

/** One carimbo on a trainer; `at`: when it started (the drawing clock), a queue plays one after the other. */
export type StampFx = { id: StampId; look: StampLook; at: number }

/** How long a carimbo lasts (s). */
export const STAMP_FX_SECONDS = 2.2

/** Moments of the carimbo (s): down until `HIT`, the burst until `LIFT`, then the stamper leaves. */
const HIT = 0.28
const LIFT = 0.6
const FADE = 1.8
const STAMPER_H = 32
/** The stamp over a head is drawn this big, world px: a poster-sized one would hide the room. */
const SHOWN = 32

const stamperArt = artImages<'stamper'>(() => `${import.meta.env.BASE_URL}assets/shop/icons/stamp.png`)
const STAMPER = canvasCache<'stamper', HTMLCanvasElement>('shared')

const stamper = () => {
  const held = STAMPER.get('stamper')
  if (held) return held
  const copy = stamperArt.copy('stamper')
  if (copy) STAMPER.set('stamper', copy)
  return copy
}

/** The sparks of the thump: where each flies, in px per second. */
const BURST = [[-44, -22], [44, -22], [-30, -40], [30, -40], [-52, 6], [52, 6], [-20, 28], [20, 28]] as const

/**
 * Draws a carimbo over a trainer (`x`, `top` the world px above its head,
 * minus the camera), or nothing past its time. Returns whether it's still on.
 */
export const drawStampFx = (ctx: CanvasRenderingContext2D, fx: StampFx, x: number, top: number, clock: number) => {
  const age = clock - fx.at
  if (age < 0 || age > STAMP_FX_SECONDS) return age < 0
  const stamp = sceneStamp(fx.id, fx.look)
  const bottom = Math.round(top - 8)
  const left = Math.round(x - SHOWN / 2)
  // The stamp: under the stamper as it lifts, floating up as it fades.
  if (stamp && age >= HIT) {
    const rise = age > FADE ? Math.round((age - FADE) * 30) : 0
    ctx.globalAlpha = age > FADE ? Math.max(0, 1 - (age - FADE) / (STAMP_FX_SECONDS - FADE)) : 1
    ctx.drawImage(stamp, left, bottom - SHOWN - rise, SHOWN, SHOWN)
    ctx.globalAlpha = 1
  }
  // The stamper, falling fast, then rising and gone by `LIFT + 0.25`.
  const art = stamper()
  if (art && age < LIFT + 0.25) {
    const y = age < HIT ? bottom - SHOWN - STAMPER_H - (1 - age / HIT) * 46 : bottom - SHOWN - STAMPER_H - (age > LIFT ? (age - LIFT) * 180 : 0)
    if (age < HIT || age > LIFT) ctx.globalAlpha = 0.95
    ctx.drawImage(art, Math.round(x - art.width / 2), Math.round(y))
    ctx.globalAlpha = 1
  }
  // The burst.
  if (age >= HIT && age < LIFT) {
    const t = age - HIT
    ctx.fillStyle = age < HIT + 0.08 ? '#fff4b0' : '#f0c840'
    const midY = bottom - SHOWN / 2
    for (const [vx, vy] of BURST) ctx.fillRect(Math.round(x + vx * t * 1.6), Math.round(midY + vy * t * 1.6), 2, 2)
  }
  return true
}

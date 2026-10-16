import { blitCentered, fromStrings, type PixelSprite } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { MEGA, MEGAS, type MegaDef, type MegaId, type MegaForm } from '../data/megas'
import { playerDex } from '../game/game'
import { heldMega, rainbow } from '../game/mega'
import type { Attack, Game } from '../game/types'
import { lazy, outlined, toIconUrl } from './art'
import { hasSheets } from './sprites'

/** Code-drawn pixel art for Mega Evolution (`game/mega.ts`): the symbol, the stones, the transformation and the form's aura. */

type Ctx = CanvasRenderingContext2D

/** The Mega Evolution symbol: a white ring around a rainbow, crossed by the dark helix. Bands a-f run red to violet. */
const SYMBOL = [
  '...wwwww...',
  '.wwaaaaaww.',
  '.wbkkbbbbw.',
  'wcccckkcccw',
  'wccccckkccw',
  'wddddddkkdw',
  'wdddddkkddw',
  'weeeekkeeew',
  '.wfkkffffw.',
  '.wwfffffww.',
  '...wwwww...',
]

const [red, orange, yellow, green, blue, violet] = rainbow

const MEGA_SYMBOL = lazy(() =>
  outlined(fromStrings(SYMBOL, { w: '#ffffff', a: red, b: orange, c: yellow, d: green, e: blue, f: violet, k: '#282040' }), '#181028'),
)

/** The symbol as an icon (the Mega button). */
export const megaIcon = () => toIconUrl('mega', MEGA_SYMBOL)

/** A Mega Stone: a marble in the line's colors with its helix inside. 2 shell, 3 shine, 4 helix. */
const STONE = ['..222..', '.23322.', '2332242', '2224222', '2242222', '.22422.', '..222..']

const stones = new Map<string, PixelSprite>()

const stoneSprite = (def: MegaDef) => {
  let sprite = stones.get(def.stone)
  if (!sprite) {
    const [shell, shine, helix] = def.colors
    sprite = outlined(fromStrings(STONE, { 2: shell, 3: shine, 4: helix }), '#101018')
    stones.set(def.stone, sprite)
  }
  return sprite
}

export const megaStoneIcon = (def: MegaDef) => toIconUrl(`stone:${def.stone}`, () => stoneSprite(def))

/** A Mega Stone on the ground, with a rainbow glint going round it. */
export const drawMegaStone = (ctx: Ctx, mega: MegaId, x: number, y: number, t: number) => {
  blitCentered(ctx, stoneSprite(MEGAS[mega]), x, y)
  const a = t * 5
  ctx.fillStyle = rainbow[Math.floor(t * 8) % rainbow.length]!
  ctx.fillRect(Math.round(x + Math.cos(a) * 7), Math.round(y + Math.sin(a) * 7), 1, 1)
}

/** Transformation progress, 0 → 1 (0 when none is playing). */
const introProgress = (g: Game) => (g.player.mega.intro > 0 ? 1 - g.player.mega.intro / MEGA.intro : 0)

type MegaLook = { form: MegaForm | undefined; flash: number; outline?: string }

/**
 * Which sheets the player wears and how white it flashes: the Mega form while
 * it lasts; during the transformation a white silhouette that flickers between
 * the two forms faster and faster, then fades into the Mega's colors. A Mega
 * SpriteCollab hasn't drawn yet wears its final stage with a rainbow outline.
 */
export const megaLook = (g: Game): MegaLook => {
  const def = heldMega(g)
  if (!def) return { form: undefined, flash: 0 }
  if (g.player.mega.intro <= 0) {
    if (g.player.mega.active <= 0) return { form: undefined, flash: 0 }
    const outline = hasSheets(playerDex(g), def.form) ? undefined : rainbow[Math.floor(g.player.mega.active * 4) % rainbow.length]
    return { form: def.form, flash: 0, outline }
  }
  const k = introProgress(g)
  if (k < 0.35) return { form: undefined, flash: k / 0.35 }
  if (k < 0.8) {
    const period = 0.16 - (k - 0.35) * 0.28
    return { form: Math.floor((k - 0.35) / period) % 2 === 0 ? def.form : undefined, flash: 1 }
  }
  return { form: def.form, flash: 1 - (k - 0.8) / 0.2 }
}

/**
 * Under the entities: a veil over the world while the keystone energy gathers,
 * an aura's reach (Shadow Tag, Electric Surge) while the Mega lasts, and the rainbow motes at a Mega's feet.
 */
export const drawMegaGround = (ctx: Ctx, g: Game, camX: number, camY: number, t: number) => {
  const def = heldMega(g)
  if (!def) return
  const p = g.player
  if (g.player.mega.intro > 0) {
    ctx.fillStyle = `rgba(16,8,40,${(0.45 * Math.min(1, introProgress(g) * 4)).toFixed(2)})`
    ctx.fillRect(camX, camY, g.view.w, g.view.h)
  }
  if (g.player.mega.active <= 0) return
  if (def.effect.kind === 'aura') {
    const r = def.effect.radius
    const steps = Math.ceil(r * TAU * 0.25)
    for (let i = 0; i < steps; i++) {
      if (i % 4 === 3) continue
      const a = (i / steps) * TAU + t * 0.6
      ctx.fillStyle = i % 4 === 0 ? def.colors[1] : def.colors[0]
      ctx.fillRect(Math.round(p.x + Math.cos(a) * r), Math.round(p.y - 4 + Math.sin(a) * r), 2, 2)
    }
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + t * 2.5
    ctx.fillStyle = rainbow[(i + Math.floor(t * 6)) % rainbow.length]!
    ctx.fillRect(Math.round(p.x + Math.cos(a) * 14), Math.round(p.y + 1 + Math.sin(a) * 5), 1, 1)
  }
}

/**
 * Above the entities: the transformation's rainbow streams spiralling into the
 * Pokémon with the symbol over its head, then the symbol floating over the
 * Mega form (blinking for its last 3 seconds). `top` is the sprite's top edge.
 */
export const drawMegaAir = (ctx: Ctx, g: Game, top: number, t: number) => {
  if (!heldMega(g)) return
  const p = g.player
  const k = introProgress(g)
  if (g.player.mega.intro > 0) {
    const cy = p.y - 12
    for (let i = 0; i < rainbow.length; i++) {
      ctx.fillStyle = rainbow[i]!
      for (let j = 0; j < 6; j++) {
        const r = Math.max(2, (1 - k) * 80 + j * 5)
        const a = (i / rainbow.length) * TAU + k * 9 - j * 0.12
        ctx.fillRect(Math.round(p.x + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.75), 2, 2)
      }
    }
    if (k > 0.15) {
      ctx.globalAlpha = Math.min(1, (k - 0.15) * 4)
      blitCentered(ctx, MEGA_SYMBOL(), p.x, top - 10 - Math.round(k * 4))
      ctx.globalAlpha = 1
    }
    return
  }
  const left = g.player.mega.active
  if (left <= 0 || (left < 3 && Math.floor(t * 6) % 2 === 0)) return
  blitCentered(ctx, MEGA_SYMBOL(), p.x, top - 8 + Math.round(Math.sin(t * 3)))
}

/** The burst that ends the transformation: rainbow rings racing out, then fading. */
export const drawMegaAttack = (ctx: Ctx, a: Attack) => {
  if (a.visual !== 'megaWave' || a.shape.kind !== 'circle') return
  const r = a.shape.r
  ctx.globalAlpha = Math.max(0, 1 - a.age / a.ttl)
  for (let i = 0; i < rainbow.length; i++) {
    const rr = Math.round(r - i * 2)
    if (rr <= 0) break
    ctx.fillStyle = rainbow[i]!
    const steps = Math.max(12, Math.ceil(rr * TAU * 0.6))
    for (let j = 0; j < steps; j++) {
      const ang = (j / steps) * TAU
      ctx.fillRect(Math.round(a.x + Math.cos(ang) * rr), Math.round(a.y + Math.sin(ang) * rr * 0.8), 1, 1)
    }
  }
  ctx.globalAlpha = 1
}

import { blitCentered, blitEllipse, blitRing, type PixelSprite } from '../engine/pixelart'
import { ENEMIES } from '../data/enemies'
import { TRAITS } from '../data/traits'
import { TYPE_COLORS } from '../data/types'
import { flavorOf } from '../game/spitters'
import { blastRadius, HEALED_TIME, leapHeight, traitPace } from '../game/traits'
import type { Enemy, Game } from '../game/types'
import { TRAIT_FX } from './art'
import { bodyOf } from '../data/bodies'
import { localPlayer } from '../game/players'

/**
 * Enemy-trait visuals: heal/ward/summon pulses, and the telegraphs of the
 * dangerous ones (blast radius, beam line, landing shadow), drawn so they read
 * on a phone: every warning blinks faster as the hit gets close.
 */

type Ctx = CanvasRenderingContext2D
type Visible = (x: number, y: number, margin?: number) => boolean

const PULSE_TIME = 0.5
const PULSES = {
  healer: { radius: TRAITS.healer.radius, line: '#78e878', fill: 'rgba(120,232,120,0.16)' },
  shield: { radius: TRAITS.shield.radius, line: '#a8c8f8', fill: 'rgba(136,184,248,0.16)' },
  summoner: { radius: 30, line: '#c8a0e8', fill: 'rgba(200,160,232,0.2)' },
} as const
const DANGER = { line: '#f84830', fill: 'rgba(248,72,48,0.2)' } as const
/** Seconds the blast ring of a Voltorb that went off stays up (inside its 0.4s faint). */
const BLAST_TIME = 0.3

/** On/off blink that speeds up as `k` (0..1) gets close to 1. */
const blink = (time: number, k: number) => Math.floor(time * (6 + k * 18)) % 2 === 0

/** A 1px-long cross-section stretched along a line: hard edges, no smoothing. */
const stripe = (ctx: Ctx, sprite: PixelSprite, x: number, y: number, angle: number, length: number) => {
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y))
  ctx.rotate(angle)
  ctx.drawImage(sprite, 0, -Math.floor(sprite.height / 2), Math.round(length), sprite.height)
  ctx.restore()
}

/** Telegraph circle like the bosses': a fill growing with `k` and an outline blinking faster. */
const danger = (ctx: Ctx, x: number, y: number, r: number, k: number, time: number) => {
  const fill = Math.max(1, Math.round(r * k))
  blitEllipse(ctx, fill, fill, DANGER.fill, x, y)
  if (blink(time, k)) blitRing(ctx, Math.round(r), 1, DANGER.line, x, y)
}

/** Ground layer: pulse rings and every warning (blast radius, beam line, landing spot). */
export const drawTraitGround = (ctx: Ctx, g: Game, visible: Visible) => {
  for (const e of g.enemies) {
    const act = e.trait.act
    if (!act) continue
    switch (act.kind) {
      case 'healer':
      case 'shield':
      case 'summoner': {
        if (act.cast >= PULSE_TIME || e.dying >= 0 || !visible(e.x, e.y, 80)) break
        const k = act.cast / PULSE_TIME
        const look = PULSES[act.kind]
        const r = Math.max(2, Math.round(look.radius * (1 - (1 - k) ** 2)))
        ctx.globalAlpha = 1 - k * 0.8
        blitEllipse(ctx, r, r, look.fill, e.x, e.y)
        blitRing(ctx, r, 2, look.line, e.x, e.y)
        ctx.globalAlpha = 1
        break
      }
      case 'kamikaze': {
        if (act.fuse < 0 || e.dying >= 0 || !visible(e.x, e.y)) break
        danger(ctx, e.x, e.y, blastRadius(e.radius), Math.min(1, act.fuse / TRAITS.kamikaze.fuse), act.fuse)
        break
      }
      case 'beam': {
        if (act.phase !== 'aim' || e.dying >= 0 || !visible(act.ox, act.oy, TRAITS.beam.length)) break
        const k = act.t / TRAITS.beam.aim
        const [red, yellow] = TRAIT_FX.beamTelegraph()
        ctx.globalAlpha = 0.6 + k * 0.4
        stripe(ctx, blink(act.t, k) ? red! : yellow!, act.ox, act.oy, Math.atan2(act.dy, act.dx), TRAITS.beam.length)
        ctx.globalAlpha = 1
        break
      }
      case 'leaper': {
        if (act.phase === 'idle' || e.dying >= 0 || !visible(act.toX, act.toY)) break
        const l = TRAITS.leaper
        const elapsed = act.phase === 'crouch' ? act.t : l.crouch + act.t
        const k = Math.min(1, elapsed / (l.crouch + l.air))
        // The landing shadow grows as the leaper comes down.
        const rx = Math.round(4 + k * (l.radius * 0.7 - 4))
        blitEllipse(ctx, rx, Math.max(1, Math.round(rx * 0.45)), 'rgba(16,24,16,0.45)', act.toX, act.toY)
        danger(ctx, act.toX, act.toY, l.radius, k, elapsed)
        break
      }
    }
  }
}

/** Air layer: beams firing, ward bubbles, heal crosses, "!" alerts and blast rings. */
export const drawTraitAir = (ctx: Ctx, g: Game, visible: Visible) => {
  const cross = TRAIT_FX.healCross()
  const alert = TRAIT_FX.alert()
  for (const e of g.enemies) {
    const st = e.trait
    const act = st.act
    if (!act && st.wardTime <= 0 && st.healed <= 0) continue

    if (act?.kind === 'kamikaze' && e.dying >= 0) {
      if (act.fuse < TRAITS.kamikaze.fuse || e.dying > BLAST_TIME || !visible(e.x, e.y)) continue
      const k = e.dying / BLAST_TIME
      const r = blastRadius(e.radius)
      ctx.globalAlpha = 1 - k
      blitEllipse(ctx, r, r, 'rgba(255,240,160,0.5)', e.x, e.y)
      blitRing(ctx, Math.round(r * (0.7 + k * 0.3)), 2, '#f8e858', e.x, e.y)
      ctx.globalAlpha = 1
      continue
    }
    if (e.dying >= 0) continue

    if (act?.kind === 'beam' && act.phase === 'fire' && visible(act.ox, act.oy, TRAITS.beam.length)) {
      const color = TYPE_COLORS[e.types[0] ?? 'electric']
      ctx.globalAlpha = Math.min(1, (TRAITS.beam.fire - act.t) / 0.08)
      stripe(ctx, TRAIT_FX.beam(color), act.ox, act.oy, Math.atan2(act.dy, act.dx), TRAITS.beam.length)
      blitEllipse(ctx, 3, 3, '#ffffff', act.ox, act.oy)
      ctx.globalAlpha = 1
    }
    if (!visible(e.x, e.y)) continue

    const lift = traitLift(e)
    const cy = e.y - e.radius - lift
    if (act?.kind === 'spitter' && act.phase === 'charge') spitGlow(ctx, g, e, act.t, act.t / flavorOf(e.types).charge)
    if (st.wardTime > 0 && st.ward > 0 && (st.wardTime > 1.5 || Math.floor(st.wardTime * 8) % 2 === 0)) {
      const hit = st.wardHit < 0.12
      blitEllipse(ctx, e.radius + 4, e.radius + 4, hit ? 'rgba(255,255,255,0.35)' : 'rgba(136,184,248,0.22)', e.x, cy)
      blitRing(ctx, e.radius + 4, 1, hit ? '#ffffff' : '#a8d0ff', e.x, cy)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(Math.round(e.x - e.radius * 0.6), Math.round(cy - e.radius * 0.6), 1, 1)
    }
    if (st.healed > 0) {
      const k = 1 - st.healed / HEALED_TIME
      ctx.globalAlpha = Math.min(1, (1 - k) * 2)
      blitCentered(ctx, cross, e.x, e.y - e.radius * 2 - 4 - k * 8)
      ctx.globalAlpha = 1
    }
    if (act && traitPace(e) === 0 && !(act.kind === 'beam' && act.phase === 'fire') && !(act.kind === 'leaper' && act.phase === 'air')) {
      const top = e.y - bodyOf(ENEMIES[e.kind].dex).bodyH - 6
      blitCentered(ctx, alert, e.x, top + (Math.floor(g.now * 8) % 2))
    }
  }
}

/**
 * A spitter's telegraph: a glow of its type's color swelling at its mouth,
 * on the side facing the player, blinking faster as the shot gets close (`t` seconds in, `k` 0..1).
 */
const spitGlow = (ctx: Ctx, g: Game, e: Enemy, t: number, k: number) => {
  const p = localPlayer(g)
  const d = Math.hypot(p.x - e.x, p.y - e.y) || 1
  const x = e.x + ((p.x - e.x) / d) * e.radius * 0.7
  const y = e.y - bodyOf(ENEMIES[e.kind].dex).bodyH * 0.5 + ((p.y - e.y) / d) * e.radius * 0.4
  const color = TYPE_COLORS[e.types[0] ?? 'normal']
  const r = Math.max(1, Math.round(1 + k * 3))
  blitEllipse(ctx, r + 2, r + 2, 'rgba(255,255,255,0.35)', x, y)
  blitEllipse(ctx, r, r, blink(t, k) ? '#ffffff' : color, x, y)
  if (!blink(t, k)) blitRing(ctx, r + 3, 1, color, x, y)
}

/** How high a leaper is drawn above its ground position (its shadow stays on the ground). */
export const traitLift = (e: Enemy) => {
  const act = e.trait.act
  return act?.kind === 'leaper' && act.phase === 'air' ? leapHeight(Math.min(1, act.t / TRAITS.leaper.air), TRAITS.leaper.height) : 0
}

const tint = { color: '', amount: 0 }

/** Color overlay while a trait winds up (reused object, read it right away), or undefined. */
export const traitTint = (e: Enemy) => {
  const act = e.trait.act
  if (!act) return undefined
  if (act.kind === 'kamikaze' && act.fuse >= 0) {
    const k = act.fuse / TRAITS.kamikaze.fuse
    if (!blink(act.fuse, k)) return undefined
    tint.color = k > 0.85 ? '#ffffff' : '#f83030'
    tint.amount = 0.75
    return tint
  }
  if (act.kind === 'beam' && act.phase === 'aim') {
    tint.color = TYPE_COLORS[e.types[0] ?? 'electric']
    tint.amount = 0.2 + (act.t / TRAITS.beam.aim) * 0.4
    return tint
  }
  if (act.kind === 'spitter' && act.phase === 'charge') {
    tint.color = TYPE_COLORS[e.types[0] ?? 'normal']
    tint.amount = 0.2 + (act.t / flavorOf(e.types).charge) * 0.4
    return tint
  }
  if (act.kind === 'leaper' && act.phase === 'crouch') {
    tint.color = '#ffffff'
    tint.amount = 0.35
    return tint
  }
  return undefined
}

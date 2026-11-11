import { blitCentered, blitEllipse, blitRing, blitRotated } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { ENEMIES, type EnemyId } from '../data/enemies'
import { isUltraBeast } from '../data/ultraBeasts'
import { domainHere } from '../game/domain'
import { CAPTURE } from '../game/domainRules'
import type { Game } from '../game/types'
import { art, lazy } from './art'
import { drawPokemon, sprites } from './sprites'

type Ctx = CanvasRenderingContext2D

/**
 * The capture scene after a domain's battle (`game/domain.ts`): the legendary
 * kneels, a Poké Ball (an Ultra Beast's Beast Ball) flies to it, takes it in, drops and shakes; then it
 * clicks shut, or bursts open and the legendary escapes. The simulation plays
 * the same either way: which one shows is the shell's to say, through
 * `setCaptureOutcome` (the save knows how many times it was beaten).
 */

export type CaptureOutcome = 'caught' | 'escaped'

let outcomeOf: (legend: EnemyId) => CaptureOutcome = () => 'escaped'
/** The outcome decided for each capture scene, asked once so the ball and the toast agree. */
const decided = new WeakMap<object, CaptureOutcome>()

/** Wires how a capture ends (the shell reads its save). Until it's set, every legendary escapes. */
export const setCaptureOutcome = (fn: (legend: EnemyId) => CaptureOutcome) => {
  outcomeOf = fn
}

/** How the capture scene of `capture` ends, asked once per scene. */
export const captureOutcome = (capture: { kind: EnemyId }) => {
  let out = decided.get(capture)
  if (!out) decided.set(capture, (out = outcomeOf(capture.kind)))
  return out
}

/**
 * The capture balls, 13 px so the ball holds its own beside a legend: `1`
 * outline, `2` the top's color, `7` its light, `4` its lines (the Beast Ball's
 * yellow claws), `3` the band, `6` the button, `5` the white bottom and `8` its
 * shade. Rows 0 to 5 are the top half, 6 to 12 the bottom (`halves`).
 */
const POKE_ROWS = [
  '....11111....',
  '..117222211..',
  '.17722222221.',
  '.17222222221.',
  '1722222222221',
  '1333311133331',
  '1333166613331',
  '1555311135551',
  '1555555555581',
  '.15555555881.',
  '.15555558881.',
  '..118888811..',
  '....11111....',
] as const
const BEAST_ROWS = [
  '....11111....',
  '..117242211..',
  '.17224242221.',
  '.17242224221.',
  '1724222224221',
  '1333311133331',
  '1333166613331',
  '1555311135551',
  '1555555555581',
  '.15555555881.',
  '.15555558881.',
  '..118888811..',
  '....11111....',
] as const
const POKE_COLORS = { 1: '#181018', 2: '#e83838', 7: '#f88878', 4: '#e83838', 3: '#202020', 6: '#ffffff', 5: '#f0f0f0', 8: '#b8b8c8' }
const BEAST_COLORS = { 1: '#0c1430', 2: '#2c60d8', 7: '#70a0f8', 4: '#f8d030', 3: '#182040', 6: '#ffffff', 5: '#f0f0f0', 8: '#b8b8c8' }

/** A ball whole and its two halves (the top with the band's upper rows, the bottom with the button's lower ones). */
const halves = (rows: readonly string[], colors: Record<string, string>) => ({
  ball: art(rows, colors),
  top: art(rows.slice(0, 6), colors),
  bottom: art(rows.slice(6), colors),
})
const POKE = lazy(() => halves(POKE_ROWS, POKE_COLORS))
/** The Beast Ball an Ultra Beast is caught in: blue, its top run through with yellow claws. */
const BEAST = lazy(() => halves(BEAST_ROWS, BEAST_COLORS))

/** Prism colors: the stars a Beast Ball throws as it clicks shut. */
const PRISM = ['#f8a0d0', '#f8e098', '#a8f0c8', '#98d8f8', '#c8a8f8'] as const

/** The ball a capture throws, and the light it takes its catch in with: a Beast Ball for an Ultra Beast, a Poké Ball for the rest. */
const ballOf = (kind: EnemyId) =>
  isUltraBeast(kind) ? { ...BEAST(), beam: '#58c8f8', glow: '#3878f8', prism: true } : { ...POKE(), beam: '#f85050', glow: '#f83030', prism: false }

const STAR = lazy(() => art(['..1..', '.121.', '12221', '.121.', '..1..'], { 1: '#f8d030', 2: '#fff8c0' }))

const clamp01 = (k: number) => Math.min(1, Math.max(0, k))

/** A capture scene's beats, in seconds (`CAPTURE` for a domain's, `LIGHT_CAPTURE` for a legendary falling on the map). */
export type CaptureTiming = { kneel: number; throw: number; absorb: number; drop: number; shake: number; settle: number }

/** Whether a capture scene is playing (a domain's or a legendary's on the map): the ground's pickups beside it (a boss's Tera Shards) wait, so the ball has the stage. */
export const capturePlaying = (g: Game) => domainHere(g)?.d.act === 'capture' || (g.legendScene?.kind === 'capture' && g.legendScene.capture !== null)

/** The capture scene in world space (after the entities): the kneeling legendary (and its partner, with a ball of its own), the ball, its shakes and how it ends. */
export const drawCapture = (ctx: Ctx, g: Game, t: number) => {
  const here = domainHere(g)
  const c = here?.d.capture
  if (!here || !c || (here.d.act !== 'capture' && here.d.act !== 'after')) return
  const scene = here.d.act === 'after' ? CAPTURE.length + here.d.age : here.d.scene
  drawCaptureScene(ctx, g, c, scene, CAPTURE, t)
  if (c.partner) drawCaptureScene(ctx, g, c.partner, scene, CAPTURE, t)
}

/**
 * Draws capture `c`, `scene` s into it on `timing`'s beats: the legendary kneels,
 * the ball flies from the player, takes it in, drops, shakes and settles.
 */
export const drawCaptureScene = (ctx: Ctx, g: Game, c: { kind: EnemyId; x: number; y: number; shiny: boolean }, scene: number, timing: CaptureTiming, t: number) => {
  // Seconds since the ball left the player's hand (negative while the legendary kneels).
  const s = scene - timing.kneel
  const p = g.player
  const x = Math.round(c.x)
  const y = Math.round(c.y)
  const sp = sprites(ENEMIES[c.kind].dex, c.shiny)
  // Where the ball's middle rests: its 13 px sit on the legend's feet.
  const ground = y - 6
  const absorbEnd = timing.throw + timing.absorb
  const dropEnd = absorbEnd + timing.drop
  const settle = timing.settle - timing.kneel
  const out = s >= settle ? captureOutcome(c) : null
  const look = ballOf(c.kind)
  // The legendary kneels until the ball takes it in: shrinking into its ball's glow.
  if (s < absorbEnd) {
    const k = clamp01((s - timing.throw) / timing.absorb)
    drawPokemon(ctx, sp, 'Hurt', 0, 0.2, x, y, { loop: false, scale: 1 - k * 0.9, tint: { color: look.glow, amount: k * 0.8 }, flash: k > 0 ? 0.3 + k * 0.6 : 0, alpha: 1 - k * 0.5 })
  }
  if (s < 0) {
    // Knocked out: stars circle its head before the throw.
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i / 3) * TAU
      blitCentered(ctx, STAR(), Math.round(x + Math.cos(a) * 14), Math.round(y - sp.bodyH - 4 + Math.sin(a) * 4))
    }
    return
  }
  if (s < timing.throw) {
    // The throw: an arc from the player up and over to the legendary.
    const k = s / timing.throw
    const bx = p.x + (x - p.x) * k
    const by = p.y - 14 + (y - 40 - (p.y - 14)) * k - Math.sin(k * Math.PI) * 50
    blitRotated(ctx, look.ball, Math.round(bx), Math.round(by), k * TAU * 2)
    return
  }
  if (s < absorbEnd) {
    // The ball hangs open over it; a beam of its light pulls it in.
    const by = y - 40
    ctx.fillStyle = look.beam
    for (let yy = by; yy < y - 6; yy += 2) ctx.fillRect(x - 1 + Math.round(Math.sin(yy + t * 30)), yy, 2, 2)
    blitCentered(ctx, look.top, x, by - 4)
    blitCentered(ctx, look.bottom, x, by + 4)
    return
  }
  let bx = x
  let by = ground
  let angle = 0
  if (s < dropEnd) {
    const k = (s - absorbEnd) / timing.drop
    by = Math.round(y - 40 + (ground - (y - 40)) * k * k)
  } else if (s < settle) {
    // Each shake: a wobble left and right, then still.
    const k = ((s - dropEnd) % timing.shake) / timing.shake
    angle = k < 0.5 ? Math.sin(k * 2 * TAU) * 0.45 : 0
    bx = x + Math.round(angle * 3)
  }
  blitEllipse(ctx, 7, 2, 'rgba(16,8,32,0.4)', x, ground + 7)
  if (!out || out === 'caught') {
    // While it shakes and as it clicks, its light pulses round it on the beat of each shake.
    if (s >= dropEnd && (!out || s < settle + 0.5)) {
      const k = out ? clamp01((s - settle) / 0.5) : ((s - dropEnd) % timing.shake) / timing.shake
      blitRing(ctx, 9 + Math.round(k * 8), 1, look.glow, bx, by)
    }
    blitRotated(ctx, look.ball, bx, by, angle)
    if (out === 'caught') {
      // Click: stars burst out and fade.
      const k = clamp01((s - settle) / 0.8)
      if (k < 1) {
        ctx.globalAlpha = 1 - k
        for (let i = 0; i < 3; i++) {
          const a = -Math.PI / 2 + (i - 1) * 0.7
          blitCentered(ctx, STAR(), Math.round(x + Math.cos(a) * (8 + k * 20)), Math.round(by + Math.sin(a) * (8 + k * 20)))
        }
        // A Beast Ball shuts in Ultra Space's light: prism sparks fly all round it.
        if (look.prism) {
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * TAU + 0.3
            ctx.fillStyle = PRISM[i % PRISM.length]!
            ctx.fillRect(Math.round(x + Math.cos(a) * (10 + k * 26)) - 1, Math.round(by + Math.sin(a) * (10 + k * 22)) - 1, 2, 2)
          }
        }
        ctx.globalAlpha = 1
      }
    }
    return
  }
  // Broke free: the halves fly apart and the legendary flashes back out, rising away.
  const k = clamp01((s - settle) / 1.2)
  blitCentered(ctx, look.top, x - Math.round(k * 18), by - 4 - Math.round(Math.sin(k * Math.PI) * 10))
  blitCentered(ctx, look.bottom, x + Math.round(k * 18), by + 4 - Math.round(Math.sin(k * Math.PI) * 6))
  if (k < 1) {
    drawPokemon(ctx, sp, 'Idle', 0, t, x, y - Math.round(k * 40), { alpha: 1 - k, flash: 1 - k })
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 14; i++) {
      const a = hash2(i, 1, 9) * TAU
      const r = k * 50 * (0.5 + hash2(i, 2, 9))
      ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y - 14 + Math.sin(a) * r), 2, 2)
    }
  }
}

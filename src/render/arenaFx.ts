import { effectIn, type BurstKind, type EmoteAnim, type EffectOf, type Flourish, type TrailKind } from '../data/arenaEffects'
import type { Look } from '../data/cosmetics'
import { bodyOf } from '../data/bodies'
import emoteManifest from '../data/emotes.generated.json'
import { VERSUS } from '../data/versus'
import { TAU } from '../engine/math'
import { blitCentered, blitEllipse, blitRing, context2d, createCanvas, fromStrings, lazy } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import { formAt } from '../game/branch'
import { localPlayer } from '../game/players'
import type { Game, GameEvent, Player } from '../game/types'
import type { VersusState } from '../game/versus'
import { lookOf, looksGameKey, shownLook } from './looks'
import { createCompanion, drawCompanion, stepCompanion, type CompanionView } from './companion'
import { detail } from './quality'
import { drawPokemon, freeSheet, loadSheet, sprites, type Sheet } from './sprites'
import { concealed, grassAlpha } from './valeGrass'
import { TEAM_COLORS } from './vale'

/**
 * The cosmetic effects in a game (`data/arenaEffects.ts`), read from each
 * seat's look as its mode shows it (`shownLook`): the followers trotting
 * after their trainers and the trails in a run (solo or co-op) and in the
 * Arena; there also the spawn, KO and goal effects and the emotes'
 * animations and flourishes. Shell state only, never the simulation's: it
 * steps on the drawing clock and hears the match's events (`arenaFxEvent`);
 * the emote is the one thing a player sends (`versusSocial.ts`), and the
 * match only keeps when it played, so every screen plays the seat's own.
 *
 * Particles live in one fixed pool (typed arrays, no allocation per frame:
 * eight players' trails on a phone at 60 Hz), capped lower and emitted half
 * as often when the frame governor draws lean (`render/quality.ts`); a lean
 * run also leaves teammates' followers and trails out (the horde already
 * fills a struggling phone's frame), keeping this screen's own. Anything of
 * a Pokémon hidden from this screen in the tall grass (`concealed`) shows
 * nowhere: its follower, its trail, its emote.
 */

type Ctx = CanvasRenderingContext2D

/* ---------------- Art ---------------- */

const sprite = (rows: readonly string[], palette: Record<string, string>) => fromStrings(rows, palette)

const HEART = ['.1.1.', '12111', '11111', '.111.', '..1..']
const STAR = ['..1..', '..1..', '11211', '.111.', '.1.1.']
const NOTE = ['..11.', '..1.1', '..1..', '.11..', '111..', '.1...']
const FLAKE = ['1.1.1', '.121.', '12221', '.121.', '1.1.1']
const PETAL = ['.11.', '1221', '.11.']
const LEAF = ['..11', '.121', '121.', '1...']
const COIN = ['.111.', '12221', '12321', '12221', '.111.']
const BALLOON = ['.111.', '11121', '11111', '11111', '.111.', '..1..', '..2..', '.2...', '..2..']
const ZEE = ['1111', '..1.', '.1..', '1111']
const GHOST = ['..11111..', '.1222221.', '122222221', '123223221', '122222221', '122222221', '122222221', '121212121', '1.1.1.1.1']

const ART = {
  heart: lazy(() => sprite(HEART, { 1: '#e83878', 2: '#ffc0d8' })),
  hearts: lazy(() => [sprite(HEART, { 1: '#e83878', 2: '#ffc0d8' }), sprite(HEART, { 1: '#f870a8', 2: '#ffffff' }), sprite(HEART, { 1: '#c02050', 2: '#f898b8' })]),
  stars: lazy(() => [sprite(STAR, { 1: '#f8d030', 2: '#ffffff' }), sprite(STAR, { 1: '#a8d8f8', 2: '#ffffff' }), sprite(STAR, { 1: '#f8a8e0', 2: '#ffffff' })]),
  notes: lazy(() => [sprite(NOTE, { 1: '#3868d8' }), sprite(NOTE, { 1: '#d84890' }), sprite(NOTE, { 1: '#38a058' })]),
  flake: lazy(() => sprite(FLAKE, { 1: '#d8f0ff', 2: '#ffffff' })),
  petals: lazy(() => [sprite(PETAL, { 1: '#f080b0', 2: '#ffd0e8' }), sprite(PETAL, { 1: '#f8a8c8', 2: '#ffffff' })]),
  leaves: lazy(() => [sprite(LEAF, { 1: '#307828', 2: '#88d850' }), sprite(LEAF, { 1: '#58a030', 2: '#c8f070' })]),
  coin: lazy(() => sprite(COIN, { 1: '#a87000', 2: '#f8c830', 3: '#fff8c0' })),
  balloons: lazy(() => ['#e83838', '#3878e8', '#f8c830', '#48b848', '#e860b0'].map((c) => sprite(BALLOON, { 1: c, 2: '#f8f8f8' }))),
  zee: lazy(() => sprite(ZEE, { 1: '#e8f0ff' })),
  ghost: lazy(() => sprite(GHOST, { 1: '#584878', 2: '#e8e0f8', 3: '#282040' })),
  /** A Poké Ball, 13 px, painted in halves so it can open: `top` and `bottom`. */
  ball: lazy(() => {
    const r = 6
    const half = (top: boolean) => {
      const rows: string[] = []
      for (let y = -r; y <= r; y++) {
        let row = ''
        for (let x = -r; x <= r; x++) {
          const d = x * x + y * y
          const inside = d <= r * r + 2
          const mine = top ? y < 0 : y >= 0
          if (!inside || !mine) row += '.'
          else if (d > (r - 1) * (r - 1) + 1) row += '1'
          else if (y === -1 || y === 0) row += '1'
          else if (x * x + y * y <= 4) row += y < 0 ? '1' : '3'
          else row += top ? '2' : '4'
        }
        rows.push(row)
      }
      return sprite(rows, { 1: '#181818', 2: '#e83030', 3: '#f8f8f8', 4: '#f0f0f0' })
    }
    return { top: half(true), bottom: half(false) }
  }),
  /** A rainbow's arch, 61×24: revealed left to right as it grows (`goalRainbow`). */
  rainbow: lazy(() => {
    const colors = ['#e83838', '#f89030', '#f8d830', '#48c048', '#3888f0', '#8850d0']
    const w = 61
    const rows: string[] = []
    for (let y = 0; y < 24; y++) {
      let row = ''
      for (let x = 0; x < w; x++) {
        const dx = (x - 30) / 30
        const dy = (24 - y) / 24
        const d = Math.sqrt(dx * dx + dy * dy)
        const band = Math.floor((1 - d) * 24)
        row += band >= 0 && band < colors.length ? String(band) : '.'
      }
      rows.push(row)
    }
    return sprite(rows, Object.fromEntries(colors.map((c, i) => [String(i), c])))
  }),
}

const RAINBOW = ['#e83838', '#f89030', '#f8d830', '#48c048', '#3888f0', '#8850d0'] as const
const CONFETTI = ['#e83838', '#f8d830', '#48c048', '#3888f0', '#e860b0', '#ffffff'] as const

/* ---------------- The particle pool ---------------- */

/** Every particle the effects leave, by its drawing. */
const KINDS = ['spark', 'petal', 'bubble', 'ember', 'snow', 'heart', 'star', 'rainbow', 'confetti', 'coin', 'leaf', 'smoke', 'note', 'zee', 'balloon', 'drop', 'glint'] as const
type PKind = (typeof KINDS)[number]
const KIND = Object.fromEntries(KINDS.map((k, i) => [k, i])) as Record<PKind, number>

/** How each kind moves: px/s² down (negative rises), and the share of its speed it keeps per second. */
const MOTION: Record<PKind, { fall: number; keep: number }> = {
  spark: { fall: 0, keep: 0.05 },
  petal: { fall: 14, keep: 0.4 },
  bubble: { fall: -22, keep: 0.3 },
  ember: { fall: -30, keep: 0.3 },
  snow: { fall: 10, keep: 0.3 },
  heart: { fall: -24, keep: 0.3 },
  star: { fall: 0, keep: 0.1 },
  rainbow: { fall: 0, keep: 0.05 },
  confetti: { fall: 70, keep: 0.25 },
  coin: { fall: 180, keep: 0.6 },
  leaf: { fall: 0, keep: 0.25 },
  smoke: { fall: -10, keep: 0.15 },
  note: { fall: -18, keep: 0.3 },
  zee: { fall: -14, keep: 0.4 },
  balloon: { fall: -26, keep: 0.6 },
  drop: { fall: 200, keep: 0.7 },
  glint: { fall: 20, keep: 0.12 },
}

const MAX_PARTICLES = 384
/** Particles alive at most while the frame governor draws lean. */
const LEAN_PARTICLES = 140

const P = {
  x: new Float32Array(MAX_PARTICLES),
  y: new Float32Array(MAX_PARTICLES),
  vx: new Float32Array(MAX_PARTICLES),
  vy: new Float32Array(MAX_PARTICLES),
  age: new Float32Array(MAX_PARTICLES),
  life: new Float32Array(MAX_PARTICLES),
  /** 0..1, rolled at birth: its color, its sway's phase. */
  seed: new Float32Array(MAX_PARTICLES),
  kind: new Uint8Array(MAX_PARTICLES),
  /** The seat whose trail or emote it is (hidden with it in the grass), or -1 (a burst's). */
  owner: new Int8Array(MAX_PARTICLES),
  /** 1: drawn over the Pokémon (bursts, flourishes); 0: on the ground with the trails. */
  air: new Uint8Array(MAX_PARTICLES),
}
let count = 0

const emit = (kind: PKind, x: number, y: number, vx: number, vy: number, life: number, owner = -1, air = 1, seed = Math.random()) => {
  if (count >= (detail.lean ? LEAN_PARTICLES : MAX_PARTICLES)) return
  const i = count++
  P.x[i] = x
  P.y[i] = y
  P.vx[i] = vx
  P.vy[i] = vy
  P.age[i] = 0
  P.life[i] = life
  P.seed[i] = seed
  P.kind[i] = KIND[kind]
  P.owner[i] = owner
  P.air[i] = air
}

/** `n` particles out of (x, y) in a ring, `speed` px/s give or take a third, rising by `up`. */
const ringOut = (kind: PKind, n: number, x: number, y: number, speed: number, life: number, up = 0) => {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + Math.random() * 0.4
    const s = speed * (0.67 + Math.random() * 0.66)
    emit(kind, x, y, Math.cos(a) * s, Math.sin(a) * s * 0.6 - up, life * (0.8 + Math.random() * 0.4))
  }
}

const stepParticles = (dt: number) => {
  for (let i = count - 1; i >= 0; i--) {
    const age = (P.age[i]! += dt)
    if (age >= P.life[i]!) {
      const last = --count
      if (i !== last) {
        P.x[i] = P.x[last]!
        P.y[i] = P.y[last]!
        P.vx[i] = P.vx[last]!
        P.vy[i] = P.vy[last]!
        P.age[i] = P.age[last]!
        P.life[i] = P.life[last]!
        P.seed[i] = P.seed[last]!
        P.kind[i] = P.kind[last]!
        P.owner[i] = P.owner[last]!
        P.air[i] = P.air[last]!
      }
      continue
    }
    const m = MOTION[KINDS[P.kind[i]!]!]
    const keep = Math.pow(m.keep, dt)
    P.vx[i] = P.vx[i]! * keep
    P.vy[i] = P.vy[i]! * keep + m.fall * dt
    P.x[i] = P.x[i]! + P.vx[i]! * dt
    P.y[i] = P.y[i]! + P.vy[i]! * dt
  }
}

/** A tiny plus in `color`, its middle `core`. */
const plus = (ctx: Ctx, x: number, y: number, color: string, core: string) => {
  ctx.fillStyle = color
  ctx.fillRect(x - 1, y, 3, 1)
  ctx.fillRect(x, y - 1, 1, 3)
  ctx.fillStyle = core
  ctx.fillRect(x, y, 1, 1)
}

const pick = <T>(list: readonly T[], seed: number) => list[Math.floor(seed * list.length) % list.length]!

/** One particle, `k` of its life gone. */
const drawParticle = (ctx: Ctx, i: number, t: number) => {
  const kind = KINDS[P.kind[i]!]!
  const seed = P.seed[i]!
  const k = P.age[i]! / P.life[i]!
  const sway = Math.sin(P.age[i]! * 5 + seed * TAU)
  const x = Math.round(P.x[i]!)
  const y = Math.round(P.y[i]!)
  ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1
  switch (kind) {
    case 'spark':
      if (k < 0.5) plus(ctx, x, y, '#f8d030', '#ffffff')
      else {
        ctx.fillStyle = '#f8b830'
        ctx.fillRect(x, y, 1, 1)
      }
      break
    case 'glint':
      if (k < 0.45) plus(ctx, x, y, pick(CONFETTI, seed), '#ffffff')
      else {
        ctx.fillStyle = pick(CONFETTI, seed)
        ctx.fillRect(x, y, 1, 1)
      }
      break
    case 'rainbow':
      // A column of the six bands: dropped every few px, they make a ribbon.
      for (let b = 0; b < 6; b++) {
        ctx.fillStyle = RAINBOW[b]!
        ctx.fillRect(x - 1, y - 6 + b + Math.round(Math.sin(P.age[i]! * 6 + seed * TAU) * (k * 2)), 2, 1)
      }
      break
    case 'petal':
      blitCentered(ctx, pick(ART.petals(), seed), x + Math.round(sway * 2), y)
      break
    case 'leaf':
      blitCentered(ctx, pick(ART.leaves(), seed), x + Math.round(sway * 2), y)
      break
    case 'bubble': {
      const r = k < 0.3 ? 1 : 2
      ctx.fillStyle = '#a8d8f8'
      ctx.fillRect(x - r, y, r * 2 + 1, 1)
      ctx.fillRect(x, y - r, 1, r * 2 + 1)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x - 1, y - 1, 1, 1)
      if (k > 0.9) plus(ctx, x, y, '#d8f0ff', '#ffffff')
      break
    }
    case 'ember':
      ctx.fillStyle = k < 0.3 ? '#fff0a0' : k < 0.6 ? '#f89030' : '#c83018'
      ctx.fillRect(x + Math.round(sway), y, Math.floor(t * 20 + seed * 9) % 3 === 0 ? 1 : 2, 2)
      break
    case 'snow':
      if (k < 0.6) blitCentered(ctx, ART.flake(), x + Math.round(sway * 2), y)
      else plus(ctx, x + Math.round(sway * 2), y, '#d8f0ff', '#ffffff')
      break
    case 'heart':
      blitCentered(ctx, pick(ART.hearts(), seed), x + Math.round(sway * 1.5), y)
      break
    case 'star':
      if (Math.floor((P.age[i]! + seed) * 12) % 4 !== 0) blitCentered(ctx, pick(ART.stars(), seed), x, y)
      break
    case 'confetti': {
      ctx.fillStyle = pick(CONFETTI, seed)
      const flip = Math.floor(P.age[i]! * 12 + seed * 4) % 2
      ctx.fillRect(x + Math.round(sway * 2), y, flip ? 2 : 1, flip ? 1 : 2)
      break
    }
    case 'coin':
      blitCentered(ctx, ART.coin(), x, y)
      break
    case 'smoke': {
      // A round puff that swells and greys, its top lit.
      const r = 2 + Math.round(k * 3)
      ctx.globalAlpha *= 0.75
      blitEllipse(ctx, r, r - 1, k < 0.5 ? '#d8d0c8' : '#a8a098', x, y)
      blitEllipse(ctx, Math.max(1, r - 2), Math.max(1, r - 3), '#f0ece8', x - 1, y - 1)
      break
    }
    case 'note':
      blitCentered(ctx, pick(ART.notes(), seed), x + Math.round(sway * 2), y)
      break
    case 'zee':
      blitCentered(ctx, ART.zee(), x + Math.round(sway * 2), y)
      break
    case 'balloon':
      blitCentered(ctx, pick(ART.balloons(), seed), x + Math.round(sway * 2), y)
      break
    case 'drop':
      ctx.fillStyle = '#6890f0'
      ctx.fillRect(x, y, 1, 2)
      ctx.fillStyle = '#d8f0ff'
      ctx.fillRect(x, y, 1, 1)
      break
  }
}

/* ---------------- Bursts: the spawn, KO and goal effects ---------------- */

/** A one-shot effect playing at (x, y) for `life` seconds; `team` colors the ones that wear it. */
type Burst = { kind: BurstKind; x: number; y: number; age: number; life: number; seed: number; team: number; on: boolean }

const BURST_LIFE: Record<BurstKind, number> = {
  beam: 1.1,
  leaves: 1.2,
  splash: 1,
  thunder: 1,
  pokeball: 1.5,
  stars: 1.5,
  puff: 0.9,
  ghost: 1.7,
  lightning: 0.8,
  supernova: 1.6,
  confetti: 2,
  coins: 1.7,
  balloons: 2.6,
  hearts: 1.6,
  rainbow: 2.4,
}

/** Bursts playing at once at most (the oldest gives way). */
const BURSTS = 12
const bursts: Burst[] = Array.from({ length: BURSTS }, () => ({ kind: 'beam', x: 0, y: 0, age: 0, life: 0, seed: 0, team: 0, on: false }))

/** The particles a burst throws as it starts. */
const BURST_PARTICLES: Record<BurstKind, (x: number, y: number) => void> = {
  beam: (x, y) => {
    for (let i = 0; i < 10; i++) emit('glint', x + (Math.random() - 0.5) * 16, y - Math.random() * 6, 0, -40 - Math.random() * 50, 0.8)
  },
  leaves: (x, y) => {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU
      emit('leaf', x + Math.cos(a) * 6, y + Math.sin(a) * 3, Math.cos(a + 1.2) * 70, Math.sin(a + 1.2) * 40 - 20, 1)
    }
  },
  splash: (x, y) => {
    for (let i = 0; i < 18; i++) {
      const a = Math.PI + (i / 17) * Math.PI
      emit('drop', x, y - 2, Math.cos(a) * (40 + Math.random() * 40), Math.sin(a) * (60 + Math.random() * 60), 0.7)
    }
  },
  thunder: (x, y) => ringOut('spark', 14, x, y, 60, 0.5, 20),
  pokeball: (x, y) => {
    ringOut('star', 10, x, y - 10, 70, 0.9, 10)
    ringOut('glint', 12, x, y - 10, 50, 0.8, 20)
  },
  stars: () => {},
  puff: (x, y) => ringOut('smoke', 9, x, y - 6, 30, 0.8),
  ghost: (x, y) => ringOut('smoke', 5, x, y - 4, 22, 0.6),
  lightning: (x, y) => ringOut('spark', 16, x, y - 8, 80, 0.5),
  supernova: (x, y) => {
    ringOut('glint', 24, x, y - 10, 120, 0.9)
    ringOut('star', 8, x, y - 10, 60, 1.1)
  },
  confetti: (x, y) => {
    for (let i = 0; i < 40; i++) emit('confetti', x + (Math.random() - 0.5) * 20, y - 6, (Math.random() - 0.5) * 140, -90 - Math.random() * 90, 1.6 + Math.random() * 0.5)
  },
  coins: (x, y) => {
    for (let i = 0; i < 16; i++) emit('coin', x + (Math.random() - 0.5) * 12, y - 6, (Math.random() - 0.5) * 110, -120 - Math.random() * 80, 1.2 + Math.random() * 0.4)
    ringOut('glint', 10, x, y - 8, 50, 0.7, 20)
  },
  balloons: (x, y) => {
    for (let i = 0; i < 7; i++) emit('balloon', x + (i - 3) * 7 + (Math.random() - 0.5) * 4, y - 4 - Math.random() * 6, (Math.random() - 0.5) * 10, -20 - Math.random() * 20, 2.4 + Math.random() * 0.4, -1, 1, i / 7)
  },
  hearts: (x, y) => {
    ringOut('heart', 14, x, y - 10, 70, 1.2, 20)
    for (let i = 0; i < 6; i++) emit('heart', x + (Math.random() - 0.5) * 24, y - Math.random() * 8, 0, -30 - Math.random() * 20, 1.5)
  },
  rainbow: (x, y) => {
    ringOut('star', 10, x, y - 20, 50, 1.6, 10)
    for (let i = 0; i < 16; i++) emit('glint', x - 30 + i * 4, y - 6, rnd(10), -30 - Math.random() * 30, 1.4)
  },
}

const startBurst = (kind: BurstKind, x: number, y: number, team: number) => {
  let slot = bursts.find((b) => !b.on)
  if (!slot) slot = bursts.reduce((a, b) => (b.age / b.life > a.age / a.life ? b : a))
  Object.assign(slot, { kind, x, y, age: 0, life: BURST_LIFE[kind], seed: Math.floor(Math.random() * 1000), team, on: true })
  BURST_PARTICLES[kind](x, y)
}

/** A bolt from far above down to (x, y), jagged by `seed`, re-rolled a few times a second so it crackles. */
const bolt = (ctx: Ctx, x: number, y: number, height: number, seed: number, t: number, edge: string, core: string) => {
  const steps = Math.max(3, Math.round(height / 9))
  let px = x + (hash2(seed, 0, Math.floor(t * 18)) - 0.5) * 18
  let py = y - height
  for (let i = 1; i <= steps; i++) {
    const k = i / steps
    const qx = i === steps ? x : x + (hash2(seed, i, Math.floor(t * 18)) - 0.5) * 18 * (1 - k * 0.5)
    const qy = y - height * (1 - k)
    const n = Math.max(1, Math.round(Math.max(Math.abs(qx - px), Math.abs(qy - py))))
    for (let s = 0; s < n; s++) {
      const bx = Math.round(px + ((qx - px) * s) / n)
      const by = Math.round(py + ((qy - py) * s) / n)
      ctx.fillStyle = edge
      ctx.fillRect(bx - 1, by, 3, 1)
      ctx.fillStyle = core
      ctx.fillRect(bx, by, 1, 1)
    }
    px = qx
    py = qy
  }
}

/** The part of a burst on the floor, under the Pokémon: rings and marks. */
const drawBurstGround = (ctx: Ctx, b: Burst) => {
  const k = b.age / b.life
  const x = Math.round(b.x)
  const y = Math.round(b.y)
  ctx.globalAlpha = 1 - k
  switch (b.kind) {
    case 'beam':
      blitRing(ctx, 6 + k * 14, 1, '#fff8c0', x, y)
      break
    case 'leaves':
      blitRing(ctx, 8 + k * 16, 1, '#88d850', x, y)
      break
    case 'splash':
      blitRing(ctx, 6 + k * 20, 1, '#a8d8f8', x, y)
      if (k > 0.25) blitRing(ctx, (k - 0.25) * 20, 1, '#6890f0', x, y)
      break
    case 'thunder':
    case 'lightning':
      ctx.globalAlpha = Math.max(0, 0.7 - k)
      blitRing(ctx, 5 + k * 6, 2, '#403018', x, y)
      break
    case 'pokeball':
      blitRing(ctx, 8 + k * 22, 2, '#e83030', x, y)
      blitRing(ctx, 4 + k * 18, 1, '#ffffff', x, y)
      break
    case 'supernova':
      blitRing(ctx, 6 + k * 34, 2, '#f8d030', x, y)
      blitRing(ctx, k * 26, 1, '#f070c0', x, y)
      break
    case 'rainbow':
    case 'confetti':
    case 'coins':
    case 'hearts':
      blitRing(ctx, 10 + k * 16, 1, TEAM_COLORS[b.team] ?? '#ffffff', x, y)
      break
    default:
      break
  }
  ctx.globalAlpha = 1
}

/** The part of a burst in the air, over the Pokémon. */
const drawBurstAir = (ctx: Ctx, b: Burst, t: number) => {
  const k = b.age / b.life
  const x = Math.round(b.x)
  const y = Math.round(b.y)
  switch (b.kind) {
    case 'beam': {
      // A pillar of light, narrowing as it fades.
      const w = Math.max(1, Math.round(10 * (1 - k)))
      ctx.globalAlpha = 0.75 * (1 - k)
      ctx.fillStyle = '#fff8c0'
      ctx.fillRect(x - w, y - 90, w * 2, 90)
      ctx.globalAlpha = 1 - k
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x - Math.max(1, w >> 1), y - 90, Math.max(1, w >> 1) * 2, 90)
      break
    }
    case 'thunder':
    case 'lightning':
      if (k < 0.35) {
        ctx.globalAlpha = 1
        bolt(ctx, x, y - (b.kind === 'lightning' ? 8 : 0), 110, b.seed, t, '#f8d030', '#ffffff')
      } else if (k < 0.5) {
        ctx.globalAlpha = 0.5
        bolt(ctx, x, y, 110, b.seed, t, '#f8b830', '#fff8c0')
      }
      break
    case 'pokeball': {
      // Drops in, bounces, then pops open.
      const ball = ART.ball()
      const fall = Math.min(1, k / 0.3)
      const drop = Math.round((1 - fall * fall) * 50)
      const bounce = k > 0.3 && k < 0.45 ? Math.round(Math.sin(((k - 0.3) / 0.15) * Math.PI) * 4) : 0
      const open = k > 0.5 ? Math.min(1, (k - 0.5) / 0.15) : 0
      ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1
      blitCentered(ctx, ball.bottom, x, y - 7 - drop - bounce)
      blitCentered(ctx, ball.top, x - Math.round(open * 3), y - 7 - drop - bounce - Math.round(open * 6))
      if (open > 0 && open < 1) {
        ctx.globalAlpha = 1 - open
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(x - 10, y - 14, 20, 8)
      }
      break
    }
    case 'stars': {
      // Dizzy stars circling over the fallen Pokémon.
      const stars = ART.stars()
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1
      for (let i = 0; i < 5; i++) {
        const a = t * 6 + (i / 5) * TAU
        blitCentered(ctx, stars[i % stars.length]!, x + Math.round(Math.cos(a) * 11), y - 24 + Math.round(Math.sin(a) * 4))
      }
      break
    }
    case 'ghost': {
      ctx.globalAlpha = (k > 0.6 ? (1 - k) / 0.4 : 1) * 0.9
      blitCentered(ctx, ART.ghost(), x + Math.round(Math.sin(k * 10) * 4), y - 14 - Math.round(k * 30))
      break
    }
    case 'supernova':
      if (k < 0.25) {
        ctx.globalAlpha = 1 - k / 0.25
        ctx.fillStyle = '#ffffff'
        const r = Math.round(4 + k * 40)
        ctx.fillRect(x - r, y - 10 - 2, r * 2, 4)
        ctx.fillRect(x - 2, y - 10 - r, 4, r * 2)
      }
      break
    case 'rainbow': {
      const arch = ART.rainbow()
      const grow = Math.min(1, k / 0.35)
      const w = Math.max(1, Math.round(arch.width * grow))
      ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 0.9
      ctx.drawImage(arch, 0, 0, w, arch.height, x - (arch.width >> 1), y - 34, w, arch.height)
      break
    }
    default:
      break
  }
  ctx.globalAlpha = 1
}

/* ---------------- Trails and flourishes ---------------- */

/**
 * Seconds between two of a trail's particles while its Pokémon walks (twice
 * that drawing lean), and how they leave; `gap`: px walked between two
 * instead (a ribbon that must stay whole at any speed).
 */
const TRAILS: Record<TrailKind, { every: number; gap?: number; emit: (x: number, y: number, owner: number, n: number) => void }> = {
  spark: {
    every: 0.03,
    emit: (x, y, o) => {
      emit('spark', x + rnd(10), y - 1 - Math.random() * 8, rnd(16), -8, 0.55, o, 0)
      emit('spark', x + rnd(6), y - Math.random() * 3, rnd(10), -4, 0.35, o, 0)
    },
  },
  petal: { every: 0.055, emit: (x, y, o) => emit('petal', x + rnd(12), y - 4 - Math.random() * 10, rnd(14), -10, 1.1, o, 0) },
  bubble: { every: 0.06, emit: (x, y, o) => emit('bubble', x + rnd(12), y - 2 - Math.random() * 6, rnd(8), -12, 1, o, 0) },
  ember: {
    every: 0.035,
    emit: (x, y, o) => {
      emit('ember', x + rnd(10), y - 1 - Math.random() * 4, rnd(10), -14, 0.75, o, 0)
      emit('spark', x + rnd(6), y - Math.random() * 2, rnd(8), -6, 0.3, o, 0)
    },
  },
  snow: { every: 0.055, emit: (x, y, o) => emit('snow', x + rnd(14), y - 8 - Math.random() * 12, rnd(8), 0, 1.2, o, 0) },
  heart: { every: 0.085, emit: (x, y, o) => emit('heart', x + rnd(12), y - 2 - Math.random() * 8, rnd(8), -12, 1.1, o, 0) },
  star: {
    every: 0.045,
    emit: (x, y, o, n) => (n % 3 === 0 ? emit('star', x + rnd(14), y - 2 - Math.random() * 12, 0, -5, 1, o, 0) : emit('glint', x + rnd(12), y - 1 - Math.random() * 8, 0, -8, 0.6, o, 0, 0.6 + Math.random() * 0.25)),
  },
  rainbow: { every: 0.02, gap: 2, emit: (x, y, o) => emit('rainbow', x, y - 2, 0, 0, 0.6, o, 0) },
}

const rnd = (spread: number) => (Math.random() - 0.5) * spread

/** What an emote's flourish throws while it plays, `every` seconds (none: `aura` is drawn, not thrown). */
const FLOURISHES: Record<Flourish, { every: number; emit: (x: number, head: number, owner: number, n: number) => void }> = {
  confetti: { every: 0.06, emit: (x, head, o) => emit('confetti', x + rnd(30), head - 10, rnd(30), 10, 1, o) },
  sparkles: {
    every: 0.07,
    emit: (x, head, o, n) => {
      const a = n * 0.9
      emit('glint', x + Math.cos(a) * 14, head + 8 + Math.sin(a) * 6, 0, -14, 0.6, o)
    },
  },
  zz: { every: 0.55, emit: (x, head, o) => emit('zee', x + 6, head, 8, -10, 1.4, o) },
  aura: { every: 0.05, emit: (x, head, o) => emit('spark', x + rnd(18), head + 14 + Math.random() * 10, 0, -50, 0.4, o) },
  notes: { every: 0.24, emit: (x, head, o) => emit('note', x + rnd(20), head, rnd(14), -18, 1.3, o) },
  fireworks: {
    every: 0.45,
    emit: (x, head, o) => {
      const fx = x + rnd(40)
      const fy = head - 16 - Math.random() * 14
      const seed = Math.random()
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU
        emit('glint', fx, fy, Math.cos(a) * 64, Math.sin(a) * 64, 0.8, o, 1, seed)
      }
      emit('star', fx, fy, 0, 0, 0.5, o, 1, seed)
    },
  },
}

/* ---------------- Emote sheets ---------------- */

type EmoteMeta = { frameWidth: number; frameHeight: number; durations: number[] }
const EMOTES = emoteManifest as Record<string, Partial<Record<EmoteAnim, EmoteMeta>>>

/** The first of an emote's animations a species has, or null (it plays the flourish alone). */
export const emoteAnimOf = (dex: number, anims: readonly EmoteAnim[]): EmoteAnim | null => {
  const has = EMOTES[String(dex)]
  return anims.find((a) => has?.[a] !== undefined) ?? null
}

const emoteUrl = (dex: number, anim: EmoteAnim) => `${import.meta.env.BASE_URL}assets/pokemon/${dex}/emote/${anim}.png`

/** Emote sheets by `dex:anim`: loaded, on their way (null) or failed (false). Freed when the match ends. */
const sheets = new Map<string, Sheet | null | false>()

/** Bumped by every `resetArenaFx`: a load asked before it lands into nothing (its sheet is freed), however soon the same sheet is asked again. */
let sheetsGen = 0

/** The emote sheet of `dex`, loading it the first time it's asked for; null until it lands. */
const emoteSheet = (dex: number, anim: EmoteAnim): Sheet | null => {
  const key = `${dex}:${anim}`
  const got = sheets.get(key)
  if (got !== undefined) return got || null
  const meta = EMOTES[String(dex)]?.[anim]
  if (!meta) {
    sheets.set(key, false)
    return null
  }
  sheets.set(key, null)
  const gen = sheetsGen
  loadSheet(emoteUrl(dex, anim), meta).then(
    (sheet) => (gen === sheetsGen && sheets.get(key) === null ? sheets.set(key, sheet) : freeSheet(sheet)),
    () => gen === sheetsGen && sheets.set(key, false),
  )
  return null
}

/* ---------------- The game's state ---------------- */

type FollowerSeat = { id: string; view: CompanionView; float: boolean; legendary: boolean; slot: number }

/** A follower to sort among the drawables (`render/draw.ts`), by its feet. */
export type FollowerDrawable = { follower: FollowerSeat }

/**
 * The game the effects belong to (`matchOf`: the shell's key for it, else
 * its state object), and what they hold for it.
 */
let match: string | VersusState | Game | null = null

/**
 * What names `g`'s game: the shell's room and run (`setLooksGame`), which a
 * snapshot heal or a rejoin keeps; else the match's state, or the run's (a
 * new game is a new one).
 */
const matchOf = (g: Game): string | VersusState | Game => looksGameKey() ?? g.versus ?? g

/** The seat whose own companion walks with it (`render/companion.ts`), so its follower stays home, or -1. */
let home = -1
let last = -1
const followers: (FollowerDrawable | null)[] = []
const trailIn: number[] = []
/** Where a ribbon trail last dropped a particle, by seat (`on`: while walking). */
const trailAt: { x: number; y: number; on: boolean }[] = []
const trailN: number[] = []
const flourishIn: number[] = []
/** Each seat's emote cut short by moving (its `at`). */
const cut: number[] = []

/** Lets go of a game's effects: its particles, bursts, followers and emote sheets. */
export const resetArenaFx = () => {
  match = null
  last = -1
  count = 0
  for (const b of bursts) b.on = false
  followers.length = trailIn.length = trailAt.length = trailN.length = flourishIn.length = cut.length = readied.length = 0
  for (const sheet of sheets.values()) if (sheet) freeSheet(sheet)
  sheets.clear()
  sheetsGen++
}

const headOf = (p: Player) => p.y - bodyOf(formAt(p.starter, p.branch, p.stage).dex).bodyH

/** The emote `p` plays now (the latest the match kept, not cut short), with its entry; null when none. */
const playing = (g: Game, p: Player) => {
  const s = g.versus
  if (!s) return null
  for (let i = s.emotes.length - 1; i >= 0; i--) {
    const e = s.emotes[i]!
    if (e.slot !== p.slot) continue
    if (g.now - e.at >= VERSUS.emote.keep || cut[p.slot] === e.at) return null
    const def = effectIn('emote', shownLook(g, p.slot).emote)
    return def ? { at: e.at, def } : null
  }
  return null
}

/**
 * What `p`'s sprite plays now in a match: their emote's sheet (facing the
 * camera), its clock and whether it loops, or null to draw them as usual. Read by `drawPlayer`;
 * a sheet still loading draws the usual sprite under the flourish.
 */
export const arenaEmote = (g: Game, p: Player): { sheet: Sheet; seconds: number; loop: boolean } | null => {
  const e = p.versus ? playing(g, p) : null
  return e ? emoteFrame(formAt(p.starter, p.branch, p.stage).dex, e.def, g.now - e.at) : null
}

/** What `dex` plays `seconds` into emote `def`: the sheet (loading it the first time), its clock and whether it loops; null while it loads. */
const emoteFrame = (dex: number, def: EffectOf<'emote'>, seconds: number): { sheet: Sheet; seconds: number; loop: boolean } | null => {
  if (!def.sequence) {
    const anim = emoteAnimOf(dex, def.anims)
    const sheet = anim && emoteSheet(dex, anim)
    return sheet ? { sheet, seconds, loop: def.once !== true } : null
  }
  // A sequence: each animation the species has, a loop each, round and round.
  const loops: Sheet[] = []
  for (const anim of def.anims) {
    if (emoteAnimOf(dex, [anim]) === null) continue
    const sheet = emoteSheet(dex, anim)
    if (!sheet) return null
    loops.push(sheet)
  }
  const total = loops.reduce((sum, sheet) => sum + sheet.totalTicks / 60, 0)
  let left = total > 0 ? seconds % total : 0
  for (const sheet of loops) {
    const length = sheet.totalTicks / 60
    if (left < length) return { sheet, seconds: left, loop: true }
    left -= length
  }
  return null
}

/** Whether `p` and what's theirs show on this screen: in the match, standing, and not hidden from `viewer` in the grass. */
const shows = (viewer: Player, p: Player | undefined): p is Player => !!p && !p.gone && p.hp > 0 && !concealed(viewer, p)

/**
 * Keeps `p`'s follower the one their look names (a look can change mid-game:
 * the dev console's `ps.look`), none while their own companion walks with them.
 */
const syncFollower = (g: Game, p: Player) => {
  const id = p.slot === home ? undefined : shownLook(g, p.slot).follower
  if (followers[p.slot]?.follower.id === id) return
  const def = effectIn('follower', id)
  followers[p.slot] = def && id ? { follower: { id, view: createCompanion(def.dex, false, p), float: def.float === true, legendary: def.rarity === 'legendary', slot: p.slot } } : null
}

/** Each seat's form and emote whose sheets were asked for ahead. */
const readied: { dex: number; id: string | undefined }[] = []

/** Loads `p`'s emote sheets ahead of its first play, again when the emote or the form changes. */
const readyEmote = (g: Game, p: Player) => {
  const id = shownLook(g, p.slot).emote
  const dex = formAt(p.starter, p.branch, p.stage).dex
  const had = readied[p.slot]
  if (had && had.dex === dex && had.id === id) return
  readied[p.slot] = { dex, id }
  const emote = effectIn('emote', id)
  for (const anim of emote ? (emote.sequence ? emote.anims : [emoteAnimOf(dex, emote.anims)]) : []) if (anim && emoteAnimOf(dex, [anim])) emoteSheet(dex, anim)
}

/** Takes up a new game: its followers and the opening spawn effects. */
const begin = (g: Game) => {
  resetArenaFx()
  match = matchOf(g)
  for (const p of g.players) {
    syncFollower(g, p)
    readyEmote(g, p)
    spawnFx(g, p)
  }
}

const spawnFx = (g: Game, p: Player) => {
  const def = effectIn('spawn', shownLook(g, p.slot).spawn)
  if (def) startBurst(def.burst, p.x, p.y, p.versus?.team ?? 0)
}

/** The goal nearest (x, y): where a score's effect plays. */
const goalNear = (s: VersusState, x: number, y: number) => {
  let best = s.goals[0]
  let d = Infinity
  for (const goal of s.goals) {
    const dd = (goal.x - x) ** 2 + (goal.y - y) ** 2
    if (dd < d) {
      d = dd
      best = goal
    }
  }
  return best
}

/** Hears a match's event (`main.ts`, with the match's sounds): the spawn, KO and goal effects of the seat it belongs to. */
export const arenaFxEvent = (g: Game, e: GameEvent) => {
  const s = g.versus
  if (!s) return
  if (match !== matchOf(g)) begin(g)
  switch (e.kind) {
    case 'versusBack': {
      const p = g.players[e.slot]
      if (p) spawnFx(g, p)
      return
    }
    case 'versusKo': {
      const victim = g.players[e.slot]
      const def = e.by >= 0 ? effectIn('ko', shownLook(g, e.by).ko) : null
      if (victim && def) startBurst(def.burst, victim.x, victim.y, g.players[e.by]?.versus?.team ?? 0)
      return
    }
    case 'versusScore': {
      const p = g.players[e.slot]
      const def = effectIn('goal', shownLook(g, e.slot).goal)
      const goal = p && goalNear(s, p.x, p.y)
      if (def && goal) startBurst(def.burst, goal.x, goal.y, e.team)
      return
    }
    default:
      return
  }
}

/** Whether a lean frame leaves `p`'s follower and trail out: a run's teammates, not this screen's own player. */
const spared = (g: Game, viewer: Player, p: Player | undefined) => detail.lean && !g.versus && p !== viewer

/**
 * One drawn frame of a game's effects, on the drawing clock `t` (seconds):
 * the followers walk, trails and flourishes throw their particles, particles
 * and bursts age. Called by `render` before it draws, with the seat whose own
 * companion walks along (`walking`, -1 none: its follower stays home); a new
 * game lets go of the last one's.
 */
export const stepArenaFx = (g: Game, t: number, walking = -1) => {
  if (match !== matchOf(g)) begin(g)
  home = walking
  const dt = last < 0 ? 0 : Math.max(0, Math.min(0.1, t - last))
  last = t
  if (dt === 0) return
  const lean = detail.lean ? 2 : 1
  const viewer = localPlayer(g)
  for (const p of g.players) {
    const slot = p.slot
    const look = shownLook(g, slot)
    syncFollower(g, p)
    readyEmote(g, p)
    const f = followers[slot]
    if (f) stepCompanion(f.follower.view, p, dt)
    const visible = shows(viewer, p) && !spared(g, viewer, p)
    // An emote stops the moment its Pokémon moves or is hit.
    const e = playing(g, p)
    if (e && (p.moving || p.hurt > 0)) cut[slot] = e.at
    if (!visible) continue
    const trail = effectIn('trail', look.trail)
    const rule = trail && TRAILS[trail.trail]
    if (rule?.gap && p.moving) {
      // A ribbon: a particle every `gap` px walked since the last one, at most a few a frame.
      const from = (trailAt[slot] ??= { x: p.x, y: p.y, on: false })
      if (!from.on) Object.assign(from, { x: p.x, y: p.y, on: true })
      const d = Math.hypot(p.x - from.x, p.y - from.y)
      const n = Math.min(8, Math.floor(d / (rule.gap * lean)))
      for (let i = 1; i <= n; i++) rule.emit(from.x + ((p.x - from.x) * i) / n, from.y + ((p.y - from.y) * i) / n, slot, i)
      if (n > 0 || d > 40) {
        from.x = p.x
        from.y = p.y
      }
    } else if (rule && p.moving) {
      if ((trailIn[slot] = (trailIn[slot] ?? 0) - dt) <= 0) {
        trailIn[slot] = rule.every * lean
        trailN[slot] = (trailN[slot] ?? 0) + 1
        rule.emit(p.x, p.y, slot, trailN[slot]!)
      }
    } else if (trailAt[slot]) trailAt[slot].on = false
    // A legendary follower leaves sparkles of its own.
    if (f?.follower.legendary && f.follower.view.moving && Math.random() < dt * 14) emit('glint', f.follower.view.x + rnd(10), f.follower.view.y - 14 - Math.random() * 8, 0, -10, 0.6, slot, 0, 0.66 + Math.random() * 0.3)
    const now = e && cut[slot] !== e.at ? e : null
    if (now) {
      const rule = FLOURISHES[now.def.flourish]
      if ((flourishIn[slot] = (flourishIn[slot] ?? 0) - dt) <= 0) {
        flourishIn[slot] = rule.every * lean
        trailN[slot] = (trailN[slot] ?? 0) + 1
        rule.emit(p.x, headOf(p), slot, trailN[slot]!)
      }
    }
  }
  stepParticles(dt)
  for (const b of bursts) if (b.on && (b.age += dt) >= b.life) b.on = false
}

/** The followers of the seats this screen sees, for the depth pass. */
export const arenaFollowers = (g: Game, out: { push: (d: FollowerDrawable) => unknown }) => {
  if (match !== matchOf(g)) return
  const viewer = localPlayer(g)
  for (const f of followers) {
    if (!f) continue
    const owner = g.players[f.follower.slot]
    if (shows(viewer, owner) && !spared(g, viewer, owner)) out.push(f)
  }
}

export const isFollower = (d: unknown): d is FollowerDrawable => typeof d === 'object' && d !== null && 'follower' in d

/** A follower at its feet (a floating one bobbing over its shadow, which the depth pass draws), faint like its trainer in the grass. */
export const drawFollower = (ctx: Ctx, g: Game, d: FollowerDrawable, t: number) => {
  const { view, float, slot } = d.follower
  const owner = g.players[slot]
  const lift = float ? 9 + Math.round(Math.sin(t * 3 + slot) * 2) : 0
  drawCompanion(ctx, view, t, lift, owner ? grassAlpha(g, localPlayer(g), owner) : 1)
}

/** Whether this screen draws particle `i` now: its owner standing and not hidden from it. */
const particleShows = (g: Game, viewer: Player, i: number, visible: (x: number, y: number, m?: number) => boolean) => {
  const owner = P.owner[i]!
  return visible(P.x[i]!, P.y[i]!, 8) && (owner < 0 || shows(viewer, g.players[owner]))
}

/** Under the Pokémon: the trails' particles, the bursts' rings and an emote's aura. */
export const drawArenaFxGround = (ctx: Ctx, g: Game, t: number, visible: (x: number, y: number, m?: number) => boolean) => {
  if (match !== matchOf(g)) return
  const viewer = localPlayer(g)
  for (const b of bursts) if (b.on && visible(b.x, b.y, 60)) drawBurstGround(ctx, b)
  for (const p of g.players) {
    if (!shows(viewer, p)) continue
    const e = playing(g, p)
    if (e?.def.flourish !== 'aura') continue
    const k = ((g.now - e.at) * 2) % 1
    ctx.globalAlpha = 1 - k
    blitRing(ctx, 8 + k * 12, 1, '#f8d030', p.x, p.y)
    ctx.globalAlpha = 1
  }
  for (let i = 0; i < count; i++) if (P.air[i] === 0 && particleShows(g, viewer, i, visible)) drawParticle(ctx, i, t)
  ctx.globalAlpha = 1
}

/** Over the Pokémon: the bursts and the flourishes. */
export const drawArenaFxAir = (ctx: Ctx, g: Game, t: number, visible: (x: number, y: number, m?: number) => boolean) => {
  if (match !== matchOf(g)) return
  const viewer = localPlayer(g)
  for (const b of bursts) if (b.on && visible(b.x, b.y, 120)) drawBurstAir(ctx, b, t)
  for (let i = 0; i < count; i++) if (P.air[i] === 1 && particleShows(g, viewer, i, visible)) drawParticle(ctx, i, t)
  ctx.globalAlpha = 1
}

/** Plays a burst at (x, y) now, for the dev console's staging (`ps.look`). */
export const playBurst = (kind: BurstKind, x: number, y: number, team: number) => startBurst(kind, x, y, team)

/** The emote equipped in `slot`'s look, for the shell's button (null: none). */
export const equippedEmote = (slot: number): EffectOf<'emote'> | null => effectIn('emote', lookOf(slot).emote)

/** How many particles are alive now, for the dev console. */
export const arenaFxStats = () => ({ particles: count, bursts: bursts.filter((b) => b.on).length, followers: followers.filter(Boolean).length, sheets: sheets.size })

/** The art circling a victory pose, by its emote's flourish. */
const POSE_ART: Record<Flourish, () => readonly HTMLCanvasElement[]> = {
  confetti: () => ART.stars(),
  sparkles: () => ART.stars(),
  zz: () => [ART.zee()],
  aura: () => ART.stars(),
  notes: () => ART.notes(),
  fireworks: () => [...ART.stars(), ...ART.hearts()],
}

/**
 * The end screen's victory pose (`ui/versusEnd.ts`): `p`'s Pokémon playing
 * their equipped emote, facing the camera in a canvas of its own (CSS scales
 * it up), its flourish's art circling it. It loads its own sheet, since the
 * match's may be let go first, and frees it with `dispose`. Null without an
 * emote equipped.
 */
export const victoryPose = (p: Player): { el: HTMLCanvasElement; dispose: () => void } | null => {
  const def = effectIn('emote', lookOf(p.slot).emote)
  if (!def) return null
  const dex = formAt(p.starter, p.branch, p.stage).dex
  const anim = emoteAnimOf(dex, def.anims)
  const meta = anim && EMOTES[String(dex)]?.[anim]
  const canvas = createCanvas(80, 72)
  canvas.className = 'vs-victory-pose'
  const ctx = context2d(canvas)
  let sheet: Sheet | null = null
  let gone = false
  if (anim && meta) void loadSheet(emoteUrl(dex, anim), meta).then((got) => (gone ? freeSheet(got) : (sheet = got)), () => {})
  const art = POSE_ART[def.flourish]()
  const start = performance.now()
  let frame = 0
  const draw = () => {
    const t = (performance.now() - start) / 1000
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // The flourish's art circles it: the far half behind the Pokémon, the near half in front.
    const around = (front: boolean) => {
      for (let i = 0; i < 6; i++) {
        const a = t * 1.6 + (i / 6) * TAU
        if (Math.sin(a) > 0 !== front) continue
        blitCentered(ctx, art[i % art.length]!, 40 + Math.round(Math.cos(a) * 30), 40 + Math.round(Math.sin(a) * 9))
      }
    }
    around(false)
    // A pose (`once`) strikes again every couple of seconds.
    drawPokemon(ctx, sprites(dex), 'Idle', 0, def.once ? t % 2 : t, 40, 62, sheet ? { sheet, loop: !def.once } : {})
    around(true)
    frame = requestAnimationFrame(draw)
  }
  draw()
  return {
    el: canvas,
    dispose: () => {
      gone = true
      cancelAnimationFrame(frame)
      if (sheet) freeSheet(sheet)
    },
  }
}

/* ---------------- The shop's stage ---------------- */

/** The preview that owns the particle pool outside a match (the last to step). */
let previewing: object | null = null

/**
 * The gem shop's stage (`ui/gemShop.ts`): a look's effects around a Pokémon
 * on a canvas of its own, out of any match. Its follower trots after it, its
 * trail drops behind it while it walks, its emote plays (the sheet facing the
 * camera, and the flourish) and a spawn, KO or goal effect plays on demand.
 * It borrows the match's particle pool, so it steps nothing while a match
 * holds it; the last preview to step owns it, and `dispose` lets go.
 */
export const createFxPreview = () => {
  const me = {}
  let follower: { id: string; view: CompanionView; float: boolean; legendary: boolean } | null = null
  let last = -1
  let trailIn = 0
  let flourishIn = 0
  let n = 0
  const ribbon = { x: 0, y: 0, on: false }
  const own = () => {
    if (match) return false
    if (previewing !== me) {
      previewing = me
      count = 0
      for (const b of bursts) b.on = false
      follower = null
      last = -1
    }
    return true
  }
  return {
    /**
     * Steps to the clock `t` (seconds): `dex` stands at (x, y) wearing
     * `look`, walking or not, `emoting` (its flourish throws) or not.
     */
    step: (look: Look, dex: number, x: number, y: number, moving: boolean, emoting: boolean, t: number) => {
      if (!own()) return
      const dt = last < 0 ? 0 : Math.max(0, Math.min(0.1, t - last))
      last = t
      const def = effectIn('follower', look.follower)
      if (follower?.id !== look.follower) follower = def && look.follower ? { id: look.follower, view: createCompanion(def.dex, false, { x, y }), float: def.float === true, legendary: def.rarity === 'legendary' } : null
      if (dt === 0) return
      if (follower) stepCompanion(follower.view, { x, y }, dt)
      const trail = effectIn('trail', look.trail)
      const rule = trail && TRAILS[trail.trail]
      if (rule?.gap && moving) {
        if (!ribbon.on) Object.assign(ribbon, { x, y, on: true })
        const d = Math.hypot(x - ribbon.x, y - ribbon.y)
        const k = Math.min(8, Math.floor(d / rule.gap))
        for (let i = 1; i <= k; i++) rule.emit(ribbon.x + ((x - ribbon.x) * i) / k, ribbon.y + ((y - ribbon.y) * i) / k, 0, i)
        if (k > 0) Object.assign(ribbon, { x, y })
      } else if (rule && moving && (trailIn -= dt) <= 0) {
        trailIn = rule.every
        rule.emit(x, y, 0, ++n)
      } else if (!moving) ribbon.on = false
      if (follower?.legendary && follower.view.moving && Math.random() < dt * 14) emit('glint', follower.view.x + rnd(10), follower.view.y - 14 - Math.random() * 8, 0, -10, 0.6, 0, 0, 0.66 + Math.random() * 0.3)
      const emote = emoting ? effectIn('emote', look.emote) : null
      if (emote && (flourishIn -= dt) <= 0) {
        flourishIn = FLOURISHES[emote.flourish].every
        FLOURISHES[emote.flourish].emit(x, y - bodyOf(dex).bodyH, 0, ++n)
      }
      stepParticles(dt)
      for (const b of bursts) if (b.on && (b.age += dt) >= b.life) b.on = false
    },
    /** Plays spawn, KO or goal effect `id` at (x, y), in the blue team's colors. */
    burst: (id: string | undefined, x: number, y: number) => {
      const def = effectIn('spawn', id) ?? effectIn('ko', id) ?? effectIn('goal', id)
      if (def && own()) startBurst(def.burst, x, y, 0)
    },
    /** What `dex` plays `seconds` into `look`'s emote (null: none, or its sheet still loading). */
    emote: (look: Look, dex: number, seconds: number) => {
      const def = effectIn('emote', look.emote)
      return def ? emoteFrame(dex, def, def.once ? seconds % 2 : seconds) : null
    },
    /** The follower, at its feet: drawn before the Pokémon when it's behind (north of) `y`, after it otherwise. */
    drawFollower: (ctx: Ctx, t: number, y: number, front: boolean) => {
      const f = follower
      if (!f || previewing !== me || f.view.y > y !== front) return
      drawCompanion(ctx, f.view, t, f.float ? 9 + Math.round(Math.sin(t * 3) * 2) : 0)
    },
    /** Under the Pokémon: the trail, the bursts' rings and an emote's aura (`emoting` since `at`). */
    drawGround: (ctx: Ctx, look: Look, x: number, y: number, emoting: number | null) => {
      if (previewing !== me) return
      for (const b of bursts) if (b.on) drawBurstGround(ctx, b)
      if (emoting !== null && effectIn('emote', look.emote)?.flourish === 'aura') {
        const k = (emoting * 2) % 1
        ctx.globalAlpha = 1 - k
        blitRing(ctx, 8 + k * 12, 1, '#f8d030', x, y)
      }
      for (let i = 0; i < count; i++) if (P.air[i] === 0) drawParticle(ctx, i, last)
      ctx.globalAlpha = 1
    },
    /** Over the Pokémon: the bursts and the flourishes. */
    drawAir: (ctx: Ctx, t: number) => {
      if (previewing !== me) return
      for (const b of bursts) if (b.on) drawBurstAir(ctx, b, t)
      for (let i = 0; i < count; i++) if (P.air[i] === 1) drawParticle(ctx, i, t)
      ctx.globalAlpha = 1
    },
    /** Lets go of the pool and the emote sheets (unless a match took them meanwhile). */
    dispose: () => {
      if (previewing !== me) return
      previewing = null
      if (!match) resetArenaFx()
    },
  }
}

export type FxPreview = ReturnType<typeof createFxPreview>

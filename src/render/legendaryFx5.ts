import { blitEllipse, blitRing, context2d, createCanvas, type PixelSprite } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { maskOf, OGERPON_MASKS, type OgerponMask } from '../data/mythicals'
import { CUDGEL, PLASMA, type LegendaryMove5Id } from '../game/legendaryMoves5'
import { ownerOf } from '../game/players'
import type { Attack, Game } from '../game/types'
import { medallion } from './legendaryArt'
import { fadeOut, px, thickLine } from './legendaryFx'

type Ctx = CanvasRenderingContext2D

/**
 * The fifth batch of legendary moves on screen (`game/legendaryMoves5.ts`)
 * and their icons: Diancie's whirl of diamonds, Zeraora's plasma fists and
 * their arcs, and Ogerpon's cudgel, its slam and its mask's bursts.
 */

type Px = (x: number, y: number, color: string, w?: number, h?: number) => void

const paint = (w: number, h: number, fn: (dot: Px) => void) => {
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  fn((x, y, color, pw = 1, ph = 1) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, pw, ph)
  })
  return canvas
}

/** Draws pixel rows (`.` empty, a key of `palette` a color) with their middle at (x, y), mirrored when `flip`. */
const rows = (ctx: Ctx, art: readonly string[], palette: Readonly<Record<string, string>>, x: number, y: number, flip = false) => {
  const w = art[0]!.length
  const ox = Math.round(x - w / 2)
  const oy = Math.round(y - art.length / 2)
  for (let r = 0; r < art.length; r++) {
    const line = art[r]!
    for (let c = 0; c < w; c++) {
      const color = palette[line[c]!]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(ox + (flip ? w - 1 - c : c), oy + r, 1, 1)
    }
  }
}

/* ---------------- Palettes and shapes ---------------- */

const PINK = { o: '#5a1238', d: '#a02c68', m: '#d85898', l: '#f090c0', p: '#f8c8e0', w: '#ffffff' } as const
/** The diamonds' three cuts: the colors of a shard's lit and shaded facets. */
const CUTS = [
  { l: PINK.p, m: PINK.l, d: PINK.m },
  { l: PINK.w, m: PINK.p, d: PINK.l },
  { l: PINK.l, m: PINK.m, d: PINK.d },
] as const

/** A diamond shard, point first: its crown lit, its pavilion shaded. */
const SHARD = ['..o..', '.olo.', 'ollmo', 'olmdo', '.omd.', '..o..'] as const

const BOLT = { o: '#383010', y: '#f8d838', l: '#fff8b0', w: '#ffffff', b: '#58b8f8' } as const

/** Zeraora's fist, knuckles to the right: claws of yellow fur, plasma light at the knuckles. */
const FIST = [
  '..oooo...',
  '.oyyyyo..',
  'oyllllyo.',
  'oylwwlyoo',
  'oyllllybo',
  'oyyyyyybo',
  '.oyyyyoo.',
  '..oooo...',
] as const

/** The cudgel, head up: Ogerpon's wooden club wound with ivy. */
const WOOD = { o: '#30200c', h: '#a87040', m: '#7c4c24', d: '#583418', g: '#58c058', G: '#286828' } as const

/* ---------------- Icons ---------------- */

export const LEGENDARY_ICONS_5: Record<LegendaryMove5Id, () => PixelSprite> = {
  diamondStorm: () =>
    medallion(paint(11, 11, (dot) => {
      // A pink diamond with a spark, and two small ones whirling round it.
      const big = ['..ooooo..', '.olplmmo.', 'ollppllmo', '.ollmmdo.', '..olmdo..', '...omo...', '....o....']
      big.forEach((line, y) => [...line].forEach((ch, x) => ch !== '.' && dot(x + 1, y + 2, ch === 'o' ? PINK.o : ch === 'p' ? PINK.p : ch === 'l' ? PINK.l : ch === 'm' ? PINK.m : PINK.d)))
      dot(3, 3, '#ffffff')
      dot(0, 1, PINK.p)
      dot(9, 0, PINK.l)
      dot(10, 1, '#ffffff')
    }), '#301028'),
  plasmaFists: () =>
    medallion(paint(11, 11, (dot) => {
      FIST.forEach((line, y) => [...line].forEach((ch, x) => ch !== '.' && dot(x + 1, y + 2, BOLT[ch as keyof typeof BOLT])))
      // A spark off the knuckles.
      dot(10, 1, '#ffffff')
      dot(9, 0, BOLT.y)
    }), '#1c2438'),
  ivyCudgel: () =>
    medallion(paint(11, 11, (dot) => {
      // The club on the diagonal, head up and right, ivy wound round it.
      for (let i = 0; i < 9; i++) {
        const x = 1 + i
        const y = 9 - i
        const head = i >= 5
        dot(x, y, head ? WOOD.h : WOOD.m)
        dot(x, y + 1, head ? WOOD.m : WOOD.d)
        if (head) dot(x + 1, y, WOOD.m)
        if (i % 3 === 1) dot(x, y, WOOD.g)
      }
      dot(8, 1, WOOD.G)
      dot(6, 4, WOOD.g)
    }), '#18301c'),
}

/* ---------------- Diamond Storm ---------------- */

/** A shard in flight, point first, a glint off it every few frames and a faint trail of glitter. */
const drawShard = (ctx: Ctx, a: Attack, t: number) => {
  const cut = CUTS[a.tier % 3]!
  const v = a.motion.kind === 'linear' ? a.motion : null
  const speed = v ? Math.hypot(v.vx, v.vy) || 1 : 1
  ctx.globalAlpha = fadeOut(a, 0.2)
  for (let i = 1; i <= 3; i++) {
    if (!v) break
    px(ctx, a.x - (v.vx / speed) * i * 4 + (i % 2), a.y - (v.vy / speed) * i * 4, i === 1 ? cut.l : PINK.l)
  }
  // Facing up or down by its flight, mirrored left or right.
  const down = v ? v.vy > 0 : false
  const art = down ? [...SHARD].reverse() : SHARD
  rows(ctx, art, { o: PINK.o, l: cut.l, m: cut.m, d: cut.d }, a.x, a.y, v ? v.vx < 0 : false)
  if (Math.floor(t * 12 + a.id) % 5 === 0) {
    px(ctx, a.x - 1, a.y - 4, '#ffffff')
    px(ctx, a.x - 2, a.y - 3, '#ffffff', 3, 1)
  }
  ctx.globalAlpha = 1
}

/** The whirl the diamonds spiral out of: small diamonds circling the player, faster and wider as it winds up, glitter falling off it. */
const drawDiamondHalo = (ctx: Ctx, g: Game, a: Attack, t: number) => {
  const p = ownerOf(g, a.owner)
  const k = Math.min(1, a.age / (a.ttl * 0.8))
  const r = a.memo * (0.4 + k * 0.6)
  const spins = a.flip ? [1, -1] : [1]
  ctx.globalAlpha = fadeOut(a, 0.15)
  for (const dir of spins) {
    for (let i = 0; i < 8; i++) {
      const q = dir * (t * (5 + k * 6)) + (i / 8) * TAU
      const x = p.x + Math.cos(q) * r * (dir < 0 ? 0.8 : 1)
      const y = p.y - 8 + Math.sin(q) * r * 0.55
      const cut = CUTS[i % 3]!
      px(ctx, x - 1, y, PINK.o, 3, 1)
      px(ctx, x, y - 1, cut.l, 1, 3)
      px(ctx, x, y, cut.m)
    }
  }
  for (let i = 0; i < 10; i++) {
    const fall = (t * 1.5 + hash2(i, a.id, 1)) % 1
    const x = p.x + (hash2(i, a.id, 2) - 0.5) * r * 2
    const y = p.y - 16 + fall * 20
    px(ctx, x, y, i % 3 === 0 ? '#ffffff' : PINK.p)
  }
  ctx.globalAlpha = 1
}

/* ---------------- Plasma Fists ---------------- */

/** A crackling bolt between two points: a zigzag of a few kinks, its jitter changing every frame. */
const zigzag = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, seed: number, color: string) => {
  const n = 4
  let px0 = x0
  let py0 = y0
  for (let i = 1; i <= n; i++) {
    const k = i / n
    const j = i === n ? 0 : (hash2(seed, i, 7) - 0.5) * 8
    const nx = x0 + (x1 - x0) * k - ((y1 - y0) / Math.hypot(x1 - x0, y1 - y0 || 1)) * j
    const ny = y0 + (y1 - y0) * k + ((x1 - x0) / Math.hypot(x1 - x0, y1 - y0 || 1)) * j
    thickLine(ctx, px0, py0, nx, ny, 1, color)
    px0 = nx
    py0 = ny
  }
}

/** A plasma fist landing: it streaks in along its way from the player, hits with a white flash and a ring, sparks crackling off it. */
const drawPlasmaFist = (ctx: Ctx, a: Attack, t: number) => {
  const k = Math.min(1, a.age / 0.06)
  const back = (1 - k) * 18
  const dx = Math.cos(a.memo)
  const dy = Math.sin(a.memo)
  const x = a.x - dx * back + (a.flip ? 3 : 0)
  const y = a.y - dy * back - (a.flip ? 2 : 0)
  ctx.globalAlpha = fadeOut(a, 0.12)
  // The streak behind it.
  for (let i = 1; i <= 3; i++) px(ctx, x - dx * i * 4, y - dy * i * 4, i === 1 ? BOLT.l : BOLT.y, 2, 2)
  rows(ctx, FIST, BOLT, x, y, dx < 0)
  if (a.age < 0.12) {
    blitRing(ctx, Math.round(4 + a.age * 110), 1, '#ffffff', Math.round(a.x), Math.round(a.y))
    blitEllipse(ctx, 3, 3, '#ffffff', Math.round(a.x), Math.round(a.y))
  }
  const seed = Math.floor(t * 20) + a.id
  for (let i = 0; i < 3; i++) {
    const q = hash2(seed, i, 3) * TAU
    const len = 8 + hash2(seed, i, 4) * 8
    zigzag(ctx, a.x, a.y, a.x + Math.cos(q) * len, a.y + Math.sin(q) * len, seed + i, i === 0 ? BOLT.w : i === 1 ? BOLT.y : BOLT.b)
  }
  ctx.globalAlpha = 1
}

/** The plasma bursting round a blow: jagged arcs racing out on a ring, yellow and blue, flickering. */
const drawPlasmaArc = (ctx: Ctx, a: Attack, t: number) => {
  const reach = a.tier || PLASMA.arc
  const k = Math.min(1, a.age / 0.14)
  const r = 6 + (reach - 6) * k
  ctx.globalAlpha = fadeOut(a, 0.16)
  const seed = Math.floor(t * 24) + a.id
  const arcs = 7
  for (let i = 0; i < arcs; i++) {
    const q0 = (i / arcs) * TAU + hash2(a.id, i, 5)
    const q1 = q0 + 0.6
    zigzag(ctx, a.x + Math.cos(q0) * r, a.y + Math.sin(q0) * r * 0.75, a.x + Math.cos(q1) * r, a.y + Math.sin(q1) * r * 0.75, seed + i, i % 2 === 0 ? BOLT.y : BOLT.b)
  }
  if (k < 1) blitRing(ctx, Math.max(1, Math.round(r * 0.6)), 1, BOLT.l, Math.round(a.x), Math.round(a.y))
  ctx.globalAlpha = 1
}

/* ---------------- Ivy Cudgel ---------------- */

/** The mask a cudgel hitbox was swung in: its type's. */
const maskAt = (a: Attack): OgerponMask => maskOf(a.type)

/** The cudgel swinging through its arc from the player, a trail in the mask's colors behind it, ivy leaves shaken off. */
const drawCudgelSwing = (ctx: Ctx, g: Game, a: Attack) => {
  const p = ownerOf(g, a.owner)
  const colors = OGERPON_MASKS[maskAt(a)].colors
  const dir = a.flip ? -1 : 1
  const k = Math.min(1, a.age / CUDGEL.time)
  const reach = a.tier
  const now = a.memo + dir * CUDGEL.arc * k
  const ox = p.x
  const oy = p.y - 8
  ctx.globalAlpha = fadeOut(a, 0.1)
  // The trail of the swing.
  for (let j = 1; j <= 5; j++) {
    const back = now - dir * j * 0.14
    if (dir * (back - a.memo) < 0) break
    ctx.globalAlpha = (0.55 - j * 0.09) * fadeOut(a, 0.1)
    thickLine(ctx, ox + Math.cos(back) * reach * 0.45, oy + Math.sin(back) * reach * 0.45, ox + Math.cos(back) * reach, oy + Math.sin(back) * reach, 3, colors[j % 2]!)
  }
  ctx.globalAlpha = fadeOut(a, 0.1)
  // The club: a handle, then the thick head out at the reach.
  const hx = ox + Math.cos(now) * reach * 0.35
  const hy = oy + Math.sin(now) * reach * 0.35
  const ex = ox + Math.cos(now) * reach
  const ey = oy + Math.sin(now) * reach
  const mx = ox + Math.cos(now) * reach * 0.62
  const my = oy + Math.sin(now) * reach * 0.62
  thickLine(ctx, hx, hy, mx, my, 3, WOOD.o)
  thickLine(ctx, hx, hy, mx, my, 2, WOOD.m)
  thickLine(ctx, mx, my, ex, ey, 7, WOOD.o)
  thickLine(ctx, mx, my, ex, ey, 5, WOOD.m)
  thickLine(ctx, mx, my, ex, ey, 2, WOOD.h)
  // Ivy round the head.
  for (let i = 0; i < 3; i++) {
    const along = 0.66 + i * 0.12
    px(ctx, ox + Math.cos(now) * reach * along - Math.sin(now) * 2, oy + Math.sin(now) * reach * along + Math.cos(now) * 2, i === 1 ? WOOD.G : WOOD.g, 2, 1)
  }
  ctx.globalAlpha = 1
}

/** Where the cudgel lands: a shockwave ring in the mask's colors and cracks in the ground, dust thrown up. */
const drawCudgelSlam = (ctx: Ctx, a: Attack) => {
  const colors = OGERPON_MASKS[maskAt(a)].colors
  const k = Math.min(1, a.age / 0.12)
  const r = Math.max(4, Math.round(a.tier * (0.4 + 0.6 * k)))
  const x = Math.round(a.x)
  const y = Math.round(a.y)
  ctx.globalAlpha = fadeOut(a, 0.2)
  blitRing(ctx, r, 2, colors[2]!, x, y)
  blitRing(ctx, Math.max(1, r - 2), 1, colors[1]!, x, y)
  // Cracks spreading from the middle.
  for (let i = 0; i < 6; i++) {
    const q = (i / 6) * TAU + hash2(a.id, i, 1) * 0.6
    const len = r * (0.5 + hash2(a.id, i, 2) * 0.5) * k
    thickLine(ctx, x, y, x + Math.cos(q) * len, y + Math.sin(q) * len * 0.6, 1, WOOD.d)
  }
  if (a.age < 0.08) blitEllipse(ctx, 5, 3, '#ffffff', x, y)
  for (let i = 0; i < 8; i++) {
    const q = (i / 8) * TAU
    const up = a.age * (40 + hash2(a.id, i, 3) * 30)
    px(ctx, x + Math.cos(q) * r * 0.8, y + Math.sin(q) * r * 0.5 - up, i % 2 === 0 ? colors[0]! : '#c8b898')
  }
  ctx.globalAlpha = 1
}

/** Embody Aspect's burst round the slam, in the mask's element: whirling leaves, a geyser, a fireball or rock spikes. */
const drawMaskBurst = (ctx: Ctx, a: Attack, t: number) => {
  const mask = maskAt(a)
  const [main, light, dark] = OGERPON_MASKS[mask].colors
  const k = Math.min(1, a.age / 0.12)
  const x = Math.round(a.x)
  const y = Math.round(a.y)
  ctx.globalAlpha = fadeOut(a, 0.18)
  switch (mask) {
    case 'teal': {
      // Leaves whirling up out of the ground.
      for (let i = 0; i < 6; i++) {
        const q = (i / 6) * TAU + t * 8 + a.memo
        const r = 4 + k * 9
        const lx = x + Math.cos(q) * r
        const ly = y - a.age * 30 + Math.sin(q) * r * 0.6
        px(ctx, lx, ly, dark!, 3, 2)
        px(ctx, lx + 1, ly, i % 2 === 0 ? light! : main!, 2, 1)
      }
      break
    }
    case 'wellspring': {
      // A geyser: a column of water rising and spraying.
      const hgt = Math.round(22 * Math.min(1, a.age / 0.15) * fadeOut(a, 0.2))
      thickLine(ctx, x, y, x, y - hgt, 6, dark!)
      thickLine(ctx, x, y, x, y - hgt, 4, main!)
      thickLine(ctx, x - 1, y, x - 1, y - hgt, 1, light!)
      for (let i = 0; i < 6; i++) px(ctx, x + (hash2(a.id, i, 4) - 0.5) * 16, y - hgt + hash2(a.id, i, 5) * 8 + a.age * 20, i % 2 === 0 ? '#ffffff' : light!)
      blitEllipse(ctx, 6, 2, light!, x, y)
      break
    }
    case 'hearthflame': {
      // A fireball blooming: a hot core, flames licking up off it.
      const r = Math.round(3 + k * 7)
      blitEllipse(ctx, r + 1, r, dark!, x, y - 4)
      blitEllipse(ctx, r, r - 1, main!, x, y - 4)
      blitEllipse(ctx, Math.max(1, r - 3), Math.max(1, r - 4), light!, x, y - 5)
      for (let i = 0; i < 5; i++) {
        const fx = x + (hash2(a.id, i, 6) - 0.5) * r * 2
        const fy = y - 6 - r - a.age * 40 * hash2(a.id, i, 7)
        px(ctx, fx, fy, i % 2 === 0 ? light! : '#f8e8a0', 2, 2)
      }
      break
    }
    case 'cornerstone': {
      // Rock spikes thrust up out of the ground.
      const up = Math.round(14 * Math.min(1, a.age / 0.08))
      for (const [ox, h] of [[-5, 0.7], [0, 1], [5, 0.6]] as const) {
        const top = y - Math.round(up * h)
        for (let r = 0; r <= y - top; r++) {
          const w = Math.max(1, Math.round(((r + 1) / (y - top + 1)) * 4))
          px(ctx, x + ox - (w >> 1), top + r, r === 0 ? light! : r % 3 === 0 ? dark! : main!, w, 1)
        }
      }
      break
    }
  }
  ctx.globalAlpha = 1
}

/** Ground layer: Ivy Cudgel's slams. */
export const drawLegendary5Ground = (ctx: Ctx, g: Game) => {
  for (const a of g.attacks) if (a.age >= 0 && a.visual === 'cudgelSlam') drawCudgelSlam(ctx, a)
}

/** Air layer (over the Pokémon). The whirl and the swing follow their player, so they draw wherever their middle is. */
export const drawLegendary5Air = (ctx: Ctx, g: Game, t: number, visible: (x: number, y: number, m?: number) => boolean) => {
  for (const a of g.attacks) {
    if (a.age < 0) continue
    switch (a.visual) {
      case 'diamondHalo':
        drawDiamondHalo(ctx, g, a, t)
        continue
      case 'cudgelSwing':
        drawCudgelSwing(ctx, g, a)
        continue
    }
    if (!visible(a.x, a.y, 40)) continue
    if (a.visual === 'diamondShard') drawShard(ctx, a, t)
    else if (a.visual === 'plasmaFist') drawPlasmaFist(ctx, a, t)
    else if (a.visual === 'plasmaArc') drawPlasmaArc(ctx, a, t)
    else if (a.visual === 'maskBurst') drawMaskBurst(ctx, a, t)
  }
}

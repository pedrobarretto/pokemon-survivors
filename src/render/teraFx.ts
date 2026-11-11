import { RAID, TERA, type RaidStars, type TeraType } from '../data/tera'
import { blitCentered, blitRotated, canvasCache, context2d, createCanvas, fromStrings, type PixelSprite } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import { TAU, type Dir8 } from '../engine/math'
import { outlined, toIconUrl } from './art'
import { detail } from './quality'
import { crownSprite, crystalAt, drawGlint, drawTwinkles, STELLAR, TERA_RAMPS, type Ramp } from './teraArt'
import { drawPokemon, type AnimName, type DrawOpts, type SpeciesSprites } from './sprites'
import { localPlayer } from '../game/players'
import type { RaidArena, RaidDen } from '../game/teraRaid'
import type { Attack, Enemy, Game, Player } from '../game/types'

/**
 * Terastal's effects (`game/tera.ts`, `game/teraRaid.ts`), all hard-edged on
 * the pixel grid: the transformation (shards drawn in, a crystal shell rising
 * round the Pokémon, cracking and bursting), the Terastallized Pokémon in
 * crystal (`render/teraArt.ts`) under its type's crown, the shatter's wave,
 * the shards on the ground, a raid den's pillar of light, the hollow's floor
 * and a raid boss's Tera shield. Drawing lean, the glint, the twinkles and the
 * rising motes stay out; the transformation never does.
 */

type Ctx = CanvasRenderingContext2D

/** Transformation progress, 0 → 1, or -1 when none plays. */
const introK = (p: Player) => (p.tera.intro > 0 ? 1 - p.tera.intro / TERA.intro : -1)

/** Seconds since the crystal shattered, while the form lasts (Infinity once the burst is long gone or none is on). */
const sinceShatter = (p: Player) => (p.tera.active > 0 ? TERA.duration - p.tera.active : Infinity)

/** The Tera type a player shows in crystal now: the form's while it lasts, and through the transformation's last beats. */
export const crystalType = (p: Player): TeraType | null => {
  const k = introK(p)
  if (k >= 0) return k > 0.55 ? p.tera.form : null
  return p.tera.active > 0 ? p.tera.form : null
}

/* ---------------- Little sprites ---------------- */

/** A Tera Shard: a faceted crystal, lit on its left. */
const SHARD = ['...4...', '..434..', '.43332.', '.43332.', '4333322', '3333221', '.33221.', '.33221.', '..321..', '...1...']

const shards = canvasCache<TeraType, PixelSprite>()

export const shardSprite = (type: TeraType) => {
  let s = shards.get(type)
  if (!s) {
    const r = TERA_RAMPS[type]
    s = outlined(fromStrings(SHARD, { 1: r[1], 2: r[2], 3: r[3], 4: r[4] }), r.o)
    shards.set(type, s)
  }
  return s
}

/** A shard as an icon (toasts). */
export const shardIcon = (type: TeraType) => toIconUrl(`shard:${type}`, () => shardSprite(type))

/** A crystal splinter: a 2×3 diamond in two tones. */
const splinter = (ctx: Ctx, x: number, y: number, light: string, dark: string) => {
  const px = Math.round(x)
  const py = Math.round(y)
  ctx.fillStyle = light
  ctx.fillRect(px, py - 1, 1, 2)
  ctx.fillStyle = dark
  ctx.fillRect(px + 1, py, 1, 2)
}

/** A ramp's color for facet `i` (Stellar's run through the seven crystals). */
const tone = (type: TeraType, r: Ramp, i: number, light: boolean) => (type === 'stellar' ? STELLAR[i % STELLAR.length]! : light ? r[3] : r[2])

/**
 * A crystal spike standing on (x, y), `h` px tall and `w` wide at its foot,
 * its tip leaning `lean` px: a lit left face, a shaded right one, a bright
 * ridge between and a dark outline, row by row.
 */
export const spike = (ctx: Ctx, x: number, y: number, w: number, h: number, lean: number, r: Ramp, stellar = -1) => {
  const face = stellar >= 0 ? STELLAR[stellar % STELLAR.length]! : r[3]
  for (let row = 0; row < h; row++) {
    const k = row / h
    const half = Math.max(0.5, (w / 2) * (1 - k))
    const cx = x + lean * k
    const left = Math.round(cx - half)
    const right = Math.round(cx + half)
    const mid = Math.round(cx)
    const yy = Math.round(y - row)
    ctx.fillStyle = r.o
    ctx.fillRect(left - 1, yy, right - left + 3, 1)
    ctx.fillStyle = face
    ctx.fillRect(left, yy, Math.max(0, mid - left), 1)
    ctx.fillStyle = r[1]
    ctx.fillRect(mid + 1, yy, Math.max(0, right - mid), 1)
    ctx.fillStyle = r[4]
    ctx.fillRect(mid, yy, 1, 1)
  }
  ctx.fillStyle = r.o
  ctx.fillRect(Math.round(x + lean) - 1, Math.round(y - h), 3, 1)
}

/* ---------------- The Terastallized Pokémon ---------------- */

/** How often a glint crosses the crystal, and how long it takes. */
const GLINT_EVERY = 2.4
const GLINT_TIME = 0.45

/**
 * Draws a player in crystal (its Tera type's) with its crown hovering over
 * its head, the glint and twinkles on top: in `drawPlayer`'s place while it's
 * Terastallized. False when there's nothing to draw it from (the caller draws
 * it plain). `scale` 2 for a raid's giant.
 */
export const drawCrystalPokemon = (
  ctx: Ctx, s: SpeciesSprites, type: TeraType, anim: AnimName, dir: Dir8, seconds: number, x: number, y: number, opts: DrawOpts, t: number, crown = true,
) => {
  const k = opts.scale ?? 1
  const at = crystalAt(s, anim, dir, seconds, x, y, k, opts.loop ?? true, type)
  if (!at) return false
  const { crystal, dx, dy, fw, fh } = at
  drawPokemon(ctx, s, anim, dir, seconds, x, y, { ...opts, body: { img: crystal.canvas, sx: 0, sy: 0, w: fw, h: fh, ox: 0, oy: 0 } })
  if ((opts.alpha ?? 1) < 1 || (opts.flash ?? 0) >= 1) return true
  if (!detail.lean) {
    const phase = (t % GLINT_EVERY) / GLINT_TIME
    if (phase < 1) drawGlint(ctx, crystal, dx, dy, k, phase)
    drawTwinkles(ctx, crystal, dx, dy, k, t)
  }
  if (crown) {
    const c = crownSprite(type)
    const bob = Math.round(Math.sin(t * 3)) * k
    const top = dy + crystal.top * k
    if (k === 1) blitCentered(ctx, c, x, top - 4 - c.height / 2 + bob)
    else ctx.drawImage(c, Math.round(x - (c.width * k) / 2), Math.round(top - 4 * k - c.height * k + bob), c.width * k, c.height * k)
  }
  return true
}

/* ---------------- The transformation ---------------- */

/** The shell's spikes round a body `bw`×`bh`: x offset, foot width, height share, lean. */
const SHELL = [
  [-0.55, 0.45, 0.7, -4],
  [0.55, 0.45, 0.75, 4],
  [-0.25, 0.6, 1.05, -2],
  [0.25, 0.6, 1, 3],
  [0, 0.75, 1.25, 0],
] as const

/**
 * Under a player while it transforms or is Terastallized: the veil over the
 * world while its crystal forms (`veil`: only this screen's own player), and
 * a ring of crystal splinters turning at its feet while the form lasts.
 */
export const drawTeraGround = (ctx: Ctx, g: Game, camX: number, camY: number, t: number, veil = true) => {
  const p = localPlayer(g)
  const k = introK(p)
  if (k >= 0 && veil) {
    ctx.fillStyle = `rgba(10,6,30,${(0.5 * Math.min(1, k * 4)).toFixed(2)})`
    ctx.fillRect(camX, camY, g.view.w, g.view.h)
  }
  const type = crystalType(p)
  if (!type || k >= 0) return
  const r = TERA_RAMPS[type]
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + t * 1.6
    splinter(ctx, p.x + Math.cos(a) * 15, p.y + 1 + Math.sin(a) * 5, tone(type, r, i, true), r[1])
  }
}

/**
 * Over a player: the transformation (splinters spiralling in, the shell
 * rising round it, cracking, bursting) and, once it shattered, the burst's
 * shards flying off; motes rising off the crystal while the form lasts.
 * `top` is the sprite's top edge, `bw` its body width.
 */
export const drawTeraAir = (ctx: Ctx, g: Game, top: number, bw: number, t: number) => {
  const p = localPlayer(g)
  const type = p.tera.form
  if (!type) return
  const r = TERA_RAMPS[type]
  const k = introK(p)
  const bh = p.y - top
  if (k >= 0) {
    // 1. Splinters of the type's crystal spiral in.
    if (k < 0.45) {
      const n = 14
      for (let i = 0; i < n; i++) {
        const d = (1 - k / 0.45) * 90 + 6
        const a = (i / n) * TAU + k * 7
        splinter(ctx, p.x + Math.cos(a) * d, p.y - bh / 2 + Math.sin(a) * d * 0.7, tone(type, r, i, true), r[1])
      }
    }
    // 2. The shell rises from the ground; 3. it cracks; 4. it bursts (the shards below take over).
    if (k > 0.2 && k < 0.88) {
      const grow = Math.min(1, (k - 0.2) / 0.35)
      SHELL.forEach(([ox, fw, fh, lean], i) => {
        const h = Math.round((bh + 8) * fh * grow)
        if (h > 1) spike(ctx, p.x + ox * bw, p.y + 2, Math.max(5, bw * fw), h, lean, r, type === 'stellar' ? i : -1)
      })
      if (k > 0.66) drawCracks(ctx, p.x, p.y - bh / 2, bw, bh, k)
    }
    if (k >= 0.86) drawBurst(ctx, type, r, p.x, p.y - bh / 2, (k - 0.86) * TERA.intro)
    return
  }
  const since = sinceShatter(p)
  if (since < 0.9) drawBurst(ctx, type, r, p.x, p.y - bh / 2, since + 0.14 * TERA.intro)
  // The form's last 3 seconds: the crystal flickers (drawPlayer blinks it); motes rise off it before.
  if (detail.lean || p.tera.active <= 0) return
  for (let i = 0; i < 4; i++) {
    const phase = (t * 0.7 + hash2(p.slot, i, 31)) % 1
    const x = p.x + (hash2(i, Math.floor(t * 0.7 + hash2(p.slot, i, 31)), 32) - 0.5) * bw
    ctx.fillStyle = tone(type, r, i, phase < 0.5)
    ctx.fillRect(Math.round(x), Math.round(p.y - 4 - phase * (bh + 10)), 1, 1)
  }
}

/** White cracks running over the shell as it gives. */
const drawCracks = (ctx: Ctx, x: number, cy: number, bw: number, bh: number, k: number) => {
  const n = Math.round(2 + (k - 0.66) * 30)
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < n; i++) {
    let cx = Math.round(x + (hash2(i, 1, 41) - 0.5) * bw)
    let yy = Math.round(cy + (hash2(i, 2, 41) - 0.5) * bh)
    for (let s = 0; s < 6; s++) {
      ctx.fillRect(cx, yy, 1, 1)
      cx += hash2(i, s, 42) < 0.5 ? -1 : 1
      yy += hash2(i, s, 43) < 0.6 ? 1 : 0
    }
  }
}

/** The shell's shards flying off, `s` seconds after the burst: spinning splinters under gravity, fading in steps. */
const drawBurst = (ctx: Ctx, type: TeraType, r: Ramp, x: number, cy: number, s: number) => {
  const n = 22
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash2(i, 3, 51) * 0.4
    const v = 70 + hash2(i, 4, 51) * 90
    const px = x + Math.cos(a) * v * s
    const py = cy + Math.sin(a) * v * s * 0.8 + 120 * s * s
    if (s > 0.55 + hash2(i, 5, 51) * 0.35) continue
    const big = i % 3 === 0
    ctx.fillStyle = tone(type, r, i, true)
    ctx.fillRect(Math.round(px), Math.round(py), big ? 2 : 1, big ? 3 : 2)
    ctx.fillStyle = r[4]
    ctx.fillRect(Math.round(px), Math.round(py), 1, 1)
  }
}

/** The shatter's shockwave: a ring of splinters racing out. */
export const drawTeraAttack = (ctx: Ctx, a: Attack, type: TeraType | null) => {
  if (a.visual !== 'teraWave' || a.shape.kind !== 'circle' || !type) return
  const r = TERA_RAMPS[type]
  const rr = a.shape.r
  if (a.age / a.ttl > 0.85) return
  const steps = Math.max(12, Math.ceil(rr * TAU * 0.35))
  for (let j = 0; j < steps; j++) {
    const ang = (j / steps) * TAU
    splinter(ctx, a.x + Math.cos(ang) * rr, a.y + Math.sin(ang) * rr * 0.8, tone(type, r, j, j % 2 === 0), r[1])
  }
}

/* ---------------- On the ground ---------------- */

/** A Tera Shard lying on the ground, its type's crown over it so the call reads at a glance, a glint going round. */
export const drawShardPickup = (ctx: Ctx, type: TeraType, x: number, y: number, t: number) => {
  blitCentered(ctx, shardSprite(type), x, y)
  const c = crownSprite(type)
  blitCentered(ctx, c, x, y - 7 - c.height / 2 + Math.round(Math.sin(t * 2.5)))
  if (Math.floor(t * 3) % 3 === 0) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(Math.round(x - 2), Math.round(y - 3), 1, 1)
  }
}

/* ---------------- Raid dens ---------------- */

/** The stars over a den and on the raid's HUD: a 5×5 pixel star. */
const STAR = ['..1..', '.111.', '11111', '.111.', '1.1.1']

const starSprite = canvasCache<string, PixelSprite>()

const star = (color: string) => {
  let s = starSprite.get(color)
  if (!s) starSprite.set(color, (s = outlined(fromStrings(STAR, { 1: color }), '#201018')))
  return s
}

/** A raid's star as an icon (the title card, the lobby's card): gold, or one of the seven crystals. */
export const starIcon = (color: string) => toIconUrl(`raidStar:${color}`, () => star(color))

/** A raid's stars in a row centered on (x, y): gold, the 7★ in the seven crystals. */
export const drawStars = (ctx: Ctx, stars: RaidStars, x: number, y: number) => {
  const w = 7
  for (let i = 0; i < stars; i++) blitCentered(ctx, star(stars === 7 ? STELLAR[i % STELLAR.length]! : '#f8d038'), x + (i - (stars - 1) / 2) * w, y)
}

/** A den's crater on the ground: a ring of crystal spikes round a glowing pit. */
export const drawDenGround = (ctx: Ctx, den: RaidDen, t: number) => {
  const type = den.raid.tera
  const r = TERA_RAMPS[type]
  ctx.fillStyle = '#1c1028'
  for (let y = -6; y <= 6; y++) {
    const half = Math.round(RAID.door * Math.sqrt(1 - (y / 7) ** 2))
    ctx.fillRect(den.x - half, den.y + y, half * 2, 1)
  }
  const glow = Math.floor(t * 4) % 2 === 0 ? r[3] : r[2]
  ctx.fillStyle = glow
  for (let y = -3; y <= 3; y++) {
    const half = Math.round(10 * Math.sqrt(1 - (y / 4) ** 2))
    ctx.fillRect(den.x - half, den.y + y, half * 2, 1)
  }
  ctx.fillStyle = r[4]
  ctx.fillRect(den.x - 3, den.y - 1, 6, 2)
}

/** The den's rim of spikes, its pillar of light, and the raid's crown and stars over it. */
export const drawDenAir = (ctx: Ctx, den: RaidDen, t: number) => {
  const type = den.raid.tera
  const r = TERA_RAMPS[type]
  // The back of the rim, then the pillar, then the front.
  const rim = (front: boolean) => {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + 0.3
      if (Math.sin(a) > 0 !== front) continue
      spike(ctx, den.x + Math.cos(a) * (RAID.door + 2), den.y + Math.sin(a) * 7, 6 + (i % 3) * 2, 9 + ((i * 5) % 4) * 3, Math.cos(a) * 3, r, type === 'stellar' ? i : -1)
    }
  }
  rim(false)
  const pulse = Math.floor(t * 6) % 2
  const height = 120
  for (let y = 0; y < height; y++) {
    const fade = y / height
    const half = Math.max(1, Math.round((7 + pulse) * (1 - fade * 0.5)))
    const yy = den.y - y
    if (fade > 0.6 && (y + Math.floor(t * 20)) % 3 === 0) continue
    ctx.fillStyle = type === 'stellar' ? STELLAR[Math.floor(y / 6 + t * 8) % STELLAR.length]! : r[2]
    ctx.fillRect(den.x - half, yy, half * 2, 1)
    ctx.fillStyle = r[3]
    ctx.fillRect(den.x - Math.max(1, half - 2), yy, Math.max(2, (half - 2) * 2), 1)
    ctx.fillStyle = r[4]
    ctx.fillRect(den.x - 1, yy, 2, 1)
  }
  rim(true)
  const c = crownSprite(type)
  const bob = Math.round(Math.sin(t * 2))
  blitCentered(ctx, c, den.x, den.y - 34 - c.height / 2 + bob)
  drawStars(ctx, den.raid.stars, den.x, den.y - 28 + bob)
}

/* ---------------- The hollow ---------------- */

const floors = canvasCache<TeraType, HTMLCanvasElement>()
const FLOOR_R = 150
const FLOOR_PAD = 26

/** The hollow's floor, made once per Tera type: dark faceted stone, crystals set in it, the raid's sigil under the giant and a rim of spikes. */
const floorOf = (type: TeraType) => {
  let c = floors.get(type)
  if (c) return c
  const size = (FLOOR_R + FLOOR_PAD) * 2
  c = createCanvas(size, size)
  const ctx = context2d(c)
  const r = TERA_RAMPS[type]
  const o = size / 2
  const STONE = ['#22183a', '#2a1e46', '#1c1430', '#261a40'] as const
  const SEAM = '#3c2c62'
  const CELL_F = 22
  /** The floor's facets: a Voronoi of seeds on a jittered grid, the nearest two for the seams. */
  const facet = (x: number, y: number) => {
    const cx = Math.floor(x / CELL_F)
    const cy = Math.floor(y / CELL_F)
    let best = Infinity
    let next = Infinity
    let id = 0
    for (let j = cy - 1; j <= cy + 1; j++) {
      for (let i = cx - 1; i <= cx + 1; i++) {
        const sx = (i + 0.2 + hash2(i, j, 66) * 0.6) * CELL_F
        const sy = (j + 0.2 + hash2(i, j, 67) * 0.6) * CELL_F
        const d = Math.hypot(x - sx, y - sy)
        if (d < best) {
          next = best
          best = d
          id = i * 997 + j
        } else if (d < next) next = d
      }
    }
    return { id, seam: next - best < 1.1 }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - o + 0.5, y - o + 0.5)
      if (d > FLOOR_R) continue
      const f = facet(x, y)
      let color: string = f.seam ? SEAM : STONE[Math.floor(hash2(f.id, 3, 68) * STONE.length)]!
      if (d > FLOOR_R - 4) color = d > FLOOR_R - 1.5 ? r.o : r[1]
      ctx.fillStyle = color
      ctx.fillRect(x, y, 1, 1)
    }
  }
  // Crystals set in the stone, glinting in the raid's type.
  for (let i = 0; i < 26; i++) {
    const a = hash2(i, 1, 69) * TAU
    const d = 30 + hash2(i, 2, 69) * (FLOOR_R - 46)
    const x = Math.round(o + Math.cos(a) * d)
    const y = Math.round(o + Math.sin(a) * d)
    spike(ctx, x, y + 2, 3 + (i % 3), 4 + (i % 4), (i % 3) - 1, r, type === 'stellar' ? i : -1)
  }
  // The raid's sigil where the giant stands: two rings of the type's crystal and six points.
  const sx = o
  const sy = o - 30
  for (let k = 0; k < 120; k++) {
    const a = (k / 120) * TAU
    ctx.fillStyle = k % 10 < 6 ? r[2] : r[1]
    ctx.fillRect(Math.round(sx + Math.cos(a) * 40), Math.round(sy + Math.sin(a) * 16), 1, 1)
    if (k % 2 === 0) ctx.fillRect(Math.round(sx + Math.cos(a) * 30), Math.round(sy + Math.sin(a) * 12), 1, 1)
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU
    ctx.fillStyle = r[3]
    ctx.fillRect(Math.round(sx + Math.cos(a) * 40) - 1, Math.round(sy + Math.sin(a) * 16), 3, 1)
  }
  // A rim of crystals round the hollow, tallest at the back.
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU
    const back = Math.sin(a) < 0
    spike(ctx, o + Math.cos(a) * (FLOOR_R + 3), o + Math.sin(a) * (FLOOR_R + 3), 8 + (i % 3) * 3, back ? 16 + (i % 4) * 4 : 7 + (i % 3) * 2, Math.cos(a) * 4, r, type === 'stellar' ? i : -1)
  }
  floors.set(type, c)
  return c
}

/** The hollow: a void of slow crystal motes, then its floor at the room's center. */
export const drawRaidFloor = (ctx: Ctx, arena: RaidArena, camX: number, camY: number, w: number, h: number, t: number) => {
  ctx.fillStyle = '#0a0614'
  ctx.fillRect(0, 0, w, h)
  const r = TERA_RAMPS[arena.raid.tera]
  ctx.fillStyle = r[1]
  const ox = Math.round(camX * 0.3)
  const oy = Math.round(camY * 0.3)
  for (let i = 0; i < 40; i++) {
    if (Math.sin(t * 1.5 + i * 2.1) < -0.3) continue
    const x = ((Math.floor(hash2(i, 1, 65) * 160) - ox) % 160 + 160) % 160
    const y = ((Math.floor(hash2(i, 2, 65) * 160) - oy) % 160 + 160) % 160
    for (let yy = y; yy < h; yy += 160) for (let xx = x; xx < w; xx += 160) ctx.fillRect(xx, yy, 1, 1)
  }
  const floor = floorOf(arena.raid.tera)
  ctx.drawImage(floor, Math.round(arena.x - floor.width / 2 - camX), Math.round(arena.y - floor.height / 2 - camY))
}

/** Lets go of the hollows' floors (a run ended). */
export const freeRaidFloors = () => {
  for (const c of floors.values()) c.width = c.height = 0
  floors.clear()
}

/* ---------------- A raid boss ---------------- */

/**
 * A raid's giant: in its Tera type's crystal, twice the size, its crown over
 * it. With its shield up, a dome of crystal facets round it, cracking as the
 * shield runs down; the reeling after it broke, splinters orbit it. False when
 * there's no crystal to draw (the caller draws it plain).
 */
export const drawRaidBoss = (ctx: Ctx, arena: RaidArena, e: Enemy, s: SpeciesSprites, anim: AnimName, y: number, opts: DrawOpts, t: number) => {
  if (!drawCrystalPokemon(ctx, s, arena.raid.tera, anim, e.dir, e.animTime, e.x, y, { ...opts, scale: 2 }, t)) return false
  const sh = arena.shield
  const r = TERA_RAMPS[arena.raid.tera]
  const bodyH = s.bodyH * 2
  const cy = y - bodyH / 2
  if (sh.up) {
    const share = sh.max > 0 ? sh.hp / sh.max : 0
    const rx = s.bodyW + 10
    const ry = bodyH * 0.62 + 6
    const facets = 18
    for (let i = 0; i < facets; i++) {
      // Facets fall away as the shield runs down, the last ones blinking.
      if (i / facets > share && !(i / facets - share < 0.06 && Math.floor(t * 10) % 2 === 0)) continue
      const a0 = (i / facets) * TAU + t * 0.4
      const a1 = ((i + 1) / facets) * TAU + t * 0.4
      const steps = 8
      for (let k = 0; k <= steps; k++) {
        const a = a0 + ((a1 - a0) * k) / steps
        ctx.fillStyle = k === 0 ? r[4] : i % 2 === 0 ? r[3] : r[2]
        ctx.fillRect(Math.round(e.x + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 2, 2)
      }
    }
  } else if (sh.broken > 0) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + t * 3
      splinter(ctx, e.x + Math.cos(a) * (s.bodyW + 6), cy + Math.sin(a) * bodyH * 0.4, tone(arena.raid.tera, r, i, true), r[1])
    }
  }
  return true
}

/* ---------------- The den's arrow ---------------- */

const ARROW = ['11.....', '1221...', '122221.', '1222221', '122221.', '1221...', '11.....']
const arrows = canvasCache<TeraType, PixelSprite>()

/** Screen-space arrow on the edge pointing at an open den off screen, the raid's crown riding it (the places' arrow's margins). */
export const drawDenArrow = (ctx: Ctx, g: Game, camX: number, camY: number, t: number) => {
  const den = g.raid.den
  if (!den || g.raid.arena || g.place.inside || g.rift.arena) return
  const { w, h } = g.view
  const sx = den.x - camX
  const sy = den.y - camY
  if (sx > 0 && sx < w && sy > -20 && sy < h) return
  const type = den.raid.tera
  let arrow = arrows.get(type)
  if (!arrow) {
    const r = TERA_RAMPS[type]
    arrows.set(type, (arrow = outlined(fromStrings(ARROW, { 1: r[4], 2: r[2] }), r.o)))
  }
  const cx = w / 2
  const cy = h / 2
  const angle = Math.atan2(sy - cy, sx - cx)
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const k = Math.min(dx > 0 ? (w - 16 - cx) / dx : dx < 0 ? (16 - cx) / dx : Infinity, dy > 0 ? (h - 40 - cy) / dy : dy < 0 ? (72 - cy) / dy : Infinity)
  const bob = Math.sin(t * 8) * 2
  const ax = cx + dx * (k + bob)
  const ay = cy + dy * (k + bob)
  blitRotated(ctx, arrow, ax, ay, angle, 2)
  const c = crownSprite(type)
  blitCentered(ctx, c, ax - dx * 18, ay - dy * 18)
}

/* ---------------- Tera Starstorm (Terapagos) ---------------- */

/**
 * Tera Starstorm's look (`teraStarstorm` in `game/legendaryMoves.ts`):
 * the prism of the seven crystals gathering over Terapagos, each star's mark
 * on the ground closing in, the star falling down its light, and its burst.
 * `ground` draws the marks, the rest goes over the Pokémon.
 */
export const drawStarstorm = (ctx: Ctx, a: Attack, t: number, ground: boolean) => {
  if (a.shape.kind !== 'circle') return
  const k = a.ttl > 0 ? Math.min(1, a.age / a.ttl) : 1
  const r = a.shape.r
  const hue = (i: number) => STELLAR[(i + a.memo) % STELLAR.length]!
  if (a.visual === 'starFall') {
    if (ground) {
      // The mark: seven-colored ticks closing in on the spot the star falls on.
      const rr = r * (1.4 - 0.4 * k)
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * TAU + t * 2
        ctx.fillStyle = hue(i)
        ctx.fillRect(Math.round(a.x + Math.cos(ang) * rr), Math.round(a.y + Math.sin(ang) * rr * 0.6), 2, 1)
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(Math.round(a.x) - 1, Math.round(a.y), 3, 1)
      return
    }
    // The star coming down its column of light in the last half of its wait.
    if (k < 0.45) return
    const f = (k - 0.45) / 0.55
    const y = a.y - (1 - f) * 150
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = hue(i)
      ctx.fillRect(Math.round(a.x - 1), Math.round(y - 6 - i * 4), 2, 3)
    }
    blitCentered(ctx, crownSprite('stellar'), a.x, y - 4)
    return
  }
  if (ground) return
  if (a.visual === 'starPrism') {
    // A diamond of the seven crystals, growing and turning its facets, rays closing in.
    const size = Math.round(4 + Math.min(1, k * 2) * 5)
    const cx = Math.round(a.x)
    const cy = Math.round(a.y)
    for (let row = -size; row <= size; row++) {
      const half = size - Math.abs(row)
      for (let x = -half; x <= half; x++) {
        ctx.fillStyle = x === 0 || Math.abs(row) === size ? '#ffffff' : hue(Math.floor((x + size + Math.floor(t * 10)) / 2))
        ctx.fillRect(cx + x, cy + row, 1, 1)
      }
    }
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * TAU + t
      const d = (1 - k) * 30 + size + 2
      ctx.fillStyle = hue(i)
      ctx.fillRect(Math.round(cx + Math.cos(ang) * d), Math.round(cy + Math.sin(ang) * d), 2, 2)
    }
    return
  }
  if (a.visual === 'starBurst') {
    // A ring of splinters racing out, a white star at its heart for the first beat.
    const rr = r * (0.4 + k * 0.8)
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * TAU
      splinter(ctx, a.x + Math.cos(ang) * rr, a.y + Math.sin(ang) * rr * 0.7, hue(i), '#ffffff')
    }
    if (k < 0.4) blitCentered(ctx, crownSprite('stellar'), a.x, a.y - 4)
  }
}

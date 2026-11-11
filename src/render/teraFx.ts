import { RAID, TERA, type RaidStars, type TeraType } from '../data/tera'
import { blitCentered, blitRotated, canvasCache, context2d, createCanvas, fromStrings, type PixelSprite } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import { TAU, type Dir8 } from '../engine/math'
import { outlined, toIconUrl } from './art'
import { detail } from './quality'
import { crownSprite, crystalAt, drawCrown, drawFacet, drawGlint, drawTwinkles, facetsOf, STELLAR, TERA_RAMPS, type Facets, type Ramp } from './teraArt'
import { headSeat, skullWidth } from './wearables'
import type { CrownSize } from './teraCrowns'
import { drawPokemon, type AnimName, type DrawOpts, type SpeciesSprites } from './sprites'
import { localPlayer } from '../game/players'
import type { RaidArena, RaidDen } from '../game/teraRaid'
import type { Attack, Enemy, Game, Player } from '../game/types'

/**
 * Terastal's effects (`game/tera.ts`, `game/teraRaid.ts`), all hard-edged on
 * the pixel grid: the transformation (beams of the type's light, the crystal
 * growing over the Pokémon facet by facet, a white flash, the shatter into its
 * facets), the Terastallized Pokémon in crystal (`render/teraArt.ts`) with its
 * type's crown seated on its head, the shatter's wave and the screen's tint,
 * the shards on the ground, a raid den's pillar of light, the hollow's floor
 * and a raid boss's Tera shield. Drawing lean, the glint, the twinkles and the
 * rising motes stay out; the transformation never does.
 */

type Ctx = CanvasRenderingContext2D

/** Transformation progress, 0 → 1, or -1 when none plays. */
const introK = (p: Player) => (p.tera.intro > 0 ? 1 - p.tera.intro / TERA.intro : -1)

/** Seconds since the crystal shattered, while the form lasts (Infinity once the burst is long gone or none is on). */
const sinceShatter = (p: Player) => (p.tera.active > 0 ? TERA.duration - p.tera.active : Infinity)

/**
 * The transformation's beats, as shares of `TERA.intro`: the Pokémon gathers
 * light, the crystal grows over it facet by facet from the feet up, holds
 * whole while cracks of light run over it, then flashes white; at the end
 * (`transform`, a hitstop holding the frame) it shatters into its facets.
 */
const BEAT = { grow: 0.1, whole: 0.66, flash: 0.86 } as const

/** The Tera type a player shows in crystal now: the form's, once its crystal shattered (the growing shell is drawn over it, `drawTeraAir`). */
export const crystalType = (p: Player): TeraType | null => (p.tera.intro <= 0 && p.tera.active > 0 ? p.tera.form : null)

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
 * Draws a player in crystal (its Tera type's) with its crown seated on its
 * head (the head rig's seat, floating over it without a rig), the glint and twinkles on top: in `drawPlayer`'s place while it's
 * Terastallized. False when there's nothing to draw it from (the caller draws
 * it plain). `scale` 2 for a raid's giant; `cut` the crown's size, picked by its skull (`crownSize`).
 */
export const drawCrystalPokemon = (
  ctx: Ctx, s: SpeciesSprites, type: TeraType, anim: AnimName, dir: Dir8, seconds: number, x: number, y: number, opts: DrawOpts, t: number, crown = true,
  cut: CrownSize = crownSize(s),
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
    const phase = detail.lean ? -1 : (t % GLINT_EVERY) / GLINT_TIME
    // Seated on the skull as a hat is (the wearables' head rig, `render/wearables.ts`), riding the head through every frame;
    // a variant without a rig wears it floating over its head.
    const seat = headSeat(s, anim, dir, seconds, opts.loop ?? true)
    // It sinks into the skull a little, but always leaves a row of the face above the eyes.
    const base = seat && Math.min(seat.y + CROWN_SINK, seat.eyes === null ? Infinity : seat.eyes - 2)
    if (seat && base !== null) drawCrown(ctx, type, dx + (seat.x + 0.5) * k, dy + base * k, k, phase < 1 ? phase : -1, t, cut)
    else drawCrown(ctx, type, x, dy + (crystal.top - 3) * k + Math.round(Math.sin(t * 3)) * k, k, phase < 1 ? phase : -1, t, cut)
  }
  return true
}

/** Rows of the crown's setting below the seat: it sits into the skull's top rather than on a point of it. */
const CROWN_SINK = 2

/** A skull narrower than this (px, the head rig's middle seat) wears the small crown: the full one would hang off a Riolu's or a Gardevoir's head. */
export const SMALL_SKULL = 14

/** The crown a variant wears: small on a small head (`skullWidth`), full otherwise and without a rig. */
export const crownSize = (s: SpeciesSprites): CrownSize => {
  const w = skullWidth(s)
  return w !== null && w < SMALL_SKULL ? 'small' : 'full'
}

/* ---------------- The transformation ---------------- */

/** Crystal spikes erupting round the feet as the crystal grows: x offset (share of the body's width), foot width, height share, lean. */
const SHELL = [
  [-0.75, 4, 0.35, -3],
  [0.75, 4, 0.4, 3],
  [-0.45, 5, 0.55, -2],
  [0.45, 5, 0.5, 2],
] as const

/** How the shards' clock runs after the shatter: slow for its first beat (the slow-mo), then at speed. */
const shardClock = (s: number) => (s < 0.22 ? s * 0.35 : 0.077 + (s - 0.22) * 1.1)

/**
 * Under a player while it transforms or is Terastallized: the veil over the
 * world in the type's dark while its crystal forms (`veil`: only this
 * screen's own player), rays of the type's light turning behind it, and a
 * ring of crystal splinters turning at its feet while the form lasts.
 */
export const drawTeraGround = (ctx: Ctx, g: Game, camX: number, camY: number, t: number, veil = true) => {
  const p = localPlayer(g)
  const k = introK(p)
  const form = p.tera.form
  if (k >= 0 && form) {
    const r = TERA_RAMPS[form]
    if (veil) {
      ctx.globalAlpha = 0.72 * Math.min(1, k * 5)
      ctx.fillStyle = r.o
      ctx.fillRect(camX, camY, g.view.w, g.view.h)
      ctx.globalAlpha = 1
    }
    // Beams of the type's light fanning out behind the Pokémon, widening as they go and longer as the crystal grows.
    if (k > BEAT.grow * 0.5) {
      const len = 26 + Math.min(1, (k - BEAT.grow * 0.5) / 0.45) * (detail.lean ? 54 : 84)
      const n = detail.lean ? 6 : 9
      const cy = p.y - 12
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + k * 0.9 + 0.2
        const ux = Math.cos(a)
        const uy = Math.sin(a) * 0.8
        const color = form === 'stellar' ? STELLAR[i % STELLAR.length]! : null
        for (let d = 12; d < len; d += 2) {
          const half = Math.floor(d / 16)
          const far = d > len * 0.7
          for (let w = -half; w <= half; w++) {
            ctx.fillStyle = color ?? (w === 0 ? r[4] : Math.abs(w) === half && half > 0 ? r[2] : far ? r[2] : r[3])
            ctx.fillRect(Math.round(p.x + ux * d - uy * w), Math.round(cy + uy * d + ux * w), 2, 2)
          }
        }
      }
    }
    return
  }
  const type = crystalType(p)
  if (!type) return
  const r = TERA_RAMPS[type]
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + t * 1.6
    splinter(ctx, p.x + Math.cos(a) * 15, p.y + 1 + Math.sin(a) * 5, tone(type, r, i, true), r[1])
  }
}

/**
 * Over a player: the transformation, then the shatter. Splinters spiral in
 * while light gathers; the crystal grows over the Pokémon facet by facet from
 * its feet up (each facet landing white), spikes erupting round it; whole, it
 * holds while cracks of light run over it, then flashes white; when it
 * shatters (`transform`) its facets fly out and fall, slow for a beat. Motes
 * rise off the crystal while the form lasts. `s`, `anim` and `feet` are how
 * the Pokémon is drawn now (the facets are cut from that frame).
 */
export const drawTeraAir = (ctx: Ctx, g: Game, s: SpeciesSprites, anim: AnimName, feet: number, t: number) => {
  const p = localPlayer(g)
  const type = p.tera.form
  if (!type) return
  const r = TERA_RAMPS[type]
  const k = introK(p)
  const bw = s.bodyW
  const bh = s.bodyH
  if (k >= 0) {
    // 1. Splinters of the type's crystal spiral in.
    if (k < 0.4) {
      const n = 16
      for (let i = 0; i < n; i++) {
        const d = (1 - k / 0.4) * 90 + 6
        const a = (i / n) * TAU + k * 7
        splinter(ctx, p.x + Math.cos(a) * d, feet - bh / 2 + Math.sin(a) * d * 0.7, tone(type, r, i, true), r[1])
      }
    }
    const at = crystalAt(s, anim, p.dir, p.animTime, p.x, feet, 1, true, type)
    const cut = at && facetsOf(at.crystal)
    if (!at || !cut) {
      if (k >= BEAT.flash) drawBurst(ctx, type, r, p.x, feet - bh / 2, (k - BEAT.flash) * 0.4)
      return
    }
    // 2. Spikes erupt round the feet as the crystal climbs.
    const grown = Math.min(1, Math.max(0, (k - BEAT.grow) / (BEAT.whole - BEAT.grow)))
    if (k < BEAT.flash) {
      SHELL.forEach(([ox, fw, fh, lean], i) => {
        const h = Math.round((bh + 6) * fh * Math.min(1, grown * 1.6))
        if (h > 1) spike(ctx, p.x + ox * bw, feet + 2, fw, h, lean, r, type === 'stellar' ? i : -1)
      })
    }
    // 3. The crystal grows facet by facet; each lands white for a beat.
    const n = cut.facets.length
    const shown = Math.floor(grown * n)
    const fresh = Math.max(1, Math.round(n * 0.12))
    const white = k >= BEAT.flash
    shell = { cut, dx: at.dx, dy: at.dy, x: p.x, feet, slot: p.slot }
    for (let i = 0; i < Math.min(n, shown); i++) drawFacet(ctx, cut, cut.facets[i]!, at.dx, at.dy, 1, 0, 0, white || i >= shown - fresh)
    // 4. Whole, cracks of light run over it: a few facets at a time catch white.
    if (k >= BEAT.whole && !white) {
      const beat = Math.floor(k * 40)
      const lit = 1 + Math.floor(((k - BEAT.whole) / (BEAT.flash - BEAT.whole)) * n * 0.5)
      for (let j = 0; j < lit; j++) drawFacet(ctx, cut, cut.facets[Math.floor(hash2(beat, j, 61) * n)]!, at.dx, at.dy, 1, 0, 0, true)
      drawGlint(ctx, at.crystal, at.dx, at.dy, 1, (k - BEAT.whole) / (BEAT.flash - BEAT.whole))
    }
    // 5. White, it swells: a ring of light closing in on it.
    if (white) {
      const q = (k - BEAT.flash) / (1 - BEAT.flash)
      ring(ctx, p.x, feet - bh / 2, (1 - q) * 40 + bw * 0.6, r[4])
    }
    return
  }
  const since = sinceShatter(p)
  if (since < SHATTER_TIME) drawShatter(ctx, s, anim, type, r, p, feet, since)
  // The form's last 3 seconds: the crystal flickers (drawPlayer blinks it); motes rise off it before.
  if (detail.lean || p.tera.active <= 0) return
  for (let i = 0; i < 4; i++) {
    const phase = (t * 0.7 + hash2(p.slot, i, 31)) % 1
    const x = p.x + (hash2(i, Math.floor(t * 0.7 + hash2(p.slot, i, 31)), 32) - 0.5) * bw
    ctx.fillStyle = tone(type, r, i, phase < 0.5)
    ctx.fillRect(Math.round(x), Math.round(p.y - 4 - phase * (bh + 10)), 1, 1)
  }
}

/** The shell as last drawn (its facets, where): the shatter flies those, not whatever frame the Pokémon walks on after. */
let shell: { cut: Facets; dx: number; dy: number; x: number; feet: number; slot: number } | null = null

/** Seconds the shatter's shards fly. */
const SHATTER_TIME = 1.3

/** A hard ring of 1 px dots, `r` px round (x, y), squashed to the ground's tilt. */
const ring = (ctx: Ctx, x: number, y: number, r: number, color: string) => {
  ctx.fillStyle = color
  const steps = Math.max(16, Math.ceil(r * 3))
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU
    ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.8), 2, 1)
  }
}

/**
 * The shatter, `since` seconds after it: the shell's facets fly out from the
 * body's middle (cut from the frame it shattered on), arc, fall to the
 * ground and blink out, white for their first beat, slow at first
 * (`shardClock`); splinters burst out with them.
 */
const drawShatter = (ctx: Ctx, s: SpeciesSprites, anim: AnimName, type: TeraType, r: Ramp, p: Player, feet: number, since: number) => {
  const c = shardClock(since)
  // The shell as it gave (`shell`), or this frame's crystal when it wasn't seen forming (a teammate's, a late join).
  const own = shell?.slot === p.slot ? shell : null
  const now = own ? null : crystalAt(s, anim, p.dir, p.animTime, p.x, feet, 1, true, type)
  const cut = own?.cut ?? (now && facetsOf(now.crystal))
  if (!cut) return drawBurst(ctx, type, r, p.x, feet - s.bodyH / 2, c)
  const at = own ?? { dx: now!.dx, dy: now!.dy }
  const base = own?.feet ?? feet
  const cx = own?.x ?? p.x
  const cy = base - s.bodyH / 2
  drawBurst(ctx, type, r, cx, cy, c)
  const lean = detail.lean
  cut.facets.forEach((f, i) => {
    if (lean && i % 2 === 1) return
    // Each facet flies off from where it sat, away from the body's middle, a little up, then falls to the ground below it.
    const fx = at.dx + f.x + f.w / 2
    const fy = at.dy + f.y + f.h / 2
    const ax = fx - cx + (hash2(i, 1, 71) - 0.5) * 6
    const ay = fy - cy + (hash2(i, 2, 71) - 0.5) * 6
    const len = Math.hypot(ax, ay) || 1
    const v = 70 + hash2(i, 3, 71) * 80
    const vx = (ax / len) * v
    const vy = (ay / len) * v * 0.7 - 60 - hash2(i, 4, 71) * 50
    const ground = base + 4 + hash2(i, 5, 71) * 10 - f.h / 2
    let ox = vx * c
    let oy = vy * c + 260 * c * c
    // Landed: it lies where it fell, sliding to a stop.
    if (fy + oy > ground) {
      oy = ground - fy
      ox = vx * Math.min(c, 0.5)
    }
    const life = 0.85 + hash2(i, 6, 71) * 0.4
    if (since > life || (since > life - 0.25 && Math.floor(since * 16) % 2 === 0)) return
    drawFacet(ctx, cut, f, at.dx, at.dy, 1, ox, oy, since < 0.1 || (since < 0.3 && i % 5 === 0))
  })
}

/** Splinters bursting out of the shell, `s` seconds after it gave: spinning under gravity, gone in steps. */
const drawBurst = (ctx: Ctx, type: TeraType, r: Ramp, x: number, cy: number, s: number) => {
  const n = detail.lean ? 14 : 26
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash2(i, 3, 51) * 0.4
    const v = 80 + hash2(i, 4, 51) * 110
    const px = x + Math.cos(a) * v * s
    const py = cy + Math.sin(a) * v * s * 0.8 + 140 * s * s
    if (s > 0.5 + hash2(i, 5, 51) * 0.35) continue
    const big = i % 3 === 0
    ctx.fillStyle = tone(type, r, i, true)
    ctx.fillRect(Math.round(px), Math.round(py), big ? 2 : 1, big ? 3 : 2)
    ctx.fillStyle = r[4]
    ctx.fillRect(Math.round(px), Math.round(py), 1, 1)
  }
}

/**
 * Over the whole screen (unless flashes are reduced): white swelling as the
 * crystal flashes, white for the shatter's first beat, then the type's color
 * washing over the world and out in four steps.
 */
export const drawTeraScreen = (ctx: Ctx, g: Game) => {
  const p = localPlayer(g)
  const type = p.tera.form
  if (!type) return
  const k = introK(p)
  const since = sinceShatter(p)
  let alpha = 0
  let color = '#ffffff'
  if (k >= 0.93) alpha = ((k - 0.93) / 0.07) * 0.55
  else if (k < 0 && since < 0.1) alpha = 0.55
  else if (k < 0 && since < 0.7) {
    color = type === 'stellar' ? STELLAR[Math.floor(since * 20) % STELLAR.length]! : TERA_RAMPS[type][2]
    alpha = 0.34 * (1 - Math.floor(((since - 0.1) / 0.6) * 4) / 4)
  }
  if (alpha <= 0) return
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.fillRect(0, 0, g.view.w, g.view.h)
  ctx.globalAlpha = 1
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
    // Its top thins out in a checker of light rather than in gaps.
    const thin = fade > 0.62
    ctx.fillStyle = type === 'stellar' ? STELLAR[Math.floor(y / 6 + t * 8) % STELLAR.length]! : r[2]
    if (thin) {
      for (let x = -half; x < half; x++) if ((x + y + Math.floor(t * 12)) % 2 === 0 || fade < 0.8) ctx.fillRect(den.x + x, yy, 1, 1)
    } else ctx.fillRect(den.x - half, yy, half * 2, 1)
    ctx.fillStyle = r[3]
    if (!thin || y % 2 === 0) ctx.fillRect(den.x - Math.max(1, half - 2), yy, Math.max(2, (half - 2) * 2), 1)
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
  // The giant's top (its crown's, roughly), for the framing (`frameRaid`).
  raidTop = y - bodyH - crownSprite(arena.raid.tera, crownSize(s)).height * 2
  const cy = y - bodyH / 2
  if (sh.up) {
    // A dome of crystal round the giant: a rim in the type's light, meridians and a band of facets across it,
    // turning slowly; its facets fall away as the shield runs down, the last ones blinking.
    const share = sh.max > 0 ? sh.hp / sh.max : 0
    const rx = s.bodyW + 12
    const ry = bodyH * 0.62 + 8
    const facets = 24
    const spin = t * 0.35
    for (let i = 0; i < facets; i++) {
      if (i / facets > share && !(i / facets - share < 0.05 && Math.floor(t * 10) % 2 === 0)) continue
      const a0 = (i / facets) * TAU + spin
      const a1 = ((i + 1) / facets) * TAU + spin
      const steps = 10
      for (let k = 0; k <= steps; k++) {
        const a = a0 + ((a1 - a0) * k) / steps
        const x = Math.round(e.x + Math.cos(a) * rx)
        const yy = Math.round(cy + Math.sin(a) * ry)
        // The rim: two pixels thick, its facet's seam bright, the upper-left lit.
        ctx.fillStyle = k === 0 ? r[4] : Math.cos(a - 2.4) > 0.3 ? r[3] : r[2]
        ctx.fillRect(x, yy, 2, 2)
        ctx.fillStyle = r[1]
        ctx.fillRect(Math.round(e.x + Math.cos(a) * (rx - 2)), Math.round(cy + Math.sin(a) * (ry - 2)), 1, 1)
      }
      // A meridian from every third facet's seam over the dome, and a dotted band of facets at its middle.
      if (i % 3 === 0 && !detail.lean) {
        const x0 = Math.cos(a0) * rx
        ctx.fillStyle = r[3]
        for (let k = -8; k <= 8; k++) {
          const v = k / 8
          if (k % 2 !== 0) continue
          ctx.fillRect(Math.round(e.x + x0 * Math.sqrt(1 - v * v) * 0.98), Math.round(cy + v * ry * 0.96), 1, 1)
        }
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

/* ---------------- Framing the raid ---------------- */

/** The giant's top as last drawn (world px), and the screen's room the HUD leaves (world px from the top and bottom). */
let raidTop: number | null = null
let raidRoom = { top: 0, bottom: 16 }
let nudge = 0
let nudgedAt = 0

/** The shell measures the boss bar's bottom and the room under the player (`syncMarkerInsets` in `main.ts`). */
export const setRaidRoom = (room: { top: number; bottom: number }) => {
  raidRoom = room
}

/**
 * The drawn camera in a raid on a short screen (a phone held sideways): the
 * simulation frames the player and the giant (`raidCamera`) without knowing
 * the HUD, so where the giant's top would sit under the boss bar, the drawn
 * camera rises until it clears it, as far as the player's feet stay on
 * screen above the room the touch controls take. Eased, and only ever up.
 * Writes `g.camera.y` from `base`, the camera as the frame would draw it
 * (the player's screen solo, the team view's in co-op); nothing outside a raid.
 */
export const frameRaid = (g: Game, t: number, base: number) => {
  const arena = g.raid.arena
  const p = localPlayer(g)
  if (!arena || raidTop === null || p.hp <= 0) {
    nudge = 0
    if (!arena) raidTop = null
    return
  }
  const camY = base
  const need = raidRoom.top + 4 - (raidTop - camY)
  const room = g.view.h - raidRoom.bottom - (p.y + 10 - camY)
  const want = need > 0 ? -Math.min(need, Math.max(0, room)) : 0
  const dt = Math.min(0.1, Math.max(0, t - nudgedAt))
  nudgedAt = t
  nudge += (want - nudge) * Math.min(1, dt * 6)
  g.camera.y = base + Math.round(nudge)
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

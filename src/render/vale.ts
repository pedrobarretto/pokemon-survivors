import { blitCentered, blitEllipse, blitPacked, canvasCache, context2d, createCanvas, fromStrings, lazy, textSprite, type PixelSprite } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import { VERSUS, type Team } from '../data/versus'
import { laneYAt, MAPS, type MapId, type MapLook, type MapTheme, type Rect, type VersusMap } from '../data/versusMaps'
import { channelTime, goalOpen, mapOf } from '../game/versusRules'
import type { GoalState, VersusState } from '../game/versus'
import type { Game, Player } from '../game/types'
import { localPlayer } from '../game/players'
import { teamFile, valeArt, type PostLook } from './arenaArt'
import { dashedRing } from './strokes'
import { concealed } from './valeGrass'
import { bannerOf, DRIFTWOOD, FLOWER_PATCHES, lampOf, LOG, MUSHROOMS, PEBBLES, SEAWEED, SHELLS, STARFISH, TALL_GRASS, TALL_GRASS_SMALL } from './valeDecor'

/**
 * The Arena's maps (`data/versusMaps.ts`) on screen, draw-only, all in the
 * same kit (each map's `look` says where its parts lie, its `theme` how they
 * look): its floor baked in 256 px tiles of code-authored pixel art (the
 * meadow's grass, worn dirt paths and hedge wall, or the coast's sand,
 * boardwalks, tidepools and the sea round it; the bases' flagstones tinted to
 * their team either way), the spawn pads and goal zones on the ground, the
 * goals' posts (standing among the Pokémon, `render/valeProps.ts`), the
 * Energy orbs, each scorer's channel arc and the goals' points left. The pads
 * and posts are PixelLab pictures (`render/arenaArt.ts`), a set per theme;
 * until they load, the code's own (`bakePad`, `bakePost`) stand in. `render`
 * calls the passes only while `g.versus` is set.
 */

type Ctx = CanvasRenderingContext2D
type RGB = readonly [number, number, number]

/** Each team's color: Blue (west, 0) and Red (east, 1). */
export const TEAM_COLORS = ['#4890f0', '#f05858'] as const satisfies readonly [string, string]
/** Lighter twins, for text and rims over the dark hedge and the grass. */
export const TEAM_LIGHT = ['#a8d0ff', '#ffb0a8'] as const satisfies readonly [string, string]

export const teamColor = (team: Team) => TEAM_COLORS[team]
export const teamLight = (team: Team) => TEAM_LIGHT[team]

const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]

/** `a` moved `k` of the way to `b`. */
const mix = (a: RGB, b: RGB, k: number): RGB => [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)]

/* ---------------- The floor: what stands where ---------------- */

/** Whether the world pixel (x, y) is on a map's floor (the union of its `rects`). */
export const onFloor = (rects: readonly Rect[], x: number, y: number) => {
  for (const r of rects) if (x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1) return true
  return false
}

export type FloorZone = 'base' | 'lane' | 'jungle' | 'passage'

/** Which part of a map (by its `look`) a floor pixel belongs to. Pure, for the bake (and its test). */
export const zoneAt = (look: MapLook, x: number, y: number): FloorZone => {
  if (x < -look.baseX || x >= look.baseX) return 'base'
  if (y < -look.laneFrom || y >= look.laneFrom) return 'lane'
  for (const j of look.jungles) if (x >= j.x0 && x < j.x1 && y >= j.y0 && y < j.y1) return 'jungle'
  return 'passage'
}

/** A camp's nest on the ground (its trampled floor and pebble ring), sized to what stands there. */
type Nest = { x: number; y: number; r: number }

/** A decor sprite baked into the floor with its top left at (x, y). */
type Decor = { sprite: () => PixelSprite; x: number; y: number }

/**
 * What the bake knows of a map, worked out once per map: its data, the
 * camps' nests, the spots on the lanes' paths the chevrons keep clear of
 * (|x| and how far), the box of its floor, its decor and its floor tiles.
 */
type Painter = {
  id: MapId
  map: VersusMap
  look: MapLook
  scenery: Scenery
  nests: readonly Nest[]
  clear: readonly { x: number; r: number }[]
  bounds: Rect
  /** The spawn pads' |x|: the carpet's arm runs from the gate to it. */
  pad: number
  decor: () => Decor[]
  tiles: () => readonly (readonly [number, number])[]
}

const painters = new Map<MapId, Painter>()

const painterOf = (id: MapId): Painter => {
  const known = painters.get(id)
  if (known) return known
  const map = MAPS[id]
  const look = map.look
  const nests = map.camps.map((c) => ({ x: c.x, y: c.y, r: c.count === 1 ? 24 : 14 + c.count * 2 }))
  const onPath = (x: number, y: number) => Math.abs(Math.abs(y) - laneYAt(look.lane, Math.abs(x))) < 30
  const P: Painter = {
    id,
    map,
    look,
    scenery: SCENERY[look.theme],
    nests,
    clear: [...map.goals.filter((goal) => onPath(goal.x, goal.y)).map((goal) => ({ x: Math.abs(goal.x), r: goal.r + 12 })), ...nests.filter((n) => onPath(n.x, n.y)).map((n) => ({ x: Math.abs(n.x), r: n.r + 8 }))],
    bounds: {
      x0: Math.min(...map.rects.map((r) => r.x0)),
      y0: Math.min(...map.rects.map((r) => r.y0)),
      x1: Math.max(...map.rects.map((r) => r.x1)),
      y1: Math.max(...map.rects.map((r) => r.y1)),
    },
    pad: Math.abs(map.spawn[1].x),
    decor: lazy(() => decorOf(P)),
    tiles: lazy(() => floorTilesOf(P)),
  }
  painters.set(id, P)
  return P
}

/* ---------------- Noise ---------------- */

const smooth = (t: number) => t * t * (3 - 2 * t)

/** Smooth value noise along a line (0..1), a knot every `step` px. */
const noise1 = (v: number, step: number, seed: number) => {
  const p = v / step
  const i = Math.floor(p)
  const f = smooth(p - i)
  return hash2(i, 0, seed) * (1 - f) + hash2(i + 1, 0, seed) * f
}

/** Smooth value noise over the plane (0..1), a knot every `step` px. */
const noise2 = (x: number, y: number, step: number, seed: number) => {
  const px = x / step
  const py = y / step
  const ix = Math.floor(px)
  const iy = Math.floor(py)
  const fx = smooth(px - ix)
  const fy = smooth(py - iy)
  const a = hash2(ix, iy, seed) * (1 - fx) + hash2(ix + 1, iy, seed) * fx
  const b = hash2(ix, iy + 1, seed) * (1 - fx) + hash2(ix + 1, iy + 1, seed) * fx
  return a * (1 - fy) + b * fy
}

/* ---------------- Palettes ---------------- */

const GRASS = { main: hex('#5ca24a'), alt: hex('#66ac52'), dark: hex('#4a8c3e'), light: hex('#80c262'), tuft: hex('#3e7e36') }
const JUNGLE = { main: hex('#3e7a3a'), alt: hex('#468442'), dark: hex('#30662e'), light: hex('#5a964a'), tuft: hex('#2a5c2a') }
const DIRT = { main: hex('#b48a5a'), alt: hex('#a87e4e'), dark: hex('#8c6a44'), light: hex('#d0ae7e') }
const STONE = { a: hex('#aca89e'), b: hex('#bab6ac'), grout: hex('#6e6c6a'), lit: hex('#d4d0c6') }
const HEDGE = { gap: hex('#0e2a16'), dark: hex('#1a4424'), mid: hex('#245a2e'), light: hex('#34723a'), leaf: hex('#46904a') }
const RIM = [hex('#5c9c4c'), hex('#3c7a3c')] as const
const FACE = [hex('#0c2012'), hex('#163a20'), hex('#1c4626'), hex('#1a4024')] as const
const SHADOW = hex('#0c1c10')
const FLOWERS = [hex('#f8f0f0'), hex('#f88aa8'), hex('#98b8f8')] as const
const POLLEN = hex('#f8d848')
const TINTS = [hex(TEAM_COLORS[0]), hex(TEAM_COLORS[1])] as const
const TEAM_LIGHT_RGB = [hex(TEAM_LIGHT[0]), hex(TEAM_LIGHT[1])] as const

/* ---------------- Ground patterns (world px) ---------------- */

/** Grass, two tones in soft patches, specks, tufts and (out of the jungle) a few flowers. */
const grassAt = (x: number, y: number, jungle: boolean, out: number[]) => {
  const p = jungle ? JUNGLE : GRASS
  const h = hash2(x, y, 11)
  // Tufts: a "v" of darker blades, one per lucky 8 px cell.
  const cx = Math.floor(x / 8)
  const cy = Math.floor(y / 8)
  if (hash2(cx, cy, 12) < 0.22) {
    const dx = x - (cx * 8 + Math.floor(hash2(cx, cy, 13) * 5))
    const dy = y - (cy * 8 + Math.floor(hash2(cx, cy, 14) * 5))
    if ((dy === 0 && (dx === 0 || dx === 2)) || (dy === 1 && dx === 1)) return set(out, dy === 0 ? p.tuft : p.dark)
  }
  if (!jungle) {
    const fx = Math.floor(x / 14)
    const fy = Math.floor(y / 14)
    if (hash2(fx, fy, 15) < 0.07) {
      const dx = x - (fx * 14 + 3 + Math.floor(hash2(fx, fy, 16) * 8))
      const dy = y - (fy * 14 + 3 + Math.floor(hash2(fx, fy, 17) * 8))
      if (dx === 0 && dy === 0) return set(out, POLLEN)
      if (Math.abs(dx) + Math.abs(dy) === 1) return set(out, FLOWERS[Math.floor(hash2(fx, fy, 18) * FLOWERS.length)]!)
    }
  }
  if (h < 0.05) return set(out, p.dark)
  if (h > 0.986) return set(out, p.light)
  return set(out, noise2(x, y, 22, jungle ? 21 : 20) > 0.55 ? p.alt : p.main)
}

/** Worn dirt: two tones, pebbles and light grains. */
const dirtAt = (x: number, y: number, out: number[]) => {
  const h = hash2(x, y, 31)
  if (h < 0.035) return set(out, DIRT.dark)
  if (h > 0.985) return set(out, DIRT.light)
  return set(out, noise2(x, y, 14, 32) > 0.58 ? DIRT.alt : DIRT.main)
}

/** Distance from (ax, ay) to the segment (x0, y0)–(x1, y1). */
const segmentDistance = (ax: number, ay: number, x0: number, y0: number, x1: number, y1: number) => {
  const dx = x1 - x0
  const dy = y1 - y0
  const k = Math.max(0, Math.min(1, ((ax - x0) * dx + (ay - y0) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(ax - x0 - k * dx, ay - y0 - k * dy)
}

/** How far (ax, ay), folded into the north-west, is from the lanes' path (`look.lane`, run on flat past the base's edge). */
const laneDistance = (look: MapLook, ax: number, ay: number) => {
  const lane = look.lane
  let best = ax >= lane[0]![0] ? Math.abs(ay - lane[0]![1]) : Infinity
  for (let i = 1; i < lane.length; i++) best = Math.min(best, segmentDistance(ax, ay, lane[i - 1]![0], lane[i - 1]![1], lane[i]![0], lane[i]![1]))
  return best
}

/** Where a floor pixel sits on the paths (`pathAt`): how deep in one (> 0 inside, the edge around 0), and whether the deepest runs north–south (a passage) or along (a lane, a way). */
type PathHit = { depth: number; upDown: boolean }

/**
 * How deep (x, y) sits in a path (`hit`): the lanes' paths along their
 * middle, the passages' columns from the lanes into the jungle, and the ways
 * along the middle (from each base into the jungle, from a cove to its
 * island). `ragged` gives the meadow's dirt its uneven edge; the coast's
 * boardwalks run straight.
 */
const pathAt = (look: MapLook, x: number, y: number, ragged: boolean, hit: PathHit) => {
  hit.depth = -Infinity
  hit.upDown = false
  const ax = Math.abs(x)
  const ay = Math.abs(y)
  if (ay >= look.laneFrom - 10) hit.depth = (ragged ? 17 + noise1(x, 18, 41) * 8 : 15) - laneDistance(look, ax, ay)
  for (const p of look.passages) {
    if (ay < p.from || ay > laneYAt(look.lane, Math.abs(p.x))) continue
    const d = (ragged ? 16 + noise1(y, 14, 42 + p.x) * 7 : 13) - Math.abs(x - p.x)
    if (d > hit.depth) {
      hit.depth = d
      hit.upDown = true
    }
  }
  for (const [a, b] of look.ways) {
    if (ax < a || ax > b) continue
    const d = (ragged ? 15 + noise1(x, 12, 43) * 6 : 13) - ay
    if (d > hit.depth) {
      hit.depth = d
      hit.upDown = false
    }
  }
  return hit
}

/**
 * The bases' carpet (px): its half width and the ball emblems' radius. It
 * runs north–south along the look's spine to both lanes' paths, and out from
 * the gate (where the base begins) to the spawn pad.
 */
const PLAZA = { half: 10, emblemR: 24 } as const
const GOLD = { lit: hex('#f0d070'), main: hex('#d8a840'), dark: hex('#7a5a28') }
const INK = hex('#282830')
const CREAM = { lit: hex('#fbf6ea'), main: hex('#ece2cc'), dark: hex('#c8bca0') }
const WHITE = hex('#ffffff')
const CARPETS = TINTS.map((c) => ({ main: mix(c, hex('#1c1c2c'), 0.38), lit: mix(c, WHITE, 0.18) }))

/** How deep (ax, ay) sits in a base's carpet (> 0 inside, its half width at the middle) and how far along it, or null off it. */
const carpetAt = (P: Painter, ax: number, ay: number): { depth: number; along: number } | null => {
  const { half } = PLAZA
  const { spine } = P.look.plaza
  const reach = P.look.lane[0]![1]
  const gate = P.look.baseX
  const pad = P.pad
  let best: { depth: number; along: number } | null = null
  const take = (depth: number, along: number) => {
    if (depth >= 0 && (!best || depth > best.depth)) best = { depth, along }
  }
  if (ay <= reach + half) take(half - Math.abs(ax - spine), ay)
  if (ax >= gate && ax <= pad) take(half - ay, ax)
  if (ax >= gate && ax <= spine + half) take(half - Math.abs(ay - reach), ax)
  return best
}

/** The ball emblem painted on the carpet, in the team's color over cream; false off it. */
const emblemAt = (dx: number, dy: number, team: Team, out: number[]) => {
  const d = Math.sqrt(dx * dx + dy * dy)
  const R = PLAZA.emblemR
  if (d > R) return false
  if (d > R - 1) set(out, INK)
  else if (d > R - 4) set(out, dx + dy < -R * 0.6 ? GOLD.lit : dx + dy > R * 0.9 ? GOLD.dark : GOLD.main)
  else if (d > R - 5) set(out, INK)
  else if (d <= 8) set(out, d > 6 ? INK : d > 4.5 ? CREAM.dark : dx + dy < -2 ? WHITE : CREAM.lit)
  else if (Math.abs(dy) <= 2) set(out, INK)
  else if (dy < 0) {
    set(out, dx + dy < -R * 0.7 ? CARPETS[team]!.lit : TINTS[team])
    if (dx + dy > R * 0.45) mixInto(out, out, hex('#101018'), 0.25)
  } else set(out, dx + dy > R * 0.7 ? CREAM.dark : CREAM.main)
  return true
}

const MOSS = hex('#6a9a4a')

/**
 * A base: wide bevelled flagstones (tinted toward the team, a moss speck in
 * the grout here and there), the team's carpet with gold trim and a diamond
 * weave from the spawn pad to every exit, and the ball emblems on it.
 */
const plazaAt = (P: Painter, x: number, y: number, out: number[]) => {
  const team: Team = x < 0 ? 0 : 1
  const ax = Math.abs(x)
  const ay = Math.abs(y)
  const { spine, emblemY } = P.look.plaza
  if (emblemAt(ax - spine, y - (y < 0 ? -emblemY : emblemY), team, out)) return
  const carpet = carpetAt(P, ax, ay)
  if (carpet) {
    const { depth, along } = carpet
    if (depth < 1) return set(out, GOLD.dark)
    if (depth < 3) return set(out, depth < 2 ? GOLD.main : GOLD.lit)
    if (depth < 4) return set(out, GOLD.dark)
    const u = ((Math.floor(along) % 14) + 14) % 14
    const v = PLAZA.half - 4 - depth
    const k = Math.abs(u - 7) + Math.abs(v + 3)
    return set(out, k === 3 ? GOLD.main : k < 3 ? CARPETS[team]!.lit : CARPETS[team]!.main)
  }
  const { stones, lit, edge, grout, fleck } = P.scenery.plaza
  const W = 26
  const H = 16
  const row = Math.floor((y + 1400) / H)
  const sx = x + 1400 + (row % 2) * 13
  const col = Math.floor(sx / W)
  const lx = sx - col * W
  const ly = y + 1400 - row * H
  if (lx === 0 || ly === 0) set(out, hash2(x, y, 53) < 0.07 ? fleck : grout)
  else {
    const tone = stones[Math.floor(hash2(col, row, 51) * stones.length)]!
    set(out, lx === 1 || ly === 1 ? lit : lx === W - 1 || ly === H - 1 ? edge : hash2(x, y, 52) < 0.03 ? edge : tone)
  }
  mixInto(out, out, TINTS[team], 0.1)
}

/** The center's stone ring (radii, world px), where Drednaw and Zapdos come down. */
const CENTER = { inner: 50, outer: 60 } as const
const SAND = { main: hex('#c8a870'), alt: hex('#bc9c64'), line: hex('#e4cc98'), dark: hex('#9c7c4c') }

/** The center: a ring of stone blocks round trodden sand, a painted circle inside; false off it. (x, y) from the center; (wx, wy) the world pixel. */
const centerAt = (S: Scenery, x: number, y: number, wx: number, wy: number, out: number[]) => {
  const d = Math.sqrt(x * x + y * y)
  const { inner, outer } = CENTER
  if (d > outer + 3) return false
  if (d > outer) {
    S.ground(wx, wy, true, out)
    mixInto(out, out, SHADOW, 0.3)
    return true
  }
  if (d > inner) {
    const arc = (Math.atan2(y, x) + Math.PI) * ((inner + outer) / 2)
    const block = Math.floor(arc / 13)
    const ring = S.ring
    if (d > outer - 1 || d <= inner + 1 || arc - block * 13 < 1) set(out, d > outer - 1 ? INK : ring.grout)
    else set(out, d < inner + 3 || y < -inner ? ring.lit : hash2(block, 0, 54) < 0.5 ? ring.a : ring.b)
    if (hash2(x, y, 55) < 0.05) mixInto(out, out, ring.fleck, 0.6)
    return true
  }
  const painted = Math.abs(d - 30) < 1 || (d < 6 && (Math.abs(x) < 1.5 || Math.abs(y) < 1.5))
  set(out, painted ? SAND.line : hash2(x, y, 56) < 0.04 ? SAND.dark : noise2(x, y, 12, 57) > 0.55 ? SAND.alt : SAND.main)
  // The ring's shadow on the sand under its north side.
  if (d > inner - 4 && y < 0) mixInto(out, out, SHADOW, 0.25)
  return true
}

const PEBBLE = { lit: hex('#d8d4c8'), main: hex('#9e9a90'), dark: hex('#5e5c58') }
const TRAMPLE = hex('#6e5a38')

/** Over a camp's nest, the floor gets trampled and a ring of pebbles. */
const nestAt = (P: Painter, x: number, y: number, out: number[]) => {
  for (const n of P.nests) {
    const dx = x - n.x
    const dy = y - n.y
    if (Math.abs(dx) > n.r + 1 || Math.abs(dy) > n.r + 1) continue
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d > n.r + 0.5) continue
    if (d > n.r - 2.5) {
      const seg = Math.floor(((Math.atan2(dy, dx) + Math.PI) * n.r) / 3)
      if (hash2(seg, n.r, 58) < 0.72) set(out, d > n.r - 0.5 ? PEBBLE.dark : dy < 0 ? PEBBLE.lit : PEBBLE.main)
    } else if (d < n.r - 4) mixInto(out, out, TRAMPLE, 0.18 + (hash2(x, y, 59) < 0.1 ? 0.12 : 0))
    return
  }
}

/** The lanes' paths: faint chevrons in each half's team color, pointing at the rival side, and the midline. */
const chevronAt = (P: Painter, x: number, y: number, out: number[]) => {
  const v = Math.abs(y) - laneYAt(P.look.lane, Math.abs(x))
  if (Math.abs(v) > 6 || Math.abs(x) > P.look.baseX - 40) return
  if (Math.abs(x) < 1) return mixInto(out, out, STONE.lit, hash2(0, y, 60) < 0.8 ? 0.7 : 0.3)
  const ax = Math.abs(x)
  // Clear of the midline and of the goals and camps on the path.
  if (ax < 34) return
  for (const c of P.clear) if (Math.abs(ax - c.x) < c.r) return
  // Apex toward the middle: each half's chevrons point the way its team attacks.
  const u = (((ax - 18) % 70) + 70) % 70
  const k = u - 30 - Math.abs(v)
  if (k === 0 || k === 1) mixInto(out, out, TEAM_LIGHT_RGB[x < 0 ? 0 : 1], 0.55)
}

/**
 * The hedge wall: round leafy clumps, lit from the top left, dark gaps
 * between. Repeats every 256 px (its cells hashed modulo 32), so a tile with
 * no floor near it is the same everywhere and baked once.
 */
const hedgeAt = (x: number, y: number, out: number[]) => {
  const C = 8
  const cx = Math.floor(x / C)
  const cy = Math.floor(y / C)
  let best = Infinity
  let bdx = 0
  let bdy = 0
  let br = 1
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const kx = (((cx + i) % 32) + 32) % 32
      const ky = (((cy + j) % 32) + 32) % 32
      const ox = (cx + i) * C + 1 + hash2(kx, ky, 61) * 6
      const oy = (cy + j) * C + 1 + hash2(kx, ky, 62) * 6
      const r = 5 + hash2(kx, ky, 63) * 2.5
      const dx = x + 0.5 - ox
      const dy = y + 0.5 - oy
      const d = Math.sqrt(dx * dx + dy * dy) - r
      if (d < best) {
        best = d
        bdx = dx
        bdy = dy
        br = r
      }
    }
  }
  if (best > 0) return set(out, HEDGE.gap)
  const k = (-bdx * 0.55 - bdy * 0.75) / br
  const px = ((x % 256) + 256) % 256
  const py = ((y % 256) + 256) % 256
  if (hash2(px, py, 64) < 0.05) return set(out, HEDGE.leaf)
  return set(out, k > 0.4 ? HEDGE.light : k > -0.35 ? HEDGE.mid : HEDGE.dark)
}

const set = (out: number[], c: RGB) => {
  out[0] = c[0]
  out[1] = c[1]
  out[2] = c[2]
}

const mixInto = (out: number[], a: RGB | number[], b: RGB, k: number) => {
  out[0] = Math.round(a[0]! + (b[0] - a[0]!) * k)
  out[1] = Math.round(a[1]! + (b[1] - a[1]!) * k)
  out[2] = Math.round(a[2]! + (b[2] - a[2]!) * k)
}

const HIT: PathHit = { depth: 0, upDown: false }

/** A floor pixel's color before the wall's shadows. */
const floorAt = (P: Painter, x: number, y: number, out: number[]) => {
  const S = P.scenery
  const zone = zoneAt(P.look, x, y)
  if (zone === 'base') return plazaAt(P, x, y, out)
  if (zone === 'jungle' && centerAt(S, x - P.map.center.x, y - P.map.center.y, x, y, out)) return
  const hit = pathAt(P.look, x, y, S.ragged, HIT)
  if (S.path(x, y, hit, out)) {
    if (zone === 'lane') chevronAt(P, x, y, out)
  } else S.ground(x, y, zone === 'jungle', out)
  nestAt(P, x, y, out)
}

/* ---------------- Sceneries ---------------- */

type Stones = { a: RGB; b: RGB; grout: RGB; lit: RGB; fleck: RGB }

/**
 * How a theme paints a map (`MapLook.theme`): its ground (the open floor,
 * darker in the jungle), its paths (true where (x, y) is on one), the wall
 * round the floor and its edge on the floor below, the bases' flagstones,
 * the center's ring, and its decor sprites.
 */
type Scenery = {
  ground: (x: number, y: number, jungle: boolean, out: number[]) => void
  /** Paints a path pixel and says so, or leaves `out` alone off the paths. */
  path: (x: number, y: number, hit: PathHit, out: number[]) => boolean
  /** Whether paths fray (`pathAt`). */
  ragged: boolean
  /** A wall pixel `south` px above the floor (0: not within 6), or `near` px beside or below it (0: not within 2). */
  wall: (x: number, y: number, south: number, near: number, out: number[]) => void
  /** A floor pixel `north` px below the wall (0: not within 6), or (`side`) beside it. */
  edge: (x: number, y: number, north: number, side: boolean, out: number[]) => void
  plaza: { stones: readonly RGB[]; lit: RGB; edge: RGB; grout: RGB; fleck: RGB }
  ring: Stones
  /** The jungle's clumps (a big one, a small one), the lanes' verge sprites (three) and the rare one among them, and the logs. */
  jungle: readonly [() => PixelSprite, () => PixelSprite]
  verge: () => readonly PixelSprite[]
  rare: () => PixelSprite
  log: () => PixelSprite
}

/** The Vale's and the Clareira's: grass, worn dirt paths, a hedge wall casting its shadow. */
const MEADOW: Scenery = {
  ground: grassAt,
  path: (x, y, hit, out) => {
    // The path's edge frays: grass and dirt dither over a couple of pixels.
    const { depth } = hit
    if (!(depth > 1.5 || (depth > -1.5 && hash2(x, y, 44) < (depth + 1.5) / 3))) return false
    dirtAt(x, y, out)
    return true
  },
  ragged: true,
  wall: (x, y, south, near, out) => {
    // South of the hedge, where the floor lies below, its front face shows; elsewhere a lit rim.
    if (south) {
      hedgeAt(x, y, out)
      const face = south === 1 ? FACE[0] : FACE[1 + ((((Math.floor(x / 2) + south) % 3) + 3) % 3)]!
      if (south <= 2 || hash2(x, y, 71) < 0.7) set(out, face)
    } else if (near) set(out, RIM[near - 1]!)
    else hedgeAt(x, y, out)
  },
  edge: (_x, _y, north, side, out) => {
    // The hedge casts a shadow down onto the floor below it, and a thin one at its other edges.
    if (north) mixInto(out, out, SHADOW, 0.5 - north * 0.065)
    else if (side) mixInto(out, out, SHADOW, 0.25)
  },
  plaza: { stones: [hex('#d2c6aa'), hex('#dcd2b8'), hex('#c8bc9e')], lit: hex('#eee6d0'), edge: hex('#b4a888'), grout: hex('#8c8068'), fleck: MOSS },
  ring: { ...STONE, fleck: MOSS },
  jungle: [TALL_GRASS, TALL_GRASS_SMALL],
  verge: FLOWER_PATCHES,
  rare: MUSHROOMS,
  log: LOG,
}

const BEACH = { main: hex('#e6d2a0'), alt: hex('#dfc994'), dark: hex('#c8ac78'), light: hex('#f6ead2') }
const WET = { main: hex('#c2ae86'), alt: hex('#b9a47c'), dark: hex('#9c8862'), light: hex('#d6c69e') }
const POOL = { deep: hex('#5aaebc'), main: hex('#78c2c6'), rim: hex('#b2dcd4'), glint: hex('#e8f8f4') }
const SHELL_SPECKS = [hex('#f6f0e6'), hex('#f0b4a8'), hex('#e8c8e0')] as const
const SEA = { deep: hex('#1a5e80'), main: hex('#21698c'), alt: hex('#1d6286'), crest: hex('#5cb0cc'), trough: hex('#164e6c') }
/** The shore, out from the sand: foam, the surf's lighter water, then the shallows (`COAST.wall`). */
const SURF = [hex('#f4f8f2'), hex('#bfe6e4'), hex('#6cc4cc'), hex('#4aa8bc'), hex('#3794b0'), hex('#2a7ea0')] as const
const WOOD = { main: hex('#a8784a'), alt: hex('#9a6c40'), light: hex('#c4925e'), gap: hex('#5c3c22'), rail: hex('#4a2e18'), beam: hex('#7a5232'), nail: hex('#d8c8b0') }

/** Sand (the tidepool flats in the jungle: wet sand with pools), shell specks and tiny pebbles. */
const sandAt = (x: number, y: number, jungle: boolean, out: number[]) => {
  const p = jungle ? WET : BEACH
  if (jungle) {
    const n = noise2(x, y, 26, 23)
    if (n > 0.78) return set(out, hash2(x, y, 24) < 0.012 ? POOL.glint : n > 0.84 ? POOL.deep : POOL.main)
    if (n > 0.765) return set(out, POOL.rim)
  }
  const h = hash2(x, y, 11)
  if (h < 0.004) return set(out, SHELL_SPECKS[Math.floor(hash2(x, y, 25) * SHELL_SPECKS.length)]!)
  if (h < 0.04) return set(out, p.dark)
  if (h > 0.985) return set(out, p.light)
  set(out, noise2(x, y, 22, jungle ? 21 : 20) > 0.55 ? p.alt : p.main)
  // Ripples the wind left: faint broken diagonal bands, in patches.
  if (!jungle && (((x + Math.floor(y * 0.5) + Math.floor(noise1(y, 30, 26) * 9)) % 11) + 11) % 11 === 0 && noise2(x, y, 40, 29) > 0.5) mixInto(out, out, p.light, 0.45)
}

/** A boardwalk: planks across the way it runs, dark gaps between, a nail here and there, a beam at each side. */
const boardwalkAt = (x: number, y: number, hit: PathHit, out: number[]) => {
  const { depth } = hit
  if (depth <= 0) return false
  if (depth < 1.5) return (set(out, WOOD.rail), true)
  if (depth < 3) return (set(out, WOOD.beam), true)
  const along = hit.upDown ? y : x
  const across = hit.upDown ? x : y
  const plank = Math.floor(along / 5)
  const u = along - plank * 5
  if (u === 0) return (set(out, WOOD.gap), true)
  if (u === 1 && (((across % 9) + 9) % 9 === 4) && depth > 4) return (set(out, WOOD.nail), true)
  const tone = hash2(plank, 0, 27)
  set(out, u === 1 ? WOOD.light : tone < 0.3 ? WOOD.alt : WOOD.main)
  if (hash2(x, y, 28) < 0.04) mixInto(out, out, WOOD.gap, 0.35)
  return true
}

/** The open sea round the coast, waves cresting in short light dashes; repeats every 256 px, like the hedge. */
const seaAt = (x: number, y: number, out: number[]) => {
  const cx = Math.floor(x / 12)
  const cy = Math.floor(y / 6)
  const kx = ((cx % 21) + 21) % 21
  const ky = ((cy % 42) + 42) % 42
  if (hash2(kx, ky, 72) < 0.28) {
    const ox = cx * 12 + Math.floor(hash2(kx, ky, 73) * 6)
    const oy = cy * 6 + 2
    const dx = x - ox
    if (dx >= 0 && dx < 5) {
      if (y === oy) return set(out, SEA.crest)
      if (y === oy + 1 && dx > 0 && dx < 4) return set(out, SEA.trough)
    }
  }
  return set(out, noise2(((x % 256) + 256) % 256, ((y % 256) + 256) % 256, 32, 74) > 0.55 ? SEA.alt : hash2(x, y, 75) < 0.04 ? SEA.deep : SEA.main)
}

/** The Enseada's and the Recife's: sand and tidepools, boardwalks, the sea round it all with surf at the shore. */
const COAST: Scenery = {
  ground: sandAt,
  path: boardwalkAt,
  ragged: false,
  wall: (x, y, south, near, out) => {
    // From the sand out: foam, surf, the shallows, the sea; the surf's line wavers.
    const d = south || near
    if (!d) return seaAt(x, y, out)
    const k = d - 1 + (hash2(x, Math.floor(y / 3), 76) < 0.25 ? 1 : 0)
    if (k < SURF.length) set(out, SURF[k]!)
    else seaAt(x, y, out)
  },
  edge: (x, y, north, side, out) => {
    // The sand by the water is wet: darker toward the surf.
    if (north) mixInto(out, out, WET.dark, 0.55 - north * 0.08)
    else if (side) mixInto(out, out, WET.dark, 0.35)
    if ((north === 1 || side) && hash2(x, y, 77) < 0.2) set(out, SURF[1])
  },
  plaza: { stones: [hex('#e6dccb'), hex('#eee6d6'), hex('#dcd2be')], lit: hex('#faf6ec'), edge: hex('#c6baa2'), grout: hex('#a8987c'), fleck: BEACH.dark },
  ring: { a: hex('#e0a898'), b: hex('#d49888'), grout: hex('#8a5448'), lit: hex('#f6cfc0'), fleck: hex('#4aa0a0') },
  jungle: [SEAWEED, PEBBLES],
  verge: SHELLS,
  rare: STARFISH,
  log: DRIFTWOOD,
}

const SCENERY: Record<MapTheme, Scenery> = { meadow: MEADOW, coast: COAST }

/* ---------------- Decor ---------------- */

/** Spots decor stays off: the goals, the pads, the camps, the center, the cover and the paths. */
const keepsClear = (P: Painter, x: number, y: number, r: number) => {
  const map = P.map
  for (const goal of map.goals) if (Math.hypot(x - goal.x, y - goal.y) < goal.r + r + 6) return true
  for (const pad of map.spawn) if (Math.hypot(x - pad.x, y - pad.y) < VERSUS.spawnPad.r + r + 6) return true
  for (const n of P.nests) if (Math.hypot(x - n.x, y - n.y) < n.r + r + 8) return true
  for (const s of map.solids) if (Math.hypot(x - s.x, y - s.y) < r + 22) return true
  if (Math.hypot(x - map.center.x, y - map.center.y) < CENTER.outer + r + 10) return true
  return pathAt(P.look, x, y, P.scenery.ragged, HIT).depth > -r - 4
}

/** Whether a sprite `w`×`h` at top left (x, y) lies wholly on the floor, a few px clear of the hedge. */
const fits = (P: Painter, x: number, y: number, w: number, h: number) => {
  const rects = P.map.rects
  return onFloor(rects, x - 3, y - 3) && onFloor(rects, x + w + 3, y - 3) && onFloor(rects, x - 3, y + h + 3) && onFloor(rects, x + w + 3, y + h + 3)
}

/**
 * Every piece of decor on a map, placed once: each base's banners on the
 * wall behind it and lamps round its plaza, the scenery's jungle clumps (tall
 * grass; seaweed and pebbles), its lanes' verge sprites (flowers and the odd
 * mushroom; shells and the odd starfish) and the fallen logs or driftwood.
 * Hashed spots, the same on every device.
 */
const decorOf = (P: Painter): Decor[] => {
  const { look, bounds } = P
  const out: Decor[] = []
  for (const team of [0, 1] as const) {
    const sx = team === 0 ? -1 : 1
    for (const ax of look.banners.xs) out.push({ sprite: () => bannerOf(team), x: sx * ax - 5, y: look.banners.y })
    for (const [ax, ay] of look.lamps) out.push({ sprite: () => lampOf(team), x: sx * ax - 3, y: ay - 13 })
  }
  const S = P.scenery
  for (const [x, y] of look.logs) out.push({ sprite: S.log, x, y })
  for (const j of look.jungles) {
    for (let cy = j.y0; cy < j.y1; cy += 26) {
      for (let cx = j.x0; cx < j.x1; cx += 30) {
        const h = hash2(cx, cy, 91)
        if (h > 0.5) continue
        const x = cx + Math.floor(hash2(cx, cy, 92) * 18)
        const y = cy + Math.floor(hash2(cx, cy, 93) * 14)
        const sprite = S.jungle[h < 0.2 ? 1 : 0]
        if (zoneAt(look, x, y) !== 'jungle' || keepsClear(P, x + 6, y + 4, 8) || !fits(P, x, y, 12, 8)) continue
        out.push({ sprite, x, y })
      }
    }
  }
  for (let cy = bounds.y0; cy < bounds.y1; cy += 22) {
    if (Math.abs(cy) < look.laneFrom - 10) continue
    for (let cx = -look.baseX; cx < look.baseX; cx += 34) {
      const h = hash2(cx, cy, 94)
      if (h > 0.2) continue
      const x = cx + Math.floor(hash2(cx, cy, 95) * 20)
      const y = cy + Math.floor(hash2(cx, cy, 96) * 12)
      if (zoneAt(look, x, y) !== 'lane' || keepsClear(P, x + 3, y + 3, 4) || !fits(P, x, y, 7, 7)) continue
      out.push({ sprite: h < 0.04 ? S.rare : () => S.verge()[Math.floor(hash2(cx, cy, 97) * 3)]!, x, y })
    }
  }
  return out
}

/** Bakes the decor overlapping the tile at world (ox, oy) onto it. */
const stampDecor = (P: Painter, ctx: CanvasRenderingContext2D, ox: number, oy: number) => {
  for (const d of P.decor()) {
    const s = d.sprite()
    if (d.x + s.width <= ox || d.x >= ox + TILE || d.y + s.height <= oy || d.y >= oy + TILE) continue
    ctx.drawImage(s, d.x - ox, d.y - oy)
  }
}

/* ---------------- Baking ---------------- */

const TILE = 256
/** How far past a tile its floor mask reaches (the rims and shadows look that far). */
const M = 8
const SPAN = TILE + M * 2

/** Whether a tile (`tx`, `ty` in tiles) has no floor within `M` px: all wall, its scenery's shared tile. */
const pureWall = (P: Painter, tx: number, ty: number) => {
  const x0 = tx * TILE - M
  const y0 = ty * TILE - M
  const x1 = x0 + SPAN
  const y1 = y0 + SPAN
  return !P.map.rects.some((r) => r.x0 < x1 && r.x1 > x0 && r.y0 < y1 && r.y1 > y0)
}

/** Bakes `P`'s tile whose top left is world (ox, oy), or (`P` null) the all-wall tile of `theme`. */
const bake = (P: Painter | null, S: Scenery, ox: number, oy: number) => {
  const mask = new Uint8Array(SPAN * SPAN)
  if (P) for (let py = 0; py < SPAN; py++) for (let px = 0; px < SPAN; px++) mask[py * SPAN + px] = onFloor(P.map.rects, ox + px - M, oy + py - M) ? 1 : 0
  const at = (px: number, py: number) => mask[(py + M) * SPAN + px + M] === 1
  const canvas = createCanvas(TILE, TILE)
  const ctx = context2d(canvas)
  const img = ctx.createImageData(TILE, TILE)
  const c = [0, 0, 0]
  for (let py = 0; py < TILE; py++) {
    for (let px = 0; px < TILE; px++) {
      const x = ox + px
      const y = oy + py
      if (P && at(px, py)) {
        floorAt(P, x, y, c)
        // The wall's edge on the floor: how far below it (up to 6 px), or whether it's beside one.
        let north = 0
        for (let d = 1; d <= 6 && !north; d++) if (!at(px, py - d)) north = d
        P.scenery.edge(x, y, north, !north && (!at(px - 1, py) || !at(px + 1, py) || !at(px, py + 1)), c)
      } else {
        // The wall by the floor: how far above it (up to 6 px), or how near beside or below it (up to 2).
        let south = 0
        for (let d = 1; d <= 6 && !south; d++) if (at(px, py + d)) south = d
        let near = 0
        if (!south) for (let d = 1; d <= 2 && !near; d++) if (at(px - d, py) || at(px + d, py) || at(px, py - d)) near = d
        S.wall(x, y, south, near, c)
      }
      const i = (py * TILE + px) * 4
      img.data[i] = c[0]!
      img.data[i + 1] = c[1]!
      img.data[i + 2] = c[2]!
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  if (P) stampDecor(P, ctx, ox, oy)
  return canvas
}

/** The baked tiles of one map (`tilesOf`): a match on another map drops them first. */
const tiles = canvasCache<number, HTMLCanvasElement>()
let tilesOf: MapId | null = null
const keyOf = (tx: number, ty: number) => (tx + 512) * 1024 + (ty + 512)
/** Each scenery's tile with no floor near it: the same everywhere, baked once. */
const WALL_TILES = { meadow: lazy(() => bake(null, MEADOW, 0, 0)), coast: lazy(() => bake(null, COAST, 0, 0)) } satisfies Record<MapTheme, () => HTMLCanvasElement>

const tileAt = (P: Painter, tx: number, ty: number) => {
  if (pureWall(P, tx, ty)) return WALL_TILES[P.look.theme]()
  if (tilesOf !== P.id) {
    dropVale()
    tilesOf = P.id
  }
  const key = keyOf(tx, ty)
  let tile = tiles.get(key)
  if (!tile) tiles.set(key, (tile = bake(P, P.scenery, tx * TILE, ty * TILE)))
  return tile
}

/** Every tile of a map with floor in it, nearest the middle first. */
const floorTilesOf = (P: Painter) => {
  const b = P.bounds
  const x0 = Math.floor((b.x0 - M) / TILE)
  const x1 = Math.floor((b.x1 + M) / TILE)
  const y0 = Math.floor((b.y0 - M) / TILE)
  const y1 = Math.floor((b.y1 + M) / TILE)
  const out: [number, number][] = []
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (!pureWall(P, tx, ty)) out.push([tx, ty])
  return out.sort((a, b) => Math.hypot(a[0] + 0.5, a[1] + 0.5) - Math.hypot(b[0] + 0.5, b[1] + 0.5))
}

/** Bakes one of `map`'s tiles not baked yet (idle time, `warmScenery`), so walking into one never stalls a frame. True if it baked one. */
export const warmVale = (map: MapId) => {
  const P = painterOf(map)
  const missing = tilesOf === map ? P.tiles().find(([tx, ty]) => !tiles.has(keyOf(tx, ty))) : P.tiles()[0]
  if (!missing) return false
  tileAt(P, missing[0], missing[1])
  return true
}

/** Frees the baked tiles (about 0.25 MB each) once no match is on. */
export const dropVale = () => {
  tilesOf = null
  if (tiles.size === 0) return
  for (const tile of tiles.values()) tile.width = tile.height = 0
  tiles.clear()
}

/** `map`'s floor for the view at (camX, camY), `w`×`h` (whole px). Replaces the world's ground in a match. */
export const drawValeFloor = (ctx: Ctx, map: MapId, camX: number, camY: number, w: number, h: number) => {
  const P = painterOf(map)
  for (let ty = Math.floor(camY / TILE); ty <= Math.floor((camY + h - 1) / TILE); ty++) {
    for (let tx = Math.floor(camX / TILE); tx <= Math.floor((camX + w - 1) / TILE); tx++) ctx.drawImage(tileAt(P, tx, ty), tx * TILE - camX, ty * TILE - camY)
  }
}

/* ---------------- Pads and goals ---------------- */

type ZoneLook = PostLook | 'pad'

const rgba = (c: ArrayLike<number>, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

/**
 * A zone on the ground as one sprite: a disc of radius `r` filled faintly in
 * the team's color, its rim, an inner dashed ring and a faint diagonal hatch;
 * a locked goal dim, a broken one grey and cracked, a spawn pad with healing crosses.
 */
const bakeZone = (team: Team, look: ZoneLook, r: number) => {
  const size = r * 2 + 3
  const c = size / 2
  const canvas = createCanvas(size, size)
  const ctx = context2d(canvas)
  const grey = hex('#8a8a90')
  const color = look === 'broken' ? grey : TINTS[team]
  const dark: number[] = [0, 0, 0]
  mixInto(dark, color, hex('#101018'), 0.45)
  const light: number[] = [0, 0, 0]
  mixInto(light, color, hex('#ffffff'), 0.45)
  const fill = look === 'open' ? 0.26 : look === 'pad' ? 0.18 : look === 'locked' ? 0.12 : 0.22
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx = px + 0.5 - c
      const dy = py + 0.5 - c
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d > r + 1) continue
      let style: string
      if (d > r) style = rgba(dark, look === 'locked' ? 0.6 : 0.9)
      else if (d > r - 2) style = look === 'locked' ? rgba(color, 0.55) : rgba(look === 'broken' ? color : light, 0.95)
      else if (d > r - 9 && d <= r - 7 && Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * 24) % 2 === 0) style = rgba(color, look === 'locked' ? 0.3 : 0.6)
      else style = rgba(color, fill + ((px + py) % 6 === 0 ? 0.08 : 0))
      ctx.fillStyle = style
      ctx.fillRect(px, py, 1, 1)
    }
  }
  if (look === 'broken') {
    // Cracks: jagged rays from the middle.
    for (let k = 0; k < 6; k++) {
      let a = (k / 6) * Math.PI * 2 + hash2(k, r, 81) * 0.6
      for (let d = 3; d < r - 2; d++) {
        a += (hash2(k, d, 82) - 0.5) * 0.25
        const x = Math.round(c + Math.cos(a) * d - 0.5)
        const y = Math.round(c + Math.sin(a) * d - 0.5)
        ctx.fillStyle = '#383840'
        ctx.fillRect(x, y, 1, 1)
        ctx.fillStyle = '#b0b0b8'
        ctx.fillRect(x, y + 1, 1, 1)
      }
    }
  }
  return canvas
}

/**
 * A team's spawn pad in code, until its picture loads: a ring of stone blocks
 * in the team's trim round a glassy disc of its color, a big healing cross in
 * the middle, small ones round it. Opaque at the rim, so it reads as a place on the plaza.
 */
const bakePad = (team: Team, r: number) => {
  const size = r * 2 + 3
  const c = size / 2
  const canvas = createCanvas(size, size)
  const ctx = context2d(canvas)
  const color = TINTS[team]
  const light: number[] = [0, 0, 0]
  mixInto(light, color, WHITE, 0.55)
  const dark: number[] = [0, 0, 0]
  mixInto(dark, color, hex('#101018'), 0.5)
  const stone = r - 9
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx = px + 0.5 - c
      const dy = py + 0.5 - c
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d > r + 1) continue
      let style: string
      if (d > r) style = rgba(INK, 0.9)
      else if (d > r - 2) style = rgba(dy < 0 ? light : color, 1)
      else if (d > stone + 1) {
        const block = Math.floor(((Math.atan2(dy, dx) + Math.PI) * (r - 5)) / 11)
        const edge = Math.floor(((Math.atan2(dy, dx) + Math.PI) * (r - 5)) % 11) === 0
        style = edge || d < stone + 2 ? rgba(STONE.grout, 1) : rgba(dy < -stone * 0.4 ? STONE.lit : hash2(block, 1, 83) < 0.5 ? STONE.a : STONE.b, 1)
      } else if (d > stone) style = rgba(dark, 1)
      else {
        const cross = (Math.abs(dx) < 4 && Math.abs(dy) < 13) || (Math.abs(dy) < 4 && Math.abs(dx) < 13)
        const rim = (Math.abs(dx) < 5 && Math.abs(dy) < 14) || (Math.abs(dy) < 5 && Math.abs(dx) < 14)
        style = cross ? rgba(dx + dy < -6 ? WHITE : light, 0.95) : rim ? rgba(dark, 0.7) : rgba(color, 0.32 + ((px + py) % 4 === 0 ? 0.08 : 0))
      }
      ctx.fillStyle = style
      ctx.fillRect(px, py, 1, 1)
    }
  }
  // Small crosses round the cross, on the glass.
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4
    const x = Math.round(c + Math.cos(a) * (stone - 9))
    const y = Math.round(c + Math.sin(a) * (stone - 9))
    ctx.fillStyle = rgba(light, 0.9)
    ctx.fillRect(x - 2, y, 5, 1)
    ctx.fillRect(x, y - 2, 1, 5)
  }
  return canvas
}

const zones = canvasCache<string, PixelSprite>()
const zoneSprite = (team: Team, look: ZoneLook, r: number) => {
  const key = `${team}:${look}:${r}`
  let s = zones.get(key)
  if (!s) zones.set(key, (s = look === 'pad' ? bakePad(team, r) : bakeZone(team, look, r)))
  return s
}

/* ---------------- Goal posts ---------------- */

/** The post's size and where its hoop sits on it (sprite px). */
const POST = { w: 21, h: 33, hx: 10.5, hy: 9.5, outer: 9.5, inner: 5.5, foot: 29 } as const

/**
 * A goal's post in code, until its picture loads: a hoop in the team's colors on a pole over a
 * stone pedestal. Shut, it greys over with a chain across the hoop (the
 * padlock goes on top); broken, the pole is a snapped stump with the hoop in
 * pieces at its foot.
 */
const bakePost = (team: Team, look: PostLook) => {
  const canvas = createCanvas(POST.w, POST.h)
  const ctx = context2d(canvas)
  const dot = (x: number, y: number, c: ArrayLike<number>, a = 1) => {
    ctx.fillStyle = rgba(c, a)
    ctx.fillRect(x, y, 1, 1)
  }
  const grey = hex('#8a8a92')
  const color: number[] = [0, 0, 0]
  mixInto(color, TINTS[team], grey, look === 'open' ? 0 : look === 'locked' ? 0.6 : 1)
  const light: number[] = [0, 0, 0]
  mixInto(light, color, WHITE, 0.5)
  const dark: number[] = [0, 0, 0]
  mixInto(dark, color, hex('#101018'), 0.5)
  // The pedestal.
  const cx = POST.hx
  const fy = POST.foot
  for (let y = fy - 4; y <= fy + 3; y++) {
    for (let x = 0; x < POST.w; x++) {
      const e = ((x + 0.5 - cx) / 8) ** 2 + ((y + 0.5 - fy) / 3.6) ** 2
      if (e > 1) continue
      const top = ((x + 0.5 - cx) / 8) ** 2 + ((y + 0.5 - (fy - 1)) / 2.6) ** 2 <= 1
      dot(x, y, e > 0.72 ? INK : top ? (x < cx - 2 ? STONE.lit : STONE.b) : STONE.grout)
    }
  }
  if (look === 'broken') {
    // A snapped stump, jagged on top, and the hoop's pieces on the ground.
    for (let y = fy - 12; y <= fy - 2; y++) for (let x = 9; x <= 11; x++) if (y > fy - 12 + ((x * 7) % 3)) dot(x, y, x === 9 ? light : x === 11 ? INK : dark)
    for (const [x0, y0, len] of [[1, fy - 1, 5], [15, fy, 5]] as const) {
      for (let i = 0; i < len; i++) {
        dot(x0 + i, y0 - (i === 1 || i === 2 ? 1 : 0), dark)
        dot(x0 + i, y0 + 1 - (i === 1 || i === 2 ? 1 : 0), INK, 0.6)
      }
    }
    dot(6, fy - 3, PEBBLE.lit)
    dot(12, fy - 4, PEBBLE.main)
    return canvas
  }
  // The pole.
  for (let y = Math.round(POST.hy + POST.outer - 1); y <= fy - 2; y++) {
    dot(9, y, light)
    dot(10, y, color)
    dot(11, y, dark)
  }
  // The hoop: a thick ring lit from the top left, a dark rim, the middle seen through.
  for (let y = 0; y < POST.hy * 2 + 1; y++) {
    for (let x = 0; x < POST.w; x++) {
      const dx = x + 0.5 - POST.hx
      const dy = y + 0.5 - POST.hy
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d > POST.outer) continue
      if (d > POST.outer - 1 || (d > POST.inner - 1 && d <= POST.inner)) dot(x, y, INK)
      else if (d > POST.inner) dot(x, y, dx + dy < -3 ? light : dx + dy > 4 ? dark : color)
      else dot(x, y, look === 'open' ? light : grey, look === 'open' ? 0.55 : 0.35)
    }
  }
  if (look === 'locked') {
    // A chain across the hoop.
    for (let i = -7; i <= 7; i += 2) {
      dot(Math.round(POST.hx + i), Math.round(POST.hy + i * 0.35), hex('#c8c8d0'))
      dot(Math.round(POST.hx + i + 1), Math.round(POST.hy + i * 0.35), hex('#606068'))
    }
  }
  return canvas
}

/** An open hoop's glow, in its team's light. */
const GLOWS = [rgba(TEAM_LIGHT_RGB[0], 0.22), rgba(TEAM_LIGHT_RGB[1], 0.22)] as const

const posts = canvasCache<string, PixelSprite>()
const postSprite = (team: Team, look: PostLook) => {
  const key = `${team}:${look}`
  let s = posts.get(key)
  if (!s) posts.set(key, (s = bakePost(team, look)))
  return s
}

/** How a goal looks now: broken, open, or shut until a lane goal of its team falls. */
const lookOf = (s: VersusState, goal: GoalState): PostLook => (goal.broken ? 'broken' : goalOpen(s, goal) ? 'open' : 'locked')

/** Where a goal's post stands: its pedestal's middle a little below the goal's. */
const postFoot = (goal: GoalState) => Math.round(goal.y + 4)
/** The painted post's pedestal middle, from the picture's bottom row. */
const ART_FOOT = 5

const postArt = (s: VersusState, goal: GoalState, look: PostLook) => valeArt(`goal-post-${teamFile(goal.team)}-${look}`, mapOf(s).look.theme)

/** A goal's post as drawn now: the painted one, or the code's until it lands. Its box (top left, size) and its hoop's middle. */
const postLayout = (s: VersusState, goal: GoalState, look: PostLook) => {
  const art = postArt(s, goal, look)
  if (art) {
    const x = Math.round(goal.x) - (art.width >> 1)
    const y = postFoot(goal) + ART_FOOT - art.height
    return { art, x, y, w: art.width, h: art.height, hx: x + art.width / 2, hy: y + 11, spark: 9 }
  }
  const x = Math.round(goal.x - POST.hx)
  const y = postFoot(goal) - POST.foot
  return { art: null, x, y, w: POST.w, h: POST.h, hx: x + POST.hx, hy: y + POST.hy, spark: 7.5 }
}

/** A base goal still shut: a small padlock (over the code post; the painted one wears its own). */
const PADLOCK = lazy(() =>
  fromStrings(['.11111.', '11...11', '1.....1', '1111111', '1222221', '1223221', '1222221', '1111111'], { 1: '#282830', 2: '#e0b848', 3: '#282830' }),
)

/** Ground zones under everything: the spawn pads and the goals (open, shut until a lane goal falls, broken), with each post's shadow. */
export const drawValeZones = (ctx: Ctx, g: Game, t: number) => {
  const s = g.versus
  if (!s) return
  mapOf(s).spawn.forEach((pad, team) => {
    const art = valeArt(`spawn-pad-${teamFile(team as Team)}`, mapOf(s).look.theme)
    if (art) ctx.drawImage(art, Math.round(pad.x - art.width / 2), Math.round(pad.y - art.height / 2))
    else blitCentered(ctx, zoneSprite(team as Team, 'pad', VERSUS.spawnPad.r), pad.x, pad.y)
    dashedRing(ctx, pad.x, pad.y, VERSUS.spawnPad.r - 4, t * 0.8, [TEAM_LIGHT[team as Team], '#ffffff'], 0.35)
  })
  for (const goal of s.goals) {
    const look = lookOf(s, goal)
    blitCentered(ctx, zoneSprite(goal.team, look, goal.r), goal.x, goal.y)
    // An open goal's rim runs, faster as it empties.
    if (look === 'open') dashedRing(ctx, goal.x, goal.y, goal.r + 2, t * (1.5 + (1 - goal.left / goal.max) * 3), [TEAM_LIGHT[goal.team], '#ffffff', TEAM_COLORS[goal.team]], 0.45)
    blitEllipse(ctx, 10, 3, 'rgba(12,20,12,0.35)', goal.x + 1, goal.y + 5)
  }
}

/** The world box goal `i`'s post covers now, for the depth pass to tell who stands behind it. */
export const goalPostBox = (g: Game, i: number) => {
  const s = g.versus
  const goal = s?.goals[i]
  return s && goal ? postLayout(s, goal, lookOf(s, goal)) : null
}

/**
 * Goal `i`'s post, Unite style, standing among the Pokémon (the depth pass
 * sorts it by its foot): a hoop on a pole over a pedestal, shut with a chain
 * and padlock, broken in pieces. An open one glows and a spark runs round its
 * hoop. `see`: faint, when this screen's player stands behind it.
 */
export const drawGoalPost = (ctx: Ctx, g: Game, i: number, t: number, see: boolean) => {
  const s = g.versus
  const goal = s?.goals[i]
  if (!s || !goal) return
  const look = lookOf(s, goal)
  const at = postLayout(s, goal, look)
  if (see) ctx.globalAlpha = 0.5
  if (look === 'open') blitEllipse(ctx, 13, 13, GLOWS[goal.team], at.hx, at.hy)
  if (at.art) ctx.drawImage(at.art, at.x, at.y)
  else {
    ctx.drawImage(postSprite(goal.team, look), at.x, at.y)
    if (look === 'locked') blitCentered(ctx, PADLOCK(), goal.x, at.hy + 1)
  }
  if (look === 'open') {
    const a = t * 3 + goal.x * 0.01
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(Math.round(at.hx + Math.cos(a) * at.spark - 0.5), Math.round(at.hy + Math.sin(a) * at.spark - 0.5), 1, 1)
  }
  ctx.globalAlpha = 1
}

/* ---------------- Orbs and channels ---------------- */

const ORB = lazy(() => ({
  small: fromStrings(['.111.', '12321', '13431', '12321', '.111.'], { 1: '#8a4c08', 2: '#e8a020', 3: '#f8d040', 4: '#ffffff' }),
  big: fromStrings(['..111..', '.12221.', '1233321', '1234321', '1233321', '.12221.', '..111..'], { 1: '#8a4c08', 2: '#e8a020', 3: '#f8d040', 4: '#ffffff' }),
}))

/** The small orb glyph the Energy badges wear (`render/team.ts`). */
export const orbGlyph = () => ORB().small

/** Pixel arc of `k` (0..1) of an ellipse, clockwise from the top, with a dark rim outside. */
const arc = (ctx: Ctx, x: number, y: number, rx: number, ry: number, k: number, color: string) => {
  const steps = Math.ceil(Math.max(rx, ry) * Math.PI * 3)
  const last = Math.floor(steps * Math.min(1, k))
  for (let i = 0; i < steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * Math.PI * 2
    const cx = Math.cos(a)
    const cy = Math.sin(a)
    ctx.fillStyle = '#181818'
    ctx.fillRect(Math.round(x + cx * (rx + 1)), Math.round(y + cy * (ry + 1)), 1, 1)
    ctx.fillStyle = i <= last ? color : 'rgba(255,255,255,0.25)'
    ctx.fillRect(Math.round(x + cx * rx), Math.round(y + cy * ry), 1, 1)
  }
}

/** Teammates of `p` standing in the goal they channel into, as the match counts them (`updateGoals`). */
const alliesIn = (g: Game, p: Player, goal: GoalState) => {
  let n = 0
  for (const q of g.players) {
    if (q === p || q.hp <= 0 || q.gone || q.versus?.team !== p.versus?.team) continue
    const dx = q.x - goal.x
    const dy = q.y - goal.y
    if (dx * dx + dy * dy < goal.r * goal.r) n++
  }
  return n
}

/** How far `p`'s channel into the goal they stand in has gone (0..1), or null when they aren't channeling. */
export const channelShare = (s: VersusState, g: Game, p: Player) => {
  const v = p.versus
  if (!v || v.goal < 0 || v.energy <= 0 || p.hp <= 0) return null
  const goal = s.goals[v.goal]
  if (!goal) return null
  return Math.max(0, Math.min(1, v.channel / channelTime(v.energy, alliesIn(g, p, goal))))
}

/** On the ground over the zones: the Energy orbs (bobbing, blinking out at the end of their time) and each scorer's channel arc. */
export const drawValeGround = (ctx: Ctx, g: Game, t: number, visible: (x: number, y: number) => boolean) => {
  const s = g.versus
  if (!s) return
  const orb = ORB()
  for (const o of s.orbs) {
    if (!visible(o.x, o.y)) continue
    const left = VERSUS.energy.ttl - o.age
    if (left < 6 && Math.floor(t * (left < 2 ? 12 : 6)) % 2 === 0) continue
    const moving = Math.abs(o.vx) + Math.abs(o.vy) > 4
    const bob = moving ? 0 : Math.round(Math.sin(t * 4 + o.id) * 1.2)
    blitEllipse(ctx, 3, 1, 'rgba(16,40,16,0.3)', o.x, o.y + 4)
    blitEllipse(ctx, 5, 3, 'rgba(248,208,64,0.22)', o.x, o.y + 3)
    blitCentered(ctx, o.value >= 5 ? orb.big : orb.small, o.x, o.y - 2 + bob)
    // A glint now and then.
    if (Math.floor(t * 3 + o.id * 0.7) % 5 === 0) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(Math.round(o.x) + 2, Math.round(o.y) - 5 + bob, 1, 1)
    }
  }
  const me = localPlayer(g)
  for (const p of g.players) {
    const k = channelShare(s, g, p)
    if (k === null || !visible(p.x, p.y) || concealed(me, p)) continue
    arc(ctx, p.x, p.y + 1, 15, 7, k, TEAM_LIGHT[p.versus!.team])
  }
}

/* ---------------- Over everyone ---------------- */

const numbers: string[] = []
const numberText = (n: number) => (numbers[n] ??= String(n))

/**
 * Over everyone: each standing goal's points left over its hoop, in its
 * team's color (grey while shut), and a bar of what's left of them.
 */
export const drawValeAir = (ctx: Ctx, g: Game) => {
  const s = g.versus
  if (!s) return
  for (const goal of s.goals) {
    if (goal.broken) continue
    const open = goalOpen(s, goal)
    const top = postLayout(s, goal, open ? 'open' : 'locked').y
    blitPacked(ctx, textSprite(numberText(Math.max(0, Math.round(goal.left))), open ? TEAM_LIGHT[goal.team] : '#a8a8b0'), goal.x, top - 7)
    const w = 16
    const x = Math.round(goal.x - w / 2)
    const y = top - 3
    ctx.fillStyle = '#181010'
    ctx.fillRect(x - 1, y - 1, w + 2, 4)
    ctx.fillStyle = '#404048'
    ctx.fillRect(x, y, w, 2)
    ctx.fillStyle = open ? TEAM_COLORS[goal.team] : '#8a8a92'
    ctx.fillRect(x, y, Math.ceil((w * Math.max(0, goal.left)) / goal.max), 2)
  }
}

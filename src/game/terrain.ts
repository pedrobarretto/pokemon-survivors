import { hash2, weightedPick } from '../engine/rng'
import { abilityImmune } from './abilities'
import { playerForm } from './branch'
import type { ArenaPiece } from '../data/arenas'
import { CLIFFS, CLUSTER_SLOTS, LAKES, SOLID_FOOT, TERRAIN, type Ellipse, type FeatureKind, type SolidKind } from '../data/terrain'
import type { PlacePiece } from '../data/places'
import { LANDMARK, LANDMARK_IDS, type LandmarkGround, type LandmarkId, type LandmarkPiece } from '../data/landmarks'
import { LANDMARK_VARIANTS, landmarkPlan } from './landmarkLayout'
import { arenaGround, fits } from './arenaFloor'
import { burst } from './effects'
import { roomOf } from './room'
import { isAirborne } from './traits'
import { nearestPlayer } from './players'
import type { Enemy, Game, Pickup } from './types'
import * as dm from '../engine/dmath'

/**
 * Terrain on the map: each world cell deterministically holds at most one
 * feature (a rock pile, a grove, bushes, a fallen log, a mountain, a lake, a
 * tower or a landmark, `data/landmarks.ts`) placed from the run's seed, so the
 * replay rebuilds the same map. Solids push walkers out and break enemy
 * shots; lakes slow walkers (ice makes the player slide). Flyers, ghosts and
 * bosses ignore all of it, and so do the player's attacks. A place's entrance
 * (`placeEntrance.ts`) stands on the map like any feature.
 * Inside a room (a rift arena, a place's interior) its own scenery and ground
 * take the map's place.
 */

/**
 * Something that blocks, with its footprint in world px. A landmark's
 * treasure (and what wakes with it) carries its cell (`loot`), so it shows open once looted.
 */
export type Solid = { kind: SolidKind | ArenaPiece | PlacePiece | LandmarkPiece; x: number; y: number; variant: number; foot: readonly Ellipse[]; loot?: number }
export type Lake = { x: number; y: number; variant: number; foot: readonly Ellipse[] }

type Pos = { x: number; y: number }

/**
 * A landmark standing in a cell (`data/landmarks.ts`): `cell` remembers its
 * treasure once looted and that it was named; its ground art, the treasure's
 * spot and the tunnel's mouths, in world px.
 */
export type Landmark = {
  id: LandmarkId
  cell: number
  x: number
  y: number
  variant: number
  ground: { kind: LandmarkGround; variant: number; x: number; y: number }
  treasure: Pos | null
  mouths: readonly Pos[]
}

export type Feature = { solids: readonly Solid[]; lake: Lake | null; landmark?: Landmark }

/** The run's terrain seed and the cells built so far (a pure cache: dropping a cell rebuilds it the same). */
export type TerrainState = { seed: number; cells: Map<number, Feature | null> }

export const createTerrain = (seed: number): TerrainState => ({ seed: Math.imul(seed | 0, 2654435761) >>> 0, cells: new Map() })

const KINDS = Object.entries(TERRAIN.weights) as Array<[FeatureKind, number]>
const SCATTER_KINDS = Object.entries(TERRAIN.scatter.weights) as Array<['bush' | 'rock' | 'tree', number]>
const SCATTER_VARIANTS = { bush: TERRAIN.bushVariants, rock: TERRAIN.rockVariants, tree: TERRAIN.treeVariants } as const
const LANDMARK_KINDS = LANDMARK_IDS.map((id) => [id, LANDMARK.weights[id]] as const)

const at = (e: Ellipse, x: number, y: number): Ellipse => ({ x: e.x + x, y: e.y + y, rx: e.rx, ry: e.ry })

/** A feature's pieces relative to its anchor, before it is placed in its cell (`loot` marks a landmark's that change once looted). */
type Draft = { solids: Array<Omit<Solid, 'foot' | 'loot'> & { foot: readonly Ellipse[]; loot?: true }>; lake: { variant: number; foot: readonly Ellipse[] } | null }

/** A cluster's single pieces and how many of them (rocks, a grove, bushes). */
const CLUSTERS = {
  rocks: { solid: 'rock', min: 2, spread: 2, variants: TERRAIN.rockVariants },
  grove: { solid: 'tree', min: 3, spread: 3, variants: TERRAIN.treeVariants },
  bushes: { solid: 'bush', min: 2, spread: 4, variants: TERRAIN.bushVariants },
} as const

const draft = (kind: Exclude<FeatureKind, 'none'>, h: (salt: number) => number): Draft => {
  switch (kind) {
    case 'rocks':
    case 'grove':
    case 'bushes': {
      const { solid, min, spread, variants } = CLUSTERS[kind]
      const count = min + Math.floor(h(3) * spread)
      const first = Math.floor(h(4) * CLUSTER_SLOTS.length)
      return {
        lake: null,
        solids: Array.from({ length: count }, (_, i) => {
          const [x, y] = CLUSTER_SLOTS[(first + i * 2) % CLUSTER_SLOTS.length]!
          return { kind: solid, x, y, variant: Math.floor(h(10 + i) * variants), foot: [at(SOLID_FOOT[solid], x, y)] }
        }),
      }
    }
    case 'log': {
      // A fallen log, a bush by one end and sometimes a rock.
      const side = h(3) < 0.5 ? -1 : 1
      const solids: Draft['solids'] = [
        { kind: 'log', x: 0, y: 0, variant: Math.floor(h(10) * TERRAIN.logVariants), foot: [SOLID_FOOT.log] },
        { kind: 'bush', x: 30 * side, y: -12, variant: Math.floor(h(11) * TERRAIN.bushVariants), foot: [at(SOLID_FOOT.bush, 30 * side, -12)] },
      ]
      if (h(4) < 0.5) solids.push({ kind: 'rock', x: -26 * side, y: 14, variant: Math.floor(h(12) * TERRAIN.rockVariants), foot: [at(SOLID_FOOT.rock, -26 * side, 14)] })
      return { lake: null, solids }
    }
    case 'cliff': {
      const variant = Math.floor(h(3) * CLIFFS.length)
      return { lake: null, solids: [{ kind: 'cliff', x: 0, y: 0, variant, foot: CLIFFS[variant]![0]!.foot }] }
    }
    case 'lake': {
      const variant = Math.floor(h(3) * LAKES.length)
      return { lake: { variant, foot: LAKES[variant]! }, solids: [] }
    }
    case 'tower':
      return { lake: null, solids: [{ kind: 'tower', x: 0, y: 0, variant: 0, foot: [SOLID_FOOT.tower] }] }
  }
}

/**
 * A cell's key, kept a small integer (15 bits per axis, wrapping every 32768 cells)
 * so the lookups the walkers make every tick don't box a number. `unwrap` reads it back.
 */
const cellKey = (cx: number, cy: number) => ((cx & 0x7fff) << 15) | (cy & 0x7fff)

/** Whether cell (cx, cy) is its block's landmark cell (`LANDMARK.block`): one block in `odds` has one, in a cell drawn from the seed. */
const landmarkCell = (seed: number, cx: number, cy: number) => {
  const B = LANDMARK.block
  const bx = Math.floor(cx / B)
  const by = Math.floor(cy / B)
  if (hash2(bx, by, seed + 7001) >= LANDMARK.odds) return false
  const pick = Math.floor(hash2(bx, by, seed + 7002) * B * B)
  return cx - bx * B === pick % B && cy - by * B === Math.floor(pick / B)
}

/** The landmark in cell (cx, cy), drafted around its anchor like any feature. */
const draftLandmark = (h: (salt: number) => number): Draft & { id: LandmarkId; variant: number } => {
  const id = weightedPick(() => h(50), LANDMARK_KINDS)
  const variant = Math.floor(h(51) * LANDMARK_VARIANTS[id])
  const plan = landmarkPlan(id, variant)
  return { id, variant, lake: null, solids: plan.pieces.map((p) => ({ kind: p.kind, x: p.x, y: p.y, variant: p.variant, foot: p.foot, loot: p.loot })) }
}

/**
 * Single pieces strewn about cell (cx, cy) around its feature's footprint
 * `feet` (world px): each candidate spot is dropped if it comes near the
 * feature or another piece, so they never close a passage.
 */
const scatter = (h: (salt: number) => number, ox: number, oy: number, feet: readonly Ellipse[]): Solid[] => {
  const { max, clear, spacing } = TERRAIN.scatter
  const C = TERRAIN.cell
  const edge = TERRAIN.margin + 14
  const out: Solid[] = []
  const count = Math.floor(h(80) * (max + 1))
  for (let i = 0; i < count; i++) {
    const x = dm.round(ox + edge + h(81 + i * 4) * (C - 2 * edge))
    const y = dm.round(oy + edge + h(82 + i * 4) * (C - 2 * edge))
    if (feet.some((e) => depth(e, x, y, clear) < 1) || out.some((s) => dm.sq(s.x - x) + dm.sq(s.y - y) < spacing * spacing)) continue
    const kind = weightedPick(() => h(83 + i * 4), SCATTER_KINDS)
    out.push({ kind, x, y, variant: Math.floor(h(84 + i * 4) * SCATTER_VARIANTS[kind]), foot: [at(SOLID_FOOT[kind], x, y)] })
  }
  return out
}

/** The feature living in world cell (cx, cy), if any. Pure: same seed, same map. */
export const featureAt = (seed: number, cx: number, cy: number): Feature | null => {
  const C = TERRAIN.cell
  const ox = cx * C
  const oy = cy * C
  // The start of the run is always open ground.
  const nx = Math.max(ox, Math.min(0, ox + C))
  const ny = Math.max(oy, Math.min(0, oy + C))
  if (nx * nx + ny * ny < TERRAIN.clearStart * TERRAIN.clearStart) return null
  const h = (salt: number) => hash2(cx, cy, seed + salt)
  const mark = landmarkCell(seed, cx, cy) ? draftLandmark(h) : null
  const kind = mark ? null : weightedPick(() => h(0), KINDS)
  if (kind === 'none') {
    const strewn = scatter(h, ox, oy, [])
    return strewn.length > 0 ? { solids: strewn, lake: null } : null
  }
  const d = mark ?? draft(kind!, h)
  const feet = [...d.solids.flatMap((s) => s.foot), ...(d.lake?.foot ?? [])]
  const minX = Math.min(...feet.map((e) => e.x - e.rx))
  const maxX = Math.max(...feet.map((e) => e.x + e.rx))
  const minY = Math.min(...feet.map((e) => e.y - e.ry))
  const maxY = Math.max(...feet.map((e) => e.y + e.ry))
  const m = TERRAIN.margin
  const ax = dm.round(ox + m - minX + h(1) * Math.max(0, C - 2 * m - (maxX - minX)))
  const ay = dm.round(oy + m - minY + h(2) * Math.max(0, C - 2 * m - (maxY - minY)))
  const cell = cellKey(cx, cy)
  const shift = (p: Pos) => ({ x: ax + p.x, y: ay + p.y })
  const plan = mark && landmarkPlan(mark.id, mark.variant)
  const solids: Solid[] = d.solids.map((s) => ({ kind: s.kind, x: ax + s.x, y: ay + s.y, variant: s.variant, foot: s.foot.map((e) => at(e, ax, ay)), ...(s.loot ? { loot: cell } : {}) }))
  const placed = [...solids.flatMap((s) => s.foot), ...(d.lake?.foot.map((e) => at(e, ax, ay)) ?? [])]
  return {
    solids: mark ? solids : [...solids, ...scatter(h, ox, oy, placed)],
    lake: d.lake && { x: ax, y: ay, variant: d.lake.variant, foot: d.lake.foot.map((e) => at(e, ax, ay)) },
    ...(mark && plan
      ? {
          landmark: {
            id: mark.id,
            cell,
            x: ax,
            y: ay,
            variant: mark.variant,
            ground: { ...plan.ground, ...shift(plan.ground) },
            treasure: plan.treasure && shift(plan.treasure),
            mouths: plan.mouths.map(shift),
          },
        }
      : {}),
  }
}
/** The signed 15-bit cell coordinate stored in the low bits of `v`. */
const unwrap = (v: number) => ((v & 0x7fff) << 17) >> 17

const cell = (g: Game, cx: number, cy: number) => {
  const key = cellKey(cx, cy)
  let f = g.terrain.cells.get(key)
  if (f === undefined) g.terrain.cells.set(key, (f = featureAt(g.terrain.seed, cx, cy)))
  return f
}

const NEAR: Feature[] = []

/** How far a place's entrance reaches from its door, for gathering the features near a spot. */
const ENTRANCE_REACH = 96

/** Features whose cells overlap the box around (x, y). Reuses one array: copy it if you keep it. */
export const featuresNear = (g: Game, x: number, y: number, rx: number, ry = rx): readonly Feature[] => {
  // Filled by index and cut to size, never emptied first (that would drop its storage every call).
  let n = 0
  const room = roomOf(g)
  if (room) NEAR[n++] = room.terrain
  else {
    const door = g.place.entrance
    if (door && Math.abs(door.x - x) < rx + ENTRANCE_REACH && Math.abs(door.y - y) < ry + ENTRANCE_REACH) NEAR[n++] = door.terrain
    const C = TERRAIN.cell
    for (let cy = Math.floor((y - ry) / C); cy <= Math.floor((y + ry) / C); cy++) {
      for (let cx = Math.floor((x - rx) / C); cx <= Math.floor((x + rx) / C); cx++) {
        const f = cell(g, cx, cy)
        if (f) NEAR[n++] = f
      }
    }
  }
  NEAR.length = n
  return NEAR
}

/** How deep (x, y) sits in an ellipse grown by `r`: below 1 means inside. */
const depth = (e: Ellipse, x: number, y: number, r: number) => {
  const rx = e.rx + r
  const ry = e.ry + r
  return ((x - e.x) * (x - e.x)) / (rx * rx) + ((y - e.y) * (y - e.y)) / (ry * ry)
}

const inside = (foot: readonly Ellipse[], x: number, y: number, r: number) => foot.some((e) => depth(e, x, y, r) < 1)

/** Pushes a circle of radius `r` at `o` out of an ellipse, straight away from its center. True if it was inside. */
export const pushOut = (o: Pos, r: number, e: Ellipse) => {
  const s = depth(e, o.x, o.y, r)
  if (s >= 1) return false
  if (s === 0) {
    o.y = e.y + e.ry + r
    return true
  }
  const k = 1 / Math.sqrt(s)
  o.x = e.x + (o.x - e.x) * k
  o.y = e.y + (o.y - e.y) * k
  return true
}

/**
 * The widest a player stands against terrain and a room's edges, px. The
 * narrowest authored ways (a maze's corridors, the cottage's door, the last
 * chamber of Groudon's tunnel) fit a radius of 10, so with this every playable
 * walks all of them, however big its sprite; its hitbox (`Player.radius`) stays.
 */
export const PLAYER_FOOT = 8

/** The radius a player (or co-op's drawn copy of one) collides with terrain at: its hitbox, capped at `PLAYER_FOOT`. */
export const footOf = (p: { radius: number }) => Math.min(p.radius, PLAYER_FOOT)

/** Unit vectors around the circle that `nearestOpen` walks out along, built with `dmath` so every engine agrees. */
const AROUND = Array.from({ length: 24 }, (_, i) => ({ x: dm.cos((i / 24) * Math.PI * 2), y: dm.sin((i / 24) * Math.PI * 2) }))

/** How far, px, `nearestOpen` looks for room, and its step between rings. */
const UNSTICK = { reach: 72, step: 2 } as const

/**
 * The nearest spot to (x, y) where `open` holds, searched ring by ring
 * outward (`UNSTICK`), or null when there's none in reach. Pure and
 * deterministic: the first open spot of the closest ring, in a fixed order.
 */
export const nearestOpen = (x: number, y: number, open: (x: number, y: number) => boolean): Pos | null => {
  for (let d = UNSTICK.step; d <= UNSTICK.reach; d += UNSTICK.step) {
    for (const u of AROUND) if (open(x + u.x * d, y + u.y * d)) return { x: x + u.x * d, y: y + u.y * d }
  }
  return null
}

/** Whether a player's foot of radius `r` at (x, y) is clear of solids and, in a room, on its floor and out of its holes. */
const standable = (g: Game, x: number, y: number, r: number) => {
  if (inSolid(g, x, y, r)) return false
  const room = roomOf(g)
  if (!room) return true
  const lx = x - room.x
  const ly = y - room.y
  return room.layout.floor.some((s) => fits(s, lx, ly, r)) && !(room.layout.holes ?? []).some((h) => dm.sq(lx - h.x) + dm.sq(ly - h.y) < dm.sq(h.r + r))
}

/**
 * Keeps a walking player out of the solids; one the pushes can't free (an
 * evolution grew them into a gap, a dash wedged them between two pieces or
 * a piece and a room's edge, each push putting them back into the other)
 * steps to the nearest spot where they stand clear.
 */
const settlePlayer = (g: Game, p: Pos & { radius: number }) => {
  const r = footOf(p)
  block(g, p, r)
  // Half a px of slack: a push leaves the circle right on the edge.
  if (standable(g, p.x, p.y, r - 0.5)) return
  const spot = nearestOpen(p.x, p.y, (x, y) => standable(g, x, y, r))
  if (!spot) return
  p.x = spot.x
  p.y = spot.y
}

/**
 * Each feature's solids' boxes (x0, y0, x1, y1 per solid, in its order: the
 * union of its feet), worked out once per feature: features never change once
 * built. A cache beside the state, not in it, like the cells themselves.
 */
const solidBoxes = new WeakMap<Feature, Float64Array>()

const boxesOf = (f: Feature) => {
  let boxes = solidBoxes.get(f)
  if (boxes) return boxes
  boxes = new Float64Array(f.solids.length * 4)
  for (let i = 0; i < f.solids.length; i++) {
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const e of f.solids[i]!.foot) {
      x0 = Math.min(x0, e.x - e.rx)
      y0 = Math.min(y0, e.y - e.ry)
      x1 = Math.max(x1, e.x + e.rx)
      y1 = Math.max(y1, e.y + e.ry)
    }
    boxes.set([x0, y0, x1, y1], i * 4)
  }
  solidBoxes.set(f, boxes)
  return boxes
}

/**
 * Pushes a circle out of every solid near it. Returns the last ellipse it hit, or null.
 * A solid whose box the circle is clear of by a pixel can't push it (no ellipse of it
 * would), so its ellipses go untested: the same pushes, in the same order, for a crowd.
 */
const block = (g: Game, o: Pos, r: number) => {
  let hit: Ellipse | null = null
  const reach = r + 1
  // Two passes: leaving one lobe of a mountain can land in the next. A first pass that
  // pushed nothing left the circle where it was, so a second would push nothing either.
  for (let pass = 0; pass < 2 && (pass === 0 || hit !== null); pass++) {
    for (const f of featuresNear(g, o.x, o.y, r)) {
      const boxes = boxesOf(f)
      for (let i = 0; i < f.solids.length; i++) {
        const b = i * 4
        if (o.x < boxes[b]! - reach || o.y < boxes[b + 1]! - reach || o.x > boxes[b + 2]! + reach || o.y > boxes[b + 3]! + reach) continue
        for (const e of f.solids[i]!.foot) if (pushOut(o, r, e)) hit = e
      }
    }
  }
  return hit
}

/** Keeps a circle of radius `r` at `o` out of every solid near it, as a walking player is each tick. For co-op's drawn prediction. */
export const keepOut = (g: Game, o: Pos, r: number) => block(g, o, r) !== null

/** Whether a circle at (x, y) overlaps any solid. */
export const inSolid = (g: Game, x: number, y: number, r: number) => featuresNear(g, x, y, r).some((f) => f.solids.some((s) => inside(s.foot, x, y, r)))

/** Moves a spot (map event, portal) out of solids and lakes, so it lands on open ground. */
export const clearSpot = (g: Game, o: Pos, r: number) => {
  if (roomOf(g)) return o
  for (let pass = 0; pass < 3; pass++) {
    for (const f of featuresNear(g, o.x, o.y, r)) {
      for (const s of f.solids) for (const e of s.foot) pushOut(o, r, e)
      if (f.lake) for (const e of f.lake.foot) pushOut(o, r, e)
    }
  }
  return o
}

/** Whether a circle at (x, y) is clear of solids and lakes (where breakables may stand). */
export const isOpen = (g: Game, x: number, y: number, r: number) =>
  !featuresNear(g, x, y, r).some((f) => f.solids.some((s) => inside(s.foot, x, y, r)) || (f.lake !== null && inside(f.lake.foot, x, y, r)))

export type Ground = 'land' | 'water' | 'ice' | 'lava'

/** What the ground is at (x, y): lakes are water, or ice in the snow; a room has its own (`arenaGround`). */
export const groundAt = (g: Game, x: number, y: number): Ground => {
  const room = roomOf(g)
  if (room) return arenaGround(room.layout, x - room.x, y - room.y)
  for (const f of featuresNear(g, x, y, 0)) if (f.lake && inside(f.lake.foot, x, y, 0)) return g.biome.id === 'snow' ? 'ice' : 'water'
  return 'land'
}

/** Flyers, ghosts, bosses and leapers mid-jump go over the terrain. */
export const overTerrain = (e: Enemy) =>
  e.boss || e.behavior.kind === 'flyby' || isAirborne(e) || e.types.includes('flying') || e.types.includes('ghost')

/** Walking pace an enemy keeps where it stands: slowed in water unless it swims or flies. */
export const enemyGroundPace = (g: Game, e: Enemy) =>
  overTerrain(e) || e.types.includes('water') || groundAt(g, e.x, e.y) !== 'water' ? 1 : TERRAIN.waterPace

export const playerTypes = (g: Game) => playerForm(g).types

/** The player's pace in water: Water types swim at full speed, and so does an ability that ignores terrain (Levitate). */
export const playerWaterPace = (g: Game) => (playerTypes(g).includes('water') || abilityImmune(g, 'terrain') ? 1 : TERRAIN.waterPace)

/**
 * Nudges an enemy pressed against a solid along its edge, toward the side of
 * the player nearest to it, so one coming straight at it from behind never
 * stalls at its middle.
 */
const slide = (g: Game, e: Enemy, wall: Ellipse, dt: number) => {
  const p = nearestPlayer(g, e.x, e.y)
  const nx = (e.x - wall.x) / ((wall.rx + 1) * (wall.rx + 1))
  const ny = (e.y - wall.y) / ((wall.ry + 1) * (wall.ry + 1))
  const n = Math.sqrt(nx * nx + ny * ny) || 1
  let tx = -ny / n
  let ty = nx / n
  const side = tx * (p.x - e.x) + ty * (p.y - e.y)
  if (side < 0 || (side === 0 && e.id % 2 === 0)) {
    tx = -tx
    ty = -ty
  }
  const step = e.speed * 0.5 * dt
  e.x += tx * step
  e.y += ty * step
}

const SHOT_SPARKS = ['#ffffff', '#d8d0c0', '#a89c90'] as const

/** Whether terrain cell (cx, cy) is more than 5 cells (per axis) from every player: far behind everyone, so it can go. */
const farFromAll = (g: Game, cx: number, cy: number) => {
  for (const p of g.players) {
    const pcx = Math.floor(p.x / TERRAIN.cell)
    const pcy = Math.floor(p.y / TERRAIN.cell)
    if (!(Math.abs(cx - pcx) > 5 || Math.abs(cy - pcy) > 5)) return false
  }
  return true
}

/** Keeps walkers out of solids, breaks enemy shots on them and drops cells far behind the players. */
export const updateTerrain = (g: Game, dt: number) => {
  if (!roomOf(g) && Math.floor(g.time) !== Math.floor(g.time - dt)) {
    for (const key of g.terrain.cells.keys()) {
      if (farFromAll(g, unwrap(key >> 15), unwrap(key))) g.terrain.cells.delete(key)
    }
  }
  // Under a tunnel's ridge (`landmarks.ts`) a player goes through the rock.
  for (const p of g.players) if (!p.landmark.transit) settlePlayer(g, p)
  for (const e of g.enemies) {
    if (e.dying >= 0 || overTerrain(e)) continue
    const wall = block(g, e, e.radius * 0.8)
    if (wall) slide(g, e, wall, dt)
  }
  for (const h of g.hazards) {
    if (h.kind !== 'shot' || h.age < h.armAt || !inSolid(g, h.x, h.y, h.r * 0.4)) continue
    h.age = h.ttl
    burst(g, h.x, h.y, { colors: SHOT_SPARKS, count: 6, speed: 50, ttl: 0.25 })
  }
  // Loot that a flyer dropped over a mountain rolls off to where the players can reach it.
  const room = roomOf(g)?.terrain ?? null
  const door = g.place.entrance?.terrain ?? null
  for (const k of g.pickups) if (!k.attracted) settleLoot(g, k, room, door)
}

/** Where a loose pickup last stood clear of the terrain, and the room and entrance (their terrain) about then. */
type ClearSpot = { x: number; y: number; room: Feature | null; door: Feature | null }

/**
 * Loot found clear of every solid (`block` pushed nothing), kept beside the
 * state like `solidBoxes`. `block` reads only the spot, the seed's cells, the
 * room and the entrance, so loot that hasn't moved since, with the same room
 * and entrance about, is still clear: the late game's thousands of candies and
 * coins left behind skip the push, and every tick ends the same.
 */
const clearLoot = new WeakMap<Pickup, ClearSpot>()

const settleLoot = (g: Game, k: Pickup, room: Feature | null, door: Feature | null) => {
  const spot = clearLoot.get(k)
  if (spot && spot.x === k.x && spot.y === k.y && spot.room === room && spot.door === door) return
  if (block(g, k, 3) !== null) return
  if (spot) {
    spot.x = k.x
    spot.y = k.y
    spot.room = room
    spot.door = door
  } else clearLoot.set(k, { x: k.x, y: k.y, room, door })
}

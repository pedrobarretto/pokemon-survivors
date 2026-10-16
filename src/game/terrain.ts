import { hash2, weightedPick } from '../engine/rng'
import { PLAYABLE } from '../data/hatchlings'
import { ARENA_LAYOUTS, type ArenaPiece } from '../data/arenas'
import { CLIFFS, CLUSTER_SLOTS, LAKES, SOLID_FOOT, TERRAIN, type Ellipse, type FeatureKind, type SolidKind } from '../data/terrain'
import { arenaGround } from './arenaFloor'
import { burst } from './effects'
import { isAirborne } from './traits'
import { nearestPlayer, present } from './players'
import type { Enemy, Game } from './types'

/**
 * Terrain on the map: each world cell deterministically holds at most one
 * feature (a rock pile, a grove, a mountain, a lake or a tower) placed from
 * the run's seed, so the replay rebuilds the same map. Solids push walkers
 * out and break enemy shots; lakes slow walkers (ice makes the player slide).
 * Flyers, ghosts and bosses ignore all of it, and so do the player's attacks.
 * Inside a rift arena the arena's own scenery and ground take the map's place.
 */

/** Something that blocks, with its footprint in world px. */
export type Solid = { kind: SolidKind | ArenaPiece; x: number; y: number; variant: number; foot: readonly Ellipse[] }
export type Lake = { x: number; y: number; variant: number; foot: readonly Ellipse[] }
export type Feature = { solids: readonly Solid[]; lake: Lake | null }

/** The run's terrain seed and the cells built so far (a pure cache: dropping a cell rebuilds it the same). */
export type TerrainState = { seed: number; cells: Map<number, Feature | null> }

export const createTerrain = (seed: number): TerrainState => ({ seed: Math.imul(seed | 0, 2654435761) >>> 0, cells: new Map() })

type Pos = { x: number; y: number }

const KINDS = Object.entries(TERRAIN.weights) as Array<[FeatureKind, number]>

const at = (e: Ellipse, x: number, y: number): Ellipse => ({ x: e.x + x, y: e.y + y, rx: e.rx, ry: e.ry })

/** A feature's pieces relative to its anchor, before it is placed in its cell. */
type Draft = { solids: Array<Omit<Solid, 'foot'> & { foot: readonly Ellipse[] }>; lake: { variant: number; foot: readonly Ellipse[] } | null }

const draft = (kind: Exclude<FeatureKind, 'none'>, h: (salt: number) => number): Draft => {
  switch (kind) {
    case 'rocks':
    case 'grove': {
      const solid = kind === 'rocks' ? 'rock' : 'tree'
      const count = kind === 'rocks' ? 1 + Math.floor(h(3) * 3) : 2 + Math.floor(h(3) * 3)
      const first = Math.floor(h(4) * CLUSTER_SLOTS.length)
      const variants = kind === 'rocks' ? TERRAIN.rockVariants : TERRAIN.treeVariants
      return {
        lake: null,
        solids: Array.from({ length: count }, (_, i) => {
          const [x, y] = CLUSTER_SLOTS[(first + i * 2) % CLUSTER_SLOTS.length]!
          return { kind: solid, x, y, variant: Math.floor(h(10 + i) * variants), foot: [at(SOLID_FOOT[solid], x, y)] }
        }),
      }
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
  const kind = weightedPick(() => h(0), KINDS)
  if (kind === 'none') return null
  const d = draft(kind, h)
  const feet = [...d.solids.flatMap((s) => s.foot), ...(d.lake?.foot ?? [])]
  const minX = Math.min(...feet.map((e) => e.x - e.rx))
  const maxX = Math.max(...feet.map((e) => e.x + e.rx))
  const minY = Math.min(...feet.map((e) => e.y - e.ry))
  const maxY = Math.max(...feet.map((e) => e.y + e.ry))
  const m = TERRAIN.margin
  const ax = Math.round(ox + m - minX + h(1) * Math.max(0, C - 2 * m - (maxX - minX)))
  const ay = Math.round(oy + m - minY + h(2) * Math.max(0, C - 2 * m - (maxY - minY)))
  return {
    solids: d.solids.map((s) => ({ kind: s.kind, x: ax + s.x, y: ay + s.y, variant: s.variant, foot: s.foot.map((e) => at(e, ax, ay)) })),
    lake: d.lake && { x: ax, y: ay, variant: d.lake.variant, foot: d.lake.foot.map((e) => at(e, ax, ay)) },
  }
}

const cellKey = (cx: number, cy: number) => (cx + 32768) * 65536 + (cy + 32768)

const cell = (g: Game, cx: number, cy: number) => {
  const key = cellKey(cx, cy)
  let f = g.terrain.cells.get(key)
  if (f === undefined) g.terrain.cells.set(key, (f = featureAt(g.terrain.seed, cx, cy)))
  return f
}

const NEAR: Feature[] = []

/** Features whose cells overlap the box around (x, y). Reuses one array: copy it if you keep it. */
export const featuresNear = (g: Game, x: number, y: number, rx: number, ry = rx): readonly Feature[] => {
  NEAR.length = 0
  if (g.rift.arena) {
    NEAR.push(g.rift.arena.terrain)
    return NEAR
  }
  const C = TERRAIN.cell
  for (let cy = Math.floor((y - ry) / C); cy <= Math.floor((y + ry) / C); cy++) {
    for (let cx = Math.floor((x - rx) / C); cx <= Math.floor((x + rx) / C); cx++) {
      const f = cell(g, cx, cy)
      if (f) NEAR.push(f)
    }
  }
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

/** Pushes a circle out of every solid near it. Returns the last ellipse it hit, or null. */
const block = (g: Game, o: Pos, r: number) => {
  let hit: Ellipse | null = null
  // Two passes: leaving one lobe of a mountain can land in the next.
  for (let pass = 0; pass < 2; pass++) {
    for (const f of featuresNear(g, o.x, o.y, r)) {
      for (const s of f.solids) for (const e of s.foot) if (pushOut(o, r, e)) hit = e
    }
  }
  return hit
}

/** Whether a circle at (x, y) overlaps any solid. */
export const inSolid = (g: Game, x: number, y: number, r: number) => featuresNear(g, x, y, r).some((f) => f.solids.some((s) => inside(s.foot, x, y, r)))

/** Moves a spot (map event, portal) out of solids and lakes, so it lands on open ground. */
export const clearSpot = (g: Game, o: Pos, r: number) => {
  if (g.rift.arena) return o
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

/** What the ground is at (x, y): lakes are water, or ice in the snow; an arena has its own (`arenaGround`). */
export const groundAt = (g: Game, x: number, y: number): Ground => {
  const arena = g.rift.arena
  if (arena) return arenaGround(ARENA_LAYOUTS[arena.legend], x - arena.x, y - arena.y)
  for (const f of featuresNear(g, x, y, 0)) if (f.lake && inside(f.lake.foot, x, y, 0)) return g.biome.id === 'snow' ? 'ice' : 'water'
  return 'land'
}

/** Flyers, ghosts, bosses and leapers mid-jump go over the terrain. */
export const overTerrain = (e: Enemy) =>
  e.boss || e.behavior.kind === 'flyby' || isAirborne(e) || e.types.includes('flying') || e.types.includes('ghost')

/** Walking pace an enemy keeps where it stands: slowed in water unless it swims or flies. */
export const enemyGroundPace = (g: Game, e: Enemy) =>
  overTerrain(e) || e.types.includes('water') || groundAt(g, e.x, e.y) !== 'water' ? 1 : TERRAIN.waterPace

export const playerTypes = (g: Game) => PLAYABLE[g.player.starter].line[g.player.stage]!.types

/** The player's pace in water: Water types swim at full speed. */
export const playerWaterPace = (g: Game) => (playerTypes(g).includes('water') ? 1 : TERRAIN.waterPace)

/**
 * Nudges an enemy pressed against a solid along its edge, toward the nearest
 * player's side, so one coming straight at it from behind never stalls at its middle.
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

/** Keeps walkers out of solids, breaks enemy shots on them and drops cells far behind every player. */
export const updateTerrain = (g: Game, dt: number) => {
  if (!g.rift.arena && Math.floor(g.time) !== Math.floor(g.time - dt)) {
    const C = TERRAIN.cell
    for (const key of g.terrain.cells.keys()) {
      const cx = Math.floor(key / 65536) - 32768
      const cy = (key % 65536) - 32768
      const near = g.players.some((p) => present(p) && Math.abs(cx - Math.floor(p.x / C)) <= 5 && Math.abs(cy - Math.floor(p.y / C)) <= 5)
      if (!near) g.terrain.cells.delete(key)
    }
  }
  for (const p of g.players) if (present(p)) block(g, p, p.radius)
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
  // Loot that a flyer dropped over a mountain rolls off to where the player can reach it.
  for (const k of g.pickups) if (!k.attracted) block(g, k, 3)
}

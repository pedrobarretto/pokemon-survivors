import { FENCE, MAP_H, MAP_W, PLAZA, TERRAIN, TILE, type Bridge, type Paint, type PropKind, type SafariMapDef, type Terrain } from '../../data/safariMaps'

/**
 * A preserve built from its data (`data/safariMaps.ts`): terrain on a grid of
 * vertices, the tall-grass tiles and what stands on the map. Pure: no DOM, so
 * the tests flood every map. Terrain is per vertex, as Wang tiles read it, and
 * walking samples it bilinearly, so a player slides along the curve the art draws.
 */

/** A prop on the map, in world px at its base, and the radius it blocks (0: none). */
export type Placed = { kind: PropKind | 'blocker'; x: number; y: number; solid: number }

export type SafariWorld = {
  terrain: Uint8Array
  /** One byte per tile (`(MAP_W - 1) × (MAP_H - 1)`): 1 where tall grass grows. */
  tall: Uint8Array
  props: readonly Placed[]
  /** Every tile that holds tall grass, row by row (index into `tall`), so drawing walks a short list. */
  tallList: Uint16Array
  bridges: readonly Bridge[]
}

const TILES_W = MAP_W - 1
const TILES_H = MAP_H - 1

export const vertexAt = (x: number, y: number) => y * MAP_W + x
export const tileAt = (x: number, y: number) => y * TILES_W + x

/** Mulberry32: a small seeded generator, so a map is the same for everyone. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Smooth 2D value noise in -1..1, from a table made by `next`. */
const valueNoise = (next: () => number) => {
  const N = 64
  const table = Float32Array.from({ length: N * N }, () => next() * 2 - 1)
  const at = (x: number, y: number) => table[((y & (N - 1)) * N + (x & (N - 1))) | 0]!
  return (x: number, y: number) => {
    const fx = Math.floor(x)
    const fy = Math.floor(y)
    const u = x - fx
    const v = y - fy
    const su = u * u * (3 - 2 * u)
    const sv = v * v * (3 - 2 * v)
    const top = at(fx, fy) * (1 - su) + at(fx + 1, fy) * su
    const low = at(fx, fy + 1) * (1 - su) + at(fx + 1, fy + 1) * su
    return top * (1 - sv) + low * sv
  }
}

/** The distance from (px, py) to a segment. */
const segDistance = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax
  const dy = by - ay
  const len = dx * dx + dy * dy
  const k = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len))
  return Math.hypot(px - (ax + dx * k), py - (ay + dy * k))
}

/** Lays one `Paint` on the grid. */
const applyPaint = (terrain: Uint8Array, paint: Paint, noise: (x: number, y: number) => number) => {
  const put = TERRAIN[paint.put]
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if ('oval' in paint) {
        const [cx, cy, rx, ry] = paint.oval
        const wobble = (paint.rough ?? 0) * noise(x * 0.35 + cx, y * 0.35 + cy)
        if (((x - cx) / (rx + wobble)) ** 2 + ((y - cy) / (ry + wobble)) ** 2 <= 1) terrain[vertexAt(x, y)] = put
      } else {
        const { trail, width } = paint
        for (let i = 1; i < trail.length; i++) {
          const [ax, ay] = trail[i - 1]!
          const [bx, by] = trail[i]!
          if (segDistance(x, y, ax, ay, bx, by) <= width / 2) {
            terrain[vertexAt(x, y)] = put
            break
          }
        }
      }
    }
  }
}

const SOLID: Record<PropKind, number> = { tree: 7, tree2: 7, rock: 8, shrub: 8, accent: 6, fence: 8 }

/** Builds a preserve: the forest ring, the paint in order, the tall tiles and the props. */
export const buildWorld = (def: SafariMapDef): SafariWorld => {
  const next = seeded(def.seed)
  const noise = valueNoise(next)
  const terrain = new Uint8Array(MAP_W * MAP_H)
  // The forest ring, its inner edge wandering so the map doesn't read as a rectangle.
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const edge = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y)
      if (edge < def.border + noise(x * 0.3, y * 0.3) * 1.2) terrain[vertexAt(x, y)] = TERRAIN.forest
    }
  }
  for (const paint of def.paint) applyPaint(terrain, paint, noise)

  const tall = new Uint8Array(TILES_W * TILES_H)
  const list: number[] = []
  for (let y = 0; y < TILES_H; y++) {
    for (let x = 0; x < TILES_W; x++) {
      const n = [vertexAt(x, y), vertexAt(x + 1, y), vertexAt(x, y + 1), vertexAt(x + 1, y + 1)].filter((v) => terrain[v] === TERRAIN.tall).length
      if (n >= 3) {
        tall[tileAt(x, y)] = 1
        list.push(tileAt(x, y))
      }
    }
  }

  const props: Placed[] = def.props.map(([kind, x, y]) => ({ kind, x: x * TILE, y: y * TILE, solid: SOLID[kind] }))
  // The fence either side of the arch, a post every tile. A span that runs into the forest or the water stops there.
  for (const [from, to] of FENCE.spans) {
    for (let x = from; x <= to; x += 1) {
      const terrainThere = terrain[vertexAt(Math.round(x), Math.round(FENCE.y))]!
      if (terrainThere < TERRAIN.block) props.push({ kind: 'fence', x: x * TILE, y: FENCE.y * TILE, solid: SOLID.fence })
    }
  }
  // The booth, its keeper and the notice board stand solid, as does the arch's pair of posts.
  for (const [x, y, solid] of [[PLAZA.kiosk.x, PLAZA.kiosk.y, 26], [PLAZA.ranger.x, PLAZA.ranger.y, 9], [PLAZA.board.x, PLAZA.board.y, 12], [PLAZA.gate.x - 2.4, PLAZA.gate.y, 8], [PLAZA.gate.x + 2.4, PLAZA.gate.y, 8]] as const) props.push({ kind: 'blocker', x: x * TILE, y: y * TILE, solid })
  const open = (x: number, y: number) => terrain[vertexAt(x, y)] === TERRAIN.ground && Math.hypot(x - PLAZA.spawn.x, y - PLAZA.spawn.y) > 10
  const clearOf = (x: number, y: number, gap: number) => props.every((p) => Math.hypot(p.x - x, p.y - y) >= gap)
  for (const kind of ['tree', 'tree2', 'rock', 'shrub', 'accent'] as const) {
    let left = def.scatter[kind] ?? 0
    for (let tries = 0; left > 0 && tries < 400; tries++) {
      const vx = 2 + Math.floor(next() * (MAP_W - 4))
      const vy = 2 + Math.floor(next() * (MAP_H - 4))
      const x = (vx + next() * 0.6 - 0.3) * TILE
      const y = (vy + next() * 0.6 - 0.3) * TILE
      if (!open(vx, vy) || !clearOf(x, y, kind.startsWith('tree') ? 44 : 26)) continue
      props.push({ kind, x, y, solid: SOLID[kind] })
      left -= 1
    }
  }
  // The forest: trees jittered over the ring's vertices, close enough to read as a wall.
  for (let vy = 0; vy < MAP_H; vy += 1) {
    for (let vx = vy % 2; vx < MAP_W; vx += 2) {
      if (terrain[vertexAt(vx, vy)] !== TERRAIN.forest) continue
      props.push({ kind: next() < 0.5 ? 'tree' : 'tree2', x: (vx + next() * 0.7 - 0.35) * TILE, y: (vy + next() * 0.5 - 0.25) * TILE, solid: 0 })
    }
  }
  return { terrain, tall, props, tallList: Uint16Array.from(list), bridges: def.bridges }
}

/** Whether the point (world px) is on a bridge's planks. */
const onBridge = (w: SafariWorld, x: number, y: number) =>
  w.bridges.some((b) => {
    const horizontal = b.y0 === b.y1
    const half = TILE * 0.9
    return horizontal
      ? x >= b.x0 * TILE && x <= b.x1 * TILE && Math.abs(y - b.y0 * TILE) <= half
      : y >= b.y0 * TILE && y <= b.y1 * TILE && Math.abs(x - b.x0 * TILE) <= half
  })

/** How much of a blocking terrain is at (world px): bilinear over the four vertices, so the edge is a curve. */
const blockAt = (w: SafariWorld, x: number, y: number) => {
  const gx = Math.max(0, Math.min(MAP_W - 1.001, x / TILE))
  const gy = Math.max(0, Math.min(MAP_H - 1.001, y / TILE))
  const vx = Math.floor(gx)
  const vy = Math.floor(gy)
  const u = gx - vx
  const v = gy - vy
  const at = (ax: number, ay: number) => (w.terrain[vertexAt(ax, ay)]! >= TERRAIN.block ? 1 : 0)
  return (at(vx, vy) * (1 - u) + at(vx + 1, vy) * u) * (1 - v) + (at(vx, vy + 1) * (1 - u) + at(vx + 1, vy + 1) * u) * v
}

/** Whether a walker's feet can stand at (world px): off the blocking terrain (unless on a bridge), off every solid prop, inside the map. */
export const walkable = (w: SafariWorld, x: number, y: number) => {
  if (x < TILE || y < TILE || x > (MAP_W - 2) * TILE || y > (MAP_H - 1.4) * TILE) return false
  if (blockAt(w, x, y) > 0.5 && !onBridge(w, x, y)) return false
  for (const p of w.props) {
    if (p.solid > 0 && (x - p.x) ** 2 + (y - p.y) ** 2 < p.solid * p.solid) return false
  }
  return true
}

/** The tall tile under (world px), or -1. */
export const tallTileAt = (w: SafariWorld, x: number, y: number) => {
  const tx = Math.floor(x / TILE)
  const ty = Math.floor(y / TILE)
  if (tx < 0 || ty < 0 || tx >= TILES_W || ty >= TILES_H) return -1
  const i = tileAt(tx, ty)
  return w.tall[i] === 1 ? i : -1
}

/**
 * Moves a walker by (dx, dy), axis by axis so it slides along what stops it.
 * Returns the new place in `out`, so a step allocates nothing.
 */
export const moveWalker = (w: SafariWorld, x: number, y: number, dx: number, dy: number, out: { x: number; y: number }) => {
  out.x = walkable(w, x + dx, y) ? x + dx : x
  out.y = walkable(w, out.x, y + dy) ? y + dy : y
}

export type { Terrain }

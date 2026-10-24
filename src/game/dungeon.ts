import { range, type Rng } from '../engine/rng'
import type { Poly, Pt } from '../data/arenas'

/**
 * Mystery Dungeon floors (the cave, `cave.ts`): rooms on a grid joined by
 * corridors, a start, stairs in the room farthest from it, items and scenery.
 * Pure: the same rng gives the same floor, and coordinates are px around the
 * floor's center. `dungeonNav` steers walkers through the corridors toward
 * the player, since they'd otherwise press against the wall nearest to them.
 */

/** A room or a corridor stretch: its top-left corner and size. */
export type Rect = { x: number; y: number; w: number; h: number }

/** A corridor between rooms `a` and `b`: a Z-shaped path from center to center, and the stretches that floor it. */
export type Link = { a: number; b: number; path: readonly Pt[]; rects: readonly Rect[] }

export type DungeonFloor = {
  rooms: readonly Rect[]
  links: readonly Link[]
  start: Pt
  stairs: Pt
  startRoom: number
  stairsRoom: number
  items: readonly Pt[]
  /** Glowing crystals (light and cover) and stalagmites (cover). */
  crystals: readonly Pt[]
  rocks: readonly Pt[]
}

/** Grid, room sizes and corridors per floor, in px. */
export const DUNGEON = {
  grids: [
    { cols: 3, rows: 2 },
    { cols: 3, rows: 3 },
  ],
  cell: { w: 190, h: 160 },
  room: { minW: 92, minH: 74 },
  /** Px kept between a room and its cell's edge, so corridors have somewhere to bend. */
  gap: 18,
  corridor: 34,
  /** Corridors added on top of the spanning tree, so later floors have loops. */
  loops: [0, 1],
  /** Items lying on each floor. */
  items: 2,
} as const

const center = (r: Rect): Pt => [Math.round(r.x + r.w / 2), Math.round(r.y + r.h / 2)]

const inRect = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h

/** A spot inside room `r`, `inset` px from its walls. */
const spotIn = (rng: Rng, r: Rect, inset: number): Pt => [Math.round(range(rng, r.x + inset, r.x + r.w - inset)), Math.round(range(rng, r.y + inset, r.y + r.h - inset))]

/** A spot in one of room `r`'s corners, clear of the corridors that come in at the middle of its walls. */
const cornerIn = (rng: Rng, r: Rect): Pt => {
  const x = rng() < 0.5 ? r.x + range(rng, 12, 26) : r.x + r.w - range(rng, 12, 26)
  const y = rng() < 0.5 ? r.y + range(rng, 12, 22) : r.y + r.h - range(rng, 8, 16)
  return [Math.round(x), Math.round(y)]
}

const far2 = ([ax, ay]: Pt, [bx, by]: Pt) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by)

/** The stretch of floor along a path segment, `w` wide and running `w / 2` past both ends so bends overlap. */
const stretch = ([ax, ay]: Pt, [bx, by]: Pt, w: number): Rect => {
  const h = w / 2
  return { x: Math.min(ax, bx) - h, y: Math.min(ay, by) - h, w: Math.abs(bx - ax) + w, h: Math.abs(by - ay) + w }
}

/** A Z-shaped corridor between neighboring rooms: out of each room straight, with the bend in the gap between them. */
const corridor = (rooms: readonly Rect[], a: number, b: number, across: boolean): Link => {
  const ra = rooms[a]!
  const rb = rooms[b]!
  const [ax, ay] = center(ra)
  const [bx, by] = center(rb)
  const path: Pt[] = across
    ? (() => {
        const mx = Math.round((ra.x + ra.w + rb.x) / 2)
        return [[ax, ay], [mx, ay], [mx, by], [bx, by]]
      })()
    : (() => {
        const my = Math.round((ra.y + ra.h + rb.y) / 2)
        return [[ax, ay], [ax, my], [bx, my], [bx, by]]
      })()
  return { a, b, path, rects: path.slice(1).map((p, i) => stretch(path[i]!, p, DUNGEON.corridor)) }
}

/** Shortest number of corridors from every room to the nearest of `goals`. */
export const roomDistances = (floor: Pick<DungeonFloor, 'rooms' | 'links'>, goals: readonly number[], out: number[] = []) => {
  out.length = floor.rooms.length
  out.fill(Infinity)
  const queue = [...goals]
  for (const g of goals) out[g] = 0
  for (let i = 0; i < queue.length; i++) {
    const r = queue[i]!
    for (const l of floor.links) {
      const n = l.a === r ? l.b : l.b === r ? l.a : -1
      if (n < 0 || out[n]! <= out[r]! + 1) continue
      out[n] = out[r]! + 1
      queue.push(n)
    }
  }
  return out
}

/** Lays out floor `index` (0 = B1F) of a dungeon. */
export const generateFloor = (rng: Rng, index: number): DungeonFloor => {
  const grid = DUNGEON.grids[Math.min(index, DUNGEON.grids.length - 1)]!
  const { w: CW, h: CH } = DUNGEON.cell
  const { gap } = DUNGEON
  const rooms: Rect[] = []
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const ox = (c - (grid.cols - 1) / 2) * CW - CW / 2
      const oy = (r - (grid.rows - 1) / 2) * CH - CH / 2
      const w = Math.round(range(rng, DUNGEON.room.minW, CW - gap * 2))
      const h = Math.round(range(rng, DUNGEON.room.minH, CH - gap * 2))
      rooms.push({ x: Math.round(ox + gap + rng() * (CW - gap * 2 - w)), y: Math.round(oy + gap + rng() * (CH - gap * 2 - h)), w, h })
    }
  }
  const at = (c: number, r: number) => r * grid.cols + c
  const neighbors = (i: number) => {
    const c = i % grid.cols
    const r = Math.floor(i / grid.cols)
    return [c > 0 ? at(c - 1, r) : -1, c < grid.cols - 1 ? at(c + 1, r) : -1, r > 0 ? at(c, r - 1) : -1, r < grid.rows - 1 ? at(c, r + 1) : -1].filter((n) => n >= 0)
  }
  // A random spanning tree (depth-first), then a few extra corridors for loops.
  const links: Link[] = []
  const linked = (a: number, b: number) => links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))
  const join = (a: number, b: number) => {
    const [lo, hi] = a < b ? [a, b] : [b, a]
    links.push(corridor(rooms, lo, hi, hi - lo === 1))
  }
  const seen = new Set<number>()
  const stack = [Math.floor(rng() * rooms.length)]
  seen.add(stack[0]!)
  while (stack.length > 0) {
    const cur = stack[stack.length - 1]!
    const open = neighbors(cur).filter((n) => !seen.has(n))
    if (open.length === 0) {
      stack.pop()
      continue
    }
    const next = open[Math.floor(rng() * open.length)]!
    join(cur, next)
    seen.add(next)
    stack.push(next)
  }
  const extra = rooms.flatMap((_, i) => neighbors(i).filter((n) => n > i && !linked(i, n)).map((n) => [i, n] as const))
  for (let k = 0; k < (DUNGEON.loops[index] ?? 1) && extra.length > 0; k++) {
    const [a, b] = extra.splice(Math.floor(rng() * extra.length), 1)[0]!
    join(a, b)
  }

  const startRoom = Math.floor(rng() * rooms.length)
  const dist = roomDistances({ rooms, links }, [startRoom])
  // The stairs wait in the room the most corridors away (the farthest one, on a tie).
  const start = center(rooms[startRoom]!)
  const far = (i: number) => dist[i]! * 1e7 + far2(center(rooms[i]!), start)
  const stairsRoom = rooms.reduce((best, _, i) => (far(i) > far(best) ? i : best), 0)
  const stairs = spotIn(rng, rooms[stairsRoom]!, 24)

  const taken: Pt[] = [start, stairs]
  const scatter = (count: number, pool: readonly number[], spacing: number, spot: (r: Rect) => Pt) => {
    const out: Pt[] = []
    for (let i = 0; i < count * 6 && out.length < count; i++) {
      const p = spot(rooms[pool[Math.floor(rng() * pool.length)]!]!)
      if (taken.some((t) => far2(t, p) < spacing * spacing)) continue
      out.push(p)
      taken.push(p)
    }
    return out
  }
  const all = rooms.map((_, i) => i)
  const others = all.filter((i) => i !== startRoom)
  const items = scatter(DUNGEON.items, others, 40, (r) => spotIn(rng, r, 18))
  const crystals = scatter(Math.ceil(rooms.length / 2), all, 50, (r) => cornerIn(rng, r))
  const rocks = scatter(rooms.length, others, 36, (r) => spotIn(rng, r, 26))
  return { rooms, links, start, stairs, startRoom, stairsRoom, items, crystals, rocks }
}

/** Index of the room holding (x, y), or -1. */
export const roomAt = (floor: Pick<DungeonFloor, 'rooms'>, x: number, y: number) => floor.rooms.findIndex((r) => inRect(r, x, y))

/** The corridor holding (x, y) and which of its stretches, or null. */
const linkAt = (floor: Pick<DungeonFloor, 'links'>, x: number, y: number) => {
  for (const link of floor.links) {
    const i = link.rects.findIndex((r) => inRect(r, x, y))
    if (i >= 0) return { link, i }
  }
  return null
}

/** Rooms the player counts as being in: theirs, or both ends of the corridor they walk. */
const playerRooms = (floor: DungeonFloor, x: number, y: number): readonly number[] => {
  const r = roomAt(floor, x, y)
  if (r >= 0) return [r]
  const at = linkAt(floor, x, y)
  return at ? [at.link.a, at.link.b] : []
}

/**
 * Steering through a dungeon floor for walkers chasing the player at (px, py),
 * all in floor px. The returned function writes where a walker at (x, y)
 * should head into `out` and returns true, or returns false when it can go
 * straight for the player (same room, or nowhere known).
 */
export const dungeonNav = (floor: DungeonFloor, px: number, py: number) => {
  const goals = playerRooms(floor, px, py)
  if (goals.length === 0) return null
  const dist = roomDistances(floor, goals)
  return (x: number, y: number, out: { x: number; y: number }) => {
    const r = roomAt(floor, x, y)
    if (r >= 0) {
      if (dist[r] === 0) return false
      const link = floor.links.find((l) => (l.a === r || l.b === r) && dist[l.a === r ? l.b : l.a] === dist[r]! - 1)
      if (!link) return false
      // Out of the room along the corridor: its first bend from this side.
      const [tx, ty] = link.a === r ? link.path[1]! : link.path[link.path.length - 2]!
      out.x = tx
      out.y = ty
      return true
    }
    const at = linkAt(floor, x, y)
    if (!at) return false
    const { link, i } = at
    if (dist[link.a] === 0 && dist[link.b] === 0) return false
    const forward = dist[link.b]! <= dist[link.a]!
    // Stretch i runs from path[i] to path[i + 1]; head for its far end, or the next one once there.
    let k = forward ? i + 1 : i
    const [kx, ky] = link.path[k]!
    if (Math.abs(kx - x) + Math.abs(ky - y) < 6) k = forward ? Math.min(link.path.length - 1, k + 1) : Math.max(0, k - 1)
    out.x = link.path[k]![0]
    out.y = link.path[k]![1]
    return true
  }
}

/**
 * A corridor's mouth, in px: a funnel reaching `into` the room and `out` along
 * the corridor, `flare` wider than the corridor on each side at the wall's
 * room end and `narrow` narrower at its corridor end, so a body a little off
 * the corridor's line slides along it into the corridor instead of catching
 * on the wall's corner. Where it crosses the wall it shaves the corners off
 * (8 px deep), which the cave's art shows (`render/places.ts`).
 */
export const MOUTH = { into: 16, out: 24, flare: 16, narrow: 4 } as const

/** The funnel where the corridor from `room`'s center toward `to` (straight out of it) leaves through its wall. */
const mouth = (room: Rect, [cx, cy]: Pt, [tx, ty]: Pt): Poly => {
  const across = tx !== cx
  const sign = Math.sign(across ? tx - cx : ty - cy)
  const wall = across ? (sign > 0 ? room.x + room.w : room.x) : sign > 0 ? room.y + room.h : room.y
  const half = DUNGEON.corridor / 2
  // (along, aside): px out from the wall, px off the corridor's line.
  const at = (along: number, aside: number): Pt => (across ? [wall + along * sign, cy + aside] : [cx + aside, wall + along * sign])
  const wide = half + MOUTH.flare
  const tight = half - MOUTH.narrow
  return { kind: 'poly', pts: [at(-MOUTH.into, -wide), at(MOUTH.out, -tight), at(MOUTH.out, tight), at(-MOUTH.into, wide)] }
}

const rectPoly = (r: Rect): Poly => ({ kind: 'poly', pts: [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]] })

/**
 * The floor's shapes for `game/arenaFloor.ts`: every room and corridor stretch
 * as a convex polygon, and a funnel at each end of every corridor (`MOUTH`).
 */
export const floorShapes = (floor: Pick<DungeonFloor, 'rooms' | 'links'>): Poly[] => [
  ...[...floor.rooms, ...floor.links.flatMap((l) => l.rects)].map(rectPoly),
  ...floor.links.flatMap((l) => {
    const n = l.path.length
    return [mouth(floor.rooms[l.a]!, l.path[0]!, l.path[1]!), mouth(floor.rooms[l.b]!, l.path[n - 1]!, l.path[n - 2]!)]
  }),
]

import { REALM_ROOMS, type Door, type Point, type Rect, type TownRoomId } from '../data/realmMap'
import { blocked, type Ground } from './interp'

/**
 * Finding the way through the town for the walks the screen does on its own
 * (the Hora do Realm's "Ir"): which door leads toward a room, and the corners
 * to walk through to reach it, so the trainer doesn't snag on a fountain. Pure.
 */

/** The side of the search's grid (world px). */
const CELL = 8
/** How often a straight line is checked along its length (world px). */
const PROBE = 3
/** The feet's margin from the room's edges (`interp.ts` holds it in the same way). */
const EDGE = 4

const free = (g: Ground, x: number, y: number) => x >= EDGE && y >= EDGE && x <= g.w - EDGE && y <= g.h - EDGE && !blocked(g, x, y)

/** The first door out of `from` on the fewest doors to `to`, or null when they're the same room or not joined. */
export const doorToward = (from: TownRoomId, to: TownRoomId): Door | null => {
  const queue: { room: TownRoomId; first: Door | null }[] = [{ room: from, first: null }]
  const seen = new Set<TownRoomId>([from])
  while (queue.length) {
    const { room, first } = queue.shift()!
    for (const d of REALM_ROOMS[room].doors) {
      if (seen.has(d.to)) continue
      const hop = first ?? d
      if (d.to === to) return hop
      seen.add(d.to)
      queue.push({ room: d.to, first: hop })
    }
  }
  return null
}

/** The free point of a door's rect nearest its middle (a door's middle may lie under the wall it's cut in), or null. */
export const doorPoint = (g: Ground, at: Rect): Point | null => {
  const mid = { x: at.x + at.w / 2, y: at.y + at.h / 2 }
  let best: Point | null = null
  let bestD = Infinity
  for (let y = at.y; y <= at.y + at.h; y++) {
    for (let x = at.x; x <= at.x + at.w; x++) {
      const d = Math.hypot(x - mid.x, y - mid.y)
      if (d < bestD && free(g, x, y)) {
        best = { x, y }
        bestD = d
      }
    }
  }
  return best
}

const clear = (g: Ground, a: Point, b: Point) => {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / PROBE)
  for (let i = 1; i <= n; i++) if (!free(g, a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n)) return false
  return true
}

/** The corners to walk through from `from` to `to`, in order and ending at `to` (breadth first over a grid, then cut to the corners that matter); empty when there's no way. */
export const routeTo = (g: Ground, from: Point, to: Point): Point[] => {
  const cols = Math.ceil(g.w / CELL)
  const rows = Math.ceil(g.h / CELL)
  const center = (i: number): Point => ({ x: (i % cols) * CELL + CELL / 2, y: Math.floor(i / cols) * CELL + CELL / 2 })
  const nearest = (p: Point) => {
    const cx = Math.floor(p.x / CELL)
    const cy = Math.floor(p.y / CELL)
    let found = -1
    let best = Infinity
    for (let y = Math.max(0, cy - 3); y <= Math.min(rows - 1, cy + 3); y++) {
      for (let x = Math.max(0, cx - 3); x <= Math.min(cols - 1, cx + 3); x++) {
        const c = center(y * cols + x)
        const d = Math.hypot(c.x - p.x, c.y - p.y)
        if (d < best && free(g, c.x, c.y)) {
          best = d
          found = y * cols + x
        }
      }
    }
    return found
  }
  const start = nearest(from)
  const goal = nearest(to)
  if (start < 0 || goal < 0) return []
  const prev = new Int32Array(cols * rows).fill(-1)
  prev[start] = start
  const queue = [start]
  for (let head = 0; head < queue.length && prev[goal] === -1; head++) {
    const c = queue[head]!
    const x = c % cols
    for (const n of [x > 0 ? c - 1 : -1, x < cols - 1 ? c + 1 : -1, c - cols, c + cols]) {
      if (n < 0 || n >= cols * rows || prev[n] !== -1) continue
      const at = center(n)
      if (!free(g, at.x, at.y)) continue
      prev[n] = c
      queue.push(n)
    }
  }
  if (prev[goal] === -1) return []
  const cells: Point[] = [to]
  for (let c = goal; c !== start; c = prev[c]!) cells.unshift(center(c))
  cells.unshift(center(start))
  // From where the trainer stands, on to the farthest corner in a straight line, again and again.
  const route: Point[] = []
  let at = from
  let i = 0
  while (i < cells.length) {
    let far = i
    for (let k = cells.length - 1; k > i; k--) {
      if (clear(g, at, cells[k]!)) {
        far = k
        break
      }
    }
    route.push(cells[far]!)
    at = cells[far]!
    i = far + 1
  }
  return route
}

/** The walk from `at` in `room` to the door that leads toward `to`; empty when there's none. */
export const routeToward = (room: TownRoomId, to: TownRoomId, at: Point): Point[] => {
  const door = doorToward(room, to)
  const point = door && doorPoint(REALM_ROOMS[room], door.at)
  return point ? routeTo(REALM_ROOMS[room], at, point) : []
}

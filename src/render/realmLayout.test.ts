import { describe, expect, it } from 'vitest'
import { REALM_ROOMS, TOWN_ROOMS, type Point, type Shape, type TownRoomId } from '../data/realmMap'
import { TOWN_LAYOUT, type TownArt } from './realmLayout'

const inShape = (s: Shape, x: number, y: number) => (s.kind === 'rect' ? x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h : ((x - s.x) / s.rx) ** 2 + ((y - s.y) / s.ry) ** 2 <= 1)

const blocked = (room: TownRoomId, x: number, y: number) => REALM_ROOMS[room].solid.some((s) => inShape(s, x, y))

/** Pieces walkers brush past, sit on or that lie flat, on the water or on the wall: no solid under them. */
const OPEN: ReadonlySet<TownArt> = new Set(['flowers', 'boat', 'shelf', 'sandcastle', 'beachball', 'cornerStool', 'rocketRug'])

/** The grid step (px) the walk is checked on. */
const STEP = 4

/** Every grid point a trainer reaches from the room's spawn, walking the open ground. */
const reachable = (room: TownRoomId) => {
  const { w, h, spawn } = REALM_ROOMS[room]
  const cols = Math.floor(w / STEP)
  const rows = Math.floor(h / STEP)
  const seen = new Uint8Array(cols * rows)
  const start = [Math.round(spawn.x / STEP), Math.round(spawn.y / STEP)] as const
  const queue: (readonly [number, number])[] = [start]
  seen[start[1] * cols + start[0]] = 1
  while (queue.length) {
    const [cx, cy] = queue.pop()!
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || seen[ny * cols + nx] || blocked(room, nx * STEP, ny * STEP)) continue
      seen[ny * cols + nx] = 1
      queue.push([nx, ny])
    }
  }
  return (p: Point, within: number) => {
    for (let y = Math.max(0, Math.floor((p.y - within) / STEP)); y <= Math.min(rows - 1, Math.ceil((p.y + within) / STEP)); y++)
      for (let x = Math.max(0, Math.floor((p.x - within) / STEP)); x <= Math.min(cols - 1, Math.ceil((p.x + within) / STEP)); x++)
        if (seen[y * cols + x] && Math.hypot(x * STEP - p.x, y * STEP - p.y) <= within) return true
    return false
  }
}

describe('the town matches its art', () => {
  it.each(TOWN_ROOMS)('%s: every standing piece keeps walkers off its feet', (room) => {
    const loose = TOWN_LAYOUT[room].props.filter((p) => !OPEN.has(p.art) && ![0, 4, 8, 12].some((up) => blocked(room, p.x, p.y - up)))
    expect(loose).toEqual([])
  })

  it.each(TOWN_ROOMS)('%s: the spawn, every spot and every door landing are open', (room) => {
    const r = REALM_ROOMS[room]
    expect(blocked(room, r.spawn.x, r.spawn.y)).toBe(false)
    for (const s of r.spots) expect(blocked(room, s.at.x, s.at.y), `${s.kind} at ${s.at.x},${s.at.y}`).toBe(false)
    for (const d of r.doors) expect(blocked(d.to, d.spawn.x, d.spawn.y), `landing in ${d.to}`).toBe(false)
  })

  it.each(TOWN_ROOMS)('%s: from the spawn a trainer walks to every door and spot', (room) => {
    const r = REALM_ROOMS[room]
    const reach = reachable(room)
    for (const d of r.doors) expect(reach({ x: d.at.x + d.at.w / 2, y: d.at.y + d.at.h / 2 }, Math.max(d.at.w, d.at.h)), `door to ${d.to}`).toBe(true)
    for (const s of r.spots) expect(reach(s.at, s.reach), `${s.kind} at ${s.at.x},${s.at.y}`).toBe(true)
  })

  it.each(TOWN_ROOMS)('%s: a door landing lands where the way back is not underfoot', (room) => {
    for (const d of REALM_ROOMS[room].doors) {
      const back = REALM_ROOMS[d.to].doors.find((b) => b.to === room)
      expect(back, `${d.to} has a way back`).toBeDefined()
      const a = back!.at
      const inside = d.spawn.x >= a.x && d.spawn.x < a.x + a.w && d.spawn.y >= a.y && d.spawn.y < a.y + a.h
      expect(inside).toBe(false)
    }
  })
})

describe('the Secret Base Grove', () => {
  const trail = REALM_ROOMS.trail

  it('has one entrance of your own, its spot right in front of it', () => {
    const mine = TOWN_LAYOUT.trail.props.filter((p) => p.mine)
    const spots = trail.spots.filter((s) => s.kind === 'myBase')
    expect(mine).toHaveLength(1)
    expect(spots).toHaveLength(1)
    const [p, s] = [mine[0]!, spots[0]!]
    expect(Math.abs(s.at.x - p.x)).toBeLessThanOrEqual(8)
    expect(s.at.y - p.y).toBeGreaterThan(0)
    expect(s.at.y - p.y).toBeLessThanOrEqual(s.reach)
  })

  it('keeps every host standing by its spot, off the walk', () => {
    const hosts = TOWN_LAYOUT.trail.hosts ?? []
    const talking = hosts.filter((h) => !('keeper' in h))
    const spots = trail.spots.filter((s) => s.kind === 'host')
    expect(talking).toHaveLength(spots.length)
    for (const host of talking) {
      expect(spots.some((s) => Math.hypot(s.at.x - host.x, s.at.y - host.y) <= s.reach)).toBe(true)
      expect(blocked('trail', host.x, host.y - 2)).toBe(true)
    }
    for (const host of hosts) expect(blocked('trail', host.x, host.y - 2)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { ARENA_FORMAT_IDS, ARENA_FORMATS } from './arenaFormats'
import { VERSUS, VERSUS_FORMATS } from './versus'
import { laneYAt, MAPS, type MapId, type Rect } from './versusMaps'
import { hopsBetween } from '../game/versusBots'
import { matchMap } from '../game/versusRules'

const IDS = Object.keys(MAPS) as MapId[]
const inside = (r: Rect, x: number, y: number) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1
const onFloor = (rects: readonly Rect[], x: number, y: number) => rects.some((r) => inside(r, x, y))

describe('the formats', () => {
  it("play on a map, with the relay's team size", () => {
    for (const f of ARENA_FORMAT_IDS) {
      expect(VERSUS_FORMATS[f].teamSize).toBe(ARENA_FORMATS[f].teamSize)
      for (const id of VERSUS_FORMATS[f].maps) expect(MAPS[id]).toBeDefined()
      expect(VERSUS_FORMATS[f].stretch).toBeLessThan(VERSUS_FORMATS[f].length)
      expect(VERSUS_FORMATS[f].drednaw.first).toBeLessThan(VERSUS_FORMATS[f].length - VERSUS_FORMATS[f].stretch)
    }
  })
})

describe('a match\'s map', () => {
  it("is the room's pick when its format plays it, else drawn from the seed among the format's", () => {
    expect(matchMap('standard', 1, 'cove')).toBe('cove')
    expect(matchMap('quick', 1, 'reef')).toBe('reef')
    for (const f of ARENA_FORMAT_IDS) {
      const drawn = new Set(Array.from({ length: 40 }, (_, seed) => matchMap(f, seed, f === 'quick' ? 'vale' : 'glade')))
      expect([...drawn].sort()).toEqual([...VERSUS_FORMATS[f].maps].sort())
      expect(matchMap(f, 1234)).toBe(matchMap(f, 1234))
    }
  })
})

describe('a lane\'s path', () => {
  it('joins its points with straight lines, flat past its ends', () => {
    const lane = [[560, 280], [370, 280], [330, 340], [0, 340]] as const
    expect(laneYAt(lane, 700)).toBe(280)
    expect(laneYAt(lane, 450)).toBe(280)
    expect(laneYAt(lane, 350)).toBe(310)
    expect(laneYAt(lane, 0)).toBe(340)
  })
})

describe.each(IDS)('the %s map', (id) => {
  const map = MAPS[id]

  it('mirrors Blue and Red', () => {
    for (const goal of map.goals) expect(map.goals.some((o) => o.team !== goal.team && o.x === -goal.x && o.y === goal.y && o.points === goal.points)).toBe(true)
    for (const c of map.camps) expect(map.camps.some((o) => o.x === -c.x && o.y === c.y && o.species === c.species)).toBe(true)
    expect(map.spawn[1]).toEqual({ x: -map.spawn[0].x, y: map.spawn[0].y })
    expect(map.goals.some((o) => o.team === 0 && o.x < 0)).toBe(true)
  })

  it('has every goal, camp and the center on the floor, and reachable from both spawn pads', () => {
    for (const p of [...map.goals, ...map.camps, map.center, ...map.spawn]) {
      expect(onFloor(map.rects, p.x, p.y)).toBe(true)
      for (const pad of map.spawn) expect(hopsBetween(id, pad.x, pad.y, p.x, p.y)).toBeLessThan(Infinity)
    }
  })

  it('opens every base goal by a lane goal of its team', () => {
    for (const goal of map.goals.filter((o) => o.base)) expect(map.goals.some((o) => o.team === goal.team && !o.base)).toBe(true)
  })

  it('keeps its tall grass on the floor and clear of the goals, the pads and the camps', () => {
    for (const r of map.grass) {
      for (const [x, y] of [[r.x0, r.y0], [r.x1, r.y0], [r.x0, r.y1], [r.x1, r.y1]] as const) expect(onFloor(map.rects, x, y)).toBe(true)
      const near = (x: number, y: number, d: number) => Math.max(r.x0 - x, 0, x - r.x1) ** 2 + Math.max(r.y0 - y, 0, y - r.y1) ** 2 < d * d
      for (const goal of map.goals) expect(near(goal.x, goal.y, goal.r)).toBe(false)
      for (const pad of map.spawn) expect(near(pad.x, pad.y, VERSUS.spawnPad.r)).toBe(false)
      for (const c of map.camps) expect(near(c.x, c.y, 16)).toBe(false)
    }
  })

  it("keeps the bots' lanes between its jungle and its lanes' paths", () => {
    expect(map.lanes).toBeGreaterThanOrEqual(Math.max(...map.look.jungles.map((j) => j.y1)) - 10)
    expect(map.lanes).toBeLessThan(Math.min(...map.look.lane.map(([, y]) => y)))
  })

  it("lays its lanes' paths on the floor, from the base to the middle", () => {
    for (let ax = 0; ax <= map.look.baseX; ax += 10) for (const sx of [-1, 1]) for (const sy of [-1, 1]) expect(onFloor(map.rects, sx * ax, sy * laneYAt(map.look.lane, ax))).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import type { ArenaShape, Circle, Pt } from '../data/arenas'
import { PLAYABLE } from '../data/hatchlings'
import { isLegend } from '../data/legends'
import { fits } from './arenaFloor'
import { playerRadius } from './game'
import { GROTTO_GLADES, GROTTO_START } from './grotto'
import { footOf } from './terrain'
import { UNDERGROUND_FLOOR, UNDERGROUND_ROOMS, UNDERGROUND_START } from './underground'

/** The widest foot any playable walks a room with: its hitbox from `bodyOf`, capped by `footOf`. */
const BIGGEST_FOOT = Math.max(
  ...Object.entries(PLAYABLE).flatMap(([id, def]) => def.line.map((s) => footOf({ radius: playerRadius(s.dex, isLegend(id)) }))),
)

/**
 * Floods a room's floor from `start` over a 1 px grid of the spots where a
 * foot of radius `r` fits wholly inside one shape: what `keepOn` lets a body
 * stand on. Returns whether each target spot was reached.
 */
const reach = (floor: readonly ArenaShape[], start: Pt, r: number, targets: readonly Pt[]) => {
  const SPAN = 200
  const N = SPAN * 2 + 1
  const open = (i: number) => floor.some((s) => fits(s, (i % N) - SPAN, Math.floor(i / N) - SPAN, r))
  const at = ([x, y]: Pt) => (Math.round(y) + SPAN) * N + Math.round(x) + SPAN
  const seen = new Uint8Array(N * N)
  const queue = [at(start)]
  seen[queue[0]!] = 1
  while (queue.length > 0) {
    const i = queue.pop()!
    const x = i % N
    for (const j of [x > 0 ? i - 1 : -1, x < N - 1 ? i + 1 : -1, i - N, i + N]) {
      if (j < 0 || j >= N * N || seen[j] || !open(j)) continue
      seen[j] = 1
      queue.push(j)
    }
  }
  return targets.map((t) => seen[at(t)] === 1)
}

const centers = (rooms: readonly Omit<Circle, 'kind'>[]): Pt[] => rooms.map((c) => [c.x, c.y])

describe('hidden zones', () => {
  it('has a playable whose foot is as wide as feet get', () => {
    expect(BIGGEST_FOOT).toBe(footOf({ radius: Infinity }))
  })

  it('lets the biggest body walk from the way in to every room of the Underground', () => {
    expect(reach(UNDERGROUND_FLOOR, UNDERGROUND_START, BIGGEST_FOOT, centers(UNDERGROUND_ROOMS))).toEqual(UNDERGROUND_ROOMS.map(() => true))
  })

  it('lets the biggest body walk from the way in to every glade of the Hidden Grotto', () => {
    const floor = GROTTO_GLADES.map((c): ArenaShape => ({ kind: 'circle', ...c }))
    expect(reach(floor, GROTTO_START, BIGGEST_FOOT, centers(GROTTO_GLADES))).toEqual(GROTTO_GLADES.map(() => true))
  })
})

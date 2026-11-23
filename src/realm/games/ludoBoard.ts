import { GOAL, LANE, LUDO } from './ludo.rules'

/**
 * Ludo's board as cells of an 11 × 11 cross (`ludo.rules.ts` counts squares;
 * this says where they are), in seat 0's frame: its yard bottom left, its
 * start square at the foot of the left column of the bottom arm, play going
 * clockwise up that column. Every other seat's cells are seat 0's turned a
 * quarter clockwise per seat (`rotate`); a screen turns the whole board so
 * its own seat sits bottom left.
 */

export const SIZE = 11

/** A cell: column, row (row 0 at the top). */
export type Cell = readonly [number, number]

/** Straight runs from a cell: `n` cells stepping (`dc`, `dr`). */
const run = (from: Cell, dc: number, dr: number, n: number): Cell[] => Array.from({ length: n }, (_, i) => [from[0] + dc * i, from[1] + dr * i] as const)

/** The 40 squares round, from seat 0's start. */
export const TRACK: readonly Cell[] = [
  ...run([4, 10], 0, -1, 5),
  ...run([3, 6], -1, 0, 4),
  ...run([0, 5], 0, -1, 2),
  ...run([1, 4], 1, 0, 4),
  ...run([4, 3], 0, -1, 4),
  ...run([5, 0], 1, 0, 2),
  ...run([6, 1], 0, 1, 4),
  ...run([7, 4], 1, 0, 4),
  ...run([10, 5], 0, 1, 2),
  ...run([9, 6], -1, 0, 4),
  ...run([6, 7], 0, 1, 4),
  [5, 10],
]

/** Seat 0's lane home, from the bottom up, and the goal in the middle. */
export const LANE0: readonly Cell[] = run([5, 9], 0, -1, LUDO.lane)
export const CENTER: Cell = [5, 5]

/** Seat 0's yard: the 4 × 4 corner bottom left (its top-left cell and size). */
export const YARD0 = { c: 0, r: 7, size: 4 } as const

/** A cell turned a quarter clockwise `turns` times round the board's middle. */
export const rotate = (cell: Cell, turns: number): Cell => {
  let [c, r] = cell
  for (let k = 0; k < ((turns % 4) + 4) % 4; k++) [c, r] = [SIZE - 1 - r, c]
  return [c, r]
}

/** The cell a piece of `seat` at place `p` stands on (seat 0's frame), or null in its yard. */
export const cellAt = (seat: number, p: number): Cell | null => {
  if (p < 0) return null
  if (p < LANE) return TRACK[(seat * LUDO.spacing + p) % LUDO.track]!
  if (p < GOAL) return rotate(LANE0[p - LANE]!, seat)
  return CENTER
}

/** A seat's yard turned `turns` quarters: its top-left cell (the square's corner that ends up top left). */
export const yardOf = (turns: number): Cell => {
  const a = rotate([YARD0.c, YARD0.r], turns)
  const b = rotate([YARD0.c + YARD0.size - 1, YARD0.r + YARD0.size - 1], turns)
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1])]
}

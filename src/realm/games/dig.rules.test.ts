import { describe, expect, it } from 'vitest'
import { DIG_FOSSIL_FAMILIES, DIG_HALVES, DIG_TREASURES, GALAR_PAIRS } from '../../data/digTreasures'
import { buildWall, cellIndex, DIG, digOdds, digPowers, digVein, fossilFor, fossilStreak, hitWall, labHalf, NO_POWERS, sortOut, startProgress, tileAt, toolArea, toolCrack, treasureCells, treasureFree, wallPrice, wallWorth, type DigWall, type DigWallCtx } from './dig.rules'

const week = '2026-11-09'
const ctx: DigWallCtx = { week, powers: NO_POWERS, lacking: [], due: false }

const wall = (seed: number, c: Partial<DigWallCtx> = {}): DigWall => buildWall(seed, { ...ctx, ...c })

/** A wall with every cell one layer, for hits and collapse. */
const soft = (seed = 11) => ({ ...wall(seed), depths: new Array<number>(DIG.cols * DIG.rows).fill(1) })

describe('wall generation', () => {
  it('is deterministic for a seed, and walls differ between seeds', () => {
    expect(wall(5)).toEqual(wall(5))
    const walls = Array.from({ length: 30 }, (_, i) => JSON.stringify(wall(i + 1)))
    expect(new Set(walls).size).toBeGreaterThan(25)
  })

  it("buries Diancie's Pink Diamond only when the API says so, and it always fits, a guaranteed fossil beside it", () => {
    for (let s = 1; s < 200; s++) {
      expect(wall(s).treasures.some((t) => t.id === 'pinkDiamond')).toBe(false)
      expect(wall(s, { diamond: true }).treasures.map((t) => t.id)).toContain('pinkDiamond')
      expect(wall(s, { diamond: true, due: true, lacking: [...DIG_FOSSIL_FAMILIES] }).treasures.map((t) => t.id)).toContain('pinkDiamond')
    }
  })

  it('keeps the rock pattern varied', () => {
    expect(new Set(Array.from({ length: 200 }, (_, i) => wall(i + 1).pattern)).size).toBeGreaterThanOrEqual(5)
  })

  it('places treasures inside the grid, never overlapping', () => {
    for (let s = 1; s < 400; s++) {
      const w = wall(s)
      const taken = new Set<number>()
      for (const t of w.treasures) {
        for (const i of treasureCells(t)) {
          expect(i).toBeGreaterThanOrEqual(0)
          expect(i).toBeLessThan(DIG.cols * DIG.rows)
          expect(taken.has(i)).toBe(false)
          taken.add(i)
        }
      }
    }
  })

  it('shows the week the same vein and odds for everyone, and odds that sum to 1', () => {
    expect(digVein(week)).toEqual(digVein(week))
    expect(digOdds(week).reduce((sum, o) => sum + o.share, 0)).toBeCloseTo(1)
  })

  it('makes large treasures take more cells than a nugget', () => {
    expect(treasureCells({ id: 'skullFossil', x: 0, y: 0 }).length).toBeGreaterThan(treasureCells({ id: 'nugget', x: 0, y: 0 }).length * 3)
  })

  it('keeps the average wall worth well under its price, so it stays a ₽ sink', () => {
    const weeks = Array.from({ length: 20 }, (_, i) => `2026-${String(9 + (i % 3)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`)
    let worth = 0
    let n = 0
    for (const wk of weeks) {
      for (let s = 1; s <= 800; s++) {
        worth += wallWorth(wall(s * 13 + 7, { week: wk }))
        n++
      }
    }
    expect(worth / n).toBeLessThan(DIG.price)
  })
})

describe('tools and partners', () => {
  it('opens one cell with the pickaxe, a cross with the hammer, a square for Ground', () => {
    const center = cellIndex(5, 4)
    expect(toolArea('pick', center, NO_POWERS)).toEqual([center])
    expect(toolArea('hammer', center, NO_POWERS)).toHaveLength(5)
    expect(toolArea('hammer', center, digPowers(['ground']))).toHaveLength(9)
  })

  it('stays inside the grid at a corner', () => {
    expect(toolArea('hammer', cellIndex(0, 0), NO_POWERS)).toHaveLength(3)
  })

  it('gives Rock more crack to hold, Psychic one cell of the biggest treasure, Steel a deeper pick', () => {
    expect(digPowers(['rock']).hold).toBe(DIG.rockHold)
    const seen = wall(44, { powers: digPowers(['psychic']) })
    expect(seen.hint).not.toBeNull()
    const biggest = seen.treasures[0]!
    expect(treasureCells(biggest)).toContain(seen.hint!.i)
    expect(wall(44).hint).toBeNull()
    const w = { ...soft(), depths: new Array<number>(DIG.cols * DIG.rows).fill(3) }
    const hit = hitWall(w, startProgress(w), 'pick', 0, digPowers(['steel']))!
    expect(hit.cells[0]!.left).toBe(1)
  })

  it('charges more for the bigger hammer', () => {
    expect(toolCrack('hammer', digPowers(['ground']))).toBeGreaterThan(toolCrack('hammer', NO_POWERS))
  })
})

describe('digging and collapse', () => {
  it('takes a layer per hit, and only answers the cells it reached', () => {
    const w = soft()
    const cell = cellIndex(2, 2)
    const hit = hitWall(w, startProgress(w), 'pick', cell, NO_POWERS)!
    expect(hit.cells).toHaveLength(1)
    expect(hit.cells[0]!.i).toBe(cell)
    expect(hit.progress.crack).toBe(DIG.pick)
    expect(hit.collapsed).toBe(false)
  })

  it('refuses a hit that changes nothing', () => {
    const w = soft()
    let p = startProgress(w)
    p = hitWall(w, p, 'pick', 5, NO_POWERS)!.progress
    expect(hitWall(w, p, 'pick', 5, NO_POWERS)).toBeNull()
  })

  it('counts a treasure only once every cell of it is dug out', () => {
    const w = soft()
    const t = 0
    let p = startProgress(w)
    const cells = treasureCells(w.treasures[t]!)
    for (const i of cells.slice(0, -1)) p = hitWall(w, p, 'pick', i, NO_POWERS)!.progress
    expect(treasureFree(w, p.left, t)).toBe(false)
    const last = hitWall(w, p, 'pick', cells[cells.length - 1]!, NO_POWERS)!
    expect(last.freed).toContain(t)
    expect(tileAt(w, cells[0]!)).toMatchObject({ t, id: w.treasures[t]!.id })
  })

  it('still digs on the hit that brings the wall down, then keeps only what was finished', () => {
    const w = { ...soft(), cap: DIG.hammer }
    const t = 0
    const cells = treasureCells(w.treasures[t]!)
    // A single cell of it, with the crack this hit will fill:
    const small = { ...w, treasures: [{ id: 'nugget' as const, x: 0, y: 0 }] }
    let p = startProgress(small)
    const hit = hitWall(small, p, 'hammer', cellIndex(0, 0), NO_POWERS)!
    expect(hit.collapsed).toBe(true)
    p = hit.progress
    const sorted = sortOut(small, p.left)
    // The hammer's cross only opens 3 of the nugget's 4 cells at the corner: not finished, buried.
    expect(sorted.buried).toHaveLength(1)
    expect(sorted.kept).toHaveLength(0)
    expect(cells.length).toBeGreaterThan(0)
  })

  it('never takes another hit once the wall is down', () => {
    const w = { ...soft(), cap: DIG.pick }
    const p = hitWall(w, startProgress(w), 'pick', 3, NO_POWERS)!.progress
    expect(hitWall(w, p, 'pick', 4, NO_POWERS)).toBeNull()
  })
})

describe('the fossil guarantee', () => {
  const lacking = DIG_FOSSIL_FAMILIES
  const fossilsIn = (w: DigWall) => w.treasures.filter((t) => DIG_TREASURES[t.id].group === 'fossil')

  it('puts a lacked fossil in a wall when the streak is due, and only then on purpose', () => {
    for (let s = 1; s < 200; s++) {
      const w = wall(s, { lacking, due: true })
      expect(w.guaranteed).toBe(true)
      expect(fossilsIn(w).length).toBeGreaterThan(0)
    }
    expect(wall(7, { lacking, due: false }).guaranteed).toBe(false)
  })

  it('offers no guarantee once all five are owned', () => {
    const w = wall(3, { lacking: [], due: true })
    expect(w.guaranteed).toBe(false)
  })

  it('counts a wall without a lacked fossil, and leaves the streak alone when one was held but buried', () => {
    const none = { ...soft(), treasures: [{ id: 'nugget' as const, x: 0, y: 0 }] }
    expect(fossilStreak(3, none, startProgress(none).left, lacking)).toBe(4)
    const held = { ...soft(), treasures: [{ id: 'skullFossil' as const, x: 0, y: 0 }] }
    expect(fossilStreak(9, held, startProgress(held).left, lacking)).toBe(9)
  })

  it('resets the streak when a lacked fossil is dug out, and a due guarantee survives a collapse', () => {
    const held = { ...soft(), treasures: [{ id: 'skullFossil' as const, x: 0, y: 0 }] }
    const left = startProgress(held).left
    for (const i of treasureCells(held.treasures[0]!)) left[i] = 0
    expect(fossilStreak(9, held, left, lacking)).toBe(0)
    expect(fossilStreak(DIG.fossilGuarantee, held, startProgress(held).left, lacking)).toBe(DIG.fossilGuarantee)
  })
})

describe('the Galar halves', () => {
  it('restore a family only from a top and a bottom that fit, and never Fish with Dino', () => {
    expect(labHalf('drake', ['bird'], ['dracozolt']).kind).toBe('restored')
    expect(labHalf('bird', ['drake'], ['dracozolt'])).toEqual({ kind: 'restored', family: 'dracozolt', with: 'drake', held: [] })
    expect(labHalf('dino', ['fish'], DIG_FOSSIL_FAMILIES)).toEqual({ kind: 'stored', held: ['fish', 'dino'] })
    expect(GALAR_PAIRS.map((p) => `${p.top}+${p.bottom}`)).not.toContain('fish+dino')
  })

  it('keep a needed half in the lab once, and pay a half no lacked family needs', () => {
    expect(labHalf('bird', [], ['arctozolt'])).toEqual({ kind: 'stored', held: ['bird'] })
    expect(labHalf('bird', ['bird'], ['arctozolt']).kind).toBe('repeat')
    expect(labHalf('fish', [], ['dracozolt', 'arctozolt']).kind).toBe('repeat')
  })

  it('guarantee the half the lab lacks for a Galar family, and count it toward the streak', () => {
    expect(fossilFor('dracovish', [])).toBe(DIG_HALVES.fish)
    expect(fossilFor('dracovish', ['fish'])).toBe(DIG_HALVES.drake)
    expect(fossilFor('kabuto')).toBe('domeFossil')
    const w = wall(9, { lacking: ['dracovish'], held: ['fish'], due: true })
    expect(w.treasures.map((t) => t.id)).toContain('fossilizedDrake')
    const half = { ...soft(), treasures: [{ id: 'fossilizedDrake' as const, x: 0, y: 0 }] }
    const left = startProgress(half).left
    for (const i of treasureCells(half.treasures[0]!)) left[i] = 0
    expect(fossilStreak(9, half, left, ['dracovish'], ['fish'])).toBe(0)
    // A second Fish while one waits brings nothing new: the streak grows.
    const twice = { ...soft(), treasures: [{ id: 'fossilizedFish' as const, x: 0, y: 0 }] }
    expect(fossilStreak(3, twice, startProgress(twice).left.map(() => 0), ['dracovish'], ['fish'])).toBe(4)
  })
})

describe('the price', () => {
  it('is free once a day, then ₽, then none past the cap', () => {
    expect(wallPrice(0)).toBe(0)
    expect(wallPrice(1)).toBe(DIG.price)
    expect(wallPrice(DIG.dailyCap - 1)).toBe(DIG.price)
    expect(wallPrice(DIG.dailyCap)).toBeNull()
  })
})

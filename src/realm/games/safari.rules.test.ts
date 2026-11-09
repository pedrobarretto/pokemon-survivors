import { describe, expect, it } from 'vitest'
import { SAFARI, applyAction, catchChanceOf, fillBushes, fleeChanceOf, guaranteedEntry, habitatOfWeek, sessionPrice, shareOf, startRun, type SafariAction, type SafariEntry } from './safari.rules'

/** A generator that answers `rolls` in turn, then 0.5 forever. */
const dice = (...rolls: number[]) => {
  let i = 0
  return () => rolls[i++] ?? 0.5
}

const POOL: SafariEntry<string>[] = [
  { family: 'pidgey', rarity: 'common', types: ['normal'] },
  { family: 'abra', rarity: 'rare', types: ['psychic'] },
  { family: 'gible', rarity: 'ultra', types: ['dragon'] },
  { family: 'mimikyu', rarity: 'special', types: ['ghost'] },
]

/** A session with five bushes of `rarity`; the first one is the guarantee's when `sure`. */
const run = (rarity: 'common' | 'ultra' = 'common', sure = false) =>
  startRun(Array.from({ length: SAFARI.bushes }, (_, i) => ({ family: 'pidgey', rarity, sure: sure && i === 0, done: false })))

const act = <R extends ReturnType<typeof run>>(state: R, action: SafariAction, ...rolls: number[]) => {
  const got = applyAction(state, action, dice(...rolls))
  if (!got) throw new Error('refused')
  return got
}

describe('price', () => {
  it('is one free, then ₽, then none past the cap', () => {
    expect(sessionPrice(0)).toBe(0)
    expect(sessionPrice(1)).toBe(SAFARI.price)
    expect(sessionPrice(SAFARI.dailyCap - 1)).toBe(SAFARI.price)
    expect(sessionPrice(SAFARI.dailyCap)).toBeNull()
  })
})

describe('the week', () => {
  it('takes the habitats in turn, and the same one all week', () => {
    const list = ['a', 'b', 'c', 'd']
    const weeks = ['2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']
    expect(new Set(weeks.map((w) => habitatOfWeek(w, list))).size).toBe(4)
    expect(habitatOfWeek('2026-12-07', list)).toBe(habitatOfWeek('2026-11-09', list))
  })
})

describe('who is in the bushes', () => {
  it('shows shares that add up to 1 and raises the partner’s type', () => {
    const plain = shareOf(POOL, [])
    expect(plain.reduce((sum, e) => sum + e.share, 0)).toBeCloseTo(1)
    const withGhost = shareOf(POOL, ['ghost'])
    expect(withGhost.find((e) => e.family === 'mimikyu')!.share).toBeGreaterThan(plain.find((e) => e.family === 'mimikyu')!.share)
  })

  it('draws at those shares', () => {
    let a = 12345
    const next = () => (a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    const counts = new Map<string, number>()
    for (let i = 0; i < 4000; i++) for (const b of fillBushes(POOL, [], next, null)) counts.set(b.family, (counts.get(b.family) ?? 0) + 1)
    for (const e of shareOf(POOL, [])) expect(counts.get(e.family)! / (4000 * SAFARI.bushes)).toBeCloseTo(e.share, 1)
  })

  it('puts the sure family in one bush, marked', () => {
    const bushes = fillBushes(POOL, [], dice(), POOL[3]!)
    expect(bushes.filter((b) => b.sure)).toEqual([{ family: 'mimikyu', rarity: 'special', sure: true, done: false }])
  })
})

describe('the odds', () => {
  it('rises with berries and stops at the cap', () => {
    expect(catchChanceOf('rare', 1)).toBeGreaterThan(catchChanceOf('rare', 0))
    expect(fleeChanceOf('rare', 1)).toBeLessThan(fleeChanceOf('rare', 0))
    expect(catchChanceOf('rare', SAFARI.maxCalm + 1)).toBe(catchChanceOf('rare', SAFARI.maxCalm))
  })
})

describe('a session', () => {
  const met = () => act(run(), { kind: 'approach', bush: 2 }, 0.5).run

  it('reveals the family on approach and only the rolled shiny', () => {
    const shiny = act(run(), { kind: 'approach', bush: 2 }, 0)
    expect(shiny.turn).toEqual({ kind: 'appear', bush: 2, family: 'pidgey', shiny: true })
    expect(act(run(), { kind: 'approach', bush: 2 }, SAFARI.shinyOdds).turn).toMatchObject({ shiny: false })
  })

  it('catches when every shake holds', () => {
    const { run: after, turn } = act(met(), { kind: 'ball' }, 0, 0, 0)
    expect(turn).toEqual({ kind: 'ball', family: 'pidgey', shiny: false, shakes: 3, caught: true, fled: false })
    expect(after.catches).toEqual([{ family: 'pidgey', shiny: false }])
    expect(after.balls).toBe(SAFARI.balls - 1)
    expect(after.encounter).toBeNull()
    expect(after.bushes[2]!.done).toBe(true)
  })

  it('breaks out after the shakes held, then may flee', () => {
    const { run: stayed, turn } = act(met(), { kind: 'ball' }, 0, 0.99, 0.99)
    expect(turn).toMatchObject({ shakes: 1, caught: false, fled: false })
    expect(stayed.encounter).not.toBeNull()
    const { run: gone, turn: ran } = act(met(), { kind: 'ball' }, 0.99, 0)
    expect(ran).toMatchObject({ shakes: 0, fled: true })
    expect(gone.encounter).toBeNull()
    expect(gone.bushes[2]!.done).toBe(true)
  })

  it('calms with a berry, spends a turn it can flee in, and runs out', () => {
    const { run: calmer, turn } = act(met(), { kind: 'berry' }, 0.99)
    expect(turn).toEqual({ kind: 'berry', calm: 1, fled: false })
    expect(calmer.encounter?.calm).toBe(1)
    expect(calmer.berries).toBe(SAFARI.berries - 1)
    expect(act(met(), { kind: 'berry' }, 0).turn).toMatchObject({ fled: true })
    expect(applyAction({ ...met(), berries: 0 }, { kind: 'berry' }, dice())).toBeNull()
  })

  it('refuses what can’t be done now', () => {
    expect(applyAction(run(), { kind: 'ball' }, dice())).toBeNull()
    expect(applyAction(met(), { kind: 'approach', bush: 0 }, dice())).toBeNull()
    expect(applyAction(run(), { kind: 'approach', bush: 9 }, dice())).toBeNull()
  })

  it('ends when the last ball is spent or the last bush is walked', () => {
    const lastBall = act({ ...met(), balls: 1 }, { kind: 'ball' }, 0.99, 0.99)
    expect(lastBall.run.over).toBe(true)
    const emptied = { ...run(), bushes: run().bushes.map((b, i) => ({ ...b, done: i !== 0 })) }
    const met0 = act(emptied, { kind: 'approach', bush: 0 }, 0.5).run
    expect(act(met0, { kind: 'leave' }).run.over).toBe(true)
  })

  it('never fails or flees on the guarantee', () => {
    const met1 = act(run('ultra', true), { kind: 'approach', bush: 0 }, 0.5).run
    expect(act(met1, { kind: 'berry' }, 0).turn).toMatchObject({ fled: false })
    expect(act(met1, { kind: 'ball' }, 0.99, 0.99, 0.99, 0).turn).toMatchObject({ shakes: 3, caught: true, fled: false })
  })
})

describe('the guarantee', () => {
  it('brings a Safari-only family while one is missing, then any missing, then nothing', () => {
    expect(guaranteedEntry(POOL, ['mimikyu'], dice())!.family).toBe('mimikyu')
    expect(guaranteedEntry(POOL.slice(0, 3), ['mimikyu'], dice(0.9))!.family).toBe('gible')
    expect(guaranteedEntry([], ['mimikyu'], dice())).toBeNull()
  })
})

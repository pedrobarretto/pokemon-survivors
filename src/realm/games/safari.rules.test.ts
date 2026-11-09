import { describe, expect, it } from 'vitest'
import { SAFARI, applyAction, catchChanceOf, encountersLeft, fleeChanceOf, guaranteedEntry, habitatOfWeek, rollQueue, sessionPrice, shareOf, startRun, type SafariAction, type SafariEntry, type SafariSlot } from './safari.rules'

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

/** A session of the usual length, all of `rarity`; the first is the guarantee's when `sure` and each is named after its place. */
const queue = (rarity: 'common' | 'ultra' = 'common', sure = false): SafariSlot<string>[] => Array.from({ length: SAFARI.encounters }, (_, i) => ({ family: `mon${i}`, rarity, shiny: false, sure: sure && i === 0 }))

const run = (rarity: 'common' | 'ultra' = 'common', sure = false) => startRun(queue(rarity, sure))

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

describe('who the grass holds', () => {
  it('shows shares that add up to 1 and raises the partner’s type', () => {
    const plain = shareOf(POOL, [])
    expect(plain.reduce((sum, e) => sum + e.share, 0)).toBeCloseTo(1)
    const withGhost = shareOf(POOL, ['ghost'])
    expect(withGhost.find((e) => e.family === 'mimikyu')!.share).toBeGreaterThan(plain.find((e) => e.family === 'mimikyu')!.share)
  })

  it('draws at those shares, shinies at their odds', () => {
    let a = 12345
    const next = () => (a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    const counts = new Map<string, number>()
    let shinies = 0
    for (let i = 0; i < 4000; i++) {
      for (const slot of rollQueue(POOL, [], next, null)) {
        counts.set(slot.family, (counts.get(slot.family) ?? 0) + 1)
        if (slot.shiny) shinies += 1
      }
    }
    const total = 4000 * SAFARI.encounters
    for (const e of shareOf(POOL, [])) expect(counts.get(e.family)! / total).toBeCloseTo(e.share, 1)
    expect(shinies / total).toBeCloseTo(SAFARI.shinyOdds, 2)
  })

  it('puts the sure family first, marked', () => {
    const slots = rollQueue(POOL, [], dice(), POOL[3]!)
    expect(slots[0]).toMatchObject({ family: 'mimikyu', rarity: 'special', sure: true })
    expect(slots.filter((s) => s.sure)).toHaveLength(1)
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
  const met = () => act(run(), { kind: 'grass' }).run

  it('reveals the encounters in their order, however often the grass is reported', () => {
    let state = run()
    for (let i = 0; i < 3; i++) {
      const got = act(state, { kind: 'grass' })
      expect(got.turn).toEqual({ kind: 'appear', family: `mon${i}`, shiny: false, sure: false })
      state = act(got.run, { kind: 'leave' }).run
    }
    expect(encountersLeft(state)).toBe(SAFARI.encounters - 3)
  })

  it('takes no roll to reveal one, so walking can’t change it', () => {
    const roll = () => {
      throw new Error('rolled')
    }
    expect(applyAction(run(), { kind: 'grass' }, roll)?.turn).toMatchObject({ family: 'mon0' })
  })

  it('catches when every shake holds', () => {
    const { run: after, turn } = act(met(), { kind: 'ball' }, 0, 0, 0)
    expect(turn).toEqual({ kind: 'ball', family: 'mon0', shiny: false, shakes: 3, caught: true, fled: false })
    expect(after.catches).toEqual([{ family: 'mon0', shiny: false }])
    expect(after.balls).toBe(SAFARI.balls - 1)
    expect(after.encounter).toBeNull()
  })

  it('breaks out after the shakes held, then may flee', () => {
    const { run: stayed, turn } = act(met(), { kind: 'ball' }, 0, 0.99, 0.99)
    expect(turn).toMatchObject({ shakes: 1, caught: false, fled: false })
    expect(stayed.encounter).not.toBeNull()
    const { run: gone, turn: ran } = act(met(), { kind: 'ball' }, 0.99, 0)
    expect(ran).toMatchObject({ shakes: 0, fled: true })
    expect(gone.encounter).toBeNull()
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
    expect(applyAction(met(), { kind: 'grass' }, dice())).toBeNull()
  })

  it('ends when the last ball is spent or the last encounter is over', () => {
    const lastBall = act({ ...met(), balls: 1 }, { kind: 'ball' }, 0.99, 0.99)
    expect(lastBall.run.over).toBe(true)
    let state = run()
    for (let i = 0; i < SAFARI.encounters; i++) state = act(act(state, { kind: 'grass' }).run, { kind: 'leave' }).run
    expect(state.over).toBe(true)
    expect(encountersLeft(state)).toBe(0)
    expect(applyAction(state, { kind: 'grass' }, dice())).toBeNull()
  })

  it('never fails or flees on the guarantee', () => {
    const met1 = act(run('ultra', true), { kind: 'grass' }).run
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

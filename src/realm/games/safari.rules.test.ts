import { describe, expect, it } from 'vitest'
import {
  SAFARI,
  applyAction,
  bestCatch,
  catchChanceOf,
  contestPrize,
  daypartOf,
  encountersLeft,
  fleeChanceOf,
  guaranteedEntry,
  habitatOfWeek,
  isContestDay,
  localHour,
  pickVisible,
  rollQueue,
  sessionPrice,
  shareOf,
  shinyChanceOf,
  startRun,
  wanderersOf,
  type SafariAction,
  type SafariEntry,
  type SafariSlot,
} from './safari.rules'

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
const queue = (rarity: 'common' | 'ultra' = 'common', sure = false): SafariSlot<string>[] => Array.from({ length: SAFARI.encounters }, (_, i) => ({ family: `mon${i}`, rarity, level: 10, sure: sure && i === 0 }))

/** A session with no wanderers unless `visible` names them. */
const run = (rarity: 'common' | 'ultra' = 'common', sure = false, visible: number[] = []) => startRun(queue(rarity, sure), visible)

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

  it('draws at those shares, every place in the queue, though it repeats to make chains', () => {
    let a = 12345
    const next = () => (a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    const counts = new Map<string, number>()
    const last = new Map<string, number>()
    let repeats = 0
    for (let i = 0; i < 4000; i++) {
      const slots = rollQueue(POOL, [], next, null)
      for (const [j, slot] of slots.entries()) {
        counts.set(slot.family, (counts.get(slot.family) ?? 0) + 1)
        if (j === SAFARI.encounters - 1) last.set(slot.family, (last.get(slot.family) ?? 0) + 1)
        if (j > 0 && slots[j - 1]!.family === slot.family) repeats += 1
        expect(slot.level).toBeGreaterThanOrEqual(SAFARI.levelBase[slot.rarity])
        expect(slot.level).toBeLessThan(SAFARI.levelBase[slot.rarity] + SAFARI.levelSpread)
      }
    }
    const total = 4000 * SAFARI.encounters
    for (const e of shareOf(POOL, [])) {
      expect(counts.get(e.family)! / total).toBeCloseTo(e.share, 1)
      expect(last.get(e.family)! / 4000).toBeCloseTo(e.share, 1)
    }
    expect(repeats / (4000 * (SAFARI.encounters - 1))).toBeGreaterThan(SAFARI.repeat)
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

  it('makes a rock’s anger easier to catch and quicker to run, and bait the other way', () => {
    expect(catchChanceOf('common', 0, 'angry')).toBeGreaterThan(catchChanceOf('common', 0))
    expect(fleeChanceOf('common', 0, 'angry')).toBeGreaterThan(fleeChanceOf('common', 0))
    expect(catchChanceOf('common', 0, 'eating')).toBeLessThan(catchChanceOf('common', 0))
    expect(fleeChanceOf('common', 0, 'eating')).toBeLessThan(fleeChanceOf('common', 0))
  })

  it('raises the shiny odds down a chain, and stops at its last step', () => {
    expect(shinyChanceOf(1)).toBe(SAFARI.shinyOdds)
    expect(shinyChanceOf(3)).toBeGreaterThan(shinyChanceOf(2))
    expect(shinyChanceOf(99)).toBe(shinyChanceOf(SAFARI.chainBoost.length))
  })
})

describe('the clock', () => {
  it('reads the hour at the player’s offset', () => {
    const noonUtc = Date.parse('2026-11-10T12:00:00Z')
    expect(localHour(noonUtc, 0)).toBe(12)
    expect(localHour(noonUtc, -180)).toBe(9)
    expect(localHour(noonUtc, 9 * 60)).toBe(21)
    expect(localHour(noonUtc, -12 * 60)).toBe(0)
  })

  it('splits the day into dawn, day, dusk and night', () => {
    expect([4, 5, 7, 16, 17, 19, 23].map(daypartOf)).toEqual(['night', 'dawn', 'day', 'day', 'dusk', 'night', 'night'])
  })

  it('holds the contest on Tuesdays, Thursdays and Saturdays', () => {
    expect(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'].map(isContestDay)).toEqual([false, true, false, true, false, true, false])
  })
})

describe('a session', () => {
  const met = () => act(run(), { kind: 'grass' }).run

  it('reveals the encounters in their order, however often the grass is reported', () => {
    let state = run()
    for (let i = 0; i < 3; i++) {
      const got = act(state, { kind: 'grass' })
      expect(got.turn).toEqual({ kind: 'appear', family: `mon${i}`, shiny: false, sure: false, level: 10, chain: 1, stalked: false })
      state = act(got.run, { kind: 'leave' }).run
    }
    expect(encountersLeft(state)).toBe(SAFARI.encounters - 3)
  })

  it('reveals the same one whatever the dice, so walking can’t change who', () => {
    expect(act(run(), { kind: 'grass' }, 0).turn).toMatchObject({ family: 'mon0', shiny: true })
    expect(act(run(), { kind: 'grass' }, 0.99).turn).toMatchObject({ family: 'mon0', shiny: false })
  })

  it('keeps the wanderers out of the grass until the rest are met, and meets one sneaked up on calmer, once', () => {
    let state = run('common', false, [1, 2])
    expect(wanderersOf(state)).toEqual([
      { slot: 1, family: 'mon1' },
      { slot: 2, family: 'mon2' },
    ])
    const stalked = act(state, { kind: 'stalk', slot: 2 })
    expect(stalked.turn).toMatchObject({ kind: 'appear', family: 'mon2', stalked: true })
    expect(stalked.run.encounter?.calm).toBe(SAFARI.stalkCalm)
    state = act(stalked.run, { kind: 'leave' }).run
    expect(applyAction(state, { kind: 'stalk', slot: 2 }, dice())).toBeNull()
    expect(applyAction(state, { kind: 'stalk', slot: 4 }, dice())).toBeNull()
    const order: string[] = []
    for (let i = 0; i < SAFARI.encounters - 1; i++) {
      const got = act(state, { kind: 'grass' })
      if (got.turn.kind === 'appear') order.push(got.turn.family)
      state = act(got.run, { kind: 'leave' }).run
    }
    expect(order).toEqual(['mon0', 'mon3', 'mon4', 'mon5', 'mon6', 'mon7', 'mon1'])
  })

  it('picks the wanderers apart from the guarantee', () => {
    const picked = pickVisible(queue('common', true), dice(0, 0, 0))
    expect(picked).toEqual([1, 2, 3])
  })

  it('builds a chain on the same species and breaks it on another', () => {
    const same: SafariSlot<string>[] = ['a', 'a', 'a', 'b'].map((family) => ({ family, rarity: 'common', level: 10, sure: false }))
    let state = startRun(same, [])
    const chains: number[] = []
    for (let i = 0; i < 4; i++) {
      const got = act(state, { kind: 'grass' })
      if (got.turn.kind === 'appear') chains.push(got.turn.chain)
      state = act(got.run, { kind: 'leave' }).run
    }
    expect(chains).toEqual([1, 2, 3, 1])
    // A roll that misses the plain odds lands on the third of a chain.
    const third = startRun(same, [])
    let s3 = third
    for (let i = 0; i < 2; i++) s3 = act(act(s3, { kind: 'grass' }, 0.99).run, { kind: 'leave' }).run
    expect(act(s3, { kind: 'grass' }, SAFARI.shinyOdds * 1.5).turn).toMatchObject({ chain: 3, shiny: true })
  })

  it('catches when every shake holds', () => {
    const { run: after, turn } = act(met(), { kind: 'ball' }, 0, 0, 0)
    expect(turn).toEqual({ kind: 'ball', family: 'mon0', shiny: false, shakes: 3, caught: true, fled: false, score: 40 + 10 * 2 })
    expect(after.catches).toEqual([{ family: 'mon0', shiny: false, level: 10, score: 60 }])
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

  it('angers with a rock and feeds with bait, for a few turns, each a turn it can flee in', () => {
    const rock = act(met(), { kind: 'rock' }, 0.99, 0.99)
    expect(rock.turn).toEqual({ kind: 'rock', turns: SAFARI.moodTurns, fled: false })
    expect(rock.run.encounter).toMatchObject({ mood: 'angry', moodTurns: SAFARI.moodTurns })
    expect(act(met(), { kind: 'rock' }, 0, 0).turn).toMatchObject({ fled: true })
    const fed = act(rock.run, { kind: 'bait' }, 0, 0.99)
    expect(fed.run.encounter).toMatchObject({ mood: 'eating', moodTurns: 1 })
    // A ball's turn wears it off.
    const after = act(fed.run, { kind: 'ball' }, 0.99, 0.99)
    expect(after.run.encounter).toMatchObject({ mood: null, moodTurns: 0 })
    expect(rock.run.berries).toBe(SAFARI.berries)
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

describe('the contest', () => {
  it('scores rarity, level and a shiny, and an entry by its best catch', () => {
    const c = [
      { family: 'a', shiny: false, level: 10, score: 60 },
      { family: 'b', shiny: true, level: 7, score: 154 },
    ]
    expect(bestCatch(c)?.family).toBe('b')
    expect(bestCatch([])).toBeNull()
  })

  it('rewards a share of the field, none on a thin week', () => {
    expect(contestPrize(1, 2)).toBeNull()
    expect(contestPrize(1, 3)).toBe('champion')
    expect(contestPrize(2, 3)).toBeNull()
    expect([1, 2, 3, 4, 10, 11].map((r) => contestPrize(r, 40))).toEqual(['champion', 'podium', 'podium', 'top', 'top', null])
  })
})

describe('the guarantee', () => {
  it('brings a Safari-only family while one is missing, then any missing, then nothing', () => {
    expect(guaranteedEntry(POOL, ['mimikyu'], dice())!.family).toBe('mimikyu')
    expect(guaranteedEntry(POOL.slice(0, 3), ['mimikyu'], dice(0.9))!.family).toBe('gible')
    expect(guaranteedEntry([], ['mimikyu'], dice())).toBeNull()
  })
})

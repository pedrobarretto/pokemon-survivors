import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { HALLOWEEN, NIGHT_BOSSES } from '../data/halloween'
import { ENEMIES, type EnemyDef } from '../data/enemies'
import { bossWaveAt, EVENTS, STAGES } from '../data/waves'
import { challengeProblem, challengeStart, dailyChallenge } from './challenge'
import { applyGift } from './gifts'
import {
  addCandies,
  candiesLeft,
  candiesOf,
  daysToHalloween,
  drawNightBosses,
  HALLOWEEN_REWARDS,
  halloweenAt,
  halloweenDaysLeft,
  halloweenFits,
  halloweenGifts,
  HUNT_REWARDS,
  isHalloweenDay,
  mergeHalloween,
  nextHalloweenReward,
  parseHalloween,
  PUMPKABOO_GIFT,
  pumpkinRow,
  pumpkinSupporter,
  recordHunt,
  spendCandies,
  withHaunts,
} from './halloween'
import { EMPTY_SAVE, type Save } from './meta'
import { OUTBREAK_SPECIES, outbreakOf } from './outbreak'
import { drawRoster } from './roster'
import { canWalkWith, mergeCompanions } from './supporters'

const withCandies = (candies: number, gifts: string[] = []): Save => ({ ...EMPTY_SAVE, halloween: { candies, spent: 0, hunted: [] }, gifts })

describe('the Noite das Bruxas calendar', () => {
  it('runs from its first day to its last, both included, counting down from the teaser', () => {
    expect(isHalloweenDay(HALLOWEEN.from)).toBe(true)
    expect(isHalloweenDay(HALLOWEEN.to)).toBe(true)
    expect(isHalloweenDay('2026-10-23')).toBe(false)
    expect(isHalloweenDay('2026-11-03')).toBe(false)
    expect(daysToHalloween(HALLOWEEN.teaser)).toBe(3)
    expect(daysToHalloween('2026-10-23')).toBe(1)
    expect(daysToHalloween('2026-10-20')).toBeNull()
    expect(daysToHalloween(HALLOWEEN.from)).toBeNull()
    expect(halloweenDaysLeft(HALLOWEEN.from)).toBe(10)
    expect(halloweenDaysLeft(HALLOWEEN.to)).toBe(1)
    expect(halloweenDaysLeft('2026-11-03')).toBeNull()
  })

  it("puts a ghost in each event day's outbreak, an outbreak species, and leaves the other days to the draw", () => {
    for (const [day, id] of Object.entries(HALLOWEEN.outbreaks)) {
      expect(isHalloweenDay(day)).toBe(true)
      expect(OUTBREAK_SPECIES).toContain(id)
      expect(outbreakOf(day)).toBe(id)
    }
    expect(outbreakOf('2026-10-31')).toBe('gastly')
    expect(Object.keys(HALLOWEEN.outbreaks)).not.toContain('2026-10-20')
  })

  it('takes a haunted run started on an event day or just after one, and any run that is not haunted', () => {
    // 2026-10-24 12:00 in Brasília is 15:00 UTC; 2026-11-03 00:30 is 03:30 UTC.
    expect(halloweenFits(true, new Date('2026-10-24T15:00:00Z'))).toBe(true)
    expect(halloweenFits(true, new Date('2026-11-03T03:30:00Z'))).toBe(true)
    expect(halloweenFits(true, new Date('2026-10-23T15:00:00Z'))).toBe(false)
    expect(halloweenFits(true, new Date('2026-11-04T15:00:00Z'))).toBe(false)
    expect(halloweenFits(false, new Date('2026-10-31T15:00:00Z'))).toBe(true)
  })

  it('takes the haunting the API dealt with a ticket for a run that starts up to a day later, across both edges', () => {
    // 23:59 in Brasília on the day before the event and on its last day (02:59 UTC the next day).
    const eve = new Date('2026-10-24T02:59:00Z')
    const last = new Date('2026-11-03T02:59:00Z')
    expect([halloweenAt(eve), halloweenAt(last)]).toEqual([false, true])
    for (const dealt of [eve, last]) {
      for (const later of [0, 2 * 60_000, 23 * 3600_000]) expect(halloweenFits(halloweenAt(dealt), new Date(dealt.getTime() + later))).toBe(true)
    }
  })

  it("haunts the Desafio do dia on the event's days, and a start that skips it isn't the challenge", () => {
    const c = dailyChallenge('2026-10-31')
    expect(c.halloween).toBe(true)
    expect(dailyChallenge('2026-10-20').halloween).toBe(false)
    const start = challengeStart(c, { w: 480, h: 270 }, false)
    expect(challengeProblem(start, c.day)).toBeNull()
    expect(challengeProblem({ ...start, halloween: false }, c.day)).toBe('halloween')
  })
})

describe('the haunted run', () => {
  it('adds the stage ghost to every stage of the cast, of a tier the stage draws, keeping the rest', () => {
    expect(HALLOWEEN.haunts.length).toBe(STAGES.length)
    HALLOWEEN.haunts.forEach((id, i) => {
      expect(ENEMIES[id].types).toContain('ghost')
      expect(STAGES[i]!.cast).toContain(ENEMIES[id].tier)
    })
    const roster = drawRoster(createRng(5))
    expect(withHaunts(roster, false, 5)).toBe(roster)
    const haunted = withHaunts(roster, true, 5)
    haunted.stages.forEach((pool, i) => {
      expect(pool.some(([id]) => id === HALLOWEEN.haunts[i])).toBe(true)
      expect(pool.filter(([id]) => id !== HALLOWEEN.haunts[i])).toEqual(roster.stages[i]!.filter(([id]) => id !== HALLOWEEN.haunts[i]))
    })
  })

  it('gives candies for bosses and Alphas always, Ghost types now and then, and nothing for the rest', () => {
    const foe = { types: ['normal'] as const, boss: false, alpha: null, elite: false, shiny: false }
    const ghost = { ...foe, types: ['ghost'] as const }
    const always = () => 0
    expect(candiesOf(always, { ...foe, boss: true })).toBe(HALLOWEEN.candy.boss)
    expect(candiesOf(always, foe)).toBe(0)
    expect(candiesOf(always, { ...ghost, shiny: true })).toBe(HALLOWEEN.candy.shiny)
    expect(candiesOf(always, { ...ghost, elite: true })).toBe(HALLOWEEN.candy.elite)
    expect(candiesOf(always, ghost)).toBe(1)
    expect(candiesOf(() => 0.99, ghost)).toBe(0)
  })
})

describe('the candy jar', () => {
  it('pays the frame for showing up during the event, then each reward its candies reach, once', () => {
    expect(halloweenGifts(withCandies(0), '2026-10-20')).toEqual([])
    expect(halloweenGifts(withCandies(0), '2026-10-31').map((g) => g.content)).toEqual([HALLOWEEN_REWARDS[0]!.content])
    const reached = halloweenGifts(withCandies(320), '2026-11-10')
    expect(reached.map((g) => g.content)).toEqual(HALLOWEEN_REWARDS.slice(0, 4).map((r) => r.content))
    expect(reached.every((g) => g.reason?.kind === 'halloween')).toBe(true)
    // Applied on any device, a reward never comes again.
    const out = applyGift(withCandies(320), reached[1]!)
    expect(out.status).toBe('applied')
    if (out.status !== 'applied') return
    expect(out.save.style.owned.background).toContain('halloween')
    expect(halloweenGifts(out.save, '2026-11-10').map((g) => g.id)).not.toContain(reached[1]!.id)
  })

  it('banks candies, keeps the fuller jar when two saves merge and parses junk to empty', () => {
    expect(addCandies(withCandies(10), 5).halloween.candies).toBe(15)
    expect(addCandies(withCandies(10), 0).halloween.candies).toBe(10)
    expect(mergeHalloween({ candies: 40, spent: 0, hunted: [] }, { candies: 90, spent: 0, hunted: [] })).toEqual({ candies: 90, spent: 0, hunted: [] })
    expect(parseHalloween({ candies: -3 })).toEqual({ candies: 0, spent: 0, hunted: [] })
    expect(parseHalloween('nope')).toEqual({ candies: 0, spent: 0, hunted: [] })
    expect(nextHalloweenReward(0)).toBe(HALLOWEEN_REWARDS[1])
    expect(nextHalloweenReward(10_000)).toBeNull()
  })

  it('spends candies without taking them out of the jar its rewards count', () => {
    const spent = spendCandies(withCandies(900), 300)
    expect([spent.halloween.candies, candiesLeft(spent.halloween)]).toEqual([900, 600])
    expect(halloweenGifts(spent, HALLOWEEN.from)).toHaveLength(HALLOWEEN_REWARDS.length)
    // Two devices: the fuller jar and the larger spending; a parse never spends more than the jar got.
    expect(mergeHalloween({ candies: 900, spent: 300, hunted: [] }, { candies: 1000, spent: 150, hunted: [] })).toEqual({ candies: 1000, spent: 300, hunted: [] })
    expect(parseHalloween({ candies: 100, spent: 400 })).toEqual({ candies: 100, spent: 100, hunted: [] })
  })
})

describe('the night bosses', () => {
  it('take the regular boss slots of a haunted run: one each, never twice, the same for the same seed', () => {
    const roster = drawRoster(createRng(9))
    for (const seed of [1, 2, 3, 42, 1_729_000_000_000]) {
      const night = drawNightBosses(seed)
      expect(drawNightBosses(seed)).toEqual(night)
      const drawn = night.filter((id) => id !== null)
      expect(drawn.length).toBe(Object.keys(HALLOWEEN.bosses).length)
      expect(new Set(drawn).size).toBe(drawn.length)
      EVENTS.forEach((e, i) => {
        const pool = e.kind === 'boss' && 'enemy' in e ? (HALLOWEEN.bosses as Partial<Record<string, readonly string[]>>)[e.enemy] : undefined
        if (pool) expect(pool).toContain(night[i])
        else expect(night[i]).toBeNull()
      })
      // Only those slots change; doing it again changes nothing.
      const haunted = withHaunts(roster, true, seed)
      expect(haunted.events.map((id, i) => night[i] ?? id)).toEqual(haunted.events)
      expect(haunted.events.filter((id, i) => night[i] === null && id !== roster.events[i])).toEqual([])
      expect(withHaunts(haunted, true, seed)).toEqual(haunted)
    }
    // Different seeds meet different pairs.
    expect(new Set(Array.from({ length: 40 }, (_, seed) => drawNightBosses(seed).join())).size).toBeGreaterThan(10)
  })

  it('fight as their slot: its wave, its strength', () => {
    for (const [slot, pool] of Object.entries(HALLOWEEN.bosses)) {
      const def: EnemyDef = ENEMIES[slot as keyof typeof ENEMIES]
      for (const id of pool) {
        const ghost: EnemyDef = ENEMIES[id]
        expect(bossWaveAt(id), id).toBe(bossWaveAt(slot as keyof typeof ENEMIES))
        expect([ghost.boss, ghost.hp, ghost.damage, ghost.xp], id).toEqual([true, def.hp, def.damage, def.xp])
      }
    }
  })
})

describe('the Caça aos Fantasmas', () => {
  const beaten = (n: number) => NIGHT_BOSSES.slice(0, n)

  it('ticks off each night boss once, paying candies the first time only', () => {
    const once = recordHunt({ candies: 10, spent: 0, hunted: [] }, [NIGHT_BOSSES[2]!, NIGHT_BOSSES[0]!, NIGHT_BOSSES[2]!])
    expect(once).toEqual({ candies: 10 + 2 * HALLOWEEN.hunt.candies, spent: 0, hunted: [NIGHT_BOSSES[0], NIGHT_BOSSES[2]] })
    expect(recordHunt(once, [NIGHT_BOSSES[0]!])).toBe(once)
    expect(recordHunt(once, ['onix'])).toBe(once)
  })

  it('pays its title and frame once every night boss fell, once', () => {
    const almost: Save = { ...EMPTY_SAVE, halloween: { candies: 0, spent: 0, hunted: beaten(NIGHT_BOSSES.length - 1) } }
    expect(halloweenGifts(almost, '2026-11-10').filter((g) => g.reason?.kind === 'ghostHunt')).toEqual([])
    const done: Save = { ...almost, halloween: { candies: 0, spent: 0, hunted: beaten(NIGHT_BOSSES.length) } }
    const gifts = halloweenGifts(done, '2026-11-10').filter((g) => g.reason?.kind === 'ghostHunt')
    expect(gifts.map((g) => g.content)).toEqual([...HUNT_REWARDS])
    const out = applyGift(done, gifts[0]!)
    expect(out.status).toBe('applied')
    if (out.status !== 'applied') return
    expect(out.save.titles).toContain('exorcist')
    expect(halloweenGifts(out.save, '2026-11-10').map((g) => g.id)).not.toContain(gifts[0]!.id)
  })

  it('keeps what either device hunted when two saves merge, and drops junk', () => {
    expect(mergeHalloween({ candies: 5, spent: 0, hunted: beaten(1) }, { candies: 3, spent: 0, hunted: [NIGHT_BOSSES[3]!] })).toEqual({ candies: 5, spent: 0, hunted: [NIGHT_BOSSES[0], NIGHT_BOSSES[3]] })
    expect(parseHalloween({ candies: 4, spent: 0, hunted: [NIGHT_BOSSES[1], 'onix', 7, NIGHT_BOSSES[1]] })).toEqual({ candies: 4, spent: 0, hunted: [NIGHT_BOSSES[1]] })
  })
})

describe("the supporters' jack-o'-lantern", () => {
  it('goes to anyone who supported by the last day, from the first day on and for good', () => {
    const during = new Date('2026-10-31T15:00:00Z')
    expect(pumpkinSupporter('2026-03-01T12:00:00Z', during)).toBe(true)
    // 2026-11-02 23:30 in Brasília is 02:30 UTC on the 3rd: still the event's last day.
    expect(pumpkinSupporter('2026-11-03T02:30:00Z', new Date('2027-05-01T12:00:00Z'))).toBe(true)
    expect(pumpkinSupporter('2026-11-03T12:00:00Z', new Date('2027-05-01T12:00:00Z'))).toBe(false)
    expect(pumpkinSupporter('2026-10-01T12:00:00Z', new Date('2026-10-23T15:00:00Z'))).toBe(false)
    expect(pumpkinSupporter(null, during)).toBe(false)
    expect(pumpkinSupporter('junk', during)).toBe(false)
  })

  it('lights their ranking row only while the event is on', () => {
    expect(pumpkinRow('2026-03-01T12:00:00Z', new Date('2026-10-31T15:00:00Z'))).toBe(true)
    expect(pumpkinRow('2026-03-01T12:00:00Z', new Date('2026-11-04T15:00:00Z'))).toBe(false)
    expect(pumpkinRow(null, new Date('2026-10-31T15:00:00Z'))).toBe(false)
  })
})

describe("the supporters' Pumpkaboo", () => {
  const supporter: Save = { ...EMPTY_SAVE, titles: ['supporter'] }
  const pumpkaboo = { id: 'pumpkaboo', shiny: false } as const

  it('comes to a supporter on an event day, once, and only walks along once owned', () => {
    expect(halloweenGifts(supporter, '2026-10-31').map((g) => g.id)).toContain(PUMPKABOO_GIFT.id)
    expect(halloweenGifts(supporter, '2026-11-03').map((g) => g.id)).not.toContain(PUMPKABOO_GIFT.id)
    expect(halloweenGifts(EMPTY_SAVE, '2026-10-31').map((g) => g.id)).not.toContain(PUMPKABOO_GIFT.id)
    expect(canWalkWith(supporter, pumpkaboo)).toBe(false)
    const out = applyGift(supporter, PUMPKABOO_GIFT)
    expect(out.status).toBe('applied')
    if (out.status !== 'applied') return
    expect(out.save.companion).toEqual(pumpkaboo)
    expect(canWalkWith(out.save, pumpkaboo)).toBe(true)
    expect(canWalkWith(out.save, { ...pumpkaboo, shiny: true })).toBe(false)
    expect(halloweenGifts(out.save, '2026-10-31').map((g) => g.id)).not.toContain(PUMPKABOO_GIFT.id)
  })

  it('walks shiny only for a Gold supporter', () => {
    const owned: Save = { ...supporter, companions: ['pumpkaboo'] }
    const gold: Save = { ...owned, style: { ...owned.style, owned: { ...owned.style.owned, background: [...owned.style.owned.background, 'supporter'] } } }
    expect(canWalkWith(owned, { ...pumpkaboo, shiny: true })).toBe(false)
    expect(canWalkWith(gold, { ...pumpkaboo, shiny: true })).toBe(true)
    expect(canWalkWith({ ...gold, companions: [] }, { ...pumpkaboo, shiny: true })).toBe(false)
  })

  it('stays owned when two saves merge', () => {
    expect(mergeCompanions([], ['pumpkaboo'])).toEqual(['pumpkaboo'])
    expect(mergeCompanions(['pumpkaboo'], ['pumpkaboo'])).toEqual(['pumpkaboo'])
  })
})

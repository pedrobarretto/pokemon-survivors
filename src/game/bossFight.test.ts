import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { BOSS_DIFFICULTY, BOSS_PATTERNS, BOSS_PHASES, BOSS_RAGE, bossKit, MIN_TELEGRAPH, STANCES, type BossPattern } from '../data/bosses'
import { WAVE_LEGENDS } from '../data/legendBosses'
import { attackCount, attackWait, chainTarget, createFight, fightPace, fightsInStances, GATE_WAIT, holdFloor, holdsOn, patternLive, phaseAt, phaseTaken, pooledShare, shouldEnrage, statusStops, steerBoss, telegraph, tickStance, ultimateDue, ultimateLength, type Steering } from './bossFight'

describe('boss fights', () => {
  it('only wave bosses fight in stances', () => {
    expect(fightsInStances('onix')).toBe(true)
    expect(fightsInStances('mewtwo')).toBe(true)
    expect(fightsInStances('lugia')).toBe(false)
    expect(fightsInStances('arceus')).toBe(false)
  })

  it('swaps stance after a seeded 4-9 s and enrages once under half HP', () => {
    const rng = createRng(3)
    const fight = createFight(rng, 'normal')
    expect(fight.stance).toBe('close')
    expect(fight.stanceLeft).toBeGreaterThanOrEqual(BOSS_RAGE.stance[0])
    expect(fight.stanceLeft).toBeLessThanOrEqual(BOSS_RAGE.stance[1])
    expect(tickStance(fight, fight.stanceLeft - 0.01, rng)).toBe(false)
    expect(tickStance(fight, 0.02, rng)).toBe(true)
    expect(fight.stance).toBe('ranged')

    expect(shouldEnrage(fight, 50, 100)).toBe(false)
    expect(shouldEnrage(fight, 49, 100)).toBe(true)
    expect(fightPace(fight)).toBe(STANCES.ranged.pace)
    fight.enraged = true
    expect(shouldEnrage(fight, 10, 100)).toBe(false)
    expect(fightPace(fight)).toBeCloseTo(STANCES.ranged.pace * BOSS_RAGE.speed)
  })

  it('gates patterns by stance, HP left and difficulty', () => {
    // Mewtwo's old Hard phase: under 40%, from Hard.
    const phase2: BossPattern = { ...BOSS_PHASES.mewtwo![2]!.patterns.find((p) => p.from === 'hard')!, below: 0.4 }
    const fight = { ...createFight(createRng(1), 'hard'), share: 0.45 }
    expect(patternLive(phase2, fight)).toBe(false)
    fight.share = 0.39
    expect(patternLive(phase2, fight)).toBe(true)
    expect(patternLive(phase2, { ...fight, difficulty: 'nightmare' })).toBe(true)
    expect(patternLive(phase2, { ...fight, difficulty: 'normal' })).toBe(false)
    const ranged: BossPattern = { stance: 'ranged', kind: 'ring', every: 3, count: 8, speed: 60, radius: 5, damage: 10, visual: 'rock' }
    expect(patternLive(ranged, fight)).toBe(false)
    expect(patternLive(ranged, { ...fight, stance: 'ranged' })).toBe(true)
  })

  it('presses harder difficulties with pace, counts and shorter warnings, never under the floor', () => {
    const ring: BossPattern = { kind: 'ring', every: 4, count: 10, speed: 60, radius: 5, damage: 10, visual: 'rock' }
    const trail: BossPattern = { kind: 'trail', every: 0.2, ttl: 2, radius: 7, damage: 10, visual: 'fire' }
    const normal = createFight(createRng(1), 'normal')
    const nightmare = createFight(createRng(1), 'nightmare')
    expect(attackWait(ring, normal)).toBe(4)
    expect(attackWait(ring, nightmare)).toBeCloseTo(4 * BOSS_DIFFICULTY.nightmare.pace)
    expect(attackWait(ring, { ...nightmare, enraged: true })).toBeCloseTo(4 * BOSS_DIFFICULTY.nightmare.pace * BOSS_RAGE.wait)
    expect(attackWait(trail, nightmare)).toBe(0.2)
    expect(attackWait(ring, null)).toBe(4)

    expect(attackCount(10, normal)).toBe(10)
    expect(attackCount(10, nightmare)).toBe(Math.round(10 * BOSS_DIFFICULTY.nightmare.more))
    expect(attackCount(1, nightmare)).toBe(1)

    expect(telegraph(1.2, normal)).toBe(1.2)
    expect(telegraph(1.4, nightmare)).toBeCloseTo(1.4 * BOSS_DIFFICULTY.nightmare.telegraph)
    expect(telegraph(0.85, nightmare)).toBe(MIN_TELEGRAPH)
    expect(telegraph(0.7, nightmare)).toBe(0.7)
    expect(telegraph(0.7, null)).toBe(0.7)
  })

  it('chains another live attack, else the same one, never a trail', () => {
    // Mewtwo's first phase: [ring (both stances), ranged strikes, close slam, ...].
    const mewtwo = BOSS_PHASES.mewtwo![0]!.patterns
    const fight = createFight(createRng(1), 'normal')
    expect(chainTarget(mewtwo, fight, 2)).toBe(0)
    expect(chainTarget(mewtwo, { ...fight, stance: 'ranged' }, 0)).toBe(1)
    const trail: BossPattern = { kind: 'trail', every: 0.2, ttl: 2, radius: 7, damage: 10, visual: 'fire' }
    const slam: BossPattern = { stance: 'close', kind: 'strikes', every: 4, target: 'self', count: 1, spread: 0, radius: 40, delay: 1.2, damage: 10, visual: 'slam' }
    const rage: BossPattern = { below: 0.5, kind: 'ring', every: 4, count: 8, speed: 60, radius: 5, damage: 10, visual: 'rock' }
    expect(chainTarget([trail, slam, rage], fight, 1)).toBe(1)
    expect(chainTarget([trail, slam, rage], { ...fight, share: 0.4 }, 1)).toBe(2)
    expect(chainTarget([trail], fight, 0)).toBe(-1)
  })
})

describe('wave boss patterns', () => {
  /** Every wave boss (everything that fights in stances) on the schedule. */
  const waveBosses = [...Object.keys(BOSS_PATTERNS), ...WAVE_LEGENDS].filter((id) => fightsInStances(id as keyof typeof BOSS_PATTERNS)) as (keyof typeof BOSS_PATTERNS)[]

  it('each one aims at the player, punishes keeping away, unlocks an attack when enraged and adds one on Nightmare', () => {
    for (const id of waveBosses) {
      const patterns = bossKit(id)
      expect(patterns.some((p) => (p.kind === 'strikes' && p.target === 'player') || p.kind === 'volley'), id).toBe(true)
      expect(patterns.some((p) => p.far !== undefined), id).toBe(true)
      expect(patterns.some((p) => p.below === BOSS_RAGE.below), id).toBe(true)
      expect(patterns.some((p) => p.from === 'nightmare'), id).toBe(true)
    }
  })

  it('every warning reads: strikes and volleys show for at least the floor on Nightmare', () => {
    const nightmare = createFight(createRng(1), 'nightmare')
    for (const id of waveBosses) {
      for (const p of bossKit(id)) {
        if (p.kind === 'strikes') expect(telegraph(p.delay, nightmare), id).toBeGreaterThanOrEqual(MIN_TELEGRAPH)
        if (p.kind === 'volley') expect(telegraph(p.windup, nightmare), id).toBeGreaterThanOrEqual(MIN_TELEGRAPH)
      }
    }
  })
})

describe('bosses with phases', () => {
  const phases = BOSS_PHASES.kyogre!

  it('move on as their HP falls under each threshold', () => {
    expect([phaseAt(phases, 1), phaseAt(phases, 0.69), phaseAt(phases, 0.67), phaseAt(phases, 0.2)]).toEqual([0, 0, 1, 2])
  })

  it('hold on at 1 HP until their last phase, and through a phase opening', () => {
    const fight = createFight(createRng(1), 'normal')
    expect(holdsOn({ kind: 'kyogre', fight })).toBe(true)
    fight.phase = phases.length - 1
    expect(holdsOn({ kind: 'kyogre', fight })).toBe(false)
    fight.shift = 1
    expect(holdsOn({ kind: 'kyogre', fight })).toBe(true)
    expect(holdsOn({ kind: 'onix', fight })).toBe(false)
  })

  it("keep the rest of the phase waiting until an ultimate's last warning has landed", () => {
    const ultimate = phases[2]!.ultimate!
    const last = ultimate.steps.at(-1)!
    expect(ultimateLength(ultimate.steps)).toBeGreaterThan(last.at)
  })
})

describe('a phase that holds on for its ultimate (Groudon, Rayquaza)', () => {
  const phases = BOSS_PHASES.groudon!
  const maxHp = 1000

  it("can't be kept at its gate by a stun, sleep or freeze", () => {
    const fight = createFight(createRng(1), 'normal')
    expect(phases[0]!.hold).toBe(true)
    expect(statusStops(phases, fight, true)).toBe(false)
    fight.ultDone = true
    expect(statusStops(phases, fight, true)).toBe(true)
    fight.ult = { t: 0, step: 0 }
    expect(statusStops(phases, fight, true)).toBe(false)
    expect(statusStops(null, null, true)).toBe(true)
    expect(statusStops(phases, fight, false)).toBe(false)
  })

  it('plays its ultimate at once when hit down to the gate', () => {
    const fight = createFight(createRng(1), 'normal')
    fight.ultLeft = 6
    const gate = holdFloor(phases, fight, maxHp)
    expect(ultimateDue(phases, fight, gate + 50, maxHp)).toBe(6)
    expect(ultimateDue(phases, fight, gate, maxHp)).toBe(GATE_WAIT)
    fight.ultDone = true
    expect(ultimateDue(phases, fight, gate, maxHp)).toBe(6)
  })
})

describe('a linked pair (Latias and Latios)', () => {
  it('share one pool of HP, so they move through the phases together', () => {
    const a = { hp: 300, maxHp: 1000 }
    expect(pooledShare(a, { hp: 1000, maxHp: 1000 })).toBeCloseTo(0.65)
    expect(pooledShare(a, { hp: -40, maxHp: 1000 })).toBeCloseTo(0.15)
    expect(pooledShare(a, undefined)).toBeCloseTo(0.3)
  })

  it('never faint alone while linked, even in their last phase', () => {
    const fight = createFight(createRng(1), 'normal')
    fight.phase = (BOSS_PHASES.latios?.length ?? 1) - 1
    fight.link = 7
    expect(holdsOn({ kind: 'latios', fight })).toBe(true)
    fight.link = -1
    expect(holdsOn({ kind: 'latios', fight })).toBe(false)
  })

  it('fly across their home from each other, and circle once alone', () => {
    const fight = createFight(createRng(1), 'normal', { x: 100, y: 100 })
    const out: Steering = { x: 0, y: 0, pace: 0 }
    steerBoss(fight, 'latios', { x: 200, y: 100, id: 2 }, { x: 0, y: 0 }, 0, out, { x: 40, y: 60 })
    expect([out.x, out.y]).toEqual([160, 140])
    steerBoss(fight, 'latios', { x: 200, y: 100, id: 2 }, { x: 0, y: 0 }, 0, out, null)
    const steer = BOSS_PHASES.latios![0]!.steer
    if (steer?.kind !== 'mirror') throw new Error('Latios mirrors Latias')
    expect(Math.hypot(out.x - 100, out.y - 100)).toBeCloseTo(steer.radius)
  })
})

describe('Deoxys', () => {
  it('takes more damage in its frail Attack Forme only', () => {
    const fight = createFight(createRng(1), 'normal')
    expect(phaseTaken({ kind: 'deoxys', fight })).toBe(1)
    fight.phase = 1
    expect(phaseTaken({ kind: 'deoxys', fight })).toBeGreaterThan(1)
    fight.phase = 2
    expect(phaseTaken({ kind: 'deoxys', fight })).toBe(1)
  })
})

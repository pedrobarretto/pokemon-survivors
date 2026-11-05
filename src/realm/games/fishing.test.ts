import { describe, expect, it } from 'vitest'
import { MINIGAMES } from '../../data/minigames'
import { BIG_HAUL, CATCHES, CATCH_IDS, featsOf, fightStep, inZone, logOf, rollCatch, scoreOf, startFight, zoneOf, zoneWidth, ZONES, type CatchId, type Fight, type FightEnd, type Rng } from './fishing.rules'

/** A seeded rng (mulberry32). */
const seeded = (seed: number): Rng => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let r = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296
}

const DT = 1 / 60

/** Fights `id` to the end with a holding policy, or gives up after `max` s. */
const fight = (id: CatchId, hold: (f: Fight) => boolean, seed = 1, max = 60): FightEnd | null => {
  const rng = seeded(seed)
  const f = startFight(id)
  for (let t = 0; t < max; t += DT) {
    const end = fightStep(f, hold(f), DT, rng)
    if (end) return end
  }
  return null
}

/** A good angler: keeps the zone's middle on the fish, and lets go while it runs. */
const angler = (f: Fight) => f.runs === 0 && f.fish > f.zone + zoneWidth(f.catchId) / 2 - f.speed * 0.12

describe('casting', () => {
  it('lands further out the longer the cast is held', () => {
    expect([0, 0.3, 0.5, 0.7, 0.8, 1].map(zoneOf)).toEqual(['near', 'near', 'mid', 'mid', 'far', 'far'])
  })

  it('rolls only what lives in each stretch, the rarest only far out', () => {
    for (const zone of ZONES) {
      const rng = seeded(7)
      for (let i = 0; i < 3000; i++) expect(CATCHES[rollCatch(zone, rng)].weight[zone]).toBeGreaterThan(0)
    }
    const near = new Set(Array.from({ length: 3000 }, (_, i) => rollCatch('near', seeded(i))))
    expect(near.has('shinyGyarados')).toBe(false)
    expect(near.has('feebas')).toBe(false)
  })

  it('pays more for a cast far out than near the dock, on average', () => {
    const mean = (zone: (typeof ZONES)[number]) => {
      const rng = seeded(3)
      let sum = 0
      for (let i = 0; i < 5000; i++) sum += CATCHES[rollCatch(zone, rng)].value
      return sum / 5000
    }
    expect(mean('mid')).toBeGreaterThan(mean('near'))
    expect(mean('far')).toBeGreaterThan(mean('mid'))
  })
})

describe('the fight', () => {
  it('lands an easy fish for a player who follows it', () => {
    for (const seed of [1, 2, 3, 4, 5]) expect(fight('magikarp', angler, seed)).toBe('landed')
  })

  it('lets a fish go when the zone is left to fall', () => {
    expect(fight('goldeen', () => false)).toBe('escaped')
  })

  it('snaps the line when held through every run', () => {
    expect(fight('wailmer', () => true, 4)).toBe('snapped')
  })

  it('makes the zone narrower for a tougher fish', () => {
    expect(zoneWidth('shinyGyarados')).toBeLessThan(zoneWidth('wailmer'))
    expect(zoneWidth('wailmer')).toBeLessThan(zoneWidth('magikarp'))
  })

  it('keeps the fish and the zone on the bar', () => {
    const rng = seeded(9)
    const f = startFight('qwilfish')
    for (let i = 0; i < 2000; i++) {
      fightStep(f, i % 90 < 50, DT, rng)
      expect(f.fish).toBeGreaterThanOrEqual(0)
      expect(f.fish).toBeLessThanOrEqual(1)
      expect(f.zone).toBeGreaterThanOrEqual(0)
      expect(f.zone + zoneWidth(f.catchId)).toBeLessThanOrEqual(1 + 1e-9)
      if (f.progress <= 0 || f.progress >= 1 || f.tension >= 1) break
    }
  })

  it('starts with the zone under the fish', () => {
    for (const id of CATCH_IDS) expect(inZone(startFight(id))).toBe(true)
  })
})

describe('a round', () => {
  it('scores the haul and names its feats', () => {
    expect(scoreOf(['magikarp', 'boot'])).toBe(CATCHES.magikarp.value + CATCHES.boot.value)
    expect(featsOf(['magikarp'])).toEqual([])
    expect(featsOf(['feebas', 'shinyGyarados'])).toEqual(['feebas', 'shinyGyarados', 'bigHaul'])
    expect(featsOf(Array.from({ length: Math.ceil(BIG_HAUL / CATCHES.wailmer.value) }, () => 'wailmer' as const))).toEqual(['bigHaul'])
  })

  it('brags only about feats the game declares', () => {
    const declared: readonly string[] = MINIGAMES.fishing.feats
    for (const feat of featsOf(['feebas', 'shinyGyarados', 'wailmer', 'wailmer', 'wailmer'])) expect(declared).toContain(feat)
  })

  it('logs each kind once, the most valuable first', () => {
    expect(logOf(['magikarp', 'staryu', 'magikarp', 'boot'])).toEqual([
      { id: 'staryu', count: 1, points: CATCHES.staryu.value },
      { id: 'magikarp', count: 2, points: 2 * CATCHES.magikarp.value },
      { id: 'boot', count: 1, points: CATCHES.boot.value },
    ])
  })
})

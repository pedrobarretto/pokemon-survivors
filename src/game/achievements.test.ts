import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS } from '../data/achievements'
import { addRun, achievementProgress, NO_ACHIEVEMENTS, NO_LIFETIME, parseAchievements, parseTitle, recordAchievements, STARTER_LINE_DEX } from './achievements'
import { EMPTY_DEX, markCaught, markSeen } from './dex'
import { EGG_TIERS, EGGS } from './eggs'
import { EMPTY_SAVE, parseSave, recordHatch, recordRun } from './meta'
import { summary } from './tally.fixture'

describe('lifetime records', () => {
  it('count a run once, even when recorded again after endless mode', () => {
    const atVictory = summary({ kills: 900, time: 900, victory: true, legends: ['lugia'] })
    const endless = summary({ kills: 1200, time: 1300, victory: true, legends: ['lugia', 'dialga'], reaperDefeats: 1 })
    const l = addRun(addRun(NO_LIFETIME, atVictory, null), endless, atVictory)
    expect(l).toMatchObject({ runs: 1, wins: 1, kills: 1200, rifts: 2, reaperDefeats: 1, bestOvertime: 400, winGens: [1], winTypes: ['fire'] })
    expect(l.legends).toEqual(['lugia', 'dialga'])
  })

  it('keep bests instead of adding them', () => {
    const l = addRun(addRun(NO_LIFETIME, summary({ time: 600, level: 30 }), null), summary({ time: 120, level: 9 }), null)
    expect(l).toMatchObject({ runs: 2, bestTime: 600, bestLevel: 30, wins: 0, winGens: [] })
  })
})

describe('achievements', () => {
  it('unlock once, in list order', () => {
    const first = recordAchievements(NO_ACHIEVEMENTS, summary({ kills: 1000, time: 330 }), null)
    expect(first.unlocked).toEqual(['firstRun', 'kills1k', 'survive5'])
    expect(recordAchievements(first.achievements, summary({ kills: 5 }), null).unlocked).toEqual([])
  })

  it('count Alphas toward their own medals, the gold one with the Alpha Hunter title', () => {
    const first = recordAchievements(NO_ACHIEVEMENTS, summary({ alphaKills: 25 }), null)
    expect(first.unlocked).toEqual(['firstRun', 'alpha1', 'alpha25'])
    const later = recordAchievements(first.achievements, summary({ alphaKills: 75 }), null)
    expect(later.unlocked).toEqual(['alpha100'])
    expect(ACHIEVEMENTS.alpha100).toMatchObject({ medal: 'gold', title: true })
  })

  it('track region wins and the grass/fire/water trio', () => {
    let save = NO_ACHIEVEMENTS
    for (const starter of ['bulbasaur', 'cyndaquil', 'mudkip'] as const) save = recordAchievements(save, summary({ starter, victory: true }), null).achievements
    expect(save.unlocked).toEqual(expect.arrayContaining(['champion', 'trio', 'kanto', 'johto', 'hoenn']))
    expect(achievementProgress(save.lifetime, 'regions')).toEqual({ value: 3, target: 9 })
  })

  it('make an explorer of whoever clears every place, over as many runs as it takes', () => {
    const cave = recordAchievements(NO_ACHIEVEMENTS, summary({ places: ['cave'], placeClears: 1 }), null)
    expect(cave.unlocked).toContain('place1')
    const again = recordAchievements(cave.achievements, summary({ places: ['cave', 'graveyard'], placeClears: 2 }), null)
    expect(again.unlocked).not.toContain('explorer')
    const sky = recordAchievements(again.achievements, summary({ starter: 'pidgey', places: ['sky'], placeClears: 1 }), null)
    expect(sky.unlocked).toContain('explorer')
    expect(sky.achievements.lifetime).toMatchObject({ placeClears: 4, places: ['cave', 'graveyard', 'sky'] })
    expect(parseAchievements(JSON.parse(JSON.stringify(sky.achievements))).lifetime.places).toEqual(['cave', 'graveyard', 'sky'])
  })

  it('count hidden zones for their own medal, never toward the explorer', () => {
    const grotto = recordAchievements(NO_ACHIEVEMENTS, summary({ places: ['cave', 'graveyard', 'grotto'], placeClears: 3 }), null)
    expect(grotto.unlocked).not.toContain('explorer')
    expect(achievementProgress(grotto.achievements.lifetime, 'secrets')).toEqual({ value: 1, target: 2 })
    const both = recordAchievements(grotto.achievements, summary({ places: ['underground'], placeClears: 1 }), null)
    expect(both.unlocked).toEqual(['secrets'])
  })

  it('pay missions and medals into the wallet', () => {
    const date = new Date(2026, 9, 13, 12)
    const r = recordRun(EMPTY_SAVE, summary({ kills: 100_000 }), null, date)
    expect(r.unlocked).toContain('kills100k')
    expect(r.save.wallet).toBe(r.reward)
    expect(r.reward).toBeGreaterThan(2000)
  })
})

describe('Pokédex and egg achievements', () => {
  const date = new Date(2026, 9, 13, 12)

  it('read the Pokédex: species seen and every starter form caught', () => {
    const seen = Array.from({ length: 100 }, (_, i) => i + 1).reduce(markSeen, EMPTY_DEX)
    expect(recordAchievements(NO_ACHIEVEMENTS, summary(), null, 0, seen).unlocked).toContain('dex100')
    expect(ACHIEVEMENTS.starterLines.target).toBe(STARTER_LINE_DEX.length)
    const lines = STARTER_LINE_DEX.reduce((dex, n) => markCaught(dex, n), EMPTY_DEX)
    expect(achievementProgress(NO_LIFETIME, 'starterLines', markSeen(lines, 1))).toEqual({ value: 81, target: 81 })
    expect(achievementProgress(NO_LIFETIME, 'starterLines', markSeen(EMPTY_DEX, 1))).toEqual({ value: 0, target: 81 })
  })

  it('unlock on hatching, and a gold medal brings an egg', () => {
    const first = recordHatch(EMPTY_SAVE, false, date)
    expect(first.unlocked).toEqual(['firstHatch'])
    expect(first.save.achievements.lifetime).toMatchObject({ hatches: 1, shinyHatches: 0 })
    const shiny = recordHatch(first.save, true, date)
    expect(shiny.unlocked).toEqual(['shinyHatch'])
    expect(shiny.eggs).toEqual(['rare'])
    expect(shiny.save.eggs).toEqual([{ tier: 'rare', steps: 0 }])
  })

  it('pay reward eggs in ₽ once the run used up its egg cap, or the incubator is full', () => {
    const capped = recordRun(EMPTY_SAVE, summary({ kills: 100_000 }), null, date, 0)
    expect(capped.unlocked).toContain('kills100k')
    expect(capped.eggs).toEqual([])
    expect(capped.save.eggs).toEqual([])
    expect(capped.converted).toEqual({ full: [], cap: ['rare'] })
    expect(capped.save.wallet).toBe(capped.reward + EGG_TIERS.rare.refund)
    expect(recordRun(EMPTY_SAVE, summary({ kills: 100_000 }), null, date).save.eggs).toHaveLength(1)
    const full = { ...EMPTY_SAVE, eggs: Array.from({ length: EGGS.slots }, () => ({ tier: 'common' as const, steps: 0 })) }
    const paid = recordHatch({ ...full, achievements: { ...NO_ACHIEVEMENTS, unlocked: ['firstHatch'] } }, true, date)
    expect(paid.eggs).toEqual([])
    expect(paid.converted).toEqual({ full: ['rare'], cap: [] })
    expect(paid.save.wallet).toBe(paid.reward + EGG_TIERS.rare.refund)
  })
})

describe('save fields', () => {
  it('parse missing or broken data as empty and drop unknown ids', () => {
    expect(parseAchievements(null)).toEqual(NO_ACHIEVEMENTS)
    const parsed = parseAchievements({ unlocked: ['champion', 'nope', 'champion'], lifetime: { kills: 12.5, legends: ['lugia', 'mew'], winGens: [1, 42] } })
    expect(parsed.unlocked).toEqual(['champion'])
    expect(parsed.lifetime).toMatchObject({ kills: 12, legends: ['lugia'], winGens: [1], runs: 0 })
  })

  it('keep a title only while its achievement is unlocked', () => {
    expect(parseTitle('champion', ['champion'])).toBe('champion')
    expect(parseTitle('champion', [])).toBeNull()
    expect(parseTitle('firstRun', ['firstRun'])).toBeNull()
  })

  it('load a save from before missions existed with the new fields empty', () => {
    const old = parseSave(JSON.stringify({ version: 1, wallet: 300, ranks: { hpUp: 1 } }))
    expect(old).toMatchObject({ wallet: 300, missions: EMPTY_SAVE.missions, achievements: NO_ACHIEVEMENTS, title: null })
  })
})

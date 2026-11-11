import { describe, expect, it } from 'vitest'
import { COSMOG, MELTAN, ZYGARDE } from '../data/legendPaths'
import { formAfter } from './legend'
import {
  clearTrial, cosmogLean, cosmogStage, cubePieces, kubfuJoined, mergePaths, NO_COSMOG, NO_PATHS, openForms, parsePaths, pathGifts, recordCosmog, runPieces, templeRun, trialOpen,
  type CosmogSave,
} from './legendPaths'
import { createPathRun } from './pathRun'
import { keepGiven } from './gifts'
import { EMPTY_SAVE } from './meta'
import { gameGiftsApplied } from './gameGifts'
import { winCounts } from './capture'

const researched: CosmogSave = { ...NO_COSMOG, research: [...COSMOG.research] }

describe('the Zygarde Cube', () => {
  it('counts Cells up to 95 and Cores up to 5, so 100% needs every Core', () => {
    expect([cubePieces({ cells: 40, cores: 2 }), cubePieces({ cells: 300, cores: 0 }), cubePieces({ cells: 95, cores: 9 })]).toEqual([42, 95, 100])
  })

  it('opens each Forme at its pieces, the 10% one with Zygarde itself', () => {
    const at = (cells: number, cores: number) => openForms({ ...NO_PATHS, cells, cores }, 'zygarde')
    expect([at(9, 0), at(10, 0), at(49, 1), at(95, 4), at(95, 5)]).toEqual([
      [], ['zygarde10'], ['zygarde10', 'zygarde50'], ['zygarde10', 'zygarde50'], ['zygarde10', 'zygarde50', 'zygardeComplete'],
    ])
  })

  it('brings 0 to 3 Cells a run, about 1.5 on average, and a Core now and then', () => {
    const runs = Array.from({ length: 4000 }, (_, seed) => runPieces(seed + 1))
    const mean = runs.reduce((sum, r) => sum + r.cells, 0) / runs.length
    const cores = runs.filter((r) => r.core).length / runs.length
    expect(runs.every((r) => r.cells >= 0 && r.cells <= 3)).toBe(true)
    expect(mean).toBeGreaterThan(1.4)
    expect(mean).toBeLessThan(1.7)
    expect(Math.abs(cores - ZYGARDE.core)).toBeLessThan(0.02)
  })

  it('schedules a run’s pieces inside its window, in order and far enough apart', () => {
    for (let seed = 1; seed < 300; seed++) {
      const { pieces } = createPathRun(seed, false)
      for (const [i, p] of pieces.entries()) {
        expect(p.at).toBeGreaterThanOrEqual(ZYGARDE.from)
        expect(p.at).toBeLessThanOrEqual(ZYGARDE.until)
        if (i > 0) expect(p.at - pieces[i - 1]!.at).toBeGreaterThanOrEqual(ZYGARDE.apart - 1)
      }
      expect(pieces.filter((p) => p.core).length).toBe(runPieces(seed).core ? 1 : 0)
    }
  })
})

describe('Cosmog', () => {
  const win = { time: 900, victory: true, rift: false }

  it('ticks one research step a run: a night win, a day win and a rift legendary, in any order', () => {
    const a = recordCosmog(NO_COSMOG, win, 22, true)
    const b = recordCosmog(a, win, 23, true)
    const c = recordCosmog(b, { ...win, rift: true }, 10, true)
    const d = recordCosmog(c, { ...win, rift: true }, 10, true)
    expect([a.research, b.research, c.research, d.research]).toEqual([['night'], ['night'], ['night', 'day'], ['night', 'day', 'rift']])
    expect(cosmogStage(c)).toBeNull()
    expect(cosmogStage(d)).toBe('cosmog')
  })

  it('counts a run once, and only from five minutes on, by the hour it ended at', () => {
    const once = recordCosmog(researched, win, 12, true)
    expect(recordCosmog(once, win, 12, false)).toBe(once)
    expect(recordCosmog(researched, { ...win, time: COSMOG.minRun - 1 }, 12, true)).toBe(researched)
    expect([once.sun, once.moon, recordCosmog(researched, win, 3, true).moon]).toEqual([1, 0, 1])
  })

  it('becomes Cosmoem, then the legend its hours lean to, and a second Cosmog the missing one', () => {
    let c = researched
    for (let i = 0; i < COSMOG.cosmoem; i++) c = recordCosmog(c, win, 21, true)
    expect(cosmogStage(c)).toBe('cosmoem')
    for (let i = COSMOG.cosmoem; i < COSMOG.evolve; i++) c = recordCosmog(c, win, i % 3 === 0 ? 9 : 21, true)
    expect(c.raised).toEqual(['lunala'])
    expect([c.runs, cosmogStage(c)]).toEqual([0, 'cosmog'])
    expect(cosmogLean({ ...c, sun: 0, moon: 9 }, false)).toBe('solgaleo')
    for (let i = 0; i < COSMOG.evolve; i++) c = recordCosmog(c, win, 21, true)
    expect(c.raised).toEqual(['solgaleo', 'lunala'])
    expect(cosmogStage(c)).toBeNull()
  })

  it('breaks a tie by the hour of the run that tips it', () => {
    expect([cosmogLean({ ...researched, sun: 3, moon: 3 }, true), cosmogLean({ ...researched, sun: 3, moon: 3 }, false)]).toEqual(['solgaleo', 'lunala'])
  })
})

describe('the Torre', () => {
  it('opens each floor after the one before it and one tower, ever, after all three', () => {
    expect([trialOpen([], 'fist'), trialOpen([], 'crowd'), trialOpen(['fist'], 'crowd'), trialOpen(['fist', 'crowd'], 'dark')]).toEqual([true, false, true, false])
    const floors = clearTrial(clearTrial(clearTrial([], 'fist'), 'crowd'), 'chase')
    expect([kubfuJoined(floors), trialOpen(floors, 'dark'), trialOpen(floors, 'water')]).toEqual([true, true, true])
    const water = clearTrial(floors, 'water')
    expect([trialOpen(water, 'dark'), clearTrial(water, 'dark')]).toEqual([false, water])
    expect(openForms({ ...NO_PATHS, trials: water }, 'kubfu')).toEqual(['urshifuRapid'])
  })
})

describe('the save', () => {
  it('merges every counter at the larger side, Cosmog with the side further along, one tower', () => {
    const a = { ...NO_PATHS, cells: 30, cores: 1, nuts: 50, trials: ['fist', 'crowd', 'chase', 'dark'] as const, cosmog: { ...researched, runs: 4, sun: 4 } }
    const b = { ...NO_PATHS, cells: 12, cores: 3, nuts: 400, trials: ['fist', 'water'] as const, cosmog: { ...NO_COSMOG, research: ['day'] as const, raised: ['lunala'] as const } }
    const m = mergePaths(a, b)
    expect(m).toEqual({ cells: 30, cores: 3, nuts: 400, trials: ['fist', 'crowd', 'chase', 'dark'], cosmog: { research: [...COSMOG.research], runs: 0, sun: 0, moon: 0, raised: ['lunala'] } })
    expect(mergePaths(m, a)).toEqual(m)
    expect(parsePaths(JSON.parse(JSON.stringify(m)))).toEqual(m)
  })

  it('opens Melmetal at its Hex Nuts', () => {
    expect([openForms({ ...NO_PATHS, nuts: MELTAN.nuts - 1 }, 'meltan'), openForms({ ...NO_PATHS, nuts: MELTAN.nuts }, 'meltan'), openForms({ ...NO_PATHS, nuts: 999 }, 'kyogre')]).toEqual([[], ['melmetal'], []])
  })

  it('brings the path legends as game-made gifts the API vouches for, and drops one the save gave itself', () => {
    const save = { ...EMPTY_SAVE, paths: { ...NO_PATHS, cells: 10, trials: ['fist', 'crowd', 'chase'] as const, cosmog: { ...researched, raised: ['solgaleo'] as const } } }
    expect(pathGifts(save).map((g) => g.id)).toEqual(['path:zygarde', 'path:kubfu', 'path:solgaleo'])
    const opened = { ...save, gifts: ['path:zygarde'], legends: { zygarde: 1, meltan: 1 } }
    const kept = keepGiven(opened, gameGiftsApplied(opened))
    expect(kept.legends).toEqual({ zygarde: 1 })
  })
})

describe('Regigigas', () => {
  it('counts a win only once the Regi trio is captured', () => {
    expect([winCounts({ regirock: 3, regice: 3 }, 'regigigas', false), winCounts({ regirock: 3, regice: 3, registeel: 3 }, 'regigigas', false)]).toEqual([false, true])
    expect(winCounts({}, 'zygarde', false)).toBe(false)
  })

  it('raises its temple only for the trio’s captor, often until it’s caught', () => {
    const odds = (caught: boolean) => Array.from({ length: 2000 }, (_, i) => templeRun(i + 1, true, caught)).filter(Boolean).length / 2000
    expect(Array.from({ length: 50 }, (_, i) => templeRun(i + 1, false, false)).some(Boolean)).toBe(false)
    expect(odds(false)).toBeGreaterThan(odds(true) * 2)
  })
})

describe('path forms', () => {
  it('give each awakening its look: Zygarde’s Formes as they open, Urshifu and Melmetal as other species', () => {
    expect([formAfter('zygarde', 0, ['zygarde10'])?.key, formAfter('zygarde', 1, ['zygarde10'])?.key, formAfter('zygarde', 1, ['zygarde10', 'zygarde50'])?.name]).toEqual(['ten', 'ten', 'Zygarde 50%'])
    expect(formAfter('kubfu', 2, ['urshifuRapid'])).toEqual({ dex: 892, key: 'rapid', name: 'Urshifu', types: ['fighting', 'water'] })
    expect([formAfter('kubfu', 1, ['urshifuSingle']), formAfter('meltan', 2, ['melmetal'])?.dex, formAfter('kyogre', 2)?.key]).toEqual([null, 809, 'primal'])
  })
})

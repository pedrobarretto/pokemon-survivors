import { describe, expect, it } from 'vitest'
import { FURNITURE, isFurnitureId } from './furniture'
import { FURNITURE_GAMES, MINIGAMES, MINIGAME_DAILY, MINIGAME_IDS, capped, coinsFor, trophiesEarned, type Trophy } from './minigames'

describe('minigames', () => {
  it('pays a solo score per point up to the play cap, and nothing for a made-up or too quick game', () => {
    expect(coinsFor('fishing', { score: 120 }, 60_000)).toBe(120)
    expect(coinsFor('fishing', { score: 1999 }, 60_000)).toBe(MINIGAMES.fishing.pay.perPlay)
    expect(coinsFor('fishing', { score: 99_999 }, 60_000)).toBeNull()
    expect(coinsFor('fishing', { score: 100 }, 1_000)).toBeNull()
    expect(coinsFor('fishing', { result: 'win', vs: 'human' }, 60_000)).toBeNull()
  })

  it('pays a table result, halved against the bot', () => {
    expect(coinsFor('fourInRow', { result: 'win', vs: 'human' }, 60_000)).toBe(150)
    expect(coinsFor('fourInRow', { result: 'win', vs: 'bot' }, 60_000)).toBe(75)
    expect(coinsFor('fourInRow', { score: 10 }, 60_000)).toBeNull()
  })

  it('caps by the game and by the day across games', () => {
    expect(capped('fishing', 250, 700, 0)).toBe(100)
    expect(capped('fishing', 250, 0, MINIGAME_DAILY - 50)).toBe(50)
    expect(capped('fishing', 250, 800, 0)).toBe(0)
  })

  it('grants trophies from stats and feats', () => {
    expect(trophiesEarned('fishing', { plays: 0, wins: 0, best: 0, feats: [] })).toEqual([])
  })

  it('names only earned, unsold furniture as trophies, and only real pieces as game furniture', () => {
    for (const id of MINIGAME_IDS)
      for (const t of MINIGAMES[id].trophies as readonly Trophy[]) {
        expect(isFurnitureId(t.furniture), t.furniture).toBe(true)
        if (isFurnitureId(t.furniture)) expect(FURNITURE[t.furniture].price).toBeNull()
        if ('feat' in t.after) expect(MINIGAMES[id].feats as readonly string[]).toContain(t.after.feat)
      }
    for (const id of Object.keys(FURNITURE_GAMES)) expect(isFurnitureId(id), id).toBe(true)
  })
})

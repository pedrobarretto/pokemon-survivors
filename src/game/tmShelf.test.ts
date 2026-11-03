import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { BOSS_TMS } from '../data/tms'
import { TM_SHELF } from '../data/shop'
import { challengeProblem, challengeStart, dailyChallenge } from './challenge'
import { killEnemy } from './combat'
import { addDays } from './day'
import { spawnEnemy } from './enemies'
import { chooseOffer, step } from './game'
import { EMPTY_SAVE, NO_RANKS, recordRun, type Save } from './meta'
import { parseReplay, recordEvent, recordStep, resimulate, startGame, startRecording, TICK, type ReplayStart } from './replay'
import { NO_SHOP } from './shop'
import { mergeSaves } from './sync'
import { summary } from './tally.fixture'
import { openTutor } from './tms'
import { shopTmMoveIds } from './shopTmMoves'
import { tmMoveIds } from './tmMoves'
import { armedTms, armTm, buyTm, learnTms, mergeTms, NO_TMS, parseTms, shelfOf, tmBlock, tmListing, tmRotation, type TmCase } from './tmShelf'
import type { Game } from './types'

const DAY = '2026-10-21'
const START: ReplayStart = { seed: 11, starter: 'squirtle', difficulty: 'normal', ranks: NO_RANKS, shiny: false, luckyEgg: false, outbreak: null, halloween: false, bag: [], view: { w: 480, h: 270 } }

const save = (wallet: number, level: Save['shop']['level'], tms: Partial<TmCase> = {}): Save => ({ ...EMPTY_SAVE, wallet, shop: { ...NO_SHOP, level }, tms: { ...NO_TMS, ...tms } })

describe('the TM shelf', () => {
  it('rotates 3 regular TMs a day, the same for everyone, each back within 7 days over years', () => {
    const last = new Map<string, number>()
    const longest = new Map<string, number>()
    for (let i = 0; i < 3 * 365; i++) {
      const today = tmRotation(addDays(TM_SHELF.epoch, i))
      expect(today).toHaveLength(TM_SHELF.rotation)
      expect(new Set(today).size).toBe(TM_SHELF.rotation)
      for (const id of today) {
        longest.set(id, Math.max(longest.get(id) ?? 0, i - (last.get(id) ?? -1)))
        last.set(id, i)
      }
    }
    for (const id of tmMoveIds()) expect([id, longest.get(id)! <= 7]).toEqual([id, true])
  })

  it('always lists the exclusives and the TMs a run taught; never a legendary one', () => {
    const found = tmMoveIds().find((id) => !tmRotation(DAY).includes(id))!
    const tms = { ...NO_TMS, learned: [found] }
    const shelf = shelfOf(tms, DAY)
    expect(shelf).toContain(found)
    expect(tmListing(tms, found, DAY)).toBe('learned')
    for (const id of shopTmMoveIds()) expect(tmListing(tms, id, DAY)).toBe('exclusive')
    for (const id of tmRotation(DAY)) expect(shelf).toContain(id)
    expect(shelf).toHaveLength(shopTmMoveIds().length + 1 + TM_SHELF.rotation)
    expect(shelf.some((id) => (id as string) === 'sacredFire')).toBe(false)
  })

  it('sells from the Tent (Lv 2), what is on the shelf today, once, into `spent`', () => {
    const away = tmMoveIds().find((id) => !tmRotation(DAY).includes(id))!
    const today = tmRotation(DAY)[0]!
    expect(tmBlock(save(1e6, 1), today, DAY)).toBe('locked')
    expect(tmBlock(save(1e6, 2), away, DAY)).toBe('away')
    expect(tmBlock(save(100, 2), 'payDay', DAY)).toBe('poor')
    const bought = buyTm(save(30_000, 2), 'payDay', DAY)!
    expect(bought.wallet).toBe(30_000 - TM_SHELF.exclusive)
    expect(bought.spent).toBe(TM_SHELF.exclusive)
    expect(bought.tms.owned).toEqual(['payDay'])
    expect(bought.tms.armed).toEqual(['payDay'])
    expect(tmBlock(bought, 'payDay', DAY)).toBe('owned')
    // Owned for good: off the rotation, it stays on the shelf.
    expect(shelfOf(buyTm(save(30_000, 2), today, DAY)!.tms, addDays(DAY, 1))).toContain(today)
  })

  it('arms up to the level’s limit, the oldest making room, and only TMs owned', () => {
    const owned: TmCase = { ...NO_TMS, owned: ['iceBeam', 'payDay', 'protect'] }
    const one = armTm(armTm(owned, 'iceBeam', true, 1), 'payDay', true, 1)
    expect(armedTms(one, 1)).toEqual(['payDay'])
    const two = armTm(armTm(armTm(owned, 'iceBeam', true, 2), 'payDay', true, 2), 'protect', true, 2)
    expect(armedTms(two, 2)).toEqual(['payDay', 'protect'])
    expect(armedTms(armTm(two, 'protect', false, 2), 2)).toEqual(['payDay'])
    expect(armTm(owned, 'thief', true, 2)).toEqual(owned)
    // A save that lost a level (a merge) arms fewer.
    expect(armedTms(two, 1)).toEqual(['payDay'])
  })

  it('remembers the TMs a run learned, and merges as unions with the armed picks of the incoming side', () => {
    expect(learnTms(NO_TMS, ['iceBeam', 'payDay', 'ember']).learned).toEqual(['iceBeam'])
    const recorded = recordRun(EMPTY_SAVE, summary({ tms: ['yawn', 'rockSlide'] }), null, new Date(`${DAY}T15:00:00Z`))
    expect(recorded.save.tms.learned).toEqual(['rockSlide', 'yawn'])
    const a: TmCase = { owned: ['iceBeam', 'payDay'], armed: ['payDay'], learned: ['yawn'] }
    const b: TmCase = { owned: ['protect'], armed: ['protect'], learned: ['iceBeam'] }
    expect(mergeTms(a, b)).toEqual({ owned: ['iceBeam', 'payDay', 'protect'], armed: ['protect'], learned: ['yawn', 'iceBeam'] })
    expect(mergeSaves({ ...EMPTY_SAVE, tms: a }, { ...EMPTY_SAVE, tms: b }).tms.owned).toHaveLength(3)
    expect(parseTms({ owned: ['iceBeam', 'nope', 'sacredFire'], armed: ['thief', 'iceBeam'], learned: ['payDay', 'yawn'] })).toEqual({ owned: ['iceBeam'], armed: ['iceBeam'], learned: ['yawn'] })
  })
})

/** A run past the opening draft. */
const run = (start: ReplayStart): Game => {
  const g = startGame(start)
  chooseOffer(g, g.player.offers[0]!)
  return g
}

describe('armed TMs in a run', () => {
  it('make the first boss discs and tutor lessons theirs, in order, then the run goes back to normal', () => {
    const g = run({ ...START, tms: ['payDay', 'iceBeam'] })
    killEnemy(g, spawnEnemy(g, 'onix', 40, 0))
    expect(g.pickups.find((k) => k.kind === 'tm')).toMatchObject({ move: 'payDay', source: 'armed' })
    expect(openTutor(g)).toBe(true)
    expect(g.player.offers[0]).toMatchObject({ kind: 'tm', id: 'iceBeam', source: 'tutor' })
    g.phase = 'playing'
    g.pickups.length = 0
    killEnemy(g, spawnEnemy(g, 'snorlax', 40, 0))
    expect(g.pickups.find((k) => k.kind === 'tm')).toMatchObject({ move: BOSS_TMS.snorlax, source: 'boss' })
  })

  it('ride in the replay, which rejects unknown, repeated or too many TMs, and re-simulate', () => {
    const start: ReplayStart = { ...START, tms: ['hyperBeam'] }
    const staged = () => {
      const g = run(start)
      killEnemy(g, spawnEnemy(g, 'onix', g.player.x, g.player.y))
      return g
    }
    const g = staged()
    const rec = startRecording(start)
    const bot = createRng(5)
    let angle = 0
    while (g.time < 12 && g.phase !== 'gameover') {
      if (g.phase !== 'playing' && g.phase !== 'evolving') {
        recordEvent(rec, ['offer', 0])
        chooseOffer(g, g.player.offers[0]!)
        continue
      }
      angle += (bot() - 0.5) * 0.4
      step(g, { move: recordStep(rec, start.view, { x: Math.cos(angle) * 0.3, y: Math.sin(angle) * 0.3 }), special: false }, TICK)
    }
    expect(g.player.moves.map((m) => m.id)).toContain('hyperBeam')
    const parsed = parseReplay(JSON.parse(JSON.stringify(rec.replay)))!
    expect(parsed.start.tms).toEqual(['hyperBeam'])
    const again = staged()
    expect(resimulate(parsed, again)).toMatchObject({ time: g.time, kills: g.kills, level: g.player.level })
    const bad = (tms: unknown) => parseReplay({ ...rec.replay, start: { ...rec.replay.start, tms } })
    expect(bad(['hyperBeam', 'hyperBeam'])).toBeNull()
    expect(bad(['sacredFire'])).toBeNull()
    expect(bad(['payDay', 'thief', 'protect'])).toBeNull()
    expect(bad(['payDay', 'iceBeam'])?.start.tms).toEqual(['payDay', 'iceBeam'])
  }, 30_000)

  it('are not allowed in the Desafio do dia, nor evolution items or Bottle Caps', () => {
    const c = dailyChallenge(DAY)
    const clean = challengeStart(c, { w: 480, h: 270 }, false)
    expect(challengeProblem(clean, DAY)).toBeNull()
    expect(challengeProblem({ ...clean, tms: ['payDay'] }, DAY)).toBe('items')
    expect(challengeProblem({ ...clean, evo: ['iceStone'] }, DAY)).toBe('items')
    expect(challengeProblem({ ...clean, caps: 1 }, DAY)).toBe('ranks')
  })
})

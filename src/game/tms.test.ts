import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { BRANCHES, type BranchId } from '../data/branches'
import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { BOSS_TMS } from '../data/tms'
import { formLine } from './branch'
import { killEnemy } from './combat'
import { spawnEnemy } from './enemies'
import { chooseOffer, step } from './game'
import { applyOffer, loadout, MAX_MOVES, offerPool } from './leveling'
import { NO_RANKS } from './meta'
import { MOVES, maxMoveLevel, type MoveId } from './moves'
import { recordEvent, recordStep, resimulate, startGame, startRecording, TICK, type ReplayStart } from './replay'
import { isTmMove } from './tmMoves'
import { runLearnset } from './learnsets'
import { forgetChoice, needsForget, tmCard, tmChoice, tutorPicks, tutorPool, tutorPrice, tutorTypes, tutorWeight, TUTOR } from './tmRules'
import { collectTm, dropLegendaryTm, dropTm, openTutor } from './tms'
import type { Game, OwnedMove, TmOffer } from './types'

const owned = (id: MoveId, level = 1): OwnedMove => ({ id, level, cooldown: 0 })
const SIX: OwnedMove[] = (['waterGun', 'whirlpool', 'swift', 'thunder', 'sludgeBomb', 'gust'] as const).map((id) => owned(id))
const START: ReplayStart = { seed: 11, starter: 'squirtle', difficulty: 'normal', ranks: NO_RANKS, shiny: false, luckyEgg: false, outbreak: null, halloween: false, bag: [], view: { w: 480, h: 270 } }

/** A run past the opening draft, playing. */
const run = (): Game => {
  const g = startGame(START)
  chooseOffer(g, g.player.offers[0]!)
  return g
}

describe('TM cards', () => {
  it('teach a new move at Lv 1, raise an owned one, and skip a mastered one', () => {
    expect(tmCard([], 'iceBeam', 'boss')).toEqual({ kind: 'tm', id: 'iceBeam', level: 1, source: 'boss', price: 0 })
    expect(tmCard([owned('iceBeam', 3)], 'iceBeam', 'boss')?.level).toBe(4)
    expect(tmCard([owned('iceBeam', maxMoveLevel('iceBeam'))], 'iceBeam', 'boss')).toBeNull()
  })

  it('always come with a pass, and open nothing when every move is mastered', () => {
    expect(tmChoice([], ['iceBeam', 'yawn'], 'tutor', 300).map((o) => o.kind)).toEqual(['tm', 'tm', 'pass'])
    expect(tmChoice([owned('yawn', maxMoveLevel('yawn'))], ['yawn'], 'boss')).toEqual([])
  })

  it('are boss moves exempt from learnsets and the evolution rule', () => {
    for (const id of Object.values(BOSS_TMS)) {
      expect(isTmMove(id)).toBe(true)
      expect(MOVES[id].upgrades.length).toBe(7)
    }
  })
})

describe('forgetting a move for a TM', () => {
  const tm: TmOffer = { kind: 'tm', id: 'iceBeam', level: 1, source: 'boss', price: 0 }

  it('is needed only with every slot taken (or a second manual move)', () => {
    expect(needsForget(SIX.slice(0, MAX_MOVES - 1), 'iceBeam')).toBe(false)
    expect(needsForget(SIX, 'iceBeam')).toBe(true)
    expect(needsForget([...SIX.slice(0, 5), owned('iceBeam')], 'iceBeam')).toBe(false)
    expect(needsForget([owned('quickAttack')], 'uTurn')).toBe(true)
  })

  it('offers every move plus "keep them"', () => {
    const choice = forgetChoice(SIX, tm)
    expect(choice.map((o) => (o.kind === 'forget' ? o.id : o.kind))).toEqual([...SIX.map((m) => m.id), 'pass'])
  })

  it('only offers the manual move when the TM is manual too', () => {
    const choice = forgetChoice([owned('waterGun'), owned('quickAttack')], { ...tm, id: 'uTurn' })
    expect(choice.map((o) => (o.kind === 'forget' ? o.id : o.kind))).toEqual(['quickAttack', 'pass'])
  })
})

describe('the Move Tutor', () => {
  const loadout = { starter: 'squirtle', branch: null, types: ['water'], moves: [owned('waterGun'), owned('iceBeam')] } as const

  it('teaches moves that suit the form, never one its family learns anyway', () => {
    const grovyle = { starter: 'treecko', branch: null, types: ['grass'], moves: [owned('leafBlade')] } as const
    const pool = tutorPool(grovyle)
    const learnset = runLearnset('treecko', null)
    const suits = tutorTypes(['grass'])
    for (const id of pool) expect([id, suits.has(MOVES[id].type) && !learnset.includes(id)]).toEqual([id, true])
    for (const type of ['water', 'fire', 'ice', 'electric'] as const) expect(suits.has(type)).toBe(false)
    expect(pool).toEqual(expect.arrayContaining(['uTurn', 'sludgeBomb', 'earthquake']))
    expect(tutorPool(loadout)).toContain('rockSlide')
    for (const id of ['whirlwind', 'firePledge', 'dreamEater'] as const) expect(tutorPool(loadout)).not.toContain(id)
    // No evolved move, no signature only its Pokémon learns.
    expect(tutorPool(loadout)).not.toContain('stoneEdge')
    expect(pool).not.toContain('leechSeed')
  })

  it('has two moves of different types for every form, from its first move', () => {
    for (const id of Object.keys(PLAYABLE) as PlayableId[]) {
      const branches = [null, ...(Object.keys(BRANCHES) as BranchId[]).filter((b) => BRANCHES[b].line === id)]
      for (const branch of branches)
        for (const form of formLine(id, branch)) {
          const pool = tutorPool({ starter: id, branch, types: form.types, moves: [owned(PLAYABLE[id].signature)] })
          expect([form.name, tutorPicks(pool, createRng(1)).length]).toEqual([form.name, TUTOR.offers])
        }
    }
  })

  it('leaves out forgotten moves and a second manual move', () => {
    expect(tutorPool({ ...loadout, banished: new Set(['rockSlide'] as const) })).not.toContain('rockSlide')
    expect(tutorPool({ ...loadout, moves: [...loadout.moves, owned('quickAttack')] })).not.toContain('selfDestruct')
  })

  it('draws moves of different types, the same for the same seed', () => {
    const pool = tutorPool(loadout)
    const a = tutorPicks(pool, createRng(5))
    expect(a).toHaveLength(TUTOR.offers)
    expect(MOVES[a[0]!].type).not.toBe(MOVES[a[1]!].type)
    expect(tutorPicks(pool, createRng(5))).toEqual(a)
  })

  it('shows up once early and maybe once more, and charges after the free lesson', () => {
    expect(tutorWeight(0, TUTOR.first.from - 1)).toBe(0)
    expect(tutorWeight(0, 200)).toBeGreaterThan(0)
    expect(tutorWeight(1, 200)).toBe(0)
    expect(tutorWeight(1, 400)).toBeGreaterThan(0)
    expect(tutorWeight(2, 400)).toBe(0)
    expect(tutorPrice(0)).toBe(0)
    expect(tutorPrice(1)).toBe(TUTOR.price)
  })
})

describe('TMs in a run', () => {
  it('replace a forgotten move when the slots are full: card, then the move to forget', () => {
    const g = run()
    g.player.moves = SIX.map((m) => ({ ...m }))
    dropTm(g, g.player.x, g.player.y, 'iceBeam', 'boss')
    collectTm(g, g.pickups.find((k) => k.kind === 'tm')! as Extract<Game['pickups'][number], { kind: 'tm' }>)
    expect(g.phase).toBe('tm')
    chooseOffer(g, g.player.offers[0]!)
    expect(g.phase).toBe('tm')
    expect(g.player.offers.filter((o) => o.kind === 'forget')).toHaveLength(MAX_MOVES)
    chooseOffer(g, g.player.offers.find((o) => o.kind === 'forget' && o.id === 'gust')!)
    expect(g.phase).toBe('playing')
    expect(g.player.moves.map((m) => m.id)).toEqual(['waterGun', 'whirlpool', 'swift', 'thunder', 'sludgeBomb', 'iceBeam'])
    expect(g.events.some((e) => e.kind === 'tmLearned' && e.forgot === 'gust')).toBe(true)
  })

  it('keep the moves on a pass', () => {
    const g = run()
    g.player.moves = SIX.map((m) => ({ ...m }))
    dropTm(g, 0, 0, 'yawn', 'boss')
    collectTm(g, g.pickups[g.pickups.length - 1]! as Extract<Game['pickups'][number], { kind: 'tm' }>)
    chooseOffer(g, g.player.offers[0]!)
    chooseOffer(g, g.player.offers.find((o) => o.kind === 'pass')!)
    expect(g.phase).toBe('playing')
    expect(g.player.moves.map((m) => m.id)).toEqual(SIX.map((m) => m.id))
  })

  it('drop from a defeated wave boss, its own move', () => {
    const g = run()
    killEnemy(g, spawnEnemy(g, 'onix', 40, 0))
    expect(g.pickups.find((k) => k.kind === 'tm')).toMatchObject({ move: BOSS_TMS.onix, source: 'boss' })
  })

  it('turn a mastered move’s disc into ₽', () => {
    const g = run()
    g.player.moves.push(owned('yawn', maxMoveLevel('yawn')))
    const before = g.coins
    dropTm(g, 0, 0, 'yawn', 'boss')
    collectTm(g, g.pickups[g.pickups.length - 1]! as Extract<Game['pickups'][number], { kind: 'tm' }>)
    expect(g.phase).toBe('playing')
    expect(g.coins).toBeGreaterThan(before)
  })

  it('learn at most one legendary TM per run', () => {
    const g = run()
    dropLegendaryTm(g, 'lugia', 0, 0)
    collectTm(g, g.pickups.find((k) => k.kind === 'tm')! as Extract<Game['pickups'][number], { kind: 'tm' }>)
    g.pickups.length = 0
    chooseOffer(g, g.player.offers[0]!)
    expect(g.player.tm.legendary).toBe(true)
    dropLegendaryTm(g, 'kyogre', 0, 0)
    expect(g.pickups.some((k) => k.kind === 'tm')).toBe(false)
  })

  it('leave a Rare Candy where the player already knows the legendary move (a legend beating its clone)', () => {
    const g = startGame({ ...START, starter: 'mew' })
    dropLegendaryTm(g, 'mew', 0, 0)
    expect(g.pickups.some((k) => k.kind === 'tm')).toBe(false)
    expect(g.pickups.some((k) => k.kind === 'consumable' && k.item === 'rareCandy')).toBe(true)
  })

  it('teach again a move a duo fusion spent, and it grows again (Suicune’s Aurora Beam after Freeze-Dry)', () => {
    const g = run()
    g.player.moves = [owned('auroraBeam', maxMoveLevel('auroraBeam')), owned('waterGun', maxMoveLevel('waterGun'))]
    applyOffer(g, { kind: 'duo', from: ['auroraBeam', 'waterGun'], to: 'freezeDry' })
    expect(g.player.banished.has('auroraBeam')).toBe(true)
    killEnemy(g, spawnEnemy(g, 'suicune', 40, 0))
    collectTm(g, g.pickups.find((k) => k.kind === 'tm')! as Extract<Game['pickups'][number], { kind: 'tm' }>)
    chooseOffer(g, g.player.offers.find((o) => o.kind === 'tm' && o.id === 'auroraBeam')!)
    expect(g.player.moves.find((m) => m.id === 'auroraBeam')?.level).toBe(1)
    expect(offerPool(loadout(g)).some(([o]) => o.kind === 'move' && o.id === 'auroraBeam' && o.level === 2)).toBe(true)
    // The fused partner stays spent.
    expect(g.player.banished.has('waterGun')).toBe(true)
  })

  it('charge a tutor lesson from the run’s ₽, and ignore one the player can’t pay', () => {
    const g = run()
    g.player.tm.lessons = 1
    g.coins = 10
    expect(openTutor(g)).toBe(true)
    const card = g.player.offers[0]!
    chooseOffer(g, card)
    expect(g.phase).toBe('tm')
    g.coins = 1000
    chooseOffer(g, card)
    expect(g.phase).toBe('playing')
    expect(g.coins).toBe(1000 - TUTOR.price)
    expect(g.player.tm.lessons).toBe(2)
  })
})

describe('TM picks in a replay', () => {
  /** A run with six moves and two TM discs at the player's feet: both open, one after the other. */
  const staged = () => {
    const g = startGame(START)
    chooseOffer(g, g.player.offers[0]!)
    g.player.moves = SIX.map((m) => ({ ...m }))
    dropTm(g, g.player.x, g.player.y, 'discharge', 'boss')
    dropTm(g, g.player.x + 2, g.player.y, 'heatWave', 'boss')
    return g
  }

  it('re-simulate to the same run, forgetting included', () => {
    const g = staged()
    const rec = startRecording(START)
    const bot = createRng(9)
    let angle = 0
    while (g.time < 30 && g.phase !== 'gameover') {
      if (g.phase !== 'playing' && g.phase !== 'evolving') {
        // Learn, forgetting the first move offered; level-ups pick at random.
        const forgets = g.player.offers.flatMap((o, i) => (o.kind === 'forget' ? [i] : []))
        const i = g.phase === 'tm' ? (forgets[0] ?? 0) : Math.floor(bot() * g.player.offers.length)
        recordEvent(rec, ['offer', i])
        chooseOffer(g, g.player.offers[i]!)
        continue
      }
      angle += (bot() - 0.5) * 0.3
      step(g, { move: recordStep(rec, START.view, { x: Math.cos(angle), y: Math.sin(angle) }), special: false }, TICK)
    }
    expect(g.player.moves.map((m) => m.id)).toContain('discharge')
    expect(g.player.moves.map((m) => m.id)).toContain('heatWave')
    const again = staged()
    const end = resimulate(rec.replay, again)
    expect(end).toMatchObject({ time: g.time, kills: g.kills, level: g.player.level })
    expect(again.player.moves.map((m) => m.id)).toEqual(g.player.moves.map((m) => m.id))
  })
})

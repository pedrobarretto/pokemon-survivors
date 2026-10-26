import { describe, expect, it } from 'vitest'
import { seedFrom } from '../engine/rng'
import * as dm from '../engine/dmath'
import type { Vec } from '../engine/math'
import { banishOffer, chooseOffer, rerollOffers, skipLevelUp, step } from './game'
import { UPGRADE_IDS, UPGRADES, type Ranks } from './meta'
import { recordEvent, recordStep, resimulate, startGame, startRecording, TICK, type ReplayStart } from './replay'
import type { Game } from './types'

/**
 * Golden runs: solo runs played by a small bot, recorded, re-simulated, and
 * fingerprinted where they end. A refactor must land on the same bits (the
 * server re-simulates ranked runs, and co-op will lean on it); a change of the
 * rules changes these, and bumps `RULES_VERSION` with them.
 */

const MAX_RANKS = Object.fromEntries(UPGRADE_IDS.map((id) => [id, UPGRADES[id].maxRank])) as Ranks

/** The pick screen's cards (the bot reads them to pick by index, like a tap). */
const offersOf = (g: Game) => g.player.offers

/** Away from the foes close by, toward the nearest candy, drifting in a slow circle. */
const steer = (g: Game, t: number): Vec => {
  const p = g.player
  let x = dm.cos(t / 300) * 0.5
  let y = dm.sin(t / 300) * 0.5
  for (const e of g.enemies) {
    const d2 = dm.sq(p.x - e.x) + dm.sq(p.y - e.y)
    if (d2 > 100 * 100 || d2 < 1) continue
    x += ((p.x - e.x) * 600) / (d2 * dm.hypot(p.x - e.x, p.y - e.y))
    y += ((p.y - e.y) * 600) / (d2 * dm.hypot(p.x - e.x, p.y - e.y))
  }
  const candy = g.pickups.find((k) => dm.sq(k.x - p.x) + dm.sq(k.y - p.y) < 150 * 150)
  if (candy) {
    const d = dm.hypot(candy.x - p.x, candy.y - p.y) || 1
    x += (candy.x - p.x) / d
    y += (candy.y - p.y) / d
  }
  const len = dm.hypot(x, y)
  return len < 0.05 ? { x: 0, y: 0 } : { x: x / len, y: y / len }
}

/** Plays `seconds` like the shell would, recording the replay: picks, rerolls, skips, Esquecer and the buttons. */
const play = (start: ReplayStart, seconds: number) => {
  const view = { ...start.view }
  const g = startGame(start, view)
  const rec = startRecording(start)
  let t = 0
  while (g.time < seconds && g.phase !== 'gameover') {
    t++
    if (g.phase === 'victory') break
    if (g.phase !== 'playing' && g.phase !== 'evolving') {
      const offers = offersOf(g)
      if (g.phase === 'levelup' && t % 11 === 0 && g.player.rerolls > 0) {
        recordEvent(rec, ['reroll'])
        rerollOffers(g)
      } else if (g.phase === 'levelup' && t % 13 === 0 && g.player.banishes > 0) {
        recordEvent(rec, ['banish', t % offers.length])
        banishOffer(g, t % offers.length)
      } else if (g.phase === 'levelup' && t % 29 === 0 && g.player.skips > 0) {
        recordEvent(rec, ['skip'])
        skipLevelUp(g)
      } else {
        recordEvent(rec, ['offer', t % offers.length])
        chooseOffer(g, offers[t % offers.length]!)
      }
      continue
    }
    const special = rec.tick % 97 === 0
    const mega = rec.tick % 400 === 100
    const lunge = rec.tick % 100 === 50
    if (special) recordEvent(rec, ['special'])
    if (mega) recordEvent(rec, ['mega'])
    if (lunge) recordEvent(rec, ['lunge'])
    step(g, { move: recordStep(rec, view, steer(g, rec.tick)), special, mega, lunge }, TICK)
    g.events.length = 0
  }
  return { g, replay: rec.replay }
}

/** FNV-1a over the run's end: clocks, tallies, the player, their moves and items, the horde and the rng's next draws. */
const fingerprint = (g: Game) => {
  const p = g.player
  const parts = [
    g.time, g.now, g.phase, g.kills, g.coins, g.candies, g.nextId,
    p.x, p.y, p.hp, p.level, p.xp, p.stage, p.walked,
    p.moves.map((m) => `${m.id}:${m.level}:${m.path ?? 0}`).join(','),
    p.items.map((i) => `${i.id}:${i.level}`).join(','),
    g.enemies.length, g.enemies.reduce((sum, e) => sum + e.x + e.y + e.hp, 0),
    g.pickups.length, g.attacks.length, g.rift.cleared.join(','),
    g.rng(), g.rng(),
  ]
  return seedFrom(parts.join('|')).toString(16)
}

/** Plays a run (with `more` of the save's run inputs), re-simulates its replay from scratch, and fingerprints both ends (which must agree). */
const golden = (starter: ReplayStart['starter'], seed: number, seconds: number, more: Partial<ReplayStart> = {}) => {
  const start: ReplayStart = { seed, starter, difficulty: 'normal', ranks: MAX_RANKS, shiny: false, luckyEgg: false, outbreak: null, halloween: false, bag: [], view: { w: 480, h: 270 }, ...more }
  const { g, replay } = play(start, seconds)
  const live = `${g.phase}@${Math.round(g.time)}s L${g.player.level} S${g.player.stage} ${g.kills}k ${fingerprint(g)}`
  const again = startGame(start)
  const result = resimulate(replay, again)
  const replayed = `${result.phase}@${Math.round(result.time)}s L${result.level} S${again.player.stage} ${result.kills}k ${fingerprint(again)}`
  return { live, replayed, branch: result.branch }
}

/** A few seconds of simulation each; generous for a loaded CI box. */
const SLOW = 30_000

describe('golden runs', () => {
  it('Eevee: the opening draft, level-ups, rerolls, skips and Esquecer', () => {
    const { live, replayed, branch } = golden('eevee', 41, 180)
    expect(replayed).toBe(live)
    expect([live, branch]).toEqual(['playing@180s L6 S0 249k 39351000', null])
  }, SLOW)

  it('Charmander evolves and picks its Ability', () => {
    const { live, replayed, branch } = golden('charmander', 42, 240)
    expect(replayed).toBe(live)
    expect([live, branch]).toEqual(['playing@240s L12 S1 517k 18418282', null])
  }, SLOW)

  it('Honedge switches stances', () => {
    const { live, replayed, branch } = golden('honedge', 43, 150)
    expect(replayed).toBe(live)
    expect([live, branch]).toEqual(['playing@150s L9 S0 278k 903ee32b', null])
  }, SLOW)

  it('Kyogre in the Legend mode on a haunted night: Pressure, its innate, an awakening, candies and jack-o\'-lanterns', () => {
    const { live, replayed, branch } = golden('kyogre', 44, 240, { halloween: true })
    expect(replayed).toBe(live)
    expect([live, branch]).toEqual(['playing@240s L14 S0 737k 199ebdc8', null])
  }, SLOW)

  it('Bulbasaur with Bag items, armed shop TMs and Bottle Caps', () => {
    const { live, replayed, branch } = golden('bulbasaur', 45, 240, { bag: ['rareCandy', 'luckyEgg', 'xAttack', 'maxRevive'], tms: ['payDay', 'thief'], caps: 2 })
    expect(replayed).toBe(live)
    expect([live, branch]).toEqual(['playing@240s L16 S1 639k c435f29a', null])
  }, SLOW)
})

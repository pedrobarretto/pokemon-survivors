import { dirTo, TAU } from '../engine/math'
import { range } from '../engine/rng'
import { ENEMIES } from '../data/enemies'
import type { SwordId } from '../data/legends'
import { DUEL, SWORD_DUELS, type DuelTest } from '../data/quests'
import { EVENTS } from '../data/waves'
import { phasesOf } from './bossFight'
import { killEnemy } from './combat'
import { burst, shakeScreen } from './effects'
import { despawnEnemy, spawnEnemy } from './enemies'
import { standing } from './players'
import { riftScale } from './rift'
import { roomOf } from './room'
import { clearSpot, footOf } from './terrain'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'

/**
 * The Swords of Justice's duels (`DUEL`, `SWORD_DUELS` in `data/quests.ts`):
 * a run whose seed brings a Sword has it wait in a biome that fits it. Once
 * the player has lingered in one, it shows up ahead and waits; standing in its
 * circle starts the duel: a ring closes around both (the horde kept out of
 * it) and the Sword fights (its phase in `SWORD_PHASES`) while it tests the
 * player: Cobalion's defense (hold out with your HP up), Terrakion's power
 * (beat it in time), Virizion's speed (step on its leaf marks in time).
 * Passing (or knocking it out) catches it (`legendBeaten`); failing sends it
 * away, to wait in a later run.
 */

/** Where the duel is: still to come (`hidden`), the Sword waiting for the player, the duel on, or over. */
export type DuelStage = 'hidden' | 'waiting' | 'dueling' | 'done'

export type DuelState = {
  sword: SwordId
  stage: DuelStage
  /** Seconds the player has spent in a biome that fits the Sword (hidden). */
  dwell: number
  /** The circle's (and then the ring's) center. */
  x: number
  y: number
  /** Seconds left: of the wait, then of the test. */
  left: number
  /** Seconds stood in the circle (it drains outside). */
  stand: number
  /** The Sword's body in the duel (-1 before). */
  body: number
  /** The speed test: marks stepped on, and where the next one waits. */
  marks: number
  mark: { x: number; y: number } | null
}

/** The moments the shell hears of. */
export type DuelMoment = 'waiting' | 'began' | 'mark' | 'passed' | 'failed' | 'left'

export const createDuel = (sword: SwordId): DuelState => ({ sword, stage: 'hidden', dwell: 0, x: 0, y: 0, left: 0, stand: 0, body: -1, marks: 0, mark: null })

const notify = (g: Game, d: DuelState, moment: DuelMoment) => g.events.push({ kind: 'duel', sword: d.sword, moment })

/** The test of `sword`'s duel. */
export const duelTest = (sword: SwordId): DuelTest => SWORD_DUELS[sword].test

/** Whether a wave boss is due within `s` seconds: a duel never starts that close to one. */
const bossSoon = (g: Game, s: number) => {
  for (let i = g.nextEvent; i < EVENTS.length; i++) {
    const e = EVENTS[i]!
    if (e.at - g.time > s) return false
    if (e.kind === 'boss') return true
  }
  return false
}

/** A duel may be offered or start: the open map, no boss or legendary scene, no rift on its way. */
const calm = (g: Game) => roomOf(g) === null && g.bossId === null && g.legendScene === null && g.rift.omen === null && g.rift.portal === null

const show = (g: Game, d: DuelState) => {
  const p = g.player
  const ahead = DUEL.distance[0] + (DUEL.distance[1] - DUEL.distance[0]) / 2
  const spot = clearSpot(g, { x: p.x + p.facing.x * ahead, y: p.y + p.facing.y * ahead }, 30)
  d.x = dm.round(spot.x)
  d.y = dm.round(spot.y)
  d.stage = 'waiting'
  d.left = DUEL.wait
  d.stand = 0
  burst(g, d.x, d.y - 16, { colors: ['#ffffff', '#f8e070', '#c8d8f0'], count: 30, speed: 110, ttl: 0.6 })
  notify(g, d, 'waiting')
}

const begin = (g: Game, d: DuelState) => {
  const def = ENEMIES[d.sword]
  const e = spawnEnemy(g, d.sword, d.x, d.y - 36)
  e.hp = e.maxHp = dm.round(def.hp * riftScale(g.time).hp * DUEL.hp[g.difficulty] * SWORD_DUELS[d.sword].hp)
  e.xp = 0
  d.body = e.id
  g.bossId = e.id
  d.stage = 'dueling'
  d.left = duelTest(d.sword).time
  d.marks = 0
  d.mark = null
  shakeScreen(g, 6, 'team')
  burst(g, d.x, d.y - 10, { colors: ['#ffffff', '#f8e070'], count: 60, speed: 200, ttl: 0.6 })
  notify(g, d, 'began')
}

/** The duel is over: passed (the Sword is caught where it stands) or failed (it leaves). */
const end = (g: Game, d: DuelState, e: Enemy | undefined, passed: boolean) => {
  d.stage = 'done'
  d.mark = null
  if (g.bossId === d.body) g.bossId = null
  if (e && e.dying < 0) {
    if (passed) {
      // Through its last phase at once, so it falls now (`holdsOn`) and its capture plays.
      if (e.fight) e.fight.phase = (phasesOf(e.kind)?.length ?? 1) - 1
      killEnemy(g, e)
    } else {
      burst(g, e.x, e.y - 14, { colors: ['#ffffff', '#c8d8f0'], count: 30, speed: 140, ttl: 0.5 })
      despawnEnemy(e)
    }
  }
  notify(g, d, passed ? 'passed' : 'failed')
}

/** Keeps the player in the ring and the horde out of it. */
const holdRing = (g: Game, d: DuelState, sword: Enemy | undefined) => {
  const r = DUEL.ring
  for (const p of g.players) {
    if (!standing(g, p)) continue
    const dx = p.x - d.x
    const dy = p.y - d.y
    const len = dm.hypot(dx, dy)
    const max = r - footOf(p) - 2
    if (len > max) {
      p.x = d.x + (dx / len) * max
      p.y = d.y + (dy / len) * max
    }
  }
  for (const e of g.enemies) {
    if (e.dying >= 0 || e === sword || e.boss) continue
    const dx = e.x - d.x
    const dy = e.y - d.y
    const len = dm.hypot(dx, dy) || 1
    if (len < r + e.radius) {
      e.x = d.x + (dx / len) * (r + e.radius)
      e.y = d.y + (dy / len) * (r + e.radius)
    }
  }
  if (sword && sword.dying < 0) {
    const dx = sword.x - d.x
    const dy = sword.y - d.y
    const len = dm.hypot(dx, dy)
    if (len > r - 12) {
      sword.x = d.x + (dx / len) * (r - 12)
      sword.y = d.y + (dy / len) * (r - 12)
    }
  }
}

/** The speed test: a leaf mark waits somewhere in the ring, away from the player; stepping on it counts. */
const leafMarks = (g: Game, d: DuelState, marks: number) => {
  const p = g.player
  if (!d.mark) {
    for (let i = 0; i < 8 && !d.mark; i++) {
      const a = range(g.rng, 0, TAU)
      const k = range(g.rng, 0.25, 0.8) * DUEL.ring
      const x = d.x + dm.cos(a) * k
      const y = d.y + dm.sin(a) * k
      if (dm.sq(x - p.x) + dm.sq(y - p.y) > 60 * 60) d.mark = { x: dm.round(x), y: dm.round(y) }
    }
    return false
  }
  const reach = DUEL.mark + footOf(p)
  if (dm.sq(d.mark.x - p.x) + dm.sq(d.mark.y - p.y) > reach * reach) return false
  burst(g, d.mark.x, d.mark.y - 4, { colors: ['#78d850', '#f8f8a0', '#ffffff'], count: 16, speed: 80, ttl: 0.4, gravity: -30 })
  d.marks++
  d.mark = null
  notify(g, d, 'mark')
  return d.marks >= marks
}

/** Every tick on the open map: offers the duel in the right biome, starts it from the circle, and judges its test. */
export const updateDuel = (g: Game, dt: number) => {
  const d = g.quests.duel
  if (!d || d.stage === 'done') return
  const test = duelTest(d.sword)
  if (d.stage === 'hidden') {
    const fits = (SWORD_DUELS[d.sword].biomes as readonly string[]).includes(g.player.biome)
    d.dwell = g.time >= DUEL.from && fits && calm(g) ? d.dwell + dt : 0
    if (d.dwell >= DUEL.dwell && !bossSoon(g, test.time + 15)) show(g, d)
    return
  }
  if (d.stage === 'waiting') {
    d.left -= dt
    const p = g.player
    const inside = standing(g, p) && dm.sq(p.x - d.x) + dm.sq(p.y - d.y) < DUEL.circle * DUEL.circle
    d.stand = inside ? d.stand + dt : Math.max(0, d.stand - dt * 0.5)
    if (d.stand >= DUEL.stand && calm(g) && !bossSoon(g, test.time + 8)) return begin(g, d)
    if (d.left > 0) return
    d.stage = 'done'
    burst(g, d.x, d.y - 16, { colors: ['#ffffff', '#c8d8f0'], count: 24, speed: 100, ttl: 0.5 })
    return notify(g, d, 'left')
  }
  const sword = g.enemies.find((e) => e.id === d.body)
  // Knocked out (or gone): it passes any test.
  if (!sword || sword.dying >= 0) return end(g, d, sword, true)
  d.left -= dt
  holdRing(g, d, sword)
  if (test.kind === 'endure') {
    if (g.player.hp < g.player.stats.maxHp * test.floor) return end(g, d, sword, false)
    if (d.left <= 0) return end(g, d, sword, true)
    return
  }
  if (test.kind === 'speed' && leafMarks(g, d, test.marks)) return end(g, d, sword, true)
  if (d.left <= 0) end(g, d, sword, false)
}

/** Which way the waiting Sword looks: at the player. */
export const duelFacing = (g: Game, d: DuelState) => dirTo(d.x, d.y, g.player.x, g.player.y)

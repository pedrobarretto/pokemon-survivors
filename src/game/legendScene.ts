import { retain } from '../engine/math'
import { isWaveLegend, WAVE_LEGEND_HP, WAVE_LEGEND_SHINY } from '../data/legendBosses'
import type { EnemyId } from '../data/enemies'
import { burst, shakeScreen, updateEffects } from './effects'
import { despawnEnemy } from './enemies'
import { centerScreen } from './players'
import { rollShiny } from './shiny'
import { winRun } from './coop'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'

/**
 * The wave legendaries' moments on the map (`data/legendBosses.ts`), played
 * with the world held still like a Mega Evolution:
 *
 * - The entrance: the camera travels to the legendary as it arrives (down from
 *   the sky, leaping in, out of the ground or thin air, `ARRIVAL`), it shows
 *   itself with a flash, its cry and its title card ("ZAPDOS · Senhor do
 *   Trovão"), and the camera comes back. A second legendary arriving meanwhile
 *   (the mythical with Mewtwo) waits its turn.
 * - The capture: where it fell a Poké Ball flies, takes it in, shakes three
 *   times and clicks or breaks open (the shell decides, `render/capture.ts`).
 *   It's short (`LIGHT_CAPTURE`) so the horde isn't held for long, and the
 *   field's hazards go with the legendary, so the player comes back to a fair
 *   fight. Mewtwo's victory waits for it.
 */

/** The entrance, in seconds: settle, the camera's trip, the arrival, the hold on the title card, the trip back. */
export const ENTRANCE = { settle: 0.2, pan: 0.7, arrive: 0.8, hold: 1.2, back: 0.5 } as const
/** When the legendary shows itself (its cry, the flash, the title card). */
export const ENTRANCE_REVEAL = ENTRANCE.settle + ENTRANCE.pan + ENTRANCE.arrive
export const ENTRANCE_LENGTH = ENTRANCE_REVEAL + ENTRANCE.hold + ENTRANCE.back

/** The quick capture on the map (the domain's `CAPTURE`, about half as long): the ball settles at `settle`, the world moves on at `length`. */
export const LIGHT_CAPTURE = { kneel: 0.3, throw: 0.4, absorb: 0.3, drop: 0.25, shakes: 3, shake: 0.35, settle: 2.3, length: 2.9 } as const

export type LegendCapture = { kind: EnemyId; x: number; y: number; shiny: boolean; settled: boolean }

/**
 * A legendary's scene on the map: its `entrance` (the boss `bossId` already in
 * play, hidden until it shows) or its `capture`, `t` s in. `next` are the
 * legendaries whose entrances wait; `then` is what comes after (Mewtwo's
 * victory).
 */
export type LegendScene = {
  kind: 'entrance' | 'capture'
  enemy: EnemyId
  bossId: number
  t: number
  capture: LegendCapture | null
  next: number[]
  then: 'victory' | null
}

const smooth = (k: number) => {
  const c = Math.min(1, Math.max(0, k))
  return c * c * (3 - 2 * c)
}

/** Where an entrance is at `t` s: how far the camera has gone to the legendary (0..1) and how far its arrival has played (0..1). */
export const entranceBeat = (t: number) => {
  const travel = smooth((t - ENTRANCE.settle) / ENTRANCE.pan)
  const back = smooth((t - ENTRANCE_REVEAL - ENTRANCE.hold) / ENTRANCE.back)
  return { camera: travel * (1 - back), arrive: Math.min(1, Math.max(0, (t - ENTRANCE.settle - ENTRANCE.pan) / ENTRANCE.arrive)) }
}

/** A wave legendary just came into play: it takes its HP (`WAVE_LEGEND_HP`), may be shiny (`WAVE_LEGEND_SHINY`) and its entrance plays now, or after the one playing. */
export const legendEntrance = (g: Game, boss: Enemy) => {
  if (!isWaveLegend(boss.kind)) return
  boss.hp = boss.maxHp = dm.round(boss.maxHp * WAVE_LEGEND_HP)
  boss.shiny = rollShiny(g.rng, WAVE_LEGEND_SHINY)
  const s = g.legendScene
  if (s) {
    s.next.push(boss.id)
    return
  }
  g.legendScene = { kind: 'entrance', enemy: boss.kind, bossId: boss.id, t: 0, capture: null, next: [], then: null }
}

/**
 * A wave legendary fell on the map (`killEnemy`): its capture plays where it
 * knelt, it leaves play and so do the hazards on the field. True when it did.
 */
export const legendFell = (g: Game, e: Enemy) => {
  if (!isWaveLegend(e.kind) || g.rift.arena) return false
  const waiting = g.legendScene?.next ?? []
  g.legendScene = { kind: 'capture', enemy: e.kind, bossId: e.id, t: 0, capture: { kind: e.kind, x: e.x, y: e.y, shiny: e.shiny, settled: false }, next: waiting, then: null }
  despawnEnemy(e)
  retain(g.hazards, (h) => h.world)
  return true
}

/** The boss a scene keeps off the field for now (drawn by the scene itself), or -1. */
export const sceneHides = (g: Game) => {
  const s = g.legendScene
  if (!s) return -1
  return s.kind === 'capture' || s.t < ENTRANCE_REVEAL ? s.bossId : -1
}

/** The scene is over: the next entrance waiting, or what it was holding (Mewtwo's victory). */
const finish = (g: Game, s: LegendScene) => {
  g.legendScene = null
  if (s.then === 'victory') return winRun(g)
  for (const id of s.next) {
    const boss = g.enemies.find((e) => e.id === id && e.dying < 0)
    if (!boss) continue
    g.legendScene = { kind: 'entrance', enemy: boss.kind, bossId: boss.id, t: 0, capture: null, next: s.next.filter((n) => n !== id), then: null }
    return
  }
}

/**
 * Plays a legendary's scene with the world held still (the step waits on it):
 * it moves every player's screen itself (each from where they stand) and
 * keeps the particles going. True while one plays.
 */
export const updateLegendScene = (g: Game, dt: number) => {
  const s = g.legendScene
  if (!s) return false
  const before = s.t
  s.t += dt
  updateEffects(g, dt)
  g.flash = Math.max(0, g.flash - dt * 1.5)
  if (s.kind === 'entrance') {
    const boss = g.enemies.find((e) => e.id === s.bossId)
    if (!boss || boss.dying >= 0) {
      finish(g, s)
      return true
    }
    const beat = entranceBeat(s.t)
    if (beat.arrive > 0 && beat.arrive < 1) shakeScreen(g, 1 + beat.arrive * 4, 'team')
    if (before < ENTRANCE_REVEAL && s.t >= ENTRANCE_REVEAL) {
      // A light flash: the shell flashes the screen too, and the title card shows through it.
      g.flash = 0.4
      shakeScreen(g, 10, 'team')
      burst(g, boss.x, boss.y - boss.radius, { colors: ['#ffffff', '#f8f0a0', '#c8d8f8'], count: 70, speed: 200, ttl: 0.6, size: 2, drag: 3 })
      g.events.push({ kind: 'legendTitle', enemy: s.enemy, shiny: boss.shiny })
    }
    for (const p of g.players) centerScreen(g, p, p.x + (boss.x - p.x) * beat.camera, p.y + (boss.y - p.y) * beat.camera)
    if (s.t >= ENTRANCE_LENGTH) finish(g, s)
    return true
  }
  const c = s.capture!
  // Halfway between the player and the ball (the throw starts at the player), easing back on the player at the end.
  const back = smooth((s.t - (LIGHT_CAPTURE.length - 0.4)) / 0.4)
  const k = 0.5 * (1 - back)
  for (const p of g.players) centerScreen(g, p, p.x + (c.x - p.x) * k, p.y + (c.y - 20 - p.y) * k)
  if (before < LIGHT_CAPTURE.settle && s.t >= LIGHT_CAPTURE.settle) {
    c.settled = true
    g.events.push({ kind: 'bossCapture', enemy: c.kind, shiny: c.shiny })
  }
  if (s.t >= LIGHT_CAPTURE.length) finish(g, s)
  return true
}

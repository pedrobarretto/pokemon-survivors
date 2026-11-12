import { TAU } from '../engine/math'
import { range } from '../engine/rng'
import { ENEMIES } from '../data/enemies'
import { WAVE_LEGEND_HP } from '../data/legendBosses'
import { ZERAORA } from '../data/mythicals'
import { EVENTS } from '../data/waves'
import { spawnHazard } from './bosses'
import { burst, shakeScreen } from './effects'
import { harmBy } from './harm'
import { teamLegend } from './legend'
import { momentBusy } from './legendMoments'
import { standing } from './players'
import { riftScale } from './rift'
import { roomOf } from './room'
import { spawnWaveBoss } from './spawner'
import { clearSpot } from './terrain'
import type { Game } from './types'
import { callWeather, weatherHere } from './weather'
import * as dm from '../engine/dmath'

/**
 * Zeraora's storm (`ZERAORA` in `data/mythicals.ts`): a run whose seed
 * brings it waits for the player in the Power Plant while it rains. Once
 * they've lingered there, the storm gathers (the sky darkens, bolts fall
 * around them, `stage: 'gathering'`) and Zeraora leaps out of a thunderbolt
 * ahead: a wave legendary's entrance and three phases (`ZERAORA_PHASES`),
 * fought under a thunderstorm that holds the rain and drops lightning on the
 * field. Knocked out, it's caught where it fell (`legendFell`); chased off
 * by the next wave boss, it's gone for the run. Solo only, on the open map,
 * like the other legends met there (`updateQuests`, `COOP_LOCKS`), and never
 * for a Zeraora's own run.
 */

/** Where the storm is: waiting for the player, gathering, Zeraora fighting, or over. */
export type StormStage = 'hidden' | 'gathering' | 'fight' | 'done'

export type StormState = {
  stage: StormStage
  /** Seconds the player has spent in the rainy Power Plant (hidden), then of the gathering. */
  t: number
  /** Zeraora's body (-1 before it comes). */
  body: number
  /** Seconds to the storm's next bolts while it fights. */
  bolt: number
  /** Where Zeraora lands, picked as the storm gathers. */
  x: number
  y: number
}

export const createStorm = (): StormState => ({ stage: 'hidden', t: 0, body: -1, bolt: 0, x: 0, y: 0 })

/** Whether the storm is under way (gathering or fighting), for `momentBusy` and the sky. */
export const stormUnderWay = (s: StormState | null) => s !== null && (s.stage === 'gathering' || s.stage === 'fight')

/** Whether a wave boss is due within `s` seconds: the storm never gathers that close to one (it would chase Zeraora off). */
const bossSoon = (g: Game, s: number) => {
  for (let i = g.nextEvent; i < EVENTS.length; i++) {
    const e = EVENTS[i]!
    if (e.at - g.time > s) return false
    if (e.kind === 'boss') return true
  }
  return false
}

/** The storm may gather: the open map, no boss or scene, no other legend moment under way, and no Zeraora of the player's own. */
const calm = (g: Game) => roomOf(g) === null && g.bossId === null && g.legendScene === null && !momentBusy(g, 'storm') && teamLegend(g)?.id !== 'zeraora'

/** Lightning on each standing player's path: `count` bolts each, landing a beat after they show. */
const bolts = (g: Game, count: number, damage: number) => {
  const b = ZERAORA.bolt
  for (const p of g.players) {
    if (!standing(g, p)) continue
    for (let i = 0; i < count; i++) {
      const a = range(g.rng, 0, TAU)
      const d = range(g.rng, 18, b.spread)
      spawnHazard(g, {
        // A gathering bolt (no damage) only shows: it never arms.
        kind: 'strike', visual: 'thunder', r: b.radius, damage, armAt: b.delay, disarmAt: damage > 0 ? b.delay + 0.12 : b.delay, ttl: b.delay + 0.35,
        x: p.x + p.vx * b.delay * 0.6 + dm.cos(a) * d, y: p.y + p.vy * b.delay * 0.6 + dm.sin(a) * d * 0.8, by: harmBy('zeraora', 'Thunder'),
      })
    }
  }
}

/** Keeps the rain over the fight: the storm calls it back for a while whenever the schedule moves on. */
const holdRain = (g: Game) => {
  if (g.weather.id !== 'rain' || g.weather.next - g.time < 8) callWeather(g, 'rain', 20)
}

/** Zeraora leaps out of the storm: a wave legendary's entrance, its HP from the run clock and the difficulty. */
const strike = (g: Game, s: StormState) => {
  const boss = spawnWaveBoss(g, 'zeraora', g.time, false, { x: s.x, y: s.y })
  boss.hp = boss.maxHp = dm.round(ENEMIES.zeraora.hp * riftScale(g.time).hp * ZERAORA.hp[g.difficulty] * WAVE_LEGEND_HP)
  boss.xp = 0
  s.body = boss.id
  s.stage = 'fight'
  s.bolt = ZERAORA.bolt.every
  g.flash = Math.max(g.flash, 0.5)
  shakeScreen(g, 10, 'team')
  burst(g, s.x, s.y - 20, { colors: ['#ffffff', '#f8e050', '#58a8f8'], count: 80, speed: 220, ttl: 0.6, size: 2, drag: 3 })
}

/** Every tick on the open map (solo): waits for the rainy Power Plant, gathers the storm, then runs it while Zeraora fights. */
export const updateStorm = (g: Game, dt: number) => {
  const s = g.quests.storm
  if (!s || s.stage === 'done') return
  const p = g.player
  if (s.stage === 'hidden') {
    if (g.time > ZERAORA.until) {
      s.stage = 'done'
      return
    }
    const fits = g.time >= ZERAORA.from && p.biome === 'plant' && weatherHere(g) === 'rain'
    s.t = fits && calm(g) ? s.t + dt : 0
    if (s.t < ZERAORA.dwell || bossSoon(g, 50)) return
    const ahead = { x: p.x + p.facing.x * ZERAORA.distance, y: p.y + p.facing.y * ZERAORA.distance }
    const spot = clearSpot(g, ahead, 30)
    s.x = dm.round(spot.x)
    s.y = dm.round(spot.y)
    s.stage = 'gathering'
    s.t = 0
    holdRain(g)
    g.events.push({ kind: 'storm', moment: 'gathering' })
    return
  }
  if (s.stage === 'gathering') {
    const before = s.t
    s.t += dt
    shakeScreen(g, 1 + s.t, 'team')
    // The storm gathers: bolts around the player, a beat apart, a flash with each, the last one where Zeraora lands.
    if (Math.floor(before / 0.8) !== Math.floor(s.t / 0.8)) {
      bolts(g, 1, 0)
      g.flash = Math.max(g.flash, 0.2)
    }
    if (s.t >= ZERAORA.gather) strike(g, s)
    return
  }
  const boss = g.enemies.find((e) => e.id === s.body)
  if (!boss || boss.dying >= 0) {
    s.stage = 'done'
    // Knocked out, its capture plays (`legendFell`); chased off by a wave boss, it's gone.
    if (!boss || boss.fled) g.events.push({ kind: 'storm', moment: 'fled' })
    return
  }
  holdRain(g)
  if (g.legendScene) return
  s.bolt -= dt
  if (s.bolt > 0) return
  s.bolt = ZERAORA.bolt.every
  bolts(g, ZERAORA.bolt.count, ZERAORA.bolt.damage)
}

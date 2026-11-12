import { RUINS, RUINS_SIDES } from '../data/forces'
import { RUINS_LEGENDS, type RuinsRegi } from '../data/legends'
import { burst, shakeScreen } from './effects'
import { teamLegend } from './legend'
import { momentBusy } from './legendMoments'
import type { MapEventDef } from './mapEvents'
import { playerWithin } from './players'
import { spawnWaveBoss } from './spawner'
import type { Game } from './types'
import * as dm from '../engine/dmath'

/**
 * The Ruínas da Decisão (Crown Tundra's Split-Decision Ruins, `RUINS` in
 * `data/forces.ts`): a run of Regigigas's captor may bring them in its
 * temple's place, two ruins side by side, Regieleki's to the west and
 * Regidrago's to the east (`ReplayStart.ruins`, the ones still free). They
 * rise ahead of the player like the temple; walking into one's gate picks it:
 * the other sinks back into the ground until another run, and the chosen one
 * shakes, its marks light, and its Regi steps out as a wave legendary
 * (`data/legendBosses.ts`), captured where it falls. A Regi already caught
 * leaves its ruin dark and shut. Solo, on the open map (the paths'
 * `COOP_LOCKS`), and none of it moves the run's rng.
 */

/**
 * The Ruins on the map: the Regis still free in them, the one picked (null
 * before), the seconds since the pick (-1 before), whether the Regi is out,
 * and whether they told of the boss still there.
 */
export type RuinsEvent = { free: readonly RuinsRegi[]; pick: RuinsRegi | null; waking: number; out: boolean; told: boolean }

/** Seconds from the pick to the Regi stepping out (the temple's beat). */
export const RUINS_WAKE = 1.8

/** Seconds the ruin left out takes to sink back into the ground. */
export const RUINS_SINK = 1.6

/** Seconds the empty ruins stand once the Regi is out, before they settle back into the ground. */
const RUINS_STAY = 180

/** Where a Regi's ruin stands, from the Ruins' middle. */
export const ruinSpot = (ev: { x: number; y: number }, regi: RuinsRegi) => ({ x: ev.x + RUINS_SIDES[regi].side * (RUINS.apart / 2), y: ev.y })

/** A ruin's threshold, the ring on the ground in front of its gate that wakes its Regi. */
export const ruinThreshold = (ev: { x: number; y: number }, regi: RuinsRegi) => {
  const at = ruinSpot(ev, regi)
  return { x: at.x, y: at.y + RUINS.front }
}

/** The Regis free in the Ruins of a run's start: known ones, once each, in the Ruins' order. */
export const parseRuins = (raw: unknown): RuinsRegi[] => (Array.isArray(raw) ? RUINS_LEGENDS.filter((r) => raw.includes(r)) : [])

/** What the Ruins tell the shell (`PathNotice`): risen (`free` still asleep), quiet while a boss fights, a ruin picked (the other `sealed`, null when it was the last free). */
export type RuinsNotice = { kind: 'ruins'; moment: 'risen'; free: readonly RuinsRegi[] } | { kind: 'ruins'; moment: 'silent' } | { kind: 'ruins'; moment: 'chosen'; pick: RuinsRegi; sealed: RuinsRegi | null }

const notify = (g: Game, notice: RuinsNotice) => g.events.push({ kind: 'path', notice })

export const SPLIT_RUINS_EVENT: MapEventDef<'splitRuins'> = {
  spawn: { from: RUINS.at[0], weight: () => 0, max: 1, lifetime: 600, distance: [RUINS.distance, RUINS.distance + 40] },
  marker: true,
  create: (g) => ({ free: [...g.paths.ruinsFree], pick: null, waking: -1, out: false, told: false }),
  enter: (g, ev) => notify(g, { kind: 'ruins', moment: 'risen', free: ev.state.free }),
  update: (g, ev, dt) => {
    const s = ev.state
    if (s.out) return
    ev.ttl = Math.max(ev.ttl, ev.age + 1)
    if (ev.age < RUINS.rise) {
      shakeScreen(g, 2, ev)
      if (ev.age + dt >= RUINS.rise) burst(g, ev.x, ev.y - 6, { colors: ['#d8d0c0', '#a8a090', '#f8f0e0'], count: 50, speed: 100, ttl: 0.8, gravity: 40 })
      return
    }
    if (s.pick === null) {
      const pick = s.free.find((regi) => {
        const at = ruinThreshold(ev, regi)
        return playerWithin(g, at.x, at.y, RUINS.wake, true) !== null
      })
      if (!pick) return
      // Another boss on the field (or a rift, a den, a Sword's duel under way) keeps them asleep: they wake once that's over.
      if (g.bossId !== null || teamLegend(g)?.id === pick || momentBusy(g, 'ruins', ['roam'])) {
        if (!s.told) notify(g, { kind: 'ruins', moment: 'silent' })
        s.told = true
        return
      }
      s.pick = pick
      s.waking = 0
      const sealed = s.free.find((r) => r !== pick) ?? null
      const at = ruinSpot(ev, pick)
      burst(g, at.x, at.y - 20, { colors: [...RUINS_SIDES[pick].light], count: 40, speed: 120, ttl: 0.7 })
      notify(g, { kind: 'ruins', moment: 'chosen', pick, sealed })
      return
    }
    s.waking += dt
    shakeScreen(g, 1 + s.waking * 2, ev)
    if (s.waking < RUINS_WAKE) return
    const at = ruinSpot(ev, s.pick)
    burst(g, at.x, at.y - 16, { colors: ['#f0e8d0', ...RUINS_SIDES[s.pick].light], count: 70, speed: 160, ttl: 0.9, size: 2 })
    // The Regi rises in its gate, between its ruin and the threshold; the ruins stand behind it, then settle back in a while later.
    spawnWaveBoss(g, s.pick, g.time, false, { x: dm.round(at.x), y: dm.round(at.y + 4) })
    s.out = true
    ev.ttl = ev.age + RUINS_STAY
  },
}

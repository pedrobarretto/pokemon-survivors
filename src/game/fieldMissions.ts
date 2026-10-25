import { dir8, TAU, type Dir8, type Vec } from '../engine/math'
import { chance, pick, range, weightedPick } from '../engine/rng'
import { query } from '../engine/spatial'
import { DROP_TABLES, rollDrop } from '../data/consumables'
import { stageIndexAt } from '../data/waves'
import { healPlayer } from './combat'
import { dropItem } from './consumables'
import { spawnEnemy } from './enemies'
import { burst, floatText, shakeScreen } from './effects'
import {
  BALLS, ballSpots, clearOfBosses, defenseProgress, ESCORT, FIELD, FIELD_TUNING, followStep, freshKinds,
  FIELD_MISSION_KINDS, missionCoins, NEST, nextMissionAt, type FieldMissionKind, type FieldTuning,
} from './fieldMissionRules'
import { makeElite } from './horde'
import { openTeamPrize } from './leveling'
import { DIRECTOR, spawnSpot } from './mapEventRules'
import type { MapEvent, MapEventDef, MapEventNotice, MapEventOf } from './mapEvents'
import { COIN_VALUES } from './meta'
import { awardEgg, dropCoins } from './pickups'
import { isAlive } from './queries'
import { countNotice } from './tally'
import { clearSpot } from './terrain'
import { anchorPlayer, nearestPlayer, playerWithin } from './players'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'

/**
 * Field missions: timed goals the missions' director places 350–600 px from
 * the player every couple of minutes, one at a time. Ignoring one costs
 * nothing; finishing it pays a lucky level-up (all rare cards, the first one
 * shiny on Nightmare), ₽ and the mission's own prize. They're map events
 * (`mapEvents.ts` spreads `FIELD_MISSIONS` in), with their own director
 * (`directMissions`) instead of the regular one's weights.
 *
 * - Defense: an egg in a nest. Standing in the ring for `hold` s saves it,
 *   while raid waves walk to the egg and bite it (`raid` behavior in `enemies.ts`).
 * - Collect: lost Poké Balls scattered around a wide area, against the clock.
 * - Escort: a lost Togepi follows the player when close; lead it to its nest alive.
 */

export type FieldMissionStates = {
  /** `progress` (0..1) fills inside the ring once the raid `started`; `wave` counts down to the next raid wave. */
  defense: { started: boolean; inside: boolean; progress: number; hp: number; wave: number; flash: number }
  collect: { balls: Array<Vec & { got: boolean }>; got: number }
  /** Togepi stands at the event's (x, y); `home` is its nest. */
  escort: { following: boolean; hp: number; home: Vec; dir: Dir8; moving: boolean; flash: number }
}

export type FieldMissionNotice =
  /** A mission was placed: its arrow and the HUD pill show the way. */
  | { kind: 'mission'; mission: FieldMissionKind; balls: number }
  | { kind: 'missionDone'; mission: FieldMissionKind; coins: number; egg: boolean }
  | { kind: 'missionFailed'; mission: FieldMissionKind }
  /** The defense began: the player reached the nest. */
  | { kind: 'nestRaid' }
  | { kind: 'ballFound'; got: number; of: number }
  | { kind: 'togepiJoin' }

/** The missions' director: when the next one may start and the kinds run so far (they rotate). */
export type FieldMissionState = { next: number; done: FieldMissionKind[] }

export const createFieldMissions = (): FieldMissionState => ({ next: clearOfBosses(FIELD.first), done: [] })

export const tuningOf = (g: Game): FieldTuning => FIELD_TUNING[g.difficulty]

const notify = (g: Game, notice: MapEventNotice) => {
  countNotice(g.tally, notice)
  g.events.push({ kind: 'mapEvent', notice })
}

const neighbors: number[] = []

/** Living wild Pokémon within `r` of (x, y) (their body counted), raiders or not. */
const touching = (g: Game, x: number, y: number, r: number) => {
  let n = 0
  for (const i of query(g.grid, x, y, r + 24, neighbors)) {
    const e = g.enemies[i]
    if (e && isAlive(e) && !e.boss && dm.sq(e.x - x) + dm.sq(e.y - y) < dm.sq(r + e.radius)) n++
  }
  return n
}

const raiding = (e: Enemy, id: number) => e.behavior.kind === 'raid' && e.behavior.mission === id

/** Raiders still alive go back to chasing the player with the rest of the horde. */
const releaseRaiders = (g: Game, id: number) => {
  for (const e of g.enemies) if (raiding(e, id)) e.behavior = { kind: 'chase' }
}

/** A ring of the current wave's species around (x, y), `elites` of them elite; `raid` sends them at the nest instead of the player. */
const ambushRing = (g: Game, x: number, y: number, r: number, count: number, elites: number, raid: number | null) => {
  const pool = g.roster.stages[stageIndexAt(g.time)] ?? []
  if (pool.length === 0) return
  const offset = range(g.rng, 0, TAU)
  for (let i = 0; i < count; i++) {
    const a = offset + (i / count) * TAU
    const e = spawnEnemy(g, weightedPick(g.rng, pool), x + dm.cos(a) * r, y + dm.sin(a) * r)
    if (i < elites) makeElite(e)
    if (raid !== null) e.behavior = { kind: 'raid', mission: raid, x, y, aggro: NEST.aggro }
  }
}

/** Pays a finished mission at (x, y): coins on the ground, the lucky level-up, and the defense's egg roll (an Incense raises it). */
const reward = (g: Game, ev: MapEventOf<FieldMissionKind>, x: number, y: number, egg: boolean) => {
  const r = tuningOf(g).reward
  const coins = Array.from({ length: missionCoins(g.time, r) }, () => COIN_VALUES[1])
  dropCoins(g, x, y - 4, coins)
  const before = g.eggs.found.length
  if (egg && chance(g.rng, Math.min(1, r.egg * g.eggs.boost))) awardEgg(g, 'mission', x, y)
  const hatched = g.eggs.found.length > before
  burst(g, x, y - 10, { colors: ['#f8d030', '#fff8c0', '#ffffff', '#78c0f8'], count: 46, speed: 130, ttl: 0.8, gravity: 50 })
  shakeScreen(g, 3, { x, y })
  notify(g, { kind: 'missionDone', mission: ev.kind, coins: coins.reduce((a, b) => a + b, 0), egg: hatched })
  ev.gone = 0
  openTeamPrize(g, 'mission', r.shinyCard)
}

const fail = (g: Game, ev: MapEventOf<FieldMissionKind>) => {
  releaseRaiders(g, ev.id)
  burst(g, ev.x, ev.y - 8, { colors: ['#ffffff', '#c8c8d8', '#686878'], count: 20, speed: 70, ttl: 0.5 })
  notify(g, { kind: 'missionFailed', mission: ev.kind })
}

/** Missions skip the regular director (`from: Infinity`): `directMissions` places them. */
const unscheduled = { from: Infinity, weight: () => 0, max: 1, lifetime: 60, distance: FIELD.distance } as const

/** Whether some player stands within `r` px of (x, y). */
const within = (g: Game, x: number, y: number, r: number) => playerWithin(g, x, y, r) !== null

export const FIELD_MISSIONS: { [K in FieldMissionKind]: MapEventDef<K> } = {
  defense: {
    spawn: unscheduled,
    marker: true,
    create: (g) => ({ started: false, inside: false, progress: 0, hp: tuningOf(g).defense.hp, wave: 0, flash: 0 }),
    enter: (g, ev) => {
      ev.ttl = tuningOf(g).defense.reach
      notify(g, { kind: 'mission', mission: 'defense', balls: 0 })
    },
    update: (g, ev, dt) => {
      const t = tuningOf(g).defense
      const s = ev.state
      s.inside = within(g, ev.x, ev.y, NEST.radius)
      s.flash = Math.max(0, s.flash - dt)
      if (!s.started) {
        if (!s.inside) return
        s.started = true
        // From here on only the egg can end it: abandoned, the raiders break it.
        ev.ttl = Infinity
        notify(g, { kind: 'nestRaid' })
      }
      s.wave -= dt
      if (s.wave <= 0) {
        s.wave = t.every
        let alive = 0
        for (const e of g.enemies) if (isAlive(e) && raiding(e, ev.id)) alive++
        const count = Math.min(t.max - alive, t.raiders + Math.floor((g.time / 60) * t.perMinute))
        if (count > 0) ambushRing(g, ev.x, ev.y, NEST.spawn, count, t.elites, ev.id)
      }
      const biting = touching(g, ev.x, ev.y, NEST.egg)
      if (biting > 0) {
        s.hp -= biting * t.bite * dt
        s.flash = 0.15
      }
      if (s.hp <= 0) {
        ev.gone = 0
        return fail(g, ev)
      }
      s.progress = defenseProgress(s.progress, s.inside, dt, t.hold)
      // The lucky level-up waits for any other screen to close.
      if (s.progress < 1 || g.phase !== 'playing') return
      releaseRaiders(g, ev.id)
      reward(g, ev, ev.x, ev.y, true)
    },
    expire: fail,
  },
  collect: {
    spawn: unscheduled,
    marker: true,
    create: () => ({ balls: [], got: 0 }),
    enter: (g, ev) => {
      // Spread around the center on open ground; the event's own (x, y) is just the area.
      ev.state.balls = ballSpots(g.rng, ev.x, ev.y, tuningOf(g).collect.balls).map((spot) => ({ ...clearSpot(g, spot, 10), got: false }))
      ev.ttl = tuningOf(g).collect.time
      notify(g, { kind: 'mission', mission: 'collect', balls: ev.state.balls.length })
    },
    update: (g, ev) => {
      const t = tuningOf(g).collect
      const s = ev.state
      for (const b of s.balls) {
        if (b.got || playerWithin(g, b.x, b.y, BALLS.reach, true) === null) continue
        b.got = true
        s.got++
        dropCoins(g, b.x, b.y - 4, [COIN_VALUES[0]])
        burst(g, b.x, b.y - 6, { colors: ['#f83838', '#ffffff', '#ffd830'], count: 18, speed: 90, ttl: 0.5 })
        if (s.got < s.balls.length) {
          if (t.guards > 0) ambushRing(g, b.x, b.y, BALLS.guardRing, t.guards, t.eliteGuards ? t.guards : 0, null)
          notify(g, { kind: 'ballFound', got: s.got, of: s.balls.length })
        }
      }
      if (s.got < s.balls.length || g.phase !== 'playing') return
      const p = nearestPlayer(g, ev.x, ev.y)
      reward(g, ev, p.x, p.y, false)
    },
    expire: fail,
  },
  escort: {
    spawn: unscheduled,
    marker: true,
    create: (g) => ({ following: false, hp: tuningOf(g).escort.hp, home: { x: 0, y: 0 }, dir: 0, moving: false, flash: 0 }),
    enter: (g, ev) => {
      // With nothing to keep apart from, the first spot on the ring is taken.
      const spot = spawnSpot(g.rng, ev.x, ev.y, ESCORT.home, [], 0) ?? { x: ev.x + ESCORT.home[0], y: ev.y }
      ev.state.home = clearSpot(g, spot, 16)
      ev.ttl = tuningOf(g).escort.time
      notify(g, { kind: 'mission', mission: 'escort', balls: 0 })
    },
    update: (g, ev, dt) => {
      const t = tuningOf(g).escort
      const s = ev.state
      // Togepi follows the player nearest to it.
      const p = nearestPlayer(g, ev.x, ev.y)
      s.flash = Math.max(0, s.flash - dt)
      if (!s.following && within(g, ev.x, ev.y, ESCORT.leash * 0.6)) {
        s.following = true
        notify(g, { kind: 'togepiJoin' })
      }
      if (s.following) {
        const next = followStep(ev.x, ev.y, p.x, p.y, dt)
        s.moving = next.x !== ev.x || next.y !== ev.y
        if (s.moving) s.dir = dir8(next.x - ev.x, next.y - ev.y)
        ev.x = next.x
        ev.y = next.y
      }
      const hurt = touching(g, ev.x, ev.y, ESCORT.body)
      if (hurt > 0) {
        s.hp -= hurt * t.bite * dt
        s.flash = 0.15
      }
      if (s.hp <= 0) {
        ev.gone = 0
        return fail(g, ev)
      }
      if (dm.sq(ev.x - s.home.x) + dm.sq(ev.y - s.home.y) > dm.sq(ESCORT.arrive) || g.phase !== 'playing') return
      const before = g.player
      for (const q of g.players) {
        g.player = q
        healPlayer(g, q.stats.maxHp * 0.3)
      }
      g.player = before
      floatText(g, s.home.x, s.home.y - 24, '♥', '#f878a8')
      dropItem(g, s.home.x + 10, s.home.y, rollDrop(DROP_TABLES.itemBall, g.time, g.rng))
      reward(g, ev, s.home.x, s.home.y, false)
    },
    expire: fail,
  },
}

export type MissionEvent = Extract<MapEvent, { kind: FieldMissionKind }>

export const isMission = (ev: MapEvent): ev is MissionEvent => FIELD_MISSION_KINDS.some((k) => k === ev.kind)

/** The field mission live on the map, if any (one at a time). The HUD pill reads it. */
export const liveMission = (g: Game) => g.mapEvents.list.find((ev): ev is MissionEvent => ev.gone < 0 && isMission(ev))

/**
 * The missions' director: once `next` comes, places a mission of a kind not
 * run in this cycle, a walk away on open ground. Never in the endless mode,
 * with a portal open, too close to Mewtwo or over another mission.
 * `place` is `spawnMapEvent` (passed in, so this module doesn't import its importer).
 */
export const directMissions = (g: Game, place: (g: Game, kind: FieldMissionKind, x: number, y: number) => void) => {
  const s = g.mapEvents.missions
  if (g.time < s.next || g.time > FIELD.lastStart || g.endless) return
  if (g.rift.portal || liveMission(g)) {
    s.next = g.time + FIELD.retry
    return
  }
  const taken = [...g.mapEvents.list, ...g.props]
  const p = anchorPlayer(g)
  const spot = spawnSpot(g.rng, p.x, p.y, FIELD.distance, taken, DIRECTOR.spacing)
  if (!spot) {
    s.next = g.time + FIELD.retry
    return
  }
  const kind = pick(g.rng, freshKinds(s.done))
  const open = clearSpot(g, spot, 20)
  s.done.push(kind)
  s.next = nextMissionAt(g.time, g.rng())
  place(g, kind, dm.round(open.x), dm.round(open.y))
}

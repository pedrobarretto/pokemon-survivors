import { dirTo, TAU, type Vec } from '../engine/math'
import { momentBusy } from './legendMoments'
import { createRng, hash2 } from '../engine/rng'
import { REGIGIGAS, ZYGARDE } from '../data/legendPaths'
import { burst, shakeScreen } from './effects'
import { teamLegend } from './legend'
import { runPieces } from './legendPaths'
import { DIRECTOR, spawnSpot } from './mapEventRules'
import type { MapEventDef, MapEventKind } from './mapEvents'
import { playerWithin } from './players'
import { spawnWaveBoss } from './spawner'
import { clearSpot } from './terrain'
import type { Game } from './types'
import * as dm from '../engine/dmath'

/**
 * The legend paths' side of a run (`data/legendPaths.ts`), solo on the open
 * map only (`COOP_LOCKS`: a co-op run, the Dojo and an Arena match never get
 * here, and none of it moves the run's rng):
 *
 * - Zygarde Cells, and now and then a Core, turn up near the player at times
 *   the seed picks (`runPieces`); a touch takes one into the Cube (the shell
 *   banks it at once, a `pathFind` event), and one left alone burrows away.
 * - In Meltan's own runs fainted foes drop Hex Nuts (`hexNuts.ts`).
 * - A run that starts with the temple (`ReplayStart.temple`, the Regi trio
 *   captured) raises it once, ahead of the player: walking up to it wakes
 *   Regigigas, which rises there as a wave legendary and is captured on the map.
 */

/** A Zygarde piece still to come: when (run s) and whether it's a Core. */
export type PieceDue = { at: number; core: boolean }

/** A run's path state (`Game.paths`): the pieces still to come, the Hex Nuts picked up, and when the temple rises (null: not this run, or risen). */
export type PathRun = { pieces: PieceDue[]; nuts: number; temple: number | null }

const SALT = 7193

/** The pieces' times, spread over the run with some play, at least `ZYGARDE.apart` s apart; the Core among them where it comes. */
const piecesOf = (seed: number): PieceDue[] => {
  const { cells, core } = runPieces(seed)
  const n = cells + (core ? 1 : 0)
  const span = (ZYGARDE.until - ZYGARDE.from) / Math.max(1, n)
  const coreAt = core ? Math.floor(hash2(seed, 9, SALT) * n) : -1
  return Array.from({ length: n }, (_, i) => ({
    at: dm.round(ZYGARDE.from + span * i + Math.max(0, span - ZYGARDE.apart) * hash2(seed, 10 + i, SALT)),
    core: i === coreAt,
  }))
}

/** A run's path state: the pieces from its seed and, when the run brings it, the temple's time (`REGIGIGAS.at`). */
export const createPathRun = (seed: number, temple: boolean): PathRun => ({
  pieces: piecesOf(seed),
  nuts: 0,
  temple: temple ? dm.round(REGIGIGAS.at[0] + (REGIGIGAS.at[1] - REGIGIGAS.at[0]) * hash2(seed, 4, SALT)) : null,
})

/** What the shell hears: a piece showing up, taken or gone; the temple risen or woken. */
export type PathNotice = { kind: 'piece'; core: boolean; moment: 'sighted' | 'found' | 'gone' } | { kind: 'temple'; moment: 'risen' | 'woken' | 'silent' }

const notify = (g: Game, notice: PathNotice) => g.events.push({ kind: 'path', notice })

/** Places a map event: `spawnMapEvent`, handed in by `mapEvents.ts`, which imports this module. */
type Spawn = (g: Game, kind: MapEventKind, x: number, y: number) => unknown

/** A draw of its own for spots and headings (`n` tells them apart), so the run's rng never moves for a path. */
const ownRng = (g: Game, n: number) => createRng(hash2(g.terrain.seed, n, SALT) * 0x100000000)

/** A clear spot `distance` px around the player, or null when it's crowded there (it tries again the next second). */
const spotNear = (g: Game, n: number, distance: readonly [number, number]): Vec | null => {
  const p = g.player
  const spot = spawnSpot(ownRng(g, n), p.x, p.y, distance, g.mapEvents.list, DIRECTOR.spacing * 0.6)
  if (!spot) return null
  const open = clearSpot(g, spot, 18)
  return { x: dm.round(open.x), y: dm.round(open.y) }
}

/** Every tick on the open map, solo: the pieces and the temple come out when due. */
export const updatePathRun = (g: Game, spawn: Spawn) => {
  if (g.coop !== null || g.training !== null) return
  const s = g.paths
  const piece = s.pieces[0]
  if (piece && g.time >= piece.at) {
    const at = spotNear(g, Math.floor(g.time) * 4 + 1, ZYGARDE.distance)
    if (at) {
      s.pieces.shift()
      spawn(g, piece.core ? 'zygardeCore' : 'zygardeCell', at.x, at.y)
    } else piece.at = g.time + 1
  }
  if (s.temple !== null && g.time >= s.temple) {
    // It rises on a quiet map: never during a boss fight, a scene or another legend moment (a rift, a den, a Sword, a roamer).
    const at = g.bossId !== null || g.legendScene !== null || momentBusy(g, 'temple') ? null : spotNear(g, Math.floor(g.time) * 4 + 2, [REGIGIGAS.distance, REGIGIGAS.distance + 40])
    if (at) {
      s.temple = null
      spawn(g, 'regiTemple', at.x, at.y)
    } else s.temple = g.time + 1
  }
}

/* ---------------- Zygarde's pieces ---------------- */

/** A piece on the map: its heading's phase (a Core creeps away) and whether it's a Core. */
export type PieceEvent = { seed: number; core: boolean }

/** How a piece is taken (or lost): shared by the Cell's and the Core's map events. */
const pieceEvent = (core: boolean): MapEventDef<'zygardeCell' | 'zygardeCore'> => ({
  spawn: { from: ZYGARDE.from, weight: () => 0, max: 1, lifetime: ZYGARDE.lifetime, distance: ZYGARDE.distance },
  marker: true,
  create: (g) => ({ seed: ownRng(g, -3)() * TAU, core }),
  enter: (g, ev) => {
    burst(g, ev.x, ev.y - 4, { colors: ['#58e878', '#b8f8c8', '#ffffff'], count: 14, speed: 50, ttl: 0.5, gravity: -30 })
    notify(g, { kind: 'piece', core, moment: 'sighted' })
  },
  update: (g, ev, dt) => {
    // A Core creeps off, away from the nearest player, wobbling as it goes.
    if (core) {
      const p = g.player
      const away = dirTo(p.x, p.y, ev.x, ev.y)
      const wobble = dm.sin(ev.age * 2.2 + ev.state.seed) * 0.8
      ev.x += (away.x - away.y * wobble) * ZYGARDE.coreSpeed * dt
      ev.y += (away.y + away.x * wobble) * ZYGARDE.coreSpeed * dt
    }
    if (playerWithin(g, ev.x, ev.y, ZYGARDE.radius, true) === null) return
    burst(g, ev.x, ev.y - 5, { colors: ['#58e878', '#b8f8c8', '#ffffff', core ? '#f86848' : '#38a858'], count: core ? 50 : 30, speed: 110, ttl: 0.7, gravity: -40 })
    if (core) shakeScreen(g, 2)
    notify(g, { kind: 'piece', core, moment: 'found' })
    ev.gone = 0
  },
  expire: (g, ev) => {
    burst(g, ev.x, ev.y, { colors: ['#a07848', '#806040', '#58c870'], count: 14, speed: 50, ttl: 0.5 })
    notify(g, { kind: 'piece', core, moment: 'gone' })
  },
})

export const ZYGARDE_CELL_EVENT = pieceEvent(false) as MapEventDef<'zygardeCell'>
export const ZYGARDE_CORE_EVENT = pieceEvent(true) as MapEventDef<'zygardeCore'>

/* ---------------- Regigigas's temple ---------------- */

/** The temple on the map: whether it's waking (the seconds since the player stepped up, -1 asleep), whether it told of the boss still there, and whether the giant has stepped out of it. */
export type TempleEvent = { waking: number; told: boolean; out: boolean }

/** Seconds the temple takes to rise out of the ground (`REGIGIGAS.rise`). */
export const TEMPLE_RISE = REGIGIGAS.rise

/** Seconds from the player stepping up to Regigigas rising: the temple shakes, the three Regi marks light up one by one. */
export const TEMPLE_WAKE = 1.8

/** Seconds the empty temple stands once the giant is out, before it settles back into the ground. */
const TEMPLE_STAYS = 180

export const REGI_TEMPLE_EVENT: MapEventDef<'regiTemple'> = {
  spawn: { from: REGIGIGAS.at[0], weight: () => 0, max: 1, lifetime: 600, distance: [REGIGIGAS.distance, REGIGIGAS.distance + 40] },
  marker: true,
  create: () => ({ waking: -1, told: false, out: false }),
  enter: (g) => notify(g, { kind: 'temple', moment: 'risen' }),
  update: (g, ev, dt) => {
    const s = ev.state
    if (s.out) return
    ev.ttl = Math.max(ev.ttl, ev.age + 1)
    // Rising: the ground rumbles under it, and it shrugs the earth off once up.
    if (ev.age < TEMPLE_RISE) {
      shakeScreen(g, 2, ev)
      if (ev.age + dt >= TEMPLE_RISE) burst(g, ev.x, ev.y - 6, { colors: ['#c8b898', '#a89878', '#f0e8d0'], count: 40, speed: 90, ttl: 0.8, gravity: 40 })
      return
    }
    if (s.waking < 0) {
      if (playerWithin(g, ev.x, ev.y, REGIGIGAS.wake, true) === null) return
      // Another boss on the field (or a rift, a den, a Sword's duel under way) keeps it asleep: it wakes once that's over.
      if (g.bossId !== null || teamLegend(g)?.id === 'regigigas' || momentBusy(g, 'temple', ['roam'])) {
        if (!s.told) notify(g, { kind: 'temple', moment: 'silent' })
        s.told = true
        return
      }
      s.waking = 0
      notify(g, { kind: 'temple', moment: 'woken' })
      return
    }
    s.waking += dt
    shakeScreen(g, 1 + s.waking * 2, ev)
    if (s.waking < TEMPLE_WAKE) return
    burst(g, ev.x, ev.y - 16, { colors: ['#f0e8d0', '#c87848', '#a8e0f8', '#9098a8'], count: 70, speed: 160, ttl: 0.9, size: 2 })
    // The giant steps out of the gate; the temple stands behind it, its marks lit, then settles back in a while later.
    spawnWaveBoss(g, 'regigigas', g.time, false, { x: ev.x, y: ev.y + 16 })
    s.out = true
    ev.ttl = ev.age + TEMPLE_STAYS
  },
}

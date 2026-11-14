import { createRng } from '../engine/rng'
import type { Vec } from '../engine/math'
import { ENEMIES, type EnemyId } from '../data/enemies'
import { PLAYABLE } from '../data/hatchlings'
import { AWAKEN_AT, type LegendId } from '../data/legends'
import { RUSH, RUSH_ORDER } from '../data/rush'
import { ISLAND_CYCLE, ISLAND_OF_TYPE, ISLAND_START, ISLANDS, islandFoot, type IslandId } from '../data/rushIslands'
import { abilitySet } from './abilities'
import type { Build } from './builds'
import type { Difficulty } from './difficulty'
import { offstage } from './bosses'
import { burst, setScreenShake, shakeScreen } from './effects'
import { spawnEnemy } from './enemies'
import { legendFell } from './legendScene'
import { winRun } from './coop'
import { MAX_MOVES, recomputeStats, xpFor } from './leveling'
import { maxMoveLevel } from './moves'
import { aimScreen, standing } from './players'
import { ARRIVAL_IFRAMES, keepOnFloor, type Room } from './room'
import { applyBuild, setAbility, setForm, setMove, trainingMoves } from './training'
import { footOf, setArchetype, type Solid } from './terrain'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'

/**
 * Hoopa's Rings (`RUSH` in `data/rush.ts`), the Legend mode's boss rush: a
 * run with no horde and no clock to beat, where Hoopa's rings bring back the
 * legends the player has captured, one ring after another, each ring on a
 * floating island of its own (a room, `RushState.room`, built from
 * `data/rushIslands.ts`); the last ring is Hoopa itself, on its golden
 * island, and beating it captures Hoopa. The player fights at the rush's
 * level with their Dojo build for the Pokémon, or the family's own moves at
 * max level. A rush is never ranked,
 * banked nor replayed: what each player faces follows their own captures, so
 * times can't be compared on a board (the save keeps each level's best,
 * `Save.rush`). Its tick is `stepRush` in `game.ts`.
 */

/** Where the rush is: a ring opening, its legend fighting, the rest between rings, or over (cleared: Hoopa captured). */
export type RushStage = 'gate' | 'fight' | 'rest' | 'cleared'

export type RushState = {
  difficulty: Difficulty
  /** The legends the rings bring, in order, Hoopa last. */
  lineup: EnemyId[]
  /** The ring playing (index into `lineup`). */
  ring: number
  stage: RushStage
  /** Seconds left on the gate or the rest. */
  clock: number
  /** The middle of the rings. */
  home: Vec
  /** The ring's legend (-1 between rings). */
  bossId: number
  /** The island the ring plays on (`islandOf`). */
  island: IslandId
  /** The island as a room (`roomOf`): its floor and what stands on it, so the map's terrain, weather and map events wait outside. */
  room: Room
}

/** Whether a level of the rings is open for `captured` legends they can bring: as many as its rings, so each level is always the same fight. */
export const rushOpen = (captured: number, difficulty: Difficulty) => captured >= RUSH.rings[difficulty]

/**
 * The legends a rush brings at `difficulty` from the captured ones: exactly
 * `RUSH.rings` of them (drawn from the seed when there are more), in
 * `RUSH_ORDER`, then Hoopa. Null while the level is locked (`rushOpen`).
 */
export const rushLineup = (captured: readonly LegendId[], difficulty: Difficulty, seed: number): EnemyId[] | null => {
  const pool = RUSH_ORDER.filter((id) => captured.includes(id))
  const rings = RUSH.rings[difficulty]
  if (!rushOpen(pool.length, difficulty)) return null
  // More captured than rings: a draw from the seed decides which come (each legend its own roll), the order stays the rings'.
  const rng = createRng(seed)
  const picked = pool.length > rings ? pool.map((id) => [id, rng()] as const).sort((a, b) => a[1] - b[1]).slice(0, rings).map(([id]) => id) : pool
  return [...RUSH_ORDER.filter((id) => picked.includes(id)), 'hoopa']
}

/** A ring's legend's HP: the same for every species, growing ring by ring; Hoopa's the most. */
export const rushHp = (difficulty: Difficulty, ring: number, hoopa: boolean) =>
  dm.round(RUSH.hp * RUSH.hpBy[difficulty] * (1 + RUSH.ramp * ring) * (hoopa ? RUSH.hoopa : 1))

/** The player's loadout for the rush: their Dojo build, or the final form with the family's first moves at max level. */
const loadout = (g: Game, build: Build | null) => {
  const p = g.player
  if (build) return applyBuild(g, build)
  const last = PLAYABLE[p.starter].line.length - 1
  setForm(g, last, null, AWAKEN_AT.length)
  for (const id of trainingMoves(p.starter, null).slice(0, MAX_MOVES)) setMove(g, id, maxMoveLevel(id))
  setAbility(g, abilitySet(p.starter, p.branch)[0] ?? null)
}

/**
 * The island ring `ring` of `lineup` plays on: Hoopa's own for Hoopa, else the
 * island of its legend's first type, or its second when that was the last
 * ring's island, or the next one round `ISLAND_CYCLE`: no two rings in a row
 * on the same island.
 */
export const islandOf = (lineup: readonly EnemyId[], ring: number): IslandId => {
  let last: IslandId | null = null
  for (let i = 0; i <= ring; i++) {
    const id = lineup[i]
    if (id === undefined || id === 'hoopa') {
      last = 'hoopa'
      continue
    }
    const wants = ENEMIES[id].types.map((t) => ISLAND_OF_TYPE[t])
    const pick: IslandId = wants.find((w) => w !== last) ?? ISLAND_CYCLE[(ISLAND_CYCLE.indexOf(wants[0]!) + 1) % ISLAND_CYCLE.length]!
    last = pick
  }
  return last ?? 'hoopa'
}

/** Island `id` as a room around `home`: its floor and its solids, in world px. */
export const islandRoom = (home: Vec, id: IslandId): Room => {
  const def = ISLANDS[id]
  const solids = def.solids.map((s, i): Solid => {
    const foot = islandFoot(s.piece)
    const x = home.x + s.x
    const y = home.y + s.y
    return { kind: s.piece, x, y, variant: i, foot: [{ ...foot, x: x + foot.x, y: y + foot.y }] }
  })
  return { x: home.x, y: home.y, layout: { floor: def.floor }, terrain: { solids, lake: null, biome: def.biome } }
}

/** Sets ring `ring`'s island and lands the team on it, south of the middle, side by side and briefly protected: Hoopa's ring carried them there. */
const landOn = (g: Game, r: RushState, ring: number) => {
  r.island = islandOf(r.lineup, ring)
  r.room = islandRoom(r.home, r.island)
  const n = g.players.length
  g.players.forEach((p, i) => {
    p.x = r.home.x + (i - (n - 1) / 2) * 22
    p.y = r.home.y + ISLAND_START
    p.iframes = Math.max(p.iframes, ARRIVAL_IFRAMES)
  })
  g.flash = Math.max(g.flash, 0.5)
}

/** Turns a fresh run into a rush: the map's middle cleared of its horde, the player at the rush's level with their loadout, the first ring opening. */
export const startRush = (g: Game, difficulty: Difficulty, lineup: readonly EnemyId[], build: Build | null) => {
  const p = g.player
  setArchetype(g, 'route')
  g.enemies.length = 0
  p.level = RUSH.level[difficulty]
  p.xp = 0
  p.xpNext = xpFor(p.level)
  p.pendingLevelUps = 0
  p.offers = []
  loadout(g, build)
  recomputeStats(g)
  p.hp = p.stats.maxHp
  g.phase = 'playing'
  const home = { x: p.x, y: p.y - ISLAND_START }
  const island = islandOf(lineup, 0)
  g.rush = { difficulty, lineup: [...lineup], ring: 0, stage: 'gate', clock: RUSH.gate, home, bossId: -1, island, room: islandRoom(home, island) }
  g.events.length = 0
}

/** Opens ring `ring` now (the dev console's `ps.rushRing`): its gate opening at once, on its own island. */
export const jumpToRing = (g: Game, ring: number) => {
  const r = g.rush
  if (!r) return
  r.ring = Math.max(0, Math.min(r.lineup.length - 1, ring))
  r.stage = 'gate'
  r.clock = 0
  landOn(g, r, r.ring)
}

/** Where the ring's legend steps through: north of the middle. */
export const rushGate = (r: RushState) => ({ x: r.home.x, y: r.home.y - RUSH.enter })

const openRing = (g: Game, r: RushState) => {
  const id = r.lineup[r.ring]!
  const at = rushGate(r)
  const e = spawnEnemy(g, id, at.x, at.y)
  e.hp = e.maxHp = rushHp(r.difficulty, r.ring, id === 'hoopa')
  e.mass *= RUSH.grip
  e.xp = 0
  r.bossId = e.id
  g.bossId = e.id
  r.stage = 'fight'
  g.flash = 0.6
  setScreenShake(g, 8, 'team')
  burst(g, at.x, at.y - 14, { colors: ['#ffffff', '#f8e078', '#b878d8'], count: 70, speed: 200, ttl: 0.6, size: 2 })
  g.events.push({ kind: 'rush', moment: 'ring', ring: r.ring, rings: r.lineup.length, legend: id, island: r.island })
}

/**
 * A ring's legend fell (`killEnemy` hands it here): the next ring comes after
 * a rest (and a heal), or, Hoopa's, it's captured where it fell and the rush
 * is won once the capture has played.
 */
export const rushDown = (g: Game, e: Enemy) => {
  const r = g.rush
  if (!r) return
  e.dying = 0
  e.hp = 0
  g.kills++
  if (g.bossId === e.id) g.bossId = null
  g.hazards.length = 0
  shakeScreen(g, 6, e)
  burst(g, e.x, e.y - e.radius, { colors: ['#ffffff', '#f8f8c8', '#c8d8f8'], count: 60, speed: 160, ttl: 0.45 })
  if (e.kind === 'hoopa') {
    r.stage = 'cleared'
    g.events.push({ kind: 'legendBeaten', legend: 'hoopa', shiny: e.shiny })
    // Its capture plays where it fell, then the rush is won.
    if (legendFell(g, e) && g.legendScene) g.legendScene.then = 'victory'
    else winRun(g)
    return
  }
  r.stage = 'rest'
  r.clock = RUSH.rest
  r.bossId = -1
  for (const p of g.players) p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * RUSH.heal)
  g.events.push({ kind: 'rush', moment: 'down', ring: r.ring, rings: r.lineup.length, legend: e.kind, island: r.island }, { kind: 'heal' })
}

/**
 * Keeps everyone on the island: the players, and the ring's legend wherever a
 * hit knocked it or a teleport took it (but while its script holds it off
 * the stage, `offstage`, as a domain's floor does).
 */
const holdIsland = (g: Game, r: RushState) => {
  const room = r.room
  const floor = room.layout.floor
  for (const p of g.players) if (standing(g, p)) keepOnFloor(p, room, floor, [], footOf(p))
  for (const e of g.enemies) if (e.dying < 0 && !offstage(e)) keepOnFloor(e, room, floor, [], e.radius * 0.5)
}

/** Every tick of a rush: everyone kept on the island, the gate opening, the rest between rings and the way to the next island. */
export const updateRush = (g: Game, dt: number) => {
  const r = g.rush
  if (!r) return
  holdIsland(g, r)
  if (r.stage === 'gate') {
    r.clock -= dt
    if (r.clock <= 0) openRing(g, r)
  } else if (r.stage === 'rest') {
    r.clock -= dt
    if (r.clock > 0) return
    r.ring++
    r.stage = 'gate'
    r.clock = RUSH.gate
    landOn(g, r, r.ring)
  }
}

/**
 * How far from the view's edges the player always stays while the screen
 * frames the ring's legend too, px (the HUD sits on top); a phone held upright
 * keeps it higher (`tall`), over the news line (`.toasts.focus`), and a
 * short one lets it nearer the bottom (`edge`) so the legend's feet stay
 * `legend` px under the top, clear of the HUD.
 */
const FRAME = { side: 44, top: 96, bottom: 48, tall: 84, legend: 100, edge: 28 } as const

/**
 * The rush's camera (`followPlayers`' frame): on the middle of the player and
 * the ring's legend, a little low so the HUD doesn't cover it, never so far
 * the player leaves the frame, easing there as a domain's does.
 */
export const rushCamera = (g: Game, dt: number) => {
  const r = g.rush
  if (!r) return false
  const p = g.player
  const { w, h } = g.view
  let x = p.x - w / 2
  let y = p.y - 10 - h / 2
  const boss = g.enemies.find((e) => e.id === r.bossId && e.dying < 0)
  const at = boss ?? (r.stage === 'gate' ? rushGate(r) : null)
  if (at) {
    x = Math.max(p.x - (w - FRAME.side), Math.min(p.x - FRAME.side, (p.x + at.x) / 2 - w / 2))
    y = Math.max(p.y - (h - (h > w ? FRAME.tall : FRAME.bottom)), Math.min(p.y - FRAME.top, (p.y + at.y) / 2 - h / 2 - 24))
    // A short screen (a phone on its side) keeps the legend's feet `legend` px under its top, clear of the HUD, letting the player nearer the bottom (`edge`).
    y = Math.max(p.y - (h - FRAME.edge), Math.min(y, at.y - FRAME.legend))
  }
  const k = 1 - dm.exp(-5 * dt)
  aimScreen(g, p, p.screen.x + (x - p.screen.x) * k, p.screen.y + (y - p.screen.y) * k)
  return true
}

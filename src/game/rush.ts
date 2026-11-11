import { createRng } from '../engine/rng'
import type { Vec } from '../engine/math'
import type { EnemyId } from '../data/enemies'
import { PLAYABLE } from '../data/hatchlings'
import { AWAKEN_AT, type LegendId } from '../data/legends'
import { RUSH, RUSH_ORDER } from '../data/rush'
import { abilitySet } from './abilities'
import type { Build } from './builds'
import type { Difficulty } from './difficulty'
import { burst, setScreenShake, shakeScreen } from './effects'
import { spawnEnemy } from './enemies'
import { legendFell } from './legendScene'
import { winRun } from './coop'
import { MAX_MOVES, recomputeStats, xpFor } from './leveling'
import { maxMoveLevel } from './moves'
import { standing } from './players'
import { applyBuild, setAbility, setForm, setMove, trainingMoves } from './training'
import { setArchetype } from './terrain'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'

/**
 * Hoopa's Rings (`RUSH` in `data/rush.ts`), the Legend mode's boss rush: a
 * run with no horde and no clock to beat, where Hoopa's rings bring back the
 * legends the player has captured, one ring after another, inside a ring of
 * its golden portals; the last ring is Hoopa itself, and beating it captures
 * Hoopa. The player fights at the rush's level with their Dojo build for the
 * Pokémon, or the family's own moves at max level. A rush is never ranked,
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
}

/**
 * The legends a rush brings at `difficulty` from the captured ones: up to
 * `RUSH.rings` of them (drawn from the seed when there are more), in
 * `RUSH_ORDER`, then Hoopa. Null with fewer than `RUSH.min` captured.
 */
export const rushLineup = (captured: readonly LegendId[], difficulty: Difficulty, seed: number): EnemyId[] | null => {
  const pool = RUSH_ORDER.filter((id) => captured.includes(id))
  if (pool.length < RUSH.min) return null
  // More captured than rings: a draw from the seed decides which come (each legend its own roll), the order stays the rings'.
  const rng = createRng(seed)
  const picked = pool.length > RUSH.rings[difficulty] ? pool.map((id) => [id, rng()] as const).sort((a, b) => a[1] - b[1]).slice(0, RUSH.rings[difficulty]).map(([id]) => id) : pool
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
  g.rush = { difficulty, lineup: [...lineup], ring: 0, stage: 'gate', clock: RUSH.gate, home: { x: p.x, y: p.y - 30 }, bossId: -1 }
  g.events.length = 0
}

/** Where the ring's legend steps through: north of the middle. */
export const rushGate = (r: RushState) => ({ x: r.home.x, y: r.home.y - RUSH.enter })

const openRing = (g: Game, r: RushState) => {
  const id = r.lineup[r.ring]!
  const at = rushGate(r)
  const e = spawnEnemy(g, id, at.x, at.y)
  e.hp = e.maxHp = rushHp(r.difficulty, r.ring, id === 'hoopa')
  e.xp = 0
  r.bossId = e.id
  g.bossId = e.id
  r.stage = 'fight'
  g.flash = 0.6
  setScreenShake(g, 8, 'team')
  burst(g, at.x, at.y - 14, { colors: ['#ffffff', '#f8e078', '#b878d8'], count: 70, speed: 200, ttl: 0.6, size: 2 })
  g.events.push({ kind: 'rush', moment: 'ring', ring: r.ring, rings: r.lineup.length, legend: id })
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
  g.events.push({ kind: 'rush', moment: 'down', ring: r.ring, rings: r.lineup.length, legend: e.kind }, { kind: 'heal' })
}

/** Keeps the players inside the rings. */
const holdRings = (g: Game, r: RushState) => {
  for (const p of g.players) {
    if (!standing(g, p)) continue
    const dx = p.x - r.home.x
    const dy = p.y - r.home.y
    const len = dm.hypot(dx, dy)
    const max = RUSH.arena - 6
    if (len <= max) continue
    p.x = r.home.x + (dx / len) * max
    p.y = r.home.y + (dy / len) * max
  }
}

/** Every tick of a rush: the gate opening, the rest between rings, and the players kept inside. */
export const updateRush = (g: Game, dt: number) => {
  const r = g.rush
  if (!r) return
  holdRings(g, r)
  if (r.stage === 'gate') {
    r.clock -= dt
    if (r.clock <= 0) openRing(g, r)
  } else if (r.stage === 'rest') {
    r.clock -= dt
    if (r.clock > 0) return
    r.ring++
    r.stage = 'gate'
    r.clock = RUSH.gate
  }
}

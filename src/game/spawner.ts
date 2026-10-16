import { TAU } from '../engine/math'
import { chance, range } from '../engine/rng'
import { ENEMIES, type EnemyDef, type EnemyId } from '../data/enemies'
import { BOSS_FIGHT, bossCandidates, bossWaveAt, EVENTS, FINALE, stageAt, stageIndexAt, type WaveEvent } from '../data/waves'
import { bossReach, chaseOffBosses, finaleEntrance } from './bosses'
import { DIFFICULTIES } from './difficulty'
import { endlessPressure } from './endless'
import { despawnEnemy, spawnEnemy } from './enemies'
import { eliteSpawn, makeElite, makeRunner } from './horde'
import { oldestRenewable, RENEWAL } from './renewal'
import { hasTrait, pickSpawn } from './roster'
import { makeShiny, rollShiny, SHINY_ODDS } from './shiny'
import { COOP } from '../data/coop'
import { coopScale } from './coop'
import { anchorPlayer, nearestPlayer, onAnyScreen, screens } from './players'
import type { Game } from './types'
import * as dm from '../engine/dmath'

/** Just outside the visible area, in a random direction around the player. */
const ringDistance = (g: Game) => dm.hypot(g.view.w, g.view.h) / 2 + 12

/** Tries for a spot that shows on no teammate's screen either (co-op only: solo, the ring is always off screen). */
const OFFSCREEN_TRIES = 4

/**
 * A spot just past the screen edge, in a random direction around one player
 * (they take turns, `anchorPlayer`). In co-op it re-rolls a few times to stay
 * off every teammate's screen too.
 */
const offscreen = (g: Game) => {
  const p = anchorPlayer(g, g.nextId)
  const d = ringDistance(g)
  let spot = { x: 0, y: 0 }
  for (let i = 0; i < OFFSCREEN_TRIES; i++) {
    const angle = range(g.rng, 0, TAU)
    spot = { x: p.x + dm.cos(angle) * d, y: p.y + dm.sin(angle) * d }
    if (!g.coop || !onAnyScreen(g, spot.x, spot.y)) break
  }
  return spot
}

/** A closing circle of `count` × `species` around a player (taking turns). The endless mode reuses it. */
export const spawnRing = (g: Game, species: EnemyId, count: number) => {
  const p = anchorPlayer(g, g.nextId)
  const d = ringDistance(g) - 20
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU
    spawnEnemy(g, species, p.x + dm.cos(a) * d, p.y + dm.sin(a) * d)
  }
}

/** A flock of `count` × `species` that enters from one side and crosses the screen through a player's area. The endless mode reuses it. */
export const spawnSwarm = (g: Game, species: EnemyId, count: number) => {
  const p = anchorPlayer(g, g.nextId)
  const heading = range(g.rng, 0, TAU)
  const d = ringDistance(g)
  const speed = ENEMIES[species].speed * 1.7
  const vx = dm.cos(heading) * speed
  const vy = dm.sin(heading) * speed
  for (let i = 0; i < count; i++) {
    const spread = range(g.rng, -70, 70)
    const back = range(g.rng, 0, 60)
    spawnEnemy(
      g,
      species,
      p.x - dm.cos(heading) * (d + back) - dm.sin(heading) * spread,
      p.y - dm.sin(heading) * (d + back) + dm.cos(heading) * spread,
      { kind: 'flyby', vx, vy, ttl: (d * 2 + 120) / speed },
    )
  }
}

/**
 * A wave boss arrives off screen: the earlier wave's boss flees (`at` is the
 * wave's time), it takes the HP bar and the shell gets its entrance. The dev
 * console's `ps.boss` calls it too.
 */
export const spawnWaveBoss = (g: Game, enemy: EnemyId, at: number, finale = false) => {
  chaseOffBosses(g, at)
  const pos = offscreen(g)
  const boss = spawnEnemy(g, enemy, pos.x, pos.y)
  const def: EnemyDef = ENEMIES[enemy]
  g.bossId = boss.id
  g.shake = def.legendary ? 9 : 5
  if (finale) finaleEntrance(g)
  g.events.push({ kind: 'boss', enemy })
  return boss
}

/** `index` points into `EVENTS`; every event takes its species from the run's roster (bosses drawn there too). */
const runEvent = (g: Game, event: WaveEvent, index: number) => {
  const species = g.roster.events[index]
  switch (event.kind) {
    case 'boss':
      if (!species || (event.chance !== undefined && !chance(g.rng, event.chance))) break
      spawnWaveBoss(g, species, event.at, event.finale)
      break
    case 'ring':
      if (species) spawnRing(g, species, event.count)
      break
    case 'swarm':
      if (species) spawnSwarm(g, species, event.count)
      break
  }
}

/** The finale boss (Mewtwo) is alive in the regular run. It's the last boss to arrive, so while it lives `bossId` points at it. */
const finaleAlive = (g: Game) => {
  if (g.endless || g.bossId === null) return false
  const boss = g.enemies.find((e) => e.id === g.bossId)
  return boss !== undefined && EVENTS.some((e) => e.kind === 'boss' && e.finale && bossCandidates(e).includes(boss.kind))
}

const CALM = { rate: 1, max: 1 } as const

/**
 * Spawn multipliers on top of the stage: endless escalation once the player
 * chose it, a thin horde while the finale boss lives, and a thinner one for the
 * first minute of any other wave boss in the fight (`bossNear`, `BOSS_FIGHT`).
 */
const pressureOf = (g: Game, finale: boolean, bossNear: boolean) =>
  g.endless ? endlessPressure(g.time) : finale ? FINALE : bossNear ? BOSS_FIGHT : CALM

/** Retires one long-lived off-screen enemy per tick (`RENEWAL.maxAge`), cap or not; the spawner refills the room. */
const retireOld = (g: Game) => {
  const old = oldestRenewable(g.enemies, screens(g), g.view, g.time)
  if (old >= 0 && g.time - g.enemies[old]!.bornAt >= RENEWAL.maxAge) despawnEnemy(g.enemies[old]!)
}

/**
 * Regular spawns: the stage's rate and cap times the difficulty and the
 * pressure. At the cap the oldest off-screen enemy makes room (renewal); past
 * `ELITE.fill` of the cap new spawns come in as elites (never while the finale
 * boss lives, so the last fight stays a duel), and the stage's runner species
 * as runners. Shinies are neither.
 */
export const updateSpawner = (g: Game, dt: number) => {
  const stage = stageAt(g.time)
  const index = stageIndexAt(g.time)
  const pool = g.roster.stages[index] ?? []
  const runner = g.roster.runners[index] ?? null
  const reach = bossReach(g)
  const more = DIFFICULTIES[g.difficulty].spawnRate * coopScale(g, COOP.spawn)
  let regular = 0
  let traitsAlive = 0
  let elites = 0
  let bossNear = false
  for (const e of g.enemies) {
    if (e.dying >= 0) continue
    if (e.boss) {
      if (!bossNear && g.time - e.bornAt < BOSS_FIGHT.duration && bossWaveAt(e.kind) !== null) {
        const p = nearestPlayer(g, e.x, e.y)
        bossNear = dm.sq(e.x - p.x) + dm.sq(e.y - p.y) < reach * reach
      }
      continue
    }
    if (e.behavior.kind === 'chase') regular++
    if (e.elite) elites++
    if (hasTrait(e.kind)) traitsAlive++
  }
  const finale = finaleAlive(g)
  const pressure = pressureOf(g, finale, bossNear)
  const cap = stage.max * pressure.max * more

  g.spawnBudget += stage.rate * pressure.rate * more * dt
  while (g.spawnBudget >= 1) {
    g.spawnBudget--
    if (regular >= cap) {
      // At the cap, swap the oldest off-screen enemy for the fresh pick so the horde keeps turning over.
      const old = oldestRenewable(g.enemies, screens(g), g.view, g.time)
      if (old < 0) continue
      const gone = g.enemies[old]!
      if (hasTrait(gone.kind)) traitsAlive--
      if (gone.elite) elites--
      despawnEnemy(gone)
      regular--
    }
    const kind = pickSpawn(g.rng, pool, traitsAlive)
    if (!kind) continue
    if (hasTrait(kind)) traitsAlive++
    if (rollShiny(g.rng, SHINY_ODDS.enemy * g.shinyBoost)) {
      // Shinies pop in just inside the screen edge so their sparkle entrance is seen.
      const a = range(g.rng, 0, TAU)
      const d = Math.min(g.view.w, g.view.h) / 2 - 16
      const p = anchorPlayer(g, g.nextId)
      makeShiny(g, spawnEnemy(g, kind, p.x + dm.cos(a) * d, p.y + dm.sin(a) * d))
    } else {
      const pos = offscreen(g)
      const e = spawnEnemy(g, kind, pos.x, pos.y)
      if (!finale && eliteSpawn(regular, elites, cap)) {
        makeElite(e)
        elites++
      }
      if (kind === runner) makeRunner(e)
    }
    regular++
  }

  retireOld(g)

  while (g.nextEvent < EVENTS.length && EVENTS[g.nextEvent]!.at <= g.time) {
    runEvent(g, EVENTS[g.nextEvent]!, g.nextEvent)
    g.nextEvent++
  }
}

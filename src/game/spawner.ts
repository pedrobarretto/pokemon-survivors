import { TAU, type Vec } from '../engine/math'
import { chance, range, weightedPick } from '../engine/rng'
import { ENEMIES, type EnemyDef, type EnemyId } from '../data/enemies'
import { BOSS_FIGHT, bossCandidates, bossWaveAt, ELITE, EVENTS, FINALE, stageAt, stageIndexAt, type WaveEvent } from '../data/waves'
import { bossReach, chaseOffBosses, finaleEntrance } from './bosses'
import { mythicalChance } from './mythicalHunt'
import { runMods } from './legend'
import { endlessPressure } from './endless'
import { despawnEnemy, spawnEnemy } from './enemies'
import { legendEntrance } from './legendScene'
import { eliteSpawn, hordeWeight, makeElite, makeRunner, weighSpawn } from './horde'
import { oldestRenewable, RENEWAL } from './renewal'
import { hasTrait, pickSpawn, type StagePool } from './roster'
import { makeShiny, rollShiny, SHINY_ODDS } from './shiny'
import { surgeSize, TENSION_PEAK, tensionMods } from './tension'
import { spawnPoint, updateTension } from './tensionSystem'
import { isSpitter, makeSpitter, SPITTERS } from './spitters'
import { anchorPlayer, onAnyScreen, playerWithin } from './players'
import { coopScale } from './coop'
import { COOP } from '../data/coop'
import type { Game } from './types'
import * as dm from '../engine/dmath'
import { setScreenShake } from './effects'

/** Just outside the visible area, in a random direction around a player. */
const ringDistance = (g: Game) => dm.hypot(g.view.w, g.view.h) / 2 + 12

/** Co-op: draws of a spawn point at most before one on a teammate's screen stands anyway. */
const OFFSCREEN_TRIES = 6

/**
 * Off a player's screen in a random direction (the players take turns,
 * `anchorPlayer`): on the far ring, or `near` of the way to just past the
 * screen edge (tension). In co-op, off every teammate's screen too, drawn
 * again a few times (`OFFSCREEN_TRIES`) when it lands on one.
 */
const offscreen = (g: Game, near = 0) => {
  const p = anchorPlayer(g)
  let pos = spawnPoint(g, p, range(g.rng, 0, TAU), ringDistance(g), near)
  for (let i = 0; g.coop !== null && i < OFFSCREEN_TRIES && onAnyScreen(g, pos.x, pos.y); i++) pos = spawnPoint(g, p, range(g.rng, 0, TAU), ringDistance(g), near)
  return pos
}

/** A closing circle of `count` × `species` around a player (`anchorPlayer`). The endless mode reuses it, each foe standing for `weight` (`weighSpawn`). */
export const spawnRing = (g: Game, species: EnemyId, count: number, weight = 1) => {
  const p = anchorPlayer(g)
  const d = ringDistance(g) - 20
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU
    weighSpawn(spawnEnemy(g, species, p.x + dm.cos(a) * d, p.y + dm.sin(a) * d), weight)
  }
}

/** A flock of `count` × `species` that enters from one side and crosses the screen through a player's area (`anchorPlayer`). The endless mode reuses it, each foe standing for `weight` (`weighSpawn`). */
export const spawnSwarm = (g: Game, species: EnemyId, count: number, weight = 1) => {
  const p = anchorPlayer(g)
  const heading = range(g.rng, 0, TAU)
  const d = ringDistance(g)
  const speed = ENEMIES[species].speed * 1.7
  const vx = dm.cos(heading) * speed
  const vy = dm.sin(heading) * speed
  for (let i = 0; i < count; i++) {
    const spread = range(g.rng, -70, 70)
    const back = range(g.rng, 0, 60)
    const e = spawnEnemy(
      g,
      species,
      p.x - dm.cos(heading) * (d + back) - dm.sin(heading) * spread,
      p.y - dm.sin(heading) * (d + back) + dm.cos(heading) * spread,
      { kind: 'flyby', vx, vy, ttl: (d * 2 + 120) / speed },
    )
    weighSpawn(e, weight)
  }
}

/**
 * A wave boss arrives off screen: the earlier wave's boss flees (`at` is the
 * wave's time), it takes the HP bar and the shell gets its entrance (a
 * legendary's plays on the map, `legendEntrance`). The dev console's `ps.boss` calls it too.
 * `where`: it rises there instead (Regigigas, out of its temple).
 */
export const spawnWaveBoss = (g: Game, enemy: EnemyId, at: number, finale = false, where: Vec | null = null) => {
  chaseOffBosses(g, at)
  const pos = where ?? offscreen(g)
  const boss = spawnEnemy(g, enemy, pos.x, pos.y)
  const def: EnemyDef = ENEMIES[enemy]
  g.bossId = boss.id
  setScreenShake(g, def.legendary ? 9 : 5, 'team')
  if (finale) finaleEntrance(g)
  g.events.push({ kind: 'boss', enemy })
  legendEntrance(g, boss)
  return boss
}

/** `index` points into `EVENTS`; every event takes its species from the run's roster (bosses drawn there too). */
const runEvent = (g: Game, event: WaveEvent, index: number) => {
  const species = g.roster.events[index]
  switch (event.kind) {
    case 'boss': {
      if (!species) break
      const mythical = 'mythical' in event
      const odds = mythical && g.mythicalHunt && event.chance !== undefined ? mythicalChance(event.chance, g.mythicalHunt.dry) : event.chance
      const comes = odds === undefined || chance(g.rng, odds)
      if (mythical && g.coop === null) g.events.push({ kind: 'mythicalRoll', enemy: comes ? species : null })
      if (comes) spawnWaveBoss(g, species, event.at, event.finale)
      break
    }
    case 'ring':
      if (species) spawnRing(g, species, event.count)
      break
    case 'swarm':
      if (species) spawnSwarm(g, species, event.count)
      break
  }
}

/** The finale boss (Mewtwo) is alive in the regular run. It's the last boss to arrive, so while it lives `bossId` points at it. */
export const finaleAlive = (g: Game) => {
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

/** The regular cap a run asks for before the endless ceiling: the stage's, times the difficulty, the pressure, the tension and the team. */
const askedCap = (g: Game, max: number, tension: number) => stageAt(g.time).max * max * runMods(g).spawnRate * tension * coopScale(g, COOP.scale.cap)

/**
 * How many foes each endless regular spawn stands for now (`hordeWeight`, 1
 * outside endless mode). The tension leaves the cap alone in endless mode, so
 * this is the spawner's own. The endless events weigh theirs by it too.
 */
export const endlessWeight = (g: Game) => (g.endless ? hordeWeight(askedCap(g, endlessPressure(g.time).max, 1)) : 1)

/**
 * A surge of the pressure director: a ring or a swarm (alternating) of a
 * species of the stage's pool, without traits, as big as the tension asks.
 */
const surge = (g: Game, pool: StagePool, level: number) => {
  const open = pool.filter(([id]) => !hasTrait(id))
  if (open.length === 0) return
  const s = g.tension
  ;(s.surges % 2 === 0 ? spawnRing : spawnSwarm)(g, weightedPick(g.rng, open), surgeSize(level))
  s.surges++
}

/** Retires one long-lived off-screen enemy per tick (`RENEWAL.maxAge`), cap or not; the spawner refills the room. */
const retireOld = (g: Game) => {
  const old = oldestRenewable(g.enemies, g.players, g.view, g.now)
  if (old >= 0 && g.now - g.enemies[old]!.bornAt >= RENEWAL.maxAge) despawnEnemy(g.enemies[old]!)
}

/**
 * Regular spawns: the stage's rate and cap times the difficulty, the
 * pressure and the tension (`tension.ts`, held still while the finale boss
 * lives). At the cap the oldest off-screen enemy makes room (renewal); past
 * `ELITE.fill` of the cap new spawns come in as elites, and with tension some
 * spawns do anyway (never while the finale boss lives, so the last fight
 * stays a duel), and the stage's runner species as runners. From
 * `SPITTERS.from` a `share` of the spawns are the stage's spitter species
 * instead, up to `alive` of them (none while the finale boss lives either).
 * Shinies are none of these. Tension also brings spawns closer and faster,
 * splits the loot of every regular faint by its rate multiplier
 * (`TensionState.share`, so a dominant build doesn't snowball) and banks
 * toward surges, which wait out a wave boss's first minute and the endless
 * mode (it has its own). Past the endless ceiling (`ENDLESS_HORDE`) the cap
 * stops at it and every spawn stands for `weight` foes, coming that many
 * times fewer. In endless mode an event's flyby flock counts against the cap.
 */
export const updateSpawner = (g: Game, dt: number) => {
  const stage = stageAt(g.time)
  const index = stageIndexAt(g.time)
  const pool = g.roster.stages[index] ?? []
  const runner = g.roster.runners[index] ?? null
  const spit = SPITTERS[g.difficulty]
  const spitter = g.roster.spitters[index] ?? null
  const reach = bossReach(g)
  const more = runMods(g).spawnRate
  let regular = 0
  let traitsAlive = 0
  let elites = 0
  let spitters = 0
  let bossNear = false
  for (const e of g.enemies) {
    if (e.dying >= 0) continue
    if (e.boss) {
      if (!bossNear && g.now - e.bornAt < BOSS_FIGHT.duration && bossWaveAt(e.kind) !== null) {
        bossNear = playerWithin(g, e.x, e.y, reach) !== null
      }
      continue
    }
    // Endless: a swarm's flock counts against the cap while it crosses, so the chasers make room for it (`ENDLESS_HORDE`).
    if (e.behavior.kind === 'chase' || (g.endless !== null && e.behavior.kind === 'flyby')) regular++
    if (e.elite) elites++
    if (hasTrait(e.kind)) traitsAlive++
    if (isSpitter(e)) spitters++
  }
  const finale = finaleAlive(g)
  const pressure = pressureOf(g, finale, bossNear)
  if (!finale) updateTension(g, dt)
  const level = finale ? 0 : g.tension.level
  const peak = TENSION_PEAK[g.difficulty]
  const tension = tensionMods(level, peak, g.endless !== null)
  // Co-op: a denser horde for a bigger team (`coopScale`; exactly 1 solo). Endless: past the ceiling, heavier foes instead of more (`ENDLESS_HORDE`).
  const want = askedCap(g, pressure.max, tension.cap)
  const weight = g.endless ? hordeWeight(want) : 1
  const cap = want / weight
  // Tension brings pressure, not power: the faster horde splits the same loot.
  g.tension.share = 1 / tension.rate
  const spitting = spitter !== null && !finale && g.time >= spit.from

  if (!finale && !bossNear && !g.endless) {
    g.tension.surge += level * dt
    if (g.tension.surge >= peak.surgeEvery) {
      g.tension.surge -= peak.surgeEvery
      surge(g, pool, level)
    }
  }

  g.spawnBudget += (stage.rate * pressure.rate * more * tension.rate * coopScale(g, COOP.scale.spawn) * dt) / weight
  while (g.spawnBudget >= 1) {
    g.spawnBudget--
    if (regular >= cap) {
      // At the cap, swap the oldest off-screen enemy for the fresh pick so the horde keeps turning over.
      const old = oldestRenewable(g.enemies, g.players, g.view, g.now)
      if (old < 0) continue
      const gone = g.enemies[old]!
      if (hasTrait(gone.kind)) traitsAlive--
      if (gone.elite) elites--
      if (isSpitter(gone)) spitters--
      despawnEnemy(gone)
      regular--
      // Past the endless ceiling an event's flock that overflowed it drains the same way, a spawn's room at a time, so the ceiling holds.
      if (weight > 1 && regular >= cap) continue
    }
    const spits = spitting && spitters < spit.alive && chance(g.rng, spit.share)
    // The horde leans to the biome around the player it spawns by (`offscreen` picks the same one: `anchorPlayer` turns on `nextId`).
    const kind = spits ? spitter : pickSpawn(g.rng, pool, traitsAlive, anchorPlayer(g).biome)
    if (!kind) continue
    if (hasTrait(kind)) traitsAlive++
    // A foe standing for `weight` is shiny as often as that many would be one (`ENDLESS_HORDE`).
    if (rollShiny(g.rng, SHINY_ODDS.enemy * g.shinyBoost * weight)) {
      // Shinies pop in just inside the screen edge so their sparkle entrance is seen (in co-op, inside every client's screen).
      const a = range(g.rng, 0, TAU)
      const d = g.coop !== null ? COOP.inSight : Math.min(g.view.w, g.view.h) / 2 - 16
      const p = anchorPlayer(g)
      const e = spawnEnemy(g, kind, p.x + dm.cos(a) * d, p.y + dm.sin(a) * d)
      weighSpawn(e, weight)
      makeShiny(g, e)
    } else {
      const pos = offscreen(g, tension.near)
      const e = spawnEnemy(g, kind, pos.x, pos.y)
      weighSpawn(e, weight)
      e.speed *= tension.speed
      const tense = tension.elite > 0 && elites < cap * ELITE.share && chance(g.rng, tension.elite)
      if (!finale && (eliteSpawn(regular, elites, cap) || tense)) {
        makeElite(e)
        elites++
      }
      if (kind === runner) makeRunner(e)
      if (spits) {
        makeSpitter(e, g.rng())
        spitters++
      }
    }
    regular++
  }

  retireOld(g)

  while (g.nextEvent < EVENTS.length && EVENTS[g.nextEvent]!.at <= g.time) {
    runEvent(g, EVENTS[g.nextEvent]!, g.nextEvent)
    g.nextEvent++
  }
}

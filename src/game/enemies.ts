import { dir8, dirTo, retain } from '../engine/math'
import { clearGrid, insert, query } from '../engine/spatial'
import { ENEMIES, type EnemyDef, type EnemyId } from '../data/enemies'
import { scaling } from '../data/waves'
import { STANCES } from '../data/bosses'
import { DIFFICULTIES } from './difficulty'
import { bodyOf } from '../data/bodies'
import { fightPace } from './bossFight'
import { hurtPlayer } from './combat'
import { leadTime } from './horde'
import { createStatus, statusAttack, statusPace } from './status'
import { enemyGroundPace } from './terrain'
import { createTraitState, isAirborne, traitPace } from './traits'
import { COOP } from '../data/coop'
import { coopScale } from './coop'
import { actAs, inPlay, nearestPlayer } from './players'
import type { Enemy, EnemyBehavior, Game } from './types'
import * as dm from '../engine/dmath'

const neighbors: number[] = []

/** Body radius derived from the sprite so big Pokémon take up more space. */
export const radiusFor = (dex: number) => Math.max(5, Math.round(bodyOf(dex).bodyW * 0.32))

/**
 * How much tougher than its base stats a regular enemy spawning now is: the
 * minutes played (`scaling`) and the difficulty. Bosses only take the difficulty's HP.
 */
export const enemyScale = (g: Game) => {
  const mods = DIFFICULTIES[g.difficulty]
  const scale = scaling(g.time, mods.ramp)
  return { hp: scale.hp * mods.enemyHp, damage: scale.damage }
}

export const spawnEnemy = (g: Game, kind: EnemyId, x: number, y: number, behavior: EnemyBehavior = { kind: 'chase' }) => {
  const def: EnemyDef = ENEMIES[kind]
  const boss = def.boss === true
  const mods = DIFFICULTIES[g.difficulty]
  const scale = boss ? { hp: mods.enemyHp, damage: 1 } : enemyScale(g)
  const hp = Math.round(def.hp * scale.hp * coopScale(g, boss ? COOP.bossHp : COOP.hp))
  const enemy: Enemy = {
    id: g.nextId++,
    kind,
    types: def.types,
    x, y, kx: 0, ky: 0,
    hp, maxHp: hp,
    damage: def.damage * scale.damage,
    speed: def.speed * (boss ? 1 : mods.enemySpeed) * (0.92 + g.rng() * 0.16),
    mass: def.mass,
    radius: radiusFor(def.dex) * (def.scale ?? 1),
    xp: def.xp,
    boss,
    shiny: false,
    elite: false,
    runner: false,
    fight: null,
    bornAt: g.time,
    cooldowns: [],
    behavior,
    dir: 0,
    animTime: g.rng() * 2,
    flash: 0,
    status: createStatus(),
    trait: createTraitState(def.trait, g.rng()),
    dying: -1,
    fled: false,
  }
  g.enemies.push(enemy)
  return enemy
}

/** Knocks every regular enemy away from the nearest player (Arceus descending, Mewtwo arriving). */
export const blastHorde = (g: Game, force: number) => {
  for (const e of g.enemies) {
    if (e.boss || e.dying >= 0) continue
    const p = nearestPlayer(g, e.x, e.y)
    const d = dirTo(p.x, p.y, e.x, e.y)
    e.kx += (d.x * force) / e.mass
    e.ky += (d.y * force) / e.mass
  }
}

export const rebuildGrid = (g: Game) => {
  clearGrid(g.grid)
  g.enemies.forEach((e, i) => {
    if (e.dying < 0) insert(g.grid, i, e.x, e.y)
  })
}

const FAINT_TIME = 0.4

/** Seconds a fleeing boss takes to glide off and fade out (`chaseOffBosses`). */
export const FLEE_TIME = 0.9

/** Removes an enemy without a faint: no EXP, no drop, gone at the end of this tick's `updateEnemies`. */
export const despawnEnemy = (e: Enemy) => {
  e.dying = FAINT_TIME
}

/** Moves the horde (each enemy after the nearest player), keeps bodies apart and out of the players, and deals contact damage. */
export const updateEnemies = (g: Game, dt: number) => {
  const recycleDist = dm.hypot(g.view.w, g.view.h) * 0.85

  for (const e of g.enemies) {
    if (e.dying >= 0) {
      e.dying += dt
      if (e.fled) {
        e.x += e.kx * dt
        e.y += e.ky * dt
      }
      continue
    }
    const p = nearestPlayer(g, e.x, e.y)
    const frozen = e.status.stun > 0
    if (!frozen) e.animTime += dt
    e.flash = Math.max(0, e.flash - dt)
    const pace = e.speed * statusPace(e.status) * traitPace(e) * (e.flash > 0 ? 0.35 : 1) * enemyGroundPace(g, e)

    let vx = 0
    let vy = 0
    if (e.behavior.kind === 'chase') {
      // Runners head where the player is going; a boss in a fight walks at its stance's pace and a ranged one holds its distance.
      let tx = p.x
      let ty = p.y
      let speed = pace
      if (e.runner) {
        const t = leadTime(dm.hypot(p.x - e.x, p.y - e.y), pace)
        tx += p.vx * t
        ty += p.vy * t
      } else if (e.fight) {
        const hold = STANCES[e.fight.stance].hold
        speed = hold > 0 && dm.sq(p.x - e.x) + dm.sq(p.y - e.y) < hold * hold ? 0 : pace * fightPace(e.fight)
      }
      const d = dirTo(e.x, e.y, tx, ty)
      vx = d.x * speed
      vy = d.y * speed
    } else {
      vx = frozen ? 0 : e.behavior.vx
      vy = frozen ? 0 : e.behavior.vy
      e.behavior.ttl -= dt
      if (e.behavior.ttl <= 0) despawnEnemy(e)
    }

    e.x += (vx + e.kx) * dt
    e.y += (vy + e.ky) * dt
    const damp = dm.exp(-9 * dt)
    e.kx *= damp
    e.ky *= damp
    if (Math.abs(vx) + Math.abs(vy) > 1) e.dir = dir8(vx, vy)

    // Wrap stragglers back in front of the player instead of letting them get lost.
    if (e.behavior.kind === 'chase' && !e.boss && Math.abs(e.x - p.x) + Math.abs(e.y - p.y) > recycleDist * 1.3) {
      e.x = p.x + (p.x - e.x) * 0.7
      e.y = p.y + (p.y - e.y) * 0.7
    }
  }

  // Separation: overlapping enemies push each other apart so hordes form rings, not blobs.
  g.enemies.forEach((e, i) => {
    if (e.dying >= 0 || isAirborne(e)) return
    for (const j of query(g.grid, e.x, e.y, e.radius * 2, neighbors)) {
      if (j === i) continue
      const o = g.enemies[j]!
      if (o.dying >= 0 || isAirborne(o)) continue
      const dx = e.x - o.x
      const dy = e.y - o.y
      const min = (e.radius + o.radius) * 0.8
      const d2 = dx * dx + dy * dy
      if (d2 >= min * min || d2 === 0) continue
      const d = Math.sqrt(d2)
      const push = ((min - d) / d) * (o.mass / (e.mass + o.mass)) * 0.5
      e.x += dx * push
      e.y += dy * push
    }

    // Keep bodies out of the players and deal contact damage.
    for (const p of g.players) {
      if (!inPlay(p)) continue
      const dx = e.x - p.x
      const dy = e.y - p.y
      const reach = e.radius + p.radius
      const d2 = dx * dx + dy * dy
      if (d2 >= reach * reach) continue
      const d = Math.sqrt(d2) || 1
      e.x = p.x + (dx / d) * reach
      e.y = p.y + (dy / d) * reach
      const attack = statusAttack(e.status)
      if (attack > 0) actAs(g, p, () => hurtPlayer(g, e.damage * attack, e))
    }
  })

  retain(g.enemies, (e) => e.dying < (e.fled ? FLEE_TIME : FAINT_TIME))
}

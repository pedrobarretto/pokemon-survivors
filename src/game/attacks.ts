import { dir8, dirTo, fromAngle, retain, TAU } from '../engine/math'
import { chance, range } from '../engine/rng'
import { query } from '../engine/spatial'
import { holdsShots } from './bossFight'
import { damageEnemy } from './combat'
import { evolvedImpact, evolvedTick } from './evolvedMoves'
import { inheritMods, modHit, modTick } from './mods'
import { lungeStep, mineArmed, mineBlast, rollStep, TURRET_RANGE } from './moveRules'
import { nearestEnemy } from './queries'
import { inDoorway } from './rift'
import { atCaveChest } from './cave'
import { inStandRing } from './mapEvents'
import { spawnAttack } from './spawn'
import { typeEvolvedTrail } from './typeEvolutions'
import { ownerOf } from './players'
import { isAlly } from './versusRules'
import type { Attack, Enemy, Game, Motion, Player, Trailer, Turret } from './types'
import * as dm from '../engine/dmath'

const neighbors: number[] = []

/**
 * Whether a move carrying the player (a lunge, Rollout) holds them where they
 * stand: in a portal or a place's door filling (`inDoorway`), at a shut chest
 * or in the Move Tutor's tent, so it never hops them off a spot that fills by
 * standing. Co-op's prediction ghost asks it too (`coop/predict.ts`).
 */
export const holdsCarry = (g: Game, p: Pick<Player, 'x' | 'y' | 'radius'>) => inDoorway(g, p) || inStandRing(g, p) || atCaveChest(g, p)

const move = (g: Game, a: Attack, m: Motion, dt: number) => {
  const p = g.player
  switch (m.kind) {
    case 'linear':
      a.x += m.vx * dt
      a.y += m.vy * dt
      break
    case 'homing': {
      if (!m.target || m.target.dying >= 0) m.target = nearestEnemy(g, a.x, a.y, 260)
      if (m.target) {
        const want = dirTo(a.x, a.y, m.target.x, m.target.y - m.target.radius)
        const k = Math.min(1, m.turn * dt)
        const vx = m.vx + (want.x * m.speed - m.vx) * k
        const vy = m.vy + (want.y * m.speed - m.vy) * k
        const len = dm.hypot(vx, vy) || 1
        m.vx = (vx / len) * m.speed
        m.vy = (vy / len) * m.speed
      }
      a.x += m.vx * dt
      a.y += m.vy * dt
      break
    }
    case 'orbit':
      m.angle += m.spin * dt
      a.x = p.x + dm.cos(m.angle) * m.radius
      a.y = p.y - 8 + dm.sin(m.angle) * m.radius
      break
    case 'boomerang':
      m.vx += m.ax * dt
      m.vy += m.ay * dt
      a.x += m.vx * dt
      a.y += m.vy * dt
      break
    case 'follow':
      a.x = p.x + m.ox
      a.y = p.y + m.oy
      break
    case 'static':
      break
    case 'lunge': {
      // A portal, a place's door or a chest being stood in holds the player: the lunge ends there.
      if (holdsCarry(g, p)) m.left = 0
      const step = lungeStep(m, dt)
      m.left = step.left
      p.x += step.dx
      p.y += step.dy
      if (m.left > 0) p.dir = dir8(m.vx, m.vy)
      a.x = p.x
      a.y = p.y - 8
      break
    }
    case 'drift': {
      const k = Math.max(0, 1 - m.drag * dt)
      m.vx *= k
      m.vy *= k
      a.x += m.vx * dt
      a.y += m.vy * dt
      break
    }
    case 'return': {
      if (m.out > 0) {
        m.out -= dt
        a.x += m.vx * dt
        a.y += m.vy * dt
        // The way back is a fresh pass: everything can be hit again.
        if (m.out <= 0) a.hits.clear()
        break
      }
      const dx = p.x - a.x
      const dy = p.y - 8 - a.y
      const d = dm.hypot(dx, dy)
      const step = m.speed * dt
      if (d <= step + RETURN_CATCH) {
        a.x = p.x
        a.y = p.y - 8
        a.ttl = a.age
        break
      }
      m.vx = (dx / d) * m.speed
      m.vy = (dy / d) * m.speed
      a.x += m.vx * dt
      a.y += m.vy * dt
      break
    }
    case 'wander': {
      m.heading += range(g.rng, -m.turn, m.turn) * dt
      const dx = p.x - a.x
      const dy = p.y - a.y
      if (dm.sq(dx) + dm.sq(dy) > m.leash * m.leash) m.heading += turnToward(m.heading, dm.atan2(dy, dx)) * Math.min(1, 4 * dt)
      a.x += dm.cos(m.heading) * m.speed * dt
      a.y += dm.sin(m.heading) * m.speed * dt
      break
    }
    case 'roll': {
      // Held, it rolls in place (the stick still walks the player out).
      if (!holdsCarry(g, p)) {
        const step = rollStep(p.facing, m.speed, dt)
        p.x += step.dx
        p.y += step.dy
      }
      a.x = p.x
      a.y = p.y - 8
      break
    }
    case 'tether': {
      const e = m.target
      if (e.dying >= 0) {
        a.ttl = a.age
        break
      }
      a.x = e.x
      a.y = e.y - e.radius
      if (a.age < m.next) break
      m.next += m.every
      damageEnemy(g, e, a)
      break
    }
  }
}

/** A returning hitbox is caught this close to the player. */
const RETURN_CATCH = 6

/** Signed angle (−π..π) to turn from `from` to face `to`. */
const turnToward = (from: number, to: number) => {
  let d = (to - from) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}

/** Bosses feel this share of a pull, on top of their mass. */
const PULL_BOSS = 0.25

/** Draws the foes the attack touches toward its center by `pull / mass` px/s, never past it. */
const pullFoes = (g: Game, a: Attack, dt: number) => {
  for (const i of query(g.grid, a.x, a.y, reach(a) + 40, neighbors)) {
    const e = g.enemies[i]
    if (!e || e.dying >= 0 || e.behavior.kind === 'avatar' || !overlaps(a, e)) continue
    const dx = a.x - e.x
    const dy = a.y - (e.y - e.radius)
    const d = dm.hypot(dx, dy)
    if (d < 1) continue
    const step = Math.min(d, (a.pull / e.mass) * (e.boss ? PULL_BOSS : 1) * dt)
    e.x += (dx / d) * step
    e.y += (dy / d) * step
  }
}

/** Drops a patch at the player's feet for every `every` px walked since the last one. */
const dropTrail = (g: Game, a: Attack, t: Trailer) => {
  const p = g.player
  t.acc += p.walked - t.walked
  t.walked = p.walked
  for (; t.acc >= t.every; t.acc -= t.every) {
    spawnAttack(g, {
      move: a.move, type: a.type, visual: t.visual, x: p.x + range(g.rng, -2, 2), y: p.y + range(g.rng, -2, 2),
      shape: { kind: 'circle', r: t.r }, motion: { kind: 'static' },
      damage: a.damage * t.share, knockback: 0, hitInterval: t.hitInterval, ttl: t.ttl, status: a.status,
      bonus: a.bonus, drain: a.drain, flip: chance(g.rng, 0.5), ...inheritMods(a, ['trail']),
    })
  }
}

/** Whether a drifting shard is still flying (it trails frost and points its way only then). */
export const flying = (m: Motion) => m.kind === 'drift' && dm.sq(m.vx) + dm.sq(m.vy) > 400

/** Blows a mine up: a short blast hits everything around it, then the mine is gone. */
const detonate = (g: Game, a: Attack, expired: boolean) => {
  spawnAttack(g, {
    move: a.move, type: a.type, visual: a.blastVisual, x: a.x, y: a.y - 4,
    shape: { kind: 'circle', r: a.blast }, motion: { kind: 'static' },
    damage: mineBlast(a.damage, expired), knockback: a.knockback, status: a.status,
    ttl: 0.32, activeUntil: 0.05, ...inheritMods(a, ['trail']),
  })
  a.pierce = 0
}

/** Turrets shoot at the nearest foe in range, `amount` shots in a small fan. */
const shoot = (g: Game, a: Attack, t: Turret, dt: number) => {
  t.left -= dt
  if (t.left > 0) return
  const y = a.y - 12
  const target = nearestEnemy(g, a.x, y, TURRET_RANGE)
  if (!target) {
    t.left = 0
    return
  }
  t.left += t.every
  const aim = dirTo(a.x, y, target.x, target.y - target.radius)
  const center = dm.atan2(aim.y, aim.x)
  for (let i = 0; i < t.amount; i++) {
    const v = fromAngle(center + (i - (t.amount - 1) / 2) * 0.22, t.speed)
    spawnAttack(g, {
      move: a.move, type: a.type, visual: t.shot, x: a.x, y,
      shape: { kind: 'circle', r: 4 }, motion: { kind: 'linear', vx: v.x, vy: v.y },
      damage: a.damage, knockback: a.knockback, pierce: 1, status: a.status, ttl: 1.2, ...inheritMods(a),
    })
  }
}

const overlaps = (a: Attack, e: Enemy) => {
  const ey = e.y - e.radius // enemy body center sits above its feet
  if (a.shape.kind === 'circle') return dm.sq(a.x - e.x) + dm.sq(a.y - ey) < dm.sq(a.shape.r + e.radius)
  const cx = Math.max(a.x - a.shape.w / 2, Math.min(e.x, a.x + a.shape.w / 2))
  const cy = Math.max(a.y - a.shape.h / 2, Math.min(ey, a.y + a.shape.h / 2))
  return dm.sq(cx - e.x) + dm.sq(cy - ey) < dm.sq(e.radius)
}

const reach = (a: Attack) => (a.shape.kind === 'circle' ? a.shape.r : dm.hypot(a.shape.w, a.shape.h) / 2)

const collide = (g: Game, a: Attack) => {
  for (const i of query(g.grid, a.x, a.y, reach(a) + 40, neighbors)) {
    const e = g.enemies[i]
    if (!e || e.dying >= 0 || isAlly(g, e) || !overlaps(a, e)) continue
    if ((a.hits.get(e.id) ?? -1) > g.now) continue
    if (a.blast > 0) return detonate(g, a, false)
    a.hits.set(e.id, g.now + a.hitInterval)
    damageEnemy(g, e, a)
    if (a.mod) modHit(g, a, e)
    if (--a.pierce <= 0) return
  }
}

/** Cosmetic trails, emitted from the simulation so they inherit attack motion. */
const trail = (g: Game, a: Attack) => {
  const emit = (colors: readonly string[], p: number, opts: { speed?: number; gravity?: number; ttl?: number } = {}) => {
    if (!chance(g.rng, p)) return
    g.particles.push({
      x: a.x + range(g.rng, -2, 2), y: a.y + range(g.rng, -2, 2),
      vx: range(g.rng, -1, 1) * (opts.speed ?? 10), vy: range(g.rng, -1, 1) * (opts.speed ?? 10),
      life: 0, ttl: opts.ttl ?? 0.3, color: colors[Math.floor(g.rng() * colors.length)]!, size: 1, gravity: opts.gravity ?? 0, drag: 3,
    })
  }
  switch (a.visual) {
    case 'ember': return emit(['#f8d030', '#f08030', '#c03020'], 0.9, { gravity: -30 })
    case 'flame': return emit(['#f8d030', '#f08030'], 0.4, { gravity: -50 })
    case 'water': return emit(['#a8d8f8', '#6890f0', '#ffffff'], 0.7, { gravity: 60 })
    case 'star': return emit(['#fff8a0', '#ffffff'], 0.5, { ttl: 0.25 })
    case 'sludge': return a.age > a.activeFrom ? emit(['#c070d0', '#a040a0'], 0.25, { gravity: -25, ttl: 0.5, speed: 6 }) : undefined
    case 'flamethrower': return emit(['#f8d030', '#f08030', '#c03020'], 0.8, { gravity: -40, speed: 18 })
    case 'gunk': return a.age > a.activeFrom ? emit(['#b878c8', '#6a3a78', '#88a038'], 0.35, { gravity: -25, ttl: 0.6, speed: 8 }) : undefined
    case 'hurricane': return emit(['#ffffff', '#c8d0e8'], 0.8, { gravity: -70, speed: 40, ttl: 0.4 })
    case 'arrow': return emit(['#a070d8', '#705898', '#c8a8f0'], 0.7, { ttl: 0.35, speed: 4 })
    case 'steel': return emit(['#ffffff', '#c8d0e0', '#8890a8'], 0.6, { ttl: 0.3, speed: 14 })
    case 'shuriken': return emit(['#a8d8f8', '#ffffff'], 0.4, { gravity: 40, ttl: 0.25 })
    case 'psy': return emit(['#f85888', '#ffd0e8'], 0.4, { ttl: 0.3, speed: 6 })
    case 'heart': return emit(['#f878a8', '#ffffff'], 0.3, { gravity: -20, ttl: 0.3, speed: 6 })
    case 'note': return emit(['#f8d030', '#f08030', '#c03020'], 0.6, { gravity: -30 })
    case 'blade': return emit(['#a8e870', '#58b838'], 0.5, { ttl: 0.25, speed: 6 })
    case 'pyro': return a.age < a.activeFrom ? undefined : emit(['#f8d030', '#f08030', '#c03020'], 0.9, { gravity: -40, speed: 40, ttl: 0.4 })
    case 'iceShard': return flying(a.motion) ? emit(['#e0f8ff', '#98d8f8', '#ffffff'], 0.6, { ttl: 0.3, speed: 6 }) : undefined
    case 'blizzard': return emit(['#ffffff', '#e0f8ff', '#98d8f8'], flying(a.motion) ? 0.9 : 0.08, { gravity: 12, ttl: 0.45, speed: 10 })
    case 'pin': return emit(['#d8f070', '#a8c838', '#ffffff'], 0.35, { ttl: 0.18, speed: 3 })
    case 'megahorn': return emit(['#ffffff', '#d8dcf0', '#a8b0d0'], 0.9, { ttl: 0.4, speed: 12 })
    case 'dragonBreath': return emit(['#a070f8', '#7038f8', '#f0e0ff'], 0.5, { gravity: -30, ttl: 0.3, speed: 8 })
    case 'outrage': return emit(['#a070f8', '#f85030', '#f8d030', '#f0e0ff'], 0.7, { gravity: -40, ttl: 0.35, speed: 16 })
    default: return typeEvolvedTrail(a, emit)
  }
}

/** When a hitbox lands: its damage window opens, or it shows up (visual-only ones never open it). */
const landsAt = (a: Attack) => (a.activeFrom === Infinity ? 0 : a.activeFrom)

/** Motions that fly free of the player: a boss's time stop (`timeStop`) holds these still in mid-air. */
const FLYING: ReadonlySet<Motion['kind']> = new Set(['linear', 'homing', 'boomerang', 'drift', 'return'])

/** Whether the fight's boss holds the players' shots still now (Dialga's Roar of Time). */
const shotsHeld = (g: Game) => {
  if (g.bossId === null) return false
  const boss = g.enemies.find((e) => e.id === g.bossId)
  return boss !== undefined && boss.dying < 0 && holdsShots(boss.fight)
}

/** Moves every hitbox and lands its hits, each as the player who cast it (`Attack.owner`). */
export const updateAttacks = (g: Game, dt: number) => {
  const held = shotsHeld(g)
  const actor = g.player
  for (const a of g.attacks) {
    // Held in a time stop: it neither moves, ages nor hits until time flows again.
    if (held && a.age >= 0 && FLYING.has(a.motion.kind)) continue
    a.age += dt
    if (a.age < 0) continue
    g.player = ownerOf(g, a.owner)
    move(g, a, a.motion, dt)
    if (a.grow > 0 && a.shape.kind === 'circle') a.shape = { kind: 'circle', r: a.shape.r + a.grow * dt }
    trail(g, a)
    evolvedTick(g, a, dt)
    if (a.mod) modTick(g, a)
    if (a.turret) shoot(g, a, a.turret, dt)
    if (a.trailer) dropTrail(g, a, a.trailer)
    if (a.age > landsAt(a) && a.age - dt <= landsAt(a) + 1e-9) evolvedImpact(g, a)
    const active = a.age >= a.activeFrom && a.age <= a.activeUntil
    if (a.pull > 0 && active) pullFoes(g, a, dt)
    if (active && (a.blast === 0 || mineArmed(a.age))) collide(g, a)
    if (a.blast > 0 && a.pierce > 0 && a.age >= a.ttl) detonate(g, a, true)
  }
  g.player = actor
  retain(g.attacks, (a) => a.age < a.ttl && a.pierce > 0)
}

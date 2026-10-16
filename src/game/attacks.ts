import { dir8, dirTo, fromAngle, retain } from '../engine/math'
import { chance, range } from '../engine/rng'
import { query } from '../engine/spatial'
import { damageEnemy } from './combat'
import { mineArmed, mineBlast, TURRET_RANGE } from './moveRules'
import { nearestEnemy } from './queries'
import { spawnAttack } from './spawn'
import type { Attack, Enemy, Game, Motion, Turret } from './types'
import * as dm from '../engine/dmath'

const neighbors: number[] = []

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
      const step = Math.min(dt, m.left)
      m.left -= step
      p.x += m.vx * step
      p.y += m.vy * step
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
    ttl: 0.32, activeUntil: 0.05,
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
      damage: a.damage, knockback: a.knockback, pierce: 1, status: a.status, ttl: 1.2,
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
    if (!e || e.dying >= 0 || !overlaps(a, e)) continue
    if ((a.hits.get(e.id) ?? -1) > g.time) continue
    if (a.blast > 0) return detonate(g, a, false)
    a.hits.set(e.id, g.time + a.hitInterval)
    damageEnemy(g, e, a)
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
    case 'fireBlast': return emit(['#fff8c0', '#f8d030', '#f08030'], 0.7, { gravity: -60, ttl: 0.4 })
    case 'hydroPump': return emit(['#a8d8f8', '#4878e8', '#ffffff'], 1, { gravity: 80, speed: 24 })
    case 'leafStorm': return emit(['#70d048', '#e0f8a0'], 0.3, { ttl: 0.35 })
    case 'triAttack': return emit([['#f06020', '#ffd080'], ['#60c0f0', '#e0f8ff'], ['#f8d830', '#fff8c0']][a.id % 3]!, 0.6, { ttl: 0.25 })
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
    default: return
  }
}

/** Moves, grows and collides every attack, each acting as its owner (so motion follows them and hits count as theirs). */
export const updateAttacks = (g: Game, dt: number) => {
  const acting = g.player
  for (const a of g.attacks) {
    g.player = a.owner
    a.age += dt
    if (a.age < 0) continue
    move(g, a, a.motion, dt)
    if (a.grow > 0 && a.shape.kind === 'circle') a.shape = { kind: 'circle', r: a.shape.r + a.grow * dt }
    trail(g, a)
    if (a.turret) shoot(g, a, a.turret, dt)
    if (a.age >= a.activeFrom && a.age <= a.activeUntil && (a.blast === 0 || mineArmed(a.age))) collide(g, a)
    if (a.blast > 0 && a.pierce > 0 && a.age >= a.ttl) detonate(g, a, true)
  }
  g.player = acting
  retain(g.attacks, (a) => a.age < a.ttl && a.pierce > 0)
}

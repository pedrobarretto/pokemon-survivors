import { fromAngle, retain, TAU } from '../engine/math'
import { chance, range } from '../engine/rng'
import { query } from '../engine/spatial'
import { drainHeal } from './combat'
import { burst, floatText, shakeScreen } from './effects'
import { recomputeStats } from './leveling'
import { addMoveBuff, TIRED_SLOW, TIRED_TIME } from './signatureMoves'
import { reflectShots } from './seasonOneEggMoves'
import { recoilFor, snipeScale } from './signatureRules'
import { inheritMods } from './mods'
import { spawnAttack } from './spawn'
import { ownAttack } from './players'
import type { Attack, Enemy, Game } from './types'
import * as dm from '../engine/dmath'

/**
 * Per-tick side of the signature moves (`signatureMoves.ts`): their timed
 * effects on the player's stats, and the hitboxes that behave over time:
 * Thrash bites, Petal Dance's spiral widens, Drill Peck grinds, Leaf Tornado
 * bursts, bubbles pop, Snipe Shot fires from where the player stands, Rapid
 * Spin blows shots away, Wood Hammer's recoil, Water Shuriken grows and Spirit
 * Shackle pins. `game.ts` calls `updateSignatures` every tick, before the moves cast.
 */

const neighbors: number[] = []

/** Bites a random foe within the rampage's reach, or snaps at the air beside the player. */
const bite = (g: Game, a: Attack) => {
  const p = g.player
  const reach = a.shape.kind === 'circle' ? a.shape.r : 46
  const near: Enemy[] = []
  for (const i of query(g.grid, p.x, p.y, reach, neighbors)) {
    const e = g.enemies[i]
    if (e && e.dying < 0 && dm.sq(e.x - p.x) + dm.sq(e.y - p.y) <= reach * reach) near.push(e)
  }
  const e = near.length > 0 ? near[Math.floor(g.rng() * near.length)]! : null
  const at = e ? { x: e.x + range(g.rng, -3, 3), y: e.y - e.radius + range(g.rng, -3, 3) } : { ...fromAngle(range(g.rng, 0, TAU), 18) }
  spawnAttack(g, {
    move: a.move, type: a.type, visual: 'thrashBite', x: e ? at.x : p.x + at.x, y: e ? at.y : p.y - 10 + at.y * 0.7,
    shape: { kind: 'circle', r: 11 }, motion: { kind: 'static' },
    damage: a.damage, knockback: a.knockback, ttl: 0.26, activeFrom: 0.1, activeUntil: 0.15, flip: chance(g.rng, 0.5), ...inheritMods(a, ['trail']),
  })
}

/** Leaf Tornado's end: six blades burst outward from where it stood. */
const leafBurst = (g: Game, a: Attack) => {
  const r = a.shape.kind === 'circle' ? a.shape.r : 16
  for (let i = 0; i < 6; i++) {
    const v = fromAngle(a.id + (i / 6) * TAU, 170)
    spawnAttack(g, {
      move: a.move, type: a.type, visual: 'tornadoLeaf', x: a.x, y: a.y,
      shape: { kind: 'circle', r: 5 * (r / 16) }, motion: { kind: 'linear', vx: v.x, vy: v.y },
      damage: a.damage * 1.5, knockback: 60, pierce: 2, ttl: 0.4, ...inheritMods(a, ['trail']),
    })
  }
}

/** A bubble pops: a splash that hits around it, healing the player when it bursts close to them. */
const pop = (g: Game, a: Attack) => {
  const p = g.player
  const r = a.shape.kind === 'circle' ? a.shape.r : 7
  spawnAttack(g, {
    move: a.move, type: a.type, visual: 'bubblePop', x: a.x, y: a.y,
    shape: { kind: 'circle', r: r * 2.6 }, motion: { kind: 'static' },
    damage: a.damage, knockback: a.knockback, ttl: 0.3, activeUntil: 0.06, ...inheritMods(a, ['trail']),
  })
  if (dm.sq(a.x - p.x) + dm.sq(a.y - (p.y - 10)) < dm.sq(ARIA_HEAL_REACH)) {
    const healed = drainHeal(g, p.stats.maxHp * ARIA_HEAL, 1)
    if (healed >= 1) burst(g, p.x, p.y - 12, { colors: ['#a8e8ff', '#ffffff', '#78f8b8'], count: 5, speed: 30, ttl: 0.5, gravity: -60 })
  }
  a.ttl = a.age
}

/** A bubble bursting this close to the player heals this share of max HP (through the drain budget). */
const ARIA_HEAL_REACH = 50
const ARIA_HEAL = 0.02

const touchesFoe = (g: Game, a: Attack) => {
  const r = a.shape.kind === 'circle' ? a.shape.r : 7
  for (const i of query(g.grid, a.x, a.y, r + 24, neighbors)) {
    const e = g.enemies[i]
    if (e && e.dying < 0 && dm.sq(e.x - a.x) + dm.sq(e.y - e.radius - a.y) < dm.sq(r + e.radius)) return true
  }
  return false
}

/** Hits landed since the last look (the hit list only grows), so per-hit effects fire once each. */
const newHits = (a: Attack) => {
  const fresh = a.hits.size - a.memo
  a.memo = a.hits.size
  return fresh
}

const enemyById = (g: Game, id: number) => g.enemies.find((e) => e.id === id)

/** Runs the moves' timed stat effects: folds new ones into the stats and takes spent ones off. */
const updateMoveBuffs = (g: Game, dt: number) => {
  const buffs = g.player.moveBuffs
  if (buffs.length === 0) return
  let dirty = false
  for (const b of buffs) {
    if (!b.applied) {
      b.applied = true
      dirty = true
    }
    b.left -= dt
    if (b.left <= 0) dirty = true
  }
  retain(buffs, (b) => b.left > 0)
  if (dirty) recomputeStats(g)
}

export const updateSignatures = (g: Game, dt: number) => {
  updateMoveBuffs(g, dt)
  const p = g.player
  for (const a of g.attacks) {
    if (!ownAttack(g, a)) continue
    switch (a.visual) {
      case 'thrash': {
        if (a.age < 0) break
        a.memo -= dt
        for (; a.memo <= 0; a.memo += a.hitInterval) bite(g, a)
        if (a.age + dt >= a.ttl) addMoveBuff(g, 'thrash', TIRED_TIME, { speed: -p.stats.speed * TIRED_SLOW })
        break
      }
      case 'petal':
        if (a.age >= 0 && a.motion.kind === 'orbit') a.motion.radius += a.memo * dt
        break
      case 'drill': {
        if (a.age < 0 || a.motion.kind !== 'linear') break
        let grinding = false
        for (const until of a.hits.values()) if (until > g.now) grinding = true
        const v = dm.hypot(a.motion.vx, a.motion.vy) || 1
        const want = a.memo * (grinding ? 0.22 : 1)
        const k = (v + (want - v) * Math.min(1, dt * 18)) / v
        a.motion.vx *= k
        a.motion.vy *= k
        break
      }
      case 'leafTornado':
        if (a.age + dt >= a.ttl && a.memo === 0) {
          a.memo = 1
          leafBurst(g, a)
        }
        break
      case 'bubble':
        if (a.age >= 0 && (a.age + dt >= a.ttl || touchesFoe(g, a))) pop(g, a)
        break
      case 'snipeShot': {
        if (a.motion.kind !== 'linear') break
        // The crosshair is done: the shot leaves from where the player stands now, towards it.
        if (a.age < 0 && a.age + dt >= 0) {
          a.x = p.x
          a.y = p.y - 8
          const d = dm.hypot(a.from.x - a.x, a.from.y - a.y) || 1
          const v = dm.hypot(a.motion.vx, a.motion.vy)
          a.motion.vx = ((a.from.x - a.x) / d) * v
          a.motion.vy = ((a.from.y - a.y) / d) * v
          g.events.push({ kind: 'cast', move: 'snipeShot' })
        }
        if (a.age >= 0) a.damage = a.memo * snipeScale(a.age * dm.hypot(a.motion.vx, a.motion.vy))
        break
      }
      case 'protect':
        if (a.move === 'magicCoat') reflectShots(g, a)
        break
      case 'rapidSpin': {
        if (a.shape.kind !== 'circle') break
        const r = a.shape.r + 4
        for (const h of g.hazards) {
          if (h.kind !== 'shot' || dm.sq(h.x - a.x) + dm.sq(h.y - 6 - a.y) > dm.sq(r + h.r)) continue
          h.ttl = h.age
          burst(g, h.x, h.y - 6, { colors: ['#ffffff', '#c8d8f8'], count: 6, speed: 90, ttl: 0.25 })
        }
        break
      }
      case 'hammer':
        if (a.age < a.activeFrom && a.age + dt >= a.activeFrom) {
          shakeScreen(g, 4)
          g.events.push({ kind: 'cast', move: 'woodHammer' })
          burst(g, a.x, a.y + 6, { colors: ['#a07840', '#d8c080', '#685028'], count: 14, speed: 90, ttl: 0.4, gravity: 200, size: 2 })
        }
        if (a.age > a.activeUntil && a.memo === 0) {
          a.memo = 1
          const recoil = a.hits.size > 0 ? recoilFor(p.hp, p.stats.maxHp) : 0
          if (recoil > 0) {
            p.hp -= recoil
            floatText(g, p.x, p.y - 28, String(recoil), '#f8a060', true)
          }
        }
        break
      case 'shuriken': {
        // Water Shuriken swells with every foe it cuts.
        if (a.move !== 'waterShuriken' || a.shape.kind !== 'circle') break
        for (let n = newHits(a); n > 0; n--) {
          a.shape = { kind: 'circle', r: Math.min(a.shape.r * 1.3, 14) }
          a.damage *= 1.25
        }
        break
      }
      case 'arrow': {
        // Spirit Shackle pins each foe it goes through to its shadow.
        if (a.move !== 'spiritShackle') break
        const fresh = newHits(a)
        if (fresh <= 0) break
        for (const id of [...a.hits.keys()].slice(-fresh)) {
          const e = enemyById(g, id)
          if (!e || e.dying >= 0) continue
          spawnAttack(g, {
            move: a.move, type: a.type, visual: 'pinShadow', x: e.x, y: e.y,
            shape: { kind: 'circle', r: e.radius }, motion: { kind: 'static' },
            damage: 0, ttl: e.boss ? 0.4 : 0.8, activeFrom: Infinity,
          })
        }
        break
      }
      case 'eruptionFall':
        // The bombs land with a thud.
        if (a.age < a.ttl && a.age + dt >= a.ttl) shakeScreen(g, 1.5)
        break
    }
  }
}

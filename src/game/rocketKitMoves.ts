import { dirTo, fromAngle } from '../engine/math'
import * as dm from '../engine/dmath'
import { range } from '../engine/rng'
import type { PokeType } from '../data/types'
import type { DamageBonus } from './kitRules'
import type { Look, MoveDef, MoveId, MoveStats } from './moves'
import { enemiesInView, isAlive, nearestEnemy } from './queries'
import { rainMult } from './rocketKitRules'
import { coinsHeld, transformInto } from './rocketKitSystem'
import { spawnAttack } from './spawn'
import type { Enemy, Game, Visual } from './types'

/**
 * The Rocket Game Corner's prize families' signature moves
 * (`data/rocketFamilies.ts`): each reads its family's state (`Player.rocket`)
 * in `fire`. Numbers live here and the look in `render/rocketKitFx.ts`.
 * Seeded rng and `dmath` only, and no `moves.ts` at runtime (it is evaluated
 * first): only its types.
 */

const stats = (s: Partial<MoveStats>): MoveStats => ({
  damage: 0, cooldown: 1, area: 1, amount: 1, speed: 0, duration: 1, pierce: Infinity, knockback: 0, statusChance: 0, statusDamage: 0, ...s,
})

const look = (move: MoveId, type: PokeType, visual: Visual): Look => ({ move, type, visual })

const cast = (g: Game, move: MoveId) => g.events.push({ kind: 'cast', move })

/** Razor Wind cuts deeper into a foe Absol's Omen doomed (or anything else marked). */
const OMEN_CUT: readonly DamageBonus[] = [{ when: 'marked', mult: 1.3 }]

/** Who Ditto copies: the boss in reach, else an elite, else the nearest foe. */
const copyTarget = (g: Game, reach: number): Enemy | null => {
  const p = g.player
  const r2 = reach * reach
  let pick: Enemy | null = null
  let rank = -1
  let bestD = Infinity
  for (const e of g.enemies) {
    if (!isAlive(e) || e.behavior.kind === 'avatar') continue
    const d = dm.sq(e.x - p.x) + dm.sq(e.y - p.y)
    if (d > r2) continue
    const r = e.boss ? 2 : e.elite ? 1 : 0
    if (r > rank || (r === rank && d < bestD)) {
      pick = e
      rank = r
      bestD = d
    }
  }
  return pick
}

export const ROCKET_KIT_MOVES = {
  /* Ditto: Transforms into the strongest foe near it, copying its look, type and a stat, and strikes it as that type. */
  transform: {
    name: 'Transform',
    type: 'normal',
    base: stats({ damage: 10, cooldown: 4.5, knockback: 40 }),
    upgrades: [
      { damage: 3 },
      { amount: 1 },
      { fork: [{ stats: { damage: 3 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.4 }, mods: ['echo'] }] },
      { damage: 3 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 4 }, mods: ['hunter'] }, { stats: { amount: 1 }, mods: ['drain'] }] },
      { damage: 4 },
    ],
    fire: (g, s) => {
      const p = g.player
      const foe = copyTarget(g, 180)
      if (foe) transformInto(g, foe)
      const kit = p.rocket
      const type: PokeType = kit?.kind === 'transform' && kit.dex !== 0 ? kit.type : 'normal'
      // The copy strike: the foe it copied first, then the next nearest ones, as the copied type.
      const hit = new Set<number>()
      for (let i = 0; i < s.amount; i++) {
        const target = i === 0 && foe ? foe : nearestEnemy(g, p.x, p.y, 160, hit)
        if (!target) break
        hit.add(target.id)
        spawnAttack(g, {
          ...look('transform', type, 'transformSplash'), x: target.x, y: target.y - target.radius,
          shape: { kind: 'circle', r: 14 * s.area }, motion: { kind: 'static' },
          damage: s.damage, knockback: s.knockback, ttl: 0.42, activeUntil: 0.08, age: -i * 0.08,
        })
      }
      cast(g, 'transform')
    },
  },

  /* Absol: crescent blades of wind, flung at the foe its Omen doomed (else the nearest). */
  razorWind: {
    name: 'Razor Wind',
    type: 'normal',
    base: stats({ damage: 9, cooldown: 1.7, speed: 210, pierce: 2, amount: 2, knockback: 24 }),
    tags: ['slice'],
    upgrades: [
      { damage: 2 },
      { pierce: 1 },
      { fork: [{ stats: { damage: 2 }, mods: ['execute'] }, { stats: { amount: 1 }, mods: ['seek'] }] },
      { damage: 2 },
      { cooldown: -0.15 },
      { fork: [{ stats: { damage: 3 }, mods: ['cruel'] }, { stats: { amount: 1 }, mods: ['split'] }] },
      { damage: 3 },
    ],
    fire: (g, s) => {
      const p = g.player
      const kit = p.rocket
      const doomed = kit?.kind === 'omen' && kit.target !== 0 ? (g.enemies.find((e) => e.id === kit.target && isAlive(e)) ?? null) : null
      const target = doomed ?? nearestEnemy(g, p.x, p.y, 240)
      const aim = target ? dirTo(p.x, p.y - 8, target.x, target.y - target.radius) : p.facing
      const center = dm.atan2(aim.y, aim.x)
      for (let i = 0; i < s.amount; i++) {
        const angle = center + (i - (s.amount - 1) / 2) * 0.22
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          ...look('razorWind', 'normal', 'razorWind'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 8 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, ttl: 1.1, age: -i * 0.05, bonus: OMEN_CUT, flip: v.x < 0,
        })
      }
      cast(g, 'razorWind')
    },
  },

  /* Gimmighoul's line: coins rain down on the foes around, heavier the more coins it gathered this run. */
  makeItRain: {
    name: 'Make It Rain',
    type: 'steel',
    base: stats({ damage: 7, cooldown: 2, amount: 4, knockback: 16 }),
    upgrades: [
      { damage: 2 },
      { amount: 1 },
      { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.25 }, mods: ['arc'] }] },
      { damage: 2 },
      { amount: 1 },
      { fork: [{ stats: { damage: 3 }, mods: ['cruel'] }, { stats: { area: 0.25 }, mods: ['echo'] }] },
      { damage: 3 },
    ],
    fire: (g, s) => {
      const p = g.player
      const mult = rainMult(coinsHeld(p))
      // Gholdengo throws two more coins than Gimmighoul.
      const coins = s.amount + (p.stage >= 1 ? 2 : 0)
      const foes = enemiesInView(g).filter((e) => e.behavior.kind !== 'avatar' && dm.sq(e.x - p.x) + dm.sq(e.y - p.y) < 200 * 200)
      for (let i = 0; i < coins; i++) {
        const foe = foes.length > 0 ? foes[Math.floor(range(g.rng, 0, foes.length)) % foes.length]! : null
        const x = (foe ? foe.x : p.x + range(g.rng, -60, 60)) + range(g.rng, -8, 8)
        const y = (foe ? foe.y : p.y + range(g.rng, -44, 44)) + range(g.rng, -6, 6)
        spawnAttack(g, {
          ...look('makeItRain', 'steel', 'coinRain'), x, y,
          shape: { kind: 'circle', r: 9 * s.area }, motion: { kind: 'static' },
          damage: s.damage * mult, knockback: s.knockback, ttl: 0.62, activeFrom: 0.3, activeUntil: 0.38, age: -i * 0.06,
        })
      }
      cast(g, 'makeItRain')
    },
  },

  /* Mawile: the great jaws on the back of its head snap shut behind it (both ways as a Mega). */
  viseGrip: {
    name: 'Vise Grip',
    type: 'normal',
    base: stats({ damage: 14, cooldown: 1.5, knockback: 60 }),
    status: { kind: 'slow', chance: 0.6, duration: 1.2, power: 0.5 },
    tags: ['bite'],
    upgrades: [
      { damage: 3 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 3 }, mods: ['execute'] }, { stats: { cooldown: -0.2 }, mods: ['drain'] }] },
      { damage: 3 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 4 }, mods: ['hunter'] }, { stats: { cooldown: -0.2 }, mods: ['burstOnKill'] }] },
      { damage: 4 },
    ],
    fire: (g, s) => {
      const p = g.player
      const sides = p.mega.active > 0 ? [-1, 1] : [-1]
      for (const side of sides) {
        const d = { x: p.facing.x * 20 * side, y: p.facing.y * 14 * side }
        spawnAttack(g, {
          ...look('viseGrip', 'normal', 'viseGrip'), x: p.x + d.x, y: p.y - 8 + d.y,
          shape: { kind: 'circle', r: 18 * s.area }, motion: { kind: 'follow', ox: d.x, oy: d.y - 8 },
          damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.34, activeFrom: 0.1, activeUntil: 0.18, flip: d.x > 0,
        })
      }
      cast(g, 'viseGrip')
    },
  },
} as const satisfies Record<string, MoveDef>

export const ROCKET_KIT_MOVE_IDS = Object.keys(ROCKET_KIT_MOVES) as ReadonlyArray<keyof typeof ROCKET_KIT_MOVES>

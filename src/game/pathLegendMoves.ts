import { dirTo, fromAngle } from '../engine/math'
import { burst, shakeScreen } from './effects'
import { aimAt, cast, crowdTargets, fan, look, stats, tookB } from './legendaryMoves'
import { returnShot, strike } from './moveKit'
import type { MoveDef } from './moves'
import { enemiesInView, nearestEnemy } from './queries'
import { spawnAttack } from './spawn'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'

/**
 * Legendary moves, third batch: the capstones of the path legends
 * (`data/legendPaths.ts`), so each has one (`LEGENDARY_MOVE_OF`). Same tier
 * and rules as the others (`legendaryMoves.ts`): Lv1–5 with a fork at Lv4,
 * `legendary: true`, never evolve. Their art is `render/pathLegendFx.ts`.
 *
 * This module must not import `moves.ts` at runtime (it is evaluated first).
 */

/** The visuals of this batch, drawn by `render/pathLegendFx.ts`. */
export type PathLegendVisual =
  | 'coreStroke' | 'coreCell' | 'sunComet' | 'sunBurst' | 'moonBeam' | 'moonOrb' | 'wickedFist' | 'surgingStrike'
  | 'ironNut' | 'ironSlam' | 'gripHand'

/** Core Enforcer: the Z's width and height (× area), how long each stroke takes to draw, the segments per stroke and their radius. */
export const CORE = { w: 120, h: 76, stroke: 0.12, segments: 9, r: 9 } as const
/** Sunsteel Strike: the comet's reach (and how far past its crowd it stops) and radius, the burst's radius (× area) and share of the damage. */
export const SUNSTEEL = { reach: 230, past: 26, r: 13, burst: 52, share: 0.8, grow: 0.22 } as const
/** Moongeist Beam: the beam's length (× area), its arc and seconds, segments, and the moon orb it leaves where it ends. */
export const MOONGEIST = { length: 190, arc: 1.7, time: 0.75, segments: 10, r: 9, orb: 26, orbTime: 1.4 } as const
/** Wicked Blow: the strike's wind-up, radius (× area) and reach; Surging Strikes (Rapid Strike Style): its blows and their share. */
export const WICKED = { delay: 0.14, r: 20, reach: 170, surge: 3, surgeShare: 0.5, surgeGap: 0.09 } as const
/** Double Iron Bash: the nuts' reach and radius, the slam's radius (× area), delay after the cast and share of the damage. */
export const IRON_BASH = { reach: 120, r: 9, slam: 46, delay: 0.55, share: 1.2 } as const
/** Crush Grip: the hand's reach, its squeezes and their beat, and how much more it hurts the big ones. */
export const GRIP = { reach: 240, squeezes: 5, beat: 0.18, big: 1.6 } as const

/** Whether the acting player plays Urshifu in its Rapid Strike Style now (Kubfu's second awakening, the Tower of Waters climbed). */
export const rapidStrike = (g: Game) => {
  const s = g.player.legend
  return s !== null && s.id === 'kubfu' && s.awakened >= 2 && s.forms.includes('urshifuRapid')
}

/** The foe in view with the most HP within Crush Grip's reach, past the ones already held. */
const toughest = (g: Game, taken: ReadonlySet<number>): Enemy | null => {
  const p = g.player
  let best: Enemy | null = null
  for (const e of enemiesInView(g)) {
    if (taken.has(e.id) || dm.sq(e.x - p.x) + dm.sq(e.y - p.y) > GRIP.reach * GRIP.reach) continue
    if (!best || e.hp > best.hp) best = e
  }
  return best
}

export const PATH_LEGEND_MOVES = {
  /* Zygarde */
  coreEnforcer: {
    name: 'Core Enforcer',
    type: 'dragon',
    legendary: true,
    base: stats({ damage: 42, cooldown: 3.2, amount: 1, knockback: 40 }),
    status: { kind: 'slow', chance: 1, duration: 1.6, power: 0.4 },
    upgrades: [
      { damage: 10 },
      { area: 0.15 },
      { fork: [{ stats: { amount: 1, damage: -4 } }, { stats: { damage: 12 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.5, damage: 10 },
    ],
    // Zygarde's core draws a Z of green light over the densest crowd, stroke by stroke: what it crosses is held down (slowed).
    fire: (g, s) => {
      const p = g.player
      const targets = crowdTargets(g, s.amount, 110, 240)
      const w = CORE.w * s.area
      const h = CORE.h * Math.min(1.3, s.area)
      for (let i = 0; i < s.amount; i++) {
        const t = targets[i]
        const cx = t ? t.x : p.x + (i % 2 === 0 ? 70 : -70)
        const cy = t ? t.y : p.y - 10
        const corners = [
          { x: cx - w / 2, y: cy - h / 2 },
          { x: cx + w / 2, y: cy - h / 2 },
          { x: cx - w / 2, y: cy + h / 2 },
          { x: cx + w / 2, y: cy + h / 2 },
        ]
        const delay = i * 0.2
        for (let k = 0; k < 3; k++) {
          const a = corners[k]!
          const b = corners[k + 1]!
          const at = -(delay + k * CORE.stroke)
          const hits = new Map<number, number>()
          for (let n = 0; n < CORE.segments; n++) {
            const f = n / (CORE.segments - 1)
            spawnAttack(g, {
              ...look('coreEnforcer', 'dragon', 'hitbox'), x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f,
              shape: { kind: 'circle', r: CORE.r * s.area }, motion: { kind: 'static' },
              damage: s.damage, knockback: s.knockback, status: s.status, hits, ttl: 0.1, age: at - f * CORE.stroke,
            })
          }
          // The stroke's light, drawn from `from` to its end, as long as the Z stands.
          spawnAttack(g, {
            ...look('coreEnforcer', 'dragon', 'coreStroke'), x: b.x, y: b.y, from: { x: a.x, y: a.y },
            shape: { kind: 'circle', r: CORE.r }, motion: { kind: 'static' },
            damage: 0, activeFrom: Infinity, ttl: 0.55 + (2 - k) * CORE.stroke, age: at, memo: k,
          })
        }
        for (const [n, c] of corners.entries()) {
          spawnAttack(g, {
            ...look('coreEnforcer', 'dragon', 'coreCell'), x: c.x, y: c.y,
            shape: { kind: 'circle', r: 5 }, motion: { kind: 'static' },
            damage: 0, activeFrom: Infinity, ttl: 0.7, age: -(delay + Math.max(0, n - 1) * CORE.stroke), memo: n,
          })
        }
      }
      cast(g, 'coreEnforcer')
    },
  },

  /* Solgaleo */
  sunsteelStrike: {
    name: 'Sunsteel Strike',
    type: 'steel',
    legendary: true,
    base: stats({ damage: 58, cooldown: 3.2, amount: 1, speed: 300, knockback: 120 }),
    upgrades: [
      { damage: 14 },
      { area: 0.15 },
      { fork: [{ stats: { amount: 1, damage: -6 } }, { stats: { damage: 16 }, mods: ['echo'] }] },
      { cooldown: -0.5, damage: 12 },
    ],
    // Solgaleo becomes a comet of sunlight: it tears through the crowd in a line and bursts like a small sun where it stops.
    fire: (g, s) => {
      const p = g.player
      const crowd = crowdTargets(g, 1, 0, 260)[0] ?? null
      // It stops just past the crowd it aimed at, so the sun bursts among them; with none in reach, at its full length.
      const far = SUNSTEEL.reach * Math.max(1, s.area * 0.9)
      const reach = crowd ? Math.min(far, dm.hypot(crowd.x - p.x, crowd.y - p.y) + SUNSTEEL.past) : far
      for (const angle of fan(aimAt(g, 260, crowd), s.amount, 0.6)) {
        const v = fromAngle(angle, s.speed)
        const flight = reach / s.speed
        spawnAttack(g, {
          ...look('sunsteelStrike', 'steel', 'sunComet'), x: p.x, y: p.y - 10,
          shape: { kind: 'circle', r: SUNSTEEL.r * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, ttl: flight, memo: angle,
        })
        const end = fromAngle(angle, reach)
        const r = SUNSTEEL.burst * s.area
        spawnAttack(g, {
          ...look('sunsteelStrike', 'steel', 'sunBurst'), x: p.x + end.x, y: p.y - 10 + end.y,
          shape: { kind: 'circle', r: 8 }, motion: { kind: 'static' },
          damage: s.damage * SUNSTEEL.share, knockback: s.knockback, ttl: SUNSTEEL.grow + 0.2, grow: (r - 8) / SUNSTEEL.grow, age: -flight, memo: r,
        })
      }
      cast(g, 'sunsteelStrike')
    },
  },

  /* Lunala */
  moongeistBeam: {
    name: 'Moongeist Beam',
    type: 'ghost',
    legendary: true,
    base: stats({ damage: 24, cooldown: 3, amount: 1, knockback: 20 }),
    upgrades: [
      { damage: 6 },
      { area: 0.15 },
      { fork: [{ stats: { amount: 1, damage: -2 } }, { stats: { damage: 6 }, mods: ['drain'] }] },
      { cooldown: -0.5, damage: 6 },
    ],
    // Lunala's wings open and a beam of moonlight sweeps the field, hitting all it passes over again and again; a moon lingers at its end.
    fire: (g, s) => {
      const p = g.player
      const length = MOONGEIST.length * s.area
      for (const [i, center] of fan(aimAt(g, 240), s.amount, Math.PI).entries()) {
        const from = center - MOONGEIST.arc / 2
        const arc = i % 2 === 0 ? MOONGEIST.arc : -MOONGEIST.arc
        const start = i % 2 === 0 ? from : from + MOONGEIST.arc
        const spin = arc / MOONGEIST.time
        const hits = new Map<number, number>()
        for (let n = 0; n < MOONGEIST.segments; n++) {
          const radius = 14 + ((length - 14) * n) / (MOONGEIST.segments - 1)
          spawnAttack(g, {
            ...look('moongeistBeam', 'ghost', n === MOONGEIST.segments - 1 ? 'moonBeam' : 'hitbox'),
            x: p.x + dm.cos(start) * radius, y: p.y - 8 + dm.sin(start) * radius,
            shape: { kind: 'circle', r: MOONGEIST.r * s.area }, motion: { kind: 'orbit', angle: start, spin, radius },
            damage: s.damage, knockback: s.knockback, hitInterval: 0.25, hits, ttl: MOONGEIST.time, memo: radius,
          })
        }
        const end = fromAngle(start + arc, length)
        spawnAttack(g, {
          ...look('moongeistBeam', 'ghost', 'moonOrb'), x: p.x + end.x, y: p.y - 8 + end.y,
          shape: { kind: 'circle', r: MOONGEIST.orb * s.area }, motion: { kind: 'static' },
          damage: s.damage * 0.5, hitInterval: 0.35, ttl: MOONGEIST.orbTime, age: -MOONGEIST.time,
        })
      }
      cast(g, 'moongeistBeam')
    },
  },

  /* Kubfu, and Urshifu after it */
  wickedBlow: {
    name: 'Wicked Blow',
    type: 'dark',
    legendary: true,
    base: stats({ damage: 66, cooldown: 1.9, amount: 1, knockback: 150 }),
    upgrades: [
      { damage: 16 },
      { area: 0.15 },
      { fork: [{ stats: { amount: 1, damage: -6 } }, { stats: { damage: 18 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.35, damage: 14 },
    ],
    // One blow at the nearest foe, never pulled; Urshifu's Rapid Strike Style throws it as Surging Strikes instead, a flurry of water blows spread over the closest ones.
    fire: (g, s, owned) => {
      const p = g.player
      const rapid = rapidStrike(g)
      const taken = new Set<number>()
      for (let i = 0; i < s.amount; i++) {
        const foe = nearestEnemy(g, p.x, p.y, WICKED.reach, taken)
        if (foe) taken.add(foe.id)
        const d = foe ? dirTo(p.x, p.y, foe.x, foe.y) : p.facing
        const x = foe ? foe.x : p.x + d.x * 34
        const y = foe ? foe.y - foe.radius : p.y - 8 + d.y * 34
        if (!rapid) {
          const hit = strike(g, s, look('wickedBlow', 'dark', 'wickedFist'), x, y, WICKED.r * s.area, WICKED.delay + i * 0.1, 0.35)
          hit.memo = dm.atan2(d.y, d.x)
          continue
        }
        for (let k = 0; k < WICKED.surge; k++) {
          const hit = strike(g, { ...s, damage: s.damage * WICKED.surgeShare }, look('wickedBlow', 'water', 'surgingStrike'), x + (k - 1) * 6, y + ((k % 2) * 2 - 1) * 4, WICKED.r * 0.8 * s.area, WICKED.delay * 0.6 + k * WICKED.surgeGap + i * 0.08, 0.25)
          hit.memo = k
        }
      }
      if (tookB(owned) && !rapid) shakeScreen(g, 1.5)
      cast(g, 'wickedBlow')
    },
  },

  /* Meltan, and Melmetal after it */
  doubleIronBash: {
    name: 'Double Iron Bash',
    type: 'steel',
    legendary: true,
    base: stats({ damage: 34, cooldown: 2.6, amount: 2, speed: 220, knockback: 70 }),
    upgrades: [
      { damage: 8 },
      { area: 0.15 },
      { fork: [{ stats: { amount: 2, damage: -3 } }, { stats: { damage: 10 }, mods: ['arc'] }] },
      { cooldown: -0.4, damage: 8 },
    ],
    // Two hex nuts spin out at the foes and come back; as they land the ground takes an iron slam all around.
    fire: (g, s) => {
      const p = g.player
      const aim = aimAt(g, 200)
      for (let i = 0; i < s.amount; i++) {
        const angle = aim + (i % 2 === 0 ? 1 : -1) * 0.35 * Math.ceil((i + 1) / 2) + (i >= 2 ? Math.PI : 0)
        const nut = returnShot(g, s, look('doubleIronBash', 'steel', 'ironNut'), angle, IRON_BASH.reach * Math.max(1, s.area), IRON_BASH.r)
        nut.memo = i
      }
      const r = IRON_BASH.slam * s.area
      spawnAttack(g, {
        ...look('doubleIronBash', 'steel', 'ironSlam'), x: p.x, y: p.y - 2,
        shape: { kind: 'circle', r: 10 }, motion: { kind: 'follow', ox: 0, oy: -2 },
        damage: s.damage * IRON_BASH.share, knockback: s.knockback * 1.4, ttl: 0.3, grow: (r - 10) / 0.2, age: -IRON_BASH.delay, memo: r,
      })
      cast(g, 'doubleIronBash')
    },
  },

  /* Regigigas */
  crushGrip: {
    name: 'Crush Grip',
    type: 'normal',
    legendary: true,
    base: stats({ damage: 30, cooldown: 3, amount: 1, knockback: 0 }),
    upgrades: [
      { damage: 8 },
      { amount: 1 },
      { fork: [{ stats: { damage: 8, area: 0.15 } }, { stats: { damage: 6 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.5, damage: 8 },
    ],
    // A giant's hand closes on the toughest foes in view and crushes them, squeeze after squeeze: the bigger they are, the harder.
    fire: (g, s) => {
      const taken = new Set<number>()
      for (let i = 0; i < s.amount; i++) {
        const foe = toughest(g, taken)
        if (!foe) break
        taken.add(foe.id)
        spawnAttack(g, {
          ...look('crushGrip', 'normal', 'gripHand'), x: foe.x, y: foe.y - foe.radius,
          shape: { kind: 'circle', r: Math.max(10, foe.radius) * s.area }, motion: { kind: 'tether', target: foe, every: GRIP.beat, next: GRIP.beat },
          damage: s.damage, activeFrom: Infinity, ttl: GRIP.beat * (GRIP.squeezes + 1), memo: foe.radius,
          bonus: [{ when: 'boss', mult: GRIP.big }, { when: 'elite', mult: GRIP.big }],
        })
        burst(g, foe.x, foe.y - foe.radius, { colors: ['#f8f0d8', '#d8d0b8', '#a89878'], count: 10, speed: 60, ttl: 0.4 })
      }
      cast(g, 'crushGrip')
    },
  },
} as const satisfies Record<string, MoveDef>

export type PathLegendMoveId = keyof typeof PATH_LEGEND_MOVES

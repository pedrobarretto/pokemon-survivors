import type { PokeType } from '../data/types'
import { burrow, guard, returnShot, strike, sweep, throwFoe, trailer, wanderer } from './moveKit'
import { moveStats, type MoveId } from './moves'
import { enemiesInView } from './queries'
import { spawnAttack } from './spawn'
import { applyStatus, type StatusKind } from './status'
import type { Game, Visual } from './types'
import * as dm from '../engine/dmath'

/** The demos `ps.kit()` stages. */
export const KIT_DEMOS = ['status', 'sweep', 'return', 'pull', 'strike', 'trailer', 'wander', 'guard', 'burrow', 'throw', 'execute', 'drain'] as const
export type KitDemo = (typeof KIT_DEMOS)[number]

const DEMO_STATUSES = ['freeze', 'mark', 'confuse', 'seed', 'sleep'] as const satisfies readonly StatusKind[]

/**
 * Dev-console stage for the move kit (`moveKit.ts`): `ps.kit('sweep')` and
 * friends cast a primitive with stand-in moves (no new `MOVES` entry), so each
 * mechanic can be seen and screenshotted. `ps.kit('status')` puts the newer
 * conditions on the foes in view, one kind each in turn.
 * Wired in `main.ts` for dev builds only.
 */
export const kitDevTools = (game: () => Game | undefined) => ({
  kit: (demo: KitDemo = 'status', kind?: StatusKind) => {
    const g = game()
    if (!g) return console.warn('ps: start a run first')
    const p = g.player
    const s = { ...moveStats('hex', 1, p.stats), damage: 18, speed: 220, knockback: 20, pierce: Infinity }
    const look = (move: MoveId, type: PokeType, visual: Visual) => ({ move, type, visual })
    const facing = dm.atan2(p.facing.y, p.facing.x)
    const foes = enemiesInView(g).sort((a, b) => dm.sq(a.x - p.x) + dm.sq(a.y - p.y) - (dm.sq(b.x - p.x) + dm.sq(b.y - p.y)) || a.id - b.id)
    switch (demo) {
      case 'status':
        return foes.forEach((e, i) => {
          const k = kind ?? DEMO_STATUSES[i % DEMO_STATUSES.length]!
          const spec = { kind: k, chance: 1, duration: 60, power: k === 'mark' ? 0.15 : k === 'seed' ? 0.3 : 0 }
          for (let n = 0; n < (k === 'mark' ? 1 + (i % 3) : 1); n++) applyStatus(e.status, spec, 10, e.boss, 'hex')
        })
      case 'sweep':
        return sweep(g, s, look('hex', 'ghost', 'beam'), { from: facing - 1.1, arc: 2.2, time: 0.9, length: 96, segments: 10, r: 7 })
      case 'return':
        return [-0.35, 0, 0.35].forEach((d) => returnShot(g, s, look('razorLeaf', 'grass', 'leaf'), facing + d, 110, 6))
      case 'pull':
        return void spawnAttack(g, {
          ...look('whirlpool', 'water', 'whirlpool'), x: p.x + p.facing.x * 70, y: p.y + p.facing.y * 70,
          shape: { kind: 'circle', r: 46 }, motion: { kind: 'static' },
          damage: 4, hitInterval: 0.5, ttl: 4, pull: 160,
        })
      case 'strike':
      case 'execute':
        return foes.slice(0, 6).forEach((e, i) => {
          const hit = strike(g, s, look('thunder', 'electric', 'thunder'), e.x, e.y, 16, 0.8 + i * 0.12, 0.35)
          if (demo === 'execute') hit.execute = 0.9
        })
      case 'trailer':
        return void trailer(g, s, look('ember', 'fire', 'fireTrail'), { every: 10, r: 8, ttl: 1.5, share: 0.3, duration: 6 })
      case 'wander':
        for (let i = 0; i < 4; i++) wanderer(g, s, look('disarmingVoice', 'fairy', 'heart'), { r: 6, speed: 70, ttl: 6 })
        return
      case 'guard':
        return guard(g, 'hex', 4)
      case 'burrow':
        return burrow(g, 'hex', 3)
      case 'throw': {
        const e = foes[0]
        const to = foes[foes.length - 1]
        if (!e) return
        const angle = to && to !== e ? dm.atan2(to.y - e.y, to.x - e.x) : facing
        return throwFoe(g, e, angle, 900 * e.mass, 30, 'hex')
      }
      case 'drain':
        return void spawnAttack(g, {
          ...look('hex', 'ghost', 'gust'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 10 }, motion: { kind: 'follow', ox: 0, oy: -8 },
          damage: 30, hitInterval: 0.3, ttl: 4, grow: 12, drain: 0.5,
        })
    }
  },
})

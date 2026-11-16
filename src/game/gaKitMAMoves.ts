import { dirTo, fromAngle } from '../engine/math'
import * as dm from '../engine/dmath'
import type { PokeType } from '../data/types'
import { atStage, KIT_MA } from './gaKitMARules'
import { GA_KIT_MA_UPGRADES } from './gaKitMAUpgrades'
import { burrow, throwFoe } from './moveKit'
import { LUNGE_IFRAMES, LUNGE_MIN_COOLDOWN } from './moveRules'
import type { CastStats, Look, MoveDef, MoveId, MoveStats } from './moves'
import { nearestEnemy } from './queries'
import { spawnAttack } from './spawn'
import type { Game, Visual } from './types'

/**
 * The Mega families' signatures, one per family (`data/gaMegaFamiliesA.ts`).
 * Drill Run digs (it opens Drilbur's holes, `gaKitMASystem.ts`), Storm Throw
 * throws a clamped foe over Pinsir's shoulder and Hyper Voice swells with
 * Drampa's rage (its area). Their steps live in `gaKitMAUpgrades.ts`, their
 * look in `render/gaKitMAFx.ts`. Seeded rng and `dmath` only, and no
 * `moves.ts` at runtime (it is evaluated first): only its types.
 */

const stats = (s: Partial<MoveStats>): MoveStats => ({
  damage: 0, cooldown: 1, area: 1, amount: 1, speed: 0, duration: 1, pierce: Infinity, knockback: 0, statusChance: 0, statusDamage: 0, ...s,
})

const look = (move: MoveId, type: PokeType, visual: Visual): Look => ({ move, type, visual })

/** Lets the shell play the move's own sound (`ui/castSounds.ts`). */
const cast = (g: Game, move: MoveId) => g.events.push({ kind: 'cast', move })

/** Toward the nearest foe within `reach`, else where the player faces. */
const aimAngle = (g: Game, reach: number) => {
  const p = g.player
  const target = nearestEnemy(g, p.x, p.y, reach)
  const d = target ? dirTo(p.x, p.y, target.x, target.y) : p.facing
  return dm.atan2(d.y, d.x)
}

/** A short hit glued to the player, `dist` px toward `angle`, `delay` s from now. */
const jab = (g: Game, s: CastStats, l: Look, angle: number, dist: number, r: number, delay: number, ttl: number) => {
  const d = fromAngle(angle, dist)
  return spawnAttack(g, {
    ...l, x: g.player.x + d.x, y: g.player.y - 8 + d.y,
    shape: { kind: 'circle', r: r * s.area }, motion: { kind: 'follow', ox: d.x, oy: d.y - 8 },
    damage: s.damage, knockback: s.knockback, status: s.status, age: -delay, ttl, activeUntil: Math.min(ttl, 0.07), flip: dm.cos(angle) < 0,
  })
}

/** Whether the acting player is in a given Mega form. */
const megaIs = (g: Game, stone: string) => g.player.mega.active > 0 && g.player.mega.stone === stone

/** Storm Throw: what a throw adds to the foe it hurls (its crash), and the bite on clamped (marked) foes. */
export const STORM_THROW = { force: 340, crash: 0.7, clamped: [{ when: 'marked', mult: 1.6 }] } as const

/** Hyper Voice: each ring's reach (× area) and how long it takes to swell. */
const VOICE = { r: 58, time: 0.3, gap: 0.13 } as const

export const GA_KIT_MA_MOVES = {
  /* Kangaskhan: a flurry of quick punches just ahead (each one the baby can follow). */
  cometPunch: {
    name: 'Comet Punch',
    type: 'normal',
    base: stats({ damage: 5, cooldown: 1.1, amount: 3, knockback: 12 }),
    tags: ['punch'],
    upgrades: GA_KIT_MA_UPGRADES.cometPunch,
    fire: (g, s) => {
      const angle = aimAngle(g, 80)
      for (let i = 0; i < s.amount; i++) {
        const sway = (i % 2 === 0 ? 1 : -1) * Math.min(i, 1) * 0.35
        const punch = jab(g, s, look('cometPunch', 'normal', 'maComet'), angle + sway, 18 + (i % 3) * 2, 10, i * 0.07, 0.16)
        punch.memo = angle + sway
      }
      cast(g, 'cometPunch')
    },
  },

  /* Pinsir: grabs the foe just ahead with its horns and hurls it over its shoulder into the ones behind; clamped foes take it worst. */
  stormThrow: {
    name: 'Storm Throw',
    type: 'fighting',
    base: stats({ damage: 13, cooldown: 1.6, knockback: 0 }),
    upgrades: GA_KIT_MA_UPGRADES.stormThrow,
    onHit: (g, a, e) => {
      if (a.visual !== 'maThrow' || e.boss || e.dying >= 0 || e.hp <= 0) return
      const p = g.player
      throwFoe(g, e, dm.atan2(p.y - e.y, p.x - e.x), STORM_THROW.force, a.damage * STORM_THROW.crash, 'stormThrow')
    },
    fire: (g, s) => {
      const angle = aimAngle(g, 80)
      const hit = jab(g, s, look('stormThrow', 'fighting', 'maThrow'), angle, 20, 13, 0, 0.26)
      hit.bonus = STORM_THROW.clamped
      hit.memo = angle
      cast(g, 'stormThrow')
    },
  },

  /* Skarmory: blades of air in a fan that cut through the first foes they meet. */
  airCutter: {
    name: 'Air Cutter',
    type: 'flying',
    base: stats({ damage: 8, cooldown: 1.35, amount: 2, speed: 230, pierce: 2, knockback: 20 }),
    tags: ['slice'],
    upgrades: GA_KIT_MA_UPGRADES.airCutter,
    fire: (g, s) => {
      const p = g.player
      const center = aimAngle(g, 240)
      for (let i = 0; i < s.amount; i++) {
        const v = fromAngle(center + (i - (s.amount - 1) / 2) * 0.3, s.speed)
        spawnAttack(g, {
          ...look('airCutter', 'flying', 'maCutter'), x: p.x, y: p.y - 10,
          shape: { kind: 'circle', r: 6 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, status: s.status, ttl: 1, age: -i * 0.04, flip: i % 2 === 1,
          ignoreWards: megaIs(g, 'skarmory'),
        })
      }
      cast(g, 'airCutter')
    },
  },

  /*
   * Drilbur's line: spins into the ground and drills through the horde to the nearest foe, hitting all along the
   * way; it opens a hole where it dives and another where it comes up (`gaKitMASystem.ts`).
   */
  drillRun: {
    name: 'Drill Run',
    type: 'ground',
    base: stats({ damage: 5, cooldown: 1.9, speed: 290, knockback: 26 }),
    minCooldown: LUNGE_MIN_COOLDOWN,
    upgrades: GA_KIT_MA_UPGRADES.drillRun,
    fire: (g, s) => {
      const p = g.player
      const kit = p.kitMA?.kind === 'dig' ? p.kitMA : null
      const time = atStage(KIT_MA.dig.under, p.stage)
      // Under the ground is an immunity window: if another move's is too fresh, the drill runs on the surface, no holes.
      if (kit && burrow(g, 'drillRun', time)) kit.dive = { x: p.x, y: p.y }
      const piercing = megaIs(g, 'excadrill')
      const d = fromAngle(aimAngle(g, 150), s.speed)
      p.iframes = Math.max(p.iframes, LUNGE_IFRAMES)
      spawnAttack(g, {
        ...look('drillRun', 'ground', 'maDrill'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: 12 * s.area }, motion: { kind: 'lunge', vx: d.x, vy: d.y, left: time },
        damage: s.damage, knockback: s.knockback, status: s.status, hitInterval: piercing ? 0.05 : 0.08, ttl: time + 0.06,
        ignoreWards: piercing, tier: p.stage + (piercing ? 1 : 0),
      })
      cast(g, 'drillRun')
    },
  },

  /* Drampa: rings of sound that swell out from it, one after another; they grow with its rage (its area). */
  hyperVoice: {
    name: 'Hyper Voice',
    type: 'normal',
    base: stats({ damage: 7, cooldown: 1.9, amount: 2, knockback: 46 }),
    tags: ['sound'],
    upgrades: GA_KIT_MA_UPGRADES.hyperVoice,
    fire: (g, s) => {
      const p = g.player
      const r = VOICE.r * s.area
      for (let i = 0; i < s.amount; i++) {
        spawnAttack(g, {
          ...look('hyperVoice', 'normal', 'maVoice'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 8 }, motion: { kind: 'follow', ox: 0, oy: -8 }, grow: (r - 8) / VOICE.time,
          damage: s.damage, knockback: s.knockback, status: s.status, age: -i * VOICE.gap, ttl: VOICE.time + 0.06, activeUntil: VOICE.time, tier: i,
        })
      }
      cast(g, 'hyperVoice')
    },
  },
} as const satisfies Record<string, MoveDef>

export const GA_KIT_MA_MOVE_IDS = Object.keys(GA_KIT_MA_MOVES) as ReadonlyArray<keyof typeof GA_KIT_MA_MOVES>

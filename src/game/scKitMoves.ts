import { dirTo, fromAngle } from '../engine/math'
import * as dm from '../engine/dmath'
import type { PokeType } from '../data/types'
import { healPlayer } from './combat'
import { burst, floatText } from './effects'
import { strike } from './moveKit'
import type { Look, MoveDef, MoveId, MoveStats } from './moves'
import { nearestEnemy } from './queries'
import { KIT_SC } from './scKitRules'
import { SC_KIT_UPGRADES } from './scKitUpgrades'
import { spawnAttack } from './spawn'
import type { DamageBonus } from './kitRules'
import type { Game, Visual } from './types'

/**
 * The Safári and Game Corner wave's signatures, one per family
 * (`data/scFamilies.ts`). Moonlight reads Cleffa's moon (a full moon brings
 * another beam and makes each one heal) and Dive reads Phione's current (a
 * full one swells its geysers). Their steps live in `scKitUpgrades.ts`, their
 * look in `render/scKitFx.ts`. Seeded rng and `dmath` only, and no `moves.ts`
 * at runtime (it is evaluated first): only its types.
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

/** Sludge bites twice as deep into a poisoned foe (Nidoran♀'s barbs poison them). */
const POISONED: readonly DamageBonus[] = [{ when: 'poisoned', mult: 2 }]

/** Sludge's lob: how long a glob flies, the splash's radius and how far it looks. */
export const SLUDGE = { flight: 0.42, r: 16, reach: 200 } as const

/** Fury Attack's jabs: the beat between them, how far ahead each lands and its radius. */
export const FURY = { gap: 0.09, reach: 22, r: 11 } as const

/** Moonlight: how long a beam takes to fall, its radius, and how far it looks for foes. */
export const MOONLIGHT = { fall: 0.38, r: 15, reach: 200 } as const

/** Dive: the dip's i-frames, the beat before the geysers burst, their radius, how far they look, and a full current's swell. */
export const DIVE = { dip: 0.3, delay: 0.3, r: 18, reach: 190, full: 0.9, swell: 1.5 } as const

/** Whether Cleffa's line's moon is full now. */
const moonFull = (g: Game) => g.player.kitSC?.kind === 'moon' && g.player.kitSC.full > 0

export const SC_KIT_MOVES = {
  /* Nidoran♀'s line: globs of sludge lobbed onto the nearest foes, splashing where they land, twice as harsh on the poisoned. */
  sludge: {
    name: 'Sludge',
    type: 'poison',
    base: stats({ damage: 9, cooldown: 1.5, amount: 2, knockback: 30 }),
    status: { kind: 'poison', chance: 0.4, duration: 3, power: 0.3 },
    upgrades: SC_KIT_UPGRADES.sludge,
    fire: (g, s) => {
      const p = g.player
      const taken = new Set<number>()
      for (let i = 0; i < s.amount; i++) {
        const e = nearestEnemy(g, p.x, p.y, SLUDGE.reach, taken)
        if (e) taken.add(e.id)
        const at = e ?? { x: p.x + p.facing.x * (54 + i * 16), y: p.y + p.facing.y * (54 + i * 16), radius: 0 }
        const flight = SLUDGE.flight + i * 0.07
        const hit = strike(g, s, look('sludge', 'poison', 'scSludge'), at.x, at.y - at.radius / 2, SLUDGE.r * s.area, flight, 0.4)
        hit.from = { x: p.x, y: p.y - 12 }
        hit.memo = flight
        hit.bonus = POISONED
      }
      cast(g, 'sludge')
    },
  },

  /* Nidoran♂'s line: the horn jabs ahead again and again, a beat apart. */
  furyAttack: {
    name: 'Fury Attack',
    type: 'normal',
    base: stats({ damage: 6, cooldown: 1.15, amount: 3, knockback: 22 }),
    upgrades: SC_KIT_UPGRADES.furyAttack,
    fire: (g, s) => {
      const p = g.player
      const angle = aimAngle(g, 90)
      for (let i = 0; i < s.amount; i++) {
        // Each jab lands a little to one side of the last, a flurry rather than a line.
        const side = (i % 2 === 0 ? 1 : -1) * (i === 0 ? 0 : 0.28)
        const d = fromAngle(angle + side, FURY.reach)
        spawnAttack(g, {
          ...look('furyAttack', 'normal', 'scHorn'), x: p.x + d.x, y: p.y - 8 + d.y,
          shape: { kind: 'circle', r: FURY.r * s.area }, motion: { kind: 'follow', ox: d.x, oy: d.y - 8 },
          damage: s.damage, knockback: s.knockback, status: s.status, age: -i * FURY.gap, ttl: 0.16, activeUntil: 0.08, memo: angle + side,
        })
      }
      cast(g, 'furyAttack')
    },
  },

  /* Cleffa's line: moonbeams fall on the foes around; under a full moon one more falls and each heals. */
  moonlight: {
    name: 'Moonlight',
    type: 'fairy',
    base: stats({ damage: 9, cooldown: 1.7, amount: 2, knockback: 30 }),
    upgrades: SC_KIT_UPGRADES.moonlight,
    onHit: (g, a) => {
      if (a.tier !== 1) return
      const p = g.player
      const healed = healPlayer(g, p.stats.maxHp * KIT_SC.moon.heal)
      if (healed > 0.5) floatText(g, p.x, p.y - 26, `+${dm.round(healed)}`, '#f8d8f0', true)
    },
    fire: (g, s) => {
      const p = g.player
      const full = moonFull(g)
      const taken = new Set<number>()
      const count = s.amount + (full ? 1 : 0)
      for (let i = 0; i < count; i++) {
        const e = nearestEnemy(g, p.x, p.y, MOONLIGHT.reach, taken)
        if (e) taken.add(e.id)
        const at = e ?? { x: p.x + p.facing.x * (40 + i * 18), y: p.y + p.facing.y * (40 + i * 18), radius: 0 }
        const hit = strike(g, s, look('moonlight', 'fairy', 'scMoonbeam'), at.x, at.y - at.radius / 2, MOONLIGHT.r * s.area, MOONLIGHT.fall + i * 0.06, 0.34)
        hit.tier = full ? 1 : 0
      }
      cast(g, 'moonlight')
    },
  },

  /* Phione: it dips under for a moment, and geysers burst under the nearest foes; a full current swells them. */
  dive: {
    name: 'Dive',
    type: 'water',
    base: stats({ damage: 11, cooldown: 2, amount: 2, knockback: 60 }),
    status: { kind: 'slow', chance: 0.5, duration: 1, power: 0.3 },
    upgrades: SC_KIT_UPGRADES.dive,
    fire: (g, s) => {
      const p = g.player
      const kit = p.kitSC?.kind === 'current' ? p.kitSC : null
      const swell = kit && kit.drift >= DIVE.full ? DIVE.swell : 1
      p.iframes = Math.max(p.iframes, DIVE.dip)
      const taken = new Set<number>()
      for (let i = 0; i < s.amount; i++) {
        const e = nearestEnemy(g, p.x, p.y, DIVE.reach, taken)
        if (e) taken.add(e.id)
        const at = e ?? { x: p.x + p.facing.x * (46 + i * 20), y: p.y + p.facing.y * (46 + i * 20), radius: 0 }
        const hit = strike(g, { ...s, damage: s.damage * swell }, look('dive', 'water', 'scGeyser'), at.x, at.y, DIVE.r * s.area * (swell > 1 ? 1.25 : 1), DIVE.delay + i * 0.07, 0.42)
        hit.tier = swell > 1 ? 1 : 0
      }
      burst(g, p.x, p.y - 2, { colors: ['#ffffff', '#a8e0f8', '#58a8e0'], count: 12, speed: 70, ttl: 0.4, gravity: 200, size: 2 })
      cast(g, 'dive')
    },
  },
} as const satisfies Record<string, MoveDef>

export const SC_KIT_MOVE_IDS = Object.keys(SC_KIT_MOVES) as ReadonlyArray<keyof typeof SC_KIT_MOVES>

import { dirTo, fromAngle } from '../engine/math'
import * as dm from '../engine/dmath'
import { damageEnemy } from './combat'
import { burst, floatText, shakeScreen } from './effects'
import { recoilCost } from './eggMove2Rules'
import { guardWard } from './kitRules'
import { guard, trailer } from './moveKit'
import { modHit } from './mods'
import { chainDamage, chainTargets } from './moveRules'
import type { Look, MoveDef, MoveId, MoveStats } from './moves'
import { ownAttack } from './players'
import { nearestEnemy } from './queries'
import {
  APPLE, BITE, biteMult, BLITZ, blitzPower, COAT, GAS, GLEAM, reflectedVelocity, SHIELD, shieldAnswer, SMASH, SNOW, SWIPE, VEIL, veilFreeze, veilRadius, WEB, WING,
} from './seasonOneEggRules'
import { addMoveBuff } from './signatureMoves'
import { densestFoe } from './signatureRules'
import { spawnAttack } from './spawn'
import { VEIL_SNOW } from './regionalRules'
import { weatherHere } from './weather'
import { applyStatus } from './status'
import type { Attack, Game } from './types'

/**
 * Temporada 1's new moves for the egg and fossil families
 * (`data/seasonOneEggs.ts`), each a verb of its own: snow trails, webs that
 * chain, poison that jumps when a foe falls (`spreadVenom` in `combat.ts`), a
 * coat that sends shots back (`reflectShots`), a fan of icy dragon shards and
 * the five fossils. Numbers live in `seasonOneEggRules.ts`. Spread at the end
 * of `MOVES`; this module must not use `moves.ts` at load time (only its types).
 */

const stats = (s: Partial<MoveStats>): MoveStats => ({
  damage: 0, cooldown: 1, area: 1, amount: 1, speed: 0, duration: 1, pierce: Infinity, knockback: 0, statusChance: 0, statusDamage: 0, ...s,
})

const look = (move: MoveId, type: Look['type'], visual: Look['visual']): Look => ({ move, type, visual })

/** Lets the shell play the move's own sound (`ui/castSounds.ts`). */
const cast = (g: Game, move: MoveId) => g.events.push({ kind: 'cast', move })

/** Toward the nearest foe within `reach`, else the way the player faces. */
const aimAngle = (g: Game, reach: number) => {
  const p = g.player
  const e = nearestEnemy(g, p.x, p.y, reach)
  const d = e ? dirTo(p.x, p.y, e.x, e.y, p.facing) : p.facing
  return dm.atan2(d.y, d.x)
}

/** The player's speed without `move`'s own buff, so a refreshed buff never compounds. */
const ownSpeed = (g: Game, move: MoveId) => {
  const p = g.player
  const own = p.moveBuffs.find((b) => b.move === move && b.applied)
  return p.stats.speed - (own?.stats.speed ?? 0)
}

/**
 * Per tick of Magic Coat's mirror (`signatures.ts`): every enemy shot touching
 * it flies back the way it came as the player's own, up to `COAT.max` a cast.
 * `a.damage` is what a sent-back shot hits for, `a.memo` how many it sent.
 */
export const reflectShots = (g: Game, a: Attack) => {
  if (a.shape.kind !== 'circle' || a.age < 0 || a.memo >= COAT.max) return
  for (const h of g.hazards) {
    if (h.kind !== 'shot' || h.age < h.armAt || h.phantom > 0) continue
    if (dm.sq(h.x - a.x) + dm.sq(h.y - 6 - a.y) > dm.sq(a.shape.r + h.r)) continue
    h.ttl = h.age
    spawnAttack(g, {
      move: a.move, type: a.type, visual: 'psy', x: h.x, y: h.y - 6,
      shape: { kind: 'circle', r: 7 }, motion: { kind: 'linear', ...reflectedVelocity(h.vx, h.vy) },
      damage: a.damage, knockback: 40, pierce: 2, ttl: COAT.ttl, mod: null,
    })
    burst(g, h.x, h.y - 6, { colors: ['#ffffff', '#f8a0c8', '#c878f0'], count: 8, speed: 90, ttl: 0.25 })
    if (++a.memo >= COAT.max) return
  }
}

export const SEASON_ONE_EGG_MOVES = {
  /* Snom: walking leaves powder snow that slows whatever crosses it, and each cast puffs some out. */
  powderSnow: {
    name: 'Powder Snow',
    type: 'ice',
    base: stats({ damage: 5, cooldown: 3.2, duration: 2.4 }),
    status: { kind: 'slow', chance: 1, duration: 1.6, power: 0.35 },
    upgrades: [
      { damage: 2 },
      { duration: 0.4 },
      { fork: [{ stats: { area: 0.15, damage: 1 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.3 }, mods: ['arc'] }] },
      { damage: 2 },
      { cooldown: -0.3 },
      { fork: [{ stats: { duration: 0.6 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['drain'] }] },
      { damage: 3, area: 0.15 },
    ],
    fire: (g, s) => {
      const p = g.player
      trailer(g, s, look('powderSnow', 'ice', 'modTrail'), { every: SNOW.every, r: SNOW.r, ttl: SNOW.ttl, hitInterval: SNOW.hitInterval, share: SNOW.share, duration: s.duration })
      spawnAttack(g, {
        ...look('powderSnow', 'ice', 'modTrail'), x: p.x, y: p.y,
        shape: { kind: 'circle', r: SNOW.puff * s.area }, motion: { kind: 'static' },
        damage: s.damage, status: s.status, ttl: 0.7, activeUntil: 0.12,
      })
      burst(g, p.x, p.y - 8, { colors: ['#ffffff', '#c8e8f8'], count: 10, speed: 70, ttl: 0.4 })
      cast(g, 'powderSnow')
    },
  },

  /* Ponyta: burns all around and leaves fire where it runs, hotter the faster it goes; standing still it barely smolders. */
  flareBlitz: {
    name: 'Flare Blitz',
    type: 'fire',
    base: stats({ damage: 9, cooldown: 2.8, duration: 2.2, knockback: 90 }),
    status: { kind: 'burn', chance: 0.35, duration: 2.5, power: 0.3 },
    upgrades: [
      { damage: 2 },
      { duration: 0.4 },
      { fork: [{ stats: { area: 0.15, damage: 1 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.3 }, mods: ['arc'] }] },
      { damage: 3 },
      { cooldown: -0.3 },
      { fork: [{ stats: { duration: 0.6 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['cruel'] }] },
      { damage: 4, area: 0.15 },
    ],
    fire: (g, s) => {
      const p = g.player
      const power = blitzPower(ownSpeed(g, 'flareBlitz'), p.moving)
      trailer(g, { ...s, damage: s.damage * power }, look('flareBlitz', 'fire', 'flameTrail'), { every: BLITZ.every, r: BLITZ.r, ttl: BLITZ.ttl, hitInterval: BLITZ.hitInterval, share: BLITZ.share, duration: s.duration })
      spawnAttack(g, {
        ...look('flareBlitz', 'fire', 'flameLanding'), x: p.x, y: p.y,
        shape: { kind: 'circle', r: BLITZ.ring * s.area }, motion: { kind: 'static' },
        damage: s.damage * power, knockback: s.knockback, status: s.status, ttl: 0.55, activeUntil: 0.07,
      })
      cast(g, 'flareBlitz')
    },
  },

  /* Galarian Ponyta: a pastel flash all around that confuses some foes and heals through the drain budget. */
  dazzlingGleam: {
    name: 'Dazzling Gleam',
    type: 'fairy',
    base: stats({ damage: 11, cooldown: 2.6, knockback: 60 }),
    status: { kind: 'confuse', chance: 0.2, duration: 2, power: 0 },
    upgrades: [
      { damage: 3 },
      { area: 0.15 },
      { fork: [{ stats: { cooldown: -0.3 }, mods: ['burstOnKill'] }, { stats: { damage: 3 }, mods: ['hunter'] }] },
      { damage: 4 },
      { area: 0.15 },
      { fork: [{ stats: { cooldown: -0.4 }, mods: ['cruel'] }, { stats: { area: 0.2 }, mods: ['arc'] }] },
      { damage: 5, area: 0.15 },
    ],
    fire: (g, s) => {
      const p = g.player
      spawnAttack(g, {
        ...look('dazzlingGleam', 'fairy', 'dazzlingGleam'), x: p.x, y: p.y - 6,
        shape: { kind: 'circle', r: GLEAM.r * s.area }, motion: { kind: 'static' },
        damage: s.damage, knockback: s.knockback, status: s.status, drain: GLEAM.drain, ttl: 0.5, activeUntil: 0.08,
      })
      burst(g, p.x, p.y - 12, { colors: ['#ffffff', '#f8c8e8', '#c8b0f8', '#a8e8f0'], count: 12, speed: 90, ttl: 0.4 })
      cast(g, 'dazzlingGleam')
    },
  },

  /* Joltik: a web jumps from foe to foe, slowing each and leaving a patch of live thread under it. */
  electroweb: {
    name: 'Electroweb',
    type: 'electric',
    base: stats({ damage: 9, cooldown: 1.8, amount: 3 }),
    status: { kind: 'slow', chance: 1, duration: 1.4, power: 0.3 },
    upgrades: [
      { amount: 1 },
      { damage: 3 },
      { fork: [{ stats: { cooldown: -0.2 }, mods: ['burstOnKill'] }, { stats: { amount: 1, damage: -1 }, mods: ['arc'] }] },
      { damage: 3 },
      { amount: 1 },
      { fork: [{ stats: { damage: 4 }, mods: ['hunter'] }, { stats: { area: 0.25 }, mods: ['cruel'] }] },
      { amount: 1, damage: 3 },
    ],
    fire: (g, s) => {
      const p = g.player
      const targets = chainTargets(g.enemies, p, s.amount, WEB.reach, WEB.hop * s.area)
      if (targets.length === 0) return
      let from = { x: p.x, y: p.y - 10 }
      targets.forEach((e, hop) => {
        const to = { x: e.x, y: e.y - e.radius }
        const arc = spawnAttack(g, {
          ...look('electroweb', 'electric', 'shock'), ...to, from,
          shape: { kind: 'circle', r: 4 * s.area }, motion: { kind: 'static' },
          damage: chainDamage(s.damage, hop), status: s.status, ttl: 0.28, activeFrom: Infinity, age: -hop * 0.035,
        })
        damageEnemy(g, e, arc)
        // The hit lands here, not in `collide`, so its mods hear of it here.
        if (arc.mod) modHit(g, arc, e)
        spawnAttack(g, {
          ...look('electroweb', 'electric', 'modTrail'), x: e.x, y: e.y + 4,
          shape: { kind: 'circle', r: WEB.r * s.area }, motion: { kind: 'static' },
          damage: s.damage * WEB.share, hitInterval: WEB.hitInterval, status: s.status, ttl: WEB.ttl, age: -hop * 0.035, mod: null,
        })
        from = to
      })
      cast(g, 'electroweb')
    },
  },

  /* Salandit: a corrosive cloud on the thickest crowd; the poison it leaves jumps on when a poisoned foe falls. */
  corrosiveGas: {
    name: 'Corrosive Gas',
    type: 'poison',
    base: stats({ damage: 4, cooldown: 2.6, duration: GAS.ttl }),
    status: { kind: 'poison', chance: 1, duration: 3.5, power: 0.5 },
    upgrades: [
      { damage: 1 },
      { area: 0.15 },
      { fork: [{ stats: { statusDamage: 0.2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.3 }, mods: ['trail'] }] },
      { damage: 2 },
      { cooldown: -0.3 },
      { fork: [{ stats: { duration: 0.4, statusDamage: 0.1 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['vortex'] }] },
      { damage: 3, statusDamage: 0.15 },
    ],
    fire: (g, s, owned) => {
      const p = g.player
      const t = densestFoe(g.enemies, p.x, p.y, GAS.reach, GAS.crowd) ?? nearestEnemy(g, p.x, p.y, GAS.reach)
      if (!t) {
        owned.cooldown -= s.cooldown - 0.4
        return
      }
      spawnAttack(g, {
        ...look('corrosiveGas', 'poison', 'toxicCloud'), x: t.x, y: t.y - t.radius,
        shape: { kind: 'circle', r: GAS.r * s.area }, motion: { kind: 'static' },
        damage: s.damage, status: s.status, hitInterval: GAS.hitInterval, ttl: s.duration,
      })
      cast(g, 'corrosiveGas')
    },
  },

  /* Hatenna: a pulse, and for a capped window a mirror around the player that sends enemy shots back (`reflectShots`). */
  magicCoat: {
    name: 'Magic Coat',
    type: 'psychic',
    base: stats({ damage: 11, cooldown: 5, duration: 2, knockback: 60 }),
    upgrades: [
      { damage: 3 },
      { duration: 0.2 },
      { fork: [{ stats: { damage: 4 }, mods: ['burstOnKill'] }, { stats: { area: 0.2 }, mods: ['arc'] }] },
      { cooldown: -0.4 },
      { damage: 4 },
      { fork: [{ stats: { duration: 0.2, area: 0.15 }, mods: ['hunter'] }, { stats: { damage: 3, cooldown: -0.3 }, mods: ['cruel'] }] },
      { damage: 5, duration: 0.2 },
    ],
    ward: guardWard,
    fire: (g, s) => {
      const p = g.player
      spawnAttack(g, {
        ...look('magicCoat', 'psychic', 'protect'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: COAT.r * s.area }, motion: { kind: 'follow', ox: 0, oy: -8 },
        damage: s.damage, ttl: guardWard(s), activeFrom: Infinity, mod: null,
      })
      spawnAttack(g, {
        ...look('magicCoat', 'psychic', 'psyBurst'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: COAT.pulse * s.area }, motion: { kind: 'static' },
        damage: s.damage, knockback: s.knockback, ttl: 0.34, grow: COAT.pulseGrow * s.area, activeUntil: 0.22,
      })
      cast(g, 'magicCoat')
    },
  },

  /* Applin: a lobbed apple that bursts in acid, softening what it splashes; Flapple throws them sharper, Appletun bigger. */
  appleAcid: {
    name: 'Apple Acid',
    type: 'grass',
    base: stats({ damage: 14, cooldown: 2.2, amount: 2, knockback: 40 }),
    status: { kind: 'mark', chance: 0.7, duration: 3, power: 0.1 },
    upgrades: [
      { damage: 4 },
      { amount: 1 },
      { fork: [{ stats: { area: 0.15 }, mods: ['trail'] }, { stats: { damage: 4 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.25 },
      { damage: 5 },
      { fork: [{ stats: { amount: 1, damage: -2 }, mods: ['echo'] }, { stats: { statusChance: 0.2 }, mods: ['hunter'] }] },
      { amount: 1, damage: 5 },
    ],
    fire: (g, s) => {
      const p = g.player
      const form = p.branch === 'flapple' ? APPLE.flapple : p.branch === 'appletun' ? APPLE.appletun : null
      const taken = new Set<number>()
      for (let i = 0; i < s.amount; i++) {
        const t = nearestEnemy(g, p.x, p.y, APPLE.reach, taken)
        if (t) taken.add(t.id)
        const ahead = fromAngle(dm.atan2(p.facing.y, p.facing.x) + (i - (s.amount - 1) / 2) * 0.5, 80)
        spawnAttack(g, {
          ...look('appleAcid', 'grass', 'leechSeed'), x: t ? t.x : p.x + ahead.x, y: t ? t.y - t.radius : p.y + ahead.y - 8,
          shape: { kind: 'circle', r: APPLE.r * s.area * (form?.area ?? 1) }, motion: { kind: 'static' },
          damage: s.damage * (form?.damage ?? 1), knockback: s.knockback, status: s.status,
          ttl: APPLE.lob + 0.3, activeFrom: APPLE.lob, activeUntil: APPLE.lob + 0.08,
          from: { x: p.x, y: p.y - 10 }, age: -i * 0.09, flip: i % 2 === 1,
        })
      }
      cast(g, 'appleAcid')
    },
  },

  /* Frigibax: a fan of icy dragon shards that brake as they fly, slowing what they cut. */
  icicleSpear: {
    name: 'Icicle Spear',
    type: 'ice',
    base: stats({ damage: 12, cooldown: 2, amount: 5, speed: 260, duration: 0.75, knockback: 30 }),
    status: { kind: 'slow', chance: 0.6, duration: 1.4, power: 0.3 },
    upgrades: [
      { amount: 1 },
      { damage: 3 },
      { fork: [{ stats: { damage: 3 }, mods: ['burstOnKill'] }, { stats: { amount: 2, damage: -2 }, mods: ['split'] }] },
      { cooldown: -0.2 },
      { damage: 4 },
      { fork: [{ stats: { statusChance: 0.2, damage: 2 }, mods: ['cruel'] }, { stats: { area: 0.2 }, mods: ['arc'] }] },
      { amount: 2, damage: 3 },
    ],
    tags: ['slice'],
    fire: (g, s) => {
      const p = g.player
      const center = aimAngle(g, SWIPE.reach)
      for (let i = 0; i < s.amount; i++) {
        const v = fromAngle(center + (i - (s.amount - 1) / 2) * SWIPE.step, s.speed)
        spawnAttack(g, {
          ...look('icicleSpear', 'ice', i % 2 === 0 ? 'iceShard' : 'dragonBreath'), x: p.x, y: p.y - 6,
          shape: { kind: 'circle', r: 5 * s.area }, motion: { kind: 'drift', vx: v.x, vy: v.y, drag: SWIPE.drag },
          damage: s.damage, knockback: s.knockback, hitInterval: 0.5, ttl: s.duration, status: s.status,
        })
      }
      cast(g, 'icicleSpear')
    },
  },

  /* Cranidos: an all-in charge at the nearest foe; landing it costs HP, never the last point. */
  headSmash: {
    name: 'Head Smash',
    type: 'rock',
    base: stats({ damage: 30, cooldown: 3.2, knockback: 150 }),
    minCooldown: 1.5,
    upgrades: [
      { damage: 7 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 8 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.4 }, mods: ['trail'] }] },
      { damage: 8 },
      { cooldown: -0.3 },
      { fork: [{ stats: { damage: 10 }, mods: ['hunter'] }, { stats: { area: 0.2, damage: 4 }, mods: ['arc'] }] },
      { damage: 12, area: 0.2 },
    ],
    fire: (g, s, owned) => {
      const p = g.player
      const t = nearestEnemy(g, p.x, p.y, SMASH.reach)
      if (!t) {
        owned.cooldown -= s.cooldown - SMASH.retry
        return
      }
      const d = dirTo(p.x, p.y, t.x, t.y, p.facing)
      const v = SMASH.length / SMASH.time
      p.iframes = Math.max(p.iframes, SMASH.time + 0.1)
      spawnAttack(g, {
        ...look('headSmash', 'rock', 'bodySlam'), x: p.x, y: p.y - 8, from: { x: p.x, y: p.y },
        shape: { kind: 'circle', r: 13 * s.area }, motion: { kind: 'lunge', vx: d.x * v, vy: d.y * v, left: SMASH.time },
        damage: s.damage, knockback: s.knockback, ttl: SMASH.time + 0.2, activeUntil: SMASH.time,
      })
      cast(g, 'headSmash')
    },
    onHit: (g, a) => {
      if (a.visual !== 'bodySlam' || a.hits.size !== 1) return
      const p = g.player
      const cost = recoilCost(p.stats.maxHp, p.hp, 0, SMASH.recoil, SMASH.recoil)
      shakeScreen(g, 3)
      if (cost <= 0) return
      p.hp -= cost
      floatText(g, p.x, p.y - 26, String(cost), '#f87858', true)
    },
  },

  /* Shieldon: a capped shield that bashes what touches it, negates the next hit and answers with a shockwave; armor makes it hit harder. */
  ironDefense: {
    name: 'Iron Defense',
    type: 'steel',
    base: stats({ damage: 20, cooldown: 5.5, duration: 2.2, knockback: 150 }),
    minCooldown: 3.2,
    upgrades: [
      { damage: 5 },
      { duration: 0.2 },
      { fork: [{ stats: { damage: 6 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.5 }, mods: ['arc'] }] },
      { damage: 6 },
      { cooldown: -0.4 },
      { fork: [{ stats: { area: 0.25 }, mods: ['hunter'] }, { stats: { damage: 8 }, mods: ['drain'] }] },
      { damage: 8, duration: 0.2 },
    ],
    ward: guardWard,
    fire: (g, s, owned) => {
      const p = g.player
      const span = guardWard(s)
      if (!guard(g, 'ironDefense', span)) {
        owned.cooldown -= s.cooldown - SHIELD.retry
        return
      }
      spawnAttack(g, {
        ...look('ironDefense', 'steel', 'protect'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: SHIELD.r * s.area }, motion: { kind: 'follow', ox: 0, oy: -8 },
        damage: s.damage * SHIELD.share, knockback: s.knockback, hitInterval: SHIELD.hitInterval, ttl: span,
      })
      cast(g, 'ironDefense')
    },
    onGuard: (g, s) => {
      const p = g.player
      // The shield is spent: its bubble goes with the guard.
      for (const a of g.attacks) if (a.move === 'ironDefense' && a.visual === 'protect' && ownAttack(g, a)) a.ttl = a.age
      spawnAttack(g, {
        ...look('ironDefense', 'steel', 'slamWave'), x: p.x, y: p.y,
        shape: { kind: 'circle', r: SHIELD.wave * s.area }, motion: { kind: 'static' },
        damage: shieldAnswer(s.damage, p.stats.armor), knockback: s.knockback, ttl: 0.36, grow: SHIELD.waveGrow * s.area, activeUntil: 0.26,
      })
      shakeScreen(g, 3)
    },
  },

  /* Archen: two quick wing blows on the nearest foe, then a burst of speed to get away. */
  dualWingbeat: {
    name: 'Dual Wingbeat',
    type: 'flying',
    base: stats({ damage: 10, cooldown: 1.1, amount: 2, knockback: 60 }),
    upgrades: [
      { damage: 3 },
      { cooldown: -0.08 },
      { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { amount: 1, damage: -2 }, mods: ['arc'] }] },
      { damage: 3 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { cooldown: -0.1 }, mods: ['echo'] }] },
      { damage: 5 },
    ],
    fire: (g, s, owned) => {
      const p = g.player
      const t = nearestEnemy(g, p.x, p.y, WING.reach)
      if (!t) {
        owned.cooldown -= s.cooldown - 0.25
        return
      }
      for (let i = 0; i < s.amount; i++) {
        spawnAttack(g, {
          ...look('dualWingbeat', 'flying', 'gust'), x: t.x + (i % 2 === 0 ? -3 : 3), y: t.y - t.radius,
          shape: { kind: 'circle', r: 12 * s.area }, motion: { kind: 'static' },
          damage: s.damage, knockback: s.knockback, ttl: 0.2, activeUntil: 0.06, age: -i * WING.gap, flip: i % 2 === 1,
        })
      }
      addMoveBuff(g, 'dualWingbeat', WING.seconds, { speed: ownSpeed(g, 'dualWingbeat') * WING.haste })
      cast(g, 'dualWingbeat')
    },
  },

  /* Tyrunt: bites the nearest foe and marks it; each mark already there makes the next bite on it land harder. */
  bite: {
    name: 'Bite',
    type: 'dark',
    base: stats({ damage: 10, cooldown: 0.95, knockback: 25 }),
    status: { kind: 'mark', chance: 1, duration: 3, power: 0.04 },
    tags: ['bite'],
    upgrades: [
      { damage: 3 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 3 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.08 }, mods: ['drain'] }] },
      { damage: 3 },
      { cooldown: -0.08 },
      { fork: [{ stats: { damage: 4 }, mods: ['hunter'] }, { stats: { area: 0.25 }, mods: ['cruel'] }] },
      { damage: 6 },
    ],
    fire: (g, s, owned) => {
      const p = g.player
      const t = nearestEnemy(g, p.x, p.y, BITE.reach * s.area)
      if (!t) {
        owned.cooldown -= s.cooldown - BITE.retry
        return
      }
      spawnAttack(g, {
        ...look('bite', 'dark', 'jaws'), x: t.x, y: t.y - t.radius,
        shape: { kind: 'circle', r: 10 * s.area }, motion: { kind: 'static' },
        damage: s.damage * biteMult(t.status.mark.stacks), knockback: s.knockback, status: s.status, ttl: 0.24, activeFrom: 0.04, activeUntil: 0.1,
      })
      cast(g, 'bite')
    },
  },

  /* Amaura, Alolan Vulpix: a wide aurora field around the player that chills all it touches and sometimes freezes; it has a hard size cap, and grows wider and harder in the snow (`VEIL_SNOW`). */
  auroraVeil: {
    name: 'Aurora Veil',
    type: 'ice',
    base: stats({ damage: 7, cooldown: 5, duration: 2.6, knockback: 0 }),
    status: { kind: 'freeze', chance: 0.14, duration: 0.8, power: 0 },
    upgrades: [
      { damage: 2 },
      { area: 0.12 },
      { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { duration: 0.4 }, mods: ['vortex'] }] },
      { damage: 2 },
      { cooldown: -0.4 },
      { fork: [{ stats: { statusChance: 0.08 }, mods: ['hunter'] }, { stats: { area: 0.15, damage: 1 }, mods: ['arc'] }] },
      { damage: 4, duration: 0.3 },
    ],
    fire: (g, s) => {
      const p = g.player
      const snow = weatherHere(g) === 'snow'
      const r = veilRadius(s.area) * (snow ? VEIL_SNOW.area : 1)
      const status = s.status && { ...s.status, chance: veilFreeze(s.status.chance) }
      spawnAttack(g, {
        ...look('auroraVeil', 'ice', 'modTrail'), x: p.x, y: p.y,
        shape: { kind: 'circle', r }, motion: { kind: 'follow', ox: 0, oy: 0 },
        damage: s.damage * (snow ? VEIL_SNOW.damage : 1), status, hitInterval: VEIL.hitInterval, ttl: s.duration,
      })
      spawnAttack(g, { ...look('auroraVeil', 'ice', 'snowSwirl'), x: p.x, y: p.y - 4, shape: { kind: 'circle', r: 1 }, motion: { kind: 'follow', ox: 0, oy: -4 }, damage: 0, ttl: s.duration, activeFrom: Infinity, mod: null })
      cast(g, 'auroraVeil')
    },
    onHit: (g, a, e) => {
      if (a.visual === 'modTrail') applyStatus(e.status, VEIL.slow, 1, e.boss, 'auroraVeil', g.player.slot)
    },
  },
} as const satisfies Record<string, MoveDef>

export type SeasonOneEggMoveId = keyof typeof SEASON_ONE_EGG_MOVES

/** The new moves' ids: they are signatures, so they never evolve (`neverEvolves`). */
export const SEASON_ONE_EGG_MOVE_IDS = Object.keys(SEASON_ONE_EGG_MOVES) as SeasonOneEggMoveId[]

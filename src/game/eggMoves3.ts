import { dirTo, fromAngle, TAU } from '../engine/math'
import { chance, range } from '../engine/rng'
import * as dm from '../engine/dmath'
import { burst, shakeScreen } from './effects'
import {
  AVALANCHE_CHUNKS, AVALANCHE_DROP, AVALANCHE_GAP, AVALANCHE_SPEED, avalancheMult, BITTER_ARC, BITTER_DRAIN, BITTER_TIME,
  BULLDOZE_GAP, BULLDOZE_SEGMENTS, BULLDOZE_TTL, CHARGE_MIGHT, DANCE_MIGHT, DANCE_REACH, FANG_BITE, FANG_FLINCH, FANG_REACH,
  FROST_CRIT, HAMMER_R, HAMMER_TAP, HAMMER_WINDUP, hammerSwing, HEAVY_HOP, HEAVY_R, heavyMult, isDownbeat, LEECH_DRAIN,
  LEECH_REACH, MOON_BURST, MOON_SHARE, OVERDRIVE_BEAT, OVERDRIVE_DOWNBEAT, OVERDRIVE_RING, PERISH_TIME, perishDamage, swipesFor,
  swipesNext, SWIPES_REACH,
} from './eggMove3Rules'
import type { DamageBonus } from './kitRules'
import { stacksOf, sweep } from './moveKit'
import type { Look, MoveDef, MoveId, MoveStats } from './moves'
import { enemiesInView, nearestEnemy } from './queries'
import { addMoveBuff } from './signatureMoves'
import { spawnAttack } from './spawn'
import { ownAttack } from './players'
import type { Attack, Game } from './types'

/**
 * Third batch of the egg families' signature moves, each its own verb: a
 * dance that may fire you up, a riff in beats, a hammer too heavy to swing
 * twice, blades and bites that heal, a frenzy that grows while you stay in
 * melee, a slam that weighs your armor, a song that dooms the whole screen,
 * a breath that crits on chilled foes, a slide that pays back a hit… Spread at
 * the END of `MOVES` (`moves.ts`); their numbers live in `eggMove3Rules.ts`
 * and their look in `render/eggMove3Fx.ts`. Seeded rng and `dmath` only.
 *
 * This module must not use `moves.ts` at runtime (it is evaluated first):
 * only its types.
 */

const stats = (s: Partial<MoveStats>): MoveStats => ({
  damage: 0, cooldown: 1, area: 1, amount: 1, speed: 0, duration: 1, pierce: Infinity, knockback: 0, statusChance: 0, statusDamage: 0, ...s,
})

const look = (move: MoveId, type: Look['type'], visual: Look['visual']): Look => ({ move, type, visual })

/** Angles spread evenly around `center`, `step` radians apart. */
const fan = (center: number, count: number, step: number) =>
  Array.from({ length: count }, (_, i) => center + (i - (count - 1) / 2) * step)

/** Toward the nearest foe within `reach`, else the way the player faces. */
const aimAngle = (g: Game, reach: number) => {
  const p = g.player
  const target = nearestEnemy(g, p.x, p.y, reach)
  const d = target ? dirTo(p.x, p.y, target.x, target.y) : p.facing
  return dm.atan2(d.y, d.x)
}

/** Offset `dist` px towards `angle`, at body height, for strikes glued to the player. */
const reachOffset = (angle: number, dist: number) => {
  const d = fromAngle(angle, dist)
  return { ox: d.x, oy: d.y - 8 }
}

/** Lets the shell play the move's own sound (`ui/castSounds.ts`). */
const cast = (g: Game, move: MoveId) => g.events.push({ kind: 'cast', move })

/** The first hit of a big landing shakes the screen (and holds the world for a blink). */
const landing = (g: Game, a: Attack, shake: number, hitstop = 0) => {
  if (a.hits.size !== 1) return
  shakeScreen(g, shake)
  g.hitstop = Math.max(g.hitstop, hitstop)
  g.events.push({ kind: 'quake' })
}

/** Rolls a move's might boost: on success the player hits harder for a while (refreshed, never stacked), with a puff of red sparks. */
const mightUp = (g: Game, move: MoveId, boost: { chance: number; might: number; seconds: number }) => {
  if (!chance(g.rng, boost.chance)) return
  const p = g.player
  addMoveBuff(g, move, boost.seconds, { might: boost.might })
  burst(g, p.x, p.y - 14, { colors: ['#f85838', '#f8a038', '#ffffff'], count: 8, speed: 50, ttl: 0.5, gravity: -90 })
}

/** A row of `count` chunks across `angle` (perpendicular to it), `gap` px apart, around (x, y). */
const row = (x: number, y: number, angle: number, count: number, gap: number) =>
  Array.from({ length: count }, (_, k) => {
    const side = (k - (count - 1) / 2) * gap
    return { x: x - dm.sin(angle) * side, y: y + dm.cos(angle) * side, k }
  })

/** Frost Breath's crits. */
const FROST: readonly DamageBonus[] = [{ when: 'chilled', mult: FROST_CRIT }]

export const EGG_MOVES_3 = {
  /* Larvesta: flames flare out in a ring and twirl back; the dance may fire you up. */
  fieryDance: {
    name: 'Fiery Dance',
    type: 'fire',
    base: stats({ damage: 9, cooldown: 2.4, amount: 6, speed: 140, knockback: 30 }),
    status: { kind: 'burn', chance: 0.2, duration: 2.5, power: 0.3 },
    upgrades: [
      { amount: 2 },
      { damage: 3 },
      { fork: [{ stats: { area: 0.25 }, mods: ['burstOnKill'] }, { stats: { damage: 2 }, mods: ['arc'] }] },
      { cooldown: -0.3 },
      { amount: 2 },
      { fork: [{ stats: { statusChance: 0.25, statusDamage: 0.3 }, mods: ['cruel'] }, { stats: { damage: 3 }, mods: ['echo'] }] },
      { damage: 4, area: 0.2 },
    ],
    fire: (g, s) => {
      const p = g.player
      const reach = DANCE_REACH * s.area
      const spin = g.time * 1.3
      for (let i = 0; i < s.amount; i++) {
        const v = fromAngle(spin + (i / s.amount) * TAU, s.speed)
        spawnAttack(g, {
          ...look('fieryDance', 'fire', 'fieryDance'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 6 * s.area }, motion: { kind: 'return', vx: v.x, vy: v.y, out: reach / s.speed, speed: s.speed * 1.15 },
          damage: s.damage, knockback: s.knockback, status: s.status, ttl: 2, age: -i * 0.03, flip: i % 2 === 1,
        })
      }
      mightUp(g, 'fieryDance', DANCE_MIGHT)
      cast(g, 'fieryDance')
    },
  },

  /* Toxel: a punk riff in beats, every fourth one the downbeat. */
  overdrive: {
    name: 'Overdrive',
    type: 'electric',
    tags: ['sound'],
    base: stats({ damage: 7, cooldown: 2.6, amount: 4, knockback: 35 }),
    status: { kind: 'paralysis', chance: 0.35, duration: 1.2, power: 0 },
    upgrades: [
      { damage: 2 },
      { area: 0.2 },
      { fork: [{ stats: { amount: 2 }, mods: ['cruel'] }, { stats: { damage: 2 }, mods: ['arc'] }] },
      { cooldown: -0.3 },
      { damage: 3 },
      { fork: [{ stats: { area: 0.25, knockback: 40 }, mods: ['hunter'] }, { stats: { statusChance: 0.25 }, mods: ['echo'] }] },
      { amount: 2, damage: 2 },
    ],
    fire: (g, s) => {
      const beats = s.amount
      for (let i = 0; i < beats; i++) {
        const down = isDownbeat(i, beats)
        const radius = (down ? 64 : 50) * s.area
        spawnAttack(g, {
          ...look('overdrive', 'electric', 'overdrive'), x: g.player.x, y: g.player.y - 8,
          shape: { kind: 'circle', r: 6 }, motion: { kind: 'follow', ox: 0, oy: -8 },
          damage: s.damage * (down ? OVERDRIVE_DOWNBEAT : 1), knockback: s.knockback * (down ? 2 : 0.5), status: down ? s.status : null,
          ttl: OVERDRIVE_RING, grow: (radius - 6) / OVERDRIVE_RING, age: -i * OVERDRIVE_BEAT, tier: down ? 1 : 0,
        })
      }
      cast(g, 'overdrive')
    },
  },

  /* Tinkatink: a gigantic slam, then a light tap while the hammer comes back up. */
  gigatonHammer: {
    name: 'Gigaton Hammer',
    type: 'steel',
    base: stats({ damage: 22, cooldown: 2.2, knockback: 170 }),
    upgrades: [
      { damage: 8 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 6 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.3 }, mods: ['execute'] }] },
      { damage: 8 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 10 }, mods: ['hunter'] }, { stats: { area: 0.3 }, mods: ['arc'] }] },
      { damage: 10, cooldown: -0.2 },
    ],
    fire: (g, s, owned) => {
      const p = g.player
      const angle = aimAngle(g, 90)
      if (hammerSwing(stacksOf(owned)) === 'tap') {
        owned.stacks = 0
        const off = reachOffset(angle, 15 * s.area)
        spawnAttack(g, {
          ...look('gigatonHammer', 'steel', 'hammerTap'), x: p.x + off.ox, y: p.y + off.oy,
          shape: { kind: 'circle', r: 12 * s.area }, motion: { kind: 'follow', ...off },
          damage: s.damage * HAMMER_TAP, knockback: s.knockback * 0.3, ttl: 0.24, activeUntil: 0.1, flip: dm.cos(angle) < 0,
        })
        return
      }
      owned.stacks = 1
      const d = fromAngle(angle, 26 * s.area)
      spawnAttack(g, {
        ...look('gigatonHammer', 'steel', 'gigatonHammer'), x: p.x + d.x, y: p.y + d.y,
        shape: { kind: 'circle', r: HAMMER_R * s.area }, motion: { kind: 'static' },
        damage: s.damage, knockback: s.knockback, ttl: HAMMER_WINDUP + 0.5, activeFrom: HAMMER_WINDUP, activeUntil: HAMMER_WINDUP + 0.08,
        flip: dm.cos(angle) < 0,
      })
    },
    // The clang plays when the hammer lands on someone.
    onHit: (g, a) => {
      if (a.visual !== 'gigatonHammer' || a.hits.size !== 1) return
      landing(g, a, 7, 0.06)
      cast(g, 'gigatonHammer')
    },
  },

  /* Charcadet: a sweep of spectral fire that heals for half of what it cuts. */
  bitterBlade: {
    name: 'Bitter Blade',
    type: 'fire',
    tags: ['slice'],
    base: stats({ damage: 15, cooldown: 1.7, amount: 1, knockback: 60 }),
    status: { kind: 'burn', chance: 0.15, duration: 2.5, power: 0.3 },
    upgrades: [
      { damage: 4 },
      { area: 0.2 },
      { fork: [{ stats: { amount: 1 }, mods: ['execute'] }, { stats: { damage: 4 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.2 },
      { damage: 5 },
      { fork: [{ stats: { statusChance: 0.3, statusDamage: 0.3 }, mods: ['cruel'] }, { stats: { area: 0.2 }, mods: ['arc'] }] },
      { damage: 6, area: 0.15 },
    ],
    fire: (g, s) => {
      const aim = aimAngle(g, 90)
      for (let i = 0; i < s.amount; i++) {
        const dir = i % 2 === 0 ? 1 : -1
        const first = g.attacks.length
        sweep(g, s, look('bitterBlade', 'fire', 'bitterBlade'), { from: aim - (dir * BITTER_ARC) / 2, arc: dir * BITTER_ARC, time: BITTER_TIME, length: 44 * s.area, segments: 5, r: 7, inner: 10 })
        const last = g.attacks.length - 1
        for (let k = first; k <= last; k++) {
          const a = g.attacks[k]!
          a.drain = BITTER_DRAIN
          a.age = -i * 0.26
          a.flip = dir < 0
          // The outer segment draws the whole blade; the others only cut.
          if (k < last) a.visual = 'hitbox'
        }
      }
      cast(g, 'bitterBlade')
    },
  },

  /* Kabuto: quick little bites on whatever is right next to you, draining HP. */
  leechLife: {
    name: 'Leech Life',
    type: 'bug',
    tags: ['bite'],
    base: stats({ damage: 5, cooldown: 0.5, amount: 1, knockback: 8 }),
    upgrades: [
      { damage: 2 },
      { amount: 1 },
      { fork: [{ stats: { cooldown: -0.08 }, mods: ['execute'] }, { stats: { damage: 1 }, mods: ['arc'] }] },
      { damage: 2 },
      { area: 0.3 },
      { fork: [{ stats: { amount: 1 }, mods: ['hunter'] }, { stats: { damage: 3 }, mods: ['burstOnKill'] }] },
      { damage: 3 },
    ],
    fire: (g, s) => {
      const p = g.player
      const taken = new Set<number>()
      for (let i = 0; i < s.amount; i++) {
        const t = nearestEnemy(g, p.x, p.y, LEECH_REACH * s.area + 8, taken)
        if (!t) return
        taken.add(t.id)
        spawnAttack(g, {
          ...look('leechLife', 'bug', 'leechLife'), x: t.x, y: t.y - t.radius,
          shape: { kind: 'circle', r: 7 * s.area }, motion: { kind: 'static' },
          damage: s.damage, knockback: s.knockback, drain: LEECH_DRAIN, ttl: 0.3, activeFrom: 0.06, activeUntil: 0.1,
          age: -i * 0.05, flip: i % 2 === 1, from: { x: p.x, y: p.y - 10 },
        })
      }
    },
  },

  /* Houndour: a burning bite; a foe already on fire flinches instead. */
  fireFang: {
    name: 'Fire Fang',
    type: 'fire',
    tags: ['bite'],
    base: stats({ damage: 16, cooldown: 1.3, amount: 1, knockback: 50 }),
    status: { kind: 'burn', chance: 0.3, duration: 2.5, power: 0.3 },
    upgrades: [
      { damage: 5 },
      { statusChance: 0.15 },
      { fork: [{ stats: { amount: 1 }, mods: ['cruel'] }, { stats: { damage: 4 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.2 },
      { damage: 6 },
      { fork: [{ stats: { statusDamage: 0.4, statusChance: 0.1 }, mods: ['trail'] }, { stats: { area: 0.2 }, mods: ['arc'] }] },
      { amount: 1, damage: 4 },
    ],
    fire: (g, s) => {
      const p = g.player
      const taken = new Set<number>()
      for (let i = 0; i < s.amount; i++) {
        const t = nearestEnemy(g, p.x, p.y, FANG_REACH, taken)
        if (!t) return
        taken.add(t.id)
        const burning = t.status.burn.time > 0
        spawnAttack(g, {
          ...look('fireFang', 'fire', 'fireFang'), x: t.x, y: t.y - t.radius,
          shape: { kind: 'circle', r: 11 * s.area }, motion: { kind: 'static' },
          damage: s.damage, knockback: s.knockback, status: burning ? FANG_FLINCH : s.status,
          ttl: FANG_BITE + 0.26, activeFrom: FANG_BITE, activeUntil: FANG_BITE + 0.06, age: -i * 0.08, tier: burning ? 1 : 0,
        })
      }
    },
  },

  /* Teddiursa: 2 to 5 swipes, more the longer it stays in the brawl. */
  furySwipes: {
    name: 'Fury Swipes',
    type: 'normal',
    tags: ['slice'],
    base: stats({ damage: 6, cooldown: 1, amount: 1, knockback: 15 }),
    upgrades: [
      { damage: 2 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.15 }, mods: ['cruel'] }, { stats: { damage: 1 }, mods: ['arc'] }] },
      { damage: 2 },
      { amount: 1 },
      { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { area: 0.25, knockback: 30 }, mods: ['hunter'] }] },
      { damage: 3 },
    ],
    fire: (g, s, owned) => {
      const p = g.player
      const t = nearestEnemy(g, p.x, p.y, SWIPES_REACH * s.area)
      // Out of the brawl: no swing, and the frenzy cools down.
      if (!t) {
        owned.stacks = 0
        return
      }
      const stacks = stacksOf(owned)
      const swipes = swipesFor(stacks) + s.amount - 1
      const angle = dm.atan2(t.y - t.radius - (p.y - 8), t.x - p.x)
      for (let i = 0; i < swipes; i++) {
        const off = reachOffset(angle + range(g.rng, -0.5, 0.5), 15 * s.area)
        spawnAttack(g, {
          ...look('furySwipes', 'normal', 'furySwipes'), x: p.x + off.ox, y: p.y + off.oy,
          shape: { kind: 'circle', r: 12 * s.area }, motion: { kind: 'follow', ...off },
          damage: s.damage, knockback: s.knockback, ttl: 0.18, activeUntil: 0.07, age: -i * 0.08, flip: i % 2 === 1, tier: stacks,
        })
      }
      owned.stacks = swipesNext(stacks, true)
    },
  },

  /* Aron: a hop and a slam that weighs the player's armor and max HP. */
  heavySlam: {
    name: 'Heavy Slam',
    type: 'steel',
    base: stats({ damage: 18, cooldown: 2.8, knockback: 150 }),
    upgrades: [
      { damage: 6 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.4 }, mods: ['vortex'] }, { stats: { damage: 4 }, mods: ['burstOnKill'] }] },
      { damage: 8 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 4 }, mods: ['arc'] }, { stats: { knockback: 80, area: 0.2 }, mods: ['hunter'] }] },
      { damage: 9 },
    ],
    fire: (g, s) => {
      const p = g.player
      const mult = heavyMult(p.stats.armor, p.stats.maxHp)
      p.iframes = Math.max(p.iframes, HEAVY_HOP + 0.15)
      spawnAttack(g, {
        ...look('heavySlam', 'steel', 'heavySlam'), x: p.x, y: p.y,
        shape: { kind: 'circle', r: 8 }, motion: { kind: 'follow', ox: 0, oy: 0 }, damage: 0, ttl: HEAVY_HOP, activeFrom: Infinity,
      })
      spawnAttack(g, {
        ...look('heavySlam', 'steel', 'heavyQuake'), x: p.x, y: p.y,
        shape: { kind: 'circle', r: 10 }, motion: { kind: 'follow', ox: 0, oy: 0 },
        damage: s.damage * mult, knockback: s.knockback, ttl: 0.5, grow: (HEAVY_R * s.area - 10) / 0.18, activeUntil: 0.18, age: -HEAVY_HOP,
        tier: Math.round((mult - 1) * 10),
      })
    },
    onHit: (g, a) => {
      if (a.visual !== 'heavyQuake' || a.hits.size !== 1) return
      landing(g, a, 5, 0.04)
      cast(g, 'heavySlam')
    },
  },

  /* Trapinch: a ground wave rolling out ahead that slows everything it passes. */
  bulldoze: {
    name: 'Bulldoze',
    type: 'ground',
    base: stats({ damage: 13, cooldown: 2.4, amount: 1, speed: 130, knockback: 40 }),
    status: { kind: 'slow', chance: 1, duration: 1.6, power: 0.4 },
    upgrades: [
      { damage: 4 },
      { area: 0.2 },
      { fork: [{ stats: { amount: 1 }, mods: ['cruel'] }, { stats: { damage: 3 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.3 },
      { damage: 5 },
      { fork: [{ stats: { area: 0.3 }, mods: ['vortex'] }, { stats: { damage: 3, speed: 30 }, mods: ['arc'] }] },
      { amount: 1, damage: 4 },
    ],
    fire: (g, s) => {
      const p = g.player
      for (const angle of fan(aimAngle(g, 200), s.amount, 0.8)) {
        const v = fromAngle(angle, s.speed)
        const hits = new Map<number, number>()
        for (const c of row(p.x + dm.cos(angle) * 10, p.y + dm.sin(angle) * 10, angle, BULLDOZE_SEGMENTS, BULLDOZE_GAP * s.area)) {
          spawnAttack(g, {
            ...look('bulldoze', 'ground', 'bulldoze'), x: c.x, y: c.y,
            shape: { kind: 'circle', r: 8 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
            damage: s.damage, knockback: s.knockback, status: s.status, hits, ttl: BULLDOZE_TTL, tier: c.k, age: -Math.abs(c.k - 2) * 0.03,
          })
        }
      }
      shakeScreen(g, 2)
      cast(g, 'bulldoze')
    },
  },

  /* Swablu: a song that marks every foe on screen; three seconds later they perish (bosses lose a capped share). */
  perishSong: {
    name: 'Perish Song',
    type: 'normal',
    tags: ['sound'],
    base: stats({ damage: 24, cooldown: 16 }),
    upgrades: [
      { damage: 8 },
      { cooldown: -1 },
      { fork: [{ stats: { damage: 12 }, mods: ['hunter'] }, { stats: { cooldown: -1.5 }, mods: ['execute'] }] },
      { damage: 10 },
      { cooldown: -1 },
      { fork: [{ stats: { damage: 8 }, mods: ['burstOnKill'] }, { stats: { damage: -6, cooldown: -2 }, mods: ['cruel'] }] },
      { damage: 12 },
    ],
    fire: (g, s) => {
      const p = g.player
      const foes = enemiesInView(g)
      if (foes.length === 0) return
      spawnAttack(g, {
        ...look('perishSong', 'normal', 'perishWave'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: 8 }, motion: { kind: 'follow', ox: 0, oy: -8 }, damage: 0, ttl: 0.9, grow: 260, activeFrom: Infinity,
      })
      for (const e of foes) {
        // A mark already counting down is renewed, not doubled.
        for (const a of g.attacks) if (ownAttack(g, a) && a.move === 'perishSong' && a.motion.kind === 'tether' && a.motion.target === e) a.ttl = a.age
        spawnAttack(g, {
          ...look('perishSong', 'normal', 'perishMark'), x: e.x, y: e.y - e.radius,
          shape: { kind: 'circle', r: 6 }, motion: { kind: 'tether', target: e, every: Infinity, next: PERISH_TIME },
          damage: perishDamage(s.damage, e.maxHp, e.boss), sure: true, ttl: PERISH_TIME + 0.4, activeFrom: Infinity, tier: e.boss ? 1 : 0,
        })
      }
      cast(g, 'perishSong')
    },
  },

  /* Electrike: an electric beam that may charge the player up. */
  chargeBeam: {
    name: 'Charge Beam',
    type: 'electric',
    base: stats({ damage: 14, cooldown: 1.8, amount: 1, duration: 0.25, knockback: 30 }),
    upgrades: [
      { damage: 4 },
      { area: 0.2 },
      { fork: [{ stats: { amount: 1 }, mods: ['hunter'] }, { stats: { damage: 3 }, mods: ['arc'] }] },
      { cooldown: -0.2 },
      { damage: 5 },
      { fork: [{ stats: { area: 0.3 }, mods: ['execute'] }, { stats: { damage: 5 }, mods: ['burstOnKill'] }] },
      { amount: 1, damage: 3 },
    ],
    fire: (g, s) => {
      for (const angle of fan(aimAngle(g, 160), s.amount, 0.35)) {
        const first = g.attacks.length
        sweep(g, s, look('chargeBeam', 'electric', 'chargeBeam'), { from: angle, arc: 0, time: s.duration, length: 120 * s.area, segments: 9, r: 6, inner: 10 })
        const last = g.attacks.length - 1
        for (let k = first; k < last; k++) g.attacks[k]!.visual = 'hitbox'
      }
      mightUp(g, 'chargeBeam', CHARGE_MIGHT)
      cast(g, 'chargeBeam')
    },
  },

  /* Ralts: a slow moon orb that bursts on impact, weakening foes' attacks. */
  moonblast: {
    name: 'Moonblast',
    type: 'fairy',
    base: stats({ damage: 18, cooldown: 1.9, amount: 1, speed: 110, pierce: 2, knockback: 50 }),
    status: { kind: 'weaken', chance: 0.5, duration: 3, power: 0.3 },
    upgrades: [
      { damage: 5 },
      { statusChance: 0.2 },
      { fork: [{ stats: { pierce: 2 }, mods: ['cruel'] }, { stats: { damage: 3 }, mods: ['seek'] }] },
      { cooldown: -0.25 },
      { damage: 6 },
      { fork: [{ stats: { amount: 1 }, mods: ['split'] }, { stats: { area: 0.3 }, mods: ['hunter'] }] },
      { damage: 6, area: 0.15 },
    ],
    fire: (g, s) => {
      const p = g.player
      for (const angle of fan(aimAngle(g, 240), s.amount, 0.3)) {
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          ...look('moonblast', 'fairy', 'moonblast'), x: p.x, y: p.y - 10,
          shape: { kind: 'circle', r: 7 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, status: s.status, ttl: 2.2,
          // The orb's size, for the burst it leaves.
          memo: s.area,
        })
      }
      cast(g, 'moonblast')
    },
    // Each impact blooms into a burst of moonlight around the foe.
    onHit: (g, a, e) => {
      if (a.visual !== 'moonblast') return
      spawnAttack(g, {
        ...look('moonblast', 'fairy', 'moonBurst'), x: e.x, y: e.y - e.radius,
        shape: { kind: 'circle', r: 6 }, motion: { kind: 'static' },
        damage: a.damage * MOON_SHARE, knockback: a.knockback * 0.6, status: a.status, ttl: 0.42, activeUntil: 0.18,
        grow: (MOON_BURST * a.memo - 6) / 0.18, hits: new Map([[e.id, Infinity]]),
      })
    },
  },

  /* Snorunt: an icy breath whose hits always crit on chilled or frozen foes. */
  frostBreath: {
    name: 'Frost Breath',
    type: 'ice',
    base: stats({ damage: 7, cooldown: 1.5, amount: 5, speed: 150, knockback: 15 }),
    status: { kind: 'slow', chance: 0.5, duration: 1.5, power: 0.35 },
    upgrades: [
      { damage: 2 },
      { amount: 2 },
      { fork: [{ stats: { statusChance: 0.3 }, mods: ['execute'] }, { stats: { damage: 2 }, mods: ['arc'] }] },
      { cooldown: -0.2 },
      { damage: 3 },
      { fork: [{ stats: { area: 0.3 }, mods: ['vortex'] }, { stats: { amount: 2, speed: 40 }, mods: ['hunter'] }] },
      { damage: 3, statusChance: 0.1 },
    ],
    fire: (g, s) => {
      const p = g.player
      fan(aimAngle(g, 120), s.amount, 0.16).forEach((a, i) => {
        const v = fromAngle(a + range(g.rng, -0.06, 0.06), s.speed * range(g.rng, 0.6, 1.1))
        spawnAttack(g, {
          ...look('frostBreath', 'ice', 'frostBreath'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 3 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, bonus: FROST, status: s.status, ttl: 0.5, grow: 15 * s.area,
          age: -Math.abs(i - (s.amount - 1) / 2) * 0.035, flip: i % 2 === 1,
        })
      })
      cast(g, 'frostBreath')
    },
  },

  /* Swinub: a snow slide crashing down on the nearest foe, twice as hard right after you took a hit. */
  avalanche: {
    name: 'Avalanche',
    type: 'ice',
    base: stats({ damage: 14, cooldown: 3, amount: 1, knockback: 90 }),
    status: { kind: 'slow', chance: 0.4, duration: 1.2, power: 0.35 },
    stacks: { grow: 'hurt', max: 1, reset: 'cast' },
    upgrades: [
      { damage: 4 },
      { area: 0.2 },
      { fork: [{ stats: { amount: 1 }, mods: ['hunter'] }, { stats: { damage: 4 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.3 },
      { damage: 5 },
      { fork: [{ stats: { area: 0.25, knockback: 50 }, mods: ['execute'] }, { stats: { damage: 3 }, mods: ['arc'] }] },
      { damage: 5, amount: 1 },
    ],
    fire: (g, s, owned) => {
      const p = g.player
      const revenge = stacksOf(owned) > 0
      const damage = s.damage * avalancheMult(stacksOf(owned))
      const taken = new Set<number>()
      for (let i = 0; i < s.amount; i++) {
        const t = nearestEnemy(g, p.x, p.y, 200, taken)
        if (t) taken.add(t.id)
        const tx = t ? t.x : p.x + p.facing.x * 60 + range(g.rng, -20, 20)
        const ty = t ? t.y : p.y + p.facing.y * 60
        const hits = new Map<number, number>()
        const fall = (AVALANCHE_DROP + 24) / AVALANCHE_SPEED
        for (const c of row(tx, ty - AVALANCHE_DROP, Math.PI / 2, AVALANCHE_CHUNKS, AVALANCHE_GAP * s.area)) {
          spawnAttack(g, {
            ...look('avalanche', 'ice', 'avalanche'), x: c.x, y: c.y + (c.k % 2) * 6,
            shape: { kind: 'circle', r: 9 * s.area }, motion: { kind: 'linear', vx: 0, vy: AVALANCHE_SPEED },
            damage, knockback: s.knockback, status: s.status, hits, ttl: fall, activeFrom: fall * 0.55,
            age: -i * 0.18 - Math.abs(c.k - 2) * 0.04, tier: revenge ? 1 : 0, memo: ty, flip: c.k % 2 === 1,
          })
        }
      }
      cast(g, 'avalanche')
    },
    onHit: (g, a) => landing(g, a, a.tier > 0 ? 5 : 3),
  },
} as const satisfies Record<string, MoveDef>

export type EggMove3Id = keyof typeof EGG_MOVES_3

/** For the dev console (`ps.sig3()`), in table order. */
export const EGG_MOVE_3_IDS = Object.keys(EGG_MOVES_3) as EggMove3Id[]

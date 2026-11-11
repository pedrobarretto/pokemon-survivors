import { dirTo, fromAngle, TAU } from '../engine/math'
import * as dm from '../engine/dmath'
import type { PokeType } from '../data/types'
import { chance } from '../engine/rng'
import { dotDamage } from './combat'
import { burst, shakeScreen } from './effects'
import { GA_KIT, guillotineReady, poisonCash, teaPuddles } from './gaKitARules'
import { furPunch, huntStrikes, pourTea, sapHit } from './gaKitASystem'
import { LUNGE_IFRAMES, LUNGE_MIN_COOLDOWN } from './moveRules'
import { sweep, throwFoe, wanderer } from './moveKit'
import type { CastStats, Look, MoveDef, MoveId, MoveStats } from './moves'
import { nearestEnemy } from './queries'
import { recomputeStats } from './leveling'
import { spawnAttack } from './spawn'
import { applyStatus, clearAffliction, dotDps } from './status'
import type { Game } from './types'

/**
 * The signature moves of the big update's first 15 families
 * (`data/gaFamiliesA.ts`). Each reads its family's state (`Player.kitA`) in
 * `fire` or `onHit`, so a card stays one move while the mechanic shapes it.
 * Numbers live here and in `gaKitARules.ts`, the look in `render/gaKitAFx.ts`.
 * Seeded rng and `dmath` only, and no `moves.ts` at runtime (it is evaluated
 * first): only its types.
 */

const stats = (s: Partial<MoveStats>): MoveStats => ({
  damage: 0, cooldown: 1, area: 1, amount: 1, speed: 0, duration: 1, pierce: Infinity, knockback: 0, statusChance: 0, statusDamage: 0, ...s,
})

const look = (move: MoveId, type: PokeType, visual: Look['visual']): Look => ({ move, type, visual })

/** Lets the shell play the move's own sound (`ui/castSounds.ts`). */
const cast = (g: Game, move: MoveId) => g.events.push({ kind: 'cast', move })

/** Toward the nearest foe within `reach`, else where the player faces. */
const aimAngle = (g: Game, reach: number) => {
  const p = g.player
  const target = nearestEnemy(g, p.x, p.y, reach)
  const d = target ? dirTo(p.x, p.y, target.x, target.y, p.facing) : p.facing
  return dm.atan2(d.y, d.x)
}

/** A short strike glued to the player, `dist` px toward `angle`, landing `delay` s from now. */
const strikeAt = (g: Game, s: CastStats, l: Look, angle: number, dist: number, r: number, ttl: number, delay = 0, damage = s.damage) => {
  const d = fromAngle(angle, dist)
  return spawnAttack(g, {
    ...l, x: g.player.x + d.x, y: g.player.y - 8 + d.y,
    shape: { kind: 'circle', r: r * s.area }, motion: { kind: 'follow', ox: d.x, oy: d.y - 8 },
    damage, knockback: s.knockback, status: s.status, ttl, activeUntil: Math.min(ttl, 0.1), age: -delay, flip: dm.cos(angle) < 0,
  })
}

/** A ring that spreads around the player once. */
const wave = (g: Game, s: CastStats, l: Look, reach: number, damage = s.damage) => {
  const p = g.player
  return spawnAttack(g, {
    ...l, x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: 6 }, motion: { kind: 'follow', ox: 0, oy: -8 }, grow: Math.max(0, reach - 6) / 0.3,
    damage, knockback: s.knockback, status: s.status, ttl: 0.4, activeUntil: 0.3,
  })
}

/** Haxorus's Guillotine: Dual Chop spends a full dance on one huge chop that fells the weak and bites into bosses. */
const guillotine = (g: Game, s: CastStats) => {
  const p = g.player
  const a = strikeAt(g, s, look('dualChop', 'dragon', 'gaGuillotine'), aimAngle(g, 110), 26, 24, 0.32, 0, s.damage * 2.2)
  a.execute = GA_KIT.dance.execute
  a.bonus = [{ when: 'boss', mult: GA_KIT.dance.boss }]
  a.knockback = s.knockback * 3
  if (p.kitA?.kind === 'dance') {
    p.kitA.stacks = 0
    p.kitA.calm = 0
    recomputeStats(g)
  }
  shakeScreen(g, 6)
  burst(g, p.x, p.y - 12, { colors: ['#e83838', '#ffffff', '#90a050'], count: 30, speed: 140, ttl: 0.4, size: 2 })
}

export const GA_KIT_A_MOVES = {
  /* Jangmo-o's line: its scales clang out a ring of sound, wider while Clangorous Soul runs. */
  clangingScales: {
    name: 'Clanging Scales',
    type: 'dragon',
    base: stats({ damage: 9, cooldown: 1.8, knockback: 60 }),
    tags: ['sound'],
    upgrades: [
      { damage: 2 },
      { area: 0.15 },
      { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.2 }, mods: ['cruel'] }] },
      { damage: 2 },
      { area: 0.15 },
      { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { cooldown: -0.2 }, mods: ['echo'] }] },
      { damage: 3 },
    ],
    fire: (g, s) => {
      const k = g.player.kitA
      const soul = k?.kind === 'soul' && k.left > 0
      wave(g, s, look('clangingScales', 'dragon', 'gaRing'), 46 * s.area * (soul ? GA_KIT.soul.wave : 1))
      cast(g, 'clangingScales')
    },
  },

  /* Axew's line: two quick chops in front; Haxorus with a full dance swings a Guillotine instead. */
  dualChop: {
    name: 'Dual Chop',
    type: 'dragon',
    base: stats({ damage: 7, cooldown: 1.2, knockback: 30 }),
    tags: ['slice'],
    upgrades: [
      { damage: 2 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 2 }, mods: ['execute'] }, { stats: { cooldown: -0.12 }, mods: ['arc'] }] },
      { damage: 2 },
      { cooldown: -0.1 },
      { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['burstOnKill'] }] },
      { damage: 3 },
    ],
    fire: (g, s) => {
      const p = g.player
      if (p.kitA?.kind === 'dance' && guillotineReady(p.kitA.stacks, p.stage)) guillotine(g, s)
      else {
        const angle = aimAngle(g, 90)
        const l = look('dualChop', 'dragon', 'gaChop')
        strikeAt(g, s, l, angle - 0.35, 18, 12, 0.2)
        strikeAt(g, s, l, angle + 0.35, 18, 12, 0.2, 0.12)
      }
      cast(g, 'dualChop')
    },
  },

  /* Lapras: a lullaby that rolls out and puts foes to sleep; afloat, it carries farther. */
  sing: {
    name: 'Sing',
    type: 'normal',
    base: stats({ damage: 4, cooldown: 2.6, knockback: 10 }),
    status: { kind: 'sleep', chance: 0.55, duration: 1.8, power: 0 },
    tags: ['sound'],
    upgrades: [
      { damage: 1 },
      { area: 0.15 },
      { fork: [{ stats: { statusChance: 0.1 }, mods: ['cruel'] }, { stats: { cooldown: -0.3 }, mods: ['drain'] }] },
      { damage: 2 },
      { area: 0.15 },
      { fork: [{ stats: { damage: 2 }, mods: ['echo'] }, { stats: { statusChance: 0.1 }, mods: ['burstOnKill'] }] },
      { damage: 2 },
    ],
    fire: (g, s) => {
      const k = g.player.kitA
      const afloat = k?.kind === 'ferry' && k.afloat
      wave(g, s, look('sing', 'normal', 'gaSing'), 64 * s.area * (afloat ? GA_KIT.ferry.sing : 1))
      cast(g, 'sing')
    },
  },

  /* Sneasel's line: the pack's claws fall on the nearest foes, more of them the longer the hunt runs. Weavile's chill. */
  beatUp: {
    name: 'Beat Up',
    type: 'dark',
    base: stats({ damage: 5, cooldown: 1.5, knockback: 16 }),
    upgrades: [
      { damage: 1 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 1 }, mods: ['cruel'] }, { stats: { cooldown: -0.15 }, mods: ['arc'] }] },
      { damage: 2 },
      { cooldown: -0.12 },
      { fork: [{ stats: { damage: 2 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['burstOnKill'] }] },
      { damage: 2 },
    ],
    fire: (g, s) => {
      const p = g.player
      const count = huntStrikes(g)
      const taken = new Set<number>()
      const status = p.stage >= 1 ? { kind: 'slow', chance: 0.3, duration: 1.2, power: 0.4 } as const : s.status
      for (let i = 0; i < count; i++) {
        const e = nearestEnemy(g, p.x, p.y, 130, taken) ?? nearestEnemy(g, p.x, p.y, 130)
        const f = fromAngle(dm.atan2(p.facing.y, p.facing.x) + (i - (count - 1) / 2) * 0.5, 22)
        const x = e ? e.x : p.x + f.x
        const y = e ? e.y - e.radius : p.y - 8 + f.y
        if (e) taken.add(e.id)
        spawnAttack(g, {
          ...look('beatUp', 'dark', 'gaClaw'), x, y,
          shape: { kind: 'circle', r: 10 * s.area }, motion: { kind: 'static' },
          damage: s.damage, knockback: s.knockback, status, ttl: 0.2, activeUntil: 0.06, age: -i * 0.07, flip: i % 2 === 1,
        })
      }
      cast(g, 'beatUp')
    },
  },

  /* Heracross: gores the foe in front and flings it into the crowd; each gore draws sap. */
  hornAttack: {
    name: 'Horn Attack',
    type: 'normal',
    base: stats({ damage: 14, cooldown: 1.9, knockback: 40 }),
    upgrades: [
      { damage: 2 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.15 }, mods: ['cruel'] }] },
      { damage: 3 },
      { cooldown: -0.12 },
      { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['echo'] }] },
      { damage: 3 },
    ],
    onHit: (g, a, e) => {
      if (a.visual !== 'gaHorn') return
      sapHit(g)
      if (e.boss) return
      const k = g.player.kitA
      const rush = k?.kind === 'sap' && k.rush > 0
      const p = g.player
      throwFoe(g, e, dm.atan2(e.y - p.y, e.x - p.x), 240 * (rush ? GA_KIT.sap.fling : 1), a.damage * 0.6, 'hornAttack')
    },
    fire: (g, s) => {
      strikeAt(g, s, look('hornAttack', 'normal', 'gaHorn'), aimAngle(g, 90), 20, 12, 0.22)
      cast(g, 'hornAttack')
    },
  },

  /* Sableye: its shadow slides along the ground and bursts up under a foe. */
  shadowSneak: {
    name: 'Shadow Sneak',
    type: 'ghost',
    base: stats({ damage: 9, cooldown: 1.4, speed: 230, pierce: 2, knockback: 30 }),
    upgrades: [
      { damage: 2 },
      { pierce: 1 },
      { fork: [{ stats: { damage: 2 }, mods: ['seek'] }, { stats: { cooldown: -0.15 }, mods: ['split'] }] },
      { damage: 2 },
      { amount: 1 },
      { fork: [{ stats: { damage: 3 }, mods: ['cruel'] }, { stats: { area: 0.2 }, mods: ['burstOnKill'] }] },
      { damage: 3 },
    ],
    fire: (g, s) => {
      const p = g.player
      const center = aimAngle(g, 240)
      for (let i = 0; i < s.amount; i++) {
        const v = fromAngle(center + (i - (s.amount - 1) / 2) * 0.35, s.speed)
        spawnAttack(g, {
          ...look('shadowSneak', 'ghost', 'gaShadow'), x: p.x, y: p.y - 2,
          shape: { kind: 'circle', r: 9 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, status: s.status, ttl: 1.1, age: -i * 0.06,
        })
      }
      cast(g, 'shadowSneak')
    },
  },

  /* Spiritomb's: an eerie wind of wisps that wander around you. */
  ominousWind: {
    name: 'Ominous Wind',
    type: 'ghost',
    base: stats({ damage: 6, cooldown: 2.4, duration: 2.6, amount: 2, knockback: 20 }),
    upgrades: [
      { damage: 1 },
      { amount: 1 },
      { fork: [{ stats: { damage: 1 }, mods: ['drain'] }, { stats: { duration: 0.5 }, mods: ['cruel'] }] },
      { damage: 2 },
      { amount: 1 },
      { fork: [{ stats: { damage: 2 }, mods: ['hunter'] }, { stats: { cooldown: -0.3 }, mods: ['burstOnKill'] }] },
      { damage: 2 },
    ],
    fire: (g, s) => {
      for (let i = 0; i < s.amount; i++) wanderer(g, s, look('ominousWind', 'ghost', 'gaWisp'), { r: 8, speed: 70, ttl: s.duration, leash: 80, hitInterval: 0.5 })
      cast(g, 'ominousWind')
    },
  },

  /* Croagunk's line: a toxic jab. On a foe already poisoned, it cashes the poison in at once, and the sacs swell. */
  poisonJab: {
    name: 'Poison Jab',
    type: 'poison',
    base: stats({ damage: 10, cooldown: 1.4, knockback: 40 }),
    status: { kind: 'poison', chance: 0.5, duration: 3, power: 0.3 },
    tags: ['punch'],
    upgrades: [
      { damage: 2 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 2 }, mods: ['cruel'] }, { stats: { cooldown: -0.15 }, mods: ['arc'] }] },
      { damage: 2 },
      { cooldown: -0.12 },
      { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['burstOnKill'] }] },
      { damage: 3 },
    ],
    onHit: (g, a, e) => {
      if (a.visual !== 'gaJab' || e.dying >= 0) return
      const poison = e.status.poison
      if (poison.time <= 0) {
        // `memo` carries the cast's poison chance: the jab poisons here, so a foe it just poisoned isn't cashed in.
        if (chance(g.rng, a.memo)) applyStatus(e.status, GA_KIT.sacs.poison, a.damage, e.boss, 'poisonJab', g.player.slot)
        return
      }
      const cash = poisonCash(dotDps(poison), poison.time)
      clearAffliction(poison)
      burst(g, e.x, e.y - e.radius, { colors: ['#a040c0', '#e8a8f8', '#ffffff'], count: 10, speed: 90, ttl: 0.35 })
      if (cash > 0) dotDamage(g, e, cash, 'poisonJab', 'poison')
      const k = g.player.kitA
      if (k?.kind !== 'sacs') return
      k.sacs++
      if (k.sacs < GA_KIT.sacs.need) return
      // The sacs croak: a toxic ring around the player.
      k.sacs = 0
      const p = g.player
      const r = GA_KIT.sacs.r * p.stats.area * (p.stage >= 1 ? 1 : GA_KIT.sacs.small)
      spawnAttack(g, {
        move: 'poisonJab', type: 'poison', visual: 'gaCroak', x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: 6 }, motion: { kind: 'follow', ox: 0, oy: -8 }, grow: (r - 6) / 0.3,
        damage: GA_KIT.sacs.power * p.stats.might * (1 + 0.04 * (p.level - 1)), knockback: 90, status: GA_KIT.sacs.poison, ttl: 0.4, activeUntil: 0.3,
      })
      shakeScreen(g, 4)
      g.events.push({ kind: 'guard' })
    },
    fire: (g, s) => {
      const a = strikeAt(g, { ...s, status: null }, look('poisonJab', 'poison', 'gaJab'), aimAngle(g, 80), 20, 11, 0.2)
      a.memo = s.status?.chance ?? 0
      cast(g, 'poisonJab')
    },
  },

  /* Sinistea's line: pours cups of hot tea around it; standing in its own tea it sips HP back. */
  teatime: {
    name: 'Teatime',
    type: 'normal',
    base: stats({ damage: 7, cooldown: 3, knockback: 0 }),
    upgrades: [
      { damage: 1 },
      { area: 0.15 },
      { fork: [{ stats: { damage: 1 }, mods: ['drain'] }, { stats: { cooldown: -0.3 }, mods: ['cruel'] }] },
      { damage: 2 },
      { area: 0.15 },
      { fork: [{ stats: { damage: 2 }, mods: ['hunter'] }, { stats: { cooldown: -0.3 }, mods: ['burstOnKill'] }] },
      { damage: 2 },
    ],
    fire: (g, s) => {
      const p = g.player
      const count = teaPuddles(p.stage, p.branch)
      for (let i = 0; i < count; i++) {
        const at = fromAngle((i / count) * TAU + g.now * 0.7, 26 * s.area)
        pourTea(g, p.x + at.x, p.y + at.y * 0.7, s.damage, s.area)
      }
      burst(g, p.x, p.y - 14, { colors: ['#c89068', '#f8e0b0', '#ffffff'], count: 10, speed: 60, ttl: 0.4, gravity: 80 })
      cast(g, 'teatime')
    },
  },

  /* Impidimp's line: a bow, then a jab that never misses at the nearest foe; with the hair coiled, two. */
  falseSurrender: {
    name: 'False Surrender',
    type: 'dark',
    base: stats({ damage: 12, cooldown: 1.7, knockback: 40 }),
    status: { kind: 'confuse', chance: 0.35, duration: 2.5, power: 0 },
    upgrades: [
      { damage: 2 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 2 }, mods: ['cruel'] }, { stats: { cooldown: -0.15 }, mods: ['arc'] }] },
      { damage: 2 },
      { cooldown: -0.12 },
      { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['burstOnKill'] }] },
      { damage: 3 },
    ],
    fire: (g, s) => {
      const p = g.player
      const k = p.kitA
      const jabs = k?.kind === 'mischief' && k.left > 0 ? 2 : 1
      const taken = new Set<number>()
      for (let i = 0; i < jabs; i++) {
        const e = nearestEnemy(g, p.x, p.y, 120, taken)
        if (!e) break
        taken.add(e.id)
        const a = spawnAttack(g, {
          ...look('falseSurrender', 'dark', 'gaBow'), x: e.x, y: e.y - e.radius,
          shape: { kind: 'circle', r: 10 * s.area }, motion: { kind: 'static' },
          damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.3, activeUntil: 0.06, age: -0.22 - i * 0.1, flip: e.x < p.x,
        })
        a.sure = true
      }
      burst(g, p.x, p.y - 10, { colors: ['#c05878', '#f8a0c8'], count: 6, speed: 40, ttl: 0.3 })
      cast(g, 'falseSurrender')
    },
  },

  /* Pawmi's line: a quick hop that rubs a charged cheek on the nearest foe; each lands charge in the fur. */
  nuzzle: {
    name: 'Nuzzle',
    type: 'electric',
    base: stats({ damage: 8, cooldown: 1.5, speed: 240, knockback: 30 }),
    status: { kind: 'paralysis', chance: 0.35, duration: 1, power: 0 },
    minCooldown: LUNGE_MIN_COOLDOWN,
    upgrades: [
      { damage: 2 },
      { cooldown: -0.1 },
      { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.1 }, mods: ['arc'] }] },
      { damage: 2 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['echo'] }] },
      { damage: 3 },
    ],
    onHit: (g, a) => {
      if (a.visual === 'gaSpark') furPunch(g)
    },
    fire: (g, s) => {
      const p = g.player
      const d = fromAngle(aimAngle(g, 120), s.speed)
      p.iframes = Math.max(p.iframes, LUNGE_IFRAMES)
      spawnAttack(g, {
        ...look('nuzzle', 'electric', 'gaSpark'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: 11 * s.area }, motion: { kind: 'lunge', vx: d.x, vy: d.y, left: 0.16 },
        damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.22,
      })
      cast(g, 'nuzzle')
    },
  },

  /* Rookidee's line: a sweep of hard wings in front. */
  steelWing: {
    name: 'Steel Wing',
    type: 'steel',
    base: stats({ damage: 9, cooldown: 1.5, knockback: 40 }),
    upgrades: [
      { damage: 2 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.15 }, mods: ['arc'] }] },
      { damage: 2 },
      { cooldown: -0.12 },
      { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['echo'] }] },
      { damage: 3 },
    ],
    fire: (g, s) => {
      const angle = aimAngle(g, 100)
      sweep(g, s, look('steelWing', 'steel', 'gaWing'), { from: angle - 1.1, arc: 2.2, time: 0.2, length: 40 * s.area, segments: 4, r: 8 })
      cast(g, 'steelWing')
    },
  },

  /* Elekid's line: an electric punch in front; the cables carry half of it to the foes they hold. */
  thunderPunch: {
    name: 'Thunder Punch',
    type: 'electric',
    base: stats({ damage: 12, cooldown: 1.6, knockback: 50 }),
    status: { kind: 'paralysis', chance: 0.3, duration: 1, power: 0 },
    tags: ['punch'],
    upgrades: [
      { damage: 2 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 2 }, mods: ['arc'] }, { stats: { cooldown: -0.15 }, mods: ['cruel'] }] },
      { damage: 3 },
      { cooldown: -0.12 },
      { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['echo'] }] },
      { damage: 3 },
    ],
    fire: (g, s) => {
      const p = g.player
      strikeAt(g, s, look('thunderPunch', 'electric', 'gaPunch'), aimAngle(g, 80), 20, 12, 0.22)
      const k = p.kitA
      if (k?.kind === 'cables')
        for (const id of k.links) {
          const e = g.enemies.find((f) => f.id === id && f.dying < 0)
          if (!e) continue
          spawnAttack(g, {
            ...look('thunderPunch', 'electric', 'gaZap'), x: e.x, y: e.y - e.radius,
            shape: { kind: 'circle', r: e.radius + 3 }, motion: { kind: 'static' },
            damage: s.damage * 0.5, knockback: 20, status: s.status, ttl: 0.16, activeUntil: 0.05,
          })
        }
      cast(g, 'thunderPunch')
    },
  },

  /* Magby's line: a fireball that bursts into flames where it lands. */
  flameBurst: {
    name: 'Flame Burst',
    type: 'fire',
    base: stats({ damage: 10, cooldown: 1.5, speed: 190, pierce: 1, knockback: 30 }),
    status: { kind: 'burn', chance: 0.25, duration: 2.5, power: 0.3 },
    upgrades: [
      { damage: 2 },
      { area: 0.15 },
      { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.15 }, mods: ['seek'] }] },
      { damage: 2 },
      { amount: 1 },
      { fork: [{ stats: { damage: 3 }, mods: ['cruel'] }, { stats: { area: 0.2 }, mods: ['split'] }] },
      { damage: 3 },
    ],
    onHit: (g, a, e) => {
      if (a.visual !== 'gaFlame') return
      // The ball bursts: a splash of flame on the foes around the one it struck.
      spawnAttack(g, {
        move: 'flameBurst', type: 'fire', visual: 'gaFlameSplash', x: e.x, y: e.y - e.radius,
        shape: { kind: 'circle', r: 22 }, motion: { kind: 'static' },
        damage: a.damage * 0.5, knockback: 30, status: a.status, ttl: 0.3, activeUntil: 0.06, hits: new Map([[e.id, Infinity]]),
      })
    },
    fire: (g, s) => {
      const p = g.player
      const center = aimAngle(g, 240)
      for (let i = 0; i < s.amount; i++) {
        const v = fromAngle(center + (i - (s.amount - 1) / 2) * 0.3, s.speed)
        spawnAttack(g, {
          ...look('flameBurst', 'fire', 'gaFlame'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 7 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, status: s.status, ttl: 1.3, age: -i * 0.05,
        })
      }
      cast(g, 'flameBurst')
    },
  },

  /* Nincada's line: a quick bite in front; Ninjask bites twice. */
  bugBite: {
    name: 'Bug Bite',
    type: 'bug',
    base: stats({ damage: 7, cooldown: 1.1, knockback: 20 }),
    tags: ['bite'],
    upgrades: [
      { damage: 2 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 1 }, mods: ['drain'] }, { stats: { cooldown: -0.12 }, mods: ['cruel'] }] },
      { damage: 2 },
      { cooldown: -0.1 },
      { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['burstOnKill'] }] },
      { damage: 2 },
    ],
    fire: (g, s) => {
      const p = g.player
      const angle = aimAngle(g, 80)
      const l = look('bugBite', 'bug', 'gaBite')
      strikeAt(g, s, l, angle, 16, 10, 0.18)
      if (p.stage >= 1 && p.branch !== 'shedinja') strikeAt(g, s, l, angle + 0.3, 18, 10, 0.18, 0.1)
      cast(g, 'bugBite')
    },
  },
} as const satisfies Record<string, MoveDef>

export type GaKitAMoveId = keyof typeof GA_KIT_A_MOVES

export const GA_KIT_A_MOVE_IDS = Object.keys(GA_KIT_A_MOVES) as GaKitAMoveId[]

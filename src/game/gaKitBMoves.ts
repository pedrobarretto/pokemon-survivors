import { dirTo, fromAngle } from '../engine/math'
import * as dm from '../engine/dmath'
import type { PokeType } from '../data/types'
import { damageEnemy } from './combat'
import { atStage, KIT_B, launcherShot } from './gaKitBRules'
import { GA_KIT_B_UPGRADES } from './gaKitBUpgrades'
import { strike, sweep } from './moveKit'
import { chainDamage, chainTargets, LUNGE_IFRAMES, LUNGE_MIN_COOLDOWN } from './moveRules'
import type { CastStats, Look, MoveDef, MoveId, MoveStats } from './moves'
import { ownAttack } from './players'
import { nearestEnemy } from './queries'
import { spawnAttack } from './spawn'
import type { StatusSpec } from './status'
import type { Attack, Enemy, Game, Visual } from './types'
import { weatherHere } from './weather'

/**
 * The Grande Atualização's second batch of signatures, one per family
 * (`data/gaFamiliesB.ts`). Some read the family's mechanic in `fire`
 * (Clauncher's Mega Launcher, Fletchling's Gale Wings) and Spark latches on
 * from Eelektrik on. Their steps live in `gaKitBUpgrades.ts`, their look in
 * `render/gaKitBFx.ts`. Seeded rng and `dmath` only, and no `moves.ts` at
 * runtime (it is evaluated first): only its types.
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

/** A short strike glued to the player, `dist` px toward `angle`. */
const strikeAt = (g: Game, s: CastStats, l: Look, angle: number, dist: number, r: number, ttl: number, damage = s.damage) => {
  const d = fromAngle(angle, dist)
  return spawnAttack(g, {
    ...l, x: g.player.x + d.x, y: g.player.y - 8 + d.y,
    shape: { kind: 'circle', r: r * s.area }, motion: { kind: 'follow', ox: d.x, oy: d.y - 8 },
    damage, knockback: s.knockback, status: s.status, ttl, activeUntil: Math.min(ttl, 0.1), flip: dm.cos(angle) < 0,
  })
}

/** A dash that carries the player into the nearest foe (Jet Punch's shape), with a moment of i-frames. */
const lungeAt = (g: Game, s: CastStats, l: Look, reach: number, damage = s.damage) => {
  const p = g.player
  const d = fromAngle(aimAngle(g, reach), s.speed)
  p.iframes = Math.max(p.iframes, LUNGE_IFRAMES)
  return spawnAttack(g, {
    ...l, x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: 12 * s.area }, motion: { kind: 'lunge', vx: d.x, vy: d.y, left: 0.18 },
    damage, knockback: s.knockback, status: s.status, ttl: 0.24,
  })
}

/** Homing shots that curve onto the nearest foes: Aura Sphere and Shadow Punch never miss. */
const homingShots = (g: Game, s: CastStats, l: Look, r: number, turn: number, damage = s.damage, pierce = s.pierce) => {
  const p = g.player
  const center = aimAngle(g, 260)
  for (let i = 0; i < s.amount; i++) {
    const v = fromAngle(center + (i - (s.amount - 1) / 2) * 0.5, s.speed)
    spawnAttack(g, {
      ...l, x: p.x, y: p.y - 10,
      shape: { kind: 'circle', r: r * s.area }, motion: { kind: 'homing', vx: v.x, vy: v.y, speed: s.speed, turn, target: null },
      damage, knockback: s.knockback, pierce, status: s.status, ttl: 2.2, age: -i * 0.06,
    })
  }
}

/** Straight shots in an even fan around `center`. */
const fanShots = (g: Game, s: CastStats, l: Look, center: number, step: number, r: number, ttl: number) => {
  const p = g.player
  for (let i = 0; i < s.amount; i++) {
    const v = fromAngle(center + (i - (s.amount - 1) / 2) * step, s.speed)
    spawnAttack(g, {
      ...l, x: p.x, y: p.y - 8,
      shape: { kind: 'circle', r: r * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
      damage: s.damage, knockback: s.knockback, pierce: s.pierce, status: s.status, ttl, age: -i * 0.05, flip: i % 2 === 1,
    })
  }
}

/** Electro Shot's charge and beam (× area), and its rain boost. */
export const ELECTRO_SHOT = { charge: 0.8, length: 150, segments: 7, r: 7, time: 0.22, rain: 1.2 } as const

/** Salt Cure's crust: the mark it leaves (each stack takes more from every hit). */
const SALT_MARK: StatusSpec = { kind: 'mark', chance: 0.5, duration: 3.5, power: 0.12 }

/**
 * Spark's latch from Eelektrik on: renews the one already on, else rides the
 * foe Spark hit, shocking it every `KIT_B.latch.every` s and arcing to its neighbors.
 */
const latchOn = (g: Game, a: Attack, e: Enemy) => {
  const p = g.player
  const left = atStage(KIT_B.latch.left, p.stage)
  if (left <= 0 || e.dying >= 0) return
  for (const t of g.attacks) if (ownAttack(g, t) && t.visual === 'kitBLatch' && t.age < t.ttl) t.ttl = t.age
  spawnAttack(g, {
    ...look('spark', 'electric', 'kitBLatch'), x: e.x, y: e.y - e.radius,
    shape: { kind: 'circle', r: 6 }, motion: { kind: 'tether', target: e, every: KIT_B.latch.every, next: KIT_B.latch.every },
    damage: a.damage * KIT_B.latch.share, ttl: left, activeFrom: Infinity, tier: 1, mod: null,
  })
}

/** Each of the latch's shocks arcs to a neighbor or two (Eelektross). */
const latchArcs = (g: Game, a: Attack, e: Enemy) => {
  const count = atStage(KIT_B.latch.arcs, g.player.stage)
  if (count <= 0) return
  const targets = chainTargets(g.enemies.filter((o) => o !== e), { x: e.x, y: e.y }, count, KIT_B.latch.reach, KIT_B.latch.reach)
  let from = { x: e.x, y: e.y - e.radius }
  targets.forEach((o, hop) => {
    const to = { x: o.x, y: o.y - o.radius }
    const arc = spawnAttack(g, {
      ...look('spark', 'electric', 'shock'), ...to, from,
      shape: { kind: 'circle', r: 4 }, motion: { kind: 'static' },
      damage: chainDamage(a.damage, hop + 1), ttl: 0.22, activeFrom: Infinity, mod: null,
    })
    damageEnemy(g, o, arc)
    from = to
  })
}

export const GA_KIT_B_MOVES = {
  /* Onix's line: the tail whips round from behind, a wide swing of rock and steel. */
  ironTail: {
    name: 'Iron Tail',
    type: 'steel',
    base: stats({ damage: 11, cooldown: 1.9, knockback: 70 }),
    tags: ['slice'],
    upgrades: GA_KIT_B_UPGRADES.ironTail,
    fire: (g, s) => {
      const angle = aimAngle(g, 90)
      sweep(g, s, look('ironTail', 'steel', 'kitBTail'), { from: angle + 2.3, arc: -4.6, time: 0.26, length: 42 * s.area, segments: 4, r: 9 })
      cast(g, 'ironTail')
    },
  },

  /* Happiny's line: an egg lobbed onto the nearest foes that bursts where it lands. */
  eggBomb: {
    name: 'Egg Bomb',
    type: 'normal',
    base: stats({ damage: 12, cooldown: 2, knockback: 50 }),
    upgrades: GA_KIT_B_UPGRADES.eggBomb,
    fire: (g, s) => {
      const p = g.player
      const taken = new Set<number>()
      for (let i = 0; i < s.amount; i++) {
        const e = nearestEnemy(g, p.x, p.y, 210, taken)
        if (e) taken.add(e.id)
        const at = e ?? { x: p.x + p.facing.x * 70, y: p.y + p.facing.y * 70, radius: 0 }
        const hit = strike(g, s, look('eggBomb', 'normal', 'kitBEgg'), at.x, at.y - at.radius / 2, 20 * s.area, 0.5 + i * 0.08, 0.32)
        hit.from = { x: p.x, y: p.y - 12 }
      }
      cast(g, 'eggBomb')
    },
  },

  /* Clauncher's line: an orb of aura that curves onto its target. Mega Launcher: every few, the claw's full blast. */
  auraSphere: {
    name: 'Aura Sphere',
    type: 'fighting',
    base: stats({ damage: 9, cooldown: 1.4, speed: 175, pierce: 1, knockback: 30 }),
    upgrades: GA_KIT_B_UPGRADES.auraSphere,
    fire: (g, s) => {
      const p = g.player
      const kit = p.kitB?.kind === 'launcher' ? p.kitB : null
      const shot = kit ? launcherShot(kit.shots, p.stage) : { shots: 0, blast: false }
      if (kit) kit.shots = shot.shots
      if (shot.blast) {
        const B = KIT_B.launcher
        const v = fromAngle(aimAngle(g, 280), s.speed * 1.25)
        spawnAttack(g, {
          ...look('auraSphere', 'fighting', 'kitBSphere'), x: p.x, y: p.y - 10,
          shape: { kind: 'circle', r: 7 * B.area * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage * B.power, knockback: B.knockback, pierce: s.pierce + B.pierce, ttl: 1.6, tier: 1,
        })
        g.events.push({ kind: 'quake' })
      } else homingShots(g, s, look('auraSphere', 'fighting', 'kitBSphere'), 6, 5)
      cast(g, 'auraSphere')
    },
  },

  /* Fletchling's line: a darting strike into the nearest foe, harder while Gale Wings holds. */
  acrobatics: {
    name: 'Acrobatics',
    type: 'flying',
    base: stats({ damage: 10, cooldown: 1.7, speed: 280, knockback: 50 }),
    minCooldown: LUNGE_MIN_COOLDOWN,
    upgrades: GA_KIT_B_UPGRADES.acrobatics,
    fire: (g, s) => {
      const kit = g.player.kitB
      const gale = kit?.kind === 'gale' && kit.on
      lungeAt(g, s, look('acrobatics', 'flying', 'kitBWing'), 140, s.damage * (gale ? KIT_B.gale.acrobatics : 1)).tier = gale ? 1 : 0
      cast(g, 'acrobatics')
    },
  },

  /* Golett's line: a fist of shadow that homes in and never misses. */
  shadowPunch: {
    name: 'Shadow Punch',
    type: 'ghost',
    base: stats({ damage: 10, cooldown: 1.35, speed: 200, pierce: 1, knockback: 40 }),
    tags: ['punch'],
    upgrades: GA_KIT_B_UPGRADES.shadowPunch,
    fire: (g, s) => {
      homingShots(g, s, look('shadowPunch', 'ghost', 'kitBFist'), 7, 7)
      cast(g, 'shadowPunch')
    },
  },

  /* Nacli's line: chunks of salt that crust the foes they hit, so every hit after bites deeper. Its kills build the salt layers. */
  saltCure: {
    name: 'Salt Cure',
    type: 'rock',
    base: stats({ damage: 6, cooldown: 1.5, amount: 2, speed: 165, pierce: 1, knockback: 20 }),
    status: SALT_MARK,
    upgrades: GA_KIT_B_UPGRADES.saltCure,
    fire: (g, s) => {
      fanShots(g, s, look('saltCure', 'rock', 'kitBSalt'), aimAngle(g, 240), 0.32, 5, 1.2)
      cast(g, 'saltCure')
    },
  },

  /* Inkay's line: two crescents of psychic power, sharper on foes afflicted (Topsy-Turvy's confused ones too). */
  psychoCut: {
    name: 'Psycho Cut',
    type: 'psychic',
    base: stats({ damage: 8, cooldown: 1.3, amount: 2, speed: 220, pierce: 2, knockback: 24 }),
    tags: ['slice'],
    upgrades: GA_KIT_B_UPGRADES.psychoCut,
    fire: (g, s) => {
      const from = g.attacks.length
      fanShots(g, s, look('psychoCut', 'psychic', 'kitBCut'), aimAngle(g, 240), 0.28, 6, 1)
      for (let i = from; i < g.attacks.length; i++) g.attacks[i]!.bonus = AFFLICTED_CUT
      cast(g, 'psychoCut')
    },
  },

  /* Skorupi's line: a venomous bite in front. */
  poisonFang: {
    name: 'Poison Fang',
    type: 'poison',
    base: stats({ damage: 9, cooldown: 1.2, knockback: 26 }),
    status: { kind: 'poison', chance: 0.6, duration: 3, power: 0.3 },
    tags: ['bite'],
    upgrades: GA_KIT_B_UPGRADES.poisonFang,
    fire: (g, s) => {
      strikeAt(g, s, look('poisonFang', 'poison', 'jaws'), aimAngle(g, 80), 20, 12, 0.22)
      cast(g, 'poisonFang')
    },
  },

  /* Snover's line: a frozen punch that may freeze what it lands on. */
  icePunch: {
    name: 'Ice Punch',
    type: 'ice',
    base: stats({ damage: 12, cooldown: 1.6, knockback: 55 }),
    status: { kind: 'freeze', chance: 0.15, duration: 1.4, power: 0 },
    tags: ['punch'],
    upgrades: GA_KIT_B_UPGRADES.icePunch,
    fire: (g, s) => {
      strikeAt(g, s, look('icePunch', 'ice', 'kitBFist'), aimAngle(g, 80), 22, 13, 0.22)
      cast(g, 'icePunch')
    },
  },

  /* Tynamo's line: a crackling dash into the nearest foe; from Eelektrik on it latches on and keeps shocking. */
  spark: {
    name: 'Spark',
    type: 'electric',
    base: stats({ damage: 9, cooldown: 1.6, speed: 250, knockback: 34 }),
    status: { kind: 'paralysis', chance: 0.2, duration: 0.8, power: 0 },
    minCooldown: LUNGE_MIN_COOLDOWN,
    upgrades: GA_KIT_B_UPGRADES.spark,
    onHit: (g, a, e) => {
      if (a.visual === 'kitBLatch') latchArcs(g, a, e)
      else if (a.visual === 'kitBSpark') latchOn(g, a, e)
    },
    fire: (g, s) => {
      lungeAt(g, s, look('spark', 'electric', 'kitBSpark'), 130)
      cast(g, 'spark')
    },
  },

  /* Dewpider's line: a lunge that saps the foe's strength (its contact hits weaken). */
  lunge: {
    name: 'Lunge',
    type: 'bug',
    base: stats({ damage: 11, cooldown: 1.6, speed: 260, knockback: 60 }),
    status: { kind: 'weaken', chance: 1, duration: 3, power: 0.25 },
    minCooldown: LUNGE_MIN_COOLDOWN,
    upgrades: GA_KIT_B_UPGRADES.lunge,
    fire: (g, s) => {
      lungeAt(g, s, look('lunge', 'bug', 'kitBWing'), 130)
      cast(g, 'lunge')
    },
  },

  /* Duraludon's line: charges, then fires a long piercing beam; in the rain it fires at once, harder. */
  electroShot: {
    name: 'Electro Shot',
    type: 'electric',
    base: stats({ damage: 16, cooldown: 2.6, knockback: 40 }),
    upgrades: GA_KIT_B_UPGRADES.electroShot,
    fire: (g, s) => {
      const p = g.player
      const rain = weatherHere(g) === 'rain'
      const charge = rain ? 0 : ELECTRO_SHOT.charge
      const angle = aimAngle(g, 220)
      if (charge > 0) {
        spawnAttack(g, {
          ...look('electroShot', 'electric', 'kitBCharge'), x: p.x, y: p.y - 10,
          shape: { kind: 'circle', r: 1 }, motion: { kind: 'follow', ox: 0, oy: -10 },
          damage: 0, ttl: charge, activeFrom: Infinity, mod: null,
        })
      }
      const first = g.attacks.length
      const fired = { ...s, damage: s.damage * (rain ? ELECTRO_SHOT.rain : 1) }
      sweep(g, fired, look('electroShot', 'electric', 'kitBShot'), {
        from: angle, arc: 0.0001, time: ELECTRO_SHOT.time, length: ELECTRO_SHOT.length * s.area, segments: ELECTRO_SHOT.segments, r: ELECTRO_SHOT.r, inner: 10,
      })
      // The beam waits out the charge, aimed where the cast looked.
      for (let k = first; k < g.attacks.length; k++) g.attacks[k]!.age = -charge
      cast(g, 'electroShot')
    },
  },

  /* Bounsweet's line: a sweeping kick that leaves its targets weaker. */
  tropKick: {
    name: 'Trop Kick',
    type: 'grass',
    base: stats({ damage: 9, cooldown: 1.25, knockback: 34 }),
    status: { kind: 'weaken', chance: 0.5, duration: 2.5, power: 0.25 },
    upgrades: GA_KIT_B_UPGRADES.tropKick,
    fire: (g, s) => {
      const angle = aimAngle(g, 80)
      sweep(g, s, look('tropKick', 'grass', 'kitBKick'), { from: angle - 1, arc: 2, time: 0.16, length: 34 * s.area, segments: 4, r: 8 })
      cast(g, 'tropKick')
    },
  },

  /* Sandile's line: a snap of the jaws in front, harder with every Moxie stack the KOs built. */
  powerTrip: {
    name: 'Power Trip',
    type: 'dark',
    base: stats({ damage: 10, cooldown: 1.3, knockback: 34 }),
    tags: ['bite'],
    upgrades: GA_KIT_B_UPGRADES.powerTrip,
    fire: (g, s) => {
      const kit = g.player.kitB
      const stacks = kit?.kind === 'burrow' ? kit.stacks : 0
      const bite = strikeAt(g, s, look('powerTrip', 'dark', 'kitBJaws'), aimAngle(g, 80), 20, 13, 0.22, s.damage * (1 + stacks * POWER_TRIP))
      bite.tier = stacks
      cast(g, 'powerTrip')
    },
  },

  /* Stufful's line: a heavy two-fisted smash just ahead, after a short wind-up, that shakes the ground. */
  hammerArm: {
    name: 'Hammer Arm',
    type: 'fighting',
    base: stats({ damage: 20, cooldown: 2.2, knockback: 90 }),
    tags: ['punch'],
    upgrades: GA_KIT_B_UPGRADES.hammerArm,
    fire: (g, s) => {
      const p = g.player
      const d = fromAngle(aimAngle(g, 90), 26)
      strike(g, s, look('hammerArm', 'fighting', 'kitBHammer'), p.x + d.x, p.y - 4 + d.y, 22 * s.area, HAMMER_WINDUP, 0.3)
      cast(g, 'hammerArm')
    },
  },
} as const satisfies Record<string, MoveDef>

/** Power Trip: what each Moxie stack adds to its bite. */
export const POWER_TRIP = 0.08

/** Hammer Arm's wind-up before the fists land, seconds. */
const HAMMER_WINDUP = 0.18

/** Psycho Cut bites deeper into afflicted foes. */
const AFFLICTED_CUT = [{ when: 'afflicted', mult: 1.25 }] as const

export const GA_KIT_B_MOVE_IDS = Object.keys(GA_KIT_B_MOVES) as ReadonlyArray<keyof typeof GA_KIT_B_MOVES>

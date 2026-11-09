import { dirTo, fromAngle, TAU } from '../engine/math'
import * as dm from '../engine/dmath'
import type { PokeType } from '../data/types'
import { LUNGE_IFRAMES, LUNGE_MIN_COOLDOWN } from './moveRules'
import { sweep } from './moveKit'
import type { CastStats, Look, MoveDef, MoveId, MoveStats } from './moves'
import { nearestEnemy } from './queries'
import { spawnAttack } from './spawn'
import { addMice, slimeFed } from './seasonOneKitSystem'
import { weatherHere } from './weather'
import type { Game, Visual } from './types'
import type { StatusSpec } from './status'
import type { WeatherId } from '../data/biomes'
import type { Stance } from './stance'

/**
 * Temporada 1's new signature moves for the families with a mechanic of their
 * own (`data/seasonOneKits.ts`): each reads its family's state (`Player.kit`,
 * `special.stance` or the weather) in `fire`, so its card stays one move while
 * its type and shape follow the Pokémon. Their numbers live here and their
 * look in `render/seasonOneKitFx.ts`. Seeded rng and `dmath` only, and no
 * `moves.ts` at runtime (it is evaluated first): only its types.
 */

const stats = (s: Partial<MoveStats>): MoveStats => ({
  damage: 0, cooldown: 1, area: 1, amount: 1, speed: 0, duration: 1, pierce: Infinity, knockback: 0, statusChance: 0, statusDamage: 0, ...s,
})

const look = (move: MoveId, type: PokeType, visual: Visual): Look => ({ move, type, visual })

const cast = (g: Game, move: MoveId) => g.events.push({ kind: 'cast', move })

/** Toward the nearest foe within `reach`, else where the player faces. */
const aimAngle = (g: Game, reach: number) => {
  const p = g.player
  const target = nearestEnemy(g, p.x, p.y, reach)
  const d = target ? dirTo(p.x, p.y, target.x, target.y) : p.facing
  return dm.atan2(d.y, d.x)
}

/** A short strike glued to the player, `dist` px toward `angle`. */
const strikeAt = (g: Game, s: CastStats, l: Look, angle: number, dist: number, r: number, ttl: number) => {
  const d = fromAngle(angle, dist)
  return spawnAttack(g, {
    ...l, x: g.player.x + d.x, y: g.player.y - 8 + d.y,
    shape: { kind: 'circle', r: r * s.area }, motion: { kind: 'follow', ox: d.x, oy: d.y - 8 },
    damage: s.damage, knockback: s.knockback, status: s.status, ttl, activeUntil: Math.min(ttl, 0.1), flip: dm.cos(angle) < 0,
  })
}

/** Straight shots in an even fan around `center`. */
const fanShots = (g: Game, s: CastStats, l: Look, center: number, step: number, r: number, ttl: number, damage = s.damage) => {
  const p = g.player
  for (let i = 0; i < s.amount; i++) {
    const v = fromAngle(center + (i - (s.amount - 1) / 2) * step, s.speed)
    spawnAttack(g, {
      ...l, x: p.x, y: p.y - 8,
      shape: { kind: 'circle', r: r * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
      damage, knockback: s.knockback, pierce: s.pierce, status: s.status, ttl, age: -i * 0.05,
    })
  }
}

/** Two crossed sweeps: Cross Chop and X-Scissor. */
const crossSweeps = (g: Game, s: CastStats, l: Look, reach: number) => {
  const angle = aimAngle(g, reach + 30)
  const opts = { time: 0.16, length: reach * s.area, segments: 4, r: 8 }
  sweep(g, s, l, { from: angle - 0.75, arc: 1.5, ...opts })
  sweep(g, s, l, { from: angle + 0.75, arc: -1.5, ...opts })
}

/** Night Slash bites deeper into bosses. */
const BOSS_CUT = [{ when: 'boss', mult: 1.3 }] as const

/** Night Slash and Shadow Claw: one wide claw in front. */
const clawSweep = (g: Game, s: CastStats, l: Look, reach: number, bonusBoss: boolean) => {
  const from = g.attacks.length
  const angle = aimAngle(g, reach + 30)
  sweep(g, s, l, { from: angle - 1.2, arc: 2.4, time: 0.18, length: reach * s.area, segments: 5, r: 8 })
  if (bonusBoss) for (let i = from; i < g.attacks.length; i++) g.attacks[i]!.bonus = BOSS_CUT
}

/* ---------------- What each form makes of its signature ---------------- */

const appliancePlays: Record<Stance & ('heat' | 'wash' | 'frost' | 'fan' | 'mow'), { type: PokeType; visual: Visual; status: StatusSpec | null }> = {
  heat: { type: 'fire', visual: 'flame', status: { kind: 'burn', chance: 0.35, duration: 2.5, power: 0.3 } },
  wash: { type: 'water', visual: 'water', status: { kind: 'slow', chance: 0.5, duration: 1, power: 0.4 } },
  frost: { type: 'ice', visual: 'iceShard', status: { kind: 'slow', chance: 0.8, duration: 1.4, power: 0.55 } },
  fan: { type: 'flying', visual: 'gust', status: null },
  mow: { type: 'grass', visual: 'leaf', status: { kind: 'poison', chance: 0.3, duration: 3, power: 0.25 } },
}

const isAppliance = (s: Stance | null): s is keyof typeof appliancePlays => s !== null && s in appliancePlays

const FORECAST: Record<WeatherId, { type: PokeType; visual: Visual; status: StatusSpec | null; mult: number }> = {
  clear: { type: 'normal', visual: 'star', status: null, mult: 1 },
  sun: { type: 'fire', visual: 'ember', status: { kind: 'burn', chance: 0.4, duration: 2.5, power: 0.3 }, mult: 1.15 },
  rain: { type: 'water', visual: 'water', status: { kind: 'slow', chance: 0.5, duration: 1, power: 0.45 }, mult: 1.15 },
  snow: { type: 'ice', visual: 'iceShard', status: { kind: 'slow', chance: 0.7, duration: 1.3, power: 0.55 }, mult: 1.15 },
  sand: { type: 'rock', visual: 'rockTomb', status: null, mult: 1.15 },
  fog: { type: 'ghost', visual: 'psy', status: { kind: 'mark', chance: 0.3, duration: 3, power: 0.15 }, mult: 1.05 },
}

export const SEASON_ONE_KIT_MOVES = {
  /* Mankey's line: two crossing chops close up. */
  crossChop: {
    name: 'Cross Chop',
    type: 'fighting',
    base: stats({ damage: 8, cooldown: 1.3, knockback: 40 }),
    tags: ['punch'],
    upgrades: [
      { damage: 2 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.15 }, mods: ['cruel'] }] },
      { damage: 2 },
      { cooldown: -0.12 },
      { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['echo'] }] },
      { damage: 3 },
    ],
    fire: (g, s) => {
      crossSweeps(g, s, look('crossChop', 'fighting', 'kitCross'), 34)
      cast(g, 'crossChop')
    },
  },

  /* Pawniard's line: a wide cut that bites deeper into bosses. */
  nightSlash: {
    name: 'Night Slash',
    type: 'dark',
    base: stats({ damage: 10, cooldown: 1.5, knockback: 30 }),
    tags: ['slice'],
    upgrades: [
      { damage: 2 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 2 }, mods: ['execute'] }, { stats: { cooldown: -0.15 }, mods: ['arc'] }] },
      { damage: 2 },
      { cooldown: -0.12 },
      { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['burstOnKill'] }] },
      { damage: 3 },
    ],
    fire: (g, s) => {
      clawSweep(g, s, look('nightSlash', 'dark', 'kitClaw'), 42, true)
      cast(g, 'nightSlash')
    },
  },

  /* Goomy's line: a ring of dragon energy; its slime (`dropSlime`) answers to this move too. */
  dragonPulse: {
    name: 'Dragon Pulse',
    type: 'dragon',
    base: stats({ damage: 8, cooldown: 1.8, knockback: 34 }),
    upgrades: [
      { damage: 2 },
      { area: 0.15 },
      { fork: [{ stats: { damage: 2 }, mods: ['trail'] }, { stats: { cooldown: -0.2 }, mods: ['drain'] }] },
      { damage: 2 },
      { area: 0.15 },
      { fork: [{ stats: { damage: 3 }, mods: ['cruel'] }, { stats: { cooldown: -0.2 }, mods: ['burstOnKill'] }] },
      { damage: 3 },
    ],
    onHit: (g, a) => {
      if (a.visual === 'slime') slimeFed(g)
    },
    fire: (g, s) => {
      const p = g.player
      const reach = 58 * s.area
      spawnAttack(g, {
        ...look('dragonPulse', 'dragon', 'dragonPulse'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: 6 }, motion: { kind: 'static' }, grow: reach / 0.32,
        damage: s.damage, knockback: s.knockback, ttl: 0.4, activeUntil: 0.3,
      })
      cast(g, 'dragonPulse')
    },
  },

  /* Wishiwashi: one small bubble ring alone; the School throws a ring of them. */
  waterPulse: {
    name: 'Water Pulse',
    type: 'water',
    base: stats({ damage: 7, cooldown: 1.2, speed: 190, pierce: 1, knockback: 20 }),
    status: { kind: 'slow', chance: 0.25, duration: 1, power: 0.4 },
    upgrades: [
      { damage: 2 },
      { amount: 1 },
      { fork: [{ stats: { damage: 2 }, mods: ['split'] }, { stats: { cooldown: -0.12 }, mods: ['seek'] }] },
      { damage: 2 },
      { pierce: 1 },
      { fork: [{ stats: { damage: 3 }, mods: ['burstOnKill'] }, { stats: { amount: 1 }, mods: ['bounce'] }] },
      { damage: 3 },
    ],
    fire: (g, s) => {
      const p = g.player
      const l = look('waterPulse', 'water', 'waterPulse')
      if (p.kit?.kind === 'school' && p.kit.left > 0) {
        const count = 8 + s.amount
        for (let i = 0; i < count; i++) {
          const v = fromAngle((i / count) * TAU, s.speed)
          spawnAttack(g, {
            ...l, x: p.x, y: p.y - 8, shape: { kind: 'circle', r: 7 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
            damage: s.damage, knockback: s.knockback, pierce: s.pierce + 1, status: s.status, ttl: 1.1, age: 0, flip: i % 2 === 0,
          })
        }
      } else fanShots(g, s, l, aimAngle(g, 260), 0.3, 5, 1.2)
      cast(g, 'waterPulse')
    },
  },

  /* Tandemaus' line: sends out the mice that hunt and draw foes (`seasonOneKitSystem`). */
  populationBomb: {
    name: 'Population Bomb',
    type: 'normal',
    base: stats({ damage: 6, cooldown: 2.6, duration: 4 }),
    upgrades: [
      { damage: 1 },
      { amount: 1 },
      { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { duration: 0.5 }, mods: ['cruel'] }] },
      { damage: 1 },
      { amount: 1 },
      { fork: [{ stats: { damage: 2 }, mods: ['hunter'] }, { stats: { cooldown: -0.3 }, mods: ['arc'] }] },
      { damage: 2 },
    ],
    fire: (g, s) => {
      addMice(g, s.amount, s.damage, s.duration, s.mods)
      cast(g, 'populationBomb')
    },
  },

  /* Finizen's line: a fist of water that carries it to the nearest foe. */
  jetPunch: {
    name: 'Jet Punch',
    type: 'water',
    base: stats({ damage: 11, cooldown: 1.9, speed: 260, knockback: 60 }),
    minCooldown: LUNGE_MIN_COOLDOWN,
    tags: ['punch'],
    upgrades: [
      { damage: 2 },
      { cooldown: -0.1 },
      { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.1 }, mods: ['arc'] }] },
      { damage: 2 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 4 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['echo'] }] },
      { damage: 3 },
    ],
    fire: (g, s) => {
      const p = g.player
      const d = fromAngle(aimAngle(g, 130), s.speed)
      p.iframes = Math.max(p.iframes, LUNGE_IFRAMES)
      spawnAttack(g, {
        ...look('jetPunch', 'water', 'fist'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: 12 * s.area }, motion: { kind: 'lunge', vx: d.x, vy: d.y, left: 0.18 },
        damage: s.damage, knockback: s.knockback, ttl: 0.24,
      })
      cast(g, 'jetPunch')
    },
  },

  /* Morpeko: a wheel that follows its mood. Full Belly throws fast shocks; Hangry a slower, harder dark wheel. */
  auraWheel: {
    name: 'Aura Wheel',
    type: 'electric',
    base: stats({ damage: 9, cooldown: 1.4, speed: 200, pierce: 3, knockback: 24 }),
    status: { kind: 'paralysis', chance: 0.25, duration: 1, power: 0 },
    upgrades: [
      { damage: 2 },
      { pierce: 1 },
      { fork: [{ stats: { damage: 2 }, mods: ['arc'] }, { stats: { cooldown: -0.15 }, mods: ['seek'] }] },
      { damage: 2 },
      { amount: 1 },
      { fork: [{ stats: { damage: 3 }, mods: ['cruel'] }, { stats: { area: 0.2 }, mods: ['burstOnKill'] }] },
      { damage: 3 },
    ],
    fire: (g, s) => {
      const hangry = g.player.kit?.kind === 'hunger' && g.player.kit.hangry
      const angle = aimAngle(g, 240)
      const wheel = { ...s, status: hangry ? null : s.status, speed: hangry ? s.speed * 0.7 : s.speed }
      fanShots(g, wheel, look('auraWheel', hangry ? 'dark' : 'electric', 'auraWheel'), angle, 0.32, hangry ? 8 : 6, 1.3, s.damage * (hangry ? 1.35 : 1))
      cast(g, 'auraWheel')
    },
  },

  /* Rotom: the appliance it wears (`special.stance`) picks the discharge's type and shape. */
  discharge: {
    name: 'Discharge',
    type: 'electric',
    base: stats({ damage: 8, cooldown: 1.7, speed: 180, amount: 2, knockback: 28 }),
    upgrades: [
      { damage: 2 },
      { area: 0.15 },
      { fork: [{ stats: { damage: 2 }, mods: ['arc'] }, { stats: { cooldown: -0.15 }, mods: ['burstOnKill'] }] },
      { damage: 2 },
      { amount: 1 },
      { fork: [{ stats: { damage: 3 }, mods: ['cruel'] }, { stats: { area: 0.2 }, mods: ['echo'] }] },
      { damage: 3 },
    ],
    fire: (g, s) => {
      const stance = g.player.special.stance
      const form = isAppliance(stance) ? appliancePlays[stance] : null
      const l = look('discharge', form?.type ?? 'electric', form?.visual ?? 'thunder')
      const fired = { ...s, status: form?.status ?? s.status }
      const p = g.player
      switch (stance) {
        case 'heat': {
          // A tight cone of flames straight ahead.
          fanShots(g, { ...fired, speed: s.speed * 0.8, pierce: 2 }, l, aimAngle(g, 150), 0.22, 7, 0.6)
          break
        }
        case 'wash': {
          // Water thrown all around.
          const count = 5 + s.amount
          for (let i = 0; i < count; i++) {
            const v = fromAngle((i / count) * TAU + g.now, s.speed * 0.85)
            spawnAttack(g, { ...l, x: p.x, y: p.y - 8, shape: { kind: 'circle', r: 5 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y }, damage: s.damage * 0.75, knockback: 18, pierce: 1, status: fired.status, ttl: 0.9 })
          }
          break
        }
        case 'frost':
          // A slow fan of shards that chill.
          fanShots(g, { ...fired, speed: s.speed * 0.65, pierce: 1 }, l, aimAngle(g, 200), 0.34, 6, 1.1)
          break
        case 'fan': {
          // Wind that circles close, pushing foes off.
          for (let i = 0; i < s.amount + 2; i++) {
            const a = (i / (s.amount + 2)) * TAU
            spawnAttack(g, { ...l, x: p.x, y: p.y - 8, shape: { kind: 'circle', r: 9 * s.area }, motion: { kind: 'orbit', angle: a, spin: 5, radius: 36 * s.area }, damage: s.damage * 0.8, knockback: 90, hitInterval: 0.4, ttl: 1.3 })
          }
          break
        }
        case 'mow':
          // Blades that fly out and return.
          for (let i = 0; i < s.amount; i++) {
            const v = fromAngle(aimAngle(g, 200) + (i - (s.amount - 1) / 2) * 0.5, s.speed)
            spawnAttack(g, {
              ...l, x: p.x, y: p.y - 8, shape: { kind: 'circle', r: 8 * s.area }, motion: { kind: 'return', vx: v.x, vy: v.y, out: 0.55, speed: s.speed },
              damage: s.damage, knockback: s.knockback, status: fired.status, ttl: 2.5,
            })
          }
          break
        default:
          fanShots(g, fired, l, aimAngle(g, 220), 0.4, 6, 1.1)
      }
      cast(g, 'discharge')
    },
  },

  /* Castform: the weather picks its ball's type, condition and size (`weatherHere`). */
  forecast: {
    name: 'Forecast',
    type: 'normal',
    base: stats({ damage: 10, cooldown: 1.5, speed: 170, pierce: 2, knockback: 26 }),
    upgrades: [
      { damage: 2 },
      { area: 0.15 },
      { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.15 }, mods: ['seek'] }] },
      { damage: 2 },
      { amount: 1 },
      { fork: [{ stats: { damage: 3 }, mods: ['cruel'] }, { stats: { area: 0.2 }, mods: ['split'] }] },
      { damage: 3 },
    ],
    fire: (g, s) => {
      const form = FORECAST[weatherHere(g)]
      fanShots(g, { ...s, status: form.status }, look('forecast', form.type, form.visual), aimAngle(g, 240), 0.3, 7, 1.3, s.damage * form.mult)
      cast(g, 'forecast')
    },
  },

  /* Darumaka's line: a burning punch close up. */
  firePunch: {
    name: 'Fire Punch',
    type: 'fire',
    base: stats({ damage: 13, cooldown: 1.7, knockback: 55 }),
    status: { kind: 'burn', chance: 0.3, duration: 2.5, power: 0.3 },
    tags: ['punch'],
    upgrades: [
      { damage: 2 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.15 }, mods: ['cruel'] }] },
      { damage: 3 },
      { cooldown: -0.12 },
      { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['echo'] }] },
      { damage: 3 },
    ],
    fire: (g, s) => {
      strikeAt(g, s, look('firePunch', 'fire', 'fist'), aimAngle(g, 80), 22, 13, 0.22)
      cast(g, 'firePunch')
    },
  },

  /* Wimpod's line: quick crossed claws. */
  xScissor: {
    name: 'X-Scissor',
    type: 'bug',
    base: stats({ damage: 7, cooldown: 1.15, knockback: 26 }),
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
      crossSweeps(g, s, look('xScissor', 'bug', 'kitCross'), 32)
      cast(g, 'xScissor')
    },
  },

  /* Mimikyu: a claw of its own shadow. */
  shadowClaw: {
    name: 'Shadow Claw',
    type: 'ghost',
    base: stats({ damage: 9, cooldown: 1.35, knockback: 30 }),
    tags: ['slice'],
    upgrades: [
      { damage: 2 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 2 }, mods: ['cruel'] }, { stats: { cooldown: -0.15 }, mods: ['drain'] }] },
      { damage: 2 },
      { cooldown: -0.12 },
      { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['burstOnKill'] }] },
      { damage: 3 },
    ],
    fire: (g, s) => {
      clawSweep(g, s, look('shadowClaw', 'ghost', 'kitClaw'), 40, false)
      cast(g, 'shadowClaw')
    },
  },

  /* Tatsugiri: a wave of orders, far harder from inside Dondozo. */
  orderUp: {
    name: 'Order Up',
    type: 'dragon',
    base: stats({ damage: 10, cooldown: 1.7, speed: 150, knockback: 40 }),
    upgrades: [
      { damage: 2 },
      { area: 0.15 },
      { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.15 }, mods: ['echo'] }] },
      { damage: 2 },
      { area: 0.15 },
      { fork: [{ stats: { damage: 3 }, mods: ['hunter'] }, { stats: { cooldown: -0.15 }, mods: ['cruel'] }] },
      { damage: 3 },
    ],
    fire: (g, s) => {
      const p = g.player
      const aboard = p.kit?.kind === 'commander' && p.kit.left > 0
      const v = fromAngle(aimAngle(g, 240), s.speed)
      spawnAttack(g, {
        ...look('orderUp', 'dragon', 'orderUp'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: (aboard ? 22 : 14) * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
        damage: s.damage * (aboard ? 1.5 : 1), knockback: s.knockback, ttl: 1.2,
      })
      cast(g, 'orderUp')
    },
  },
} as const satisfies Record<string, MoveDef>

export const SEASON_ONE_KIT_MOVE_IDS = Object.keys(SEASON_ONE_KIT_MOVES) as ReadonlyArray<keyof typeof SEASON_ONE_KIT_MOVES>

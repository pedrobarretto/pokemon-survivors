import { dirTo, fromAngle, TAU } from '../engine/math'
import { chance, pick, range } from '../engine/rng'
import type { PokeType } from '../data/types'
import { spawnAttack } from './spawn'
import { damageEnemy } from './combat'
import { enemiesInView, nearestEnemy } from './queries'
import {
  CHAIN_JUMP, CHAIN_RANGE, chainDamage, chainTargets, HEX_BONUS, LUNGE_IFRAMES, LUNGE_MIN_COOLDOWN, LUNGE_OVERSHOOT,
  LUNGE_SEEK, LUNGE_TIME, lungeLength, lungeTarget, mineCap,
} from './moveRules'
import type { Attack, Game, Visual } from './types'
import type { PlayerStats } from './stats'
import { isAfflicted, scaleStatus, type StatusSpec } from './status'
import * as dm from '../engine/dmath'

/**
 * Moves are the weapons. Each level-up upgrade adds a delta to the move's
 * base stats; player-wide stats (might, area…) are applied on top in `moveStats`.
 */
export type MoveStats = {
  damage: number
  /** seconds between casts */
  cooldown: number
  /** size multiplier */
  area: number
  /** projectiles per cast */
  amount: number
  /** px/s (or rad/s for orbiting moves) */
  speed: number
  /** seconds, for lingering effects */
  duration: number
  pierce: number
  knockback: number
  /** added to the move's status chance */
  statusChance: number
  /** extra burn/poison damage (0.25 = +25%) */
  statusDamage: number
}

/** What `fire` receives: final stats plus the scaled status the move inflicts. */
export type CastStats = MoveStats & { status: StatusSpec | null }

/** Stat delta added by one level-up (texts live in `i18n`). */
type Upgrade = Partial<MoveStats>

export type MoveDef = {
  /** Official English name; descriptions live in `i18n`. */
  name: string
  type: PokeType
  base: MoveStats
  upgrades: readonly Upgrade[]
  /** Condition its hits may inflict (chance and power scale with upgrades and items). */
  status?: StatusSpec
  /** Floor for the cooldown after every reduction (lunges, see `LUNGE_MIN_COOLDOWN`). */
  minCooldown?: number
  /** Fires on the player's press (Shift, the lunge button) instead of on its own, once recharged (`updateMoves`). */
  manual?: true
  fire: (g: Game, s: CastStats) => void
}

/** What a cast helper needs to name and paint its hitboxes. */
type Look = { move: MoveId; type: PokeType; visual: Visual }

const stats = (s: Partial<MoveStats>): MoveStats => ({
  damage: 0, cooldown: 1, area: 1, amount: 1, speed: 0, duration: 1, pierce: Infinity, knockback: 0, statusChance: 0, statusDamage: 0, ...s,
})

/** Angles spread evenly around `center`, `step` radians apart. */
const fan = (center: number, count: number, step: number) =>
  Array.from({ length: count }, (_, i) => center + (i - (count - 1) / 2) * step)

const aimAngle = (g: Game, range: number) => {
  const p = g.player
  const target = nearestEnemy(g, p.x, p.y, range)
  const d = target ? dirTo(p.x, p.y, target.x, target.y) : p.facing
  return dm.atan2(d.y, d.x)
}

/** `count` angles evenly around the full circle, slowly rotating with game time. */
const radial = (g: Game, count: number, spin = 1.7) =>
  Array.from({ length: count }, (_, i) => g.time * spin + (i / count) * TAU)

/** Offset `dist` px towards `angle`, at body height, for strikes glued to the player. */
const reachOffset = (angle: number, dist: number) => {
  const d = fromAngle(angle, dist)
  return { ox: d.x, oy: d.y - 8 }
}

/**
 * Lunge (a manual move): carries the player a short hop through the nearest foe
 * ahead of the stick (any foe when standing still), hitting everything along
 * the way, with a short i-frame window. With no foe in reach it hops its full
 * length the way the player faces. `burst` (> 0) adds a shockwave where it lands.
 */
const lunge = (g: Game, s: CastStats, look: Look, burst = 0) => {
  const p = g.player
  const length = lungeLength(s.speed)
  const target = lungeTarget(g.enemies, p, p.facing, p.moving, length + LUNGE_SEEK)
  const d = target ? dirTo(p.x, p.y, target.x, target.y, p.facing) : p.facing
  const dist = target ? Math.min(length, dm.hypot(target.x - p.x, target.y - p.y) + LUNGE_OVERSHOOT) : length
  const v = dist / LUNGE_TIME
  p.iframes = Math.max(p.iframes, LUNGE_IFRAMES)
  spawnAttack(g, {
    ...look, x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: 11 * s.area },
    motion: { kind: 'lunge', vx: d.x * v, vy: d.y * v, left: LUNGE_TIME },
    damage: s.damage, knockback: s.knockback, ttl: LUNGE_TIME + 0.12, activeUntil: LUNGE_TIME,
  })
  if (burst > 0) {
    spawnAttack(g, {
      ...look, x: p.x + d.x * dist, y: p.y + d.y * dist - 4,
      shape: { kind: 'circle', r: 6 }, motion: { kind: 'static' },
      damage: s.damage * 0.6, knockback: s.knockback, ttl: 0.3, grow: burst / 0.3, age: -LUNGE_TIME,
    })
  }
}

/**
 * Chain: strikes the nearest foe, then jumps to the next nearest ones (`amount`
 * hits in all), ×0.85 damage per jump and ×`hexBonus` on foes with a status
 * condition. The hits land at once, without knockback; each jump leaves a
 * visual-only arc from the previous foe, a few ms apart.
 */
const chain = (g: Game, s: CastStats, look: Look, hexBonus = 1) => {
  const p = g.player
  const targets = chainTargets(g.enemies, p, s.amount, CHAIN_RANGE, CHAIN_JUMP * s.area)
  let from = { x: p.x, y: p.y - 10 }
  targets.forEach((e, hop) => {
    const to = { x: e.x, y: e.y - e.radius }
    const arc = spawnAttack(g, {
      ...look, ...to, from,
      shape: { kind: 'circle', r: 4 * s.area }, motion: { kind: 'static' },
      damage: chainDamage(s.damage, hop, isAfflicted(e.status), hexBonus), status: s.status,
      ttl: 0.28, activeFrom: Infinity, age: -hop * 0.035,
    })
    damageEnemy(g, e, arc)
    from = to
  })
}

/**
 * Mine: drops `amount` mines at the player's feet (scattered after the first).
 * They arm after `MINE_ARM`, blow up when a foe steps on one and blow for half
 * when they expire. Over the cap (`mineCap`), the oldest go off early.
 */
const mine = (g: Game, s: CastStats, look: Look, blastVisual: Visual) => {
  const p = g.player
  const mines: Attack[] = []
  for (const a of g.attacks) if (a.move === look.move && a.owner === p && a.blast > 0 && a.pierce > 0) mines.push(a)
  // Attacks stay in spawn order, so the first ones are the oldest: they expire now.
  const extra = mines.length + s.amount - mineCap(s.amount)
  for (let i = 0; i < extra && i < mines.length; i++) mines[i]!.ttl = mines[i]!.age
  for (let i = 0; i < s.amount; i++) {
    const off = i === 0 ? { x: 0, y: 0 } : fromAngle(range(g.rng, 0, TAU), range(g.rng, 10, 20))
    spawnAttack(g, {
      ...look, x: p.x + off.x, y: p.y + off.y * 0.7,
      shape: { kind: 'circle', r: 9 * s.area }, motion: { kind: 'static' },
      damage: s.damage, knockback: s.knockback, pierce: 1, status: s.status, ttl: s.duration,
      blast: 30 * s.area, blastVisual, flip: chance(g.rng, 0.5),
    })
  }
}

/**
 * Turret: leaves a static wisp just behind the player; for `duration` it shoots
 * `amount` shots at the nearest foe every `every` seconds. It never hits by itself.
 */
const turret = (g: Game, s: CastStats, look: Look, shot: Visual, every: number) => {
  const p = g.player
  spawnAttack(g, {
    ...look, x: p.x - p.facing.x * 10, y: p.y - p.facing.y * 10,
    shape: { kind: 'circle', r: 6 * s.area }, motion: { kind: 'static' },
    damage: s.damage, knockback: s.knockback, status: s.status, ttl: s.duration, activeFrom: Infinity,
    turret: { every, left: 0.25, amount: s.amount, speed: s.speed, shot },
  })
}

/**
 * Shards: ice shards fly out along `angles`, lose speed (`drag`) until they stick
 * in the ground, and stay for `duration`, hurting and chilling whatever touches
 * them every half second (Ice Shard, Blizzard).
 */
const shards = (g: Game, s: CastStats, look: Look, angles: readonly number[], drag: number) => {
  const p = g.player
  for (const angle of angles) {
    const v = fromAngle(angle, s.speed)
    spawnAttack(g, {
      ...look, x: p.x, y: p.y - 6,
      shape: { kind: 'circle', r: 5 * s.area }, motion: { kind: 'drift', vx: v.x, vy: v.y, drag },
      damage: s.damage, knockback: s.knockback, hitInterval: 0.5, ttl: s.duration, status: s.status,
    })
  }
}

/**
 * Breath: a cone of `puffs` growing puffs blown towards `angle`, the middle one
 * first and the edges a beat later, each a little off its line and pace so the
 * cone fills up. The middle of the cone, where puffs overlap, hits hardest
 * (Dragon Breath, Outrage).
 */
const breath = (g: Game, s: CastStats, look: Look, angle: number, puffs: number) => {
  const p = g.player
  fan(angle, puffs, 0.2).forEach((a, i) => {
    const v = fromAngle(a + range(g.rng, -0.08, 0.08), s.speed * range(g.rng, 0.55, 1.1))
    spawnAttack(g, {
      ...look, x: p.x, y: p.y - 8,
      shape: { kind: 'circle', r: 3 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
      damage: s.damage, knockback: s.knockback, ttl: 0.45, grow: 14 * s.area, status: s.status,
      age: -Math.abs(i - (puffs - 1) / 2) * 0.04,
    })
  })
}

/** Seconds a Rock Tomb boulder takes to fall: its shadow is the warning. */
const ROCK_FALL = 0.32
/** Pillars in each Stone Edge line, and the gap between them (px, scaled by area). */
const EDGE_PILLARS = 6
const EDGE_GAP = 15

export const MOVES = {
  ember: {
    name: 'Ember',
    type: 'fire',
    base: stats({ damage: 10, cooldown: 1, amount: 1, speed: 190, pierce: 1, knockback: 40 }),
    status: { kind: 'burn', chance: 0.3, duration: 2.5, power: 0.3 },
    upgrades: [
      { amount: 1 },
      { damage: 4, statusChance: 0.1 },
      { cooldown: -0.15 },
      { amount: 1 },
      { pierce: 1 },
      { damage: 6 },
      { amount: 1, area: 0.25 },
    ],
    fire: (g, s) => {
      const p = g.player
      for (const angle of fan(aimAngle(g, 280), s.amount, 0.2)) {
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          move: 'ember', type: 'fire', visual: 'ember', x: p.x, y: p.y - 6,
          shape: { kind: 'circle', r: 4 * s.area },
          motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, ttl: 1.6, status: s.status,
        })
      }
    },
  },

  fireSpin: {
    name: 'Fire Spin',
    type: 'fire',
    base: stats({ damage: 9, cooldown: 3.4, amount: 2, speed: 3.4, duration: 2.6, knockback: 30 }),
    status: { kind: 'burn', chance: 0.25, duration: 2, power: 0.3 },
    upgrades: [
      { amount: 1 },
      { area: 0.2 },
      { damage: 4 },
      { duration: 0.6 },
      { amount: 1 },
      { damage: 5, statusDamage: 0.25 },
      { amount: 1, speed: 1 },
    ],
    fire: (g, s) => {
      const p = g.player
      for (let i = 0; i < s.amount; i++) {
        spawnAttack(g, {
          move: 'fireSpin', type: 'fire', visual: 'flame', x: p.x, y: p.y,
          shape: { kind: 'circle', r: 7 * s.area },
          motion: { kind: 'orbit', angle: (i / s.amount) * TAU, spin: s.speed, radius: 36 * s.area },
          damage: s.damage, knockback: s.knockback, hitInterval: 0.45, ttl: s.duration, status: s.status,
        })
      }
    },
  },

  waterGun: {
    name: 'Water Gun',
    type: 'water',
    base: stats({ damage: 8, cooldown: 0.75, amount: 1, speed: 290, pierce: 2, knockback: 60 }),
    upgrades: [
      { amount: 1 },
      { damage: 3 },
      { pierce: 1 },
      { cooldown: -0.1 },
      { amount: 1 },
      { damage: 5 },
      { amount: 1, pierce: 2 },
    ],
    fire: (g, s) => {
      const p = g.player
      const angle = dm.atan2(p.facing.y, p.facing.x)
      for (let i = 0; i < s.amount; i++) {
        const v = fromAngle(angle + range(g.rng, -0.08, 0.08), s.speed)
        spawnAttack(g, {
          move: 'waterGun', type: 'water', visual: 'water', x: p.x, y: p.y - 6,
          shape: { kind: 'circle', r: 5 * s.area },
          motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, ttl: 0.9,
          age: -i * 0.08,
        })
      }
    },
  },

  whirlpool: {
    name: 'Whirlpool',
    type: 'water',
    base: stats({ damage: 5, cooldown: 0.6, knockback: 14 }),
    status: { kind: 'slow', chance: 1, duration: 0.6, power: 0.4 },
    upgrades: [
      { area: 0.2 },
      { damage: 2 },
      { cooldown: -0.08 },
      { area: 0.2 },
      { damage: 3 },
      { cooldown: -0.08 },
      { area: 0.25, damage: 3 },
    ],
    // Persistent aura: each "cast" refreshes the single live hitbox with current stats.
    fire: (g, s) => {
      const radius = 34 * s.area
      const aura = g.attacks.find((a) => a.move === 'whirlpool' && a.owner === g.player)
      if (aura) {
        aura.shape = { kind: 'circle', r: radius }
        aura.damage = s.damage
        aura.hitInterval = s.cooldown
        aura.knockback = s.knockback
        aura.status = s.status
        return
      }
      spawnAttack(g, {
        move: 'whirlpool', type: 'water', visual: 'whirlpool', x: g.player.x, y: g.player.y,
        shape: { kind: 'circle', r: radius },
        motion: { kind: 'follow', ox: 0, oy: 0 },
        damage: s.damage, knockback: s.knockback, hitInterval: s.cooldown, ttl: Infinity, status: s.status,
      })
    },
  },

  razorLeaf: {
    name: 'Razor Leaf',
    type: 'grass',
    base: stats({ damage: 11, cooldown: 1.5, amount: 1, speed: 210, duration: 1, knockback: 25 }),
    status: { kind: 'poison', chance: 0.15, duration: 3, power: 0.2 },
    upgrades: [
      { amount: 1 },
      { damage: 4 },
      { area: 0.2 },
      { amount: 1 },
      { speed: 52 },
      { damage: 5 },
      { amount: 1 },
    ],
    fire: (g, s) => {
      const p = g.player
      for (const angle of fan(aimAngle(g, 220), s.amount, 0.45)) {
        const d = fromAngle(angle)
        spawnAttack(g, {
          move: 'razorLeaf', type: 'grass', visual: 'leaf', x: p.x, y: p.y - 6,
          shape: { kind: 'circle', r: 6 * s.area },
          motion: { kind: 'boomerang', vx: d.x * s.speed, vy: d.y * s.speed, ax: -d.x * s.speed * 1.5, ay: -d.y * s.speed * 1.5 },
          damage: s.damage, knockback: s.knockback, hitInterval: 0.6, ttl: 2.2 * s.duration, status: s.status,
        })
      }
    },
  },

  vineWhip: {
    name: 'Vine Whip',
    type: 'grass',
    base: stats({ damage: 14, cooldown: 1.3, amount: 1, knockback: 70 }),
    status: { kind: 'poison', chance: 0.25, duration: 3, power: 0.2 },
    upgrades: [
      { amount: 1 },
      { damage: 5 },
      { area: 0.2 },
      { cooldown: -0.15 },
      { damage: 6 },
      { area: 0.2 },
      { damage: 8 },
    ],
    fire: (g, s) => {
      const p = g.player
      const side = p.facing.x < 0 ? -1 : 1
      const w = 72 * s.area
      const h = 14 * s.area
      for (let i = 0; i < s.amount; i++) {
        const dir = i % 2 === 0 ? side : -side
        spawnAttack(g, {
          move: 'vineWhip', type: 'grass', visual: 'vine', x: p.x, y: p.y,
          shape: { kind: 'rect', w, h },
          motion: { kind: 'follow', ox: dir * (w / 2 + 4), oy: -6 - Math.floor(i / 2) * 12 },
          damage: s.damage, knockback: s.knockback, ttl: 0.24, flip: dir < 0, status: s.status,
          age: -i * 0.1,
        })
      }
    },
  },

  swift: {
    name: 'Swift',
    type: 'normal',
    base: stats({ damage: 7, cooldown: 1.25, amount: 2, speed: 170, pierce: 1, knockback: 20 }),
    upgrades: [
      { amount: 1 },
      { damage: 3 },
      { cooldown: -0.18 },
      { amount: 1 },
      { pierce: 1 },
      { damage: 4 },
      { amount: 2 },
    ],
    fire: (g, s) => {
      const p = g.player
      const taken = new Set<number>()
      for (let i = 0; i < s.amount; i++) {
        const target = nearestEnemy(g, p.x, p.y, 320, taken)
        if (target) taken.add(target.id)
        const v = fromAngle(range(g.rng, 0, TAU), s.speed)
        spawnAttack(g, {
          move: 'swift', type: 'normal', visual: 'star', x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 5 * s.area },
          motion: { kind: 'homing', vx: v.x, vy: v.y, speed: s.speed, turn: 7, target },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, ttl: 2.5,
        })
      }
    },
  },

  thunder: {
    name: 'Thunder',
    type: 'electric',
    base: stats({ damage: 22, cooldown: 2.6, amount: 2, knockback: 10 }),
    status: { kind: 'paralysis', chance: 0.5, duration: 2.5, power: 0 },
    upgrades: [
      { amount: 1 },
      { damage: 8 },
      { area: 0.25, statusChance: 0.15 },
      { amount: 1 },
      { cooldown: -0.3 },
      { damage: 10 },
      { amount: 2 },
    ],
    fire: (g, s) => {
      const targets = enemiesInView(g)
      if (targets.length === 0) return
      for (let i = 0; i < s.amount; i++) {
        const t = pick(g.rng, targets)
        spawnAttack(g, {
          move: 'thunder', type: 'electric', visual: 'thunder', x: t.x, y: t.y,
          shape: { kind: 'circle', r: 16 * s.area },
          motion: { kind: 'static' },
          damage: s.damage, knockback: s.knockback, ttl: 0.5, activeFrom: 0.22, activeUntil: 0.3, status: s.status,
          age: -i * 0.12,
        })
      }
      g.events.push({ kind: 'thunder' })
    },
  },

  sludgeBomb: {
    name: 'Sludge Bomb',
    type: 'poison',
    base: stats({ damage: 6, cooldown: 3.6, amount: 1, duration: 2.6 }),
    status: { kind: 'poison', chance: 0.6, duration: 3, power: 0.35 },
    upgrades: [
      { amount: 1 },
      { damage: 2, statusDamage: 0.25 },
      { duration: 0.6 },
      { area: 0.2 },
      { amount: 1 },
      { damage: 3 },
      { amount: 1, area: 0.2 },
    ],
    fire: (g, s) => {
      const p = g.player
      const nearby = enemiesInView(g).filter((e) => dm.sq(e.x - p.x) + dm.sq(e.y - p.y) < 130 * 130)
      for (let i = 0; i < s.amount; i++) {
        const t = nearby.length > 0 ? pick(g.rng, nearby) : { x: p.x + range(g.rng, -80, 80), y: p.y + range(g.rng, -60, 60) }
        spawnAttack(g, {
          move: 'sludgeBomb', type: 'poison', visual: 'sludge', x: t.x, y: t.y,
          shape: { kind: 'circle', r: 22 * s.area },
          motion: { kind: 'static' },
          damage: s.damage, hitInterval: 0.45, ttl: 0.4 + s.duration, activeFrom: 0.4, status: s.status,
          from: { x: p.x, y: p.y - 10 },
          age: -i * 0.15,
        })
      }
    },
  },

  gust: {
    name: 'Gust',
    type: 'flying',
    base: stats({ damage: 8, cooldown: 3, amount: 1, duration: 0.45, knockback: 170 }),
    upgrades: [
      { damage: 3 },
      { area: 0.2 },
      { cooldown: -0.4 },
      { amount: 1 },
      { damage: 4 },
      { area: 0.3, knockback: 60 },
      { amount: 1 },
    ],
    fire: (g, s) => {
      const p = g.player
      for (let i = 0; i < s.amount; i++) {
        spawnAttack(g, {
          move: 'gust', type: 'flying', visual: 'gust', x: p.x, y: p.y,
          shape: { kind: 'circle', r: 6 },
          motion: { kind: 'follow', ox: 0, oy: -4 },
          damage: s.damage, knockback: s.knockback, ttl: s.duration, grow: (74 * s.area) / s.duration,
          age: -i * 0.22,
        })
      }
    },
  },

  machPunch: {
    name: 'Mach Punch',
    type: 'fighting',
    base: stats({ damage: 9, cooldown: 1.1, amount: 3, knockback: 50 }),
    upgrades: [
      { amount: 1 },
      { damage: 3 },
      { area: 0.2 },
      { amount: 1 },
      { cooldown: -0.2 },
      { damage: 5 },
      { amount: 2 },
    ],
    fire: (g, s) => {
      const angle = aimAngle(g, 90)
      for (let i = 0; i < s.amount; i++) {
        const jab = angle + (i % 2 === 0 ? 0.3 : -0.3)
        spawnAttack(g, {
          move: 'machPunch', type: 'fighting', visual: 'fist', x: g.player.x, y: g.player.y,
          shape: { kind: 'circle', r: 9 * s.area },
          motion: { kind: 'follow', ...reachOffset(jab, 20 * s.area) },
          damage: s.damage, knockback: s.knockback, ttl: 0.14, age: -i * 0.09,
        })
      }
    },
  },

  flashCannon: {
    name: 'Flash Cannon',
    type: 'steel',
    base: stats({ damage: 16, cooldown: 2.2, amount: 1, speed: 150, knockback: 80 }),
    upgrades: [
      { damage: 6 },
      { area: 0.25 },
      { cooldown: -0.3 },
      { amount: 1 },
      { damage: 8 },
      { area: 0.25 },
      { amount: 1 },
    ],
    fire: (g, s) => {
      const p = g.player
      for (const angle of fan(aimAngle(g, 300), s.amount, 0.3)) {
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          move: 'flashCannon', type: 'steel', visual: 'steel', x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 8 * s.area },
          motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, ttl: 2.2,
        })
      }
    },
  },

  spiritShackle: {
    name: 'Spirit Shackle',
    type: 'ghost',
    base: stats({ damage: 8, cooldown: 1.4, amount: 3, speed: 260, pierce: 2, knockback: 20 }),
    upgrades: [
      { amount: 1 },
      { damage: 3 },
      { pierce: 1 },
      { amount: 1 },
      { cooldown: -0.2 },
      { damage: 4 },
      { amount: 2 },
    ],
    fire: (g, s) => {
      const p = g.player
      for (const angle of fan(aimAngle(g, 300), s.amount, 0.14)) {
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          move: 'spiritShackle', type: 'ghost', visual: 'arrow', x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 4 * s.area },
          motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, ttl: 1.2,
        })
      }
    },
  },

  waterShuriken: {
    name: 'Water Shuriken',
    type: 'water',
    base: stats({ damage: 5, cooldown: 0.9, amount: 2, speed: 230, pierce: 1, knockback: 15 }),
    upgrades: [
      { amount: 1 },
      { damage: 2 },
      { cooldown: -0.12 },
      { amount: 1 },
      { damage: 3 },
      { speed: 60 },
      { amount: 2 },
    ],
    fire: (g, s) => {
      const p = g.player
      const taken = new Set<number>()
      fan(aimAngle(g, 300), s.amount, 0.5).forEach((angle, i) => {
        const target = nearestEnemy(g, p.x, p.y, 300, taken)
        if (target) taken.add(target.id)
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          move: 'waterShuriken', type: 'water', visual: 'shuriken', x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 4 * s.area },
          motion: { kind: 'homing', vx: v.x, vy: v.y, speed: s.speed, turn: 10, target },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, ttl: 1.6, age: -i * 0.05,
        })
      })
    },
  },

  crunch: {
    name: 'Crunch',
    type: 'dark',
    base: stats({ damage: 18, cooldown: 1.6, amount: 1, knockback: 30 }),
    upgrades: [
      { damage: 6 },
      { amount: 1 },
      { area: 0.2 },
      { cooldown: -0.2 },
      { amount: 1 },
      { damage: 8 },
      { amount: 1, area: 0.2 },
    ],
    fire: (g, s) => {
      const p = g.player
      const taken = new Set<number>()
      for (let i = 0; i < s.amount; i++) {
        const t = nearestEnemy(g, p.x, p.y, 110, taken)
        if (!t) return
        taken.add(t.id)
        spawnAttack(g, {
          move: 'crunch', type: 'dark', visual: 'jaws', x: t.x, y: t.y - t.radius,
          shape: { kind: 'circle', r: 12 * s.area },
          motion: { kind: 'static' },
          damage: s.damage, knockback: s.knockback, ttl: 0.34, activeFrom: 0.14, activeUntil: 0.2,
          age: -i * 0.07,
        })
      }
    },
  },

  pyroBall: {
    name: 'Pyro Ball',
    type: 'fire',
    base: stats({ damage: 20, cooldown: 2.4, amount: 1, knockback: 90 }),
    upgrades: [
      { amount: 1 },
      { damage: 6 },
      { area: 0.25 },
      { cooldown: -0.3 },
      { damage: 8 },
      { amount: 1 },
      { area: 0.25, damage: 6 },
    ],
    fire: (g, s) => {
      const p = g.player
      const nearby = enemiesInView(g).filter((e) => dm.sq(e.x - p.x) + dm.sq(e.y - p.y) < 170 * 170)
      for (let i = 0; i < s.amount; i++) {
        const t = nearby.length > 0 ? pick(g.rng, nearby) : { x: p.x + p.facing.x * 90, y: p.y + p.facing.y * 90 }
        spawnAttack(g, {
          move: 'pyroBall', type: 'fire', visual: 'pyro', x: t.x, y: t.y,
          shape: { kind: 'circle', r: 20 * s.area },
          motion: { kind: 'static' },
          damage: s.damage, knockback: s.knockback, ttl: 0.75, activeFrom: 0.45, activeUntil: 0.55,
          from: { x: p.x, y: p.y - 6 },
          age: -i * 0.12,
        })
      }
    },
  },

  psyshock: {
    name: 'Psyshock',
    type: 'psychic',
    base: stats({ damage: 9, cooldown: 2.2, amount: 4, speed: 170, duration: 1, knockback: 30 }),
    upgrades: [
      { amount: 1 },
      { damage: 3 },
      { area: 0.2 },
      { amount: 1 },
      { damage: 4 },
      { speed: 40 },
      { amount: 2 },
    ],
    fire: (g, s) => {
      const p = g.player
      for (const angle of radial(g, s.amount)) {
        const d = fromAngle(angle)
        spawnAttack(g, {
          move: 'psyshock', type: 'psychic', visual: 'psy', x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 6 * s.area },
          motion: { kind: 'boomerang', vx: d.x * s.speed, vy: d.y * s.speed, ax: -d.x * s.speed * 1.6, ay: -d.y * s.speed * 1.6 },
          damage: s.damage, knockback: s.knockback, hitInterval: 0.5, ttl: 1.8 * s.duration,
        })
      }
    },
  },

  earthquake: {
    name: 'Earthquake',
    type: 'ground',
    base: stats({ damage: 24, cooldown: 3.2, amount: 1, duration: 0.35, knockback: 60 }),
    upgrades: [
      { damage: 8 },
      { area: 0.2 },
      { cooldown: -0.4 },
      { amount: 1 },
      { damage: 10 },
      { area: 0.25 },
      { amount: 1, damage: 10 },
    ],
    fire: (g, s) => {
      const p = g.player
      for (let i = 0; i < s.amount; i++) {
        spawnAttack(g, {
          move: 'earthquake', type: 'ground', visual: 'quake', x: p.x, y: p.y,
          shape: { kind: 'circle', r: 8 },
          motion: { kind: 'static' },
          damage: s.damage, knockback: s.knockback, ttl: s.duration, grow: (84 * s.area) / s.duration,
          age: -i * 0.35,
        })
      }
      g.shake = Math.max(g.shake, 3)
    },
  },

  drumBeating: {
    name: 'Drum Beating',
    type: 'grass',
    base: stats({ damage: 11, cooldown: 1.9, amount: 1, duration: 0.3, knockback: 40 }),
    status: { kind: 'slow', chance: 1, duration: 0.6, power: 0.35 },
    upgrades: [
      { damage: 4 },
      { area: 0.2 },
      { amount: 1 },
      { cooldown: -0.25 },
      { damage: 5 },
      { amount: 1 },
      { area: 0.25, damage: 5 },
    ],
    fire: (g, s) => {
      const p = g.player
      for (let i = 0; i < s.amount; i++) {
        spawnAttack(g, {
          move: 'drumBeating', type: 'grass', visual: 'drumRoots', x: p.x, y: p.y,
          shape: { kind: 'circle', r: 6 },
          motion: { kind: 'follow', ox: 0, oy: 0 },
          damage: s.damage, knockback: s.knockback, ttl: s.duration, grow: (62 * s.area) / s.duration, status: s.status,
          age: -i * 0.25,
        })
      }
    },
  },

  disarmingVoice: {
    name: 'Disarming Voice',
    type: 'fairy',
    base: stats({ damage: 7, cooldown: 1.6, amount: 6, speed: 150, pierce: 1, knockback: 30 }),
    upgrades: [
      { amount: 2 },
      { damage: 3 },
      { pierce: 1 },
      { cooldown: -0.2 },
      { amount: 2 },
      { damage: 4 },
      { amount: 4 },
    ],
    fire: (g, s) => {
      const p = g.player
      for (const angle of radial(g, s.amount)) {
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          move: 'disarmingVoice', type: 'fairy', visual: 'heart', x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 5 * s.area },
          motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, ttl: 1.1,
        })
      }
    },
  },

  torchSong: {
    name: 'Torch Song',
    type: 'fire',
    base: stats({ damage: 9, cooldown: 2, amount: 5, speed: 115, pierce: 2, knockback: 20 }),
    upgrades: [
      { amount: 1 },
      { damage: 3 },
      { pierce: 1 },
      { amount: 2 },
      { cooldown: -0.3 },
      { damage: 5 },
      { amount: 2, area: 0.2 },
    ],
    fire: (g, s) => {
      const p = g.player
      for (const angle of radial(g, s.amount, -1.1)) {
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          move: 'torchSong', type: 'fire', visual: 'note', x: p.x, y: p.y - 10,
          shape: { kind: 'circle', r: 5 * s.area },
          motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, ttl: 1.4,
        })
      }
    },
  },

  leafBlade: {
    name: 'Leaf Blade',
    type: 'grass',
    base: stats({ damage: 13, cooldown: 1.5, amount: 1, speed: 12, knockback: 50 }),
    upgrades: [
      { damage: 4 },
      { area: 0.2 },
      { amount: 1 },
      { cooldown: -0.2 },
      { damage: 6 },
      { area: 0.2 },
      { amount: 1 },
    ],
    fire: (g, s) => {
      const p = g.player
      const start = dm.atan2(p.facing.y, p.facing.x)
      for (let i = 0; i < s.amount; i++) {
        spawnAttack(g, {
          move: 'leafBlade', type: 'grass', visual: 'blade', x: p.x, y: p.y,
          shape: { kind: 'circle', r: 9 * s.area },
          motion: { kind: 'orbit', angle: start + (i / s.amount) * TAU, spin: s.speed, radius: 24 * s.area },
          damage: s.damage, knockback: s.knockback, ttl: TAU / s.speed,
        })
      }
    },
  },

  razorShell: {
    name: 'Razor Shell',
    type: 'water',
    base: stats({ damage: 15, cooldown: 1.2, amount: 1, knockback: 80 }),
    upgrades: [
      { amount: 1 },
      { damage: 5 },
      { area: 0.2 },
      { cooldown: -0.15 },
      { damage: 6 },
      { area: 0.2 },
      { amount: 1, damage: 6 },
    ],
    fire: (g, s) => {
      const p = g.player
      const start = dm.atan2(p.facing.y, p.facing.x)
      for (let i = 0; i < s.amount; i++) {
        spawnAttack(g, {
          move: 'razorShell', type: 'water', visual: 'shell', x: p.x, y: p.y,
          shape: { kind: 'circle', r: 20 * s.area },
          motion: { kind: 'follow', ...reachOffset(start + (i / s.amount) * TAU, 18 * s.area) },
          damage: s.damage, knockback: s.knockback, ttl: 0.22, age: -i * 0.08,
        })
      }
    },
  },

  quickAttack: {
    name: 'Quick Attack',
    type: 'normal',
    base: stats({ damage: 14, cooldown: 2.4, speed: 360, knockback: 90 }),
    minCooldown: LUNGE_MIN_COOLDOWN,
    manual: true,
    upgrades: [
      { damage: 5 },
      { area: 0.2 },
      { cooldown: -0.3 },
      { damage: 6 },
      { speed: 70 },
      { cooldown: -0.3 },
      { damage: 8, area: 0.2 },
    ],
    fire: (g, s) => lunge(g, s, { move: 'quickAttack', type: 'normal', visual: 'quick' }),
  },

  shockWave: {
    name: 'Shock Wave',
    type: 'electric',
    base: stats({ damage: 12, cooldown: 1.6, amount: 3 }),
    status: { kind: 'paralysis', chance: 0.2, duration: 1.5, power: 0 },
    upgrades: [
      { amount: 1 },
      { damage: 4 },
      { cooldown: -0.2 },
      { amount: 1 },
      { damage: 5, statusChance: 0.1 },
      { area: 0.25 },
      { amount: 2 },
    ],
    fire: (g, s) => chain(g, s, { move: 'shockWave', type: 'electric', visual: 'shock' }),
  },

  hex: {
    name: 'Hex',
    type: 'ghost',
    base: stats({ damage: 11, cooldown: 1.5, amount: 3 }),
    upgrades: [
      { amount: 1 },
      { damage: 4 },
      { cooldown: -0.2 },
      { amount: 1 },
      { damage: 5 },
      { area: 0.25 },
      { amount: 2 },
    ],
    fire: (g, s) => chain(g, s, { move: 'hex', type: 'ghost', visual: 'hex' }, HEX_BONUS),
  },

  toxicSpikes: {
    name: 'Toxic Spikes',
    type: 'poison',
    base: stats({ damage: 18, cooldown: 1.4, amount: 1, duration: 6, knockback: 50 }),
    status: { kind: 'poison', chance: 0.6, duration: 3, power: 0.3 },
    upgrades: [
      { damage: 6 },
      { amount: 1 },
      { area: 0.2 },
      { duration: 2 },
      { damage: 8, statusDamage: 0.25 },
      { amount: 1 },
      { area: 0.25, damage: 6 },
    ],
    fire: (g, s) => mine(g, s, { move: 'toxicSpikes', type: 'poison', visual: 'spikes' }, 'spikesBlast'),
  },

  willOWisp: {
    name: 'Will-O-Wisp',
    type: 'fire',
    base: stats({ damage: 9, cooldown: 6.5, amount: 1, speed: 170, duration: 5, knockback: 20 }),
    status: { kind: 'burn', chance: 0.3, duration: 2.5, power: 0.3 },
    upgrades: [
      { damage: 3 },
      { duration: 1.5 },
      { amount: 1 },
      { cooldown: -1 },
      { damage: 4, statusChance: 0.1 },
      { duration: 1.5 },
      { amount: 1, damage: 3 },
    ],
    fire: (g, s) => turret(g, s, { move: 'willOWisp', type: 'fire', visual: 'wisp' }, 'wispShot', 0.6),
  },

  iceShard: {
    name: 'Ice Shard',
    type: 'ice',
    base: stats({ damage: 7, cooldown: 1.4, amount: 2, speed: 240, duration: 2.4, knockback: 10 }),
    status: { kind: 'slow', chance: 0.5, duration: 1.5, power: 0.5 },
    upgrades: [
      { amount: 1 },
      { damage: 3 },
      { duration: 1 },
      { amount: 1 },
      { cooldown: -0.2 },
      { damage: 4, statusChance: 0.2 },
      { amount: 2, area: 0.2 },
    ],
    fire: (g, s) => shards(g, s, { move: 'iceShard', type: 'ice', visual: 'iceShard' }, fan(aimAngle(g, 240), s.amount, 0.32), 3.4),
  },

  rockTomb: {
    name: 'Rock Tomb',
    type: 'rock',
    base: stats({ damage: 16, cooldown: 2.2, amount: 2, knockback: 40 }),
    status: { kind: 'slow', chance: 1, duration: 1.2, power: 0.5 },
    upgrades: [
      { amount: 1 },
      { damage: 6 },
      { area: 0.2 },
      { cooldown: -0.3 },
      { amount: 1 },
      { damage: 8 },
      { amount: 1, area: 0.2 },
    ],
    // Boulders drop on the nearest foes, a little ahead of them (they walk at you while it falls).
    fire: (g, s) => {
      const p = g.player
      const taken = new Set<number>()
      const first = nearestEnemy(g, p.x, p.y, 170)
      if (!first) return
      for (let i = 0; i < s.amount; i++) {
        const t = i === 0 ? first : nearestEnemy(g, p.x, p.y, 170, taken)
        if (t) taken.add(t.id)
        const foe = t ?? first
        const d = dirTo(foe.x, foe.y, p.x, p.y)
        const lead = Math.min(foe.speed * ROCK_FALL, dm.hypot(foe.x - p.x, foe.y - p.y) * 0.5)
        // No foe left for this boulder: it lands around the first one.
        const off = t ? { x: 0, y: 0 } : fromAngle(i * 2.4, 20 * s.area)
        spawnAttack(g, {
          move: 'rockTomb', type: 'rock', visual: 'rockTomb', x: foe.x + d.x * lead + off.x, y: foe.y + d.y * lead + off.y,
          shape: { kind: 'circle', r: 15 * s.area }, motion: { kind: 'static' },
          damage: s.damage, knockback: s.knockback, ttl: ROCK_FALL + 0.6, activeFrom: ROCK_FALL, activeUntil: ROCK_FALL + 0.08,
          status: s.status, flip: i % 2 === 1, age: -i * 0.1,
        })
      }
    },
  },

  pinMissile: {
    name: 'Pin Missile',
    type: 'bug',
    base: stats({ damage: 5, cooldown: 1.2, amount: 3, speed: 280, pierce: 1, knockback: 12 }),
    status: { kind: 'poison', chance: 0.15, duration: 2.5, power: 0.2 },
    upgrades: [
      { amount: 1 },
      { damage: 2 },
      { amount: 1 },
      { cooldown: -0.15 },
      { pierce: 1 },
      { damage: 3, statusChance: 0.1 },
      { amount: 2 },
    ],
    // Needles leave from both flanks and curve into the nearest foe.
    fire: (g, s) => {
      const p = g.player
      const target = nearestEnemy(g, p.x, p.y, 260)
      const aim = target ? dm.atan2(target.y - p.y, target.x - p.x) : dm.atan2(p.facing.y, p.facing.x)
      for (let i = 0; i < s.amount; i++) {
        const side = i % 2 === 0 ? 1 : -1
        const v = fromAngle(aim + side * (0.9 + 0.15 * Math.floor(i / 2)), s.speed)
        spawnAttack(g, {
          move: 'pinMissile', type: 'bug', visual: 'pin', x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 3 * s.area },
          motion: { kind: 'homing', vx: v.x, vy: v.y, speed: s.speed, turn: 9, target },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, ttl: 1, status: s.status, age: -i * 0.06,
        })
      }
    },
  },

  dragonBreath: {
    name: 'Dragon Breath',
    type: 'dragon',
    base: stats({ damage: 8, cooldown: 1.3, amount: 3, speed: 170, knockback: 35 }),
    status: { kind: 'burn', chance: 0.2, duration: 2, power: 0.3 },
    upgrades: [
      { amount: 1 },
      { damage: 3 },
      { area: 0.2 },
      { cooldown: -0.15 },
      { amount: 1 },
      { damage: 4, statusChance: 0.1 },
      { amount: 2 },
    ],
    fire: (g, s) => breath(g, s, { move: 'dragonBreath', type: 'dragon', visual: 'dragonBreath' }, aimAngle(g, 200), s.amount),
  },

  /* ---------- Evolved moves (max level move + paired held item, see data/evolutions.ts) ---------- */

  flamethrower: {
    name: 'Flamethrower',
    type: 'fire',
    base: stats({ damage: 18, cooldown: 0.9, amount: 7, speed: 240, area: 1.3, knockback: 30 }),
    status: { kind: 'burn', chance: 0.35, duration: 2.5, power: 0.35 },
    upgrades: [],
    fire: (g, s) => {
      const p = g.player
      const angle = aimAngle(g, 300)
      for (let i = 0; i < s.amount; i++) {
        const v = fromAngle(angle + range(g.rng, -0.14, 0.14), s.speed * range(g.rng, 0.9, 1.1))
        spawnAttack(g, {
          move: 'flamethrower', type: 'fire', visual: 'flamethrower', x: p.x, y: p.y - 6,
          shape: { kind: 'circle', r: 4 * s.area },
          motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, ttl: 0.75, grow: 10 * s.area, status: s.status,
          age: -i * 0.05,
        })
      }
    },
  },

  fireBlast: {
    name: 'Fire Blast',
    type: 'fire',
    base: stats({ damage: 26, cooldown: 3.6, amount: 5, speed: 2.8, duration: 3.4, area: 1.3, knockback: 60 }),
    status: { kind: 'burn', chance: 0.4, duration: 3, power: 0.35 },
    upgrades: [],
    fire: (g, s) => {
      const p = g.player
      for (let i = 0; i < s.amount; i++) {
        spawnAttack(g, {
          move: 'fireBlast', type: 'fire', visual: 'fireBlast', x: p.x, y: p.y,
          shape: { kind: 'circle', r: 10 * s.area },
          motion: { kind: 'orbit', angle: (i / s.amount) * TAU, spin: s.speed, radius: 46 * s.area },
          damage: s.damage, knockback: s.knockback, hitInterval: 0.35, ttl: s.duration, status: s.status,
        })
      }
    },
  },

  hydroPump: {
    name: 'Hydro Pump',
    type: 'water',
    base: stats({ damage: 30, cooldown: 0.7, amount: 3, speed: 360, area: 1.4, knockback: 150 }),
    upgrades: [],
    fire: (g, s) => {
      const p = g.player
      for (const [i, angle] of fan(dm.atan2(p.facing.y, p.facing.x), s.amount, 0.22).entries()) {
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          move: 'hydroPump', type: 'water', visual: 'hydroPump', x: p.x, y: p.y - 6,
          shape: { kind: 'circle', r: 7 * s.area },
          motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, ttl: 0.9,
          age: -(i % 2) * 0.05,
        })
      }
    },
  },

  surf: {
    name: 'Surf',
    type: 'water',
    base: stats({ damage: 26, cooldown: 1.3, amount: 2, duration: 0.9, knockback: 110 }),
    status: { kind: 'slow', chance: 1, duration: 0.8, power: 0.5 },
    upgrades: [],
    fire: (g, s) => {
      const p = g.player
      for (let i = 0; i < s.amount; i++) {
        spawnAttack(g, {
          move: 'surf', type: 'water', visual: 'surf', x: p.x, y: p.y,
          shape: { kind: 'circle', r: 8 },
          motion: { kind: 'follow', ox: 0, oy: -4 },
          damage: s.damage, knockback: s.knockback, ttl: s.duration, grow: (150 * s.area) / s.duration, status: s.status,
          age: -i * 0.35,
        })
      }
    },
  },

  leafStorm: {
    name: 'Leaf Storm',
    type: 'grass',
    base: stats({ damage: 20, cooldown: 1.6, amount: 10, speed: 240, area: 1.4, knockback: 35 }),
    upgrades: [],
    fire: (g, s) => {
      const p = g.player
      const spin = g.time * 1.7
      for (let i = 0; i < s.amount; i++) {
        const d = fromAngle(spin + (i / s.amount) * TAU)
        spawnAttack(g, {
          move: 'leafStorm', type: 'grass', visual: 'leafStorm', x: p.x, y: p.y - 6,
          shape: { kind: 'circle', r: 6 * s.area },
          motion: { kind: 'boomerang', vx: d.x * s.speed, vy: d.y * s.speed, ax: -d.x * s.speed * 1.5, ay: -d.y * s.speed * 1.5 },
          damage: s.damage, knockback: s.knockback, hitInterval: 0.5, ttl: 2.2 * s.duration,
        })
      }
    },
  },

  powerWhip: {
    name: 'Power Whip',
    type: 'grass',
    base: stats({ damage: 48, cooldown: 1, amount: 4, area: 1.7, knockback: 130 }),
    upgrades: [],
    fire: (g, s) => {
      const p = g.player
      const side = p.facing.x < 0 ? -1 : 1
      const w = 72 * s.area
      const h = 16 * s.area
      for (let i = 0; i < s.amount; i++) {
        const dir = i % 2 === 0 ? side : -side
        spawnAttack(g, {
          move: 'powerWhip', type: 'grass', visual: 'powerWhip', x: p.x, y: p.y,
          shape: { kind: 'rect', w, h },
          motion: { kind: 'follow', ox: dir * (w / 2 + 4), oy: 2 - Math.floor(i / 2) * 16 },
          damage: s.damage, knockback: s.knockback, ttl: 0.3, flip: dir < 0,
          age: -Math.floor(i / 2) * 0.08,
        })
      }
    },
  },

  triAttack: {
    name: 'Tri Attack',
    type: 'normal',
    base: stats({ damage: 18, cooldown: 1, amount: 9, speed: 210, pierce: 3, area: 1.2, knockback: 30 }),
    upgrades: [],
    fire: (g, s) => {
      const p = g.player
      const taken = new Set<number>()
      for (let i = 0; i < s.amount; i++) {
        const target = nearestEnemy(g, p.x, p.y, 340, taken)
        if (target) taken.add(target.id)
        const v = fromAngle((i / s.amount) * TAU, s.speed)
        spawnAttack(g, {
          move: 'triAttack', type: 'normal', visual: 'triAttack', x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 5 * s.area },
          motion: { kind: 'homing', vx: v.x, vy: v.y, speed: s.speed, turn: 8, target },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, ttl: 2.5,
        })
      }
    },
  },

  wildboltStorm: {
    name: 'Wildbolt Storm',
    type: 'electric',
    base: stats({ damage: 46, cooldown: 1.7, amount: 9, area: 1.5, knockback: 30 }),
    status: { kind: 'paralysis', chance: 0.5, duration: 2.5, power: 0 },
    upgrades: [],
    fire: (g, s) => {
      const targets = enemiesInView(g)
      if (targets.length === 0) return
      for (let i = 0; i < s.amount; i++) {
        const t = pick(g.rng, targets)
        spawnAttack(g, {
          move: 'wildboltStorm', type: 'electric', visual: 'wildbolt', x: t.x, y: t.y,
          shape: { kind: 'circle', r: 16 * s.area },
          motion: { kind: 'static' },
          damage: s.damage, knockback: s.knockback, ttl: 0.55, activeFrom: 0.2, activeUntil: 0.3, status: s.status,
          age: -i * 0.07,
        })
      }
      g.events.push({ kind: 'thunder' })
    },
  },

  gunkShot: {
    name: 'Gunk Shot',
    type: 'poison',
    base: stats({ damage: 14, cooldown: 2.8, amount: 5, duration: 4, area: 1.7 }),
    status: { kind: 'poison', chance: 0.7, duration: 3.5, power: 0.4 },
    upgrades: [],
    fire: (g, s) => {
      const p = g.player
      const nearby = enemiesInView(g).filter((e) => dm.sq(e.x - p.x) + dm.sq(e.y - p.y) < 160 * 160)
      for (let i = 0; i < s.amount; i++) {
        const t = nearby.length > 0 ? pick(g.rng, nearby) : { x: p.x + range(g.rng, -100, 100), y: p.y + range(g.rng, -70, 70) }
        spawnAttack(g, {
          move: 'gunkShot', type: 'poison', visual: 'gunk', x: t.x, y: t.y,
          shape: { kind: 'circle', r: 22 * s.area },
          motion: { kind: 'static' },
          damage: s.damage, hitInterval: 0.4, ttl: 0.45 + s.duration, activeFrom: 0.45, status: s.status,
          from: { x: p.x, y: p.y - 10 },
          age: -i * 0.12,
        })
      }
    },
  },

  hurricane: {
    name: 'Hurricane',
    type: 'flying',
    base: stats({ damage: 16, cooldown: 4.5, amount: 2, speed: 1.6, duration: 4.5, knockback: 50 }),
    upgrades: [],
    fire: (g, s) => {
      const p = g.player
      for (let i = 0; i < s.amount; i++) {
        spawnAttack(g, {
          move: 'hurricane', type: 'flying', visual: 'hurricane', x: p.x, y: p.y,
          shape: { kind: 'circle', r: 16 * s.area },
          motion: { kind: 'orbit', angle: (i / s.amount) * TAU, spin: s.speed, radius: 64 * s.area },
          damage: s.damage, knockback: s.knockback, hitInterval: 0.25, ttl: s.duration,
        })
      }
    },
  },

  extremeSpeed: {
    name: 'Extreme Speed',
    type: 'normal',
    base: stats({ damage: 36, cooldown: 1.5, speed: 560, area: 1.4, knockback: 160 }),
    minCooldown: LUNGE_MIN_COOLDOWN,
    manual: true,
    upgrades: [],
    fire: (g, s) => lunge(g, s, { move: 'extremeSpeed', type: 'normal', visual: 'extremeSpeed' }, 44),
  },

  thunderbolt: {
    name: 'Thunderbolt',
    type: 'electric',
    base: stats({ damage: 30, cooldown: 1.1, amount: 9, area: 1.3 }),
    status: { kind: 'paralysis', chance: 0.35, duration: 2, power: 0 },
    upgrades: [],
    fire: (g, s) => chain(g, s, { move: 'thunderbolt', type: 'electric', visual: 'thunderbolt' }),
  },

  barbBarrage: {
    name: 'Barb Barrage',
    type: 'poison',
    base: stats({ damage: 42, cooldown: 1, amount: 3, duration: 7, area: 1.5, knockback: 70 }),
    status: { kind: 'poison', chance: 0.8, duration: 3.5, power: 0.4 },
    upgrades: [],
    fire: (g, s) => mine(g, s, { move: 'barbBarrage', type: 'poison', visual: 'barbs' }, 'barbsBlast'),
  },

  inferno: {
    name: 'Inferno',
    type: 'fire',
    base: stats({ damage: 22, cooldown: 4.5, amount: 3, speed: 200, duration: 8, knockback: 30 }),
    status: { kind: 'burn', chance: 0.6, duration: 3, power: 0.4 },
    upgrades: [],
    fire: (g, s) => turret(g, s, { move: 'inferno', type: 'fire', visual: 'inferno' }, 'infernoShot', 0.45),
  },
  blizzard: {
    name: 'Blizzard',
    type: 'ice',
    base: stats({ damage: 20, cooldown: 1.8, amount: 10, speed: 260, duration: 3, area: 1.4, knockback: 30 }),
    status: { kind: 'slow', chance: 1, duration: 1.5, power: 0.6 },
    upgrades: [],
    // A ring of shards all around: a frozen fence that the horde has to wade through.
    fire: (g, s) => shards(g, s, { move: 'blizzard', type: 'ice', visual: 'blizzard' }, radial(g, s.amount, 0.9), 3),
  },

  stoneEdge: {
    name: 'Stone Edge',
    type: 'rock',
    base: stats({ damage: 34, cooldown: 1.5, amount: 3, area: 1.3, knockback: 90 }),
    upgrades: [],
    // Lines of stone pillars burst from the ground towards the nearest foes, one after another.
    fire: (g, s) => {
      const p = g.player
      const taken = new Set<number>()
      const aim = aimAngle(g, 220)
      for (let i = 0; i < s.amount; i++) {
        const t = nearestEnemy(g, p.x, p.y, 220, taken)
        if (t) taken.add(t.id)
        const d = fromAngle(t ? dm.atan2(t.y - p.y, t.x - p.x) : aim + (i / s.amount) * TAU)
        for (let k = 0; k < EDGE_PILLARS; k++) {
          const dist = (14 + k * EDGE_GAP) * s.area
          spawnAttack(g, {
            move: 'stoneEdge', type: 'rock', visual: 'stoneEdge', x: p.x + d.x * dist, y: p.y + d.y * dist,
            shape: { kind: 'circle', r: 10 * s.area }, motion: { kind: 'static' },
            damage: s.damage, knockback: s.knockback, ttl: 0.6, activeUntil: 0.12, flip: (i + k) % 2 === 0,
            age: -k * 0.045 - i * 0.06,
          })
        }
      }
      g.shake = Math.max(g.shake, 2)
    },
  },

  megahorn: {
    name: 'Megahorn',
    type: 'bug',
    base: stats({ damage: 44, cooldown: 1.2, amount: 3, speed: 300, area: 1.5, knockback: 140 }),
    status: { kind: 'poison', chance: 0.3, duration: 3, power: 0.3 },
    upgrades: [],
    // Huge horns that bore through everything in their way, bending towards a foe each.
    fire: (g, s) => {
      const p = g.player
      const taken = new Set<number>()
      fan(aimAngle(g, 300), s.amount, 0.5).forEach((angle, i) => {
        const target = nearestEnemy(g, p.x, p.y, 300, taken)
        if (target) taken.add(target.id)
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          move: 'megahorn', type: 'bug', visual: 'megahorn', x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 7 * s.area },
          motion: { kind: 'homing', vx: v.x, vy: v.y, speed: s.speed, turn: 3.5, target },
          damage: s.damage, knockback: s.knockback, ttl: 1.4, status: s.status, age: -i * 0.05,
        })
      })
    },
  },

  outrage: {
    name: 'Outrage',
    type: 'dragon',
    base: stats({ damage: 26, cooldown: 0.9, amount: 3, speed: 200, area: 1.4, knockback: 70 }),
    status: { kind: 'burn', chance: 0.3, duration: 2.5, power: 0.35 },
    upgrades: [],
    // A rampage: a breath cone in `amount` directions at once, turning a little every cast.
    fire: (g, s) => {
      for (const angle of radial(g, s.amount, 2.3)) breath(g, s, { move: 'outrage', type: 'dragon', visual: 'outrage' }, angle, 3)
    },
  },
} as const satisfies Record<string, MoveDef>

export type MoveId = keyof typeof MOVES

export const MOVE_IDS = Object.keys(MOVES) as MoveId[]

export const maxMoveLevel = (id: MoveId) => MOVES[id].upgrades.length + 1

/** Whether the move waits for the player's press (`MoveDef.manual`). */
export const isManual = (id: MoveId) => {
  const def: MoveDef = MOVES[id]
  return def.manual === true
}

/** Final stats of a move at `level`, after upgrades and player modifiers (incl. type boosts). */
export const moveStats = (id: MoveId, level: number, player: PlayerStats): CastStats => {
  const def: MoveDef = MOVES[id]
  const s = def.upgrades.slice(0, level - 1).reduce<MoveStats>((acc, delta) => {
    const next = { ...acc }
    for (const k of Object.keys(delta) as (keyof MoveStats)[]) next[k] += delta[k] ?? 0
    return next
  }, def.base)
  return {
    ...s,
    damage: s.damage * player.might * (1 + (player.typeDamage[def.type] ?? 0)),
    cooldown: Math.max(def.minCooldown ?? 0.1, s.cooldown * player.cooldown),
    area: s.area * player.area,
    amount: s.amount + player.amount,
    speed: s.speed * player.projectileSpeed,
    duration: s.duration * player.duration,
    status: def.status
      ? scaleStatus(def.status, {
          chance: s.statusChance + player.statusChance,
          damage: s.statusDamage + player.statusDamage,
          duration: player.duration,
        })
      : null,
  }
}

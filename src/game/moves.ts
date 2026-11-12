import { dirTo, fromAngle, TAU } from '../engine/math'
import { chance, pick, range } from '../engine/rng'
import type { PokeType } from '../data/types'
import { spawnAttack } from './spawn'
import { damageEnemy } from './combat'
import { enemiesInView, nearestEnemy } from './queries'
import { NO_BONUS, softCooldown, type DamageBonus, type StackRule } from './kitRules'
import {
  CHAIN_JUMP, CHAIN_RANGE, chainDamage, chainTargets, HEX_BONUS, LUNGE_IFRAMES, LUNGE_MIN_COOLDOWN, LUNGE_OVERSHOOT,
  LUNGE_SEEK, LUNGE_TIME, lungeLength, lungeTarget, mineCap,
} from './moveRules'
import { ownAttack } from './players'
import type { Attack, Enemy, Game, OwnedMove, Visual } from './types'
import type { PlayerStats } from './stats'
import { modBits, modHit, refreshMods, type ModId } from './mods'
import { scaleStatus, type StatusSpec } from './status'
import { SIGNATURE_MOVES } from './signatureMoves'
import { EGG_MOVES_3 } from './eggMoves3'
import { SKETCH_MOVES } from './sketch'
import { SEASON_ONE_EGG_MOVES } from './seasonOneEggMoves'
import { SEASON_ONE_KIT_MOVES } from './seasonOneKitMoves'
import { GA_KIT_B_MOVES } from './gaKitBMoves'
import { GA_KIT_A_MOVES } from './gaKitAMoves'
import { REGIONAL_MOVES } from './regionalMoves'
import { ROCKET_KIT_MOVES } from './rocketKitMoves'
import { GA_KIT_MA_MOVES } from './gaKitMAMoves'
import { GALLOP_MOVES } from './gallopMoves'
import { TM_MOVES } from './tmMoves'
import { SHOP_TM_MOVES } from './shopTmMoves'
import { SHOP_TM_MOVES_2 } from './shopTmMoves2'
import { VERB_EVOLVED_MOVES } from './verbEvolutions'
import { EGG_MOVES_2 } from './eggMoves2'
import { DUO_MOVES } from './duoMoves'
import { LEGENDARY_MOVES } from './legendaryMoves'
import { LEGENDARY_MOVES_2 } from './legendaryMoves2'
import { ULTRA_MOVES } from './ultraMoves'
import { PATH_LEGEND_MOVES } from './pathLegendMoves'
import { LEGENDARY_MOVES_3 } from './legendaryMoves3'
import { beatOf } from './signatureRules'
import { stacksOf } from './kitRules'
import * as dm from '../engine/dmath'
import * as egg from './eggMoves'
import { ECHO_MAX, MASH_MAX, METRONOME_REF } from './eggMoveRules'
import {
  bonemerang, brine, dragonTail, electroBall, flameWheel, FOCUS, focusPunch, futureSight, gyroBall, roost, selfDestruct, sheerCold,
  solarBeam, stealthRock, suckerPunch, uTurn, venoshock,
} from './moveVerbs'
import * as evo from './typeEvolutions'
import * as evolved from './evolvedMoves'
import { TRI_ELEMENTS } from './evolvedRules'
import { shakeScreen } from './effects'

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

/** What `fire` receives: final stats, the scaled status the move inflicts and the mods of the branches taken (`mods.ts`). */
export type CastStats = MoveStats & { status: StatusSpec | null; mods: number }

/** Stat delta added by one level-up (texts live in `i18n`). */
type Upgrade = Partial<MoveStats>

/** One way of a fork: a stat trade-off plus the behavior mods it adds (`mods.ts`). */
export type Branch = { stats: Upgrade; mods?: readonly ModId[] }

/**
 * A level-up step: a stat delta, or a fork where the player picks one of two
 * branches (`OwnedMove.path` remembers which). Texts: one line per plain step,
 * a name and a line per branch for a fork (`Lines` in `i18n/pt.ts`).
 */
export type UpgradeStep = Upgrade | { fork: readonly [Branch, Branch] }

export type MoveDef = {
  /** Official English name; descriptions live in `i18n`. */
  name: string
  type: PokeType
  base: MoveStats
  upgrades: readonly UpgradeStep[]
  /** Condition its hits may inflict (chance and power scale with upgrades and items). */
  status?: StatusSpec
  /** Floor for the cooldown after every reduction (lunges, see `LUNGE_MIN_COOLDOWN`). */
  minCooldown?: number
  /** A duo move (`duoRules.ts`): fused from two maxed moves, it never evolves (and needs no evolution). */
  duo?: true
  /** Fires on the player's press (Shift, the lunge button) instead of on its own, once recharged (`updateMoves`). */
  manual?: true
  /**
   * Seconds the immunity it opens really lasts (Protect's bubble, Fly's time
   * aloft): its `duration`, cut by the uptime rules (`guardWard`,
   * `burrowWard` in `kitRules.ts`). `fire` casts with it and its card shows it.
   */
  ward?: (s: MoveStats) => number
  /** A legendary's capstone move (`legendaryMoves.ts`): evolved-tier, it never evolves and comes from the legendaries, not a learnset. */
  legendary?: true
  /** What kind of move it is, for the abilities that boost a kind (Iron Fist, Strong Jaw, Sharpness, Liquid Voice). */
  tags?: readonly MoveTag[]
  /** Per-move counter rule (`OwnedMove.stacks`, see `kitRules.ts`); `fire` reads `owned.stacks`. */
  stacks?: StackRule
  /** Casts the move. `owned` is its slot: level, `stacks`, `walkedAt` (`moveKit.ts`). */
  fire: (g: Game, s: CastStats, owned: OwnedMove) => void
  /** A guard window it opened (`guard` in `moveKit.ts`) negated a hit from `from` (none for hazards): counter it. */
  onGuard?: (g: Game, s: CastStats, owned: OwnedMove, from?: Enemy) => void
  /** A burrow it started (`burrow` in `moveKit.ts`) ended: come back out, usually with a hit. */
  emerge?: (g: Game, s: CastStats, owned: OwnedMove) => void
  /** One of its hitboxes `a` landed a hit on `e` (after the damage): ramp it up, grow it, shake the screen. */
  onHit?: (g: Game, a: Attack, e: Enemy) => void
}

/**
 * Kinds of move abilities boost (`data/abilities.ts`). `weak` (a base hit of
 * `WEAK_MOVE` or less: Technician) and `status` (inflicts a condition: Sheer
 * Force) follow from the move's data; the rest are tagged by hand.
 */
export type MoveTag = 'punch' | 'bite' | 'slice' | 'sound' | 'weak' | 'status'

/** The strongest base hit Technician still counts as weak. */
export const WEAK_MOVE = 10

/** Whether a move is of a kind (`MoveTag`). */
export const hasTag = (def: MoveDef, tag: MoveTag) =>
  tag === 'weak' ? def.base.damage <= WEAK_MOVE : tag === 'status' ? def.status !== undefined : (def.tags?.includes(tag) ?? false)

/** Extra damage the player's tag boosts give a move (0 without any). */
const tagBonus = (def: MoveDef, player: PlayerStats) => {
  let bonus = 0
  for (const [tag, value] of Object.entries(player.tagDamage) as Array<[MoveTag, number]>) if (hasTag(def, tag)) bonus += value
  return bonus
}

/** What a cast helper needs to name and paint its hitboxes. */
export type Look = { move: MoveId; type: PokeType; visual: Visual }

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
 * hits in all), ×0.85 damage per jump and `bonus` on the foes it applies to
 * (Hex: ×1.7 on foes with a status condition). The hits land at once, without
 * knockback; each jump leaves a visual-only arc from the previous foe, a few ms apart.
 */
const chain = (g: Game, s: CastStats, look: Look, bonus: readonly DamageBonus[] = NO_BONUS) => {
  const p = g.player
  const targets = chainTargets(g.enemies, p, s.amount, CHAIN_RANGE, CHAIN_JUMP * s.area)
  let from = { x: p.x, y: p.y - 10 }
  targets.forEach((e, hop) => {
    const to = { x: e.x, y: e.y - e.radius }
    const arc = spawnAttack(g, {
      ...look, ...to, from,
      shape: { kind: 'circle', r: 4 * s.area }, motion: { kind: 'static' },
      damage: chainDamage(s.damage, hop), bonus, status: s.status,
      ttl: 0.28, activeFrom: Infinity, age: -hop * 0.035,
    })
    damageEnemy(g, e, arc)
    // The hit lands here, not in `collide`, so its mods hear of it here.
    if (arc.mod) modHit(g, arc, e)
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
  for (const a of g.attacks) if (ownAttack(g, a) && a.move === look.move && a.blast > 0 && a.pierce > 0) mines.push(a)
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

/** Hex hits foes with a status condition ×1.7. */
const HEX: readonly DamageBonus[] = [{ when: 'afflicted', mult: HEX_BONUS }]

/** Seconds a Rock Tomb boulder takes to fall: its shadow is the warning. */
const ROCK_FALL = 0.32
/** Pillars in each Stone Edge line, and the gap between them (px, scaled by area). */
const EDGE_PILLARS = 6
const EDGE_GAP = 15

/** Leaf Blade crits on every third swing, Drum Beating hits its downbeat on every third beat. */
const LEAF_BLADE_BAR = 3
const DRUM_BAR = 3
/** Mach Punch recharges this much faster while the player walks. */
const MACH_HASTE = 0.3
/** Torch Song: power each cast in a row adds (lost when the player is hurt), up to `TORCH_MAX` casts. */
const TORCH_POWER = 0.08
const TORCH_MAX = 5
/** How far a Pyro Ball looks for a second foe to bounce onto. */
const PYRO_BOUNCE = 90

export const MOVES = {
  /* ---------- Starter signatures (`signatureMoves.ts`) ---------- */
  ...SIGNATURE_MOVES,

  ember: {
    name: 'Ember',
    type: 'fire',
    base: stats({ damage: 10, cooldown: 1, amount: 1, speed: 190, pierce: 1, knockback: 40 }),
    status: { kind: 'burn', chance: 0.3, duration: 2.5, power: 0.3 },
    upgrades: [
      { amount: 1 },
      { damage: 4, statusChance: 0.1 },
      { fork: [{ stats: { cooldown: -0.1 }, mods: ['seek'] }, { stats: { speed: -40 }, mods: ['trail'] }] },
      { amount: 1 },
      { pierce: 1 },
      { fork: [{ stats: { damage: 4 }, mods: ['split'] }, { stats: { cooldown: 0.1 }, mods: ['rear'] }] },
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
      { fork: [{ stats: { damage: -3 }, mods: ['twin'] }, { stats: { damage: 4, speed: -0.6 }, mods: ['trail'] }] },
      { duration: 0.6 },
      { amount: 1 },
      { fork: [{ stats: { damage: 5 }, mods: ['burstOnKill'] }, { stats: { statusDamage: 0.4 }, mods: ['echo'] }] },
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
      { fork: [{ stats: { damage: -1 }, mods: ['rear'] }, { stats: { pierce: 1, speed: -60 }, mods: ['seek'] }] },
      { cooldown: -0.1 },
      { amount: 1 },
      { fork: [{ stats: { damage: 4 }, mods: ['bounce'] }, { stats: { cooldown: 0.1 }, mods: ['boomerang'] }] },
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
      { fork: [{ stats: { cooldown: -0.04 }, mods: ['cruel'] }, { stats: { cooldown: -0.08 }, mods: ['drain'] }] },
      { area: 0.2 },
      { damage: 3 },
      { fork: [{ stats: { cooldown: -0.08 }, mods: ['arc'] }, { stats: { cooldown: -0.08 }, mods: ['execute'] }] },
      { area: 0.25, damage: 3 },
    ],
    // Persistent aura: each "cast" refreshes the single live hitbox with current stats.
    fire: (g, s) => {
      const radius = 34 * s.area
      const aura = g.attacks.find((a) => ownAttack(g, a) && a.move === 'whirlpool')
      if (aura) {
        aura.shape = { kind: 'circle', r: radius }
        aura.damage = s.damage
        aura.hitInterval = s.cooldown
        aura.knockback = s.knockback
        aura.status = s.status
        refreshMods(g, aura)
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
    tags: ['slice'],
    base: stats({ damage: 11, cooldown: 1.5, amount: 1, speed: 210, duration: 1, knockback: 25 }),
    status: { kind: 'poison', chance: 0.15, duration: 3, power: 0.2 },
    upgrades: [
      { amount: 1 },
      { damage: 4 },
      { fork: [{ stats: { damage: -2 }, mods: ['rear'] }, { stats: { area: 0.2 }, mods: ['echo'] }] },
      { amount: 1 },
      { speed: 52 },
      { fork: [{ stats: { statusChance: 0.25 }, mods: ['trail'] }, { stats: { damage: 5 }, mods: ['burstOnKill'] }] },
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
      { fork: [{ stats: { area: 0.1 }, mods: ['trail'] }, { stats: { area: 0.2 }, mods: ['arc'] }] },
      { cooldown: -0.15 },
      { damage: 6 },
      { fork: [{ stats: { area: 0.2 }, mods: ['burstOnKill'] }, { stats: { area: 0.1 }, mods: ['drain'] }] },
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
      { fork: [{ stats: { damage: 6 }, mods: ['bounce'] }, { stats: { amount: 1, damage: 2 }, mods: ['halo'] }] },
      { amount: 1 },
      { pierce: 1 },
      { fork: [{ stats: { damage: 5 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.15 }, mods: ['echo'] }] },
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
      { fork: [{ stats: { amount: 2, area: -0.25, damage: -6 }, mods: ['echo'] }, { stats: { amount: -2, damage: 34, area: 0.8 }, mods: ['arc'] }] },
      { amount: 1 },
      { cooldown: -0.3 },
      { fork: [{ stats: { damage: 10 }, mods: ['burstOnKill'] }, { stats: { statusChance: 0.15 }, mods: ['trail'] }] },
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
      { fork: [{ stats: { duration: 0.3 }, mods: ['vortex'] }, { stats: {}, mods: ['echo'] }] },
      { area: 0.2 },
      { amount: 1 },
      { fork: [{ stats: { damage: 1 }, mods: ['cruel'] }, { stats: { damage: 3 }, mods: ['burstOnKill'] }] },
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

  /* ---------- Egg families' signature moves (cast in eggMoves.ts) ---------- */

  dreamEater: {
    name: 'Dream Eater',
    type: 'psychic',
    base: stats({ damage: 11, cooldown: 2.6, amount: 2, knockback: 20 }),
    status: { kind: 'sleep', chance: 0.5, duration: 2.5, power: 0 },
    upgrades: [
      { amount: 1 },
      { damage: 4 },
      { fork: [{ stats: { area: 0.1 }, mods: ['arc'] }, { stats: { area: 0.2 }, mods: ['drain'] }] },
      { statusChance: 0.15 },
      { cooldown: -0.3 },
      { fork: [{ stats: {}, mods: ['burstOnKill'] }, { stats: { damage: 11 }, mods: ['hunter'] }] },
      { amount: 2 },
    ],
    fire: (g, s) => egg.dreamEater(g, s),
  },

  forcePalm: {
    name: 'Force Palm',
    type: 'fighting',
    base: stats({ damage: 17, cooldown: 1.4, amount: 1, knockback: 60 }),
    status: { kind: 'paralysis', chance: 0.3, duration: 1.6, power: 0 },
    upgrades: [
      { damage: 5 },
      { statusChance: 0.15 },
      { fork: [{ stats: { area: 0.1 }, mods: ['arc'] }, { stats: { area: 0.2 }, mods: ['echo'] }] },
      { cooldown: -0.2 },
      { amount: 1 },
      { fork: [{ stats: { damage: 16 }, mods: ['execute'] }, { stats: { damage: 6 }, mods: ['burstOnKill'] }] },
      { area: 0.25, statusChance: 0.1 },
    ],
    fire: (g, s) => egg.forcePalm(g, s),
  },

  dig: {
    name: 'Dig',
    type: 'ground',
    base: stats({ damage: 30, cooldown: 4.5, duration: 0.9, knockback: 120 }),
    minCooldown: 2,
    manual: true,
    upgrades: [
      { damage: 10 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.4 }, mods: ['trail'] }, { stats: { cooldown: -0.5 }, mods: ['hunter'] }] },
      { damage: 12 },
      { duration: 0.3 },
      { fork: [{ stats: { cooldown: -0.5 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.5, damage: 18 }, mods: ['execute'] }] },
      { damage: 14, area: 0.25 },
    ],
    ward: egg.digUnder,
    fire: (g, s) => egg.dig(g, s),
    emerge: (g, s) => egg.digEmerge(g, s),
  },

  twister: {
    name: 'Twister',
    type: 'dragon',
    base: stats({ damage: 8, cooldown: 3.8, amount: 1, speed: 55, duration: 3.5, knockback: 10 }),
    upgrades: [
      { damage: 2 },
      { duration: 1 },
      { fork: [{ stats: { amount: 1, damage: -1 }, mods: ['trail'] }, { stats: { amount: 1 }, mods: ['execute'] }] },
      { area: 0.2 },
      { damage: 3 },
      { fork: [{ stats: { cooldown: -0.5 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.2 }, mods: ['echo'] }] },
      { amount: 1, area: 0.15 },
    ],
    fire: (g, s) => egg.twister(g, s),
  },

  sandTomb: {
    name: 'Sand Tomb',
    type: 'ground',
    base: stats({ damage: 6, cooldown: 6, duration: 4 }),
    status: { kind: 'slow', chance: 1, duration: 0.6, power: 0.3 },
    upgrades: [
      { damage: 2 },
      { area: 0.2 },
      { fork: [{ stats: { duration: 0.5 }, mods: ['drain'] }, { stats: { duration: 1 }, mods: ['cruel'] }] },
      { cooldown: -0.8 },
      { damage: 3 },
      { fork: [{ stats: { area: 0.2 }, mods: ['burstOnKill'] }, { stats: { area: 0.1, damage: 4 }, mods: ['execute'] }] },
      { duration: 1.5, damage: 2 },
    ],
    fire: (g, s) => egg.sandTomb(g, s),
  },

  meteorMash: {
    name: 'Meteor Mash',
    type: 'steel',
    tags: ['punch'],
    base: stats({ damage: 16, cooldown: 1.8, amount: 1, knockback: 70 }),
    stacks: { grow: 'hit', max: MASH_MAX, reset: 'hurt' },
    upgrades: [
      { amount: 1 },
      { damage: 5 },
      { fork: [{ stats: { area: 0.1, damage: 13 }, mods: ['arc'] }, { stats: { area: 0.2 }, mods: ['trail'] }] },
      { cooldown: -0.25 },
      { damage: 6 },
      { fork: [{ stats: { amount: 1 }, mods: ['burstOnKill'] }, { stats: { damage: 5 }, mods: ['echo'] }] },
      { damage: 6, area: 0.2 },
    ],
    fire: (g, s, owned) => egg.meteorMash(g, s, owned),
  },

  zenHeadbutt: {
    name: 'Zen Headbutt',
    type: 'psychic',
    base: stats({ damage: 20, cooldown: 1.3, knockback: 110 }),
    status: { kind: 'sleep', chance: 1, duration: 0.5, power: 0 },
    upgrades: [
      { damage: 5 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.15 }, mods: ['arc'] }, { stats: { cooldown: -0.2 }, mods: ['drain'] }] },
      { damage: 6 },
      { knockback: 40, area: 0.15 },
      { fork: [{ stats: { cooldown: -0.2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.15, damage: 13 }, mods: ['execute'] }] },
      { damage: 8 },
    ],
    fire: (g, s) => egg.zenHeadbutt(g, s),
  },

  foulPlay: {
    name: 'Foul Play',
    type: 'dark',
    base: stats({ damage: 13, cooldown: 1.8, amount: 1, knockback: 30 }),
    upgrades: [
      { damage: 4 },
      { amount: 1 },
      { fork: [{ stats: { cooldown: -0.1 }, mods: ['hunter'] }, { stats: { cooldown: -0.25 }, mods: ['arc'] }] },
      { damage: 5 },
      { area: 0.25 },
      { fork: [{ stats: { amount: 1, damage: 14 }, mods: ['execute'] }, { stats: { amount: 1, damage: -9 }, mods: ['burstOnKill'] }] },
      { damage: 6 },
    ],
    fire: (g, s) => egg.foulPlay(g, s),
  },

  bodySlam: {
    name: 'Body Slam',
    type: 'normal',
    base: stats({ damage: 22, cooldown: 3.5, knockback: 140 }),
    status: { kind: 'paralysis', chance: 0.4, duration: 1.6, power: 0 },
    minCooldown: LUNGE_MIN_COOLDOWN,
    manual: true,
    upgrades: [
      { damage: 6 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.3 }, mods: ['trail'] }, { stats: { cooldown: -0.4 }, mods: ['vortex'] }] },
      { statusChance: 0.15 },
      { damage: 8 },
      { fork: [{ stats: { cooldown: -0.4 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.4 }, mods: ['arc'] }] },
      { damage: 10, area: 0.25 },
    ],
    fire: (g, s) => egg.bodySlam(g, s),
    onHit: (g, a) => egg.bodySlamHit(g, a),
  },

  dynamicPunch: {
    name: 'Dynamic Punch',
    type: 'fighting',
    tags: ['punch'],
    base: stats({ damage: 34, cooldown: 3.2, knockback: 180 }),
    status: { kind: 'confuse', chance: 1, duration: 2, power: 0 },
    upgrades: [
      { damage: 10 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.3, damage: 10 }, mods: ['arc'] }, { stats: { cooldown: -0.4 }, mods: ['trail'] }] },
      { damage: 12 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.4, damage: -13 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.3, damage: 28 }, mods: ['hunter'] }] },
      { damage: 16 },
    ],
    fire: (g, s) => egg.dynamicPunch(g, s),
    onHit: (g, a) => egg.dynamicPunchHit(g, a),
  },

  rollout: {
    name: 'Rollout',
    type: 'rock',
    base: stats({ damage: 5, cooldown: 5, speed: 70, duration: 2, knockback: 40 }),
    upgrades: [
      { damage: 2 },
      { duration: 0.5 },
      { fork: [{ stats: { cooldown: -0.5 }, mods: ['arc'] }, { stats: { cooldown: -0.6, damage: 3 }, mods: ['drain'] }] },
      { damage: 2 },
      { area: 0.2 },
      { fork: [{ stats: { duration: 0.5 }, mods: ['burstOnKill'] }, { stats: { duration: 0.3, damage: 16 }, mods: ['hunter'] }] },
      { damage: 3, cooldown: -0.5 },
    ],
    fire: (g, s) => egg.rollout(g, s),
    onHit: (g, a) => egg.rolloutHit(g, a),
  },

  iceBall: {
    name: 'Ice Ball',
    type: 'ice',
    base: stats({ damage: 7, cooldown: 1.6, amount: 1, speed: 150, knockback: 30 }),
    status: { kind: 'slow', chance: 1, duration: 1, power: 0.35 },
    upgrades: [
      { damage: 3 },
      { amount: 1 },
      { fork: [{ stats: { speed: 30 }, mods: ['trail'] }, { stats: { damage: 6 }, mods: ['arc'] }] },
      { cooldown: -0.2 },
      { damage: 4 },
      { fork: [{ stats: { area: 0.2 }, mods: ['burstOnKill'] }, { stats: { area: 0.1 }, mods: ['execute'] }] },
      { amount: 1 },
    ],
    fire: (g, s) => egg.iceBall(g, s),
    onHit: (g, a, e) => egg.iceBallHit(g, a, e),
  },

  furyCutter: {
    name: 'Fury Cutter',
    type: 'bug',
    tags: ['slice'],
    base: stats({ damage: 7, cooldown: 0.8, knockback: 25 }),
    upgrades: [
      { damage: 2 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.05 }, mods: ['arc'] }, { stats: { cooldown: -0.1 }, mods: ['drain'] }] },
      { damage: 3 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.1 }, mods: ['execute'] }, { stats: { cooldown: -0.1 }, mods: ['burstOnKill'] }] },
      { damage: 4 },
    ],
    fire: (g, s, owned) => egg.furyCutter(g, s, owned),
  },

  sacredSword: {
    name: 'Sacred Sword',
    type: 'fighting',
    tags: ['slice'],
    base: stats({ damage: 16, cooldown: 1.9, amount: 1, knockback: 70 }),
    upgrades: [
      { damage: 5 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.2 }, mods: ['trail'] }, { stats: { cooldown: -0.25, damage: 7 }, mods: ['hunter'] }] },
      { damage: 6 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 6 }, mods: ['echo'] }, { stats: { amount: 1 }, mods: ['burstOnKill'] }] },
      { damage: 7 },
    ],
    fire: (g, s) => egg.sacredSword(g, s),
  },

  dragonDarts: {
    name: 'Dragon Darts',
    type: 'dragon',
    base: stats({ damage: 11, cooldown: 1.3, amount: 2, speed: 240, pierce: 1, knockback: 25 }),
    upgrades: [
      { damage: 3 },
      { speed: 40 },
      { fork: [{ stats: { cooldown: -0.1, damage: 16 }, mods: ['split'] }, { stats: { cooldown: -0.15, damage: -7 }, mods: ['halo'] }] },
      { damage: 4 },
      { amount: 2 },
      { fork: [{ stats: { damage: 3 }, mods: ['bounce'] }, { stats: { damage: 16 }, mods: ['hunter'] }] },
      { cooldown: -0.2, damage: 3 },
    ],
    fire: (g, s) => egg.dragonDarts(g, s),
  },

  snarl: {
    name: 'Snarl',
    type: 'dark',
    tags: ['sound'],
    base: stats({ damage: 10, cooldown: 2, amount: 3, knockback: 40 }),
    upgrades: [
      { damage: 3 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.15 }, mods: ['arc'] }, { stats: { cooldown: -0.25 }, mods: ['drain'] }] },
      { damage: 4 },
      { amount: 1 },
      { fork: [{ stats: { area: 0.2 }, mods: ['burstOnKill'] }, { stats: { area: 0.1 }, mods: ['execute'] }] },
      { damage: 5, amount: 1 },
    ],
    fire: (g, s) => egg.snarl(g, s),
  },

  gigaImpact: {
    name: 'Giga Impact',
    type: 'normal',
    base: stats({ damage: 42, cooldown: 8, duration: 1, knockback: 260 }),
    minCooldown: 3,
    manual: true,
    upgrades: [
      { damage: 10 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.6, damage: 10 }, mods: ['vortex'] }, { stats: { cooldown: -0.8 }, mods: ['arc'] }] },
      { damage: 14 },
      { duration: -0.25 },
      { fork: [{ stats: { cooldown: -0.8 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.6, damage: 15 }, mods: ['hunter'] }] },
      { damage: 18, area: 0.25 },
    ],
    fire: (g, s) => egg.gigaImpact(g, s),
    onHit: (g, a) => egg.gigaImpactHit(g, a),
  },

  flail: {
    name: 'Flail',
    type: 'normal',
    base: stats({ damage: 9, cooldown: 1.2, amount: 3, knockback: 50 }),
    upgrades: [
      { damage: 3 },
      { amount: 1 },
      { fork: [{ stats: { area: 0.1 }, mods: ['drain'] }, { stats: { area: 0.2 }, mods: ['arc'] }] },
      { cooldown: -0.15 },
      { damage: 4 },
      { fork: [{ stats: { amount: 1 }, mods: ['burstOnKill'] }, { stats: { amount: 1, damage: 4 }, mods: ['execute'] }] },
      { damage: 5, area: 0.15 },
    ],
    fire: (g, s) => egg.flail(g, s),
  },

  boneRush: {
    name: 'Bone Rush',
    type: 'ground',
    base: stats({ damage: 10, cooldown: 1.6, amount: 0, knockback: 35 }),
    upgrades: [
      { damage: 3 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.1 }, mods: ['arc'] }, { stats: { cooldown: -0.2 }, mods: ['trail'] }] },
      { amount: 1 },
      { damage: 4 },
      { fork: [{ stats: { area: 0.2 }, mods: ['burstOnKill'] }, { stats: { area: 0.1 }, mods: ['hunter'] }] },
      { amount: 1, damage: 4 },
    ],
    fire: (g, s) => egg.boneRush(g, s),
  },

  metronome: {
    name: 'Metronome',
    type: 'normal',
    base: stats({ damage: METRONOME_REF * 0.8, cooldown: 2.4 }),
    upgrades: [
      { damage: 1 },
      { cooldown: -0.2 },
      { fork: [{ stats: {}, mods: ['echo'] }, { stats: { damage: 4 }, mods: ['arc'] }] },
      { cooldown: -0.2 },
      { damage: 1.5 },
      { fork: [{ stats: { cooldown: -0.2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.2 }, mods: ['trail'] }] },
      { damage: 1.5 },
    ],
    fire: (g, s, owned) => egg.metronome(g, s, owned),
  },

  echoedVoice: {
    name: 'Echoed Voice',
    type: 'normal',
    tags: ['sound'],
    base: stats({ damage: 7, cooldown: 1.5, knockback: 40 }),
    stacks: { grow: 'cast', max: ECHO_MAX, reset: 'hurt' },
    upgrades: [
      { damage: 3 },
      { area: 0.2 },
      { fork: [{ stats: { damage: -4 }, mods: ['echo'] }, { stats: { cooldown: -0.2, damage: 4 }, mods: ['arc'] }] },
      { damage: 3 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.2 }, mods: ['execute'] }] },
      { damage: 4 },
    ],
    fire: (g, s, owned) => egg.echoedVoice(g, s, owned),
  },

  curse: {
    name: 'Curse',
    type: 'ghost',
    // damage: % of the target's max HP lost per second.
    base: stats({ damage: 1.2, cooldown: 9, amount: 1, duration: 6 }),
    upgrades: [
      { damage: 0.3 },
      { duration: 2 },
      { fork: [{ stats: { cooldown: -0.8 }, mods: ['drain'] }, { stats: { cooldown: -1 }, mods: ['hunter'] }] },
      { damage: 0.3 },
      { amount: 1 },
      { fork: [{ stats: { cooldown: -1 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.8 }, mods: ['execute'] }] },
      { damage: 0.4 },
    ],
    fire: (g, s) => egg.curse(g, s),
  },

  gust: {
    name: 'Gust',
    type: 'flying',
    base: stats({ damage: 8, cooldown: 3, amount: 1, duration: 0.45, knockback: 170 }),
    upgrades: [
      { damage: 3 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.3 }, mods: ['drain'] }, { stats: { cooldown: -0.1 }, mods: ['echo'] }] },
      { amount: 1 },
      { damage: 4 },
      { fork: [{ stats: { area: 0.3 }, mods: ['burstOnKill'] }, { stats: { area: 0.2 }, mods: ['arc'] }] },
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
    tags: ['punch'],
    base: stats({ damage: 9, cooldown: 1.1, amount: 3, knockback: 50 }),
    upgrades: [
      { amount: 1 },
      { damage: 3 },
      { fork: [{ stats: { area: 0.1 }, mods: ['arc'] }, { stats: { area: 0.2 }, mods: ['drain'] }] },
      { amount: 1 },
      { cooldown: -0.2 },
      { fork: [{ stats: { damage: 6 }, mods: ['execute'] }, { stats: { damage: 5 }, mods: ['burstOnKill'] }] },
      { amount: 2 },
    ],
    // The combo's last jab breaks the sound barrier: a shockwave flies on ahead. Walking recharges it faster.
    fire: (g, s, owned) => {
      const p = g.player
      const angle = aimAngle(g, 90)
      for (let i = 0; i < s.amount; i++) {
        const jab = angle + (i % 2 === 0 ? 0.3 : -0.3)
        spawnAttack(g, {
          move: 'machPunch', type: 'fighting', visual: 'fist', x: p.x, y: p.y,
          shape: { kind: 'circle', r: 9 * s.area },
          motion: { kind: 'follow', ...reachOffset(jab, 20 * s.area) },
          damage: s.damage, knockback: s.knockback, ttl: 0.14, age: -i * 0.09,
        })
      }
      const v = fromAngle(angle, 260)
      const off = fromAngle(angle, 24 * s.area)
      spawnAttack(g, {
        move: 'machPunch', type: 'fighting', visual: 'sonicJab', x: p.x + off.x, y: p.y - 8 + off.y,
        shape: { kind: 'circle', r: 7 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
        damage: s.damage * 0.6, knockback: s.knockback * 0.6, ttl: 0.3, age: -(s.amount - 1) * 0.09 - 0.05,
      })
      if (p.moving) owned.cooldown -= s.cooldown * MACH_HASTE
    },
  },

  flashCannon: {
    name: 'Flash Cannon',
    type: 'steel',
    base: stats({ damage: 16, cooldown: 2.2, amount: 1, speed: 150, knockback: 80 }),
    upgrades: [
      { damage: 6 },
      { area: 0.25 },
      { fork: [{ stats: { cooldown: -0.2 }, mods: ['split'] }, { stats: { cooldown: -0.1 }, mods: ['boomerang'] }] },
      { amount: 1 },
      { damage: 8 },
      { fork: [{ stats: { area: 0.1 }, mods: ['rear'] }, { stats: { area: 0.25 }, mods: ['hunter'] }] },
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
    // Pins each foe it goes through to its shadow for a moment (`signatures.ts` draws the shadow).
    status: { kind: 'slow', chance: 1, duration: 0.8, power: 0.9 },
    upgrades: [
      { amount: 1 },
      { damage: 3 },
      { fork: [{ stats: { pierce: 1 }, mods: ['seek'] }, { stats: {}, mods: ['rear'] }] },
      { amount: 1 },
      { cooldown: -0.2 },
      { fork: [{ stats: { damage: 1 }, mods: ['bounce'] }, { stats: { damage: 6 }, mods: ['cruel'] }] },
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
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, ttl: 1.2, status: s.status,
        })
      }
    },
  },

  waterShuriken: {
    name: 'Water Shuriken',
    type: 'water',
    tags: ['slice'],
    // Each shuriken swells with every foe it cuts (`signatures.ts`).
    base: stats({ damage: 5, cooldown: 0.9, amount: 2, speed: 230, pierce: 2, knockback: 15 }),
    upgrades: [
      { amount: 1 },
      { damage: 2 },
      { fork: [{ stats: { cooldown: -0.08, damage: 6 }, mods: ['bounce'] }, { stats: { cooldown: -0.12, damage: 7 }, mods: ['trail'] }] },
      { amount: 1 },
      { damage: 3 },
      { fork: [{ stats: { speed: 60 }, mods: ['split'] }, { stats: { speed: 60, damage: 2 }, mods: ['execute'] }] },
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
    tags: ['bite'],
    base: stats({ damage: 18, cooldown: 1.6, amount: 1, knockback: 30 }),
    upgrades: [
      { damage: 6 },
      { amount: 1 },
      { fork: [{ stats: { damage: -3 }, mods: ['arc'] }, { stats: { area: 0.15 }, mods: ['echo'] }] },
      { cooldown: -0.2 },
      { amount: 1 },
      { fork: [{ stats: { damage: 8 }, mods: ['burstOnKill'] }, { stats: { area: 0.2 }, mods: ['trail'] }] },
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
      { fork: [{ stats: { area: 0.15 }, mods: ['trail'] }, { stats: { area: 0.25 }, mods: ['arc'] }] },
      { cooldown: -0.3 },
      { damage: 8 },
      { fork: [{ stats: { amount: 1 }, mods: ['burstOnKill'] }, { stats: {}, mods: ['echo'] }] },
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
        // The ball bounces off the first foe onto the nearest other one, for 60% of the damage.
        const next = nearby.filter((e) => e !== t && dm.sq(e.x - t.x) + dm.sq(e.y - t.y) < PYRO_BOUNCE * PYRO_BOUNCE)
        next.sort((a, b) => dm.sq(a.x - t.x) + dm.sq(a.y - t.y) - (dm.sq(b.x - t.x) + dm.sq(b.y - t.y)) || a.id - b.id)
        const to = next[0] ?? { x: t.x + (t.x - p.x) * 0.4, y: t.y + (t.y - p.y) * 0.4 }
        spawnAttack(g, {
          move: 'pyroBall', type: 'fire', visual: 'pyro', x: to.x, y: to.y,
          shape: { kind: 'circle', r: 15 * s.area },
          motion: { kind: 'static' },
          damage: s.damage * 0.6, knockback: s.knockback * 0.7, ttl: 0.6, activeFrom: 0.3, activeUntil: 0.4,
          from: { x: t.x, y: t.y - 6 },
          age: -i * 0.12 - 0.5,
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
      { fork: [{ stats: { area: 0.1 }, mods: ['halo'] }, { stats: { area: 0.2 }, mods: ['split'] }] },
      { amount: 1 },
      { damage: 4 },
      { fork: [{ stats: { speed: 40 }, mods: ['arc'] }, { stats: { speed: 20 }, mods: ['hunter'] }] },
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
      { fork: [{ stats: { cooldown: -0.2 }, mods: ['echo'] }, { stats: { cooldown: -0.4 }, mods: ['arc'] }] },
      { amount: 1 },
      { damage: 10 },
      { fork: [{ stats: { area: 0.25 }, mods: ['burstOnKill'] }, { stats: { area: 0.15 }, mods: ['execute'] }] },
      { amount: 1, damage: 10 },
    ],
    fire: (g, s) => {
      const p = g.player
      for (let i = 0; i < s.amount; i++) {
        spawnAttack(g, {
          move: 'earthquake', type: 'ground', visual: 'quake', x: p.x, y: p.y,
          shape: { kind: 'circle', r: 8 },
          motion: { kind: 'static' },
          damage: s.damage, knockback: s.knockback, ttl: s.duration, grow: (72 * s.area) / s.duration,
          age: -i * 0.35,
        })
      }
      shakeScreen(g, 3)
    },
  },

  drumBeating: {
    name: 'Drum Beating',
    type: 'grass',
    tags: ['sound'],
    base: stats({ damage: 11, cooldown: 1.9, amount: 1, duration: 0.3, knockback: 40 }),
    status: { kind: 'slow', chance: 1, duration: 0.6, power: 0.35 },
    upgrades: [
      { damage: 4 },
      { area: 0.2 },
      { fork: [{ stats: { amount: 1 }, mods: ['cruel'] }, { stats: { amount: 1 }, mods: ['drain'] }] },
      { cooldown: -0.25 },
      { damage: 5 },
      { fork: [{ stats: { amount: 1 }, mods: ['arc'] }, { stats: { amount: 1 }, mods: ['burstOnKill'] }] },
      { area: 0.25, damage: 5 },
    ],
    // A beat in three: the third is the downbeat, a bigger, harder ring.
    fire: (g, s, owned) => {
      const p = g.player
      const beat = beatOf(stacksOf(owned), DRUM_BAR)
      owned.stacks = beat.next
      const k = beat.strong ? 1.35 : 1
      for (let i = 0; i < s.amount; i++) {
        spawnAttack(g, {
          move: 'drumBeating', type: 'grass', visual: 'drumRoots', x: p.x, y: p.y,
          shape: { kind: 'circle', r: 6 },
          motion: { kind: 'follow', ox: 0, oy: 0 },
          damage: s.damage * (beat.strong ? 1.6 : 1), knockback: s.knockback * k, ttl: s.duration,
          grow: (62 * s.area * k) / s.duration, status: s.status, age: -i * 0.25, memo: beat.strong ? 1 : 0,
        })
      }
      if (beat.strong) shakeScreen(g, 2)
    },
  },

  disarmingVoice: {
    name: 'Disarming Voice',
    type: 'fairy',
    tags: ['sound'],
    base: stats({ damage: 7, cooldown: 1.6, amount: 6, speed: 150, pierce: 1, knockback: 30 }),
    upgrades: [
      { amount: 2 },
      { damage: 3 },
      { fork: [{ stats: { damage: 9 }, mods: ['bounce'] }, { stats: { damage: -4 }, mods: ['halo'] }] },
      { cooldown: -0.2 },
      { amount: 2 },
      { fork: [{ stats: { damage: 2 }, mods: ['split'] }, { stats: { damage: 4 }, mods: ['drain'] }] },
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
    tags: ['sound'],
    base: stats({ damage: 9, cooldown: 2, amount: 5, speed: 115, pierce: 2, knockback: 20 }),
    // Each song in a row burns brighter (+8% per cast, up to 5); getting hurt breaks the streak.
    stacks: { grow: 'cast', max: TORCH_MAX, reset: 'hurt' },
    upgrades: [
      { amount: 1 },
      { damage: 3 },
      { fork: [{ stats: { pierce: 1, damage: 10 }, mods: ['seek'] }, { stats: { damage: -4 }, mods: ['halo'] }] },
      { amount: 2 },
      { cooldown: -0.3 },
      { fork: [{ stats: { damage: 5 }, mods: ['burstOnKill'] }, { stats: { damage: 3 }, mods: ['trail'] }] },
      { amount: 2, area: 0.2 },
    ],
    fire: (g, s, owned) => {
      const p = g.player
      const streak = stacksOf(owned)
      for (const angle of radial(g, s.amount, -1.1)) {
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          move: 'torchSong', type: 'fire', visual: 'note', x: p.x, y: p.y - 10,
          shape: { kind: 'circle', r: 5 * s.area },
          motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage * (1 + TORCH_POWER * streak), knockback: s.knockback, pierce: s.pierce, ttl: 1.4, memo: streak,
        })
      }
    },
  },

  leafBlade: {
    name: 'Leaf Blade',
    type: 'grass',
    tags: ['slice'],
    base: stats({ damage: 13, cooldown: 1.5, amount: 1, speed: 12, knockback: 50 }),
    upgrades: [
      { damage: 4 },
      { area: 0.2 },
      { fork: [{ stats: {}, mods: ['twin'] }, { stats: { amount: 1 }, mods: ['execute'] }] },
      { cooldown: -0.2 },
      { damage: 6 },
      { fork: [{ stats: { area: 0.2 }, mods: ['burstOnKill'] }, { stats: { area: 0.1 }, mods: ['drain'] }] },
      { amount: 1 },
    ],
    // A high critical-hit ratio: every third swing is a critical one, a bigger golden blade at ×2.
    fire: (g, s, owned) => {
      const p = g.player
      const start = dm.atan2(p.facing.y, p.facing.x)
      const beat = beatOf(stacksOf(owned), LEAF_BLADE_BAR)
      owned.stacks = beat.next
      const k = beat.strong ? 1.25 : 1
      for (let i = 0; i < s.amount; i++) {
        spawnAttack(g, {
          move: 'leafBlade', type: 'grass', visual: 'blade', x: p.x, y: p.y,
          shape: { kind: 'circle', r: 9 * s.area * k },
          motion: { kind: 'orbit', angle: start + (i / s.amount) * TAU, spin: s.speed, radius: 24 * s.area * k },
          damage: s.damage * (beat.strong ? 2 : 1), knockback: s.knockback * k, ttl: TAU / s.speed, memo: beat.strong ? 1 : 0,
        })
      }
      if (beat.strong) g.events.push({ kind: 'cast', move: 'leafBlade' })
    },
  },

  razorShell: {
    name: 'Razor Shell',
    type: 'water',
    tags: ['slice'],
    base: stats({ damage: 15, cooldown: 1.2, amount: 1, knockback: 80 }),
    // Lowers defense: a cut foe may be marked to take more damage from every hit.
    status: { kind: 'mark', chance: 0.5, duration: 4, power: 0.15 },
    upgrades: [
      { amount: 1 },
      { damage: 5 },
      { fork: [{ stats: { area: 0.1 }, mods: ['arc'] }, { stats: { area: 0.2 }, mods: ['drain'] }] },
      { cooldown: -0.15 },
      { damage: 6 },
      { fork: [{ stats: { area: 0.2 }, mods: ['burstOnKill'] }, { stats: { area: 0.1 }, mods: ['cruel'] }] },
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
          damage: s.damage, knockback: s.knockback, ttl: 0.22, age: -i * 0.08, status: s.status,
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
      { fork: [{ stats: { cooldown: -0.2 }, mods: ['trail'] }, { stats: { cooldown: -0.3, damage: 11 }, mods: ['arc'] }] },
      { damage: 6 },
      { speed: 70 },
      { fork: [{ stats: { cooldown: -0.3, damage: -8 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.3, damage: 26 }, mods: ['execute'] }] },
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
      { fork: [{ stats: { cooldown: -0.1 }, mods: ['burstOnKill'] }, { stats: { amount: -1 }, mods: ['echo'] }] },
      { amount: 1 },
      { damage: 5, statusChance: 0.1 },
      { fork: [{ stats: { statusChance: 0.1 }, mods: ['trail'] }, { stats: { damage: -2 }, mods: ['arc'] }] },
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
      { fork: [{ stats: { cooldown: -0.1, damage: -6 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.2, damage: 8 }, mods: ['drain'] }] },
      { amount: 1 },
      { damage: 5 },
      { fork: [{ stats: { area: 0.25, damage: -6 }, mods: ['trail'] }, { stats: { area: 0.1, damage: 11 }, mods: ['echo'] }] },
      { amount: 2 },
    ],
    fire: (g, s) => chain(g, s, { move: 'hex', type: 'ghost', visual: 'hex' }, HEX),
  },

  toxicSpikes: {
    name: 'Toxic Spikes',
    type: 'poison',
    base: stats({ damage: 18, cooldown: 1.4, amount: 1, duration: 6, knockback: 50 }),
    status: { kind: 'poison', chance: 0.6, duration: 3, power: 0.3 },
    upgrades: [
      { damage: 6 },
      { amount: 1 },
      { fork: [{ stats: { area: 0.2 }, mods: ['arc'] }, { stats: { area: 0.1 }, mods: ['trail'] }] },
      { duration: 2 },
      { damage: 8, statusDamage: 0.25 },
      { fork: [{ stats: { amount: 1 }, mods: ['burstOnKill'] }, { stats: { amount: 1 }, mods: ['cruel'] }] },
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
      { fork: [{ stats: { amount: 1, damage: 6 }, mods: ['trail'] }, { stats: { amount: 1, damage: -2 }, mods: ['burstOnKill'] }] },
      { cooldown: -1 },
      { damage: 4, statusChance: 0.1 },
      { fork: [{ stats: { duration: 0.5 }, mods: ['echo'] }, { stats: { duration: 1.5, damage: 4 }, mods: ['hunter'] }] },
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
      { fork: [{ stats: { damage: 6 }, mods: ['halo'] }, { stats: { duration: 0.5, damage: -2 }, mods: ['rear'] }] },
      { amount: 1 },
      { cooldown: -0.2 },
      { fork: [{ stats: { damage: 3 }, mods: ['split'] }, { stats: { statusChance: 0.2, damage: 2 }, mods: ['execute'] }] },
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
      { fork: [{ stats: { area: 0.1, damage: 3 }, mods: ['trail'] }, { stats: { area: 0.2 }, mods: ['arc'] }] },
      { cooldown: -0.3 },
      { amount: 1 },
      { fork: [{ stats: { damage: 8 }, mods: ['burstOnKill'] }, { stats: { damage: 11 }, mods: ['hunter'] }] },
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
      { fork: [{ stats: {}, mods: ['bounce'] }, { stats: { amount: 1, damage: -1 }, mods: ['rear'] }] },
      { cooldown: -0.15 },
      { pierce: 1 },
      { fork: [{ stats: { damage: 2 }, mods: ['split'] }, { stats: { damage: 5 }, mods: ['execute'] }] },
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
      { fork: [{ stats: { damage: 3 }, mods: ['rear'] }, { stats: { area: 0.2 }, mods: ['trail'] }] },
      { cooldown: -0.15 },
      { amount: 1 },
      { fork: [{ stats: { damage: 4 }, mods: ['burstOnKill'] }, { stats: { statusChance: 0.2, damage: 3 }, mods: ['cruel'] }] },
      { amount: 2 },
    ],
    fire: (g, s) => breath(g, s, { move: 'dragonBreath', type: 'dragon', visual: 'dragonBreath' }, aimAngle(g, 200), s.amount),
  },

  /* ---------- Verb moves: each one adds a way to play (`moveVerbs.ts`) ---------- */

  flameWheel: {
    name: 'Flame Wheel',
    type: 'fire',
    base: stats({ damage: 8, cooldown: 0.5, duration: 1.6 }),
    status: { kind: 'burn', chance: 0.25, duration: 2, power: 0.3 },
    upgrades: [
      { damage: 3 },
      { duration: 0.6 },
      { fork: [{ stats: { area: 0.1 }, mods: ['drain'] }, { stats: { area: 0.2 }, mods: ['arc'] }] },
      { damage: 3, statusChance: 0.1 },
      { duration: 0.6 },
      { fork: [{ stats: { damage: 4 }, mods: ['burstOnKill'] }, { stats: { damage: 2 }, mods: ['cruel'] }] },
      { area: 0.25, damage: 3 },
    ],
    fire: (g, s, owned) => flameWheel(g, s, owned),
  },

  solarBeam: {
    name: 'Solar Beam',
    type: 'grass',
    base: stats({ damage: 30, cooldown: 4.2, amount: 1, duration: 0.6, knockback: 40 }),
    upgrades: [
      { damage: 8 },
      { area: 0.15 },
      { fork: [{ stats: { cooldown: -0.4, damage: 9 }, mods: ['arc'] }, { stats: { cooldown: -0.5 }, mods: ['trail'] }] },
      { damage: 10 },
      { amount: 1 },
      { fork: [{ stats: { area: 0.2 }, mods: ['burstOnKill'] }, { stats: { area: 0.1 }, mods: ['hunter'] }] },
      { damage: 12, cooldown: -0.4 },
    ],
    fire: (g, s, owned) => solarBeam(g, s, owned),
  },

  brine: {
    name: 'Brine',
    type: 'water',
    base: stats({ damage: 16, cooldown: 1.5, amount: 1, knockback: 40 }),
    upgrades: [
      { amount: 1 },
      { damage: 5 },
      { fork: [{ stats: { cooldown: -0.1 }, mods: ['arc'] }, { stats: { cooldown: -0.2, damage: 4 }, mods: ['trail'] }] },
      { area: 0.25 },
      { amount: 1 },
      { fork: [{ stats: { damage: 10 }, mods: ['execute'] }, { stats: { damage: 7 }, mods: ['burstOnKill'] }] },
      { amount: 1, damage: 5 },
    ],
    fire: (g, s, owned) => brine(g, s, owned),
  },

  electroBall: {
    name: 'Electro Ball',
    type: 'electric',
    base: stats({ damage: 18, cooldown: 1.6, amount: 1, speed: 180, pierce: 2, knockback: 50 }),
    status: { kind: 'paralysis', chance: 0.2, duration: 1.2, power: 0 },
    upgrades: [
      { damage: 5 },
      { pierce: 1 },
      { fork: [{ stats: { cooldown: -0.1, damage: 20 }, mods: ['seek'] }, { stats: { cooldown: -0.2, damage: -7 }, mods: ['arc'] }] },
      { amount: 1 },
      { damage: 6, statusChance: 0.1 },
      { fork: [{ stats: { area: 0.15 }, mods: ['split'] }, { stats: { area: 0.25 }, mods: ['boomerang'] }] },
      { amount: 1, damage: 5 },
    ],
    fire: (g, s, owned) => electroBall(g, s, owned),
  },

  venoshock: {
    name: 'Venoshock',
    type: 'poison',
    base: stats({ damage: 12, cooldown: 1.2, amount: 1, speed: 170, pierce: 1, knockback: 20 }),
    status: { kind: 'poison', chance: 0.2, duration: 3, power: 0.25 },
    upgrades: [
      { amount: 1 },
      { damage: 4 },
      { fork: [{ stats: { cooldown: -0.1 }, mods: ['split'] }, { stats: { cooldown: -0.15 }, mods: ['trail'] }] },
      { amount: 1 },
      { damage: 5, statusChance: 0.1 },
      { fork: [{ stats: { damage: 4 }, mods: ['bounce'] }, { stats: { pierce: 1 }, mods: ['burstOnKill'] }] },
      { amount: 1, damage: 4 },
    ],
    fire: (g, s, owned) => venoshock(g, s, owned),
  },

  selfDestruct: {
    name: 'Self-Destruct',
    type: 'normal',
    base: stats({ damage: 70, cooldown: 10, knockback: 260 }),
    minCooldown: LUNGE_MIN_COOLDOWN,
    manual: true,
    upgrades: [
      { damage: 15 },
      { area: 0.15 },
      { fork: [{ stats: { cooldown: -0.7 }, mods: ['drain'] }, { stats: { cooldown: -1 }, mods: ['trail'] }] },
      { damage: 20 },
      { area: 0.15 },
      { fork: [{ stats: { cooldown: -1 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.8 }, mods: ['hunter'] }] },
      { damage: 25, area: 0.2 },
    ],
    fire: (g, s, owned) => selfDestruct(g, s, owned),
  },

  roost: {
    name: 'Roost',
    type: 'flying',
    base: stats({ damage: 10, cooldown: 0.25, knockback: 140 }),
    // Settle time and healing grow by level (`ROOST`): the empty steps are those.
    upgrades: [
      { damage: 6 },
      {},
      { fork: [{ stats: {} }, { stats: { area: 0.2 }, mods: ['trail'] }] },
      { area: 0.3 },
      {},
      { fork: [{ stats: { damage: 4 }, mods: ['burstOnKill'] }, { stats: {} }] },
      { damage: 10 },
    ],
    fire: (g, s, owned) => roost(g, s, owned),
  },

  focusPunch: {
    name: 'Focus Punch',
    type: 'fighting',
    tags: ['punch'],
    base: stats({ damage: 70, cooldown: 0.2, knockback: 220 }),
    stacks: { grow: 'cast', max: FOCUS.charge, reset: 'hurt' },
    upgrades: [
      { damage: 18 },
      { cooldown: -0.02 },
      { fork: [{ stats: { area: 0.1, damage: 31 }, mods: ['arc'] }, { stats: { area: 0.2 }, mods: ['hunter'] }] },
      { damage: 22 },
      { cooldown: -0.02 },
      { fork: [{ stats: { damage: 26 }, mods: ['burstOnKill'] }, { stats: { damage: 4 } }] },
      { area: 0.2, damage: 22 },
    ],
    fire: (g, s, owned) => focusPunch(g, s, owned),
  },

  gyroBall: {
    name: 'Gyro Ball',
    type: 'steel',
    base: stats({ damage: 10, cooldown: 0.25, amount: 1, speed: 3.2, knockback: 70 }),
    upgrades: [
      { amount: 1 },
      { damage: 3 },
      { fork: [{ stats: { area: 0.1 }, mods: ['drain'] }, { stats: { area: 0.2 }, mods: ['vortex'] }] },
      { speed: 0.8 },
      { amount: 1 },
      { fork: [{ stats: { damage: 4 }, mods: ['burstOnKill'] }, { stats: { damage: 9 }, mods: ['execute'] }] },
      { damage: 5, area: 0.2 },
    ],
    fire: (g, s, owned) => gyroBall(g, s, owned),
  },

  suckerPunch: {
    name: 'Sucker Punch',
    type: 'dark',
    base: stats({ damage: 14, cooldown: 0.6, amount: 1, knockback: 120 }),
    upgrades: [
      { damage: 4 },
      { amount: 1 },
      { fork: [{ stats: { cooldown: -0.05 }, mods: ['drain'] }, { stats: { cooldown: -0.08 }, mods: ['arc'] }] },
      { area: 0.2 },
      { damage: 6 },
      { fork: [{ stats: { amount: 1, damage: 11 }, mods: ['execute'] }, { stats: { amount: 1 }, mods: ['burstOnKill'] }] },
      { damage: 6, cooldown: -0.08 },
    ],
    fire: (g, s, owned) => suckerPunch(g, s, owned),
  },

  futureSight: {
    name: 'Future Sight',
    type: 'psychic',
    base: stats({ damage: 42, cooldown: 5, amount: 3, knockback: 50 }),
    upgrades: [
      { damage: 10 },
      { area: 0.2 },
      { fork: [{ stats: { amount: 1 }, mods: ['vortex'] }, { stats: { amount: 1 }, mods: ['arc'] }] },
      { cooldown: -0.6 },
      { damage: 14 },
      { fork: [{ stats: { amount: 1 }, mods: ['burstOnKill'] }, { stats: { amount: 1, damage: 13 }, mods: ['hunter'] }] },
      { damage: 14, area: 0.2 },
    ],
    fire: (g, s, owned) => futureSight(g, s, owned),
  },

  bonemerang: {
    name: 'Bonemerang',
    type: 'ground',
    base: stats({ damage: 15, cooldown: 1.6, amount: 1, speed: 230, knockback: 50 }),
    upgrades: [
      { damage: 5 },
      { amount: 1 },
      { fork: [{ stats: { area: 0.15 }, mods: ['trail'] }, { stats: { area: 0.25 }, mods: ['arc'] }] },
      { cooldown: -0.2 },
      { damage: 6 },
      { fork: [{ stats: { amount: 1 }, mods: ['burstOnKill'] }, { stats: { amount: 1 }, mods: ['execute'] }] },
      { speed: 60, damage: 6 },
    ],
    fire: (g, s, owned) => bonemerang(g, s, owned),
  },

  stealthRock: {
    name: 'Stealth Rock',
    type: 'rock',
    base: stats({ damage: 12, cooldown: 8, amount: 5, duration: 20, knockback: 30 }),
    upgrades: [
      { amount: 1 },
      { damage: 4 },
      { fork: [{ stats: { duration: 3 }, mods: ['vortex'] }, { stats: { duration: 3 }, mods: ['arc'] }] },
      { area: 0.2 },
      { amount: 2 },
      { fork: [{ stats: { damage: 6 }, mods: ['burstOnKill'] }, { stats: { damage: 4 }, mods: ['hunter'] }] },
      { damage: 6, duration: 5 },
    ],
    fire: (g, s, owned) => stealthRock(g, s, owned),
  },

  uTurn: {
    name: 'U-turn',
    type: 'bug',
    base: stats({ damage: 26, cooldown: 2.6, speed: 340, knockback: 110 }),
    minCooldown: LUNGE_MIN_COOLDOWN,
    manual: true,
    upgrades: [
      { damage: 6 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.2 }, mods: ['trail'] }, { stats: { cooldown: -0.3 }, mods: ['drain'] }] },
      { damage: 8 },
      { speed: 60 },
      { fork: [{ stats: { cooldown: -0.3 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.3, damage: 25 }, mods: ['arc'] }] },
      { damage: 10, area: 0.2 },
    ],
    fire: (g, s, owned) => uTurn(g, s, owned),
  },

  dragonTail: {
    name: 'Dragon Tail',
    type: 'dragon',
    base: stats({ damage: 20, cooldown: 1.8 }),
    upgrades: [
      { damage: 6 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.15 }, mods: ['drain'] }, { stats: { cooldown: -0.2 }, mods: ['hunter'] }] },
      { damage: 7 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.2 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.2, damage: 12 }, mods: ['execute'] }] },
      { damage: 9 },
    ],
    fire: (g, s, owned) => dragonTail(g, s, owned),
  },

  sheerCold: {
    name: 'Sheer Cold',
    type: 'ice',
    base: stats({ damage: 6, cooldown: 3.5, duration: 0.5, knockback: 20 }),
    status: { kind: 'slow', chance: 1, duration: 1.2, power: 0.4 },
    // The execute share grows by level too (`SHEER_COLD_EXECUTE`).
    upgrades: [
      { damage: 2 },
      { area: 0.15 },
      { fork: [{ stats: { damage: 6 }, mods: ['cruel'] }, { stats: { damage: -1 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.4 },
      { damage: 2 },
      { fork: [{ stats: { area: 0.1 }, mods: ['echo'] }, { stats: { area: 0.2 }, mods: ['hunter'] }] },
      { cooldown: -0.4 },
    ],
    fire: (g, s, owned) => sheerCold(g, s, owned),
  },

  /* ---------- Evolved moves (max level move + paired held item, see data/evolutions.ts) ---------- */
  // Most casts live in `evolvedMoves.ts`, reached through `evolved.` at cast time: that module
  // imports combat code that leads back here, so its exports aren't ready while `MOVES` is built.

  flamethrower: {
    name: 'Flamethrower',
    type: 'fire',
    base: stats({ damage: 18, cooldown: 0.9, amount: 7, speed: 240, duration: 1.4, area: 1.3, knockback: 30 }),
    status: { kind: 'burn', chance: 0.35, duration: 2.5, power: 0.35 },
    upgrades: [
      { damage: 5, area: 0.15 },
      { amount: 2, speed: 40 },
      { duration: 0.8, statusDamage: 0.3 },
      { cooldown: -0.15, amount: 2 },
    ],
    fire: (g, s) => evolved.castFlamethrower(g, s),
  },

  fireBlast: {
    name: 'Fire Blast',
    type: 'fire',
    base: stats({ damage: 40, cooldown: 2.4, amount: 2, duration: 0.8, area: 1.2, knockback: 90 }),
    status: { kind: 'burn', chance: 0.4, duration: 3, power: 0.35 },
    upgrades: [
      { amount: 1 },
      { damage: 8, area: 0.15 },
      { duration: 0.4, statusChance: 0.15 },
      { cooldown: -0.4, damage: 8 },
    ],
    fire: (g, s) => evolved.castFireBlast(g, s),
  },

  hydroPump: {
    name: 'Hydro Pump',
    type: 'water',
    base: stats({ damage: 36, cooldown: 1, amount: 2, area: 1.2, knockback: 170 }),
    upgrades: [
      { damage: 8 },
      { area: 0.2 },
      { amount: 1 },
      { cooldown: -0.2, knockback: 60 },
    ],
    fire: (g, s) => evolved.castHydroPump(g, s),
  },

  surf: {
    name: 'Surf',
    type: 'water',
    base: stats({ damage: 24, cooldown: 1.6, amount: 2, duration: 0.9, knockback: 140 }),
    status: { kind: 'slow', chance: 1, duration: 0.8, power: 0.5 },
    upgrades: [
      { damage: 6 },
      { area: 0.2 },
      { amount: 1 },
      { cooldown: -0.25, damage: 4 },
    ],
    fire: (g, s) => evolved.castSurf(g, s),
  },

  leafStorm: {
    name: 'Leaf Storm',
    type: 'grass',
    tags: ['slice'],
    base: stats({ damage: 15, cooldown: 1.8, amount: 10, speed: 240, duration: 1.8, area: 1.2, knockback: 35 }),
    upgrades: [
      { amount: 4 },
      { damage: 6 },
      { area: 0.2, duration: 0.4 },
      { cooldown: -0.25, speed: 60 },
    ],
    fire: (g, s) => evolved.castLeafStorm(g, s),
  },

  powerWhip: {
    name: 'Power Whip',
    type: 'grass',
    base: stats({ damage: 36, cooldown: 1.3, amount: 2, area: 1.3, knockback: 130 }),
    upgrades: [
      { damage: 10 },
      { area: 0.2 },
      { amount: 1 },
      { cooldown: -0.25, knockback: 40 },
    ],
    fire: (g, s) => evolved.castPowerWhip(g, s),
  },

  triAttack: {
    name: 'Tri Attack',
    type: 'normal',
    base: stats({ damage: 22, cooldown: 1.3, amount: 3, area: 1.2, knockback: 30 }),
    // The fire beam's burn; the ice and lightning beams derive theirs from it (`TRI_ELEMENTS`).
    status: TRI_ELEMENTS[0].status,
    upgrades: [
      { damage: 6 },
      { statusChance: 0.2, area: 0.15 },
      { amount: 3 },
      { cooldown: -0.25, damage: 6 },
    ],
    fire: (g, s) => evolved.castTriAttack(g, s),
  },

  wildboltStorm: {
    name: 'Wildbolt Storm',
    type: 'electric',
    base: stats({ damage: 40, cooldown: 1.8, amount: 6, area: 1.4, knockback: 30 }),
    status: { kind: 'paralysis', chance: 0.5, duration: 2.5, power: 0 },
    upgrades: [
      { amount: 2 },
      { damage: 10 },
      { area: 0.25, statusChance: 0.15 },
      { cooldown: -0.3, amount: 2 },
    ],
    fire: (g, s) => evolved.castWildboltStorm(g, s),
  },

  gunkShot: {
    name: 'Gunk Shot',
    type: 'poison',
    base: stats({ damage: 17, cooldown: 2.4, amount: 2, duration: 2.2, area: 1.4 }),
    status: { kind: 'poison', chance: 0.7, duration: 3.5, power: 0.4 },
    upgrades: [
      { amount: 1 },
      { damage: 4, statusDamage: 0.25 },
      { duration: 0.6, area: 0.2 },
      { cooldown: -0.4, damage: 5 },
    ],
    fire: (g, s) => evolved.castGunkShot(g, s),
  },

  hurricane: {
    name: 'Hurricane',
    type: 'flying',
    base: stats({ damage: 16, cooldown: 4.5, amount: 2, speed: 1.6, duration: 4.5, knockback: 50 }),
    upgrades: [
      { damage: 5 },
      { amount: 1 },
      { area: 0.2, duration: 1 },
      { cooldown: -0.6, speed: 0.4 },
    ],
    // Funnels orbit the player and drag the foes around them in (`evolvedTick`).
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
    upgrades: [
      { damage: 10 },
      { area: 0.25 },
      { speed: 60, damage: 6 },
      { damage: 12, knockback: 60 },
    ],
    fire: (g, s) => lunge(g, s, { move: 'extremeSpeed', type: 'normal', visual: 'extremeSpeed' }, 32 * s.area),
  },

  thunderbolt: {
    name: 'Thunderbolt',
    type: 'electric',
    base: stats({ damage: 30, cooldown: 1.2, amount: 8, area: 1.3 }),
    status: { kind: 'paralysis', chance: 0.35, duration: 2, power: 0 },
    upgrades: [
      { amount: 3 },
      { damage: 8 },
      { area: 0.25, statusChance: 0.15 },
      { cooldown: -0.2, amount: 3 },
    ],
    fire: (g, s) => evolved.castThunderbolt(g, s),
  },

  barbBarrage: {
    name: 'Barb Barrage',
    type: 'poison',
    base: stats({ damage: 38, cooldown: 1.2, amount: 4, duration: 7, area: 1.4, knockback: 70 }),
    status: { kind: 'poison', chance: 0.8, duration: 3.5, power: 0.4 },
    upgrades: [
      { amount: 2 },
      { damage: 10 },
      { area: 0.2, statusDamage: 0.3 },
      { cooldown: -0.2, amount: 2 },
    ],
    fire: (g, s) => evolved.castBarbBarrage(g, s),
  },

  inferno: {
    name: 'Inferno',
    type: 'fire',
    base: stats({ damage: 22, cooldown: 4.5, amount: 3, speed: 200, duration: 8, knockback: 30 }),
    status: { kind: 'burn', chance: 0.6, duration: 3, power: 0.4 },
    upgrades: [
      { damage: 6 },
      { amount: 1 },
      { area: 0.25, duration: 2 },
      { cooldown: -1, statusChance: 0.15 },
    ],
    fire: (g, s) => evolved.castInferno(g, s),
  },

  blizzard: {
    name: 'Blizzard',
    type: 'ice',
    base: stats({ damage: 22, cooldown: 1.8, amount: 8, duration: 2.6, area: 1.3, knockback: 30 }),
    status: { kind: 'slow', chance: 1, duration: 1.5, power: 0.6 },
    upgrades: [
      { amount: 3 },
      { damage: 6 },
      { area: 0.2, duration: 1 },
      { cooldown: -0.3, amount: 2 },
    ],
    fire: (g, s) => evolved.castBlizzard(g, s),
  },

  stoneEdge: {
    name: 'Stone Edge',
    type: 'rock',
    base: stats({ damage: 34, cooldown: 1.5, amount: 3, area: 1.3, knockback: 90 }),
    upgrades: [
      { damage: 10 },
      { amount: 1 },
      { area: 0.2 },
      { cooldown: -0.3, damage: 6 },
    ],
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
      shakeScreen(g, 2)
    },
  },

  megahorn: {
    name: 'Megahorn',
    type: 'bug',
    base: stats({ damage: 42, cooldown: 1.4, amount: 2, speed: 340, area: 1.5, knockback: 140 }),
    status: { kind: 'poison', chance: 0.3, duration: 3, power: 0.3 },
    upgrades: [
      { damage: 10 },
      { amount: 1 },
      { area: 0.25, speed: 40 },
      { cooldown: -0.25, statusChance: 0.2 },
    ],
    fire: (g, s) => evolved.castMegahorn(g, s),
  },

  outrage: {
    name: 'Outrage',
    type: 'dragon',
    base: stats({ damage: 18, cooldown: 1.6, amount: 3, speed: 200, area: 1.4, knockback: 70 }),
    status: { kind: 'burn', chance: 0.3, duration: 2.5, power: 0.35 },
    upgrades: [
      { damage: 5 },
      { amount: 1 },
      { area: 0.2 },
      { cooldown: -0.25, statusChance: 0.15 },
    ],
    fire: (g, s) => evolved.castOutrage(g, s),
  },

  /* ---------- Evolved by the newer type items and generic ones (cast in typeEvolutions.ts) ---------- */

  jawLock: {
    name: 'Jaw Lock',
    type: 'dark',
    tags: ['bite'],
    base: stats({ damage: 17, cooldown: 1.5, amount: 3, area: 1.2, knockback: 40 }),
    status: { kind: 'slow', chance: 1, duration: 1, power: 0.8 },
    upgrades: [{ amount: 1 }, { damage: 8 }, { area: 0.25, cooldown: -0.15 }, { amount: 1, damage: 6 }],
    fire: (g, s) => evo.jawLock(g, s, { move: 'jawLock', type: 'dark', visual: 'jawLock' }),
  },

  superpower: {
    name: 'Superpower',
    type: 'fighting',
    tags: ['punch'],
    base: stats({ damage: 44, cooldown: 1.3, amount: 6, area: 1.3, knockback: 110 }),
    upgrades: [{ damage: 10 }, { amount: 3 }, { area: 0.2 }, { cooldown: -0.25, damage: 8 }],
    fire: (g, s) => evo.superpower(g, s, { move: 'superpower', type: 'fighting', visual: 'superFist' }),
  },

  fissure: {
    name: 'Fissure',
    type: 'ground',
    base: stats({ damage: 50, cooldown: 2.1, amount: 4, area: 1.2, duration: 0.9, knockback: 20 }),
    upgrades: [{ amount: 1 }, { damage: 12 }, { area: 0.2 }, { amount: 1, cooldown: -0.3 }],
    fire: (g, s) => evo.fissure(g, s, { move: 'fissure', type: 'ground', visual: 'fissure' }),
  },

  extrasensory: {
    name: 'Extrasensory',
    type: 'psychic',
    base: stats({ damage: 34, cooldown: 2.2, amount: 3, area: 1.2, duration: 1, knockback: 140 }),
    status: { kind: 'confuse', chance: 0.6, duration: 2.5, power: 0 },
    upgrades: [{ amount: 1 }, { damage: 10, statusChance: 0.2 }, { area: 0.2 }, { amount: 1, duration: 0.3 }],
    fire: (g, s) => evo.extrasensory(g, s, { move: 'extrasensory', type: 'psychic', visual: 'psyVortex' }),
  },

  steelBeam: {
    name: 'Steel Beam',
    type: 'steel',
    base: stats({ damage: 22, cooldown: 2.2, amount: 1, area: 1.2, duration: 0.8, knockback: 30 }),
    upgrades: [{ damage: 6 }, { amount: 1 }, { duration: 0.3, area: 0.15 }, { amount: 1, damage: 6 }],
    fire: (g, s) => evo.steelBeam(g, s, { move: 'steelBeam', type: 'steel', visual: 'steelBeam' }),
  },

  infernalParade: {
    name: 'Infernal Parade',
    type: 'ghost',
    base: stats({ damage: 14, cooldown: 2.6, amount: 6, speed: 75, duration: 3.2, area: 1.2, knockback: 12 }),
    status: { kind: 'burn', chance: 0.35, duration: 2.5, power: 0.3 },
    upgrades: [{ amount: 2 }, { damage: 5, statusChance: 0.15 }, { duration: 1, speed: 15 }, { amount: 2, damage: 4 }],
    fire: (g, s) => evo.infernalParade(g, s, { move: 'infernalParade', type: 'ghost', visual: 'parade' }),
  },

  phantomForce: {
    name: 'Phantom Force',
    type: 'ghost',
    base: stats({ damage: 36, cooldown: 1.5, amount: 5, area: 1.2, knockback: 30 }),
    status: { kind: 'slow', chance: 1, duration: 1.4, power: 0.85 },
    upgrades: [{ amount: 2 }, { damage: 10 }, { area: 0.25 }, { amount: 2, cooldown: -0.2 }],
    fire: (g, s) => evo.phantomForce(g, s, { move: 'phantomForce', type: 'ghost', visual: 'phantomArrow' }),
  },

  aquaCutter: {
    name: 'Aqua Cutter',
    type: 'water',
    tags: ['slice'],
    base: stats({ damage: 15, cooldown: 1.4, amount: 3, speed: 260, area: 1.4, knockback: 40 }),
    upgrades: [{ amount: 1 }, { damage: 7 }, { area: 0.25 }, { amount: 1, speed: 60 }],
    fire: (g, s) => evo.aquaCutter(g, s, { move: 'aquaCutter', type: 'water', visual: 'aquaCutter' }),
  },

  searingShot: {
    name: 'Searing Shot',
    type: 'fire',
    base: stats({ damage: 28, cooldown: 2, amount: 2, speed: 150, area: 1.3, knockback: 90 }),
    status: { kind: 'burn', chance: 0.5, duration: 2.5, power: 0.35 },
    upgrades: [{ amount: 1 }, { damage: 10 }, { area: 0.25, statusDamage: 0.25 }, { amount: 1, cooldown: -0.3 }],
    fire: (g, s) => evo.searingShot(g, s, { move: 'searingShot', type: 'fire', visual: 'searing' }),
  },

  gigaDrain: {
    name: 'Giga Drain',
    type: 'grass',
    tags: ['sound'],
    base: stats({ damage: 13, cooldown: 1.7, amount: 4, duration: 1.5 }),
    status: { kind: 'slow', chance: 1, duration: 0.4, power: 0.5 },
    upgrades: [{ amount: 1 }, { damage: 4 }, { duration: 0.5 }, { amount: 2, damage: 3 }],
    fire: (g, s) => evo.gigaDrain(g, s, { move: 'gigaDrain', type: 'grass', visual: 'gigaDrain' }),
  },

  burningJealousy: {
    name: 'Burning Jealousy',
    type: 'fire',
    tags: ['sound'],
    base: stats({ damage: 30, cooldown: 2.1, amount: 4, area: 1.2, knockback: 50 }),
    status: { kind: 'burn', chance: 0.8, duration: 3, power: 0.4 },
    upgrades: [{ amount: 2 }, { damage: 12 }, { area: 0.25, statusDamage: 0.25 }, { amount: 2, cooldown: -0.3 }],
    fire: (g, s) => evo.burningJealousy(g, s, { move: 'burningJealousy', type: 'fire', visual: 'jealousy' }),
  },

  trailblaze: {
    name: 'Trailblaze',
    type: 'grass',
    tags: ['slice'],
    base: stats({ damage: 24, cooldown: 1.6, amount: 2, area: 1.2, duration: 0.45, knockback: 80 }),
    upgrades: [{ damage: 8 }, { area: 0.2 }, { amount: 1 }, { cooldown: -0.25, damage: 8 }],
    fire: (g, s) => evo.trailblaze(g, s, { move: 'trailblaze', type: 'grass', visual: 'trailblaze' }),
  },

  liquidation: {
    name: 'Liquidation',
    type: 'water',
    tags: ['slice'],
    base: stats({ damage: 26, cooldown: 1.3, amount: 2, speed: 210, area: 1.3, knockback: 150 }),
    status: { kind: 'mark', chance: 0.5, duration: 4, power: 0.15 },
    upgrades: [{ amount: 1 }, { damage: 10 }, { area: 0.2, statusChance: 0.2 }, { amount: 1, cooldown: -0.2 }],
    fire: (g, s) => evo.liquidation(g, s, { move: 'liquidation', type: 'water', visual: 'liquidation' }),
  },

  alluringVoice: {
    name: 'Alluring Voice',
    type: 'fairy',
    tags: ['sound'],
    base: stats({ damage: 24, cooldown: 1.9, amount: 2, area: 1.2, duration: 0.75, knockback: 70 }),
    status: { kind: 'confuse', chance: 0.45, duration: 2.5, power: 0 },
    upgrades: [{ amount: 1 }, { damage: 8, statusChance: 0.15 }, { area: 0.2 }, { amount: 1, cooldown: -0.3 }],
    fire: (g, s) => evo.alluringVoice(g, s, { move: 'alluringVoice', type: 'fairy', visual: 'alluring' }),
  },

  /* ---------- Egg signatures, third batch (`eggMoves3.ts`) ---------- */
  ...EGG_MOVES_3,
  /* ---------- TM moves: boss discs and the Move Tutor (`tmMoves.ts`) ---------- */
  ...TM_MOVES,
  /* ---------- Shop-exclusive TMs: only the Kecleon Shop's TM shelf sells them (`shopTmMoves.ts`) ---------- */
  ...SHOP_TM_MOVES,
  /* ---------- Evolutions of the verb moves (`verbEvolutions.ts`) ---------- */
  ...VERB_EVOLVED_MOVES,
  /* ---------- Egg families' signature moves, second batch (`eggMoves2.ts`) ---------- */
  ...EGG_MOVES_2,
  /* ---------- Duo moves: two maxed moves fused into one (duoMoves.ts, recipes in duoRules.ts) ---------- */

  ...DUO_MOVES,
  /* ---------- Legendary moves (`legendaryMoves.ts`) ---------- */
  ...LEGENDARY_MOVES,
  /* ---------- Legendary moves, second batch: the trios, Mewtwo and Arceus (`legendaryMoves2.ts`) ---------- */
  ...LEGENDARY_MOVES_2,
  ...ULTRA_MOVES,
  /* ---------- Legendary moves, third batch: the path legends (`pathLegendMoves.ts`) ---------- */
  ...PATH_LEGEND_MOVES,
  /* ---------- Legendary moves, third batch: Palkia, the lake trio, the Swords of Justice, Keldeo and Hoopa (`legendaryMoves3.ts`) ---------- */
  ...LEGENDARY_MOVES_3,
  /* ---------- Smeargle's Sketch, the Kecleon Egg's signature (`sketch.ts`) ---------- */
  ...SKETCH_MOVES,
  ...SEASON_ONE_EGG_MOVES,
  ...SEASON_ONE_KIT_MOVES,
  ...GA_KIT_B_MOVES,
  ...GA_KIT_A_MOVES,
  ...REGIONAL_MOVES,
  ...ROCKET_KIT_MOVES,
  /* ---------- Ponyta's gallop batch and its evolutions (`gallopMoves.ts`) ---------- */
  ...GALLOP_MOVES,
  /* ---------- The Mega families' signatures (`gaKitMAMoves.ts`) ---------- */
  ...GA_KIT_MA_MOVES,
} as const satisfies Record<string, MoveDef>

export type MoveId = keyof typeof MOVES

/**
 * Every table `MOVES` is assembled from (and `SHOP_TM_MOVES_2`, which
 * `SHOP_TM_MOVES` spreads), by name. A spread lets a later table, or a move
 * written in `MOVES` itself, silently take over an id: `moveTables.test.ts`
 * holds that each id here is the move `MOVES` keeps. A new table goes here too.
 */
export const MOVE_TABLES: Readonly<Record<string, Readonly<Record<string, MoveDef>>>> = {
  SIGNATURE_MOVES,
  EGG_MOVES_3,
  TM_MOVES,
  SHOP_TM_MOVES,
  SHOP_TM_MOVES_2,
  VERB_EVOLVED_MOVES,
  EGG_MOVES_2,
  DUO_MOVES,
  LEGENDARY_MOVES,
  LEGENDARY_MOVES_2,
  ULTRA_MOVES,
  PATH_LEGEND_MOVES,
  LEGENDARY_MOVES_3,
  SKETCH_MOVES,
  SEASON_ONE_EGG_MOVES,
  SEASON_ONE_KIT_MOVES,
  GA_KIT_B_MOVES,
  GA_KIT_A_MOVES,
  REGIONAL_MOVES,
  ROCKET_KIT_MOVES,
  GALLOP_MOVES,
  GA_KIT_MA_MOVES,
}

export const MOVE_IDS = Object.keys(MOVES) as MoveId[]

export const maxMoveLevel = (id: MoveId) => MOVES[id].upgrades.length + 1

/** Whether the move waits for the player's press (`MoveDef.manual`). */
export const isManual = (id: MoveId) => {
  const def: MoveDef = MOVES[id]
  return def.manual === true
}

/** Whether the move is a legendary's capstone (`MoveDef.legendary`). */
export const isLegendary = (id: MoveId) => {
  const def: MoveDef = MOVES[id]
  return def.legendary === true
}

/** The fork a move's step to `level` is, or null for a plain step (and level 1). */
export const forkAt = (id: MoveId, level: number) => {
  const def: MoveDef = MOVES[id]
  const step = level >= 2 ? def.upgrades[level - 2] : undefined
  return step && 'fork' in step ? step.fork : null
}

/** The branch a path takes at step `index` (`OwnedMove.path`). */
export const branchAt = (path: number, index: number): 0 | 1 => ((path >> index) & 1 ? 1 : 0)

/** A path with the branch picked at the step to `level`. */
export const withBranch = (path: number, level: number, branch: 0 | 1) => (branch ? path | (1 << (level - 2)) : path & ~(1 << (level - 2)))

/**
 * Final stats of a move at `level`, after upgrades and player modifiers (incl.
 * type boosts). Forks follow `path` (`OwnedMove.path`); their branches' mods
 * come back in `mods`. Trade-offs never take a move below one shot, 0.35 of its size or negative damage.
 */
export const moveStats = (id: MoveId, level: number, player: PlayerStats, path = 0): CastStats => {
  const def: MoveDef = MOVES[id]
  let mods = 0
  const s = def.upgrades.slice(0, level - 1).reduce<MoveStats>((acc, step, i) => {
    const { stats: delta, mods: added }: Branch = 'fork' in step ? step.fork[branchAt(path, i)] : { stats: step }
    mods |= modBits(added)
    const next = { ...acc }
    for (const k of Object.keys(delta) as (keyof MoveStats)[]) next[k] += delta[k] ?? 0
    return next
  }, def.base)
  return {
    ...s,
    mods,
    damage: Math.max(0, s.damage) * player.might * (1 + (player.typeDamage[def.type] ?? 0) + tagBonus(def, player)),
    cooldown: Math.max(def.minCooldown ?? 0.1, s.cooldown * softCooldown(player.cooldown)),
    area: Math.max(0.35, s.area) * player.area,
    amount: Math.max(1, s.amount) + player.amount,
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

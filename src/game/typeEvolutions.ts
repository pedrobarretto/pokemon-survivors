import { dirTo, fromAngle, TAU } from '../engine/math'
import { pick, range } from '../engine/rng'
import { returnShot, sweep, throwFoe, wanderer } from './moveKit'
import type { CastStats, Look } from './moves'
import type { DamageBonus } from './kitRules'
import { enemiesInView, nearestEnemy } from './queries'
import { spawnAttack } from './spawn'
import type { Attack, Enemy, Game } from './types'
import * as dm from '../engine/dmath'
import { shakeScreen } from './effects'

/**
 * Casts of the evolved moves the seven newer type items (and a few generic
 * items) unlock: Jaw Lock, Superpower, Fissure, Extrasensory, Steel Beam,
 * Infernal Parade, Phantom Force, Aqua Cutter, Searing Shot, Giga Drain,
 * Burning Jealousy, Trailblaze, Liquidation and Alluring Voice. Each one
 * changes form against its base move; the `MOVES` entries call these, and
 * `render/typeEvolved.ts` draws them. Deterministic like every move.
 */

/** Angle to the nearest foe within `reach`, or the way the player faces. */
const aimAt = (g: Game, reach: number) => {
  const p = g.player
  const target = nearestEnemy(g, p.x, p.y, reach)
  const d = target ? dirTo(p.x, p.y, target.x, target.y) : p.facing
  return dm.atan2(d.y, d.x)
}

/** Foes in view, nearest to the player first (ties to the lower id, the same on every engine). */
const nearestInView = (g: Game, reach: number) => {
  const p = g.player
  const d = (e: Enemy) => dm.sq(e.x - p.x) + dm.sq(e.y - p.y)
  return enemiesInView(g)
    .filter((e) => d(e) < reach * reach)
    .sort((a, b) => d(a) - d(b) || a.id - b.id)
}

/* ---------------- Jaw Lock (Crunch + Black Glasses) ---------------- */

/** Bites per maw, and the beat between them (s). */
export const JAW_BITES = 3
export const JAW_BEAT = 0.16
/** The maw rises out of its shadow for this long before the first bite. */
export const JAW_RISE = 0.24
const LOCKED: readonly DamageBonus[] = [{ when: 'lowHp', mult: 1.6 }]

/**
 * A shadow maw rises under each of the nearest foes and bites it three times,
 * holding it still (heavy slow); the bites hit ×1.6 on foes under half HP.
 */
export const jawLock = (g: Game, s: CastStats, look: Look) => {
  const p = g.player
  const taken = new Set<number>()
  const life = JAW_RISE + JAW_BITES * JAW_BEAT + 0.24
  for (let i = 0; i < s.amount; i++) {
    const t = nearestEnemy(g, p.x, p.y, 150, taken)
    if (!t) return
    taken.add(t.id)
    const x = t.x
    const y = t.y - t.radius
    const r = 14 * s.area
    const lag = -i * 0.07
    spawnAttack(g, { ...look, x, y, shape: { kind: 'circle', r }, motion: { kind: 'static' }, damage: 0, ttl: life, activeFrom: Infinity, age: lag, flip: i % 2 === 1 })
    for (let b = 0; b < JAW_BITES; b++) {
      spawnAttack(g, {
        ...look, visual: 'jawBite', x, y, shape: { kind: 'circle', r }, motion: { kind: 'static' },
        damage: s.damage, knockback: b === JAW_BITES - 1 ? s.knockback : 0, status: s.status, bonus: LOCKED,
        ttl: 0.14, activeUntil: 0.05, age: lag - JAW_RISE - b * JAW_BEAT,
      })
    }
  }
}

/* ---------------- Superpower (Mach Punch + Black Belt) ---------------- */

/** How hard the blow hurls a foe (px/s at mass 1), and the share of the hit its crash deals. */
export const SUPER_THROW = 460
const SUPER_CRASH = 0.6

/**
 * One mighty blow ahead hurls every regular foe in front into the horde behind
 * it (thrown foes hurt whoever they crash into), then a barrage of `amount`
 * jabs follows up in the same cone.
 */
export const superpower = (g: Game, s: CastStats, look: Look) => {
  const p = g.player
  const angle = aimAt(g, 120)
  const d = fromAngle(angle)
  const reach = 24 * s.area
  const r = 18 * s.area
  for (const e of g.enemies) {
    if (e.dying >= 0 || e.boss) continue
    const dx = e.x - p.x
    const dy = e.y - e.radius - (p.y - 8)
    const dist = dm.hypot(dx, dy)
    // In front (within ~60° of the blow) and within its reach.
    if (dist > reach + r + e.radius || dx * d.x + dy * d.y < dist * 0.5) continue
    throwFoe(g, e, dm.atan2(dy + d.y * 30, dx + d.x * 30), SUPER_THROW * e.mass, s.damage * SUPER_CRASH, look.move)
  }
  const at = fromAngle(angle, reach)
  spawnAttack(g, {
    ...look, x: p.x + at.x, y: p.y - 8 + at.y,
    shape: { kind: 'circle', r }, motion: { kind: 'follow', ox: at.x, oy: at.y - 8 },
    damage: s.damage, knockback: s.knockback, ttl: 0.34, activeUntil: 0.08,
  })
  for (let i = 0; i < s.amount; i++) {
    const jab = fromAngle(angle + range(g.rng, -0.55, 0.55), reach * range(g.rng, 0.75, 1.15))
    spawnAttack(g, {
      ...look, visual: 'superJab', x: p.x + jab.x, y: p.y - 8 + jab.y,
      shape: { kind: 'circle', r: 10 * s.area }, motion: { kind: 'follow', ox: jab.x, oy: jab.y - 8 },
      damage: s.damage * 0.35, knockback: s.knockback * 0.3, ttl: 0.13, age: -0.2 - i * 0.055,
    })
  }
  shakeScreen(g, 2)
}

/* ---------------- Fissure (Earthquake + Soft Sand) ---------------- */

/** Chasm pieces in each crack, and the gap between them (px, scaled by area). */
export const FISSURE_PIECES = 7
export const FISSURE_GAP = 15
/** Regular foes left under this share of their HP fall in for good. */
export const FISSURE_EXECUTE = 0.2

/**
 * The ground splits in `amount` cracks running out from the player, the first
 * one toward the nearest foe. While a crack opens it drags the foes on it into
 * the chasm; whoever is left under 20% HP falls in for good.
 */
export const fissure = (g: Game, s: CastStats, look: Look) => {
  const p = g.player
  const first = aimAt(g, 200)
  for (let i = 0; i < s.amount; i++) {
    const d = fromAngle(first + (i / s.amount) * TAU)
    for (let k = 0; k < FISSURE_PIECES; k++) {
      const dist = (16 + k * FISSURE_GAP) * s.area
      spawnAttack(g, {
        ...look, x: p.x + d.x * dist, y: p.y + d.y * dist, from: { x: p.x, y: p.y },
        shape: { kind: 'circle', r: 10 * s.area }, motion: { kind: 'static' },
        damage: s.damage, knockback: s.knockback, execute: FISSURE_EXECUTE, pull: 170,
        ttl: s.duration, activeUntil: 0.3, age: -k * 0.035, flip: (i + k) % 2 === 0,
      })
    }
  }
  shakeScreen(g, 4)
  g.events.push({ kind: 'quake' })
}

/* ---------------- Extrasensory (Psyshock + Twisted Spoon) ---------------- */

/**
 * A psychic eye opens over up to `amount` foes (spread apart): for `duration`
 * it drags the crowd around into its pupil, hurting a little, then bursts,
 * confusing whoever it hits (confused foes bump and hurt each other).
 */
export const extrasensory = (g: Game, s: CastStats, look: Look) => {
  const spread = 56 * s.area
  const spots: Enemy[] = []
  for (const e of nearestInView(g, 220)) {
    if (spots.length >= s.amount) break
    if (spots.every((o) => dm.sq(o.x - e.x) + dm.sq(o.y - e.y) > spread * spread)) spots.push(e)
  }
  spots.forEach((t, i) => {
    const x = t.x
    const y = t.y - t.radius
    spawnAttack(g, {
      ...look, x, y, shape: { kind: 'circle', r: 36 * s.area }, motion: { kind: 'static' },
      damage: s.damage * 0.2, hitInterval: 0.3, pull: 150, ttl: s.duration, age: -i * 0.1,
    })
    spawnAttack(g, {
      ...look, visual: 'psyBurst', x, y, shape: { kind: 'circle', r: 32 * s.area }, motion: { kind: 'static' },
      damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.45, activeUntil: 0.06, age: -i * 0.1 - s.duration,
    })
  })
}

/* ---------------- Steel Beam (Flash Cannon + Metal Coat) ---------------- */

/** Steel Beam's length (px, scaled by area) and the arc each beam sweeps. */
export const STEEL_BEAM_LENGTH = 190
const STEEL_BEAM_ARC = 0.55

/**
 * A thick steel beam fires at the nearest foe and slowly sweeps across it for
 * `duration`, hitting everything on its line every 0.2 s; more beams fan out.
 * The last segment of each beam is its tip (`flip`), where the flare is drawn.
 */
export const steelBeam = (g: Game, s: CastStats, look: Look) => {
  const aim = aimAt(g, 300)
  for (let i = 0; i < s.amount; i++) {
    const center = aim + (i - (s.amount - 1) / 2) * 0.7
    const dir = i % 2 === 0 ? 1 : -1
    const before = g.attacks.length
    sweep(g, s, look, {
      from: center - (dir * STEEL_BEAM_ARC) / 2, arc: dir * STEEL_BEAM_ARC, time: s.duration,
      length: STEEL_BEAM_LENGTH * s.area, segments: 16, r: 8, inner: 14, hitInterval: 0.2,
    })
    const tip = g.attacks[g.attacks.length - 1]
    if (tip && g.attacks.length > before) tip.flip = true
  }
  shakeScreen(g, 2)
}

/* ---------------- Infernal Parade (Hex + Spell Tag) ---------------- */

const HAUNT: readonly DamageBonus[] = [{ when: 'afflicted', mult: 1.7 }]

/** A parade of `amount` ghost flames wanders around the player for `duration`, burning; ×1.7 on foes with a condition. */
export const infernalParade = (g: Game, s: CastStats, look: Look) => {
  for (let i = 0; i < s.amount; i++) {
    const w = wanderer(g, s, look, { r: 8, speed: s.speed, ttl: s.duration, leash: 80, turn: 4, hitInterval: 0.45 })
    w.bonus = HAUNT
    w.age = -i * 0.09
    w.flip = i % 2 === 1
  }
}

/* ---------------- Phantom Force (Spirit Shackle + Spell Tag) ---------------- */

/** Seconds a spectral arrow takes to come down after the volley. */
export const PHANTOM_DELAY = 0.5

/**
 * A volley of arrows vanishes into the sky, then one plunges onto each of the
 * nearest `amount` foes (aimed a little ahead of them), shackling them in place.
 */
export const phantomForce = (g: Game, s: CastStats, look: Look) => {
  const p = g.player
  const foes = nearestInView(g, 240).slice(0, s.amount)
  if (foes.length === 0) return
  const volley = Math.min(foes.length, 5)
  for (let i = 0; i < volley; i++) {
    const v = fromAngle(-Math.PI / 2 + (i - (volley - 1) / 2) * 0.18, 260)
    spawnAttack(g, {
      ...look, visual: 'phantomVolley', x: p.x, y: p.y - 10, shape: { kind: 'circle', r: 2 }, motion: { kind: 'linear', vx: v.x, vy: v.y },
      damage: 0, ttl: 0.3, activeFrom: Infinity, age: -i * 0.03,
    })
  }
  foes.forEach((t, i) => {
    const delay = PHANTOM_DELAY + i * 0.07
    const d = dirTo(t.x, t.y, p.x, p.y)
    const lead = Math.min(t.speed * delay * 0.6, dm.hypot(t.x - p.x, t.y - p.y) * 0.4)
    const x = t.x + d.x * lead
    const y = t.y + d.y * lead
    const r = 13 * s.area
    spawnAttack(g, { ...look, visual: 'phantomFall', x, y, shape: { kind: 'circle', r }, motion: { kind: 'static' }, damage: 0, ttl: delay, activeFrom: Infinity })
    spawnAttack(g, {
      ...look, x, y, shape: { kind: 'circle', r }, motion: { kind: 'static' },
      damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.55, activeUntil: 0.08, age: -delay, flip: i % 2 === 1,
    })
  })
}

/* ---------------- Aqua Cutter (Water Shuriken + Quick Claw) ---------------- */

/** Giant water shurikens fly out at the nearest foes and spin back to the player, cutting on both legs. */
export const aquaCutter = (g: Game, s: CastStats, look: Look) => {
  const aim = aimAt(g, 300)
  for (let i = 0; i < s.amount; i++) {
    const angle = aim + (i - (s.amount - 1) / 2) * 0.55
    const a = returnShot(g, s, look, angle, 130, 9)
    a.age = -i * 0.06
    a.hitInterval = 0.25
  }
}

/* ---------------- Searing Shot (Pyro Ball + Muscle Band) ---------------- */

/** Embers each blast throws out, and the share of the blast they deal. */
export const SEARING_EMBERS = 6
const EMBER_SHARE = 0.4
const LOB = 0.45

/** Lobs white-hot fireballs onto nearby foes; each blast sprays a ring of embers that keep burning on. */
export const searingShot = (g: Game, s: CastStats, look: Look) => {
  const p = g.player
  const nearby = nearestInView(g, 170)
  for (let i = 0; i < s.amount; i++) {
    const t = nearby.length > 0 ? pick(g.rng, nearby) : { x: p.x + p.facing.x * 90, y: p.y + p.facing.y * 90 }
    const lag = -i * 0.15
    spawnAttack(g, {
      ...look, x: t.x, y: t.y, from: { x: p.x, y: p.y - 6 },
      shape: { kind: 'circle', r: 24 * s.area }, motion: { kind: 'static' },
      damage: s.damage, knockback: s.knockback, status: s.status, ttl: LOB + 0.4, activeFrom: LOB, activeUntil: LOB + 0.1, age: lag,
    })
    for (let k = 0; k < SEARING_EMBERS; k++) {
      const v = fromAngle((k / SEARING_EMBERS) * TAU + i * 0.5, s.speed)
      spawnAttack(g, {
        ...look, visual: 'searingEmber', x: t.x, y: t.y - 4,
        shape: { kind: 'circle', r: 5 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
        damage: s.damage * EMBER_SHARE, knockback: 20, pierce: 2, status: s.status, ttl: 0.6, age: lag - LOB - 0.02,
      })
    }
  }
}

/* ---------------- Giga Drain (Drum Beating + Leftovers) ---------------- */

/** Share of Giga Drain's damage that heals (through the drain budget). */
export const GIGA_DRAIN = 0.35

/**
 * Vines latch onto the nearest `amount` foes and drink from them for
 * `duration`, healing the player; a vine whose foe faints jumps to the next.
 * The vine is drawn from the player to its hitbox (`drawDrainVines`).
 */
export const gigaDrain = (g: Game, s: CastStats, look: Look) => {
  const p = g.player
  const taken = new Set<number>()
  for (let i = 0; i < s.amount; i++) {
    const t = nearestEnemy(g, p.x, p.y, 160, taken)
    if (!t) return
    taken.add(t.id)
    spawnAttack(g, {
      ...look, x: t.x, y: t.y - t.radius, from: { x: p.x, y: p.y - 10 },
      shape: { kind: 'circle', r: 9 * s.area }, motion: { kind: 'homing', vx: 0, vy: 0, speed: 70, turn: 30, target: t },
      damage: s.damage, status: s.status, hitInterval: 0.3, drain: GIGA_DRAIN, ttl: s.duration, age: -i * 0.05,
    })
  }
}

/* ---------------- Burning Jealousy (Torch Song + Metronome) ---------------- */

const ENVY: readonly DamageBonus[] = [{ when: 'elite', mult: 1.5 }, { when: 'boss', mult: 1.5 }]
/** Seconds between the song and the first pillar. */
export const JEALOUSY_DELAY = 0.3

/**
 * A song of envy rings out, and pillars of jealous fire burst under the
 * `amount` toughest foes in view (most max HP first): ×1.5 on elites and bosses.
 */
export const burningJealousy = (g: Game, s: CastStats, look: Look) => {
  const p = g.player
  const foes = enemiesInView(g).sort((a, b) => b.maxHp - a.maxHp || a.id - b.id).slice(0, s.amount)
  if (foes.length === 0) return
  spawnAttack(g, {
    ...look, visual: 'jealousySong', x: p.x, y: p.y, shape: { kind: 'circle', r: 6 }, motion: { kind: 'follow', ox: 0, oy: -8 },
    damage: 0, ttl: 0.5, activeFrom: Infinity, grow: 220,
  })
  foes.forEach((e, i) => {
    const delay = JEALOUSY_DELAY + i * 0.08
    spawnAttack(g, {
      ...look, x: e.x, y: e.y, shape: { kind: 'circle', r: 16 * s.area }, motion: { kind: 'static' },
      damage: s.damage, knockback: s.knockback, status: s.status, bonus: ENVY,
      ttl: delay + 0.6, activeFrom: delay, activeUntil: delay + 0.1, flip: i % 2 === 1,
    })
  })
}

/* ---------------- Trailblaze (Leaf Blade + Wide Lens) ---------------- */

/** How far each giant blade sweeps around the player (rad). */
export const TRAILBLAZE_ARC = TAU * 0.7

/**
 * `amount` giant leaf blades sweep most of a circle around the player at long
 * reach, cutting everything once. The outermost segment of each is its tip (`flip`).
 */
export const trailblaze = (g: Game, s: CastStats, look: Look) => {
  const p = g.player
  const start = dm.atan2(p.facing.y, p.facing.x)
  for (let i = 0; i < s.amount; i++) {
    const before = g.attacks.length
    sweep(g, s, look, { from: start + (i / s.amount) * TAU, arc: TRAILBLAZE_ARC, time: s.duration, length: 58 * s.area, segments: 6, r: 9, inner: 16 })
    const tip = g.attacks[g.attacks.length - 1]
    if (tip && g.attacks.length > before) tip.flip = true
  }
}

/* ---------------- Liquidation (Razor Shell + King's Rock) ---------------- */

/**
 * Crashing waves surge out in `amount` directions (front and back, then a
 * triangle, a cross…), bowling foes over and lowering their guard (mark).
 */
export const liquidation = (g: Game, s: CastStats, look: Look) => {
  const p = g.player
  const aim = aimAt(g, 200)
  for (let i = 0; i < s.amount; i++) {
    const v = fromAngle(aim + (i / s.amount) * TAU, s.speed)
    spawnAttack(g, {
      ...look, x: p.x, y: p.y - 8, shape: { kind: 'circle', r: 14 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
      damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.55, grow: 22 * s.area, age: -i * 0.04,
    })
  }
}

/* ---------------- Alluring Voice (Disarming Voice + Fairy Feather) ---------------- */

/** Heart-shaped waves of song spread from the player, one after another, confusing the foes they reach. */
export const alluringVoice = (g: Game, s: CastStats, look: Look) => {
  for (let i = 0; i < s.amount; i++) {
    spawnAttack(g, {
      ...look, x: g.player.x, y: g.player.y - 6, shape: { kind: 'circle', r: 8 }, motion: { kind: 'follow', ox: 0, oy: -6 },
      damage: s.damage, knockback: s.knockback, status: s.status, ttl: s.duration, grow: (118 * s.area) / s.duration, age: -i * 0.2,
    })
  }
}

/** Cosmetic trail particles of these moves' hitboxes (`trail` in `attacks.ts`). */
export const typeEvolvedTrail = (a: Attack, emit: (colors: readonly string[], p: number, opts?: { speed?: number; gravity?: number; ttl?: number }) => void) => {
  switch (a.visual) {
    case 'parade': return emit(['#c8a0f8', '#7048c0', '#f0e0ff'], 0.6, { gravity: -40, ttl: 0.4, speed: 6 })
    case 'aquaCutter': return emit(['#a8d8f8', '#ffffff', '#4878e8'], 0.9, { gravity: 50, ttl: 0.3, speed: 30 })
    case 'searing': return a.age < a.activeFrom ? emit(['#fff8c0', '#f8d030', '#f08030'], 1, { gravity: -30, ttl: 0.3, speed: 8 }) : undefined
    case 'searingEmber': return emit(['#fff8c0', '#f8a030', '#e04018'], 0.8, { gravity: -30, ttl: 0.25, speed: 6 })
    case 'liquidation': return emit(['#ffffff', '#a8d8f8', '#4878e8'], 0.9, { gravity: 90, ttl: 0.35, speed: 40 })
    case 'phantomVolley': return emit(['#c8a0f8', '#a8f0c8'], 0.8, { ttl: 0.2, speed: 4 })
    case 'gigaDrain': return emit(['#a8f070', '#58c838', '#e0f8a0'], 0.25, { gravity: -30, ttl: 0.35, speed: 10 })
    case 'fissure': return a.age < 0.3 ? emit(['#e0c068', '#a07840', '#704820'], 0.5, { gravity: -20, ttl: 0.5, speed: 14 }) : undefined
    case 'jealousy': return a.age > a.activeFrom ? emit(['#f878c8', '#fff0f8', '#d03898'], 0.9, { gravity: -90, ttl: 0.45, speed: 12 }) : undefined
    default: return undefined
  }
}

import { dir8, dirTo, retain, TAU } from '../engine/math'
import { chance, range } from '../engine/rng'
import { BOSS_RAGE, MIN_TELEGRAPH, PHASE_SHIFT, type BossPattern, type HazardVisual } from '../data/bosses'
import { JUDGMENT_PLATE } from '../data/legendBosses'
import type { RetinueRole } from '../data/domains'
import type { EnemyId } from '../data/enemies'
import { FINALE, fleesFrom } from '../data/waves'
import {
  attackCount, attackWait, bossAway, chainChance, chainTarget, createFight, fightsInStances, hasteOf, holdFloor, leadTime, nextPhase, patternLive, patternsOf, phasesOf,
  pooledShare, shouldEnrage, statusStops, telegraph, tickStance, ultimateDue, ultimateLength, waitsOnUltimate, type BossBlast, type BossFight,
} from './bossFight'
import { ENEMIES } from '../data/enemies'
import { harmBy } from './harm'
import { hurtPlayer } from './combat'
import { abilityImmune } from './abilities'
import type { HitKind } from '../data/abilities'
import { burst, shakeScreen } from './effects'
import { blastHorde, spawnEnemy } from './enemies'
import { makeElite, makeRunner } from './horde'
import { makeSpitter } from './spitters'
import { isHeld } from './status'
import { featuresNear, groundAt } from './terrain'
import { actAs, nearestPlayer, standing } from './players'
import type { Enemy, Game, Hazard, Player } from './types'
import { HAZARD_TYPES } from './weather'
import * as dm from '../engine/dmath'
import { sleepPlayer } from './playerSleep'

type HazardInit = Pick<Hazard, 'kind' | 'visual' | 'x' | 'y' | 'r' | 'damage' | 'ttl'> & Partial<Hazard>

/** Adds an enemy hazard (boss attacks, the horde's spit, an Alpha's shockwave). */
export const spawnHazard = (g: Game, init: HazardInit) => {
  g.hazards.push({ id: g.nextId++, vx: 0, vy: 0, age: 0, armAt: 0, disarmAt: Infinity, vanishOnHit: false, leaper: -1, world: false, angle: 0, len: 0, spin: 0, pull: 0, pullReach: 0, cover: 0, phantom: 0, sleep: 0, by: null, ...init })
}

/** How long a strike keeps hurting after it lands. */
const STRIKE_WINDOW = 0.15

/**
 * A boss's attack at player `p`; what a `sleep` pattern throws puts the player it hits to sleep (Dark Void).
 * What it throws is signed with the boss (and `move`, an ultimate's name) for the end screen (`Hazard.by`).
 */
const fire = (g: Game, boss: Enemy, written: BossPattern, fight: BossFight | null, p: Player, move: string | null = null) => {
  const from = g.hazards.length
  launch(g, boss, written, fight, p)
  const by = harmBy(boss, move)
  for (let i = from; i < g.hazards.length; i++) {
    const h = g.hazards[i]!
    h.by = by
    if (written.sleep) h.sleep = written.sleep
  }
  if (written.kind === 'blast' && fight?.blast) fight.blast.by = by
}

/** Launches a boss's attack at player `p`, pressed by its fight's difficulty (`attackCount`, `telegraph`); a rift legendary in the old arena passes no fight. */
const launch = (g: Game, boss: Enemy, written: BossPattern, fight: BossFight | null, p: Player) => {
  // Judgment takes the biome's plate.
  const pattern = written.plate && 'visual' in written ? { ...written, visual: JUDGMENT_PLATE[g.biome.id] } : written
  switch (pattern.kind) {
    case 'strikes': {
      const center = pattern.target === 'player' ? p : boss
      const count = attackCount(pattern.count, fight)
      const delay = telegraph(pattern.delay, fight)
      for (let i = 0; i < count; i++) {
        // The first strike always aims at the target; the rest scatter around it, or follow the
        // player's path (`lead`, as far as the difficulty's `aim`); a single led one lands at the path's end.
        let x = center.x
        let y = center.y
        if (pattern.lead !== undefined) {
          const ahead = leadTime(pattern.lead, delay, fight) * (count > 1 ? i / (count - 1) : 1)
          x += p.vx * ahead + range(g.rng, -3, 3)
          y += p.vy * ahead + range(g.rng, -3, 3)
        } else if (i > 0) {
          const a = range(g.rng, 0, TAU)
          const d = range(g.rng, pattern.radius, pattern.spread)
          x += dm.cos(a) * d
          y += dm.sin(a) * d * 0.8
        }
        spawnHazard(g, {
          kind: 'strike',
          visual: pattern.visual,
          x,
          y,
          r: pattern.radius,
          damage: Math.max(pattern.damage, (pattern.share ?? 0) * p.stats.maxHp),
          armAt: delay,
          disarmAt: delay + STRIKE_WINDOW,
          ttl: delay + 0.45,
          leaper: pattern.leap ? boss.id : -1,
        })
      }
      return
    }
    case 'volley': {
      const count = attackCount(pattern.count, fight)
      const windup = telegraph(pattern.windup, fight)
      const aim = dm.atan2(p.y - boss.y, p.x - boss.x)
      for (let i = 0; i < count; i++) {
        const a = count > 1 ? aim - pattern.arc / 2 + (pattern.arc * i) / (count - 1) : aim
        spawnHazard(g, {
          kind: 'shot',
          visual: pattern.visual,
          x: boss.x + dm.cos(a) * boss.radius,
          y: boss.y + dm.sin(a) * boss.radius,
          vx: dm.cos(a) * pattern.speed,
          vy: dm.sin(a) * pattern.speed,
          r: pattern.radius,
          damage: pattern.damage,
          armAt: windup,
          ttl: windup + 5,
          vanishOnHit: true,
        })
      }
      return
    }
    case 'ring': {
      const offset = range(g.rng, 0, TAU)
      const count = attackCount(pattern.count, fight)
      const gap = pattern.gap ?? 0
      const open = gap > 0 ? range(g.rng, 0, TAU) : 0
      // Closing on the player from `around` px, or out of the boss.
      const around = pattern.around
      const windup = around === undefined ? 0 : telegraph(pattern.windup ?? MIN_TELEGRAPH, fight)
      const cx = around === undefined ? boss.x : p.x
      const cy = around === undefined ? boss.y : p.y
      const out = around ?? boss.radius
      const sign = around === undefined ? 1 : -1
      for (let i = 0; i < count; i++) {
        const a = offset + (i / count) * TAU
        if (gap > 0 && Math.abs(angleGap(a, open)) < gap / 2) continue
        spawnHazard(g, {
          kind: 'shot',
          visual: pattern.visual,
          x: cx + dm.cos(a) * out,
          y: cy + dm.sin(a) * out,
          vx: dm.cos(a) * pattern.speed * sign,
          vy: dm.sin(a) * pattern.speed * sign,
          r: pattern.radius,
          damage: pattern.damage,
          armAt: windup,
          ttl: around === undefined ? 5 : windup + (around * 2) / pattern.speed,
          vanishOnHit: true,
        })
      }
      return
    }
    case 'trail': {
      spawnHazard(g, {
        kind: 'zone',
        visual: pattern.visual,
        x: boss.x + range(g.rng, -3, 3),
        y: boss.y + range(g.rng, -2, 2),
        r: pattern.radius,
        damage: pattern.damage,
        armAt: 0.15,
        disarmAt: pattern.ttl - 0.3,
        ttl: pattern.ttl,
      })
      return
    }
    case 'beam':
      return fireBeams(g, boss, pattern, fight, p)
    case 'summon':
      return summon(g, boss, pattern)
    case 'dash': {
      if (!fight) return
      fight.motion = { kind: 'dash', wait: 0, left: 0, vx: 0, vy: 0, more: pattern.count, speed: pattern.speed, width: pattern.width, damage: pattern.damage, windup: telegraph(pattern.windup, fight), hit: false, reach: 0 }
      return aimDash(g, boss, fight, p)
    }
    case 'swoop': {
      if (!fight) return
      burst(g, boss.x, boss.y - boss.radius, { colors: IMPACT.dragon!.colors, count: 30, speed: 160, ttl: 0.45, size: 2 })
      fight.motion = { kind: 'dash', wait: 0, left: 0, vx: 0, vy: 0, more: pattern.count, speed: pattern.speed, width: pattern.width, damage: pattern.damage, windup: telegraph(pattern.windup, fight), hit: false, reach: pattern.reach }
      return aimDash(g, boss, fight, p)
    }
    case 'dive': {
      if (!fight) return
      const windup = telegraph(pattern.windup, fight)
      fight.motion = { kind: 'dive', left: pattern.hide + windup, lock: windup, x: boss.x, y: boss.y, windup, radius: pattern.radius, damage: pattern.damage, visual: pattern.visual }
      burst(g, boss.x, boss.y - 4, { colors: IMPACT[pattern.visual]?.colors ?? ['#ffffff'], count: 30, speed: 110, ttl: 0.5, size: 2 })
      park(boss, fight)
      return
    }
    case 'teleport': {
      if (!fight) return
      const windup = telegraph(pattern.windup, fight)
      const to = pattern.to === 'player' ? { x: p.x + p.vx * windup * 0.5, y: p.y + p.vy * windup * 0.5 } : farFrom(fight.home, p)
      burst(g, boss.x, boss.y - boss.radius, { colors: IMPACT[pattern.visual]?.colors ?? ['#ffffff'], count: 36, speed: 140, ttl: 0.45, size: 2 })
      spawnHazard(g, { kind: 'strike', visual: pattern.visual, x: to.x, y: to.y, r: pattern.radius, damage: pattern.damage, armAt: windup, disarmAt: windup + STRIKE_WINDOW, ttl: windup + 0.45, leaper: boss.id })
      fight.motion = { kind: 'away', left: windup }
      park(boss, fight)
      return
    }
    case 'blast': {
      if (!fight) return
      const windup = telegraph(pattern.windup, fight)
      const spots = pattern.safe === 'spots' ? shelters(g, pattern.spots ?? 3, p) : []
      // Co-op: every other teammate the blast reaches gets shelters of their own.
      if (pattern.safe === 'spots' && g.coop !== null) {
        for (const q of g.players) if (q !== p && standing(g, q) && inBlastReach(g, q, boss.x, boss.y)) spots.push(...shelters(g, pattern.spots ?? 3, q))
      }
      const radius = pattern.radius ?? (pattern.safe === 'spots' ? SHELTER.radius : 90)
      fight.blast = { left: windup, total: windup, x: boss.x, y: boss.y, damage: pattern.damage, safe: pattern.safe, radius, visual: pattern.visual, spots, sleep: pattern.sleep ?? 0, by: null }
      return
    }
    case 'cage': {
      const windup = telegraph(pattern.windup, fight)
      const offset = range(g.rng, 0, TAU)
      for (let i = 0; i < pattern.count; i++) {
        const a = offset + (i / pattern.count) * TAU
        spawnHazard(g, {
          kind: 'zone', visual: pattern.visual, x: p.x + dm.cos(a) * pattern.radius, y: p.y + dm.sin(a) * pattern.radius * 0.85,
          r: pattern.size, damage: pattern.damage, armAt: windup, disarmAt: pattern.ttl - 0.3, ttl: pattern.ttl,
        })
      }
      return
    }
    case 'whirlpool': {
      const center = pattern.target === 'player' ? p : boss
      const count = attackCount(pattern.count, fight)
      const windup = telegraph(pattern.windup, fight)
      for (let i = 0; i < count; i++) {
        const a = range(g.rng, 0, TAU)
        const d = i === 0 ? 0 : range(g.rng, pattern.radius * 2, pattern.spread)
        spawnHazard(g, {
          kind: 'zone', visual: pattern.visual, x: center.x + dm.cos(a) * d, y: center.y + dm.sin(a) * d * 0.8, r: pattern.radius, damage: pattern.damage,
          armAt: windup, disarmAt: windup + pattern.ttl, ttl: windup + pattern.ttl + 0.4, pull: pattern.pull, pullReach: pattern.reach,
        })
      }
      return
    }
    case 'gust': {
      const count = attackCount(pattern.count, fight)
      const windup = telegraph(pattern.windup, fight)
      const aim = dm.atan2(p.y - boss.y, p.x - boss.x)
      for (let i = 0; i < count; i++) {
        const a = count > 1 ? aim - pattern.arc / 2 + (pattern.arc * i) / (count - 1) : aim
        spawnHazard(g, {
          kind: 'shot', visual: pattern.visual, x: boss.x + dm.cos(a) * boss.radius, y: boss.y + dm.sin(a) * boss.radius,
          vx: dm.cos(a) * pattern.speed, vy: dm.sin(a) * pattern.speed, r: pattern.radius, damage: pattern.damage,
          armAt: windup, ttl: windup + 4, pull: -pattern.push, pullReach: pattern.reach,
        })
      }
      return
    }
    case 'timeStop': {
      if (!fight) return
      fight.timeStop = { wait: telegraph(pattern.windup, fight), left: pattern.duration, total: pattern.duration }
      return
    }
    case 'phantoms':
      return phantoms(g, boss, pattern, fight, p)
    case 'guard':
      return raiseGuard(g, boss, pattern, fight)
  }
}

/** Fires `phantoms`: phantoms of the boss streak one after another along marked lanes through where player `p` stands. */
const phantoms = (g: Game, boss: Enemy, pattern: Extract<BossPattern, { kind: 'phantoms' }>, fight: BossFight | null, p: Player) => {
  const count = attackCount(pattern.count, fight)
  const windup = telegraph(pattern.windup, fight)
  const offset = range(g.rng, 0, TAU)
  const aim = dm.atan2(p.y - boss.y, p.x - boss.x)
  const dex = ENEMIES[boss.kind].dex
  for (let i = 0; i < count; i++) {
    const ring = pattern.origin === 'ring'
    const around = offset + (i / count) * TAU
    const a = ring ? around + Math.PI : aim + (i - (count - 1) / 2) * 0.32
    const x = ring ? p.x + dm.cos(around) * pattern.radius : boss.x
    const y = ring ? p.y + dm.sin(around) * pattern.radius : boss.y
    const len = ring ? pattern.radius * 2 : dm.hypot(p.x - boss.x, p.y - boss.y) + pattern.radius
    const at = windup + i * pattern.gap
    spawnHazard(g, { kind: 'beam', visual: pattern.visual, x, y, r: pattern.width / 2, damage: 0, angle: a, len, armAt: at, disarmAt: at, ttl: at })
    spawnHazard(g, {
      kind: 'shot', visual: pattern.visual, x, y, vx: dm.cos(a) * pattern.speed, vy: dm.sin(a) * pattern.speed,
      r: pattern.width / 2, damage: pattern.damage, armAt: at, ttl: at + len / pattern.speed, phantom: dex,
    })
  }
}

/** Raises a `guard`: its keepers come out on their posts around the boss's home, and while one stands the boss is warded. */
const raiseGuard = (g: Game, boss: Enemy, pattern: Extract<BossPattern, { kind: 'guard' }>, fight: BossFight | null) => {
  if (!fight || fight.guards.length > 0) return
  const offset = range(g.rng, 0, TAU)
  for (let i = 0; i < pattern.count; i++) {
    const a = offset + (i / pattern.count) * TAU
    const x = fight.home.x + dm.cos(a) * pattern.radius
    const y = fight.home.y + dm.sin(a) * pattern.radius * 0.8
    const keeper = spawnEnemy(g, pattern.enemies[i % pattern.enemies.length]!, x, y, { kind: 'raid', mission: -1, x, y, aggro: 0 })
    keeper.hp = keeper.maxHp = dm.round(keeper.maxHp * pattern.hp)
    keeper.xp = 0
    fight.guards.push(keeper.id)
    burst(g, x, y - 6, { colors: ['#ffffff', '#f8b070', '#c8e0f8'], count: 18, speed: 90, ttl: 0.45 })
  }
  g.events.push({ kind: 'bossGuard', enemy: boss.kind, up: true })
}

/** Keeps a boss's barrier: its fallen keepers drop off, it's warded while one stands, and it breaks with the last. */
const keepGuard = (g: Game, e: Enemy, fight: BossFight) => {
  if (fight.guards.length === 0) return
  retain(fight.guards, (id) => g.enemies.some((k) => k.id === id && k.dying < 0))
  if (fight.guards.length > 0) {
    e.trait.ward = e.maxHp
    e.trait.wardTime = 1
    return
  }
  e.trait.ward = 0
  e.trait.wardTime = 0
  burst(g, e.x, e.y - e.radius, { colors: ['#ffffff', '#f8b070', '#c8e0f8'], count: 60, speed: 220, ttl: 0.6, size: 2 })
  shakeScreen(g, 7, e)
  g.events.push({ kind: 'bossGuard', enemy: e.kind, up: false })
}

/** A barrier's keepers leave as its phase ends: they fade out of play, with no reward. */
const dismissGuard = (g: Game, e: Enemy, fight: BossFight) => {
  for (const k of g.enemies) {
    if (!fight.guards.includes(k.id) || k.dying >= 0) continue
    k.dying = 0
    k.fled = true
    burst(g, k.x, k.y - 6, { colors: ['#ffffff', '#c8e0f8'], count: 14, speed: 80, ttl: 0.4 })
  }
  fight.guards.length = 0
  e.trait.ward = 0
  e.trait.wardTime = 0
}

/** Counts a time stop down: its wait, then the seconds it holds the player's shots. */
const updateTimeStop = (fight: BossFight, dt: number) => {
  const s = fight.timeStop
  if (!s) return
  if (s.wait > 0) s.wait -= dt
  else if ((s.left -= dt) <= 0) fight.timeStop = null
}

/** The signed angle (rad, -π..π) from `b` to `a`. */
const angleGap = (a: number, b: number) => {
  const d = (a - b) % TAU
  return d > Math.PI ? d - TAU : d < -Math.PI ? d + TAU : d
}

/** A `spots` blast's shelters: `radius` px circles `near`..`far` px around its target player, evenly spread at a random turn (always one within reach of its warning). */
export const SHELTER = { radius: 16, near: 52, far: 92 } as const

const shelters = (g: Game, count: number, p: Player) => {
  const offset = range(g.rng, 0, TAU)
  return Array.from({ length: count }, (_, i) => {
    const a = offset + (i / count) * TAU
    const d = range(g.rng, SHELTER.near, SHELTER.far)
    return { x: p.x + dm.cos(a) * d, y: p.y + dm.sin(a) * d * 0.8 }
  })
}

/** A hidden boss waits this far north of its home, out of everyone's reach, until its script lands it. */
const PARK = 8000

/** Hides a boss (a dive, a teleport): it waits far out of play until its strike lands it (`land`). */
export const park = (boss: Enemy, fight: BossFight) => {
  boss.x = fight.home.x
  boss.y = fight.home.y - PARK
  boss.kx = 0
  boss.ky = 0
}

/** Whether a boss is parked out of play (`park`). */
export const parked = (boss: Enemy) => boss.fight !== null && boss.y < boss.fight.home.y - PARK / 2

/** Whether a boss is off the arena's floor on its script: parked, or out on a swoop's pass (floors and the camera let it be). */
export const offstage = (boss: Enemy) => parked(boss) || (boss.fight?.motion?.kind === 'dash' && boss.fight.motion.reach > 0)

/** As far from the player as a teleport goes: across the boss's home from them, at most 150 px out. */
const farFrom = (home: { x: number; y: number }, p: { x: number; y: number }) => {
  const dx = home.x - p.x
  const dy = home.y - p.y
  const d = dm.hypot(dx, dy) || 1
  const out = Math.min(150, d)
  return { x: home.x + (dx / d) * out, y: home.y + (dy / d) * out }
}

/** The first scenery (as a circle a bit wider than each foot) a ray from (x, y) along (dx, dy) meets within `len` px: its distance, or `len`. */
export const rayToCover = (g: Game, x: number, y: number, dx: number, dy: number, len: number) => {
  let best = len
  for (const f of featuresNear(g, x + (dx * len) / 2, y + (dy * len) / 2, len / 2 + 40)) {
    for (const s of f.solids) {
      for (const foot of s.foot) {
        // A little wider than the foot: what stands on it shades more than its base.
        const r = Math.max(foot.rx, foot.ry) + 3
        const ox = foot.x - x
        const oy = foot.y - y
        const along = ox * dx + oy * dy
        if (along <= 0 || along - r > best) continue
        const side = ox * dy - oy * dx
        if (side * side > r * r) continue
        best = Math.min(best, Math.max(0, along - Math.sqrt(r * r - side * side)))
      }
    }
  }
  return best
}

/** Whether a body of radius `r` at (x, y) stands where a blast spares it (`BlastSafe`). */
export const safeAt = (g: Game, blast: Pick<BossBlast, 'x' | 'y' | 'safe' | 'radius' | 'spots'>, x: number, y: number, r: number) => {
  const dx = x - blast.x
  const dy = y - blast.y
  const d = dm.hypot(dx, dy)
  switch (blast.safe) {
    case 'cover':
      return d > 1 && rayToCover(g, blast.x, blast.y, dx / d, dy / d, d) < d - r * 0.5
    case 'dry':
      return groundAt(g, x, y) !== 'water'
    case 'near':
      return d <= blast.radius
    case 'far':
      return d >= blast.radius
    case 'spots':
      return blast.spots.some((s) => dm.sq(s.x - x) + dm.sq(s.y - y) <= dm.sq(blast.radius - r * 0.5))
  }
}

/** Whether player `p` stands where a blast spares them. */
export const blastSpares = (g: Game, blast: Pick<BossBlast, 'x' | 'y' | 'safe' | 'radius' | 'spots'>, p: Player) => safeAt(g, blast, p.x, p.y, p.radius)

/** Fires a beam pattern at player `p`: out of the boss (aimed, maybe sweeping or stopped by cover) or parallel lances from past the screen's edge. */
const fireBeams = (g: Game, boss: Enemy, pattern: Extract<BossPattern, { kind: 'beam' }>, fight: BossFight | null, p: Player) => {
  const count = attackCount(pattern.count, fight)
  const windup = telegraph(pattern.windup, fight)
  const timing = { armAt: windup, disarmAt: windup + pattern.duration, ttl: windup + pattern.duration + 0.25 }
  if (pattern.source === 'edge' || pattern.source === 'lattice') {
    const a = range(g.rng, 0, TAU)
    const sets = pattern.source === 'lattice' ? 2 : 1
    for (let set = 0; set < sets; set++) {
      const angle = a + set * (Math.PI / 2)
      const dx = dm.cos(angle)
      const dy = dm.sin(angle)
      const visual = set === 1 ? (pattern.cross ?? pattern.visual) : pattern.visual
      for (let i = 0; i < count; i++) {
        const off = (i - (count - 1) / 2) * pattern.spread
        spawnHazard(g, {
          kind: 'beam', visual, r: pattern.width / 2, damage: pattern.damage, angle, len: pattern.length,
          x: p.x - dx * (pattern.length / 2) - dy * off,
          y: p.y - dy * (pattern.length / 2) + dx * off,
          ...timing,
        })
      }
    }
    return
  }
  const aim = dm.atan2(p.y - boss.y, p.x - boss.x)
  const sweep = pattern.sweep ?? 0
  const turn = range(g.rng, 0, 1) < 0.5 ? -1 : 1
  for (let i = 0; i < count; i++) {
    const a = aim + (i - (count - 1) / 2) * pattern.spread - (sweep / 2) * turn
    // A blocked beam stops at the first cover in its way; a sweeping one finds it again every tick (`cover`).
    const len = pattern.blocked ? rayToCover(g, boss.x, boss.y, dm.cos(a), dm.sin(a), pattern.length) : pattern.length
    spawnHazard(g, {
      kind: 'beam', visual: pattern.visual, x: boss.x, y: boss.y - 6, r: pattern.width / 2, damage: pattern.damage, angle: a, len,
      spin: sweep === 0 ? 0 : (sweep * turn) / pattern.duration,
      cover: pattern.blocked && sweep !== 0 ? pattern.length : 0,
      ...timing,
    })
  }
}

/** Gives a domain's retinue member or a summoned add its role. */
export const joinAs = (g: Game, e: Enemy, role: RetinueRole | undefined) => {
  if (role === 'runner') makeRunner(e)
  else if (role === 'spitter') makeSpitter(e, g.rng())
  else if (role === 'elite') makeElite(e)
}

/** Brings adds in around the boss, while fewer than the pattern's `max` of its kinds stand. */
const summon = (g: Game, boss: Enemy, pattern: Extract<BossPattern, { kind: 'summon' }>) => {
  const kinds: readonly EnemyId[] = pattern.enemies
  let alive = 0
  for (const e of g.enemies) if (e.dying < 0 && !e.boss && kinds.includes(e.kind)) alive++
  const n = Math.min(pattern.count, pattern.max - alive)
  const offset = range(g.rng, 0, TAU)
  for (let i = 0; i < n; i++) {
    const a = offset + (i / Math.max(1, n)) * TAU
    const x = boss.x + dm.cos(a) * pattern.radius
    const y = boss.y + dm.sin(a) * pattern.radius * 0.8
    const add = spawnEnemy(g, kinds[i % kinds.length]!, x, y)
    joinAs(g, add, pattern.role)
    burst(g, x, y - 6, { colors: ['#ffffff', '#c8a8f8', '#7850c8'], count: 14, speed: 80, ttl: 0.4 })
  }
}

/**
 * Marks a dash's lane through where player `p` stands now (a telegraph beam
 * that never burns) and starts its windup. A swoop's pass first puts the boss
 * `reach` px from them on a random side, and its lane runs as far past them.
 */
const aimDash = (g: Game, boss: Enemy, fight: BossFight, p: Player) => {
  const m = fight.motion
  if (m?.kind !== 'dash') return
  if (m.reach > 0) {
    const side = range(g.rng, 0, TAU)
    boss.x = p.x + dm.cos(side) * m.reach
    boss.y = p.y + dm.sin(side) * m.reach
    boss.kx = 0
    boss.ky = 0
  }
  const a = dm.atan2(p.y - boss.y, p.x - boss.x)
  const len = dm.hypot(p.x - boss.x, p.y - boss.y) + (m.reach > 0 ? m.reach : 70)
  m.vx = dm.cos(a) * m.speed
  m.vy = dm.sin(a) * m.speed
  m.wait = m.windup
  m.left = len / m.speed
  m.more--
  m.hit = false
  spawnHazard(g, { kind: 'beam', visual: 'slam', x: boss.x, y: boss.y, r: m.width / 2, damage: 0, angle: a, len, armAt: m.windup, disarmAt: m.windup, ttl: m.windup })
}

/**
 * Runs a boss's scripted motion: a dash's windup and rush (hitting the first
 * player it runs into), a dive's wake (after the nearest player), a teleport's wait.
 */
const updateMotion = (g: Game, boss: Enemy, fight: BossFight, dt: number) => {
  const m = fight.motion
  if (!m) return
  if (m.kind === 'dash') {
    if (m.wait > 0) {
      m.wait -= dt
      return
    }
    boss.x += m.vx * dt
    boss.y += m.vy * dt
    m.left -= dt
    for (const p of g.players) {
      if (m.hit || !standing(g, p) || dm.sq(boss.x - p.x) + dm.sq(boss.y - p.y) >= dm.sq(boss.radius + p.radius)) continue
      m.hit = true
      const before = actAs(g, p)
      hurtPlayer(g, m.damage, boss)
      actAs(g, before)
    }
    if (g.rng() < 0.5) burst(g, boss.x, boss.y - 2, { colors: ['#ffffff', '#d8d0c0'], count: 1, speed: 30, ttl: 0.3 })
    if (m.left > 0) return
    if (m.more > 0) return aimDash(g, boss, fight, nearestPlayer(g, boss.x, boss.y))
    fight.motion = null
    // A swoop's last pass ends off the arena: the boss lands back at its home.
    if (m.reach > 0) {
      boss.x = fight.home.x
      boss.y = fight.home.y
      burst(g, boss.x, boss.y - boss.radius, { colors: IMPACT.dragon!.colors, count: 30, speed: 160, ttl: 0.45, size: 2 })
    }
    return
  }
  m.left -= dt
  if (m.kind === 'dive') {
    // The wake follows the nearest player, then stops and shows where the boss bursts out.
    if (m.left > m.lock) {
      const p = nearestPlayer(g, m.x, m.y)
      const d = dm.hypot(p.x - m.x, p.y - m.y)
      const step = Math.min(d, DIVE_WAKE * dt)
      if (d > 0) {
        m.x += ((p.x - m.x) / d) * step
        m.y += ((p.y - m.y) / d) * step
      }
    } else if (m.lock > 0) {
      spawnHazard(g, { kind: 'strike', visual: m.visual, x: m.x, y: m.y, r: m.radius, damage: m.damage, armAt: m.lock, disarmAt: m.lock + STRIKE_WINDOW, ttl: m.lock + 0.45, leaper: boss.id, by: harmBy(boss) })
      m.lock = 0
    }
  }
  if (m.left > 0) return
  // Its landing strike should have brought it back; if that strike was cleared, it comes back home.
  if (parked(boss)) {
    boss.x = m.kind === 'dive' ? m.x : fight.home.x
    boss.y = m.kind === 'dive' ? m.y : fight.home.y
  }
  fight.motion = null
}

/** How fast a dive's wake follows the player, px/s (a bit slower than they walk, so it can be outrun). */
const DIVE_WAKE = 58

/** Px past a player's screen edge a boss's blast still reaches them from. */
const BLAST_REACH = 40

/** Co-op: whether a blast from (x, y) reaches player `p`: its boss stands on their screen, or near it. A teammate far off never feels it. */
const inBlastReach = (g: Game, p: Player, x: number, y: number) =>
  x > p.screen.x - BLAST_REACH && x < p.screen.x + g.view.w + BLAST_REACH && y > p.screen.y - BLAST_REACH && y < p.screen.y + g.view.h + BLAST_REACH

/** Lands a charged blast: any player not in a safe spot is hit (in co-op, the ones it reaches: `inBlastReach`). */
const updateBlast = (g: Game, boss: Enemy, fight: BossFight, dt: number) => {
  const b = fight.blast
  if (!b) return
  b.left -= dt
  if (b.left > 0) return
  fight.blast = null
  const colors = IMPACT[b.visual]?.colors ?? ['#ffffff']
  for (const p of g.players) burst(g, p.x, p.y - 10, { colors, count: 40, speed: 200, ttl: 0.5, size: 2 })
  burst(g, boss.x, boss.y - boss.radius, { colors, count: 50, speed: 260, ttl: 0.6, size: 2 })
  shakeScreen(g, 9, 'team')
  g.flash = Math.max(g.flash, 0.35)
  g.events.push({ kind: 'quake' })
  for (const p of g.players) {
    if (!standing(g, p) || (g.coop !== null && !inBlastReach(g, p, b.x, b.y)) || blastSpares(g, b, p)) continue
    const before = actAs(g, p)
    const hp = p.hp
    hurtPlayer(g, b.damage, undefined, HAZARD_TYPES[b.visual], 'hazard', b.by)
    if (b.sleep > 0 && p.hp < hp) sleepPlayer(g, p, b.sleep)
    actAs(g, before)
  }
}

/**
 * A boss with phases fell under its next phase's threshold: it roars and holds
 * still for the phase's shift, its old attacks and scripts stop, and the new
 * patterns start. One phase at a time: a hit that skips a whole phase leaves
 * it at the top of the one it skipped.
 */
const enterPhase = (g: Game, e: Enemy, fight: BossFight, next: number) => {
  const phases = phasesOf(e.kind)!
  const phase = phases[next]!
  const after = phases[next + 1]
  // A linked pair shares one pool: each holds the HP it came in with instead.
  if (fight.link < 0 && after && e.hp < after.below * e.maxHp) e.hp = Math.ceil(after.below * e.maxHp) + 1
  // Before a rebirth (whose threshold is 0) a skipping hit still leaves a little of the phase to fight.
  if (after?.rebirth !== undefined) e.hp = Math.max(e.hp, Math.ceil(e.maxHp * REBIRTH_FLOOR))
  fight.held = e.hp
  dismissGuard(g, e, fight)
  if (offstage(e)) {
    e.x = fight.home.x
    e.y = fight.home.y
  }
  fight.phase = next
  fight.phaseAge = 0
  fight.shift = phase.shift ?? PHASE_SHIFT
  fight.ult = null
  fight.ultDone = false
  fight.ultLeft = phase.ultimate ? phase.ultimate.first + fight.shift : Infinity
  fight.motion = null
  fight.blast = null
  fight.timeStop = null
  // Reborn (`BossPhase.rebirth`): it comes back from its last HP with a share of it.
  if (phase.rebirth !== undefined) e.hp = dm.round(e.maxHp * phase.rebirth)
  e.cooldowns = phase.patterns.map((pt) => pt.every * (phase.open ?? 0.5) + fight.shift)
  // The last phase's attacks go with it.
  retain(g.hazards, (h) => h.world)
  burst(g, e.x, e.y - e.radius, { colors: ['#ffffff', '#f8e070', '#f85030'], count: 70, speed: 200, ttl: 0.7, size: 2, drag: 3 })
  shakeScreen(g, 10, e)
  g.flash = Math.max(g.flash, 0.5)
  g.events.push({ kind: 'bossPhase', enemy: e.kind, phase: next })
}

/** The least share of its HP a boss enters the phase before its rebirth with, however hard the hit that took it there. */
const REBIRTH_FLOOR = 0.12

/** Plays a phase's ultimate: announced as it begins, then its steps fire in turn at player `p`. True while it plays (the other patterns wait). */
const updateUltimate = (g: Game, e: Enemy, fight: BossFight, dt: number, p: Player) => {
  const ultimate = phasesOf(e.kind)?.[fight.phase]?.ultimate
  if (!ultimate) return false
  if (!fight.ult) {
    if (fight.motion) return false
    fight.ultLeft -= dt
    if (fight.ultLeft > 0) return false
    fight.ult = { t: 0, step: 0 }
    fight.ultDone = true
    g.events.push({ kind: 'bossUltimate', enemy: e.kind, move: ultimate.move })
    burst(g, e.x, e.y - e.radius, { colors: ['#ffffff', '#f8f0a0'], count: 40, speed: 150, ttl: 0.5, size: 2 })
  }
  const u = fight.ult
  u.t += dt
  while (u.step < ultimate.steps.length && ultimate.steps[u.step]!.at <= u.t) fire(g, e, ultimate.steps[u.step++]!.pattern, fight, p, ultimate.move)
  if (u.t < ultimateLength(ultimate.steps)) return true
  fight.ult = null
  fight.ultLeft = ultimate.every
  return false
}

/** How fast a fleeing boss glides off the screen, px/s. */
const FLEE_SPEED = 260

/**
 * A new wave's boss arrives at `at`: earlier wave bosses still around run off
 * (`fleesFrom`). They leave play at once, glide away from the nearest player in a puff
 * of dust and drop nothing; the shell toasts it.
 */
export const chaseOffBosses = (g: Game, at: number) => {
  for (const e of g.enemies) {
    if (!e.boss || e.dying >= 0 || !fleesFrom(e.kind, at)) continue
    const p = nearestPlayer(g, e.x, e.y)
    const d = dirTo(p.x, p.y, e.x, e.y)
    e.dying = 0
    e.fled = true
    e.kx = d.x * FLEE_SPEED
    e.ky = d.y * FLEE_SPEED
    e.dir = dir8(d.x, d.y)
    if (g.bossId === e.id) g.bossId = null
    burst(g, e.x, e.y - e.radius * 0.5, { colors: ['#ffffff', '#e0d8c8', '#b0a890'], count: 36, speed: 120, ttl: 0.6, size: 2, drag: 5 })
    g.events.push({ kind: 'bossFled', enemy: e.kind })
  }
}

/** The finale boss arrives: a psychic shockwave from the players blasts the horde back (`FINALE.push`). */
export const finaleEntrance = (g: Game) => {
  blastHorde(g, FINALE.push)
  for (const p of g.players) burst(g, p.x, p.y - 8, { colors: ['#f85888', '#f8b0d0', '#ffffff'], count: 90, speed: 320, ttl: 0.55, size: 2, drag: 2 })
  shakeScreen(g, 10, 'team')
}

/**
 * How far from its target player a boss attacks from (and counts as in the
 * fight, `bossInFight`). In a rift the arena bounds the fight, which is
 * bigger than a phone's screen: there it attacks from anywhere.
 */
export const bossReach = (g: Game) => (g.rift.arena ? Infinity : dm.hypot(g.view.w, g.view.h) * 0.6)

/** A wave boss under half HP enrages: a red burst, a jolt and a cue for the shell (cry, flash, toast). */
const enrage = (g: Game, e: Enemy) => {
  e.fight!.enraged = true
  burst(g, e.x, e.y - e.radius, { colors: ['#f83020', '#f8a020', '#ffffff'], count: 48, speed: 160, ttl: 0.6, size: 2, drag: 4 })
  shakeScreen(g, 6, e)
  g.events.push({ kind: 'enrage', enemy: e.kind })
}

/**
 * Ticks every boss's attack patterns. Bosses only attack once they're close
 * enough to be seen. Wave bosses also swap stance (only the live patterns count
 * down; entering a stance holds its attacks `BOSS_RAGE.open` s), unlock
 * patterns as their HP drops and, once enraged, attack sooner and sometimes
 * chain a second attack. A `far` pattern that comes due waits, ready, until
 * the player keeps away.
 */
export const updateBosses = (g: Game, tick: number) => {
  const reach = bossReach(g)
  for (const e of g.enemies) {
    if (e.dying >= 0) continue
    const phases = phasesOf(e.kind)
    if (e.fight === null && (phases || fightsInStances(e.kind))) {
      e.fight = createFight(g.rng, g.difficulty, { x: e.x, y: e.y })
      // The first phase is never entered (`enterPhase`), so its ultimate's clock starts here.
      if (phases?.[0]?.ultimate) e.fight.ultLeft = phases[0].ultimate.first
    }
    const fight = e.fight
    // A `hold` phase doesn't give way before its ultimate has played; pinned at its gate, it plays it at once.
    if (phases && fight && waitsOnUltimate(phases, fight)) {
      e.hp = Math.max(e.hp, Math.min(e.maxHp, holdFloor(phases, fight, e.maxHp)))
      fight.ultLeft = ultimateDue(phases, fight, e.hp, e.maxHp)
    }
    // A hasted phase (`BossPhase.haste`) runs the boss's whole script faster.
    const dt = tick * hasteOf(e.kind, fight)
    if (fight) fight.share = fight.link >= 0 ? pooledShare(e, g.enemies.find((k) => k.id === fight.link)) : e.hp / e.maxHp
    // Knocked out beside its partner: out of play until revived (`domainPair.ts`).
    if (fight?.down) continue
    if (phases && fight) {
      // A rebirth waits for the phase before it to open first.
      const next = fight.shift > 0 ? fight.phase : nextPhase(phases, fight.phase, e.hp, e.maxHp)
      if (next > fight.phase) enterPhase(g, e, fight, fight.phase + 1)
      fight.phaseAge += dt
      if (fight.shift > 0) {
        // Untouchable while the phase opens: it holds the HP it came in with.
        fight.shift = Math.max(0, fight.shift - dt)
        e.hp = fight.link >= 0 ? Math.max(e.hp, fight.held) : Math.max(e.hp, Math.min(e.maxHp, phases[fight.phase]!.below * e.maxHp) - 1)
        continue
      }
    }
    const patterns = patternsOf(e.kind, fight)
    if (!patterns) continue
    if (fight && fightsInStances(e.kind) && shouldEnrage(fight, e.hp, e.maxHp)) enrage(g, e)
    if (fight) {
      updateMotion(g, e, fight, dt)
      updateBlast(g, e, fight, dt)
      updateTimeStop(fight, dt)
      keepGuard(g, e, fight)
      // On the map a boss's home goes with it: its teleports and dives start from where it stands.
      if (!g.rift.arena && !fight.motion && !parked(e)) {
        fight.home.x = e.x
        fight.home.y = e.y
      }
    }
    // Stunned, asleep or frozen bosses hold their attacks (paralysis and the Poké Flute pay off here); so does one mid-script.
    // One that owes its `hold` phase the ultimate (or is playing one) shrugs the condition off for it (`statusStops`).
    const held = e.status.stun > 0 || isHeld(e.status)
    if (statusStops(phases, fight, held) || bossAway(fight)) continue
    const target = nearestPlayer(g, e.x, e.y)
    const dist = dm.hypot(e.x - target.x, e.y - target.y)
    const near = dist < reach
    // An ultimate only comes due while the boss is close enough to be seen (always, in an arena).
    if (fight && phases && (near || fight.ult) && updateUltimate(g, e, fight, dt, target)) continue
    if (held) continue
    if (fight?.motion || fight?.blast) continue
    if (e.cooldowns.length !== patterns.length) e.cooldowns = patterns.map((pt) => pt.every * 0.5)
    if (fight && tickStance(fight, dt, g.rng)) {
      patterns.forEach((pt, i) => {
        if (pt.stance === fight.stance) e.cooldowns[i] = Math.max(e.cooldowns[i]!, BOSS_RAGE.open)
      })
    }
    patterns.forEach((pattern, i) => {
      if (fight && !patternLive(pattern, fight)) return
      // A barrier is raised again only `every` s after its last keeper broke.
      if (pattern.kind === 'guard' && fight && fight.guards.length > 0) {
        e.cooldowns[i] = Math.max(e.cooldowns[i]!, pattern.every)
        return
      }
      e.cooldowns[i]! -= dt
      if (e.cooldowns[i]! > 0 || !near) return
      if (fight && pattern.far !== undefined && dist < pattern.far) {
        e.cooldowns[i] = 0
        return
      }
      fire(g, e, pattern, fight, target)
      e.cooldowns[i]! += attackWait(pattern, fight)
      if (!fight?.enraged || pattern.kind === 'trail' || !chance(g.rng, chainChance(fight))) return
      const next = chainTarget(patterns, fight, i)
      if (next >= 0) e.cooldowns[next] = Math.min(e.cooldowns[next]!, BOSS_RAGE.gap)
    })
  }
}

/** A boss lands where its `leap` strike hits, in a puff of dust at both ends; one that fell or fled meanwhile stays put. */
const land = (g: Game, h: Hazard) => {
  const boss = g.enemies.find((e) => e.id === h.leaper)
  if (!boss || boss.dying >= 0) return
  const colors = IMPACT[h.visual]?.colors ?? ['#ffffff']
  burst(g, boss.x, boss.y - boss.radius * 0.5, { colors, count: 24, speed: 110, ttl: 0.45, size: 2, drag: 5 })
  boss.x = h.x
  boss.y = h.y
  boss.kx = 0
  boss.ky = 0
  shakeScreen(g, 5, h)
}

const IMPACT: Partial<Record<HazardVisual, { colors: readonly string[]; event: 'thunder' | 'quake' }>> = {
  ice: { colors: ['#98d8f8', '#e0f8ff', '#ffffff'], event: 'quake' },
  fire: { colors: ['#f86830', '#f8c030', '#fff0a0'], event: 'quake' },
  rock: { colors: ['#b8a038', '#786028', '#e0c068'], event: 'quake' },
  slam: { colors: ['#e0c068', '#a8a878', '#ffffff'], event: 'quake' },
  thunder: { colors: ['#f8d030', '#ffffff', '#fff8a0'], event: 'thunder' },
  psychic: { colors: ['#f85888', '#f8b0d0', '#ffffff'], event: 'quake' },
  water: { colors: ['#58a8f8', '#c8e8f8', '#ffffff'], event: 'quake' },
  dragon: { colors: ['#a070f8', '#7038f8', '#f0e0ff'], event: 'quake' },
  steel: { colors: ['#c8e0f8', '#78e0f8', '#ffffff'], event: 'quake' },
  aero: { colors: ['#ffffff', '#d8e8f8', '#a8c8f8'], event: 'quake' },
  grass: { colors: ['#70d048', '#e0f8a0', '#286820'], event: 'quake' },
  shadow: { colors: ['#302040', '#7860a8', '#d8c8f8'], event: 'quake' },
  judgment: { colors: ['#fff0a0', '#f8d030', '#ffffff'], event: 'thunder' },
  mist: { colors: ['#f86078', '#f8c0c8', '#ffffff'], event: 'quake' },
  luster: { colors: ['#58a0f8', '#c0d8f8', '#ffffff'], event: 'quake' },
}

/** How far (x, y) is from a beam's line. */
export const beamDistance = (h: Pick<Hazard, 'x' | 'y' | 'angle' | 'len'>, x: number, y: number) => {
  const dx = dm.cos(h.angle)
  const dy = dm.sin(h.angle)
  const along = Math.max(0, Math.min(h.len, (x - h.x) * dx + (y - h.y) * dy))
  return dm.hypot(x - (h.x + dx * along), y - (h.y + dy * along))
}

/** What kind of harm a hazard deals, for the abilities (`abilityTakes`): a shot, a lingering patch (Magic Guard's), else a strike. */
export const hazardHit = (h: Pick<Hazard, 'kind'>): HitKind => (h.kind === 'shot' ? 'shot' : h.kind === 'zone' ? 'zone' : 'hazard')

/** Whether an armed hazard touches the acting player (`p`); Air Lock keeps the world's attacks (the weather's and the biome's) off them. */
const hazardHits = (g: Game, h: Hazard, p: Player) => {
  if (h.world && abilityImmune(g, 'weather')) return false
  if (h.kind === 'beam') return beamDistance(h, p.x, p.y - 6) < h.r + p.radius * 0.6
  const reach = h.r + p.radius * 0.7
  return dm.sq(h.x - p.x) + dm.sq(h.y - p.y) < reach * reach
}

/** How many times as fast the fight's hazards run: a hasted phase's boss (`BossPhase.haste`) speeds them all. */
const hazardHaste = (g: Game) => {
  if (g.bossId === null) return 1
  const boss = g.enemies.find((e) => e.id === g.bossId)
  return boss && boss.dying < 0 ? hasteOf(boss.kind, boss.fight) : 1
}

/** Wind on player `p`: a whirlpool draws them to its eye, a gust shoves them along its flight (`Hazard.pull`). */
const blowPlayer = (h: Hazard, p: Player, dt: number) => {
  if (p.hidden) return
  const dx = h.x - p.x
  const dy = h.y - p.y
  const d = dm.hypot(dx, dy)
  if (d > h.pullReach) return
  const speed = dm.hypot(h.vx, h.vy)
  if (h.pull < 0 && speed > 0) {
    p.x += (h.vx / speed) * -h.pull * dt
    p.y += (h.vy / speed) * -h.pull * dt
  } else if (d > 0.5) {
    // A whirlpool pulls hardest by its eye, with 40% of it at the edge of its reach.
    const step = h.pull > 0 ? Math.min(d, h.pull * (1 - (0.6 * d) / h.pullReach) * dt) : h.pull * dt
    p.x += (dx / d) * step
    p.y += (dy / d) * step
  }
}

/** Moves enemy hazards, plays impacts as telegraphs land and hurts the players they touch (a shot only the first). */
export const updateHazards = (g: Game, tick: number) => {
  const dt = tick * hazardHaste(g)
  for (const h of g.hazards) {
    const before = h.age
    h.age += dt
    // A volley's shots hover by the boss through their windup; a sweeping beam turns while it burns.
    if (h.age >= h.armAt) {
      h.x += h.vx * dt
      h.y += h.vy * dt
      if (h.age <= h.disarmAt) h.angle += h.spin * dt
    }

    const impact = IMPACT[h.visual]
    if (impact && h.kind === 'strike' && before < h.armAt && h.age >= h.armAt) {
      burst(g, h.x, h.y, { colors: impact.colors, count: dm.round(h.r * 0.8), speed: h.r * 5, ttl: 0.4 })
      shakeScreen(g, 2, h)
      g.events.push({ kind: impact.event })
    }
    if (h.leaper >= 0 && before < h.armAt && h.age >= h.armAt) land(g, h)

    if (h.age < h.armAt || h.age > h.disarmAt) continue
    if (h.cover > 0) h.len = rayToCover(g, h.x, h.y + 6, dm.cos(h.angle), dm.sin(h.angle), h.cover)
    if (h.pull !== 0) for (const p of g.players) if (standing(g, p)) blowPlayer(h, p, dt)
    if (h.damage <= 0) continue
    for (const p of g.players) {
      if (!standing(g, p)) continue
      const before = actAs(g, p)
      const hit = hazardHits(g, h, p)
      const hp = p.hp
      if (hit) hurtPlayer(g, h.damage, undefined, HAZARD_TYPES[h.visual], hazardHit(h), h.by)
      // Dark Void puts to sleep only what it really hit (not through i-frames, a guard or a burrow).
      if (hit && h.sleep > 0 && p.hp < hp) sleepPlayer(g, p, h.sleep)
      actAs(g, before)
      if (!hit || !h.vanishOnHit) continue
      h.age = h.ttl
      break
    }
  }
  retain(g.hazards, (h) => h.age < h.ttl)
}

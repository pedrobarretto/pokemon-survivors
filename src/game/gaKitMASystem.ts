import * as dm from '../engine/dmath'
import { burst, shakeScreen } from './effects'
import { atStage, babyEvery, babyShare, featherCap, feathersShed, KIT_MA, rageAt, roars, snapEvery, tunnelCaves, tunnelFinds, type GaKitMA } from './gaKitMARules'
import { hpFraction } from './kitRules'
import { recomputeStats } from './leveling'
import { dropXp } from './pickups'
import { ownAttack } from './players'
import { nearestEnemy } from './queries'
import { spawnAttack } from './spawn'
import type { Attack, Enemy, Game, Player, Visual } from './types'

/**
 * Runs the Mega families' mechanics on `Player.kitMA` (the rules and numbers
 * are `gaKitMARules.ts`). `stepMoves` calls `updateKitMA` and `damageEnemy`
 * calls `kitMAHit`; for anyone without a kit each is one check, so their runs
 * stay bit-identical.
 */

type Kit<K extends GaKitMA['kind']> = Extract<GaKitMA, { kind: K }>

/** The player's power at their level, as the abilities and the special grow: what a kit's own hits are scaled by. */
const kitPower = (p: Player, power: number) => power * p.stats.might * (1 + 0.04 * (p.level - 1))

const megaIs = (p: Player, stone: string) => p.mega.active > 0 && p.mega.stone === stone

/** How many of the acting player's hitboxes of `visual` are still alive. */
const alive = (g: Game, visual: Visual) => {
  let n = 0
  for (const a of g.attacks) if (a.visual === visual && ownAttack(g, a) && a.age < a.ttl) n++
  return n
}

/** Retires the acting player's oldest live hitbox of `visual` (the one past the cap). */
const retireOldest = (g: Game, visual: Visual) => {
  let oldest: Attack | null = null
  for (const a of g.attacks) if (a.visual === visual && ownAttack(g, a) && a.age < a.ttl && (!oldest || a.age > oldest.age)) oldest = a
  if (oldest) oldest.ttl = oldest.age
}

/* ---------------- Kangaskhan ---------------- */

/**
 * A hit of the acting player landed on `e` (`damageEnemy`, after the damage): Kangaskhan's baby hops onto the
 * same foe and punches it for its share of the hit, at most once every `babyEvery` s. Its own punches never
 * call it back.
 */
export const kitMAHit = (g: Game, attack: Attack, e: Enemy) => {
  const p = g.player
  const kit = p.kitMA
  if (kit?.kind !== 'baby' || kit.ready > 0 || attack.visual === 'maBaby' || attack.move === 'ability' || e.hp <= 0 || e.dying >= 0) return
  const B = KIT_MA.baby
  const mega = megaIs(p, 'kangaskhan')
  kit.ready = babyEvery(mega)
  spawnAttack(g, {
    move: 'cometPunch', type: 'normal', visual: 'maBaby', x: e.x, y: e.y - e.radius * 0.6, from: { x: p.x, y: p.y - 10 },
    shape: { kind: 'circle', r: mega ? B.megaR : B.r }, motion: { kind: 'static' },
    damage: Math.max(1, attack.damage * babyShare(p.level, mega)), knockback: mega ? 40 : 18, pierce: mega ? Infinity : 1,
    age: -B.hop, ttl: 0.32, activeUntil: 0.06, tier: mega ? 1 : 0, mod: null,
  })
}

/* ---------------- Pinsir ---------------- */

/** The pincers snap shut on the nearest foe in reach: a clamp, a cut for the weak ones, and Mega Pinsir's gust blade. */
const snap = (g: Game, foe: Enemy) => {
  const p = g.player
  const P = KIT_MA.pincers
  const angle = dm.atan2(foe.y - p.y, foe.x - p.x)
  const dist = Math.min(P.dist, dm.hypot(foe.x - p.x, foe.y - p.y))
  const mega = megaIs(p, 'pinsir')
  spawnAttack(g, {
    move: 'stormThrow', type: 'bug', visual: 'maSnap', x: p.x + dm.cos(angle) * dist, y: p.y - 6 + dm.sin(angle) * dist,
    shape: { kind: 'circle', r: P.r * p.stats.area }, motion: { kind: 'static' },
    damage: kitPower(p, P.power), knockback: 10, status: P.clamp, execute: P.cut, ttl: 0.24, activeUntil: 0.06, memo: angle, tier: mega ? 1 : 0, mod: null,
  })
  if (!mega) return
  const G = P.gust
  spawnAttack(g, {
    move: 'stormThrow', type: 'flying', visual: 'maGust', x: p.x, y: p.y - 10,
    shape: { kind: 'circle', r: G.r * p.stats.area }, motion: { kind: 'linear', vx: dm.cos(angle) * G.speed, vy: dm.sin(angle) * G.speed },
    damage: kitPower(p, G.power), knockback: 50, pierce: G.pierce, ttl: G.ttl, memo: angle, mod: null,
  })
}

const stepPincers = (g: Game, kit: Kit<'pincers'>, dt: number) => {
  const p = g.player
  kit.snap -= dt
  if (kit.snap > 0) return
  const foe = nearestEnemy(g, p.x, p.y, KIT_MA.pincers.reach)
  if (!foe) {
    kit.snap = 0.25
    return
  }
  kit.snap = snapEvery(megaIs(p, 'pinsir'))
  snap(g, foe)
}

/* ---------------- Skarmory ---------------- */

/** Every `gap` px walked a razor feather drops behind Skarmory, while fewer than the cap lie on the ground. */
const stepFeathers = (g: Game, kit: Kit<'feathers'>) => {
  const p = g.player
  const shed = feathersShed(kit.walked, p.walked)
  kit.walked = p.walked
  if (shed <= 0) return
  const F = KIT_MA.feathers
  const mega = megaIs(p, 'skarmory')
  if (alive(g, 'maFeather') >= featherCap(p.level, mega)) return
  const len = dm.hypot(p.facing.x, p.facing.y) || 1
  spawnAttack(g, {
    move: 'airCutter', type: 'steel', visual: 'maFeather', x: p.x - (p.facing.x / len) * 8, y: p.y + 2 - (p.facing.y / len) * 5,
    shape: { kind: 'circle', r: F.r * p.stats.area }, motion: { kind: 'static' },
    damage: kitPower(p, F.power * (mega ? F.megaPower : 1)), knockback: 8, pierce: mega ? F.megaPierce : F.pierce, status: F.slow, ttl: F.life,
    tier: mega ? 1 : 0, mod: null,
  })
}

/* ---------------- Drilbur's line ---------------- */

/** A hole in the ground at (x, y): it trips what crosses it; past the cap the oldest fills in. */
const hole = (g: Game, x: number, y: number) => {
  const p = g.player
  const D = KIT_MA.dig
  if (alive(g, 'maHole') >= atStage(D.holes, p.stage)) retireOldest(g, 'maHole')
  spawnAttack(g, {
    move: 'drillRun', type: 'ground', visual: 'maHole', x, y,
    shape: { kind: 'circle', r: atStage(D.r, p.stage) * p.stats.area }, motion: { kind: 'static' },
    damage: kitPower(p, D.tripPower), status: D.slow, hitInterval: D.trip, ttl: D.life, tier: p.stage, mod: null,
  })
  burst(g, x, y - 2, { colors: ['#a08868', '#685840', '#d0b890'], count: 10, speed: 80, ttl: 0.4, gravity: 160 })
}

/** Excadrill's tunnel from (x0, y0) to (x1, y1) caves in: a fault line of hits along it, the nearer end first. */
const collapse = (g: Game, x0: number, y0: number, x1: number, y1: number) => {
  const p = g.player
  const D = KIT_MA.dig
  const angle = dm.atan2(y1 - y0, x1 - x0)
  const piercing = megaIs(p, 'excadrill')
  for (let i = 0; i < D.segments; i++) {
    const k = (i + 0.5) / D.segments
    spawnAttack(g, {
      move: 'drillRun', type: 'ground', visual: 'maFault', x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k,
      shape: { kind: 'circle', r: D.segR * p.stats.area }, motion: { kind: 'static' },
      damage: kitPower(p, atStage(D.power, p.stage)), knockback: 70, ttl: 0.34, activeUntil: 0.08, age: -(D.collapse + (D.segments - 1 - i) * 0.035),
      memo: angle, ignoreWards: piercing, tier: i, mod: null,
    })
  }
}

/** Drill Run came up from under the ground: holes at both ends, Excadrill's tunnel caves in, and every few tunnels a find. */
const surface = (g: Game, kit: Kit<'dig'>, dive: { x: number; y: number }) => {
  const p = g.player
  hole(g, dive.x, dive.y)
  hole(g, p.x, p.y)
  const length = dm.hypot(p.x - dive.x, p.y - dive.y)
  if (tunnelCaves(p.stage, length)) collapse(g, dive.x, dive.y, p.x, p.y)
  kit.tunnels++
  if (tunnelFinds(kit.tunnels)) {
    dropXp(g, p.x, p.y - 4, KIT_MA.dig.find * p.level)
    burst(g, p.x, p.y - 8, { colors: ['#f8e070', '#ffffff', '#c0a040'], count: 14, speed: 110, ttl: 0.5, gravity: 120 })
  }
  shakeScreen(g, p.stage >= 1 ? 3 : 2)
}

/* ---------------- Drampa ---------------- */

/** Drampa roars as it falls under half its HP: a ring that throws the horde back, with a moment of i-frames. */
const roar = (g: Game) => {
  const p = g.player
  const R = KIT_MA.berserk.roar
  spawnAttack(g, {
    move: 'hyperVoice', type: 'dragon', visual: 'maRoar', x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: 10 }, motion: { kind: 'follow', ox: 0, oy: -8 }, grow: (R.r * p.stats.area - 10) / 0.24,
    damage: kitPower(p, R.power), knockback: R.knockback, ttl: 0.42, activeUntil: 0.24, mod: null,
  })
  p.iframes = Math.max(p.iframes, R.iframes)
  burst(g, p.x, p.y - 14, { colors: ['#e86858', '#f8f0e8', '#78c0f0'], count: 24, speed: 140, ttl: 0.45, size: 2 })
  shakeScreen(g, 5)
  g.events.push({ kind: 'quake' })
}

/** Berserk follows the HP each tick (stats recomputed only when the rage steps); the roar waits on its own clock. */
const stepBerserk = (g: Game, kit: Kit<'berserk'>, dt: number) => {
  const p = g.player
  const share = hpFraction(p)
  const mega = megaIs(p, 'drampa')
  kit.roar = Math.max(0, kit.roar - dt)
  if (roars(kit.above, share, kit.roar)) {
    const R = KIT_MA.berserk.roar
    kit.roar = mega ? R.megaCooldown : R.cooldown
    roar(g)
  }
  kit.above = share >= KIT_MA.berserk.roar.at
  const rage = rageAt(share, mega)
  if (rage === kit.rage) return
  kit.rage = rage
  recomputeStats(g)
}

/** Per tick, for the acting player: the baby's pace, the pincers' rhythm, the feathers, the tunnels and the rage. */
export const updateKitMA = (g: Game, dt: number) => {
  const p = g.player
  const kit = p.kitMA
  if (!kit) return
  switch (kit.kind) {
    case 'baby':
      kit.ready = Math.max(0, kit.ready - dt)
      return
    case 'pincers': return stepPincers(g, kit, dt)
    case 'feathers': return stepFeathers(g, kit)
    case 'dig': {
      const dive = kit.dive
      if (!dive || p.hidden?.move === 'drillRun') return
      kit.dive = null
      return surface(g, kit, dive)
    }
    case 'berserk': return stepBerserk(g, kit, dt)
  }
}

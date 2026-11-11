import { TAU } from '../engine/math'
import * as dm from '../engine/dmath'
import { healPlayer } from './combat'
import { burst, floatText, shakeScreen } from './effects'
import { atStage, eggHeal, eggTaken, faded, galeOn, jetsReady, KIT_B, majestyStops, stackUp, type GaKitB } from './gaKitBRules'
import { wardOpens } from './kitRules'
import { recomputeStats } from './leveling'
import { stampWard, wardHolder } from './moveKit'
import { inPlay } from './players'
import { nearestEnemy } from './queries'
import { spawnAttack } from './spawn'
import { applyStatus } from './status'
import type { DamageSource, Enemy, Game, Player } from './types'

/**
 * Runs the second batch's family mechanics on `Player.kitB` (the rules and
 * numbers are `gaKitBRules.ts`). `stepMoves` calls `updateKitB`, and
 * `hurtPlayer`/`killEnemy` the small hooks below; for anyone without a kit
 * each is one check, so their runs stay bit-identical.
 */

type Kit<K extends GaKitB['kind']> = Extract<GaKitB, { kind: K }>

/** The player's power at their level, as the abilities and the special grow: what a kit's own hits are scaled by. */
const kitPower = (p: Player, power: number) => power * p.stats.might * (1 + 0.04 * (p.level - 1))

const flare = (g: Game, colors: readonly string[], count = 22) => {
  const p = g.player
  burst(g, p.x, p.y - 14, { colors: [...colors, '#ffffff'], count, speed: 120, ttl: 0.45, size: 2 })
  g.events.push({ kind: 'guard' })
}

/** Onix's body: the path walked, newest first, as x, y pairs; enough of it for every segment. */
const trackPath = (p: Player, kit: Kit<'serpent'>) => {
  const S = KIT_B.serpent
  if (kit.path.length > 0 && p.walked - kit.walked < S.step) return
  kit.walked = p.walked
  kit.path.unshift(p.x, p.y)
  const keep = Math.ceil((S.lead + atStage(S.segments, 1) * S.spacing) / S.step) + 2
  if (kit.path.length > keep * 2) kit.path.length = keep * 2
}

/** Where segment `i` (1 = the one behind the head) of Onix's body lies on its path, or null while the body is still coiled. */
export const segmentAt = (kit: Kit<'serpent'>, i: number) => {
  const k = dm.round((KIT_B.serpent.lead + i * KIT_B.serpent.spacing) / KIT_B.serpent.step) * 2
  return k + 1 < kit.path.length ? { x: kit.path[k]!, y: kit.path[k + 1]! } : null
}

/** Every `every` s each segment of the body hits what it lies on. */
const serpentBites = (g: Game, kit: Kit<'serpent'>, dt: number) => {
  const p = g.player
  const S = KIT_B.serpent
  kit.hit -= dt
  if (kit.hit > 0) return
  kit.hit += S.every
  const steel = p.stage >= 1
  for (let i = 1; i <= atStage(S.segments, p.stage); i++) {
    const at = segmentAt(kit, i)
    if (!at) break
    spawnAttack(g, {
      move: 'ironTail', type: steel ? 'steel' : 'rock', visual: 'kitBHit', x: at.x, y: at.y - 6,
      shape: { kind: 'circle', r: atStage(S.r, p.stage) * p.stats.area }, motion: { kind: 'static' },
      damage: kitPower(p, atStage(S.power, p.stage)), knockback: atStage(S.knockback, p.stage), ttl: 0.1, mod: null,
    })
  }
}

/** Happiny's eggs: one laid every few seconds; whoever on the team walks over one is healed. */
const stepEggs = (g: Game, kit: Kit<'eggs'>, dt: number) => {
  const p = g.player
  const E = KIT_B.eggs
  kit.next -= dt
  if (kit.next <= 0) {
    kit.next += atStage(E.every, p.stage)
    if (kit.eggs.length < E.max) {
      const angle = g.rng() * TAU
      const dist = E.drop[0] + g.rng() * (E.drop[1] - E.drop[0])
      kit.eggs.push({ x: p.x + dm.cos(angle) * dist, y: p.y + dm.sin(angle) * dist * 0.7, left: E.life })
      burst(g, p.x, p.y - 8, { colors: ['#f8f0e0', '#f0b0c0'], count: 6, speed: 50, ttl: 0.35 })
    }
  }
  if (kit.eggs.length === 0) return
  const layer = g.player
  for (const egg of kit.eggs) {
    egg.left -= dt
    for (const q of g.players) {
      if (egg.left <= 0 || !inPlay(q) || q.hp >= q.stats.maxHp || !eggTaken(egg.x, egg.y, q.x, q.y, q.radius)) continue
      g.player = q
      const healed = healPlayer(g, eggHeal(q.stats.maxHp, layer.stage), layer)
      g.player = layer
      egg.left = 0
      if (healed > 0) floatText(g, q.x, q.y - 28, `+${dm.round(healed)}`, '#68e868', true)
      burst(g, egg.x, egg.y - 4, { colors: ['#ffffff', '#f8e0e8', '#f0b0c0'], count: 10, speed: 70, ttl: 0.4 })
      g.events.push({ kind: 'heal' })
    }
  }
  if (kit.eggs.some((egg) => egg.left <= 0)) kit.eggs = kit.eggs.filter((egg) => egg.left > 0)
}

/** Golurk lands from its arm jets: a slam around it. */
const jetsLand = (g: Game) => {
  const p = g.player
  const J = KIT_B.jets
  spawnAttack(g, {
    move: 'shadowPunch', type: 'ground', visual: 'kitBSlam', x: p.x, y: p.y - 4,
    shape: { kind: 'circle', r: 8 }, motion: { kind: 'static' }, grow: (atStage(J.r, p.stage) * p.stats.area - 8) / 0.18,
    damage: kitPower(p, atStage(J.power, p.stage)), knockback: J.knockback, ttl: 0.36, activeUntil: 0.18, mod: null,
  })
  shakeScreen(g, p.stage >= 1 ? 6 : 3)
  g.events.push({ kind: 'quake' })
}

/** The arm jets: recharge on a fixed clock, take off with a foe near (Golett hops, Golurk flies), land with a slam. */
const stepJets = (g: Game, kit: Kit<'jets'>, dt: number) => {
  const p = g.player
  const J = KIT_B.jets
  if (kit.air > 0) {
    kit.air -= dt
    if (kit.air > 0) return
    kit.air = 0
    kit.charge = J.cooldown
    recomputeStats(g)
    return jetsLand(g)
  }
  kit.charge = Math.max(0, kit.charge - dt)
  if (!jetsReady(kit.charge, kit.air, nearestEnemy(g, p.x, p.y, J.near) !== null)) return
  // Aloft is an immunity window: it waits while another move's is open (`wardOpens`).
  if (!wardOpens(p.ward, wardHolder(p), 'shadowPunch', g.now)) return
  stampWard(p, 'shadowPunch', g.now)
  kit.air = kit.total = atStage(J.air, p.stage)
  p.iframes = Math.max(p.iframes, kit.air + 0.1)
  recomputeStats(g)
  flare(g, ['#f8a030', '#58a0a0'], 18)
}

/** Topsy-Turvy: a ring that turns the foes it touches around. */
const topsyTurvy = (g: Game) => {
  const p = g.player
  const T = KIT_B.topsy
  const r = atStage(T.r, p.stage) * p.stats.area
  spawnAttack(g, {
    move: 'psychoCut', type: 'dark', visual: 'kitBRing', x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: 6 }, motion: { kind: 'static' }, grow: (r - 6) / 0.3,
    damage: kitPower(p, atStage(T.power, p.stage)), knockback: 0, ttl: 0.4, activeUntil: 0.3, mod: null,
    status: { kind: 'confuse', chance: 1, duration: atStage(T.confuse, p.stage), power: 0 },
  })
}

/** Skorupi's tail: grabs the nearest regular foe in reach, drags it in, holds it and poisons it. */
const tailGrab = (g: Game, kit: Kit<'pin'>) => {
  const p = g.player
  const P = KIT_B.pin
  const reach = atStage(P.reach, p.stage)
  let best: Enemy | null = null
  let bestD = reach * reach
  for (const e of g.enemies) {
    if (e.boss || e.dying >= 0 || e.behavior.kind === 'avatar') continue
    const d = dm.sq(e.x - p.x) + dm.sq(e.y - p.y)
    if (d >= bestD) continue
    bestD = d
    best = e
  }
  if (!best) return false
  const dist = Math.max(1, dm.hypot(best.x - p.x, best.y - p.y))
  best.kx -= ((best.x - p.x) / dist) * (P.pull / best.mass)
  best.ky -= ((best.y - p.y) / dist) * (P.pull / best.mass)
  applyStatus(best.status, { kind: 'paralysis', chance: 1, duration: atStage(P.hold, p.stage), power: 0 }, 0, false, 'poisonFang', p.slot)
  const bite = spawnAttack(g, {
    move: 'poisonFang', type: 'poison', visual: 'kitBHit', x: best.x, y: best.y - best.radius,
    shape: { kind: 'circle', r: best.radius + 2 }, motion: { kind: 'static' },
    damage: kitPower(p, atStage(P.power, p.stage)), status: P.poison, ttl: 0.08, mod: null,
  })
  bite.from = { x: p.x, y: p.y - 10 }
  kit.grab = { x: best.x, y: best.y - best.radius, left: P.show }
  return true
}

/** Snow Warning: the snowfall around Snover's line chills and chips what stands in it. */
const snowfall = (g: Game, kit: Kit<'snowfall'>, dt: number) => {
  const p = g.player
  const S = KIT_B.snowfall
  kit.pulse -= dt
  if (kit.pulse > 0) return
  kit.pulse += S.every
  spawnAttack(g, {
    move: 'icePunch', type: 'ice', visual: 'kitBHit', x: p.x, y: p.y - 4,
    shape: { kind: 'circle', r: atStage(S.r, p.stage) * p.stats.area }, motion: { kind: 'follow', ox: 0, oy: -4 },
    damage: kitPower(p, atStage(S.power, p.stage)), status: S.slow, ttl: 0.1, mod: null,
  })
}

/** Queenly Majesty: an enemy shot entering the ring breaks, one every few tenths of a second. */
const majesty = (g: Game, kit: Kit<'majesty'>, dt: number) => {
  const p = g.player
  kit.ready = Math.max(0, kit.ready - dt)
  if (!majestyStops(kit.ready)) return
  const r = atStage(KIT_B.majesty.r, p.stage)
  for (const h of g.hazards) {
    if (h.kind !== 'shot' || h.age < h.armAt || h.phantom > 0) continue
    if (dm.sq(h.x - p.x) + dm.sq(h.y - 6 - (p.y - 8)) > dm.sq(r + h.r)) continue
    h.ttl = h.age
    kit.ready = atStage(KIT_B.majesty.every, p.stage)
    burst(g, h.x, h.y - 6, { colors: ['#ffffff', '#f8d870', '#e86878'], count: 10, speed: 90, ttl: 0.3 })
    return
  }
}

/** Per tick, for the acting player: paths, eggs, jets, rings, grabs and the snowfall act; stacks fade and Gale Wings follows the HP. */
export const updateKitB = (g: Game, dt: number) => {
  const p = g.player
  const kit = p.kitB
  if (!kit) return
  switch (kit.kind) {
    case 'serpent':
      trackPath(p, kit)
      return serpentBites(g, kit, dt)
    case 'eggs': return stepEggs(g, kit, dt)
    case 'gale': {
      const on = galeOn(p.hp, p.stats.maxHp)
      if (on === kit.on) return
      kit.on = on
      recomputeStats(g)
      if (on) flare(g, ['#f8f0f0', '#e05838'], 12)
      return
    }
    case 'jets': return stepJets(g, kit, dt)
    case 'salt': {
      const next = faded(kit.layers, g.now - kit.last, dt, KIT_B.salt.hold, KIT_B.salt.decayEvery)
      if (next === kit.layers) return
      kit.layers = next
      return recomputeStats(g)
    }
    case 'topsy':
      kit.next -= dt
      if (kit.next > 0) return
      kit.next += atStage(KIT_B.topsy.every, p.stage)
      return topsyTurvy(g)
    case 'pin':
      if (kit.grab) {
        kit.grab.left -= dt
        if (kit.grab.left <= 0) kit.grab = null
      }
      kit.next -= dt
      if (kit.next > 0) return
      kit.next = tailGrab(g, kit) ? atStage(KIT_B.pin.every, p.stage) : 0.5
      return
    case 'snowfall': return snowfall(g, kit, dt)
    case 'bubble':
      kit.down = Math.max(0, kit.down - dt)
      return
    case 'stamina': {
      const next = faded(kit.stacks, g.now - kit.last, dt, KIT_B.stamina.hold, KIT_B.stamina.decayEvery)
      if (next === kit.stacks) return
      kit.stacks = next
      return recomputeStats(g)
    }
    case 'majesty': return majesty(g, kit, dt)
    default:
  }
}

/** A hit landed on the acting player (HP already taken): Stamina stacks. Gale Wings drops on the next tick. */
export const kitBHurt = (g: Game) => {
  const p = g.player
  const kit = p.kitB
  if (kit?.kind !== 'stamina' || p.hp <= 0) return
  kit.last = g.now
  const next = stackUp(kit.stacks, atStage(KIT_B.stamina.cap, p.stage))
  if (next === kit.stacks) return
  kit.stacks = next
  recomputeStats(g)
}

/** Water Bubble takes this hit and pops in a splash, unless another move's immunity window is too fresh (`wardOpens`). */
export const kitBBlocks = (g: Game) => {
  const p = g.player
  const kit = p.kitB
  if (kit?.kind !== 'bubble' || kit.down > 0 || !wardOpens(p.ward, wardHolder(p), 'lunge', g.now)) return false
  const B = KIT_B.bubble
  stampWard(p, 'lunge', g.now)
  kit.down = atStage(B.cooldown, p.stage)
  p.iframes = Math.max(p.iframes, B.iframes)
  spawnAttack(g, {
    move: 'lunge', type: 'water', visual: 'kitBSplash', x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: 8 }, motion: { kind: 'static' }, grow: (atStage(B.r, p.stage) * p.stats.area - 8) / 0.2,
    damage: kitPower(p, atStage(B.power, p.stage)), knockback: 90, ttl: 0.34, activeUntil: 0.2, mod: null,
  })
  flare(g, ['#90c0d8', '#d8f0f8'], 26)
  return true
}

/** A foe fell to the acting player: Salt Cure's kills lay on a salt layer. */
export const kitBKill = (g: Game, source: DamageSource | null | undefined) => {
  const p = g.player
  const kit = p.kitB
  if (kit?.kind !== 'salt' || source !== 'saltCure') return
  kit.last = g.now
  const next = stackUp(kit.layers, atStage(KIT_B.salt.cap, p.stage))
  if (next === kit.layers) return
  kit.layers = next
  recomputeStats(g)
  burst(g, p.x, p.y - 10, { colors: ['#ffffff', '#e8e0d8', '#c8b8a8'], count: 8, speed: 60, ttl: 0.35 })
}

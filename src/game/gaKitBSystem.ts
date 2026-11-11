import { TAU } from '../engine/math'
import * as dm from '../engine/dmath'
import { healPlayer } from './combat'
import { burst, floatText, shakeScreen } from './effects'
import { atStage, diveReady, eggHeal, eggTaken, eruptPower, faded, galeOn, jetsReady, KIT_B, majestyStops, stackUp, stepSerpent, type GaKitB, type Held } from './gaKitBRules'
import { wardOpens } from './kitRules'
import { recomputeStats } from './leveling'
import { burrow, stampWard, throwFoe, wardHolder } from './moveKit'
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

/** Onix's body: still time from the walk, then the chain steps behind the head (`stepSerpent`). */
const moveSerpent = (p: Player, kit: Kit<'serpent'>, dt: number) => {
  kit.still = p.walked === kit.walked ? kit.still + dt : 0
  kit.walked = p.walked
  stepSerpent(kit, p.x, p.y, p.facing.x, p.facing.y, p.stage, dt)
}

/** Where segment `i` (0 = the one behind the head) of Onix's body lies. */
export const segmentAt = (kit: Kit<'serpent'>, i: number) =>
  i * 2 + 1 < kit.segs.length ? { x: kit.segs[i * 2]!, y: kit.segs[i * 2 + 1]! } : null

/** Every `every` s each segment of the body hits what it lies on. */
const serpentBites = (g: Game, kit: Kit<'serpent'>, dt: number) => {
  const p = g.player
  const S = KIT_B.serpent
  kit.hit -= dt
  if (kit.hit > 0) return
  kit.hit += S.every
  const steel = p.stage >= 1
  for (let i = 0; i < atStage(S.segments, p.stage); i++) {
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

/** Sandile bursts up from the sand: a ring of sand under it that tosses what stands there, harder with Moxie. */
const erupt = (g: Game, kit: Kit<'burrow'>) => {
  const p = g.player
  const B = KIT_B.burrow
  const r = atStage(B.r, p.stage) * p.stats.area
  spawnAttack(g, {
    move: 'powerTrip', type: 'ground', visual: 'kitBErupt', x: p.x, y: p.y - 4,
    shape: { kind: 'circle', r: 10 }, motion: { kind: 'static' }, grow: (r - 10) / 0.16,
    damage: kitPower(p, eruptPower(p.stage, kit.stacks)), knockback: B.knockback, ttl: 0.42, activeUntil: 0.16, tier: kit.stacks, mod: null,
  })
  p.iframes = Math.max(p.iframes, B.iframes)
  burst(g, p.x, p.y - 6, { colors: ['#f0dca8', '#d8b878', '#b08850'], count: 30, speed: 150, ttl: 0.5, size: 2 })
  shakeScreen(g, p.stage >= 2 ? 5 : 3)
  g.events.push({ kind: 'quake' })
}

/** Sand Tomb's dive: on a fixed clock, a foe closing in sends Sandile under; surfacing erupts. Moxie fades between KOs. */
const stepBurrow = (g: Game, kit: Kit<'burrow'>, dt: number) => {
  const p = g.player
  const B = KIT_B.burrow
  const moxie = faded(kit.stacks, g.now - kit.last, dt, B.moxie.hold, B.moxie.decayEvery)
  if (moxie !== kit.stacks) {
    kit.stacks = moxie
    recomputeStats(g)
  }
  if (kit.under) {
    if (p.hidden?.move === 'powerTrip') return
    kit.under = false
    kit.charge = atStage(B.cooldown, p.stage)
    recomputeStats(g)
    return erupt(g, kit)
  }
  kit.charge = Math.max(0, kit.charge - dt)
  if (kit.charge > 0) return
  const foe = nearestEnemy(g, p.x, p.y, B.near)
  if (!foe || !diveReady(kit.charge, kit.under, dm.hypot(foe.x - p.x, foe.y - p.y))) return
  // Under the sand is an immunity window: it waits while another move's is open (`burrow` asks `wardOpens`).
  if (!burrow(g, 'powerTrip', atStage(B.under, p.stage))) return
  kit.under = true
  recomputeStats(g)
  burst(g, p.x, p.y - 4, { colors: ['#f0dca8', '#d8b878', '#b08850'], count: 16, speed: 90, ttl: 0.4 })
}

const enemyById = (g: Game, id: number) => {
  for (const e of g.enemies) if (e.id === id) return e.dying >= 0 ? null : e
  return null
}

/** The bear hug's grab: the toughest regular foe in reach (the heaviest thing to throw), held still in the arms. */
const hugGrab = (g: Game, kit: Kit<'hug'>) => {
  const p = g.player
  const H = KIT_B.hug
  const reach = dm.sq(atStage(H.reach, p.stage))
  let best: Enemy | null = null
  for (const e of g.enemies) {
    if (e.boss || e.dying >= 0 || e.thrown || e.behavior.kind === 'avatar') continue
    if (dm.sq(e.x - p.x) + dm.sq(e.y - p.y) > reach || (best && e.hp <= best.hp)) continue
    best = e
  }
  if (!best) return false
  const carry = atStage(H.carry, p.stage)
  applyStatus(best.status, { kind: 'paralysis', chance: 1, duration: carry + H.hurl.flight, power: 0 }, 0, false, 'hammerArm', p.slot)
  kit.held = { id: best.id, left: carry }
  burst(g, best.x, best.y - best.radius, { colors: ['#f8a8b8', '#ffffff'], count: 8, speed: 60, ttl: 0.3 })
  return true
}

/** Where a held foe rides: in the arms, just ahead of the bear. */
const armsOf = (p: Player, e: Enemy) => {
  const len = dm.hypot(p.facing.x, p.facing.y) || 1
  const reach = p.radius + e.radius * 0.5 + 8
  return { x: p.x + (p.facing.x / len) * reach, y: p.y + (p.facing.y / len) * reach * 0.6 + 1 }
}

/** Hurls the held foe at the nearest other foe in range (else ahead): it flies, crashing through whoever it meets. */
const hurl = (g: Game, kit: Kit<'hug'>, e: Enemy) => {
  const p = g.player
  const H = KIT_B.hug.hurl
  const target = nearestEnemy(g, e.x, e.y, H.aim, new Set([e.id]))
  const angle = target ? dm.atan2(target.y - e.y, target.x - e.x) : dm.atan2(p.facing.y, p.facing.x)
  const power = kitPower(p, atStage(H.power, p.stage))
  throwFoe(g, e, angle, atStage(H.force, p.stage) * e.mass, power, 'hammerArm')
  spawnAttack(g, {
    move: 'hammerArm', type: 'fighting', visual: 'kitBHit', x: e.x, y: e.y - e.radius,
    shape: { kind: 'circle', r: e.radius + 2 }, motion: { kind: 'static' }, damage: power, ttl: 0.08, mod: null,
  })
  kit.flying = { id: e.id, left: H.flight }
  g.events.push({ kind: 'cast', move: 'hammerArm' })
}

/** The thrown foe lands: a slam around it. */
const hugLand = (g: Game, e: Enemy) => {
  const p = g.player
  const H = KIT_B.hug.hurl
  const r = atStage(H.r, p.stage) * p.stats.area
  spawnAttack(g, {
    move: 'hammerArm', type: 'fighting', visual: 'kitBHug', x: e.x, y: e.y - 2,
    shape: { kind: 'circle', r: 8 }, motion: { kind: 'static' }, grow: (r - 8) / 0.16,
    damage: kitPower(p, atStage(H.slam, p.stage)), knockback: H.knockback, ttl: 0.36, activeUntil: 0.16, mod: null,
  })
  shakeScreen(g, p.stage >= 1 ? 5 : 3)
  g.events.push({ kind: 'quake' })
}

/** The bear hug's cycle: grab on a clock, carry, hurl, land. */
const stepHug = (g: Game, kit: Kit<'hug'>, dt: number) => {
  const p = g.player
  const H = KIT_B.hug
  if (kit.flying) {
    const flying: Held = kit.flying
    flying.left -= dt
    if (flying.left > 0) return
    kit.flying = null
    const e = enemyById(g, flying.id)
    if (e) hugLand(g, e)
    return
  }
  if (kit.held) {
    const held: Held = kit.held
    const e = enemyById(g, held.id)
    if (!e) {
      // It fell in the arms (another move finished it): reach for the next one at once.
      kit.held = null
      kit.next = 0.4
      return
    }
    const at = armsOf(p, e)
    e.x = at.x
    e.y = at.y
    e.kx = 0
    e.ky = 0
    held.left -= dt
    if (held.left > 0) return
    kit.held = null
    kit.next = atStage(H.every, p.stage)
    return hurl(g, kit, e)
  }
  kit.next -= dt
  if (kit.next > 0) return
  if (!hugGrab(g, kit)) kit.next = 0.4
}

/** Per tick, for the acting player: paths, eggs, jets, rings, grabs and the snowfall act; stacks fade and Gale Wings follows the HP. */
export const updateKitB = (g: Game, dt: number) => {
  const p = g.player
  const kit = p.kitB
  if (!kit) return
  switch (kit.kind) {
    case 'serpent':
      moveSerpent(p, kit, dt)
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
    case 'burrow': return stepBurrow(g, kit, dt)
    case 'hug': return stepHug(g, kit, dt)
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

/** A foe fell to the acting player: Salt Cure's kills lay on a salt layer; any KO adds a Moxie stack. */
export const kitBKill = (g: Game, source: DamageSource | null | undefined) => {
  const p = g.player
  const kit = p.kitB
  if (kit?.kind === 'burrow') {
    kit.last = g.now
    const next = stackUp(kit.stacks, atStage(KIT_B.burrow.moxie.cap, p.stage))
    if (next === kit.stacks) return
    kit.stacks = next
    return recomputeStats(g)
  }
  if (kit?.kind !== 'salt' || source !== 'saltCure') return
  kit.last = g.now
  const next = stackUp(kit.layers, atStage(KIT_B.salt.cap, p.stage))
  if (next === kit.layers) return
  kit.layers = next
  recomputeStats(g)
  burst(g, p.x, p.y - 10, { colors: ['#ffffff', '#e8e0d8', '#c8b8a8'], count: 8, speed: 60, ttl: 0.35 })
}

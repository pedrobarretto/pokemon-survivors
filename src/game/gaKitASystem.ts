import { dirTo, fromAngle, TAU } from '../engine/math'
import * as dm from '../engine/dmath'
import type { PokeType } from '../data/types'
import { healPlayer } from './combat'
import { burst, floatText, shakeScreen } from './effects'
import {
  atStage, beatUpStrikes, bindSpirit, blessingHp, danceHit, danceStep, furCharged, furHolds, GA_KIT, heatCast, huntKill, mischiefFed,
  plateSoak, shellOut, soulReady, teaRefill, wispsOf, wonderGuardHolds, type GaKitA,
} from './gaKitARules'
import { recomputeStats } from './leveling'
import { isAlive, nearestEnemy } from './queries'
import { spawnAttack } from './spawn'
import type { StatusSpec } from './status'
import { groundAt } from './terrain'
import type { Attack, Enemy, Game, Pickup, Player } from './types'
import { weatherHere } from './weather'

/**
 * Runs the big update's first 15 families on `Player.kitA` (the numbers and
 * pure rules are `gaKitARules.ts`). `stepMoves` calls `updateGaKitA`;
 * `hurtPlayer`, `killEnemy`, `afterCast` and the pickups call the small hooks
 * below. For anyone without a kit each is one check, so their runs stay
 * bit-identical.
 */

/** The player's power at their level, as the abilities and the special grow: what a kit's own hits are scaled by. */
const kitPower = (p: Player, power: number) => power * p.stats.might * (1 + 0.04 * (p.level - 1))

/** A burst of the kit's colors on the player, a shake and the guard sound: a mechanic going off. */
const flare = (g: Game, colors: readonly string[], count = 22, shake = 3) => {
  const p = g.player
  burst(g, p.x, p.y - 14, { colors: [...colors, '#ffffff'], count, speed: 120, ttl: 0.45, size: 2 })
  if (shake > 0) shakeScreen(g, shake)
  g.events.push({ kind: 'guard' })
}

/** A ring that hits everything around the player once (a clang, a croak, a burst of static, a vent); `visual` picks its look. */
const ring = (g: Game, move: Attack['move'], type: PokeType, r: number, damage: number, knockback: number, status: StatusSpec | null = null, visual: Attack['visual'] = 'gaRing') => {
  const p = g.player
  return spawnAttack(g, {
    move, type, visual, x: p.x, y: p.y - 6,
    shape: { kind: 'circle', r: 6 }, motion: { kind: 'follow', ox: 0, oy: -6 }, grow: (r - 6) / 0.28,
    damage, knockback, status, ttl: 0.36, activeUntil: 0.28,
  })
}

/** Shards flung all around the player (Power Gem, a broken plate). */
const shards = (g: Game, move: Attack['move'], type: PokeType, visual: Attack['visual'], count: number, damage: number, speed: number) => {
  const p = g.player
  for (let i = 0; i < count; i++) {
    const v = fromAngle((i / count) * TAU + g.now, speed)
    spawnAttack(g, {
      move, type, visual, x: p.x, y: p.y - 8,
      shape: { kind: 'circle', r: 5 }, motion: { kind: 'linear', vx: v.x, vy: v.y },
      damage, knockback: 30, pierce: 2, ttl: 0.9, flip: i % 2 === 0,
    })
  }
}

/**
 * A cue the screen draws and nothing else: never active, no damage, no mods.
 * Glued to the player at (ox, oy), or left at (x, y) with `at`.
 */
const cue = (g: Game, visual: Attack['visual'], ttl: number, ox: number, oy: number, at?: { x: number; y: number }) => {
  const p = g.player
  spawnAttack(g, {
    move: 'bugBite', type: 'normal', visual, x: at ? at.x : p.x + ox, y: at ? at.y : p.y + oy,
    shape: { kind: 'circle', r: 1 }, motion: at ? { kind: 'static' } : { kind: 'follow', ox, oy },
    damage: 0, ttl, activeFrom: Infinity, mod: null,
  })
}

/** Whether a cue of `visual` the acting player owns is younger than `age` s: hits in a crowd don't stack them. */
const cueFresh = (g: Game, visual: Attack['visual'], age: number) => g.attacks.some((a) => a.visual === visual && a.owner === g.player.slot && a.age < age)

/* ---------------- Per family ---------------- */

const soul = (g: Game, k: Extract<GaKitA, { kind: 'soul' }>, dt: number) => {
  const p = g.player
  k.cooldown = Math.max(0, k.cooldown - dt)
  if (k.left > 0) {
    k.left -= dt
    if (k.left <= 0) {
      k.left = 0
      recomputeStats(g)
    }
    return
  }
  if (!soulReady(p.stats.maxHp > 0 ? p.hp / p.stats.maxHp : 0, k.left, k.cooldown)) return
  // Clangorous Soul: the scales clang and the soul pays for every stat.
  const cost = p.stats.maxHp * GA_KIT.soul.cost
  p.hp = Math.max(1, p.hp - cost)
  floatText(g, p.x, p.y - 28, `-${dm.round(cost)}`, '#f8d048')
  k.left = GA_KIT.soul.left
  k.cooldown = GA_KIT.soul.cooldown
  recomputeStats(g)
  ring(g, 'clangingScales', 'dragon', 62 * p.stats.area, kitPower(p, 12), 120, null, 'gaClang')
  flare(g, ['#f8d048', '#e86848', '#c8b0a0'], 36, 5)
  g.events.push({ kind: 'cast', move: 'clangingScales' })
}

const dance = (g: Game, k: Extract<GaKitA, { kind: 'dance' }>, dt: number) => {
  const next = danceStep(k.stacks, k.calm, dt, g.player.stage)
  k.calm = next.calm
  if (next.stacks === k.stacks) return
  k.stacks = next.stacks
  recomputeStats(g)
  const p = g.player
  burst(g, p.x, p.y - 10, { colors: ['#7058c8', '#c8b8f8', '#ffffff'], count: 10, speed: 70, ttl: 0.4, gravity: -60 })
}

const ferry = (g: Game, k: Extract<GaKitA, { kind: 'ferry' }>) => {
  const p = g.player
  const ground = groundAt(g, p.x, p.y)
  const afloat = ground === 'water' || ground === 'ice'
  if (afloat === k.afloat) return
  k.afloat = afloat
  recomputeStats(g)
  burst(g, p.x, p.y - 2, { colors: ['#a8d8f8', '#ffffff', '#5898d0'], count: 14, speed: 70, ttl: 0.4, gravity: 60 })
}

const hunt = (g: Game, k: Extract<GaKitA, { kind: 'hunt' }>, dt: number) => {
  if (k.stacks <= 0) return
  k.left -= dt
  if (k.left > 0) return
  k.left = 0
  k.stacks = 0
  recomputeStats(g)
}

const sap = (g: Game, k: Extract<GaKitA, { kind: 'sap' }>, dt: number) => {
  if (k.rush > 0) {
    k.rush -= dt
    if (k.rush <= 0) {
      k.rush = 0
      recomputeStats(g)
    }
    return
  }
  if (k.sap < GA_KIT.sap.need) return
  k.sap = 0
  k.rush = GA_KIT.sap.rush
  recomputeStats(g)
  flare(g, ['#e8a838', '#f8d878', '#3868b0'], 30)
}

/** Heracross's horn struck: a drop of sap. */
export const sapHit = (g: Game) => {
  const k = g.player.kitA
  if (k?.kind === 'sap' && k.rush <= 0) k.sap = Math.min(GA_KIT.sap.need, k.sap + 1)
}

/** Whether the acting player is Mega Sableye now. */
const megaSableye = (p: Player) => p.mega.active > 0 && p.mega.stone === 'sableye'

/** Mega Sableye's gem mirror: enemy shots touching it fly back as the player's, `perSecond` at most. */
const mirror = (g: Game, k: Extract<GaKitA, { kind: 'hoard' }>, dt: number) => {
  const p = g.player
  k.mirror = Math.min(GA_KIT.hoard.mirror.perSecond, k.mirror + dt * GA_KIT.hoard.mirror.perSecond)
  if (k.mirror < 1) return
  const r = GA_KIT.hoard.mirror.r
  for (const h of g.hazards) {
    if (h.kind !== 'shot' || h.age < h.armAt || h.phantom > 0) continue
    if (dm.sq(h.x - p.x) + dm.sq(h.y - (p.y - 10)) > dm.sq(r + h.r)) continue
    h.ttl = h.age
    const speed = Math.max(170, dm.hypot(h.vx, h.vy) * 1.25)
    const d = dirTo(h.x, h.y, h.x - h.vx, h.y - h.vy)
    spawnAttack(g, {
      move: 'shadowSneak', type: 'rock', visual: 'gaMirror', x: h.x, y: h.y - 6,
      shape: { kind: 'circle', r: 6 }, motion: { kind: 'linear', vx: d.x * speed, vy: d.y * speed },
      damage: kitPower(p, GA_KIT.hoard.power), knockback: 40, pierce: 2, ttl: 1.4,
    })
    cue(g, 'gaGlint', 0.3, 0, 0, { x: h.x, y: h.y - 6 })
    burst(g, h.x, h.y - 6, { colors: ['#ffffff', '#f85878', '#58e8f8'], count: 8, speed: 90, ttl: 0.25 })
    if (--k.mirror < 1) return
  }
}

const hoard = (g: Game, k: Extract<GaKitA, { kind: 'hoard' }>, dt: number) => {
  const p = g.player
  k.wait = Math.max(0, k.wait - dt)
  if (megaSableye(p)) mirror(g, k, dt)
  const need = megaSableye(p) ? GA_KIT.hoard.megaNeed : GA_KIT.hoard.need
  if (k.gems < need || k.wait > 0) return
  // Power Gem: the hoard bursts out of its eyes and chest in a ring of shards.
  k.gems = 0
  k.wait = GA_KIT.hoard.gap
  shards(g, 'shadowSneak', 'rock', 'gaGem', GA_KIT.hoard.shards, kitPower(p, GA_KIT.hoard.power), GA_KIT.hoard.speed)
  flare(g, ['#f85878', '#58e8f8', '#f8e858'], 24)
}

/** Whether Spiritomb's kills bind two spirits: in a place's dark, in fog or on a haunted night. */
const inTheDark = (g: Game) => (g.place.inside !== null && g.place.inside.id !== 'sky') || weatherHere(g) === 'fog' || g.halloween

/** The wisps circle the player, re-cast each second with their count. */
const spirits = (g: Game, k: Extract<GaKitA, { kind: 'spirits' }>, dt: number) => {
  k.tick -= dt
  if (k.tick > 0 || k.wisps <= 0) return
  k.tick = 1
  const p = g.player
  const hits = new Map<number, number>()
  for (let i = 0; i < k.wisps; i++) {
    const angle = (i / k.wisps) * TAU + g.now * 2.4
    spawnAttack(g, {
      move: 'ominousWind', type: 'ghost', visual: 'gaWisp', x: p.x + dm.cos(angle) * GA_KIT.spirits.orbit, y: p.y - 10 + dm.sin(angle) * GA_KIT.spirits.orbit,
      shape: { kind: 'circle', r: GA_KIT.spirits.r }, motion: { kind: 'orbit', angle, spin: 2.4, radius: GA_KIT.spirits.orbit },
      damage: kitPower(p, GA_KIT.spirits.power), knockback: 10, hitInterval: GA_KIT.spirits.hitInterval, hits, ttl: 1.02,
    })
  }
}

/** Spirits bound or lost: the wisps follow, and the stats when their count moves. */
const setSpirits = (g: Game, k: Extract<GaKitA, { kind: 'spirits' }>, spirits: number) => {
  k.spirits = spirits
  const wisps = wispsOf(spirits)
  if (wisps === k.wisps) return
  const more = wisps > k.wisps
  k.wisps = wisps
  k.tick = 0
  recomputeStats(g)
  if (more) flare(g, ['#685088', '#a8f0a0', '#c8b8f8'], 16, 0)
}

/** The tea puddles the acting player poured, under their feet. */
const inTea = (g: Game, p: Player) => g.attacks.some((a) => a.visual === 'gaTea' && a.owner === p.slot && a.shape.kind === 'circle' && dm.sq(a.x - p.x) + dm.sq(a.y - p.y) <= dm.sq(a.shape.r))

/** Pours a puddle of tea at (x, y): hot for foes, a sip for the player standing in it. */
export const pourTea = (g: Game, x: number, y: number, damage: number, area: number) => {
  const p = g.player
  const antique = p.branch === 'polteageistAntique' && p.stage >= 1
  return spawnAttack(g, {
    move: 'teatime', type: 'ghost', visual: 'gaTea', x, y,
    shape: { kind: 'circle', r: GA_KIT.tea.r * area }, motion: { kind: 'static' },
    damage: damage * GA_KIT.tea.share, hitInterval: GA_KIT.tea.hitInterval, ttl: antique ? GA_KIT.tea.antiqueTtl : GA_KIT.tea.ttl,
    status: { kind: 'burn', chance: 0.15, duration: 2, power: 0.2 }, flip: antique,
  })
}

const tea = (g: Game, k: Extract<GaKitA, { kind: 'tea' }>, dt: number) => {
  const p = g.player
  k.spill = Math.max(0, k.spill - dt)
  if (!inTea(g, p) || p.hp >= p.stats.maxHp) return
  const rate = p.branch === 'polteageistAntique' && p.stage >= 1 ? GA_KIT.tea.antiqueHeal : GA_KIT.tea.heal
  k.heal = teaRefill(k.heal, g.now - k.at, p.stats.maxHp, rate)
  k.at = g.now
  const sip = Math.min(k.heal, p.stats.maxHp * rate * dt)
  if (sip <= 0) return
  k.heal -= sip
  healPlayer(g, sip)
}

/** Foes within reach that are confused or weakened: what Impidimp's line feeds on. */
const vexed = (g: Game) => {
  const p = g.player
  let n = 0
  const r = GA_KIT.mischief.reach * GA_KIT.mischief.reach
  for (const e of g.enemies) {
    if (!isAlive(e) || (e.status.confuse.time <= 0 && e.status.weaken.time <= 0)) continue
    if (dm.sq(e.x - p.x) + dm.sq(e.y - p.y) <= r) n++
  }
  return n
}

const mischief = (g: Game, k: Extract<GaKitA, { kind: 'mischief' }>, dt: number) => {
  k.lockout = Math.max(0, k.lockout - dt)
  if (k.left > 0) {
    k.left -= dt
    if (k.left > 0) return
    k.left = 0
    k.meter = 0
    k.lockout = GA_KIT.mischief.lockout
    return recomputeStats(g)
  }
  k.tick -= dt
  if (k.tick <= 0) {
    k.tick += GA_KIT.mischief.every
    k.meter = mischiefFed(k.meter, vexed(g), k.left, k.lockout)
  }
  if (k.meter < GA_KIT.mischief.need) return
  // The hair coils into muscle: Bulk Up for a few seconds.
  k.left = GA_KIT.mischief.left
  recomputeStats(g)
  flare(g, ['#c05878', '#f8a0c8', '#404048'], 34, 4)
}

const fur = (g: Game, k: Extract<GaKitA, { kind: 'fur' }>) => {
  const p = g.player
  if (k.walked === 0) k.walked = p.walked
  const before = k.charge
  k.charge = furCharged(k.charge, p.walked - k.walked)
  k.walked = p.walked
  if (k.charge < 1) return
  if (furHolds(p.stage, k.blessed)) {
    if (before < 1) {
      recomputeStats(g)
      flare(g, ['#f8d030', '#f0a040'], 16, 0)
    }
    return
  }
  // A full fur lets go: a burst of static all around.
  k.charge = 0
  ring(g, 'nuzzle', 'electric', GA_KIT.fur.r * p.stats.area, kitPower(p, GA_KIT.fur.power), 70, { kind: 'paralysis', chance: 0.5, duration: 1, power: 0 })
  flare(g, ['#f8d030', '#f0a040', '#ffffff'], 24)
}

/** A punch or a nuzzle of Pawmi's line landed: charge from the paw pads. */
export const furPunch = (g: Game) => {
  const k = g.player.kitA
  if (k?.kind === 'fur') k.charge = furCharged(k.charge, GA_KIT.fur.punch)
}

const plates = (g: Game, k: Extract<GaKitA, { kind: 'plates' }>, dt: number) => {
  const cap = atStage(GA_KIT.plates.cap, g.player.stage)
  if (k.plates >= cap) {
    k.regrow = GA_KIT.plates.regrow
    return
  }
  k.regrow -= dt
  if (k.regrow > 0) return
  k.regrow = GA_KIT.plates.regrow
  k.plates++
  const p = g.player
  burst(g, p.x, p.y - 12, { colors: ['#a8b0c8', '#ffffff', '#485878'], count: 10, speed: 60, ttl: 0.35 })
}

/** The foes a cable may latch: alive, near and not already held. */
const latch = (g: Game, k: Extract<GaKitA, { kind: 'cables' }>) => {
  const p = g.player
  const want = atStage(GA_KIT.cables.count, p.stage)
  while (k.links.length < want) {
    const e = nearestEnemy(g, p.x, p.y - 8, GA_KIT.cables.reach, new Set(k.links))
    if (!e) return
    k.links.push(e.id)
  }
}

const enemyById = (g: Game, id: number) => g.enemies.find((e) => e.id === id && isAlive(e)) ?? null

/** Whether a rival family (Electivire's line for Magmortar's, and back) plays within reach: co-op only, checked once a second. */
const rivalNear = (g: Game, rival: GaKitA['kind']) => {
  if (g.coop === null) return false
  const p = g.player
  return g.players.some((q) => q !== p && q.kitA?.kind === rival && q.stage >= 2 && dm.sq(q.x - p.x) + dm.sq(q.y - p.y) <= dm.sq(GA_KIT.rivalry.reach))
}

const rivalry = (g: Game, k: Extract<GaKitA, { kind: 'cables' | 'heat' }>, dt: number) => {
  k.check -= dt
  if (k.check > 0) return
  k.check = GA_KIT.rivalry.every
  const rival = g.player.stage >= 2 && rivalNear(g, k.kind === 'cables' ? 'heat' : 'cables')
  if (rival === k.rival) return
  k.rival = rival
  recomputeStats(g)
}

const cables = (g: Game, k: Extract<GaKitA, { kind: 'cables' }>, dt: number) => {
  const p = g.player
  rivalry(g, k, dt)
  const snap = GA_KIT.cables.snap * GA_KIT.cables.snap
  const before = k.links.length
  k.links = k.links.filter((id) => {
    const e = enemyById(g, id)
    return e !== null && dm.sq(e.x - p.x) + dm.sq(e.y - p.y) <= snap
  })
  if (k.links.length < before) k.relink = GA_KIT.cables.relink
  k.relink = Math.max(0, k.relink - dt)
  if (k.relink <= 0) latch(g, k)
  k.tick -= dt
  if (k.tick > 0) return
  k.tick += GA_KIT.cables.every
  for (const id of k.links) {
    const e = enemyById(g, id)
    if (!e) continue
    spawnAttack(g, {
      move: 'thunderPunch', type: 'electric', visual: 'gaZap', x: e.x, y: e.y - e.radius,
      shape: { kind: 'circle', r: e.radius + 2 }, motion: { kind: 'static' },
      damage: kitPower(p, GA_KIT.cables.power), knockback: 0, ttl: 0.12, activeUntil: 0.05,
      status: { kind: 'paralysis', chance: 0.12, duration: 0.6, power: 0 },
    })
  }
}

const heat = (g: Game, k: Extract<GaKitA, { kind: 'heat' }>, dt: number) => {
  rivalry(g, k, dt)
  if (k.vent <= 0) return
  k.vent -= dt
  if (k.vent > 0) return
  k.vent = 0
  recomputeStats(g)
}

/** Where Shedinja floats: a step behind the player, the way they came from. */
const shedSpot = (p: Player) => ({ x: p.x - p.facing.x * GA_KIT.shell.follow, y: p.y - 14 - p.facing.y * GA_KIT.shell.follow * 0.5 })

const shell = (g: Game, k: Extract<GaKitA, { kind: 'shell' }>, dt: number) => {
  const p = g.player
  if (!shellOut(p.stage, p.branch)) {
    k.shed = null
    return
  }
  const spot = shedSpot(p)
  if (!k.shed) {
    // The shell Nincada left behind wakes up beside it.
    k.shed = { x: spot.x, y: spot.y, claw: 0.5 }
    burst(g, spot.x, spot.y, { colors: ['#c8a868', '#f8e8b0', '#685088'], count: 26, speed: 90, ttl: 0.6 })
    return
  }
  const s = k.shed
  const pull = Math.min(1, dt * 5)
  s.x += (spot.x - s.x) * pull
  s.y += (spot.y - s.y) * pull
  s.claw -= dt
  if (s.claw > 0) return
  const e = nearestEnemy(g, s.x, s.y + 8, GA_KIT.shell.reach)
  if (!e) return
  s.claw = GA_KIT.shell.every
  spawnAttack(g, {
    move: 'bugBite', type: 'ghost', visual: 'gaShedClaw', x: e.x, y: e.y - e.radius,
    shape: { kind: 'circle', r: GA_KIT.shell.r }, motion: { kind: 'static' },
    damage: kitPower(p, GA_KIT.shell.power), knockback: 20, ttl: 0.22, activeUntil: 0.06, flip: e.x < s.x,
  })
}

/* ---------------- Hooks ---------------- */

/** Per tick, for the acting player: timers run, stacks grow, the wisps, cables, puddles and the shell act. */
export const updateGaKitA = (g: Game, dt: number) => {
  const k = g.player.kitA
  if (!k) return
  switch (k.kind) {
    case 'soul': return soul(g, k, dt)
    case 'dance': return dance(g, k, dt)
    case 'ferry': return ferry(g, k)
    case 'hunt': return hunt(g, k, dt)
    case 'sap': return sap(g, k, dt)
    case 'hoard': return hoard(g, k, dt)
    case 'spirits': return spirits(g, k, dt)
    case 'tea': return tea(g, k, dt)
    case 'mischief': return mischief(g, k, dt)
    case 'fur': return fur(g, k)
    case 'plates': return plates(g, k, dt)
    case 'cables': return cables(g, k, dt)
    case 'heat': return heat(g, k, dt)
    case 'shell': return shell(g, k, dt)
    default:
  }
}

/**
 * A hit about to land on the acting player, before armor: a plate soaks most
 * of it (and breaks into shards), and Shedinja's Wonder Guard lets only a
 * sliver through unless the hit is super effective.
 */
export const gaKitATaken = (g: Game, amount: number, types: readonly PokeType[]) => {
  const p = g.player
  const k = p.kitA
  if (!k) return amount
  if (k.kind === 'plates' && k.plates > 0) {
    k.plates--
    shards(g, 'steelWing', 'steel', 'gaPlate', GA_KIT.plates.shards, kitPower(p, GA_KIT.plates.power), GA_KIT.plates.speed)
    cue(g, 'gaPlateBreak', 0.4, 0, -10)
    burst(g, p.x, p.y - 12, { colors: ['#a8b0c8', '#ffffff', '#485878'], count: 14, speed: 110, ttl: 0.35 })
    return plateSoak(amount, 1)
  }
  if (k.kind === 'shell' && p.branch === 'shedinja' && p.stage >= 1) {
    // Wonder Guard: a hollow ripple when the shell shrugs a hit off, a crack when a super-effective one gets in.
    if (wonderGuardHolds(types)) {
      if (!cueFresh(g, 'gaWard', 0.2)) cue(g, 'gaWard', 0.4, 0, -12)
      burst(g, p.x, p.y - 12, { colors: ['#f8e8b0', '#c8a868'], count: 6, speed: 60, ttl: 0.25 })
      return amount * GA_KIT.shell.through
    }
    if (!cueFresh(g, 'gaPierce', 0.2)) cue(g, 'gaPierce', 0.45, 0, -12)
    burst(g, p.x, p.y - 12, { colors: ['#f83018', '#f8a030', '#ffffff'], count: 12, speed: 110, ttl: 0.3 })
    shakeScreen(g, 2)
  }
  return amount
}

/** A hit landed on the acting player (HP already taken): the dance stumbles, spirits slip out, the teacup spills. */
export const gaKitAHurt = (g: Game) => {
  const p = g.player
  const k = p.kitA
  if (!k || p.hp <= 0) return
  if (k.kind === 'dance') {
    const next = danceHit(k.stacks)
    k.calm = 0
    if (next === k.stacks) return
    k.stacks = next
    recomputeStats(g)
  } else if (k.kind === 'spirits' && k.spirits > 0) {
    setSpirits(g, k, Math.max(0, k.spirits - GA_KIT.spirits.leak))
  } else if (k.kind === 'tea' && k.spill <= 0) {
    k.spill = GA_KIT.tea.gap
    pourTea(g, p.x, p.y, kitPower(p, 8), p.stats.area)
  }
}

/** Revival Blessing: Pawmot's fur restarts its heart, once a run. */
export const gaKitAHolds = (g: Game) => {
  const p = g.player
  const k = p.kitA
  if (k?.kind !== 'fur') return false
  const share = blessingHp(p.stage, k.blessed, k.charge)
  if (share === null) return false
  k.blessed = true
  k.charge = 0
  recomputeStats(g)
  p.hp = p.stats.maxHp * Math.min(1, share)
  p.iframes = Math.max(p.iframes, GA_KIT.fur.blessing.iframes)
  g.flash = Math.max(g.flash, 0.5)
  flare(g, ['#f8d030', '#58e858', '#ffffff'], 60, 8)
  return true
}

/** A foe fell to the acting player: the hunt links up and Spiritomb binds its spirit. */
export const gaKitAKill = (g: Game, _e: Enemy) => {
  const p = g.player
  const k = p.kitA
  if (k?.kind === 'hunt') {
    const next = huntKill(k.stacks, k.left, p.stage)
    k.left = GA_KIT.hunt.window
    if (next === k.stacks) return
    k.stacks = next
    recomputeStats(g)
  } else if (k?.kind === 'spirits') {
    setSpirits(g, k, bindSpirit(k.spirits, inTheDark(g)))
  }
}

/** One of the acting player's moves fired: Magmortar's cannon heats up, and vents at the top. */
export const gaKitACast = (g: Game) => {
  const p = g.player
  const k = p.kitA
  if (k?.kind !== 'heat' || k.vent > 0) return
  const next = heatCast(k.heat, p.stage)
  k.heat = next.heat
  if (next.vented) {
    k.vent = GA_KIT.heat.vent
    ring(g, 'flameBurst', 'fire', GA_KIT.heat.r * p.stats.area, kitPower(p, GA_KIT.heat.power), 110, { kind: 'burn', chance: 0.6, duration: 2.5, power: 0.3 }, 'gaVent')
    flare(g, ['#f87838', '#f8d048', '#e83818'], 36, 5)
  }
  recomputeStats(g)
}

/** The acting player picked something up: Sableye eats the Exp. gems, Heracross laps a berry's sap. */
export const gaKitAPickup = (g: Game, pickup: Pickup) => {
  const k = g.player.kitA
  if (k?.kind === 'hoard' && pickup.kind === 'xp') k.gems = Math.min(GA_KIT.hoard.need, k.gems + 1)
  else if (k?.kind === 'sap' && pickup.kind === 'berry' && k.rush <= 0) k.sap = GA_KIT.sap.need
}

/** Beat Up's strikes for the acting player's hunt (two without one). */
export const huntStrikes = (g: Game) => beatUpStrikes(g.player.kitA?.kind === 'hunt' ? g.player.kitA.stacks : 0)

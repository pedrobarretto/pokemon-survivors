import { dirTo, TAU } from '../engine/math'
import * as dm from '../engine/dmath'
import { healPlayer } from './combat'
import { burst, floatText, shakeScreen } from './effects'
import { wardOpens } from './kitRules'
import { recomputeStats } from './leveling'
import {
  atStage, crashCost, eruptionBombs, eruptionEvery, gardenCap, gardenerOf, gardenHeal, hopCooldown, hopReady, MAGMA_BURN, MEGA_KIT_B,
  petalEvery, petalPower, pureAfter, pureCap, venomMult, venomSizes, type Gardener, type MegaKitB,
} from './megaKitBRules'
import { stampWard, wardHolder } from './moveKit'
import { inPlay, ownAttack } from './players'
import { nearestEnemy } from './queries'
import { spawnAttack } from './spawn'
import type { Enemy, Game, Player } from './types'

/**
 * Runs the Mega families' mechanics on `Player.megaB` (the rules and numbers
 * are `megaKitBRules.ts`) and grows Venom Drench's globs as they fly.
 * `stepMoves` calls `updateMegaKitB`; for anyone without the kit or the move
 * it is one or two checks, so their runs stay bit-identical.
 */

type Kit<K extends MegaKitB['kind']> = Extract<MegaKitB, { kind: K }>

/** The player's power at their level, as the abilities and the special grow: what a kit's own hits are scaled by. */
const kitPower = (p: Player, power: number) => power * p.stats.might * (1 + 0.04 * (p.level - 1))

const megaOn = (p: Player) => p.mega.active > 0

/* ---------------- Pure Power ---------------- */

/** A kick is judged as it lands: a stack for a foe touched, a crash for nothing (the HP, and the stacks unless Mega). */
const judgeKick = (g: Game, kit: Kit<'pure'>) => {
  const p = g.player
  const mega = megaOn(p)
  const next = pureAfter(kit.stacks, kit.landed, pureCap(p.stage, mega), mega)
  if (kit.landed) {
    if (next > kit.stacks) burst(g, p.x, p.y - 14, { colors: ['#f8d048', '#f87838', '#ffffff'], count: 8, speed: 70, ttl: 0.35 })
  } else {
    const cost = mega ? 0 : crashCost(p.stats.maxHp, p.hp, MEGA_KIT_B.pure.crash)
    if (cost > 0) {
      p.hp -= cost
      floatText(g, p.x, p.y - 26, String(cost), '#f87858', true)
    }
    // The crash's cue: a puff where it hit the ground, seen by everyone.
    spawnAttack(g, {
      move: 'highJumpKick', type: 'fighting', visual: 'mbCrash', x: p.x, y: p.y,
      shape: { kind: 'circle', r: 1 }, motion: { kind: 'static' }, damage: 0, ttl: 0.45, activeFrom: Infinity, tier: mega ? 1 : 0, mod: null,
    })
    shakeScreen(g, 2)
    if (!mega) g.events.push({ kind: 'hurt' })
  }
  if (next === kit.stacks) return
  kit.stacks = next
  recomputeStats(g)
}

const stepPure = (g: Game, kit: Kit<'pure'>, dt: number) => {
  if (kit.leap > 0) kit.leap = Math.max(0, kit.leap - dt)
  if (kit.resolve <= 0) return
  kit.resolve -= dt
  if (kit.resolve > 0) return
  kit.resolve = 0
  judgeKick(g, kit)
}

/* ---------------- Eruption ---------------- */

/** Where a bomb comes down: on a foe in reach for every other one when there are any, else a spot drawn around the humps. */
const bombSpot = (g: Game, p: Player, i: number, foes: readonly Enemy[], reach: readonly [number, number]) => {
  if (i % 2 === 0 && foes.length > 0) {
    const e = foes[Math.floor(g.rng() * foes.length)]!
    return { x: e.x, y: e.y }
  }
  const angle = g.rng() * TAU
  const d = reach[0] + g.rng() * (reach[1] - reach[0])
  return { x: p.x + dm.cos(angle) * d, y: p.y + dm.sin(angle) * d * 0.75 }
}

/** The humps blow: lava bombs as many as the HP says, each a blast and a pool of magma where it lands. */
const erupt = (g: Game) => {
  const p = g.player
  const E = MEGA_KIT_B.erupt
  const mega = megaOn(p)
  const count = eruptionBombs(p.hp / Math.max(1, p.stats.maxHp), p.stage, mega)
  const foes = g.enemies.filter((e) => e.dying < 0 && e.behavior.kind !== 'avatar' && dm.sq(e.x - p.x) + dm.sq(e.y - p.y) <= dm.sq(E.reach[1]))
  const r = (mega ? E.megaR : atStage(E.r, p.stage)) * p.stats.area
  const poolR = (mega ? E.pool.megaR : atStage(E.pool.r, p.stage)) * p.stats.area
  const power = kitPower(p, mega ? E.megaPower : atStage(E.power, p.stage))
  const hump = { x: p.x, y: p.y - (p.stage >= 1 ? 22 : 14) }
  for (let i = 0; i < count; i++) {
    const at = bombSpot(g, p, i, foes, E.reach)
    const fall = E.fall + i * 0.05
    const bomb = spawnAttack(g, {
      move: 'magnitude', type: 'fire', visual: 'mbBomb', x: at.x, y: at.y - 4,
      shape: { kind: 'circle', r }, motion: { kind: 'static' },
      damage: power, knockback: E.knockback, ttl: 0.36, activeUntil: 0.12, age: -fall, tier: mega ? 1 : 0, mod: null,
      // The whole fall, so the lob draws from the humps (`render/megaKitBFx.ts`).
      memo: fall,
    })
    bomb.from = hump
    spawnAttack(g, {
      move: 'magnitude', type: 'fire', visual: 'mbMagma', x: at.x, y: at.y,
      shape: { kind: 'circle', r: poolR }, motion: { kind: 'static' },
      damage: power * E.pool.share, status: MAGMA_BURN, hitInterval: E.pool.every, ttl: E.pool.ttl, age: -fall, mod: null,
    })
  }
  burst(g, hump.x, hump.y, { colors: ['#f8e070', '#f89030', '#d84020', '#584038'], count: 18 + count * 2, speed: 110, ttl: 0.55, gravity: 160, size: 2 })
  shakeScreen(g, mega ? 5 : 3)
  g.events.push({ kind: 'quake' })
}

const stepErupt = (g: Game, kit: Kit<'erupt'>, dt: number) => {
  const p = g.player
  kit.next -= dt
  if (kit.next > 0) return
  kit.next += eruptionEvery(p.stage, megaOn(p))
  erupt(g)
}

/* ---------------- The hop ---------------- */

/** Buneary comes down from its hop: a stomp round its feet, and its next Dizzy Punch waits as a counter. */
const hopLand = (g: Game, kit: Kit<'hop'>) => {
  const p = g.player
  const S = MEGA_KIT_B.hop.stomp
  const mega = megaOn(p)
  const r = (mega ? S.megaR : atStage(S.r, p.stage)) * p.stats.area
  spawnAttack(g, {
    move: 'dizzyPunch', type: mega ? 'fighting' : 'normal', visual: 'mbStomp', x: p.x, y: p.y - 2,
    shape: { kind: 'circle', r: 6 }, motion: { kind: 'static' }, grow: Math.max(0, r - 6) / 0.14,
    damage: kitPower(p, mega ? S.megaPower : atStage(S.power, p.stage)), knockback: S.knockback, ttl: 0.34, activeUntil: 0.14, tier: mega ? 1 : 0, mod: null,
  })
  kit.counter = MEGA_KIT_B.hop.counter.hold
  burst(g, p.x, p.y - 2, { colors: ['#f0e0c0', '#c8a878', '#ffffff'], count: 12, speed: 80, ttl: 0.35 })
}

const stepHop = (g: Game, kit: Kit<'hop'>, dt: number) => {
  const p = g.player
  const H = MEGA_KIT_B.hop
  kit.down = Math.max(0, kit.down - dt)
  kit.counter = Math.max(0, kit.counter - dt)
  if (kit.air > 0) {
    kit.air -= dt
    if (kit.air > 0) return
    kit.air = 0
    return hopLand(g, kit)
  }
  if (kit.down > 0) return
  const foe = nearestEnemy(g, p.x, p.y, 80)
  const gap = foe ? dm.hypot(foe.x - p.x, foe.y - p.y) - p.radius - foe.radius : null
  if (!foe || !hopReady(kit.down, kit.air, gap)) return
  // Aloft is an immunity window: it waits while another move's is open (`wardOpens`).
  if (!wardOpens(p.ward, wardHolder(p), 'dizzyPunch', g.now)) return
  stampWard(p, 'dizzyPunch', g.now)
  const away = foe.x === p.x && foe.y === p.y ? { x: -p.facing.x, y: -p.facing.y } : dirTo(foe.x, foe.y, p.x, p.y)
  spawnAttack(g, {
    move: 'dizzyPunch', type: 'normal', visual: 'mbHop', x: p.x, y: p.y,
    shape: { kind: 'circle', r: 6 }, motion: { kind: 'lunge', vx: (away.x * H.dist) / H.time, vy: (away.y * H.dist) / H.time, left: H.time },
    damage: 0, ttl: H.time, activeFrom: Infinity, mod: null,
  })
  kit.air = H.time
  kit.down = hopCooldown(p.stage, megaOn(p))
  p.iframes = Math.max(p.iframes, H.time + 0.1)
  burst(g, p.x, p.y, { colors: ['#f0e0c0', '#ffffff'], count: 6, speed: 50, ttl: 0.3 })
}

/* ---------------- The garden ---------------- */

const GARDENERS: readonly Gardener[] = ['flabebe', 'florges', 'eternal']

/** A new blossom where Flabébé stands; past the cap, the oldest one wilts. */
const plant = (g: Game, who: Gardener) => {
  const p = g.player
  const G = MEGA_KIT_B.garden
  let count = 0
  let oldest: number | null = null
  for (let i = 0; i < g.attacks.length; i++) {
    const a = g.attacks[i]!
    if (a.visual !== 'mbBlossom' || !ownAttack(g, a) || a.age >= a.ttl - 0.5) continue
    count++
    if (oldest === null || a.age > g.attacks[oldest]!.age) oldest = i
  }
  if (count >= gardenCap(who) && oldest !== null) {
    const wilt = g.attacks[oldest]!
    wilt.ttl = wilt.age + 0.5
  }
  spawnAttack(g, {
    move: 'fairyWind', type: 'fairy', visual: 'mbBlossom', x: p.x, y: p.y,
    shape: { kind: 'circle', r: G.r }, motion: { kind: 'static' },
    damage: kitPower(p, petalPower(who)), ttl: G.life, activeFrom: Infinity, tier: GARDENERS.indexOf(who),
    turret: { every: petalEvery(who, megaOn(p)), left: 0.4, amount: 1, speed: G.shot.speed, shot: 'mbPetal' }, mod: null,
  })
  burst(g, p.x, p.y - 4, { colors: ['#f8a8c0', '#ffffff', '#78c868'], count: 8, speed: 50, ttl: 0.4 })
}

/** Each blossom keeps the Mega's pace, and whoever on the team stands in a ring is healed (once a tick, however many rings). */
const tend = (g: Game, who: Gardener) => {
  const p = g.player
  const G = MEGA_KIT_B.garden
  const every = petalEvery(who, megaOn(p))
  const blossoms = []
  for (const a of g.attacks) {
    if (a.visual !== 'mbBlossom' || !ownAttack(g, a) || a.age >= a.ttl) continue
    if (a.turret) a.turret.every = every
    blossoms.push(a)
  }
  if (blossoms.length === 0) return
  const share = gardenHeal(who) * G.tick
  const keeper = g.player
  for (const q of g.players) {
    if (!inPlay(q) || q.hp >= q.stats.maxHp) continue
    if (!blossoms.some((a) => dm.sq(a.x - q.x) + dm.sq(a.y - q.y) <= dm.sq(G.r + q.radius))) continue
    g.player = q
    const healed = healPlayer(g, q.stats.maxHp * share, keeper)
    g.player = keeper
    if (healed >= 1) floatText(g, q.x, q.y - 28, `+${dm.round(healed)}`, '#68e868', true)
  }
}

const stepGarden = (g: Game, kit: Kit<'garden'>, dt: number) => {
  const p = g.player
  const who = gardenerOf(p.stage, p.branch)
  kit.next -= dt
  if (kit.next <= 0) {
    kit.next += atStage(MEGA_KIT_B.garden.every, p.stage)
    plant(g, who)
  }
  kit.tick -= dt
  if (kit.tick > 0) return
  kit.tick += MEGA_KIT_B.garden.tick
  tend(g, who)
}

/* ---------------- Long-range venom ---------------- */

/** Venom Drench's globs grow as they fly: bigger, and harder by the share they hadn't carried yet (`memo`). */
const growVenom = (g: Game) => {
  const p = g.player
  const mega = megaOn(p)
  for (const a of g.attacks) {
    if (a.visual !== 'mbGlob' || a.age < 0 || !ownAttack(g, a) || a.shape.kind !== 'circle') continue
    const dist = dm.hypot(a.x - a.from.x, a.y - a.from.y)
    const mult = venomMult(dist, p.stage, mega)
    if (mult <= a.memo) continue
    a.damage *= mult / a.memo
    a.memo = mult
    a.shape.r = venomSizes(dist).r * p.stats.area
  }
}

/** Per tick, for the acting player: the kick is judged, the humps blow, the hop goes off, the garden grows, the venom swells. */
export const updateMegaKitB = (g: Game, dt: number) => {
  const p = g.player
  if (p.starter === 'skrelp') growVenom(g)
  const kit = p.megaB
  if (!kit) return
  switch (kit.kind) {
    case 'pure': return stepPure(g, kit, dt)
    case 'erupt': return stepErupt(g, kit, dt)
    case 'hop': return stepHop(g, kit, dt)
    case 'garden': return stepGarden(g, kit, dt)
    default:
  }
}

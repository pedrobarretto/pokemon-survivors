import { TAU } from '../engine/math'
import * as dm from '../engine/dmath'
import { burst, shakeScreen } from './effects'
import { atStage, diveEvery, divePrey, faded, KIT_F, rootedAfter, shiverEvery, smashReady, stackUp, voltCharge, type FossilKit } from './fossilKitRules'
import { recomputeStats } from './leveling'
import { LUNGE_IFRAMES } from './moveRules'
import { isAlive } from './queries'
import { spawnAttack } from './spawn'
import { applyStatus } from './status'
import type { Enemy, Game, Player } from './types'
import { unseen } from './versusRules'
import { weatherHere } from './weather'

/**
 * Runs the fossil families' mechanics on `Player.kitF` (the rules and numbers
 * are `fossilKitRules.ts`). `stepMoves` calls `updateKitF`, and the
 * signatures' first strikes `kitFFirstStrike`; for anyone without a kit each
 * is one check, so their runs stay bit-identical.
 */

type Kit<K extends FossilKit['kind']> = Extract<FossilKit, { kind: K }>

/** The player's power at their level, as the abilities and the special grow: what a kit's own hits are scaled by. */
const kitPower = (p: Player, power: number) => power * p.stats.might * (1 + 0.04 * (p.level - 1))

/** Whether a kit may act on `e` within `reach` px of the player: alive, seen, never a Versus avatar. */
const actsOn = (g: Game, e: Enemy, reach: number) => isAlive(e) && !unseen(g, e) && e.behavior.kind !== 'avatar' && dm.sq(e.x - g.player.x) + dm.sq(e.y - g.player.y) <= reach * reach

/** The foes (bosses too) a kit may act on within `reach` px. */
const foesWithin = (g: Game, reach: number) => g.enemies.filter((e) => actsOn(g, e, reach))

/** How many of them, without a list (the shell checks every tick while it waits whole). */
const countWithin = (g: Game, reach: number) => {
  let n = 0
  for (const e of g.enemies) if (actsOn(g, e, reach)) n++
  return n
}

/** Aerodactyl swoops on the toughest prey in reach: a fast dash that bites on the way, i-frames while it lasts. */
const dive = (g: Game) => {
  const p = g.player
  const D = KIT_F.dive
  // Under the ground (Dig) or carried elsewhere, it stays put.
  if (p.hidden) return false
  const prey = divePrey(foesWithin(g, D.reach))
  if (!prey) return false
  const dx = prey.x - p.x
  const dy = prey.y - p.y
  const dist = Math.max(1, dm.hypot(dx, dy))
  const time = Math.min(D.most, (dist + prey.radius) / D.speed)
  const mega = p.mega.active > 0
  p.iframes = Math.max(p.iframes, time + LUNGE_IFRAMES)
  spawnAttack(g, {
    move: 'wingAttack', type: 'rock', visual: 'kitFDive', x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: D.r * p.stats.area }, motion: { kind: 'lunge', vx: (dx / dist) * D.speed, vy: (dy / dist) * D.speed, left: time },
    damage: kitPower(p, mega ? D.megaPower : D.power), knockback: D.knockback, ttl: time + 0.08, tier: mega ? 1 : 0, mod: null,
  })
  burst(g, p.x, p.y - 12, { colors: ['#d8c8e8', '#a898b8', '#ffffff'], count: 10, speed: 90, ttl: 0.3 })
  g.events.push({ kind: 'cast', move: 'wingAttack' })
  return true
}

/** The dive's clock, and Mega Aerodactyl's second swoop right after the first. */
const stepDive = (g: Game, kit: Kit<'dive'>, dt: number) => {
  const mega = g.player.mega.active > 0
  if (kit.again > 0) {
    kit.again -= dt
    if (kit.again <= 0) dive(g)
  }
  kit.next -= dt
  if (kit.next > 0) return
  if (!dive(g)) {
    kit.next = 0.5
    return
  }
  kit.next = diveEvery(mega)
  if (mega) kit.again = KIT_F.dive.again
}

/** Shell Smash: the shell breaks, spikes spray out all around, and the smashed stats run. */
const shellSmash = (g: Game, kit: Kit<'smash'>) => {
  const p = g.player
  const S = KIT_F.smash
  kit.left = atStage(S.left, p.stage)
  const spikes = atStage(S.spikes, p.stage)
  const turn = g.rng() * TAU
  for (let i = 0; i < spikes; i++) {
    const a = turn + (i / spikes) * TAU
    spawnAttack(g, {
      move: 'spikeCannon', type: 'rock', visual: 'kitFShell', x: p.x, y: p.y - 8,
      shape: { kind: 'circle', r: 5 }, motion: { kind: 'linear', vx: dm.cos(a) * S.spikeSpeed, vy: dm.sin(a) * S.spikeSpeed },
      damage: kitPower(p, atStage(S.spikePower, p.stage)), knockback: 60, pierce: 2, ttl: 0.6, mod: null,
    })
  }
  burst(g, p.x, p.y - 10, { colors: ['#f8e8c0', '#d8b070', '#a07840', '#ffffff'], count: 26, speed: 140, ttl: 0.45, size: 2 })
  shakeScreen(g, 4)
  g.events.push({ kind: 'quake' })
  recomputeStats(g)
}

/** The shell's cycle: smashed for a while, then it regrows, then it waits whole for a crowd. */
const stepSmash = (g: Game, kit: Kit<'smash'>, dt: number) => {
  const p = g.player
  if (kit.left > 0) {
    kit.left -= dt
    if (kit.left > 0) return
    kit.left = 0
    kit.shell = atStage(KIT_F.smash.regrow, p.stage)
    return recomputeStats(g)
  }
  kit.shell = Math.max(0, kit.shell - dt)
  if (kit.shell > 0) return
  if (smashReady(kit.shell, kit.left, countWithin(g, KIT_F.smash.near))) shellSmash(g, kit)
}

/** Cradily's tendrils: the nearest regular foes in reach are latched, pulled in, sapped and slowed. */
const latch = (g: Game, kit: Kit<'roots'>) => {
  const p = g.player
  const R = KIT_F.roots
  const reach = atStage(R.reach, p.stage)
  const near = foesWithin(g, reach).filter((e) => !e.boss)
  near.sort((a, b) => dm.sq(a.x - p.x) + dm.sq(a.y - p.y) - (dm.sq(b.x - p.x) + dm.sq(b.y - p.y)) || a.id - b.id)
  const grabbed: Enemy[] = near.slice(0, atStage(R.grabs, p.stage))
  for (const e of grabbed) {
    const dist = Math.max(1, dm.hypot(e.x - p.x, e.y - p.y))
    e.kx -= ((e.x - p.x) / dist) * (R.pull / e.mass)
    e.ky -= ((e.y - p.y) / dist) * (R.pull / e.mass)
    applyStatus(e.status, R.slow, 0, false, 'ingrain', p.slot)
    const sap = spawnAttack(g, {
      move: 'ingrain', type: 'grass', visual: 'kitFHit', x: e.x, y: e.y - e.radius,
      shape: { kind: 'circle', r: e.radius + 2 }, motion: { kind: 'static' },
      damage: kitPower(p, atStage(R.power, p.stage)), drain: R.drain, ttl: 0.08, mod: null,
    })
    sap.from = { x: p.x, y: p.y - 6 }
    kit.tendrils.push({ x: e.x, y: e.y - e.radius, left: R.show })
  }
  return grabbed.length > 0
}

/** Lileep's roots: standing still roots it (regen and armor), and while rooted the tendrils latch on a clock. */
const stepRoots = (g: Game, kit: Kit<'roots'>, dt: number) => {
  const p = g.player
  kit.still = p.walked === kit.walked ? kit.still + dt : 0
  kit.walked = p.walked
  const rooted = rootedAfter(kit.still)
  if (rooted !== kit.rooted) {
    kit.rooted = rooted
    kit.next = 0.2
    recomputeStats(g)
    if (rooted) burst(g, p.x, p.y, { colors: ['#a0d070', '#c890c8', '#684830'], count: 10, speed: 50, ttl: 0.35 })
  }
  if (kit.tendrils.length > 0) {
    for (const t of kit.tendrils) t.left -= dt
    if (kit.tendrils.some((t) => t.left <= 0)) kit.tendrils = kit.tendrils.filter((t) => t.left > 0)
  }
  if (!kit.rooted) return
  kit.next -= dt
  if (kit.next > 0) return
  kit.next = latch(g, kit) ? atStage(KIT_F.roots.every, p.stage) : 0.4
}

/** Dracozolt's tail lets the charge go: a ring of lightning that paralyzes. */
const discharge = (g: Game) => {
  const p = g.player
  const V = KIT_F.volt
  const r = V.r * p.stats.area
  spawnAttack(g, {
    move: 'boltBeak', type: 'electric', visual: 'kitFVolt', x: p.x, y: p.y - 6,
    shape: { kind: 'circle', r: 8 }, motion: { kind: 'follow', ox: 0, oy: -6 }, grow: (r - 8) / 0.16,
    damage: kitPower(p, V.power), knockback: 70, status: V.paralysis, ttl: 0.36, activeUntil: 0.16, mod: null,
  })
  burst(g, p.x, p.y - 10, { colors: ['#f8e060', '#ffffff', '#78a858'], count: 22, speed: 130, ttl: 0.4 })
  shakeScreen(g, 3)
}

/** Arctozolt shivers: a cold ring that chips and slows what stands near. */
const shiver = (g: Game) => {
  const p = g.player
  const S = KIT_F.shiver
  const r = S.r * p.stats.area
  spawnAttack(g, {
    move: 'icicleCrash', type: 'ice', visual: 'kitFShiver', x: p.x, y: p.y - 6,
    shape: { kind: 'circle', r: 8 }, motion: { kind: 'follow', ox: 0, oy: -6 }, grow: (r - 8) / 0.22,
    damage: kitPower(p, S.power), knockback: 20, status: S.slow, ttl: 0.4, activeUntil: 0.22, mod: null,
  })
}

/** Per tick, for the acting player: the dive, the shell, the roots, the claws' chain, the shiver and the frenzy's fade. */
export const updateKitF = (g: Game, dt: number) => {
  const kit = g.player.kitF
  if (!kit) return
  switch (kit.kind) {
    case 'dive': return stepDive(g, kit, dt)
    case 'smash': return stepSmash(g, kit, dt)
    case 'roots': return stepRoots(g, kit, dt)
    case 'claws':
      if (kit.left <= 0) return
      kit.left -= dt
      if (kit.left <= 0) kit.links = 0
      return
    case 'shiver':
      kit.pulse -= dt
      if (kit.pulse > 0) return
      kit.pulse += shiverEvery(weatherHere(g) === 'snow')
      return shiver(g)
    case 'frenzy': {
      const next = faded(kit.stacks, g.now - kit.last, dt, KIT_F.frenzy.hold, KIT_F.frenzy.decayEvery)
      if (next === kit.stacks) return
      kit.stacks = next
      return recomputeStats(g)
    }
    default:
  }
}

/** A first strike landed (a signature's hit on an unhurt foe): Dracozolt's generator charges, Dracovish's frenzy grows. */
export const kitFFirstStrike = (g: Game) => {
  const p = g.player
  const kit = p.kitF
  if (kit?.kind === 'volt') {
    const next = voltCharge(kit.charge)
    kit.charge = next.charge
    if (next.burst) discharge(g)
    return
  }
  if (kit?.kind !== 'frenzy') return
  kit.last = g.now
  const next = stackUp(kit.stacks, KIT_F.frenzy.cap)
  if (next === kit.stacks) return
  kit.stacks = next
  recomputeStats(g)
  burst(g, p.x, p.y - 12, { colors: ['#5888a8', '#f8f0e8'], count: 5, speed: 50, ttl: 0.3 })
}

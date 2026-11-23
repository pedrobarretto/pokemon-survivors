import { dirTo, fromAngle } from '../engine/math'
import { formBodyOf, bodyOf } from '../data/bodies'
import { PLAYABLE } from '../data/hatchlings'
import * as dm from '../engine/dmath'
import { healPlayer } from './combat'
import { burst, shakeScreen } from './effects'
import { wardOpens } from './kitRules'
import { recomputeStats } from './leveling'
import { stampWard, wardHolder } from './moveKit'
import { nearestEnemy } from './queries'
import { spawnAttack } from './spawn'
import {
  exitTrips, heroHolds, KIT, meterFed, miceRoom, rageFaded, rageHit, slimeRefill, supremeUp, zenNext, type Mouse, type SeasonKit,
} from './seasonOneKitRules'
import type { Enemy, Game, Player } from './types'

/**
 * Runs Temporada 1's mechanic families on `Player.kit` (the rules and numbers
 * are `seasonOneKitRules.ts`). `stepMoves` calls `updateSeasonKit` and
 * `hurtPlayer`/`killEnemy` the small hooks below; for anyone without a kit
 * each is one check, so their runs stay bit-identical.
 */

/** The player's power at their level, as the abilities and the special grow: what a kit's own hits are scaled by. */
const kitPower = (p: Player, power: number) => power * p.stats.might * (1 + 0.04 * (p.level - 1))

const flare = (g: Game, colors: readonly string[], count = 22) => {
  const p = g.player
  burst(g, p.x, p.y - 14, { colors: [...colors, '#ffffff'], count, speed: 120, ttl: 0.45, size: 2 })
  shakeScreen(g, 3)
  g.events.push({ kind: 'guard' })
}

/** School's hitbox from the form's data, capped so the School stays a bigger target without covering the screen. */
const setRadius = (p: Player, school: boolean) => {
  const dex = PLAYABLE[p.starter].line[0].dex
  const body = school ? (formBodyOf(dex, 'school') ?? bodyOf(dex)) : bodyOf(dex)
  p.radius = school ? Math.min(KIT.school.radiusCap, dm.round(body.bodyW * 0.3)) : Math.max(6, dm.round(body.bodyW * 0.3))
}

/** Drops a patch of slime every `gap` px walked, its heal budget refilling as it goes. */
const dropSlime = (g: Game, kit: Extract<SeasonKit, { kind: 'slime' }>) => {
  const p = g.player
  if (kit.walked === 0) kit.walked = p.walked
  if (p.walked - kit.walked < KIT.slime.gap) return
  kit.walked = p.walked
  spawnAttack(g, {
    move: 'dragonPulse', type: 'dragon', visual: 'slime', x: p.x, y: p.y,
    shape: { kind: 'circle', r: KIT.slime.r }, motion: { kind: 'static' },
    damage: kitPower(p, 7) * KIT.slime.share, ttl: KIT.slime.ttl, hitInterval: KIT.slime.hitInterval, status: KIT.slime.slow,
  })
}

/** A foe stepped in Goomy's slime: a little HP back, from a budget of one second of its rate. */
export const slimeFed = (g: Game) => {
  const p = g.player
  const kit = p.kit
  if (kit?.kind !== 'slime') return
  kit.heal = slimeRefill(kit.heal, g.now - kit.at, p.stats.maxHp)
  kit.at = g.now
  const amount = Math.min(KIT.slime.healPerHit, kit.heal)
  if (amount <= 0) return
  kit.heal -= amount
  healPlayer(g, amount)
}

/** Sends out mice up to the cap, from the player's feet. They carry the cast's damage and mods. */
export const addMice = (g: Game, wanted: number, damage: number, life: number, mods: number) => {
  const p = g.player
  const kit = p.kit
  if (kit?.kind !== 'mice') return
  for (let i = 0; i < miceRoom(kit.mice.length, wanted); i++) kit.mice.push({ x: p.x + (i - 1) * 8, y: p.y + 4, left: life, bite: 0, damage, mods })
}

/** Each mouse runs at the nearest foe, nips it and heads back to the player when it finds none. */
const stepMice = (g: Game, kit: Extract<SeasonKit, { kind: 'mice' }>, dt: number) => {
  const p = g.player
  for (const m of kit.mice) {
    m.left -= dt
    m.bite = Math.max(0, m.bite - dt)
    const target = nearestEnemy(g, m.x, m.y, KIT.mice.seek)
    const goal = target ?? p
    const reach = target ? target.radius + KIT.mice.bite : 14
    const d = dirTo(m.x, m.y, goal.x, goal.y)
    if (dm.sq(goal.x - m.x) + dm.sq(goal.y - m.y) > reach * reach) {
      m.x += d.x * KIT.mice.pace * dt
      m.y += d.y * KIT.mice.pace * dt
    } else if (target && m.bite <= 0) {
      m.bite = KIT.mice.biteEvery
      p.castMods = m.mods
      spawnAttack(g, {
        move: 'populationBomb', type: 'normal', visual: 'miceBite', x: m.x, y: m.y - 4,
        shape: { kind: 'circle', r: KIT.mice.bite }, motion: { kind: 'static' }, damage: m.damage, knockback: 12, ttl: 0.16, activeUntil: 0.05,
      })
      p.castMods = 0
    }
  }
  if (kit.mice.some((m) => m.left <= 0)) kit.mice = kit.mice.filter((m) => m.left > 0)
}

/** Whether any player has mice out; what the horde's lure asks first, so the walk costs one check for everyone else. */
const miceOf = (g: Game): Mouse[] | null => {
  for (const p of g.players) if (p.kit?.kind === 'mice' && p.kit.mice.length > 0) return p.kit.mice
  return null
}

/**
 * The mouse a regular foe at (x, y) runs at instead of the player, if one is
 * near. A foe at its teeth wears it out faster, so mice can't hold a crowd for
 * long. Bosses ignore them.
 */
export const miceLure = (g: Game, e: Enemy, dt: number): Mouse | null => {
  if (e.boss) return null
  const mice = miceOf(g)
  if (!mice) return null
  let best: Mouse | null = null
  let bestD = KIT.mice.lure * KIT.mice.lure
  for (const m of mice) {
    const d = dm.sq(m.x - e.x) + dm.sq(m.y - e.y)
    if (d >= bestD) continue
    bestD = d
    best = m
  }
  if (best && bestD < dm.sq(e.radius + KIT.mice.bite)) best.left -= dt * KIT.mice.touched
  return best
}

/** A psychic orb, slow and heavy, at the nearest foe in reach: Zen Mode's turret. */
const zenOrb = (g: Game) => {
  const p = g.player
  const target = nearestEnemy(g, p.x, p.y - 12, KIT.zen.reach)
  if (!target) return false
  const aim = dirTo(p.x, p.y - 12, target.x, target.y - target.radius)
  const v = fromAngle(dm.atan2(aim.y, aim.x), KIT.zen.orbSpeed)
  spawnAttack(g, {
    move: 'ability', type: 'psychic', visual: 'zenOrb', x: p.x, y: p.y - 12,
    shape: { kind: 'circle', r: KIT.zen.orbR }, motion: { kind: 'linear', vx: v.x, vy: v.y },
    damage: kitPower(p, KIT.zen.power), knockback: 30, pierce: 2, ttl: 3.4,
  })
  return true
}

/** One of Dondozo's slams around the player. */
const commandSlam = (g: Game) => {
  const p = g.player
  spawnAttack(g, {
    move: 'orderUp', type: 'dragon', visual: 'commandSlam', x: p.x, y: p.y - 6,
    shape: { kind: 'circle', r: KIT.commander.slamR * p.stats.area }, motion: { kind: 'static' },
    damage: kitPower(p, KIT.commander.power), knockback: 170, ttl: 0.42, activeUntil: 0.08,
  })
  shakeScreen(g, 3)
  g.events.push({ kind: 'quake' })
}

/** Emergency Exit: a dash away from the nearest foe, hitting nothing. */
const emergencyExit = (g: Game, kit: Extract<SeasonKit, { kind: 'exit' }>) => {
  const p = g.player
  const foe = nearestEnemy(g, p.x, p.y, 200)
  const away = foe ? dirTo(foe.x, foe.y, p.x, p.y) : { x: -p.facing.x, y: -p.facing.y }
  const speed = KIT.exit.dash / KIT.exit.time
  kit.cooldown = KIT.exit.cooldown
  p.iframes = Math.max(p.iframes, KIT.exit.iframes)
  spawnAttack(g, {
    move: 'ability', type: 'bug', visual: 'quick', x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: 8 }, motion: { kind: 'lunge', vx: away.x * speed, vy: away.y * speed, left: KIT.exit.time },
    damage: 0, ttl: KIT.exit.time + 0.1, activeFrom: Infinity,
  })
  flare(g, ['#a0a8b0', '#d8e0e8'], 14)
}

/** Per tick, for the acting player: stacks fade, meters and timers run, the forms turn and the patches, mice and orbs act. */
export const updateSeasonKit = (g: Game, dt: number) => {
  const p = g.player
  const kit = p.kit
  if (!kit) return
  switch (kit.kind) {
    case 'rage': {
      const next = rageFaded(kit.stacks, g.now - kit.last, dt)
      if (next !== kit.stacks) {
        kit.stacks = next
        recomputeStats(g)
      }
      return
    }
    case 'slime': return dropSlime(g, kit)
    case 'mice': return stepMice(g, kit, dt)
    case 'hunger':
      kit.next -= dt
      if (kit.next > 0) return
      kit.next += KIT.hunger.every
      kit.hangry = !kit.hangry
      recomputeStats(g)
      return flare(g, kit.hangry ? ['#785090', '#402848'] : ['#f8d030', '#d8a838'], 14)
    case 'school':
      kit.lockout = Math.max(0, kit.lockout - dt)
      if (kit.left > 0) {
        kit.left -= dt
        if (kit.left <= 0) {
          kit.left = 0
          kit.meter = 0
          kit.lockout = KIT.school.lockout
          setRadius(p, false)
          recomputeStats(g)
          flare(g, ['#7088c8', '#a8c8f0'], 16)
        }
        return
      }
      if (kit.meter < KIT.school.need) return
      kit.left = KIT.school.left
      setRadius(p, true)
      recomputeStats(g)
      return flare(g, ['#7088c8', '#a8c8f0', '#3858a0'], 40)
    case 'zen': {
      const on = zenNext(kit.on, p.stats.maxHp > 0 ? p.hp / p.stats.maxHp : 1)
      if (on !== kit.on) {
        kit.on = on
        kit.orb = 0
        recomputeStats(g)
        flare(g, on ? ['#a8c8f0', '#78a0d8'] : ['#e06838', '#f8a038'], 18)
      }
      if (!kit.on) return
      kit.orb -= dt
      if (kit.orb <= 0 && zenOrb(g)) kit.orb = KIT.zen.every
      return
    }
    case 'exit':
      kit.cooldown = Math.max(0, kit.cooldown - dt)
      return
    case 'disguise':
      kit.down = Math.max(0, kit.down - dt)
      return
    case 'commander':
      kit.lockout = Math.max(0, kit.lockout - dt)
      if (kit.left > 0) {
        kit.left -= dt
        kit.slam -= dt
        if (kit.slam <= 0) {
          kit.slam += KIT.commander.slamEvery
          commandSlam(g)
        }
        if (kit.left > 0) return
        kit.left = 0
        kit.meter = 0
        kit.lockout = KIT.commander.lockout
        recomputeStats(g)
        return flare(g, ['#e87858', '#f8c0a0'], 18)
      }
      if (kit.meter < KIT.commander.need) return
      kit.left = KIT.commander.left
      kit.slam = 0
      recomputeStats(g)
      return flare(g, ['#d8c080', '#587898', '#e87858'], 40)
    default:
  }
}

/** Mega Tatsugiri's Commander: the transformation fills the meter, so Dondozo comes on the next tick, unless it's aboard or just left. */
export const callDondozo = (g: Game) => {
  const kit = g.player.kit
  if (kit?.kind === 'commander' && kit.left <= 0 && kit.lockout <= 0) kit.meter = KIT.commander.need
}

/** A hit landed on the acting player (HP already taken): Rage stacks, Emergency Exit fires. */
export const seasonKitHurt = (g: Game, dmg: number) => {
  const p = g.player
  const kit = p.kit
  if (!kit || p.hp <= 0) return
  if (kit.kind === 'rage') {
    kit.last = g.now
    const next = rageHit(kit.stacks, p.stage)
    if (next !== kit.stacks) {
      kit.stacks = next
      recomputeStats(g)
    }
  } else if (kit.kind === 'exit' && exitTrips((p.hp + dmg) / p.stats.maxHp, p.hp / p.stats.maxHp, kit.cooldown)) {
    emergencyExit(g, kit)
  }
}

/** Mimikyu's Disguise takes this hit, unless another move's immunity window is too fresh (`wardOpens`). */
export const seasonKitBlocks = (g: Game) => {
  const p = g.player
  const kit = p.kit
  if (kit?.kind !== 'disguise' || kit.down > 0 || !wardOpens(p.ward, wardHolder(p), 'shadowClaw', g.now)) return false
  stampWard(p, 'shadowClaw', g.now)
  kit.down = KIT.disguise.cooldown
  p.iframes = Math.max(p.iframes, KIT.disguise.iframes)
  flare(g, ['#d8c890', '#685028'], 26)
  return true
}

/** Zero to Hero: Palafin's first faint of the run rises as the Hero instead. */
export const seasonKitHolds = (g: Game) => {
  const p = g.player
  const kit = p.kit
  if (kit?.kind !== 'hero' || !heroHolds(kit.spent, p.stage)) return false
  kit.spent = true
  recomputeStats(g)
  p.hp = p.stats.maxHp * KIT.hero.heal
  p.iframes = Math.max(p.iframes, KIT.hero.iframes)
  g.flash = Math.max(g.flash, 0.5)
  flare(g, ['#58b0e8', '#f8d030', '#e84838'], 60)
  shakeScreen(g, 8)
  return true
}

/** A regular foe or boss fell to the acting player: meters fill, and every Pawniard on the team gets its stack from a boss. */
export const seasonKitKill = (g: Game, e: Enemy) => {
  const kit = g.player.kit
  if (kit?.kind === 'school') kit.meter = meterFed(kit.meter, KIT.school.need, kit.left, kit.lockout)
  else if (kit?.kind === 'commander') kit.meter = meterFed(kit.meter, KIT.commander.need, kit.left, kit.lockout)
  if (!e.boss || e.alpha) return
  const actor = g.player
  for (const p of g.players) {
    if (p.kit?.kind !== 'supreme') continue
    p.kit.stacks = supremeUp(p.kit.stacks)
    g.player = p
    recomputeStats(g)
    flare(g, ['#c04848', '#d8c890'], 24)
  }
  g.player = actor
}

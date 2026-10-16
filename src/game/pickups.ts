import { dirTo, retain } from '../engine/math'
import { range } from '../engine/rng'
import { healPlayer } from './combat'
import { burst, floatText } from './effects'
import { useConsumable } from './consumables'
import { rollEgg, type EggSource } from './eggs'
import { applyOffer, gainXp, loadout, rollOffers } from './leveling'
import { grantStone } from './mega'
import { MEGAS } from '../data/megas'
import { actAs, inPlay } from './players'
import type { Game, Pickup, Player } from './types'
import * as dm from '../engine/dmath'

const MAX_XP_PICKUPS = 260

type PickupKind = Exclude<Pickup['kind'], 'xp' | 'coin' | 'consumable' | 'megaStone'>

export const dropPickup = (g: Game, x: number, y: number, kind: PickupKind) => {
  g.pickups.push({ id: g.nextId++, x, y, vx: 0, vy: 0, attracted: false, age: 0, kind })
}

/** Drops an Exp. Candy. Past the cap, value merges into the oldest candy so totals are never lost. */
export const dropXp = (g: Game, x: number, y: number, value: number) => {
  const xp = g.pickups.filter((p): p is Extract<Pickup, { kind: 'xp' }> => p.kind === 'xp')
  const oldest = xp.length >= MAX_XP_PICKUPS ? xp.find((p) => !p.attracted) : undefined
  if (oldest) {
    oldest.value += value
    return
  }
  g.pickups.push({ id: g.nextId++, x, y, vx: range(g.rng, -20, 20), vy: range(g.rng, -30, -10), attracted: false, age: 0, kind: 'xp', value })
}

/** Scatters Poké Dollar coins around a fainted enemy. */
export const dropCoins = (g: Game, x: number, y: number, values: readonly number[]) => {
  for (const value of values) {
    const spread = values.length > 1 ? 40 : 15
    g.pickups.push({ id: g.nextId++, x, y, vx: range(g.rng, -spread, spread), vy: range(g.rng, -spread, -5), attracted: false, age: 0, kind: 'coin', value })
  }
}

/**
 * Rolls an egg from `source` (`rollEgg`). A found egg goes straight into the
 * run's bag, so it can't be lost on the ground when Mewtwo ends the run.
 */
export const awardEgg = (g: Game, source: EggSource, x: number, y: number) => {
  const tier = rollEgg(g.rng, source, g.eggs)
  if (!tier) return
  g.eggs.found.push({ tier, at: g.player.walked })
  g.eggs.lucky = false
  burst(g, x, y - 12, { colors: ['#f8f0d0', '#ffffff', '#58c858', '#f8d030'], count: 36, speed: 110, ttl: 0.8, gravity: 40 })
  g.events.push({ kind: 'egg', tier })
}

/** Exp. Candy size tier, used for rendering. */
export const xpTier = (value: number) => (value >= 40 ? 3 : value >= 10 ? 2 : value >= 3 ? 1 : 0)

const collect = (g: Game, pickup: Pickup) => {
  const p = g.player
  switch (pickup.kind) {
    case 'xp':
      gainXp(g, pickup.value)
      g.events.push({ kind: 'pickup' })
      break
    case 'coin': {
      const amount = Math.round(pickup.value * p.stats.greed)
      g.coins += amount
      floatText(g, p.x, p.y - 30, `₽${amount}`, '#f8d030')
      g.events.push({ kind: 'coin' })
      break
    }
    case 'berry': {
      const heal = Math.round(healPlayer(g, p.stats.maxHp * 0.3))
      floatText(g, p.x, p.y - 30, `+${heal}`, '#58e858')
      burst(g, p.x, p.y - 10, { colors: ['#58e858', '#c8f8c8'], count: 12, speed: 60, ttl: 0.5, gravity: -40 })
      g.events.push({ kind: 'heal' })
      break
    }
    case 'pokeball': {
      const [offer] = rollOffers(loadout(g), g.rng, 1)
      if (offer) applyOffer(g, offer)
      burst(g, p.x, p.y - 10, { colors: ['#f83838', '#ffffff', '#ffd830'], count: 30, speed: 120, ttl: 0.6 })
      // Evolutions celebrate with their own event instead of the Poké Ball toast.
      if (offer?.kind !== 'evolution') g.events.push({ kind: 'pokeball', offer: offer ?? null })
      break
    }
    case 'megaStone':
      grantStone(g, pickup.mega)
      break
    case 'consumable':
      useConsumable(g, pickup.item)
      break
  }
}

/** Mega Stones of one line on the ground: two or more means its player is choosing one, so the magnet leaves them be. */
const megaStones = (g: Game, line: Player['starter']) => {
  let n = 0
  for (const k of g.pickups) if (k.kind === 'megaStone' && MEGAS[k.mega].line === line) n++
  return n
}

/** Who may take a pickup: anyone in play, except a Mega Stone, which only goes to a player of its line still without one. */
const canTake = (p: Player, k: Pickup) => inPlay(p) && (k.kind !== 'megaStone' || (MEGAS[k.mega].line === p.starter && !p.mega.stone))

/** The player a pickup heads for: the nearest one who may take it, or null. */
const takerOf = (g: Game, k: Pickup) => {
  let best: Player | null = null
  let bestD = Infinity
  for (const p of g.players) {
    if (!canTake(p, k)) continue
    const d = dm.sq(k.x - p.x) + dm.sq(k.y - (p.y - 6))
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best
}

/** Moves every pickup: idle ones settle, ones in a player's magnet hop and fly to them, and touching one collects it (as that player). */
export const updatePickups = (g: Game, dt: number) => {
  for (const k of g.pickups) {
    k.age += dt
    const p = takerOf(g, k)
    if (!p) {
      k.vx *= dm.exp(-6 * dt)
      k.vy *= dm.exp(-6 * dt)
      k.x += k.vx * dt
      k.y += k.vy * dt
      continue
    }
    const magnet2 = dm.sq(p.stats.magnet)
    const choosing = k.kind === 'megaStone' && megaStones(g, p.starter) > 1
    const d2 = dm.sq(k.x - p.x) + dm.sq(k.y - (p.y - 6))
    if (choosing) {
      if (d2 < dm.sq(p.radius + 8)) {
        actAs(g, p, () => collect(g, k))
        k.age = -1
      }
      continue
    }
    if (!k.attracted && d2 < magnet2) {
      k.attracted = true
      // Tiny hop away before being sucked in – the classic survivors feel.
      const d = dirTo(p.x, p.y, k.x, k.y)
      k.vx = d.x * 70
      k.vy = d.y * 70
    }
    if (k.attracted) {
      const d = dirTo(k.x, k.y, p.x, p.y - 6)
      k.vx += d.x * 900 * dt
      k.vy += d.y * 900 * dt
      const speed = dm.hypot(k.vx, k.vy)
      if (speed > 420) {
        k.vx *= 420 / speed
        k.vy *= 420 / speed
      }
    } else {
      k.vx *= dm.exp(-6 * dt)
      k.vy *= dm.exp(-6 * dt)
    }
    k.x += k.vx * dt
    k.y += k.vy * dt
    if (k.attracted && d2 < dm.sq(p.radius + 5)) {
      actAs(g, p, () => collect(g, k))
      k.age = -1
    }
  }
  retain(g.pickups, (k) => k.age >= 0)
}


import { dirTo, retain } from '../engine/math'
import { range } from '../engine/rng'
import { healPlayer } from './combat'
import { burst, floatText, shakeScreen } from './effects'
import { useConsumable } from './consumables'
import { rollEgg, type EggSource } from './eggs'
import { applyOffer, gainXp, loadout, rollOffers, type Loadout } from './leveling'
import { openAlphaPrize } from './alphas'
import { grantStone } from './mega'
import { collectTm } from './tms'
import { collectCandy } from './halloween'
import { collectEvoItem } from './evoGate'
import { inPlay, onAnyScreen, setPhase } from './players'
import { coopScale } from './coop'
import { COOP } from '../data/coop'
import type { Game, Offer, Pickup, Player } from './types'
import * as dm from '../engine/dmath'

export const MAX_XP_PICKUPS = 260

/**
 * Loot left lying: past `maxAge` seconds on the ground, off every player's
 * screen (by `margin` px), it's gone. A long endless run otherwise strews
 * thousands of coins, candies and berries behind it, each one costing every
 * tick. Exp. Candies fold into new ones instead (`MAX_XP_PICKUPS`) and the
 * one-of-a-kind finds stay.
 */
export const LOOT = { maxAge: 120, margin: 32 } as const

/** Pickups that never go: Exp. Candies (capped by folding) and the finds a run gets one of. */
const LASTING: ReadonlySet<Pickup['kind']> = new Set(['xp', 'tm', 'megaStone', 'evoItem', 'alphaPrize'])

/** Whether `k` was left behind for good (`LOOT`): old, not on its way to anyone, out of everyone's sight. */
export const leftBehind = (g: Game, k: Pickup) => k.age > LOOT.maxAge && !k.attracted && !LASTING.has(k.kind) && !onAnyScreen(g, k.x, k.y, LOOT.margin)

/** Speed (px/s) a pulled pickup heads for the player at, well above any player's speed. */
const PULL_SPEED = 420
/** How fast (1/s) a pulled pickup's velocity turns toward the player. */
const PULL_STEER = 7

type PickupKind = Exclude<Pickup['kind'], 'xp' | 'coin' | 'consumable' | 'megaStone' | 'tm' | 'treat' | 'evoItem'>

export const dropPickup = (g: Game, x: number, y: number, kind: PickupKind) => {
  g.pickups.push({ id: g.nextId++, x, y, vx: 0, vy: 0, attracted: false, age: 0, kind })
}

/**
 * Drops an Exp. Candy where a foe fainted. Past the cap, the oldest candy left
 * on the ground folds into the new one: every kill still shows its candy and
 * no EXP is lost (merging into the old candy instead hid every drop for the
 * rest of a run that had left the cap's worth behind).
 */
export const dropXp = (g: Game, x: number, y: number, value: number) => {
  let count = 0
  let oldest = -1
  for (let i = 0; i < g.pickups.length; i++) {
    const k = g.pickups[i]!
    if (k.kind !== 'xp') continue
    count++
    if (oldest < 0 && !k.attracted) oldest = i
  }
  let total = value
  if (count >= MAX_XP_PICKUPS && oldest >= 0) {
    const [old] = g.pickups.splice(oldest, 1)
    if (old?.kind === 'xp') total += old.value
  }
  g.pickups.push({ id: g.nextId++, x, y, vx: range(g.rng, -20, 20), vy: range(g.rng, -30, -10), attracted: false, age: 0, kind: 'xp', value: total })
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
  // Co-op: every player gets the egg, each walking it from where they stood.
  g.eggs.found.push(g.coop === null ? { tier, at: g.player.walked } : { tier, at: g.player.walked, walked: g.players.map((p) => p.walked) })
  g.eggs.lucky = false
  burst(g, x, y - 12, { colors: ['#f8f0d0', '#ffffff', '#58c858', '#f8d030'], count: 36, speed: 110, ttl: 0.8, gravity: 40 })
  g.events.push({ kind: 'egg', tier })
}

/** Exp. Candy size tier, used for rendering. */
export const xpTier = (value: number) => (value >= 40 ? 3 : value >= 10 ? 2 : value >= 3 ? 1 : 0)

/**
 * Whether a Poké Ball's prize waits on the player: a move or held item they
 * don't own yet takes a slot for the rest of the run, so it's their call.
 * Upgrades, move evolutions and berries go in on their own.
 */
export const pokeballAsks = (offer: Offer, { moves, items }: Pick<Loadout, 'moves' | 'items'>) =>
  offer.kind === 'move' ? !moves.some((m) => m.id === offer.id) : offer.kind === 'item' ? !items.some((i) => i.id === offer.id) : false

/**
 * A Poké Ball pops open with a burst and a few rising sparkles. It picks on
 * its own (so never a fork or a duo fusion, the player's calls, and always
 * common); a new move or item waits on the player (phase `pokeball`: the
 * prize or `pass`, picked like a level-up, so the replay records it).
 */
const openPokeball = (g: Game) => {
  const p = g.player
  const [offer] = rollOffers(loadout(g), g.rng, 1, { forks: false, duos: false })
  burst(g, p.x, p.y - 10, { colors: ['#f83838', '#ffffff', '#ffd830'], count: 30, speed: 120, ttl: 0.6 })
  burst(g, p.x, p.y - 14, { colors: ['#ffffff', '#fff8c0', '#ffd830'], count: 12, speed: 45, ttl: 0.9, gravity: -60 })
  shakeScreen(g, 2)
  if (offer && pokeballAsks(offer, p)) {
    setPhase(g, 'pokeball')
    g.player.offers = [offer, { kind: 'pass' }]
    g.events.push({ kind: 'pokeball', offer, moment: 'found' })
    return
  }
  if (offer) applyOffer(g, offer)
  // Evolutions celebrate with their own event instead of the Poké Ball toast.
  if (offer?.kind !== 'evolution') g.events.push({ kind: 'pokeball', offer: offer ?? null, moment: 'auto' })
}

/** The player's call on a Poké Ball's new move or item: `pass` leaves it, anything else takes it. */
export const decidePokeball = (g: Game, picked: Offer) => {
  const [found] = g.player.offers
  if (!found || found.kind === 'pass') return
  const take = picked.kind !== 'pass'
  if (take) applyOffer(g, found)
  g.events.push({ kind: 'pokeball', offer: found, moment: take ? 'taken' : 'left' })
}

const collect = (g: Game, pickup: Pickup) => {
  const p = g.player
  switch (pickup.kind) {
    case 'xp':
      if (g.coop === null) gainXp(g, pickup.value)
      else shareXp(g, pickup.value)
      g.events.push({ kind: 'pickup' })
      break
    case 'coin': {
      // Co-op ₽ are worth a bit more: the team's total is split at the end (`coopPayout`).
      const amount = dm.round(pickup.value * p.stats.greed * coopScale(g, COOP.scale.coins))
      g.coins += amount
      floatText(g, p.x, p.y - 30, `₽${amount}`, '#f8d030')
      g.events.push({ kind: 'coin' })
      break
    }
    case 'berry': {
      const heal = dm.round(healPlayer(g, p.stats.maxHp * 0.3))
      floatText(g, p.x, p.y - 30, `+${heal}`, '#58e858')
      burst(g, p.x, p.y - 10, { colors: ['#58e858', '#c8f8c8'], count: 12, speed: 60, ttl: 0.5, gravity: -40 })
      g.events.push({ kind: 'heal' })
      break
    }
    case 'pokeball':
      openPokeball(g)
      break
    case 'megaStone':
      grantStone(g, pickup.mega)
      break
    case 'consumable':
      useConsumable(g, pickup.item)
      break
    case 'tm':
      collectTm(g, pickup)
      break
    case 'alphaPrize':
      openAlphaPrize(g)
      break
    case 'treat':
      collectCandy(g)
      break
    case 'evoItem':
      collectEvoItem(g, pickup.item)
      break
  }
}

/**
 * Co-op: an Exp. Candy reaches every player still in the run (fainted and
 * away ones too), split so the team levels at a solo pace, and grown by the
 * team's mean growth (Exp. Charm, Lucky Egg) rather than each player's: the
 * same EXP for everyone keeps the team's levels together, so level-ups land on
 * the same tick and the team picks them in one pause.
 */
export const shareXp = (g: Game, value: number) => {
  const share = value / coopScale(g, COOP.scale.xp)
  let growth = 0
  let n = 0
  for (const q of g.players) {
    if (q.gone) continue
    growth += q.stats.growth
    n++
  }
  if (n === 0) return
  growth /= n
  const actor = g.player
  for (const q of g.players) {
    if (q.gone) continue
    g.player = q
    gainXp(g, share, growth)
  }
  g.player = actor
}

/** Pickups that can open a screen (and set the run waiting), so they never land while another one is up. */
const OPENS_SCREEN: ReadonlySet<Pickup['kind']> = new Set(['tm', 'pokeball', 'alphaPrize'])

/** Mega Stones on the ground: two or more means the player is choosing one, so the magnet leaves them be. */
const megaStones = (g: Game) => {
  let n = 0
  for (const k of g.pickups) if (k.kind === 'megaStone') n++
  return n
}

export const updatePickups = (g: Game, dt: number) => {
  if (g.coop !== null) return updateTeamPickups(g, dt)
  const p = g.player
  const magnet2 = dm.sq(p.stats.magnet)
  const choosing = megaStones(g) > 1
  // The same for every pickup this tick: a long run leaves hundreds on the ground.
  const steer = 1 - dm.exp(-PULL_STEER * dt)
  const rest = dm.exp(-6 * dt)
  for (const k of g.pickups) {
    k.age += dt
    if (leftBehind(g, k)) {
      k.age = -1
      continue
    }
    const d2 = dm.sq(k.x - p.x) + dm.sq(k.y - (p.y - 6))
    if (choosing && k.kind === 'megaStone') {
      if (d2 < dm.sq(p.radius + 8)) {
        collect(g, k)
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
      // Steer the velocity toward the player rather than adding a pull to it: a
      // pull keeps the sideways speed, and a candy could orbit the player forever.
      const d = dirTo(k.x, k.y, p.x, p.y - 6)
      k.vx += (d.x * PULL_SPEED - k.vx) * steer
      k.vy += (d.y * PULL_SPEED - k.vy) * steer
    } else {
      k.vx *= rest
      k.vy *= rest
    }
    k.x += k.vx * dt
    k.y += k.vy * dt
    // Checked after the move and with this frame's step as slack, so a fast candy can't hop over the player.
    const reach = p.radius + 5 + dm.hypot(k.vx, k.vy) * dt
    // A TM, a Poké Ball or an Alpha's prize may open a screen: one at a time, the next one waits on the ground.
    if (OPENS_SCREEN.has(k.kind) && g.phase !== 'playing') continue
    if (k.attracted && dm.sq(k.x - p.x) + dm.sq(k.y - (p.y - 6)) < dm.sq(reach)) {
      collect(g, k)
      k.age = -1
    }
  }
  retain(g.pickups, (k) => k.age >= 0)
}


/* ---------------- Co-op ---------------- */

/** Whether `p` can take `k`: standing, and it's theirs when it was dropped for one player (`Pickup.owner`). */
const takes = (p: Player, k: Pickup) => inPlay(p) && (k.owner === undefined || k.owner === p.slot)

/** Mega Stones on the ground for `owner`: two or more is a choice, touched rather than pulled. */
const stonesFor = (g: Game, owner: number | undefined) => {
  let n = 0
  for (const k of g.pickups) if (k.kind === 'megaStone' && k.owner === owner && k.age >= 0) n++
  return n
}

/** The first player in slot order who can take `k` and has it within `reach` (squared px; their magnet by default). */
const takerWithin = (g: Game, k: Pickup, reach: (q: Player) => number = magnetReach) => {
  for (const q of g.players) {
    if (!takes(q, k)) continue
    if (dm.sq(k.x - q.x) + dm.sq(k.y - (q.y - 6)) < reach(q)) return q
  }
  return null
}

const magnetReach = (q: Player) => dm.sq(q.stats.magnet)
const touchReach = (q: Player) => dm.sq(q.radius + 8)

/** The nearest player who can take `k` (an already pulled pickup whose player fainted or went away, or one Exp. Share pulled). */
const nearestTaker = (g: Game, k: Pickup) => {
  let best: Player | null = null
  let bestD = Infinity
  for (const q of g.players) {
    if (!takes(q, k)) continue
    const d = dm.sq(k.x - q.x) + dm.sq(k.y - q.y)
    if (d < bestD) {
      bestD = d
      best = q
    }
  }
  return best
}

/**
 * Co-op pickups: each one flies to whoever's magnet caught it first (`to`) and
 * is collected as them; one dropped for a player (`owner`) only goes to them.
 * Same pull as solo.
 */
const updateTeamPickups = (g: Game, dt: number) => {
  const actor = g.player
  const steer = 1 - dm.exp(-PULL_STEER * dt)
  const rest = dm.exp(-6 * dt)
  for (const k of g.pickups) {
    k.age += dt
    if (k.age < 0) continue
    if (leftBehind(g, k)) {
      k.age = -1
      continue
    }
    if (k.kind === 'megaStone' && stonesFor(g, k.owner) > 1) {
      // A choice of stones isn't pulled: it waits to be touched.
      const q = takerWithin(g, k, touchReach)
      if (q) {
        g.player = q
        collect(g, k)
        k.age = -1
      }
      continue
    }
    let p = k.attracted && k.to !== undefined ? g.players[k.to] : undefined
    if (p && !takes(p, k)) p = undefined
    if (!p) {
      const q = takerWithin(g, k)
      if (q && !k.attracted) {
        k.attracted = true
        const d = dirTo(q.x, q.y, k.x, k.y)
        k.vx = d.x * 70
        k.vy = d.y * 70
      }
      p = q ?? (k.attracted ? nearestTaker(g, k) ?? undefined : undefined)
      if (p) k.to = p.slot
      else k.attracted = false
    }
    if (k.attracted && p) {
      const d = dirTo(k.x, k.y, p.x, p.y - 6)
      k.vx += (d.x * PULL_SPEED - k.vx) * steer
      k.vy += (d.y * PULL_SPEED - k.vy) * steer
    } else {
      k.vx *= rest
      k.vy *= rest
    }
    k.x += k.vx * dt
    k.y += k.vy * dt
    if (!p || !k.attracted) continue
    const reach = p.radius + 5 + dm.hypot(k.vx, k.vy) * dt
    if (OPENS_SCREEN.has(k.kind) && g.phase !== 'playing') continue
    if (dm.sq(k.x - p.x) + dm.sq(k.y - (p.y - 6)) < dm.sq(reach)) {
      g.player = p
      collect(g, k)
      k.age = -1
    }
  }
  g.player = actor
  retain(g.pickups, (k) => k.age >= 0)
}

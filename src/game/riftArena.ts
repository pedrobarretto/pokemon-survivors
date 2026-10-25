import { retain } from '../engine/math'
import { ARENA_FEET, ARENA_LAYOUTS, type Pt } from '../data/arenas'
import { isRiftLegend, RIFT, type RiftLegend } from '../data/rifts'
import { partnerOf } from '../data/domains'
import { floorAt, holesAt, onFloor, stepsAt } from './arenaFloor'
import { healPlayer, hurtPlayer } from './combat'
import { dropItem } from './consumables'
import { burst, floatText, setScreenShake, shakeScreen } from './effects'
import { spawnEnemy } from './enemies'
import { dropMegaStones, heldMega } from './mega'
import { dropCoins, dropPickup } from './pickups'
import { dropLegendaryTm } from './tms'
import { riftLoot, riftScale, type RiftArena } from './rift'
import { bringBack, keepOnFloor, setAside } from './room'
import { rollShiny } from './shiny'
import { footOf, groundAt, playerTypes } from './terrain'
import { updateDomain } from './domain'
import { centerScreen, eachPlayer, placeTeam } from './players'
import { dropForEach } from './coop'
import type { Game } from './types'
import * as dm from '../engine/dmath'

/**
 * The arena behind a rift: a room (`room.ts`) with its own shape, scenery and
 * ground rule (`data/arenas.ts`) where the team duels one legendary.
 * Entering sets the world aside and leaving puts it back exactly as it was.
 * Falling here doesn't end the run: the rift throws the team back out
 * (`fallInArena`).
 */

/** Lava burns this share of max HP per touch (every half second, the player's i-frames). Fire types walk on it. */
export const LAVA_BURN = 0.07

/** Sends the team into `legend`'s arena, centered where the portal was. */
export const enterArena = (g: Game, legend: RiftLegend, x: number, y: number) => {
  const shiny = rollShiny(g.rng, RIFT.shinyOdds)
  const layout = ARENA_LAYOUTS[legend]
  const at = ([dx, dy]: Pt) => ({ x: x + dx, y: y + dy })
  const stash = setAside(g)

  const spawn = at(layout.boss)
  const boss = spawnEnemy(g, legend, spawn.x, spawn.y)
  const scale = riftScale(g.time)
  boss.hp = boss.maxHp = dm.round(boss.maxHp * scale.hp)
  boss.damage *= scale.damage
  boss.xp = riftLoot(g.time, shiny).xp
  boss.shiny = shiny
  g.bossId = boss.id

  const start = at(layout.player)
  placeTeam(g, start.x, start.y)
  g.flash = 0.9
  setScreenShake(g, 9, 'team')
  const terrain = {
    lake: null,
    solids: layout.solids.map((s, i) => {
      const foot = ARENA_FEET[s.piece]
      return { kind: s.piece, x: x + s.x, y: y + s.y, variant: i, foot: [{ ...foot, x: x + s.x + foot.x, y: y + s.y + foot.y }] }
    }),
  }
  g.rift.arena = { legend, shiny, x, y, layout, left: RIFT.arenaTime, age: 0, bossId: boss.id, loot: null, fall: null, stash, terrain, domain: null }
  g.events.push({ kind: 'riftEnter', enemy: legend, shiny })
}

/** Brings the team back to the world they left. `outcome` decides the toast; the loot was already dropped. */
export const exitArena = (g: Game, outcome: 'won' | 'collapse' | 'fallen') => {
  const arena = g.rift.arena
  if (!arena) return
  if (outcome === 'collapse') {
    const boss = g.enemies.find((e) => e.id === arena.bossId)
    if (boss) burst(g, boss.x, boss.y - boss.radius, { colors: ['#7850c8', '#c8a8f8', '#ffffff'], count: 50, speed: 140, ttl: 0.6 })
  }
  g.rift.arena = null
  // Out of a domain the team comes back where its portal stood, and its sky clears soon after.
  if (arena.domain) {
    placeTeam(g, arena.x, arena.y)
    for (const p of g.players) centerScreen(g, p, arena.x, arena.y)
    if (g.weather.next === Infinity) g.weather.next = g.time
  }
  bringBack(g, arena.stash)
  g.flash = 0.6
  g.events.push({ kind: 'riftExit', outcome })
}

/**
 * The acting player's HP hit 0 in the arena: instead of the game over, they
 * faint and the rift throws the team out (`updateArenaFall` plays it with the
 * world held still). A held Revive is kept for a real fall.
 */
export const fallInArena = (g: Game) => {
  const arena = g.rift.arena
  if (!arena || arena.fall !== null) return
  arena.fall = RIFT.fallTime
  g.player.hp = 0
  shakeScreen(g, 8)
  g.events.push({ kind: 'riftFall', enemy: arena.legend })
}

/**
 * Runs the defeat while it plays and lands the team back outside when it
 * ends, whoever fainted with a bit of HP. Returns whether it is playing (the
 * simulation waits).
 */
export const updateArenaFall = (g: Game, dt: number) => {
  const arena = g.rift.arena
  if (!arena || arena.fall === null) return false
  arena.fall -= dt
  if (arena.fall > 0) return true
  for (const p of g.players) {
    // Solo the one player is the one who fell.
    if (g.players.length > 1 && (p.hp > 0 || p.gone)) continue
    p.hp = Math.max(1, dm.round(p.stats.maxHp * RIFT.fallHp))
    p.revive = 0
    p.hurt = 0
  }
  exitArena(g, 'fallen')
  return true
}

/** The legendary fell: drop the rift's loot at (x, y), heal the team and start the short loot window. */
export const riftWin = (g: Game, arena: RiftArena, x: number, y: number) => {
  const loot = riftLoot(g.time, arena.shiny)
  dropCoins(g, x, y, loot.coins)
  dropForEach(g, () => {
    for (let i = 0; i < loot.pokeballs; i++) dropPickup(g, x - 8 + i * 8, y + 4, 'pokeball')
  })
  loot.items.forEach((item, i) => dropItem(g, x + 10 + i * 6, y, item))
  const before = g.player
  // A Mega line's first beaten legendary also leaves its Mega Stone (or both, to choose from).
  // Co-op: each player gets their own line's stones (`Pickup.owner`), so nobody is locked out by a teammate's.
  for (const p of g.players) {
    g.player = p
    const owner = g.coop === null ? undefined : p.slot
    if (p.gone || heldMega(g) || g.pickups.some((k) => k.kind === 'megaStone' && k.owner === owner)) continue
    const from = g.pickups.length
    dropMegaStones(g, x, y - 10)
    if (owner !== undefined) for (let i = from; i < g.pickups.length; i++) g.pickups[i]!.owner = owner
  }
  g.player = before
  // So does its legendary TM, until everyone has learned one.
  dropForEach(g, () => dropLegendaryTm(g, arena.legend, x + 14, y - 6))
  for (const p of g.players) {
    g.player = p
    const heal = dm.round(healPlayer(g, p.stats.maxHp * loot.heal))
    floatText(g, p.x, p.y - 30, `+${heal}`, '#58e858')
  }
  g.player = before
  g.hazards.length = 0
  arena.loot = RIFT.lootTime
  // A pair (Latias and Latios) is one rift: one toast, both beaten.
  const partner = partnerOf(arena.legend)
  g.rift.cleared.push(arena.legend)
  if (partner && isRiftLegend(partner)) g.rift.cleared.push(partner)
  g.events.push({ kind: 'riftCleared', enemy: arena.legend, shiny: arena.shiny })
}

/** Lava burns the acting player where they stand, unless they're a Fire type. */
export const lavaBurns = (g: Game) => {
  const p = g.player
  if (groundAt(g, p.x, p.y) === 'lava' && !playerTypes(g).includes('fire')) hurtPlayer(g, p.stats.maxHp * LAVA_BURN, undefined, ['fire'], 'lava')
}

/**
 * Runs the arena's ground rule (the tide rises, the edge crumbles), keeps
 * everyone on the floor, burns whoever walks in lava, runs the collapse timer
 * and closes the arena after the loot window.
 */
export const updateArena = (g: Game, dt: number) => {
  const arena = g.rift.arena
  // A player who fainted this tick is on the way out: no win, no collapse.
  if (!arena || arena.fall !== null) return
  if (arena.domain) return updateDomain(g, arena, arena.domain, dt)
  const layout = ARENA_LAYOUTS[arena.legend]
  const before = stepsAt(layout.tide, arena.age) + stepsAt(layout.crumble, arena.age)
  arena.age += dt
  if (stepsAt(layout.tide, arena.age) + stepsAt(layout.crumble, arena.age) > before) {
    shakeScreen(g, 5, 'team')
    g.events.push({ kind: 'quake' })
  }
  const floor = floorAt(layout, stepsAt(layout.crumble, arena.age))
  const holes = holesAt(layout, stepsAt(layout.tide, arena.age))
  // The players keep to what's left of the floor; the legendary flies or swims over the rest.
  for (const p of g.players) keepOnFloor(p, arena, floor, holes, footOf(p))
  const whole = floorAt(layout, 0)
  for (const e of g.enemies) keepOnFloor(e, arena, whole, [], e.radius)
  // Shots break on the edge.
  retain(g.hazards, (h) => onFloor(whole, h.x - arena.x, h.y - arena.y, 4))
  eachPlayer(g, lavaBurns, dt)

  if (arena.loot === null) {
    const boss = g.enemies.find((e) => e.id === arena.bossId)
    if (!boss || boss.dying >= 0) return riftWin(g, arena, boss?.x ?? arena.x, boss?.y ?? arena.y)
    arena.left -= dt
    if (arena.left <= 0) exitArena(g, 'collapse')
    return
  }
  for (const k of g.pickups) k.attracted = true
  arena.loot -= dt
  if (arena.loot <= 0) exitArena(g, 'won')
}

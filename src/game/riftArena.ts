import { retain } from '../engine/math'
import { ARENA_FEET, ARENA_LAYOUTS, type Pt } from '../data/arenas'
import { RIFT, type RiftLegend } from '../data/rifts'
import { floorAt, holesAt, keepOn, onFloor, stepsAt } from './arenaFloor'
import { healPlayer, hurtPlayer } from './combat'
import { dropItem } from './consumables'
import { burst, floatText } from './effects'
import { spawnEnemy } from './enemies'
import { dropMegaStones } from './mega'
import { dropCoins, dropPickup } from './pickups'
import { riftLoot, riftScale, type RiftArena } from './rift'
import { rollShiny } from './shiny'
import { groundAt, playerTypes } from './terrain'
import { COOP } from '../data/coop'
import { MEGAS } from '../data/megas'
import { actAs, inPlay, present } from './players'
import type { Enemy, Game } from './types'

/**
 * The arena behind a rift: a floor with its own shape, scenery and ground
 * rule (`data/arenas.ts`) where the player duels one legendary. Entering sets
 * the world aside (horde, hazards, pickups, props) and leaving puts it back
 * exactly as it was. The run clock keeps going.
 */

/** Seconds of invulnerability when stepping in or out, so nobody lands on a hit. */
const ARRIVAL_IFRAMES = 1.5
/** The horde is pushed this far from the player when they come back. */
const EXIT_CLEARANCE = 64
/** A weather change that came due in the arena waits this long after the way out, so it doesn't land on the loot's news. */
const EXIT_WEATHER_DELAY = 6
/** Lava burns this share of max HP per touch (every half second, the player's i-frames). Fire types walk on it. */
const LAVA_BURN = 0.07

/** Sends the team into `legend`'s arena, centered where the portal was. */
export const enterArena = (g: Game, legend: RiftLegend, x: number, y: number) => {
  const shiny = rollShiny(g.rng, RIFT.shinyOdds)
  const layout = ARENA_LAYOUTS[legend]
  const at = ([dx, dy]: Pt) => ({ x: x + dx, y: y + dy })
  const stash = { enemies: g.enemies, hazards: g.hazards, pickups: g.pickups, props: g.props, bossId: g.bossId }
  g.enemies = []
  g.hazards = []
  g.pickups = []
  g.props = []
  // Homing shots would keep chasing a target that is now set aside.
  for (const a of g.attacks) if (a.motion.kind === 'homing') a.motion.target = null

  const spawn = at(layout.boss)
  const boss = spawnEnemy(g, legend, spawn.x, spawn.y)
  const scale = riftScale(g.time)
  boss.hp = boss.maxHp = Math.round(boss.maxHp * scale.hp)
  boss.damage *= scale.damage
  boss.xp = riftLoot(g.time, shiny).xp
  boss.shiny = shiny
  g.bossId = boss.id

  const start = at(layout.player)
  const team = g.players.filter(present)
  team.forEach((p, i) => {
    p.x = start.x + (i - (team.length - 1) / 2) * COOP.spacing
    p.y = start.y
    p.iframes = Math.max(p.iframes, ARRIVAL_IFRAMES)
  })
  g.flash = 0.9
  g.shake = 9
  const terrain = {
    lake: null,
    solids: layout.solids.map((s, i) => {
      const foot = ARENA_FEET[s.piece]
      return { kind: s.piece, x: x + s.x, y: y + s.y, variant: i, foot: [{ ...foot, x: x + s.x + foot.x, y: y + s.y + foot.y }] }
    }),
  }
  g.rift.arena = { legend, shiny, x, y, left: RIFT.arenaTime, age: 0, bossId: boss.id, loot: null, stash, terrain }
  g.events.push({ kind: 'riftEnter', enemy: legend, shiny })
}

/** Brings the player back to the world they left. `won` decides the toast; the loot was already dropped. */
export const exitArena = (g: Game, outcome: 'won' | 'collapse') => {
  const arena = g.rift.arena
  if (!arena) return
  const { stash } = arena
  if (outcome === 'collapse') {
    const boss = g.enemies.find((e) => e.id === arena.bossId)
    if (boss) burst(g, boss.x, boss.y - boss.radius, { colors: ['#7850c8', '#c8a8f8', '#ffffff'], count: 50, speed: 140, ttl: 0.6 })
  }
  g.enemies = stash.enemies
  g.hazards = stash.hazards
  // Loot still flying toward the player keeps flying.
  g.pickups = [...stash.pickups, ...g.pickups]
  g.props = stash.props
  g.bossId = stash.bossId
  g.rift.arena = null

  for (const p of g.players) {
    if (!present(p)) continue
    for (const e of g.enemies) {
      if (e.dying >= 0) continue
      const dx = e.x - p.x
      const dy = e.y - p.y
      const d2 = dx * dx + dy * dy
      if (d2 >= EXIT_CLEARANCE * EXIT_CLEARANCE) continue
      const d = Math.sqrt(d2) || 1
      e.x = p.x + (dx / d) * EXIT_CLEARANCE
      e.y = p.y + (dy / d) * EXIT_CLEARANCE
    }
    p.iframes = Math.max(p.iframes, ARRIVAL_IFRAMES)
  }
  g.weather.next = Math.max(g.weather.next, g.time + EXIT_WEATHER_DELAY)
  g.flash = 0.6
  g.events.push({ kind: 'riftExit', outcome })
}

/** Keeps a circle on the arena's floor (world coordinates in, arena coordinates for the geometry). */
const keepOnFloor = (o: { x: number; y: number }, arena: RiftArena, floor: Parameters<typeof keepOn>[0], holes: Parameters<typeof keepOn>[1], r: number) => {
  const local = { x: o.x - arena.x, y: o.y - arena.y }
  keepOn(floor, holes, local, r)
  o.x = arena.x + local.x
  o.y = arena.y + local.y
}

/** The legendary fell: drop the rift's loot (and Mega Stones for the lines still without one), heal the team and start the short loot window. */
const win = (g: Game, arena: RiftArena, boss: Enemy | undefined) => {
  const loot = riftLoot(g.time, arena.shiny)
  const x = boss?.x ?? arena.x
  const y = boss?.y ?? arena.y
  dropCoins(g, x, y, loot.coins)
  for (let i = 0; i < loot.pokeballs; i++) dropPickup(g, x - 8 + i * 8, y + 4, 'pokeball')
  loot.items.forEach((item, i) => dropItem(g, x + 10 + i * 6, y, item))
  // A Mega line's first beaten legendary also leaves its Mega Stone (or both, to choose from), one set per line in the team.
  const lines = [...new Set(g.players.filter((p) => present(p) && !p.mega.stone).map((p) => p.starter))]
  lines.forEach((line, i) => {
    if (g.pickups.some((k) => k.kind === 'megaStone' && MEGAS[k.mega].line === line)) return
    const owner = g.players.find((p) => p.starter === line)!
    actAs(g, owner, () => dropMegaStones(g, x + (i - (lines.length - 1) / 2) * 56, y - 10, line))
  })
  for (const p of g.players) {
    if (!inPlay(p)) continue
    const heal = Math.round(actAs(g, p, () => healPlayer(g, p.stats.maxHp * loot.heal)))
    floatText(g, p.x, p.y - 30, `+${heal}`, '#58e858')
  }
  g.hazards.length = 0
  g.rift.cleared.push(arena.legend)
  arena.loot = RIFT.lootTime
  g.events.push({ kind: 'riftCleared', enemy: arena.legend, shiny: arena.shiny })
}

/**
 * Runs the arena's ground rule (the tide rises, the edge crumbles), keeps
 * everyone on the floor, burns whoever walks in lava, runs the collapse timer
 * and closes the arena after the loot window.
 */
export const updateArena = (g: Game, dt: number) => {
  const arena = g.rift.arena
  if (!arena) return
  const layout = ARENA_LAYOUTS[arena.legend]
  const before = stepsAt(layout.tide, arena.age) + stepsAt(layout.crumble, arena.age)
  arena.age += dt
  if (stepsAt(layout.tide, arena.age) + stepsAt(layout.crumble, arena.age) > before) {
    g.shake = Math.max(g.shake, 5)
    g.events.push({ kind: 'quake' })
  }
  const floor = floorAt(layout, stepsAt(layout.crumble, arena.age))
  const holes = holesAt(layout, stepsAt(layout.tide, arena.age))
  // The team keeps to what's left of the floor; the legendary flies or swims over the rest.
  for (const p of g.players) if (present(p)) keepOnFloor(p, arena, floor, holes, p.radius)
  const whole = floorAt(layout, 0)
  for (const e of g.enemies) keepOnFloor(e, arena, whole, [], e.radius)
  // Shots break on the edge.
  retain(g.hazards, (h) => onFloor(whole, h.x - arena.x, h.y - arena.y, 4))
  for (const p of g.players) {
    if (inPlay(p) && groundAt(g, p.x, p.y) === 'lava') actAs(g, p, () => playerTypes(g).includes('fire') || hurtPlayer(g, p.stats.maxHp * LAVA_BURN, undefined, ['fire']))
  }

  if (arena.loot === null) {
    const boss = g.enemies.find((e) => e.id === arena.bossId)
    if (!boss || boss.dying >= 0) return win(g, arena, boss)
    arena.left -= dt
    if (arena.left <= 0) exitArena(g, 'collapse')
    return
  }
  for (const k of g.pickups) k.attracted = true
  arena.loot -= dt
  if (arena.loot <= 0) exitArena(g, 'won')
}

import { clamp, TAU } from '../engine/math'
import { range, weightedPick } from '../engine/rng'
import type { Circle, FloorPlan, Pt } from '../data/arenas'
import { DROP_TABLES, rollDrop } from '../data/consumables'
import { CAVE, PLACE_FEET, PLACE_LOOT } from '../data/places'
import { dropItem } from './consumables'
import { floorShapes, generateFloor, type DungeonFloor } from './dungeon'
import { burst, shakeScreen } from './effects'
import { spawnEnemy } from './enemies'
import { chestCoins } from './mapEventRules'
import { COIN_VALUES } from './meta'
import { awardEgg, dropCoins, dropPickup } from './pickups'
import { placePool, type PlaceInteriorOf } from './place'
import { notifyPlace, solidAt, spawnInPlace, startLoot } from './placeKit'
import { playerTypes, type Solid } from './terrain'
import { anchorPlayer, centerScreen, placeTeam } from './players'
import type { Game, Player } from './types'
import * as dm from '../engine/dmath'

/**
 * The cave, a Mystery Dungeon: dark floors of rooms and corridors
 * (`dungeon.ts`) with stairs down, then a treasure chamber whose chest is
 * guarded by a Monster House. The PMD wind warns three times, then blows the
 * explorer back out. Only a circle of light around the player shows the way
 * (`caveLight`), wider for Fire and Electric types.
 */

export type CaveState = {
  /** 0 is B1F; at `CAVE.floors` the treasure chamber. */
  floor: number
  /** The floor's layout, null in the treasure chamber. */
  plan: DungeonFloor | null
  /** Where the stairs stand, in room px (null in the treasure chamber). */
  stairs: Pt | null
  chest: { x: number; y: number; progress: number; open: boolean } | null
  /** Glowing crystals, in room px: light besides the player's. */
  lights: readonly Pt[]
  /** Wind warnings given so far (up to three). */
  wind: number
  /** The treasure chamber's Monster House has sprung. */
  house: boolean
}

type CaveInside = PlaceInteriorOf<'cave'>

/** The treasure chamber: a round cavern, crystals around its wall and the chest in the middle. */
const CHAMBER = { r: 120, chest: [0, -14] as Pt, start: [0, 94] as Pt, crystals: 7 } as const

/** How far the acting player's light reaches: Fire types carry a flame, Electric types use Flash. */
export const caveLight = (g: Game) => {
  const types = playerTypes(g)
  return types.includes('fire') ? CAVE.fireLight : types.includes('electric') ? CAVE.electricLight : CAVE.light
}

type Floor = { layout: FloorPlan; solids: Solid[]; start: Pt; plan: DungeonFloor | null; stairs: Pt | null; chest: CaveState['chest']; lights: readonly Pt[] }

/** Lays out floor `index` around world (x, y) and puts its items down: a pile of Poké and something from an item ball. */
const layFloor = (g: Game, x: number, y: number, index: number): Floor => {
  if (index >= CAVE.floors) {
    const lights = Array.from({ length: CHAMBER.crystals }, (_, i): Pt => {
      const a = -Math.PI / 2 + ((i + 0.5) / CHAMBER.crystals) * TAU
      return [dm.round(dm.cos(a) * (CHAMBER.r - 16)), dm.round(dm.sin(a) * (CHAMBER.r - 16) * 0.9)]
    }).filter(([lx, ly]) => ly < CHAMBER.r - 40 || Math.abs(lx) > 30)
    const floor: Circle = { kind: 'circle', x: 0, y: 0, r: CHAMBER.r }
    return {
      layout: { floor: [floor] },
      solids: [
        solidAt('chest', PLACE_FEET.chest, x + CHAMBER.chest[0], y + CHAMBER.chest[1]),
        ...lights.map(([lx, ly], i) => solidAt('crystal', PLACE_FEET.crystal, x + lx, y + ly, i)),
      ],
      start: CHAMBER.start,
      plan: null,
      stairs: null,
      chest: { x: CHAMBER.chest[0], y: CHAMBER.chest[1], progress: 0, open: false },
      lights,
    }
  }
  const plan = generateFloor(g.rng, index)
  plan.items.forEach(([ix, iy], i) => {
    if (i === 0) dropCoins(g, x + ix, y + iy, [COIN_VALUES[1], COIN_VALUES[1], COIN_VALUES[0], COIN_VALUES[0]])
    else dropItem(g, x + ix, y + iy, rollDrop(DROP_TABLES.itemBall, g.time, g.rng))
  })
  return {
    layout: { floor: floorShapes(plan) },
    solids: [
      ...plan.crystals.map(([cx, cy], i) => solidAt('crystal', PLACE_FEET.crystal, x + cx, y + cy, i)),
      ...plan.rocks.map(([rx, ry], i) => solidAt('caveRock', PLACE_FEET.caveRock, x + rx, y + ry, i)),
    ],
    start: plan.start,
    plan,
    stairs: plan.stairs,
    chest: null,
    lights: plan.crystals,
  }
}

const stateOf = (f: Floor, floor: number): CaveState => ({ floor, plan: f.plan, stairs: f.stairs, chest: f.chest, lights: f.lights, wind: 0, house: false })

export const buildCave = (g: Game, x: number, y: number) => {
  const f = layFloor(g, x, y, 0)
  return { layout: f.layout, solids: f.solids, start: f.start, state: stateOf(f, 0), intro: CAVE.card }
}

/**
 * Down the stairs: a fresh floor and a fresh cast, the team at its start.
 * Loot still lying around comes along (it flies to a player as they arrive),
 * and the floor's title card holds everything still for a moment.
 */
export const descendCave = (g: Game, inside: CaveInside) => {
  const s = inside.state
  g.enemies = []
  g.hazards = []
  for (const k of g.pickups) k.attracted = true
  const f = layFloor(g, inside.x, inside.y, s.floor + 1)
  const start = f.start
  inside.layout = f.layout
  inside.terrain = { solids: f.solids, lake: null }
  inside.state = { ...stateOf(f, s.floor + 1), wind: s.wind }
  placeTeam(g, inside.x + start[0], inside.y + start[1])
  const p = anchorPlayer(g)
  for (const k of g.pickups) {
    if (!k.attracted) continue
    k.x = p.x + range(g.rng, -20, 20)
    k.y = p.y - 30
  }
  for (const q of g.players) centerScreen(g, q, q.x, q.y)
  inside.intro = CAVE.card
  notifyPlace(g, 'cave', { kind: 'floor', floor: inside.state.floor })
}

/** Whether (x, y) is in some player's light (and its 24 px fringe). */
const inLight = (g: Game, x: number, y: number) => {
  const before = g.player
  let lit = false
  for (const p of g.players) {
    g.player = p
    if (dm.sq(x - p.x) + dm.sq(y - p.y) <= dm.sq(caveLight(g) + 24)) lit = true
  }
  g.player = before
  return lit
}

/** A spot in the dark: in some room (or around the chamber), past every player's light but close enough to come for one of them (they take turns, `anchorPlayer`). */
const darkSpot = (inside: CaveInside) => (g: Game) => {
  const plan = inside.state.plan
  const p = anchorPlayer(g)
  for (let i = 0; i < 4; i++) {
    let x: number
    let y: number
    if (plan) {
      const r = plan.rooms[Math.floor(g.rng() * plan.rooms.length)]!
      x = inside.x + range(g.rng, r.x + 14, r.x + r.w - 14)
      y = inside.y + range(g.rng, r.y + 14, r.y + r.h - 14)
    } else {
      const a = range(g.rng, 0, TAU)
      const d = range(g.rng, 40, CHAMBER.r - 16)
      x = inside.x + dm.cos(a) * d
      y = inside.y + dm.sin(a) * d
    }
    if (!inLight(g, x, y) && dm.sq(x - p.x) + dm.sq(y - p.y) < 380 * 380) return { x, y }
  }
  return null
}

/** The Monster House: wild Pokémon all around the chest at once. */
const springHouse = (g: Game, inside: CaveInside) => {
  inside.state.house = true
  const chest = inside.state.chest
  if (!chest) return
  const count = CAVE.monsterHouse + Math.floor(g.time / 120)
  const offset = range(g.rng, 0, TAU)
  const pool = placePool('cave', g.time)
  for (let i = 0; i < count; i++) {
    const a = offset + (i / count) * TAU
    const d = range(g.rng, 46, 84)
    spawnEnemy(g, weightedPick(g.rng, pool), inside.x + chest.x + dm.cos(a) * d, inside.y + chest.y + dm.sin(a) * d * 0.8)
  }
  shakeScreen(g, 5, { x: inside.x + chest.x, y: inside.y + chest.y })
  notifyPlace(g, 'cave', { kind: 'monsterHouse' })
}

/** The chest opens: ₽, a Poké Ball, items and maybe an egg, then the way out. */
const openChest = (g: Game, inside: CaveInside, chest: NonNullable<CaveState['chest']>) => {
  chest.open = true
  // The chest's art shows it open.
  for (const s of inside.terrain.solids) if (s.kind === 'chest') s.variant = 1
  const x = inside.x + chest.x
  const y = inside.y + chest.y
  const coins = [...chestCoins(g.time), COIN_VALUES[2]]
  dropCoins(g, x, y - 4, coins)
  dropPickup(g, x + 8, y, 'pokeball')
  PLACE_LOOT.cave.forEach((item, i) => dropItem(g, x - 8 + i * 6, y, item))
  awardEgg(g, 'place', x, y)
  burst(g, x, y - 8, { colors: ['#f8d030', '#fff8c0', '#ffffff', '#c08800'], count: 60, speed: 150, ttl: 0.8, gravity: 60 })
  shakeScreen(g, 4, { x, y })
  notifyPlace(g, 'cave', { kind: 'treasure', coins: coins.reduce((a, b) => a + b, 0) })
  startLoot(g, inside)
}

/**
 * Whether `p` stands where the treasure chamber's chest fills, still shut: a
 * lunge stops there (`attacks.ts`), like at a doorway, so a move that keeps
 * carrying the player (Aqua Step's dance) can't hop them off it every time.
 */
export const atCaveChest = (g: Pick<Game, 'place'>, p: Pick<Player, 'x' | 'y' | 'radius'>) => {
  const inside = g.place.inside
  if (inside?.id !== 'cave') return false
  const chest = inside.state.chest
  return chest !== null && !chest.open && dm.sq(p.x - inside.x - chest.x) + dm.sq(p.y - inside.y - chest.y) < dm.sq(CAVE.chestRadius + p.radius)
}

/** Every tick in the cave: the wind's warnings, the stairs, the Monster House, the chest and the dark's spawns. */
export const updateCave = (g: Game, inside: CaveInside, dt: number) => {
  const s = inside.state
  while (s.wind < CAVE.wind.length && inside.left <= CAVE.wind[s.wind]!) {
    s.wind++
    notifyPlace(g, 'cave', { kind: 'wind', level: s.wind })
  }
  // Any player at the stairs takes the team down; any player at the chest opens it.
  const stairs = s.stairs
  if (stairs) {
    for (const p of g.players) if (dm.sq(p.x - inside.x - stairs[0]) + dm.sq(p.y - inside.y - stairs[1]) < dm.sq(CAVE.stairsRadius + p.radius * 0.5)) return descendCave(g, inside)
  }
  const chest = s.chest
  if (chest && !chest.open) {
    if (!s.house) return springHouse(g, inside)
    let near = false
    for (const p of g.players) near ||= dm.sq(p.x - inside.x - chest.x) + dm.sq(p.y - inside.y - chest.y) < dm.sq(CAVE.chestRadius + p.radius)
    const before = chest.progress
    chest.progress = clamp(chest.progress + (near ? dt : -dt * 0.5) / CAVE.chestTime, 0, 1)
    if (chest.progress > before && Math.floor(chest.progress * 5) !== Math.floor(before * 5)) notifyPlace(g, 'cave', { kind: 'chestTick' })
    if (chest.progress >= 1) return openChest(g, inside, chest)
  }
  spawnInPlace(g, inside, dt, darkSpot(inside), s.plan ? 1 : 0.3)
}

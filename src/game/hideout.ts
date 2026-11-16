import type { Circle, FloorPlan, Pt } from '../data/arenas'
import { DROP_TABLES, rollDrop } from '../data/consumables'
import { PLACE_LOOT } from '../data/places'
import { HIDEOUT, type HideoutBoss } from '../data/rocketHideout'
import { range } from '../engine/rng'
import { dropItem } from './consumables'
import { floorShapes, generateFloor, type DungeonFloor } from './dungeon'
import { burst, shakeScreen } from './effects'
import { despawnEnemy, spawnEnemy } from './enemies'
import { COIN_VALUES } from './meta'
import { dropCoins } from './pickups'
import { placeBossScale, type PlaceInteriorOf } from './place'
import { notifyPlace, spawnInPlace, startLoot } from './placeKit'
import { anchorPlayer, centerScreen, placeTeam } from './players'
import type { Solid } from './terrain'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'

/**
 * The Rocket Hideout (`data/rocketHideout.ts`): dungeon floors of the grunts'
 * Shadow Pokémon (`dungeon.ts`'s rooms and corridors, lit: it's a base, not a
 * cave) with stairs down, then the boss's room. There Giovanni speaks (the
 * shell shows his lines from `giovanni` notices), sends his Persian, and once
 * it falls, Shadow Mewtwo in its three phases. Beating Mewtwo is the run's
 * `rocketCleared` event: the shell gives Shadow Mewtwo to the Legend mode
 * (`game/shadow.ts`) and counts the clear (`game/hideoutPass.ts`).
 */

/** Where the lair's fight stands: Giovanni talking, Persian's fight, the pause before Mewtwo, Mewtwo's, and won. */
export type LairStage = 'arrive' | 'persian' | 'between' | 'mewtwo' | 'won'

export type HideoutState = {
  /** 0 is B1F; at `HIDEOUT.floors` the boss's room. */
  floor: number
  plan: DungeonFloor | null
  stairs: Pt | null
  stage: LairStage | null
  /** Seconds the stage's pause has left (Giovanni's lines). */
  wait: number
  bossId: number | null
  /** Shadow Mewtwo's phase last told (its lines). */
  phase: number
}

type HideoutInside = PlaceInteriorOf<'hideout'>

/** Giovanni's lines, as the shell names them (`rocket.hideout.giovanni`). */
export type GiovanniLine = 'arrive' | 'persian' | 'persianDown' | 'mewtwo' | 'phase2' | 'phase3' | 'defeat'

type Floor = { layout: FloorPlan; solids: Solid[]; start: Pt; plan: DungeonFloor | null; stairs: Pt | null }

/** Lays out floor `index` around world (x, y): a dungeon floor with ₽ and an item ball, or the boss's round room. */
const layFloor = (g: Game, x: number, y: number, index: number): Floor => {
  if (index >= HIDEOUT.floors) {
    const floor: Circle = { kind: 'circle', x: 0, y: 0, r: HIDEOUT.lair.r }
    return { layout: { floor: [floor] }, solids: [], start: HIDEOUT.lair.start, plan: null, stairs: null }
  }
  const plan = generateFloor(g.rng, index)
  plan.items.forEach(([ix, iy], i) => {
    if (i === 0) dropCoins(g, x + ix, y + iy, [COIN_VALUES[1], COIN_VALUES[1], COIN_VALUES[0]])
    else dropItem(g, x + ix, y + iy, rollDrop(DROP_TABLES.itemBall, g.time, g.rng))
  })
  return { layout: { floor: floorShapes(plan) }, solids: [], start: plan.start, plan, stairs: plan.stairs }
}

const stateOf = (f: Floor, floor: number): HideoutState => ({
  floor,
  plan: f.plan,
  stairs: f.stairs,
  stage: floor >= HIDEOUT.floors ? 'arrive' : null,
  wait: floor >= HIDEOUT.floors ? HIDEOUT.intro : 0,
  bossId: null,
  phase: 0,
})

export const buildHideout = (g: Game, x: number, y: number) => {
  const f = layFloor(g, x, y, 0)
  return { layout: f.layout, solids: f.solids, start: f.start, state: stateOf(f, 0), intro: HIDEOUT.card }
}

const say = (g: Game, line: GiovanniLine) => notifyPlace(g, 'hideout', { kind: 'giovanni', line })

/** Down the stairs: a fresh floor (the lair at the bottom), the team at its start, the floor's card. */
export const descendHideout = (g: Game, inside: HideoutInside) => {
  g.enemies = []
  g.hazards = []
  for (const k of g.pickups) k.attracted = true
  const f = layFloor(g, inside.x, inside.y, inside.state.floor + 1)
  inside.layout = f.layout
  inside.terrain = { solids: f.solids, lake: null }
  inside.state = stateOf(f, inside.state.floor + 1)
  placeTeam(g, inside.x + f.start[0], inside.y + f.start[1])
  for (const p of g.players) centerScreen(g, p, p.x, p.y)
  inside.intro = HIDEOUT.card
  notifyPlace(g, 'hideout', { kind: 'floor', floor: inside.state.floor })
  if (inside.state.stage === 'arrive') say(g, 'arrive')
}

/** A lair boss leaps in at the far side of the room, grown with the run clock like a place boss. */
const bringBoss = (g: Game, inside: HideoutInside, kind: HideoutBoss) => {
  const x = inside.x + HIDEOUT.lair.boss[0]
  const y = inside.y + HIDEOUT.lair.boss[1]
  const boss = spawnEnemy(g, kind, x, y)
  const scale = placeBossScale(Math.max(g.time, HIDEOUT.bossAt))
  boss.hp = boss.maxHp = dm.round(boss.maxHp * scale.hp)
  boss.damage *= scale.damage
  boss.xp = dm.round(80 + (g.time / 60) * 25)
  inside.state.bossId = boss.id
  g.bossId = boss.id
  burst(g, x, y - 12, kind === 'shadowMewtwo' ? { colors: ['#1c0828', '#4a1478', '#b468f0', '#ffffff'], count: 80, speed: 180, ttl: 0.9 } : { colors: ['#f8e8b0', '#d8b860', '#ffffff'], count: 40, speed: 140, ttl: 0.6 })
  shakeScreen(g, kind === 'shadowMewtwo' ? 10 : 6, { x, y })
  g.flash = kind === 'shadowMewtwo' ? 0.7 : 0.35
  return boss
}

/** Mewtwo fell: ₽, items and the way out; the shell hears the clear. */
const win = (g: Game, inside: HideoutInside, boss: Enemy | undefined) => {
  const x = boss?.x ?? inside.x
  const y = boss?.y ?? inside.y
  dropCoins(g, x, y, [COIN_VALUES[2], COIN_VALUES[2], COIN_VALUES[1]])
  PLACE_LOOT.cave.forEach((item, i) => dropItem(g, x + 10 + i * 6, y, item))
  for (const e of g.enemies) if (e.dying < 0) despawnEnemy(e)
  g.hazards.length = 0
  inside.state.stage = 'won'
  say(g, 'defeat')
  g.events.push({ kind: 'rocketCleared' })
  startLoot(g, inside)
}

/** The boss of the lair still standing, or null once it fell. */
const lairBoss = (g: Game, s: HideoutState) => (s.bossId === null ? null : (g.enemies.find((e) => e.id === s.bossId && e.dying < 0) ?? null))

/** The lair: Giovanni's lines between the bosses, Persian, then Shadow Mewtwo's phases. */
const updateLair = (g: Game, inside: HideoutInside, dt: number) => {
  const s = inside.state
  switch (s.stage) {
    case 'arrive':
      s.wait -= dt
      if (s.wait > 0) return
      say(g, 'persian')
      bringBoss(g, inside, 'giovanniPersian')
      s.stage = 'persian'
      return
    case 'persian':
      if (lairBoss(g, s)) return
      say(g, 'persianDown')
      s.stage = 'between'
      s.wait = HIDEOUT.between
      s.bossId = null
      g.hazards.length = 0
      return
    case 'between':
      s.wait -= dt
      if (s.wait > 0) return
      say(g, 'mewtwo')
      bringBoss(g, inside, 'shadowMewtwo')
      s.stage = 'mewtwo'
      return
    case 'mewtwo': {
      const boss = lairBoss(g, s)
      if (!boss) return win(g, inside, g.enemies.find((e) => e.id === s.bossId))
      const phase = boss.fight?.phase ?? 0
      if (phase > s.phase) {
        s.phase = phase
        say(g, phase >= 2 ? 'phase3' : 'phase2')
      }
      return
    }
    default:
  }
}

/** Dev (`ps.hideout`): skips the lair to `boss`'s fight now (whatever stood there leaves). */
export const stageLair = (g: Game, inside: HideoutInside, boss: HideoutBoss) => {
  for (const e of g.enemies) if (e.dying < 0) despawnEnemy(e)
  g.hazards.length = 0
  inside.state.stage = boss === 'shadowMewtwo' ? 'mewtwo' : 'persian'
  inside.state.phase = 0
  bringBoss(g, inside, boss)
}

/** A spot in one of the floor's rooms, away from the team: where a grunt's Pokémon jumps out. */
const gruntSpot = (inside: HideoutInside) => (g: Game) => {
  const plan = inside.state.plan
  if (!plan) return null
  const p = anchorPlayer(g)
  for (let i = 0; i < 6; i++) {
    const room = plan.rooms[Math.floor(g.rng() * plan.rooms.length) % plan.rooms.length]!
    const x = inside.x + room.x + range(g.rng, 6, Math.max(7, room.w - 6))
    const y = inside.y + room.y + range(g.rng, 6, Math.max(7, room.h - 6))
    const d2 = dm.sq(x - p.x) + dm.sq(y - p.y)
    if (d2 > 80 * 80 && d2 < 300 * 300) return { x, y }
  }
  return null
}

/** A grunt's Pokémon jumps out in a puff of Team Rocket's smoke. */
const smoke = (g: Game) => (e: Enemy) => burst(g, e.x, e.y - 4, { colors: ['#4a1478', '#7a2cc0', '#282028'], count: 10, speed: 40, ttl: 0.5, gravity: -20 })

/** Every tick in the Hideout: grunts on the floors and the stairs down, or the lair's fight. */
export const updateHideout = (g: Game, inside: HideoutInside, dt: number) => {
  const s = inside.state
  if (s.floor >= HIDEOUT.floors) return updateLair(g, inside, dt)
  if (s.stairs) {
    const sx = inside.x + s.stairs[0]
    const sy = inside.y + s.stairs[1]
    if (g.players.some((p) => dm.sq(p.x - sx) + dm.sq(p.y - sy) < dm.sq(12))) return descendHideout(g, inside)
  }
  spawnInPlace(g, inside, dt, gruntSpot(inside), 1, smoke(g))
}

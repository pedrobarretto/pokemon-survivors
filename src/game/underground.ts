import { clamp } from '../engine/math'
import type { ArenaShape, Pt } from '../data/arenas'
import { HIDDEN, PLACE_FEET, UNDERGROUND, type DigFind } from '../data/places'
import { dropItem } from './consumables'
import { burst, shakeScreen } from './effects'
import { EGGS } from './eggs'
import { dropEvoItem, missingEvoItems } from './evoGate'
import { createDwellers, openSpot, updateDwellers, type DwellerRules, type Dwellers } from './hidden'
import { luckyXp, rollDig } from './hiddenRules'
import { COIN_VALUES } from './meta'
import { awardEgg, dropCoins, dropXp } from './pickups'
import type { PlaceInteriorOf } from './place'
import { markCleared, notifyPlace, solidAt, spawnInPlace } from './placeKit'
import { actAs } from './players'
import type { Game } from './types'
import * as dm from '../engine/dmath'

/**
 * The Underground (Diamond and Pearl): a crack in a boulder leads down to a
 * small dig site, a chamber with tunnels to three pockets. Glints in the
 * walls hide treasure: stand at one to dig it up (Exp. Candy, a sphere worth
 * ₽, a Rare Candy, the evolution stone the Pokémon lacks, or Old Amber with
 * an egg inside), but every dig cracks the walls (`UNDERGROUND.crack` off
 * the clock). Diglett pop up out of their holes for a moment, worth a pile
 * of EXP if whacked in time, and Diancie sparkles in the north pocket now and
 * then. When the walls give, the team scrambles back out.
 */

/** A glint in the wall, in room px: `progress` 0 → 1 while a player digs at it. */
export type Glint = { x: number; y: number; progress: number; dug: boolean }

export type UndergroundState = {
  dwellers: Dwellers
  glints: Glint[]
  /** Glints dug this visit. */
  dug: number
  /** Old Amber came up already (once a visit). */
  fossil: boolean
  warned: boolean
}

type UndergroundInside = PlaceInteriorOf<'underground'>

/** The dig site, in room px: the chamber, its tunnels and pockets, the holes, where glints may be, the rocks and the way in. */
const SITE = {
  rooms: [
    { x: 0, y: 0, r: 64 },
    { x: 0, y: -124, r: 32 },
    { x: -122, y: 2, r: 30 },
    { x: 122, y: -14, r: 30 },
    { x: 0, y: 70, r: 26 },
  ],
  tunnels: [
    [[-13, -56], [13, -56], [13, -104], [-13, -104]],
    [[-56, -10], [-56, 14], [-104, 14], [-104, -10]],
    [[56, -14], [104, -26], [104, -2], [56, 10]],
  ] as const satisfies readonly (readonly Pt[])[],
  holes: [[-28, -18], [30, -12], [0, 26], [-10, -120], [-118, 4], [118, -12]] as const satisfies readonly Pt[],
  glints: [[-50, -30], [52, -34], [-46, 36], [44, 40], [-20, -140], [18, -138], [-140, -10], [-128, 22], [138, -26], [130, 8]] as const satisfies readonly Pt[],
  rocks: [[18, 46], [-26, -44]] as const satisfies readonly Pt[],
  rare: [8, -130] as Pt,
  start: [0, 80] as Pt,
} as const

const RULES: DwellerRules = { ...UNDERGROUND, leash: 0, rareLeash: 26, colors: ['#5a4430', '#8a6a48', '#b89470', '#3a2c20'] }

export const buildUnderground = (g: Game, x: number, y: number) => {
  const floor: ArenaShape[] = [
    ...SITE.rooms.map((c): ArenaShape => ({ kind: 'circle', ...c })),
    ...SITE.tunnels.map((pts): ArenaShape => ({ kind: 'poly', pts })),
  ]
  // Six of the glint spots, drawn from the run's rng.
  const spots = [...SITE.glints]
  const glints: Glint[] = []
  while (glints.length < UNDERGROUND.glints && spots.length > 0) {
    const [gx, gy] = spots.splice(Math.floor(g.rng() * spots.length), 1)[0]!
    glints.push({ x: gx, y: gy, progress: 0, dug: false })
  }
  const solids = SITE.rocks.map(([rx, ry], i) => solidAt('caveRock', PLACE_FEET.caveRock, x + rx, y + ry, i))
  markCleared(g, 'underground')
  const state: UndergroundState = { dwellers: createDwellers(g, SITE.holes, SITE.rare, UNDERGROUND.first), glints, dug: 0, fossil: false, warned: false }
  return { layout: { floor }, solids, start: SITE.start, state, intro: HIDDEN.card }
}

/** Base EXP of a dug-up Exp. Candy (ramped by the run clock like the lucky ones). */
const CANDY_XP = 14

/** A glint gives its find to the acting player (the one digging) at world (x, y). */
const unearth = (g: Game, inside: UndergroundInside, x: number, y: number): DigFind => {
  const s = inside.state
  const find = rollDig(g.rng, { stone: missingEvoItems(g).length > 0, fossil: !s.fossil && g.eggs.found.length < EGGS.perRun })
  switch (find) {
    case 'expCandy':
      dropXp(g, x, y, luckyXp(CANDY_XP, g.time))
      break
    case 'sphere':
      dropCoins(g, x, y, [COIN_VALUES[1], COIN_VALUES[1], COIN_VALUES[0], COIN_VALUES[0]])
      break
    case 'rareCandy':
      dropItem(g, x, y, 'rareCandy')
      break
    case 'stone':
      dropEvoItem(g, x, y, 1)
      break
    case 'fossil':
      s.fossil = true
      awardEgg(g, 'fossil', x, y)
      break
  }
  return find
}

/** Digs at the glints players stand at: progress, the pick's clinks, then the find, and the walls crack. */
const dig = (g: Game, inside: UndergroundInside, dt: number) => {
  const s = inside.state
  for (const gl of s.glints) {
    if (gl.dug) continue
    const x = inside.x + gl.x
    const y = inside.y + gl.y
    let digger = null
    for (const p of g.players) if (digger === null && p.hp > 0 && dm.sq(p.x - x) + dm.sq(p.y - y) < dm.sq(UNDERGROUND.digRadius + p.radius)) digger = p
    const before = gl.progress
    gl.progress = clamp(gl.progress + (digger ? dt : -dt * 0.5) / UNDERGROUND.digTime, 0, 1)
    if (gl.progress > before && Math.floor(gl.progress * 4) !== Math.floor(before * 4)) notifyPlace(g, 'underground', { kind: 'digTick' })
    if (gl.progress < 1 || !digger) continue
    gl.dug = true
    s.dug++
    inside.left = Math.max(1, inside.left - UNDERGROUND.crack)
    const was = actAs(g, digger)
    const find = unearth(g, inside, x, y + 6)
    actAs(g, was)
    burst(g, x, y - 4, { colors: ['#8a6a48', '#b89470', '#f8f0c8', '#ffffff'], count: 22, speed: 90, ttl: 0.6, gravity: 120 })
    shakeScreen(g, 3, { x, y })
    notifyPlace(g, 'underground', { kind: 'dug', find })
  }
}

/** Every tick underground: the warning, the glints, the Diglett in their holes, Diancie, a few wild ones. */
export const updateUnderground = (g: Game, inside: UndergroundInside, dt: number) => {
  const s = inside.state
  if (!s.warned && inside.left <= 10) {
    s.warned = true
    notifyPlace(g, 'underground', { kind: 'warn' })
  }
  dig(g, inside, dt)
  updateDwellers(g, inside, s.dwellers, RULES)
  spawnInPlace(g, inside, dt, openSpot(inside, SITE.rooms, 70))
}

/** The rooms (circles) of the dig site, for the minimap and the art. */
export const UNDERGROUND_ROOMS = SITE.rooms

import type { Circle, Pt } from '../data/arenas'
import { GROTTO, HIDDEN } from '../data/places'
import { SOLID_FOOT } from '../data/terrain'
import { createDwellers, openSpot, updateDwellers, type DwellerRules, type Dwellers } from './hidden'
import { dropPickup } from './pickups'
import type { PlaceInteriorOf } from './place'
import { markCleared, notifyPlace, solidAt, spawnInPlace } from './placeKit'
import type { Game } from './types'

/**
 * The Hidden Grotto (Black 2 and White 2): a clearing behind a gap in a
 * thicket, ringed by trees. Patches of tall grass shake, then an Audino pops
 * out (now and then a Chansey or a Blissey), shy and worth a pile of EXP; an
 * item lies in the grass at the back, and sometimes Shaymin comes out of its
 * Gracidea. When the grotto's light fades, the team walks back out.
 */

export type GrottoState = { dwellers: Dwellers; warned: boolean }

type GrottoInside = PlaceInteriorOf<'grotto'>

/** The clearing, in room px: overlapping glades, the trees standing in it, the shaking grass, the Gracidea, the item and where the team comes in. */
const CLEARING = {
  glades: [
    { x: 0, y: 0, r: 78 },
    { x: -78, y: -22, r: 46 },
    { x: 76, y: -38, r: 44 },
    { x: -4, y: -84, r: 34 },
    { x: 6, y: 76, r: 34 },
  ],
  trees: [[-46, -54], [44, 46]] as const satisfies readonly Pt[],
  grass: [[-88, -20], [-34, 26], [48, 12], [14, -50], [70, -60]] as const satisfies readonly Pt[],
  gracidea: [-4, -94] as Pt,
  item: [92, -36] as Pt,
  start: [6, 90] as Pt,
} as const

/** The glades, for spawning on the floor. */
export const GROTTO_GLADES = CLEARING.glades

const RULES: DwellerRules = { ...GROTTO, leash: 220, rareLeash: 220, colors: ['#3c8c34', '#68b048', '#a8d870', '#f8f8c8'] }

export const buildGrotto = (g: Game, x: number, y: number) => {
  const floor = CLEARING.glades.map((c): Circle => ({ kind: 'circle', ...c }))
  const solids = CLEARING.trees.map(([tx, ty], i) => solidAt('tree', [SOLID_FOOT.tree], x + tx, y + ty, i))
  // The grotto's item, lying in the grass like a Hidden Grotto's.
  dropPickup(g, x + CLEARING.item[0], y + CLEARING.item[1], 'pokeball')
  markCleared(g, 'grotto')
  const state: GrottoState = { dwellers: createDwellers(g, CLEARING.grass, CLEARING.gracidea, GROTTO.first), warned: false }
  return { layout: { floor }, solids, start: CLEARING.start, state, intro: HIDDEN.card }
}

/** Every tick in the grotto: the grass shakes and its Pokémon pop out, Shaymin may come, a few wild ones wander in, the light fades. */
export const updateGrotto = (g: Game, inside: GrottoInside, dt: number) => {
  const s = inside.state
  if (!s.warned && inside.left <= 10) {
    s.warned = true
    notifyPlace(g, 'grotto', { kind: 'warn' })
  }
  updateDwellers(g, inside, s.dwellers, RULES)
  spawnInPlace(g, inside, dt, openSpot(inside, CLEARING.glades, 80))
}

/** The light fades: the team walks back out, nothing lost. */
export const grottoDone = () => 'done' as const

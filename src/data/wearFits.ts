import type { WearableSlot } from './arenaCosmetics'
import type { WearableId } from './wearables'

/**
 * Hand fitting for the Arena's wearables, by dex: what the measures of
 * `npm run anchors` (`data/wearAnchors.generated.json`) get wrong for a
 * species. The dev console's `ps.wear('fit', id)` shows the roster wearing an
 * item in every direction, takes nudges from the keyboard and prints the
 * table back in this shape.
 *
 * - `nudge`: px to move a slot's pivot by (right, down), for every direction or per
 *   art direction (`ART_DIRS`); the west-facing rows take the east-facing ones', mirrored.
 * - `size`: a slot's size class (0, 1, 2: `SIZE_CLASSES` in `render/wearModels.ts`) where the measured one is off.
 * - `no`: slots or items the species can't wear well (a flame where the hat goes,
 *   a shell or a tree where a cape hangs): left off, never drawn badly.
 */
export const ART_DIRS = ['S', 'SE', 'E', 'NE', 'N'] as const

export type ArtDirName = (typeof ART_DIRS)[number]

export type Nudge = readonly [number, number]

export type SpeciesFit = {
  nudge?: Partial<Record<WearableSlot, Nudge | Partial<Record<ArtDirName, Nudge>>>>
  size?: Partial<Record<WearableSlot, 0 | 1 | 2>>
  no?: readonly (WearableSlot | WearableId)[]
}

/** What hangs down an upright back: on four legs (or a seal's flippers) it would hang off the side. */
const UPRIGHT = ['cape', 'royalCape', 'backpack', 'jetpack'] as const satisfies readonly WearableId[]

export const WEAR_FITS: Partial<Record<number, SpeciesFit>> = {
  1: { nudge: { head: { S: [0, 3], N: [0, 3] }, face: { S: [0, 3], SE: [0, 2] } }, no: ['back'] }, // Bulbasaur: the bulb rises over its head and fills its back
  2: { nudge: { head: { S: [0, 5], SE: [3, 5], E: [5, 4], NE: [1, 3], N: [0, 3] }, face: { S: [0, 2], SE: [0, 2], E: [0, 1] } }, no: ['back'] }, // Ivysaur: the bud
  3: { no: ['head', 'back'] }, // Venusaur: the flower is where a hat or a cape would go
  6: { no: ['back'] }, // Charizard: its own wings
  9: { no: ['back'] }, // Blastoise: the cannons
  152: { nudge: { head: { S: [0, 7], SE: [0, 4], NE: [0, 3], N: [0, 6] }, face: { S: [0, 3], SE: [0, 2] } }, no: UPRIGHT }, // Chikorita: the leaf
  153: { no: UPRIGHT }, // Bayleef
  154: { no: ['neck', ...UPRIGHT] }, // Meganium: the petals around its neck
  155: { no: ['back'] }, // Cyndaquil: the flames on its back
  156: { no: ['neck', 'back'] }, // Quilava: flames at the neck and the back
  157: { no: ['neck'] }, // Typhlosion: the flame collar
  258: { no: UPRIGHT }, // Mudkip
  387: { no: UPRIGHT }, // Turtwig
  388: { no: ['back'] }, // Grotle: the shrubs on its shell
  389: { no: ['head', 'back'] }, // Torterra: the tree
  497: { no: ['back'] }, // Serperior: no shoulders to hang anything from
  498: { no: UPRIGHT }, // Tepig
  503: { no: UPRIGHT }, // Samurott
  652: { no: ['back'] }, // Chesnaught: the shell
  653: { no: UPRIGHT }, // Fennekin
  657: { no: ['neck'] }, // Frogadier: the bubbles at its neck
  658: { no: ['neck'] }, // Greninja: its tongue is already a scarf
  722: { no: UPRIGHT }, // Rowlet
  724: { nudge: { head: { E: [-6, 3] }, face: { E: [-5, 1] } }, no: ['back'] }, // Decidueye: the beak sticks out of the hood, the cloak is its own
  725: { no: UPRIGHT }, // Litten
  726: { no: UPRIGHT }, // Torracat
  728: { no: UPRIGHT }, // Popplio
  729: { no: UPRIGHT }, // Brionne
  730: { nudge: { head: { NE: [-9, 3] } }, no: UPRIGHT }, // Primarina: the ponytail
  816: { no: UPRIGHT }, // Sobble
  911: { nudge: { head: { E: [6, 2] } }, no: UPRIGHT }, // Skeledirge: the head leads its long body
}

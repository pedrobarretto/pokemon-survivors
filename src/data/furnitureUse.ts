/**
 * What a piece of furniture does when a trainer uses it in the Poké Realm,
 * Habbo style (`FurnitureDef.use`, `data/furniture.ts`): sit on it, switch it
 * on and off, or play music on it. Import-free, like `net/realm.ts`: the realm
 * relay checks every use against the same data (`relay/src/realm.ts`).
 *
 * - `sit`: its seats, each where the trainer goes (px from the footprint's
 *   top-left, the piece unturned), the way it faces and its pose: `sit`
 *   (on a chair, a sofa, a bench), `lie` (tucked into a bed, a hammock) or
 *   `soak` (in a tub). A turned piece turns its seats with it (`seatsOf`).
 * - `toggle`: a light (`lamp`), a screen or a fire that lights up, glowing
 *   from `glow` (px from the bottom middle of its art, which stands on the
 *   bottom middle of its footprint).
 * - `music`: plays the room's music, track by track through `JUKEBOX`, the
 *   last one stopping it.
 *
 * A base's lights and music are the room's while someone is in it (the relay
 * keeps them, never the base's saved layout): the next visit finds the room
 * as its art draws it.
 */

/** The 8 facings, as `net/realm.ts`'s `Facing` (0 down, then clockwise as seen from above: 2 right, 4 up, 6 left). */
export type SeatFacing = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

export const SEAT_POSES = ['sit', 'lie', 'soak'] as const

export type SeatPose = (typeof SEAT_POSES)[number]

/** A place to sit on a piece: px from its footprint's top-left (unturned), where the seat's front edge runs (the trainer sinks behind it). */
export type Seat = { x: number; y: number; facing: SeatFacing; pose: SeatPose }

/** How a lit piece shines: a lamp's warm light, a screen's flicker, a fire's. */
export type GlowLook = 'lamp' | 'screen' | 'fire'

export type FurnitureUse = { sit: readonly Seat[] } | { toggle: GlowLook; glow: readonly [dx: number, dy: number] } | { music: true }

/** The tracks a music piece plays through, in order (`ThemeId`s of `data/music.ts`; a test holds them to it). */
export const JUKEBOX = ['menu', 'forest', 'beach', 'snow', 'desert', 'tower', 'lugia', 'rayquaza'] as const

/** One seat at `x` across a piece, its front edge at `y`. */
const one = (x: number, y: number, pose: SeatPose = 'sit'): FurnitureUse => ({ sit: [{ x, y, facing: 0, pose }] })

/** The uses the catalog shares (`data/furniture.ts` and `furnitureSets/`). */
export const USE = {
  /** A chair, a stool, an armchair or a bean bag (1 × 1). */
  chair: one(12, 14),
  stool: one(12, 12),
  /** A two-seat sofa (2 × 1). */
  sofa: { sit: [{ x: 15, y: 14, facing: 0, pose: 'sit' }, { x: 33, y: 14, facing: 0, pose: 'sit' }] },
  /** The Snorlax bean bag (2 × 2): one sits on its belly. */
  beanbag: one(24, 32),
  /** A bed (2 × 3): tucked in under the blanket, the head on the pillow. */
  bed: one(24, 24, 'lie'),
  hammock: one(36, 12, 'lie'),
  bathtub: one(22, 14, 'soak'),
  /** The hot tub (2 × 2): two can soak. */
  hotTub: { sit: [{ x: 16, y: 30, facing: 0, pose: 'soak' }, { x: 32, y: 30, facing: 0, pose: 'soak' }] },
  music: { music: true },
} as const satisfies Record<string, FurnitureUse>

/** A light: `toggle` with its glow's spot. */
export const light = (look: GlowLook, dx: number, dy: number): FurnitureUse => ({ toggle: look, glow: [dx, dy] })

/** A footprint (tiles), turned or not (a quarter: w and h swap) when the piece turns. */
export const turnedSize = (size: readonly [number, number], turns: boolean, turned: boolean): readonly [w: number, h: number] => (turned && turns ? [size[1], size[0]] : size)

/**
 * A piece's seats as placed (px from its footprint's top-left): a turned
 * piece's art turns a quarter clockwise (`render/base.ts`), and its seats
 * with it, each facing a quarter round too (down becomes left).
 */
export const seatsOf = (use: FurnitureUse | undefined, size: readonly [number, number], turned: boolean, tile: number): readonly Seat[] => {
  if (!use || !('sit' in use)) return []
  if (!turned) return use.sit
  const h = size[1] * tile
  return use.sit.map((s) => ({ ...s, x: h - s.y, y: s.x, facing: ((s.facing + 6) % 8) as SeatFacing }))
}

/** A base piece's key on the wire and in the room's state: its tile and id (a floor piece and the lamp on it share a tile, never an id). */
export const pieceKey = (p: { id: string; x: number; y: number }) => `${p.x},${p.y},${p.id}`

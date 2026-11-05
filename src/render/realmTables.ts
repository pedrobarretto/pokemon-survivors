import type { Point, Spot } from '../data/realmMap'
import type { Facing } from '../net/realm'
import type { TableView } from '../net/realmTables'
import { blitCentered, context2d, fromStrings, lazy, type PixelSprite } from '../engine/pixelart'

/**
 * The realm's game tables in the town (`ui/realm.ts` draws them): where the
 * trainers sitting at one are drawn (on its stools, facing the board), and
 * the little bubble over a table in use, so a room shows at a glance where a
 * match is on and where a seat waits for an opponent.
 */

/** A seat at a table: where its trainer's feet go, which way it faces, and where it sorts among the room's pieces. */
export type TableSeat = Point & { facing: Facing; sortY: number }

/**
 * A table spot's two seats. The café's round tables (the spot stands in
 * front of the table's feet) seat on their side stools; a base's game table
 * (its spot in front of the piece, `gameSpots`) at its two ends.
 */
export const tableSeats = (spot: Spot, town: boolean): readonly [TableSeat, TableSeat] => {
  const { x, y } = spot.at
  return town
    ? [
        { x: x - 17, y: y - 34, facing: 2, sortY: y - 17 },
        { x: x + 16, y: y - 34, facing: 6, sortY: y - 17 },
      ]
    : [
        { x: x - 30, y: y - 12, facing: 2, sortY: y - 5 },
        { x: x + 30, y: y - 12, facing: 6, sortY: y - 5 },
      ]
}

/** Every seated trainer of the room's tables: avatar id → its seat. */
export const seatedAt = (tables: ReadonlyMap<string, TableView>, spots: readonly Spot[], town: boolean): Map<number, TableSeat> => {
  const out = new Map<number, TableSeat>()
  for (const spot of spots) {
    const tb = spot.kind === 'gameTable' && spot.id ? tables.get(spot.id) : undefined
    if (!tb) continue
    const seats = tableSeats(spot, town)
    tb.seats.forEach((id, i) => {
      const seat = seats[i]
      if (id !== null && seat) out.set(id, seat)
    })
  }
  return out
}

/** The bubble the icons sit in (11 × 13, the emotes' shape, `render/realmScene.ts`). */
const BUBBLE = ['..1111111..', '.122222221.', '12222222221', '12222222221', '12222222221', '12222222221', '12222222221', '12222222221', '12222222221', '.122222221.', '..1112111..', '....121....', '.....1.....']

/** A match on: a Poké Ball and a Great Ball side by side. */
const PLAYING = ['.r...u.', 'rrr.uuu', 'kkk.kkk', 'www.www', '.w...w.']
/** A seat free: a Poké Ball and an empty, dotted place for the rival. */
const WAITING = ['.r...d.', 'rrr.d.d', 'kkk....', 'www.d.d', '.w...d.']

const ICON_PALETTE = { r: '#e84038', u: '#3870e0', k: '#283040', w: '#f8f8f8', d: '#8890a8' }

const MARKERS = lazy(() => {
  const build = (rows: readonly string[]): PixelSprite => {
    const sprite = fromStrings(BUBBLE, { 1: '#283040', 2: '#f8f8f8' })
    context2d(sprite).drawImage(fromStrings(rows, ICON_PALETTE), 2, 3)
    return sprite
  }
  return { playing: build(PLAYING), waiting: build(WAITING) }
})

/**
 * The bubble over a table in use (`tb`) at `spot`, camera at (`camX`,
 * `camY`), `now` the drawing clock (s): a match on, or a seat free (that
 * one bobs, calling someone over).
 */
export const drawTableMarker = (ctx: CanvasRenderingContext2D, spot: Spot, tb: TableView, town: boolean, camX: number, camY: number, now: number) => {
  const waiting = tb.seats.includes(null)
  const bob = waiting ? Math.round(Math.sin(now * 4) + 1) : 0
  const top = town ? spot.at.y - 66 : spot.at.y - 40
  blitCentered(ctx, waiting ? MARKERS().waiting : MARKERS().playing, Math.round(spot.at.x - camX), Math.round(top - camY - bob))
}

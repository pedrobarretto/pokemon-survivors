import { describe, expect, it } from 'vitest'
import { FURNITURE, FURNITURE_IDS, footprint, turnOf } from '../data/furniture'
import { JUKEBOX, pieceKey, seatsOf } from '../data/furnitureUse'
import { BASE_GRID, REALM_ROOMS, type Spot } from '../data/realmMap'
import { DOOR, EMPTY_BASE, checkLayout, type BaseLayout } from '../data/secretBases'
import { actionOf, freeSeat, onASeat, pieceAt, roomTheme, trackTheme, usePieces } from './pieces'

const TILE = BASE_GRID.tile
const layout = (items: BaseLayout['items']): BaseLayout => ({ ...EMPTY_BASE, items })

describe('the furniture’s uses', () => {
  it('seat only on floor pieces, every seat inside its footprint, turned or not', () => {
    for (const id of FURNITURE_IDS) {
      const def = FURNITURE[id]
      if (!def.use || !('sit' in def.use)) continue
      expect(def.kind, id).toBe('floor')
      for (const turned of turnOf(id) ? [false, true] : [false]) {
        const [w, h] = footprint(id, turned)
        for (const s of seatsOf(def.use, def.size, turned ? turnOf(id) : null, TILE)) {
          expect(s.x, id).toBeGreaterThanOrEqual(0)
          expect(s.x, id).toBeLessThanOrEqual(w * TILE)
          expect(s.y, id).toBeGreaterThanOrEqual(0)
          expect(s.y, id).toBeLessThanOrEqual(h * TILE)
        }
      }
    }
  })

  it('plays only the game’s own themes', () => {
    expect(JUKEBOX.map((_, i) => trackTheme(i))).not.toContain(null)
    expect(trackTheme(JUKEBOX.length)).toBeNull()
  })
})

describe('a room’s pieces', () => {
  it('seats a turned bed across its turned footprint, facing a quarter round', () => {
    const [bed] = usePieces('base:misty', layout([{ id: 'pikachuBed', x: 2, y: 3, turned: true }]))
    expect(bed!.box).toEqual({ x: 2 * TILE, y: 3 * TILE, w: 3 * TILE, h: 2 * TILE })
    expect(bed!.seats).toEqual([{ x: 2 * TILE + 3 * TILE - 24, y: 3 * TILE + 24, facing: 6, pose: 'lie' }])
  })

  it('seats a turned sofa mirrored across the same footprint, facing the other way', () => {
    const [plain] = usePieces('base:misty', layout([{ id: 'cozySofa', x: 4, y: 4, turned: false }]))
    const [sofa] = usePieces('base:misty', layout([{ id: 'cozySofa', x: 4, y: 4, turned: true }]))
    expect(sofa!.box).toEqual(plain!.box)
    expect(sofa!.mirrored).toBe(true)
    const right = plain!.box.x + plain!.box.w
    expect(sofa!.seats.map((s) => s.x)).toEqual(plain!.seats.map((s) => plain!.box.x + right - s.x))
    expect(seatsOf({ sit: [{ x: 4, y: 10, facing: 2, pose: 'sit' }, { x: 4, y: 10, facing: 1, pose: 'sit' }] }, [1, 1], 'mirror', TILE).map((s) => [s.x, s.facing])).toEqual([[TILE - 4, 6], [TILE - 4, 7]])
  })

  it('leaves a piece that never turns as it is', () => {
    const [still] = usePieces('base:misty', layout([{ id: 'hotTub', x: 4, y: 4, turned: true }]))
    const [plain] = usePieces('base:misty', layout([{ id: 'hotTub', x: 4, y: 4, turned: false }]))
    expect(still).toEqual({ ...plain, ref: { ...plain!.ref, turned: true } })
  })

  it('makes the town’s benches pieces with their seats, and leaves out pieces that do nothing', () => {
    const spots: readonly Spot[] = REALM_ROOMS.cafe.spots
    const benches = spots.filter((s) => s.seats)
    expect(usePieces('cafe', null)).toHaveLength(benches.length)
    expect(usePieces('base:misty', layout([{ id: 'woodTable', x: 2, y: 3, turned: false }]))).toEqual([])
  })

  it('takes the nearest free seat, and none on a full sofa', () => {
    const [sofa] = usePieces('base:misty', layout([{ id: 'cozySofa', x: 4, y: 4, turned: false }]))
    const [left, right] = sofa!.seats
    expect(freeSeat(sofa!, [], right!.x + 10, right!.y)).toBe(1)
    expect(freeSeat(sofa!, [right!], right!.x + 10, right!.y)).toBe(0)
    expect(freeSeat(sofa!, [left!, right!], 0, 0)).toBeNull()
    expect(actionOf(sofa!, null, [left!, right!], 0, 0)).toBe('taken')
  })

  it('switches a light and steps a music piece through its tracks to off', () => {
    const lamp = { id: 'floorLamp', x: 1, y: 3, turned: false } as const
    const box = { id: 'jukebox', x: 5, y: 3, turned: false } as const
    const [l, j] = usePieces('base:misty', layout([lamp, box]))
    expect(actionOf(l!, null, [], 0, 0)).toBe('on')
    expect(actionOf(l!, { lit: [pieceKey(lamp)], music: null }, [], 0, 0)).toBe('off')
    expect(actionOf(j!, null, [], 0, 0)).toBe('play')
    expect(actionOf(j!, { lit: [], music: { piece: pieceKey(box), track: 0 } }, [], 0, 0)).toBe('next')
    expect(actionOf(j!, { lit: [], music: { piece: pieceKey(box), track: JUKEBOX.length - 1 } }, [], 0, 0)).toBe('stop')
  })

  it('plays a base’s music only from a music piece this layout holds', () => {
    const pieces = usePieces('base:misty', layout([{ id: 'piano', x: 3, y: 3, turned: false }]))
    expect(roomTheme(pieces, { lit: [], music: { piece: '3,3,piano', track: 1 } })).toBe(JUKEBOX[1])
    expect(roomTheme(pieces, { lit: [], music: { piece: '6,3,jukebox', track: 1 } })).toBeNull()
  })

  it('keeps a trainer seated beside the door on its seat, and only there', () => {
    const beside = layout([{ id: 'cozyArmchair', x: DOOR.x - 1, y: DOOR.y, turned: true }])
    expect(checkLayout(beside, { cozyArmchair: 1 })).toBeNull()
    const pieces = usePieces('base:misty', beside)
    const [seat] = pieces[0]!.seats
    expect(onASeat(pieces, seat!.x + 0.3, seat!.y)).toBe(true)
    expect(onASeat(pieces, seat!.x + 6, seat!.y)).toBe(false)
  })

  it('hits the frontmost piece a tap lands on', () => {
    const pieces = usePieces('base:misty', layout([{ id: 'cozySofa', x: 4, y: 4, turned: false }, { id: 'floorLamp', x: 4, y: 5, turned: false }]))
    expect(pieceAt(pieces, 4 * TILE + 6, 5 * TILE + 2)?.id).toBe('floorLamp')
    expect(pieceAt(pieces, 5 * TILE + 6, 4 * TILE + 12)?.id).toBe('cozySofa')
    expect(pieceAt(pieces, 0, 0)).toBeNull()
  })
})

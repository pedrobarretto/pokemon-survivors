import { describe, expect, it } from 'vitest'
import { BASE_GRID } from './realmMap'
import { DOOR, checkLayout, parseLayout, type BaseLayout, type Placed } from './secretBases'

const base = (items: Placed[], extra: Partial<BaseLayout> = {}): BaseLayout => ({ exterior: 'cave', wallpaper: null, flooring: null, items, ...extra })
const at = (id: Placed['id'], x: number, y: number, turned = false): Placed => ({ id, x, y, turned })

describe('checkLayout', () => {
  it('takes a furnished room', () => {
    const layout = base([at('woodTable', 2, 3), at('candle', 2, 3), at('pokeBallRug', 2, 3), at('regionMap', 0, 0)])
    expect(checkLayout(layout, { woodTable: 1, candle: 1, pokeBallRug: 1, regionMap: 1 })).toBeNull()
  })

  it('counts repeats against what is owned', () => {
    expect(checkLayout(base([at('woodChair', 2, 3), at('woodChair', 4, 3)]), { woodChair: 1 })).toEqual({ error: 'owned', item: 1 })
  })

  it('keeps each kind where it goes', () => {
    expect(checkLayout(base([at('woodChair', 2, 0)]), { woodChair: 1 })).toEqual({ error: 'bounds', item: 0 })
    expect(checkLayout(base([at('regionMap', 2, 4)]), { regionMap: 1 })).toEqual({ error: 'bounds', item: 0 })
    expect(checkLayout(base([at('woodTable', BASE_GRID.cols - 1, 3)]), { woodTable: 1 })).toEqual({ error: 'bounds', item: 0 })
  })

  it('turns a piece that turns', () => {
    expect(checkLayout(base([at('woodTable', BASE_GRID.cols - 1, 3, true)]), { woodTable: 1 })).toBeNull()
  })

  it('refuses floors on floors, but lets a rug lie under them', () => {
    const owned = { woodChair: 2, pokeBallRug: 1 }
    expect(checkLayout(base([at('woodChair', 3, 3), at('woodChair', 3, 3)]), owned)).toEqual({ error: 'overlap', item: 1 })
    expect(checkLayout(base([at('pokeBallRug', 3, 3), at('woodChair', 3, 3)]), owned)).toBeNull()
  })

  it('needs a surface under a top', () => {
    expect(checkLayout(base([at('candle', 3, 3)]), { candle: 1 })).toEqual({ error: 'support', item: 0 })
  })

  it('keeps the door clear', () => {
    expect(checkLayout(base([at('pottedPlant', DOOR.x, DOOR.y - 1)]), { pottedPlant: 1 })).toEqual({ error: 'door', item: 0 })
    expect(checkLayout(base([at('pokeBallRug', DOOR.x - 1, DOOR.y - 2)]), { pokeBallRug: 1 })).toBeNull()
  })

  it('only dresses the room with an owned style of the right kind', () => {
    expect(checkLayout(base([], { wallpaper: 'leafWallpaper' }), {})).toEqual({ error: 'style' })
    expect(checkLayout(base([], { wallpaper: 'plankFloor' }), { plankFloor: 1 })).toEqual({ error: 'style' })
    expect(checkLayout(base([], { wallpaper: 'leafWallpaper', flooring: 'plankFloor' }), { leafWallpaper: 1, plankFloor: 1 })).toBeNull()
  })
})

describe('parseLayout', () => {
  it('drops what it does not know', () => {
    const parsed = parseLayout({ exterior: 'moon', wallpaper: 'nope', items: [{ id: 'woodChair', x: 1, y: 3 }, { id: 'ghost', x: 0, y: 0 }, 'x'] })
    expect(parsed).toEqual({ exterior: 'cave', wallpaper: null, flooring: null, items: [{ id: 'woodChair', x: 1, y: 3, turned: false }] })
  })
})

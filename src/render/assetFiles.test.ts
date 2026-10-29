import { describe, expect, it } from 'vitest'
import { ITEMS } from '../data/items'
import { EVO_ITEM_IDS } from '../data/shop'
import { POKE_TYPES } from '../data/types'
import { BAG_ITEMS } from '../game/bag'
import { CONSUMABLES } from '../game/consumables'
import { UPGRADES } from '../game/meta'
import { tmArtId } from './art'
import { ARENA_ICONS, valeArtFiles } from './arenaArt'
import { sceneryFiles } from './scenery'

const names = (paths: Record<string, unknown>) => new Set(Object.keys(paths).map((p) => p.slice(p.lastIndexOf('/') + 1, -4)))
const items = names(import.meta.glob('../../public/assets/items/*.png'))
const shopArt = names(import.meta.glob('../../public/assets/shop/icons/*.png'))
const scenery = names(import.meta.glob('../../public/assets/scenery/*.png'))
const arena = new Set([...names(import.meta.glob('../../public/assets/arena/*.png')), ...[...names(import.meta.glob('../../public/assets/arena/coast/*.png'))].map((n) => `coast/${n}`)])
const arenaIcons = names(import.meta.glob('../../public/assets/arena/icons/*.png'))

describe('picture files', () => {
  it('has an icon for every held item, upgrade, consumable and Bag item', () => {
    expect(Object.keys({ ...ITEMS, ...UPGRADES, ...CONSUMABLES, ...BAG_ITEMS }).filter((id) => !items.has(id))).toEqual([])
  })

  it('has an icon for every evolution item, Bottle Cap and type of TM the shop sells', () => {
    const shop = [...EVO_ITEM_IDS, 'bottleCap', 'goldBottleCap', ...POKE_TYPES.map(tmArtId)]
    expect(shop.filter((id) => !items.has(id))).toEqual([])
  })

  it('keeps PixelLab icons only for the shop things that are not game items', () => {
    expect([...shopArt].sort()).toEqual(['expansion', 'gift', 'kecleonEgg', 'stamp', 'wishlist'])
  })

  it('has every painted scenery piece', () => {
    expect(sceneryFiles().filter((file) => !scenery.has(file))).toEqual([])
  })

  it('has every Arena picture and icon, and no stray ones', () => {
    expect([...arena].sort()).toEqual(valeArtFiles().sort())
    expect([...arenaIcons].sort()).toEqual(Object.values(ARENA_ICONS).sort())
  })
})

import { assetImage, assetUrl } from '../assets'
import { MAX_CAPS } from '../data/shop'
import { context2d, createCanvas } from '../engine/pixelart'
import { MOVES } from '../game/moves'
import type { ShelfTm } from '../game/tmShelf'
import { itemArt, moveIcon, tmArtId, type ItemArtId } from '../render/art'
import { h } from './dom'

/**
 * Shop things that aren't game items keep their PixelLab icons (32×32,
 * `public/assets/shop/icons/`): the daily gift, the shop's expansion, the
 * wishlist's heart, the loyalty card's stamp and the Kecleon Egg.
 */
const SHOP_ART = ['gift', 'expansion', 'wishlist', 'stamp', 'kecleonEgg'] as const

export type ShopArtId = (typeof SHOP_ART)[number]

/** What `shopIcon` shows: a game item (its official sprite, `itemArt`) or one of the shop's own icons. */
export type ShopIconId = ItemArtId | ShopArtId

const isShopArt = (id: ShopIconId): id is ShopArtId => SHOP_ART.some((art) => art === id)

export const shopArtUrl = (id: ShopArtId) => assetUrl(`shop/icons/${id}.png`)

/** Official sprites centered on 32 px squares (data URLs), by file: made once each, as they load. */
const squared = new Map<string, Promise<string>>()

/**
 * An item's official sprite (15 to 31 px, trimmed) centered on a 32 px square,
 * so the shop's CSS scales it in whole multiples of 32 like its own icons and
 * every item keeps its size from the games.
 */
const squaredArt = (url: string) => {
  let made = squared.get(url)
  if (!made) {
    const img = assetImage(url)
    made = img.decode().then(() => {
      const size = Math.max(32, img.naturalWidth, img.naturalHeight)
      const canvas = createCanvas(size, size)
      context2d(canvas).drawImage(img, Math.floor((size - img.naturalWidth) / 2), Math.floor((size - img.naturalHeight) / 2))
      const data = canvas.toDataURL()
      canvas.width = canvas.height = 0
      return data
    })
    squared.set(url, made)
  }
  return made
}

/**
 * A shop icon as an `<img>` (the shop's cards, the Bag's slots, the ranking's
 * rows, the toasts); CSS sizes it in whole multiples of 32 px (`.shop-icon`), pixelated.
 */
export const shopIcon = (id: ShopIconId, label = '') => {
  const el = h('img', { alt: label, class: 'shop-icon', width: 32, height: 32, draggable: 'false' })
  if (isShopArt(id)) el.src = shopArtUrl(id)
  else void squaredArt(itemArt(id)).then((src) => (el.src = src), () => (el.src = itemArt(id)))
  return el
}

/** A TM's picture: the disc in its move type's color with the move's icon pinned on its corner. */
export const tmPicture = (id: ShelfTm) => h('span', { class: 'shop-tm' }, shopIcon(tmArtId(MOVES[id].type)), h('img', { src: moveIcon(id), alt: '', class: 'shop-tm-move', draggable: 'false' }))

/** Pips for a Pokémon's Bottle Cap level: the partner select's cells and the caps picker show them. */
export const capPips = (level: number) => h('span', { class: 'cap-pips', 'aria-hidden': 'true' }, ...Array.from({ length: MAX_CAPS }, (_, i) => h('i', { class: i < level ? 'on' : '' })))

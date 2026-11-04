import type { FurnitureDef } from '../furniture'

/**
 * The home collections (`classic`, `cozy`, `elegant`, `modern`, `pop`,
 * `garden`, `aqua`, `arcade`, `kitchen`): tables, chairs, sofas, shelves,
 * plants, lamps, rugs, wallpapers and floorings in every material and color,
 * and the Club Penguin / Habbo classics. Spread into `FURNITURE`; each piece's
 * name in i18n `furniture.names`, its art `public/assets/furniture/<id>.png`.
 *
 * Mostly ₽ (the economy's sink); the showpieces in gems at their rarity's
 * price (`RARITY_PRICE`). A sofa or a dresser is drawn from the front, so it
 * doesn't turn; wallpapers and floorings are 24 px tiles the room repeats.
 */

/** The day this batch first shows at the carpentry (its NOVO tag). */
const DROP = '2026-11-04'

export const HOME_FURNITURE = {
  // Classic: dark wood and brass.
  grandfatherClock: { kind: 'floor', set: 'classic', size: [1, 1], rarity: 'common', price: { coins: 4000 }, blocks: true, from: DROP },
  telescope: { kind: 'floor', set: 'classic', size: [1, 1], rarity: 'common', price: { coins: 6000 }, blocks: true, from: DROP },
  woodDresser: { kind: 'floor', set: 'classic', size: [2, 1], rarity: 'common', price: { coins: 3500 }, blocks: true, surface: true, from: DROP },
  pineTallboy: { kind: 'floor', set: 'classic', size: [1, 1], rarity: 'common', price: { coins: 3000 }, blocks: true, surface: true, from: DROP },
  stripedRug: { kind: 'rug', set: 'classic', size: [3, 2], rarity: 'common', price: { coins: 3500 }, from: DROP },
  welcomeMat: { kind: 'rug', set: 'classic', size: [2, 1], rarity: 'common', price: { coins: 1200 }, from: DROP },
  stripedWallpaper: { kind: 'wallpaper', set: 'classic', size: [1, 1], rarity: 'common', price: { coins: 5000 }, from: DROP },
  herringboneFloor: { kind: 'flooring', set: 'classic', size: [1, 1], rarity: 'common', price: { coins: 5000 }, from: DROP },
  // Cozy: warm fabric and timber.
  cozySofa: { kind: 'floor', set: 'cozy', size: [2, 1], rarity: 'common', price: { coins: 6000 }, blocks: true, from: DROP },
  cabinClock: { kind: 'floor', set: 'cozy', size: [1, 1], rarity: 'common', price: { coins: 4500 }, blocks: true, from: DROP },
  plaidWallpaper: { kind: 'wallpaper', set: 'cozy', size: [1, 1], rarity: 'common', price: { coins: 5000 }, from: DROP },
  carpetFloor: { kind: 'flooring', set: 'cozy', size: [1, 1], rarity: 'common', price: { coins: 5000 }, from: DROP },
  // Elegant: velvet, mahogany, gold and marble.
  velvetSofa: { kind: 'floor', set: 'elegant', size: [2, 1], rarity: 'rare', price: { gems: 250 }, blocks: true, from: DROP },
  goldClock: { kind: 'floor', set: 'elegant', size: [1, 1], rarity: 'epic', price: { gems: 550 }, blocks: true, from: DROP },
  mahoganyDrawers: { kind: 'floor', set: 'elegant', size: [1, 1], rarity: 'common', price: { coins: 4000 }, blocks: true, surface: true, from: DROP },
  royalRug: { kind: 'rug', set: 'elegant', size: [3, 2], rarity: 'common', price: { coins: 8000 }, from: DROP },
  damaskWallpaper: { kind: 'wallpaper', set: 'elegant', size: [1, 1], rarity: 'common', price: { coins: 6000 }, from: DROP },
  marbleFloor: { kind: 'flooring', set: 'elegant', size: [1, 1], rarity: 'rare', price: { gems: 250 }, from: DROP },
  // Modern: gray, white and black.
  modernSofa: { kind: 'floor', set: 'modern', size: [2, 1], rarity: 'common', price: { coins: 6000 }, blocks: true, from: DROP },
  whiteDresser: { kind: 'floor', set: 'modern', size: [2, 1], rarity: 'common', price: { coins: 3500 }, blocks: true, surface: true, from: DROP },
  blackDrawers: { kind: 'floor', set: 'modern', size: [1, 1], rarity: 'common', price: { coins: 3000 }, blocks: true, surface: true, from: DROP },
  whiteTileFloor: { kind: 'flooring', set: 'modern', size: [1, 1], rarity: 'common', price: { coins: 5000 }, from: DROP },
  // Pop: candy colors.
  popSofaPink: { kind: 'floor', set: 'pop', size: [2, 1], rarity: 'common', price: { coins: 6500 }, blocks: true, from: DROP },
  popSofaTeal: { kind: 'floor', set: 'pop', size: [2, 1], rarity: 'common', price: { coins: 6500 }, blocks: true, from: DROP },
  popSofaYellow: { kind: 'floor', set: 'pop', size: [2, 1], rarity: 'common', price: { coins: 6500 }, blocks: true, from: DROP },
  redDresser: { kind: 'floor', set: 'pop', size: [2, 1], rarity: 'common', price: { coins: 3500 }, blocks: true, surface: true, from: DROP },
  checkerRug: { kind: 'rug', set: 'pop', size: [2, 2], rarity: 'common', price: { coins: 3000 }, from: DROP },
  roundRugPink: { kind: 'rug', set: 'pop', size: [2, 2], rarity: 'common', price: { coins: 2500 }, from: DROP },
  roundRugYellow: { kind: 'rug', set: 'pop', size: [2, 2], rarity: 'common', price: { coins: 2500 }, from: DROP },
  roundRugGreen: { kind: 'rug', set: 'pop', size: [2, 2], rarity: 'common', price: { coins: 2500 }, from: DROP },
  polkaWallpaper: { kind: 'wallpaper', set: 'pop', size: [1, 1], rarity: 'common', price: { coins: 5000 }, from: DROP },
  // Garden: moss and bark.
  stumpClock: { kind: 'floor', set: 'garden', size: [1, 1], rarity: 'common', price: { coins: 5000 }, blocks: true, from: DROP },
  greenDresser: { kind: 'floor', set: 'garden', size: [2, 1], rarity: 'common', price: { coins: 3500 }, blocks: true, surface: true, from: DROP },
  mossSofa: { kind: 'floor', set: 'garden', size: [2, 1], rarity: 'common', price: { coins: 6000 }, blocks: true, from: DROP },
  grassFloor: { kind: 'flooring', set: 'garden', size: [1, 1], rarity: 'common', price: { coins: 5000 }, from: DROP },
  // Aqua: sea blues.
  seaSofa: { kind: 'floor', set: 'aqua', size: [2, 1], rarity: 'common', price: { coins: 6000 }, blocks: true, from: DROP },
  tealDresser: { kind: 'floor', set: 'aqua', size: [2, 1], rarity: 'common', price: { coins: 3500 }, blocks: true, surface: true, from: DROP },
  waveWallpaper: { kind: 'wallpaper', set: 'aqua', size: [1, 1], rarity: 'common', price: { coins: 5000 }, from: DROP },
  poolTileFloor: { kind: 'flooring', set: 'aqua', size: [1, 1], rarity: 'common', price: { coins: 5000 }, from: DROP },
  // Arcade: the party floor.
  discoTile: { kind: 'rug', set: 'arcade', size: [1, 1], rarity: 'common', price: { gems: 100 }, from: DROP },
  neonFloor: { kind: 'flooring', set: 'arcade', size: [1, 1], rarity: 'rare', price: { gems: 250 }, from: DROP },
  // Kitchen.
  redFridge: { kind: 'floor', set: 'kitchen', size: [1, 1], rarity: 'common', price: { coins: 4000 }, blocks: true, from: DROP },
  mintFridge: { kind: 'floor', set: 'kitchen', size: [1, 1], rarity: 'common', price: { coins: 4000 }, blocks: true, from: DROP },
  creamFridge: { kind: 'floor', set: 'kitchen', size: [1, 1], rarity: 'common', price: { coins: 4000 }, blocks: true, from: DROP },
  stove: { kind: 'floor', set: 'kitchen', size: [1, 1], rarity: 'common', price: { coins: 4000 }, blocks: true, surface: true, from: DROP },
  vintageStove: { kind: 'floor', set: 'kitchen', size: [1, 1], rarity: 'common', price: { coins: 4500 }, blocks: true, surface: true, from: DROP },
  woodStove: { kind: 'floor', set: 'kitchen', size: [1, 1], rarity: 'common', price: { coins: 5000 }, blocks: true, from: DROP },
  kitchenCounter: { kind: 'floor', set: 'kitchen', size: [2, 1], rarity: 'common', price: { coins: 3500 }, blocks: true, surface: true, from: DROP },
  kitchenSink: { kind: 'floor', set: 'kitchen', size: [2, 1], rarity: 'common', price: { coins: 3500 }, blocks: true, from: DROP },
  kitchenHutch: { kind: 'floor', set: 'kitchen', size: [2, 1], rarity: 'common', price: { coins: 4500 }, blocks: true, from: DROP },
  pantry: { kind: 'floor', set: 'kitchen', size: [2, 1], rarity: 'common', price: { coins: 4500 }, blocks: true, from: DROP },
  kitchenTileWallpaper: { kind: 'wallpaper', set: 'kitchen', size: [1, 1], rarity: 'common', price: { coins: 5000 }, from: DROP },
  checkerFloor: { kind: 'flooring', set: 'kitchen', size: [1, 1], rarity: 'common', price: { coins: 5000 }, from: DROP },
} as const satisfies Record<string, FurnitureDef>

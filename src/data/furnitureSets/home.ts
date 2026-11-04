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

export const HOME_FURNITURE = {
  // Classic: dark wood and brass.
  grandfatherClock: { kind: 'floor', set: 'classic', size: [1, 1], rarity: 'common', price: { coins: 4000 }, blocks: true },
  telescope: { kind: 'floor', set: 'classic', size: [1, 1], rarity: 'common', price: { coins: 6000 }, blocks: true },
  woodDresser: { kind: 'floor', set: 'classic', size: [2, 1], rarity: 'common', price: { coins: 3500 }, blocks: true, surface: true },
  pineTallboy: { kind: 'floor', set: 'classic', size: [1, 1], rarity: 'common', price: { coins: 3000 }, blocks: true, surface: true },
  stripedRug: { kind: 'rug', set: 'classic', size: [3, 2], rarity: 'common', price: { coins: 3500 } },
  welcomeMat: { kind: 'rug', set: 'classic', size: [2, 1], rarity: 'common', price: { coins: 1200 } },
  stripedWallpaper: { kind: 'wallpaper', set: 'classic', size: [1, 1], rarity: 'common', price: { coins: 5000 } },
  herringboneFloor: { kind: 'flooring', set: 'classic', size: [1, 1], rarity: 'common', price: { coins: 5000 } },
  // Cozy: warm fabric and timber.
  cozySofa: { kind: 'floor', set: 'cozy', size: [2, 1], rarity: 'common', price: { coins: 6000 }, blocks: true },
  cabinClock: { kind: 'floor', set: 'cozy', size: [1, 1], rarity: 'common', price: { coins: 4500 }, blocks: true },
  plaidWallpaper: { kind: 'wallpaper', set: 'cozy', size: [1, 1], rarity: 'common', price: { coins: 5000 } },
  carpetFloor: { kind: 'flooring', set: 'cozy', size: [1, 1], rarity: 'common', price: { coins: 5000 } },
  // Elegant: velvet, mahogany, gold and marble.
  velvetSofa: { kind: 'floor', set: 'elegant', size: [2, 1], rarity: 'rare', price: { gems: 250 }, blocks: true },
  goldClock: { kind: 'floor', set: 'elegant', size: [1, 1], rarity: 'epic', price: { gems: 550 }, blocks: true },
  mahoganyDrawers: { kind: 'floor', set: 'elegant', size: [1, 1], rarity: 'common', price: { coins: 4000 }, blocks: true, surface: true },
  royalRug: { kind: 'rug', set: 'elegant', size: [3, 2], rarity: 'common', price: { coins: 8000 } },
  damaskWallpaper: { kind: 'wallpaper', set: 'elegant', size: [1, 1], rarity: 'common', price: { coins: 6000 } },
  marbleFloor: { kind: 'flooring', set: 'elegant', size: [1, 1], rarity: 'rare', price: { gems: 250 } },
  // Modern: gray, white and black.
  modernSofa: { kind: 'floor', set: 'modern', size: [2, 1], rarity: 'common', price: { coins: 6000 }, blocks: true },
  whiteDresser: { kind: 'floor', set: 'modern', size: [2, 1], rarity: 'common', price: { coins: 3500 }, blocks: true, surface: true },
  blackDrawers: { kind: 'floor', set: 'modern', size: [1, 1], rarity: 'common', price: { coins: 3000 }, blocks: true, surface: true },
  whiteTileFloor: { kind: 'flooring', set: 'modern', size: [1, 1], rarity: 'common', price: { coins: 5000 } },
  // Pop: candy colors.
  popSofaPink: { kind: 'floor', set: 'pop', size: [2, 1], rarity: 'common', price: { coins: 6500 }, blocks: true },
  popSofaTeal: { kind: 'floor', set: 'pop', size: [2, 1], rarity: 'common', price: { coins: 6500 }, blocks: true },
  popSofaYellow: { kind: 'floor', set: 'pop', size: [2, 1], rarity: 'common', price: { coins: 6500 }, blocks: true },
  redDresser: { kind: 'floor', set: 'pop', size: [2, 1], rarity: 'common', price: { coins: 3500 }, blocks: true, surface: true },
  checkerRug: { kind: 'rug', set: 'pop', size: [2, 2], rarity: 'common', price: { coins: 3000 } },
  roundRugPink: { kind: 'rug', set: 'pop', size: [2, 2], rarity: 'common', price: { coins: 2500 } },
  roundRugYellow: { kind: 'rug', set: 'pop', size: [2, 2], rarity: 'common', price: { coins: 2500 } },
  roundRugGreen: { kind: 'rug', set: 'pop', size: [2, 2], rarity: 'common', price: { coins: 2500 } },
  polkaWallpaper: { kind: 'wallpaper', set: 'pop', size: [1, 1], rarity: 'common', price: { coins: 5000 } },
  // Garden: moss and bark.
  stumpClock: { kind: 'floor', set: 'garden', size: [1, 1], rarity: 'common', price: { coins: 5000 }, blocks: true },
  greenDresser: { kind: 'floor', set: 'garden', size: [2, 1], rarity: 'common', price: { coins: 3500 }, blocks: true, surface: true },
  mossSofa: { kind: 'floor', set: 'garden', size: [2, 1], rarity: 'common', price: { coins: 6000 }, blocks: true },
  grassFloor: { kind: 'flooring', set: 'garden', size: [1, 1], rarity: 'common', price: { coins: 5000 } },
  // Aqua: sea blues.
  seaSofa: { kind: 'floor', set: 'aqua', size: [2, 1], rarity: 'common', price: { coins: 6000 }, blocks: true },
  tealDresser: { kind: 'floor', set: 'aqua', size: [2, 1], rarity: 'common', price: { coins: 3500 }, blocks: true, surface: true },
  waveWallpaper: { kind: 'wallpaper', set: 'aqua', size: [1, 1], rarity: 'common', price: { coins: 5000 } },
  poolTileFloor: { kind: 'flooring', set: 'aqua', size: [1, 1], rarity: 'common', price: { coins: 5000 } },
  // Arcade: the party floor.
  discoTile: { kind: 'rug', set: 'arcade', size: [1, 1], rarity: 'common', price: { gems: 100 } },
  neonFloor: { kind: 'flooring', set: 'arcade', size: [1, 1], rarity: 'rare', price: { gems: 250 } },
  // Kitchen.
  redFridge: { kind: 'floor', set: 'kitchen', size: [1, 1], rarity: 'common', price: { coins: 4000 }, blocks: true },
  mintFridge: { kind: 'floor', set: 'kitchen', size: [1, 1], rarity: 'common', price: { coins: 4000 }, blocks: true },
  creamFridge: { kind: 'floor', set: 'kitchen', size: [1, 1], rarity: 'common', price: { coins: 4000 }, blocks: true },
  stove: { kind: 'floor', set: 'kitchen', size: [1, 1], rarity: 'common', price: { coins: 4000 }, blocks: true, surface: true },
  vintageStove: { kind: 'floor', set: 'kitchen', size: [1, 1], rarity: 'common', price: { coins: 4500 }, blocks: true, surface: true },
  woodStove: { kind: 'floor', set: 'kitchen', size: [1, 1], rarity: 'common', price: { coins: 5000 }, blocks: true },
  kitchenCounter: { kind: 'floor', set: 'kitchen', size: [2, 1], rarity: 'common', price: { coins: 3500 }, blocks: true, surface: true },
  kitchenSink: { kind: 'floor', set: 'kitchen', size: [2, 1], rarity: 'common', price: { coins: 3500 }, blocks: true },
  kitchenHutch: { kind: 'floor', set: 'kitchen', size: [2, 1], rarity: 'common', price: { coins: 4500 }, blocks: true },
  pantry: { kind: 'floor', set: 'kitchen', size: [2, 1], rarity: 'common', price: { coins: 4500 }, blocks: true },
  kitchenTileWallpaper: { kind: 'wallpaper', set: 'kitchen', size: [1, 1], rarity: 'common', price: { coins: 5000 } },
  checkerFloor: { kind: 'flooring', set: 'kitchen', size: [1, 1], rarity: 'common', price: { coins: 5000 } },
  // Tables and their chairs, shelves, plants and lamps (one PixelLab batch per
  // kind, so each kind shares a hand; the pop colors are one model recolored).
  // They're drawn in 3/4 from the front, so none of them turns.
  tomeBookcase: { kind: 'floor', set: 'classic', size: [1, 1], rarity: 'common', price: { coins: 4500 }, blocks: true },
  wallBookshelf: { kind: 'wall', set: 'classic', size: [1, 1], rarity: 'common', price: { coins: 1800 } },
  deskLamp: { kind: 'top', set: 'classic', size: [1, 1], rarity: 'common', price: { coins: 1200 } },
  coffeeTable: { kind: 'floor', set: 'cozy', size: [2, 1], rarity: 'common', price: { coins: 3000 }, blocks: true, surface: true },
  cozyArmchair: { kind: 'floor', set: 'cozy', size: [1, 1], rarity: 'common', price: { coins: 3000 }, blocks: true },
  paperLantern: { kind: 'top', set: 'cozy', size: [1, 1], rarity: 'common', price: { coins: 1000 } },
  marbleTable: { kind: 'floor', set: 'elegant', size: [2, 1], rarity: 'rare', price: { gems: 250 }, blocks: true, surface: true },
  marbleChair: { kind: 'floor', set: 'elegant', size: [1, 1], rarity: 'common', price: { coins: 2500 }, blocks: true },
  chandelier: { kind: 'wall', set: 'elegant', size: [1, 1], rarity: 'epic', price: { gems: 550 } },
  glassTable: { kind: 'floor', set: 'modern', size: [2, 1], rarity: 'common', price: { coins: 5000 }, blocks: true, surface: true },
  glassChair: { kind: 'floor', set: 'modern', size: [1, 1], rarity: 'common', price: { coins: 2000 }, blocks: true },
  whiteShelf: { kind: 'floor', set: 'modern', size: [1, 1], rarity: 'common', price: { coins: 3000 }, blocks: true },
  metalRack: { kind: 'floor', set: 'modern', size: [1, 1], rarity: 'common', price: { coins: 2500 }, blocks: true },
  popTablePink: { kind: 'floor', set: 'pop', size: [2, 1], rarity: 'common', price: { coins: 3500 }, blocks: true, surface: true },
  popTableTeal: { kind: 'floor', set: 'pop', size: [2, 1], rarity: 'common', price: { coins: 3500 }, blocks: true, surface: true },
  popTableYellow: { kind: 'floor', set: 'pop', size: [2, 1], rarity: 'common', price: { coins: 3500 }, blocks: true, surface: true },
  popTableRed: { kind: 'floor', set: 'pop', size: [2, 1], rarity: 'common', price: { coins: 3500 }, blocks: true, surface: true },
  popChairPink: { kind: 'floor', set: 'pop', size: [1, 1], rarity: 'common', price: { coins: 1500 }, blocks: true },
  popChairTeal: { kind: 'floor', set: 'pop', size: [1, 1], rarity: 'common', price: { coins: 1500 }, blocks: true },
  popChairYellow: { kind: 'floor', set: 'pop', size: [1, 1], rarity: 'common', price: { coins: 1500 }, blocks: true },
  popChairRed: { kind: 'floor', set: 'pop', size: [1, 1], rarity: 'common', price: { coins: 1500 }, blocks: true },
  lavaLamp: { kind: 'top', set: 'pop', size: [1, 1], rarity: 'common', price: { gems: 100 } },
  neonHeart: { kind: 'wall', set: 'pop', size: [1, 1], rarity: 'rare', price: { gems: 250 } },
  cactus: { kind: 'floor', set: 'garden', size: [1, 1], rarity: 'common', price: { coins: 800 }, blocks: true },
  fern: { kind: 'floor', set: 'garden', size: [1, 1], rarity: 'common', price: { coins: 1200 }, blocks: true },
  sunflower: { kind: 'floor', set: 'garden', size: [1, 1], rarity: 'common', price: { coins: 1000 }, blocks: true },
  monstera: { kind: 'floor', set: 'garden', size: [1, 1], rarity: 'common', price: { coins: 1800 }, blocks: true },
  bonsai: { kind: 'top', set: 'garden', size: [1, 1], rarity: 'common', price: { coins: 2000 } },
  hangingPlant: { kind: 'wall', set: 'garden', size: [1, 1], rarity: 'common', price: { coins: 1500 } },
} as const satisfies Record<string, FurnitureDef>

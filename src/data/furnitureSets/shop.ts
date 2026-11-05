import type { FurnitureDef } from '../furnitureDef'
import { USE, light } from '../furnitureUse'

/**
 * The carpentry's catalog, each piece with its PNG (`render/furnitureArt.ts`):
 * ₽ basics of every kind, so a fresh base can be furnished without gems (a
 * fireplace at the top, the ₽ sink's big ticket), and gem pieces of every
 * rarity at the gem shop's prices (`RARITY_PRICE`, a lamp below it).
 */
export const SHOP_FURNITURE = {
  // ₽: the basics.
  woodChair: { kind: 'floor', set: 'classic', size: [1, 1], rarity: 'common', price: { coins: 1500 }, blocks: true, turns: true, use: USE.chair },
  stool: { kind: 'floor', set: 'classic', size: [1, 1], rarity: 'common', price: { coins: 800 }, blocks: true, use: USE.stool },
  woodTable: { kind: 'floor', set: 'classic', size: [2, 1], rarity: 'common', price: { coins: 3000 }, blocks: true, surface: true, turns: true },
  woodCrate: { kind: 'floor', set: 'classic', size: [1, 1], rarity: 'common', price: { coins: 1000 }, blocks: true, surface: true },
  bookshelf: { kind: 'floor', set: 'classic', size: [2, 1], rarity: 'common', price: { coins: 3500 }, blocks: true },
  pottedPlant: { kind: 'floor', set: 'garden', size: [1, 1], rarity: 'common', price: { coins: 1200 }, blocks: true },
  floorLamp: { kind: 'floor', set: 'cozy', size: [1, 1], rarity: 'common', price: { coins: 2000 }, blocks: true, use: light('lamp', 0, -37) },
  pokeBallRug: { kind: 'rug', set: 'trainer', size: [3, 3], rarity: 'common', price: { coins: 4000 } },
  roundRug: { kind: 'rug', set: 'cozy', size: [2, 2], rarity: 'common', price: { coins: 2500 } },
  candle: { kind: 'top', set: 'cozy', size: [1, 1], rarity: 'common', price: { coins: 600 }, use: light('fire', 0, -21) },
  flowerVase: { kind: 'top', set: 'garden', size: [1, 1], rarity: 'common', price: { coins: 900 } },
  regionMap: { kind: 'wall', set: 'trainer', size: [2, 1], rarity: 'common', price: { coins: 2500 } },
  wallClock: { kind: 'wall', set: 'classic', size: [1, 1], rarity: 'common', price: { coins: 1800 } },
  plankFloor: { kind: 'flooring', set: 'classic', size: [1, 1], rarity: 'common', price: { coins: 5000 } },
  stoneTiles: { kind: 'flooring', set: 'classic', size: [1, 1], rarity: 'common', price: { coins: 5000 } },
  leafWallpaper: { kind: 'wallpaper', set: 'garden', size: [1, 1], rarity: 'common', price: { coins: 5000 } },
  brickWallpaper: { kind: 'wallpaper', set: 'classic', size: [1, 1], rarity: 'common', price: { coins: 5000 } },
  fireplace: { kind: 'floor', set: 'cozy', size: [2, 1], rarity: 'rare', price: { coins: 12000 }, blocks: true, use: light('fire', 0, -14) },
  // Gems, by rarity.
  pokeBallLamp: { kind: 'top', set: 'trainer', size: [1, 1], rarity: 'common', price: { gems: 100 }, use: light('lamp', 0, -11) },
  pcTerminal: { kind: 'floor', set: 'center', size: [1, 1], rarity: 'rare', price: { gems: 250 }, blocks: true, use: light('screen', 2, -21) },
  tvSet: { kind: 'floor', set: 'arcade', size: [2, 1], rarity: 'rare', price: { gems: 250 }, blocks: true, use: light('screen', -1, -33) },
  championBanner: { kind: 'wall', set: 'trainer', size: [2, 1], rarity: 'rare', price: { gems: 250 } },
  pikachuBed: { kind: 'floor', set: 'trainer', size: [2, 3], rarity: 'rare', price: { gems: 250 }, blocks: true, turns: true, use: USE.bed },
  starryWallpaper: { kind: 'wallpaper', set: 'cozy', size: [1, 1], rarity: 'rare', price: { gems: 250 } },
  snorlaxBeanbag: { kind: 'floor', set: 'cozy', size: [2, 2], rarity: 'epic', price: { gems: 550 }, blocks: true, use: USE.beanbag },
  aquarium: { kind: 'floor', set: 'aqua', size: [3, 1], rarity: 'epic', price: { gems: 550 }, blocks: true, surface: true },
  jukebox: { kind: 'floor', set: 'arcade', size: [1, 1], rarity: 'epic', price: { gems: 550 }, blocks: true, use: USE.music },
  cherryTree: { kind: 'floor', set: 'garden', size: [2, 2], rarity: 'epic', price: { gems: 550 }, blocks: true },
  crystalFloor: { kind: 'flooring', set: 'elegant', size: [1, 1], rarity: 'epic', price: { gems: 550 } },
  goldTrophyCase: { kind: 'floor', set: 'trainer', size: [3, 1], rarity: 'legendary', price: { gems: 1200 }, blocks: true, surface: true },
  masterBallStatue: { kind: 'floor', set: 'trainer', size: [1, 1], rarity: 'legendary', price: { gems: 1200 }, blocks: true },
} as const satisfies Record<string, FurnitureDef>

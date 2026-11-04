import type { FurnitureDef } from '../furniture'
import type { LegendId } from '../legends'

/**
 * The Pokémon collections (`trainer`, `center`, `gallery`): starter beds,
 * Poké Ball pieces, the Pokémon Center's and Mart's, and framed paintings
 * (legends across the sky, tributes to the games' covers). A Pokémon's
 * likeness in any of them comes from its SpriteCollab art, composited into
 * the PNG, never generated. Spread into `FURNITURE`; names in i18n
 * `furniture.names`.
 *
 * The beds and the Center's machine are gem pieces; everything a trainer's
 * room is built from (chairs, rugs, shelves, the counters, the cover
 * tributes) costs ₽, the economy's sink. The legends' paintings are never
 * sold: each comes with the legends it shows, once captured
 * (`LEGEND_PAINTINGS`, counted by `trophyFurniture` like the dolls).
 */

/** A starter bed: the starter tucked in on the pillow (its SpriteCollab sprite), the frame and blanket in its colors. */
const BED = { kind: 'floor', set: 'trainer', size: [2, 3], rarity: 'rare', price: { gems: 250 }, blocks: true, turns: true } as const satisfies FurnitureDef

/** A tribute to a game's cover: its color field, its mascot (SpriteCollab) and a title band, framed; ₽, a collector's sink. */
const COVER = { kind: 'wall', set: 'gallery', size: [2, 2], rarity: 'rare', price: { coins: 15000 }, from: '2026-11-04' } as const satisfies FurnitureDef

/** A legend across the sky, framed in gold: earned with the legends it shows (`LEGEND_PAINTINGS`). */
const PAINTING = { kind: 'wall', set: 'gallery', size: [3, 2], rarity: 'legendary', price: null, source: 'trophy' } as const satisfies FurnitureDef

export const POKEMON_FURNITURE = {
  // Trainer: the starters' beds (the Pikachu bed is the first catalog's).
  bulbasaurBed: BED,
  charmanderBed: BED,
  squirtleBed: BED,
  chikoritaBed: BED,
  cyndaquilBed: BED,
  totodileBed: BED,
  treeckoBed: BED,
  torchicBed: BED,
  mudkipBed: BED,
  // Trainer: Poké Balls and a trainer's things.
  pokeBallChair: { kind: 'floor', set: 'trainer', size: [1, 1], rarity: 'common', price: { coins: 2500 }, blocks: true },
  greatBallRug: { kind: 'rug', set: 'trainer', size: [3, 3], rarity: 'common', price: { coins: 6000 } },
  ultraBallRug: { kind: 'rug', set: 'trainer', size: [3, 3], rarity: 'rare', price: { coins: 9000 } },
  masterBallRug: { kind: 'rug', set: 'trainer', size: [3, 3], rarity: 'epic', price: { gems: 550 } },
  badgeCase: { kind: 'wall', set: 'trainer', size: [2, 1], rarity: 'rare', price: { gems: 250 } },
  capRack: { kind: 'floor', set: 'trainer', size: [1, 1], rarity: 'common', price: { coins: 2200 }, blocks: true },
  pokedexLamp: { kind: 'top', set: 'trainer', size: [1, 1], rarity: 'common', price: { coins: 1500 } },
  berryPlanter: { kind: 'floor', set: 'trainer', size: [2, 1], rarity: 'common', price: { coins: 3000 }, blocks: true, turns: true },
  gymStatue: { kind: 'floor', set: 'trainer', size: [1, 1], rarity: 'epic', price: { gems: 550 }, blocks: true },
  // The Pokémon Center and the Mart.
  healingMachine: { kind: 'floor', set: 'center', size: [2, 1], rarity: 'epic', price: { gems: 550 }, blocks: true },
  centerSofa: { kind: 'floor', set: 'center', size: [2, 1], rarity: 'common', price: { coins: 4000 }, blocks: true, turns: true },
  martCounter: { kind: 'floor', set: 'center', size: [3, 1], rarity: 'rare', price: { coins: 9000 }, blocks: true, surface: true, turns: true },
  martShelf: { kind: 'floor', set: 'center', size: [2, 1], rarity: 'common', price: { coins: 5000 }, blocks: true },
  vendingMachine: { kind: 'floor', set: 'center', size: [1, 1], rarity: 'rare', price: { gems: 250 }, blocks: true },
  eggIncubator: { kind: 'floor', set: 'center', size: [1, 1], rarity: 'rare', price: { gems: 250 }, blocks: true },
  // The gallery: the games' covers (₽) and the legends' skies (earned).
  fireRedCover: COVER,
  leafGreenCover: COVER,
  heartGoldCover: COVER,
  soulSilverCover: COVER,
  rubyCover: COVER,
  sapphireCover: COVER,
  emeraldCover: COVER,
  platinumCover: COVER,
  rayquazaPainting: PAINTING,
  lugiaPainting: PAINTING,
  hoOhPainting: PAINTING,
  clashPainting: PAINTING,
  mewtwoPainting: PAINTING,
} as const satisfies Record<string, FurnitureDef>

/** The legends' paintings and who each shows: earned once every one of them is captured (`trophyFurniture`). */
export const LEGEND_PAINTINGS = {
  rayquazaPainting: ['rayquaza'],
  lugiaPainting: ['lugia'],
  hoOhPainting: ['hoOh'],
  clashPainting: ['kyogre', 'groudon'],
  mewtwoPainting: ['mewtwo'],
} as const satisfies Partial<Record<keyof typeof POKEMON_FURNITURE, readonly LegendId[]>>

export type LegendPaintingId = keyof typeof LEGEND_PAINTINGS

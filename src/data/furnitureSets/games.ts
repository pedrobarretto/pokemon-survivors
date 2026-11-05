import type { FurnitureDef } from '../furniture'

/**
 * The mini games' trophies (`MINIGAMES[game].trophies` in `data/minigames.ts`):
 * earned only, granted by the API from each game's stats (`furniture_owned`,
 * source `game`). Every trophy is `source: 'trophy'`, `set: 'trophies'`,
 * `price: null`: never sold, never tradable (the game table is the one piece
 * here that's sold). One block per game, so each game's pieces stay together.
 */

/** Fishing (`MINIGAMES.fishing.trophies`): the rod rack for 20 rounds, the golden Magikarp plaque for a round of 500, the shiny Gyarados on its pedestal for hooking one. */
const FISHING = {
  fishingRodRack: { kind: 'floor', set: 'trophies', size: [1, 1], rarity: 'rare', price: null, source: 'trophy', blocks: true },
  goldenMagikarpPlaque: { kind: 'wall', set: 'trophies', size: [2, 1], rarity: 'epic', price: null, source: 'trophy' },
  shinyGyaradosTrophy: { kind: 'floor', set: 'trophies', size: [2, 1], rarity: 'legendary', price: null, source: 'trophy', blocks: true },
} as const satisfies Record<string, FurnitureDef>

/**
 * The game tables' pieces: the table a base hosts matches at (sold at the
 * carpentry for ₽, the one piece here that is: `FURNITURE_GAMES` plays both
 * table games at it), and Four in a Row's trophies (`MINIGAMES.fourInRow`).
 */
const TABLES = {
  gameTable: { kind: 'floor', set: 'arcade', size: [2, 1], rarity: 'common', price: { coins: 6000 }, blocks: true },
  fourInRowCup: { kind: 'top', set: 'trophies', size: [1, 1], rarity: 'epic', price: null, source: 'trophy', turn: 'still' },
  fourInRowGiant: { kind: 'floor', set: 'trophies', size: [1, 1], rarity: 'legendary', price: null, source: 'trophy', blocks: true },
} as const satisfies Record<string, FurnitureDef>

/** The type duel's: a cup after 10 wins, a pennant for a perfect duel (a win the rival banked nothing in). */
const DUEL = {
  duelCup: { kind: 'top', set: 'trophies', size: [1, 1], rarity: 'epic', price: null, source: 'trophy', turn: 'still' },
  perfectDuelPennant: { kind: 'wall', set: 'trophies', size: [2, 1], rarity: 'legendary', price: null, source: 'trophy', turn: 'still' },
} as const satisfies Record<string, FurnitureDef>

/** The arcade's: a basket of berries for a 2500 at Berry Rain, a golden mallet for a 2500 at Whack-a-Diglett. */
const ARCADE = {
  berryBasket: { kind: 'floor', set: 'trophies', size: [1, 1], rarity: 'epic', price: null, source: 'trophy', blocks: true },
  goldenMallet: { kind: 'floor', set: 'trophies', size: [1, 1], rarity: 'legendary', price: null, source: 'trophy', blocks: true },
} as const satisfies Record<string, FurnitureDef>

export const GAME_FURNITURE = { ...FISHING, ...TABLES, ...DUEL, ...ARCADE } as const satisfies Record<string, FurnitureDef>

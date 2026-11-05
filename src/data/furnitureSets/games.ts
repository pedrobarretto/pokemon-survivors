import type { FurnitureDef } from '../furniture'

/**
 * The mini games' trophies (`MINIGAMES[game].trophies` in `data/minigames.ts`):
 * earned only, granted by the API from each game's stats (`furniture_owned`,
 * source `game`). Every trophy is `source: 'trophy'`, `set: 'trophies'`,
 * `price: null`: never sold, never tradable (the game table is the one piece
 * here that's sold). One block per game, so each game's pieces stay together.
 */

const FISHING = {} as const satisfies Record<string, FurnitureDef>

/**
 * The game tables' pieces: the table a base hosts matches at (sold at the
 * carpentry for ₽, the one piece here that is: `FURNITURE_GAMES` plays both
 * table games at it), and Four in a Row's trophies (`MINIGAMES.fourInRow`).
 */
const TABLES = {
  gameTable: { kind: 'floor', set: 'arcade', size: [2, 1], rarity: 'common', price: { coins: 6000 }, blocks: true },
  fourInRowCup: { kind: 'top', set: 'trophies', size: [1, 1], rarity: 'epic', price: null, source: 'trophy' },
  fourInRowGiant: { kind: 'floor', set: 'trophies', size: [1, 1], rarity: 'legendary', price: null, source: 'trophy', blocks: true },
} as const satisfies Record<string, FurnitureDef>

/** The type duel's: a cup after 10 wins, a pennant for a perfect duel (a win the rival banked nothing in). */
const DUEL = {
  duelCup: { kind: 'top', set: 'trophies', size: [1, 1], rarity: 'epic', price: null, source: 'trophy' },
  perfectDuelPennant: { kind: 'wall', set: 'trophies', size: [2, 1], rarity: 'legendary', price: null, source: 'trophy' },
} as const satisfies Record<string, FurnitureDef>

const ARCADE = {} as const satisfies Record<string, FurnitureDef>

export const GAME_FURNITURE = { ...FISHING, ...TABLES, ...DUEL, ...ARCADE } as const satisfies Record<string, FurnitureDef>

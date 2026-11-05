import type { FurnitureDef } from '../furniture'

/**
 * The mini games' trophies (`MINIGAMES[game].trophies` in `data/minigames.ts`):
 * earned only, granted by the API from each game's stats (`furniture_owned`,
 * source `game`). Every piece is `source: 'trophy'`, `set: 'trophies'`,
 * `price: null`: never sold, never tradable. One block per game, so each
 * game's pieces stay together.
 */

const FISHING = {} as const satisfies Record<string, FurnitureDef>

const TABLES = {} as const satisfies Record<string, FurnitureDef>

const DUEL = {} as const satisfies Record<string, FurnitureDef>

/** The arcade's: a basket of berries for a 2500 at Berry Rain, a golden mallet for a 2500 at Whack-a-Diglett. */
const ARCADE = {
  berryBasket: { kind: 'floor', set: 'trophies', size: [1, 1], rarity: 'epic', price: null, source: 'trophy', blocks: true },
  goldenMallet: { kind: 'floor', set: 'trophies', size: [1, 1], rarity: 'legendary', price: null, source: 'trophy', blocks: true },
} as const satisfies Record<string, FurnitureDef>

export const GAME_FURNITURE = { ...FISHING, ...TABLES, ...DUEL, ...ARCADE } as const satisfies Record<string, FurnitureDef>

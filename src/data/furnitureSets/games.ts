import type { FurnitureDef } from '../furniture'

/**
 * The mini games' trophies (`MINIGAMES[game].trophies` in `data/minigames.ts`):
 * earned only, granted by the API from each game's stats (`furniture_owned`,
 * source `game`). Every piece is `source: 'trophy'`, `set: 'trophies'`,
 * `price: null`: never sold, never tradable. One block per game, so each
 * game's pieces stay together.
 */

/** Fishing (`MINIGAMES.fishing.trophies`): the rod rack for 20 rounds, the golden Magikarp plaque for a round of 500, the shiny Gyarados on its pedestal for hooking one. */
const FISHING = {
  fishingRodRack: { kind: 'floor', set: 'trophies', size: [1, 1], rarity: 'rare', price: null, source: 'trophy', blocks: true },
  goldenMagikarpPlaque: { kind: 'wall', set: 'trophies', size: [2, 1], rarity: 'epic', price: null, source: 'trophy' },
  shinyGyaradosTrophy: { kind: 'floor', set: 'trophies', size: [2, 1], rarity: 'legendary', price: null, source: 'trophy', blocks: true },
} as const satisfies Record<string, FurnitureDef>

const TABLES = {} as const satisfies Record<string, FurnitureDef>

const DUEL = {} as const satisfies Record<string, FurnitureDef>

const ARCADE = {} as const satisfies Record<string, FurnitureDef>

export const GAME_FURNITURE = { ...FISHING, ...TABLES, ...DUEL, ...ARCADE } as const satisfies Record<string, FurnitureDef>

/**
 * The Arena's match formats, as far as the relay and the queue need them:
 * how many Pokémon a team fields and whether the format has a ranked queue.
 * Import-free like `arenaRanked.ts`: the relay's matchmaker and rooms bundle
 * it alone. What a format plays like (its map, clock and numbers) is the
 * game's (`VERSUS_FORMATS` in `data/versus.ts`).
 *
 * - `standard`: 4v4 on the Vale or the Enseada, 7 minutes. Casual and Ranqueada.
 * - `quick`: 3v3 on the Clareira or the Recife, 3 minutes. Casual only, so the season has one ladder.
 */
export const ARENA_FORMATS = {
  standard: { teamSize: 4, ranked: true },
  quick: { teamSize: 3, ranked: false },
} as const satisfies Record<string, { teamSize: number; ranked: boolean }>

export type ArenaFormat = keyof typeof ARENA_FORMATS

export const ARENA_FORMAT_IDS = Object.keys(ARENA_FORMATS) as ArenaFormat[]

/** A format from the wire or a setting: anything but a known one is the standard (what every client before formats played). */
export const parseArenaFormat = (v: unknown): ArenaFormat => ARENA_FORMAT_IDS.find((f) => f === v) ?? 'standard'

/** Seats in a match of `format`: both teams. */
export const arenaPlayers = (format: ArenaFormat) => ARENA_FORMATS[format].teamSize * 2

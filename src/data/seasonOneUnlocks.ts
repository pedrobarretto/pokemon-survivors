import type { BiomeId, WeatherId } from './biomes'
import type { HatchlingId } from './hatchlings'
import type { MinigameId } from './minigames'

/**
 * Temporada 1's ways into a family that aren't an egg: the numbers of the map
 * encounters (`game/seasonOneFinds.ts`), the research chains and the mini game
 * feats that bring one (`game/seasonOneUnlocks.ts`). A first rough pass, to
 * tune from play. The words live in `i18n/seasonOne/unlocks.ts`.
 */

export const FIND_IDS = ['rotom', 'castform'] as const satisfies readonly HatchlingId[]
export type FindId = (typeof FIND_IDS)[number]

/** Odds a run brings each encounter, drawn once from its seed: the old TV flickers, or Castform comes out with the weather. */
export const FIND_ODDS = { rotom: 0.2, castform: 0.2 } as const satisfies Record<FindId, number>

/** The old TV on a cottage's table: how close counts (px, plus the body) and the seconds to stand there before Rotom leaves it. */
export const TV_FIND = { radius: 16, stand: 1.6 } as const

/**
 * The wandering Castform: not before `from` (run s), `delay` s into a spell of
 * weather that isn't clear, `lifetime` s to reach it, placed `distance` px
 * away, drifting at `speed` px/s (the base walk is 68). A touch or a hit counts.
 */
export const CASTFORM_FIND = { dex: 351, from: 150, delay: 15, lifetime: 28, distance: [130, 190], speed: 24, radius: 9 } as const

/** What counts as finishing in the wet: this weather, or standing on these biomes. */
export const WET_WEATHER: WeatherId = 'rain'
export const WET_BIOMES: readonly BiomeId[] = ['beach', 'forest']

/** The types a partner needs to count for Tatsugiri's research. */
export const RESEARCH_TYPES = ['water', 'dragon'] as const

/**
 * The research chains, 3 steps each and at most one step a run, 3 to 8 hours
 * of normal play per family. `hits`: win a run after taking that many hits
 * (the "apanhou e venceu"). `wet`: that many wins finished in the wet.
 * `partners`: wins with that many different Water or Dragon partners.
 */
export const RESEARCH = {
  mankey: { goal: 'hits', steps: [30, 60, 100] },
  goomy: { goal: 'wet', steps: [1, 2, 3] },
  tatsugiri: { goal: 'partners', steps: [1, 2, 3] },
} as const satisfies Partial<Record<HatchlingId, { goal: 'hits' | 'wet' | 'partners'; steps: readonly [number, number, number] }>>

export type ResearchId = keyof typeof RESEARCH

export const RESEARCH_IDS = Object.keys(RESEARCH) as ResearchId[]

/** The mini game feats that bring a family, once per account: the API sends it as a gift on the first claim (`POST /realm/game/claim`). */
export const FEAT_FAMILIES: Partial<Record<MinigameId, Readonly<Record<string, HatchlingId>>>> = {
  fishing: { wishiwashi: 'wishiwashi' },
}

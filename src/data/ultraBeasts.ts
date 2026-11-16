import type { EnemyId } from './enemies'

/**
 * ULTRA BEASTS: Pokémon from Ultra Space that come through an Ultra Wormhole,
 * a rift of its own kind (`game/wormhole.ts`): one opens on the map in every
 * solo run, around `WORMHOLE.at`, with its own omen (the sky cracks with
 * prismatic light, `render/legendSky.ts`), and leads into a short Ultra Space
 * domain (`data/domains/ultra.ts`) against one beast. Which one comes is drawn
 * from the run's rng; the beast of the week (`game/ultraWeek.ts`, from the
 * date, a run input as `ReplayStart.ultra`) weighs `WORMHOLE.weekly` times
 * the others. Beaten, it's caught in a Beast Ball and, like the legends,
 * becomes playable in the Legend mode (`data/legends.ts`, one win each).
 * Capturing all ten brings Poipole as a game-made gift (`game/ultraGifts.ts`),
 * which evolves into Naganadel at its first awakening.
 */

/** The beasts an Ultra Wormhole brings, in the order the weekly rotation walks (`ultraOfWeek`). */
export const ULTRA_BEASTS = [
  'nihilego', 'buzzwole', 'pheromosa', 'xurkitree', 'celesteela', 'kartana', 'guzzlord', 'stakataka', 'blacephalon', 'naganadel',
] as const satisfies readonly EnemyId[]

export type UltraBeast = (typeof ULTRA_BEASTS)[number]

/** A value for every beast, keyed by it (their arena's colors, floor plan, entrance…). */
export const perBeast = <T>(value: (beast: UltraBeast) => T): Record<UltraBeast, T> =>
  Object.fromEntries(ULTRA_BEASTS.map((b) => [b, value(b)])) as Record<UltraBeast, T>

/** Whether a species is one of the Ultra Wormholes' beasts. */
export const isUltraBeast = (id: unknown): id is UltraBeast => ULTRA_BEASTS.some((b) => b === id)

/** Timing and odds of the Ultra Wormhole, in run seconds. */
export const WORMHOLE = {
  /**
   * When the omen starts (± `jitter`): one wormhole a run, between the 7:00
   * and 9:30 trio slots, clear of the rifts at 4:00 and 10:20. Like a rift's,
   * it waits up to `RIFT.bossWait` for a living boss to fall.
   */
  at: 470,
  /** How many times the others the beast of the week weighs in the draw. */
  weekly: 4,
} as const

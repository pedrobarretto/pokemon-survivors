import type { BossPattern, BossPhase } from './bosses'
import { WAVE_LEGEND_PHASES } from './legendBosses'
import * as dm from '../engine/dmath'
export { HIDEOUT_BOSSES, type HideoutBoss } from './rocketHideoutFoes'

/**
 * The Rocket Hideout (`game/hideout.ts`): a place under the Game Corner,
 * reached with the pass Team Rocket's poster gives (`game/hideoutPass.ts`):
 * the run started with it (`ReplayStart.hideout`) opens the Hideout's hatch on
 * its map at `HIDEOUT.at`. Two floors of grunts' Pokémon burning with the
 * Shadow aura, stairs down, then the boss's room: Giovanni (in words only)
 * sends his Persian, and once it falls, Shadow Mewtwo in three phases.
 * Beating Mewtwo gives it as a Shadow for the Legend mode (`game/shadow.ts`).
 * Giovanni's lines live in i18n `rocket.hideout`.
 *
 * Shadow Lugia's sheets wait for a later event (`SHADOW_SHEETS`): a second lair
 * boss would be another entry in `HIDEOUT_BOSSES` and its phases.
 */
export const HIDEOUT = {
  /** Run seconds its hatch opens, in a run started with a pass (and not inside a boss fight, `placeDue`'s rules). */
  at: 200,
  /** Seconds inside before the alarm throws the team out. Long: the lair's fight is two bosses. */
  time: 320,
  /** Floors with stairs; the one after them is the boss's room. */
  floors: 2,
  /** Seconds a floor's title card holds the Hideout still. */
  card: 1.5,
  /** Seconds Giovanni talks before Persian leaps in, and between Persian falling and Mewtwo. */
  intro: 2.4,
  between: 2.6,
  /** The boss's room: a round chamber, where the team comes in and where the bosses stand. */
  lair: { r: 132, start: [0, 104], boss: [0, -48] },
  /** The bosses' HP is their 3:00 values, grown with the run clock like a place boss's (`placeBossScale`). */
  bossAt: 180,
} as const

/** The grunts' Pokémon (Team Rocket's own), weak to strong; every one inside wears the Shadow aura. */
export const HIDEOUT_CAST = ['rattata', 'zubat', 'ekans', 'koffing', 'grimer', 'drowzee', 'raticate', 'golbat', 'arbok', 'weezing', 'muk', 'hypno'] as const


/** Persian: Slash around itself, Power Gem along the player's path, Pay Day's coins in a ring, and Fake Out leaps from afar. */
export const PERSIAN_PATTERNS: readonly BossPattern[] = [
  { kind: 'strikes', every: 3.6, target: 'self', count: 1, spread: 0, radius: 40, delay: 1.1, damage: 20, visual: 'slam' },
  { kind: 'strikes', every: 4.2, target: 'player', count: 4, spread: 60, radius: 14, delay: 1.1, damage: 18, visual: 'rock', lead: 1 },
  { kind: 'ring', every: 5, count: 12, speed: 70, radius: 5, damage: 16, visual: 'steel' },
  { far: 120, kind: 'strikes', every: 5.5, target: 'player', count: 1, spread: 0, radius: 26, delay: 1.1, damage: 20, visual: 'slam', lead: 1, leap: true },
  { below: 0.5, kind: 'volley', every: 4, count: 5, arc: 0.8, speed: 110, windup: 0.9, radius: 5, damage: 16, visual: 'shadow' },
]

/**
 * Shadow Mewtwo: Mewtwo's three phases (`data/legendBosses.ts`) in the Shadow's
 * colors, its Psychic gone dark, at the place boss's strength (`HIDEOUT_BOSSES`,
 * with damages scaled down to it), always drawn in its Shadow sheets.
 */
const darken = (p: BossPattern): BossPattern => ({ ...p, ...('damage' in p ? { damage: dm.round(p.damage * 0.72) } : {}), ...('visual' in p && p.visual === 'psychic' ? { visual: 'shadow' } : {}) })

export const SHADOW_MEWTWO_PHASES: readonly BossPhase[] = WAVE_LEGEND_PHASES.mewtwo.map((ph) => ({
  ...ph,
  form: 'shadow',
  patterns: ph.patterns.map(darken),
  ...(ph.ultimate ? { ultimate: { ...ph.ultimate, steps: ph.ultimate.steps.map((s) => ({ ...s, pattern: darken(s.pattern) })) } } : {}),
}))

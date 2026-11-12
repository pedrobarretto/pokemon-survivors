import type { WeatherId } from './biomes'
import type { BossPattern, BossPhase, HazardVisual } from './bosses'
import type { Difficulty } from '../game/difficulty'
import { pin } from './domains/kit'
import type { ForceId, RuinsRegi } from './legends'
import type { PokeType } from './types'

/**
 * The Ruínas da Decisão and the Forces of Nature, as data.
 *
 * - The Ruins (Crown Tundra's Split-Decision Ruins, `game/splitRuins.ts`): once
 *   Regigigas is captured, a run of the Regi trio's captor may bring them in the
 *   temple's place, two ruins side by side, Regieleki's and Regidrago's. Walking
 *   into one wakes its Regi as a wave legendary (`data/legendBosses.ts`) and
 *   seals the other until another run; a Regi already captured leaves its ruin
 *   dark.
 * - The Forces of Nature (`game/roamers.ts`, like the lake trio): a run that
 *   brings no lake legend may bring one of them, each visit with its own
 *   weather: Tornadus the snow (its Bleakwind Storm is a freezing gale that
 *   frostbites in Legends: Arceus), Thundurus the rain (its storm), Landorus the
 *   sandstorm (its Sand Force and Sandsear Storm), Enamorus the sun (spring's).
 *   Their HP carries across runs and their attacks grow in three phases as it
 *   wears down (`FORCE_PHASES`, by the share left). Landorus only shows once
 *   Tornadus and Thundurus are captured, Enamorus once all three are.
 */

/* ---------------- The Ruínas da Decisão ---------------- */

/**
 * Chance a run brings the Ruins (by the seed) while a Regi of theirs is
 * free and Regigigas is captured: drawn before the temple's rematch, so a
 * run brings one or the other. When they stand (run seconds), how far
 * ahead of the player, the ruins' spacing, how far in front of a ruin its
 * threshold is (the ring on the ground) and how close to it wakes its Regi,
 * and the seconds they take to rise.
 */
export const RUINS = {
  odds: 0.4,
  at: [210, 480],
  distance: 200,
  apart: 92,
  front: 24,
  wake: 18,
  rise: 2.4,
} as const

/** Which side each ruin stands on (west, east), its Regi's colors (glow, core, spark) and type. */
export const RUINS_SIDES = {
  regieleki: { side: -1, light: ['#f8d838', '#fff8b0', '#ffffff'], type: 'electric' },
  regidrago: { side: 1, light: ['#58c058', '#c8f8a8', '#ffffff'], type: 'dragon' },
} as const satisfies Record<RuinsRegi, { side: -1 | 1; light: readonly [string, string, string]; type: PokeType }>

/* ---------------- The Forces of Nature ---------------- */

/**
 * The Forces' roaming, the lake trio's rules (`ROAM` in `data/quests.ts`) with
 * their own numbers: `odds` of a run that brings no lake legend, its first
 * visit and the gaps after, the visits a run, how long one lasts, the share
 * of its max HP it flees after losing in one, how far is away, and its HP
 * (`ENEMIES[force].hp` × `riftScale` × `hp` by difficulty). `fear` and the
 * paces as `ROAM`'s.
 */
export const FORCE_ROAM = {
  odds: 0.25,
  first: [80, 150],
  gap: [55, 85],
  visits: 3,
  stay: 32,
  perVisit: 0.2,
  escape: 440,
  distance: [180, 240],
  fear: 130,
  flee: 1.15,
  amble: 0.4,
  hp: { normal: 0.8, hard: 1, nightmare: 1.25 },
} as const satisfies { hp: Record<Difficulty, number> } & Record<string, unknown>

/** The weather each Force brings with it, for its whole visit. */
export const FORCE_WEATHER = {
  tornadus: 'snow',
  thundurus: 'rain',
  landorus: 'sand',
  enamorus: 'sun',
} as const satisfies Record<ForceId, WeatherId>

/**
 * How each Force moves and fights on a visit: `flee` runs from a player who
 * comes close (Tornadus, the fastest of them); `hold` keeps `range` px off,
 * coming in from afar (Thundurus in its clouds); `stand` closes in to `range`
 * and fights until it has lost `will` of its max HP in the visit, then flees
 * (Landorus); `orbit` circles the player at `range` px (Enamorus). `every`:
 * seconds between its attacks; `contrary` (Enamorus): each hit it takes this
 * visit makes them come that share sooner, up to `rush`.
 */
export type ForceQuirk =
  | { kind: 'flee'; every: number }
  | { kind: 'hold'; range: number; every: number }
  | { kind: 'stand'; range: number; will: number; every: number }
  | { kind: 'orbit'; range: number; every: number; contrary: number; rush: number }

export const FORCE_QUIRKS = {
  tornadus: { kind: 'flee', every: 3.4 },
  thundurus: { kind: 'hold', range: 120, every: 2.8 },
  landorus: { kind: 'stand', range: 72, will: 0.1, every: 2.6 },
  enamorus: { kind: 'orbit', range: 84, every: 3.2, contrary: 0.03, rush: 0.5 },
} as const satisfies Record<ForceId, ForceQuirk>

/** The share of its HP left (carried across runs) under which each Force's second and third phase begin. */
export const FORCE_PHASE_AT = [2 / 3, 1 / 3] as const

/** A ring of the Force's look closing on the player from `around` px, a `gap` (rad) left open. */
const closing = (visual: HazardVisual, count: number, damage: number, gap: number): BossPattern => ({
  kind: 'ring', every: 0, count, speed: 58, radius: 5, damage, visual, around: 116, windup: 0.9, gap,
})

/**
 * Each Force's attacks on the open map, phase by phase (by the share of its HP
 * left, `FORCE_PHASE_AT`): thrown in turn, one every `FORCE_QUIRKS[force].every`
 * s (`throwPattern`: no fight, so only the patterns that need none). The last
 * phase brings its signature as the closing pattern of the turn.
 */
export const FORCE_PATTERNS = {
  tornadus: [
    [
      { kind: 'volley', every: 0, count: 5, arc: 0.9, speed: 140, windup: 0.8, radius: 5, damage: 16, visual: 'aero' },
      { kind: 'strikes', every: 0, target: 'player', count: 3, spread: 50, radius: 14, delay: 1, damage: 16, visual: 'ice', lead: 1 },
    ],
    [
      { kind: 'volley', every: 0, count: 7, arc: 1.2, speed: 150, windup: 0.8, radius: 5, damage: 18, visual: 'aero' },
      { kind: 'ring', every: 0, count: 14, speed: 70, radius: 5, damage: 16, visual: 'ice', gap: 0.9 },
      { kind: 'strikes', every: 0, target: 'player', count: 4, spread: 60, radius: 14, delay: 1, damage: 18, visual: 'aero', lead: 1 },
    ],
    [
      { kind: 'volley', every: 0, count: 9, arc: 1.5, speed: 160, windup: 0.8, radius: 5, damage: 18, visual: 'aero' },
      { kind: 'ring', every: 0, count: 16, speed: 76, radius: 5, damage: 18, visual: 'ice', gap: 0.8 },
      // Bleakwind Storm: lanes of gale from past the screen's edge; the gaps between them are the way through.
      { kind: 'beam', every: 0, source: 'edge', count: 5, spread: 58, windup: 1.2, duration: 0.45, width: 12, length: 540, damage: 22, visual: 'aero' },
    ],
  ],
  thundurus: [
    [
      { kind: 'strikes', every: 0, target: 'player', count: 3, spread: 50, radius: 15, delay: 1.1, damage: 18, visual: 'thunder', lead: 1 },
      { kind: 'volley', every: 0, count: 3, arc: 0.4, speed: 130, windup: 0.8, radius: 5, damage: 16, visual: 'thunder' },
    ],
    [
      { kind: 'strikes', every: 0, target: 'player', count: 5, spread: 70, radius: 15, delay: 1, damage: 18, visual: 'thunder', lead: 1 },
      { kind: 'beam', every: 0, source: 'boss', count: 3, spread: 0.4, windup: 1, duration: 0.45, width: 10, length: 300, damage: 20, visual: 'thunder' },
      { kind: 'volley', every: 0, count: 5, arc: 0.7, speed: 140, windup: 0.8, radius: 5, damage: 16, visual: 'thunder' },
    ],
    [
      { kind: 'strikes', every: 0, target: 'player', count: 7, spread: 90, radius: 15, delay: 1, damage: 20, visual: 'thunder', lead: 1 },
      { kind: 'beam', every: 0, source: 'lattice', count: 4, spread: 64, windup: 1.3, duration: 0.45, width: 11, length: 520, damage: 22, visual: 'thunder' },
      // The whole storm: bolts all over, a moment apart.
      { kind: 'strikes', every: 0, target: 'player', count: 10, spread: 120, radius: 16, delay: 1.2, damage: 22, visual: 'thunder' },
    ],
  ],
  landorus: [
    [
      { kind: 'strikes', every: 0, target: 'player', count: 4, spread: 60, radius: 14, delay: 1.1, damage: 20, visual: 'rock', lead: 1 },
      { kind: 'strikes', every: 0, target: 'self', count: 1, spread: 0, radius: 50, delay: 1.2, damage: 22, visual: 'slam' },
    ],
    [
      { kind: 'strikes', every: 0, target: 'player', count: 5, spread: 70, radius: 14, delay: 1, damage: 20, visual: 'rock', lead: 1 },
      { kind: 'ring', every: 0, count: 14, speed: 66, radius: 5, damage: 18, visual: 'rock', gap: 0.9 },
      { kind: 'strikes', every: 0, target: 'self', count: 1, spread: 0, radius: 56, delay: 1.1, damage: 24, visual: 'slam' },
    ],
    [
      { kind: 'ring', every: 0, count: 16, speed: 72, radius: 5, damage: 20, visual: 'fire', gap: 0.8 },
      { kind: 'strikes', every: 0, target: 'player', count: 6, spread: 80, radius: 14, delay: 1, damage: 22, visual: 'rock', lead: 1 },
      // Sandsear Storm: a cage of searing sand closes around the player.
      { kind: 'cage', every: 0, radius: 70, count: 14, size: 11, windup: 1.1, ttl: 3.2, damage: 18, visual: 'rock' },
    ],
  ],
  enamorus: [
    [
      { kind: 'volley', every: 0, count: 5, arc: 0.8, speed: 120, windup: 0.8, radius: 5, damage: 16, visual: 'mist' },
      { kind: 'strikes', every: 0, target: 'player', count: 3, spread: 50, radius: 14, delay: 1.1, damage: 16, visual: 'mist', lead: 1 },
    ],
    [
      { kind: 'volley', every: 0, count: 7, arc: 1.1, speed: 130, windup: 0.8, radius: 5, damage: 18, visual: 'mist' },
      { kind: 'ring', every: 0, count: 14, speed: 64, radius: 5, damage: 16, visual: 'mist', gap: 0.9 },
      { kind: 'strikes', every: 0, target: 'player', count: 4, spread: 60, radius: 14, delay: 1, damage: 18, visual: 'psychic', lead: 1 },
    ],
    [
      { kind: 'volley', every: 0, count: 9, arc: 1.4, speed: 140, windup: 0.8, radius: 5, damage: 18, visual: 'mist' },
      { kind: 'strikes', every: 0, target: 'player', count: 5, spread: 70, radius: 14, delay: 1, damage: 20, visual: 'mist', lead: 1 },
      // Springtide Storm: a ring of petals closes on the player; one way out.
      closing('mist', 22, 20, 0.85),
    ],
  ],
} as const satisfies Record<ForceId, readonly [readonly BossPattern[], readonly BossPattern[], readonly BossPattern[]]>

/**
 * The Forces in Hoopa's rings (`data/rush.ts`), and anywhere else they fight
 * as a boss: one phase each, their open-map attacks with their way of moving,
 * the last phase's signature as the ultimate.
 */
export const FORCE_BOSS_PHASES = {
  tornadus: [
    {
      below: 1,
      steer: { kind: 'hold', range: 120, pace: 1.1 },
      patterns: [pin('aero', 14), { ...FORCE_PATTERNS.tornadus[1][0], every: 3.4 }, { ...FORCE_PATTERNS.tornadus[1][1], every: 4.4 }],
      ultimate: { move: 'Bleakwind Storm', first: 5, every: 14, steps: [{ at: 0, pattern: FORCE_PATTERNS.tornadus[2][2] }] },
    },
  ],
  thundurus: [
    {
      below: 1,
      steer: { kind: 'hold', range: 120, pace: 0.9 },
      patterns: [pin('thunder', 14), { ...FORCE_PATTERNS.thundurus[1][0], every: 3.6 }, { ...FORCE_PATTERNS.thundurus[1][1], every: 5.2 }],
      ultimate: { move: 'Wildbolt Storm', first: 5, every: 15, steps: [{ at: 0, pattern: FORCE_PATTERNS.thundurus[2][1] }, { at: 1.6, pattern: FORCE_PATTERNS.thundurus[2][2] }] },
    },
  ],
  landorus: [
    {
      below: 1,
      steer: { kind: 'chase', pace: 0.8 },
      patterns: [pin('rock', 16), { ...FORCE_PATTERNS.landorus[1][0], every: 3.8 }, { ...FORCE_PATTERNS.landorus[1][2], every: 4.6 }],
      ultimate: { move: 'Sandsear Storm', first: 5, every: 15, steps: [{ at: 0, pattern: FORCE_PATTERNS.landorus[2][2] }, { at: 1.2, pattern: FORCE_PATTERNS.landorus[2][0] }] },
    },
  ],
  enamorus: [
    {
      below: 1,
      steer: { kind: 'orbit', radius: 90, pace: 0.9, keep: 50 },
      patterns: [pin('mist', 14), { ...FORCE_PATTERNS.enamorus[1][0], every: 3.6 }, { ...FORCE_PATTERNS.enamorus[1][2], every: 4.4 }],
      ultimate: { move: 'Springtide Storm', first: 5, every: 14, steps: [{ at: 0, pattern: FORCE_PATTERNS.enamorus[2][2] }] },
    },
  ],
} as const satisfies Record<ForceId, readonly BossPhase[]>

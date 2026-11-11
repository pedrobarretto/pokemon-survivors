import type { BiomeId } from './biomes'
import type { BossPattern, BossPhase } from './bosses'
import type { Difficulty } from '../game/difficulty'
import { pin } from './domains/kit'
import type { LakeId, SwordId } from './legends'

/**
 * The legends met on the open map, as data: the roaming lake trio
 * (`game/roamers.ts`) and the Swords of Justice's duels (`game/duels.ts`).
 * Both are drawn from the run's seed apart from its rng (`game/quests.ts`), so
 * a run that brings none plays exactly as before, and both are solo only, on
 * the open map (`COOP_LOCKS`).
 */

/**
 * The roaming lake trio. A run brings one with `odds` (the save's free ones
 * only), first between `first` s, then every `gap` s, up to `visits` times.
 * A visit lasts `stay` s; it flees early once it has lost `perVisit` of its
 * max HP in it, or when everyone is past `escape` px. Its HP is
 * `ENEMIES[legend].hp` × `riftScale` × `hp` (by difficulty), and the share
 * left carries over in the save (`Save.roamers`). It runs from a player
 * within `fear` px at `flee` × its pace, and ambles at `amble` × otherwise.
 */
export const ROAM = {
  odds: 0.22,
  first: [70, 130],
  gap: [50, 80],
  visits: 4,
  stay: 28,
  perVisit: 0.16,
  escape: 420,
  distance: [180, 240],
  fear: 125,
  flee: 1,
  amble: 0.35,
  hp: { normal: 0.8, hard: 1, nightmare: 1.25 },
} as const satisfies { hp: Record<Difficulty, number> } & Record<string, unknown>

/**
 * Each lake legend's quirk. Uxie (knowledge) wipes the player's memory: hit,
 * it blinks `blink` px away and drops off the minimap for `forget` s (at most
 * every `every` s). Mesprit (emotion) swings between joy (it circles the
 * player at `orbit` px, slow) and sorrow (it flees and heals `heal` of its max
 * HP per second, never above the share it began the visit with), `swing` s
 * each. Azelf (willpower) stands its ground and fights (a strike on the
 * player every `every` s) until its will breaks after losing `will` of its
 * max HP in a visit; then it flees like the others.
 */
export const LAKE_QUIRKS = {
  uxie: { blink: [90, 140], forget: 4, every: 2.5 },
  mesprit: { swing: 6, orbit: 70, heal: 0.012 },
  azelf: { will: 0.08, every: 2.4, reach: 70 },
} as const satisfies Record<LakeId, unknown>

/** Azelf's attacks while its will holds: Psychic on the player and an Extrasensory burst around itself. */
export const AZELF_STRIKES: readonly BossPattern[] = [
  { kind: 'strikes', every: 0, target: 'player', count: 3, spread: 46, radius: 14, delay: 1, damage: 16, visual: 'psychic', lead: 1 },
  { kind: 'strikes', every: 0, target: 'self', count: 1, spread: 0, radius: 44, delay: 1.1, damage: 18, visual: 'psychic' },
]

/** What a Sword's duel tests: holding out (`endure`: keep your HP over `floor` for `time` s), power (`power`: knock it out in `time` s) or speed (`speed`: step on `marks` leaf marks in `time` s). */
export type DuelTest =
  | { kind: 'endure'; time: number; floor: number }
  | { kind: 'power'; time: number }
  | { kind: 'speed'; time: number; marks: number }

/**
 * The Swords of Justice's duels. A run brings one Sword with `odds` (the
 * save's free ones only); it waits for the player in a biome that fits it
 * (`SWORD_DUELS[sword].biomes`): after `from` s, once the player has spent
 * `dwell` s in one, it shows up `distance` px ahead and waits `wait` s. A
 * player standing `stand` s in its circle (`circle` px) starts the duel: a
 * ring of `ring` px closes around both, the horde kept out of it. Its HP is
 * `ENEMIES[sword].hp` × `riftScale` × `hp` (by difficulty). A leaf mark (the
 * speed test) is `mark` px wide.
 */
export const DUEL = {
  odds: 0.3,
  from: 100,
  dwell: 6,
  distance: [130, 170],
  wait: 40,
  circle: 24,
  stand: 1.2,
  ring: 100,
  mark: 12,
  hp: { normal: 0.8, hard: 1, nightmare: 1.25 },
} as const satisfies { hp: Record<Difficulty, number> } & Record<string, unknown>

/**
 * Where each Sword waits, its test and its HP in the duel (× `DUEL.hp`):
 * Cobalion in caves and on the mountains (defense), Terrakion in the desert
 * and on the volcano's rock (power: its HP is the test, beaten in time),
 * Virizion in the forest and the meadow (speed). Knocking a Sword out passes
 * any test.
 */
export const SWORD_DUELS = {
  cobalion: { biomes: ['cave', 'snow'], test: { kind: 'endure', time: 25, floor: 0.3 }, hp: 1 },
  terrakion: { biomes: ['desert', 'volcano'], test: { kind: 'power', time: 32 }, hp: 0.45 },
  virizion: { biomes: ['forest', 'meadow'], test: { kind: 'speed', time: 26, marks: 6 }, hp: 0.7 },
} as const satisfies Record<SwordId, { biomes: readonly BiomeId[]; test: DuelTest; hp: number }>

/** Sacred Sword: parallel blades of light from past the screen's edge; the gaps between them are the way through. */
const blades = (count: number, windup: number, damage: number, every = 0): BossPattern => ({
  kind: 'beam', every, source: 'edge', count, spread: 58, windup, duration: 0.4, width: 12, length: 520, damage, visual: 'steel',
})

/**
 * The Swords fight in one phase each, in their duels and in Hoopa's rings,
 * every attack read on the open map (no cover): Cobalion presses hard and
 * long (the endurance test), Terrakion hits heavy and slow (it must be beaten
 * fast), Virizion darts about while its leaf marks wait.
 */
export const SWORD_PHASES = {
  cobalion: [
    {
      below: 1,
      steer: { kind: 'hold', range: 70, pace: 0.8 },
      patterns: [
        pin('steel', 16),
        { kind: 'dash', every: 5.6, windup: 0.9, speed: 230, width: 22, damage: 20, count: 2 },
        { kind: 'ring', every: 4.2, count: 14, speed: 64, radius: 5, damage: 16, visual: 'steel', gap: 0.9 },
        { kind: 'strikes', every: 4.8, target: 'player', count: 4, spread: 60, radius: 15, delay: 1.1, damage: 18, visual: 'steel', lead: 1 },
      ],
      ultimate: { move: 'Sacred Sword', first: 6, every: 14, steps: [{ at: 0, pattern: blades(5, 1.3, 22) }, { at: 1.6, pattern: blades(5, 1.2, 22) }] },
    },
  ],
  terrakion: [
    {
      below: 1,
      steer: { kind: 'chase', pace: 0.7 },
      patterns: [
        pin('rock', 18),
        { kind: 'strikes', every: 3.8, target: 'player', count: 5, spread: 70, radius: 14, delay: 1.1, damage: 20, visual: 'rock' },
        { kind: 'strikes', every: 5.2, target: 'self', count: 1, spread: 0, radius: 52, delay: 1.3, damage: 24, visual: 'slam' },
        { kind: 'cage', every: 9, radius: 70, count: 10, size: 13, windup: 1, ttl: 3, damage: 16, visual: 'rock' },
      ],
      ultimate: {
        move: 'Sacred Sword',
        first: 7,
        every: 15,
        steps: [{ at: 0, pattern: { kind: 'blast', every: 0, windup: 2.4, damage: 30, safe: 'far', radius: 96, visual: 'rock' } }],
      },
    },
  ],
  virizion: [
    {
      below: 1,
      steer: { kind: 'hold', range: 110, pace: 1.1 },
      patterns: [
        pin('grass', 14),
        { kind: 'dash', every: 3.6, windup: 0.7, speed: 280, width: 18, damage: 16, count: 3 },
        { kind: 'volley', every: 3.4, count: 5, arc: 0.9, speed: 120, windup: 0.6, radius: 5, damage: 14, visual: 'grass' },
      ],
      ultimate: { move: 'Sacred Sword', first: 6, every: 13, steps: [{ at: 0, pattern: blades(4, 1.1, 18) }, { at: 1.2, pattern: blades(4, 1.1, 18) }] },
    },
  ],
} as const satisfies Record<SwordId, readonly BossPhase[]>

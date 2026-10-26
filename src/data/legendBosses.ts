import type { BiomeId } from './biomes'
import type { BossPattern, BossPhase, HazardVisual } from './bosses'
import type { EnemyId } from './enemies'
import type { ThemeId } from './music'
import { pin } from './domains/kit'

/**
 * The legendaries that fight on the map instead of in a rift: the trio drawn
 * for the run (7:00, 9:30, 12:00), the rare mythical and Mewtwo at the finale,
 * and Arceus, the endless mode's reaper. Each fights in three phases
 * (`BossPhase`): its old stance kit first, then a phase that brings in a new
 * way to move (a dive, a dash, a teleport, a cage), then its last phase with
 * its signature ultimate, themed on its legendary move. They keep their stats
 * (no extra HP): the phases add variety, not length, and each one's ultimate
 * holds the rest of its patterns while it plays.
 *
 * Wave bosses still swap stances (`stance` gates) and enrage under half HP
 * (`below: 0.5`), inside whatever phase they're in; `from` adds the Nightmare
 * extras. Ultimates use the overworld's safe spots: shelters marked around the
 * player (`spots`), getting away from (`far`) or under (`near`) the boss, the
 * gap of a closing ring, or the lanes between lances.
 */

/** The legendaries this module gives phases (rift legendaries have theirs in `data/domains`). */
export const WAVE_LEGENDS = [
  'articuno', 'zapdos', 'moltres', 'raikou', 'entei', 'suicune', 'regirock', 'regice', 'registeel', 'mew', 'celebi', 'jirachi', 'mewtwo', 'arceus',
] as const satisfies readonly EnemyId[]
export type WaveLegend = (typeof WAVE_LEGENDS)[number]

export const isWaveLegend = (id: EnemyId): id is WaveLegend => (WAVE_LEGENDS as readonly EnemyId[]).includes(id)

/**
 * Judgment's plate in each biome, as the look (and type) its attacks take:
 * `JUDGMENT_PLATES` (`data/legendaryMoves.ts`) in hazard looks. Hazards have no
 * bug, ghost or ground look, so the Insect Plate shows as grass, the Spooky Plate as shadow and the Earth Plate as rock.
 */
export const JUDGMENT_PLATE = {
  meadow: 'grass',
  forest: 'grass',
  cave: 'rock',
  snow: 'ice',
  tower: 'shadow',
  beach: 'water',
  plant: 'thunder',
  desert: 'rock',
  volcano: 'fire',
} as const satisfies Record<BiomeId, HazardVisual>

/**
 * How each one arrives in its entrance (`game/legendScene.ts`): down from the
 * sky (`descend`), leaping in (`bound`), up out of the ground (`rise`), or out
 * of thin air (`materialize`).
 */
export type Arrival = 'descend' | 'bound' | 'rise' | 'materialize'

export const ARRIVAL = {
  articuno: 'descend', zapdos: 'descend', moltres: 'descend',
  raikou: 'bound', entei: 'bound', suicune: 'bound',
  regirock: 'rise', regice: 'rise', registeel: 'rise',
  mew: 'materialize', celebi: 'materialize', jirachi: 'descend',
  mewtwo: 'materialize', arceus: 'descend',
} as const satisfies Record<WaveLegend, Arrival>

/** The theme each one plays while it's the boss on the HP bar (`data/music.ts`): one per trio, Mewtwo's finale (the mythicals come with it), and Arceus's. */
export const LEGEND_THEME = {
  articuno: 'birds', zapdos: 'birds', moltres: 'birds',
  raikou: 'beasts', entei: 'beasts', suicune: 'beasts',
  regirock: 'regis', regice: 'regis', registeel: 'regis',
  mew: 'mewtwo', celebi: 'mewtwo', jirachi: 'mewtwo', mewtwo: 'mewtwo',
  arceus: 'arceus',
} as const satisfies Record<WaveLegend, ThemeId>

/**
 * Multiplies a wave legendary's HP as it arrives (`legendEntrance`): its phase
 * openings, dives and teleports keep it out of reach for a share of the fight,
 * so it gives that back and the fight lasts about as long as it did in one phase.
 */
export const WAVE_LEGEND_HP = 0.85

/** Chance a wave legendary arrives shiny (`legendEntrance`), as a rift's does (`RIFT.shinyOdds`): beating one unlocks its shiny in Legend mode. */
export const WAVE_LEGEND_SHINY = 1 / 8

/** Seconds a wave legendary holds still and untouchable as a phase begins (shorter than a rift's: the horde keeps coming, and the fight shouldn't last longer than it did in one phase). */
const SHIFT = 1.2

/** Share of each pattern's pause it waits after a phase's opening: soon, so a fight that ends fast still sees its phases attack. */
const OPEN = 0.2

/** Thresholds of the three phases (share of HP left). */
const TRIO = [1, 0.66, 0.33] as const

/* ---------------- Building blocks ---------------- */

/** Parallel lances from past the screen's edge, `spread` px apart; the gaps between them are the way through. */
const lances = (visual: HazardVisual, count: number, windup: number, damage: number, every = 0, width = 14): BossPattern => ({
  kind: 'beam', every, source: 'edge', count, spread: 56, windup, duration: 0.4, width, length: 560, damage, visual,
})

/** A ring closing on the player from `around` px with a `gap` (rad) left open: the way out. */
const closing = (visual: HazardVisual, count: number, damage: number, gap: number, every = 0, around = 118, speed = 58): BossPattern => ({
  kind: 'ring', every, count, speed, radius: 5, damage, visual, around, windup: 0.9, gap,
})


/** The boss flies or burrows under the player: its shadow or wake follows them, then stops where it lands. */
const dive = (visual: HazardVisual, every: number, damage: number): BossPattern => ({ kind: 'dive', every, hide: 1.1, windup: 0.85, radius: 28, damage, visual })

/* ---------------- The Kanto birds ---------------- */

const articuno: readonly BossPhase[] = [
  {
    below: TRIO[0],
    patterns: [
      pin('ice', 18),
      { stance: 'ranged', kind: 'ring', every: 3.2, count: 12, speed: 72, radius: 5, damage: 18, visual: 'ice' },
      { stance: 'ranged', kind: 'strikes', every: 4, target: 'player', count: 3, spread: 0, radius: 13, delay: 1.1, damage: 18, visual: 'ice', lead: 1 },
      { stance: 'close', kind: 'strikes', every: 4, target: 'self', count: 1, spread: 0, radius: 42, delay: 1.2, damage: 20, visual: 'ice' },
      { far: 120, kind: 'strikes', every: 7, target: 'player', count: 1, spread: 0, radius: 28, delay: 1.3, damage: 20, visual: 'aero', lead: 1, leap: true },
      { from: 'nightmare', stance: 'close', kind: 'trail', every: 0.25, ttl: 2.4, radius: 7, damage: 12, visual: 'ice' },
    ],
  },
  {
    // It takes to the sky: Fly (its shadow hunts the player) and a sweeping Ice Beam.
    below: TRIO[1],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('ice', 18),
      dive('aero', 8.5, 20),
      { stance: 'ranged', kind: 'beam', every: 6, source: 'boss', count: 1, spread: 0, sweep: 1.2, windup: 1.1, duration: 1.2, width: 10, length: 300, damage: 16, visual: 'ice' },
      { stance: 'ranged', kind: 'ring', every: 3.6, count: 12, speed: 72, radius: 5, damage: 18, visual: 'ice' },
      { stance: 'close', kind: 'strikes', every: 4, target: 'self', count: 1, spread: 0, radius: 42, delay: 1.2, damage: 20, visual: 'ice' },
      { below: 0.5, kind: 'volley', every: 4, count: 5, arc: 0.8, speed: 100, windup: 0.9, radius: 5, damage: 18, visual: 'ice' },
    ],
    ultimate: { move: 'Sheer Cold', first: 1.5, every: 18, steps: [{ at: 0, pattern: closing('ice', 20, 18, 1) }, { at: 1.7, pattern: closing('ice', 20, 18, 0.9) }] },
  },
  {
    // A blizzard over everything: only the snow shelters it marks keep the player safe.
    below: TRIO[2],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('ice', 18),
      dive('aero', 10, 20),
      { kind: 'beam', every: 6.5, source: 'boss', count: 1, spread: 0, sweep: 1.4, windup: 1.1, duration: 1.3, width: 10, length: 300, damage: 16, visual: 'ice' },
      { stance: 'ranged', kind: 'strikes', every: 4, target: 'player', count: 3, spread: 0, radius: 13, delay: 1.1, damage: 18, visual: 'ice', lead: 1 },
      { stance: 'close', kind: 'ring', every: 3.6, count: 12, speed: 72, radius: 5, damage: 18, visual: 'ice' },
      { from: 'nightmare', stance: 'close', kind: 'trail', every: 0.25, ttl: 2.4, radius: 7, damage: 12, visual: 'ice' },
    ],
    ultimate: {
      move: 'Snowscape',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: { kind: 'blast', every: 0, windup: 2.4, damage: 26, safe: 'spots', spots: 3, visual: 'ice' } },
        { at: 2.6, pattern: { kind: 'ring', every: 0, count: 14, speed: 70, radius: 5, damage: 16, visual: 'ice' } },
      ],
    },
  },
]

const zapdos: readonly BossPhase[] = [
  {
    below: TRIO[0],
    patterns: [
      pin('thunder', 22),
      { stance: 'ranged', kind: 'strikes', every: 2.6, target: 'player', count: 4, spread: 64, radius: 15, delay: 1, damage: 24, visual: 'thunder', lead: 1 },
      { stance: 'close', kind: 'strikes', every: 3.6, target: 'self', count: 1, spread: 0, radius: 44, delay: 1.1, damage: 24, visual: 'thunder' },
      { far: 120, kind: 'strikes', every: 6.5, target: 'player', count: 1, spread: 0, radius: 26, delay: 1.2, damage: 22, visual: 'thunder', lead: 1, leap: true },
      { from: 'nightmare', stance: 'ranged', kind: 'volley', every: 4.4, count: 4, arc: 0.6, speed: 130, windup: 0.9, radius: 5, damage: 20, visual: 'aero' },
    ],
  },
  {
    // Drill Peck charges and Thunder lances across the field.
    below: TRIO[1],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('thunder', 22),
      { kind: 'dash', every: 7, windup: 0.9, speed: 260, width: 20, damage: 22, count: 2 },
      { stance: 'ranged', ...lances('thunder', 3, 1.2, 22), every: 6 },
      { stance: 'ranged', kind: 'strikes', every: 3.4, target: 'player', count: 3, spread: 60, radius: 15, delay: 1, damage: 22, visual: 'thunder', lead: 1 },
      { stance: 'close', kind: 'strikes', every: 3.8, target: 'self', count: 1, spread: 0, radius: 44, delay: 1.1, damage: 24, visual: 'thunder' },
      { below: 0.5, kind: 'ring', every: 4, count: 12, speed: 90, radius: 5, damage: 20, visual: 'aero' },
    ],
    ultimate: {
      move: 'Zap Cannon',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: { kind: 'beam', every: 0, source: 'boss', count: 1, spread: 0, windup: 1.3, duration: 0.5, width: 22, length: 380, damage: 26, visual: 'thunder' } },
        { at: 1.9, pattern: { kind: 'beam', every: 0, source: 'boss', count: 2, spread: 0.5, windup: 1.1, duration: 0.5, width: 18, length: 380, damage: 24, visual: 'thunder' } },
      ],
    },
  },
  {
    // The ground around Zapdos charges: get out of the field, then through the lances.
    below: TRIO[2],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('thunder', 22),
      { kind: 'dash', every: 8, windup: 0.9, speed: 270, width: 20, damage: 22, count: 2 },
      { stance: 'ranged', kind: 'strikes', every: 2.8, target: 'player', count: 4, spread: 64, radius: 15, delay: 1, damage: 22, visual: 'thunder', lead: 1 },
      { stance: 'close', kind: 'ring', every: 4, count: 12, speed: 90, radius: 5, damage: 20, visual: 'aero' },
      { far: 120, kind: 'strikes', every: 6.5, target: 'player', count: 1, spread: 0, radius: 26, delay: 1.2, damage: 22, visual: 'thunder', lead: 1, leap: true },
      { from: 'nightmare', stance: 'ranged', kind: 'volley', every: 4.4, count: 4, arc: 0.6, speed: 130, windup: 0.9, radius: 5, damage: 20, visual: 'aero' },
    ],
    ultimate: {
      move: 'Electric Terrain',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: { kind: 'blast', every: 0, windup: 2.4, damage: 30, safe: 'far', radius: 116, visual: 'thunder' } },
        { at: 2.6, pattern: lances('thunder', 5, 1.2, 22) },
      ],
    },
  },
]

const moltres: readonly BossPhase[] = [
  {
    below: TRIO[0],
    patterns: [
      pin('fire', 22),
      { kind: 'trail', every: 0.16, ttl: 3.2, radius: 7, damage: 14, visual: 'fire' },
      { stance: 'ranged', kind: 'ring', every: 4.5, count: 8, speed: 60, radius: 5, damage: 20, visual: 'fire' },
      { stance: 'ranged', kind: 'strikes', every: 3.8, target: 'player', count: 3, spread: 0, radius: 13, delay: 1.1, damage: 20, visual: 'fire', lead: 1 },
      { stance: 'close', kind: 'strikes', every: 4.2, target: 'self', count: 1, spread: 0, radius: 44, delay: 1.2, damage: 22, visual: 'fire' },
      { far: 120, kind: 'strikes', every: 6.5, target: 'player', count: 1, spread: 0, radius: 30, delay: 1.3, damage: 24, visual: 'fire', lead: 1, leap: true },
      { from: 'nightmare', stance: 'close', kind: 'strikes', every: 4.6, target: 'self', count: 3, spread: 70, radius: 20, delay: 1.2, damage: 22, visual: 'fire' },
    ],
  },
  {
    // Fly with a burning shadow, and Flamethrower sweeping the field.
    below: TRIO[1],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('fire', 22),
      { kind: 'trail', every: 0.2, ttl: 3, radius: 7, damage: 14, visual: 'fire' },
      dive('fire', 9, 24),
      { stance: 'ranged', kind: 'beam', every: 6.5, source: 'boss', count: 1, spread: 0, sweep: 1.4, windup: 1.1, duration: 1.2, width: 12, length: 300, damage: 18, visual: 'fire' },
      { stance: 'close', kind: 'strikes', every: 4.2, target: 'self', count: 1, spread: 0, radius: 44, delay: 1.2, damage: 22, visual: 'fire' },
      { below: 0.5, kind: 'volley', every: 4, count: 7, arc: 1.2, speed: 100, windup: 0.9, radius: 5, damage: 20, visual: 'fire' },
    ],
    ultimate: {
      move: 'Heat Wave',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: { kind: 'volley', every: 0, count: 9, arc: 1.6, speed: 100, windup: 1, radius: 5, damage: 20, visual: 'fire' } },
        { at: 1.4, pattern: { kind: 'volley', every: 0, count: 9, arc: 1.6, speed: 110, windup: 0.9, radius: 5, damage: 20, visual: 'fire' } },
      ],
    },
  },
  {
    // Overheat: the air burns everywhere but under Moltres's own wings.
    below: TRIO[2],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('fire', 22),
      { kind: 'trail', every: 0.16, ttl: 3.2, radius: 7, damage: 14, visual: 'fire' },
      dive('fire', 10, 24),
      { stance: 'ranged', kind: 'strikes', every: 3.8, target: 'player', count: 3, spread: 0, radius: 13, delay: 1.1, damage: 20, visual: 'fire', lead: 1 },
      { stance: 'ranged', kind: 'ring', every: 4.5, count: 8, speed: 60, radius: 5, damage: 20, visual: 'fire' },
      { stance: 'close', kind: 'strikes', every: 4.2, target: 'self', count: 1, spread: 0, radius: 44, delay: 1.2, damage: 22, visual: 'fire' },
      { from: 'nightmare', stance: 'close', kind: 'strikes', every: 4.6, target: 'self', count: 3, spread: 70, radius: 20, delay: 1.2, damage: 22, visual: 'fire' },
    ],
    ultimate: {
      move: 'Overheat',
      first: 1.5,
      every: 18,
      steps: [{ at: 0, pattern: { kind: 'blast', every: 0, windup: 2.6, damage: 34, safe: 'near', radius: 62, visual: 'fire' } }],
    },
  },
]

/* ---------------- Johto's beasts ---------------- */

const raikou: readonly BossPhase[] = [
  {
    below: TRIO[0],
    patterns: [
      pin('thunder', 18),
      { stance: 'ranged', kind: 'strikes', every: 3, target: 'player', count: 3, spread: 46, radius: 13, delay: 0.9, damage: 18, visual: 'thunder', lead: 1 },
      { stance: 'close', kind: 'trail', every: 0.22, ttl: 1.6, radius: 6, damage: 10, visual: 'thunder' },
      { stance: 'close', kind: 'strikes', every: 3.8, target: 'self', count: 1, spread: 0, radius: 40, delay: 1.1, damage: 20, visual: 'thunder' },
      { far: 120, kind: 'strikes', every: 6.5, target: 'player', count: 1, spread: 0, radius: 26, delay: 1.1, damage: 20, visual: 'thunder', lead: 1, leap: true },
      { from: 'nightmare', kind: 'ring', every: 4.4, count: 10, speed: 90, radius: 5, damage: 16, visual: 'aero' },
    ],
  },
  {
    // Extreme Speed: three charges in a row down marked lanes.
    below: TRIO[1],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('thunder', 18),
      { kind: 'dash', every: 7, windup: 0.8, speed: 300, width: 18, damage: 18, count: 3 },
      { stance: 'ranged', kind: 'strikes', every: 3.2, target: 'player', count: 3, spread: 46, radius: 13, delay: 0.9, damage: 18, visual: 'thunder', lead: 1 },
      { stance: 'close', kind: 'trail', every: 0.22, ttl: 1.6, radius: 6, damage: 10, visual: 'thunder' },
      { below: 0.5, stance: 'ranged', kind: 'strikes', every: 3.2, target: 'player', count: 5, spread: 70, radius: 12, delay: 1, damage: 16, visual: 'thunder' },
    ],
    ultimate: {
      move: 'Discharge',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: { kind: 'strikes', every: 0, target: 'self', count: 1, spread: 0, radius: 66, delay: 1.4, damage: 20, visual: 'thunder' } },
        { at: 1.4, pattern: { kind: 'ring', every: 0, count: 14, speed: 95, radius: 5, damage: 16, visual: 'thunder' } },
      ],
    },
  },
  {
    // Thunderclap: lightning strikes first, three waves of lances in a breath and a last charge.
    below: TRIO[2],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('thunder', 18),
      { kind: 'dash', every: 8, windup: 0.8, speed: 300, width: 18, damage: 18, count: 2 },
      { stance: 'ranged', kind: 'strikes', every: 3, target: 'player', count: 3, spread: 46, radius: 13, delay: 0.9, damage: 18, visual: 'thunder', lead: 1 },
      { stance: 'close', kind: 'trail', every: 0.22, ttl: 1.6, radius: 6, damage: 10, visual: 'thunder' },
      { far: 120, kind: 'strikes', every: 6.5, target: 'player', count: 1, spread: 0, radius: 26, delay: 1.1, damage: 20, visual: 'thunder', lead: 1, leap: true },
      { from: 'nightmare', kind: 'ring', every: 4.4, count: 10, speed: 90, radius: 5, damage: 16, visual: 'aero' },
    ],
    ultimate: {
      move: 'Thunderclap',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: lances('thunder', 4, 1.1, 18) },
        { at: 1.2, pattern: lances('thunder', 4, 1, 18) },
        { at: 2.4, pattern: lances('thunder', 4, 0.9, 18) },
        { at: 3.6, pattern: { kind: 'dash', every: 0, windup: 0.8, speed: 340, width: 18, damage: 20, count: 1 } },
      ],
    },
  },
]

const entei: readonly BossPhase[] = [
  {
    below: TRIO[0],
    patterns: [
      pin('fire', 22),
      { stance: 'ranged', kind: 'strikes', every: 3.4, target: 'player', count: 5, spread: 72, radius: 13, delay: 1.1, damage: 22, visual: 'fire', lead: 1 },
      { stance: 'close', kind: 'trail', every: 0.2, ttl: 2.4, radius: 7, damage: 14, visual: 'fire' },
      { stance: 'close', kind: 'strikes', every: 4.4, target: 'self', count: 1, spread: 0, radius: 50, delay: 1.3, damage: 26, visual: 'fire' },
      { far: 120, kind: 'strikes', every: 6.5, target: 'player', count: 1, spread: 0, radius: 30, delay: 1.3, damage: 24, visual: 'fire', lead: 1, leap: true },
      { from: 'nightmare', stance: 'close', kind: 'ring', every: 4.4, count: 10, speed: 70, radius: 5, damage: 20, visual: 'fire' },
    ],
  },
  {
    // Flame Charge: it rushes through, leaving fire behind.
    below: TRIO[1],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('fire', 22),
      { kind: 'dash', every: 7.5, windup: 0.9, speed: 240, width: 22, damage: 24, count: 2 },
      { stance: 'ranged', kind: 'strikes', every: 3.6, target: 'player', count: 4, spread: 72, radius: 13, delay: 1.1, damage: 22, visual: 'fire', lead: 1 },
      { stance: 'close', kind: 'trail', every: 0.2, ttl: 2.4, radius: 7, damage: 14, visual: 'fire' },
      { far: 120, kind: 'strikes', every: 6.5, target: 'player', count: 1, spread: 0, radius: 30, delay: 1.3, damage: 24, visual: 'fire', lead: 1, leap: true },
      { below: 0.5, kind: 'volley', every: 4, count: 5, arc: 1, speed: 100, windup: 1, radius: 5, damage: 20, visual: 'fire' },
    ],
    ultimate: {
      move: 'Eruption',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: { kind: 'strikes', every: 0, target: 'player', count: 9, spread: 110, radius: 15, delay: 1.3, damage: 22, visual: 'fire' } },
        { at: 1.5, pattern: { kind: 'strikes', every: 0, target: 'player', count: 6, spread: 0, radius: 14, delay: 1.1, damage: 22, visual: 'fire', lead: 1 } },
      ],
    },
  },
  {
    // Burning Bulwark: a wall of fire shuts the player in while fire rains inside.
    below: TRIO[2],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('fire', 22),
      { kind: 'dash', every: 8, windup: 0.9, speed: 240, width: 22, damage: 24, count: 2 },
      { stance: 'ranged', kind: 'strikes', every: 3.4, target: 'player', count: 5, spread: 72, radius: 13, delay: 1.1, damage: 22, visual: 'fire', lead: 1 },
      { stance: 'close', kind: 'strikes', every: 4.4, target: 'self', count: 1, spread: 0, radius: 50, delay: 1.3, damage: 26, visual: 'fire' },
      { stance: 'close', kind: 'trail', every: 0.2, ttl: 2.4, radius: 7, damage: 14, visual: 'fire' },
      { from: 'nightmare', stance: 'close', kind: 'ring', every: 4.4, count: 10, speed: 70, radius: 5, damage: 20, visual: 'fire' },
    ],
    ultimate: {
      move: 'Burning Bulwark',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: { kind: 'cage', every: 0, radius: 76, count: 26, size: 8, windup: 1, ttl: 5.4, damage: 12, visual: 'fire' } },
        { at: 1.2, pattern: { kind: 'strikes', every: 0, target: 'player', count: 3, spread: 0, radius: 14, delay: 1.1, damage: 20, visual: 'fire', lead: 1 } },
        { at: 2.6, pattern: { kind: 'strikes', every: 0, target: 'player', count: 1, spread: 0, radius: 26, delay: 1.2, damage: 22, visual: 'fire' } },
        { at: 3.6, pattern: { kind: 'strikes', every: 0, target: 'player', count: 4, spread: 56, radius: 13, delay: 1.1, damage: 20, visual: 'fire' } },
      ],
    },
  },
]

const suicune: readonly BossPhase[] = [
  {
    below: TRIO[0],
    patterns: [
      pin('water', 22),
      { stance: 'ranged', kind: 'ring', every: 3.6, count: 16, speed: 62, radius: 5, damage: 20, visual: 'water' },
      { stance: 'ranged', kind: 'strikes', every: 4.4, target: 'player', count: 2, spread: 44, radius: 18, delay: 1.1, damage: 22, visual: 'water', lead: 1 },
      { stance: 'close', kind: 'ring', every: 3.2, count: 10, speed: 96, radius: 5, damage: 18, visual: 'ice' },
      { stance: 'close', kind: 'strikes', every: 4.2, target: 'self', count: 1, spread: 0, radius: 44, delay: 1.2, damage: 22, visual: 'water' },
      { far: 120, kind: 'strikes', every: 6.5, target: 'player', count: 1, spread: 0, radius: 30, delay: 1.3, damage: 24, visual: 'water', lead: 1, leap: true },
      { from: 'nightmare', stance: 'close', kind: 'trail', every: 0.25, ttl: 2.4, radius: 7, damage: 14, visual: 'water' },
    ],
  },
  {
    // It glides over the field (Surf charges) and sweeps it with Aurora Beam.
    below: TRIO[1],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('water', 22),
      { kind: 'dash', every: 7.5, windup: 0.9, speed: 230, width: 24, damage: 22, count: 2 },
      { stance: 'ranged', kind: 'beam', every: 7, source: 'boss', count: 1, spread: 0, sweep: 1.6, windup: 1.1, duration: 1.4, width: 10, length: 300, damage: 18, visual: 'ice' },
      { stance: 'ranged', kind: 'ring', every: 4, count: 14, speed: 62, radius: 5, damage: 20, visual: 'water' },
      { stance: 'close', kind: 'strikes', every: 4.2, target: 'self', count: 1, spread: 0, radius: 44, delay: 1.2, damage: 22, visual: 'water' },
      { below: 0.5, kind: 'volley', every: 3.8, count: 3, arc: 0.25, speed: 140, windup: 1, radius: 5, damage: 22, visual: 'water' },
    ],
    ultimate: {
      move: 'Hydro Pump',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: { kind: 'beam', every: 0, source: 'boss', count: 2, spread: 0.4, windup: 1.2, duration: 0.6, width: 14, length: 340, damage: 20, visual: 'water' } },
        { at: 2, pattern: { kind: 'beam', every: 0, source: 'boss', count: 2, spread: 0.4, windup: 1.1, duration: 0.6, width: 14, length: 340, damage: 20, visual: 'water' } },
      ],
    },
  },
  {
    // Aqua Ring: rings of water close in, each with one way out.
    below: TRIO[2],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('water', 22),
      { kind: 'dash', every: 8, windup: 0.9, speed: 230, width: 24, damage: 22, count: 2 },
      { stance: 'ranged', kind: 'ring', every: 3.6, count: 16, speed: 62, radius: 5, damage: 20, visual: 'water' },
      { stance: 'ranged', kind: 'strikes', every: 4.4, target: 'player', count: 2, spread: 44, radius: 18, delay: 1.1, damage: 22, visual: 'water', lead: 1 },
      { stance: 'close', kind: 'strikes', every: 4.2, target: 'self', count: 1, spread: 0, radius: 44, delay: 1.2, damage: 22, visual: 'water' },
      { far: 120, kind: 'strikes', every: 6.5, target: 'player', count: 1, spread: 0, radius: 30, delay: 1.3, damage: 24, visual: 'water', lead: 1, leap: true },
      { from: 'nightmare', stance: 'close', kind: 'trail', every: 0.25, ttl: 2.4, radius: 7, damage: 14, visual: 'water' },
    ],
    ultimate: {
      move: 'Aqua Ring',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: closing('water', 22, 18, 1) },
        { at: 2.2, pattern: closing('water', 20, 18, 0.95, 0, 104) },
      ],
    },
  },
]

/* ---------------- Hoenn's Regis ---------------- */

const regirock: readonly BossPhase[] = [
  {
    below: TRIO[0],
    patterns: [
      pin('rock', 18),
      { stance: 'ranged', kind: 'strikes', every: 3.4, target: 'player', count: 4, spread: 56, radius: 12, delay: 1.1, damage: 18, visual: 'rock' },
      { stance: 'close', kind: 'strikes', every: 4.2, target: 'self', count: 1, spread: 0, radius: 46, delay: 1.3, damage: 20, visual: 'slam' },
      { stance: 'close', kind: 'ring', every: 3.8, count: 8, speed: 64, radius: 5, damage: 18, visual: 'rock' },
      { far: 120, kind: 'volley', every: 5, count: 3, arc: 0.4, speed: 120, windup: 1, radius: 5, damage: 18, visual: 'rock' },
      { from: 'nightmare', stance: 'close', kind: 'strikes', every: 4.6, target: 'self', count: 3, spread: 60, radius: 18, delay: 1.2, damage: 20, visual: 'slam' },
    ],
  },
  {
    // Rock Tomb shuts the player in; Rock Slide lances cut across.
    below: TRIO[1],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('rock', 18),
      { kind: 'cage', every: 11, radius: 70, count: 20, size: 9, windup: 1.1, ttl: 3.6, damage: 14, visual: 'rock' },
      { stance: 'ranged', ...lances('rock', 3, 1.2, 18, 0, 16), every: 6.5 },
      { stance: 'close', kind: 'strikes', every: 4.2, target: 'self', count: 1, spread: 0, radius: 46, delay: 1.3, damage: 20, visual: 'slam' },
      { far: 120, kind: 'volley', every: 5, count: 3, arc: 0.4, speed: 120, windup: 1, radius: 5, damage: 18, visual: 'rock' },
      { below: 0.5, stance: 'ranged', kind: 'strikes', every: 3.6, target: 'player', count: 3, spread: 0, radius: 14, delay: 1.1, damage: 18, visual: 'rock', lead: 1 },
    ],
    ultimate: {
      move: 'Stone Edge',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: { kind: 'strikes', every: 0, target: 'player', count: 9, spread: 100, radius: 14, delay: 1.2, damage: 18, visual: 'rock' } },
        { at: 1.4, pattern: { kind: 'strikes', every: 0, target: 'player', count: 9, spread: 100, radius: 14, delay: 1.2, damage: 18, visual: 'rock' } },
      ],
    },
  },
  {
    // Rock Wrecker: three huge boulders, each aimed with a line first.
    below: TRIO[2],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('rock', 18),
      { kind: 'cage', every: 12, radius: 70, count: 20, size: 9, windup: 1.1, ttl: 3.6, damage: 14, visual: 'rock' },
      { stance: 'ranged', kind: 'strikes', every: 3.4, target: 'player', count: 4, spread: 56, radius: 12, delay: 1.1, damage: 18, visual: 'rock' },
      { stance: 'close', kind: 'strikes', every: 4.2, target: 'self', count: 1, spread: 0, radius: 46, delay: 1.3, damage: 20, visual: 'slam' },
      { stance: 'close', kind: 'ring', every: 3.8, count: 8, speed: 64, radius: 5, damage: 18, visual: 'rock' },
      { from: 'nightmare', stance: 'close', kind: 'strikes', every: 4.6, target: 'self', count: 3, spread: 60, radius: 18, delay: 1.2, damage: 20, visual: 'slam' },
    ],
    ultimate: {
      move: 'Rock Wrecker',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: { kind: 'volley', every: 0, count: 1, arc: 0, speed: 170, windup: 1.2, radius: 14, damage: 28, visual: 'rock' } },
        { at: 1.5, pattern: { kind: 'volley', every: 0, count: 1, arc: 0, speed: 180, windup: 1.1, radius: 14, damage: 28, visual: 'rock' } },
        { at: 3, pattern: { kind: 'volley', every: 0, count: 3, arc: 0.5, speed: 170, windup: 1.1, radius: 12, damage: 26, visual: 'rock' } },
      ],
    },
  },
]

const regice: readonly BossPhase[] = [
  {
    below: TRIO[0],
    patterns: [
      pin('ice', 22),
      { stance: 'ranged', kind: 'ring', every: 3.4, count: 14, speed: 66, radius: 5, damage: 20, visual: 'ice' },
      { stance: 'ranged', kind: 'strikes', every: 4.2, target: 'player', count: 2, spread: 40, radius: 18, delay: 1.1, damage: 24, visual: 'ice', lead: 1 },
      { stance: 'close', kind: 'trail', every: 0.3, ttl: 2.8, radius: 8, damage: 12, visual: 'ice' },
      { stance: 'close', kind: 'strikes', every: 4, target: 'self', count: 1, spread: 0, radius: 48, delay: 1.3, damage: 24, visual: 'ice' },
      { far: 120, kind: 'volley', every: 5, count: 3, arc: 0.3, speed: 130, windup: 1, radius: 5, damage: 22, visual: 'ice' },
      { from: 'nightmare', stance: 'close', kind: 'ring', every: 4, count: 10, speed: 90, radius: 5, damage: 18, visual: 'ice' },
    ],
  },
  {
    // Ice Beams fan out from its body, and Icy Wind closes in around the player.
    below: TRIO[1],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('ice', 22),
      { stance: 'ranged', kind: 'beam', every: 6, source: 'boss', count: 3, spread: 0.5, windup: 1.1, duration: 0.5, width: 10, length: 320, damage: 20, visual: 'ice' },
      closing('ice', 18, 18, 1.1, 9, 110, 55),
      { stance: 'close', kind: 'trail', every: 0.3, ttl: 2.8, radius: 8, damage: 12, visual: 'ice' },
      { stance: 'close', kind: 'strikes', every: 4, target: 'self', count: 1, spread: 0, radius: 48, delay: 1.3, damage: 24, visual: 'ice' },
      { far: 120, kind: 'volley', every: 5, count: 3, arc: 0.3, speed: 130, windup: 1, radius: 5, damage: 22, visual: 'ice' },
      { below: 0.5, stance: 'ranged', kind: 'strikes', every: 3.6, target: 'player', count: 4, spread: 0, radius: 14, delay: 1.1, damage: 20, visual: 'ice', lead: 1 },
    ],
    ultimate: {
      move: 'Blizzard',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: lances('ice', 5, 1.2, 20) },
        { at: 1.3, pattern: lances('ice', 5, 1.1, 20) },
      ],
    },
  },
  {
    // Glaciate: the ground freezes around Regice (get out), then everywhere else (get back in).
    below: TRIO[2],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('ice', 22),
      { stance: 'ranged', kind: 'beam', every: 6.5, source: 'boss', count: 3, spread: 0.5, windup: 1.1, duration: 0.5, width: 10, length: 320, damage: 20, visual: 'ice' },
      closing('ice', 18, 18, 1.1, 10, 110, 55),
      { stance: 'ranged', kind: 'ring', every: 3.6, count: 14, speed: 66, radius: 5, damage: 20, visual: 'ice' },
      { stance: 'close', kind: 'strikes', every: 4, target: 'self', count: 1, spread: 0, radius: 48, delay: 1.3, damage: 24, visual: 'ice' },
      { from: 'nightmare', stance: 'close', kind: 'ring', every: 4, count: 10, speed: 90, radius: 5, damage: 18, visual: 'ice' },
    ],
    ultimate: {
      move: 'Glaciate',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: { kind: 'blast', every: 0, windup: 2.2, damage: 26, safe: 'far', radius: 74, visual: 'ice' } },
        { at: 2.5, pattern: { kind: 'blast', every: 0, windup: 2, damage: 26, safe: 'near', radius: 74, visual: 'ice' } },
      ],
    },
  },
]

const registeel: readonly BossPhase[] = [
  {
    below: TRIO[0],
    patterns: [
      pin('steel', 22),
      { stance: 'ranged', kind: 'ring', every: 4, count: 18, speed: 56, radius: 5, damage: 20, visual: 'steel' },
      { stance: 'ranged', kind: 'strikes', every: 3.8, target: 'player', count: 4, spread: 70, radius: 15, delay: 1.1, damage: 24, visual: 'steel' },
      { stance: 'close', kind: 'strikes', every: 4.6, target: 'self', count: 1, spread: 0, radius: 56, delay: 1.4, damage: 26, visual: 'slam' },
      { far: 120, kind: 'volley', every: 5, count: 3, arc: 0.35, speed: 120, windup: 1, radius: 5, damage: 24, visual: 'steel' },
      { from: 'nightmare', stance: 'close', kind: 'ring', every: 4.2, count: 12, speed: 60, radius: 5, damage: 20, visual: 'steel' },
    ],
  },
  {
    // Flash Cannon beams and an Iron Head charge.
    below: TRIO[1],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('steel', 22),
      { kind: 'dash', every: 8, windup: 1, speed: 220, width: 26, damage: 26, count: 1 },
      { stance: 'ranged', kind: 'beam', every: 6.5, source: 'boss', count: 2, spread: 0.5, windup: 1.1, duration: 0.5, width: 12, length: 320, damage: 22, visual: 'steel' },
      { stance: 'ranged', kind: 'ring', every: 4.4, count: 16, speed: 56, radius: 5, damage: 20, visual: 'steel' },
      { stance: 'close', kind: 'strikes', every: 4.6, target: 'self', count: 1, spread: 0, radius: 56, delay: 1.4, damage: 26, visual: 'slam' },
      { far: 120, kind: 'volley', every: 5, count: 3, arc: 0.35, speed: 120, windup: 1, radius: 5, damage: 24, visual: 'steel' },
      { below: 0.5, stance: 'ranged', kind: 'strikes', every: 3.6, target: 'player', count: 4, spread: 0, radius: 15, delay: 1.1, damage: 22, visual: 'steel', lead: 1 },
    ],
    ultimate: {
      move: 'Heavy Slam',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: { kind: 'strikes', every: 0, target: 'player', count: 1, spread: 0, radius: 46, delay: 1.6, damage: 28, visual: 'slam', leap: true } },
        { at: 1.7, pattern: { kind: 'ring', every: 0, count: 18, speed: 70, radius: 5, damage: 20, visual: 'steel' } },
      ],
    },
  },
  {
    // Metal Burst: it braces, then throws everything back, crossing lances and a wall of steel.
    below: TRIO[2],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('steel', 22),
      { kind: 'dash', every: 8.5, windup: 1, speed: 220, width: 26, damage: 26, count: 1 },
      { stance: 'ranged', kind: 'ring', every: 4, count: 18, speed: 56, radius: 5, damage: 20, visual: 'steel' },
      { stance: 'ranged', kind: 'strikes', every: 3.8, target: 'player', count: 4, spread: 70, radius: 15, delay: 1.1, damage: 24, visual: 'steel' },
      { stance: 'close', kind: 'strikes', every: 4.6, target: 'self', count: 1, spread: 0, radius: 56, delay: 1.4, damage: 26, visual: 'slam' },
      { from: 'nightmare', stance: 'close', kind: 'ring', every: 4.2, count: 12, speed: 60, radius: 5, damage: 20, visual: 'steel' },
    ],
    ultimate: {
      move: 'Metal Burst',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: { kind: 'strikes', every: 0, target: 'self', count: 1, spread: 0, radius: 34, delay: 1, damage: 24, visual: 'steel' } },
        { at: 1, pattern: lances('steel', 3, 1.2, 22) },
        { at: 1.9, pattern: lances('steel', 3, 1.1, 22) },
        { at: 3.3, pattern: { kind: 'ring', every: 0, count: 18, speed: 48, radius: 5, damage: 20, visual: 'steel' } },
      ],
    },
  },
]

/* ---------------- The finale ---------------- */

const mew: readonly BossPhase[] = [
  {
    below: TRIO[0],
    patterns: [
      pin('psychic', 22),
      { stance: 'ranged', kind: 'ring', every: 2.4, count: 8, speed: 90, radius: 5, damage: 22, visual: 'psychic' },
      { stance: 'ranged', kind: 'strikes', every: 3.6, target: 'player', count: 3, spread: 0, radius: 13, delay: 1.1, damage: 20, visual: 'psychic', lead: 1 },
      { stance: 'close', kind: 'strikes', every: 3.5, target: 'self', count: 1, spread: 0, radius: 38, delay: 1.1, damage: 22, visual: 'psychic' },
      { far: 120, kind: 'strikes', every: 6, target: 'player', count: 1, spread: 0, radius: 26, delay: 1.2, damage: 22, visual: 'psychic', lead: 1, leap: true },
      { from: 'nightmare', stance: 'close', kind: 'ring', every: 4, count: 10, speed: 80, radius: 5, damage: 20, visual: 'psychic' },
    ],
  },
  {
    // It blinks onto the player and plays with psychic volleys.
    below: TRIO[1],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('psychic', 22),
      { kind: 'teleport', every: 8, to: 'player', windup: 0.9, radius: 30, damage: 22, visual: 'psychic' },
      { stance: 'ranged', kind: 'ring', every: 2.8, count: 8, speed: 90, radius: 5, damage: 22, visual: 'psychic' },
      { stance: 'close', kind: 'strikes', every: 3.5, target: 'self', count: 1, spread: 0, radius: 38, delay: 1.1, damage: 22, visual: 'psychic' },
      { below: 0.5, kind: 'volley', every: 3.6, count: 5, arc: 0.9, speed: 110, windup: 0.9, radius: 5, damage: 20, visual: 'psychic' },
    ],
    ultimate: { move: 'Psychic', first: 1.5, every: 18, steps: [{ at: 0, pattern: lances('psychic', 3, 1.2, 20) }, { at: 1.3, pattern: lances('psychic', 3, 1.1, 20) }] },
  },
  {
    // Ancient Power: stones rise all around and close in, each ring with a way out.
    below: TRIO[2],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('psychic', 22),
      { kind: 'teleport', every: 8.5, to: 'player', windup: 0.9, radius: 30, damage: 22, visual: 'psychic' },
      { stance: 'ranged', kind: 'strikes', every: 3.6, target: 'player', count: 3, spread: 0, radius: 13, delay: 1.1, damage: 20, visual: 'psychic', lead: 1 },
      { stance: 'ranged', kind: 'ring', every: 2.6, count: 8, speed: 90, radius: 5, damage: 22, visual: 'psychic' },
      { far: 120, kind: 'strikes', every: 6, target: 'player', count: 1, spread: 0, radius: 26, delay: 1.2, damage: 22, visual: 'psychic', lead: 1, leap: true },
      { from: 'nightmare', stance: 'close', kind: 'ring', every: 4, count: 10, speed: 80, radius: 5, damage: 20, visual: 'psychic' },
    ],
    ultimate: {
      move: 'Ancient Power',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: closing('rock', 16, 18, 1) },
        { at: 2, pattern: closing('rock', 16, 18, 0.95) },
        { at: 3.6, pattern: { kind: 'strikes', every: 0, target: 'player', count: 4, spread: 60, radius: 14, delay: 1.1, damage: 18, visual: 'rock' } },
      ],
    },
  },
]

const celebi: readonly BossPhase[] = [
  {
    below: TRIO[0],
    patterns: [
      pin('grass', 22),
      { stance: 'ranged', kind: 'ring', every: 2.6, count: 10, speed: 86, radius: 5, damage: 22, visual: 'grass' },
      { stance: 'ranged', kind: 'strikes', every: 3.6, target: 'player', count: 3, spread: 50, radius: 14, delay: 1.1, damage: 20, visual: 'psychic', lead: 1 },
      { stance: 'close', kind: 'strikes', every: 3.5, target: 'self', count: 1, spread: 0, radius: 40, delay: 1.1, damage: 22, visual: 'grass' },
      { far: 120, kind: 'strikes', every: 6, target: 'player', count: 1, spread: 0, radius: 26, delay: 1.2, damage: 22, visual: 'grass', lead: 1, leap: true },
      { from: 'nightmare', stance: 'close', kind: 'trail', every: 0.25, ttl: 2.4, radius: 7, damage: 14, visual: 'grass' },
    ],
  },
  {
    // It slips through time, away from the player, leaving leaves behind.
    below: TRIO[1],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('grass', 22),
      { kind: 'teleport', every: 9, to: 'far', windup: 0.9, radius: 26, damage: 20, visual: 'grass' },
      { kind: 'trail', every: 0.3, ttl: 2.4, radius: 7, damage: 12, visual: 'grass' },
      { stance: 'ranged', kind: 'ring', every: 2.8, count: 10, speed: 86, radius: 5, damage: 22, visual: 'grass' },
      { stance: 'close', kind: 'strikes', every: 3.5, target: 'self', count: 1, spread: 0, radius: 40, delay: 1.1, damage: 22, visual: 'grass' },
      { far: 120, kind: 'strikes', every: 6, target: 'player', count: 1, spread: 0, radius: 26, delay: 1.2, damage: 22, visual: 'grass', lead: 1, leap: true },
      { below: 0.5, kind: 'volley', every: 3.6, count: 5, arc: 1, speed: 105, windup: 0.9, radius: 5, damage: 20, visual: 'grass' },
    ],
    ultimate: {
      move: 'Future Sight',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: { kind: 'strikes', every: 0, target: 'player', count: 5, spread: 0, radius: 16, delay: 1.6, damage: 20, visual: 'psychic', lead: 1 } },
        { at: 1.8, pattern: { kind: 'strikes', every: 0, target: 'player', count: 5, spread: 0, radius: 16, delay: 1.5, damage: 20, visual: 'psychic', lead: 1 } },
      ],
    },
  },
  {
    // Magical Leaf: fans of leaves that follow the player, then a ring of them closing in.
    below: TRIO[2],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('grass', 22),
      { kind: 'teleport', every: 9.5, to: 'far', windup: 0.9, radius: 26, damage: 20, visual: 'grass' },
      { stance: 'ranged', kind: 'ring', every: 2.6, count: 10, speed: 86, radius: 5, damage: 22, visual: 'grass' },
      { stance: 'ranged', kind: 'strikes', every: 3.6, target: 'player', count: 3, spread: 50, radius: 14, delay: 1.1, damage: 20, visual: 'psychic', lead: 1 },
      { stance: 'close', kind: 'strikes', every: 3.5, target: 'self', count: 1, spread: 0, radius: 40, delay: 1.1, damage: 22, visual: 'grass' },
      { from: 'nightmare', stance: 'close', kind: 'trail', every: 0.25, ttl: 2.4, radius: 7, damage: 14, visual: 'grass' },
    ],
    ultimate: {
      move: 'Magical Leaf',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: { kind: 'volley', every: 0, count: 5, arc: 1.2, speed: 110, windup: 1, radius: 5, damage: 18, visual: 'grass' } },
        { at: 1, pattern: { kind: 'volley', every: 0, count: 5, arc: 1.2, speed: 115, windup: 0.9, radius: 5, damage: 18, visual: 'grass' } },
        { at: 2.2, pattern: closing('grass', 18, 18, 1) },
      ],
    },
  },
]

const jirachi: readonly BossPhase[] = [
  {
    below: TRIO[0],
    patterns: [
      pin('steel', 22),
      { stance: 'ranged', kind: 'strikes', every: 3.4, target: 'player', count: 1, spread: 0, radius: 28, delay: 1.5, damage: 30, visual: 'steel' },
      { stance: 'ranged', kind: 'ring', every: 3, count: 8, speed: 84, radius: 5, damage: 20, visual: 'steel' },
      { stance: 'close', kind: 'strikes', every: 3.5, target: 'self', count: 1, spread: 0, radius: 38, delay: 1.1, damage: 22, visual: 'psychic' },
      { far: 120, kind: 'strikes', every: 6, target: 'player', count: 1, spread: 0, radius: 26, delay: 1.2, damage: 22, visual: 'steel', lead: 1, leap: true },
      { from: 'nightmare', stance: 'ranged', kind: 'volley', every: 4.2, count: 4, arc: 0.7, speed: 115, windup: 0.9, radius: 5, damage: 20, visual: 'steel' },
    ],
  },
  {
    // It blinks onto the player between Meteor Mash and steel rings.
    below: TRIO[1],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('steel', 22),
      { kind: 'teleport', every: 8.5, to: 'player', windup: 0.9, radius: 28, damage: 22, visual: 'steel' },
      { stance: 'ranged', kind: 'ring', every: 3.2, count: 8, speed: 84, radius: 5, damage: 20, visual: 'steel' },
      { stance: 'close', kind: 'strikes', every: 3.5, target: 'self', count: 1, spread: 0, radius: 38, delay: 1.1, damage: 22, visual: 'psychic' },
      { below: 0.5, stance: 'ranged', kind: 'strikes', every: 3.6, target: 'player', count: 4, spread: 0, radius: 14, delay: 1.1, damage: 20, visual: 'steel', lead: 1 },
    ],
    ultimate: {
      move: 'Doom Desire',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: { kind: 'strikes', every: 0, target: 'player', count: 1, spread: 0, radius: 54, delay: 2.2, damage: 30, visual: 'steel' } },
        { at: 1.2, pattern: { kind: 'strikes', every: 0, target: 'player', count: 4, spread: 0, radius: 14, delay: 1.2, damage: 20, visual: 'steel', lead: 1 } },
      ],
    },
  },
  {
    // Wish: a shower of falling stars over the whole field, in three waves.
    below: TRIO[2],
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('steel', 22),
      { kind: 'teleport', every: 9, to: 'player', windup: 0.9, radius: 28, damage: 22, visual: 'steel' },
      { stance: 'ranged', kind: 'strikes', every: 3.4, target: 'player', count: 1, spread: 0, radius: 28, delay: 1.5, damage: 30, visual: 'steel' },
      { stance: 'ranged', kind: 'ring', every: 3, count: 8, speed: 84, radius: 5, damage: 20, visual: 'steel' },
      { far: 120, kind: 'strikes', every: 6, target: 'player', count: 1, spread: 0, radius: 26, delay: 1.2, damage: 22, visual: 'steel', lead: 1, leap: true },
      { from: 'nightmare', stance: 'ranged', kind: 'volley', every: 4.2, count: 4, arc: 0.7, speed: 115, windup: 0.9, radius: 5, damage: 20, visual: 'steel' },
    ],
    ultimate: {
      move: 'Wish',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: { kind: 'strikes', every: 0, target: 'player', count: 12, spread: 130, radius: 14, delay: 1.4, damage: 22, visual: 'judgment' } },
        { at: 1.1, pattern: { kind: 'strikes', every: 0, target: 'player', count: 12, spread: 130, radius: 14, delay: 1.3, damage: 22, visual: 'judgment' } },
        { at: 2.2, pattern: { kind: 'strikes', every: 0, target: 'player', count: 12, spread: 130, radius: 14, delay: 1.2, damage: 22, visual: 'judgment' } },
      ],
    },
  },
]

/**
 * Mewtwo: three phases on every difficulty (70% and 40%). The second brings
 * Teleport onto the player and Telekinesis, a closing ring; the last, its old
 * Hard phase (from Hard: leaps every few seconds between wide Psystrike volleys,
 * slow rings on Nightmare) and Psystrike, lances that cross twice and then a
 * blast only its shelters escape.
 */
const mewtwo: readonly BossPhase[] = [
  {
    below: 1,
    patterns: [
      pin('psychic', 28),
      { kind: 'ring', every: 3, count: 16, speed: 80, radius: 5, damage: 26, visual: 'psychic' },
      { stance: 'ranged', kind: 'strikes', every: 4.5, target: 'player', count: 5, spread: 80, radius: 18, delay: 1.1, damage: 30, visual: 'psychic', lead: 1 },
      { stance: 'close', kind: 'strikes', every: 4.5, target: 'self', count: 1, spread: 0, radius: 52, delay: 1.2, damage: 30, visual: 'psychic' },
      { far: 130, kind: 'strikes', every: 6, target: 'player', count: 1, spread: 0, radius: 30, delay: 1.2, damage: 28, visual: 'psychic', lead: 1, leap: true },
    ],
  },
  {
    below: 0.7,
    shift: SHIFT,
    open: OPEN,
    patterns: [
      pin('psychic', 28),
      { kind: 'teleport', every: 8, to: 'player', windup: 0.9, radius: 32, damage: 28, visual: 'psychic' },
      { kind: 'ring', every: 3.4, count: 16, speed: 80, radius: 5, damage: 26, visual: 'psychic' },
      { stance: 'ranged', kind: 'strikes', every: 4.5, target: 'player', count: 5, spread: 80, radius: 18, delay: 1.1, damage: 30, visual: 'psychic', lead: 1 },
      { stance: 'close', kind: 'strikes', every: 4.5, target: 'self', count: 1, spread: 0, radius: 52, delay: 1.2, damage: 30, visual: 'psychic' },
      { below: 0.5, kind: 'volley', every: 4, count: 3, arc: 0.5, speed: 120, windup: 1, radius: 5, damage: 26, visual: 'psychic' },
    ],
    ultimate: {
      move: 'Telekinesis',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: closing('psychic', 22, 26, 0.85) },
        { at: 1.7, pattern: { kind: 'volley', every: 0, count: 5, arc: 0.9, speed: 125, windup: 0.9, radius: 5, damage: 26, visual: 'psychic' } },
      ],
    },
  },
  {
    below: 0.4,
    shift: 1.5,
    open: OPEN,
    patterns: [
      pin('psychic', 28),
      { kind: 'teleport', every: 7.5, to: 'player', windup: 0.9, radius: 32, damage: 28, visual: 'psychic' },
      { kind: 'ring', every: 3.2, count: 16, speed: 80, radius: 5, damage: 26, visual: 'psychic' },
      { stance: 'ranged', kind: 'strikes', every: 4.5, target: 'player', count: 5, spread: 80, radius: 18, delay: 1.1, damage: 30, visual: 'psychic', lead: 1 },
      { far: 130, kind: 'strikes', every: 6, target: 'player', count: 1, spread: 0, radius: 30, delay: 1.2, damage: 28, visual: 'psychic', lead: 1, leap: true },
      { from: 'hard', kind: 'strikes', every: 3.8, target: 'player', count: 1, spread: 0, radius: 28, delay: 1.1, damage: 28, visual: 'psychic', lead: 1, leap: true },
      { from: 'hard', kind: 'volley', every: 2.6, count: 5, arc: 0.9, speed: 130, windup: 0.9, radius: 5, damage: 26, visual: 'psychic' },
      { from: 'nightmare', kind: 'ring', every: 4.5, count: 12, speed: 52, radius: 5, damage: 24, visual: 'psychic' },
    ],
    ultimate: {
      move: 'Psystrike',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: lances('psychic', 5, 1.2, 26) },
        { at: 1.5, pattern: lances('psychic', 5, 1.1, 26) },
        { at: 3, pattern: { kind: 'blast', every: 0, windup: 2.2, damage: 34, safe: 'spots', spots: 3, visual: 'psychic' } },
      ],
    },
  },
]

/** Arceus walks straight at the player, at its hunting pace (`game/endlessSystem.ts`), in every phase. */
const HUNT = { kind: 'chase' } as const

/** Arceus, the reaper: Judgment's storm of light takes the biome's plate; it hunts, so its phases press rather than hold back. */
const arceus: readonly BossPhase[] = [
  {
    below: 1,
    steer: HUNT,
    patterns: [
      { kind: 'strikes', every: 3, target: 'player', count: 7, spread: 100, radius: 16, delay: 1, damage: 45, visual: 'judgment', plate: true },
      { kind: 'ring', every: 4.5, count: 24, speed: 80, radius: 5, damage: 40, visual: 'judgment' },
    ],
  },
  {
    below: 0.6,
    shift: SHIFT,
    open: OPEN,
    steer: HUNT,
    patterns: [
      { kind: 'strikes', every: 3.2, target: 'player', count: 7, spread: 100, radius: 16, delay: 1, damage: 45, visual: 'judgment', plate: true },
      { kind: 'ring', every: 5, count: 24, speed: 80, radius: 5, damage: 40, visual: 'judgment' },
      { kind: 'teleport', every: 12, to: 'player', windup: 1, radius: 34, damage: 40, visual: 'judgment' },
    ],
    ultimate: {
      move: 'Hyper Beam',
      first: 1.5,
      every: 18,
      steps: [{ at: 0, pattern: { kind: 'beam', every: 0, source: 'boss', count: 1, spread: 0, sweep: 2, windup: 1.3, duration: 1.6, width: 18, length: 360, damage: 32, visual: 'judgment' } }],
    },
  },
  {
    below: 0.3,
    shift: SHIFT,
    open: OPEN,
    steer: HUNT,
    patterns: [
      { kind: 'strikes', every: 3, target: 'player', count: 7, spread: 100, radius: 16, delay: 1, damage: 45, visual: 'judgment', plate: true },
      { kind: 'ring', every: 4.5, count: 24, speed: 80, radius: 5, damage: 40, visual: 'judgment' },
      { kind: 'teleport', every: 12, to: 'player', windup: 1, radius: 34, damage: 40, visual: 'judgment' },
      { ...lances('judgment', 3, 1.2, 36, 8), plate: true },
    ],
    ultimate: {
      move: 'Judgment',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: { kind: 'blast', every: 0, windup: 2.4, damage: 60, safe: 'spots', spots: 3, visual: 'judgment', plate: true } },
        { at: 2.6, pattern: { kind: 'strikes', every: 0, target: 'player', count: 9, spread: 110, radius: 16, delay: 1.1, damage: 45, visual: 'judgment', plate: true } },
      ],
    },
  },
]

/** The phases of every wave legendary, for `BOSS_PHASES`. */
export const WAVE_LEGEND_PHASES = {
  articuno, zapdos, moltres, raikou, entei, suicune, regirock, regice, registeel, mew, celebi, jirachi, mewtwo, arceus,
} as const satisfies Record<WaveLegend, readonly BossPhase[]>

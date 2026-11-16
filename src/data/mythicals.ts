import type { Difficulty } from '../game/difficulty'
import type { StatDelta } from '../game/stats'
import type { BossPattern, BossPhase, HazardVisual } from './bosses'
import { pin } from './domains/kit'
import type { PokeType } from './types'

/**
 * The Grande Atualização's mythicals, as data: three Legend-mode legends,
 * each caught its own way, and Dialga's Primal form.
 *
 * - Diancie: the Escavação's rarest treasure, a pink diamond the API buries
 *   for an account without it (`DIANCIE`, like Meltan's Mystery Box). Its
 *   second awakening is Mega Diancie.
 * - Zeraora: the Power Plant's storm. A run's seed may bring it (`ZERAORA`);
 *   once the player lingers in the Power Plant while it rains, the storm
 *   gathers and Zeraora leaps out of a thunderbolt, a three-phase fight on
 *   the open map under a thunderstorm (`game/zeraora.ts`). Mega Zeraora at the
 *   second awakening.
 * - Ogerpon: its own Tera Raid (`OGERPON.raid`), its mask the run's Tera type
 *   among its four (`OGERPON_MASKS`). In the Legend mode its mask follows the
 *   Tera Shards it picks, Ivy Cudgel takes the mask's type, and Terastallizing
 *   is its Embody Aspect: the mask's crystal sheets, a stat of the mask's, and
 *   Ivy Cudgel's blows bursting in the mask's element (`game/ogerpon.ts`).
 * - Primal Dialga: Dialga's second awakening, and on Nightmare its rift's last
 *   phase (`BossPhase.nightmareForm`).
 *
 * Words live in `i18n/mythicals.ts`.
 */

/* ---------------- Diancie ---------------- */

export const DIANCIE = {
  /** The chance a new Escavação wall holds Diancie's diamond while the account lacks Diancie, and the walls after which one surely does. */
  jewel: 0.015,
  guarantee: 45,
} as const

/* ---------------- Zeraora ---------------- */

/**
 * Zeraora's storm. A run brings the chance with `odds` (the seed's own draw);
 * from `from` to `until` s, once the player has spent `dwell` s in the Power
 * Plant while it rains (and no boss, scene or other legend moment is under
 * way or near), the storm gathers for `gather` s (bolts around the player,
 * the sky darkening) and Zeraora leaps in `distance` px ahead. Its HP is
 * `ENEMIES.zeraora.hp` × `riftScale` × `hp` (by difficulty). While it fights,
 * the rain holds and lightning falls on the field every `bolt.every` s
 * (`bolt.count` bolts around each player, `bolt.damage` each).
 */
export const ZERAORA = {
  odds: 0.45,
  from: 110,
  until: 780,
  dwell: 5,
  gather: 3.2,
  distance: 110,
  hp: { normal: 0.85, hard: 1, nightmare: 1.25 },
  bolt: { every: 1.5, count: 2, spread: 80, radius: 14, delay: 0.95, damage: 12 },
} as const satisfies { hp: Record<Difficulty, number> } & Record<string, unknown>

/** Thresholds of Zeraora's three phases (share of HP left), as the wave legendaries'. */
const PHASES = [1, 0.66, 0.33] as const

/** Lightning lances from past the screen's edge: the gaps between them are the way through. */
const bolts = (count: number, windup: number, damage: number, every = 0): BossPattern => ({
  kind: 'beam', every, source: 'edge', count, spread: 56, windup, duration: 0.35, width: 13, length: 560, damage, visual: 'thunder',
})

/** Plasma Fists: a fist marked on the player's spot, a beat later. */
const fists = (count: number, spread: number, delay: number, damage: number, every = 0): BossPattern => ({
  kind: 'strikes', every, target: 'player', count, spread, radius: 15, delay, damage, visual: 'thunder', lead: 1,
})

/**
 * Zeraora fights like the storm it rides: (1) quick sparks on the player's
 * path, a trail of static as it closes in and Discharge at its feet; (2) Volt
 * Switch, blinking onto the player, with dashes too fast to follow and Plasma
 * Fists in a flurry; (3) the storm breaks: lightning lances, and Plasma Fists
 * charges the whole field, sparing only the shelters it marks.
 */
export const ZERAORA_PHASES: readonly BossPhase[] = [
  {
    below: PHASES[0],
    patterns: [
      pin('thunder', 18),
      { stance: 'ranged', ...fists(3, 46, 0.95, 18), every: 3 },
      { stance: 'close', kind: 'trail', every: 0.2, ttl: 1.6, radius: 6, damage: 10, visual: 'thunder' },
      { stance: 'close', kind: 'strikes', every: 3.8, target: 'self', count: 1, spread: 0, radius: 44, delay: 1.1, damage: 22, visual: 'thunder' },
      { far: 120, kind: 'strikes', every: 6.2, target: 'player', count: 1, spread: 0, radius: 28, delay: 1, damage: 22, visual: 'thunder', lead: 1, leap: true },
      { below: 0.5, kind: 'volley', every: 4.2, count: 5, arc: 0.8, speed: 130, windup: 0.85, radius: 5, damage: 16, visual: 'thunder' },
      { from: 'nightmare', kind: 'ring', every: 4.4, count: 12, speed: 92, radius: 5, damage: 16, visual: 'thunder' },
    ],
  },
  {
    // Volt Switch: it blinks onto the player and zips across the field.
    below: PHASES[1],
    shift: 1.2,
    open: 0.2,
    patterns: [
      pin('thunder', 18),
      { kind: 'teleport', every: 7.5, to: 'player', windup: 1.05, radius: 30, damage: 22, visual: 'thunder' },
      { kind: 'dash', every: 6.4, windup: 0.8, speed: 330, width: 18, damage: 18, count: 3 },
      { stance: 'ranged', ...fists(4, 54, 0.95, 18), every: 3.2 },
      { stance: 'close', kind: 'trail', every: 0.2, ttl: 1.6, radius: 6, damage: 10, visual: 'thunder' },
      { below: 0.5, stance: 'close', kind: 'strikes', every: 4, target: 'self', count: 1, spread: 0, radius: 52, delay: 1.1, damage: 22, visual: 'thunder' },
    ],
    ultimate: {
      move: 'Plasma Fists',
      first: 1.5,
      every: 17,
      steps: [
        { at: 0, pattern: fists(1, 0, 0.9, 20) },
        { at: 0.45, pattern: fists(1, 0, 0.9, 20) },
        { at: 0.9, pattern: fists(1, 0, 0.9, 20) },
        { at: 1.35, pattern: fists(3, 40, 0.9, 20) },
        { at: 2.4, pattern: { kind: 'ring', every: 0, count: 16, speed: 100, radius: 5, damage: 16, visual: 'thunder' } },
      ],
    },
  },
  {
    // The storm breaks: lightning everywhere, Zeraora at its heart.
    below: PHASES[2],
    shift: 1.2,
    open: 0.2,
    patterns: [
      pin('thunder', 18),
      { kind: 'dash', every: 7.5, windup: 0.8, speed: 340, width: 18, damage: 20, count: 2 },
      { stance: 'ranged', ...fists(3, 46, 0.95, 18), every: 3 },
      { stance: 'ranged', ...bolts(3, 1.1, 18), every: 6.5 },
      { stance: 'close', kind: 'trail', every: 0.2, ttl: 1.6, radius: 6, damage: 10, visual: 'thunder' },
      { far: 120, kind: 'teleport', every: 8, to: 'player', windup: 1.05, radius: 30, damage: 22, visual: 'thunder' },
      { from: 'nightmare', kind: 'ring', every: 4.4, count: 12, speed: 92, radius: 5, damage: 16, visual: 'thunder' },
    ],
    ultimate: {
      move: 'Plasma Fists',
      first: 1.5,
      every: 18,
      steps: [
        { at: 0, pattern: { kind: 'blast', every: 0, windup: 2.4, damage: 42, safe: 'spots', spots: 3, visual: 'thunder' } },
        { at: 2.6, pattern: bolts(4, 1, 18) },
        { at: 3.8, pattern: { kind: 'dash', every: 0, windup: 0.8, speed: 360, width: 18, damage: 20, count: 1 } },
      ],
    },
  },
]

/* ---------------- Ogerpon ---------------- */

export const OGERPON_MASK_IDS = ['teal', 'wellspring', 'hearthflame', 'cornerstone'] as const
export type OgerponMask = (typeof OGERPON_MASK_IDS)[number]

/**
 * Ogerpon's four masks (their names are the items', in English): the type each gives it (on top of Grass, the Teal
 * Mask's own), its sheets (`form`, none for the Teal Mask, the species' own)
 * and Terastallized (`tera`), what its Embody Aspect raises while
 * Terastallized (`embody`), how Ivy Cudgel's blows burst then (`visual`, the
 * hazards' look its raid uses too) and its colors.
 */
export const OGERPON_MASKS = {
  teal: { name: 'Teal Mask', type: 'grass', form: null, tera: 'tealTera', embody: { speed: 8, cooldown: -0.06 }, visual: 'grass', colors: ['#58c058', '#a8e878', '#285828'] },
  wellspring: { name: 'Wellspring Mask', type: 'water', form: 'wellspring', tera: 'wellspringTera', embody: { regen: 0.8, maxHp: 20 }, visual: 'water', colors: ['#3890e8', '#a8d8f8', '#18407c'] },
  hearthflame: { name: 'Hearthflame Mask', type: 'fire', form: 'hearthflame', tera: 'hearthflameTera', embody: { might: 0.18 }, visual: 'fire', colors: ['#e84830', '#f8b048', '#781810'] },
  cornerstone: { name: 'Cornerstone Mask', type: 'rock', form: 'cornerstone', tera: 'cornerstoneTera', embody: { armor: 2, maxHp: 15 }, visual: 'rock', colors: ['#a89070', '#e0d0a8', '#504030'] },
} as const satisfies Record<OgerponMask, { name: string; type: PokeType; form: string | null; tera: string; embody: StatDelta; visual: HazardVisual; colors: readonly string[] }>

/** The mask of a Tera type: the one whose type it is, else the Teal Mask. */
export const maskOf = (type: string | null): OgerponMask => OGERPON_MASK_IDS.find((m) => OGERPON_MASKS[m].type === type) ?? 'teal'

/** Whether a Tera type is one of Ogerpon's masks'. */
export const isMaskType = (type: string | null) => OGERPON_MASK_IDS.some((m) => OGERPON_MASKS[m].type === type)

/**
 * Ogerpon's Tera Raid: the run's own raid (its first den) is Ogerpon's with
 * `raid` odds (the seed's own draw), in the mask of the run's Tera type
 * (the Teal Mask without one of its four). Its stars are the run's own raid's.
 * In its own runs, Ogerpon's orb fills `orb` times as fast from its second
 * awakening, and Ivy Cudgel's Terastallized blows burst `burst` px wide (× area).
 */
export const OGERPON = { raid: 0.3, orb: 2, burst: 40 } as const

/** The raid boss's kit: Ivy Cudgel slams along the player's path and at its feet, Horn Leech charges and a ring of thorns. */
export const OGERPON_RAID_PATTERNS: readonly BossPattern[] = [
  { kind: 'strikes', every: 3.4, target: 'player', count: 3, spread: 50, radius: 16, delay: 1.1, damage: 20, visual: 'grass', lead: 1 },
  { kind: 'strikes', every: 5.6, target: 'self', count: 1, spread: 0, radius: 58, delay: 1.2, damage: 24, visual: 'slam' },
  { kind: 'dash', every: 7, windup: 0.9, speed: 260, width: 22, damage: 20, count: 2 },
  { kind: 'ring', every: 4.6, count: 14, speed: 64, radius: 5, damage: 15, visual: 'grass', gap: 0.9 },
]

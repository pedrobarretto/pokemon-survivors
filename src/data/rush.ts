import type { BossPattern, BossPhase } from './bosses'
import type { Difficulty } from '../game/difficulty'
import { pin } from './domains/kit'
import type { EnemyId } from './enemies'
import type { LegendId } from './legends'
import { ULTRA_BEASTS } from './ultraBeasts'

/**
 * Hoopa's Rings (Anéis de Hoopa), the Legend mode's boss rush
 * (`game/rush.ts`): Hoopa's rings bring back the legends the player has
 * captured, one ring after another, in a ring of its golden portals, and the
 * last ring is Hoopa itself. The rush's level is the difficulty picked
 * (`rings`: legends before Hoopa); clearing it once captures Hoopa.
 *
 * `min`: captured legends the rings need to open. Each legend comes with
 * `hp` × `hpBy[difficulty]` × (1 + `ramp` × its ring) HP whatever its species
 * (so a ring of Arceus is as long as a ring of Latias), Hoopa with `hoopa` ×
 * that. The player fights at `level` with their Dojo build for the Pokémon
 * (or the family's own moves at max level), is healed `heal` of their max HP
 * between rings, `rest` s, and each ring opens `gate` s before its legend
 * steps through, `arena` px from the middle of the rings.
 */
export const RUSH = {
  min: 3,
  rings: { normal: 4, hard: 7, nightmare: 10 },
  hp: 3000,
  hpBy: { normal: 0.85, hard: 1.15, nightmare: 1.5 },
  ramp: 0.12,
  hoopa: 1.8,
  level: { normal: 25, hard: 35, nightmare: 45 },
  heal: 0.4,
  rest: 3.5,
  gate: 1.8,
  arena: 132,
  /** The legend steps out this far north of the middle. */
  enter: 70,
} as const satisfies { rings: Record<Difficulty, number>; hpBy: Record<Difficulty, number>; level: Record<Difficulty, number> } & Record<string, unknown>

/**
 * The order the rings bring the captured legends in, from the gentler to the
 * fiercer: the trios, the mythicals, the lake trio and the Swords, the Forces
 * of Nature, the Ultra Beasts, then the rift legendaries, the Ruínas da
 * Decisão's Regis and Regigigas, Darkrai and Palkia,
 * Terapagos, Mewtwo and Arceus. Every captured legend that fights somewhere
 * comes, on the rings' own stage. Never Hoopa (it's the last ring), nor a
 * legend no fight ever brings: Cresselia (a festival's gift), Poipole (the
 * Ultra Beasts' gift) and the path legends but Regigigas (Zygarde, Solgaleo,
 * Lunala, Kubfu and Meltan, each raised on its own path).
 */
export const RUSH_ORDER = [
  'articuno', 'zapdos', 'moltres', 'raikou', 'entei', 'suicune', 'regirock', 'regice', 'registeel',
  'mew', 'celebi', 'jirachi', 'uxie', 'mesprit', 'azelf', 'cobalion', 'terrakion', 'virizion', 'keldeo',
  'tornadus', 'thundurus', 'landorus', 'enamorus',
  ...ULTRA_BEASTS,
  'lugia', 'hoOh', 'latias', 'latios', 'kyogre', 'groudon', 'rayquaza', 'deoxys', 'regieleki', 'regidrago', 'regigigas', 'dialga', 'darkrai', 'palkia', 'terapagos', 'mewtwo', 'arceus',
] as const satisfies readonly (LegendId & EnemyId)[]

/** Hyperspace Fury: fists raining around the player. */
const fists = (count: number, spread: number, damage: number): BossPattern => ({
  kind: 'strikes', every: 0, target: 'player', count, spread, radius: 14, delay: 1, damage, visual: 'shadow',
})

/**
 * The phases of the legends that fight only in the rings (the lake trio,
 * Keldeo) and of Hoopa, the last ring: Confined, its rings throwing copies
 * through and caging the player, then Unbound, all fists, with a Hyperspace
 * Fury only the rings' shelters escape.
 */
export const RUSH_PHASES = {
  uxie: [
    {
      below: 1,
      steer: { kind: 'hold', range: 110, pace: 0.8 },
      patterns: [
        pin('psychic', 14),
        { kind: 'teleport', every: 7, to: 'far', windup: 1, radius: 26, damage: 18, visual: 'psychic' },
        { kind: 'volley', every: 3.6, count: 5, arc: 0.8, speed: 110, windup: 0.7, radius: 5, damage: 16, visual: 'psychic' },
      ],
      ultimate: { move: 'Mystical Power', first: 5, every: 15, steps: [{ at: 0, pattern: { kind: 'ring', every: 0, count: 22, speed: 58, radius: 5, damage: 18, visual: 'psychic', around: 118, windup: 0.9, gap: 0.9 } }] },
    },
  ],
  mesprit: [
    {
      below: 1,
      steer: { kind: 'orbit', radius: 90, pace: 0.9, keep: 50 },
      patterns: [
        pin('psychic', 14),
        { kind: 'ring', every: 3.8, count: 16, speed: 64, radius: 5, damage: 16, visual: 'mist', gap: 0.8 },
        { kind: 'strikes', every: 4.4, target: 'player', count: 4, spread: 60, radius: 15, delay: 1.1, damage: 18, visual: 'psychic', lead: 1 },
      ],
      ultimate: { move: 'Mystical Power', first: 5, every: 15, steps: [{ at: 0, pattern: { kind: 'blast', every: 0, windup: 2.4, damage: 26, safe: 'spots', radius: 18, visual: 'psychic', spots: 3 } }] },
    },
  ],
  azelf: [
    {
      below: 1,
      steer: { kind: 'chase', pace: 0.8 },
      patterns: [
        pin('psychic', 16),
        { kind: 'dash', every: 4.6, windup: 0.8, speed: 260, width: 20, damage: 20, count: 2 },
        { kind: 'strikes', every: 4, target: 'self', count: 1, spread: 0, radius: 46, delay: 1.1, damage: 20, visual: 'psychic' },
      ],
      ultimate: { move: 'Mystical Power', first: 5, every: 14, steps: [{ at: 0, pattern: fists(7, 80, 20) }, { at: 1, pattern: fists(7, 80, 20) }] },
    },
  ],
  keldeo: [
    {
      below: 1,
      steer: { kind: 'hold', range: 90, pace: 1 },
      patterns: [
        pin('water', 15),
        { kind: 'dash', every: 4.2, windup: 0.75, speed: 270, width: 20, damage: 18, count: 2 },
        { kind: 'ring', every: 4, count: 14, speed: 66, radius: 5, damage: 16, visual: 'water', gap: 0.9 },
      ],
      ultimate: {
        move: 'Secret Sword',
        first: 6,
        every: 14,
        steps: [{ at: 0, pattern: { kind: 'beam', every: 0, source: 'edge', count: 5, spread: 58, windup: 1.2, duration: 0.4, width: 12, length: 520, damage: 22, visual: 'water' } }],
      },
    },
  ],
  hoopa: [
    {
      below: 1,
      steer: { kind: 'anchor', x: 0, y: 0, drift: 40, pace: 0.6 },
      patterns: [
        pin('psychic', 16),
        { kind: 'phantoms', every: 6, origin: 'ring', count: 3, gap: 0.45, windup: 0.9, speed: 260, width: 18, radius: 130, damage: 20, visual: 'psychic' },
        { kind: 'volley', every: 3.8, count: 5, arc: 0.7, speed: 110, windup: 0.8, radius: 5, damage: 18, visual: 'shadow' },
        { kind: 'teleport', every: 8.5, to: 'far', windup: 1, radius: 28, damage: 20, visual: 'shadow' },
      ],
      ultimate: {
        move: 'Hyperspace Hole',
        first: 6,
        every: 17,
        steps: [
          { at: 0, pattern: { kind: 'cage', every: 0, radius: 64, count: 12, size: 12, windup: 1, ttl: 3.4, damage: 18, visual: 'shadow' } },
          { at: 1.4, pattern: fists(6, 50, 20) },
        ],
      },
    },
    {
      below: 0.6,
      shift: 2.4,
      form: 'unbound',
      steer: { kind: 'chase', pace: 0.65 },
      patterns: [
        pin('shadow', 18),
        { kind: 'dash', every: 5, windup: 0.85, speed: 250, width: 24, damage: 22, count: 2 },
        { kind: 'strikes', every: 3.4, target: 'player', count: 5, spread: 70, radius: 14, delay: 1, damage: 20, visual: 'shadow', lead: 1 },
        { kind: 'ring', every: 5, count: 18, speed: 62, radius: 5, damage: 18, visual: 'shadow', gap: 0.8 },
      ],
      ultimate: { move: 'Hyperspace Fury', first: 4, every: 15, steps: [{ at: 0, pattern: fists(8, 90, 22) }, { at: 1, pattern: fists(8, 90, 22) }, { at: 2, pattern: fists(8, 90, 22) }] },
    },
    {
      below: 0.3,
      shift: 2.4,
      form: 'unbound',
      haste: 1.15,
      steer: { kind: 'chase', pace: 0.7 },
      patterns: [
        pin('shadow', 18),
        { kind: 'phantoms', every: 5.5, origin: 'ring', count: 4, gap: 0.4, windup: 0.85, speed: 280, width: 18, radius: 130, damage: 22, visual: 'shadow' },
        { kind: 'strikes', every: 3.2, target: 'player', count: 6, spread: 80, radius: 14, delay: 1, damage: 20, visual: 'shadow', lead: 1 },
        { kind: 'beam', every: 7, source: 'lattice', count: 4, spread: 64, windup: 1.3, duration: 0.45, width: 11, length: 520, damage: 22, visual: 'shadow', cross: 'psychic' },
      ],
      ultimate: {
        move: 'Hyperspace Fury',
        first: 4,
        every: 16,
        steps: [
          { at: 0, pattern: { kind: 'blast', every: 0, windup: 2.6, damage: 34, safe: 'spots', radius: 18, visual: 'shadow', spots: 3 } },
          { at: 3, pattern: fists(10, 100, 22) },
        ],
      },
    },
  ],
} as const satisfies Partial<Record<EnemyId, readonly BossPhase[]>>

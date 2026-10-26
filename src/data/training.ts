import type { EnemyId } from './enemies'

/**
 * The Dojo (`game/training.ts`): a run with no horde, where the player sets
 * their own moves, items and form and tries them on training dummies. The
 * dummies are wild species standing still, one per type, so a build can be
 * tried against what it hits hard and what resists it; Snorlax stands in for
 * a boss (bosses take less knockback and shrug off executes).
 */
export const TRAINING = {
  /** The species standing in as the dummy when the Dojo opens: Wobbuffet, the punching bag that takes it all. */
  target: 'wobbuffet',
  /** How many dummies stand: one for single-target damage, a few for spread, a crowd for area moves. */
  counts: [1, 3, 8, 24],
  /** A dummy's HP: topped up every tick, so it never faints, while the damage it took is counted. */
  hp: 1e7,
  /** How fast (per second) a knocked-back dummy slides back to its post. */
  spring: 4,
  /** Distance (world px) from the player's start to the dummies: one ahead, the rest in a ring around. */
  reach: 80,
} as const

/** The dummies to pick from, one or two per type, and the boss. */
export const TRAINING_TARGETS = [
  'wobbuffet',
  'tauros',
  'vulpix',
  'psyduck',
  'oddish',
  'mareep',
  'snorunt',
  'machop',
  'sandshrew',
  'scyther',
  'gastly',
  'dratini',
  'sneasel',
  'aron',
  'clefairy',
  'sudowoodo',
  'snorlax',
] as const satisfies readonly EnemyId[]

export type TrainingTarget = (typeof TRAINING_TARGETS)[number]

export const isTrainingTarget = (id: unknown): id is TrainingTarget => TRAINING_TARGETS.some((t) => t === id)

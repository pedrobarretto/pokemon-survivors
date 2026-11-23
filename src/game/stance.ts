import type { PlayerStats } from './stats'

/**
 * Stances: a special that swaps formes instead of attacking, cycling through
 * its `STANCE_CYCLES` entry on each press. Aegislash's Stance Change swaps
 * Shield (takes less, hits softer) and Blade (hits harder, takes a bit more);
 * Deoxys's Forme Change cycles Normal, Attack, Defense and Speed. The
 * multipliers apply on top of the final stats (`recomputeStats`), so moves,
 * the walk and the damage taken (`hurtPlayer`) follow without knowing about it. Pure.
 */
export const STANCES = {
  shield: { might: 0.7, damageTaken: 0.7, speed: 1, color: '#5890f8' },
  blade: { might: 1.3, damageTaken: 1.1, speed: 1, color: '#f05040' },
  normal: { might: 1, damageTaken: 1, speed: 1, color: '#f8a058' },
  attack: { might: 1.35, damageTaken: 1.25, speed: 1, color: '#f05038' },
  defense: { might: 0.75, damageTaken: 0.6, speed: 0.9, color: '#48b898' },
  speed: { might: 0.9, damageTaken: 1.05, speed: 1.35, color: '#c878f0' },
  // Rotom's appliances only change its signature's shape: their numbers stay close to 1.
  heat: { might: 1.05, damageTaken: 1.05, speed: 1, color: '#f07838' },
  wash: { might: 1, damageTaken: 0.95, speed: 1, color: '#4898e8' },
  frost: { might: 1, damageTaken: 1, speed: 0.95, color: '#88d0e8' },
  fan: { might: 0.95, damageTaken: 1, speed: 1.1, color: '#b8c8e0' },
  mow: { might: 1, damageTaken: 1, speed: 1, color: '#70b858' },
} as const satisfies Record<string, { might: number; damageTaken: number; speed: number; color: string }>

export type Stance = keyof typeof STANCES

/** Each stance special's formes, in the order a press cycles them; the first is the one it starts in. */
export const STANCE_CYCLES = {
  stanceChange: ['shield', 'blade'],
  formeChange: ['normal', 'attack', 'defense', 'speed'],
  applianceChange: ['heat', 'wash', 'frost', 'fan', 'mow'],
} as const satisfies Record<string, readonly Stance[]>

export type StanceSpecial = keyof typeof STANCE_CYCLES

const CYCLE_OF = new Map<Stance, readonly Stance[]>(Object.values(STANCE_CYCLES).flatMap((cycle) => cycle.map((s) => [s, cycle] as const)))

/** The stance a special starts in (Aegislash's Shield Forme, Deoxys's Normal Forme). */
export const firstStance = (special: StanceSpecial): Stance => STANCE_CYCLES[special][0]

/** The next stance of the same cycle (Shield ↔ Blade; Normal → Attack → Defense → Speed → Normal). */
export const nextStance = (s: Stance): Stance => {
  const cycle = CYCLE_OF.get(s) ?? [s]
  return cycle[(cycle.indexOf(s) + 1) % cycle.length]!
}

/** Stats in a stance; `null` (every other special) leaves them as they are. */
export const stanceStats = (stats: PlayerStats, stance: Stance | null): PlayerStats => {
  if (!stance) return stats
  const m = STANCES[stance]
  return { ...stats, might: stats.might * m.might, damageTaken: stats.damageTaken * m.damageTaken, speed: stats.speed * m.speed }
}

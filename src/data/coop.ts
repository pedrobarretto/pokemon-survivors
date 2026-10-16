/**
 * Co-op numbers (`game/coop.ts`). A team of `n` faces a bigger, tougher horde,
 * shares every candy (split a little so levels don't fly by) and gets fainted
 * teammates back by standing next to them.
 */
export const COOP = {
  /** Regular spawn rate and horde cap × (1 + spawn·(n − 1)). */
  spawn: 0.75,
  /** Regular enemy HP × (1 + hp·(n − 1)). */
  hp: 0.3,
  /** Boss HP × (1 + bossHp·(n − 1)): everyone hits it at once. */
  bossHp: 0.7,
  /** Every candy reaches the whole team, divided by (1 + xp·(n − 1)). */
  xp: 0.6,
  revive: {
    /** Seconds a teammate must stand next to a fainted player. */
    time: 3,
    /** How close (px, feet to feet) counts as next to them. */
    radius: 30,
    /** Share of max HP they get back up with. */
    hp: 0.5,
    /** Seconds of invulnerability after getting up. */
    iframes: 2,
    /** Progress lost per second while nobody is there. */
    decay: 1.5,
  },
  /** Seconds the team has to pick its level-ups before the first offer is taken for whoever hasn't. */
  pickTime: 15,
  /** Px between teammates at the start. */
  spacing: 34,
} as const

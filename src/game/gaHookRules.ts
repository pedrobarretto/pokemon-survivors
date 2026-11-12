import type { PlayableId } from '../data/hatchlings'
import type { StatDelta } from './stats'
import type { StatusSpec } from './status'
import * as dm from '../engine/dmath'

/**
 * Pure numbers and rules of the wave's five hook families
 * (`data/gaFamiliesHook.ts`): Scatterbug's powder, Minior's Shields Down,
 * Tyrogue's build-read evolution and its three branches, and Plusle's and
 * Minun's charges (their co-op link is `coop.ts`'s, `plusMinusOn`).
 * `gaHookSystem.ts` runs them on `Player.kitH`; nothing here touches the game.
 * Arrays are by evolution stage.
 */
export const KIT_H = {
  /**
   * Scatterbug's line: a puff of scales every `step` px walked, lasting `life` s, of radius `r`, hitting every `every`
   * s for `power`. Scatterbug's and Spewpa's slow; Vivillon's cycles its three powders (`VIVILLON_POWDERS`). Spewpa
   * standing still `settle` s hardens (`harden`).
   */
  scales: { step: [36, 42, 30], life: [2.2, 2.6, 3.2], r: [14, 16, 22], every: 0.45, power: [2, 3, 5], settle: 0.5, harden: { armor: 2, damageTaken: -0.15 } },
  /**
   * Minior's Shields Down: the Meteor shell breaks below `breakAt` of its HP into the Core and closes again once
   * healed back to `closeAt` (a gap, so a hit and a heal around half don't flicker it). The shell's stats, the
   * Core's, the shards the break throws and the moment of i-frames each change leaves.
   */
  shields: {
    breakAt: 0.5, closeAt: 0.62,
    meteor: { armor: 2, damageTaken: -0.15, speed: -6 },
    core: { speed: 14, might: 0.3, cooldown: -0.12, armor: -1 },
    shards: { r: 58, power: 16, knockback: 140 }, iframes: 0.6,
  },
  /**
   * Tyrogue's line. Its evolution reads the build (`fighterBranch`): Attack is the Might gained in the run in
   * points of 1% (`attack`), Defense the Defense (armor) gained in points of 0.1 (`defense`), so a Muscle Band level
   * and an Assault Vest level each weigh 10; within `even` points of each other is even. Hitmonlee's legs
   * (`lee`), Hitmonchan's Iron Fist and its Counter, Hitmontop's Technician (`top`).
   */
  fighter: {
    attack: 100, defense: 10, even: 5,
    lee: { area: 0.12, speed: 4 },
    chan: { punch: 0.2, counter: { cooldown: 2.5, reach: 60, r: 18, power: 14, knockback: 130 } },
    top: { weak: 0.25, speed: 2 },
  },
  /** Plusle: KOs charge Plus; full, it bursts in a ring of sparks and runs faster a moment. */
  plus: { need: 24, r: 64, power: 14, surge: 4, speed: 10, cooldown: -0.08, paralysis: { kind: 'paralysis', chance: 0.6, duration: 0.8, power: 0 } satisfies StatusSpec },
  /** Minun: every `every` s a Minus pulse weakens and slows the foes around and heals it a little. */
  minus: { every: 6, r: 70, power: 6, heal: 0.04, weaken: { kind: 'weaken', chance: 1, duration: 3, power: 0.3 } satisfies StatusSpec, slow: { kind: 'slow', chance: 1, duration: 2, power: 0.35 } satisfies StatusSpec },
  /**
   * Co-op, with a Plusle and a Minun on the team (`coop.ts`): both get `bonus`, and a current runs between them while
   * no farther than `reach` apart, hitting the foes within `width` of it every `every` s.
   */
  link: { bonus: { might: 0.15, cooldown: -0.08 }, reach: 240, width: 10, every: 0.4, power: 7 },
} as const

/** The slow Scatterbug's and Spewpa's scales leave. */
export const SCALE_SLOW: StatusSpec = { kind: 'slow', chance: 1, duration: 1.2, power: 0.35 }

/** Vivillon's three powders, one puff after another: Poison Powder, Stun Spore, Sleep Powder. */
export const VIVILLON_POWDERS: readonly StatusSpec[] = [
  { kind: 'poison', chance: 1, duration: 3, power: 0.35 },
  { kind: 'paralysis', chance: 0.5, duration: 0.9, power: 0 },
  { kind: 'sleep', chance: 0.35, duration: 1.4, power: 0 },
]

/** Hitmonlee, Hitmonchan or Hitmontop: where Tyrogue's build takes it. */
export type FighterBranch = 'hitmonlee' | 'hitmonchan' | 'hitmontop'

/** What the build reads at a moment: Attack and Defense points gained since the run's start. */
export type FighterScore = { attack: number; defense: number }

/** Each family's running state on `Player.kitH`; absent for anyone else. */
export type GaKitHook =
  | { kind: 'scales'; walked: number; puffs: number; still: number; at: number; hard: boolean }
  | { kind: 'shields'; core: boolean }
  /** `base`: Might and Defense when the run began (the first tick), what the build is measured from. */
  | { kind: 'fighter'; base: { might: number; armor: number } | null; counter: number }
  | { kind: 'plus'; charge: number; surge: number }
  | { kind: 'minus'; next: number }

const CREATE = {
  scatterbug: () => ({ kind: 'scales', walked: 0, puffs: 0, still: 0, at: 0, hard: false }),
  minior: () => ({ kind: 'shields', core: false }),
  tyrogue: () => ({ kind: 'fighter', base: null, counter: 0 }),
  plusle: () => ({ kind: 'plus', charge: 0, surge: 0 }),
  minun: () => ({ kind: 'minus', next: KIT_H.minus.every / 2 }),
} as const satisfies Partial<Record<PlayableId, () => GaKitHook>>

const hasKit = (id: PlayableId): id is keyof typeof CREATE => id in CREATE

/** The fresh state of a family's mechanic, or null for anyone without one (`createPlayer` then leaves the field out). */
export const createKitH = (starter: PlayableId): GaKitHook | null => (hasKit(starter) ? CREATE[starter]() : null)

/** A by-stage number at `stage`, the last one past the end. */
export const atStage = <T>(values: readonly T[], stage: number): T => values[Math.min(Math.max(0, stage), values.length - 1)]!

/** Whether a puff is due: `walked` px gone since the last one, at the stage's step. */
export const puffDue = (walked: number, since: number, stage: number) => walked - since >= atStage(KIT_H.scales.step, stage)

/** The powder of a puff: the slow before Vivillon, then its three powders in turn. */
export const powderOf = (stage: number, puffs: number): StatusSpec => (stage >= 2 ? VIVILLON_POWDERS[puffs % VIVILLON_POWDERS.length]! : SCALE_SLOW)

/**
 * Shields Down: whether Minior shows its Core after this tick. The shell breaks
 * below `breakAt` of its HP and closes again at `closeAt`; between them it
 * stays as it was.
 */
export const coreOpen = (core: boolean, hp: number, maxHp: number) => {
  if (maxHp <= 0) return core
  const share = hp / maxHp
  return core ? share < KIT_H.shields.closeAt : share < KIT_H.shields.breakAt
}

/** Attack and Defense points gained from `base` to `now` (the stat bars' Attack, Might, and Defense, armor). */
export const fighterScore = (base: { might: number; armor: number }, now: { might: number; armor: number }): FighterScore => ({
  attack: dm.round((now.might - base.might) * KIT_H.fighter.attack),
  defense: dm.round((now.armor - base.armor) * KIT_H.fighter.defense),
})

/** Where Tyrogue evolves, as in the games: Attack over Defense, Hitmonlee; Defense over Attack, Hitmonchan; even, Hitmontop. */
export const fighterBranch = ({ attack, defense }: FighterScore): FighterBranch =>
  Math.abs(attack - defense) <= KIT_H.fighter.even ? 'hitmontop' : attack > defense ? 'hitmonlee' : 'hitmonchan'

/** Plus fills by one KO; full, it bursts and starts over. */
export const plusCharged = (charge: number) => {
  const next = charge + 1
  return next >= KIT_H.plus.need ? { charge: 0, burst: true } : { charge: next, burst: false }
}

/** The families with a Plus or a Minus. */
export const PLUS_MINUS = ['plusle', 'minun'] as const satisfies readonly PlayableId[]

export const isPlusMinus = (id: PlayableId): id is (typeof PLUS_MINUS)[number] => (PLUS_MINUS as readonly PlayableId[]).includes(id)

/** A player's share of Plusle and Minun's co-op lift (`updatePlusMinus` in `coop.ts` turns `linked` on): theirs while the link holds, nobody else's. */
export const linkDeltas = (linked: boolean, starter: PlayableId): readonly StatDelta[] => (linked && isPlusMinus(starter) ? [KIT_H.link.bonus] : [])

/** Distance² from (x, y) to the segment (ax, ay)–(bx, by): the link's current hits what lies near it. */
export const segmentDist2 = (x: number, y: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const k = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0
  const px = ax + dx * k - x
  const py = ay + dy * k - y
  return px * px + py * py
}

/** The family's bonuses right now, on top of its other stats (`recomputeStats`). `branch`: Tyrogue's, once it evolved. */
export const kitHDeltas = (kit: GaKitHook | undefined, stage: number, branch: string | null): readonly StatDelta[] => {
  if (!kit) return []
  switch (kit.kind) {
    case 'scales': return stage === 1 && kit.hard ? [KIT_H.scales.harden] : []
    case 'shields': {
      const S = KIT_H.shields
      return [kit.core ? S.core : S.meteor]
    }
    case 'fighter': {
      const F = KIT_H.fighter
      if (branch === 'hitmonlee') return [F.lee]
      if (branch === 'hitmonchan') return [{ tagDamage: { punch: F.chan.punch } }]
      if (branch === 'hitmontop') return [{ tagDamage: { weak: F.top.weak }, speed: F.top.speed }]
      return []
    }
    case 'plus': return kit.surge > 0 ? [{ speed: KIT_H.plus.speed, cooldown: KIT_H.plus.cooldown }] : []
    default: return []
  }
}

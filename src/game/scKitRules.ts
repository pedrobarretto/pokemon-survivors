import type { PlayableId } from '../data/hatchlings'
import type { StatDelta } from './stats'

/**
 * Pure numbers and rules of the Safári and Game Corner wave's families
 * (`data/scFamilies.ts`). `scKitSystem.ts` runs them on `Player.kitSC`;
 * nothing here touches the game, so each rule is tested on its own. As in the
 * other batches, every bonus is capped and every timer is a fixed clock the
 * cooldown stat can't shrink. Arrays are by evolution stage.
 */
export const KIT_SC = {
  /**
   * Nidoran♀'s line, Poison Point: a ring of `count` barbs every `every` s (a hit taken fires it once the ring is
   * `early` charged), each flying `speed` px/s for `ttl` s, hitting for `power` and poisoning. Nidoqueen guards her
   * ground: +`armor` for each poisoned foe within `near` px, up to `cap`.
   */
  barbs: {
    every: [4.5, 3.8, 3.2], early: 0.5, count: [6, 8, 12], speed: 190, ttl: 0.55, r: 5, power: [5, 8, 12],
    poison: { kind: 'poison', chance: 1, duration: 3, power: 0.3 },
    guard: { near: 80, armor: 0.5, cap: [0, 0, 4], every: 0.5 },
  },
  /**
   * Nidoran♂'s line, the horn charge: once recharged (`every` s) with a foe within `reach`, it lowers its horn
   * and charges `time` s at `speed` px/s (i-frames through it), goring and poisoning what it runs through;
   * Nidoking's charge ends in a quake (`quake`).
   */
  horn: {
    every: [6, 5, 4.2], reach: [90, 110, 130], time: 0.3, speed: [330, 360, 400], r: [11, 13, 15], power: [10, 16, 24], knockback: 120,
    poison: { kind: 'poison', chance: 1, duration: 3, power: 0.3 },
    quake: { r: [0, 0, 64], power: [0, 0, 22], knockback: 150 },
  },
  /**
   * Cleffa's line, the moon: it waxes `tick` a second and `kill` a KO to `full` (lower each stage); the full moon
   * lasts `lasts` s, Fairy moves +`fairy`, a moonbeam on a foe in view every `beam` s (radius, hit), and
   * Moonlight heals `heal` of max HP per foe it hits while it's up.
   */
  moon: { tick: 2, kill: 1.5, full: [100, 90, 80], lasts: [5, 6, 7], fairy: [0.25, 0.3, 0.4], beam: [0.6, 0.5, 0.4], r: [14, 16, 18], power: [10, 15, 22], heal: 0.01, reach: 170 },
  /**
   * Phione's warm current: walking fills it (`per` px to full), `bubbles` (from the empty count to the full one)
   * circle at `orbit` px, turning `spin` rad/s more the fuller it is, each hitting every `every` s for `power`
   * (slowing). Standing still `settle` s with at least `burst` of it lets them burst: a splash of radius `r`
   * hitting for `splash` that heals `heal` of max HP; then the current is spent.
   */
  current: { per: 900, bubbles: [2, 6], orbit: 28, spin: [2, 5], r: 6, every: 0.4, power: 4, slow: { kind: 'slow', chance: 1, duration: 0.8, power: 0.3 }, settle: 0.5, burst: 0.5, splash: { r: 58, power: 22, heal: 0.06 } },
} as const

/** Each family's running state on `Player.kitSC`; absent for anyone else. */
export type ScKit =
  | { kind: 'barbs'; charge: number; guard: number; check: number }
  | { kind: 'horn'; charge: number; dash: number; dx: number; dy: number }
  | { kind: 'moon'; fill: number; full: number; beam: number }
  | { kind: 'current'; drift: number; angle: number; hit: number; still: number; walked: number }

const CREATE = {
  nidoranF: () => ({ kind: 'barbs', charge: 0, guard: 0, check: 0 }),
  nidoranM: () => ({ kind: 'horn', charge: KIT_SC.horn.every[0] / 2, dash: 0, dx: 1, dy: 0 }),
  cleffa: () => ({ kind: 'moon', fill: 0, full: 0, beam: 0 }),
  phione: () => ({ kind: 'current', drift: 0, angle: 0, hit: 0, still: 0, walked: 0 }),
} as const satisfies Partial<Record<PlayableId, () => ScKit>>

const hasKit = (id: PlayableId): id is keyof typeof CREATE => id in CREATE

/** The fresh state of a family's mechanic, or null for anyone without one (`createPlayer` then leaves the field out). */
export const createKitSC = (starter: PlayableId): ScKit | null => (hasKit(starter) ? CREATE[starter]() : null)

/** A by-stage number at `stage`, the last one past the end. */
export const scAt = <T>(values: readonly T[], stage: number): T => values[Math.min(Math.max(0, stage), values.length - 1)]!

/** The barb ring's charge after `dt` s (0..1); full fires it. */
export const barbCharge = (charge: number, dt: number, stage: number) => Math.min(1, charge + dt / scAt(KIT_SC.barbs.every, stage))

/** Whether a hit taken fires the ring now: it must be charged past `early`. */
export const barbsOnHurt = (charge: number) => charge >= KIT_SC.barbs.early

/** Nidoqueen's guard: the armor stacks from the poisoned foes around her. */
export const guardStacks = (poisoned: number, stage: number) => Math.min(scAt(KIT_SC.barbs.guard.cap, stage), poisoned)

/** The horn charges once recharged with a foe in reach and no charge running. */
export const hornReady = (charge: number, dash: number, foeNear: boolean) => charge <= 0 && dash <= 0 && foeNear

/** The moon after `dt` s and `kills` KOs: how full it is; at `full` it turns full. */
export const waxMoon = (fill: number, dt: number, kills: number) => fill + dt * KIT_SC.moon.tick + kills * KIT_SC.moon.kill

/** The moon's phase for its look, 0 (new) to 4 (full), from how full it is. */
export const moonPhase = (fill: number, full: number, stage: number) => (full > 0 ? 4 : Math.min(3, Math.floor((fill / scAt(KIT_SC.moon.full, stage)) * 4)))

/** The current after walking `px` (0..1). */
export const driftAfter = (drift: number, px: number) => Math.min(1, drift + px / KIT_SC.current.per)

/** How many bubbles circle Phione at `drift`. */
export const bubblesAt = (drift: number) => {
  const [lo, hi] = KIT_SC.current.bubbles
  return lo + Math.floor(drift * (hi - lo) + 1e-9)
}

/** Whether the bubbles burst now: still long enough, with enough current. */
export const currentBursts = (still: number, drift: number) => still >= KIT_SC.current.settle && drift >= KIT_SC.current.burst

/** The family's bonuses right now, on top of its other stats (`recomputeStats`). */
export const kitSCDeltas = (kit: ScKit | undefined, stage: number): readonly StatDelta[] => {
  if (!kit) return []
  switch (kit.kind) {
    case 'barbs': return kit.guard > 0 ? [{ armor: kit.guard * KIT_SC.barbs.guard.armor }] : []
    case 'moon': return kit.full > 0 ? [{ typeDamage: { fairy: scAt(KIT_SC.moon.fairy, stage) } }] : []
    default: return []
  }
}

import type { PlayableId } from '../data/hatchlings'
import type { StatDelta } from './stats'
import type { StatusSpec } from './status'
import * as dm from '../engine/dmath'

/**
 * Pure numbers and rules of the big update's Mega families
 * (`data/megaFamiliesB.ts`). `megaKitBSystem.ts` runs them on `Player.megaB`;
 * nothing here touches the game, so each rule is tested on its own
 * (`megaKitBRules.test.ts`). As with the other batches, every bonus is capped
 * and every protection has a fixed cooldown the cooldown stat can't shrink.
 * Arrays are by evolution stage (the last value holds past their end); the
 * Mega's own numbers sit beside them.
 */
export const MEGA_KIT_B = {
  /**
   * Meditite's line, Pure Power: each High Jump Kick that lands on a foe adds a focus stack (capped by stage, the
   * Mega's higher), `might` each. One that lands on nothing crashes, as in the games: the stacks go and it pays
   * `crash` of max HP (never the last point). Mega Medicham keeps its stacks through a crash and pays nothing.
   */
  pure: { cap: [3, 5], megaCap: 8, might: 0.05, crash: 0.06 },
  /** High Jump Kick: how far it looks for a foe to leap at, the leap's seconds and height, the landing's reach. */
  kick: { reach: 125, leap: 0.3, lift: [14, 20], r: 16, window: 0.1 },
  /**
   * Numel's humps, Eruption: on a fixed clock they blow, throwing lava bombs, as many as the HP left says (from the
   * first number at no HP to the second at full); each lands in a blast and a pool of magma that burns. Mega
   * Camerupt's single great hump (Sheer Force) blows sooner, with more and bigger bombs.
   */
  erupt: {
    every: [9, 7], megaEvery: 4.5, bombs: [[1, 4], [2, 7]], megaBombs: [3, 10], reach: [40, 130], fall: 0.65,
    r: [16, 20], megaR: 26, power: [12, 20], megaPower: 30, knockback: 70,
    pool: { ttl: 3, r: [8, 10], megaR: 13, share: 0.22, every: 0.5 },
  },
  /**
   * Buneary's line, the hop: a foe about to touch it sends it bouncing away (a fixed cooldown), safe in the air, and
   * it lands in a stomp. The next Dizzy Punch is a counter: harder, wider and sure to confuse (Mega Lopunny's,
   * Scrappy, a flurry of three).
   */
  hop: {
    cooldown: [6, 4.5], megaCooldown: 2.8, near: 9, dist: 36, time: 0.24, lift: [10, 14],
    stomp: { r: [22, 30], megaR: 36, power: [8, 16], megaPower: 22, knockback: 120 },
    counter: { power: 1.8, area: 1.3, punches: 2, megaPunches: 3, hold: 4 },
  },
  /**
   * Flabébé's line, its garden: a blossom where it stands every few seconds (up to a cap), each healing whoever
   * stands in its ring and firing petals at foes near it. Florges tends a bigger garden that heals more; the Eternal
   * Flower's blossoms shoot harder, and Mega Floette's (Fairy Aura) as fast as light.
   */
  garden: {
    every: [5, 4], cap: [2, 3], florgesCap: 5, life: 14, r: 22, tick: 0.5,
    heal: [0.008, 0.012], florgesHeal: 0.02,
    shot: { every: [1.4, 1.1], florgesEvery: 1.3, megaEvery: 0.45, power: [5, 9], eternalPower: 12, florgesPower: 8, speed: 150 },
  },
  /**
   * Skrelp's line, long-range venom: Venom Drench's glob grows as it flies, hitting harder and splashing wider the
   * farther it went, from ×1 within `near` px to the stage's most at `far`. Mega Dragalge (Adaptability) goes
   * further and its splash throws droplets of its own.
   */
  venom: { near: 40, far: 220, max: [1.6, 2], megaMax: 2.5, r: [5, 8], splash: [14, 34], share: 0.5, droplets: 4 },
} as const

/** Venom Drench's splash: the poison it leaves on every foe it catches. */
export const VENOM_SPLASH: StatusSpec = { kind: 'poison', chance: 1, duration: 3, power: 0.3 }

/** Eruption's magma: the burn its pools may leave. */
export const MAGMA_BURN: StatusSpec = { kind: 'burn', chance: 0.4, duration: 2, power: 0.4 }

/** A value from a per-stage table: the stage's, or the last one past its end. */
export const atStage = <T>(table: readonly T[], stage: number): T => table[Math.max(0, Math.min(stage, table.length - 1))]!

/** Each family's running state on `Player.megaB`; absent for anyone else (and Skrelp's line, whose venom rides on its move). */
export type MegaKitB =
  /** `leap`: s left in the air; `resolve`: s until the landing is judged (0: no kick out); `landed`: it touched a foe. */
  | { kind: 'pure'; stacks: number; leap: number; total: number; resolve: number; landed: boolean }
  | { kind: 'erupt'; next: number }
  /** `down`: s to the next hop; `air`: s left in the air; `counter`: s the counter waits for the next Dizzy Punch. */
  | { kind: 'hop'; down: number; air: number; counter: number }
  /** The blossoms are attacks of their own (`mbBlossom`); `next`: s to the next one, `tick`: s to the next heal. */
  | { kind: 'garden'; next: number; tick: number }

const CREATE = {
  meditite: () => ({ kind: 'pure', stacks: 0, leap: 0, total: 0, resolve: 0, landed: false }),
  numel: () => ({ kind: 'erupt', next: MEGA_KIT_B.erupt.every[0] }),
  buneary: () => ({ kind: 'hop', down: 0, air: 0, counter: 0 }),
  flabebe: () => ({ kind: 'garden', next: 1.5, tick: MEGA_KIT_B.garden.tick }),
} as const satisfies Partial<Record<PlayableId, () => MegaKitB>>

const hasKit = (id: PlayableId): id is keyof typeof CREATE => id in CREATE

/** The fresh state of a family's mechanic, or null for anyone else (`createPlayer` then leaves the field out). */
export const createMegaKitB = (starter: PlayableId): MegaKitB | null => (hasKit(starter) ? CREATE[starter]() : null)

/* ---------------- Pure Power ---------------- */

/** The most focus stacks the line holds now. */
export const pureCap = (stage: number, mega: boolean) => (mega ? MEGA_KIT_B.pure.megaCap : atStage(MEGA_KIT_B.pure.cap, stage))

/** Stacks after a kick is judged: one more for a landing, none after a crash (unless Mega, which keeps them). */
export const pureAfter = (stacks: number, landed: boolean, cap: number, mega: boolean) => (landed ? Math.min(cap, stacks + 1) : mega ? Math.min(cap, stacks) : 0)

/** HP a crash costs: `share` of max HP, never the last point. */
export const crashCost = (maxHp: number, hp: number, share: number) => Math.max(0, Math.min(dm.round(maxHp * share), Math.floor(hp) - 1))

/** How high the kick carries the sprite: up and down over the leap. */
export const leapLift = (left: number, total: number, top: number) => {
  if (left <= 0 || total <= 0) return 0
  const k = 1 - left / total
  return dm.round(dm.sin(k * Math.PI) * top)
}

/* ---------------- Eruption ---------------- */

/** Lava bombs an eruption throws: more the more HP is left (`share` of max), the Mega's range above the stage's. */
export const eruptionBombs = (share: number, stage: number, mega: boolean) => {
  const [lo, hi] = mega ? MEGA_KIT_B.erupt.megaBombs : atStage(MEGA_KIT_B.erupt.bombs, stage)
  const k = Math.max(0, Math.min(1, share))
  return dm.round(lo + (hi - lo) * k)
}

/** Seconds to the next eruption. */
export const eruptionEvery = (stage: number, mega: boolean) => (mega ? MEGA_KIT_B.erupt.megaEvery : atStage(MEGA_KIT_B.erupt.every, stage))

/* ---------------- The hop ---------------- */

/** Whether the hop goes now: recharged, on the ground, with a foe about to touch. */
export const hopReady = (down: number, air: number, gap: number | null) => down <= 0 && air <= 0 && gap !== null && gap <= MEGA_KIT_B.hop.near

/** The hop's fixed cooldown. */
export const hopCooldown = (stage: number, mega: boolean) => (mega ? MEGA_KIT_B.hop.megaCooldown : atStage(MEGA_KIT_B.hop.cooldown, stage))

/* ---------------- The garden ---------------- */

/** What the garden looks like by the run's form: Flabébé's, Florges' or the Eternal Flower's. */
export type Gardener = 'flabebe' | 'florges' | 'eternal'

export const gardenerOf = (stage: number, branch: string | null): Gardener => (stage < 1 ? 'flabebe' : branch === 'florges' ? 'florges' : 'eternal')

const G = MEGA_KIT_B.garden

/** How many blossoms the garden holds at once. */
export const gardenCap = (who: Gardener) => (who === 'florges' ? G.florgesCap : atStage(G.cap, who === 'flabebe' ? 0 : 1))

/** Share of max HP a blossom's ring heals per second. */
export const gardenHeal = (who: Gardener) => (who === 'florges' ? G.florgesHeal : atStage(G.heal, who === 'flabebe' ? 0 : 1))

/** Seconds between a blossom's petals (Mega Floette's light comes fastest). */
export const petalEvery = (who: Gardener, mega: boolean) => (mega ? G.shot.megaEvery : who === 'florges' ? G.shot.florgesEvery : atStage(G.shot.every, who === 'flabebe' ? 0 : 1))

/** A petal's power before the player's might. */
export const petalPower = (who: Gardener) => (who === 'florges' ? G.shot.florgesPower : who === 'eternal' ? G.shot.eternalPower : G.shot.power[0])

/* ---------------- Long-range venom ---------------- */

/** How far into the venom's range a glob is, 0 (within `near`) to 1 (at `far` or beyond). */
export const venomReach = (dist: number) => {
  const V = MEGA_KIT_B.venom
  return Math.max(0, Math.min(1, (dist - V.near) / (V.far - V.near)))
}

/** Venom Drench's damage multiplier after flying `dist` px. */
export const venomMult = (dist: number, stage: number, mega: boolean) => {
  const max = mega ? MEGA_KIT_B.venom.megaMax : atStage(MEGA_KIT_B.venom.max, stage)
  return 1 + (max - 1) * venomReach(dist)
}

/** The glob's radius and its splash's after flying `dist` px. */
export const venomSizes = (dist: number) => {
  const V = MEGA_KIT_B.venom
  const k = venomReach(dist)
  return { r: V.r[0] + (V.r[1] - V.r[0]) * k, splash: V.splash[0] + (V.splash[1] - V.splash[0]) * k }
}

/** The family's bonuses right now, on top of its other stats (`recomputeStats`): Pure Power's focus. */
export const megaKitBDeltas = (kit: MegaKitB | undefined): readonly StatDelta[] =>
  kit?.kind === 'pure' && kit.stacks > 0 ? [{ might: kit.stacks * MEGA_KIT_B.pure.might }] : []

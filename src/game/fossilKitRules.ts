import type { PlayableId } from '../data/hatchlings'
import type { StatDelta } from './stats'

/**
 * Pure numbers and rules of the fossil families the Grande Atualização
 * restores (`data/gaFossils.ts`). `fossilKitSystem.ts` runs them on
 * `Player.kitF`; nothing here touches the game, so each rule is tested on its
 * own (`fossilKitRules.test.ts`). As in the other batches, every bonus is
 * capped and every cycle runs on a fixed clock the cooldown stat can't
 * shrink. Arrays are by evolution stage (`atStage`).
 */
export const KIT_F = {
  /**
   * Aerodactyl, the primal dive: every `every` s (Mega: `megaEvery`) with prey
   * within `reach`, it swoops on the toughest (a boss or an elite first, else
   * the most HP): a dash of `speed` px/s with i-frames, biting what it passes.
   * Mega Aerodactyl dives again at the next prey `again` s later.
   */
  dive: { every: 6, megaEvery: 4.5, reach: 160, speed: 430, most: 0.32, r: 16, power: 22, megaPower: 30, knockback: 130, again: 0.4 },
  /**
   * Omanyte's line, Shell Smash: a whole shell breaks once `crowd` foes press
   * within `near` px, spraying `spikes` spikes; for `left` s the armor drops
   * and might, speed and haste rise, and Spike Cannon fires `cannon` more.
   * Then the shell regrows (`regrow` s).
   */
  smash: { regrow: [18, 14], near: 64, crowd: 4, left: [6, 8], spikes: [8, 12], spikePower: [7, 12], spikeSpeed: 210, armor: -2, might: [0.25, 0.4], speed: [4, 6], haste: [-0.08, -0.12], cannon: 2 },
  /**
   * Lileep's line, Suction Cups: standing still `settle` s it takes root:
   * regen and armor while rooted, and every `every` s its tendrils latch on
   * the nearest `grabs` regular foes within `reach`, pull them in, sap them
   * and slow them. Ingrain hits `ingrain` times harder from roots.
   */
  roots: { settle: 0.7, regen: [1, 2], armor: [1, 2], every: [1.4, 1.1], reach: [72, 96], grabs: [1, 2], pull: 170, power: [4, 8], drain: 0.5, slow: { kind: 'slow', chance: 1, duration: 1, power: 0.5 }, show: 0.32, ingrain: 1.3 },
  /**
   * Anorith's line, the claws' combo: Crush Claw casts that land chain
   * (`window` s apart), each link `perLink` more; at the stage's `cap` the
   * next is Armaldo's cross cleave, an X around it `cross.r` px wide at
   * `cross.power` times the claw.
   */
  claws: { window: 2.6, cap: [4, 5], perLink: 0.15, cross: { r: [42, 58], power: 2.2 } },
  /**
   * Dracozolt, its tail's generator: every first strike (a hit on an unhurt
   * foe) charges it; at `need` it discharges a ring around it that paralyzes.
   */
  volt: { need: 6, r: 62, power: 22, paralysis: { kind: 'paralysis', chance: 1, duration: 1.1, power: 0 } },
  /**
   * Arctozolt, the shiver: every `every` s its frozen body shivers out a ring
   * that chips and slows (`snow`: faster in the snow). Icicle Crash freezes the
   * unhurt foes it hits (`freeze`), so the next hit lands double.
   */
  shiver: { every: 2.4, snow: 0.6, r: 54, power: 3, slow: { kind: 'slow', chance: 1, duration: 1.4, power: 0.4 }, freeze: { kind: 'freeze', chance: 1, duration: 1.4, power: 0 } },
  /**
   * Dracovish, the feeding frenzy: each first strike adds a stack (to `cap`),
   * `might` and `speed` each; they hold `hold` s after the last, then one
   * fades every `decayEvery` s.
   */
  frenzy: { cap: 5, might: 0.05, speed: 1.5, hold: 3, decayEvery: 0.8 },
} as const

/** The fossil families' hitboxes and cues (`render/fossilKitFx.ts`); `kitFHit` is a kit's unseen hitbox. */
export type FossilVisual =
  | 'kitFHit' | 'kitFWing' | 'kitFDive' | 'kitFSpike' | 'kitFShell' | 'kitFRoot' | 'kitFClaw' | 'kitFCross' | 'kitFBeak' | 'kitFVolt'
  | 'kitFIcicle' | 'kitFShiver' | 'kitFJaws'

/** One of Lileep's tendrils on a foe, for the drawing: where it holds and the seconds it still shows. */
export type Tendril = { x: number; y: number; left: number }

/** Each family's running state on `Player.kitF`; absent for anyone else, so their runs hash the same. */
export type FossilKit =
  | { kind: 'dive'; next: number; again: number }
  | { kind: 'smash'; shell: number; left: number }
  | { kind: 'roots'; walked: number; still: number; rooted: boolean; next: number; tendrils: Tendril[] }
  | { kind: 'claws'; links: number; left: number; landed: boolean }
  | { kind: 'volt'; charge: number }
  | { kind: 'shiver'; pulse: number }
  | { kind: 'frenzy'; stacks: number; last: number }

const CREATE = {
  aerodactyl: () => ({ kind: 'dive', next: KIT_F.dive.every / 2, again: 0 }),
  omanyte: () => ({ kind: 'smash', shell: 0, left: 0 }),
  lileep: () => ({ kind: 'roots', walked: 0, still: 0, rooted: false, next: 0, tendrils: [] }),
  anorith: () => ({ kind: 'claws', links: 0, left: 0, landed: false }),
  dracozolt: () => ({ kind: 'volt', charge: 0 }),
  arctozolt: () => ({ kind: 'shiver', pulse: KIT_F.shiver.every }),
  dracovish: () => ({ kind: 'frenzy', stacks: 0, last: 0 }),
} as const satisfies Partial<Record<PlayableId, () => FossilKit>>

const hasKit = (id: PlayableId): id is keyof typeof CREATE => id in CREATE

/** The fresh state of a family's mechanic, or null for anyone without one (`createPlayer` then leaves the field out). */
export const createKitF = (starter: PlayableId): FossilKit | null => (hasKit(starter) ? CREATE[starter]() : null)

/** A by-stage number at `stage`, the last one past the end. */
export const atStage = <T>(values: readonly T[], stage: number): T => values[Math.min(Math.max(0, stage), values.length - 1)]!

/** Prey for the dive, from what's in reach: a boss or an elite before anything, then the most HP. Null for none. */
export const divePrey = <E extends { boss: boolean; elite: boolean; hp: number }>(foes: readonly E[]): E | null => {
  let best: E | null = null
  const rank = (e: E) => (e.boss ? 2 : e.elite ? 1 : 0)
  for (const e of foes) if (!best || rank(e) > rank(best) || (rank(e) === rank(best) && e.hp > best.hp)) best = e
  return best
}

/** The dive's clock: Mega Aerodactyl's runs faster. */
export const diveEvery = (mega: boolean) => (mega ? KIT_F.dive.megaEvery : KIT_F.dive.every)

/** Shell Smash goes off with a whole shell and enough foes pressing in, and not while it already runs. */
export const smashReady = (shell: number, left: number, near: number) => shell <= 0 && left <= 0 && near >= KIT_F.smash.crowd

/** Whether Lileep has taken root: it stood still long enough. */
export const rootedAfter = (still: number) => still >= KIT_F.roots.settle

/** Crush Claw's power with `links` in the chain. */
export const clawPower = (links: number) => 1 + links * KIT_F.claws.perLink

/** Whether this Crush Claw is Armaldo's cross: the chain is full and the line has evolved. */
export const crossReady = (links: number, stage: number) => stage >= 1 && links >= atStage(KIT_F.claws.cap, stage)

/** The chain after a cast that landed: a link more, up to the stage's cap. */
export const clawLink = (links: number, stage: number) => Math.min(atStage(KIT_F.claws.cap, stage), links + 1)

/** The generator after a first strike: charged, or discharging (`burst`) and back to 0. */
export const voltCharge = (charge: number) => (charge + 1 >= KIT_F.volt.need ? { charge: 0, burst: true } : { charge: charge + 1, burst: false })

/** Seconds between Arctozolt's shivers, faster in the snow. */
export const shiverEvery = (snow: boolean) => KIT_F.shiver.every * (snow ? KIT_F.shiver.snow : 1)

/** A cap-limited stack gain (a frenzy stack). */
export const stackUp = (stacks: number, cap: number) => Math.min(cap, stacks + 1)

/** Stacks left after a decay check: one fades every `every` s once `hold` s went by since the last gain. */
export const faded = (stacks: number, since: number, dt: number, hold: number, every: number) => {
  if (stacks <= 0 || since < hold) return stacks
  const before = Math.floor((since - dt - hold) / every)
  const after = Math.floor((since - hold) / every)
  return Math.max(0, stacks - Math.max(0, after - before))
}

/** The family's bonuses right now, on top of its other stats (`recomputeStats`). */
export const kitFDeltas = (kit: FossilKit | undefined, stage: number): readonly StatDelta[] => {
  if (!kit) return []
  switch (kit.kind) {
    case 'smash': {
      const S = KIT_F.smash
      return kit.left > 0 ? [{ armor: S.armor, might: atStage(S.might, stage), speed: atStage(S.speed, stage), cooldown: atStage(S.haste, stage) }] : []
    }
    case 'roots': return kit.rooted ? [{ regen: atStage(KIT_F.roots.regen, stage), armor: atStage(KIT_F.roots.armor, stage) }] : []
    case 'frenzy': return kit.stacks > 0 ? [{ might: kit.stacks * KIT_F.frenzy.might, speed: kit.stacks * KIT_F.frenzy.speed }] : []
    default: return []
  }
}

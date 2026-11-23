import type { PlayableId } from '../data/hatchlings'
import type { StatDelta } from './stats'
import * as dm from '../engine/dmath'

/**
 * Pure numbers and rules of the Grande Atualização's second batch of families
 * (`data/gaFamiliesB.ts`). `gaKitBSystem.ts` runs them on `Player.kitB`;
 * nothing here touches the game, so each rule is tested on its own. As in
 * Temporada 1, every bonus is capped and every protection has a fixed cooldown
 * the cooldown stat can't shrink. Arrays are by evolution stage.
 */
export const KIT_B = {
  /**
   * Onix's line: rock (then steel) segments trailing as a chain, px from the head to the first (above or below it,
   * then beside it, where the sheets' own tail already reaches) and between each and the next (they taper to the tail), how hard and how often each hits. Standing still `settle` s, the body
   * coils round the head at `coil` px, eased in at `ease` per s.
   */
  serpent: { segments: [3, 5], lead: [[14, 30], [16, 32]], gaps: [[10, 9, 8], [11, 10, 9, 9, 8]], settle: 0.4, coil: [30, 32], ease: 4, r: [8, 9], power: [4, 6], every: 0.5, knockback: [24, 40] },
  /** Happiny's line: seconds between eggs, how many lie at once, how long one lasts, the reach to take it and the share of the taker's max HP it heals. */
  eggs: { every: [11, 10, 9], max: 3, life: 20, reach: 13, heal: [0.07, 0.09, 0.12], drop: [22, 34] },
  /** Clauncher's line: Mega Launcher, every Nth Aura Sphere is the claw's full blast, and what the blast adds. */
  launcher: { every: [4, 3], power: 2.2, area: 1.8, pierce: 6, knockback: 110 },
  /** Fletchling's line: Gale Wings, at full HP (this share of it); what it adds, and Acrobatics' boost while it holds. */
  gale: { full: 0.99, speed: [5, 8, 11], cooldown: [-0.04, -0.06, -0.09], acrobatics: 1.4 },
  /** Golett's line: the arm jets' fixed cooldown, a foe this close to take off, seconds aloft, the speed while aloft and the landing. */
  jets: { cooldown: 15, near: 110, air: [0.5, 1.3], speed: [10, 34], r: [44, 66], power: [14, 30], knockback: 140 },
  /** Nacli's line: salt layers from Salt Cure's kills, the cap by stage, what each adds and how they crumble. */
  salt: { cap: [3, 4, 6], armor: 0.5, damageTaken: -0.02, hold: 5, decayEvery: 2.5 },
  /** Inkay's line: Topsy-Turvy, seconds between flips, the ring's reach, the confusion and the hit. */
  topsy: { every: [12, 9], r: [64, 96], confuse: [1.6, 2.4], power: [6, 12] },
  /** Skorupi's line: seconds between tail grabs, the reach, the pull, the hold and the venom. */
  pin: { every: [5, 3.5], reach: [70, 92], pull: 220, hold: [1, 1.4], poison: { kind: 'poison', chance: 1, duration: 3, power: 0.3 }, power: [6, 12], show: 0.3 },
  /** Snover's line: Snow Warning, the snowfall around it, how often it bites, its slow and the Ice moves' boost. */
  snowfall: { r: [46, 62], every: 0.6, power: [1.5, 2.5], slow: { kind: 'slow', chance: 1, duration: 0.8, power: 0.3 }, ice: [0.1, 0.2] },
  /** Dewpider's line: Water Bubble's fixed cooldown, the pop's splash, the i-frames it leaves and the Water moves' boost. */
  bubble: { cooldown: [15, 11], r: [40, 58], power: [12, 24], iframes: 0.8, water: 0.15 },
  /** Duraludon's line: Stamina, stacks from hits taken, the cap by stage, what each adds and how they fade. */
  stamina: { cap: [3, 6], armor: 0.5, might: 0.02, hold: 4, decayEvery: 1.5 },
  /** Bounsweet's line: Queenly Majesty, the ring that stops enemy shots and the seconds between two it stops. */
  majesty: { r: [20, 30, 42], every: [1.4, 1, 0.6] },
  /** Tynamo's line: Spark's latch (from Eelektrik on), seconds on, a shock every, and how many neighbors each arcs to. */
  latch: { left: [0, 2.5, 3.2], every: 0.35, arcs: [0, 1, 2], share: 0.35, reach: 60 },
  /**
   * Sandile's line: it dives into the sand when a foe closes in (a fixed cooldown), runs unseen and faster for a
   * moment, then bursts up under whatever stands there (the eruption's reach, hit and toss). Moxie: each KO adds
   * a stack (capped), `might` each and `erupt` more on the next eruption; they hold `hold` s after the last KO, then
   * one fades every `decayEvery` s.
   */
  burrow: {
    cooldown: [8, 6.5, 5], near: 34, under: [0.8, 1, 1.2], speed: [12, 16, 20], r: [38, 50, 64], power: [10, 18, 28], knockback: 150, iframes: 0.35,
    moxie: { cap: [5, 8, 12], might: 0.025, erupt: 0.05, hold: 4, decayEvery: 0.8 },
  },
  /**
   * Stufful's line: a bear hug every few seconds grabs the toughest regular foe in reach, carries it a moment and
   * hurls it at the nearest other foe, where it crashes through the horde and lands in a slam.
   */
  hug: {
    every: [6, 4.2], reach: [40, 54], carry: [0.8, 0.65],
    hurl: { force: [300, 380], power: [16, 30], flight: 0.32, r: [30, 44], slam: [12, 26], knockback: 110, aim: 160 },
  },
} as const

/** A foe in Stufful's arms, or flying from them: its id and the seconds this part has left. */
export type Held = { id: number; left: number }

/** One of Happiny's eggs on the ground. */
export type LuckyEgg = { x: number; y: number; left: number }

/** Each family's running state on `Player.kitB`; absent for anyone else (and Tynamo's line, whose latch rides on its move). */
export type GaKitB =
  | { kind: 'serpent'; segs: number[]; walked: number; still: number; coil: number; turn: number; hit: number }
  | { kind: 'eggs'; next: number; eggs: LuckyEgg[] }
  | { kind: 'launcher'; shots: number }
  | { kind: 'gale'; on: boolean }
  | { kind: 'jets'; charge: number; air: number; total: number }
  | { kind: 'salt'; layers: number; last: number }
  | { kind: 'topsy'; next: number }
  | { kind: 'pin'; next: number; grab: { x: number; y: number; left: number } | null }
  | { kind: 'snowfall'; pulse: number }
  | { kind: 'bubble'; down: number }
  | { kind: 'stamina'; stacks: number; last: number }
  | { kind: 'majesty'; ready: number }
  | { kind: 'burrow'; charge: number; under: boolean; stacks: number; last: number }
  | { kind: 'hug'; next: number; held: Held | null; flying: Held | null }

const CREATE = {
  onix: () => ({ kind: 'serpent', segs: [], walked: 0, still: 0, coil: 0, turn: 1, hit: 0 }),
  happiny: () => ({ kind: 'eggs', next: KIT_B.eggs.every[0], eggs: [] }),
  clauncher: () => ({ kind: 'launcher', shots: 0 }),
  fletchling: () => ({ kind: 'gale', on: true }),
  golett: () => ({ kind: 'jets', charge: KIT_B.jets.cooldown / 2, air: 0, total: 0 }),
  nacli: () => ({ kind: 'salt', layers: 0, last: 0 }),
  inkay: () => ({ kind: 'topsy', next: KIT_B.topsy.every[0] / 2 }),
  skorupi: () => ({ kind: 'pin', next: 2, grab: null }),
  snover: () => ({ kind: 'snowfall', pulse: 0 }),
  dewpider: () => ({ kind: 'bubble', down: 0 }),
  duraludon: () => ({ kind: 'stamina', stacks: 0, last: 0 }),
  bounsweet: () => ({ kind: 'majesty', ready: 0 }),
  sandile: () => ({ kind: 'burrow', charge: KIT_B.burrow.cooldown[0] / 2, under: false, stacks: 0, last: 0 }),
  stufful: () => ({ kind: 'hug', next: KIT_B.hug.every[0] / 2, held: null, flying: null }),
} as const satisfies Partial<Record<PlayableId, () => GaKitB>>

const hasKit = (id: PlayableId): id is keyof typeof CREATE => id in CREATE

/** The fresh state of a family's mechanic, or null for anyone without one (`createPlayer` then leaves the field out). */
export const createKitB = (starter: PlayableId): GaKitB | null => (hasKit(starter) ? CREATE[starter]() : null)

/** A by-stage number at `stage`, the last one past the end. */
export const atStage = <T>(values: readonly T[], stage: number): T => values[Math.min(Math.max(0, stage), values.length - 1)]!

/** Stacks left after a decay check: one fades every `every` s once `hold` s went by since the last gain (Salt, Stamina). */
export const faded = (stacks: number, since: number, dt: number, hold: number, every: number) => {
  if (stacks <= 0 || since < hold) return stacks
  const before = Math.floor((since - dt - hold) / every)
  const after = Math.floor((since - hold) / every)
  return Math.max(0, stacks - Math.max(0, after - before))
}

/** Onix's body as the chain's x, y pairs, most segments any stage has; how many show is the stage's. */
export type SerpentBody = { segs: number[]; still: number; coil: number; turn: number }

/** The unit vector behind a facing (fx, fy); straight down the screen's back (up) when it has none. */
const backOf = (fx: number, fy: number) => {
  const len = dm.hypot(fx, fy)
  return len > 0 ? { x: -fx / len, y: -fy / len } : { x: 0, y: -1 }
}

/** Lays the body out straight behind a head at (hx, hy) facing (fx, fy): a new run, or after a jump the chain can't follow. */
const layOut = (body: SerpentBody, hx: number, hy: number, fx: number, fy: number, stage: number) => {
  const S = KIT_B.serpent
  const back = backOf(fx, fy)
  const [leadV, leadH] = atStage(S.lead, stage)
  let d = leadV + (leadH - leadV) * Math.abs(back.x)
  body.segs.length = 0
  for (const gap of S.gaps[S.gaps.length - 1]!) {
    body.segs.push(hx + back.x * d, hy + back.y * d)
    d += gap
  }
}

/**
 * Steps Onix's body behind a head at (hx, hy) facing (fx, fy), `dt` s after the last: each segment is pulled
 * along once farther than its gap from the one before (never pushed, so turning back the head passes through
 * and the body folds after it, as a snake's). Once the head stood still `settle` s, the body eases into a coil
 * round it, so a body that stopped mid-fold never rests stacked. `still` is how long the head has stood still,
 * the caller's to count.
 */
export const stepSerpent = (body: SerpentBody, hx: number, hy: number, fx: number, fy: number, stage: number, dt: number) => {
  const S = KIT_B.serpent
  const gaps = S.gaps[S.gaps.length - 1]!
  const [leadV, leadH] = atStage(S.lead, stage)
  if (body.segs.length < gaps.length * 2 || dm.sq(body.segs[0]! - hx) + dm.sq(body.segs[1]! - hy) > dm.sq(leadH * 4)) layOut(body, hx, hy, fx, fy, stage)
  const segs = body.segs
  if (body.still >= S.settle) {
    if (body.still - dt < S.settle) {
      // Just settled: the coil starts where the first segment lies and curls toward the front (down the screen).
      body.coil = dm.atan2(segs[1]! - hy, segs[0]! - hx)
      body.turn = dm.cos(body.coil) >= 0 ? 1 : -1
    }
    const r = atStage(S.coil, stage)
    const k = 1 - dm.exp(-S.ease * dt)
    let angle = body.coil
    for (let i = 0; i < gaps.length; i++) {
      // A spiral: each segment a gap further round, a little nearer the head.
      const ring = r - i * 1.5
      const tx = hx + dm.cos(angle) * ring
      const ty = hy + dm.sin(angle) * ring * 0.6
      segs[i * 2] = segs[i * 2]! + (tx - segs[i * 2]!) * k
      segs[i * 2 + 1] = segs[i * 2 + 1]! + (ty - segs[i * 2 + 1]!) * k
      angle += body.turn * (gaps[i]! / ring)
    }
  }
  let px = hx
  let py = hy
  for (let i = 0; i < gaps.length; i++) {
    const dx = segs[i * 2]! - px
    const dy = segs[i * 2 + 1]! - py
    const d = dm.hypot(dx, dy)
    const want = i > 0 ? gaps[i - 1]! : d > 0 ? leadV + ((leadH - leadV) * Math.abs(dx)) / d : leadV
    if (d > want) {
      segs[i * 2] = px + (dx / d) * want
      segs[i * 2 + 1] = py + (dy / d) * want
    }
    px = segs[i * 2]!
    py = segs[i * 2 + 1]!
  }
}

/** Mega Launcher: after this cast, how many shots are counted, and whether this one is the full blast. */
export const launcherShot = (shots: number, stage: number) => {
  const next = shots + 1
  const every = atStage(KIT_B.launcher.every, stage)
  return next >= every ? { shots: 0, blast: true } : { shots: next, blast: false }
}

/** Gale Wings holds at full HP only. */
export const galeOn = (hp: number, maxHp: number) => maxHp > 0 && hp >= maxHp * KIT_B.gale.full

/** The arm jets take off once recharged with a foe near; Golett only hops. */
export const jetsReady = (charge: number, air: number, foeNear: boolean) => charge <= 0 && air <= 0 && foeNear

/** A cap-limited stack gain (a salt layer, a Stamina stack). */
export const stackUp = (stacks: number, cap: number) => Math.min(cap, stacks + 1)

/** Sandile dives once recharged with a foe this close, unless already under. */
export const diveReady = (charge: number, under: boolean, nearest: number) => charge <= 0 && !under && nearest <= KIT_B.burrow.near

/** The eruption's hit: the stage's power, more for each Moxie stack. */
export const eruptPower = (stage: number, stacks: number) => atStage(KIT_B.burrow.power, stage) * (1 + stacks * KIT_B.burrow.moxie.erupt)

/** Queenly Majesty stops one more shot when its ring is ready. */
export const majestyStops = (ready: number) => ready <= 0

/** Whether a lucky egg at (ex, ey) is taken by a body at (x, y) with `radius`. */
export const eggTaken = (ex: number, ey: number, x: number, y: number, radius: number) => {
  const reach = KIT_B.eggs.reach + radius
  const dx = ex - x
  const dy = ey - y
  return dx * dx + dy * dy <= reach * reach
}

/** What an egg heals the player who takes it, before the difficulty's healing. */
export const eggHeal = (maxHp: number, stage: number) => maxHp * atStage(KIT_B.eggs.heal, stage)

/** The family's bonuses right now, on top of its other stats (`recomputeStats`). */
export const kitBDeltas = (kit: GaKitB | undefined, stage: number): readonly StatDelta[] => {
  if (!kit) return []
  switch (kit.kind) {
    case 'gale': return kit.on ? [{ speed: atStage(KIT_B.gale.speed, stage), cooldown: atStage(KIT_B.gale.cooldown, stage) }] : []
    case 'jets': return kit.air > 0 ? [{ speed: atStage(KIT_B.jets.speed, stage) }] : []
    case 'salt': return kit.layers > 0 ? [{ armor: kit.layers * KIT_B.salt.armor, damageTaken: kit.layers * KIT_B.salt.damageTaken }] : []
    case 'snowfall': return [{ typeDamage: { ice: atStage(KIT_B.snowfall.ice, stage) } }]
    case 'bubble': return [{ typeDamage: { water: KIT_B.bubble.water } }]
    case 'stamina': return kit.stacks > 0 ? [{ armor: kit.stacks * KIT_B.stamina.armor, might: kit.stacks * KIT_B.stamina.might }] : []
    case 'burrow': {
      const moxie = kit.stacks > 0 ? [{ might: kit.stacks * KIT_B.burrow.moxie.might }] : []
      return kit.under ? [...moxie, { speed: atStage(KIT_B.burrow.speed, stage) }] : moxie
    }
    default: return []
  }
}

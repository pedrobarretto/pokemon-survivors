import type { PlayableId } from '../data/hatchlings'
import type { WeatherId } from '../data/biomes'
import type { StatDelta } from './stats'

/**
 * Pure numbers and rules of Temporada 1's mechanic families
 * (`data/seasonOneKits.ts`). `seasonOneKitSystem.ts` runs them on `Player.kit`;
 * nothing here touches the game, so each rule is tested on its own. Every
 * bonus is capped and every protection has a fixed cooldown the cooldown stat
 * can't shrink: the season's point is cutting invincible builds.
 */
export const KIT = {
  /** Mankey's line: stacks by evolution stage, what each adds, how long it holds and how fast it fades. */
  rage: { cap: [6, 9, 12], might: 0.035, speed: 0.5, hold: 3.5, decayEvery: 1.2 },
  /** Pawniard's line: bosses beaten this run. */
  supreme: { cap: 6, might: 0.07, area: 0.02 },
  /** Goomy's line: px between slime patches, how they hit, and the heal budget (share of max HP per second). */
  slime: { gap: 16, r: 11, ttl: 3.4, hitInterval: 0.5, share: 0.25, healPerHit: 0.6, healRate: 0.008, slow: { kind: 'slow', chance: 1, duration: 0.9, power: 0.35 } },
  /** Wishiwashi: kills to fill the School meter, seconds as a School, seconds the meter stays shut after one. */
  school: { need: 40, left: 9, lockout: 16, might: 0.9, area: 0.25, radiusCap: 16 },
  /** Tandemaus' line: mice at once, how far a foe is lured from, their pace and bite. */
  mice: { cap: 5, lure: 72, pace: 132, bite: 8, biteEvery: 0.55, seek: 150, touched: 0.25 },
  /** Palafin: what the Hero Forme adds, the heal when it rises and the i-frames it rises with. */
  hero: { might: 0.35, speed: 8, heal: 0.6, iframes: 2.5 },
  /** Morpeko: seconds per mode, and what each adds. */
  hunger: { every: 6, full: { speed: 8 }, hangry: { might: 0.2, speed: -5 } },
  /** Darumaka's line: HP share that enters and leaves Zen, what it changes, the orb's cadence and hit. */
  zen: { enter: 0.5, exit: 0.66, speed: -18, armor: 4, every: 2.4, reach: 210, power: 24, orbSpeed: 74, orbR: 9 },
  /** Wimpod's line: HP share that trips the exit, its fixed cooldown, the dash and its i-frames. */
  exit: { under: 0.5, cooldown: 32, dash: 118, time: 0.2, iframes: 0.55 },
  /** Mimikyu: Disguise's fixed cooldown, and the i-frames a busted one leaves. */
  disguise: { cooldown: 24, iframes: 0.8 },
  /** Tatsugiri: kills to fill Commander, seconds inside Dondozo, seconds the meter stays shut, its slams and what it shrugs off. */
  commander: { need: 36, left: 6, lockout: 18, slamEvery: 0.85, slamR: 74, power: 30, damageTaken: -0.25 },
} as const

/** One running mouse of Tandemaus' line. */
export type Mouse = { x: number; y: number; left: number; bite: number; damage: number; mods: number }

/** Each family's running state on `Player.kit`; absent for anyone else (and Rotom, whose stance is the special's). */
export type SeasonKit =
  | { kind: 'rage'; stacks: number; last: number }
  | { kind: 'supreme'; stacks: number }
  | { kind: 'slime'; walked: number; heal: number; at: number }
  | { kind: 'school'; meter: number; left: number; lockout: number }
  | { kind: 'mice'; mice: Mouse[] }
  | { kind: 'hero'; spent: boolean }
  | { kind: 'hunger'; hangry: boolean; next: number }
  | { kind: 'forecast' }
  | { kind: 'zen'; on: boolean; orb: number }
  | { kind: 'exit'; cooldown: number }
  | { kind: 'disguise'; down: number }
  | { kind: 'commander'; meter: number; left: number; lockout: number; slam: number }

const CREATE = {
  mankey: () => ({ kind: 'rage', stacks: 0, last: 0 }),
  pawniard: () => ({ kind: 'supreme', stacks: 0 }),
  goomy: () => ({ kind: 'slime', walked: 0, heal: 0, at: 0 }),
  wishiwashi: () => ({ kind: 'school', meter: 0, left: 0, lockout: 0 }),
  tandemaus: () => ({ kind: 'mice', mice: [] }),
  finizen: () => ({ kind: 'hero', spent: false }),
  morpeko: () => ({ kind: 'hunger', hangry: false, next: KIT.hunger.every }),
  castform: () => ({ kind: 'forecast' }),
  darumaka: () => ({ kind: 'zen', on: false, orb: 0 }),
  wimpod: () => ({ kind: 'exit', cooldown: 0 }),
  mimikyu: () => ({ kind: 'disguise', down: 0 }),
  tatsugiri: () => ({ kind: 'commander', meter: 0, left: 0, lockout: 0, slam: 0 }),
} as const satisfies Partial<Record<PlayableId, () => SeasonKit>>

const hasKit = (id: PlayableId): id is keyof typeof CREATE => id in CREATE

/** The fresh state of a family's mechanic, or null for a starter with none (`createPlayer` then leaves the field out). */
export const createSeasonKit = (starter: PlayableId): SeasonKit | null => (hasKit(starter) ? CREATE[starter]() : null)

const clampStage = (cap: readonly number[], stage: number) => cap[Math.min(stage, cap.length - 1)]!

/** Rage's cap at an evolution stage. */
export const rageCap = (stage: number) => clampStage(KIT.rage.cap, stage)

/** A hit taken adds a stack up to the stage's cap. */
export const rageHit = (stacks: number, stage: number) => Math.min(rageCap(stage), stacks + 1)

/** Stacks left after a decay check: one fades every `decayEvery` s once `hold` s went by without a hit. */
export const rageFaded = (stacks: number, sinceHit: number, dt: number) => {
  if (stacks <= 0 || sinceHit < KIT.rage.hold) return stacks
  const before = Math.floor((sinceHit - dt - KIT.rage.hold) / KIT.rage.decayEvery)
  const after = Math.floor((sinceHit - KIT.rage.hold) / KIT.rage.decayEvery)
  return Math.max(0, stacks - Math.max(0, after - before))
}

/** Supreme Overlord's stacks after one more boss falls. */
export const supremeUp = (stacks: number) => Math.min(KIT.supreme.cap, stacks + 1)

/**
 * A kill feeds a School or Commander meter: nothing while the form runs or the
 * lockout shuts it, so a fast clearing build can't hold the form up.
 */
export const meterFed = (meter: number, need: number, left: number, lockout: number) => (left > 0 || lockout > 0 ? meter : Math.min(need, meter + 1))

/** The slime's heal budget `elapsed` s after it held `left`, for a player with `maxHp`: at most one second of `healRate`. */
export const slimeRefill = (left: number, elapsed: number, maxHp: number) => {
  const cap = maxHp * KIT.slime.healRate
  return Math.min(cap, left + elapsed * cap)
}

/** Zen Mode next tick, with its hysteresis so HP on the line doesn't flicker it. */
export const zenNext = (on: boolean, hp: number) => (on ? hp < KIT.zen.exit : hp < KIT.zen.enter)

/** Whether a hit took the player from at or over the line to under it, with the exit recharged. */
export const exitTrips = (before: number, after: number, cooldown: number) => cooldown <= 0 && before >= KIT.exit.under && after < KIT.exit.under

/** Palafin alone (the last stage), once a run. */
export const heroHolds = (spent: boolean, stage: number) => !spent && stage >= 1

/** How many more mice fit with `alive` running. */
export const miceRoom = (alive: number, wanted: number) => Math.max(0, Math.min(wanted, KIT.mice.cap - alive))

/** The family's bonuses right now, on top of its other stats (`recomputeStats`). */
export const seasonKitDeltas = (kit: SeasonKit | undefined): readonly StatDelta[] => {
  if (!kit) return []
  switch (kit.kind) {
    case 'rage': return kit.stacks > 0 ? [{ might: kit.stacks * KIT.rage.might, speed: kit.stacks * KIT.rage.speed }] : []
    case 'supreme': return kit.stacks > 0 ? [{ might: kit.stacks * KIT.supreme.might, area: kit.stacks * KIT.supreme.area }] : []
    case 'school': return kit.left > 0 ? [{ might: KIT.school.might, area: KIT.school.area }] : []
    case 'hero': return kit.spent ? [{ might: KIT.hero.might, speed: KIT.hero.speed }] : []
    case 'hunger': return [kit.hangry ? KIT.hunger.hangry : KIT.hunger.full]
    case 'zen': return kit.on ? [{ speed: KIT.zen.speed, armor: KIT.zen.armor }] : []
    case 'commander': return kit.left > 0 ? [{ damageTaken: KIT.commander.damageTaken }] : []
    default: return []
  }
}

/** The sheets a form-changing family wears, as the manifest names them; undefined for its normal ones. */
export type SeasonForm = 'school' | 'hero' | 'hangry' | 'sunny' | 'rainy' | 'snowy' | 'zen' | 'busted'

const WEATHER_FORM: Partial<Record<WeatherId, SeasonForm>> = { sun: 'sunny', rain: 'rainy', snow: 'snowy' }

/** Which form the kit shows: only the stages with sheets for it (Darmanitan's Zen, Palafin's Hero). */
export const seasonKitForm = (kit: SeasonKit | undefined, stage: number, weather: WeatherId): SeasonForm | undefined => {
  if (!kit) return undefined
  switch (kit.kind) {
    case 'school': return kit.left > 0 ? 'school' : undefined
    case 'hero': return kit.spent && stage >= 1 ? 'hero' : undefined
    case 'hunger': return kit.hangry ? 'hangry' : undefined
    case 'forecast': return WEATHER_FORM[weather]
    case 'zen': return kit.on && stage >= 1 ? 'zen' : undefined
    case 'disguise': return kit.down > 0 ? 'busted' : undefined
    default: return undefined
  }
}

/** What a Commander or School meter reads for the bar (0..1), or null for a family without one. */
export const kitMeter = (kit: SeasonKit | undefined) => {
  if (kit?.kind === 'school') return { fill: kit.left > 0 ? kit.left / KIT.school.left : kit.meter / KIT.school.need, on: kit.left > 0, locked: kit.lockout > 0 }
  if (kit?.kind === 'commander') return { fill: kit.left > 0 ? kit.left / KIT.commander.left : kit.meter / KIT.commander.need, on: kit.left > 0, locked: kit.lockout > 0 }
  return null
}

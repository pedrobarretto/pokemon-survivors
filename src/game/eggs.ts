import { chance, weightedPick, type Rng } from '../engine/rng'
import type { EnemyId } from '../data/enemies'
import { HATCHLING_IDS, HATCHLINGS, isHatchling, isStarter, type HatchlingId, type PlayableId } from '../data/hatchlings'
import { isRiftLegend } from '../data/rifts'
import { GRAVEYARD } from '../data/places'
import { MYTHICALS } from '../data/waves'
import { INCUBATOR } from '../data/shop'
import { markHatch } from './dex'
import { wholeNumber } from './parse'
import { REAPER } from './endless'
import type { Save } from './meta'

/**
 * Eggs: a few drop in runs (bosses, locked chests, rifts, places), wait in a small
 * incubator and hatch after enough steps walked inside runs, unlocking a
 * playable family (`data/hatchlings.ts`). Pure rules: the simulation awards
 * them (`awardEgg` in `pickups.ts`) and `ui/save.ts` persists them.
 */

/**
 * An egg tier: the steps it walks to hatch, the ₽ it pays when it can't fit
 * (or hatches a duplicate), `even` odds among its families, the tier whose
 * families it hatches when not its own (`families`) and a hatch that's always `shiny`.
 */
type EggTierRule = { steps: number; refund: number; even?: boolean; families?: string; shiny?: boolean }

export const EGG_TIERS = {
  common: { steps: 2000, refund: 300 },
  rare: { steps: 4000, refund: 600 },
  ultra: { steps: 8000, refund: 1200 },
  /** The Friendship Egg: only a Mystery Gift for an invite brings it (`game/referral.ts`), and only Munchlax comes out. */
  friend: { steps: 2000, refund: 600 },
  /**
   * The Haunted Egg: only Duskull's stall sells it, on the Noite das Bruxas
   * (`STALLS` in `data/visitors.ts`), and only its four ghosts come out, at
   * `even` odds (no nudge towards the families not hatched yet, as the stall shows).
   */
  haunted: { steps: 3000, refund: 1500, even: true },
  /**
   * The Kecleon Egg: only the Vitrine's fixed card sells it (`VITRINE.kecleonEgg`,
   * `game/shop.ts`), one a day, and only its four families come out (Porygon,
   * Exeggcute, Scraggy and Smeargle), at `even` odds, as the card shows.
   */
  kecleon: { steps: 4000, refund: 2500, even: true },
  /** The loyalty card's 100-stamp gift (`LOYALTY`): a Kecleon Egg whose hatch is always shiny. */
  kecleonShiny: { steps: 4000, refund: 2500, even: true, families: 'kecleon', shiny: true },
} as const satisfies Record<string, EggTierRule>

export type EggTier = keyof typeof EGG_TIERS

export const EGG_TIER_IDS = Object.keys(EGG_TIERS) as EggTier[]

export const EGGS = {
  /** Incubator slots every save has (the shop sells more, `INCUBATOR.slots`). An egg that finds them full is paid out in ₽ (its tier's `refund`). */
  slots: 3,
  /** Eggs a single run can drop. */
  perRun: 2,
  /** World px per step: the base speed (68 px/s) walks about 4 steps a second. */
  stepPx: 16,
  shinyOdds: 1 / 100,
  /** Families not hatched yet are this many times likelier to come out. */
  newWeight: 3,
  /** Eggs of a kind in a row without a new family, after which the next one of that kind is sure to bring one (`guaranteedNew`). */
  pity: 5,
} as const

type DropRule = { chance: number; odds: Partial<Record<EggTier, number>> }

/** Odds that each source leaves an egg, and the weights of its tier. */
export const EGG_SOURCES = {
  boss: { chance: 0.15, odds: { common: 70, rare: 25, ultra: 5 } },
  chest: { chance: 0.1, odds: { common: 85, rare: 15 } },
  rift: { chance: 0.4, odds: { rare: 65, ultra: 35 } },
  /** The cave's treasure chest and Spiritomb (`data/places.ts`). */
  place: { chance: 0.25, odds: { common: 55, rare: 40, ultra: 5 } },
  final: { chance: 1, odds: { rare: 70, ultra: 30 } },
  reaper: { chance: 1, odds: { ultra: 1 } },
  /** A defended nest (`fieldMissions.ts`): the mission rolls its own odds per difficulty first. */
  mission: { chance: 1, odds: { common: 60, rare: 35, ultra: 5 } },
} as const satisfies Record<string, DropRule>

export type EggSource = keyof typeof EGG_SOURCES

/** The egg rule of a fainted boss: rift legendaries (an event rift's Darkrai too), Arceus, Mewtwo, the mythicals (Mew, Celebi, Jirachi) and places' bosses have their own. */
export const bossEggSource = (kind: EnemyId): EggSource =>
  kind === REAPER
    ? 'reaper'
    : isRiftLegend(kind)
      ? 'rift'
      : kind === 'mewtwo' || MYTHICALS.some((id) => id === kind)
        ? 'final'
        : kind === GRAVEYARD.boss
          ? 'place'
          : 'boss'

/* ---------------- In a run ---------------- */

/** An egg found this run, with the distance walked (px) when it was found; in co-op, every player's (`walked`, by slot). */
export type FoundEgg = { tier: EggTier; at: number; walked?: number[] }

/** `lucky`: this player never had an egg, so the next roll can't miss. `boost` multiplies every source's chance (Incense). */
export type RunEggs = { found: FoundEgg[]; lucky: boolean; boost: number }

/** Whether `source` leaves an egg, and which. Null on a miss or once the run's cap is reached. */
export const rollEgg = (rng: Rng, source: EggSource, eggs: RunEggs): EggTier | null => {
  if (eggs.found.length >= EGGS.perRun) return null
  const rule: DropRule = EGG_SOURCES[source]
  if (!eggs.lucky && !chance(rng, Math.min(1, rule.chance * eggs.boost))) return null
  return weightedPick(rng, EGG_TIER_IDS.flatMap((tier) => (rule.odds[tier] ? [[tier, rule.odds[tier]] as const] : [])))
}

export const toSteps = (px: number) => Math.floor(Math.max(0, px) / EGGS.stepPx)

/* ---------------- Incubator ---------------- */

/** An egg in the incubator: its tier, the steps it has walked so far and whether a Quick Incubator speeds it up (`game/incubator.ts`). */
export type Egg = { tier: EggTier; steps: number; quick?: boolean }

/** Families hatched so far. A shiny hatch keeps the family shiny for good. */
export type Hatched = Partial<Record<HatchlingId, { shiny: boolean }>>

/** The egg pity: per family pool (`poolOf`), the eggs hatched in a row that brought no new family, up to `EGGS.pity`. */
export type EggPity = Partial<Record<EggTier, number>>

export const stepsLeft = (egg: Egg) => Math.max(0, EGG_TIERS[egg.tier].steps - egg.steps)

export const isReady = (egg: Egg) => stepsLeft(egg) === 0

/** Steps still to walk in runs before the egg hatches: a quick one needs `INCUBATOR.quick.speed` times fewer. */
export const stepsToWalk = (egg: Egg) => Math.ceil(stepsLeft(egg) / (egg.quick ? INCUBATOR.quick.speed : 1))

/** The egg after `steps` more, capped at its tier's; a quick one walks them `INCUBATOR.quick.speed` times over. */
const walk = (egg: Egg, steps: number): Egg => {
  const walked = Math.min(EGG_TIERS[egg.tier].steps, egg.steps + (egg.quick ? steps * INCUBATOR.quick.speed : steps))
  return egg.quick ? { tier: egg.tier, steps: walked, quick: true } : { tier: egg.tier, steps: walked }
}

/** The incubator's slots for a save: the `EGGS.slots` every save has plus the ones bought at the shop. */
export const incubatorSlots = (save: Pick<Save, 'incubator'>) => EGGS.slots + save.incubator.slots

/** The most slots an incubator can have, every upgrade bought. */
export const MAX_SLOTS = EGGS.slots + INCUBATOR.slots.length

/** Incubator slots still free out of `slots` (`incubatorSlots`). */
export const freeSlots = (eggs: readonly Egg[], slots: number) => Math.max(0, slots - eggs.length)

/** Whether a save's incubator has no slot left for another egg. */
export const incubatorFull = (save: Pick<Save, 'eggs' | 'incubator'>) => freeSlots(save.eggs, incubatorSlots(save)) === 0

/** The ₽ eggs of these tiers are paid out for when they don't fit. */
export const refundOf = (tiers: readonly EggTier[]) => tiers.reduce((sum, tier) => sum + EGG_TIERS[tier].refund, 0)

/**
 * Banks a run into the incubator: the eggs already in it walk `steps` (twice
 * over with a Quick Incubator), then the new ones (with the steps they walked
 * since found) take the free slots. Those that don't fit are paid out in ₽.
 */
export const depositEggs = (save: Save, steps: number, found: readonly Egg[]) => {
  const free = freeSlots(save.eggs, incubatorSlots(save))
  const converted = found.slice(free).map((e) => e.tier)
  const refund = refundOf(converted)
  const eggs = [...save.eggs.map((e) => walk(e, steps)), ...found.slice(0, free).map((e) => walk(e, 0))]
  return { save: { ...save, eggs, wallet: save.wallet + refund }, converted, refund }
}

/** Gives an egg outside a run (mission rewards). It starts with no steps; a full incubator pays its ₽ instead. */
export const grantEgg = (save: Save, tier: EggTier) => depositEggs(save, 0, [{ tier, steps: 0 }])

/* ---------------- Hatching ---------------- */

/** A hatch: `guaranteed` when the egg pity made it a new family (`guaranteedNew`). */
export type Hatch = { id: HatchlingId; tier: EggTier; shiny: boolean; duplicate: boolean; refund: number; guaranteed: boolean }

/** The tier whose families an egg of `tier` hatches (its `families` when it borrows them): the pool the egg pity counts by. */
export const poolOf = (tier: EggTier): EggTier => {
  const rule: EggTierRule = EGG_TIERS[tier]
  return isTier(rule.families) ? rule.families : tier
}

/** Whether an egg of `tier` could still bring a family this save hasn't hatched. */
const hasNew = (tier: EggTier, hatched: Hatched) => HATCHLING_IDS.some((id) => HATCHLINGS[id].egg === poolOf(tier) && !hatched[id])

/** Whether the next egg of `tier` is sure to bring a new family: the last `EGGS.pity` of its pool brought none, and one is left to bring. */
export const guaranteedNew = (tier: EggTier, hatched: Hatched, pity: EggPity) => (pity[poolOf(tier)] ?? 0) >= EGGS.pity && hasNew(tier, hatched)

/**
 * Who can come out of an egg of `tier` (its `families`' when it borrows them),
 * weighted towards families not hatched yet (all alike for an `even` tier).
 * Only the new ones once the egg pity guarantees one (`guaranteedNew`).
 */
export const hatchPool = (tier: EggTier, hatched: Hatched, pity: EggPity = {}) => {
  const rule: EggTierRule = EGG_TIERS[tier]
  const pool = HATCHLING_IDS.filter((id) => HATCHLINGS[id].egg === poolOf(tier)).map((id) => [id, hatched[id] || rule.even ? 1 : EGGS.newWeight] as const)
  return guaranteedNew(tier, hatched, pity) ? pool.filter(([id]) => !hatched[id]) : pool
}

/** The egg pity the incubator shows: each pool with a drought going and a new family left to bring, with its count. */
export const pityShown = (save: Pick<Save, 'hatched' | 'eggPity'>) =>
  EGG_TIER_IDS.flatMap((tier) => {
    const n = save.eggPity[tier] ?? 0
    return n > 0 && hasNew(tier, save.hatched) ? [[tier, n] as const] : []
  })

/** The egg pity after an egg of `tier` hatched: back to 0 on a new family, one more otherwise (while its pool has a new one to give). */
const afterHatch = (pity: EggPity, tier: EggTier, hatched: Hatched, isNew: boolean): EggPity => {
  const pool = poolOf(tier)
  if (isNew) return { ...pity, [pool]: 0 }
  return hasNew(tier, hatched) ? { ...pity, [pool]: Math.min(EGGS.pity, (pity[pool] ?? 0) + 1) } : pity
}

/** Whether an egg of `tier` always hatches shiny (the loyalty card's Kecleon Egg). */
export const hatchesShiny = (tier: EggTier) => {
  const rule: EggTierRule = EGG_TIERS[tier]
  return rule.shiny === true
}

/** Each family's share of an egg of `tier` for this save (what the shop shows): the weights of `hatchPool`, summing to 1. */
export const hatchOdds = (tier: EggTier, hatched: Hatched, pity: EggPity = {}) => {
  const pool = hatchPool(tier, hatched, pity)
  const total = pool.reduce((sum, [, w]) => sum + w, 0)
  return pool.map(([id, w]) => [id, w / total] as const)
}

/**
 * Hatches the ready egg at `index`. A new family, or the shiny form of one
 * owned in normal colors, unlocks it; anything else is a duplicate worth its
 * tier's ₽. Either way the Pokédex catches what came out (`markHatch`), and
 * the egg pity counts it (a shiny of an owned family isn't new). Null when
 * there is no ready egg there.
 */
export const hatchEgg = (save: Save, index: number, rng: Rng): { save: Save; hatch: Hatch } | null => {
  const egg = save.eggs[index]
  if (!egg || !isReady(egg)) return null
  const guaranteed = guaranteedNew(egg.tier, save.hatched, save.eggPity)
  const id = weightedPick(rng, hatchPool(egg.tier, save.hatched, save.eggPity))
  const shiny = chance(rng, EGGS.shinyOdds) || hatchesShiny(egg.tier)
  const owned = save.hatched[id]
  const duplicate = owned !== undefined && (owned.shiny || !shiny)
  const refund = duplicate ? EGG_TIERS[egg.tier].refund : 0
  return {
    save: {
      ...save,
      eggs: save.eggs.filter((_, i) => i !== index),
      hatched: duplicate ? save.hatched : { ...save.hatched, [id]: { shiny } },
      eggPity: afterHatch(save.eggPity, egg.tier, save.hatched, owned === undefined),
      wallet: save.wallet + refund,
      dex: markHatch(save.dex, HATCHLINGS[id].line.map((stage) => stage.dex), shiny),
    },
    hatch: { id, tier: egg.tier, shiny, duplicate, refund, guaranteed },
  }
}

/** Starters are always playable; egg families once hatched. Legends aren't unlocked by eggs: the Legend mode captures them (the save's side). */
export const isUnlocked = (hatched: Hatched, id: PlayableId) => isStarter(id) || (isHatchling(id) && hatched[id] !== undefined)

/* ---------------- Save fields ---------------- */

/** Rarest first, then the most walked: the order eggs keep their slot in `mergeEggs`. */
const byValue = (x: Egg, y: Egg) => EGG_TIER_IDS.indexOf(y.tier) - EGG_TIER_IDS.indexOf(x.tier) || y.steps - x.steps

const ofTier = (list: readonly Egg[], tier: EggTier) => list.filter((e) => e.tier === tier).sort(byValue)

/**
 * Both incubators in one. Eggs have no identity, so each tier keeps as many
 * as the side with more of it, pairing the most walked with the most walked
 * (each pair keeps the larger step count, and a Quick Incubator either side
 * put on it). Merging the same incubator again changes nothing. Past `slots`
 * (the merged save's, `incubatorSlots`), the rarest and most walked stay.
 */
export const mergeEggs = (a: readonly Egg[], b: readonly Egg[], slots: number): Egg[] =>
  EGG_TIER_IDS.flatMap((tier) => {
    const x = ofTier(a, tier)
    const y = ofTier(b, tier)
    return Array.from({ length: Math.max(x.length, y.length) }, (_, i): Egg => {
      const steps = Math.max(x[i]?.steps ?? 0, y[i]?.steps ?? 0)
      return x[i]?.quick || y[i]?.quick ? { tier, steps, quick: true } : { tier, steps }
    })
  })
    .sort(byValue)
    .slice(0, slots)

/** Every family hatched on either side, shiny if it is shiny on either. */
export const mergeHatched = (a: Hatched, b: Hatched): Hatched =>
  Object.fromEntries(HATCHLING_IDS.flatMap((id) => (a[id] || b[id] ? [[id, { shiny: a[id]?.shiny === true || b[id]?.shiny === true }]] : [])))

/** Each pool's egg pity at the longer drought of the two (two devices that hatched apart may both have counted). */
export const mergeEggPity = (a: EggPity, b: EggPity): EggPity =>
  Object.fromEntries(EGG_TIER_IDS.flatMap((tier) => { const n = Math.max(a[tier] ?? 0, b[tier] ?? 0); return n > 0 ? [[tier, n]] : [] }))

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isTier = (v: unknown): v is EggTier => typeof v === 'string' && v in EGG_TIERS

/** The save's `eggs`: unknown tiers are dropped, steps clamped and the list cut to the save's `slots` (`incubatorSlots`). */
export const parseEggs = (v: unknown, slots: number): Egg[] =>
  Array.isArray(v)
    ? v
        .flatMap((e) => {
          if (!isRecord(e) || !isTier(e.tier)) return []
          const steps = Math.min(EGG_TIERS[e.tier].steps, typeof e.steps === 'number' && e.steps > 0 ? Math.floor(e.steps) : 0)
          return [e.quick === true ? { tier: e.tier, steps, quick: true } : { tier: e.tier, steps }]
        })
        .slice(0, slots)
    : []

/** The save's `hatched`: unknown families are dropped. */
export const parseHatched = (v: unknown): Hatched =>
  isRecord(v) ? Object.fromEntries(HATCHLING_IDS.flatMap((id) => { const h = v[id]; return isRecord(h) ? [[id, { shiny: h.shiny === true }]] : [] })) : {}

/** The save's `eggPity`: unknown pools are dropped, counts clamped to whole numbers up to `EGGS.pity`. */
export const parseEggPity = (v: unknown): EggPity =>
  isRecord(v) ? Object.fromEntries(EGG_TIER_IDS.flatMap((tier) => { const n = wholeNumber(v[tier], EGGS.pity); return n > 0 ? [[tier, n]] : [] })) : {}

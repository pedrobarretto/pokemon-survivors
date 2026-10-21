import { COUNTER } from './mart'
import { totalSpent, type Save } from './meta'
import type { ReplayStart } from './replay'
import { worth } from './sync'

/**
 * The ranked kit: what a ranked run brings from the save (its Poké Mart ranks
 * and the Bag items it used up), priced in ₽, against what the account can
 * back. A replay carries its own start (`ReplayStart`), so without this an
 * edited save, or a tampered game, would play ranked runs with upgrades it
 * never earned, and they would even verify. The API judges it when a run
 * reports (`server/src/ranking.ts`); with `KIT_ENFORCE` an unbacked run stays
 * off the public boards. Pure, shared with the API.
 *
 * What backs a kit: the account's amnesty, decided once per account (the
 * accounts with a save at the ranked kit's deploy get the kit they held then,
 * by `server/scripts/kitAmnesty.ts`; a save imported after it brings its own
 * when it adds up, `importAmnesty`), plus `KIT.base`, plus `KIT.perMinute`
 * for every minute survived in its ranked runs, which the wall clock bounds
 * (`clockAllows`). Calibrated on prod (2026-10-21): no server-only player's
 * kit went past this.
 */
export const KIT = {
  /** ₽ any account may bring unbacked: about what a first run's missions and medals pay. */
  base: 10_000,
  /** ₽ each minute survived in the account's ranked runs backs. */
  perMinute: 5_000,
  /**
   * A save adds up (`selfConsistent`) while its fortune is at most `coinsFactor` times the coins
   * its runs picked up (`lifetime.coins`), plus `slack`: the run bonuses, missions, medals and gifts.
   */
  coinsFactor: 3,
  slack: 30_000,
} as const

/** What a run's start kit cost: its Poké Mart ranks and the Bag items it used up, at their full counter price. */
export const kitCost = (start: Pick<ReplayStart, 'ranks' | 'lure' | 'incense'>) =>
  totalSpent(start.ranks) + (start.lure ? COUNTER.lure.price : 0) + (start.incense ? COUNTER.incense.price : 0)

/** ₽ of kit an account backs: its amnesty, the base, and `seconds` survived in its other ranked runs. */
export const kitBacking = (amnesty: number, seconds: number) => amnesty + KIT.base + Math.floor((seconds / 60) * KIT.perMinute)

/** A run's kit and what its account backs, as the API stores them (`runs.kit_cost`, `kit_backing`). */
export type KitVerdict = { cost: number; backing: number }

export const kitBacked = (k: KitVerdict) => k.cost <= k.backing

/** Whether a run goes on the public boards, by its kit: always while the API only observes (`enforce` off). */
export const kitListed = (k: KitVerdict, enforce: boolean) => !enforce || kitBacked(k)

/**
 * Whether a save's fortune (wallet, ranks and spending) could have come from
 * the coins its runs picked up. Every forged save in prod failed it and no
 * honest one did; a forger who also inflates `lifetime.coins` passes, which
 * `runs.kit_cost` and the account's minutes still show.
 */
export const selfConsistent = (save: Save) => worth(save) <= KIT.coinsFactor * save.achievements.lifetime.coins + KIT.slack

/** The amnesty a save imported into an account (a guest's, at its first push) brings: what its ranks cost, or nothing when it doesn't add up. */
export const importAmnesty = (save: Save) => (selfConsistent(save) ? totalSpent(save.ranks) : 0)

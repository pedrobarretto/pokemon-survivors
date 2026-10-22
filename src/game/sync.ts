import { mergeAchievements, mergeGiftTitles } from './achievements'
import { mergeAttempts } from './attempt'
import { mergeClaimedGifts } from './gifts'
import { mergeClears } from './clears'
import { mergeHalloween } from './halloween'
import { mergeCaptures } from './capture'
import { mergeBag } from './bag'
import { mergeShop, shopInvested } from './shop'
import { mergeTms } from './tmShelf'
import { mergeCaps, mergeEvoItems } from './evoItems'
import { mergeCaravan } from './caravan'
import { mergeStall } from './stalls'
import { mergeStyle } from './style'
import { mergeDex } from './dex'
import { incubatorSlots, mergeEggs, mergeHatched } from './eggs'
import { mergeIncubator, slotsInvested } from './incubator'
import { SAVE_VERSION, totalSpent, UPGRADE_IDS, type Ranks, type Save, type UpgradeId } from './meta'
import { mergeMissions } from './missions'
import { mergeRibbons } from './ribbons'
import { mergeShinyStarters } from './shinyStarters'
import { mergeShinyPicks } from './shinyPicks'
import { mergeCompanions } from './supporters'

/**
 * Account sync rules, shared by the game and the API (`server/`): how two
 * saves become one, and what a push stores. Pure, so both sides agree.
 */

/**
 * Everything a save ever got in ₽: the wallet plus what its upgrades cost,
 * what it invested in the shop's level and the incubator's slots, and what it
 * spent on the Vitrine, on styles and on Quick Incubators. Buying, investing
 * or refunding doesn't change it.
 */
const worth = (s: Save) => s.wallet + totalSpent(s.ranks) + shopInvested(s.shop.level) + slotsInvested(s.incubator.slots) + s.spent

/**
 * Two saves of the same player in one (a guest save joining an account, or
 * two devices that played apart). Every rule keeps the larger side, so the
 * result never loses progress and merging it again with either save changes
 * nothing:
 *
 * - Collection: the Pokédex, hatched families and unlocked achievements are
 *   unions; the incubator keeps the most eggs of each tier (`mergeEggs`), up
 *   to the merged slots. Its upgrades: the most slots bought, and the Quick
 *   Incubators' got and used counters at the larger side (`mergeIncubator`).
 * - Upgrades, records, counters and mission progress keep the larger value
 *   (missions of an older day or week give way to the current ones).
 * - ₽: the larger fortune (wallet plus upgrades, the shop's level, the
 *   incubator's slots and other spending, see `worth`) wins, minus what the
 *   merged upgrades, shop level and slots cost and the larger spending, so ₽
 *   spent on one side and kept on the other isn't counted twice.
 * - The title: `incoming`'s, if it shows one.
 * - The difficulty and the partner picked last: `incoming`'s, settings rather than progress.
 * - Shiny starters: a union; each Normal/Shiny pick (a shiny hatch's too) is
 *   `incoming`'s when it has one, else `base`'s, so a hatch switched to Normal stays so.
 * - The bag: each item's got and used counters keep the larger side; what's
 *   armed is `incoming`'s. The shop: the higher level; the most recent day,
 *   the most bought of each card and the gift taken on either side on the
 *   same day; the wishlist is `incoming`'s; the visits, the later day's (the
 *   longer streak on the same day, `mergeVisit`); the loyalty stamps, the
 *   larger count (its milestones are gifts, kept above). Styles: a union, worn as `incoming`.
 * - Gift titles and the ids of the Mystery Gifts applied: unions, so a gift
 *   applied on either side never lands again.
 * - Ribbons: a union, one per day (the better one if both sides had that day).
 * - Shiny picks: a union by ticket; a pick made on either side stays made.
 * - The companion: `incoming`'s, if it has one (like the title); gift-only companions: a union.
 * - Branches taken: per family, `incoming`'s when it has one (like the partner).
 * - Clears: a union, each Pokémon at the harder difficulty of the two.
 * - The Noite das Bruxas candy jar: the fuller one (its rewards are gifts, kept above); its Caça aos Fantasmas: a union.
 * - Legend captures: each legend's win count at the larger side (a shiny
 *   captured is a `shinyStarters` key, a union like the rest).
 * - The TM case: TMs owned and TMs runs taught are unions; the armed picks
 *   are `incoming`'s (`mergeTms`). Evolution items: a union. Bottle Caps:
 *   each Pokémon at the higher level (`mergeCaps`). What they cost is in `spent`.
 * - Meowth's caravan: the later weekend's; on the same weekend, what either
 *   side bought (a union) and the haggle made on either (`mergeCaravan`).
 * - The seasonal stalls: the later day's purchases; on the same day, the most
 *   of each good either side bought (`mergeStall`), so the daily stock holds.
 * - The Desafio do dia attempt: the later day (`base`'s on the same day).
 */
export const mergeSaves = (base: Save, incoming: Save): Save => {
  const ranks: Ranks = Object.fromEntries(UPGRADE_IDS.map((id) => [id, Math.max(base.ranks[id], incoming.ranks[id])])) as Record<UpgradeId, number>
  const spent = Math.max(base.spent, incoming.spent)
  const shop = mergeShop(base.shop, incoming.shop)
  const incubator = mergeIncubator(base.incubator, incoming.incubator)
  return {
    version: SAVE_VERSION,
    wallet: Math.max(0, Math.max(worth(base), worth(incoming)) - totalSpent(ranks) - shopInvested(shop.level) - slotsInvested(incubator.slots) - spent),
    ranks,
    dex: mergeDex(base.dex, incoming.dex),
    eggs: mergeEggs(base.eggs, incoming.eggs, incubatorSlots({ incubator })),
    incubator,
    hatched: mergeHatched(base.hatched, incoming.hatched),
    missions: mergeMissions(base.missions, incoming.missions),
    achievements: mergeAchievements(base.achievements, incoming.achievements),
    title: incoming.title ?? base.title,
    difficulty: incoming.difficulty,
    partner: incoming.partner,
    shinyStarters: mergeShinyStarters(base.shinyStarters, incoming.shinyStarters),
    bag: mergeBag(base.bag, incoming.bag),
    shop,
    style: mergeStyle(base.style, incoming.style),
    spent,
    titles: mergeGiftTitles(base.titles, incoming.titles),
    gifts: mergeClaimedGifts(base.gifts, incoming.gifts),
    ribbons: mergeRibbons(base.ribbons, incoming.ribbons),
    shinyPicks: mergeShinyPicks(base.shinyPicks, incoming.shinyPicks),
    companion: incoming.companion ?? base.companion,
    companions: mergeCompanions(base.companions, incoming.companions),
    branches: { ...base.branches, ...incoming.branches },
    clears: mergeClears(base.clears, incoming.clears),
    halloween: mergeHalloween(base.halloween, incoming.halloween),
    legends: mergeCaptures(base.legends, incoming.legends),
    tms: mergeTms(base.tms, incoming.tms),
    evo: mergeEvoItems(base.evo, incoming.evo),
    caps: mergeCaps(base.caps, incoming.caps),
    caravan: mergeCaravan(base.caravan, incoming.caravan),
    stall: mergeStall(base.stall, incoming.stall),
    attempt: mergeAttempts(base.attempt, incoming.attempt),
  }
}

/** A save as the account stores it. `revision` goes up by one with every push. */
export type Stored = { save: Save; revision: number }

/** What a device sends: its save and the revision it last got from the account (null if it never synced). */
export type Push = { save: Save; base: number | null }

/**
 * What a push stores. A device that pushes on top of the latest revision has
 * seen everything stored, so its save is the newer one and replaces it as is:
 * that keeps ₽ spent, eggs hatched and refunds. Anything else (a first sign
 * in, another device pushed in between) merges both with `mergeSaves`.
 *
 * `resetAt` is the revision a reset stored, when the account's save was wiped
 * (an edited save, see `server/README.md`). A device that hasn't seen it (its
 * `base` is older, or it never synced) would merge the wiped progress back, so
 * its push changes nothing and gets the stored save, as merged: the device
 * takes it over its own.
 */
export const applyPush = (stored: Stored | null, push: Push, resetAt: number | null = null): Stored & { merged: boolean } => {
  if (!stored) return { save: push.save, revision: 1, merged: false }
  if (resetAt !== null && (push.base === null || push.base < resetAt)) return { ...stored, merged: true }
  const merged = push.base !== stored.revision
  return { save: merged ? mergeSaves(stored.save, push.save) : push.save, revision: stored.revision + 1, merged }
}


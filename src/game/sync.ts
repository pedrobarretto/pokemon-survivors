import { mergeAchievements, mergeGiftTitles } from './achievements'
import { mergeRoamers, mergeRushBest } from './questSave'
import { mergeAttempts } from './attempt'
import { mergeClaimedGifts } from './gifts'
import { mergeClears } from './clears'
import { mergeHalloween } from './halloween'
import { mergeCaptures } from './capture'
import { LEGEND_IDS } from '../data/legends'
import { mergeMythicalPity } from './mythicalHunt'
import { mergeBag } from './bag'
import { mergeShop, shopInvested } from './shop'
import { mergeTms } from './tmShelf'
import { mergeCaps, mergeEvoItems } from './evoItems'
import { mergeCaravan } from './caravan'
import { mergeStyle } from './style'
import { mergeDex } from './dex'
import { incubatorSlots, mergeEggPity, mergeHatched, mergeIncubated } from './eggs'
import { mergeIncubator, slotsInvested } from './incubator'
import { SAVE_VERSION, totalSpent, UPGRADE_IDS, type Ranks, type Save, type UpgradeId } from './meta'
import { mergeMissions } from './missions'
import { mergeRibbons } from './ribbons'
import { mergeFinds, mergeResearch } from './seasonOneUnlocks'
import { mergePaths } from './legendPaths'
import { mergeShinyStarters } from './shinyStarters'
import { mergeShinyPicks } from './shinyPicks'
import { mergeCompanions } from './supporters'
import { mergeShadows } from './shadow'
import { mergeHideout } from './hideoutPass'

/**
 * Account sync rules, shared by the game and the API (`server/`): how two
 * saves become one, and what a push stores. Pure, so both sides agree.
 */

/**
 * Everything a save ever got in ₽: the wallet plus what its upgrades cost,
 * what it invested in the shop's level and the incubator's slots, and what it
 * spent on the Vitrine, on styles, on Quick Incubators and in the Festival da
 * Praça's fountain (`donateFrom`). Buying, investing, donating or refunding
 * doesn't change it.
 */
const worth = (s: Save) => s.wallet + totalSpent(s.ranks) + shopInvested(s.shop.level) + slotsInvested(s.incubator.slots) + s.spent

/**
 * Two saves of the same player in one (a guest save joining an account, or
 * two devices that played apart). Every rule keeps the larger side, so the
 * result never loses progress and merging it again with either save changes
 * nothing:
 *
 * - Collection: the Pokédex, hatched families and unlocked achievements are
 *   unions; the incubator and its waiting line keep the most eggs of each tier as one pool (`mergeIncubated`), up
 *   to the merged slots. Its upgrades: the most slots bought, and the Quick
 *   Incubators' got and used counters at the larger side (`mergeIncubator`).
 *   The egg pity: each kind's count at the larger side (`mergeEggPity`).
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
 * - The Noite das Bruxas candy jar: the fuller one (its rewards are gifts, kept above) and the larger
 *   spending at Duskull's stall; its Caça aos Fantasmas: a union.
 * - Legend captures: each legend's win count at the larger side (a shiny
 *   captured is a `shinyStarters` key, a union like the rest).
 * - The TM case: TMs owned and TMs runs taught are unions; the armed picks
 *   are `incoming`'s (`mergeTms`). Evolution items: a union. Bottle Caps:
 *   each Pokémon at the higher level (`mergeCaps`). What they cost is in `spent`.
 * - Meowth's caravan: the later weekend's; on the same weekend, what either
 *   side bought (a union) and the haggle made on either (`mergeCaravan`).
 * - The Desafio do dia attempt: the later day (`base`'s on the same day).
 * - Temporada 1's encounters: a union; its research: each chain at the side further along, the partners a union (`mergeResearch`).
 * - The Rocket Hideout's pass: the later day it was given and the later it was used, Giovanni's clears the higher (`mergeHideout`).
 * - Shadow Pokémon: a union; the side with the later purify or Shadow Serum (`rev`) decides purified and the gauge, else purified wins and the further gauge; `incoming`'s pick (`mergeShadows`).
 * - The legend paths: the Cube's Cells and Cores and Meltan's Hex Nuts at the larger side; Cosmog's research and the
 *   legends it grew into, unions, its run counts the side further along's; the Torre's trials a union (`mergePaths`).
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
    ...mergeIncubated(base, incoming, incubatorSlots({ incubator })),
    incubator,
    hatched: mergeHatched(base.hatched, incoming.hatched),
    eggPity: mergeEggPity(base.eggPity, incoming.eggPity),
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
    roamers: mergeRoamers(base.roamers, incoming.roamers),
    rush: mergeRushBest(base.rush, incoming.rush),
    mythicalPity: mergeMythicalPity(base.mythicalPity, incoming.mythicalPity),
    tms: mergeTms(base.tms, incoming.tms),
    evo: mergeEvoItems(base.evo, incoming.evo),
    caps: mergeCaps(base.caps, incoming.caps),
    caravan: mergeCaravan(base.caravan, incoming.caravan),
    attempt: mergeAttempts(base.attempt, incoming.attempt),
    // A build saved again on another device replaces this one's for its family.
    builds: { ...base.builds, ...incoming.builds },
    finds: mergeFinds(base.finds, incoming.finds),
    shinyFinds: mergeFinds(base.shinyFinds, incoming.shinyFinds),
    research: mergeResearch(base.research, incoming.research),
    shadows: mergeShadows(base.shadows, incoming.shadows),
    hideout: mergeHideout(base.hideout, incoming.hideout),
    paths: mergePaths(base.paths, incoming.paths),
  }
}

/**
 * A save as the account stores it. `revision` goes up by one with every push;
 * `build` is the newest game build that pushed it (`Push.build`), null until
 * a build that sends one does.
 */
export type Stored = { save: Save; revision: number; build: number | null }

/**
 * What a device sends: its save, the revision it last got from the account
 * (null if it never synced) and its build (`__GAME_BUILT__`, the build's commit
 * time in seconds; null from a game too old to send it).
 */
export type Push = { save: Save; base: number | null; build: number | null }

/**
 * A push body's `build` as the API takes it: a whole number of seconds no later
 * than a day past `now` (ms), else null, as from a game too old to send one. A
 * build from the future would mark every real build older and merge their pushes.
 */
export const pushBuild = (raw: unknown, now: number): number | null =>
  typeof raw === 'number' && Number.isSafeInteger(raw) && raw > 0 && raw <= now / 1000 + 86_400 ? raw : null

const missing = <T>(have: readonly T[], need: readonly T[]) => need.some((x) => !have.includes(x))

/**
 * A save behind `stored` on what only ever goes up: its lifetime runs, a
 * legend's captures, a legend path's progress (Cells, Cores, Hex Nuts, the
 * Torre's trials, Cosmog's research, the legends it grew into and, while it's
 * the same Cosmog, its runs). A device pushing it on top of the latest
 * revision lost its save (storage cleared or unreadable) but kept its account
 * link, or runs a build too old to read all of it (its parse dropped legends
 * and paths it doesn't know), so it hasn't seen what's stored.
 */
export const behind = (save: Save, stored: Save) => {
  const [p, q] = [save.paths, stored.paths]
  return (
    save.achievements.lifetime.runs < stored.achievements.lifetime.runs ||
    LEGEND_IDS.some((id) => (save.legends[id] ?? 0) < (stored.legends[id] ?? 0)) ||
    p.cells < q.cells ||
    p.cores < q.cores ||
    p.nuts < q.nuts ||
    missing(p.trials, q.trials) ||
    missing(p.cosmog.research, q.cosmog.research) ||
    missing(p.cosmog.raised, q.cosmog.raised) ||
    (p.cosmog.raised.length === q.cosmog.raised.length && p.cosmog.runs < q.cosmog.runs)
  )
}

/**
 * Whether a push comes from a build older than the one that last stored the
 * save, or from one too old to say (no `build`). Such a build can't read
 * everything a newer one stored, so its save may lack it and must be merged.
 */
export const olderBuild = (push: Push, stored: Stored) => stored.build !== null && (push.build === null || push.build < stored.build)

/**
 * What a push stores. A device that pushes on top of the latest revision has
 * seen everything stored, so its save is the newer one and replaces it as is:
 * that keeps ₽ spent, eggs hatched and refunds. Anything else (a first sign
 * in, another device pushed in between, a save `behind` the stored one, or a
 * push from an `olderBuild`, which would wipe what it can't read) merges both
 * with `mergeSaves`, run by the API's own (current) code, so nothing the old
 * build dropped is lost. The stored `build` is the newest that pushed.
 *
 * `resetAt` is the revision a reset stored, when the account's save was wiped
 * (an edited save, see `server/README.md`). A device that hasn't seen it (its
 * `base` is older, or it never synced) would merge the wiped progress back, so
 * its push changes nothing and gets the stored save, as merged: the device
 * takes it over its own.
 */
export const applyPush = (stored: Stored | null, push: Push, resetAt: number | null = null): Stored & { merged: boolean } => {
  if (!stored) return { save: push.save, revision: 1, build: push.build, merged: false }
  if (resetAt !== null && (push.base === null || push.base < resetAt)) return { ...stored, merged: true }
  const merged = push.base !== stored.revision || olderBuild(push, stored) || behind(push.save, stored.save)
  const build = stored.build === null ? push.build : push.build === null ? stored.build : Math.max(stored.build, push.build)
  return { save: merged ? mergeSaves(stored.save, push.save) : push.save, revision: stored.revision + 1, build, merged }
}


import { FESTIVAL, FESTIVALS, type Festival, type FestivalId, type PlazaStage } from '../data/festivals'
import { LEGEND_IDS, legendFestival, type LegendId } from '../data/legends'
import { addDays, isDayKey, type DayKey } from './day'
import type { Gift, GiftContent } from './gifts'
import type { Save } from './meta'
import { isRecord, wholeNumber } from './parse'
import { parseHandle } from './ranking'

/**
 * Festival da Praça rules (`data/festivals.ts`), shared by the game and the
 * API. The API keeps the donations and sums the pot (`GET /festival`); the
 * game turns the pot into Mystery Gifts for everyone, guests included, the
 * way it makes its own gifts (`game/gameGifts.ts`): no row per player in the
 * API's `gifts`. The API vouches for them on every push from the pot it sums
 * itself (`festivalGiftsVouched`), so an edited save can't give itself the
 * Lantern frame or the Mecenas title. Pure.
 */

/* ---------------- Calendar ---------------- */

/** A festival's last Brasília day. */
export const festivalEnd = (f: Festival): DayKey => addDays(f.start, f.days - 1)

/** The festival running on `day`, or null between festivals. */
export const festivalOn = (day: DayKey): Festival | null => FESTIVALS.find((f) => day >= f.start && day <= festivalEnd(f)) ?? null

/** The festival the plaza shows on `day`: the one running, else the last one that ran (its plaque stays). Null before the first. */
export const latestFestival = (day: DayKey): Festival | null => FESTIVALS.filter((f) => f.start <= day).at(-1) ?? null

/** The next festival to open after `day`, or null when none is planned. */
export const nextFestival = (day: DayKey): Festival | null => FESTIVALS.find((f) => f.start > day) ?? null

/** The festival the shop points to on `day`: the one running, else the next one if it opens within `FESTIVAL.announceDays`. */
export const festivalAnnounced = (day: DayKey): Festival | null => {
  const next = nextFestival(day)
  return festivalOn(day) ?? (next && day >= addDays(next.start, -FESTIVAL.announceDays) ? next : null)
}

/** Whether `f`'s milestone gifts can still be opened on `day`: from its start until `FESTIVAL.claimDays` after its last day. */
export const claimOpen = (f: Festival, day: DayKey) => day >= f.start && day <= addDays(festivalEnd(f), FESTIVAL.claimDays)

export const festivalById = (id: string): Festival | null => FESTIVALS.find((f) => f.id === id) ?? null

/* ---------------- Its legend ---------------- */

/**
 * Whether the game shows legend `id` on Brasília `day` (the partner select,
 * the boards, the staff bot): a festival legend is a surprise until its
 * festival is announced (`FESTIVAL.announceDays` before it opens), then stays.
 * Every other legend always shows. It only hides: the rules know it all along.
 */
export const legendShown = (id: LegendId, day: DayKey) => {
  const f = festivalById(legendFestival(id) ?? '')
  return !f || day >= addDays(f.start, -FESTIVAL.announceDays)
}

/** The legends the game shows on `day` (`legendShown`), in `LEGEND_IDS` order. */
export const shownLegends = (day: DayKey): readonly LegendId[] => LEGEND_IDS.filter((id) => legendShown(id, day))

/* ---------------- The pot ---------------- */

/** How many of `f`'s milestones a pot of `pot` ₽ reached. */
export const reachedMilestones = (f: Festival, pot: number) => f.milestones.filter((m) => pot >= m.pot).length

/** The plaza stage for a pot (`PlazaStage`): the highest stage of the milestones it reached, 0 without a festival or before the first. */
export const plazaStage = (f: Festival | null, pot: number): PlazaStage =>
  f ? f.milestones.reduce<PlazaStage>((stage, m) => (pot >= m.pot && m.stage > stage ? m.stage : stage), 0) : 0

/** The next milestone a pot works toward, or null once every one is reached. */
export const nextMilestone = (f: Festival, pot: number) => f.milestones.find((m) => pot < m.pot) ?? null

/* ---------------- Gifts ---------------- */

/** A milestone's gift id (`festival:lanternas:0`…), or the Mecenas title's (`festival:lanternas:patron`). */
export const festivalGiftId = (id: FestivalId, which: number | 'patron') => `festival:${id}:${which}`

/** Whether a gift id is a festival's, made by the game rather than listed by the API. */
export const isFestivalGift = (id: string) => id.startsWith('festival:')

/** The Mecenas title. */
const PATRON_GIFT = { kind: 'title', title: 'patron' } as const satisfies GiftContent

/** Every gift `f` gives with a pot of `pot` and `given` ₽ (counted) from the player: the milestones reached, and the Mecenas title. */
const earned = (f: Festival, pot: number, given: number): Gift[] => [
  ...f.milestones.flatMap((m, i) => (pot >= m.pot ? [{ id: festivalGiftId(f.id, i), content: m.reward, reason: { kind: 'festival', festival: f.id, pot: m.pot } } satisfies Gift] : [])),
  ...(given >= FESTIVAL.patron ? [{ id: festivalGiftId(f.id, 'patron'), content: PATRON_GIFT, reason: { kind: 'patron', festival: f.id } } satisfies Gift] : []),
]

/** The pot of each festival and what one player gave to each (counted donations only), as the API sums them. */
export type FestivalTotals = { pots: Partial<Record<FestivalId, number>>; given: Partial<Record<FestivalId, number>> }

/** The festival gifts waiting to be opened on `day`: those of the festivals whose claim window is open (`claimOpen`) that the save didn't apply yet. */
export const festivalGifts = (save: Save, totals: FestivalTotals, day: DayKey): Gift[] =>
  FESTIVALS.filter((f) => claimOpen(f, day))
    .flatMap((f) => earned(f, totals.pots[f.id] ?? 0, totals.given[f.id] ?? 0))
    .filter((g) => !save.gifts.includes(g.id))

/**
 * The festival gifts the save applied that the API's sums back, as
 * `keepGiven` takes them (any festival, claim window or not: a frame once
 * opened stays). Run on every push with the totals the API summed itself.
 */
export const festivalGiftsVouched = (save: Save, totals: FestivalTotals): Pick<Gift, 'id' | 'content'>[] => {
  const vouched = new Map(FESTIVALS.flatMap((f) => earned(f, totals.pots[f.id] ?? 0, totals.given[f.id] ?? 0)).map((g) => [g.id, g.content]))
  return save.gifts.flatMap((id) => {
    const content = vouched.get(id)
    return content ? [{ id, content }] : []
  })
}

/* ---------------- Donating ---------------- */

/** ₽ the player may still put in the fountain today, having put `today` already. */
export const capLeft = (today: number) => Math.max(0, FESTIVAL.dailyCap - today)

/** A donation's amount from an untrusted body: whole ₽ from `FESTIVAL.minDonation` up to the daily cap, else null. */
export const parseDonationAmount = (v: unknown): number | null =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= FESTIVAL.minDonation && v <= FESTIVAL.dailyCap ? v : null

/**
 * Why a donation can't go, or null when it can: `closed` outside a festival
 * (`festival` is the one running, `festivalOn`),
 * `profile` without a @handle, `runs` before `FESTIVAL.minRuns` verified runs,
 * `cap` past the day's cap, `funds` when the stored wallet can't cover it.
 */
export type DonationRefusal = 'closed' | 'profile' | 'runs' | 'cap' | 'funds'

export const donationRefusal = (d: { festival: Festival | null; amount: number; handle: string | null; runs: number; today: number; wallet: number }): DonationRefusal | null => {
  if (!d.festival) return 'closed'
  if (!d.handle) return 'profile'
  if (d.runs < FESTIVAL.minRuns) return 'runs'
  if (d.amount > capLeft(d.today)) return 'cap'
  if (d.amount > d.wallet) return 'funds'
  return null
}

/** Whether a donation from a save with `wallet` ₽ waits for an admin before counting in the pot. */
export const isHeld = (wallet: number) => wallet > FESTIVAL.heldWallet

/**
 * The save after donating `amount`: out of the wallet and into `spent`, so
 * `mergeSaves` counts it as spent and a merge never brings it back.
 */
export const donateFrom = (save: Save, amount: number): Save => ({ ...save, wallet: save.wallet - amount, spent: save.spent + amount })

/* ---------------- What the API answers ---------------- */

/** A donor on the plaque, by @handle, with what they gave to the festival (counted donations only). */
export type FestivalDonor = { handle: string; amount: number }

/**
 * The signed-in player's donations: `today` counts toward the daily cap
 * (held ones too), `given` per festival counts in the pot (for the Mecenas
 * title), `held` waits for an admin, `public` puts their name on the plaque,
 * and `rank` is their place among the shown festival's donors (hidden names
 * too; null before they gave to it).
 */
export type FestivalMine = { today: number; given: Partial<Record<FestivalId, number>>; held: number; public: boolean; rank: number | null }

/**
 * `GET /festival`: the API's Brasília `day`, the `festival` the plaza shows
 * (`latestFestival`; null before the first), every festival's pot, that
 * festival's top donors and how many gave, and the asker's own (`me`, null for guests).
 */
export type FestivalStatus = { day: DayKey; festival: FestivalId | null; pots: Partial<Record<FestivalId, number>>; top: FestivalDonor[]; donors: number; me: FestivalMine | null }

/** A record of ₽ per festival id, known ids only. */
const parseTotals = (v: unknown): Partial<Record<FestivalId, number>> =>
  isRecord(v) ? Object.fromEntries(FESTIVALS.flatMap((f) => (typeof v[f.id] === 'number' ? [[f.id, wholeNumber(v[f.id])]] : []))) : {}

const parseDonor = (v: unknown): FestivalDonor | null => {
  const handle = isRecord(v) ? parseHandle(v.handle) : null
  return isRecord(v) && handle ? { handle, amount: wholeNumber(v.amount) } : null
}

const parseMine = (v: unknown): FestivalMine | null =>
  isRecord(v)
    ? { today: wholeNumber(v.today), given: parseTotals(v.given), held: wholeNumber(v.held), public: v.public !== false, rank: typeof v.rank === 'number' && v.rank >= 1 ? wholeNumber(v.rank) : null }
    : null

/** `GET /festival`'s answer, or null when it isn't one. */
export const parseFestivalStatus = (v: unknown): FestivalStatus | null => {
  if (!isRecord(v) || !isDayKey(v.day)) return null
  return {
    day: v.day,
    festival: festivalById(typeof v.festival === 'string' ? v.festival : '')?.id ?? null,
    pots: parseTotals(v.pots),
    top: (Array.isArray(v.top) ? v.top : []).flatMap((d: unknown) => parseDonor(d) ?? []).slice(0, FESTIVAL.top),
    donors: wholeNumber(v.donors),
    me: parseMine(v.me),
  }
}

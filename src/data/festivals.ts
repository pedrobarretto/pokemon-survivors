import type { DayKey } from '../game/day'
import type { GiftContent } from '../game/gifts'

/**
 * Festival da Praça: a community ₽ pot at the fountain on the Kecleon plaza.
 * Each festival is an entry here (roughly one a month): its Brasília days,
 * and the milestones its pot pays everyone as Mystery Gifts (guests too),
 * with the plaza stage each one unlocks. The pot is per festival, so the next
 * one starts from zero. No milestone ever pays ₽ (that would put the money
 * back in circulation). The rules live in `game/festival.ts`, the pot and the
 * donations in the API (`server/src/festival.ts`); names in `i18n`
 * (`festival.names`).
 */

/**
 * How the plaza looks for a pot (`render/plaza.ts`): 0 the opening (the
 * fountain, lantern arms on the lamps, the bare wishing tree, the unlit gate,
 * Lanturn's Lantern Market), 1 wish tags, garlands and the bunting, 2 lanterns
 * on the tree and the gate and lantern strings across the square, 3 the dusk,
 * the golden Kecleon, the Togepi float, Volbeat, Illumise and sky lanterns,
 * 4 the float turns shiny under more sky lanterns.
 */
export type PlazaStage = 0 | 1 | 2 | 3 | 4

/** A milestone: the pot that reaches it, the gift everyone gets and the plaza stage it unlocks. */
type Milestone = { pot: number; reward: GiftContent; stage: PlazaStage }

/** A festival: opens at the start of Brasília day `start` and lasts `days` days. Milestones go up in `pot`. */
type FestivalDef = { id: string; start: DayKey; days: number; milestones: readonly Milestone[] }

export const FESTIVALS = [
  {
    // Right after the Noite das Bruxas ends (11-02).
    id: 'lanternas',
    start: '2026-11-03',
    days: 14,
    milestones: [
      { pot: 10_000_000, reward: { kind: 'egg', tier: 'rare' }, stage: 1 },
      { pot: 30_000_000, reward: { kind: 'style', style: { slot: 'frame', id: 'lantern' } }, stage: 2 },
      { pot: 60_000_000, reward: { kind: 'bag', item: 'lure', count: 3 }, stage: 2 },
      { pot: 100_000_000, reward: { kind: 'egg', tier: 'kecleon' }, stage: 3 },
      // The stretch goal.
      { pot: 150_000_000, reward: { kind: 'shinyHatch', family: 'togepi' }, stage: 4 },
    ],
  },
] as const satisfies readonly FestivalDef[]

export type Festival = (typeof FESTIVALS)[number]

export type FestivalId = Festival['id']

/** The rules every festival shares. */
export const FESTIVAL = {
  /** Most ₽ one account may put in the fountain per Brasília day, so no whale decides alone. */
  dailyCap: 200_000,
  /** Fewest ₽ one donation may be. */
  minDonation: 100,
  /** ₽ donated (counted) within one festival that make the player a Mecenas (the `patron` title). */
  patron: 50_000,
  /** Days after a festival's last day its milestone gifts can still be opened. */
  claimDays: 7,
  /** Verified runs an account needs before it may donate (as an invite needs to count, `REFERRAL.runs`). */
  minRuns: 3,
  /** A save whose wallet is above this donates `held`: it counts in the pot only once an admin approves it. */
  heldWallet: 20_000_000,
  /** Donors on the plaque. */
  top: 10,
  /** Days before a festival opens that the shop already shows it (its sheet counts down). */
  announceDays: 7,
} as const

import { INCUBATOR } from '../data/shop'
import { isReady } from './eggs'
import type { Save } from './meta'
import { isRecord, wholeNumber } from './parse'

/**
 * The incubator's upgrades (`INCUBATOR` in `data/shop.ts`), sold on the
 * shop's Incubadora shelf. Extra slots are owned for good: like the shop's
 * levels, they're paid into the upgrade itself, which the sync counts in the
 * fortune (`slotsInvested`, `game/sync.ts`) and nothing refunds. The Quick
 * Incubator is a consumable bought into `spent`, like the Vitrine's: the
 * incubator screen puts one on an egg, which then walks twice as fast until
 * it hatches (`walk` in `game/eggs.ts`). Meta, not simulation. Pure.
 */

/**
 * The save's side: the extra slots bought (0 to `INCUBATOR.slots.length`) and
 * the Quick Incubators ever bought and ever used (what's left is the
 * difference; two counters so two devices merge without bringing a used one back, like the Bag).
 */
export type IncubatorSave = { slots: number; quick: { got: number; used: number } }

export const NO_INCUBATOR: IncubatorSave = { slots: 0, quick: { got: 0, used: 0 } }

/* ---------------- Extra slots ---------------- */

/** ₽ paid for the first `slots` extra slots: what the sync counts in the fortune. */
export const slotsInvested = (slots: number) => INCUBATOR.slots.slice(0, slots).reduce((sum, s) => sum + s.price, 0)

/** The next extra slot a save can buy (its price and shop level), or null with every one bought. */
export const nextSlot = (save: Save) => INCUBATOR.slots[save.incubator.slots] ?? null

export type SlotBlock = 'max' | 'level' | 'poor'

/** Why the next slot can't be bought: every one is, the shop's level is below its, or not enough ₽. */
export const slotBlock = (save: Save): SlotBlock | null => {
  const next = nextSlot(save)
  if (!next) return 'max'
  if (save.shop.level < next.minLevel) return 'level'
  return save.wallet < next.price ? 'poor' : null
}

/** Buys the next slot, for good (paid into the slot, not `spent`). Null when blocked (`slotBlock`). */
export const buySlot = (save: Save): Save | null => {
  const next = nextSlot(save)
  if (!next || slotBlock(save)) return null
  return { ...save, wallet: save.wallet - next.price, incubator: { ...save.incubator, slots: save.incubator.slots + 1 } }
}

/* ---------------- The Quick Incubator ---------------- */

/** Quick Incubators a save has left. */
export const quickCount = (inc: IncubatorSave) => Math.max(0, inc.quick.got - inc.quick.used)

/** Buys a Quick Incubator (₽ into `spent`); null without the ₽. No daily stock: it's a sink. */
export const buyQuick = (save: Save): Save | null => {
  const { price } = INCUBATOR.quick
  if (save.wallet < price) return null
  const { quick } = save.incubator
  return { ...save, wallet: save.wallet - price, spent: save.spent + price, incubator: { ...save.incubator, quick: { ...quick, got: quick.got + 1 } } }
}

export type QuickBlock = 'empty' | 'ready' | 'quick' | 'none'

/** Why the egg at `index` can't take a Quick Incubator: no egg there, it's ready already, it has one, or none left to use. */
export const quickBlock = (save: Save, index: number): QuickBlock | null => {
  const egg = save.eggs[index]
  if (!egg) return 'empty'
  if (isReady(egg)) return 'ready'
  if (egg.quick) return 'quick'
  return quickCount(save.incubator) === 0 ? 'none' : null
}

/** Puts a Quick Incubator on the egg at `index`, using one up. Null when blocked (`quickBlock`). */
export const useQuick = (save: Save, index: number): Save | null => {
  if (quickBlock(save, index)) return null
  const { quick } = save.incubator
  return {
    ...save,
    eggs: save.eggs.map((e, i) => (i === index ? { ...e, quick: true } : e)),
    incubator: { ...save.incubator, quick: { ...quick, used: quick.used + 1 } },
  }
}

/* ---------------- Sync and parsing ---------------- */

/** Two incubators' upgrades: the most slots bought, and each Quick Incubator counter at the larger side (one used on either side stays used). */
export const mergeIncubator = (base: IncubatorSave, incoming: IncubatorSave): IncubatorSave => ({
  slots: Math.max(base.slots, incoming.slots),
  quick: { got: Math.max(base.quick.got, incoming.quick.got), used: Math.max(base.quick.used, incoming.quick.used) },
})

/** The save's `incubator`: slots clamped to the ones sold, counters to whole numbers (never more used than got). */
export const parseIncubator = (raw: unknown): IncubatorSave => {
  if (!isRecord(raw)) return NO_INCUBATOR
  const quick = isRecord(raw.quick) ? raw.quick : {}
  const got = wholeNumber(quick.got, 100_000)
  return { slots: wholeNumber(raw.slots, INCUBATOR.slots.length), quick: { got, used: wholeNumber(quick.used, got) } }
}

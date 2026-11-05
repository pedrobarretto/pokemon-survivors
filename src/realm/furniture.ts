import { type FurnitureCounts, type FurnitureId } from '../data/furniture'
import { LEGENDS } from '../data/legends'
import { fetchGems } from '../gems'
import { t } from '../i18n'
import { buyFurniture, buyWithCoins, isFailure } from './api'
import { dollLegend } from './placement'

/**
 * The secret bases' furniture on the device: a piece's name, and buying one
 * at the carpentry (`ui/carpentry.ts`). Where pieces go is `placement.ts`.
 */

/** A piece's name in the player's language (a doll's is its legend's). */
export const pieceName = (id: FurnitureId): string => {
  const legend = dollLegend(id)
  if (legend) return t().furniture.doll(LEGENDS[legend].name)
  const names: Readonly<Record<string, string>> = t().furniture.names
  return names[id] ?? id
}

/** What a purchase came to: the account's new counts, or why not (`gems`, `funds`, `guest`, `nosave`, `stale`, `offline`, the API's word). */
export type PieceBought = { ok: true; furniture: FurnitureCounts } | { ok: false; error: string }

/**
 * Buys one piece at the carpentry: with gems (the gem ledger; the balance is
 * asked again after), or with ₽ out of the account's stored save
 * (`buyWithCoins`, like a festival donation: the save the API answers with,
 * ₽ moved to `spent`, becomes the device's). Never throws.
 */
export const buyPiece = async (id: FurnitureId, pay: 'gems' | 'coins'): Promise<PieceBought> => {
  try {
    if (pay === 'gems') {
      const done = await buyFurniture({ id, pay: 'gems' })
      if (isFailure(done)) return { ok: false, error: done.error }
      void fetchGems()
      return { ok: true, furniture: done.furniture }
    }
    const done = await buyWithCoins(id)
    return isFailure(done) ? { ok: false, error: done.error } : { ok: true, furniture: done.furniture }
  } catch (err) {
    console.warn('furniture purchase failed', err)
    return { ok: false, error: 'offline' }
  }
}

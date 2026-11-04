import { payFromSave } from '../account'
import { FURNITURE, type FurnitureCounts, type FurnitureId } from '../data/furniture'
import { LEGENDS } from '../data/legends'
import { donateFrom } from '../game/festival'
import { fetchGems } from '../gems'
import { t } from '../i18n'
import { buyFurniture, isFailure, realmFaked } from './api'
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
 * (`payFromSave`, like a festival donation: the save the API answers with,
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
    // Faking the realm, nothing real is spent.
    if (realmFaked()) {
      const done = await buyFurniture({ id, pay: 'coins', base: 0 })
      return isFailure(done) ? { ok: false, error: done.error } : { ok: true, furniture: done.furniture }
    }
    const price = FURNITURE[id].price
    const coins = price !== null && 'coins' in price ? price.coins : 0
    const paid = await payFromSave<FurnitureCounts>(
      async (base) => {
        const done = await buyFurniture({ id, pay: 'coins', base })
        if (isFailure(done)) return { ok: false, error: done.error }
        return done.pay === 'coins' ? { ok: true, save: done.save, revision: done.revision, value: done.furniture } : { ok: false, error: 'offline' }
      },
      (save) => donateFrom(save, coins),
    )
    return paid.ok ? { ok: true, furniture: paid.value } : paid
  } catch (err) {
    console.warn('furniture purchase failed', err)
    return { ok: false, error: 'offline' }
  }
}

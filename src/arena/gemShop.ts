import { ARENA_COSMETICS, COSMETIC_IDS, COSMETIC_SLOTS, cosmeticPrice, slotOf, type ArenaLook, type CosmeticBase, type CosmeticId, type CosmeticSlot, type Rarity } from '../data/arenaCosmetics'
import type { GemCurrency, GemMethod } from '../data/gems'
import type { DayKey } from '../game/day'

/**
 * The Arena shop's rules, DOM-free (`ui/gemShop.ts` draws them, `gems.ts`
 * talks to the API): which currency a buyer sees, how each method pays,
 * what the shop shows today and how a look changes as items go on and off.
 */

/** Brazil's IANA time zones: a buyer there pays in reais even with the game in another language. */
const BRAZIL_ZONES = new Set([
  'America/Sao_Paulo',
  'America/Araguaina',
  'America/Bahia',
  'America/Belem',
  'America/Boa_Vista',
  'America/Campo_Grande',
  'America/Cuiaba',
  'America/Eirunepe',
  'America/Fortaleza',
  'America/Maceio',
  'America/Manaus',
  'America/Noronha',
  'America/Porto_Velho',
  'America/Recife',
  'America/Rio_Branco',
  'America/Santarem',
])

/** The currency a buyer sees first: reais in Brazilian Portuguese or a Brazilian time zone, dollars elsewhere. */
export const currencyFor = (tag: string, timeZone: string | undefined): GemCurrency => (tag === 'pt-BR' || (timeZone !== undefined && BRAZIL_ZONES.has(timeZone)) ? 'brl' : 'usd')

/** How a pack can be paid in `currency`: card always (Apple Pay and Google Pay ride on it), Pix only in reais. */
export const methodsFor = (currency: GemCurrency): readonly GemMethod[] => (currency === 'brl' ? ['card', 'pix'] : ['card'])

/** A price in cents as the buyer's language writes it (`R$ 24,90`, `$4.99`). */
export const priceText = (cents: number, currency: GemCurrency, tag: string) => new Intl.NumberFormat(tag, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)

/** Rarities from the plainest up, the order the shop lists them in. */
export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const satisfies readonly Rarity[]

export const rarityOf = (id: CosmeticId): Rarity => ARENA_COSMETICS[id].rarity

const fromOf = (id: CosmeticId): DayKey | undefined => {
  const { from }: CosmeticBase = ARENA_COSMETICS[id]
  return from
}

/**
 * What the shop shows on `day` (Brasília), by slot: the items on sale (a
 * price) that are out by then (`from`), plainest first, plus anything the
 * player owns already (a gift, an item off sale), so it still shows as
 * theirs. Slots with nothing are left out.
 */
export const shopCatalog = (day: DayKey, owned: ReadonlySet<CosmeticId> = new Set()) => {
  const shown = COSMETIC_IDS.filter((id) => owned.has(id) || (cosmeticPrice(id) !== null && (fromOf(id) ?? '') <= day))
  const rank = (id: CosmeticId) => RARITIES.indexOf(rarityOf(id))
  return COSMETIC_SLOTS.flatMap((slot) => {
    const items = shown.filter((id) => slotOf(id) === slot).sort((a, b) => rank(a) - rank(b) || (cosmeticPrice(a) ?? 0) - (cosmeticPrice(b) ?? 0))
    return items.length > 0 ? [{ slot, items }] : []
  })
}

/** `look` with `id` on, in its own slot (replacing what was there). */
export const equip = (look: ArenaLook, id: CosmeticId): ArenaLook => ({ ...look, [slotOf(id)]: id })

/** `look` with `slot` empty. */
export const unequip = (look: ArenaLook, slot: CosmeticSlot): ArenaLook => {
  const { [slot]: _off, ...rest } = look
  return rest
}

/** `look` keeping only what the player owns (as the API's `PUT /gems/look` does). */
export const ownedOnly = (look: ArenaLook, owned: ReadonlySet<CosmeticId>): ArenaLook => {
  const out: ArenaLook = {}
  for (const slot of COSMETIC_SLOTS) {
    const id = look[slot]
    if (id !== undefined && owned.has(id)) out[slot] = id
  }
  return out
}

/** Whether two looks wear the same items. */
export const sameLook = (a: ArenaLook, b: ArenaLook) => COSMETIC_SLOTS.every((slot) => a[slot] === b[slot])

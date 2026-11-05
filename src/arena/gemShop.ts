import { COSMETICS, COSMETIC_IDS, COSMETIC_SLOTS, cosmeticPrice, showsIn, slotOf, withSkins, type Look, type CosmeticBase, type CosmeticId, type CosmeticSlot, type Rarity } from '../data/cosmetics'
import { PLAYABLE } from '../data/hatchlings'
import { isSkinId, lineOf, SKIN_IDS, SKIN_LINES, SKINS, type SkinId, type SkinLine } from '../data/skinCatalog'
import { GEM_PACK_IDS, GEM_PACKS, oncePack, packGems, type GemCurrency, type GemMethod, type GemPackId } from '../data/gems'
import { createRng, pick, seedFrom } from '../engine/rng'
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

/**
 * How a pack can be paid in `currency`, the first one offered first: in
 * reais Pix (almost never charged back, where a card's chargeback costs a fee
 * on top), then card; elsewhere card (Apple Pay and Google Pay ride on it).
 */
export const methodsFor = (currency: GemCurrency): readonly GemMethod[] => (currency === 'brl' ? ['pix', 'card'] : ['card'])

/** The packs the shop offers an account, in order: a `once` pack only while it isn't `taken`. */
export const shownPacks = (taken: readonly GemPackId[]): GemPackId[] => GEM_PACK_IDS.filter((id) => !oncePack(id) || !taken.includes(id))

/**
 * The pack that covers `missing` gems for the least money in `currency`
 * among the ones offered (`shownPacks`): the welcome pack while it's there,
 * else the smallest that's enough; the biggest when none is.
 */
export const packFor = (missing: number, taken: readonly GemPackId[], currency: GemCurrency): GemPackId => {
  const packs = shownPacks(taken).sort((a, b) => GEM_PACKS[a][currency] - GEM_PACKS[b][currency] || packGems(b) - packGems(a))
  return packs.find((id) => packGems(id) >= missing) ?? packs.reduce((a, b) => (packGems(b) > packGems(a) ? b : a))
}

/** A price in cents as the buyer's language writes it (`R$ 24,90`, `$4.99`). */
export const priceText = (cents: number, currency: GemCurrency, tag: string) => new Intl.NumberFormat(tag, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)

/** Rarities from the plainest up, the order the shop lists them in. */
export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const satisfies readonly Rarity[]

export const rarityOf = (id: CosmeticId): Rarity => COSMETICS[id].rarity

const fromOf = (id: CosmeticId): DayKey | undefined => {
  const { from }: CosmeticBase = COSMETICS[id]
  return from
}

/** Whether the shop shows `id` on `day`: on sale (a price) and out by then (`from`), or owned already. */
export const shownOn = (id: CosmeticId, day: DayKey, owned: ReadonlySet<CosmeticId>) => owned.has(id) || (cosmeticPrice(id) !== null && (fromOf(id) ?? '') <= day)

/**
 * What the shop shows on `day` (Brasília), by slot (skins have their own page, `ui/skinShop.ts`): the items on sale (a
 * price) that are out by then (`from`), plainest first, plus anything the
 * player owns already (a gift, an item off sale), so it still shows as
 * theirs. Slots with nothing are left out.
 */
export const shopCatalog = (day: DayKey, owned: ReadonlySet<CosmeticId> = new Set()) => {
  const shown = COSMETIC_IDS.filter((id) => shownOn(id, day, owned))
  const rank = (id: CosmeticId) => RARITIES.indexOf(rarityOf(id))
  return COSMETIC_SLOTS.flatMap((slot) => {
    const items = shown.filter((id) => slotOf(id) === slot).sort((a, b) => rank(a) - rank(b) || (cosmeticPrice(a) ?? 0) - (cosmeticPrice(b) ?? 0))
    return items.length > 0 ? [{ slot, items }] : []
  })
}

/**
 * The Boutique's Vitrine do dia on `day` (Brasília): a look (anything a run
 * shows but a skin) and a skin, drawn from the day alone, so everyone sees
 * the same pair until midnight and no server is asked. Only what's on sale
 * that day, and what `owned` lacks while there's any, so a player who owns
 * the day's draw sees the next one. Without a skin on sale, two looks of
 * different slots.
 */
export const dailyPicks = (day: DayKey, owned: ReadonlySet<CosmeticId> = new Set()): CosmeticId[] => {
  const onSale = COSMETIC_IDS.filter((id) => (cosmeticPrice(id) ?? 0) > 0 && shownOn(id, day, new Set()) && showsIn(slotOf(id), 'run'))
  const rng = createRng(seedFrom(`vitrine:${day}`))
  const draw = (pool: readonly CosmeticId[]) => {
    const fresh = pool.filter((id) => !owned.has(id))
    const from = fresh.length > 0 ? fresh : pool
    return from.length > 0 ? pick(rng, from) : null
  }
  const look = draw(onSale.filter((id) => !isSkinId(id)))
  const skin = draw(onSale.filter(isSkinId)) ?? draw(onSale.filter((id) => !isSkinId(id) && look !== null && slotOf(id) !== slotOf(look)))
  return [look, skin].filter((id): id is CosmeticId => id !== null)
}

/**
 * The catalog (`shopCatalog`) split where its items show: `main`, the slots
 * that show in every mode, and `arena`, the ones only the Arena shows
 * (`SLOT_MODES`), which the shop keeps in their own section.
 */
export const catalogSections = <G extends { slot: CosmeticSlot }>(catalog: readonly G[]) => ({
  main: catalog.filter((g) => showsIn(g.slot, 'run')),
  arena: catalog.filter((g) => !showsIn(g.slot, 'run')),
})

/** `look` with `id` on, in its own slot (replacing what was there); a skin in place of its line's. */
export const equip = (look: Look, id: CosmeticId): Look => {
  if (isSkinId(id)) return withSkins(look, [...(look.skins ?? []).filter((s) => lineOf(s) !== lineOf(id)), id])
  const slot = slotOf(id)
  return slot === 'skin' ? look : { ...look, [slot]: id }
}

/** `look` with `slot` empty, or without a skin on `line`. */
export const unequip = (look: Look, slot: CosmeticSlot | { line: SkinLine }): Look => {
  if (typeof slot === 'object') return withSkins(look, (look.skins ?? []).filter((s) => lineOf(s) !== slot.line))
  const { [slot]: _off, ...rest } = look
  return rest
}

/** `look` without `id`'s place filled: its slot, or its line's skin. */
export const takeOff = (look: Look, id: CosmeticId): Look => {
  if (isSkinId(id)) return unequip(look, { line: lineOf(id) })
  const slot = slotOf(id)
  return slot === 'skin' ? look : unequip(look, slot)
}

/** Whether `look` wears `id` (in its slot, or among its skins). */
export const wearing = (look: Look, id: CosmeticId) => {
  if (isSkinId(id)) return look.skins?.includes(id) === true
  const slot = slotOf(id)
  return slot !== 'skin' && look[slot] === id
}

/** `look` keeping only what the player owns (as the API's `PUT /gems/look` does). */
export const ownedOnly = (look: Look, owned: ReadonlySet<CosmeticId>): Look => {
  const out: Look = {}
  for (const slot of COSMETIC_SLOTS) {
    const id = look[slot]
    if (id !== undefined && owned.has(id)) out[slot] = id
  }
  return withSkins(out, (look.skins ?? []).filter((id) => owned.has(id)))
}

/** Whether two looks wear the same items. */
export const sameLook = (a: Look, b: Look) =>
  COSMETIC_SLOTS.every((slot) => a[slot] === b[slot]) && (a.skins ?? []).join() === (b.skins ?? []).join()

/** A skin line's stage `dex` by name (the line's own, in English); a dex the line lacks reads as its number. */
export const stageName = (line: SkinLine, dex: number) => PLAYABLE[line].line.find((st) => st.dex === dex)?.name ?? `#${dex}`

/** The skins of a line, in the catalog's order. */
export const skinsOf = (line: SkinLine) => SKIN_IDS.filter((id) => lineOf(id) === line)

/**
 * The lines the player owns skins of, as Visual lists them: the line, its
 * first covered stage (its name and portrait), the skins owned and the one
 * `look` wears on it (null: none).
 */
export const ownedSkinLines = (owned: ReadonlySet<CosmeticId>, look: Look) =>
  SKIN_LINES.flatMap((line) => {
    const mine = skinsOf(line).filter((id) => owned.has(id))
    if (mine.length === 0) return []
    const dex = SKINS[mine[0]!].dexes[0]!
    const on: SkinId | null = look.skins?.find((id) => lineOf(id) === line) ?? null
    return [{ line, dex, name: stageName(line, dex), mine, on }]
  })

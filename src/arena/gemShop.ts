import { COSMETICS, COSMETIC_IDS, COSMETIC_SLOTS, cosmeticPrice, showsIn, slotOf, withSkins, type Look, type CosmeticBase, type CosmeticId, type CosmeticSlot, type Rarity } from '../data/cosmetics'
import { PLAYABLE } from '../data/hatchlings'
import { isSkinId, lineOf, SKIN_IDS, SKIN_LINES, SKINS, type SkinId, type SkinLine } from '../data/skinCatalog'
import { GEM_FX, GEM_PACK_IDS, oncePack, packGems, packGemsOn, packPrice, type GemMarket, type GemPackId, type ShownCurrency } from '../data/gems'
import { createRng, pick, seedFrom } from '../engine/rng'
import type { DayKey } from '../game/day'
import { onSale } from '../game/gems'

/**
 * The Arena shop's rules, DOM-free (`ui/gemShop.ts` draws them, `gems.ts`
 * talks to the API): which price a buyer pays and in what currency the shop
 * guesses it, what the shop shows today and how a look changes as items go on and off.
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

/** Which price a buyer gets first: Brazil's in Brazilian Portuguese or a Brazilian time zone, everyone else's elsewhere (the shop lets them switch). */
export const marketFor = (tag: string, timeZone: string | undefined): GemMarket => (tag === 'pt-BR' || (timeZone !== undefined && BRAZIL_ZONES.has(timeZone)) ? 'br' : 'intl')

/**
 * Where each currency the shop guesses in (`GEM_FX`) is used: IANA time
 * zones (`Australia/` a prefix for the whole country) and the regions a
 * language tag names (`es-MX`). Dollars are the fallback, so the US needs none.
 */
const CURRENCY_PLACES: Record<Exclude<ShownCurrency, 'usd'>, { zones: readonly string[]; regions: readonly string[] }> = {
  eur: {
    zones: [
      ...['Amsterdam', 'Andorra', 'Athens', 'Berlin', 'Bratislava', 'Brussels', 'Busingen', 'Dublin', 'Helsinki', 'Lisbon', 'Ljubljana', 'Luxembourg', 'Madrid', 'Malta', 'Mariehamn', 'Monaco', 'Paris', 'Podgorica', 'Riga', 'Rome', 'San_Marino', 'Sofia', 'Tallinn', 'Vatican', 'Vienna', 'Vilnius', 'Zagreb'].map((c) => `Europe/${c}`),
      'Atlantic/Azores',
      'Atlantic/Canary',
      'Atlantic/Madeira',
      'Africa/Ceuta',
    ],
    regions: ['AT', 'BE', 'BG', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK'],
  },
  gbp: { zones: ['Europe/London', 'Europe/Belfast', 'Europe/Guernsey', 'Europe/Isle_of_Man', 'Europe/Jersey'], regions: ['GB'] },
  chf: { zones: ['Europe/Zurich', 'Europe/Vaduz'], regions: ['CH', 'LI'] },
  twd: { zones: ['Asia/Taipei'], regions: ['TW'] },
  hkd: { zones: ['Asia/Hong_Kong', 'Asia/Macau'], regions: ['HK', 'MO'] },
  cny: { zones: ['Asia/Shanghai', 'Asia/Chongqing', 'Asia/Harbin', 'Asia/Urumqi'], regions: ['CN'] },
  sgd: { zones: ['Asia/Singapore'], regions: ['SG'] },
  myr: { zones: ['Asia/Kuala_Lumpur', 'Asia/Kuching'], regions: ['MY'] },
  mxn: {
    zones: ['Mexico_City', 'Cancun', 'Merida', 'Monterrey', 'Matamoros', 'Chihuahua', 'Ciudad_Juarez', 'Ojinaga', 'Mazatlan', 'Bahia_Banderas', 'Hermosillo', 'Tijuana'].map((c) => `America/${c}`),
    regions: ['MX'],
  },
  cad: {
    zones: ['Toronto', 'Montreal', 'Vancouver', 'Edmonton', 'Winnipeg', 'Regina', 'Swift_Current', 'Halifax', 'Moncton', 'Glace_Bay', 'Goose_Bay', 'St_Johns', 'Whitehorse', 'Dawson', 'Dawson_Creek', 'Fort_Nelson', 'Creston', 'Iqaluit', 'Rankin_Inlet', 'Resolute', 'Cambridge_Bay', 'Inuvik', 'Atikokan'].map((c) => `America/${c}`),
    regions: ['CA'],
  },
  aud: { zones: ['Australia/'], regions: ['AU'] },
  clp: { zones: ['America/Santiago', 'America/Punta_Arenas', 'Pacific/Easter'], regions: ['CL'] },
  cop: { zones: ['America/Bogota'], regions: ['CO'] },
  pen: { zones: ['America/Lima'], regions: ['PE'] },
}

const PLACES = Object.entries(CURRENCY_PLACES) as [Exclude<ShownCurrency, 'usd'>, { zones: readonly string[]; regions: readonly string[] }][]

/** The region a language tag names (`zh-Hant-TW` → `TW`), or null. */
const regionOf = (tag: string) => /-([A-Z]{2})(?:-|$)/.exec(tag)?.[1] ?? null

/**
 * The currency the shop guesses prices abroad in (`approxText`): the
 * device's time zone's, else the first of its languages' regions it knows,
 * else dollars. Only a guess: Stripe charges in the buyer's own currency
 * from where they pay, whatever this says.
 */
export const shownCurrency = (tags: readonly string[], timeZone: string | undefined): ShownCurrency => {
  const zone = timeZone ?? ''
  const byZone = PLACES.find(([, p]) => p.zones.some((z) => (z.endsWith('/') ? zone.startsWith(z) : zone === z)))
  if (byZone) return byZone[0]
  for (const tag of tags) {
    const region = regionOf(tag)
    const byRegion = region === null ? undefined : PLACES.find(([, p]) => p.regions.includes(region))
    if (byRegion) return byRegion[0]
  }
  return 'usd'
}

/** The packs the shop offers an account, in order: a `once` pack only while it isn't `taken`. */
export const shownPacks = (taken: readonly GemPackId[]): GemPackId[] => GEM_PACK_IDS.filter((id) => !oncePack(id) || !taken.includes(id))

/**
 * The pack that covers `missing` gems for the least money in `market` among
 * the ones offered (`shownPacks`): the welcome pack while it's there, else
 * the smallest that's enough; the biggest when none is. `day`: the Brasília
 * day the packs are counted on (`packGemsOn`: a promotion's gems count too).
 */
export const packFor = (missing: number, taken: readonly GemPackId[], market: GemMarket, day: DayKey | null = null): GemPackId => {
  const gems = (id: GemPackId) => (day ? packGemsOn(id, day) : packGems(id))
  const packs = shownPacks(taken).sort((a, b) => packPrice(a, market) - packPrice(b, market) || gems(b) - gems(a))
  return packs.find((id) => gems(id) >= missing) ?? packs.reduce((a, b) => (gems(b) > gems(a) ? b : a))
}

/** A price in cents of `currency` as the buyer's language writes it (`R$ 24,90`, `$4.99`). */
export const priceText = (cents: number, currency: string, tag: string) => new Intl.NumberFormat(tag, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)

/** What `centavos` of reais come to in `currency` by the shop's table (`GEM_FX`), in whole units of it. */
export const approxPrice = (centavos: number, currency: ShownCurrency) => (centavos / 100 / GEM_FX.brlPerUsd) * GEM_FX.perUsd[currency].rate

/** `centavos` of reais as the shop guesses them in `currency`: `≈ NT$64`, `≈ €1.75` (whole units where they're written so). */
export const approxText = (centavos: number, currency: ShownCurrency, tag: string) => {
  const fx: { rate: number; whole?: true } = GEM_FX.perUsd[currency]
  const digits = fx.whole ? 0 : 2
  return `≈ ${new Intl.NumberFormat(tag, { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: digits, maximumFractionDigits: digits }).format(approxPrice(centavos, currency))}`
}

/** What pack `id` costs as the shop shows it: exactly in reais in Brazil (`R$ 9,90`), a guess in `currency` elsewhere (`≈ US$ 2,02`). */
export const packPriceText = (id: GemPackId, market: GemMarket, currency: ShownCurrency, tag: string) =>
  market === 'br' ? priceText(packPrice(id, 'br'), 'brl', tag) : approxText(packPrice(id, 'intl'), currency, tag)

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
 * What a balance of free gems can buy now, for the results' gem line and
 * the lobby's chip: the Vitrine do dia's first pick the account lacks when
 * the balance covers it (`dailyPicks`), else the cheapest item on sale it
 * lacks (`onSale`; ties go to what shows in a run, then the catalog's
 * order), as `covers`; when nothing is in reach, how many gems the cheapest
 * is `missing` (`first`: the account owns nothing bought yet). Null when
 * the account owns everything on sale.
 */
export type LookNudge = { kind: 'covers'; id: CosmeticId } | { kind: 'short'; missing: number; first: boolean }

export const lookNudge = (day: DayKey, owned: ReadonlySet<CosmeticId>, balance: number): LookNudge | null => {
  const price = (id: CosmeticId) => cosmeticPrice(id) ?? 0
  const buyable = (id: CosmeticId) => !owned.has(id) && onSale(id, day)
  const featured = dailyPicks(day, owned).find((id) => buyable(id) && price(id) <= balance)
  if (featured) return { kind: 'covers', id: featured }
  const runs = (id: CosmeticId) => (showsIn(slotOf(id), 'run') ? 0 : 1)
  const cheapest = COSMETIC_IDS.filter(buyable).sort((a, b) => price(a) - price(b) || runs(a) - runs(b))[0]
  if (cheapest === undefined) return null
  if (price(cheapest) <= balance) return { kind: 'covers', id: cheapest }
  const first = ![...owned].some((id) => price(id) > 0)
  return { kind: 'short', missing: price(cheapest) - Math.max(0, balance), first }
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

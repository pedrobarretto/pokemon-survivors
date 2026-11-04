import type { CosmeticBase } from './cosmetics'

/**
 * Skins: a species' Walk, Idle and Hurt sheets redrawn (`src/data/skins/<id>.json`,
 * baked into `public/assets/skins/<id>/<dex>/`, the shiny's in a `shiny/`
 * below, by `npm run skins`), sold in the gem shop (`data/cosmetics.ts`
 * spreads them into the catalog). One buy dresses every stage of the line it
 * covers (`dexes`, its source's variants): the player's own Pokémon draws in
 * the skin whenever its species is one of them, in every mode; any other form
 * (a Mega, a Primal) draws as it is. A look holds at most one skin per `line`
 * (`Look.skins`). Only the dex numbers live here, so the game never loads the
 * sources; `skinCatalog.test.ts` checks them against the sources and the
 * baked sheets. Names live in i18n (`skins`).
 */

/** The day the skins and their bundles go on sale (Brasília), and the launch offers' first. */
export const SKIN_LAUNCH = '2026-11-05'

/** How many days the seasons' launch offers (`SKIN_BUNDLES`, `days`) stay on sale from `SKIN_LAUNCH`. */
export const SKIN_OFFER_DAYS = 14

/** The seasonal series: each 3-stage and 2-stage grass line wears all three. */
export const SEASONS = ['sakura', 'autumn', 'winter'] as const

export type Season = (typeof SEASONS)[number]

/**
 * `line`: the evolution line it dresses, by its first stage's `PlayableId`
 * (the look's one-skin-per-line key); `dexes`: the stages it covers;
 * `season`: its series, for the bundles.
 */
export type SkinDef = CosmeticBase & { slot: 'skin'; line: string; dexes: readonly number[]; season?: Season }

const at = { slot: 'skin', from: SKIN_LAUNCH } as const

export const SKINS = {
  /* ---------- Legendary ---------- */
  charmanderSuit: { ...at, rarity: 'legendary', line: 'charmander', dexes: [4, 5, 6] },
  squirtleNinja: { ...at, rarity: 'legendary', line: 'squirtle', dexes: [7, 8, 9] },
  torchicGi: { ...at, rarity: 'legendary', line: 'torchic', dexes: [255, 256, 257] },

  /* ---------- Epic ---------- */
  gengarSuit: { ...at, rarity: 'epic', price: 750, line: 'gastly', dexes: [94] },
  froakieDart: { ...at, rarity: 'epic', price: 750, line: 'froakie', dexes: [656, 657, 658] },
  rayquazaCelestial: { ...at, rarity: 'epic', line: 'rayquaza', dexes: [384] },
  groudonObsidian: { ...at, rarity: 'epic', line: 'groudon', dexes: [383] },

  /* ---------- The seasons: 3-stage lines (epic) ---------- */
  bulbasaurSakura: { ...at, rarity: 'epic', line: 'bulbasaur', dexes: [1, 2, 3], season: 'sakura' },
  bulbasaurAutumn: { ...at, rarity: 'epic', line: 'bulbasaur', dexes: [1, 2, 3], season: 'autumn' },
  bulbasaurWinter: { ...at, rarity: 'epic', line: 'bulbasaur', dexes: [1, 2, 3], season: 'winter' },
  chikoritaSakura: { ...at, rarity: 'epic', line: 'chikorita', dexes: [152, 153, 154], season: 'sakura' },
  chikoritaAutumn: { ...at, rarity: 'epic', line: 'chikorita', dexes: [152, 153, 154], season: 'autumn' },
  chikoritaWinter: { ...at, rarity: 'epic', line: 'chikorita', dexes: [152, 153, 154], season: 'winter' },
  treeckoSakura: { ...at, rarity: 'epic', line: 'treecko', dexes: [252, 253, 254], season: 'sakura' },
  treeckoAutumn: { ...at, rarity: 'epic', line: 'treecko', dexes: [252, 253, 254], season: 'autumn' },
  treeckoWinter: { ...at, rarity: 'epic', line: 'treecko', dexes: [252, 253, 254], season: 'winter' },
  turtwigSakura: { ...at, rarity: 'epic', line: 'turtwig', dexes: [387, 388, 389], season: 'sakura' },
  turtwigAutumn: { ...at, rarity: 'epic', line: 'turtwig', dexes: [387, 388, 389], season: 'autumn' },
  turtwigWinter: { ...at, rarity: 'epic', line: 'turtwig', dexes: [387, 388, 389], season: 'winter' },
  budewSakura: { ...at, rarity: 'epic', line: 'budew', dexes: [406, 315, 407], season: 'sakura' },
  budewAutumn: { ...at, rarity: 'epic', line: 'budew', dexes: [406, 315, 407], season: 'autumn' },
  budewWinter: { ...at, rarity: 'epic', line: 'budew', dexes: [406, 315, 407], season: 'winter' },
  rowletSakura: { ...at, rarity: 'epic', line: 'rowlet', dexes: [722, 723, 724], season: 'sakura' },
  rowletAutumn: { ...at, rarity: 'epic', line: 'rowlet', dexes: [722, 723, 724], season: 'autumn' },
  rowletWinter: { ...at, rarity: 'epic', line: 'rowlet', dexes: [722, 723, 724], season: 'winter' },
  sprigatitoSakura: { ...at, rarity: 'epic', line: 'sprigatito', dexes: [906, 907, 908], season: 'sakura' },
  sprigatitoAutumn: { ...at, rarity: 'epic', line: 'sprigatito', dexes: [906, 907, 908], season: 'autumn' },
  sprigatitoWinter: { ...at, rarity: 'epic', line: 'sprigatito', dexes: [906, 907, 908], season: 'winter' },

  /* ---------- The seasons: 2-stage lines (rare) ---------- */
  shroomishSakura: { ...at, rarity: 'rare', price: 400, line: 'shroomish', dexes: [285, 286], season: 'sakura' },
  shroomishAutumn: { ...at, rarity: 'rare', price: 400, line: 'shroomish', dexes: [285, 286], season: 'autumn' },
  shroomishWinter: { ...at, rarity: 'rare', price: 400, line: 'shroomish', dexes: [285, 286], season: 'winter' },
  phantumpSakura: { ...at, rarity: 'rare', price: 400, line: 'phantump', dexes: [708, 709], season: 'sakura' },
  phantumpAutumn: { ...at, rarity: 'rare', price: 400, line: 'phantump', dexes: [708, 709], season: 'autumn' },
  phantumpWinter: { ...at, rarity: 'rare', price: 400, line: 'phantump', dexes: [708, 709], season: 'winter' },
} as const satisfies Record<string, SkinDef>

export type SkinId = keyof typeof SKINS

export const SKIN_IDS = Object.keys(SKINS) as SkinId[]

export const isSkinId = (v: unknown): v is SkinId => typeof v === 'string' && Object.hasOwn(SKINS, v)

export type SkinLine = (typeof SKINS)[SkinId]['line']

/** The lines with skins, in the catalog's order (the shop's line picker). */
export const SKIN_LINES = [...new Set(SKIN_IDS.map((id) => SKINS[id].line))] as SkinLine[]

export const lineOf = (id: SkinId): SkinLine => SKINS[id].line

/** Whether skin `id` dresses the species `dex`. */
export const skinCovers = (id: SkinId, dex: number) => (SKINS[id].dexes as readonly number[]).includes(dex)

/**
 * A bundle of skins sold together for `price` gems (less what the buyer owns
 * already, `bundlePrice` in `game/gems.ts`). `days`: on sale only that many
 * days from `SKIN_LAUNCH` (the launch offers); absent, from then on.
 */
export type SkinBundle = { items: readonly SkinId[]; price: number; days?: number; line?: SkinLine; season?: Season }

const seasonsOf = (line: SkinLine) =>
  SKIN_IDS.filter((id) => {
    const def: SkinDef = SKINS[id]
    return def.line === line && def.season !== undefined
  })

const lineBundle = (line: SkinLine, price: number): SkinBundle => ({ items: seasonsOf(line), price, line })

const seasonOffer = (season: Season): SkinBundle => ({
  items: SKIN_IDS.filter((id) => {
    const def: SkinDef = SKINS[id]
    return def.season === season
  }),
  price: 2600,
  days: SKIN_OFFER_DAYS,
  season,
})

/**
 * The bundles: each seasonal line's Coleção das Estações (its three seasons:
 * 1200 for a 3-stage line, 900 for a 2-stage one), and each season's launch
 * offer (its nine skins, 2600, for `SKIN_OFFER_DAYS`).
 */
export const SKIN_BUNDLES = {
  bulbasaurSeasons: lineBundle('bulbasaur', 1200),
  chikoritaSeasons: lineBundle('chikorita', 1200),
  treeckoSeasons: lineBundle('treecko', 1200),
  turtwigSeasons: lineBundle('turtwig', 1200),
  budewSeasons: lineBundle('budew', 1200),
  rowletSeasons: lineBundle('rowlet', 1200),
  sprigatitoSeasons: lineBundle('sprigatito', 1200),
  shroomishSeasons: lineBundle('shroomish', 900),
  phantumpSeasons: lineBundle('phantump', 900),
  sakuraLaunch: seasonOffer('sakura'),
  autumnLaunch: seasonOffer('autumn'),
  winterLaunch: seasonOffer('winter'),
} as const satisfies Record<string, SkinBundle>

export type SkinBundleId = keyof typeof SKIN_BUNDLES

export const SKIN_BUNDLE_IDS = Object.keys(SKIN_BUNDLES) as SkinBundleId[]

export const isSkinBundleId = (v: unknown): v is SkinBundleId => typeof v === 'string' && Object.hasOwn(SKIN_BUNDLES, v)

export const bundleOf = (id: SkinBundleId): SkinBundle => SKIN_BUNDLES[id]

/**
 * Regional forms played as species of their own, by PokeAPI's id for the form:
 * every sheet, cry, rig and Pokédex mark keys on that id, so a regional form
 * costs nothing past this table. What a player reads comes from here: the
 * national number and the region it's the form of (`scripts/dex.mjs` maps the
 * same ids to SpriteCollab's folders). Who plays them: `data/regionalFamilies.ts`
 * (whole regional lines) and `data/branches.ts` (regional evolutions).
 */

/** The regions with forms of their own, in the Ovo de Viagem's weekly order (`game/travel.ts`). */
export const REGIONS = {
  alola: { gen: 7, color: '#f0a050' },
  galar: { gen: 8, color: '#c84878' },
  hisui: { gen: 8, color: '#6890b8' },
  paldea: { gen: 9, color: '#e0a830' },
} as const satisfies Record<string, { gen: number; color: string }>

export type RegionId = keyof typeof REGIONS

export const REGION_IDS = Object.keys(REGIONS) as RegionId[]

export const isRegion = (v: unknown): v is RegionId => typeof v === 'string' && Object.hasOwn(REGIONS, v)

const alola = (national: number) => ({ national, region: 'alola' }) as const
const galar = (national: number) => ({ national, region: 'galar' }) as const
const hisui = (national: number) => ({ national, region: 'hisui' }) as const
const paldea = (national: number) => ({ national, region: 'paldea' }) as const

const REGIONAL_FORMS: Readonly<Record<number, { national: number; region: RegionId }>> = {
  10100: alola(26), 10101: alola(27), 10102: alola(28), 10103: alola(37), 10104: alola(38), 10105: alola(50), 10106: alola(51),
  10109: alola(74), 10110: alola(75), 10111: alola(76), 10112: alola(88), 10113: alola(89), 10114: alola(103), 10115: alola(105),
  10161: galar(52), 10162: galar(77), 10163: galar(78), 10164: galar(79), 10165: galar(80), 10166: galar(83), 10168: galar(122),
  10172: galar(199), 10173: galar(222), 10174: galar(263), 10175: galar(264), 10176: galar(554), 10177: galar(555),
  10229: hisui(58), 10230: hisui(59), 10231: hisui(100), 10232: hisui(101), 10233: hisui(157), 10234: hisui(211), 10236: hisui(503),
  10238: hisui(570), 10239: hisui(571), 10242: hisui(706), 10244: hisui(724),
  10250: paldea(128), 10251: paldea(128), 10252: paldea(128), 10253: paldea(194),
}

/** The national dex number to show for a species (a regional form shows its species'). */
export const nationalDex = (dex: number) => REGIONAL_FORMS[dex]?.national ?? dex

/** The region a regional form is of, undefined for any other species. */
export const regionOf = (dex: number): RegionId | undefined => REGIONAL_FORMS[dex]?.region

/** The generation of a regional form (its region's), undefined for any other species. */
export const regionalGen = (dex: number) => {
  const region = regionOf(dex)
  return region && REGIONS[region].gen
}

/** Every regional form's dex number, in the table's order. */
export const REGIONAL_DEX = Object.keys(REGIONAL_FORMS).map(Number)

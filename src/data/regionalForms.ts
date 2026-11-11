/**
 * Regional forms played as species of their own, by PokeAPI's id for the form:
 * every sheet, cry, rig and Pokédex mark keys on that id, so a regional form
 * costs nothing past this table. What a player reads comes from here: the
 * national number and the region it's the form of (`scripts/dex.mjs` maps the
 * same ids to SpriteCollab's folders).
 */
const REGIONAL_FORMS: Readonly<Record<number, { national: number; gen: number }>> = {
  10162: { national: 77, gen: 8 }, // Galarian Ponyta
  10163: { national: 78, gen: 8 }, // Galarian Rapidash
  10263: { national: 999, gen: 9 }, // Gimmighoul's Roaming Form (SpriteCollab has no Chest Form sheets; the Rocket Game Corner's prize)
}

/** The national dex number to show for a species (a regional form shows its species'). */
export const nationalDex = (dex: number) => REGIONAL_FORMS[dex]?.national ?? dex

/** The generation of a regional form, undefined for any other species. */
export const regionalGen = (dex: number) => REGIONAL_FORMS[dex]?.gen

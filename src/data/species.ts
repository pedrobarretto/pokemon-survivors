import { BRANCHES } from './branches'
import { ENEMIES } from './enemies'
import { PLAYABLE } from './hatchlings'
import { FESTIVAL_LEGENDS } from './legends'

/** The Pokémon of the map event that flees with coins (`game/mapEvents.ts`), also listed in `scripts/dex.mjs` (CRITTERS). */
export const MEOWTH_DEX = 52

/**
 * Species a player can own without defeating one: the forms they play (each
 * starter's and egg family's line, and the branches their evolutions take).
 * Every other species is caught only by defeating a shiny. The festival
 * legends (Cresselia) stay out for now: a new Pokédex slot would give away
 * the surprise before its festival is announced.
 */
export const OWNABLE_SPECIES: ReadonlySet<number> = new Set([
  ...Object.entries(PLAYABLE).flatMap(([id, p]) => (FESTIVAL_LEGENDS.some((l) => l === id) ? [] : p.line.map((stage) => stage.dex))),
  ...Object.values(BRANCHES).map((b) => b.dex),
])

/** Every species the save may hold, by national dex number: the ones the in-game Pokédex lists (`gameDex` in `site/pokedex.ts`). Gift-only companions aren't here. */
export const GAME_SPECIES: ReadonlySet<number> = new Set([...OWNABLE_SPECIES, ...Object.values(ENEMIES).map((e) => e.dex), MEOWTH_DEX])

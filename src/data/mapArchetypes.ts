import type { FeatureKind, ScatterKind } from './terrain'
import type { PokeType } from './types'

/**
 * Map archetypes: each run draws one from its seed (`game/terrain.ts`,
 * `archetypeOf`), and it weighs what every cell of that run's map holds, so
 * no two runs walk the same kind of ground. Each one leans on places from the
 * games: the archipelago's bays leave narrow land bridges along every cell
 * edge (Sevii Islands, Routes 19–21), the canyon's ridges line up into long
 * walls with a chokepoint at each edge (Victory Road), the forest's thickets
 * make a maze of trails (Viridian Forest, Ilex Forest), the ruins' colonnades
 * stand as cover (Ruins of Alph), the plains stay open (Route 1, the Safari
 * Zone) and the classic route mixes a bit of everything.
 *
 * Every archetype keeps the terrain's own rules (`data/terrain.ts`): one
 * feature per cell, clear of the cell's edges, nothing near the start; so
 * every map stays walkable whatever it draws. Landmarks take their cells first.
 * `goodFor` are the types whose way across the terrain (`TRAVERSAL` in
 * `game/terrain.ts`) the map rewards; the run's sign shows them (`ui/mapSign.ts`).
 * Names and lines live in `i18n` (`maps`).
 */
export const MAP_ARCHETYPE_IDS = ['route', 'plains', 'archipelago', 'canyon', 'forest', 'ruins'] as const

export type MapArchetypeId = (typeof MAP_ARCHETYPE_IDS)[number]

export type MapArchetype = {
  /** Relative odds a run draws it. */
  odds: number
  /** Relative odds of what a cell holds. */
  features: Partial<Record<FeatureKind, number>>
  /** Single pieces strewn about each cell: up to `max`, picked by `weights`. */
  scatter: { max: number; weights: Partial<Record<ScatterKind, number>> }
  /** Types the map is good for (their `TRAVERSAL`), shown on the run's sign. */
  goodFor: readonly PokeType[]
}

export const MAP_ARCHETYPES = {
  route: {
    odds: 2,
    features: { none: 20, rocks: 15, grove: 18, bushes: 12, log: 7, cliff: 11, lake: 9, tower: 4 },
    scatter: { max: 3, weights: { bush: 5, rock: 3, tree: 3 } },
    goodFor: [],
  },
  plains: {
    odds: 2,
    features: { none: 56, bushes: 14, log: 6, rocks: 5, grove: 6, lake: 8, cliff: 3, tower: 2 },
    scatter: { max: 1, weights: { bush: 6, rock: 2, tree: 2 } },
    goodFor: [],
  },
  archipelago: {
    odds: 2,
    features: { bay: 64, lake: 8, none: 8, grove: 9, rocks: 6, bushes: 4, tower: 2 },
    scatter: { max: 2, weights: { bush: 3, rock: 3, tree: 4 } },
    goodFor: ['water', 'flying', 'ice'],
  },
  canyon: {
    odds: 2,
    features: { ridge: 56, cliff: 12, rocks: 12, none: 11, log: 3, lake: 2, tower: 4 },
    scatter: { max: 2, weights: { rock: 6, bush: 2, tree: 1 } },
    goodFor: [],
  },
  forest: {
    odds: 2,
    features: { thicket: 46, grove: 28, bushes: 10, log: 7, none: 4, lake: 3, rocks: 2 },
    scatter: { max: 4, weights: { tree: 6, bush: 4, rock: 1 } },
    goodFor: ['ghost'],
  },
  ruins: {
    odds: 2,
    features: { colonnade: 46, none: 16, rocks: 11, tower: 7, bushes: 8, grove: 6, cliff: 3, lake: 3 },
    scatter: { max: 3, weights: { rock: 5, bush: 3, tree: 2 } },
    goodFor: ['ghost'],
  },
} as const satisfies Record<MapArchetypeId, MapArchetype>

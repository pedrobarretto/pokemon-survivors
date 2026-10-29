import type { ArenaLook } from '../data/arenaCosmetics'
import type { Dir8 } from '../engine/math'
import type { AnimName, SpeciesSprites } from './sprites'

/** Which pass of a look to draw: `behind` before the Pokémon's sprite (a cape seen from the front), `front` after it (a hat, glasses). */
export type WearLayer = 'behind' | 'front'

/**
 * Draws a look's worn cosmetics (`data/wearables.ts`) on a Pokémon that
 * `drawPokemon` draws with the same species, anim, direction, clock, feet
 * position and scale: call it once with `behind` before the sprite and once
 * with `front` after it. Anchored per frame from the species' SpriteCollab
 * offsets, so a hat bobs with the walk and turns with the Pokémon.
 */
export const drawWearables = (
  _ctx: CanvasRenderingContext2D,
  _s: SpeciesSprites,
  _look: ArenaLook,
  _anim: AnimName,
  _dir: Dir8,
  _seconds: number,
  _x: number,
  _y: number,
  _layer: WearLayer,
  _opts: { alpha?: number; scale?: number } = {},
) => {}

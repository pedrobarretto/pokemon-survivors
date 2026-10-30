import type { Look } from '../data/cosmetics'
import { WEARABLES, type WearableId } from '../data/wearables'
import type { Dir8 } from '../engine/math'
import { fitOf, wears } from './wearFit'
import type { AnimName, SpeciesSprites } from './sprites'

/** Which pass of a look to draw: `behind` before the Pokémon's sprite (a cape seen from the front), `front` after it (a hat, glasses). */
export type WearLayer = 'behind' | 'front'

type Engine = typeof import('./wearEngine')
let engine: Engine | null = null
let loading: Promise<Engine> | null = null

/**
 * Loads the wearables' engine and the roster's anchors (a separate chunk,
 * about 40 KB gzipped, that only a look needs). `drawWearables` starts it on
 * its own; await it where a screen must show a look at once (the locker).
 */
export const loadWearables = () =>
  (loading ??= import('./wearEngine').then(
    (m) => (engine = m),
    (error: unknown) => {
      loading = null
      throw error
    },
  ))

/** Whether a look wears anything on the sprite. */
const wearsAny = (look: Look) => look.head !== undefined || look.face !== undefined || look.neck !== undefined || look.back !== undefined

export type WearOpts = {
  alpha?: number
  scale?: number
  /** As `drawPokemon`'s: false plays the anim once (a faint's Hurt). */
  loop?: boolean
  /** The clock (s) an animated wearable (a flowing cape, a sparkling crown) plays by; by default `seconds`, the anim's own. */
  clock?: number
}

/**
 * Draws a look's worn cosmetics (`data/wearables.ts`) on a Pokémon that
 * `drawPokemon` draws with the same species, anim, direction, clock, feet
 * position and scale: call it once with `behind` before the sprite and once
 * with `front` after it. Anchored per frame from the species' SpriteCollab
 * offsets, so a hat bobs with the walk and turns with the Pokémon; sized to
 * the species' head, neck and body; drawn in the pass its slot takes facing
 * `dir` (`render/wearFit.ts`: a cape behind facing south and over the body
 * facing north, glasses gone facing away). Draws nothing until the engine
 * loads (the first call starts it), on a sheet the anchors didn't measure
 * (`anchorKey`, `anchoredSheet` in `render/wearFit.ts`: a stand-in, a form,
 * the Fly sheet, a species not covered yet), and for an item the species
 * can't wear (`data/wearFits.ts`).
 */
export const drawWearables = (
  ctx: CanvasRenderingContext2D,
  s: SpeciesSprites,
  look: Look,
  anim: AnimName,
  dir: Dir8,
  seconds: number,
  x: number,
  y: number,
  layer: WearLayer,
  opts: WearOpts = {},
) => {
  if (!wearsAny(look)) return
  if (engine) engine.drawWearables(ctx, s, look, anim, dir, seconds, x, y, layer, opts)
  else void loadWearables().catch(() => {})
}

/** Whether a species (by dex) can wear an item: the locker greys out the ones it can't (`data/wearFits.ts`). */
export const fitsWearer = (dex: number, id: WearableId) => wears(fitOf(dex), WEARABLES[id].slot, id)

/** An item's art in three-quarter view, for the shop's and the locker's tiles (scale it up by whole numbers); null until `loadWearables` lands. */
export const wearableIcon = (id: WearableId): HTMLCanvasElement | null => engine?.wearableIcon(id) ?? null

/** Dev: forgets the engine's fits and art after `WEAR_FITS` changes (the fitting gallery, `ui/wearFitting.ts`). */
export const refitWearables = () => engine?.refit()

/** A room's game ended: the engine lets go of its rendered art (`freeWearArt`). */
export const freeWearables = () => engine?.freeWearArt()

/** Dev: how many draws since the last ask found their art still rendering (`ui/wearFitting.ts`'s contact sheets wait for none). */
export const wearMisses = () => engine?.takeMisses() ?? 0

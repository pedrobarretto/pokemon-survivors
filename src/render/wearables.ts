import type { Look } from '../data/cosmetics'
import { WEARABLES, type WearableId } from '../data/wearables'
import type { Dir8 } from '../engine/math'
import { fitOf, wears } from './wearFit'
import { drawPokemon, type AnimName, type DrawOpts, type SpeciesSprites } from './sprites'

type Engine = typeof import('./wearEngine')
let engine: Engine | null = null
let loading: Promise<Engine> | null = null

/**
 * Loads the wearables' engine (a separate chunk that only a look needs; each
 * species' rig comes in a small chunk of its own on its first draw, and the
 * dressing runs in a worker). `drawDressed` starts it on its own; await it
 * where a screen must show a look at once (the locker).
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

/**
 * Draws a Pokémon as `drawPokemon` does, dressed in a look's worn cosmetics
 * (`data/wearables.ts`): the frame comes back from the wearables' worker with
 * the items drawn into it (`render/wearDress.ts`: pinned per frame to the
 * variant's head rig, sized to its head, neck and body, behind the body or
 * over it as the Pokémon turns, the eyes never covered), so a hat bobs with
 * the walk and turns with the Pokémon, and an animated item's moving part
 * plays over it on `opts.clock` (by default `seconds`, the anim's own). Draws
 * bare until the engine loads (the first call starts it) and the variant's
 * rows are dressed, on a sheet the rig didn't measure (`rigSheet` in
 * `render/wearFit.ts`: the Fly sheet, a swapped one), for a stand-in sprite
 * (a dust puff) or a variant without a rig (`npm run rig` lists them), and
 * without the items the species can't wear (`data/wearFits.ts`).
 */
export const drawDressed = (
  ctx: CanvasRenderingContext2D,
  s: SpeciesSprites,
  look: Look | null,
  anim: AnimName,
  dir: Dir8,
  seconds: number,
  x: number,
  y: number,
  opts: DrawOpts & { clock?: number } = {},
) => {
  if (!look || !wearsAny(look) || opts.sheet) return drawPokemon(ctx, s, anim, dir, seconds, x, y, opts)
  if (engine) return engine.drawDressed(ctx, s, look, anim, dir, seconds, x, y, opts)
  void loadWearables().catch(() => {})
  drawPokemon(ctx, s, anim, dir, seconds, x, y, opts)
}

/** Whether a species (by dex) can wear an item: the locker greys out the ones it can't (`data/wearFits.ts`). */
export const fitsWearer = (dex: number, id: WearableId) => wears(fitOf(dex), WEARABLES[id].slot, id)

/** Whether a species (by dex) can wear looks at all (it has a rig); null until `loadWearables` lands. */
export const wearsLooks = (dex: number): boolean | null => engine?.hasRig(dex) ?? null

/** An item's art in three-quarter view, for the shop's and the locker's tiles (scale it up by whole numbers); null until `loadWearables` lands. */
export const wearableIcon = (id: WearableId): HTMLCanvasElement | null => engine?.wearableIcon(id) ?? null

/** Dev: forgets the engine's wearers and dressed frames after `WEAR_FITS` changes (`ui/wearFitting.ts`, `ui/rigTool.ts`). */
export const refitWearables = () => engine?.refit()

/** A room's game ended: the engine lets go of its dressed frames (`freeWearArt`). */
export const freeWearables = () => engine?.freeWearArt()

/** Dev: how many draws since the last ask found their frames still dressing (`ui/wearFitting.ts`'s contact sheets wait for none). */
export const wearMisses = () => engine?.takeMisses() ?? 0

/** Dev: keeps every dressed row while a contact sheet renders (`holdWearArt`), from `on` until the matching `false`. */
export const holdWearables = (on: boolean) => engine?.holdWearArt(on)

/** Dev: the dressed frames' memory now and at its peak (`ps.sprites()`). */
export const wearMemory = (reset = false) => engine?.wearMemory(reset) ?? null

/** Dev (`ps.rig`): a variant's rig and size as the engine dresses it now (its fixes decoded afresh); null until the engine and its chunk land. */
export const rigOfSprites = (s: SpeciesSprites) => engine?.devWearer(s) ?? null

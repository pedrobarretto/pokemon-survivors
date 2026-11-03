import { BIOME_MAP, type BiomeId } from '../data/biomes'
import { biomeOf, sampleBiome } from '../game/biomeMap'
import type { Game } from '../game/types'
import type { GroundMap } from './world'

/**
 * The renderer's view of the run's biome map (`game/biomeMap.ts`): the
 * ground's source and which biomes are around the screen, so only their
 * terrain and ground stay built.
 */

let ground: { seed: number; map: GroundMap } | null = null

/** The run's ground: its biome map, borders dithered `BIOME_MAP.blend` px each side. */
export const groundMapOf = (g: Game): GroundMap => {
  const seed = g.terrain.seed
  if (ground?.seed !== seed) ground = { seed, map: { key: `run:${seed}`, at: (x, y) => sampleBiome(seed, x, y), blend: BIOME_MAP.blend } }
  return ground.map
}

/** Px between the samples `biomesNear` takes. Regions are a thousand px across, so none slips between. */
const STEP = 96

let near: { key: string; biomes: BiomeId[] } | null = null

/**
 * The biomes within `margin` px of the screen (and the screen's player's),
 * sorted. Sampled on a coarse grid, and only again once the camera has moved
 * a step.
 */
export const biomesNear = (g: Game, here: BiomeId, margin: number): BiomeId[] => {
  const { x, y } = g.camera
  const { w, h } = g.view
  const cx = Math.floor(x / STEP)
  const cy = Math.floor(y / STEP)
  const key = `${g.terrain.seed}:${cx},${cy}:${margin}:${here}`
  if (near?.key === key) return near.biomes
  const found = new Set<BiomeId>([here])
  for (let sy = cy * STEP - margin; sy <= cy * STEP + h + margin + STEP; sy += STEP) {
    for (let sx = cx * STEP - margin; sx <= cx * STEP + w + margin + STEP; sx += STEP) found.add(biomeOf(g, sx, sy))
  }
  near = { key, biomes: [...found].sort() }
  return near.biomes
}

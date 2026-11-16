import { DEX_REGIONS, type DexRegion } from '../data/nationalDex'
import { markSeen } from '../game/dex'
import { dexGoal, regionProgress } from '../game/dexRegions'
import { loadSave, updateSave } from './save'

/**
 * Dev console helper for the regional Pokédexes (`ps.dexSee` in dev builds):
 * marks a region's goal seen but its last `missing` species (`'all'` every
 * region's), so seeing one more completes it, or with 0 completes it and its
 * title waits in the lobby's gift box. Returns each region's progress.
 */
export const dexSee = (region: DexRegion | 'all' = 'kanto', missing = 1) => {
  const regions = region === 'all' ? DEX_REGIONS : [region]
  updateSave((save) => ({ ...save, dex: regions.flatMap((r) => dexGoal(r).slice(0, Math.max(0, dexGoal(r).length - missing))).reduce(markSeen, save.dex) }))
  const dex = loadSave().dex
  return Object.fromEntries(DEX_REGIONS.map((r) => [r, `${regionProgress(dex, r).seen}/${regionProgress(dex, r).total}`]))
}

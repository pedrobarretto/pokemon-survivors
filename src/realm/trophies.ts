import { dollOf, FURNITURE_IDS, type FurnitureCounts } from '../data/furniture'
import { LEGEND_PAINTINGS, type LegendPaintingId } from '../data/furnitureSets/paintings'
import { LEGEND_IDS } from '../data/legends'
import { isCaptured } from '../game/capture'
import type { Save } from '../game/meta'

/**
 * The furniture a save earned by play (`source: 'trophy'` in
 * `data/furniture.ts`), which the API counts on its own and never stores: a
 * doll of each captured legend (`isCaptured`), and each legend painting once
 * every legend it shows is captured (`LEGEND_PAINTINGS`). Pure; shared with
 * the API (`GET /realm/me`, `PUT /realm/base`'s `checkLayout`).
 */
export const trophyFurniture = (save: Pick<Save, 'legends'>): FurnitureCounts => {
  const dolls = LEGEND_IDS.filter((id) => isCaptured(save.legends, id)).map((id) => [dollOf(id), 1] as const)
  const paintings = paintingIds.filter((id) => LEGEND_PAINTINGS[id].every((l) => isCaptured(save.legends, l))).map((id) => [id, 1] as const)
  return Object.fromEntries([...dolls, ...paintings])
}

const paintingIds = Object.keys(LEGEND_PAINTINGS) as LegendPaintingId[]

/** Two counts summed piece by piece (bought plus earned). */
export const addFurniture = (a: FurnitureCounts, b: FurnitureCounts): FurnitureCounts =>
  Object.fromEntries(
    FURNITURE_IDS.flatMap((id) => {
      const n = (a[id] ?? 0) + (b[id] ?? 0)
      return n > 0 ? [[id, n] as const] : []
    }),
  )

import type { LegendId } from '../legends'
import type { POKEMON_FURNITURE } from './pokemon'

/** The legends' paintings and who each shows: earned once every one of them is captured (`trophyFurniture`). */
export const LEGEND_PAINTINGS = {
  rayquazaPainting: ['rayquaza'],
  lugiaPainting: ['lugia'],
  hoOhPainting: ['hoOh'],
  clashPainting: ['kyogre', 'groudon'],
  mewtwoPainting: ['mewtwo'],
} as const satisfies Partial<Record<keyof typeof POKEMON_FURNITURE, readonly LegendId[]>>

export type LegendPaintingId = keyof typeof LEGEND_PAINTINGS

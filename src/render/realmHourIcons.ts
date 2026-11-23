import type { RealmEventKind } from '../data/realmEvents'
import { fromStrings } from '../engine/pixelart'

/**
 * The Hora do Realm's pixel art that the lobby needs too (the banner's and the
 * tag's icons, the café's lantern): its own module, so the lobby doesn't pull
 * in the town's painter (`render/realmHours.ts`).
 */

/** A paper lantern: `1` outline, `2` paper, `3` paper's light, `4` ribs, `5` brass, `6` tassel. */
export const LANTERN = [
  '...55...',
  '.111111.',
  '12343321',
  '12343321',
  '13443341',
  '13443341',
  '12343321',
  '12343321',
  '.111111.',
  '...55...',
  '...66...',
  '...66...',
] as const

export const LANTERN_COLORS = [
  { 1: '#6a1820', 2: '#d83840', 3: '#ffb070', 4: '#a02830', 5: '#e8b838', 6: '#f8d060' },
  { 1: '#7a4010', 2: '#f09030', 3: '#ffe090', 4: '#c06818', 5: '#e8b838', 6: '#d83840' },
  { 1: '#70500c', 2: '#f0c840', 3: '#fff4b0', 4: '#c89820', 5: '#c87830', 6: '#d83840' },
] as const

const FISH = [
  '...11.......',
  '..1221..11..',
  '.122221.121.',
  '13423331221.',
  '12222233221.',
  '.122331.121.',
  '..1111..11..',
] as const

const BERRY = [
  '....44..',
  '...44...',
  '.112211.',
  '12322221',
  '13222221',
  '12222251',
  '12222551',
  '.111111.',
] as const

const url = (make: () => HTMLCanvasElement) => {
  let got: string | null = null
  return () => (got ??= make().toDataURL())
}

const ICONS: Record<RealmEventKind, () => string> = {
  tide: url(() => fromStrings(FISH, { 1: '#6a2010', 2: '#f07830', 3: '#fff0d8', 4: '#181820' })),
  storm: url(() => fromStrings(BERRY, { 1: '#3a2868', 2: '#7080e8', 3: '#d0d8ff', 4: '#48a048', 5: '#4858c0' })),
  tables: url(() => fromStrings(LANTERN, LANTERN_COLORS[0])),
}

/** A kind of hour's little icon, as an image URL for the HTML. */
export const hourIconUrl = (kind: RealmEventKind) => ICONS[kind]()

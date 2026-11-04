import { BASE_GRID } from '../data/realmMap'
import type { Shape } from '../data/realmMap'
import type { BaseLayout } from '../data/secretBases'
import type { BaseView } from '../net/realmApi'

/**
 * STUB (feat/realm-client): the bases PR (`feat/realm-bases`) replaces this
 * file with the real room (walls, floor, furniture by depth, dolls). Until
 * then a base draws as a plain room on its grid.
 */

const EXTERIOR = { cave: ['#5a4838', '#7a6450'], tree: ['#4a6830', '#8a6a40'], bush: ['#3a7a38', '#6a9a50'], sand: ['#c8a868', '#e0c890'] } as const

/** A base's room (`view`, or the bare one while it loads), camera at `camX`, `camY`. */
export const drawBaseRoom = (ctx: CanvasRenderingContext2D, view: BaseView | null, camX: number, camY: number, _time: number) => {
  const [wall, floor] = EXTERIOR[view?.layout.exterior ?? 'cave']
  const { cols, rows, tile, wallRows } = BASE_GRID
  const ox = -Math.round(camX)
  const oy = -Math.round(camY)
  ctx.fillStyle = floor
  ctx.fillRect(ox, oy, cols * tile, rows * tile)
  ctx.fillStyle = wall
  ctx.fillRect(ox, oy, cols * tile, wallRows * tile)
  ctx.fillStyle = 'rgba(0,0,0,0.08)'
  for (let x = 0; x < cols; x++) for (let y = wallRows; y < rows; y++) if ((x + y) % 2 === 0) ctx.fillRect(ox + x * tile, oy + y * tile, tile, tile)
  ctx.fillStyle = '#281810'
  ctx.fillRect(ox + Math.floor(cols / 2) * tile, oy + (rows - 1) * tile + tile - 4, tile, 4)
  for (const p of view?.layout.items ?? []) {
    ctx.fillStyle = '#a06838'
    ctx.fillRect(ox + p.x * tile + 2, oy + p.y * tile + 2, tile - 4, tile - 4)
  }
}

/** What blocks walking in a base (its standing furniture), as shapes in room px. */
export const baseSolids = (_layout: BaseLayout): readonly Shape[] => []

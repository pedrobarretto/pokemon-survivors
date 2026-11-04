import { FURNITURE, footprint, type FurnitureId } from '../data/furniture'
import { LEGENDS, type LegendId } from '../data/legends'
import { BASE_GRID, BASE_ROOM, type Shape } from '../data/realmMap'
import { DOOR, type BaseExterior, type BaseLayout, type Placed } from '../data/secretBases'
import { canvasCache, context2d, createCanvas } from '../engine/pixelart'
import type { BaseView } from '../net/realmApi'
import { boxOf, dollLegend, drawOrder, supportOf, type Box } from '../realm/placement'
import { furnitureImage } from './furnitureArt'
import { drawPokemon, fitSprites, sprites } from './sprites'

/**
 * A secret base drawn (`data/secretBases.ts`): the room's walls and floor (the
 * exterior's own, or the wallpaper and flooring laid over them), then the
 * furniture by depth: rugs under everything, the wall's pieces on the back
 * wall, and what stands on the floor sorted by its bottom edge, with the
 * pieces on a table drawn just after it. Art comes from the art PR's
 * `furnitureImage` (`render/furnitureArt.ts`); a piece whose PNG isn't there
 * (yet) draws a code-made stand-in in its footprint, and a legend's doll is
 * its own SpriteCollab sprite, shrunk, on a gold pedestal.
 *
 * The realm (`ui/realm.ts`) draws a base room with `drawBaseRoom` and walks
 * trainers around `baseSolids`; the editor (`ui/baseEditor.ts`) draws it with
 * its overlays (`BaseOverlay`), and the screens' cards use `pieceIcon`.
 */

const { cols: COLS, rows: ROWS, tile: TILE, wallRows: WALL_ROWS } = BASE_GRID
const WALL_H = WALL_ROWS * TILE

/** How far a floor piece's stand-in rises above its footprint, and so how high what sits on a surface is lifted. */
export const SURFACE_RISE = 10

const OUTLINE = '#20263a'

/* ---------------- Little helpers ---------------- */

/** A stable small hash of integers (presentation only: textures and stand-in colors). */
const hash = (...n: readonly number[]) => {
  let h = 2166136261
  for (const v of n) h = Math.imul(h ^ (v | 0), 16777619)
  return (h ^ (h >>> 13)) >>> 0
}

const hashText = (s: string) => hash(...Array.from(s, (c) => c.charCodeAt(0)))

const hsl = (h: number, s: number, l: number) => `hsl(${h} ${s}% ${l}%)`

const rect = (ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

/** A filled box with a hard 1 px outline around it. */
const box = (ctx: CanvasRenderingContext2D, fill: string, x: number, y: number, w: number, h: number) => {
  rect(ctx, OUTLINE, x - 1, y - 1, w + 2, h + 2)
  rect(ctx, fill, x, y, w, h)
}

/* ---------------- Walls and floor ---------------- */

type Ramp = readonly [dark: string, mid: string, light: string, lit: string]

/** Each exterior's walls and floor, after Emerald's secret base spots: a cave's rock, a tree's wood, a bush's leaves, a sand pit. */
const EXTERIOR: Record<BaseExterior, { wall: Ramp; floor: Ramp }> = {
  cave: { wall: ['#4a3628', '#6e5038', '#8e6a4a', '#ad8660'], floor: ['#7a5c40', '#977452', '#ad8860', '#c29c72'] },
  tree: { wall: ['#43291a', '#64402a', '#865a36', '#a87444'], floor: ['#8e6236', '#a87844', '#be8c54', '#d4a468'] },
  bush: { wall: ['#173c1e', '#28602c', '#3e8038', '#5ea04a'], floor: ['#5a8a3c', '#6e9e48', '#84b45a', '#9cc86e'] },
  sand: { wall: ['#7a5a32', '#a0804a', '#c2a066', '#dcbe84'], floor: ['#c8a870', '#d8bc84', '#e6cc96', '#f2dcac'] },
}

/** Paints the back wall's band in an exterior's texture. */
const paintWall = (ctx: CanvasRenderingContext2D, exterior: BaseExterior) => {
  const [dark, mid, light, lit] = EXTERIOR[exterior].wall
  rect(ctx, mid, 0, 0, BASE_ROOM.w, WALL_H)
  if (exterior === 'cave') {
    // Rough stones, a few per 12 px cell, lit from above.
    for (let cy = 0; cy < WALL_H; cy += 8)
      for (let cx = (cy / 8) % 2 === 0 ? 0 : -6; cx < BASE_ROOM.w; cx += 12) {
        const k = hash(cx, cy, 1)
        const w = 8 + (k % 5)
        rect(ctx, dark, cx, cy + 6, w, 2)
        rect(ctx, k % 3 === 0 ? lit : light, cx + 1, cy, w - 2, 2)
      }
  } else if (exterior === 'tree') {
    // The trunk's grain: vertical streaks, and a knot here and there.
    for (let x = 0; x < BASE_ROOM.w; x += 3) {
      const k = hash(x, 2)
      rect(ctx, k % 2 === 0 ? dark : light, x, (k >> 3) % 10, 1, WALL_H - ((k >> 6) % 12))
    }
    for (let i = 0; i < 6; i++) {
      const k = hash(i, 3)
      const x = 20 + ((k % 240) | 0)
      const y = 8 + ((k >> 8) % 28)
      rect(ctx, dark, x, y, 6, 4)
      rect(ctx, lit, x + 1, y + 1, 4, 1)
    }
  } else if (exterior === 'bush') {
    // Leaf clumps over a dark tangle.
    rect(ctx, dark, 0, 0, BASE_ROOM.w, WALL_H)
    for (let cy = -2; cy < WALL_H; cy += 6)
      for (let cx = (cy / 6) % 2 === 0 ? 0 : -4; cx < BASE_ROOM.w; cx += 8) {
        const k = hash(cx, cy, 4)
        rect(ctx, mid, cx, cy, 7, 5)
        rect(ctx, k % 3 === 0 ? lit : light, cx + 1, cy, 4, 2)
      }
  } else {
    // Sandstone strata with specks.
    for (let y = 0; y < WALL_H; y += 6) {
      rect(ctx, (y / 6) % 2 === 0 ? light : mid, 0, y, BASE_ROOM.w, 6)
      for (let x = 0; x < BASE_ROOM.w; x += 4) if (hash(x, y, 5) % 5 === 0) rect(ctx, (y / 6) % 2 === 0 ? lit : dark, x, y + 1 + (hash(x, y) % 4), 2, 1)
    }
  }
}

/** Paints the floor in an exterior's texture: its ground with specks. */
const paintFloor = (ctx: CanvasRenderingContext2D, exterior: BaseExterior) => {
  const [dark, mid, light, lit] = EXTERIOR[exterior].floor
  rect(ctx, mid, 0, WALL_H, BASE_ROOM.w, BASE_ROOM.h - WALL_H)
  for (let y = WALL_H; y < BASE_ROOM.h; y += 4)
    for (let x = 0; x < BASE_ROOM.w; x += 4) {
      const k = hash(x, y, exterior.length) % 23
      if (k === 0) rect(ctx, dark, x, y, 2, 1)
      else if (k === 1) rect(ctx, light, x + 1, y + 2, 2, 1)
      else if (k === 2 && exterior !== 'bush') rect(ctx, lit, x, y + 1, 1, 1)
      else if (k === 3 && exterior === 'bush') rect(ctx, light, x + 1, y, 1, 3)
    }
}

/** A wallpaper's stand-in, from its id: stars, leaves, or stripes, in a color of its own. */
const paintWallpaper = (ctx: CanvasRenderingContext2D, id: FurnitureId, x: number, y: number, w: number, h: number) => {
  const hue = hashText(id) % 360
  if (id.toLowerCase().includes('star')) {
    rect(ctx, '#1c2450', x, y, w, h)
    for (let sy = y; sy < y + h; sy += 6)
      for (let sx = x; sx < x + w; sx += 6) {
        const k = hash(sx, sy, 6) % 11
        if (k === 0) rect(ctx, '#f8e070', sx + 2, sy + 2, 1, 1)
        else if (k === 1) {
          rect(ctx, '#fff4b0', sx + 2, sy + 1, 1, 3)
          rect(ctx, '#fff4b0', sx + 1, sy + 2, 3, 1)
        }
      }
    return
  }
  if (id.toLowerCase().includes('leaf')) {
    rect(ctx, hsl(105, 38, 70), x, y, w, h)
    for (let sy = y; sy < y + h; sy += 8)
      for (let sx = x + ((sy / 8) % 2) * 4; sx < x + w; sx += 8) {
        rect(ctx, hsl(115, 45, 42), sx + 1, sy + 2, 3, 2)
        rect(ctx, hsl(110, 40, 55), sx + 2, sy + 1, 2, 1)
      }
    return
  }
  for (let sx = x; sx < x + w; sx += 6) rect(ctx, (sx - x) % 12 === 0 ? hsl(hue, 40, 66) : hsl(hue, 34, 74), sx, y, 6, h)
}

/** A flooring's stand-in, from its id: planks, tiles, or a carpet, in a color of its own. */
const paintFlooring = (ctx: CanvasRenderingContext2D, id: FurnitureId, x: number, y: number, w: number, h: number) => {
  const name = id.toLowerCase()
  const hue = hashText(id) % 360
  if (name.includes('plank') || name.includes('wood')) {
    for (let sy = y; sy < y + h; sy += 6) {
      rect(ctx, (sy / 6) % 2 === 0 ? '#b88450' : '#c4905a', x, sy, w, 6)
      rect(ctx, '#7a5430', x, sy + 5, w, 1)
      const shift = hash(sy, 7) % 30
      for (let sx = x - shift; sx < x + w; sx += 30) rect(ctx, '#7a5430', sx, sy, 1, 5)
    }
    return
  }
  if (name.includes('tile')) {
    for (let sy = y; sy < y + h; sy += 12) for (let sx = x; sx < x + w; sx += 12) rect(ctx, ((sx + sy) / 12) % 2 === 0 ? hsl(hue, 30, 82) : hsl(hue, 34, 66), sx, sy, 12, 12)
    return
  }
  rect(ctx, hsl(hue, 42, 52), x, y, w, h)
  for (let sy = y; sy < y + h; sy += 3) for (let sx = x; sx < x + w; sx += 3) if (hash(sx, sy, 8) % 7 === 0) rect(ctx, hsl(hue, 42, 60), sx, sy, 1, 1)
}

/** Lays a style piece's PNG as a repeating tile over the area, or its stand-in until it's there. */
const paintStyle = (ctx: CanvasRenderingContext2D, id: FurnitureId, x: number, y: number, w: number, h: number) => {
  const img = furnitureImage(id)
  if (img) {
    const pattern = ctx.createPattern(img, 'repeat')
    if (pattern) {
      ctx.save()
      ctx.translate(x, y)
      ctx.fillStyle = pattern
      ctx.fillRect(0, 0, w, h)
      ctx.restore()
      return
    }
  }
  if (FURNITURE[id].kind === 'wallpaper') paintWallpaper(ctx, id, x, y, w, h)
  else paintFlooring(ctx, id, x, y, w, h)
}

/** The room's walls and floor with nothing in it, drawn once per look (`exterior|wallpaper|flooring`, and whether their art was in). */
const rooms = canvasCache<string, HTMLCanvasElement>()

const roomKey = (layout: BaseLayout) =>
  `${layout.exterior}|${layout.wallpaper ?? ''}${layout.wallpaper && furnitureImage(layout.wallpaper) ? '+' : ''}|${layout.flooring ?? ''}${layout.flooring && furnitureImage(layout.flooring) ? '+' : ''}`

const roomCanvas = (layout: BaseLayout) => {
  const key = roomKey(layout)
  let c = rooms.get(key)
  if (c) return c
  if (rooms.size > 12) rooms.clear()
  c = createCanvas(BASE_ROOM.w, BASE_ROOM.h)
  const ctx = context2d(c)
  const [dark, , , lit] = EXTERIOR[layout.exterior].wall
  if (layout.wallpaper) paintStyle(ctx, layout.wallpaper, 0, 0, BASE_ROOM.w, WALL_H)
  else paintWall(ctx, layout.exterior)
  if (layout.flooring) paintStyle(ctx, layout.flooring, 0, WALL_H, BASE_ROOM.w, BASE_ROOM.h - WALL_H)
  else paintFloor(ctx, layout.exterior)
  // The baseboard, and the wall's shadow on the floor.
  rect(ctx, dark, 0, WALL_H - 3, BASE_ROOM.w, 3)
  rect(ctx, lit, 0, WALL_H - 4, BASE_ROOM.w, 1)
  ctx.globalAlpha = 0.25
  rect(ctx, '#000', 0, WALL_H, BASE_ROOM.w, 3)
  ctx.globalAlpha = 1
  // The way out: a gap in the bottom edge with a mat before it.
  const dx = DOOR.x * TILE
  const dy = DOOR.y * TILE
  rect(ctx, '#7a3a30', dx + 3, dy + 6, TILE - 6, TILE - 10)
  rect(ctx, '#a85448', dx + 4, dy + 7, TILE - 8, TILE - 12)
  rect(ctx, '#0c0e18', dx + 2, BASE_ROOM.h - 3, TILE - 4, 3)
  // The room's edge.
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, BASE_ROOM.w - 2, BASE_ROOM.h - 2)
  rooms.set(key, c)
  return c
}

/* ---------------- Furniture ---------------- */

const RARITY_ACCENT = { common: null, rare: '#58a8f8', epic: '#b868f0', legendary: '#f8c838' } as const

/** A doll's legend sprite, shrunk to doll size. */
const dollSprites = (legend: LegendId) => fitSprites(sprites(LEGENDS[legend].line[0].dex), 16, 12)

/** A doll on its pedestal: `x` its center, `y` the pedestal's bottom. */
const drawDoll = (ctx: CanvasRenderingContext2D, legend: LegendId, x: number, y: number, time: number) => {
  box(ctx, '#b08830', x - 7, y - 4, 14, 4)
  rect(ctx, '#f0d070', x - 7, y - 4, 14, 1)
  drawPokemon(ctx, dollSprites(legend), 'Idle', 0, time, x, y - 4)
}

/** A piece's code-made stand-in in its footprint (`px`, `py`: its top-left, `pw`, `ph`: its size, all px). */
const drawStandIn = (ctx: CanvasRenderingContext2D, id: FurnitureId, px: number, py: number, pw: number, ph: number) => {
  const def = FURNITURE[id]
  const hue = hashText(id) % 360
  const accent = RARITY_ACCENT[def.rarity]
  if (def.kind === 'rug') {
    box(ctx, hsl(hue, 45, 52), px + 2, py + 2, pw - 4, ph - 4)
    rect(ctx, hsl(hue, 50, 70), px + 4, py + 4, pw - 8, ph - 8)
    rect(ctx, hsl(hue, 45, 52), px + 6, py + 6, pw - 12, ph - 12)
    if (accent) rect(ctx, accent, px + pw / 2 - 2, py + ph / 2 - 2, 4, 4)
  } else if (def.kind === 'wall') {
    box(ctx, hsl(hue, 30, 38), px + 3, py + 4, pw - 6, ph - 10)
    rect(ctx, hsl(hue, 40, 74), px + 5, py + 6, pw - 10, ph - 14)
    rect(ctx, hsl((hue + 120) % 360, 40, 55), px + 7, py + ph - 12, pw - 14, 4)
    if (accent) rect(ctx, accent, px + pw / 2 - 1, py + 3, 3, 2)
  } else if (def.kind === 'top') {
    const w = Math.min(pw - 8, 12)
    const x = px + (pw - w) / 2
    const bottom = py + ph - 4
    box(ctx, hsl(hue, 45, 40), x, bottom - 6, w, 6)
    box(ctx, hsl(hue, 50, 64), x, bottom - 9, w, 3)
    if (accent) rect(ctx, accent, x + 1, bottom - 4, w - 2, 1)
  } else {
    const rise = SURFACE_RISE
    box(ctx, hsl(hue, 40, 36), px + 2, py + ph - 2 - rise, pw - 4, rise)
    box(ctx, hsl(hue, 45, 58), px + 2, py + 2 - rise, pw - 4, ph - 4 - 1)
    rect(ctx, hsl(hue, 50, 72), px + 2, py + 2 - rise, pw - 4, 1)
    if (accent) rect(ctx, accent, px + 4, py + ph - 6, pw - 8, 2)
  }
}

/** A piece's PNG, bottom-aligned on its footprint and centered across it; a turned piece is drawn a quarter turned. */
const drawArt = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, px: number, py: number, pw: number, ph: number, turned: boolean) => {
  if (!turned) {
    ctx.drawImage(img, Math.round(px + (pw - img.width) / 2), Math.round(py + ph - img.height))
    return
  }
  // Turned, the art's height lies across the footprint: shrink it to fit when it would overhang (a bed's headboard), never grow it.
  const fit = Math.min(1, pw / img.height, (ph + TILE / 2) / img.width)
  const w = Math.round(img.width * fit)
  const h = Math.round(img.height * fit)
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.translate(Math.round(px + pw / 2), Math.round(py + ph - w / 2))
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(img, -Math.round(w / 2), -Math.round(h / 2), w, h)
  ctx.restore()
}

/** Draws one piece at its footprint (px), lifted by `lift` px (what sits on a table). */
const drawPiece = (ctx: CanvasRenderingContext2D, p: Placed, ox: number, oy: number, lift: number, time: number) => {
  const [w, h] = footprint(p.id, p.turned)
  const px = ox + p.x * TILE
  const py = oy + p.y * TILE - lift
  const pw = w * TILE
  const ph = h * TILE
  const legend = dollLegend(p.id)
  if (legend) return drawDoll(ctx, legend, px + pw / 2, py + ph - 4, time)
  const img = furnitureImage(p.id)
  if (img) drawArt(ctx, img, px, py, pw, ph, p.turned && FURNITURE[p.id].turns === true)
  else drawStandIn(ctx, p.id, px, py, pw, ph)
}

/** How far a top piece is lifted: onto its surface, or not at all when there's none (the editor flags it). */
const liftOf = (items: readonly Placed[], i: number) => (FURNITURE[items[i]!.id].kind === 'top' && supportOf(items, i) >= 0 ? SURFACE_RISE : 0)

/**
 * The editor's marks over a base (`ui/baseEditor.ts`): the tile grid, the
 * selected piece, the piece `checkLayout` refused (`mark`), a piece left out
 * while it's dragged (`skip`) and the dragged one where it would land
 * (`ghost`, red when it can't stay there).
 */
export type BaseOverlay = {
  grid?: boolean
  selected?: number | null
  mark?: number | null
  skip?: number | null
  ghost?: { piece: Placed; ok: boolean } | null
}

const outlineBox = (ctx: CanvasRenderingContext2D, color: string, b: Box, ox: number, oy: number) => {
  const x = ox + b.x * TILE
  const y = oy + b.y * TILE
  const w = b.w * TILE
  const h = b.h * TILE
  rect(ctx, color, x, y, w, 1)
  rect(ctx, color, x, y + h - 1, w, 1)
  rect(ctx, color, x, y, 1, h)
  rect(ctx, color, x + w - 1, y, 1, h)
}

const drawGrid = (ctx: CanvasRenderingContext2D, ox: number, oy: number) => {
  ctx.globalAlpha = 0.18
  for (let c = 1; c < COLS; c++) rect(ctx, '#fff', ox + c * TILE, oy, 1, BASE_ROOM.h)
  for (let r = 1; r < ROWS; r++) rect(ctx, r === WALL_ROWS ? '#f8e070' : '#fff', ox, oy + r * TILE, BASE_ROOM.w, 1)
  ctx.globalAlpha = 0.22
  // The door's two tiles stay clear (`checkLayout`'s `door`).
  rect(ctx, '#f8e070', ox + DOOR.x * TILE, oy + (DOOR.y - 1) * TILE, TILE, TILE * 2)
  ctx.globalAlpha = 1
}

/**
 * Draws a base room (its walls and floor, then the furniture by depth) with
 * its top-left at `-camX, -camY` on `ctx`; `time` (s) plays the dolls' idle.
 * `overlay` adds the editor's marks.
 */
export const drawBaseRoom = (ctx: CanvasRenderingContext2D, view: Pick<BaseView, 'layout'>, camX: number, camY: number, time: number, overlay: BaseOverlay = {}) => {
  const { layout } = view
  const ox = Math.round(-camX)
  const oy = Math.round(-camY)
  ctx.drawImage(roomCanvas(layout), ox, oy)
  if (overlay.grid) drawGrid(ctx, ox, oy)
  const items = layout.items
  const pulse = Math.floor(time * 4) % 2 === 0
  for (const i of drawOrder(items)) {
    if (i === overlay.skip) continue
    drawPiece(ctx, items[i]!, ox, oy, liftOf(items, i), time)
    if (i === overlay.mark) {
      ctx.globalAlpha = 0.3
      const b = boxOf(items[i]!)
      rect(ctx, '#f03838', ox + b.x * TILE, oy + b.y * TILE, b.w * TILE, b.h * TILE)
      ctx.globalAlpha = 1
      outlineBox(ctx, '#ff4848', b, ox, oy)
    }
  }
  const chosen = overlay.selected != null && overlay.selected !== overlay.skip ? items[overlay.selected] : undefined
  // A refused piece that's also selected keeps its red, pulsing.
  if (chosen) outlineBox(ctx, overlay.selected === overlay.mark ? (pulse ? '#ffffff' : '#ff4848') : pulse ? '#ffffff' : '#f8d030', boxOf(chosen), ox, oy)
  const ghost = overlay.ghost
  if (ghost) {
    const all = [...items, ghost.piece]
    ctx.globalAlpha = 0.7
    drawPiece(ctx, ghost.piece, ox, oy, liftOf(all, all.length - 1), time)
    ctx.globalAlpha = 0.25
    const b = boxOf(ghost.piece)
    rect(ctx, ghost.ok ? '#48d048' : '#f03838', ox + b.x * TILE, oy + b.y * TILE, b.w * TILE, b.h * TILE)
    ctx.globalAlpha = 1
    outlineBox(ctx, ghost.ok ? '#78f078' : '#ff4848', b, ox, oy)
  }
}

/**
 * What a walker can't walk through in a base (world px, from the room's
 * top-left): the back wall's band and every piece that `blocks`. The door's
 * tiles are always clear (`checkLayout`).
 */
export const baseSolids = (layout: BaseLayout): Shape[] => [
  { kind: 'rect', x: 0, y: 0, w: BASE_ROOM.w, h: WALL_H },
  ...layout.items.flatMap((p): Shape[] => {
    if (FURNITURE[p.id].blocks !== true) return []
    const b = boxOf(p)
    return [{ kind: 'rect', x: b.x * TILE, y: b.y * TILE, w: b.w * TILE, h: b.h * TILE }]
  }),
]

/* ---------------- Icons for the screens ---------------- */

/**
 * A piece drawn alone on a canvas of its own size, for the editor's tray and
 * the carpentry's collection covers (CSS scales it, pixelated). `ready`: false while its
 * art (the PNG, a doll's sprite) is still on its way, so the screen paints it
 * again later.
 */
export const pieceIcon = (id: FurnitureId, time = 0): { canvas: HTMLCanvasElement; ready: boolean } => {
  const def = FURNITURE[id]
  const legend = dollLegend(id)
  if (legend) {
    const canvas = createCanvas(28, 34)
    const ctx = context2d(canvas)
    drawDoll(ctx, legend, 14, 32, time)
    return { canvas, ready: dollSprites(legend).variant !== undefined }
  }
  if (def.kind === 'wallpaper' || def.kind === 'flooring') {
    const canvas = createCanvas(36, 36)
    const ctx = context2d(canvas)
    paintStyle(ctx, id, 0, 0, 36, 36)
    ctx.strokeStyle = OUTLINE
    ctx.strokeRect(0.5, 0.5, 35, 35)
    return { canvas, ready: furnitureImage(id) !== null }
  }
  const [w, h] = def.size
  const img = furnitureImage(id)
  const pw = w * TILE
  const ph = h * TILE
  const rise = def.kind === 'floor' ? SURFACE_RISE : 0
  const canvas = createCanvas(Math.max(pw, img?.width ?? 0), Math.max(ph + rise, img?.height ?? 0))
  const ctx = context2d(canvas)
  const px = (canvas.width - pw) / 2
  const py = canvas.height - ph
  if (img) drawArt(ctx, img, px, py, pw, ph, false)
  else drawStandIn(ctx, id, px, py, pw, ph)
  return { canvas, ready: img !== null }
}

/** The room a catalog preview stands in: the tree's warm wood, the plainest of the four. */
const PREVIEW_EXTERIOR: BaseExterior = 'tree'

/** What a piece that sits on a surface is shown on in a preview, by its width (wider ones stand on the floor). */
const PREVIEW_STANDS: Partial<Record<number, FurnitureId>> = { 1: 'woodCrate', 2: 'woodTable' }

/** Whether a piece's art is in (a doll's sprite, a PNG). */
const artReady = (id: FurnitureId) => {
  const legend = dollLegend(id)
  return legend ? dollSprites(legend).variant !== undefined : furnitureImage(id) !== null
}

/**
 * A piece as it would stand in a base, for the carpentry's catalog: a corner
 * of a room (the back wall and a few floor tiles, the tree's own, or the
 * piece itself laid over them when it's a wallpaper or a flooring) with the
 * piece in it against the wall, on a crate or a table when it sits on one,
 * cropped round it. Drawn by `drawBaseRoom`, so it looks as it will in the
 * base. `ready` as `pieceIcon`'s.
 */
export const piecePreview = (id: FurnitureId, time = 0): { canvas: HTMLCanvasElement; ready: boolean } => {
  const def = FURNITURE[id]
  const style = def.kind === 'wallpaper' || def.kind === 'flooring'
  const [w, h] = def.size
  const x = Math.floor((COLS - w) / 2)
  const stand = def.kind === 'top' && h === 1 ? PREVIEW_STANDS[w] : undefined
  const items: Placed[] = style
    ? []
    : def.kind === 'wall'
      ? [{ id, x, y: Math.max(0, WALL_ROWS - h), turned: false }]
      : [...(stand ? [{ id: stand, x, y: WALL_ROWS, turned: false }] : []), { id, x, y: WALL_ROWS, turned: false }]
  const layout: BaseLayout = { exterior: PREVIEW_EXTERIOR, wallpaper: def.kind === 'wallpaper' ? id : null, flooring: def.kind === 'flooring' ? id : null, items }
  // Half a tile of room round the piece; above it, a strip of the wall over its art (all of the wall for the wall's pieces).
  const cols = style ? 3 : w + 1
  const left = style ? Math.floor((COLS - 3) / 2) * TILE : x * TILE - TILE / 2
  const floorBottom = (WALL_ROWS + h) * TILE
  const rises = (piece: FurnitureId | undefined) => (piece ? Math.max(furnitureImage(piece)?.height ?? 0, FURNITURE[piece].size[1] * TILE) : 0)
  const art = def.kind === 'rug' ? h * TILE : dollLegend(id) ? 34 + SURFACE_RISE : Math.max(rises(stand), rises(id) + (stand ? SURFACE_RISE : 0))
  const top = style || def.kind === 'wall' ? 0 : Math.max(0, Math.min(WALL_H - 10, floorBottom - art - 8))
  const bottom = style ? WALL_H + 2 * TILE : def.kind === 'wall' ? WALL_H + TILE / 2 : floorBottom + TILE / 2
  const canvas = createCanvas(cols * TILE, bottom - top)
  drawBaseRoom(context2d(canvas), { layout }, left, top, time)
  return { canvas, ready: artReady(id) && (stand === undefined || artReady(stand)) }
}

/** An exterior's look in small (its wall over its floor), for the editor's picker. */
export const exteriorSwatch = (exterior: BaseExterior): HTMLCanvasElement => {
  const canvas = createCanvas(36, 36)
  const ctx = context2d(canvas)
  const room = roomCanvas({ exterior, wallpaper: null, flooring: null, items: [] })
  ctx.drawImage(room, 24, WALL_H - 18, 36, 36, 0, 0, 36, 36)
  ctx.strokeStyle = OUTLINE
  ctx.strokeRect(0.5, 0.5, 35, 35)
  return canvas
}

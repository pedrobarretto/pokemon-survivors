import { context2d } from '../engine/pixelart'
import type { Dir8 } from '../engine/math'
import { BASE_GRID, BASE_ROOM, REALM_ROOMS, TOWN_ROOMS, type TownRoomId } from '../data/realmMap'
import { BASE_EXTERIORS } from '../data/secretBases'
import { FURNITURE, FURNITURE_IDS, footprint, type FurnitureId, type ShopFurnitureId } from '../data/furniture'
import { drawPokemon, loadSpecies, loadedSprites } from '../render/sprites'
import { baseShell, drawTownGround, drawTownOverhead, townPieces } from '../render/realmArt'
import { furnitureImage } from '../render/furnitureArt'
import { pieceName } from '../realm/furniture'

/**
 * Dev only (`ps.realmArt`): a look at the Poké Realm's art before the realm's
 * screen draws it. `ps.realmArt('plaza')` shows a town room (arrows pan,
 * `+`/`-` zoom, `g` the geometry from `REALM_ROOMS`), with a few Pokémon on
 * its spots for scale; `'bases'` the four base interiors furnished;
 * `'furniture'` the catalog's art on the base grid. Esc closes.
 */

export type RealmArtView = TownRoomId | 'bases' | 'furniture'

/** A few walkers for scale, by dex. */
const WALKERS = [25, 4, 7, 1, 133, 39] as const

const isShop = (id: FurnitureId): id is ShopFurnitureId => FURNITURE[id].source !== 'trophy'

/** Opens the viewer; `opts.cam` and `opts.scale` pin the view (for screenshots), `opts.geometry` overlays what blocks walking. */
export const openRealmArt = (view: RealmArtView = 'plaza', opts: { cam?: { x: number; y: number }; scale?: number; geometry?: boolean } = {}) => {
  document.getElementById('realm-art-dev')?.remove()
  const canvas = document.createElement('canvas')
  canvas.id = 'realm-art-dev'
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: '9999', imageRendering: 'pixelated', background: '#000' })
  document.body.append(canvas)
  const ctx = context2d(canvas)
  for (const dex of WALKERS) void loadSpecies(dex).catch(() => {})
  const size = view === 'bases' ? { w: BASE_ROOM.w * 2 + 24, h: BASE_ROOM.h * 2 + 24 } : view === 'furniture' ? { w: 530, h: 420 } : REALM_ROOMS[view]
  let scale = opts.scale ?? Math.max(1, Math.floor(Math.min(innerWidth / size.w, innerHeight / size.h) * devicePixelRatio))
  const cam = { x: opts.cam?.x ?? 0, y: opts.cam?.y ?? 0 }
  let geometry = opts.geometry ?? false
  let live = true
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Escape') return close()
    if (e.key === 'ArrowLeft') cam.x -= 16
    if (e.key === 'ArrowRight') cam.x += 16
    if (e.key === 'ArrowUp') cam.y -= 16
    if (e.key === 'ArrowDown') cam.y += 16
    if (e.key === '+' || e.key === '=') scale++
    if (e.key === '-') scale = Math.max(1, scale - 1)
    if (e.key === 'g') geometry = !geometry
    e.stopPropagation()
  }
  const close = () => {
    live = false
    canvas.remove()
    removeEventListener('keydown', keys, true)
  }
  addEventListener('keydown', keys, true)
  const walker = (dex: number, x: number, y: number, dir: Dir8, time: number) => {
    const s = loadedSprites(dex)
    if (s) drawPokemon(ctx, s, 'Idle', dir, time, x, y)
  }
  const drawRoom = (room: TownRoomId, w: number, h: number, time: number) => {
    const r = REALM_ROOMS[room]
    drawTownGround(ctx, room, cam.x, cam.y, w, h, time)
    const people = [r.spawn, ...r.spots.map((s) => s.at)].slice(0, WALKERS.length).map((at, i) => ({ y: at.y, draw: () => walker(WALKERS[i]!, at.x - cam.x, at.y - cam.y, (i % 2 ? 1 : 0) as Dir8, time + i * 0.3) }))
    for (const p of [...townPieces(room), ...people].sort((a, b) => a.y - b.y)) p.draw(ctx, cam.x, cam.y, time)
    drawTownOverhead(ctx, room, cam.x, cam.y, w, h, time)
    if (!geometry) return
    ctx.strokeStyle = 'rgba(255,0,80,0.9)'
    ctx.lineWidth = 1
    for (const s of r.solid) {
      ctx.beginPath()
      if (s.kind === 'rect') ctx.rect(s.x - cam.x + 0.5, s.y - cam.y + 0.5, s.w, s.h)
      else ctx.ellipse(s.x - cam.x, s.y - cam.y, s.rx, s.ry, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(0,200,255,0.9)'
    for (const d of r.doors) ctx.strokeRect(d.at.x - cam.x + 0.5, d.at.y - cam.y + 0.5, d.at.w, d.at.h)
    ctx.strokeStyle = 'rgba(255,220,0,0.9)'
    for (const s of r.spots) {
      ctx.beginPath()
      ctx.arc(s.at.x - cam.x, s.at.y - cam.y, s.reach, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  /** A few pieces on each base, so the shells show with furniture standing in them. */
  const drawBases = (time: number) => {
    BASE_EXTERIORS.forEach((ext, i) => {
      const ox = (i % 2) * (BASE_ROOM.w + 24) - cam.x
      const oy = Math.floor(i / 2) * (BASE_ROOM.h + 24) - cam.y
      ctx.drawImage(baseShell(ext), ox, oy)
      const T = BASE_GRID.tile
      const placed: [FurnitureId, number, number][] = [
        [(['regionMap', 'championBanner', 'wallClock', 'regionMap'] as const)[i]!, 2, 0],
        [(['pokeBallRug', 'roundRug', 'pokeBallRug', 'roundRug'] as const)[i]!, 4, 4],
        [(['woodTable', 'tvSet', 'bookshelf', 'aquarium'] as const)[i]!, 7, 1],
        [(['pottedPlant', 'floorLamp', 'cherryTree', 'jukebox'] as const)[i]!, 1, 2],
        [(['snorlaxBeanbag', 'pikachuBed', 'fireplace', 'goldTrophyCase'] as const)[i]!, 8, 4],
      ]
      for (const [id, tx, ty] of placed) {
        const img = furnitureImage(id)
        if (!img) continue
        const [fw, fh] = footprint(id, false)
        if (FURNITURE[id].kind === 'rug') ctx.drawImage(img, ox + tx * T + (fw * T - img.width) / 2, oy + ty * T + (fh * T - img.height) / 2)
        // A wall piece hangs a little above the wall's foot.
        else if (FURNITURE[id].kind === 'wall') ctx.drawImage(img, Math.round(ox + (tx + fw / 2) * T - img.width / 2), oy + BASE_GRID.wallRows * T - 6 - img.height)
        else ctx.drawImage(img, Math.round(ox + (tx + fw / 2) * T - img.width / 2), oy + (ty + fh) * T - img.height)
      }
      walker(WALKERS[i]!, ox + 6.5 * T, oy + 7.6 * T, 4, time)
    })
  }
  const drawCatalog = () => {
    const T = BASE_GRID.tile
    const ids = FURNITURE_IDS.filter(isShop)
    ctx.font = '8px monospace'
    let x = 8
    let y = 8
    let rowH = 0
    for (const id of ids) {
      const img = furnitureImage(id)
      const tiled = FURNITURE[id].kind === 'wallpaper' || FURNITURE[id].kind === 'flooring'
      // A wallpaper or a flooring shows three of its tiles in a row.
      const [fw, fh] = tiled ? [3, 1] : footprint(id, false)
      // A cell: the art standing on its footprint (or over it, a tall piece), its name below.
      const art = Math.max(fh * T, img?.height ?? 0)
      const w = Math.max(fw * T, img?.width ?? 0, 64) + 8
      if (x + w > 520) {
        x = 8
        y += rowH
        rowH = 0
      }
      const floor = y + art - fh * T
      ctx.fillStyle = '#c99a64'
      ctx.fillRect(x - cam.x, floor - cam.y, fw * T, fh * T)
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'
      for (let gx = 0; gx < fw; gx++) for (let gy = 0; gy < fh; gy++) ctx.strokeRect(x + gx * T - cam.x + 0.5, floor + gy * T - cam.y + 0.5, T - 1, T - 1)
      if (img) {
        const kind = FURNITURE[id].kind
        if (tiled) for (let gx = 0; gx < fw; gx++) ctx.drawImage(img, x + gx * T - cam.x, floor - cam.y)
        else if (kind === 'rug') ctx.drawImage(img, x - cam.x, floor - cam.y)
        else ctx.drawImage(img, Math.round(x + (fw * T - img.width) / 2) - cam.x, y + art - img.height - cam.y)
      }
      ctx.fillStyle = '#fff'
      ctx.fillText(pieceName(id), x - cam.x, y + art + 9 - cam.y)
      x += w
      rowH = Math.max(rowH, art + 16)
    }
  }
  const frame = (ms: number) => {
    if (!live) return
    const time = ms / 1000
    canvas.width = Math.ceil(innerWidth * devicePixelRatio)
    canvas.height = Math.ceil(innerHeight * devicePixelRatio)
    const w = Math.ceil(canvas.width / scale)
    const h = Math.ceil(canvas.height / scale)
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#1a1a24'
    ctx.fillRect(0, 0, w, h)
    if (view === 'bases') drawBases(time)
    else if (view === 'furniture') drawCatalog()
    else drawRoom(view, w, h, time)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  return { close, rooms: TOWN_ROOMS }
}

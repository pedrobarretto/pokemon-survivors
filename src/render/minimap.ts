import { context2d, createCanvas, fromStrings, lazy, blitPacked, textSprite, type Palette, type PixelSprite } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import type { BiomeId } from '../data/biomes'
import type { ArenaShape, FloorPlan } from '../data/arenas'
import type { LandmarkId } from '../data/landmarks'
import type { PlaceId } from '../data/places'
import { TERRAIN } from '../data/terrain'
import { isMission } from '../game/fieldMissions'
import { MAP_EVENTS, type MapEventKind } from '../game/mapEvents'
import { entranceShown } from '../game/place'
import { localPlayer } from '../game/players'
import { roomOf, type Room } from '../game/room'
import { featureAt, type Feature } from '../game/terrain'
import type { Game, Pickup } from '../game/types'
import { missionSpot } from './fieldMissions'
import { slotColor } from './team'

/**
 * The HUD's mini map (`ui/minimap.ts`): a pixel-art map around the local
 * player, north up, drawn at `MINIMAP.size` px a side. On the map it shows
 * the terrain (lakes, cliffs, groves, rocks), the landmarks, the map events,
 * a place's entrance, a rift's portal, the important drops, the teammates,
 * the Alphas and the boss; the ones worth walking to stay pinned to the rim
 * when they're out of range. In a room (a rift's arena, a place's inside) it
 * shows the room's floor up close. The wild horde never shows. Presentation
 * only: it reads the game and builds terrain with the pure `featureAt`, so the
 * simulation's caches stay untouched.
 */

type Ctx = CanvasRenderingContext2D

/** The map's outline (Settings → Jogo also turns it off, `MINIMAP_MODES` in `ui/save.ts`). */
export type MinimapShape = 'square' | 'round'

/** Map px a side; world px per map px on the map and in a room. */
export const MINIMAP = { size: 64, scale: 26, roomScale: 14 } as const

const S = MINIMAP.size
const C = S / 2
/** Where pinned markers sit, in map px from the rim. */
const PIN = 5

const DARK = '#101018'

/* ---------------- Palettes ---------------- */

type Look = { ground: string; dither: string; bush: string; tree: string; rock: string; cliff: string; cliffTop: string; water: string; shore: string }

/** Each biome's map colors: darker than the world, so the markers pop. */
const LOOKS: Record<BiomeId, Look> = {
  meadow: { ground: '#4f8c3e', dither: '#5a9846', bush: '#3f7a32', tree: '#2a5a26', rock: '#a0a090', cliff: '#7a5c40', cliffTop: '#9a7a54', water: '#3070c0', shore: '#78b0e8' },
  forest: { ground: '#30602c', dither: '#386a32', bush: '#285424', tree: '#163c18', rock: '#8a8c80', cliff: '#6a5038', cliffTop: '#8a6c4c', water: '#2a64a8', shore: '#6aa0d8' },
  cave: { ground: '#5a4c4e', dither: '#625456', bush: '#504446', tree: '#3e3436', rock: '#9a8e8a', cliff: '#3a2e2e', cliffTop: '#7a6a62', water: '#3a6aa0', shore: '#7aa0c8' },
  snow: { ground: '#a8b8cc', dither: '#b4c4d6', bush: '#8aa0b4', tree: '#4a6a62', rock: '#6a7480', cliff: '#5a6474', cliffTop: '#8a96a6', water: '#5a90d0', shore: '#c8e8f8' },
  tower: { ground: '#4c4460', dither: '#544c68', bush: '#423a56', tree: '#2e2840', rock: '#8a84a0', cliff: '#2a2438', cliffTop: '#6a6284', water: '#40508c', shore: '#8a98d0' },
}

const ROOM_LOOK = { void: '#141020', floor: '#5a5270', dither: '#625a7a', edge: '#8a82a8', water: '#2c4c90', shallow: '#4a74b8', lava: '#e05020' } as const

/* ---------------- Glyphs ---------------- */

/** A glyph drawn from string rows, with a 1 px dark outline added around it. */
const glyph = (rows: readonly string[], palette: Palette): PixelSprite => {
  const w = Math.max(...rows.map((r) => r.length)) + 2
  const h = rows.length + 2
  const filled = (x: number, y: number) => palette[rows[y - 1]?.[x - 1] ?? '.'] !== undefined
  const grid = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => {
      if (filled(x, y)) return rows[y - 1]![x - 1]!
      const near = filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)
      return near ? '#' : '.'
    }).join(''),
  )
  return fromStrings(grid, { ...palette, '#': DARK })
}

const SKULL = ['.www.', 'wwwww', 'wkwkw', 'wwwww', '.w.w.']
const DIAMOND = ['..c..', '.cwc.', 'cwwwc', '.cwc.', '..c..']
const PORTAL = ['.ppp.', 'plllp', 'plwlp', 'plllp', '.ppp.']
const DOOR = ['.ccc.', 'ckkkc', 'ckkkc', 'ckkkc']
const DOT = ['ccc', 'cwc', 'ccc']
const DROP = ['..b..', '.bbb.', 'bbwbb', 'bbbbb', '.bbb.']
const COIN = ['.yyy.', 'yyoyy', 'yoyoy', 'yyoyy', '.yyy.']
const CHEST = ['bbbbb', 'kkykk', 'bbbbb', 'bbbbb']
const GEM = ['.y.', 'yey', '.y.']
const DISC = ['.bbb.', 'bbwbb', 'bw.wb', 'bbwbb', '.bbb.']
const FLAG = ['gg..', 'gggg', 'gg..', 'k...', 'k...']
const CROSS = ['r.r', '.r.', 'r.r']
const BALL = ['rrr', 'kwk', 'www']
const HOUSE = ['..r..', '.rrr.', 'rrrrr', '.wkw.', '.wkw.']
const TUNNEL = ['.sss.', 'sssss', 'skkks', 'skkks']
const MAZE = ['mmmmm', 'm...m', 'm.m.m', 'm.m..', 'mmmmm']
const RUINS = ['sssss', '.s.s.', '.s.s.', 'sssss']
const TENT = ['..o..', '.ooo.', 'oo.oo', 'oo.oo']

const GLYPHS = lazy(() => ({
  boss: [glyph(SKULL, { w: '#f8f0e0', k: DARK }), glyph(SKULL, { w: '#f86858', k: DARK })],
  alpha: [glyph(DIAMOND, { c: '#e02838', w: '#f8e0b0' }), glyph(DIAMOND, { c: '#f8a020', w: '#f8f0d0' })],
  portal: [glyph(PORTAL, { p: '#7850c8', l: '#c8a8f8', w: '#ffffff' }), glyph(PORTAL, { p: '#c8a8f8', l: '#7850c8', w: '#ffffff' })],
  place: {
    cave: glyph(DOOR, { c: '#a87848', k: '#281810' }),
    graveyard: glyph(DOOR, { c: '#9888b0', k: '#201830' }),
    sky: glyph(DOOR, { c: '#a8d8f8', k: '#f8f8f8' }),
    grotto: glyph(DOOR, { c: '#68b048', k: '#102808' }),
    underground: glyph(DOOR, { c: '#b89470', k: '#281808' }),
  } satisfies Record<PlaceId, PixelSprite>,
  landmark: {
    cottage: glyph(HOUSE, { r: '#d05838', w: '#f0e0b8', k: '#583018' }),
    tunnel: glyph(TUNNEL, { s: '#a09890', k: '#201818' }),
    maze: glyph(MAZE, { m: '#c8b078' }),
    ruins: glyph(RUINS, { s: '#d8d0c0' }),
    camp: glyph(TENT, { o: '#e89838' }),
  } satisfies Record<LandmarkId, PixelSprite>,
  events: {
    altar: glyph(GEM, { y: '#f8d048', e: '#ffffff' }),
    fountain: glyph(DROP, { b: '#58a8f8', w: '#e0f4ff' }),
    chest: glyph(CHEST, { b: '#b07838', k: '#583818', y: '#f8d048' }),
    spikes: glyph(CROSS, { r: '#e8e8e8' }),
    bomb: glyph(DOT, { c: '#383848', w: '#f84838' }),
    meowth: glyph(COIN, { y: '#f8d030', o: '#c89018' }),
    tutor: glyph(DISC, { b: '#78c0f8', w: '#ffffff' }),
    defense: glyph(FLAG, { g: '#58d878', k: '#e8e8e8' }),
    collect: glyph(FLAG, { g: '#58d878', k: '#e8e8e8' }),
    escort: glyph(FLAG, { g: '#f878a8', k: '#e8e8e8' }),
  } satisfies Record<MapEventKind, PixelSprite>,
  stairs: glyph(['yyy.', 'yyyy', '.yyy'], { y: '#f8e070' }),
  keystone: glyph(DIAMOND, { c: '#9878e8', w: '#e8d8ff' }),
  ball: glyph(BALL, { r: '#f04838', k: DARK, w: '#f8f8f8' }),
  tm: glyph(['bbb', 'bwb', 'bbb'], { b: '#58a0f0', w: '#ffffff' }),
  gold: glyph(['bbb', 'bwb', 'bbb'], { b: '#f8c030', w: '#ffffff' }),
  stone: glyph(['.p.', 'pwp', '.p.'], { p: '#f070d0', w: '#ffffff' }),
  evo: glyph(['.g.', 'gwg', '.g.'], { g: '#68d858', w: '#ffffff' }),
  prize: glyph(['.c.', 'cwc', '.c.'], { c: '#e02838', w: '#f8e0b0' }),
}))

/**
 * The local player's arrow for each of 8 headings (0 = east, clockwise), rasterized
 * from a notched arrowhead so the diagonals stay as crisp as the straight ones.
 */
const ARROWS = lazy(() =>
  Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    const pts = [[3.6, 0], [-3, 2.8], [-1.4, 0], [-3, -2.8]].map(([x, y]) => [x! * Math.cos(a) - y! * Math.sin(a), x! * Math.sin(a) + y! * Math.cos(a)] as const)
    const N = 9
    const inside = (px: number, py: number) => {
      let odd = false
      for (let j = 0, k = pts.length - 1; j < pts.length; k = j++) {
        const [xj, yj] = pts[j]!
        const [xk, yk] = pts[k]!
        if (yj > py !== yk > py && px < ((xk - xj) * (py - yj)) / (yk - yj) + xj) odd = !odd
      }
      return odd
    }
    const fill = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => inside(x - 4, y - 4)))
    const rows = fill.map((row, y) =>
      row.map((on, x) => (on ? 'w' : fill[y]?.[x - 1] || fill[y]?.[x + 1] || fill[y - 1]?.[x] || fill[y + 1]?.[x] ? '#' : '.')).join(''),
    )
    return fromStrings(rows, { w: '#ffffff', '#': DARK })
  }),
)

/** The map's window: opaque where the map shows, for clipping it to its shape. */
const MASKS = lazy(() => {
  const mask = (shape: MinimapShape) => {
    const c = createCanvas(S, S)
    const ctx = context2d(c)
    ctx.fillStyle = '#ffffff'
    for (let y = 0; y < S; y++) {
      const [x0, x1] = span(shape, y, 0)
      if (x1 > x0) ctx.fillRect(x0, y, x1 - x0, 1)
    }
    return c
  }
  return { square: mask('square'), round: mask('round') }
})

/** Columns [x0, x1) of row `y` inside the map's shape, `inset` px in from its edge. */
const span = (shape: MinimapShape, y: number, inset: number): readonly [number, number] => {
  if (shape === 'square') {
    // Corners clipped by 2 px, like the UI's boxes.
    const edge = Math.min(y, S - 1 - y) - inset
    if (edge < 0) return [0, 0]
    const cut = Math.max(0, 2 - edge)
    return [inset + cut, S - inset - cut]
  }
  const r = C - inset
  const dy = y + 0.5 - C
  if (Math.abs(dy) >= r) return [0, 0]
  const half = Math.sqrt(r * r - dy * dy)
  return [Math.round(C - half), Math.round(C + half)]
}

/** The frame: dark rim, a paper line and the inner shadow, then the north tick on top. */
const FRAMES = lazy(() => {
  const frame = (shape: MinimapShape) => {
    const c = createCanvas(S, S)
    const ctx = context2d(c)
    const rings = ['#101018', '#e8e0c8', '#283040'] as const
    rings.forEach((color, inset) => {
      ctx.fillStyle = color
      for (let y = 0; y < S; y++) {
        const [o0, o1] = span(shape, y, inset)
        const [i0, i1] = span(shape, y, inset + 1)
        if (o1 <= o0) continue
        if (i1 <= i0) ctx.fillRect(o0, y, o1 - o0, 1)
        else {
          ctx.fillRect(o0, y, i0 - o0, 1)
          ctx.fillRect(i1, y, o1 - i1, 1)
        }
      }
    })
    return c
  }
  return { square: frame('square'), round: frame('round') }
})

/* ---------------- Terrain ---------------- */

/** Terrain cells built for the map, apart from the simulation's own cache (`featureAt` is pure). */
const cells = new Map<number, Feature | null>()
let cellsSeed = -1

const featureFor = (seed: number, cx: number, cy: number) => {
  if (seed !== cellsSeed || cells.size > 900) {
    cells.clear()
    cellsSeed = seed
  }
  const key = (cx & 0xffff) * 0x10000 + (cy & 0xffff)
  let f = cells.get(key)
  if (f === undefined) cells.set(key, (f = featureAt(seed, cx, cy)))
  return f
}

/** Draws on the map: world coordinates in, whole map px out, through the frame's origin and scale. */
type View = { ox: number; oy: number; scale: number }

const mapX = (v: View, x: number) => Math.floor(x / v.scale) - v.ox
const mapY = (v: View, y: number) => Math.floor(y / v.scale) - v.oy

/** An ellipse in world px, filled on the map (at least one pixel). */
const fillEllipse = (ctx: Ctx, v: View, x: number, y: number, rx: number, ry: number) => {
  const cx = x / v.scale - v.ox
  const cy = y / v.scale - v.oy
  const a = rx / v.scale
  const b = ry / v.scale
  if (a < 0.75 || b < 0.75) {
    ctx.fillRect(Math.floor(cx), Math.floor(cy), 1, 1)
    return
  }
  for (let py = Math.ceil(cy - b - 0.5); py <= Math.floor(cy + b - 0.5); py++) {
    const dy = (py + 0.5 - cy) / b
    const half = a * Math.sqrt(Math.max(0, 1 - dy * dy))
    const x0 = Math.round(cx - half)
    const x1 = Math.round(cx + half)
    if (x1 > x0) ctx.fillRect(x0, py, x1 - x0, 1)
  }
}

const drawFeature = (ctx: Ctx, v: View, f: Feature, look: Look) => {
  if (f.lake) {
    ctx.fillStyle = look.shore
    for (const e of f.lake.foot) fillEllipse(ctx, v, e.x, e.y, e.rx + v.scale * 0.7, e.ry + v.scale * 0.7)
    ctx.fillStyle = look.water
    for (const e of f.lake.foot) fillEllipse(ctx, v, e.x, e.y, e.rx, e.ry)
  }
  // A landmark shows as its glyph (`drawLandmarks`); its walls would only smudge it.
  if (f.landmark) return
  for (const s of f.solids) {
    switch (s.kind) {
      case 'cliff':
        ctx.fillStyle = look.cliff
        for (const e of s.foot) fillEllipse(ctx, v, e.x, e.y, e.rx, e.ry)
        ctx.fillStyle = look.cliffTop
        for (const e of s.foot) fillEllipse(ctx, v, e.x, e.y - e.ry * 0.35, e.rx * 0.7, e.ry * 0.45)
        break
      case 'tree':
        ctx.fillStyle = look.tree
        ctx.fillRect(mapX(v, s.x), mapY(v, s.y) - 1, 2, 2)
        break
      case 'rock':
      case 'tower':
        ctx.fillStyle = look.rock
        ctx.fillRect(mapX(v, s.x), mapY(v, s.y), s.kind === 'tower' ? 2 : 1, s.kind === 'tower' ? 2 : 1)
        break
      case 'log':
        ctx.fillStyle = look.cliff
        ctx.fillRect(mapX(v, s.x), mapY(v, s.y), 2, 1)
        break
      case 'bush':
        ctx.fillStyle = look.bush
        ctx.fillRect(mapX(v, s.x), mapY(v, s.y), 1, 1)
        break
    }
  }
}

/* ---------------- Ground ---------------- */

let groundBuffer: ImageData | null = null

const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] as const

/** The ground, a sparse dither fixed to the world so it scrolls with the player. */
const drawGround = (ctx: Ctx, v: View, base: string, dither: string, seed: number) => {
  groundBuffer ??= ctx.createImageData(S, S)
  const data = groundBuffer.data
  const a = rgb(base)
  const b = rgb(dither)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const c = hash2(x + v.ox, y + v.oy, seed) < 0.12 ? b : a
      const i = (y * S + x) * 4
      data[i] = c[0]
      data[i + 1] = c[1]
      data[i + 2] = c[2]
      data[i + 3] = 255
    }
  }
  ctx.putImageData(groundBuffer, 0, 0)
}

/* ---------------- Rooms ---------------- */

const fillShape = (ctx: Ctx, v: View, room: Room, s: ArenaShape, grow = 0) => {
  if (s.kind === 'circle') return fillEllipse(ctx, v, room.x + s.x, room.y + s.y, s.r + grow, s.r + grow)
  // A convex polygon, a row at a time.
  const pts = s.pts.map(([x, y]) => [(room.x + x) / v.scale - v.ox, (room.y + y) / v.scale - v.oy] as const)
  const ys = pts.map((p) => p[1])
  for (let py = Math.floor(Math.min(...ys)); py <= Math.ceil(Math.max(...ys)); py++) {
    const yc = py + 0.5
    let x0 = Infinity
    let x1 = -Infinity
    for (let j = 0, k = pts.length - 1; j < pts.length; k = j++) {
      const [ax, ay] = pts[k]!
      const [bx, by] = pts[j]!
      if (ay > yc === by > yc) continue
      const x = ax + ((yc - ay) / (by - ay)) * (bx - ax)
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
    }
    if (x1 > x0) ctx.fillRect(Math.round(x0 - grow / v.scale), py, Math.round(x1 - x0 + (2 * grow) / v.scale), 1)
  }
}

/** A room's floor: its rim, the floor, then deep and shallow water and lava. */
const drawRoom = (ctx: Ctx, v: View, room: Room) => {
  ctx.fillStyle = ROOM_LOOK.void
  ctx.fillRect(0, 0, S, S)
  const plan: FloorPlan = room.layout
  ctx.fillStyle = ROOM_LOOK.edge
  for (const s of plan.floor) fillShape(ctx, v, room, s, v.scale)
  ctx.fillStyle = ROOM_LOOK.floor
  for (const s of plan.floor) fillShape(ctx, v, room, s)
  ctx.fillStyle = ROOM_LOOK.shallow
  for (const s of plan.shallow ?? []) fillShape(ctx, v, room, s)
  ctx.fillStyle = ROOM_LOOK.floor
  for (const s of plan.islands ?? []) fillShape(ctx, v, room, s)
  ctx.fillStyle = ROOM_LOOK.water
  for (const s of plan.holes ?? []) fillShape(ctx, v, room, s)
  ctx.fillStyle = ROOM_LOOK.lava
  for (const s of plan.lavaFields ?? []) fillShape(ctx, v, room, s)
  for (const river of plan.lava ?? []) for (const [x, y] of river.pts) fillEllipse(ctx, v, room.x + x, room.y + y, river.w / 2, river.w / 2)
}

/* ---------------- Markers ---------------- */

/**
 * Draws `sprite` at world (x, y) when it's on the map; out of range, `pin`
 * puts it on the rim in its direction instead.
 */
const marker = (ctx: Ctx, v: View, shape: MinimapShape, sprite: PixelSprite, x: number, y: number, pin: boolean) => {
  let mx = x / v.scale - v.ox
  let my = y / v.scale - v.oy
  const dx = mx - C
  const dy = my - C
  const reach = C - PIN
  const out = shape === 'round' ? dx * dx + dy * dy > reach * reach : Math.abs(dx) > reach || Math.abs(dy) > reach
  if (out) {
    if (!pin) return
    const k = shape === 'round' ? reach / Math.hypot(dx, dy) : reach / Math.max(Math.abs(dx), Math.abs(dy))
    mx = C + dx * k
    my = C + dy * k
  }
  ctx.drawImage(sprite, Math.round(mx - sprite.width / 2), Math.round(my - sprite.height / 2))
}

const pickupGlyph = (p: Pickup) => {
  const g = GLYPHS()
  switch (p.kind) {
    case 'pokeball': return g.ball
    case 'tm': return p.source === 'legendary' ? g.gold : g.tm
    case 'megaStone': return g.stone
    case 'evoItem': return g.evo
    case 'alphaPrize': return g.prize
    default: return null
  }
}

/** The camera's view as a faint box, so the map reads against the screen. */
const drawViewBox = (ctx: Ctx, v: View, g: Game) => {
  const x0 = mapX(v, g.camera.x)
  const y0 = mapY(v, g.camera.y)
  const x1 = mapX(v, g.camera.x + g.view.w)
  const y1 = mapY(v, g.camera.y + g.view.h)
  ctx.globalAlpha = 0.35
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x0, y0, x1 - x0, 1)
  ctx.fillRect(x0, y1, x1 - x0 + 1, 1)
  ctx.fillRect(x0, y0, 1, y1 - y0)
  ctx.fillRect(x1, y0, 1, y1 - y0)
  ctx.globalAlpha = 1
}

const heading = (fx: number, fy: number) => (Math.round(Math.atan2(fy, fx) / (Math.PI / 4)) + 8) % 8

/**
 * Draws the mini map of `g` into `ctx` (a `MINIMAP.size` px square canvas),
 * clipped to `shape`. `t` is a clock in seconds, for the blinking.
 */
export const drawMinimap = (ctx: Ctx, g: Game, shape: MinimapShape, t: number) => {
  const me = localPlayer(g)
  const room = roomOf(g)
  const scale = room ? MINIMAP.roomScale : MINIMAP.scale
  const v: View = { ox: Math.floor(me.x / scale) - C, oy: Math.floor(me.y / scale) - C, scale }
  const art = GLYPHS()
  const blink = Math.floor(t * 4) % 2
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1

  if (room) {
    drawRoom(ctx, v, room)
    const inside = g.place.inside
    if (inside?.id === 'cave' && inside.state.stairs) marker(ctx, v, shape, art.stairs, inside.x + inside.state.stairs[0], inside.y + inside.state.stairs[1], true)
    if (inside?.id === 'cave' && inside.state.chest && !inside.state.chest.open) marker(ctx, v, shape, art.events.chest, inside.x + inside.state.chest.x, inside.y + inside.state.chest.y, true)
    if (inside?.id === 'graveyard') marker(ctx, v, shape, art.keystone, inside.x + inside.state.keystone[0], inside.y + inside.state.keystone[1], true)
    if (inside?.id === 'underground') for (const gl of inside.state.glints) if (!gl.dug) marker(ctx, v, shape, art.events.altar, inside.x + gl.x, inside.y + gl.y, false)
  } else {
    const look = LOOKS[g.biome.id]
    drawGround(ctx, v, look.ground, look.dither, g.terrain.seed)
    const cell = TERRAIN.cell
    const x0 = Math.floor((v.ox * scale) / cell)
    const y0 = Math.floor((v.oy * scale) / cell)
    const x1 = Math.floor(((v.ox + S) * scale) / cell)
    const y1 = Math.floor(((v.oy + S) * scale) / cell)
    const marks: Feature[] = []
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const f = featureFor(g.terrain.seed, cx, cy)
        if (!f) continue
        drawFeature(ctx, v, f, look)
        if (f.landmark) marks.push(f)
      }
    }
    // A hidden zone's entrance stays off the map until found: its trees and rocks would give it away.
    if (g.place.entrance && entranceShown(g.place.entrance)) drawFeature(ctx, v, g.place.entrance.terrain, look)
    drawViewBox(ctx, v, g)
    for (const f of marks) {
      const lm = f.landmark!
      const spent = lm.treasure !== null && g.landmarks.looted.has(lm.cell)
      ctx.globalAlpha = spent ? 0.5 : 1
      marker(ctx, v, shape, art.landmark[lm.id], lm.x, lm.y, false)
    }
    ctx.globalAlpha = 1
    for (const ev of g.mapEvents.list) {
      if (ev.gone >= 0) continue
      const at = isMission(ev) ? missionSpot(g, ev) : ev
      marker(ctx, v, shape, art.events[ev.kind], at.x, at.y, MAP_EVENTS[ev.kind].marker)
    }
    const door = g.place.entrance
    if (door?.open && entranceShown(door)) marker(ctx, v, shape, art.place[door.id], door.x, door.y, true)
    const portal = g.rift.portal
    if (portal) marker(ctx, v, shape, art.portal[blink]!, portal.x, portal.y, true)
  }

  for (const p of g.pickups) {
    const sprite = pickupGlyph(p)
    if (sprite && (p.owner === undefined || p.owner === me.slot)) marker(ctx, v, shape, sprite, p.x, p.y, false)
  }
  for (const e of g.enemies) {
    if (e.dying >= 0) continue
    if (e.alpha) marker(ctx, v, shape, art.alpha[e.alpha.enraged ? blink : 0]!, e.x, e.y, true)
    else if (e.boss) marker(ctx, v, shape, art.boss[blink]!, e.x, e.y, true)
  }
  // Teammates, in their slot's color; a fainted one greyed.
  for (const p of g.players) {
    if (p === me || p.gone) continue
    marker(ctx, v, shape, teammate(p.hp > 0 ? slotColor(p.slot) : '#808080'), p.x, p.y, true)
  }
  const arrow = ARROWS()[heading(me.facing.x, me.facing.y)]!
  ctx.drawImage(arrow, C - 4, C - 4)

  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(MASKS()[shape], 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(FRAMES()[shape], 0, 0)
  // North, on the top rim.
  blitPacked(ctx, textSprite('N', '#f8f8f8', DARK), C, 3)
}

const teammates = new Map<string, PixelSprite>()
const teammate = (color: string) => {
  let s = teammates.get(color)
  if (!s) teammates.set(color, (s = glyph(DOT, { c: color, w: '#ffffff' })))
  return s
}

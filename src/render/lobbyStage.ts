import type { Dir8 } from '../engine/math'
import { context2d, createCanvas, lazy, onCanvasReset } from '../engine/pixelart'
import { createRng, range } from '../engine/rng'
import type { GameModeId } from '../data/gameModes'
import { shadow } from './draw'
import { drawPokemon, loadedSprites, loadSpecies, type Dex } from './sprites'

/**
 * The lobby's stage, side on: sky and clouds, hills, grass, the raised round
 * platform and the wild Pokémon around it, drawn on the game's canvas in the
 * meadow's place while the lobby is up. Everything hangs from `StageAnchor`
 * (the platform's middle and the line its cast stands on), so a wider or taller
 * view only shows more sky and grass at the sides, never stretched. The cast on
 * the platform and the places on the horizon are the lobby's own (`ui/title.ts`),
 * drawn a size up in whole device pixels. Presentation only.
 */

/** Where the stage stands in view px. */
export type StageAnchor = { x: number; feet: number }

/** A wild Pokémon around the platform: `x` from its middle, `y` from the feet line (world px); `air` hovers over its shadow. */
type Wild = { dex: Dex; x: number; y: number; dir: Dir8; air?: number }

/** The horde around Survivors' platform; the other modes bring their own, or nobody. */
const HORDE: readonly Wild[] = [
  { dex: 19, x: -126, y: 17, dir: 2 },
  { dex: 41, x: -106, y: -6, dir: 2, air: 15 },
  { dex: 66, x: -152, y: 3, dir: 2 },
  { dex: 92, x: 98, y: -7, dir: 6, air: 11 },
  { dex: 19, x: 132, y: 22, dir: 6 },
  { dex: 16, x: 156, y: 4, dir: 6 },
]

/** Who waits around the platform in each mode. Arena, Dojo and Realm keep the platform to its own cast. */
const WILD: Record<GameModeId, readonly Wild[]> = {
  survivors: HORDE,
  legends: [],
  challenge: [],
  coop: [HORDE[0]!, HORDE[3]!, HORDE[4]!, HORDE[1]!],
  arena: [],
  dojo: [],
  realm: [],
}

/** The species `mode` draws around the platform: the menus' sprite stream keeps these. */
export const stageDex = (mode: GameModeId): Dex[] => [...new Set(WILD[mode].map((w) => w.dex))]

/** Starts loading what `mode` shows around the platform (the sheets it stops showing are swept like any other menu sprite). */
export const loadStage = (mode: GameModeId) => {
  for (const dex of stageDex(mode)) void loadSpecies(dex).catch(() => {})
}

export type LobbyStage = { time: number }

export const createLobbyStage = (): LobbyStage => ({ time: 0 })

/* ---------------- The backdrop ---------------- */

/** How far over the feet line the horizon sits, and how far over the horizon the hills reach (world px). */
const HORIZON_RISE = 26
const HILLS_FAR = 38
const HILLS_NEAR = 16

/** The platform: half its width and its top's half height, and how deep its earth shows (world px). */
const PLATFORM = { rx: 62, ry: 12, depth: 7 } as const

type Palette = {
  sky: readonly string[]
  far: string
  near: string
  grass: string
  grassLight: string
  tuft: string
  top: string
  topLight: string
  earth: string
  earthDark: string
  shade: string
}

const DAY: Palette = {
  sky: ['#5db3ec', '#74bff0', '#8ecbf2', '#a8d8f4', '#c0e4f3'],
  far: '#b5dfc0',
  near: '#92cd86',
  grass: '#7cb95c',
  grassLight: '#86c365',
  tuft: '#5f9c47',
  top: '#8bc968',
  topLight: '#9ad477',
  earth: '#a58657',
  earthDark: '#84683f',
  shade: '#6aa44f',
}

/** The Noite das Bruxas: the same stage after dark. */
const NIGHT: Palette = {
  sky: ['#15123a', '#1f1a4c', '#2b2360', '#3a2d70', '#4d3a80'],
  far: '#2e3a66',
  near: '#27405a',
  grass: '#2a4a48',
  grassLight: '#305250',
  tuft: '#1e3838',
  top: '#3a6258',
  topLight: '#467064',
  earth: '#5a4a50',
  earthDark: '#40343c',
  shade: '#223e3c',
}

/** A hill's top at `x`, as gentle overlapping waves, in steps of 3 px so it reads as pixel art. */
const hillTop = (x: number, seed: number) => {
  const wave = Math.sin(x / 67 + seed) * 0.55 + Math.sin(x / 29 + seed * 2.3) * 0.28 + Math.sin(x / 151 + seed * 0.7) * 0.5
  return Math.round(wave * 3) * 3
}

const fillRow = (ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h = 1) => {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

/** The sky's bands, each ragged into the next by a row of dither. */
const paintSky = (ctx: CanvasRenderingContext2D, p: Palette, w: number, horizon: number) => {
  const band = Math.max(8, Math.floor(horizon / p.sky.length))
  p.sky.forEach((color, i) => {
    const top = i * band
    fillRow(ctx, color, 0, top, w, i === p.sky.length - 1 ? horizon - top : band)
    if (i === 0) return
    for (let x = i % 2 === 0 ? 0 : 3; x < w; x += 6) fillRow(ctx, color, x, top - 2, 3, 2)
  })
}

const paintHills = (ctx: CanvasRenderingContext2D, p: Palette, w: number, horizon: number) => {
  for (let x = 0; x < w; x += 3) {
    const far = horizon - HILLS_FAR + hillTop(x, 1.4)
    fillRow(ctx, p.far, x, far, 3, horizon - far)
  }
  for (let x = 0; x < w; x += 3) {
    const near = horizon - HILLS_NEAR + hillTop(x, 4.2) / 2
    fillRow(ctx, p.near, x, near, 3, horizon - near)
  }
}

/** The grass from the horizon down, with its lighter strip and a scatter of tufts on a loose grid. */
const paintGrass = (ctx: CanvasRenderingContext2D, p: Palette, w: number, h: number, horizon: number) => {
  fillRow(ctx, p.grass, 0, horizon, w, h - horizon)
  fillRow(ctx, p.grassLight, 0, horizon, w, 5)
  for (let x = 0; x < w; x += 6) fillRow(ctx, p.grassLight, x, horizon + 5, 3, 2)
  const rng = createRng(7)
  const cell = 26
  for (let y = horizon + 10; y < h; y += cell) {
    for (let x = -cell; x < w; x += cell) {
      const tx = Math.round(x + range(rng, 0, cell))
      const ty = Math.round(y + range(rng, 0, cell - 6))
      if (rng() < 0.35) continue
      fillRow(ctx, p.tuft, tx, ty, 1, 2)
      fillRow(ctx, p.tuft, tx + 2, ty - 1, 1, 3)
      fillRow(ctx, p.tuft, tx + 4, ty, 1, 2)
    }
  }
}

/** Half the row width of an ellipse `y` rows from its middle, stepped to 3 px. */
const stepped = (rx: number, ry: number, y: number) => {
  const k = 1 - (y * y) / (ry * ry)
  return k <= 0 ? 0 : Math.round((rx * Math.sqrt(k)) / 3) * 3
}

/** The raised round platform: its shadow on the grass, its earth and its grassy top. */
const paintPlatform = (ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number) => {
  const { rx, ry, depth } = PLATFORM
  for (let row = -ry; row <= ry; row++) {
    const half = stepped(rx + 6, ry + 2, row)
    fillRow(ctx, p.shade, x - half, y + row + depth + 3, half * 2, 1)
  }
  for (let row = 0; row <= ry; row++) {
    const half = stepped(rx, ry, row)
    fillRow(ctx, p.earthDark, x - half, y + row + depth - 2, half * 2, 3)
    fillRow(ctx, p.earth, x - half, y + row, half * 2, depth - 2)
  }
  for (let row = -ry; row <= ry; row++) {
    const half = stepped(rx, ry, row)
    fillRow(ctx, p.top, x - half, y + row, half * 2, 1)
    const light = stepped(rx - 18, ry - 3, row + 1)
    if (light > 0) fillRow(ctx, p.topLight, x - light, y + row, light * 2, 1)
  }
}

/** Where the platform's middle sits, from the feet line: the cast stands a little behind it. */
const platformY = (feet: number) => feet - 2

type Backdrop = { key: string; canvas: HTMLCanvasElement }

/** One view-sized picture of everything that doesn't move, redrawn only when the view or the anchor changes. */
let backdrop: Backdrop | null = null
onCanvasReset(
  () => (backdrop = null),
  () => backdrop?.canvas,
  'lobby',
)

const stageBackdrop = (w: number, h: number, at: StageAnchor, night: boolean) => {
  const key = `${w}x${h}:${at.x}:${at.feet}:${night}`
  if (backdrop?.key === key) return backdrop.canvas
  const canvas = backdrop && backdrop.canvas.width === w && backdrop.canvas.height === h ? backdrop.canvas : createCanvas(w, h)
  const ctx = context2d(canvas)
  const p = night ? NIGHT : DAY
  const horizon = at.feet - HORIZON_RISE
  paintSky(ctx, p, w, horizon)
  paintHills(ctx, p, w, horizon)
  paintGrass(ctx, p, w, h, horizon)
  paintPlatform(ctx, p, at.x, platformY(at.feet))
  backdrop = { key, canvas }
  return canvas
}

/* ---------------- Clouds ---------------- */

/** A cloud's outline: rows of [left, width] in 3 px blocks, top to bottom. */
const CLOUD_SHAPES: readonly (readonly (readonly [number, number])[])[] = [
  [[6, 5], [3, 11], [0, 17], [2, 13]],
  [[8, 6], [4, 13], [1, 20], [0, 22], [5, 11]],
]

const clouds = lazy(
  () =>
    CLOUD_SHAPES.map((rows) => {
      const width = Math.max(...rows.map(([l, n]) => l + n))
      const canvas = createCanvas(width * 3, rows.length * 3)
      const ctx = context2d(canvas)
      rows.forEach(([left, n], i) => fillRow(ctx, i === rows.length - 1 ? '#dfeffa' : '#ffffff', left * 3, i * 3, n * 3, 3))
      return canvas
    }),
  'lobby',
)

/** The clouds: drifting one way forever, each wrapping around the view on its own. */
const CLOUDS = [
  { x: 0.08, y: 0.1, shape: 0, speed: 1.4 },
  { x: 0.42, y: 0.2, shape: 1, speed: 0.9 },
  { x: 0.74, y: 0.06, shape: 1, speed: 1.1 },
  { x: 0.9, y: 0.28, shape: 0, speed: 0.7 },
] as const

const drawClouds = (ctx: CanvasRenderingContext2D, s: LobbyStage, w: number, horizon: number, night: boolean) => {
  const art = clouds()
  const span = w + 90
  // After dark the clouds are barely there.
  ctx.globalAlpha = night ? 0.18 : 1
  for (const c of CLOUDS) {
    const x = Math.round(((c.x * w + s.time * c.speed) % span) - 90)
    ctx.drawImage(art[c.shape]!, x, Math.round(c.y * Math.max(60, horizon - 30)))
  }
  ctx.globalAlpha = 1
}

/* ---------------- The whole stage ---------------- */

const drawWild = (ctx: CanvasRenderingContext2D, s: LobbyStage, wild: readonly Wild[], w: number, at: StageAnchor) => {
  // On a phone the wings of the horde come in, so it stays on screen.
  const spread = Math.min(1, (w / 2 - 14) / 165)
  for (const wd of wild) {
    const sprite = loadedSprites(wd.dex)
    if (!sprite) continue
    const x = Math.round(at.x + wd.x * spread)
    const y = Math.round(at.feet + wd.y)
    shadow(ctx, x, y, sprite.bodyW)
    drawPokemon(ctx, sprite, 'Idle', wd.dir, s.time + wd.x / 40, x, y - (wd.air ?? 0))
  }
}

/** Advances the stage by `dt` seconds and draws it for a `w`×`h` view. */
export const drawLobbyStage = (ctx: CanvasRenderingContext2D, s: LobbyStage, w: number, h: number, at: StageAnchor, mode: GameModeId, night: boolean, dt: number) => {
  s.time += dt
  ctx.drawImage(stageBackdrop(w, h, at, night), 0, 0)
  drawClouds(ctx, s, w, at.feet - HORIZON_RISE, night)
  drawWild(ctx, s, WILD[mode], w, at)
}

/** How far (world px) the horizon stands over the feet line: where the lobby sets the places on it. */
export const stageHorizonRise = HORIZON_RISE

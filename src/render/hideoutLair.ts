import { context2d, createCanvas, lazy } from '../engine/pixelart'
import { hash2 } from '../engine/rng'

/**
 * The Rocket Hideout's boss room (`data/rocketHideout.ts`, `HIDEOUT.lair`):
 * Team Rocket's HQ under the Game Corner. Baked once (`bakeLair`): steel
 * plates riveted in a grid, a hazard ring round the arena, the big R painted
 * dark on the floor in a ring (low in contrast, so every attack on it still
 * reads), a steel wall round it and, along its north rim (behind the fight,
 * never in front of it), lab tanks and consoles. Drawn live over it
 * (`drawLairLife`): bubbles rising in the tanks, the consoles' lamps and
 * screens blinking. Pure presentation: the room's shape is the place's.
 */

/** The baked room: its canvas and its top-left in room coordinates (the room's middle at 0, 0). */
export type LairBake = { canvas: HTMLCanvasElement; x: number; y: number }

/** How far past the floor's edge the bake reaches (the wall and the pieces on it). */
const MARGIN = 64

/** The pieces on the north rim: a tank or a console at an angle (radians, 0 east, −π/2 north) just past the floor's edge. */
const RIM = [
  { kind: 'tank', a: Math.PI - 0.06 },
  { kind: 'tank', a: -2.75 },
  { kind: 'console', a: -2.3 },
  { kind: 'tank', a: -1.95 },
  { kind: 'console', a: -1.35 },
  { kind: 'console', a: -1.79 },
  { kind: 'tank', a: -1.19 },
  { kind: 'console', a: -0.84 },
  { kind: 'tank', a: -0.39 },
  { kind: 'tank', a: 0.06 },
] as const

/** Vent grates let into the floor on the diagonals, between the emblem and the hazard ring. */
const GRATES = [
  [-68, -68],
  [68, -68],
  [-68, 68],
  [68, 68],
] as const

/** A piece's feet on the rim of a room of radius `r`. */
const footOf = (a: number, r: number) => ({ x: Math.round(Math.cos(a) * (r + 7)), y: Math.round(Math.sin(a) * (r + 7)) })

/** Pixel rows in a palette, as a canvas. */
const sprite = (rows: readonly string[], pal: Record<string, string>) => {
  const w = Math.max(...rows.map((r) => r.length))
  const c = createCanvas(w, rows.length)
  const g = context2d(c)
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (!pal[ch]) return
      g.fillStyle = pal[ch]!
      g.fillRect(x, y, 1, 1)
    }),
  )
  return c
}

/** A lab tank: a steel cap and base, a green-lit glass cylinder between with a liquid line near its top. */
const TANK = lazy(() =>
  sprite(
    [
      '...11111111...',
      '..1222222221..',
      '.122333333221.',
      '.111111111111.',
      '.1455666666571',
      '.1455666666571',
      '.1888888888871',
      '.1455666666571',
      '.1455666666571',
      '.1456666666571',
      '.1456666666571',
      '.1456666666571',
      '.1456666666571',
      '.1456666666571',
      '.1456666666571',
      '.1456666666571',
      '.1456666666571',
      '.1456666666571',
      '.1456666666571',
      '.1456666666571',
      '.1456666666571',
      '.111111111111.',
      '.122333333221.',
      '.12223aa32221.',
      '.122333333221.',
      '..1111111111..',
    ],
    { 1: '#0e1014', 2: '#4a505e', 3: '#6a7282', 4: '#3aa890', 5: '#8af0d8', 6: '#2a8a76', 7: '#1c5e50', 8: '#7ae8d0', a: '#e02028' },
  ),
)

/** A console: a monitor on a desk, its keys and a row of lamps on its front. */
const CONSOLE = lazy(() =>
  sprite(
    [
      '...11111111111111...',
      '...12222222222221...',
      '...12333333333321...',
      '...12344443443321...',
      '...12333333333321...',
      '...12344334443321...',
      '...12333333333321...',
      '...12222222222221...',
      '...11111122111111...',
      '.111111111111111111.',
      '1555555555555555551',
      '1565656565656565651',
      '1555555555555555551',
      '1111111111111111111',
      '1777777777777777771',
      '1778878878878877771',
      '1777777777777777771',
      '1777777777777777771',
      '1111111111111111111',
    ],
    { 1: '#0e1014', 2: '#4a505e', 3: '#0c2a24', 4: '#40d080', 5: '#6a7282', 6: '#3a3f4c', 7: '#3a3f4c', 8: '#1a1d24' },
  ),
)

/** Team Rocket's R, painted on the floor five px a pixel. */
const R = ['111111.', '11...11', '11...11', '11...11', '111111.', '11.11..', '11..11.', '11...11', '11...11'] as const
const R_SCALE = 5
const R_ORIGIN = { x: -17, y: -24 } as const

const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] as const

/** The R's pixel at room (x, y): 1 the letter, 0 outside it. */
const inR = (x: number, y: number) => {
  const fx = Math.floor((x - R_ORIGIN.x) / R_SCALE)
  const fy = Math.floor((y - R_ORIGIN.y) / R_SCALE)
  return R[fy]?.[fx] === '1'
}

/** The floor's color at room (x, y), `d` from the middle, for a room of radius `r`. */
const floorAt = (x: number, y: number, d: number, r: number): string => {
  if (d > r - 2) return '#14171e'
  if (d > r - 4) return '#232832'
  // The hazard ring round the arena: yellow and black stripes slanting with the angle.
  if (d > r - 16 && d < r - 9) {
    const along = Math.floor(((Math.atan2(y, x) + Math.PI) * r) / 5 + d * 0.6)
    return d < r - 15 || d > r - 10 ? '#14171e' : along % 2 === 0 ? '#d8a818' : '#1a1a1e'
  }
  // The emblem: a dark red ring and the R inside it, outlined.
  if (d >= 42 && d < 47) return d < 43 || d >= 46 ? '#20141a' : '#4a161e'
  if (d < 42) {
    if (inR(x, y)) return inR(x, y - 1) ? '#521820' : '#6a2028'
    if (inR(x + 1, y) || inR(x - 1, y) || inR(x, y + 1) || inR(x, y - 1)) return '#20141a'
  }
  // The vents: a dark slotted grate in a steel frame.
  for (const [gx, gy] of GRATES) {
    const lx = x - gx + 10
    const ly = y - gy + 7
    if (lx < 0 || ly < 0 || lx > 20 || ly > 14) continue
    if (lx === 0 || ly === 0 || lx === 20 || ly === 14) return '#14171e'
    if (lx === 1 || ly === 1) return '#5a6274'
    return ly % 3 === 0 ? '#2a303c' : '#0e1014'
  }
  // Steel plates, 16 px, seams between them and a rivet in each corner; a scuff here and there.
  const tx = ((x % 16) + 16) % 16
  const ty = ((y % 16) + 16) % 16
  if (tx === 0 || ty === 0) return '#262b35'
  if ((tx === 2 || tx === 14) && (ty === 2 || ty === 14)) return '#6a7488'
  if (ty === 1) return '#4a5262'
  const plate = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0
  const h = hash2(x, y, 31)
  if (h < 0.012) return '#2c323e'
  return plate ? '#3a4150' : '#3e4555'
}

/** The wall round the room at (x, y), `d` from the middle: a dark lip, steel panels going up, then the dark. */
const wallAt = (x: number, y: number, d: number, r: number): string => {
  if (d < r + 2) return '#0a0c10'
  if (d < r + 12) {
    const seam = Math.floor(((Math.atan2(y, x) + Math.PI) * r) / 14) !== Math.floor(((Math.atan2(y, x) + Math.PI) * r + 1) / 14)
    return seam ? '#1a1e26' : d < r + 4 ? '#4a5262' : '#2e343f'
  }
  if (d < r + 13) return '#0a0c10'
  return (((x % 12) + 12) % 12 === 0 || ((y % 12) + 12) % 12 === 0) && hash2(Math.floor(x / 12), Math.floor(y / 12), 4) < 0.7 ? '#161a22' : '#101218'
}

/** Bakes the boss's room of radius `r`: its floor, its wall and the pieces on its north rim. */
export const bakeLair = (r: number): LairBake => {
  const half = r + MARGIN
  const size = half * 2
  const canvas = createCanvas(size, size)
  const g = context2d(canvas)
  const img = g.createImageData(size, size)
  for (let py = 0; py < size; py++)
    for (let px = 0; px < size; px++) {
      const x = px - half
      const y = py - half
      const d = Math.hypot(x, y)
      const [cr, cg, cb] = hex(d <= r ? floorAt(x, y, d, r) : wallAt(x, y, d, r))
      const i = (py * size + px) * 4
      img.data[i] = cr
      img.data[i + 1] = cg
      img.data[i + 2] = cb
      img.data[i + 3] = 255
    }
  g.putImageData(img, 0, 0)
  for (const p of RIM) {
    const art = p.kind === 'tank' ? TANK() : CONSOLE()
    const foot = footOf(p.a, r)
    g.drawImage(art, foot.x + half - Math.floor(art.width / 2), foot.y + half - art.height)
  }
  return { canvas, x: -half, y: -half }
}

/** The dark round the room, past its bake: steel grid in the gloom. */
export const LAIR_DARK = '#101218'

/** Draws the room's life over its bake (room middle at `cx`, `cy`): bubbles rising in the tanks, the consoles' lamps and screens. */
export const drawLairLife = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: number) => {
  RIM.forEach((p, i) => {
    const foot = footOf(p.a, r)
    if (p.kind === 'tank') {
      const art = TANK()
      const left = Math.round(cx + foot.x - Math.floor(art.width / 2))
      const top = Math.round(cy + foot.y - art.height)
      ctx.fillStyle = '#c8fff0'
      for (let b = 0; b < 3; b++) {
        const k = (t * (9 + b * 3) + b * 5 + i * 3) % 13
        ctx.fillRect(left + 4 + ((b * 3 + i) % 6), top + 19 - Math.floor(k), 1, 1)
      }
      // Its red lamp at the foot, pulsing.
      if (Math.floor(t * 2 + i) % 2 === 0) {
        ctx.fillStyle = '#ff6a60'
        ctx.fillRect(left + 6, top + 23, 2, 1)
      }
    } else {
      const art = CONSOLE()
      const left = Math.round(cx + foot.x - Math.floor(art.width / 2))
      const top = Math.round(cy + foot.y - art.height)
      // The front's lamps: one lit at a time, running along; a line of text scrolling on the screen.
      const lit = Math.floor(t * 4 + i) % 6
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = k === lit ? (k % 2 ? '#ff5050' : '#60f090') : '#1a1d24'
        ctx.fillRect(left + 3 + k * 3, top + 15, 2, 1)
      }
      ctx.fillStyle = '#90ffc0'
      const row = Math.floor(t * 3 + i) % 4
      ctx.fillRect(left + 5, top + 3 + row, 6 + ((i + row) % 4), 1)
    }
  })
}

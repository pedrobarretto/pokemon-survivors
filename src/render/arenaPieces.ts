import type { ArenaPiece } from '../data/arenas'
import { cylinder, grid, lathe, limb, outline, shade, toSprite, type Ramp } from './sculpt'
import { boulder, brokenPillar, stalagmites, type Piece } from './terrain'

/**
 * The scenery standing in the rift arenas (`data/arenas.ts`), sculpted in
 * code like the map's terrain. Built on first sight and cached by `render/terrain.ts`.
 */

/** A lacquered pillar with gold bands (Bell Tower). */
const redPillar = (): Piece => {
  const g = grid(22, 52)
  const red: Ramp = ['#401008', '#782014', '#a8301c', '#d04828', '#e87040']
  const gold: Ramp = ['#704808', '#b08018', '#e0b030', '#f8e078']
  cylinder(g, 11, 48, 7, 40, red, {
    top: gold,
    paint: (x, y, _nx, e, l) => (e < 3 || (e > 30 && e < 34) || e > 37 ? shade(gold, l, x, y) : null),
  })
  outline(g, '#200804')
  return { sprite: toSprite(g), ax: 11, ay: 48 }
}

/** The great bronze bell on the floor (Bell Tower). */
const bell = (): Piece => {
  const g = grid(44, 50)
  const bronze: Ramp = ['#3c2808', '#6c4814', '#a07020', '#d0a038', '#f0d070']
  limb(g, 22, 9, 22, 4, 2.5, 2.5, bronze)
  // Dome on top, a waist, then the flared lip.
  lathe(g, 22, 44, 34, (t) => (t > 0.86 ? 10 * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.86) / 0.14, 2))) + 0.5 : 10 + 9 * Math.pow(1 - t / 0.86, 3)), bronze, { ry: 0.38 })
  for (const band of [14, 28]) for (let x = 0; x < g.w; x++) if (g.px[(44 - band) * g.w + x]) g.px[(44 - band) * g.w + x] = '#5c3c10'
  outline(g, '#1c1004')
  return { sprite: toSprite(g), ax: 22, ay: 46 }
}

const MARBLE: Ramp = ['#3c4460', '#5c6480', '#8088a4', '#a8b0c8', '#d8e0f0']

/** A fluted marble column with capital and base (Spear Pillar). */
const column = (): Piece => {
  const g = grid(26, 62)
  cylinder(g, 13, 58, 9.5, 5, MARBLE, { ry: 3.5, top: null })
  cylinder(g, 13, 54, 7, 44, MARBLE, {
    top: null,
    paint: (x, y, nx, _e, l) => (Math.round((nx + 1) * 3.5) % 2 === 0 ? shade(MARBLE, l - 0.28, x, y) : null),
  })
  cylinder(g, 13, 11, 10.5, 5, MARBLE, { ry: 4, top: MARBLE })
  outline(g, '#141828')
  return { sprite: toSprite(g), ax: 13, ay: 58 }
}

/** A leaning palm: a ringed trunk, drooping fronds and a few coconuts (Southern Island). */
const palm = (): Piece => {
  const g = grid(44, 60)
  const cx = 20
  const ground = 56
  const trunk: Ramp = ['#3c2814', '#684424', '#94683c', '#b88c58', '#d8b078']
  const leaves: Ramp = ['#10401c', '#20682c', '#38903c', '#60b850', '#a0d870']
  // The trunk bends a little to the right as it rises, darker at every ring.
  const bend = (t: number) => cx + 6 * t * t
  for (let i = 0; i < 8; i++) {
    const t0 = i / 8
    const t1 = (i + 1) / 8
    limb(g, bend(t0), ground - t0 * 38, bend(t1), ground - t1 * 38, 3.2 - t0, 3.2 - t1, i % 2 ? trunk : trunk.slice(0, 4))
  }
  const top = { x: bend(1), y: ground - 39 }
  // Fronds rise out of the crown and droop at the tips.
  for (const [dx, dy, droop] of [[-17, -5, 9], [-11, -11, 6], [0, -13, 4], [11, -11, 6], [18, -4, 9], [-9, 2, 7], [10, 3, 7]] as const) {
    const mx = top.x + dx * 0.6
    const my = top.y + dy * 0.6 - 2
    limb(g, top.x, top.y, mx, my, 2.2, 1.8, leaves)
    limb(g, mx, my, top.x + dx, top.y + dy + droop, 1.8, 0.6, leaves)
  }
  for (const [x, y] of [[-2, 2], [2, 3], [0, 4]] as const) limb(g, top.x + x, top.y + y, top.x + x + 0.5, top.y + y + 0.5, 1.5, 1.5, ['#2c1808', '#4c3018', '#6c4824', '#8c6434'])
  outline(g, '#0c1408')
  return { sprite: toSprite(g), ax: cx, ay: ground }
}

export const ARENA_PIECES: Record<ArenaPiece, (variant: number) => Piece> = {
  seaRock: (v) => boulder({ stone: ['#1c2840', '#2c3c5c', '#46608a', '#6c88b0', '#98b4d8'], outline: '#0a1020', moss: ['#1c5050', '#2c7068', '#48907c'] }, 14, v),
  redPillar,
  bell,
  stalagmite: (v) =>
    stalagmites({ stone: ['#08202a', '#123844', '#1e5260', '#2c6c7c', '#4a8c9c'], outline: '#04101a', crystal: ['#1c4868', '#3880b0', '#78c0e8', '#c8f0ff'] }, v),
  basalt: (v) => boulder({ stone: ['#140a08', '#2c1810', '#48281c', '#683c28', '#8c5838'], outline: '#080404' }, 12 + (v % 2) * 3, v + 3),
  jadeStump: (v) => brokenPillar({ stone: ['#142a1c', '#24442c', '#36603e', '#4e7c56', '#6c9c70'], outline: '#081008' }, v),
  column,
  marbleStump: (v) => brokenPillar({ stone: MARBLE, outline: '#141828' }, v + 2),
  palm,
  meteorCrystal: (v) =>
    stalagmites({ stone: ['#100c18', '#201a2c', '#342c44', '#4c4260', '#6a5e80'], outline: '#06040c', crystal: ['#802810', '#d05818', '#f89850', '#fff0c8'] }, v + 1),
  nightSpire: (v) =>
    stalagmites({ stone: ['#08060e', '#140e20', '#221834', '#32264a', '#463862'], outline: '#020104', crystal: ['#183c50', '#2c8098', '#58e8f0', '#d8ffff'] }, v + 2),
}

/** Shadow width of each piece, and which ones are tall enough to go see-through. */
export const ARENA_SHADOW: Record<ArenaPiece, number> = { seaRock: 10, redPillar: 7, bell: 16, stalagmite: 8, basalt: 10, jadeStump: 8, column: 9, marbleStump: 8, palm: 9, meteorCrystal: 8, nightSpire: 8 }
export const ARENA_TALL: Record<ArenaPiece, boolean> = {
  seaRock: false,
  redPillar: true,
  bell: true,
  stalagmite: true,
  basalt: false,
  jadeStump: false,
  column: true,
  marbleStump: false,
  palm: true,
  meteorCrystal: true,
  nightSpire: true,
}

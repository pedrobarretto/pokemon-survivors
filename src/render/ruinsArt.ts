import { context2d, createCanvas, lazy, type PixelSprite } from '../engine/pixelart'
import { RUINS_SIDES } from '../data/forces'
import type { RuinsRegi } from '../data/legends'

/**
 * The Ruínas da Decisão's art (`game/splitRuins.ts`): a ruin per Regi, cut
 * from the same mossy meadow stone as Regigigas's temple, 40 × 46 px with its
 * foot at the bottom middle: a stepped plinth, two pillars under a broken
 * arch, a gate down into the dark, and its Regi's sign carved over the gate
 * (Regieleki's bolt, Regidrago's open jaws) with the dots of its pattern on
 * the pillars. `asleep`: carved; `lit`: glowing in its Regi's colors;
 * `dark`: its Regi caught, the gate shut with fallen stone and the sign cracked.
 */

export const RUIN = { w: 40, h: 46 } as const

/** Where the gate's dark opens (its middle, from the ruin's top left), for the waking glow. */
export const RUIN_GATE = { x: 20, y: 30 } as const

export type RuinLook = 'asleep' | 'lit' | 'dark'

const STONE = ['#4a4038', '#6c5e50', '#8e7e6a', '#b0a088', '#d0c4a8'] as const
const SEAM = '#3a322c'
const RIM = '#1c1610'
const MOSS = ['#2c6a2c', '#44903a', '#68b450'] as const

/** The Regis' signs over the gate: Regieleki's bolt and Regidrago's jaws, `1` carved (or lit). */
const SIGNS = {
  regieleki: ['...11', '..11.', '.1111', '..11.', '.11..', '11...'],
  regidrago: ['1...1', '11.11', '.111.', '.1.1.', '11.11', '1...1'],
} as const satisfies Record<RuinsRegi, readonly string[]>

/** The dots of each Regi's pattern on the pillars (Regieleki's in lines, Regidrago's in a ring). */
const DOTS = {
  regieleki: [[0, 0], [0, 3], [0, 6], [0, 9]],
  regidrago: [[0, 0], [3, 2], [0, 4], [3, 6]],
} as const satisfies Record<RuinsRegi, readonly (readonly [number, number])[]>

const ruinArt = (regi: RuinsRegi, look: RuinLook): PixelSprite => {
  const canvas = createCanvas(RUIN.w, RUIN.h)
  const ctx = context2d(canvas)
  const px = (x: number, y: number, c: string, pw = 1, ph = 1) => {
    ctx.fillStyle = c
    ctx.fillRect(x, y, pw, ph)
  }
  const block = (x: number, y: number, w: number, h: number) => {
    px(x, y, RIM, w, h)
    px(x + 1, y + 1, STONE[2], w - 2, h - 2)
    px(x + 1, y + 1, STONE[4], w - 2, 1)
    px(x + 1, y + 2, STONE[3], 1, h - 3)
    px(x + w - 2, y + 2, STONE[1], 1, h - 3)
    px(x + 1, y + h - 2, STONE[1], w - 2, 1)
  }
  const [glow, core, spark] = RUINS_SIDES[regi].light
  // The plinth's two steps.
  block(0, 38, 40, 8)
  px(1, 39, STONE[3], 38, 2)
  block(4, 33, 32, 6)
  // The pillars, and the arch over them, broken off on the side away from its twin.
  block(6, 12, 9, 22)
  block(25, 12, 9, 22)
  block(8, 6, 24, 8)
  const away = RUINS_SIDES[regi].side
  const broken = away < 0 ? [8, 9, 10, 11, 12] : [27, 28, 29, 30, 31]
  for (const [i, x] of broken.entries()) {
    ctx.clearRect(x, 6, 1, 1 + ((i * 3) % 4))
    px(x, 6 + ((i * 3) % 4) + 1, RIM)
  }
  block(13, 2, 14, 5)
  // The gate.
  px(15, 14, '#100c08', 10, 20)
  px(15, 14, '#241c14', 10, 2)
  px(16, 16, '#1a140e', 8, 18)
  px(17, 28, '#2a2219', 6, 1)
  px(16, 30, '#3a3024', 8, 1)
  px(15, 32, '#4a4038', 10, 1)
  // Seams and moss.
  for (const [x, y, w] of [[2, 42, 10], [20, 43, 14], [8, 22, 4], [27, 27, 4], [10, 9, 5]] as const) px(x, y, SEAM, w, 1)
  for (const [x, y, w, c] of [[7, 13, 3, 1], [26, 13, 4, 1], [14, 3, 4, 1], [1, 37, 5, 0], [33, 37, 6, 1]] as const) {
    px(x, y, MOSS[c + 1]!, w, 1)
    px(x + 1, y + 1, MOSS[c]!, Math.max(1, w - 2), 1)
  }
  // The sign over the gate and the dots on the pillars.
  const lit = look === 'lit'
  for (const [r, row] of SIGNS[regi].entries()) {
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== '1') continue
      const x = 18 + c
      const y = 7 + r
      if (lit) px(x, y, (r + c) % 3 === 0 ? spark : core)
      else px(x, y, look === 'dark' && (r + c) % 2 === 0 ? STONE[2] : SEAM)
    }
  }
  if (lit) {
    px(17, 6, glow, 7, 1)
    px(17, 13, glow, 7, 1)
  }
  for (const [x0] of [[9], [28]] as const) {
    for (const [dx, dy] of DOTS[regi]) {
      if (lit) {
        px(x0 + dx, 17 + dy, glow, 2, 2)
        px(x0 + dx, 17 + dy, core)
      } else {
        px(x0 + dx, 17 + dy, SEAM, 2, 2)
        px(x0 + dx + 1, 19 + dy, STONE[3])
      }
    }
  }
  if (look === 'dark') {
    // Its Regi is caught: fallen stone shuts the gate, and a crack runs down the sign.
    for (const [x, y, w, h] of [[15, 24, 6, 5], [20, 22, 5, 6], [16, 29, 9, 4], [17, 19, 4, 4]] as const) block(x, y, w, h)
    for (let i = 0; i < 7; i++) px(20 + (i % 2), 3 + i, RIM)
  }
  return canvas
}

/** Each Regi's ruin in each look, built once. */
const looks = (regi: RuinsRegi): Record<RuinLook, PixelSprite> => ({ asleep: ruinArt(regi, 'asleep'), lit: ruinArt(regi, 'lit'), dark: ruinArt(regi, 'dark') })

export const RUINS_ART = lazy((): Record<RuinsRegi, Record<RuinLook, PixelSprite>> => ({ regieleki: looks('regieleki'), regidrago: looks('regidrago') }))

/** The Ruins shrunk to an arrow's icon: both signs lit side by side. */
export const ruinsIcon = lazy(() => {
  const canvas = createCanvas(14, 12)
  const ctx = context2d(canvas)
  ctx.drawImage(RUINS_ART().regieleki.lit, 14, 4, 12, 12, -4, 0, 12, 12)
  ctx.drawImage(RUINS_ART().regidrago.lit, 14, 4, 12, 12, 6, 0, 12, 12)
  return canvas
})

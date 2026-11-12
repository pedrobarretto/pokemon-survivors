import { context2d, createCanvas, fromStrings, lazy, type Palette, type PixelSprite } from '../engine/pixelart'

/**
 * Pixel art of the Safári and Game Corner wave's families
 * (`game/scKitMoves.ts`, `game/scKitSystem.ts`): the sprites their effects
 * blit and their move icons. Only the engine is imported, so `art.ts` can
 * spread the icons in without a cycle.
 */

const sprite = (rows: readonly string[], palette: Palette) => {
  const w = Math.max(...rows.map((r) => r.length))
  return fromStrings(rows.map((r) => r.padEnd(w, '.')), palette)
}

/** A one-pixel dark outline around a sprite. */
const outline = (s: PixelSprite, color = '#181818'): PixelSprite => {
  const canvas = createCanvas(s.width + 2, s.height + 2)
  const ctx = context2d(canvas)
  const sil = createCanvas(s.width, s.height)
  const sctx = context2d(sil)
  sctx.drawImage(s, 0, 0)
  sctx.globalCompositeOperation = 'source-in'
  sctx.fillStyle = color
  sctx.fillRect(0, 0, sil.width, sil.height)
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]] as const) ctx.drawImage(sil, dx, dy)
  ctx.drawImage(s, 1, 1)
  return canvas
}

const icon = (rows: readonly string[], palette: Palette) => () => outline(sprite(rows, palette))

/* ---------------- Effect sprites ---------------- */

const SLUDGE: Palette = { 1: '#3c1850', 2: '#7838a0', 3: '#b068d8', 4: '#e8c0f8' }
const HORN: Palette = { 1: '#584838', 2: '#c8b8a0', 3: '#f8f0e0', 4: '#ffffff' }
const WATER: Palette = { 1: '#1c5890', 2: '#3888d0', 3: '#88c8f0', 4: '#e8f8ff' }
const MOON: Palette = { 1: '#a87828', 2: '#e8c050', 3: '#f8e8a0', 4: '#fffff0', 5: '#584878' }

export const SC_KIT_FX = {
  /** Nidoran♀'s glob of sludge in flight, and the barbs of her ring (a quill pointing right, rotated to its heading). */
  glob: lazy(() => outline(sprite(['.2332.', '233442', '233332', '223322', '.2222.', '..21..'], SLUDGE), '#28102c')),
  quill: lazy(() => outline(sprite(['22.....', '3344...', '.34444.', '3344...', '22.....'], { 2: '#a050d0', 3: '#d088f0', 4: '#f8e8ff' }), '#3c1850')),
  /** A splat of sludge on the ground, in three sizes of drop. */
  drop: lazy(() => sprite(['.22.', '2332', '2342', '.22.'], SLUDGE)),
  /** Nidoran♂'s horn tip, pointing right. */
  horn: lazy(() => outline(sprite(['22......', '2332....', '.23332..', '..233344', '.23332..', '2332....', '22......'], HORN), '#2c2018')),
  /** Moonlight's crescent glint, and the full moon's small moons by phase over Cleffa's head (0 new to 4 full). */
  glint: lazy(() => sprite(['..4..', '..3..', '43334', '..3..', '..4..'], MOON)),
  moons: [
    lazy(() => sprite(['.555.', '55555', '55555', '55555', '.555.'], MOON)),
    lazy(() => sprite(['.553.', '55532', '55532', '55532', '.553.'], MOON)),
    lazy(() => sprite(['.533.', '55332', '55332', '55332', '.533.'], MOON)),
    lazy(() => sprite(['.333.', '53332', '53332', '53332', '.333.'], MOON)),
    lazy(() => outline(sprite(['.343.', '34443', '34433', '33432', '.322.'], MOON), '#584878')),
  ],
  /** Phione's bubble, and a droplet of its splash and Dive's geyser. */
  bubble: lazy(() => sprite(['.111.', '14431', '14331', '13331', '.111.'], { 1: '#3888d0', 3: '#a8e0f8', 4: '#ffffff' })),
  droplet: lazy(() => sprite(['.3.', '343', '232', '.2.'], WATER)),
} as const

/* ---------------- Move icons ---------------- */

export const SC_KIT_ICONS = {
  sludge: icon(['...22.....', '..2332....', '.233442...', '2333342...', '2333332.2.', '22333222.2', '.2222222..', '..2..2....', '..2.......', '.......2..'], SLUDGE),
  furyAttack: icon(['22........', '2332......', '.23332....', '..233344..', '.23332....', '2332...4..', '22...4....', '....4..4..', '..4....4..', '.....4....'], HORN),
  moonlight: icon(['....4.....', '...343....', '..2233....', '.2233.....', '.233......', '.233......', '.2233.....', '..2233..4.', '...2333.3.', '....222.4.'], MOON),
  dive: icon(['....3.....', '...343....', '...333....', '..33333...', '..23332...', '1..222..1.', '21.....12.', '.21...12..', '..21212...', '...121....'], WATER),
} as const satisfies Record<string, () => PixelSprite>

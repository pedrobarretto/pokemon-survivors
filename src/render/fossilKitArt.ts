import { context2d, createCanvas, fromStrings, lazy, type Palette, type PixelSprite } from '../engine/pixelart'

/**
 * Pixel art of the fossil families (`game/fossilKitMoves.ts`): the sprites
 * their effects blit and their move icons. Only the engine is imported, so
 * `art.ts` can spread the icons in without a cycle.
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

/** Wing Attack's blade: a crescent of wind off a rock-grey wing, pointing along the sweep (1 shade, 2 wing, 3 the edge's glint). */
const WING = ['.......11111', '.....112222.', '....12233...', '...1233.....', '..1233......', '.1233.......', '.123........', '123.........', '13..........']

/** Aerodactyl's dive: a stone wing swept back (1 outline, 2 membrane, 3 the bones' light, 4 Mega's red), pointing right. */
const DIVE_WING = ['1.........', '121.......', '12211.....', '1222211...', '123332221.', '1111111111']

/** A shell spike, pointing right (1 shade, 2 shell, 3 the tip's shine). */
const SPIKE = ['111....', '12211..', '1233321', '12211..', '111....']

/** A shard of Omastar's smashed shell, its spiral's groove across it (4). */
const SHARD = ['..111.', '.12221', '123321', '124431', '.1221.', '..11..']

/** Roots bursting out of the ground (4 the root, 5 Lileep's pink tips, 1–3 the clod they heave up). */
const ROOTS = [
  '....5.....5.....',
  '....4....45.....',
  '..5.44...4...5..',
  '..4..4..44..44..',
  '..44.44.4..44...',
  '...4444444444...',
  '....44444444....',
  '..122222222221..',
  '.12233333332221.',
  '1111111111111111',
]

/** Crush Claw's three claw tips raked across, pointing along the sweep (1 shade, 2 claw, 3 shine). */
const CLAW = ['1..1..1.', '21.21.21', '.21.21.2', '..3..3..']

/** Bolt Beak's beak of lightning, pointing right (1 shade, 2 yellow, 3 pale, 4 white tip). */
const BEAK = ['.11......', '1221.....', '123321...', '12344431.', '123321...', '1221.....', '.11......']

/** An icicle falling point first (1 shade, 2 ice, 3 shine). */
const ICICLE = ['11111', '12321', '12321', '12321', '.121.', '.121.', '.131.', '.121.', '..1..']

/** Dracovish's jaws, pointing right: the top and bottom halves that open and snap (1 outline, 2 scales, 3 the pale jaw, 4 teeth). */
const JAW_TOP = ['...1111111..', '..122222221.', '.12233332221', '122333333331', '14.4.4.4.41.']
const JAW_BOTTOM = ['14.4.4.4.41.', '122333333331', '.12222222221', '..11111111..']

const WIND = { 1: '#584870', 2: '#d0c0f0', 3: '#ffffff' }
const STONE_WING = { 1: '#3a3048', 2: '#8878a0', 3: '#c8b8d8' }
const MEGA_WING = { 1: '#3a2030', 2: '#906078', 3: '#e8a0b8' }

export const FOSSIL_FX = {
  wing: lazy(() => sprite(WING, WIND)),
  diveWing: lazy(() => outline(sprite(DIVE_WING, STONE_WING), '#181020')),
  megaWing: lazy(() => outline(sprite(DIVE_WING, MEGA_WING), '#200810')),
  spike: lazy(() => sprite(SPIKE, { 1: '#5a4028', 2: '#d8c098', 3: '#fff8e0' })),
  /** Spike Cannon with the shell smashed: hotter, angrier spikes. */
  spikeHot: lazy(() => sprite(SPIKE, { 1: '#702818', 2: '#f09048', 3: '#fff0c0' })),
  shard: lazy(() => outline(sprite(SHARD, { 1: '#4a3828', 2: '#c8a868', 3: '#f0d8a0', 4: '#806040' }), '#20140c')),
  roots: lazy(() => sprite(ROOTS, { 1: '#4a3420', 2: '#7a5838', 3: '#a07850', 4: '#6a4828', 5: '#e890c8' })),
  /** Cradily's roots: thicker, and a green tinge to the tips. */
  rootsRooted: lazy(() => sprite(ROOTS, { 1: '#4a3420', 2: '#7a5838', 3: '#a07850', 4: '#584020', 5: '#a8e070' })),
  claw: lazy(() => sprite(CLAW, { 1: '#405048', 2: '#e8f0e8', 3: '#ffffff' })),
  beak: lazy(() => outline(sprite(BEAK, { 1: '#806010', 2: '#f8d030', 3: '#fff090', 4: '#ffffff' }), '#302008')),
  icicle: lazy(() => outline(sprite(ICICLE, { 1: '#3878a8', 2: '#a8e0f8', 3: '#ffffff' }), '#183048')),
  jawTop: lazy(() => sprite(JAW_TOP, { 1: '#183850', 2: '#4878a0', 3: '#a8d0e8', 4: '#ffffff' })),
  jawBottom: lazy(() => sprite(JAW_BOTTOM, { 1: '#183850', 2: '#4878a0', 3: '#a8d0e8', 4: '#ffffff' })),
} as const

/* ---------------- Move icons ---------------- */

export const FOSSIL_KIT_ICONS = {
  wingAttack: icon(['1.........', '21........', '221.......', '2221...11.', '.2221.1221', '..22212221', '...2222221', '....222221', '.....2221.', '......11..'], { 1: '#3a3048', 2: '#a898b8' }),
  spikeCannon: icon(['11........', '1221......', '123321....', '1221..11..', '11..1221..', '....123321', '11..1221..', '1221..11..', '123321....', '1221......', '11........'], { 1: '#5a4028', 2: '#d8c098', 3: '#fff8e0' }),
  ingrain: icon(['..5...5...', '..4..45...', '.44..4..5.', '..4.44.44.', '..44444...', '...444....', '.1222221..', '122333221.', '1111111111'], { 1: '#4a3420', 2: '#7a5838', 3: '#a07850', 4: '#6a4828', 5: '#e890c8' }),
  crushClaw: icon(['1...1...1.', '21..21..21', '.21..21..2', '..21..21..', '...21..21.', '....3...3.'], { 1: '#405048', 2: '#e8f0e8', 3: '#ffffff' }),
  boltBeak: icon(['.11.......', '1221......', '12321.....', '1233321...', '12344443.1', '1233321..1', '12321...1.', '1221...1..', '.11....1..'], { 1: '#806010', 2: '#f8d030', 3: '#fff090', 4: '#ffffff' }),
  icicleCrash: icon(['111.111.11', '121.121.12', '121.121.12', '.1...1...1', '.1...1....', '..........', '.2..2..2..', '2.22.22.22'], { 1: '#3878a8', 2: '#a8e0f8' }),
  fishiousRend: icon(['...1111111', '..12222221', '.122333221', '1223333331', '14.4.4.41.', '14.4.4.41.', '1223333331', '.122222221', '..11111111'], { 1: '#183850', 2: '#4878a0', 3: '#a8d0e8', 4: '#ffffff' }),
} as const satisfies Record<string, () => PixelSprite>

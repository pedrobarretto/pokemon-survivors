import { context2d, createCanvas, fromStrings, lazy, type Palette, type PixelSprite } from '../engine/pixelart'

/**
 * Pixel art of Temporada 1's mechanic families (`game/seasonOneKitMoves.ts`):
 * the sprites their effects blit and their move icons. Only the engine is
 * imported, so `art.ts` can spread the icons in without a cycle.
 */

const sprite = (rows: readonly string[], palette: Palette) => {
  const w = Math.max(...rows.map((r) => r.length))
  return fromStrings(rows.map((r) => r.padEnd(w, '.')), palette)
}

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

/** A running mouse, two frames (the legs swap). */
const MOUSE = [
  ['..11....', '.1221.11', '1232211.', '12222211', '.1.1.1..'],
  ['..11....', '.1221.11', '1232211.', '12222211', '..1.1.1.'],
]

const WHEEL = ['..1111..', '.122221.', '12133121', '12322321', '12322321', '12133121', '.122221.', '..1111..']
const SLIME = ['...1111...', '.1122221..', '123322221.', '1222222221', '.1122211..', '...111....']
const ORB = ['..1111..', '.122221.', '12333321', '12344321', '12344321', '12333321', '.122221.', '..1111..']
const CROSS = ['1......1', '21....12', '.21..12.', '..2112..', '..2112..', '.21..12.', '21....12', '1......1']
const CLAW = ['..1.....', '..11....', '...21...', '...121..', '....221.', '....1221', '...12221', '..12221.']

export const KIT_FX = {
  mouse: MOUSE.map((rows) => lazy(() => outline(sprite(rows, { 1: '#685040', 2: '#f0e8d8', 3: '#181818' }), '#382818'))),
  wheelElectric: lazy(() => sprite(WHEEL, { 1: '#785010', 2: '#f8d030', 3: '#fff8c8' })),
  wheelDark: lazy(() => sprite(WHEEL, { 1: '#201030', 2: '#785090', 3: '#d8a8f0' })),
  slime: lazy(() => sprite(SLIME, { 1: '#584088', 2: '#a890c8', 3: '#d8c8f0' })),
  zenOrb: lazy(() => sprite(ORB, { 1: '#583888', 2: '#a868d8', 3: '#e0a8f8', 4: '#ffffff' })),
  cross: lazy(() => sprite(CROSS, { 1: '#ffffff', 2: '#f8d878' })),
  claw: lazy(() => sprite(CLAW, { 1: '#ffffff', 2: '#c8a8e8' })),
}

export const SEASON_ONE_KIT_ICONS = {
  crossChop: icon(['1........1', '21......12', '.21....12.', '..21..12..', '...2112...', '...2112...', '..21..12..', '.21....12.', '21......12', '1........1'], { 1: '#c84030', 2: '#f8a048' }),
  nightSlash: icon(['........11', '......1221', '....12221.', '..12221...', '.1221.....', '1221......', '121.......'], { 1: '#201030', 2: '#a068d8' }),
  dragonPulse: icon(['...1111...', '.11222211.', '.1233332.1', '1232332321', '12322 2321'.replace(' ', '3'), '1232332321', '.1233332.1', '.11222211.', '...1111...'], { 1: '#402888', 2: '#7048d8', 3: '#d0b8f8' }),
  waterPulse: icon(['...1111...', '..1.22.1..', '.1.2332.1.', '1.233332.1', '1.233332.1', '.1.2332.1.', '..1.22.1..', '...1111...'], { 1: '#2858a8', 2: '#58a8e8', 3: '#d8f0f8' }),
  populationBomb: icon(['.11...11..', '1221.1221.', '12221222..', '.1222221..', '..12321...', '.123332111', '.1222221.1', '..11111...'], { 1: '#685040', 2: '#f0e8d8', 3: '#181818' }),
  jetPunch: icon(['...1111...', '..122221..', '.12333321.', '1233333321', '1233333321', '1222222221', '.12222221.', '..111111..', '1.1.1.1.1.'], { 1: '#1848a8', 2: '#58a8e8', 3: '#e8f8ff' }),
  auraWheel: icon(['..11111...', '.1222221..', '1213331210', '1231113210', '1231113210', '1213331210', '.1222221..', '..11111...'].map((r) => r.replace(/0/g, '.')), { 1: '#785010', 2: '#f8d030', 3: '#a860f0' }),
  rotomDischarge: icon(['....11....', '...121....', '..1221....', '.122211...', '11222221..', '..1122211.', '....1221..', '....121...', '....11....'], { 1: '#886010', 2: '#f8d850' }),
  forecast: icon(['...1111...', '.11222211.', '1222332221', '1223333221', '1223333221', '1222332221', '.11222211.', '...1111...', '.1..1..1..', '1..1..1...'], { 1: '#5878a8', 2: '#a8c8e8', 3: '#f8f8ff' }),
  firePunch: icon(['...1.1....', '..121211..', '..122221..', '.1233321..', '123333321.', '123333321.', '.1233321..', '..11111...'], { 1: '#a02010', 2: '#f07830', 3: '#f8d060' }),
  xScissor: icon(['1........1', '11......11', '.21....12.', '..21..12..', '...2112...', '...2112...', '..21..12..', '.21....12.', '11......11', '1........1'], { 1: '#487018', 2: '#b8d858' }),
  shadowClaw: icon(['.1.1.1....', '.1.1.1....', '.1.1.1....', '.12121....', '.1222221..', '..122221..', '...1221...', '...1111...'], { 1: '#301848', 2: '#7848c8' }),
  orderUp: icon(['1......1..', '11....121.', '121..12221', '12211222.1', '.12222221.', '..122221..', '...1221...', '....11....'], { 1: '#c85838', 2: '#f8a878' }),
} as const satisfies Record<string, () => PixelSprite>

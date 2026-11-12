import { context2d, createCanvas, fromStrings, lazy, type PixelSprite } from '../engine/pixelart'

/**
 * The Ovo de Manaphy, as in the games: a sea-blue egg, clear at the edges,
 * with a red core and a few yellow speckles. Its scene (`ui/manaphyEgg.ts`)
 * draws it at three times this size and beats the core; the gift box shows
 * its icon (`ui/gifts.ts`).
 */

const ROWS = [
  '.....1111.....',
  '...11344311...',
  '..1344433321..',
  '.134433333221.',
  '.133337333221.',
  '13333333332221',
  '13333555333221',
  '13375666533221',
  '13335665533721',
  '13335555532221',
  '12333553332221',
  '.123333332221.',
  '.122337322221.',
  '..1222222221..',
  '...11222211...',
  '.....1111.....',
]

const PALETTE = { 1: '#1c4880', 2: '#4890d0', 3: '#88c8f0', 4: '#e8f8ff', 5: '#d82848', 6: '#f87888', 7: '#f8d848' } as const

export const manaphyEggSprite = lazy(() => fromStrings(ROWS, PALETTE))

/** The gift box's icon: the egg with a dark outline, as the other eggs' icons. */
export const manaphyEggIcon = lazy((): string => {
  const egg: PixelSprite = manaphyEggSprite()
  const canvas = createCanvas(egg.width + 2, egg.height + 2)
  const ctx = context2d(canvas)
  const sil = createCanvas(egg.width, egg.height)
  const sctx = context2d(sil)
  sctx.drawImage(egg, 0, 0)
  sctx.globalCompositeOperation = 'source-in'
  sctx.fillStyle = '#0c1c38'
  sctx.fillRect(0, 0, sil.width, sil.height)
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]] as const) ctx.drawImage(sil, dx, dy)
  ctx.drawImage(egg, 1, 1)
  return canvas.toDataURL()
})

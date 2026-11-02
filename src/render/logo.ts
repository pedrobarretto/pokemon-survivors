import { context2d, createCanvas, onCanvasReset, type PixelSprite } from '../engine/pixelart'
import { PICKUPS } from './art'
import { logoJack } from './halloweenArt'

/**
 * The "POKéMON SURVIVORS" logo as pixel art: the game font rasterized at its
 * native 8px grid (16px for the chunky top line), thresholded to hard pixels,
 * then outlined and drop-shadowed like a sprite.
 */

const FONT = '"Press Start 2P"'

/** Crops a canvas to its opaque pixels. */
const crop = (canvas: HTMLCanvasElement) => {
  const { data } = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height)
  let minX = canvas.width, maxX = -1, minY = canvas.height, maxY = -1
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3]! === 0) continue
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
  }
  const out = createCanvas(maxX - minX + 1, maxY - minY + 1)
  context2d(out).drawImage(canvas, -minX, -minY)
  return out
}

/** White text in the game font with every pixel fully on or off. `tracking` adds px between letters. */
const textMask = (text: string, size: number, tracking: number) => {
  const chars = [...text]
  const canvas = createCanvas(chars.length * (size + tracking), size * 2)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.font = `${size}px ${FONT}`
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#fff'
  chars.forEach((ch, i) => ctx.fillText(ch, i * (size + tracking), Math.floor(size / 2)))
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i]! >= 128 ? 255 : 0
  ctx.putImageData(img, 0, 0)
  return crop(canvas)
}

/** The mask filled with horizontal color bands, top to bottom (`[color, share of the height]`); each band runs to the bottom until the next one starts. */
const banded = (mask: PixelSprite, bands: ReadonlyArray<readonly [string, number]>) => {
  // Paint the stripes first: `source-in` clears everything outside each shape it draws, so it gets one draw.
  const stripes = createCanvas(mask.width, mask.height)
  const sctx = context2d(stripes)
  let y = 0
  for (const [color, share] of bands) {
    sctx.fillStyle = color
    sctx.fillRect(0, y, mask.width, mask.height - y)
    y += Math.round(mask.height * share)
  }
  const canvas = createCanvas(mask.width, mask.height)
  const ctx = context2d(canvas)
  ctx.drawImage(mask, 0, 0)
  ctx.globalCompositeOperation = 'source-in'
  ctx.drawImage(stripes, 0, 0)
  return canvas
}

const silhouette = (mask: PixelSprite, color: string) => banded(mask, [[color, 1]])

/** Fill with a square outline of `thickness` px and a solid drop shadow `drop` px below. */
const lettering = (mask: PixelSprite, fill: PixelSprite, outline: string, thickness: number, drop: number) => {
  const canvas = createCanvas(mask.width + thickness * 2, mask.height + thickness * 2 + drop)
  const ctx = context2d(canvas)
  const shade = silhouette(mask, '#101830')
  const line = silhouette(mask, outline)
  for (let dy = -thickness; dy <= thickness; dy++) {
    for (let dx = -thickness; dx <= thickness; dx++) ctx.drawImage(shade, thickness + dx, thickness + dy + drop)
  }
  for (let dy = -thickness; dy <= thickness; dy++) {
    for (let dx = -thickness; dx <= thickness; dx++) ctx.drawImage(line, thickness + dx, thickness + dy)
  }
  ctx.drawImage(fill, thickness, thickness)
  return canvas
}

/** Builds the logo; `haunted` (the Noite das Bruxas) paints SURVIVORS pumpkin orange on witch purple, between two jack-o'-lanterns. */
const build = (haunted: boolean) => {
  const topMask = textMask('POKéMON', 16, 0)
  const top = lettering(topMask, banded(topMask, [['#fff070', 0.2], ['#ffcb05', 0.55], ['#f0a000', 0.25]]), haunted ? '#5a2088' : '#2a5aa8', 2, 3)
  const bottomMask = textMask('SURVIVORS', 8, 2)
  const bottom = haunted
    ? lettering(bottomMask, banded(bottomMask, [['#ffd060', 0.35], ['#f88820', 0.65]]), '#3a1450', 1, 2)
    : lettering(bottomMask, banded(bottomMask, [['#ffffff', 0.6], ['#d0d8f0', 0.4]]), '#c82828', 1, 2)
  const ball = haunted ? logoJack() : PICKUPS.pokeball()
  const gap = 4
  const bottomRow = bottom.width + (ball.width + gap) * 2
  const canvas = createCanvas(Math.max(top.width, bottomRow), top.height + bottom.height + 2)
  const ctx = context2d(canvas)
  ctx.drawImage(top, Math.floor((canvas.width - top.width) / 2), 0)
  const rowX = Math.floor((canvas.width - bottomRow) / 2)
  const rowY = top.height + 2
  const ballY = rowY + Math.floor((bottom.height - 2 - ball.height) / 2)
  ctx.drawImage(ball, rowX, ballY)
  ctx.drawImage(bottom, rowX + ball.width + gap, rowY)
  ctx.drawImage(ball, rowX + bottomRow - ball.width, ballY)
  return canvas
}

const logos = new Map<boolean, Promise<HTMLCanvasElement>>()
onCanvasReset(() => logos.clear(), undefined, 'lobby')

/** The logo sprite (`haunted`: the Noite das Bruxas one), built once the game font has loaded. */
export const titleLogo = (haunted = false) => {
  let logo = logos.get(haunted)
  if (!logo) {
    const make = () => build(haunted)
    logos.set(haunted, (logo = document.fonts.load(`16px ${FONT}`).then(make, make)))
  }
  return logo
}

/** Largest whole number of device px per logo px that fits `maxW`×`maxH` CSS px, so every logo pixel stays square. */
export const logoScale = (logoW: number, logoH: number, maxW: number, maxH: number, dpr: number) =>
  Math.max(1, Math.floor(Math.min((maxW * dpr) / logoW, (maxH * dpr) / logoH)))

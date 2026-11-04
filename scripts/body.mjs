// Measures a sprite's body (the opaque box of the first Walk frame) straight from
// the PNG, so the game's hitboxes are data (`body` in sprites.generated.json)
// instead of a canvas readback that depends on when the image downloaded.
import { readPng } from './png.mjs'

/**
 * The opaque box of the frame at the sheet's top left, like the game measured
 * it in a canvas: `bodyW`, `bodyH` and `footY` (feet below the frame's center).
 */
export const measureBody = async (file, frameWidth, frameHeight) => {
  const { width, rgba } = await readPng(file)
  let minX = frameWidth, maxX = 0, minY = frameHeight, maxY = 0
  for (let y = 0; y < frameHeight; y++) {
    for (let x = 0; x < frameWidth; x++) {
      if (rgba[(y * width + x) * 4 + 3] > 0) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x)
        minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      }
    }
  }
  return { bodyW: maxX - minX + 1, bodyH: maxY - minY + 1, footY: maxY - frameHeight / 2 }
}

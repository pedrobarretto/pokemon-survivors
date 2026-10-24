import { BIOMES, type BiomeId } from '../data/biomes'
import type { LandmarkPiece } from '../data/landmarks'
import type { PlacePiece } from '../data/places'
import type { SolidKind } from '../data/terrain'
import { canvasCache, context2d, createCanvas, dropKept, keepPacked, type Packed } from '../engine/pixelart'

/**
 * Painted scenery (made with PixelLab) standing in for pieces sculpted in
 * code: `public/assets/scenery/<file>.png`, trimmed to the art. A kind's looks
 * are picked by biome (or shared by all), by variant and, for a landmark's
 * treasure, by whether it was taken. Until a picture arrives the sculpted
 * piece shows instead, so nothing waits on the network. Pictures only change
 * the look: hitboxes and the simulation never read them.
 */

/**
 * A drawn piece: its picture packed on its biome's atlas pages (`keepPacked`; shared pictures
 * on their own), the pixel on the world anchor and the half-width of its foot, for its shadow.
 */
export type ArtPiece = { packed: Packed; ax: number; ay: number; foot: number }

/** A kind's files: one per variant (cycled), and the woken ones for a looted treasure. */
type Looks = { files: readonly string[]; open?: readonly string[] }

type SceneryKind = SolidKind | PlacePiece | LandmarkPiece

const each = (kind: string, n: number) => (biome: BiomeId) => Array.from({ length: n }, (_, i) => `${biome}-${kind}-${i}`)

const SCENERY: Partial<Record<SceneryKind, (biome: BiomeId) => Looks>> = {
  tower: (b) => ({ files: [`${b}-tower`] }),
  tree: (b) => ({ files: each('tree', 3)(b) }),
  rock: (b) => ({ files: each('rock', 3)(b) }),
  bush: (b) => ({ files: each('bush', 3)(b) }),
  tent: (b) => ({ files: each('tent', 2)(b) }),
  altar: (b) => ({ files: [`${b}-altar`], open: [`${b}-altar-lit`] }),
  menhir: (b) => ({ files: each('menhir', 3)(b), open: each('menhir-lit', 3)(b) }),
  tombstone: () => ({ files: ['tombstone-0', 'tombstone-1', 'tombstone-2'] }),
  windStone: () => ({ files: ['wind-stone-0', 'wind-stone-1'] }),
  // Variant 1 is the stone Spiritomb broke out of.
  keystone: () => ({ files: ['keystone', 'keystone-broken'] }),
}

/** Pictures drawn on their own, outside the biome table: the altar event's pedestal. */
const ONE_OFFS = ['pedestal'] as const

/** Every scenery file, for the test that checks they all exist. */
export const sceneryFiles = () => {
  const biomes = Object.keys(BIOMES) as BiomeId[]
  const looks = Object.values(SCENERY).flatMap((of) => biomes.map(of))
  return [...new Set([...looks.flatMap((l) => [...l.files, ...(l.open ?? [])]), ...ONE_OFFS])]
}

/** Whether `kind` has painted art (then it isn't sculpted ahead of time). */
export const hasScenery = (kind: string): kind is SceneryKind => kind in SCENERY

const images = new Map<string, HTMLImageElement>()
const pieces = canvasCache<string, ArtPiece>()

const image = (file: string) => {
  let img = images.get(file)
  if (!img) {
    img = new Image()
    img.src = `${import.meta.env.BASE_URL}assets/scenery/${file}.png`
    images.set(file, img)
  }
  return img
}

/** Rows at the bottom of the art that make its foot, the part that meets the ground. */
const FOOT_ROWS = 6

/**
 * Copies a loaded picture to a canvas and finds its foot: the span its lowest
 * rows cover. The anchor is the foot's middle on the bottom row, so a lopsided
 * tree stands on its trunk and its shadow sits under the part touching the ground.
 */
const toPiece = (img: HTMLImageElement, group: string): ArtPiece => {
  const sprite = createCanvas(img.naturalWidth, img.naturalHeight)
  const ctx = context2d(sprite)
  ctx.drawImage(img, 0, 0)
  const { width: w, height: h } = sprite
  const rows = Math.min(FOOT_ROWS, h)
  const alpha = ctx.getImageData(0, h - rows, w, rows).data
  let x0 = w
  let x1 = -1
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[(y * w + x) * 4 + 3]! < 128) continue
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
    }
  }
  if (x1 < 0) [x0, x1] = [0, w - 1]
  return { packed: keepPacked(group, sprite), ax: Math.round((x0 + x1) / 2), ay: h - 2, foot: Math.max(3, Math.round((x1 - x0) / 2)) }
}

const BIOME_IDS = Object.keys(BIOMES) as BiomeId[]

/** The atlas group of a biome's pictures (by their file's prefix), or of the shared ones. */
const groupOf = (file: string) => `scenery:${BIOME_IDS.find((b) => file.startsWith(`${b}-`)) ?? 'shared'}`

/** A picture by file, or null while it loads. */
const pieceOfFile = (file: string) => {
  let piece = pieces.get(file)
  if (piece) return piece
  const img = image(file)
  if (!img.complete || !img.naturalWidth) return null
  pieces.set(file, (piece = toPiece(img, groupOf(file))))
  return piece
}

/** The painted look of a piece, or null when it has none or its picture is still on the way (it starts loading). */
export const sceneryPiece = (biome: BiomeId, kind: string, variant: number, open = false): ArtPiece | null => {
  if (!hasScenery(kind)) return null
  const looks = SCENERY[kind]!(biome)
  const files = open && looks.open ? looks.open : looks.files
  return pieceOfFile(files[variant % files.length]!)
}

/** A one-off picture outside the biome table (a map event's), or null while it loads. */
export const sceneryArt = (file: (typeof ONE_OFFS)[number]) => pieceOfFile(file)

/** Lets go of the pictures of every biome not in `keep` (shared ones stay): a run never walks back. */
export const keepScenery = (keep: readonly BiomeId[]) => {
  const gone = BIOME_IDS.filter((b) => !keep.includes(b))
  for (const file of [...images.keys()]) {
    if (!gone.some((b) => file.startsWith(`${b}-`))) continue
    images.delete(file)
    pieces.delete(file)
  }
  for (const b of gone) dropKept(`scenery:${b}`)
}

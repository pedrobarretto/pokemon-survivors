import { BIOMES, type BiomeId } from '../data/biomes'
import type { LandmarkPiece } from '../data/landmarks'
import type { PlacePiece } from '../data/places'
import type { SolidKind } from '../data/terrain'
import { artImages, canvasCache, context2d, dropKept, keepPacked, readPixels, type Packed } from '../engine/pixelart'

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

/** Kinds whose pictures are shared by every biome. */
const SHARED: ReadonlySet<SceneryKind> = new Set(['tombstone', 'windStone', 'keystone'])

/** Biomes painted throughout: every kind in `SCENERY` has its pictures there. */
const PAINTED: ReadonlySet<BiomeId> = new Set(['meadow', 'forest', 'cave', 'snow', 'tower'])

/**
 * The newer biomes paint only their towers (`TOWER_FEET`), by variant: the
 * desert's pyramids, Mt. Chimney's cone, the wreck on the beach, the Power
 * Plant's generator hall. A null keeps the sculpted piece (the lighthouse, the
 * smokestack), as does every other kind there.
 */
const OWN_TOWERS: Partial<Record<BiomeId, readonly (string | null)[]>> = {
  beach: [null, 'beach-tower-1'],
  plant: [null, 'plant-tower-1'],
  desert: ['desert-tower-0', 'desert-tower-1'],
  volcano: ['volcano-tower-0'],
}

/** Pictures drawn on their own, outside the biome table: the altar event's pedestal. */
const ONE_OFFS = ['pedestal'] as const

/** Every scenery file, for the test that checks they all exist. */
export const sceneryFiles = () => {
  const looks = Object.values(SCENERY).flatMap((of) => [...PAINTED].map(of))
  const towers = Object.values(OWN_TOWERS).flatMap((files) => files.flatMap((f) => (f ? [f] : [])))
  return [...new Set([...looks.flatMap((l) => [...l.files, ...(l.open ?? [])]), ...towers, ...ONE_OFFS])]
}

const isSceneryKind = (kind: string): kind is SceneryKind => kind in SCENERY

/** The picture of a piece in `biome`, or null when it's sculpted there. */
const fileOf = (biome: BiomeId, kind: string, variant: number, open: boolean): string | null => {
  if (!isSceneryKind(kind)) return null
  const own = kind === 'tower' ? OWN_TOWERS[biome] : undefined
  if (own) return own[variant % own.length] ?? null
  if (!PAINTED.has(biome) && !SHARED.has(kind)) return null
  const looks = SCENERY[kind]!(biome)
  const files = open && looks.open ? looks.open : looks.files
  return files[variant % files.length]!
}

/** Whether a piece has painted art in `biome` (then it isn't sculpted ahead of time). */
export const hasScenery = (kind: string, biome: BiomeId, variant = 0) => fileOf(biome, kind, variant, false) !== null

const pictures = artImages((file: string) => `${import.meta.env.BASE_URL}assets/scenery/${file}.png`)
const pieces = canvasCache<string, ArtPiece>()

/** Rows at the bottom of the art that make its foot, the part that meets the ground. */
const FOOT_ROWS = 6

/**
 * Finds a picture's foot, on its canvas copy: the span its lowest rows cover.
 * The anchor is the foot's middle on the bottom row, so a lopsided tree stands
 * on its trunk and its shadow sits under the part touching the ground.
 */
const toPiece = (sprite: HTMLCanvasElement, group: string): ArtPiece => {
  const ctx = context2d(sprite)
  const { width: w, height: h } = sprite
  const rows = Math.min(FOOT_ROWS, h)
  // Unreadable (`readPixels`): no foot found, so the whole width stands on the ground.
  const alpha = readPixels(ctx, 0, h - rows, w, rows)?.data
  let x0 = w
  let x1 = -1
  for (let y = 0; alpha && y < rows; y++) {
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

/** A picture by file, or null while it loads or after it failed (`artImages`). */
const pieceOfFile = (file: string) => {
  let piece = pieces.get(file)
  if (piece) return piece
  const sprite = pictures.copy(file)
  if (!sprite) return null
  pieces.set(file, (piece = toPiece(sprite, groupOf(file))))
  return piece
}

/**
 * The painted look of a piece, or null when it has none or its picture is still on the way (it starts loading).
 * A treasure's woken look starts loading with its plain one, and until it arrives the plain picture stands in:
 * falling back to the sculpted piece flashed a ruin grey the moment it woke.
 */
export const sceneryPiece = (biome: BiomeId, kind: string, variant: number, open = false): ArtPiece | null => {
  const plain = fileOf(biome, kind, variant, false)
  if (!plain) return null
  const woken = fileOf(biome, kind, variant, true)
  if (woken && woken !== plain) pictures.get(woken)
  return (open && woken ? pieceOfFile(woken) : null) ?? pieceOfFile(plain)
}

/** A one-off picture outside the biome table (a map event's), or null while it loads. */
export const sceneryArt = (file: (typeof ONE_OFFS)[number]) => pieceOfFile(file)

/** Lets go of the pictures of every biome not in `keep` (shared ones stay): walking back loads them again. */
export const keepScenery = (keep: readonly BiomeId[]) => {
  const gone = BIOME_IDS.filter((b) => !keep.includes(b))
  for (const file of [...pictures.keys()]) {
    if (!gone.some((b) => file.startsWith(`${b}-`))) continue
    pictures.forget(file)
    pieces.delete(file)
  }
  for (const b of gone) dropKept(`scenery:${b}`)
}

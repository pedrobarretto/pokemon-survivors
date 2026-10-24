import { clamp, dir8, type Dir8, type Vec } from '../engine/math'
import { blitCentered, canvasCache, context2d, createCanvas, drawable, ellipse, glow, lazy, onCanvasReset } from '../engine/pixelart'
import { EMOTES, type Emote } from './art'
import { drawSparkles, shadow } from './draw'
import { LANTERN_ART, lanternString, stringLanterns, type LanternKind, type LanternString } from './lanterns'
import { detail } from './quality'
import { drawPokemon, loadedSprites, loadSpecies, type SpeciesSprites } from './sprites'
import type { PlazaStage } from '../data/festivals'
import type { ShopLevel, ShopProp } from '../data/shop'
import { CARAVAN, STALLS, type StallId } from '../data/visitors'

/**
 * The Kecleon plaza: the lobby's shop as a place in the meadow, east of the
 * partner's home. The cobblestones are drawn in code (and cached); the
 * building of the shop's level and the props are PixelLab PNGs
 * (`public/assets/shop/`), anchored by the bottom center of what they paint,
 * with no ground of their own: each casts a shadow on the cobblestones (its
 * own silhouette squashed flat, or a soft ellipse under the deep 3/4
 * buildings). The shopkeepers are Kecleon's own sheets, plus its purple
 * brother from Lv 2, recolored from the same sheets. Visitors come by too
 * (`PlazaVisitors`, set by the shell): Meowth's weekend caravan, a seasonal
 * stall and the golden Kecleon statue. Around a Festival da Praça
 * (`PlazaFestival`, set by the shell) the fountain stands in front of the
 * shop, and while one runs the plaza becomes the Lantern Ring (`RING`): a
 * curbed round square with its own approach, the gate, the wishing tree,
 * Lanturn's Lantern Market, a wheel of lantern strings and, at the end, the
 * Togepi float and a warm dusk, by the pot's stage. The building
 * and each visitor keep an invisible footprint walkers go around (`padsOf`).
 * Pure presentation, like the rest of the lobby.
 */

export const KECLEON_DEX = 352
/** Its official name, as the dialogue box shows it. */
export const KECLEON_NAME = 'Kecleon'
export type { ShopLevel }

/** Where the plaza's building stands from home (the lobby's resting view center), world px: off a desktop's right edge, low enough that the edge marker pointing to it clears the lobby's right rail. */
export const PLAZA_OFFSET = { x: 520, y: 150 } as const

/** The props the plaza draws so far, of the levels' `props` (the Expansão shelf lists only these; the string lights come later). */
export const PLAZA_PROPS: readonly ShopProp[] = ['board', 'flowers', 'statue']

/** Who comes by the plaza today (the shell works it out from the save and the day): Meowth's caravan, a seasonal stall, the golden statue. */
export type PlazaVisitors = { caravan: boolean; stall: StallId | null; statue: boolean }

export const NO_VISITORS: PlazaVisitors = { caravan: false, stall: null, statue: false }

/**
 * The Festival da Praça on the plaza (the shell works it out from
 * `festivalView`): the fountain stands from the week before a festival opens;
 * while it `running`, the donors' plaque, the Lantern Festival's pieces and
 * the grown cobblestones stand too, dressed by the pot's stage (`PlazaStage`).
 */
export type PlazaFestival = { fountain: boolean; stage: PlazaStage; running: boolean }

export const NO_FESTIVAL: PlazaFestival = { fountain: false, stage: 0, running: false }

/** Lanturn, the Lantern Market's keeper, at its stall on the Ring's east side while a festival runs. */
export const LANTURN = { dex: 171, name: 'Lanturn' } as const
/** Volbeat and Illumise, who come to the wishing tree at dusk (stage 3). */
const FIREFLY_DEX = [313, 314] as const

/** The species the festival puts on the plaza, for the sprite stream to keep. */
export const festivalSprites = (f: PlazaFestival): number[] => (f.fountain && f.running ? [LANTURN.dex, ...(f.stage >= 3 ? FIREFLY_DEX : [])] : [])

/** Who talks at the plaza: a shopkeeper (the shop), Meowth (his caravan), a seasonal stall's keeper, Lanturn (a word, then the festival's sheet), or the festival's fountain or plaque (its sheet). */
export type PlazaNpc = 'keeper' | 'meowth' | 'stall' | 'lanturn' | 'fountain' | 'plaque'

/** The plaza's PNGs (`public/assets/shop/`), by id. */
const ART_FILES = {
  lv1: 'shop-lv1',
  lv2: 'shop-lv2',
  lv3: 'shop-lv3',
  lv4: 'shop-lv4',
  lv5: 'shop-lv5',
  lantern: 'prop-lantern',
  board: 'prop-board',
  crates: 'prop-crates',
  flowers: 'prop-flowers',
  pedestal: 'prop-pedestal',
  caravan: 'caravan-meowth',
  'stall-duskull': 'stall-duskull',
  'stall-delibird': 'stall-delibird',
  'fountain-s0-f0': 'festival-fountain-s0-f0',
  'fountain-s0-f1': 'festival-fountain-s0-f1',
  'fountain-s0-f2': 'festival-fountain-s0-f2',
  'fountain-s1-f0': 'festival-fountain-s1-f0',
  'fountain-s1-f1': 'festival-fountain-s1-f1',
  'fountain-s1-f2': 'festival-fountain-s1-f2',
  'fountain-s3-f0': 'festival-fountain-s3-f0',
  'fountain-s3-f1': 'festival-fountain-s3-f1',
  'fountain-s3-f2': 'festival-fountain-s3-f2',
  bunting: 'festival-bunting',
  plaque: 'festival-plaque',
  'lamp-arms': 'festival-lamp',
  'gate-unlit': 'festival-gate-unlit',
  gate: 'festival-gate',
  'tree-s0': 'festival-tree-s0',
  'tree-s1': 'festival-tree-s1',
  'tree-s2': 'festival-tree-s2',
  market: 'festival-market',
  stall: 'festival-stall',
  float: 'festival-float',
  'float-shiny': 'festival-float-shiny',
} as const satisfies Record<string, string>
type ArtId = keyof typeof ART_FILES
const ART_IDS = Object.keys(ART_FILES) as ArtId[]
const artFile = (id: ArtId) => `${import.meta.env.BASE_URL}assets/shop/${ART_FILES[id]}.png`

/** The fountain's water frames for each stage (stage 2 keeps stage 1's fountain, stage 4 stage 3's). */
const FOUNTAIN_FRAMES = {
  0: ['fountain-s0-f0', 'fountain-s0-f1', 'fountain-s0-f2'],
  1: ['fountain-s1-f0', 'fountain-s1-f1', 'fountain-s1-f2'],
  2: ['fountain-s1-f0', 'fountain-s1-f1', 'fountain-s1-f2'],
  3: ['fountain-s3-f0', 'fountain-s3-f1', 'fountain-s3-f2'],
  4: ['fountain-s3-f0', 'fountain-s3-f1', 'fountain-s3-f2'],
} as const satisfies Record<PlazaStage, readonly ArtId[]>

/** The wishing tree by stage (bare, wish tags, lanterns): one canvas and the same feet, so a stage swaps it in place. */
const TREE_ART = { 0: 'tree-s0', 1: 'tree-s1', 2: 'tree-s2', 3: 'tree-s2', 4: 'tree-s2' } as const satisfies Record<PlazaStage, ArtId>

/** The festival's PNGs, loaded only once a festival shows (`festivalArtReady`); the plaza waits for the rest. */
const FESTIVAL_ART: ReadonlySet<ArtId> = new Set([
  ...Object.values(FOUNTAIN_FRAMES).flat(),
  ...Object.values(TREE_ART),
  'bunting',
  'plaque',
  'lamp-arms',
  'gate-unlit',
  'gate',
  'market',
  'stall',
  'float',
  'float-shiny',
])
const BASE_ART = ART_IDS.filter((id) => !FESTIVAL_ART.has(id))
const FESTIVAL_IDS = [...FESTIVAL_ART]

/** A loaded PNG and the box of its painted pixels, so pieces stand on their real feet whatever padding the image has. */
type Art = { img: HTMLImageElement; minX: number; minY: number; maxY: number; w: number; h: number }
const arts = new Map<ArtId, Art>()
let loading = false

/** Alpha bounding box of an image (pixels above a faint alpha). */
const measure = (img: HTMLImageElement): Art => {
  const canvas = createCanvas(img.width, img.height)
  const ctx = context2d(canvas)
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, img.width, img.height).data
  let minX = img.width
  let maxX = -1
  let minY = img.height
  let maxY = -1
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (data[(y * img.width + x) * 4 + 3]! <= 40) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return { img, minX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

/** Tries left after a PNG fails to load (or loads empty or broken), and the wait before the next try. */
const ART_TRIES = 3
const ART_RETRY_MS = 5000

const loadArt = (ids: Iterable<ArtId>, tries = ART_TRIES) => {
  for (const id of ids) {
    const img = new Image()
    img.src = artFile(id)
    const landed = () => {
      if (drawable(img)) arts.set(id, measure(img))
      else if (tries > 1) setTimeout(() => loadArt([id], tries - 1), ART_RETRY_MS)
    }
    void img.decode().then(landed, landed)
  }
}

/** Starts loading the plaza's PNGs and the shopkeeper's sheets (once). Pieces show up as they arrive. */
export const loadPlazaArt = () => {
  if (loading) return
  loading = true
  void loadSpecies(KECLEON_DEX).catch(() => {})
  loadArt(BASE_ART)
}

let festivalAsked = false
let festivalLoaded = false
/** Whether the festival's PNGs are in; the first ask starts loading them, so only players who see a festival download them. */
const festivalArtReady = () => {
  if (festivalLoaded) return true
  if (!festivalAsked) {
    festivalAsked = true
    loadArt(FESTIVAL_IDS)
  }
  festivalLoaded = FESTIVAL_IDS.every((id) => arts.has(id))
  return festivalLoaded
}

/** Draws `art` with the bottom center of its painted box at (x, y); `fromRow` draws only its rows from there down (a counter's front). */
const put = (ctx: CanvasRenderingContext2D, art: Art, x: number, y: number, fromRow = 0) => {
  const dx = Math.round(x - (art.minX + art.w / 2))
  const dy = Math.round(y - art.maxY - 1)
  if (fromRow === 0) return ctx.drawImage(art.img, dx, dy)
  const rows = art.img.height - fromRow
  ctx.drawImage(art.img, 0, fromRow, art.img.width, rows, dx, dy + fromRow, art.img.width, rows)
}

/* ---------------- The purple brother ---------------- */

/** PMD's purple Kecleon: green-dominant pixels move to a purple ramp; the red stripe and the dark outline stay. */
export const purpleize = (src: CanvasImageSource & { width: number; height: number }) => {
  const canvas = createCanvas(src.width, src.height)
  const ctx = context2d(canvas)
  ctx.drawImage(src, 0, 0)
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const a = image.data
  for (let i = 0; i < a.length; i += 4) {
    const r = a[i]!
    const g = a[i + 1]!
    const b = a[i + 2]!
    if (a[i + 3] === 0 || g <= r * 0.9 || g <= b) continue
    a[i] = Math.min(255, g * 0.78 + r * 0.15)
    a[i + 1] = Math.min(255, g * 0.42 + b * 0.2)
    a[i + 2] = Math.min(255, g + 20)
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

type Sheet = SpeciesSprites['anims']['Idle']
const purpleSheet = (sheet: Sheet): Sheet => ({ ...sheet, img: purpleize(sheet.img), overlays: null })

let brother: { from: SpeciesSprites; to: SpeciesSprites } | null = null
onCanvasReset(
  () => (brother = null),
  () => brother?.to,
)

/** The purple brother's sprites, recolored once from the green Kecleon's. */
const brotherSprites = (green: SpeciesSprites) => {
  if (brother?.from !== green) {
    const { Walk, Idle, Hurt } = green.anims
    brother = { from: green, to: { ...green, anims: { Walk: purpleSheet(Walk), Idle: purpleSheet(Idle), Hurt: purpleSheet(Hurt) } } }
  }
  return brother.to
}

/** A shopkeeper's sprites (the brother's recolored), once Kecleon's sheets are loaded. */
export const keeperSprites = (purple: boolean) => {
  const green = loadedSprites(KECLEON_DEX)
  return green && (purple ? brotherSprites(green) : green)
}

/* ---------------- Layout ---------------- */

type Placed = { x: number; y: number }
type KeeperSpot = Placed & { dir: Dir8 }

/** A shadow on the cobblestones, relative to the building's feet: a piece's squashed silhouette (its feet at x, y), or a soft ellipse centered at x, y. */
type Shadow = (Placed & { art: Art }) | (Placed & { rx: number; ry: number })

/** Where everything stands at a level, relative to the building's feet (its bottom center). */
type Layout = {
  building: Art
  /** The building's footprint, never drawn: an ellipse walkers go around (its center's y, and radii). */
  pad: { y: number; rx: number; ry: number }
  /** The green Kecleon, then the purple brother from Lv 2. */
  keepers: readonly KeeperSpot[]
  /** Lv 3's open counter: the image's rows from here down are its front, drawn again over the shopkeepers behind it. */
  counter: number | null
  /** The props, each casting the shadow of its `cast` art when it has one (the lamps keep theirs under the festival's lantern arms). */
  props: readonly (Placed & { id: ArtId; cast?: ArtId })[]
  /** Where the partner stands to shop. */
  spot: Placed
  /** The cobblestones' ellipse (the Ring's floor during a festival). */
  cobbles: Placed & { rx: number; ry: number }
  /** Whether the floor is the festival's Lantern Ring (curbed, with its approach) rather than the cobblestones. */
  ring: boolean
  /** Where the visitors stand, when they come: Meowth's wagon and Meowth, a seasonal stall and its keeper, the golden statue. */
  wagon: Placed
  meowth: KeeperSpot
  stall: Placed
  stallKeeper: KeeperSpot
  statue: Placed
  /** The Festival da Praça's pieces while one shows (`FestivalLayout`). */
  festival: FestivalLayout | null
  /** What the building, the props and the visitors' pieces cast on the cobblestones. */
  shadows: readonly Shadow[]
  /** The boxes (relative to the building's feet) of the building, every piece that casts a shadow and the Ring's approach: with the floor's ellipse, all the plaza draws. */
  pieces: readonly Box[]
  /** The box holding all of it, the floor included. */
  bounds: Box
}

type Box = { left: number; top: number; right: number; bottom: number }

/** The box `art` covers standing with its feet at `p`, as `put` draws it. */
const boxOf = (art: Art, p: Placed): Box => ({ left: p.x - art.w / 2, top: p.y - art.h, right: p.x + art.w / 2, bottom: p.y })

/** The smallest box holding all of `boxes` (at least one). */
const unionOf = ([first, ...rest]: readonly [Box, ...Box[]]): Box =>
  rest.reduce((a, b) => ({ left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) }), first)

/** A festival piece standing with its feet at x, y (relative to the building's), showing `art`. */
type Standing = Placed & { art: Art }

/** A lantern string tied at `from` (relative to the building's feet). */
type Strung = { from: Placed; line: LanternString }

/** A light of the dusk: a soft glow `r` px wide at `alpha`, centered at x, y (relative to the building's feet). */
type Light = Placed & { r: number; alpha: number }

/**
 * The festival on the plaza: the fountain (its stage's water frames) from the
 * week before; while it runs, the Lantern Ring (`RING`) by stage: the
 * plaque, the gate, the wishing tree, the sister stall (null while a seasonal
 * stall holds its spot) and Lanturn's market from the opening, the bunting
 * from 1, the wheel of lantern strings and the lanterns floating on the
 * fountain from 2, and from 3 the Togepi float, Volbeat and Illumise at the
 * tree, the dusk's `lights` and `sky` lanterns rising.
 */
type FestivalLayout = {
  stage: PlazaStage
  fountain: Placed & { frames: readonly Art[] }
  plaque: Placed | null
  bunting: Placed | null
  gate: Standing | null
  tree: Standing | null
  stall: Standing | null
  market: Standing | null
  lanturn: KeeperSpot | null
  float: Standing | null
  strings: readonly Strung[]
  floaters: boolean
  guests: readonly { dex: number; spot: KeeperSpot }[]
  lights: readonly Light[]
  sky: number
}

const layouts = new Map<string, Layout>()

/** Row of `shop-lv3.png` where its counter's front starts (the kiosk's shopkeepers stand behind it). */
const LV3_COUNTER = 122

/** The visitors' footprints (radii, never drawn), each a little wider than what stands on it. */
const VISITOR_PADS = { wagon: { rx: 74, ry: 16 }, stall: { rx: 60, ry: 18 }, statue: { rx: 21, ry: 7 } } as const

/** Where the lamps' feet stand, below the building's. */
const LAMP_Y = 14

/** Where the festival's fountain stands the week before it opens, right of the statue's spot, with a flower pot `flowers` px to each side. */
const FOUNTAIN_BEFORE = { x: 46, y: 128, flowers: 54 } as const

/**
 * The Lantern Ring, the square the plaza becomes while a festival runs,
 * relative to the building's feet: a curbed round `floor` with a cobbled
 * `approach` running south out of the gate. Down its axis (x 0) stand the
 * fountain (its strings tie `crown` px up), the Togepi float (two `planters`
 * hold its spot until it comes) and the gate at the south entrance (posts
 * `post` px off its middle, their lamp heads `head` px up). Four lamps ring
 * the fountain with the shop's two; the plaque and the golden statue flank
 * the fountain. On the east, the sister stall (or a seasonal stall) and
 * Lanturn's market facing in; on the west, the wishing tree with Volbeat and
 * Illumise, and the notice board. Meowth's weekend wagon parks on the grass
 * off the north-west curb, Meowth on the stones beside it.
 */
const RING = {
  floor: { x: 0, y: 128, rx: 262, ry: 198 },
  approach: { half: 30, top: 320, bottom: 420 },
  fountain: { x: 0, y: 116 },
  crown: 74,
  plaque: { x: -66, y: 128 },
  statue: { x: 66, y: 128 },
  float: { x: 0, y: 228 },
  planters: [
    [-18, 228],
    [18, 228],
  ],
  gate: { x: 0, y: 322 },
  post: 49,
  head: 84,
  lamps: [
    [-150, 128],
    [-104, 196],
    [104, 196],
    [150, 128],
  ],
  stall: { x: 200, y: 44 },
  market: { x: 214, y: 154 },
  lanturn: { x: 158, y: 166, dir: 7 },
  tree: { x: -206, y: 154 },
  volbeat: { x: -240, y: 198, dir: 1 },
  illumise: { x: -168, y: 200, dir: 7 },
  board: { x: -170, y: 34 },
  flowers: [
    [-150, 272],
    [150, 272],
  ],
  wagon: { x: -310, y: 20 },
  spot: { x: -36, y: 36 },
} as const
/** The bunting and the lantern strings tie on the lamp's cap, this high above its feet. */
const LAMP_TIE = 40
/**
 * The festival's footprints (radii, `dy` from the feet): the fountain's basin,
 * the plaque's posts, each gate post and ring lamp, the tree's planter, the
 * stalls' counters and the float's wheels (walkers pass behind the float's
 * lantern and the stalls' awnings).
 */
const FESTIVAL_PADS = {
  fountain: { dy: -20, rx: 44, ry: 20 },
  plaque: { rx: 13, ry: 5 },
  post: { rx: 6, ry: 4 },
  lamp: { rx: 5, ry: 3 },
  tree: { dy: -14, rx: 34, ry: 13 },
  stall: { dy: -14, rx: 46, ry: 13 },
  float: { dy: -10, rx: 40, ry: 10 },
} as const

/** The lanterns floating on the fountain's water (stage 2 on), centered from its feet. */
const FLOATERS = [
  [-25, -33],
  [24, -34],
  [-13, -25],
  [14, -25],
] as const
/** Where the sky lanterns hang at the middle of their rise, relative to the building's feet (high over the shop and the meadow), and whether each is a far one; the last ones join at stage 4. */
const SKY_LANTERNS = [
  [-300, -190, 1],
  [-150, -185, 0],
  [-95, -140, 1],
  [130, -186, 0],
  [178, -140, 1],
  [250, -175, 0],
  [62, -200, 1],
  [-215, -160, 1],
  [320, -120, 1],
  [-280, -100, 0],
  [-40, -196, 0],
  [215, -200, 1],
  [100, -160, 1],
  [-260, -190, 0],
  [12, -170, 1],
  [290, -190, 1],
] as const
const SKY_AT = { 3: 10, 4: SKY_LANTERNS.length } as const
/** The fireflies around the wishing tree, from its feet. */
const FIREFLIES = [
  [-60, -110],
  [-30, -70],
  [30, -96],
  [44, -50],
  [-56, -30],
  [-24, 22],
  [52, -20],
  [8, -126],
  [-80, -70],
  [70, -80],
] as const
/** The strings' lantern mixes: the spokes', and the rim's. */
const MIX: readonly LanternKind[] = ['ball', 'kecleon', 'cream']
const RIM: readonly LanternKind[] = ['ball', 'kecleon']
/** How much lower (world px) a desktop's resting view of the plaza sits during a festival, so the float comes into view, as far as the shop's dome still fits. */
const FESTIVAL_DROP = 40

/** The plaza's layout with the festival it shows (none until the festival's PNGs are in). */
const plazaLayout = (plaza: Plaza) => layoutOf(plaza.level, plaza.visitors, plaza.festival.fountain && festivalArtReady() ? plaza.festival : NO_FESTIVAL)

/**
 * The festival's pieces on a plaza whose lamps stand `lamp` px off the
 * middle (`FestivalLayout`); `sister` when no seasonal stall holds the
 * Ring's stall spot.
 */
const festivalLayout = (f: PlazaFestival, lamp: number, sister: boolean): FestivalLayout => {
  const R = RING
  const stage = f.running ? f.stage : 0
  const frames = FOUNTAIN_FRAMES[stage].map((id) => arts.get(id)!)
  if (!f.running)
    return {
      stage,
      fountain: { x: FOUNTAIN_BEFORE.x, y: FOUNTAIN_BEFORE.y, frames },
      plaque: null,
      bunting: null,
      gate: null,
      tree: null,
      stall: null,
      market: null,
      lanturn: null,
      float: null,
      strings: [],
      floaters: false,
      guests: [],
      lights: [],
      sky: 0,
    }
  const standing = (id: ArtId, spot: Placed): Standing => ({ x: spot.x, y: spot.y, art: arts.get(id)! })
  const gate = standing(stage >= 2 ? 'gate' : 'gate-unlit', R.gate)
  const tree = standing(TREE_ART[stage], R.tree)
  const stall = sister ? standing('stall', R.stall) : null
  const market = standing('market', R.market)
  const float = stage >= 3 ? standing(stage >= 4 ? 'float-shiny' : 'float', R.float) : null
  const tie = (from: Placed, to: Placed, sag: number, start: number, kinds: readonly LanternKind[]): Strung => ({
    from,
    line: { dx: to.x - from.x, dy: to.y - from.y, sag, step: 11, start, kinds },
  })
  // Every lamp's cap, the shop's two first, then the ring's (west to east).
  const caps = [{ x: -lamp, y: LAMP_Y }, { x: lamp, y: LAMP_Y }, ...R.lamps.map(([x, y]) => ({ x, y }))].map((p) => ({ x: p.x, y: p.y - LAMP_TIE }))
  const [shopW, shopE, ringW, ringSW, ringSE, ringE] = caps as [Placed, Placed, Placed, Placed, Placed, Placed]
  const crown = { x: R.fountain.x, y: R.fountain.y - R.crown }
  const heads = [-1, 1].map((side) => ({ x: R.gate.x + side * R.post, y: R.gate.y - R.head })) as [Placed, Placed]
  // The wheel: a spoke from the fountain's crown to every lamp, and a rim from lamp to lamp that opens toward the gate.
  const strings =
    stage >= 2
      ? [
          ...caps.map((cap) => tie(crown, cap, 6, 16, MIX)),
          tie(shopW, ringW, 6, 18, RIM),
          tie(ringW, ringSW, 6, 18, RIM),
          tie(ringSW, heads[0], 6, 18, RIM),
          tie(heads[1], ringSE, 6, 18, RIM),
          tie(ringSE, ringE, 6, 18, RIM),
          tie(ringE, shopE, 6, 18, RIM),
        ]
      : []
  const light = (x: number, y: number, r: number, alpha: number): Light => ({ x, y, r, alpha })
  const lights =
    stage >= 3
      ? [
          // The lamps' heads and the lanterns on their arms.
          ...caps.flatMap(({ x, y }) => [light(x, y + LAMP_TIE - 48, 22, 0.3), light(x - 10, y + LAMP_TIE - 32, 7, 0.3), light(x + 10, y + LAMP_TIE - 32, 7, 0.3)]),
          light(R.fountain.x, R.fountain.y - 44, 54, 0.24),
          ...FLOATERS.map(([x, y]) => light(R.fountain.x + x, R.fountain.y + y, 5, 0.3)),
          light(tree.x, tree.y - 66, 40, 0.22),
          ...[stall, market].flatMap((s) => (s ? [light(s.x, s.y - 62, 34, 0.2)] : [])),
          ...heads.map((h) => light(h.x, h.y, 16, 0.3)),
          light(gate.x, gate.y - 52, 34, 0.24),
          ...(float ? [light(float.x, float.y - 52, 44, 0.28)] : []),
          ...strings.flatMap((s) => stringLanterns(s.line).map((l) => light(s.from.x + l.x, s.from.y + l.y + 5, 6, 0.22))),
        ]
      : []
  return {
    stage,
    fountain: { ...R.fountain, frames },
    plaque: R.plaque,
    bunting: stage >= 1 ? { x: -lamp, y: LAMP_Y - LAMP_TIE } : null,
    gate,
    tree,
    stall,
    market,
    lanturn: R.lanturn,
    float,
    strings,
    floaters: stage >= 2,
    guests:
      stage >= 3
        ? [
            { dex: FIREFLY_DEX[0], spot: R.volbeat },
            { dex: FIREFLY_DEX[1], spot: R.illumise },
          ]
        : [],
    lights,
    sky: stage === 3 || stage === 4 ? SKY_AT[stage] : 0,
  }
}

const layoutOf = (level: ShopLevel, v: PlazaVisitors, f: PlazaFestival): Layout | null => {
  const key = `${level}:${v.caravan}:${v.stall}:${v.statue}:${f.fountain}:${f.stage}:${f.running}`
  const cached = layouts.get(key)
  if (cached) return cached
  const building = arts.get(`lv${level}`)
  if (!building || BASE_ART.some((id) => !arts.has(id))) return null
  const half = Math.round(building.w / 2)
  // The 3/4 buildings of Lv 4 and 5 stand on a deep diamond: the footprint and the cobblestones reach back under all of it.
  const depth = level >= 4 ? Math.round(half * 0.45) : 0
  // Lanterns flank the building, the rest of the props sit outside them.
  const lamp = Math.max(104, half + 14)
  const keepers: KeeperSpot[] =
    level === 3
      ? [
          { x: -22, y: LV3_COUNTER + 4 - building.maxY - 1, dir: 0 },
          { x: 8, y: LV3_COUNTER + 4 - building.maxY - 1, dir: 0 },
        ]
      : level === 1
        ? [{ x: half + 4, y: 12, dir: 7 }]
        : [
            { x: -half + 2, y: 14, dir: 1 },
            { x: half - 2, y: 14, dir: 7 },
          ]
  // While a festival runs the plaza is the Lantern Ring, with its own spots for the visitors.
  const ring = f.fountain && f.running
  // The caravan parks west of the shop, a stall stands east of it (where the crates were); the statue keeps the front.
  const wagon = ring ? RING.wagon : { x: -lamp - 118, y: 44 }
  const stall = ring ? RING.stall : { x: lamp + 84, y: 40 }
  const statue = ring ? RING.statue : { x: -Math.round(half * 0.5), y: 92 }
  const wide = v.caravan || v.stall !== null
  const flowers = (spots: readonly (readonly [number, number])[]) => spots.map(([x, y]) => ({ id: 'flowers' as const, x, y }))
  const props: Layout['props'] = ring
    ? [
        // The festival hangs arms of Poké Ball lanterns on the lamps (theirs cast the plain lamp's shadow) and rings the fountain with four more.
        ...[[-lamp, LAMP_Y] as const, [lamp, LAMP_Y] as const, ...RING.lamps].map(([x, y]) => ({ id: 'lamp-arms' as const, cast: 'lantern' as const, x, y })),
        ...(level >= 2 ? [{ id: 'board' as const, ...RING.board }] : []),
        ...flowers(RING.flowers),
        // Until the float comes, planters keep its spot on the axis.
        ...(f.stage < 3 ? flowers(RING.planters) : []),
      ]
    : [
        { id: 'lantern', x: -lamp, y: LAMP_Y },
        { id: 'lantern', x: lamp, y: LAMP_Y },
        ...(v.stall === null ? [{ id: 'crates' as const, x: lamp + 26, y: 30 }] : []),
        ...(level >= 2 ? [{ id: 'board' as const, x: v.caravan ? -lamp - 196 : -lamp - 36, y: v.caravan ? 96 : 58 }] : []),
        ...(level >= 3 ? [{ id: 'flowers' as const, x: -lamp + 2, y: 44 }, { id: 'flowers' as const, x: v.stall ? lamp + 30 : lamp + 16, y: v.stall ? 82 : 66 }] : []),
        ...(f.fountain ? [-1, 1].map((side) => ({ id: 'flowers' as const, x: FOUNTAIN_BEFORE.x + side * FOUNTAIN_BEFORE.flowers, y: FOUNTAIN_BEFORE.y + 2 })) : []),
      ]
  const festival = f.fountain ? festivalLayout(f, lamp, v.stall === null) : null
  // The festival's fountain stands in front of the shop: the stones reach further down for it the week before; the Ring has its own floor.
  const cobbles = ring
    ? RING.floor
    : { x: 0, y: (wide ? 40 : 36) - Math.round(depth * 0.7) + (festival ? 14 : 0), rx: lamp + (wide ? 186 : 66), ry: (wide ? 88 : 78) + Math.round(depth * 1.1) + (festival ? 26 : 0) }
  const shadows: readonly Shadow[] = [
    // The deep 3/4 buildings cast a soft ellipse under their footprint; everything else, its own silhouette.
    depth ? { x: 0, y: -Math.round(half * 0.3), rx: half - 10, ry: Math.round(half * 0.32) } : { x: 0, y: 0, art: building },
    ...props.map((p) => ({ x: p.x, y: p.y, art: arts.get(p.cast ?? p.id)! })),
    ...(v.caravan ? [{ ...wagon, art: arts.get('caravan')! }] : []),
    ...(v.stall ? [{ ...stall, art: arts.get(STALLS[v.stall].art)! }] : []),
    ...(v.statue ? [{ ...statue, art: arts.get('pedestal')! }] : []),
    // A piece that changes by stage keeps its first stage's shadow (the fountain's doesn't grow when the lanterns and the statue come); the bunting and the strings cast none.
    ...(festival ? [{ x: festival.fountain.x, y: festival.fountain.y, art: arts.get('fountain-s0-f0')! }] : []),
    ...(festival?.plaque ? [{ ...festival.plaque, art: arts.get('plaque')! }] : []),
    ...(festival?.gate ? [{ x: festival.gate.x, y: festival.gate.y, art: arts.get('gate-unlit')! }] : []),
    ...(festival?.tree ? [{ x: festival.tree.x, y: festival.tree.y, art: arts.get('tree-s0')! }] : []),
    ...(festival?.stall ? [festival.stall] : []),
    ...(festival?.market ? [festival.market] : []),
    ...(festival?.float ? [{ x: festival.float.x, y: festival.float.y, art: arts.get('float')! }] : []),
  ]
  const a = RING.approach
  const pieceBoxes: [Box, ...Box[]] = [
    boxOf(building, { x: 0, y: 0 }),
    ...(ring ? [{ left: -a.half, top: a.top, right: a.half, bottom: a.bottom }] : []),
    ...shadows.flatMap((s) => ('art' in s ? [boxOf(s.art, s)] : [])),
  ]
  const layout: Layout = {
    building,
    pad: { y: -6 - depth, rx: half + 4 + (depth ? 6 : 0), ry: Math.round(building.w / 7) + depth },
    keepers,
    counter: level === 3 ? LV3_COUNTER : null,
    props,
    // On the Ring the fountain stands on the axis: the partner shops from just west of its crown.
    spot: ring ? RING.spot : { x: 0, y: 34 },
    cobbles,
    ring,
    wagon,
    meowth: { x: wagon.x + 84, y: wagon.y + 16, dir: 1 },
    stall,
    stallKeeper: { x: stall.x - 58, y: stall.y + 12, dir: 7 },
    statue,
    festival,
    shadows,
    // The bunting and the lantern strings hang between pieces inside these boxes already (the sky lanterns don't count).
    pieces: pieceBoxes,
    bounds: unionOf([{ left: cobbles.x - cobbles.rx, top: cobbles.y - cobbles.ry, right: cobbles.x + cobbles.rx, bottom: cobbles.y + cobbles.ry }, ...pieceBoxes]),
  }
  layouts.set(key, layout)
  return layout
}

/* ---------------- State ---------------- */

/** A shopkeeper's reaction: a double hop and an emote, from scene time `at`. */
export type Keeper = { hopAt: number; emote: Emote; dir: Dir8 }

export type Plaza = {
  /** The building's feet, world px. */
  x: number
  y: number
  /** The shop's level (set by the shell: the save's, or the dev override). */
  level: ShopLevel
  keepers: [Keeper, Keeper]
  /** The edge marker as last drawn (world px), for taps. */
  marker: { x: number; y: number; shown: boolean }
  /** The green Kecleon blends into the counter (the 1-in-20 easter egg) until it pops out (`revealKeeper`). */
  hidden: boolean
  /** Scene time the shop last grew a level: dust and sparkles around the new building (`celebratePlaza`). */
  party: number
  /** What the camera leans towards while a sheet is open: 0 the green Kecleon, 1 the purple brother, Meowth's caravan, the seasonal stall or the festival's fountain. */
  focus: 0 | 1 | 'caravan' | 'stall' | 'fountain'
  /** Who comes by today (set by the shell). */
  visitors: PlazaVisitors
  /** The Festival da Praça's fountain and plaque (set by the shell). */
  festival: PlazaFestival
}

export const createPlaza = (home: Vec): Plaza => {
  loadPlazaArt()
  return {
    x: home.x + PLAZA_OFFSET.x,
    y: home.y + PLAZA_OFFSET.y,
    level: 1,
    keepers: [
      { hopAt: -9, emote: 'note', dir: 0 },
      { hopAt: -9, emote: 'sparkle', dir: 0 },
    ],
    marker: { x: 0, y: 0, shown: false },
    hidden: false,
    party: -9,
    focus: 0,
    visitors: NO_VISITORS,
    festival: NO_FESTIVAL,
  }
}

/** The shopkeepers present at the plaza's level, with where they stand (world px). */
const keepersAt = (plaza: Plaza, layout: Layout) => layout.keepers.map((k, i) => ({ keeper: plaza.keepers[i]!, x: plaza.x + k.x, y: plaza.y + k.y, spot: k, purple: i === 1 }))

/** The visitors present, who talks for each and where they stand (relative to the building's feet): Meowth by his wagon, a stall's keeper (or Lanturn) by the stall. */
const npcsAt = (plaza: Plaza, layout: Layout): { who: PlazaNpc; dex: number; spot: KeeperSpot }[] => {
  const v = plaza.visitors
  return [
    ...(v.caravan ? [{ who: 'meowth' as const, dex: CARAVAN.dex, spot: layout.meowth }] : []),
    ...(v.stall ? [{ who: 'stall' as const, dex: STALLS[v.stall].dex, spot: layout.stallKeeper }] : []),
    ...(layout.festival?.lanturn ? [{ who: 'lanturn' as const, dex: LANTURN.dex, spot: layout.festival.lanturn }] : []),
  ]
}

/** The visitors' facing, turned to the partner when it comes close (by `stepPlaza`), keyed by who they are. */
const visitorDirs = new WeakMap<Plaza, Partial<Record<PlazaNpc, Dir8>>>()

/** The shopkeepers hop and pop an emote at scene time `time` (the brother a beat later). */
export const greetKeepers = (plaza: Plaza, time: number) => {
  plaza.keepers[0].hopAt = time
  plaza.keepers[1].hopAt = time + 0.18
}

/** The camouflaged Kecleon pops out at scene time `time`: it shows again, hops and pops a "!". */
export const revealKeeper = (plaza: Plaza, time: number) => {
  plaza.hidden = false
  plaza.keepers[0].emote = 'bang'
  plaza.keepers[0].hopAt = time
}

/** The shop grew to `level` at scene time `time`: the new building stands at once, with dust, sparkles and both shopkeepers cheering. */
export const celebratePlaza = (plaza: Plaza, level: ShopLevel, time: number) => {
  plaza.level = level
  plaza.party = time
  plaza.keepers[0].emote = 'note'
  plaza.keepers[1].emote = 'sparkle'
  greetKeepers(plaza, time + 0.2)
}

/** Turns the shopkeepers in front of the building, and the visitors, towards `partner` when it comes close. */
export const stepPlaza = (plaza: Plaza, partner: Vec | null) => {
  const layout = plazaLayout(plaza)
  if (!layout) return
  const facing = (spot: KeeperSpot, free: boolean) => {
    const x = plaza.x + spot.x
    const y = plaza.y + spot.y
    return partner && free && Math.hypot(partner.x - x, partner.y - y) < 70 ? dir8(partner.x - x, partner.y - y) : spot.dir
  }
  for (let i = 0; i < layout.keepers.length; i++) plaza.keepers[i]!.dir = facing(layout.keepers[i]!, layout.counter === null)
  visitorDirs.set(plaza, Object.fromEntries(npcsAt(plaza, layout).map((n) => [n.who, facing(n.spot, true)])))
}

/** Where the partner stands to shop, world px. */
export const shopSpot = (plaza: Plaza): Vec => {
  const spot = plazaLayout(plaza)?.spot ?? { x: 0, y: 34 }
  return { x: plaza.x + spot.x, y: plaza.y + spot.y }
}

/** How close (world px) the partner must stand to a shopkeeper or the counter to talk. */
const TALK_RANGE = 24

/** Above the head of whoever the partner (feet at `p`) can talk to, world px, and who it is; null when out of range. */
export const talkAnchor = (plaza: Plaza, p: Vec): (Vec & { who: PlazaNpc }) | null => {
  const layout = plazaLayout(plaza)
  if (!layout) return null
  const atCounter = Math.hypot(p.x - plaza.x - layout.spot.x, p.y - plaza.y - layout.spot.y) < TALK_RANGE
  const candidates = [
    ...layout.keepers.map((spot) => ({ spot, who: 'keeper' as PlazaNpc, counter: atCounter })),
    ...npcsAt(plaza, layout).map((n) => ({ spot: n.spot, who: n.who, counter: false })),
  ].flatMap((c) => {
    const d = Math.hypot(p.x - plaza.x - c.spot.x, p.y - plaza.y - c.spot.y)
    return d < TALK_RANGE || c.counter ? [{ ...c, d }] : []
  })
  const best = candidates.reduce<(typeof candidates)[number] | null>((a, c) => (a === null || c.d < a.d ? c : a), null)
  return best ? { x: plaza.x + best.spot.x, y: plaza.y + best.spot.y - 30, who: best.who } : festivalTalk(plaza, layout.festival, p)
}

/** How far (world px) past the fountain's basin the partner may stand to talk to it. */
const FOUNTAIN_REACH = 20

/** Above the fountain or the plaque when the partner (feet at `p`) stands by it, world px, and which; null otherwise. */
const festivalTalk = (plaza: Plaza, f: FestivalLayout | null, p: Vec): (Vec & { who: PlazaNpc }) | null => {
  if (!f) return null
  const { fountain, plaque } = f
  if (plaque && Math.hypot(p.x - plaza.x - plaque.x, p.y - plaza.y - plaque.y) < TALK_RANGE) return { x: plaza.x + plaque.x, y: plaza.y + plaque.y - arts.get('plaque')!.h - 4, who: 'plaque' }
  const pad = FESTIVAL_PADS.fountain
  const dx = (p.x - plaza.x - fountain.x) / (pad.rx + FOUNTAIN_REACH)
  const dy = (p.y - plaza.y - fountain.y - pad.dy) / (pad.ry + FOUNTAIN_REACH)
  return dx * dx + dy * dy < 1 ? { x: plaza.x + fountain.x, y: plaza.y + fountain.y - fountain.frames[0]!.h - 4, who: 'fountain' } : null
}

/** How close (world px) a walker may come to a shopkeeper's feet. */
const KEEPER_ROOM = 12

/**
 * Pushes feet at `v` off the shopkeepers, out of the building's footprint, and out of the ground the
 * building covers behind it (whoever stood there would peek over its roof, as
 * if standing on it), so walkers go around the shop (mutates `v`).
 */
export const pushOut = (plaza: Plaza, v: Vec) => {
  const layout = plazaLayout(plaza)
  if (!layout) return
  // Nobody stands on a shopkeeper's (or a visitor's, or the tree's guests') toes.
  for (const k of [...layout.keepers, ...npcsAt(plaza, layout).map((n) => n.spot), ...(layout.festival?.guests.map((g) => g.spot) ?? [])]) {
    const dx = v.x - plaza.x - k.x
    const dy = v.y - plaza.y - k.y
    const d = Math.hypot(dx, dy)
    if (d >= KEEPER_ROOM) continue
    v.x = plaza.x + k.x + (d > 1e-6 ? (dx / d) * KEEPER_ROOM : KEEPER_ROOM)
    v.y = plaza.y + k.y + (d > 1e-6 ? (dy / d) * KEEPER_ROOM : 0)
  }
  const half = layout.building.w / 2 + 10
  // Well clear of the roof line: feet just above it read as standing on the roof.
  const top = plaza.y - layout.building.h - 24
  const bottom = plaza.y + layout.pad.y
  if (v.y > top && v.y < bottom && Math.abs(v.x - plaza.x) < half) {
    const side = half - Math.abs(v.x - plaza.x)
    if (v.y - top < side) v.y = top
    else v.x = plaza.x + Math.sign(v.x - plaza.x || 1) * half
    return
  }
  // Off the building's footprint and the visitors' (a wagon or a stall is as solid as its footprint, a little taller behind).
  for (const pad of padsOf(plaza, layout)) {
    const { rx, ry } = pad
    const cx = plaza.x + pad.x
    const cy = plaza.y + pad.y
    const dx = (v.x - cx) / rx
    const dy = (v.y - cy) / (v.y < cy ? ry * pad.back : ry)
    const d = dx * dx + dy * dy
    if (d >= 1) continue
    if (d < 1e-6) {
      v.y = cy + ry
      continue
    }
    const k = 1 / Math.sqrt(d)
    v.x = cx + (v.x - cx) * k
    v.y = cy + (v.y - cy) * k
  }
}

type Pad = { x: number; y: number; rx: number; ry: number; back: number }

const padCache = new WeakMap<Layout, readonly Pad[]>()

/**
 * The footprints on the plaza, never drawn: the building's, the visitors' and
 * the festival's (center relative to the building's feet, radii; `back`
 * stretches the solid part behind a tall piece). The gate's are its two
 * posts, so walkers pass under its arch. Built once per layout.
 */
const padsOf = (plaza: Plaza, layout: Layout): readonly Pad[] => {
  const hit = padCache.get(layout)
  if (hit) return hit
  const v = plaza.visitors
  const f = layout.festival
  const pads: Pad[] = [
    { x: 0, y: layout.pad.y, rx: layout.pad.rx, ry: layout.pad.ry, back: 1 },
    ...(v.caravan ? [{ x: layout.wagon.x, y: layout.wagon.y - 6, ...VISITOR_PADS.wagon, back: 3 }] : []),
    ...(v.stall ? [{ x: layout.stall.x, y: layout.stall.y - 16, ...VISITOR_PADS.stall, back: 3 }] : []),
    ...(v.statue ? [{ x: layout.statue.x, y: layout.statue.y - 3, ...VISITOR_PADS.statue, back: 2 }] : []),
    ...(f ? [{ x: f.fountain.x, y: f.fountain.y + FESTIVAL_PADS.fountain.dy, rx: FESTIVAL_PADS.fountain.rx, ry: FESTIVAL_PADS.fountain.ry, back: 1.4 }] : []),
    ...(f?.plaque ? [{ x: f.plaque.x, y: f.plaque.y - 2, ...FESTIVAL_PADS.plaque, back: 2 }] : []),
    ...(f?.gate ? [-1, 1].map((side) => ({ x: f.gate!.x + side * RING.post, y: f.gate!.y - 2, ...FESTIVAL_PADS.post, back: 2 })) : []),
    // The Ring's lamp posts (thin: the lanes between them stay open).
    ...layout.props.flatMap((p) => (p.id === 'lamp-arms' ? [{ x: p.x, y: p.y - 1, ...FESTIVAL_PADS.lamp, back: 1.5 }] : [])),
    ...(
      [
        [f?.tree, FESTIVAL_PADS.tree],
        [f?.stall, FESTIVAL_PADS.stall],
        [f?.market, FESTIVAL_PADS.stall],
        [f?.float, FESTIVAL_PADS.float],
      ] as const
    ).flatMap(([at, pad]) => (at ? [{ x: at.x, y: at.y + pad.dy, rx: pad.rx, ry: pad.ry, back: 1.4 }] : [])),
  ]
  padCache.set(layout, pads)
  return pads
}

/** Who a tap at `at` (world px) is for: the shop (a shopkeeper, the building or the edge marker), Meowth (him or his wagon), a stall, Lanturn (it or its market), the festival's fountain or plaque; null for none. */
export const plazaTapped = (plaza: Plaza, at: Vec): PlazaNpc | null => {
  if (plaza.marker.shown && Math.abs(at.x - plaza.marker.x) <= 18 && Math.abs(at.y - plaza.marker.y) <= 15) return 'keeper'
  const layout = plazaLayout(plaza)
  if (!layout) return null
  const near = (spot: Placed) => Math.abs(at.x - plaza.x - spot.x) <= 12 && at.y <= plaza.y + spot.y + 3 && at.y >= plaza.y + spot.y - 30
  const npc = npcsAt(plaza, layout).find((n) => near(n.spot))
  if (npc) return npc.who
  const over = (art: Art | undefined, spot: Placed) => art !== undefined && Math.abs(at.x - plaza.x - spot.x) <= art.w / 2 && at.y <= plaza.y + spot.y + 4 && at.y >= plaza.y + spot.y - art.h
  if (plaza.visitors.caravan && over(arts.get('caravan'), layout.wagon)) return 'meowth'
  if (plaza.visitors.stall && over(arts.get(STALLS[plaza.visitors.stall].art), layout.stall)) return 'stall'
  const fest = layout.festival
  if (fest?.market && over(fest.market.art, fest.market)) return 'lanturn'
  if (fest?.stall && over(fest.stall.art, fest.stall)) return 'lanturn'
  if (fest?.plaque && over(arts.get('plaque'), fest.plaque)) return 'plaque'
  if (fest && over(fest.fountain.frames[0], fest.fountain)) return 'fountain'
  const half = layout.building.w / 2
  if (Math.abs(at.x - plaza.x) <= half && at.y <= plaza.y + 4 && at.y >= plaza.y - layout.building.h) return 'keeper'
  return keepersAt(plaza, layout).some((k) => near({ x: k.x - plaza.x, y: k.y - plaza.y })) ? 'keeper' : null
}

/**
 * Where the camera (its top-left, world px) frames the plaza for a `w`×`h`
 * view: on portrait screens the building and its shopkeepers fill the upper
 * part, leaving the lower ~45% to the shop's sheet; elsewhere the plaza sits
 * on the left, leaving the right side to the shop's panel.
 */
export const plazaFrame = (plaza: Plaza, w: number, h: number): Vec => {
  const layout = plazaLayout(plaza)
  const tall = layout?.building.h ?? 140
  const framed = frameAt(plaza, layout, tall, w, h)
  // The festival's sheet: the fountain comes up into view, above the sheet on portrait screens, left of it elsewhere.
  const fountain = plaza.focus === 'fountain' ? layout?.festival?.fountain : null
  if (fountain) {
    if (h > w * 1.1) return { x: Math.round(plaza.x + fountain.x - w / 2), y: Math.round(plaza.y + fountain.y - h * 0.36) }
    return { x: framed.x + Math.round(fountain.x * 0.7), y: Math.max(framed.y, plaza.y + fountain.y + 56 - h) }
  }
  // Meowth's caravan or the seasonal stall: portrait screens center on it, the rest lean well over to it.
  if ((plaza.focus === 'caravan' || plaza.focus === 'stall') && layout) {
    const [from, to] = plaza.focus === 'caravan' ? [layout.wagon, layout.meowth] : [layout.stall, layout.stallKeeper]
    const mid = Math.round(from.x + (to.x - from.x) / 2)
    // Portrait: a step down too, so Meowth (in front of the wagon) clears the dialogue box.
    return h > w * 1.1 ? { x: Math.round(plaza.x + mid - w / 2), y: framed.y + 56 } : { x: framed.x + Math.round(mid * 0.7), y: framed.y }
  }
  // A step towards the shopkeeper who talks (the purple brother's shelves).
  const lean = Math.round((layout?.keepers[typeof plaza.focus === 'number' ? plaza.focus : 0]?.x ?? 0) * 0.4)
  return { x: framed.x + lean, y: framed.y }
}

const frameAt = (plaza: Plaza, layout: Layout | null, tall: number, w: number, h: number): Vec => {
  // Portrait: the building's feet about a third down (lower for the tall Lv 4 and 5), so it, the shopkeepers and the partner clear the shop's sheet and Kecleon's box below.
  if (h > w * 1.1) {
    const feet = Math.max(Math.round(h * 0.33), Math.min(tall + 8, Math.round(h * 0.47)))
    return { x: Math.round(plaza.x - w / 2), y: plaza.y - feet }
  }
  const lamp = layout ? Math.max(104, Math.round(layout.building.w / 2) + 14) : 110
  const left = Math.round(Math.max(w * 0.32, lamp + 46))
  const feet = Math.round(Math.min(h - 44, Math.max(h * 0.6, tall + 12)))
  // The Lantern Ring reaches far south: the view steps down toward the float, as far as the shop's dome stays in.
  const drop = layout?.ring ? clamp(feet - tall - 4, 0, FESTIVAL_DROP) : 0
  return { x: plaza.x - left, y: plaza.y - feet + drop }
}

/* ---------------- Drawing ---------------- */

const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] as const

const STONES = ['#d8c8a0', '#cfbd94', '#e0d2ac', '#c8b68c', '#d4c49a'].map(rgb)
const MORTAR = rgb('#a89470')
const STONE_HI = rgb('#ebe0c0')
const STONE_LO = rgb('#bca880')
const TUFT = [rgb('#6aa850'), rgb('#7cc060')] as const

/**
 * The cobblestones: an irregular rounded patch of staggered stones (10×6)
 * with mortar, a lit top edge and a few grass tufts, ringed by a darker band
 * of trodden grass. Built once per size into a canvas centered on its middle.
 */
const cobbles = (() => {
  const cache = new Map<string, HTMLCanvasElement>()
  onCanvasReset(
    () => cache.clear(),
    () => cache,
  )
  return (rx: number, ry: number) => {
    const key = `${rx}x${ry}`
    const hit = cache.get(key)
    if (hit) return hit
    const pad = 4
    const w = rx * 2 + pad * 2 + 1
    const h = ry * 2 + pad * 2 + 1
    const canvas = createCanvas(w, h)
    const ctx = context2d(canvas)
    const image = ctx.createImageData(w, h)
    const px = image.data
    const set = (x: number, y: number, c: readonly number[], alpha = 255) => {
      const i = (y * w + x) * 4
      px[i] = c[0]!
      px[i + 1] = c[1]!
      px[i + 2] = c[2]!
      px[i + 3] = alpha
    }
    const inside = (x: number, y: number) => {
      const dx = x / rx
      const dy = y / ry
      const wobble = 0.06 * Math.sin(x * 0.11 + y * 0.07) + 0.05 * Math.cos(y * 0.13)
      return dx * dx + dy * dy < 1 + wobble
    }
    for (let y = -ry - pad; y <= ry + pad; y++) {
      for (let x = -rx - pad; x <= rx + pad; x++) {
        const cx = x + rx + pad
        const cy = y + ry + pad
        if (!inside(x, y)) {
          // Trodden grass just outside the stones.
          const ex = x / (rx + 3)
          const ey = y / (ry + 3)
          if (ex * ex + ey * ey < 1) set(cx, cy, [24, 56, 24], 70)
          continue
        }
        set(cx, cy, stoneAt(x, y))
      }
    }
    tufts(-rx, -ry, rx * 2, ry * 2, inside, (x, y, c) => set(x + rx + pad, y + ry + pad, c))
    ctx.putImageData(image, 0, 0)
    cache.set(key, canvas)
    return canvas
  }
})()

/** The stone pattern's pixel at (x, y) from its origin: staggered 10×6 stones with mortar, a lit top edge and a shaded bottom one. */
const stoneAt = (x: number, y: number) => {
  const row = Math.floor((y + 600) / 6)
  const offset = (row % 2) * 5
  const ly = (y + 600) % 6
  const lx = (x + 600 + offset) % 10
  const stone = STONES[(Math.floor((x + 600 + offset) / 10) * 31 + row * 17) % 5]!
  return lx === 0 || ly === 0 ? MORTAR : ly === 1 && lx < 9 ? STONE_HI : ly === 5 || lx === 9 ? STONE_LO : stone
}

/** A few grass tufts between the stones of a `w`×`h` patch from (x0, y0), from a fixed little generator so the patch never changes. */
const tufts = (x0: number, y0: number, w: number, h: number, inside: (x: number, y: number) => boolean, set: (x: number, y: number, c: readonly number[]) => void) => {
  let seed = 7
  const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 22; i++) {
    const x = Math.round(x0 + next() * w)
    const y = Math.round(y0 + next() * h)
    if (!inside(x, y) || !inside(x + 1, y - 1)) continue
    set(x, y, TUFT[0])
    set(x + 1, y - 1, TUFT[1])
  }
}

/** The Ring's curb: a light stone lip (and its second row), a seam, the dark outline, and the stone face below the south edge. */
const CURB = { lip: rgb('#e3dac3'), lip2: rgb('#d0c8ae'), seam: rgb('#968568'), line: rgb('#5f5446'), face: rgb('#b8a988'), face2: rgb('#968568') }
/** The curb's shadow on the grass below its face. */
const CURB_SHADOW = [0, 0, 0] as const
const CURB_SHADOW_ALPHA = 56

/**
 * The Lantern Ring's floor (`RING`), built once: the cobblestones in its
 * curbed round and its approach out of the gate. Inside, a 3 px curb (dark
 * outline, light lip, seam); outside, on south-facing edges, the curb's
 * stone face, its outline and a shadow line on the grass, and a dark outline
 * along the rest. Drawn at (`x`, `y`) from the building's feet.
 */
const ringFloor = lazy(() => {
  const e = RING.floor
  const a = RING.approach
  const x0 = e.x - e.rx - 4
  const y0 = e.y - e.ry - 4
  const w = e.rx * 2 + 9
  const h = a.bottom + 6 - y0
  const shape = (x: number, y: number) => {
    const dx = (x - e.x) / e.rx
    const dy = (y - e.y) / e.ry
    return dx * dx + dy * dy <= 1 || (Math.abs(x) <= a.half && y >= a.top && y <= a.bottom)
  }
  const inside = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) inside[y * w + x] = shape(x + x0, y + y0) ? 1 : 0
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && inside[y * w + x] === 1
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  const image = ctx.createImageData(w, h)
  const px = image.data
  const set = (x: number, y: number, c: readonly number[], alpha = 255) => {
    const i = (y * w + x) * 4
    px[i] = c[0]!
    px[i + 1] = c[1]!
    px[i + 2] = c[2]!
    px[i + 3] = alpha
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (at(x, y)) {
        // How far in from the edge (1 to 3, along the rows and columns): the curb's rows.
        let dist = 0
        for (let k = 1; k <= 3 && !dist; k++) if (!at(x - k, y) || !at(x + k, y) || !at(x, y - k) || !at(x, y + k)) dist = k
        // The south rim's top row is its lip; the face hangs below it.
        if (dist === 1) set(x, y, at(x, y - 1) && !at(x, y + 1) ? CURB.lip : CURB.line)
        else if (dist === 2) set(x, y, CURB.lip)
        else if (dist === 3) set(x, y, CURB.seam)
        else set(x, y, stoneAt(x + x0 - e.x, y + y0 - e.y))
        continue
      }
      // Below a south-facing edge: the face, its outline, then a shadow on the grass.
      const up = at(x, y - 1) ? 1 : at(x, y - 2) ? 2 : at(x, y - 3) ? 3 : at(x, y - 4) ? 4 : 0
      if (up === 1) set(x, y, CURB.face)
      else if (up === 2) set(x, y, CURB.face2)
      else if (up === 3) set(x, y, CURB.line)
      else if (up === 4) set(x, y, CURB_SHADOW, CURB_SHADOW_ALPHA)
      else if (at(x - 1, y) || at(x + 1, y) || at(x, y + 1)) set(x, y, CURB.line)
    }
  }
  const inner = (x: number, y: number) => at(x - 4, y) && at(x + 4, y) && at(x, y - 4) && at(x, y + 4)
  tufts(0, 0, w, h, inner, (x, y, c) => set(x, y, c))
  ctx.putImageData(image, 0, 0)
  return { canvas, x: x0, y: y0 }
})

/** The shadows' tint: a dark green that reads on the cobblestones and on the grass. */
const SHADOW = 'rgba(30,40,30,0.3)'
/** How flat a silhouette shadow is, of its piece's painted height. */
const SQUASH = 0.28

/** A piece's silhouette shadow: its painted rows squashed to `SQUASH` of their height and tinted `SHADOW`. Cached per art. */
const silhouette = (() => {
  const cache = new Map<Art, HTMLCanvasElement>()
  onCanvasReset(
    () => cache.clear(),
    () => cache,
  )
  return (art: Art) => {
    const hit = cache.get(art)
    if (hit) return hit
    const canvas = createCanvas(art.img.width, Math.max(1, Math.round(art.h * SQUASH)))
    const ctx = context2d(canvas)
    ctx.drawImage(art.img, 0, art.minY, art.img.width, art.h, 0, 0, canvas.width, canvas.height)
    ctx.globalCompositeOperation = 'source-in'
    ctx.fillStyle = SHADOW
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    cache.set(art, canvas)
    return canvas
  }
})()

/** Draws a shadow on the ground at (x, y), screen px: a silhouette bottom-aligned to the feet and nudged 2 px down-right, or an ellipse centered there. */
const drawShadow = (ctx: CanvasRenderingContext2D, s: Shadow, x: number, y: number) => {
  if ('rx' in s) return blitCentered(ctx, ellipse(s.rx, s.ry, SHADOW), x, y)
  const mask = silhouette(s.art)
  ctx.drawImage(mask, Math.round(x - (s.art.minX + s.art.w / 2)) + 2, Math.round(y - mask.height) + 2)
}

/** Draws the plaza's floor (cobblestones, the pieces' shadows) under everyone, when it's in view. */
export const drawPlazaGround = (ctx: CanvasRenderingContext2D, plaza: Plaza, camX: number, camY: number, w: number, h: number) => {
  const layout = plazaLayout(plaza)
  if (!layout) return
  const b = layout.bounds
  if (plaza.x + b.right + 8 - camX < 0 || plaza.x + b.left - 8 - camX > w || plaza.y + b.bottom + 8 - camY < 0 || plaza.y + b.top - camY > h) return
  if (layout.ring) {
    const floor = ringFloor()
    ctx.drawImage(floor.canvas, Math.round(plaza.x + floor.x - camX), Math.round(plaza.y + floor.y - camY))
  } else {
    const c = layout.cobbles
    blitCentered(ctx, cobbles(c.rx, c.ry), plaza.x + c.x - camX, plaza.y + c.y - camY)
  }
  for (const s of layout.shadows) drawShadow(ctx, s, plaza.x + s.x - camX, plaza.y + s.y - camY)
}

/** Height (px) of a hop `since` seconds in, `count` hops long; 0 outside it. */
const hop = (since: number, count: number, height: number) =>
  since < 0 || since >= 0.3 * count ? 0 : Math.round(Math.sin((Math.PI * (since % 0.3)) / 0.3) * height)

const KEEPER_REACTION = 1.4

/** One shopkeeper, its hop and its emote. `shadowed` false behind the kiosk's counter. */
const drawKeeper = (ctx: CanvasRenderingContext2D, k: Keeper, purple: boolean, x: number, y: number, time: number, shadowed: boolean, hidden: boolean) => {
  const sprite = keeperSprites(purple)
  if (!sprite) return
  const lift = hop(time - k.hopAt, 2, 4)
  // Camouflaged, only a faint shimmer of it shows (and no shadow).
  if (hidden) return drawPokemon(ctx, sprite, 'Idle', k.dir, time, x, y, { alpha: 0.12 })
  if (shadowed) shadow(ctx, x, y, sprite.bodyW)
  drawPokemon(ctx, sprite, 'Idle', k.dir, time + (purple ? 0.4 : 0), x, y - lift)
  const since = time - k.hopAt
  if (since >= 0 && since < KEEPER_REACTION) blitCentered(ctx, EMOTES()[k.emote], x, y - sprite.bodyH - lift - 8 - (Math.floor(since * 4) % 2))
}

/** Something the meadow sorts by its feet among the wanderers. */
export type Piece = { y: number; draw: (ctx: CanvasRenderingContext2D, camX: number, camY: number, time: number) => void }

const pieceCache = new WeakMap<Plaza, { layout: Layout; pieces: Piece[] }>()

/* ---------------- The golden statue ---------------- */

/** A gold leaf ramp, darkest first: each opaque pixel of Kecleon's sheet takes the step of its brightness. */
const GOLD = ['#3a2408', '#6e4a10', '#a87418', '#d8a428', '#f4d050', '#fff2a8'].map(rgb)

/** Kecleon's sheet cast in gold: the outline stays dark, the rest follows its brightness up the ramp. */
const goldize = (src: CanvasImageSource & { width: number; height: number }) => {
  const canvas = createCanvas(src.width, src.height)
  const ctx = context2d(canvas)
  ctx.drawImage(src, 0, 0)
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const a = image.data
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] === 0) continue
    const lum = (a[i]! * 0.3 + a[i + 1]! * 0.55 + a[i + 2]! * 0.15) / 255
    const step = GOLD[Math.min(GOLD.length - 1, Math.floor(lum * 1.25 * GOLD.length))]!
    a[i] = step[0]
    a[i + 1] = step[1]
    a[i + 2] = step[2]
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

let golden: { from: SpeciesSprites; to: SpeciesSprites } | null = null
onCanvasReset(
  () => (golden = null),
  () => golden?.to,
)

/** The golden Kecleon's sprites, cast once from the green one's. */
const goldenSprites = (green: SpeciesSprites) => {
  if (golden?.from !== green) {
    const gild = (sheet: Sheet): Sheet => ({ ...sheet, img: goldize(sheet.img), overlays: null })
    golden = { from: green, to: { ...green, anims: { Walk: green.anims.Walk, Idle: gild(green.anims.Idle), Hurt: green.anims.Hurt } } }
  }
  return golden.to
}

/** How far into the pedestal's painted top (px) the statue's feet sink, so it stands on the top face rather than its rim. */
const PEDESTAL_TOP = 6

/** The golden Kecleon on its pedestal (feet of the pedestal at x, y), with a glint now and then. */
const drawStatue = (ctx: CanvasRenderingContext2D, x: number, y: number, time: number) => {
  const pedestal = arts.get('pedestal')
  const green = loadedSprites(KECLEON_DEX)
  if (!pedestal || !green) return
  put(ctx, pedestal, x, y)
  // Frozen on its first idle frame: it's a statue.
  drawPokemon(ctx, goldenSprites(green), 'Idle', 0, 0, x, y - pedestal.h + PEDESTAL_TOP)
  drawSparkles(ctx, x, y - pedestal.h - 14, 18, (time % 4) - 0.2, 3)
}

/** The plaza's upright pieces (building, shopkeepers, props, visitors), world y of their feet, built once per layout. */
export const plazaPieces = (plaza: Plaza): readonly Piece[] => {
  const layout = plazaLayout(plaza)
  if (!layout) return []
  const cached = pieceCache.get(plaza)
  if (cached?.layout === layout) return cached.pieces
  const { building, counter } = layout
  const keepers = keepersAt(plaza, layout)
  const pieces: Piece[] = [
    ...layout.props.map((p): Piece => {
      const art = arts.get(p.id)!
      const x = plaza.x + p.x
      const y = plaza.y + p.y
      return {
        y,
        draw: (ctx, camX, camY) => put(ctx, art, x - camX, y - camY),
      }
    }),
    {
      y: plaza.y,
      draw: (ctx, camX, camY, time) => {
        put(ctx, building, plaza.x - camX, plaza.y - camY)
        if (counter === null) return
        // The kiosk: its shopkeepers stand behind the counter, whose front is drawn again over their feet.
        for (const k of keepers) drawKeeper(ctx, k.keeper, k.purple, k.x - camX, k.y - camY, time, false, plaza.hidden && !k.purple)
        put(ctx, building, plaza.x - camX, plaza.y - camY, counter)
      },
    },
    ...(counter === null
      ? keepers.map((k): Piece => ({ y: k.y, draw: (ctx, camX, camY, time) => drawKeeper(ctx, k.keeper, k.purple, k.x - camX, k.y - camY, time, true, plaza.hidden && !k.purple) }))
      : []),
    ...visitorPieces(plaza, layout),
    ...festivalPieces(plaza, layout.festival),
  ]
  pieceCache.set(plaza, { layout, pieces })
  return pieces
}

/** Frames a second of the fountain's water (f0 → f1 → f2, looping). */
const WATER_FPS = 7

/** How fast the lanterns on the fountain's water bob a pixel (per second). */
const FLOAT_BOB = 1.3

/**
 * The festival's pieces: the fountain with its water running (and its
 * floating lanterns bobbing), the plaque, the gate, the tree, the market, the
 * float, Volbeat and Illumise, and the bunting, sorted just behind the lamps it
 * hangs from so the shopkeepers by them stand in front of it.
 */
const festivalPieces = (plaza: Plaza, f: FestivalLayout | null): Piece[] => {
  if (!f) return []
  const { fountain, plaque, bunting, floaters } = f
  const fx = plaza.x + fountain.x
  const fy = plaza.y + fountain.y
  const standing = (s: Standing | null): Piece[] => {
    if (!s) return []
    const x = plaza.x + s.x
    const y = plaza.y + s.y
    return [{ y, draw: (ctx, camX, camY) => put(ctx, s.art, x - camX, y - camY) }]
  }
  const guests = f.guests.map((g): Piece => {
    void loadSpecies(g.dex).catch(() => {})
    const x = plaza.x + g.spot.x
    const y = plaza.y + g.spot.y
    return {
      y,
      draw: (ctx, camX, camY, time) => {
        const sprite = loadedSprites(g.dex)
        if (!sprite) return
        shadow(ctx, x - camX, y - camY, sprite.bodyW)
        drawPokemon(ctx, sprite, 'Idle', g.spot.dir, time + g.dex * 0.13, x - camX, y - camY)
      },
    }
  })
  return [
    {
      y: fy,
      draw: (ctx, camX, camY, time) => {
        put(ctx, fountain.frames[Math.floor(time * WATER_FPS) % fountain.frames.length]!, fx - camX, fy - camY)
        if (!floaters) return
        const sprite = LANTERN_ART().floating
        for (let i = 0; i < FLOATERS.length; i++) {
          const [x, y] = FLOATERS[i]!
          const bob = Math.floor(time * FLOAT_BOB + i * 0.5) % 2
          ctx.drawImage(sprite, Math.round(fx + x - 2 - camX), Math.round(fy + y - 3 + bob - camY))
        }
      },
    },
    ...(plaque ? [{ y: plaza.y + plaque.y, draw: (ctx, camX, camY) => put(ctx, arts.get('plaque')!, plaza.x + plaque.x - camX, plaza.y + plaque.y - camY) } satisfies Piece] : []),
    ...standing(f.gate),
    ...standing(f.tree),
    ...standing(f.stall),
    ...standing(f.market),
    ...standing(f.float),
    ...guests,
    ...(bunting
      ? [
          {
            y: plaza.y + bunting.y + LAMP_TIE - 0.5,
            // Its left tie is pixel (1, 1) of the PNG.
            draw: (ctx, camX, camY) => ctx.drawImage(arts.get('bunting')!.img, Math.round(plaza.x + bunting.x - 1 - camX), Math.round(plaza.y + bunting.y - 1 - camY)),
          } satisfies Piece,
        ]
      : []),
  ]
}

/**
 * The lantern strings, over everyone at the plaza (they hang high, so
 * whoever stands under one is behind it). Drawn after the sorted pieces.
 */
export const drawPlazaOverhead = (ctx: CanvasRenderingContext2D, plaza: Plaza, camX: number, camY: number) => {
  const strings = plazaLayout(plaza)?.festival?.strings
  if (!strings) return
  for (const s of strings) {
    const { canvas, ox, oy } = lanternString(s.line)
    ctx.drawImage(canvas, Math.round(plaza.x + s.from.x - ox - camX), Math.round(plaza.y + s.from.y - oy - camY))
  }
}

/* ---------------- The festival's dusk ---------------- */

/** The dusk's warm light, multiplied over the view at full strength (stage 3), in `DUSK_STEPS` flat steps from none. */
const DUSK_RGB = [232, 190, 162] as const
const DUSK_STEPS = 6
const DUSK_FILLS = Array.from({ length: DUSK_STEPS + 1 }, (_, i) => {
  const k = i / DUSK_STEPS
  const [r, g, b] = DUSK_RGB.map((c) => Math.round(255 + (c - 255) * k))
  return `rgb(${r},${g},${b})`
})
/** The dusk is full while the view's center is this near the building (world px) and gone this far. */
const DUSK_NEAR = 240
const DUSK_FAR = 520

/** The lanterns' warm light. */
const LIGHT = '#ffd678'

/** A light's hard rings (`glow`), built once per size and strength. */
const lightSprite = (() => {
  const cache = canvasCache<string, HTMLCanvasElement>()
  return (r: number, alpha: number) => {
    const key = `${r}:${alpha}`
    const hit = cache.get(key)
    if (hit) return hit
    const sprite = glow(r, LIGHT, alpha)
    cache.set(key, sprite)
    return sprite
  }
})()

/** Seconds a sky lantern takes to rise through its span, and the span (px). */
const SKY_RISE = { time: 22, span: 48 } as const

/**
 * The dusk over the plaza (stage 3 on): a warm light multiplied over the
 * view, fading as the camera leaves the plaza, soft glows on every lantern
 * (`FestivalLayout.lights`), and, lit over the tint, fireflies blinking
 * around the wishing tree and sky lanterns rising over the shop and the
 * meadow. The lean drawing (`detail.lean`) keeps the tint and skips the rest.
 */
export const drawPlazaDusk = (ctx: CanvasRenderingContext2D, plaza: Plaza, camX: number, camY: number, w: number, h: number, time: number) => {
  const f = plazaLayout(plaza)?.festival
  if (!f || f.stage < 3) return
  const away = Math.hypot(camX + w / 2 - plaza.x, camY + h / 2 - plaza.y)
  const step = Math.round(clamp((DUSK_FAR - away) / (DUSK_FAR - DUSK_NEAR), 0, 1) * DUSK_STEPS)
  if (step === 0) return
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = DUSK_FILLS[step]!
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'
  if (detail.lean) return
  const fade = step / DUSK_STEPS
  const ox = plaza.x - camX
  const oy = plaza.y - camY
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = fade
  for (const l of f.lights) {
    if (ox + l.x + l.r < 0 || ox + l.x - l.r > w || oy + l.y + l.r < 0 || oy + l.y - l.r > h) continue
    blitCentered(ctx, lightSprite(l.r, l.alpha), Math.round(ox + l.x), Math.round(oy + l.y))
  }
  ctx.globalCompositeOperation = 'source-over'
  const art = LANTERN_ART()
  // Fireflies drift around the tree and blink; each glows a little while lit.
  if (f.tree) {
    for (let i = 0; i < FIREFLIES.length; i++) {
      if ((time * 0.8 + i * 0.29) % 1 > 0.75) continue
      const [dx, dy] = FIREFLIES[i]!
      const x = Math.round(ox + f.tree.x + dx + Math.sin(time * 0.7 + i * 2.1) * 3)
      const y = Math.round(oy + f.tree.y + dy + Math.cos(time * 0.5 + i * 1.3) * 2)
      ctx.globalCompositeOperation = 'lighter'
      blitCentered(ctx, lightSprite(3, 0.45), x, y)
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(art.firefly, x, y)
    }
  }
  // Sky lanterns rise through their span, swaying a pixel, fading in at the bottom and out at the top.
  for (let i = 0; i < f.sky; i++) {
    const [sx, sy, far] = SKY_LANTERNS[i]!
    const k = (time / SKY_RISE.time + i * 0.37) % 1
    const sprite = far ? art.skyFar : art.sky
    const x = Math.round(ox + sx + Math.sin(time * 0.9 + i * 1.7) * 1.5)
    const y = Math.round(oy + sy + SKY_RISE.span * (0.5 - k))
    ctx.globalAlpha = fade * Math.min(1, k / 0.15, (1 - k) / 0.15)
    ctx.globalCompositeOperation = 'lighter'
    blitCentered(ctx, lightSprite(far ? 6 : 9, 0.35), x + (sprite.width >> 1), y + 3)
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(sprite, x, y)
  }
  ctx.globalAlpha = 1
}

/** The visitors' pieces: Meowth's wagon and Meowth, a seasonal stall and its keeper, the golden statue. Their sheets load on first sight. */
const visitorPieces = (plaza: Plaza, layout: Layout): Piece[] => {
  const v = plaza.visitors
  const at = (spot: Placed) => ({ x: plaza.x + spot.x, y: plaza.y + spot.y })
  const artPiece = (id: ArtId, spot: Placed): Piece => {
    const { x, y } = at(spot)
    return { y, draw: (ctx, camX, camY) => put(ctx, arts.get(id)!, x - camX, y - camY) }
  }
  const npcs: Piece[] = npcsAt(plaza, layout).map((n) => {
    void loadSpecies(n.dex).catch(() => {})
    const { x, y } = at(n.spot)
    return {
      y,
      draw: (ctx, camX, camY, time) => {
        const sprite = loadedSprites(n.dex)
        if (!sprite) return
        shadow(ctx, x - camX, y - camY, sprite.bodyW)
        drawPokemon(ctx, sprite, 'Idle', visitorDirs.get(plaza)?.[n.who] ?? n.spot.dir, time + 0.7, x - camX, y - camY)
      },
    }
  })
  const statue = at(layout.statue)
  return [
    ...(v.caravan ? [artPiece('caravan', layout.wagon)] : []),
    ...(v.stall ? [artPiece(STALLS[v.stall].art, layout.stall)] : []),
    ...npcs,
    ...(v.statue ? [{ y: statue.y, draw: (ctx, camX, camY, time) => drawStatue(ctx, statue.x - camX, statue.y - camY, time) } satisfies Piece] : []),
  ]
}

const PARTY_TIME = 1.6

/** The shop's level-up: puffs of dust rolling off the footprint's rim, then sparkles bursting over the new building, for `PARTY_TIME` seconds. */
export const drawPlazaParty = (ctx: CanvasRenderingContext2D, plaza: Plaza, camX: number, camY: number, time: number) => {
  const since = time - plaza.party
  const layout = plazaLayout(plaza)
  if (since < 0 || since >= PARTY_TIME || !layout) return
  const x = plaza.x - camX
  const y = plaza.y + layout.pad.y - camY
  const k = Math.min(1, since / 0.6)
  ctx.globalAlpha = 0.85 * (1 - k)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    const r = 1 + k * 0.35
    blitCentered(ctx, ellipse(4, 3, '#f0ead8'), Math.round(x + Math.cos(a) * layout.pad.rx * r), Math.round(y + Math.sin(a) * layout.pad.ry * r - k * 4))
  }
  ctx.globalAlpha = 1
  drawSparkles(ctx, x, y - layout.building.h / 2, layout.building.w * 0.8, since - 0.15, 7)
  drawSparkles(ctx, x, y - layout.building.h * 0.7, layout.building.w * 0.5, since - 0.45, 11)
}

/** The edge marker's box: Kecleon's head on a white card. Null until Kecleon's sheets are in (`lazy` tries again then). */
const markerCard = lazy(() => {
  const s = loadedSprites(KECLEON_DEX)
  if (!s) return null
  const sheet = s.anims.Idle
  const card = createCanvas(24, 19)
  const ctx = context2d(card)
  ctx.fillStyle = '#283040'
  ctx.fillRect(1, 0, 22, 19)
  ctx.fillRect(0, 1, 24, 17)
  ctx.fillStyle = '#f8f8f8'
  ctx.fillRect(1, 1, 22, 17)
  ctx.fillStyle = '#e0f0d0'
  ctx.fillRect(2, 2, 20, 15)
  // The head: the top of the first idle frame, facing the player.
  const top = Math.max(0, Math.round(sheet.fh / 2 + s.footY - s.bodyH))
  ctx.drawImage(sheet.img, Math.round(sheet.fw / 2 - 9), top, 18, 14, 3, 3, 18, 14)
  return card
})
/** How far (px) the plaza must reach into the view to count as on screen: a sliver at the edge still gets the marker, drawn over it. */
const MARKER_INSET = 16

/**
 * Whether any of the plaza reaches `MARKER_INSET` px into the `w`×`h` view:
 * a piece's box, or the floor's ellipse itself (not its box, whose corners
 * hold only grass).
 */
const plazaInView = (plaza: Plaza, layout: Layout, camX: number, camY: number, w: number, h: number) => {
  const left = camX + MARKER_INSET - plaza.x
  const top = camY + MARKER_INSET - plaza.y
  const right = camX + w - MARKER_INSET - plaza.x
  const bottom = camY + h - MARKER_INSET - plaza.y
  if (layout.pieces.some((b) => b.right > left && b.left < right && b.bottom > top && b.top < bottom)) return true
  // The view's point nearest the floor's middle is inside the ellipse when they meet.
  const c = layout.cobbles
  const dx = (clamp(c.x, left, right) - c.x) / c.rx
  const dy = (clamp(c.y, top, bottom) - c.y) / c.ry
  return dx * dx + dy * dy < 1
}

/**
 * A card with Kecleon's head and an arrow at the edge of the view, pointing
 * at the shop while no part of the plaza (its cobblestones, the building, a
 * visitor, the festival's pieces) is on screen. It remembers where it was
 * drawn (`plaza.marker`) so a tap on it can lead there.
 */
export const drawPlazaMarker = (ctx: CanvasRenderingContext2D, plaza: Plaza, camX: number, camY: number, w: number, h: number, time: number, show: boolean) => {
  plaza.marker.shown = false
  const layout = plazaLayout(plaza)
  if (!show || !layout || plazaInView(plaza, layout, camX, camY, w, h)) return
  const target = { x: plaza.x - camX, y: plaza.y - 30 - camY }
  const box = markerCard()
  if (!box) return
  const cx = w / 2
  const cy = h / 2
  const dx = target.x - cx
  const dy = target.y - cy
  // The card (24×19) and its arrow (5 px) stay whole inside the view.
  const ex = w / 2 - 20
  const ey = h / 2 - 17
  const t = Math.min(ex / Math.max(1e-6, Math.abs(dx)), ey / Math.max(1e-6, Math.abs(dy)))
  const sideways = Math.abs(dx) * ey >= Math.abs(dy) * ex
  const bob = Math.floor(time * 3) % 2
  const x = Math.round(clamp(cx + dx * t, 20, w - 20)) + (sideways ? Math.sign(dx) * bob : 0)
  const y = Math.round(clamp(cy + dy * t, h * 0.16, h * 0.84)) + (sideways ? 0 : Math.sign(dy) * bob)
  ctx.drawImage(box, x - 12, y - 9)
  // The arrow, on the side facing the plaza: a dark triangle around a green one.
  const dir = sideways ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) }
  const baseX = dir.x > 0 ? x + 12 : dir.x < 0 ? x - 13 : x
  const baseY = dir.y > 0 ? y + 10 : dir.y < 0 ? y - 10 : y
  for (let i = 0; i < 5; i++) {
    const len = 9 - i * 2
    ctx.fillStyle = i < 4 && i > 0 ? '#5cb048' : '#283040'
    if (dir.x !== 0) ctx.fillRect(baseX + dir.x * i, baseY - Math.floor(len / 2), 1, len)
    else ctx.fillRect(baseX - Math.floor(len / 2), baseY + dir.y * i, len, 1)
    if (i > 0 && i < 4) {
      ctx.fillStyle = '#283040'
      if (dir.x !== 0) {
        ctx.fillRect(baseX + dir.x * i, baseY - Math.floor(len / 2), 1, 1)
        ctx.fillRect(baseX + dir.x * i, baseY + Math.floor(len / 2), 1, 1)
      } else {
        ctx.fillRect(baseX - Math.floor(len / 2), baseY + dir.y * i, 1, 1)
        ctx.fillRect(baseX + Math.floor(len / 2), baseY + dir.y * i, 1, 1)
      }
    }
  }
  plaza.marker.x = x + camX
  plaza.marker.y = y + camY
  plaza.marker.shown = true
}

import { clamp, dir8, type Dir8, type Vec } from '../engine/math'
import { blitCentered, blitPacked, canvasCache, context2d, createCanvas, drawable, ellipse, glow, onCanvasReset } from '../engine/pixelart'
import { EMOTES, type Emote } from './art'
import { drawSparkles, shadow } from './draw'
import { LANTERN_ART, lanternString, stringLanterns, type LanternKind, type LanternString } from './lanterns'
import { detail } from './quality'
import { drawPokemon, loadedSprites, loadSpecies, type SpeciesSprites } from './sprites'
import { meadowPath, meadowPathRgb } from './world'
import type { PlazaStage } from '../data/festivals'
import type { ShopLevel, ShopProp } from '../data/shop'
import { CARAVAN, STALLS, TAILOR, type StallId } from '../data/visitors'

/**
 * The Kecleon plaza: the lobby's town square, east of the partner's home.
 * One curbed oval of cobblestones in every state (`SQUARE`, its paving drawn
 * in code and cached, `floorArt`), its curb opening at the south entrance,
 * where a lane runs to the meadow's paths (`laneArt`), and wherever one of
 * those paths arrives. Its storefronts stand on lots along the north arc,
 * facing south (`LOTS`): the Kecleon shop's building at its level in the
 * middle, Leavanny's Boutique on the north-west, a lot waiting for a shop on
 * the north-east. A flower bed with a blossoming tree is its centerpiece,
 * ringed by lamps; a tree, town benches and Kecleon's crates keep the rim.
 * The buildings and the props are PixelLab PNGs (`public/assets/shop/`),
 * anchored by the bottom center of what they paint, with no ground of their
 * own: each casts a shadow on the cobblestones (its own silhouette squashed
 * flat, or a soft ellipse under the deep 3/4 buildings). The shopkeepers are
 * Kecleon's own sheets, plus its purple brother from Lv 2, recolored from
 * the same sheets. Visitors come by too (`PlazaVisitors`, set by the shell),
 * each to its own spot on the rim: Meowth's weekend caravan, a seasonal
 * stall and the golden Kecleon statue. Around a Festival da Praça
 * (`PlazaFestival`, set by the shell) the fountain stands in the bed's place,
 * and while one runs the festival dresses the same square as the Lantern Ring
 * (`RING`): the gate over the entrance, the tree's wish tags and lanterns,
 * Lanturn's Lantern Market, a wheel of lantern strings and, at the end, the
 * Togepi float and a warm dusk, by the pot's stage. Everything standing there
 * keeps an invisible footprint walkers go around (`squarePlan`). Pure
 * presentation, like the rest of the lobby.
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
 * `festivalView`): the fountain stands in the flower bed's place from the
 * day before a festival opens; while it `running`, the donors' plaque and
 * the Lantern Festival's pieces stand too, dressed by the pot's stage
 * (`PlazaStage`).
 */
export type PlazaFestival = { fountain: boolean; stage: PlazaStage; running: boolean }

export const NO_FESTIVAL: PlazaFestival = { fountain: false, stage: 0, running: false }

/** Lanturn, the Lantern Market's keeper, at its stall on the Ring's east side while a festival runs. */
export const LANTURN = { dex: 171, name: 'Lanturn' } as const
/** Volbeat and Illumise, who come to the wishing tree at dusk (stage 3). */
const FIREFLY_DEX = [313, 314] as const

/** The species the festival puts on the plaza, for the sprite stream to keep. */
export const festivalSprites = (f: PlazaFestival): number[] => (f.fountain && f.running ? [LANTURN.dex, ...(f.stage >= 3 ? FIREFLY_DEX : [])] : [])

/** Who talks at the plaza: a shopkeeper (the shop), Meowth (his caravan), a seasonal stall's keeper, Lanturn (a word, then the festival's sheet), the festival's fountain or plaque (its sheet), or Leavanny (the Boutique). */
export type PlazaNpc = 'keeper' | 'meowth' | 'stall' | 'lanturn' | 'fountain' | 'plaque' | 'tailor'

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
  bed: 'prop-bed',
  bench: 'prop-bench',
  'bench-w': 'prop-bench-w',
  boutique: 'boutique',
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
  // The bare tree stands on the square in every state: the festival brings its wish tags and lanterns.
  ...Object.values(TREE_ART).filter((id) => id !== 'tree-s0'),
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

type Box = { left: number; top: number; right: number; bottom: number }

/** A footprint, never drawn: an ellipse walkers go around, centered at x, y (relative to the building's feet), `back` times as deep behind its middle (a tall piece's). */
export type Pad = Placed & { rx: number; ry: number; back: number }

/** A prop with its feet at x, y, casting the shadow of its `cast` art when it has one (the festival's lamps keep the plain lamp's under their lantern arms). */
type Prop = Placed & { id: ArtId; cast?: ArtId }

/** Where everything stands at a level, relative to the building's feet (its bottom center). */
type Layout = {
  building: Art
  /** The building's footprint (its center's y, and radii): the level-up's dust rolls off its rim. */
  pad: { y: number; rx: number; ry: number }
  /** The green Kecleon, then the purple brother from Lv 2. */
  keepers: readonly KeeperSpot[]
  /** Lv 3's open counter: the image's rows from here down are its front, drawn again over the shopkeepers behind it. */
  counter: number | null
  props: readonly Prop[]
  /** Where the partner stands to shop. */
  spot: Placed
  /** Whether a festival dresses the square as the Lantern Ring. */
  ring: boolean
  /** The shops on the square's lots besides Kecleon's (`LOTS`), with their keepers. */
  shops: readonly ShopLot[]
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
  /** The footprints walkers go around (`squarePlan`). */
  pads: readonly Pad[]
  /** The boxes (relative to the building's feet) of the building and of every piece that casts a shadow: with the floor, all the plaza draws. */
  pieces: readonly Box[]
  /** The box holding all of it, the floor included (the lane culls itself). */
  bounds: Box
}

/** A shop standing on its lot (`LOTS`): its building's feet and art, its keeper, where the partner stands to shop, and who talks there. */
type ShopLot = { id: LotShop; at: Placed; art: Art; keeper: KeeperSpot; spot: Placed; who: PlazaNpc; dex: number }

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
 * The festival on the plaza: the fountain (its stage's water frames) in the
 * flower bed's place from the day before; while it runs, the Lantern Ring
 * (`RING`) by stage: the plaque, the gate, the wishing tree, the sister stall
 * (null while a seasonal stall holds its spot) and Lanturn's market from the
 * opening, the bunting from 1, the wheel of lantern strings and the lanterns
 * floating on the fountain from 2, and from 3 the Togepi float, Volbeat and
 * Illumise at the tree, the dusk's `lights` and `sky` lanterns rising.
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

/** The square's oval, relative to the Kecleon shop's feet (its middle and radii): the curb's outer edge. */
export const OVAL = { x: 0, y: 145, rx: 330, ry: 210 } as const
/** The point `inset` px inside the curb (along the oval's radii) at `deg` degrees round its middle (0 east, 90 south). */
const rim = (deg: number, inset: number): Placed => {
  const a = (deg * Math.PI) / 180
  return { x: Math.round(OVAL.x + (OVAL.rx - inset) * Math.cos(a)), y: Math.round(OVAL.y + (OVAL.ry - inset) * Math.sin(a)) }
}
/** The curb's y on the north arc `dx` px off the axis (relative to the building's feet). */
const northCurb = (dx: number) => OVAL.y - OVAL.ry * Math.sqrt(Math.max(0, 1 - (dx / OVAL.rx) ** 2))
/** The flower bed's feet, the square's middle (the festival's fountain stands there instead). */
const CENTRE = { x: 0, y: OVAL.y + 15 } as const
/** The square's tree on the south-west rim (the wishing tree while a festival runs), and the spot on the south-east that Lanturn's market takes then, a town bench's until it comes. */
const TREE = rim(140, 34)
const MARKET = rim(40, 44)

/**
 * The square, relative to the Kecleon shop's feet: one curbed oval of
 * cobblestones (`OVAL`) in every state (`floorArt`), which the Festival
 * dresses but never reshapes. The shops stand along its north arc facing
 * south (`LOTS`), the curb passing behind their bases. In the middle, the
 * flower bed (`centre`) inside a ring of darker paving (`ring`) and four
 * lamps (`lamps`), with the shop's two (`LAMP_X`); a paved walk runs down the
 * axis from the shop's door to the entrance, which opens south, `gap` px each
 * side of the axis, where a lane leaves for the meadow's paths (`laneArt`).
 * The rim keeps the same spots in every state: Meowth's `wagon` on the west
 * (a town bench's until he comes), the `stall` spot on the east (Kecleon's
 * crates, a seasonal stall or, while a festival runs, the sister stall), the
 * `tree` on the south-west and the `market`'s spot on the south-east; the
 * golden `statue` stands east of the bed, the notice `board` by the entrance,
 * and the shop's flower pots flank it (`flowers`). The partner shops from
 * `spot`.
 */
const SQUARE = {
  ...OVAL,
  ring: { x: CENTRE.x, y: CENTRE.y - 20, rx: 118, ry: 72 },
  centre: CENTRE,
  lamps: [
    [CENTRE.x - 138, CENTRE.y + 12],
    [CENTRE.x - 98, CENTRE.y + 76],
    [CENTRE.x + 98, CENTRE.y + 76],
    [CENTRE.x + 138, CENTRE.y + 12],
  ],
  gap: 14,
  wagon: rim(180, 70),
  stall: rim(0, 80),
  tree: TREE,
  market: MARKET,
  statue: { x: CENTRE.x + 74, y: CENTRE.y + 16 },
  board: rim(118, 20),
  flowers: [rim(104, 18), rim(76, 18)].map((p) => [p.x, p.y] as const),
  spot: { x: 0, y: 34 },
} as const

/** The shop's two lamps stand this far each side of its middle (clear of its widest building) and this far below its feet. */
const LAMP_X = 104
const LAMP_Y = 14

/**
 * The Lantern Ring, the festival's dress for the square (relative to the
 * building's feet): the fountain stands in the bed's place (its strings tie
 * `crown` px up), the plaque west of it (the golden statue's spot mirrored),
 * the Togepi float on the axis (two `planters` hold its spot until it comes)
 * and the gate over the entrance (posts `post` px off its middle, their lamp
 * heads `head` px up). The square's tree becomes the wishing tree, with
 * Volbeat and Illumise beside it at dusk, Lanturn's Lantern Market takes the
 * bench's spot on the south-east (Lanturn west of it) and the sister stall
 * the stall spot. The square's lamps wear arms of lanterns and a wheel of
 * strings runs from the fountain's crown to them.
 */
const RING = {
  crown: 74,
  plaque: { x: CENTRE.x - 74, y: CENTRE.y + 16 },
  float: { x: CENTRE.x, y: CENTRE.y + 112 },
  planters: [
    [CENTRE.x - 18, CENTRE.y + 112],
    [CENTRE.x + 18, CENTRE.y + 112],
  ],
  gate: { x: OVAL.x, y: OVAL.y + OVAL.ry - 9 },
  post: 49,
  head: 84,
  volbeat: { x: TREE.x + 58, y: TREE.y + 12, dir: 1 },
  illumise: { x: TREE.x + 18, y: TREE.y + 34, dir: 0 },
  lanturn: { x: MARKET.x - 56, y: MARKET.y + 14, dir: 7 },
} as const
/** The bunting and the lantern strings tie on the lamp's cap, this high above its feet. */
const LAMP_TIE = 40

/**
 * The shops the square holds besides Kecleon's, each a PNG (`ART_FILES`) and
 * a keeper who talks for it (`who`, the shell opens the shop; the keeper's
 * species in `data/visitors.ts`): the keeper waits by its door (`keeper`,
 * from the building's feet) and the partner shops from `spot` (from the
 * keeper's). A new shop is an entry here, its art, and a lot in `LOTS`.
 */
const LOT_SHOPS = {
  boutique: { art: 'boutique', who: 'tailor', dex: TAILOR.dex, keeper: { x: 30, y: 16, dir: 1 }, spot: { x: 6, y: 24 } },
} as const satisfies Record<string, { art: ArtId; who: PlazaNpc; dex: number; keeper: KeeperSpot; spot: Placed }>
/** A shop on one of the square's lots, besides Kecleon's. */
export type LotShop = keyof typeof LOT_SHOPS
const LOT_SHOP_IDS = Object.keys(LOT_SHOPS) as LotShop[]

/**
 * The square's storefronts along its north arc, each at its building's feet
 * relative to the Kecleon shop's, lower toward the sides as the arc is, so
 * the curb runs behind every base: Kecleon's own in the middle (its building
 * follows the shop's level, between its lamps), Leavanny's Boutique on the
 * north-west, and on the north-east a lot waiting for a shop, which a bench
 * between two flower pots keeps (`EMPTY_LOT`). They stand at the same spots
 * in every state.
 */
/** How far (px) each side of its middle a lot reaches, and how far inside the curb its outer corner stands. */
const LOT = { half: 56, inset: 12 } as const
/** A lot's feet `x` px off the axis: low enough that the curb runs behind its outer corner. */
const lotAt = (x: number): Placed => ({ x, y: Math.round(northCurb(Math.abs(x) + LOT.half) + LOT.inset) })
const LOTS = [
  { x: 0, y: 0, shop: 'kecleon' },
  { ...lotAt(-206), shop: 'boutique' },
  { ...lotAt(206), shop: null },
] as const satisfies readonly (Placed & { shop: 'kecleon' | LotShop | null })[]
/** An empty lot's bench (facing the square's middle) and flower pots, from its middle. */
const EMPTY_LOT = { bench: { x: 0, y: -2 }, pots: [-32, 32], potY: 4 } as const

/** How far above its feet (world px) the ground a lot's building covers ends: its footprint (`squarePlan`) rounds off the front below that. */
const LOT_FRONT = -8

/**
 * The footprints (radii, `dy` from the feet, `back` stretching the solid
 * part behind a tall piece): the visitors' (each a little wider than what
 * stands on it), the bed's and the fountain's basins, the lamps' posts (thin:
 * the lanes between them stay open), the bench, and the festival's: the
 * plaque's posts, each gate post, the tree's planter, the stalls' counters
 * and the float's wheels (walkers pass behind the float's lantern and the
 * stalls' awnings).
 */
const PADS = {
  wagon: { dy: -6, rx: 62, ry: 16, back: 3 },
  stall: { dy: -16, rx: 60, ry: 18, back: 3 },
  statue: { dy: -3, rx: 21, ry: 7, back: 2 },
  bed: { dy: -18, rx: 42, ry: 17, back: 1.4 },
  fountain: { dy: -20, rx: 44, ry: 20, back: 1.4 },
  lamp: { dy: -1, rx: 5, ry: 3, back: 1.5 },
  bench: { dy: -4, rx: 17, ry: 6, back: 2 },
  plaque: { dy: -2, rx: 13, ry: 5, back: 2 },
  post: { dy: -2, rx: 6, ry: 4, back: 2 },
  tree: { dy: -14, rx: 34, ry: 13, back: 1.4 },
  counter: { dy: -14, rx: 46, ry: 13, back: 1.4 },
  float: { dy: -10, rx: 40, ry: 10, back: 1.4 },
} as const satisfies Record<string, { dy: number; rx: number; ry: number; back: number }>
type PadId = keyof typeof PADS

/** The props walkers go around, and the footprint each keeps (the pots, the crates and the board are low enough to brush past). */
const PROP_PADS: Partial<Record<ArtId, PadId>> = { lantern: 'lamp', 'lamp-arms': 'lamp', bed: 'bed', bench: 'bench', 'bench-w': 'bench', 'tree-s0': 'tree' }

/** The footprint `id` of a piece with its feet at `at`. */
const padAt = (id: PadId, at: Placed): Pad => {
  const { dy, rx, ry, back } = PADS[id]
  return { x: at.x, y: at.y + dy, rx, ry, back }
}

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
/** How much lower (world px) a desktop's resting view of the plaza sits, so the square comes into view, as far as the shop's roof still fits. */
const SQUARE_DROP = 40

/** The plaza's layout with the festival it shows (none until the festival's PNGs are in). */
const plazaLayout = (plaza: Plaza) => layoutOf(plaza.level, plaza.visitors, plaza.festival.fountain && festivalArtReady() ? plaza.festival : NO_FESTIVAL)

/**
 * Where the festival's pieces stand (relative to the building's feet), null
 * for one that doesn't: the fountain from the day before, the rest while it
 * runs by stage; the sister stall only when no seasonal stall holds its spot.
 */
const festivalSpots = (f: PlazaFestival, sister: boolean) => {
  const on = f.fountain && f.running
  const stage: PlazaStage = on ? f.stage : 0
  const late = on && stage >= 3
  return {
    stage,
    fountain: f.fountain ? SQUARE.centre : null,
    plaque: on ? RING.plaque : null,
    gate: on ? RING.gate : null,
    tree: on ? SQUARE.tree : null,
    stall: on && sister ? SQUARE.stall : null,
    market: on ? SQUARE.market : null,
    lanturn: on ? RING.lanturn : null,
    float: late ? RING.float : null,
    guests: late ? [RING.volbeat, RING.illumise] : [],
  }
}

/** The props standing at a level with the visitors and the festival: the lamps, the bed, the crates, the board, the flower pots and the empty lots' benches. */
const propsOf = (level: ShopLevel, v: PlazaVisitors, f: PlazaFestival): Prop[] => {
  const ring = f.fountain && f.running
  const pots = (spots: readonly (readonly [number, number])[]) => spots.map(([x, y]): Prop => ({ id: 'flowers', x, y }))
  const lamps = [[-LAMP_X, LAMP_Y] as const, [LAMP_X, LAMP_Y] as const, ...SQUARE.lamps]
  return [
    // The festival hangs arms of Poké Ball lanterns on every lamp (theirs cast the plain lamp's shadow).
    ...lamps.map(([x, y]): Prop => (ring ? { id: 'lamp-arms', cast: 'lantern', x, y } : { id: 'lantern', x, y })),
    // The fountain stands in the bed's place from the day before a festival; the festival dresses the tree.
    ...(f.fountain ? [] : [{ id: 'bed' as const, ...SQUARE.centre }]),
    ...(ring ? [] : [{ id: 'tree-s0' as const, ...SQUARE.tree }]),
    // Town benches face the middle where Meowth's wagon and Lanturn's market stand when they come.
    ...(v.caravan ? [] : [{ id: 'bench-w' as const, ...SQUARE.wagon }]),
    ...(ring ? [] : [{ id: 'bench' as const, ...SQUARE.market }, ...pots(EMPTY_LOT.pots.map((dx) => [SQUARE.market.x + dx, SQUARE.market.y + EMPTY_LOT.potY + 2] as const))]),
    // The stall spot keeps Kecleon's crates until a stall stands on it.
    ...(v.stall === null && !ring ? [{ id: 'crates' as const, ...SQUARE.stall }] : []),
    ...(level >= 2 ? [{ id: 'board' as const, ...SQUARE.board }] : []),
    ...(level >= 3 ? pots(SQUARE.flowers) : []),
    // Until the float comes, planters keep its spot on the axis.
    ...(ring && f.stage < 3 ? pots(RING.planters) : []),
    // A lot waiting for a shop keeps a bench facing the middle, between flower pots.
    ...LOTS.flatMap((l): Prop[] =>
      l.shop === null
        ? [{ id: l.x > 0 ? 'bench' : 'bench-w', x: l.x + EMPTY_LOT.bench.x, y: l.y + EMPTY_LOT.bench.y }, ...pots(EMPTY_LOT.pots.map((dx) => [l.x + dx, l.y + EMPTY_LOT.potY] as const))]
        : [],
    ),
  ]
}

/** The painted half widths footprints are sized from: the shop's building at its level, and each lot's shop. */
export type Halves = { shop: number; lots: Record<LotShop, number> }

/** How deep (px) behind its feet the 3/4 buildings of Lv 4 and 5 (painted half width `half`) reach: their footprint and shadow sit on a diamond. */
const depthOf = (level: ShopLevel, half: number) => (level >= 4 ? Math.round(half * 0.45) : 0)

/** Where a lot's keeper waits and where the partner shops from (relative to the building's feet). */
const lotPeople = (lot: Placed, shop: LotShop) => {
  const { keeper, spot } = LOT_SHOPS[shop]
  const at = { x: lot.x + keeper.x, y: lot.y + keeper.y, dir: keeper.dir }
  return { keeper: at, spot: { x: at.x + spot.x, y: at.y + spot.y } }
}

/**
 * The square in a state, from the data alone (relative to the building's
 * feet): the footprints walkers go around (`pads`: the buildings', sized from
 * their painted `halves`, every prop's that has one, the visitors' and the
 * festival's; the gate's are its two posts, so walkers pass under its arch;
 * the first `buildings` are the buildings'), the Pokémon standing there
 * besides Kecleon's shopkeepers (`people`) and where the partner stands to
 * shop (`spots`).
 */
export const squarePlan = (level: ShopLevel, halves: Halves, v: PlazaVisitors, f: PlazaFestival) => {
  const depth = depthOf(level, halves.shop)
  const fest = festivalSpots(f, v.stall === null)
  const lots = LOTS.flatMap((l) => (l.shop === null || l.shop === 'kecleon' ? [] : [{ ...l, shop: l.shop, ...lotPeople(l, l.shop) }]))
  const props = propsOf(level, v, f)
  const padOf = (p: Prop): Pad[] => {
    const id = PROP_PADS[p.id]
    return id ? [padAt(id, p)] : []
  }
  const pads: Pad[] = [
    { x: 0, y: -6 - depth, rx: halves.shop + 4 + (depth ? 6 : 0), ry: Math.round((halves.shop * 2) / 7) + depth, back: 1 },
    ...lots.map((l) => ({ x: l.x, y: l.y + LOT_FRONT, rx: halves.lots[l.shop] + 4, ry: 12, back: 1 })),
    ...props.flatMap(padOf),
    ...(v.caravan ? [padAt('wagon', SQUARE.wagon)] : []),
    ...(v.stall ? [padAt('stall', SQUARE.stall)] : []),
    ...(v.statue ? [padAt('statue', SQUARE.statue)] : []),
    ...(fest.fountain ? [padAt('fountain', fest.fountain)] : []),
    ...(fest.plaque ? [padAt('plaque', fest.plaque)] : []),
    ...(fest.gate ? [-1, 1].map((side) => padAt('post', { x: fest.gate!.x + side * RING.post, y: fest.gate!.y })) : []),
    ...(fest.tree ? [padAt('tree', fest.tree)] : []),
    ...[fest.stall, fest.market].flatMap((at) => (at ? [padAt('counter', at)] : [])),
    ...(fest.float ? [padAt('float', fest.float)] : []),
  ]
  const people: KeeperSpot[] = [
    ...lots.map((l) => l.keeper),
    ...(v.caravan ? [meowthAt(SQUARE.wagon)] : []),
    ...(v.stall ? [stallKeeperAt(SQUARE.stall)] : []),
    ...(fest.lanturn ? [fest.lanturn] : []),
    ...fest.guests,
  ]
  return { pads, buildings: 1 + lots.length, people, spots: [SQUARE.spot, ...lots.map((l) => l.spot)] }
}

/** Meowth stands on the east side of his wagon (feet at `wagon`), facing the square. */
const meowthAt = (wagon: Placed): KeeperSpot => ({ x: wagon.x + 84, y: wagon.y + 16, dir: 1 })
/** A seasonal stall's keeper stands on its west side (feet at `stall`), facing the square. */
const stallKeeperAt = (stall: Placed): KeeperSpot => ({ x: stall.x - 58, y: stall.y + 12, dir: 7 })

/** The festival's pieces on the plaza (`FestivalLayout`); `sister` when no seasonal stall holds the stall spot. */
const festivalLayout = (f: PlazaFestival, sister: boolean): FestivalLayout => {
  const spots = festivalSpots(f, sister)
  const { stage } = spots
  const frames = FOUNTAIN_FRAMES[stage].map((id) => arts.get(id)!)
  const standing = (id: ArtId, spot: Placed | null): Standing | null => (spot ? { x: spot.x, y: spot.y, art: arts.get(id)! } : null)
  const fountain = { ...SQUARE.centre, frames }
  const gate = standing(stage >= 2 ? 'gate' : 'gate-unlit', spots.gate)
  const tree = standing(TREE_ART[stage], spots.tree)
  const stall = standing('stall', spots.stall)
  const market = standing('market', spots.market)
  const float = standing(stage >= 4 ? 'float-shiny' : 'float', spots.float)
  const tie = (from: Placed, to: Placed, sag: number, start: number, kinds: readonly LanternKind[]): Strung => ({
    from,
    line: { dx: to.x - from.x, dy: to.y - from.y, sag, step: 11, start, kinds },
  })
  // Every lamp's cap, the shop's two first, then the square's (west to east).
  const caps = [{ x: -LAMP_X, y: LAMP_Y }, { x: LAMP_X, y: LAMP_Y }, ...SQUARE.lamps.map(([x, y]) => ({ x, y }))].map((p) => ({ x: p.x, y: p.y - LAMP_TIE }))
  const [shopW, shopE, ringW, ringSW, ringSE, ringE] = caps as [Placed, Placed, Placed, Placed, Placed, Placed]
  const crown = { x: fountain.x, y: fountain.y - RING.crown }
  const heads = gate ? ([-1, 1].map((side) => ({ x: gate.x + side * RING.post, y: gate.y - RING.head })) as [Placed, Placed]) : null
  // The wheel: a spoke from the fountain's crown to every lamp, and a rim from lamp to lamp that opens toward the gate.
  const strings =
    stage >= 2 && heads
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
    stage >= 3 && gate && tree
      ? [
          // The lamps' heads and the lanterns on their arms.
          ...caps.flatMap(({ x, y }) => [light(x, y + LAMP_TIE - 48, 22, 0.3), light(x - 10, y + LAMP_TIE - 32, 7, 0.3), light(x + 10, y + LAMP_TIE - 32, 7, 0.3)]),
          light(fountain.x, fountain.y - 44, 54, 0.24),
          ...FLOATERS.map(([x, y]) => light(fountain.x + x, fountain.y + y, 5, 0.3)),
          light(tree.x, tree.y - 66, 40, 0.22),
          ...[stall, market].flatMap((s) => (s ? [light(s.x, s.y - 62, 34, 0.2)] : [])),
          ...(heads ?? []).map((h) => light(h.x, h.y, 16, 0.3)),
          light(gate.x, gate.y - 52, 34, 0.24),
          ...(float ? [light(float.x, float.y - 52, 44, 0.28)] : []),
          ...strings.flatMap((s) => stringLanterns(s.line).map((l) => light(s.from.x + l.x, s.from.y + l.y + 5, 6, 0.22))),
        ]
      : []
  return {
    stage,
    fountain,
    plaque: spots.plaque,
    bunting: spots.gate && stage >= 1 ? { x: -LAMP_X, y: LAMP_Y - LAMP_TIE } : null,
    gate,
    tree,
    stall,
    market,
    lanturn: spots.lanturn,
    float,
    strings,
    floaters: spots.gate !== null && stage >= 2,
    guests: spots.guests.map((spot, i) => ({ dex: FIREFLY_DEX[i]!, spot })),
    lights,
    sky: spots.gate && (stage === 3 || stage === 4) ? SKY_AT[stage] : 0,
  }
}

/** The shops standing on their lots (`LOTS`), with their keepers and where the partner shops, relative to the building's feet. */
const shopLots = (): ShopLot[] =>
  LOTS.flatMap((lot) => {
    if (lot.shop === null || lot.shop === 'kecleon') return []
    const shop = LOT_SHOPS[lot.shop]
    return [{ id: lot.shop, at: { x: lot.x, y: lot.y }, art: arts.get(shop.art)!, ...lotPeople(lot, lot.shop), who: shop.who, dex: shop.dex }]
  })

const layoutOf = (level: ShopLevel, v: PlazaVisitors, f: PlazaFestival): Layout | null => {
  const key = `${level}:${v.caravan}:${v.stall}:${v.statue}:${f.fountain}:${f.stage}:${f.running}`
  const cached = layouts.get(key)
  if (cached) return cached
  const building = arts.get(`lv${level}`)
  if (!building || BASE_ART.some((id) => !arts.has(id))) return null
  const half = Math.round(building.w / 2)
  // The 3/4 buildings of Lv 4 and 5 stand on a deep diamond: the footprint and the shadow reach back under all of it.
  const depth = depthOf(level, half)
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
  const ring = f.fountain && f.running
  const props = propsOf(level, v, f)
  const festival = f.fountain ? festivalLayout(f, v.stall === null) : null
  const shops = shopLots()
  const { wagon, stall, statue } = SQUARE
  const shadows: readonly Shadow[] = [
    // The deep 3/4 buildings cast a soft ellipse under their footprint; everything else, its own silhouette.
    depth ? { x: 0, y: -Math.round(half * 0.3), rx: half - 10, ry: Math.round(half * 0.32) } : { x: 0, y: 0, art: building },
    ...props.map((p) => ({ x: p.x, y: p.y, art: arts.get(p.cast ?? p.id)! })),
    ...(v.caravan ? [{ ...wagon, art: arts.get('caravan')! }] : []),
    ...(v.stall ? [{ ...stall, art: arts.get(STALLS[v.stall].art)! }] : []),
    ...(v.statue ? [{ ...statue, art: arts.get('pedestal')! }] : []),
    ...shops.map((s) => ({ ...s.at, art: s.art })),
    // A piece that changes by stage keeps its first stage's shadow (the fountain's doesn't grow when the lanterns and the statue come); the bunting and the strings cast none.
    ...(festival ? [{ x: festival.fountain.x, y: festival.fountain.y, art: arts.get('fountain-s0-f0')! }] : []),
    ...(festival?.plaque ? [{ ...festival.plaque, art: arts.get('plaque')! }] : []),
    ...(festival?.gate ? [{ x: festival.gate.x, y: festival.gate.y, art: arts.get('gate-unlit')! }] : []),
    ...(festival?.tree ? [{ x: festival.tree.x, y: festival.tree.y, art: arts.get('tree-s0')! }] : []),
    ...(festival?.stall ? [festival.stall] : []),
    ...(festival?.market ? [festival.market] : []),
    ...(festival?.float ? [{ x: festival.float.x, y: festival.float.y, art: arts.get('float')! }] : []),
  ]
  const pieceBoxes: [Box, ...Box[]] = [boxOf(building, { x: 0, y: 0 }), ...shadows.flatMap((s) => ('art' in s ? [boxOf(s.art, s)] : []))]
  const plan = squarePlan(level, { shop: half, lots: Object.fromEntries(shops.map((s) => [s.id, Math.round(s.art.w / 2)])) as Record<LotShop, number> }, v, f)
  const layout: Layout = {
    building,
    pad: { y: -6 - depth, rx: half + 4 + (depth ? 6 : 0), ry: Math.round(building.w / 7) + depth },
    keepers,
    counter: level === 3 ? LV3_COUNTER : null,
    props,
    spot: SQUARE.spot,
    ring,
    shops,
    wagon,
    meowth: meowthAt(wagon),
    stall,
    stallKeeper: stallKeeperAt(stall),
    statue,
    festival,
    shadows,
    pads: plan.pads,
    // The bunting and the lantern strings hang between pieces inside these boxes already (the sky lanterns don't count).
    pieces: pieceBoxes,
    bounds: unionOf([SQUARE_BOX, ...pieceBoxes]),
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
  /** The lots' shopkeepers (Leavanny at the Boutique): a hop and an emote when the partner comes to shop (`greetShopkeeper`). */
  shopkeepers: Record<LotShop, Keeper>
  /** The edge markers as last drawn (world px), for taps: the shop's and a seasonal stall's. */
  markers: Record<MarkerWho, { x: number; y: number; shown: boolean }>
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
    shopkeepers: Object.fromEntries(LOT_SHOP_IDS.map((id) => [id, { hopAt: -9, emote: 'note', dir: 0 } satisfies Keeper])) as Record<LotShop, Keeper>,
    markers: { keeper: { x: 0, y: 0, shown: false }, stall: { x: 0, y: 0, shown: false } },
    hidden: false,
    party: -9,
    focus: 0,
    visitors: NO_VISITORS,
    festival: NO_FESTIVAL,
  }
}

/** The shopkeepers present at the plaza's level, with where they stand (world px). */
const keepersAt = (plaza: Plaza, layout: Layout) => layout.keepers.map((k, i) => ({ keeper: plaza.keepers[i]!, x: plaza.x + k.x, y: plaza.y + k.y, spot: k, purple: i === 1 }))

/** The lots' shopkeepers and the visitors present, who talks for each and where they stand (relative to the building's feet): Leavanny by the Boutique, Meowth by his wagon, a stall's keeper (or Lanturn) by the stall. */
const npcsAt = (plaza: Plaza, layout: Layout): { who: PlazaNpc; dex: number; spot: KeeperSpot; shop?: { greet: Keeper; spot: Placed } }[] => {
  const v = plaza.visitors
  return [
    ...layout.shops.map((s) => ({ who: s.who, dex: s.dex, spot: s.keeper, shop: { greet: plaza.shopkeepers[s.id], spot: s.spot } })),
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

/** A lot's shopkeeper (Leavanny at the Boutique) hops and pops an emote at scene time `time`, as the partner comes to shop. */
export const greetShopkeeper = (plaza: Plaza, shop: LotShop, time: number) => {
  plaza.shopkeepers[shop].hopAt = time
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

/** A shop on its lot, relative to the building's feet: from the layout, or from the data until the plaza's PNGs are in. */
const lotOf = (plaza: Plaza, shop: LotShop) => {
  const placed = plazaLayout(plaza)?.shops.find((s) => s.id === shop)
  if (placed) return placed
  const at = LOTS.find((l) => l.shop === shop) ?? LOTS[0]
  return { at, art: arts.get(LOT_SHOPS[shop].art), spot: lotPeople(at, shop).spot }
}

/** Where the partner stands to shop at a lot's shop (before Leavanny at the Boutique), world px. */
export const lotSpot = (plaza: Plaza, shop: LotShop): Vec => {
  const { spot } = lotOf(plaza, shop)
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
    // Standing where it shops at a lot's shop talks to its keeper too.
    ...npcsAt(plaza, layout).map((n) => ({ spot: n.spot, who: n.who, counter: n.shop !== undefined && Math.hypot(p.x - plaza.x - n.shop.spot.x, p.y - plaza.y - n.shop.spot.y) < TALK_RANGE })),
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
  const pad = PADS.fountain
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
  // The shop's building and the lots'.
  for (const b of [{ x: 0, y: 0, art: layout.building, front: layout.pad.y }, ...layout.shops.map((s) => ({ ...s.at, art: s.art, front: LOT_FRONT }))]) {
    const cx = plaza.x + b.x
    const half = b.art.w / 2 + 10
    // Well clear of the roof line: feet just above it read as standing on the roof.
    const top = plaza.y + b.y - b.art.h - 24
    const bottom = plaza.y + b.y + b.front
    if (v.y > top && v.y < bottom && Math.abs(v.x - cx) < half) {
      const side = half - Math.abs(v.x - cx)
      if (v.y - top < side) v.y = top
      else v.x = cx + Math.sign(v.x - cx || 1) * half
      return
    }
  }
  // Off the building's footprint and the visitors' (a wagon or a stall is as solid as its footprint, a little taller behind).
  for (const pad of layout.pads) {
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

/** Who a tap at `at` (world px) is for: the shop (a shopkeeper, the building or its edge marker), a lot's shop (its keeper or building), Meowth (him or his wagon), a stall (or its edge marker), Lanturn (it or its market), the festival's fountain or plaque; null for none. */
export const plazaTapped = (plaza: Plaza, at: Vec): PlazaNpc | null => {
  // A finger's reach around a marker; side by side, the nearer one.
  const reach = (who: MarkerWho) => {
    const m = plaza.markers[who]
    const dx = Math.abs(at.x - m.x)
    const dy = Math.abs(at.y - m.y)
    return m.shown && dx <= 18 && dy <= 15 ? dx + dy : Infinity
  }
  const marked = reach('stall') < reach('keeper') ? 'stall' : 'keeper'
  if (reach(marked) < Infinity) return marked
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
  const shop = layout.shops.find((s) => over(s.art, s.at))
  if (shop) return shop.who
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
  // Meowth's caravan or the seasonal stall on the rim: portrait screens center on it, above the sheet; the rest lean well over to it and step down as far as it needs.
  if ((plaza.focus === 'caravan' || plaza.focus === 'stall') && layout) {
    const [from, to] = plaza.focus === 'caravan' ? [layout.wagon, layout.meowth] : [layout.stall, layout.stallKeeper]
    const mid = Math.round(from.x + (to.x - from.x) / 2)
    const feet = Math.max(from.y, to.y)
    if (h > w * 1.1) return { x: Math.round(plaza.x + mid - w / 2), y: Math.round(plaza.y + feet - h * 0.36) }
    return { x: framed.x + Math.round(mid * 0.7), y: Math.max(framed.y, plaza.y + feet + 48 - h) }
  }
  // A step towards the shopkeeper who talks (the purple brother's shelves).
  const lean = Math.round((layout?.keepers[typeof plaza.focus === 'number' ? plaza.focus : 0]?.x ?? 0) * 0.4)
  return { x: framed.x + lean, y: framed.y }
}

/**
 * Where the camera (its top-left, world px) frames a lot's shop (the
 * Boutique) for a `w`×`h` view, as `plazaFrame` frames Kecleon's: at the top
 * on portrait screens (the sheet and its keeper's box below it), on the left
 * beside the sheet elsewhere.
 */
export const lotFrame = (plaza: Plaza, shop: LotShop, w: number, h: number): Vec => {
  const lot = lotOf(plaza, shop)
  const at = { x: plaza.x + lot.at.x, y: plaza.y + lot.at.y }
  const tall = lot.art?.h ?? 120
  // Portrait: a lot's shop is short, so it rides just under the top, clear of its keeper's box over the sheet.
  if (h > w * 1.1) return { x: Math.round(at.x - w / 2), y: at.y - Math.min(tall + 8, Math.round(h * 0.33)) }
  const left = Math.round(Math.max(w * 0.32, (lot.art?.w ?? 120) / 2 + 46))
  const feet = Math.round(Math.min(h - 44, Math.max(h * 0.6, tall + 12)))
  return { x: at.x - left, y: at.y - feet }
}

const frameAt = (plaza: Plaza, layout: Layout | null, tall: number, w: number, h: number): Vec => {
  // Portrait: the building's feet about a third down (lower for the tall Lv 4 and 5), so it, the shopkeepers and the partner clear the shop's sheet and Kecleon's box below.
  if (h > w * 1.1) {
    const feet = Math.max(Math.round(h * 0.33), Math.min(tall + 8, Math.round(h * 0.47)))
    return { x: Math.round(plaza.x - w / 2), y: plaza.y - feet }
  }
  const left = Math.round(Math.max(w * 0.32, LAMP_X + 46))
  const feet = Math.round(Math.min(h - 44, Math.max(h * 0.6, tall + 12)))
  // The square spreads south of the shop: the view steps down toward it, as far as the shop's roof stays in.
  const drop = layout ? clamp(feet - tall - 4, 0, SQUARE_DROP) : 0
  return { x: plaza.x - left, y: plaza.y - feet + drop }
}

/* ---------------- Drawing ---------------- */

const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] as const

/** A paving's stones, each pixel of a stone one of `stones` but its mortar, its lit top row and its shaded bottom row. */
type Paving = { stones: readonly (readonly number[])[]; mortar: readonly number[]; hi: readonly number[]; lo: readonly number[] }

/** The field's cobblestones, warm cream. */
const FIELD: Paving = {
  stones: ['#d8c8a0', '#cfbd94', '#e0d2ac', '#c8b68c', '#d4c49a'].map(rgb),
  mortar: rgb('#a89470'),
  hi: rgb('#ebe0c0'),
  lo: rgb('#bca880'),
}
/** The bands' stones (inside the curb and around the bed), a darker tan. */
const BAND: Paving = {
  stones: ['#c4a77e', '#bb9d74', '#cbb088', '#b69670', '#c0a27a'].map(rgb),
  mortar: rgb('#8e7656'),
  hi: rgb('#d8c09a'),
  lo: rgb('#a68a62'),
}
/** The cobblestones inside the bed's ring, a shade lighter than the field. */
const INNER: Paving = {
  stones: ['#e0d2ae', '#d8c8a2', '#e6dab8', '#d2c29a', '#dccea8'].map(rgb),
  mortar: rgb('#ae9a76'),
  hi: rgb('#f0e6c8'),
  lo: rgb('#c4b28a'),
}
const TUFT = [rgb('#6aa850'), rgb('#7cc060')] as const

/** The cobblestones' pixel at (x, y) from their origin: staggered 10×6 stones with mortar, a lit top edge and a shaded bottom one. */
const stoneAt = (pave: Paving, x: number, y: number) => {
  const row = Math.floor((y + 600) / 6)
  const offset = (row % 2) * 5
  const ly = (y + 600) % 6
  const lx = (x + 600 + offset) % 10
  const stone = pave.stones[(Math.floor((x + 600 + offset) / 10) * 31 + row * 17) % 5]!
  return lx === 0 || ly === 0 ? pave.mortar : ly === 1 && lx < 9 ? pave.hi : ly === 5 || lx === 9 ? pave.lo : stone
}

/** `count` grass tufts between the stones of a `w`×`h` patch from (x0, y0), from a fixed little generator so the patch never changes. */
const tufts = (x0: number, y0: number, w: number, h: number, count: number, inside: (x: number, y: number) => boolean, set: (x: number, y: number, c: readonly number[]) => void) => {
  let seed = 7
  const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < count; i++) {
    const x = Math.round(x0 + next() * w)
    const y = Math.round(y0 + next() * h)
    if (!inside(x, y) || !inside(x + 1, y - 1)) continue
    set(x, y, TUFT[0])
    set(x + 1, y - 1, TUFT[1])
  }
}

/** How wide (px) a band of paving is: two courses of stones laid along it. */
const BAND_W = 8
/** The walk down the square's axis: how far (px) each side of it. */
const WALK = { half: 20 } as const

/** A band's pixel `along` px around it and `across` px into it (0 to `BAND_W` - 1): two courses of 8 px stones, staggered, with mortar between. */
const bandAt = (along: number, across: number) => {
  const course = across < BAND_W / 2 ? 0 : 1
  const ly = across % (BAND_W / 2)
  const a = Math.floor(along) + 1000 + course * 4
  const lx = a % 8
  const stone = BAND.stones[(Math.floor(a / 8) * 31 + course * 17) % 5]!
  return lx === 0 || ly === 0 ? BAND.mortar : ly === 1 && lx < 7 ? BAND.hi : ly === 3 ? BAND.lo : stone
}

/** How far (px, about) inside the edge of the ellipse `e` (x, y), and how far around it: its parametric angle times its mean radius. Negative outside. */
const insideOf = (e: { x: number; y: number; rx: number; ry: number }, x: number, y: number) => {
  const dx = x - e.x
  const dy = y - e.y
  const n = Math.hypot(dx / e.rx, dy / e.ry)
  // The edge's distance from the norm's gradient: |∇n| = |(dx/rx², dy/ry²)| / n.
  const grad = n > 1e-6 ? Math.hypot(dx / (e.rx * e.rx), dy / (e.ry * e.ry)) / n : 1 / Math.min(e.rx, e.ry)
  return { depth: (1 - n) / grad, along: Math.atan2(dy / e.ry, dx / e.rx) * ((e.rx + e.ry) / 2) }
}

/** The Ring's curb: a light stone lip (and its second row), a seam, the dark outline, and the stone face below the south edge. */
const CURB = { lip: rgb('#e3dac3'), lip2: rgb('#d0c8ae'), seam: rgb('#968568'), line: rgb('#5f5446'), face: rgb('#b8a988'), face2: rgb('#968568') }
/** The curb's shadow on the grass below its face. */
const CURB_SHADOW = [0, 0, 0] as const
const CURB_SHADOW_ALPHA = 56

/** Samples of the square's rim, by angle, for its openings. */
const RIM_STEPS = 720
/** The longest run of samples (about 2.6 px each) a meadow path opens: one running along the curb rather than into it leaves it closed. */
const OPENING_MAX = 26

/** The rim sample (`RIM_STEPS`) at the angle of (x, y) from the square's middle (relative to the building's feet). */
const rimIndex = (x: number, y: number) => {
  const a = Math.atan2((y - SQUARE.y) / SQUARE.ry, (x - SQUARE.x) / SQUARE.rx) / (Math.PI * 2)
  return Math.floor((a - Math.floor(a)) * RIM_STEPS) % RIM_STEPS
}

/**
 * Which of the rim's samples open (1) on a plaza whose building's feet stand
 * at `origin` (world px): the entrance's, and wherever a meadow path meets
 * the curb, a sample wider each side; a path running along the curb for more
 * than `OPENING_MAX` samples leaves it closed.
 */
const openingsAt = (origin: Vec) => {
  const { x, y, rx, ry, gap } = SQUARE
  const hit = new Uint8Array(RIM_STEPS)
  for (let i = 0; i < RIM_STEPS; i++) {
    const a = ((i + 0.5) / RIM_STEPS) * Math.PI * 2
    // Just past the curb's face.
    hit[i] = meadowPath(Math.round(origin.x + x + (rx + 6) * Math.cos(a)), Math.round(origin.y + y + (ry + 6) * Math.sin(a))) ? 1 : 0
  }
  const open = new Uint8Array(RIM_STEPS)
  // Walk the runs from a closed sample, so none wraps around the start.
  const start = hit.indexOf(0)
  if (start >= 0) {
    for (let k = 0; k < RIM_STEPS; ) {
      const i = (start + k) % RIM_STEPS
      if (!hit[i]) {
        k++
        continue
      }
      let len = 0
      while (len < RIM_STEPS && hit[(i + len) % RIM_STEPS]) len++
      if (len <= OPENING_MAX) for (let j = -1; j <= len; j++) open[(i + j + RIM_STEPS) % RIM_STEPS] = 1
      k += len
    }
  }
  for (let i = 0; i < RIM_STEPS; i++) {
    const a = ((i + 0.5) / RIM_STEPS) * Math.PI * 2
    if (Math.sin(a) > 0 && Math.abs(rx * Math.cos(a)) < gap) open[i] = 1
  }
  return open
}

/** The square's box (relative to the building's feet), its curb's face and shadow included. */
const SQUARE_BOX: Box = { left: SQUARE.x - SQUARE.rx - 1, top: SQUARE.y - SQUARE.ry - 1, right: SQUARE.x + SQUARE.rx + 1, bottom: SQUARE.y + SQUARE.ry + 5 }

/**
 * The square's floor (`SQUARE`, relative to the building's feet), built once
 * per plaza into a canvas whose top-left is (`x`, `y`): cobblestones framed
 * by a band of darker paving inside a 3 px curb (dark outline, light lip,
 * seam) whose stone face shows below the south edge, a second band around the
 * bed with lighter stones inside it, a walk of those down the axis (`WALK`)
 * from the shop's door to the entrance, and a few grass tufts. The curb opens
 * (`openingsAt`) at the entrance and wherever a meadow path arrives, so the
 * paving meets the path (`origin`: the building's feet, world px).
 */
const floorArt = (() => {
  const cache = new Map<string, { canvas: HTMLCanvasElement; x: number; y: number }>()
  onCanvasReset(
    () => cache.clear(),
    () => cache,
  )
  return (origin: Vec) => {
    const key = `${origin.x},${origin.y}`
    const hit = cache.get(key)
    if (hit) return hit
    const open = openingsAt(origin)
    const x0 = SQUARE_BOX.left - 2
    const y0 = SQUARE_BOX.top - 2
    const w = SQUARE_BOX.right + 3 - x0
    const h = SQUARE_BOX.bottom + 3 - y0
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
    const inside = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) inside[y * w + x] = Math.hypot((x + x0 - SQUARE.x) / SQUARE.rx, (y + y0 - SQUARE.y) / SQUARE.ry) < 1 ? 1 : 0
    const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && inside[y * w + x] === 1
    // Whether the curb opens at canvas pixel (x, y), and whether it ends there beside an opening.
    const opening = (x: number, y: number) => open[rimIndex(x + x0, y + y0)] === 1
    const curbEnd = (x: number, y: number) => {
      const i = rimIndex(x + x0, y + y0)
      return !open[i] && (open[(i + 1) % RIM_STEPS] === 1 || open[(i + RIM_STEPS - 1) % RIM_STEPS] === 1)
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const wx = x + x0
        const wy = y + y0
        if (at(x, y)) {
          // How far in from the edge (1 to 3, along the rows and columns): the curb's rows.
          let dist = 0
          for (let k = 1; k <= 3 && !dist; k++) if (!at(x - k, y) || !at(x + k, y) || !at(x, y - k) || !at(x, y + k)) dist = k
          if (dist && !opening(x, y)) {
            // The south rim's top row is its lip; the face hangs below it.
            if (curbEnd(x, y) || dist === 1) set(x, y, dist === 1 && at(x, y - 1) && !at(x, y + 1) && !curbEnd(x, y) ? CURB.lip : CURB.line)
            else set(x, y, dist === 2 ? CURB.lip : CURB.seam)
            continue
          }
          const rim = insideOf(SQUARE, wx, wy)
          if (rim.depth < 3 + BAND_W) {
            set(x, y, bandAt(rim.along, Math.max(0, Math.floor(rim.depth) - 3)))
            continue
          }
          const ring = insideOf(SQUARE.ring, wx, wy)
          const off = Math.abs(wx - SQUARE.x)
          if (ring.depth >= 0 && ring.depth < BAND_W) set(x, y, bandAt(ring.along, Math.floor(ring.depth)))
          else if (ring.depth >= 0) set(x, y, stoneAt(INNER, wx, wy))
          // The walk down the axis, from the shop's door to the ring and on to the entrance, edged with a course of the bands' stones.
          else if (off < WALK.half) set(x, y, off >= WALK.half - BAND_W / 2 ? bandAt(wy, off - (WALK.half - BAND_W / 2)) : stoneAt(INNER, wx, wy))
          else set(x, y, stoneAt(FIELD, wx, wy))
          continue
        }
        // Below a south-facing edge: the face, its outline, then a shadow on the grass; none where the curb opens.
        const up = at(x, y - 1) ? 1 : at(x, y - 2) ? 2 : at(x, y - 3) ? 3 : at(x, y - 4) ? 4 : 0
        if (up && opening(x, y - up)) continue
        if (up === 1) set(x, y, curbEnd(x, y - 1) ? CURB.line : CURB.face)
        else if (up === 2) set(x, y, curbEnd(x, y - 2) ? CURB.line : CURB.face2)
        else if (up === 3) set(x, y, CURB.line)
        else if (up === 4) set(x, y, CURB_SHADOW, CURB_SHADOW_ALPHA)
        else if ((at(x - 1, y) || at(x + 1, y) || at(x, y + 1)) && !opening(x, y)) set(x, y, CURB.line)
      }
    }
    // Tufts keep off the curb and the bands, and come about as dense on any size of floor.
    const tuftable = (x: number, y: number) => insideOf(SQUARE, x + x0, y + y0).depth > 3 + BAND_W + 2
    tufts(0, 0, w, h, Math.round((w * h) / 2000), tuftable, (x, y, c) => set(x, y, c))
    ctx.putImageData(image, 0, 0)
    const floor = { canvas, x: x0, y: y0 }
    cache.set(key, floor)
    return floor
  }
})()

/**
 * The entrance's lane: how far (px) each side of its middle it runs where it
 * meets a path (about a meadow path's half width), over how long it narrows
 * to that from the entrance's width, how far it looks for a path, and how
 * steeply south of the entrance it prefers one (rise over run).
 */
const LANE = { r: 6, taper: 90, reach: 360, cone: 0.6 } as const
/** The ground a lane may cross (relative to the building's feet). */
const LANE_BOX: Box = {
  left: SQUARE.x - LANE.reach - SQUARE.gap,
  top: SQUARE.y + SQUARE.ry - 8,
  right: SQUARE.x + LANE.reach + SQUARE.gap,
  bottom: SQUARE.y + SQUARE.ry + LANE.reach + SQUARE.gap,
}

/**
 * The lane from the square's entrance to the nearest meadow path below it, on
 * a plaza whose building's feet stand at `origin` (world px): a curve leaving
 * the entrance straight south, as wide as it and narrowing to a path's width,
 * then turning to meet the path, painted in the path's own dithered shades
 * (`meadowPathRgb`) so the two join as one. Built once per plaza, into a
 * canvas whose top-left is (`x`, `y`) relative to the building's feet; null
 * when a path already meets the entrance or none lies within `LANE.reach`.
 */
const laneArt = (() => {
  const cache = new Map<string, { canvas: HTMLCanvasElement; x: number; y: number } | null>()
  onCanvasReset(
    () => cache.clear(),
    () => cache,
  )
  return (origin: Vec) => {
    const key = `${origin.x},${origin.y}`
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    const from = { x: SQUARE.x, y: SQUARE.y + SQUARE.ry }
    // The nearest path pixel below the entrance: within a cone south of it, so the lane heads away from the square, or else anywhere below.
    const nearest = (cone: number) => {
      let at: Placed | null = null
      let d = Infinity
      for (let dy = 6; dy <= LANE.reach; dy += 2) {
        for (let dx = -LANE.reach; dx <= LANE.reach; dx += 2) {
          const r = Math.hypot(dx, dy)
          if (r >= d || dy < Math.abs(dx) * cone || !meadowPath(origin.x + from.x + dx, origin.y + from.y + dy)) continue
          d = r
          at = { x: from.x + dx, y: from.y + dy }
        }
      }
      return at && { at, d }
    }
    const found = nearest(LANE.cone) ?? nearest(0)
    const to = found?.at
    const best = found?.d ?? Infinity
    if (!to || best < LANE.r * 2) {
      cache.set(key, null)
      return null
    }
    // Down from the entrance, then round to the path: a quadratic curve through the corner below the entrance, level with the path.
    const bend = { x: from.x, y: to.y }
    const steps = Math.ceil(best * 2)
    const centres = Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps
      const u = 1 - t
      return { x: u * u * from.x + 2 * u * t * bend.x + t * t * to!.x, y: u * u * (from.y - 4) + 2 * u * t * bend.y + t * t * to!.y }
    })
    // Each centre's half width: the entrance's at the curb, narrowing to the path's along the taper.
    let run = 0
    const radii = centres.map((c, i) => {
      if (i > 0) run += Math.hypot(c.x - centres[i - 1]!.x, c.y - centres[i - 1]!.y)
      return LANE.r + (SQUARE.gap - LANE.r) * Math.max(0, 1 - run / LANE.taper)
    })
    const pad = SQUARE.gap + 1
    const x0 = Math.floor(Math.min(...centres.map((c) => c.x))) - pad
    const y0 = Math.floor(Math.min(...centres.map((c) => c.y))) - pad
    const w = Math.ceil(Math.max(...centres.map((c) => c.x))) + pad + 1 - x0
    const h = Math.ceil(Math.max(...centres.map((c) => c.y))) + pad + 1 - y0
    const canvas = createCanvas(w, h)
    const ctx = context2d(canvas)
    const image = ctx.createImageData(w, h)
    const px = image.data
    centres.forEach((c, i) => {
      const r = radii[i]!
      const reach = (r + 0.5) ** 2
      for (let y = Math.floor(c.y - r); y <= Math.ceil(c.y + r); y++) {
        for (let x = Math.floor(c.x - r); x <= Math.ceil(c.x + r); x++) {
          if ((x - c.x) ** 2 + (y - c.y) ** 2 > reach) continue
          const j = ((y - y0) * w + (x - x0)) * 4
          if (px[j + 3]) continue
          const shade = meadowPathRgb(origin.x + x, origin.y + y)
          px[j] = shade[0]
          px[j + 1] = shade[1]
          px[j + 2] = shade[2]
          px[j + 3] = 255
        }
      }
    })
    ctx.putImageData(image, 0, 0)
    const lane = { canvas, x: x0, y: y0 }
    cache.set(key, lane)
    return lane
  }
})()

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
  if ('rx' in s) return blitPacked(ctx, ellipse(s.rx, s.ry, SHADOW), x, y)
  const mask = silhouette(s.art)
  ctx.drawImage(mask, Math.round(x - (s.art.minX + s.art.w / 2)) + 2, Math.round(y - mask.height) + 2)
}

/** Draws the plaza's ground (the entrance's lane, the square's floor, the pieces' shadows) under everyone, when it's in view. */
export const drawPlazaGround = (ctx: CanvasRenderingContext2D, plaza: Plaza, camX: number, camY: number, w: number, h: number) => {
  const layout = plazaLayout(plaza)
  if (!layout) return
  // Whether a box (relative to the building's feet) reaches into the view.
  const seen = (b: Box) => plaza.x + b.right + 8 - camX >= 0 && plaza.x + b.left - 8 - camX <= w && plaza.y + b.bottom + 8 - camY >= 0 && plaza.y + b.top - camY <= h
  // The lane reaches far south of the square: it's looked for once the ground it may cross comes into view, and draws whenever it's in view itself.
  const lane = seen(LANE_BOX) ? laneArt(plaza) : null
  if (lane && seen({ left: lane.x, top: lane.y, right: lane.x + lane.canvas.width, bottom: lane.y + lane.canvas.height })) {
    ctx.drawImage(lane.canvas, Math.round(plaza.x + lane.x - camX), Math.round(plaza.y + lane.y - camY))
  }
  if (!seen(layout.bounds)) return
  const floor = floorArt(plaza)
  ctx.drawImage(floor.canvas, Math.round(plaza.x + floor.x - camX), Math.round(plaza.y + floor.y - camY))
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

/** The plaza's upright pieces (the buildings, shopkeepers, props, visitors), world y of their feet, built once per layout. */
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
    ...layout.shops.map((s): Piece => {
      const x = plaza.x + s.at.x
      const y = plaza.y + s.at.y
      return { y, draw: (ctx, camX, camY) => put(ctx, s.art, x - camX, y - camY) }
    }),
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
        // A lot's shopkeeper hops and pops an emote as the partner comes to shop (`greetShopkeeper`).
        const greet = n.shop?.greet
        const since = greet ? time - greet.hopAt : -1
        const lift = hop(since, 2, 4)
        shadow(ctx, x - camX, y - camY, sprite.bodyW)
        drawPokemon(ctx, sprite, 'Idle', visitorDirs.get(plaza)?.[n.who] ?? n.spot.dir, time + 0.7, x - camX, y - camY - lift)
        if (greet && since >= 0 && since < KEEPER_REACTION) blitCentered(ctx, EMOTES()[greet.emote], x - camX, y - camY - sprite.bodyH - lift - 8 - (Math.floor(since * 4) % 2))
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
    blitPacked(ctx, ellipse(4, 3, '#f0ead8'), Math.round(x + Math.cos(a) * layout.pad.rx * r), Math.round(y + Math.sin(a) * layout.pad.ry * r - k * 4))
  }
  ctx.globalAlpha = 1
  drawSparkles(ctx, x, y - layout.building.h / 2, layout.building.w * 0.8, since - 0.15, 7)
  drawSparkles(ctx, x, y - layout.building.h * 0.7, layout.building.w * 0.5, since - 0.45, 11)
}

/** Who an edge marker leads to: the shop (Kecleon's card) or a seasonal stall (its keeper's). */
export type MarkerWho = 'keeper' | 'stall'

/** A card's inner colour, its arrow's and how far (px) below the sprite's top its head shows, for the shop and each seasonal stall. */
export type MarkerLook = { card: string; arrow: string; headDy: number }
const SHOP_MARKER: MarkerLook = { card: '#e0f0d0', arrow: '#5cb048', headDy: 0 }
const STALL_MARKERS = {
  // Duskull's top is its hood: the card shows the skull under it.
  halloween: { card: '#e8dcf4', arrow: '#f08830', headDy: 8 },
  christmas: { card: '#f8e0e0', arrow: '#d84838', headDy: 0 },
} as const satisfies Record<StallId, MarkerLook>

const markerCards = canvasCache<string, HTMLCanvasElement>()
/** Stall keepers whose sheets were asked for, so the marker asks once. */
const markerAsked = new Set<number>()

/** An edge marker's box: a Pokémon's head (`dex`) on a white card. Null until its sheets are in. */
export const markerCard = (dex: number, look: MarkerLook) => {
  const key = `${dex}:${look.card}`
  const cached = markerCards.get(key)
  if (cached) return cached
  const s = loadedSprites(dex)
  if (!s) return null
  const sheet = s.anims.Idle
  const card = createCanvas(24, 19)
  const ctx = context2d(card)
  ctx.fillStyle = '#283040'
  ctx.fillRect(1, 0, 22, 19)
  ctx.fillRect(0, 1, 24, 17)
  ctx.fillStyle = '#f8f8f8'
  ctx.fillRect(1, 1, 22, 17)
  ctx.fillStyle = look.card
  ctx.fillRect(2, 2, 20, 15)
  // The head: the top of the first idle frame (`headDy` lower), facing the player.
  const top = Math.max(0, Math.round(sheet.fh / 2 + s.footY - s.bodyH) + look.headDy)
  ctx.drawImage(sheet.img, Math.round(sheet.fw / 2 - 9), top, 18, 14, 3, 3, 18, 14)
  markerCards.set(key, card)
  return card
}
/** How far (px) the plaza must reach into the view to count as on screen: a sliver at the edge still gets the marker, drawn over it. */
const MARKER_INSET = 16

/**
 * Whether a piece of the plaza (the building, a prop, a visitor, a festival
 * piece) reaches `MARKER_INSET` px into the `w`×`h` view. The floor doesn't
 * count: a caravan or a stall widens it into the corner of home's view, where
 * a few cobblestones (often under the lobby's buttons) don't say where the shop is.
 */
const plazaInView = (plaza: Plaza, layout: Layout, camX: number, camY: number, w: number, h: number) => {
  const left = camX + MARKER_INSET - plaza.x
  const top = camY + MARKER_INSET - plaza.y
  const right = camX + w - MARKER_INSET - plaza.x
  const bottom = camY + h - MARKER_INSET - plaza.y
  return layout.pieces.some((b) => b.right > left && b.left < right && b.bottom > top && b.top < bottom)
}

/** A box on screen, view px. */
export type ViewBox = { left: number; top: number; right: number; bottom: number }

/**
 * Where an edge marker for the view point `target` stands (its card's middle)
 * and which way its arrow points. `inside` (a phone's lobby, its cards up) is
 * the open meadow around the partner: the view's edges are under the cards
 * there, so the marker sits at that box's lower corner on the target's side,
 * where it shows whole and takes taps.
 */
export const edgeSpot = (target: Vec, w: number, h: number, bob: number, inside: ViewBox | null) => {
  const cx = w / 2
  const cy = h / 2
  const dx = target.x - cx
  const dy = target.y - cy
  // The card (24×19) and its arrow (5 px) stay whole inside the view.
  const ex = w / 2 - 20
  const ey = h / 2 - 17
  const t = Math.min(ex / Math.max(1e-6, Math.abs(dx)), ey / Math.max(1e-6, Math.abs(dy)))
  const sideways = inside !== null || Math.abs(dx) * ey >= Math.abs(dy) * ex
  const edge = inside
    ? { x: clamp(dx >= 0 ? inside.right - 18 : inside.left + 18, 18, w - 18), y: clamp(inside.bottom - 11, 11, h - 11) }
    : { x: clamp(cx + dx * t, 20, w - 20), y: clamp(cy + dy * t, h * 0.16, h * 0.84) }
  return {
    x: Math.round(edge.x) + (sideways ? Math.sign(dx) * bob : 0),
    y: Math.round(edge.y) + (sideways ? 0 : Math.sign(dy) * bob),
    dir: sideways ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) },
  }
}

type EdgeSpot = ReturnType<typeof edgeSpot>

/** Draws a marker's card at `at` and its arrow on the side facing its target: a dark triangle around a coloured one. */
export const drawMarker = (ctx: CanvasRenderingContext2D, box: HTMLCanvasElement, at: EdgeSpot, arrow: string) => {
  const { x, y, dir } = at
  ctx.drawImage(box, x - 12, y - 9)
  const baseX = dir.x > 0 ? x + 12 : dir.x < 0 ? x - 13 : x
  const baseY = dir.y > 0 ? y + 10 : dir.y < 0 ? y - 10 : y
  for (let i = 0; i < 5; i++) {
    const len = 9 - i * 2
    ctx.fillStyle = i < 4 && i > 0 ? arrow : '#283040'
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
}

/**
 * Moves the stall's marker `b` off the shop's `a` when they'd overlap (both
 * point east from home): along the edge, to the side the stall lies on, or
 * the other one when the view's edge is too close.
 */
const besideMarker = (a: EdgeSpot, b: EdgeSpot, w: number, h: number): EdgeSpot => {
  if (Math.abs(a.x - b.x) >= 26 || Math.abs(a.y - b.y) >= 21) return b
  if (b.dir.x !== 0) {
    const side = b.y >= a.y ? 1 : -1
    const y = a.y + side * 21
    return { ...b, y: y >= h * 0.16 && y <= h * 0.84 ? y : a.y - side * 21 }
  }
  const side = b.x >= a.x ? 1 : -1
  const x = a.x + side * 26
  return { ...b, x: x >= 20 && x <= w - 20 ? x : a.x - side * 26 }
}

/**
 * Cards at the edge of the view with an arrow, pointing at the shop
 * (Kecleon's head) and at a seasonal stall (its keeper's) while no piece of
 * the plaza (the building, a visitor, the festival's pieces) is on screen.
 * They remember where they were drawn (`plaza.markers`) so a tap on one can
 * lead there. On a phone's lobby they keep to `inside` (see `edgeSpot`).
 */
export const drawPlazaMarker = (ctx: CanvasRenderingContext2D, plaza: Plaza, camX: number, camY: number, w: number, h: number, time: number, show: boolean, inside: ViewBox | null) => {
  plaza.markers.keeper.shown = false
  plaza.markers.stall.shown = false
  const layout = plazaLayout(plaza)
  if (!show || !layout || plazaInView(plaza, layout, camX, camY, w, h)) return
  const bob = Math.floor(time * 3) % 2
  const shop = edgeSpot({ x: plaza.x - camX, y: plaza.y - 30 - camY }, w, h, bob, inside)
  const stallId = plaza.visitors.stall
  if (stallId) {
    const { dex } = STALLS[stallId]
    if (!markerAsked.has(dex)) {
      markerAsked.add(dex)
      void loadSpecies(dex).catch(() => {})
    }
    const box = markerCard(dex, STALL_MARKERS[stallId])
    if (box) {
      const at = besideMarker(shop, edgeSpot({ x: plaza.x + layout.stall.x - camX, y: plaza.y + layout.stall.y - 30 - camY }, w, h, bob, inside), w, h)
      drawMarker(ctx, box, at, STALL_MARKERS[stallId].arrow)
      Object.assign(plaza.markers.stall, { x: at.x + camX, y: at.y + camY, shown: true })
    }
  }
  const box = markerCard(KECLEON_DEX, SHOP_MARKER)
  if (!box) return
  drawMarker(ctx, box, shop, SHOP_MARKER.arrow)
  Object.assign(plaza.markers.keeper, { x: shop.x + camX, y: shop.y + camY, shown: true })
}

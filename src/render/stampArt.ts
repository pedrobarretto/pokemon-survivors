import { artImages, canvasCache, context2d, createCanvas, fromStrings } from '../engine/pixelart'
import { STAMP_MILESTONES, STAMPS, type StampGroup, type StampId, type StampTier } from '../data/realmStamps'

/**
 * The Estampas' art: each is a postage stamp drawn here from its icon
 * (`public/assets/realm/stamps.png`, a sheet of 40 px PixelLab pictures, no
 * Pokémon in any of them), with perforated edges, a frame by difficulty and a
 * background by group. Whole pixels only: the book scales them by 2 or 3.
 */

/** A drawn stamp is this many px square; its icon fills the middle `ICON` px. */
export const STAMP_SIZE = 48
const ICON = 40

/** What a milestone gives, in the sheet after the stamps. */
export type RewardIcon = (typeof STAMP_MILESTONES)[number]['reward']['id']

/** The sheet's cells in reading order, 9 to a row. Every stamp and reward has one (`stampArt.test.ts`). */
export const SHEET_ORDER = [
  'firstSteps', 'tourist', 'errandRunner', 'reliable', 'dependable', 'benchWarmer', 'catNap', 'wetFeet', 'nightOwl',
  'hello', 'expressive', 'goodCompany', 'regular', 'townFixture', 'partyStarter', 'portalHopper', 'crowded', 'twins',
  'neighbor', 'wanderer', 'fanMail', 'decorator', 'host', 'openHouse', 'goneFishing', 'oldSalt', 'arcadeRat',
  'tableTalk', 'tableChampion', 'bigHaul', 'flawless', 'dugtrioDay', 'ugliestFish', 'redTide', 'perfectDuel', 'highTide',
  'stormChaser', 'tableNight', 'everyHour', 'neverMissed', 'stampDesk', 'stampFrame', 'stampCabinet', 'stampCollector', 'goldenStampPress',
] as const satisfies readonly (StampId | RewardIcon)[]

const COLUMNS = 9

type SheetCell = (typeof SHEET_ORDER)[number]

const sheet = artImages<'sheet'>(() => `${import.meta.env.BASE_URL}assets/realm/stamps.png`)

const SHEET = canvasCache<'sheet', HTMLCanvasElement>('shared')

/** The icons' sheet on a canvas once it's in, started on the first ask; null until then. */
const sheetImage = () => {
  const held = SHEET.get('sheet')
  if (held) return held
  const copy = sheet.copy('sheet')
  if (copy) SHEET.set('sheet', copy)
  return copy
}

/** Resolves as the sheet lands (the book paints its stamps then), or after a few seconds without it. */
export const stampArtReady = () =>
  new Promise<void>((done) => {
    const started = performance.now()
    const wait = () => (sheetImage() !== null || performance.now() - started > 8000 ? done() : setTimeout(wait, 60))
    wait()
  })

/** Draws an icon at `x, y` (its `ICON` px cell), whole. False while the sheet is still on its way. */
const drawIcon = (ctx: CanvasRenderingContext2D, id: SheetCell, x: number, y: number) => {
  const img = sheetImage()
  if (!img) return false
  const i = SHEET_ORDER.indexOf(id)
  ctx.drawImage(img, (i % COLUMNS) * ICON, Math.floor(i / COLUMNS) * ICON, ICON, ICON, x, y, ICON, ICON)
  return true
}

/** Frame colors by difficulty: its body, the lit corner and the shade. */
const FRAME: Record<StampTier, { body: string; light: string; shade: string }> = {
  easy: { body: '#5aa848', light: '#90d870', shade: '#387030' },
  medium: { body: '#3f7fd8', light: '#88c0f8', shade: '#285090' },
  hard: { body: '#9858d0', light: '#d0a0f8', shade: '#603088' },
  extreme: { body: '#e8b030', light: '#fff0a0', shade: '#a06810' },
}

const BACK: Record<StampGroup, string> = { town: '#cfe9ae', social: '#fad4c4', bases: '#e2d4f4', games: '#c2e4f4', events: '#fbeaa8' }

const PAPER = '#fffdf4'

const QUESTION = ['..1111..', '.111111.', '11....11', '11....11', '.....111', '....111.', '...111..', '...11...', '........', '...11...', '...11...']

/** The paper: a square with a bite out of its edges every 4 px, its shadow falling a pixel down and right. */
const paperAt = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  const s = STAMP_SIZE
  const toothed = (fill: string, dx: number, dy: number) => {
    ctx.fillStyle = fill
    ctx.fillRect(x + dx + 1, y + dy + 1, s - 2, s - 2)
    for (let i = 2; i < s - 2; i += 4) {
      ctx.fillRect(x + dx + i, y + dy, 2, 1)
      ctx.fillRect(x + dx + i, y + dy + s - 1, 2, 1)
      ctx.fillRect(x + dx, y + dy + i, 1, 2)
      ctx.fillRect(x + dx + s - 1, y + dy + i, 1, 2)
    }
  }
  toothed('rgba(90,62,30,0.35)', 1, 1)
  toothed(PAPER, 0, 0)
}

const frameAt = (ctx: CanvasRenderingContext2D, x: number, y: number, tier: StampTier | null, back: string) => {
  const s = STAMP_SIZE
  const c = tier ? FRAME[tier] : { body: '#c8bc9c', light: '#e4dcc2', shade: '#a89c80' }
  ctx.fillStyle = c.body
  ctx.fillRect(x + 3, y + 3, s - 6, s - 6)
  ctx.fillStyle = c.light
  ctx.fillRect(x + 3, y + 3, s - 6, 1)
  ctx.fillRect(x + 3, y + 3, 1, s - 6)
  ctx.fillStyle = c.shade
  ctx.fillRect(x + 3, y + s - 4, s - 6, 1)
  ctx.fillRect(x + s - 4, y + 3, 1, s - 6)
  ctx.fillStyle = back
  ctx.fillRect(x + 4, y + 4, ICON, ICON)
}

/** An icon flattened to one color: what a stamp still to earn shows, so the page hints at it. */
const silhouette = (id: StampId) => {
  const c = createCanvas(ICON, ICON)
  const ctx = context2d(c)
  if (!drawIcon(ctx, id, 0, 0)) return null
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = '#c9bd9f'
  ctx.fillRect(0, 0, ICON, ICON)
  return c
}

/** How a stamp shows: earned in color, `locked` a silhouette, `hidden` a "?". */
export type StampLook = 'earned' | 'locked' | 'hidden'

/** Paints a stamp on `ctx` at `x, y` (`STAMP_SIZE` square). */
export const drawStamp = (ctx: CanvasRenderingContext2D, x: number, y: number, id: StampId, look: StampLook) => {
  const def = STAMPS[id]
  paperAt(ctx, x, y)
  frameAt(ctx, x, y, look === 'earned' ? def.tier : null, look === 'earned' ? BACK[def.group] : '#efe7cf')
  if (look === 'hidden') {
    const q = fromStrings(QUESTION, { 1: '#b8ab8a' })
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(q, x + 16, y + 13, q.width * 2, q.height * 2)
  } else if (look === 'locked') {
    const shape = silhouette(id)
    if (shape) ctx.drawImage(shape, x + 4, y + 4)
  } else drawIcon(ctx, id, x + 4, y + 4)
}

/** A stamp on its own canvas. */
export const stampCanvas = (id: StampId, look: StampLook) => {
  const c = createCanvas(STAMP_SIZE, STAMP_SIZE)
  drawStamp(context2d(c), 0, 0, id, look)
  return c
}

const FOR_SCENE = canvasCache<string, HTMLCanvasElement>('shared')

/** A stamp for the town's canvas, painted once (kept until a GPU reset). Null until its art is in. */
export const sceneStamp = (id: StampId, look: StampLook) => {
  if (!sheetImage()) return null
  const key = `${id}:${look}`
  let c = FOR_SCENE.get(key)
  if (!c) FOR_SCENE.set(key, (c = stampCanvas(id, look)))
  return c
}

/** A bare icon (a reward or a Recado's) on a canvas of its `ICON` px cell; `locked` flattens it. */
export const iconCanvas = (id: SheetCell, locked = false) => {
  const c = createCanvas(ICON, ICON)
  const ctx = context2d(c)
  if (drawIcon(ctx, id, 0, 0) && locked) {
    ctx.globalCompositeOperation = 'source-in'
    ctx.fillStyle = '#b8ab8a'
    ctx.fillRect(0, 0, ICON, ICON)
  }
  return c
}

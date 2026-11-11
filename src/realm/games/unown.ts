import { playSfx } from '../../engine/audio'
import { canvasCache, context2d, createCanvas, fromStrings, lazy, type PixelSprite } from '../../engine/pixelart'
import { t } from '../../i18n'
import type { TableView } from '../../net/realmTables'
import { drawPokemon, loadSpecies, loadedFormSprites, loadedSprites, sprites, type FormKey, type SpeciesSprites } from '../../render/sprites'
import { INK, box, burst, button, centered, clip, drawBits, fluidSize, inside, label, loadSeated, seatedAt, stepBits, tableTop, wrap, type Bit, type Rect, type Seated } from './cafeKit'
import type { GameInput, TableCtx, TableRun, TableUi } from './frame'
import { UNOWN, UNOWN_TYPES, cardOf, isWild, playable, unownRules, type UnownCard, type UnownEvent, type UnownType, type UnownView } from './unown.rules'

/**
 * Unown's screen (`MINIGAMES.unown`, rules in `unown.rules.ts`): the three
 * rivals along the top in the order play reaches them (arrows say which way
 * it goes), the felt in the middle with the draw pile, the pile's top card
 * and the type in play, and your hand along the bottom (up to four rows on a
 * phone held upright when it grows), with UNOWN!, Comprar and Passar.
 *
 * Press a card to lift it, slide to another, lift your finger to play it (a
 * wild asks for its type first); tap the draw pile (or Comprar) to draw.
 * With two cards, tap UNOWN! before playing the next or the table makes you
 * draw 2. The table's events (`UnownView.events`) play out one by one: a
 * card flying to the pile, cards dealt to whoever draws, a skip, the order
 * turning round. Each card prints its Latin letter big in its corner and its
 * type's icon, so the Unown glyph in the middle is only the art.
 */

const CARD = { w: 34, h: 48 } as const

/** Seconds: a card's flight to the pile, a draw's per-card beat, a skip's and a reverse's hold, a note's life. */
const BEAT = { play: 0.26, draw: 0.1, skip: 0.45, reverse: 0.55, note: 1.5 } as const

/* ---------------- Types and art ---------------- */

/** The types' colors, darkest to lightest Water, Fire, Grass, Electric, so they read apart without color too; each card also prints its type's icon. */
const TYPE_COLOR: Record<UnownType, { dark: string; mid: string; light: string; pale: string }> = {
  fire: { dark: '#8c2410', mid: '#d84a24', light: '#f89060', pale: '#fde4d4' },
  water: { dark: '#122c78', mid: '#2a5cc8', light: '#78a4f0', pale: '#dce6fa' },
  grass: { dark: '#1e6a2c', mid: '#46b04c', light: '#9ce07c', pale: '#e2f6d8' },
  electric: { dark: '#8a6a00', mid: '#f0c018', light: '#fce878', pale: '#fff6c8' },
}

/** The types' icons, 9 × 9: a flame, a drop, a leaf, a bolt. */
const ICONS: Record<UnownType, readonly string[]> = {
  fire: ['....o....', '...oro...', '...orro..', '..oryrro.', '.oryyyro.', '.orywyro.', 'oryywyyro', '.oryyyro.', '..ooooo..'],
  water: ['....o....', '...obo...', '...obo...', '..obbbo..', '.obbbbbo.', '.olbbbbo.', '.owlbbbo.', '..olbbo..', '...ooo...'],
  grass: ['.....ooo.', '...oolllo', '..ollgglo', '.olggdglo', '.olgdggo.', '.ogdggo..', '.odggo...', 'od.oo....', 'o........'],
  electric: ['.....ooo.', '....oyyo.', '...oyyo..', '..oyyoo..', '.oyyyyyo.', '..ooyyo..', '...oyo...', '..oyo....', '..oo.....'],
}
const ICON_PALETTE = { o: INK, r: '#e05828', y: '#f8d040', w: '#fff8c0', b: '#3878e0', l: '#a8d8ff', g: '#58b840', d: '#2c7828' } as const
const icons = lazy(() => Object.fromEntries(UNOWN_TYPES.map((ty) => [ty, fromStrings(ICONS[ty], ICON_PALETTE)])) as Record<UnownType, PixelSprite>)

/** Chunky 5 × 7 glyphs for the cards' corners: the letters, and the move cards' marks. */
const GLYPH: Record<string, readonly string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  /** Protect: a circle struck through. */
  '/': ['01110', '10011', '10101', '10101', '11001', '10001', '01110'],
  /** Trick Room: two arrows turning round. */
  '~': ['01100', '10010', '10111', '10010', '11101', '01001', '00110'],
  /** A wild: a diamond. */
  '*': ['00100', '01110', '11111', '11011', '11111', '01110', '00100'],
}

/** A corner mark in the chunky glyphs, 2 px strokes across, outlined in ink. */
/**
 * The game's name spelled in Unown, 7 × 7 a letter (an eye and its limbs:
 * U, N, O, W, N), the same glyphs as the trophy plaque's: printed on the felt.
 */
const GLYPHS = {
  U: ['t.....t', 't.....t', 't.....t', 't.....t', 't.ttt.t', '.tt.tt.', '..ttt..'],
  N: ['t.....t', 'tt....t', 't.ttt.t', 't.t.t.t', 't.ttt.t', 't....tt', 't.....t'],
  O: ['..ttt..', '.t...t.', 't.ttt.t', 't.t.t.t', 't.ttt.t', '.t...t.', '..ttt..'],
  W: ['t.....t', 't..t..t', 't.ttt.t', 't.t.t.t', 't.ttt.t', '.t.t.t.', '..t.t..'],
} as const
const glyphWord = lazy(() => {
  const rows = Array.from({ length: 7 }, (_, r) => (['U', 'N', 'O', 'W', 'N'] as const).map((l) => GLYPHS[l][r]).join('.'))
  return fromStrings(rows, { t: '#18482a' })
})

const marks = canvasCache<string, PixelSprite>()
const mark = (text: string, color: string) => {
  const key = `${text}|${color}`
  const hit = marks.get(key)
  if (hit) return hit
  const glyphs = [...text].map((c) => GLYPH[c] ?? GLYPH['*']!)
  const w = glyphs.reduce((s, g) => s + g[0]!.length + 1, 0) + 2
  const c = createCanvas(w + 1, 10)
  const g = context2d(c)
  const plot = (fill: string, dx: number, dy: number) => {
    g.fillStyle = fill
    let ox = 1
    for (const glyph of glyphs) {
      glyph.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) if (row[x] === '1') g.fillRect(ox + x + dx, 1 + y + dy, 1, 1)
      })
      ox += glyph[0]!.length + 1
    }
  }
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1]] as const) plot(INK, dx, dy)
  plot(color, 0, 0)
  marks.set(key, c)
  return c
}

/** A card's corner mark: its letter, or its move's sign. */
const cornerOf = (c: UnownCard) =>
  c.face === 'protect' ? '/' : c.face === 'trickRoom' ? '~' : c.face === 'doubleKick' ? '+2' : c.face === 'mew' ? '+4' : c.face === 'ditto' ? '*' : c.face

/** The move cards' pictures, 18 × 18, drawn in the card's dark color on its pale window. */
const MOVE_ART: Record<'protect' | 'trickRoom' | 'doubleKick', readonly string[]> = {
  protect: [
    '......dddddd......',
    '....ddllllllddd...',
    '...dlllllllllld...',
    '..dllddddddddlld..',
    '..dld........dld..',
    '.dld..dddddd..dld.',
    '.dld.dllllllddld..',
    '.dld.dlllllld.dld.',
    '.dld.dlllllld.dld.',
    '.dld.dlllllld.dld.',
    '.dld.dlllllld.dld.',
    '.dlddllllllddld...',
    '..dld.dddddd.dld..',
    '..dld........dld..',
    '...dlddddddddld...',
    '....ddllllllld....',
    '......dddddd......',
    '..................',
  ],
  trickRoom: [
    'dddddddddddddddddd',
    'dlldlldlldlldllldd',
    'dllddlldlldlldllld',
    'dddlddllldd..ddddd',
    'dlld.dd....dd.dlld',
    'dlld.d......d.dlld',
    'dddd.d......d.dddd',
    'dlld.dddd...d.dlld',
    'dlld..ddd...d.dlld',
    'dddd...dd...d.dddd',
    'dlld...d....d.dlld',
    'dlld........d.dlld',
    'dddd.d......d.dddd',
    'dlld.dd....dd.dlld',
    'dllddddddddd..dlld',
    'dddddddddddddddddd',
    'dlldlldlldlldllldd',
    'dddddddddddddddddd',
  ],
  doubleKick: [
    '..................',
    '......dddd........',
    '.....dllld........',
    '.....dllld........',
    '.....dllld........',
    '.....dllld........',
    '.....dlllld.......',
    '.....dllllddddd...',
    '....dlllllllllld..',
    '....dllllllllllld.',
    '....dlllllllllllld',
    '....ddddddddddddd.',
    '..................',
    '..d..........d....',
    '.ddd...ddd..ddd...',
    '..d...d...d..d....',
    '.........d........',
    '........ddd.......',
  ],
}

/** The Unown letters' forms (`FORMS[201]` in `scripts/dex.mjs`): A is the species' own sheets. */
const UNOWN_DEX = 201
const formOfLetter = (face: string): FormKey | undefined => (face === 'A' ? undefined : (face.toLowerCase() as FormKey))
const DITTO = 132
const MEW = 151

/** The art a card's window shows, once its sheets are in: the Unown of its letter, Ditto or Mew. */
const artOf = (c: UnownCard): SpeciesSprites | undefined => {
  if (c.face === 'ditto') return loadedSprites(DITTO)
  if (c.face === 'mew') return loadedSprites(MEW)
  if (c.face === 'protect' || c.face === 'trickRoom' || c.face === 'doubleKick') return undefined
  const form = formOfLetter(c.face)
  return form ? loadedFormSprites(UNOWN_DEX, form) : loadedSprites(UNOWN_DEX)
}

/** Starts loading every sheet the cards draw. */
const loadArt = () => {
  void loadSpecies(UNOWN_DEX).catch(() => {})
  for (const l of ['b', 'c', 'f', 'j', 'k', 'n', 'o', 'u'] as const) void loadSpecies(UNOWN_DEX, false, l as FormKey).catch(() => {})
  void loadSpecies(DITTO).catch(() => {})
  void loadSpecies(MEW).catch(() => {})
}

/** A wild's frame: its four quarters in the four types' colors. */
const wildFill = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  const half = [Math.floor(w / 2), Math.floor(h / 2)] as const
  const order: readonly UnownType[] = ['fire', 'water', 'electric', 'grass']
  order.forEach((ty, i) => {
    g.fillStyle = TYPE_COLOR[ty].mid
    g.fillRect(x + (i % 2) * half[0], y + Math.floor(i / 2) * half[1], i % 2 ? w - half[0] : half[0], Math.floor(i / 2) ? h - half[1] : half[1])
  })
}

/**
 * A card's face, `CARD` size: its type's frame lit from the top left (a
 * wild's in four colors), a window with its Unown (or its move's picture,
 * or Ditto, or Mew), its letter or sign big in the top-left corner and again
 * in the bottom right, and its type's icon top right.
 */
const faces = canvasCache<number, PixelSprite>()
const faceOf = (id: number): PixelSprite => {
  const hit = faces.get(id)
  if (hit) return hit
  const c = cardOf(id)
  const canvas = createCanvas(CARD.w, CARD.h)
  const g = context2d(canvas)
  const col = c.type ? TYPE_COLOR[c.type] : null
  box(g, 0, 0, CARD.w, CARD.h, INK)
  if (col) box(g, 1, 1, CARD.w - 2, CARD.h - 2, col.mid)
  else wildFill(g, 1, 1, CARD.w - 2, CARD.h - 2)
  g.fillStyle = col?.light ?? '#ffffff88'
  g.fillRect(2, 1, CARD.w - 4, 1)
  g.fillRect(1, 2, 1, CARD.h - 4)
  g.fillStyle = col?.dark ?? '#00000044'
  g.fillRect(2, CARD.h - 2, CARD.w - 4, 1)
  g.fillRect(CARD.w - 2, 2, 1, CARD.h - 4)
  // The window.
  const win = { x: 4, y: 11, w: CARD.w - 8, h: CARD.h - 22 }
  box(g, win.x - 1, win.y - 1, win.w + 2, win.h + 2, col?.dark ?? INK)
  box(g, win.x, win.y, win.w, win.h, col?.pale ?? '#283050')
  g.fillStyle = col ? '#ffffff' : '#3a4470'
  g.fillRect(win.x + 1, win.y, win.w - 2, 1)
  const art = artOf(c)
  let ready = true
  if (c.face === 'protect' || c.face === 'trickRoom' || c.face === 'doubleKick') {
    const pic = fromStrings(MOVE_ART[c.face], { d: col!.dark, l: col!.light })
    centered(g, pic, win.x + win.w / 2, win.y + win.h / 2)
  } else if (art) {
    g.save()
    g.beginPath()
    g.rect(win.x, win.y, win.w, win.h)
    g.clip()
    drawPokemon(g, art, 'Idle', 0, 0, Math.round(win.x + win.w / 2), win.y + win.h - 2)
    g.restore()
  } else ready = false
  // The corners.
  const m = mark(cornerOf(c), '#ffffff')
  g.drawImage(m, 1, 1)
  g.drawImage(m, CARD.w - m.width - 1, CARD.h - 11)
  if (c.type) g.drawImage(icons()[c.type], CARD.w - 11, 1)
  if (ready) faces.set(id, canvas)
  return canvas
}

/** The back: deep violet, an Unown's eye in the middle and a ring of dots. */
const back = lazy(() => {
  const canvas = createCanvas(CARD.w, CARD.h)
  const g = context2d(canvas)
  box(g, 0, 0, CARD.w, CARD.h, INK)
  box(g, 1, 1, CARD.w - 2, CARD.h - 2, '#3a2a6c')
  box(g, 3, 3, CARD.w - 6, CARD.h - 6, '#5a46a0')
  box(g, 4, 4, CARD.w - 8, CARD.h - 8, '#3a2a6c')
  g.fillStyle = '#6c58b8'
  for (let y = 6; y < CARD.h - 6; y += 4) for (let x = 6 + ((y / 4) % 2) * 2; x < CARD.w - 6; x += 4) g.fillRect(x, y, 1, 1)
  const cx = CARD.w / 2
  const cy = CARD.h / 2
  for (let y = -8; y <= 8; y++)
    for (let x = -8; x <= 8; x++) {
      const d = Math.hypot(x, y)
      if (d > 8.4) continue
      g.fillStyle = d > 7.2 ? INK : d > 4.6 ? '#f4f0ff' : d > 2.4 ? '#9890b8' : INK
      g.fillRect(cx + x - 0.5, cy + y, 1, 1)
    }
  g.fillStyle = '#ffffff'
  g.fillRect(cx - 4, cy - 4, 2, 1)
  return canvas
})

/** A small back for a rival's count, 9 × 12. */
const miniBack = lazy(() => {
  const canvas = createCanvas(9, 12)
  const g = context2d(canvas)
  box(g, 0, 0, 9, 12, INK)
  box(g, 1, 1, 7, 10, '#5a46a0')
  g.fillStyle = '#3a2a6c'
  g.fillRect(2, 2, 5, 8)
  g.fillStyle = '#f4f0ff'
  g.fillRect(3, 5, 3, 2)
  return canvas
})

/* ---------------- Layout ---------------- */

type Layout = {
  wide: boolean
  panels: Rect[]
  status: Rect
  felt: Rect
  /** The pile's top card's scale (2 when the felt has the room). */
  k: number
  deck: Rect
  pile: Rect
  badge: Rect
  /** UNOWN! and Comprar/Passar. */
  call: Rect
  act: Rect
  hand: Rect
  /** The hand's cards' scale (2 on a desktop's tall canvas). */
  hk: number
  /** Cards a row holds side by side, the rows, and how far apart the rows are (under a card's height, they overlap). */
  perRow: number
  rows: number
  rowStep: number
}

/** Where everything goes on a canvas `w` × `h` with `n` cards in hand. */
const layoutOf = (w: number, h: number, n: number): Layout => {
  const wide = w > h * 1.2
  const panelH = wide && h < 200 ? 36 : 44
  const pw = Math.floor((w - 8 - 2 * 10) / 3)
  const panels = [0, 1, 2].map((i) => ({ x: 4 + i * (pw + 10), y: 3, w: pw, h: panelH }))
  const perRow = Math.max(1, Math.floor((w - 8 + 2) / (CARD.w + 2)))
  if (wide) {
    // A tall canvas (a desktop) draws the hand and the pile's top twice their size.
    const hk = h >= 240 ? 2 : 1
    const hand = { x: 4, y: h - CARD.h * hk - 8, w: w - 8, h: CARD.h * hk + 6 }
    const felt = { x: 4, y: panelH + 5, w: w - 8, h: hand.y - panelH - 7 }
    const k = felt.h >= CARD.h * 2 + 8 ? 2 : 1
    const cy = felt.y + Math.floor((felt.h - CARD.h * k) / 2)
    const mid = Math.floor(w / 2)
    const btnW = Math.min(96, Math.floor((felt.w - 3 * CARD.w - 60) / 2))
    const deckX = mid - CARD.w - 14
    return {
      wide,
      panels,
      status: { x: felt.x + 6, y: felt.y + 2, w: deckX - 10 - felt.x, h: felt.h - 20 },
      felt,
      k,
      hk,
      deck: { x: deckX, y: cy + (k - 1) * CARD.h, w: CARD.w, h: CARD.h },
      pile: { x: mid + 2, y: cy, w: CARD.w * k, h: CARD.h * k },
      badge: { x: mid + 2 + CARD.w * k + 10, y: cy + Math.floor((CARD.h * k) / 2) - 11, w: 22, h: 22 },
      call: { x: felt.x + felt.w - btnW - 6, y: felt.y + Math.floor(felt.h / 2) - 24, w: btnW, h: 22 },
      act: { x: felt.x + felt.w - btnW - 6, y: felt.y + Math.floor(felt.h / 2) + 2, w: btnW, h: 22 },
      hand,
      perRow: Math.max(n, 1),
      rows: 1,
      rowStep: 0,
    }
  }
  // Upright: as many rows as the cards need (four at most, so a big hand stays a finger wide), apart when the screen has the room.
  const statusH = 24
  const minFelt = CARD.h + 16
  const rows = Math.min(4, Math.max(1, Math.ceil(n / perRow)))
  const room = h - (panelH + 6 + statusH + minFelt + 30 + 4)
  const rowStep = rows === 1 ? 0 : Math.max(24, Math.min(CARD.h + 3, Math.floor((room - CARD.h - 6) / (rows - 1))))
  const handH = CARD.h + (rows - 1) * rowStep + 6
  const hand = { x: 4, y: h - handH - 2, w: w - 8, h: handH }
  const btnY = hand.y - 28
  const feltY = panelH + 4 + statusH
  const felt = { x: 4, y: feltY, w: w - 8, h: btnY - feltY - 4 }
  const k = felt.h >= CARD.h * 2 + 12 && felt.w >= CARD.w * 4 + 40 ? 2 : 1
  const cy = felt.y + Math.floor((felt.h - CARD.h * k) / 2)
  const mid = Math.floor(w / 2)
  const half = Math.floor((w - 8 - 8) / 2)
  return {
    wide,
    panels,
    status: { x: 4, y: panelH + 4, w: w - 8, h: statusH },
    felt,
    k,
    hk: 1,
    deck: { x: mid - CARD.w * k - 14, y: cy + (k - 1) * CARD.h, w: CARD.w, h: CARD.h },
    pile: { x: mid - 4, y: cy, w: CARD.w * k, h: CARD.h * k },
    // Over the deck, or beside the pile when the felt is too short for that (a big hand).
    badge: cy + (k - 1) * CARD.h - 28 >= felt.y + 4 ? { x: mid - CARD.w * k - 14 + 6, y: cy + (k - 1) * CARD.h - 28, w: 22, h: 22 } : { x: mid - 4 + CARD.w * k + 8, y: cy + Math.floor((CARD.h * k) / 2) - 11, w: 22, h: 22 },
    call: { x: 4, y: btnY, w: half, h: 24 },
    act: { x: 4 + half + 8, y: btnY, w: half, h: 24 },
    hand,
    perRow,
    rows,
    rowStep,
  }
}

/** Each card's place in the hand: rows filled in turn, each spread (or overlapping when it holds more than fit). */
const handPlaces = (lay: Layout, n: number): { x: number; y: number }[] => {
  const per = Math.max(1, Math.ceil(n / lay.rows))
  const out: { x: number; y: number }[] = []
  for (let row = 0; row < lay.rows; row++) {
    const count = Math.min(per, n - row * per)
    if (count <= 0) break
    const cw = CARD.w * lay.hk
    const step = count <= 1 ? 0 : Math.min(cw + 2, (lay.hand.w - cw) / (count - 1))
    const width = step * (count - 1) + cw
    const x0 = lay.hand.x + Math.floor((lay.hand.w - width) / 2)
    for (let i = 0; i < count; i++) out.push({ x: Math.round(x0 + i * step), y: lay.hand.y + 4 + row * lay.rowStep })
  }
  return out
}

/* ---------------- The screen ---------------- */

/** A card in the air: from where to where, which (null: a back), and its clock. */
type Flight = { id: number | null; from: { x: number; y: number }; to: { x: number; y: number }; t0: number; dur: number; k: number }

const parse = (tb: TableView | null): UnownView | null => (tb && tb.view !== null ? unownRules.parseView(tb.view) : null)

/** The table before a match (gathering, or the first view on its way): no hands, no pile, the deck whole. */
const BEFORE: UnownView = { you: null, hand: [], counts: [0, 0, 0, 0], pile: [], type: 'fire', turn: 0, dir: 1, deck: 104, drawn: null, winner: null, moves: 0, events: [] }

/** The match's end for `seat`: won with a Mew as the last card down is `mewFinish`. */
const featsOf = (tb: TableView, seat: number): readonly string[] => {
  const v = parse(tb)
  const last = v?.events.filter((e) => e.k === 'play').at(-1)
  return v && v.winner === seat && last?.k === 'play' && last.seat === seat && cardOf(last.card).face === 'mew' ? ['mewFinish'] : []
}

/** Cards in hand sorted for reading: by type (wilds last), then letter, then move (the deck's own order). */
const sortHand = (hand: readonly number[]) => [...hand].sort((a, b) => a - b)

const start = (ctx: TableCtx): TableRun => {
  const { source } = ctx
  const words = () => t().minigames.cafe.unown
  loadArt()
  let W = 0
  let H = 0
  let clock = 0
  let lay: Layout = layoutOf(300, 300, 7)
  let queue: UnownEvent[] = []
  let current: { e: UnownEvent; t: number; done: boolean } | null = null
  let lastN = -1
  let lastMoves = -1
  /** The pile's top as shown (it trails the table while a card flies), and the type in play. */
  let top: number | null = null
  let shownType: UnownType = 'fire'
  let flights: Flight[] = []
  /** Cards that came to the hand, and when they may show (they slide in). */
  const arrived = new Map<number, number>()
  let known = new Set<number>()
  let held: number | null = null
  let sentFor = -1
  let armed = false
  let picker: number | null = null
  let note: { text: string; at: number; hot: boolean } | null = null
  let bits: Bit[] = []
  let shake = 0
  let wonAt: number | null = null
  let help = false
  let ticked = -1
  /** Seats whose UNOWN! bubble shows, until when (s). */
  const bubbles = new Map<number, number>()
  const loaded = new Set<string>()

  const mySeat = () => source.seat()
  const bottom = () => mySeat() ?? 0
  /** A seat's panel index along the top (0: the next seat clockwise), or -1 for the bottom seat. */
  const panelOf = (seat: number) => (seat === bottom() ? -1 : (seat - bottom() + UNOWN.seats) % UNOWN.seats - 1)
  const seatedList = (tb: TableView | null): (Seated | null)[] => Array.from({ length: UNOWN.seats }, (_, s) => seatedAt(ctx, tb, s, words().you))

  /** Where a seat's cards come from and go to: its panel's middle, or our hand. */
  const seatSpot = (seat: number) => {
    const i = panelOf(seat)
    if (i < 0) return { x: lay.hand.x + lay.hand.w / 2 - (CARD.w * lay.hk) / 2, y: lay.hand.y + 4 }
    const p = lay.panels[i]!
    return { x: p.x + p.w / 2 - CARD.w / 2, y: p.y + 6 }
  }

  /* ----- Reading the table ----- */

  const read = (tb: TableView | null) => {
    const v = parse(tb)
    if (!v) return
    if (v.moves < lastMoves || lastMoves < 0) {
      queue = []
      current = null
      flights = []
      lastN = v.events.reduce((n, e) => Math.max(n, e.n), -1)
      top = v.pile.at(-1) ?? null
      shownType = v.type
      known = new Set(v.hand)
      arrived.clear()
      wonAt = null
      armed = false
      picker = null
      held = null
      sentFor = -1
      bubbles.clear()
      if (v.moves === 0 && tb?.phase === 'playing') {
        playSfx('select')
        v.hand.forEach((id, i) => arrived.set(id, clock + 0.2 + i * 0.07))
      }
    }
    lastMoves = v.moves
    for (const e of v.events)
      if (e.n > lastN) {
        queue.push(e)
        lastN = e.n
      }
  }

  const say = (text: string, hot = false) => (note = { text, at: clock, hot })

  /** Plays the next event on. */
  const advance = (dt: number, v: UnownView, seated: readonly (Seated | null)[]) => {
    if (!current && queue.length > 0) current = { e: queue.shift()!, t: 0, done: false }
    if (!current) return
    const speed = 1 + queue.length * 0.7
    current.t += dt * speed
    const c = current
    const e = c.e
    const name = (seat: number) => seated[seat]?.name ?? '?'
    const mine = (seat: number) => seat === mySeat()
    if (!c.done) {
      c.done = true
      if (e.k === 'play') {
        const from = mine(e.seat) ? (handSpot(e.card) ?? seatSpot(e.seat)) : seatSpot(e.seat)
        flights.push({ id: e.card, from, to: { x: lay.pile.x, y: lay.pile.y }, t0: clock, dur: BEAT.play / speed, k: lay.k })
        playSfx('whoosh')
        if (e.called) {
          bubbles.set(e.seat, clock + 2.2)
          say(words().called(name(e.seat)), true)
          playSfx('shing')
        }
      } else if (e.k === 'draw') {
        const to = seatSpot(e.seat)
        for (let i = 0; i < e.count; i++) flights.push({ id: null, from: { x: lay.deck.x, y: lay.deck.y }, to, t0: clock + (i * BEAT.draw) / speed, dur: 0.2 / speed, k: 1 })
        if (mine(e.seat)) e.cards.forEach((id, i) => arrived.set(id, clock + (0.2 + i * BEAT.draw) / speed))
        if (e.why === 'caught') {
          say(mine(e.seat) ? words().caughtYou : words().caught(name(e.seat)), true)
          playSfx('denied')
          shake = 0.2
        } else if (e.why === 'kick' || e.why === 'mew') {
          say(mine(e.seat) ? words().drewYou(e.count) : words().drew(name(e.seat), e.count), true)
          playSfx(e.why === 'mew' ? 'thunder' : 'kick')
          shake = 0.15
        } else playSfx('pickup')
      } else if (e.k === 'skip') {
        // After Double Kick or Mew the draw already said it: the skip only thuds.
        if (!note || clock - note.at > 0.4) say(mine(e.seat) ? words().skippedYou : words().skipped(name(e.seat)))
        playSfx('thud')
      } else if (e.k === 'reverse') {
        say(words().reversed)
        playSfx('zip')
      }
    }
    const dur =
      e.k === 'play' ? BEAT.play : e.k === 'draw' ? 0.2 + e.count * BEAT.draw : e.k === 'skip' ? BEAT.skip : e.k === 'reverse' ? BEAT.reverse : 0.05
    if (c.t >= dur) {
      if (e.k === 'play') {
        top = e.card
        shownType = e.as
        const card = cardOf(e.card)
        const col = card.type ? TYPE_COLOR[card.type] : TYPE_COLOR[e.as]
        burst(bits, lay.pile.x + (CARD.w * lay.k) / 2, lay.pile.y + (CARD.h * lay.k) / 2, isWild(card) ? 22 : 10, ['#ffffff', col.light, col.mid])
        playSfx(isWild(card) ? 'slotWin' : 'move')
      }
      current = null
    }
    void v
  }

  /* ----- The hand ----- */

  /** The hand as drawn: sorted, its newcomers once they've arrived. */
  const handNow = (v: UnownView) => sortHand(v.hand.filter((id) => (arrived.get(id) ?? 0) <= clock || !arrived.has(id)))
  /** Where a card of our hand is drawn now. */
  const handSpot = (id: number) => {
    const v = parse(source.table())
    if (!v) return null
    const hand = handNow(v)
    const i = hand.indexOf(id)
    return i < 0 ? null : (handPlaces(lay, hand.length)[i] ?? null)
  }

  const idle = () => current === null && queue.length === 0
  const myTurn = (tb: TableView | null, v: UnownView | null): v is UnownView => {
    const seat = mySeat()
    return !!tb && !!v && tb.phase === 'playing' && seat !== null && v.turn === seat && v.winner === null && sentFor !== v.moves && idle()
  }
  /** Whether `id` may go down now (the drawn card only, after a draw). */
  const canPlay = (v: UnownView, id: number) => (v.drawn === null || v.drawn === id) && playable({ pile: top === null ? v.pile : [top], type: shownType }, id)

  const send = (v: UnownView, move: unknown) => {
    sentFor = v.moves
    held = null
    source.play(move)
  }

  const playCard = (v: UnownView, id: number, as?: UnownType) => {
    if (isWild(cardOf(id)) && as === undefined) {
      picker = id
      playSfx('select')
      return
    }
    const call = armed && v.hand.length === 2
    armed = false
    picker = null
    send(v, { k: 'play', card: id, ...(as && { as }), ...(call && { call: true }) })
  }

  /** The card under (`x`, `y`) in the hand: the topmost drawn there. */
  const cardAt = (v: UnownView, x: number, y: number): number | null => {
    const hand = handNow(v)
    const places = handPlaces(lay, hand.length)
    for (let i = hand.length - 1; i >= 0; i--) {
      const p = places[i]!
      if (x >= p.x && x < p.x + CARD.w * lay.hk && y >= p.y - 6 && y < p.y + CARD.h * lay.hk) return hand[i]!
    }
    return null
  }

  /** The type picker's four buttons, over the felt. */
  const pickerRects = (): Rect[] => {
    const bw = Math.min(100, Math.floor((W - 18) / 2))
    const bh = 26
    const x0 = Math.floor(W / 2 - bw - 3)
    const y0 = Math.floor(lay.felt.y + lay.felt.h / 2 - bh - 3)
    return UNOWN_TYPES.map((_, i) => ({ x: x0 + (i % 2) * (bw + 6), y: y0 + Math.floor(i / 2) * (bh + 6), w: bw, h: bh }))
  }

  const step = (dt: number, input: GameInput) => {
    clock += dt
    const tb = source.table()
    read(tb)
    const v = parse(tb)
    const seated = seatedList(tb)
    loadSeated(seated, loaded)
    shake = Math.max(0, shake - dt)
    bits = stepBits(bits, dt)
    flights = flights.filter((f) => clock - f.t0 < f.dur)
    if (!v) return
    for (const id of v.hand) if (!known.has(id)) (known.add(id), arrived.has(id) || arrived.set(id, clock + 0.15))
    advance(dt, v, seated)
    if (idle()) {
      top = v.pile.at(-1) ?? top
      shownType = v.type
    }
    // Someone at one card who called: the bubble stays while they hold it.
    v.counts.forEach((n, seat) => {
      if (n !== 1) bubbles.delete(seat)
    })

    if (v.winner !== null && idle() && wonAt === null && flights.length === 0) {
      wonAt = clock
      for (let i = 0; i < 3; i++) burst(bits, lay.pile.x + CARD.w, lay.pile.y + CARD.h / 2, 18, ['#f8e070', '#ffffff', '#f89060', '#78a4f0', '#9ce07c'], 170)
      const seat = mySeat()
      playSfx(seat === v.winner ? 'levelUp' : seat === null ? 'coin' : 'denied')
      say(seated[v.winner]?.you ? words().youWin : words().wins(seated[v.winner]?.name ?? '?'), true)
    }

    const seat = mySeat()
    if (seat !== null && v.turn === seat && tb?.phase === 'playing' && tb.leftMs !== null) {
      const left = Math.ceil(tb.leftMs / 1000)
      if (left <= 4 && left !== ticked) (ticked = left), playSfx('tick')
    } else ticked = -1

    const p = input.pointer
    // The rules sheet: any press closes it.
    if (help) {
      if (p.pressed) help = false
      return
    }
    if (p.pressed && inside(helpRect(), p.x, p.y)) {
      help = true
      playSfx('select')
      return
    }
    // A wild's type.
    if (picker !== null) {
      if (p.pressed) {
        const i = pickerRects().findIndex((r) => inside(r, p.x, p.y))
        if (i >= 0 && myTurn(tb, v)) playCard(v, picker, UNOWN_TYPES[i])
        else picker = null
      }
      const keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4'] as const
      keys.forEach((k, i) => {
        if (input.pressed(k) && picker !== null && myTurn(tb, v)) playCard(v, picker, UNOWN_TYPES[i])
      })
      if (input.pressed('Escape')) picker = null
      return
    }
    // UNOWN!: armed before the second-last card goes down.
    const callable = seat !== null && v.hand.length === 2 && v.winner === null && tb?.phase === 'playing'
    if (!callable) armed = false
    if (callable && ((p.pressed && inside(lay.call, p.x, p.y)) || input.pressed('KeyU'))) {
      if (!armed) (armed = true), playSfx('shing')
      return
    }
    if (!myTurn(tb, v)) {
      held = null
      return
    }
    // Draw (the pile or Comprar), or pass after a draw.
    const drawRect = lay.act
    if (v.drawn === null && ((p.pressed && (inside(lay.deck, p.x, p.y) || inside(drawRect, p.x, p.y))) || input.pressed('KeyD'))) return send(v, { k: 'draw' })
    if (v.drawn !== null && ((p.pressed && inside(drawRect, p.x, p.y)) || input.pressed('KeyP'))) return send(v, { k: 'pass' })
    // The hand: press to lift, slide to change, lift the finger to play.
    if (p.pressed) held = cardAt(v, p.x, p.y)
    else if (p.down && held !== null) held = cardAt(v, p.x, p.y) ?? (p.y < lay.hand.y ? held : null)
    if (p.released && held !== null) {
      const id = held
      held = null
      if (canPlay(v, id)) playCard(v, id)
      else {
        playSfx('denied')
        say(words().match)
      }
    }
    // Keys: ←/→ choose, Enter plays.
    const hand = handNow(v).filter((id) => canPlay(v, id))
    if (hand.length > 0 && (input.pressed('ArrowLeft') || input.pressed('ArrowRight'))) {
      const i = held === null ? -1 : hand.indexOf(held)
      held = hand[(i + (input.pressed('ArrowLeft') ? hand.length - 1 : 1) + hand.length) % hand.length]!
    }
    if ((input.pressed('Enter') || input.pressed('Space')) && held !== null && canPlay(v, held)) playCard(v, held)
  }

  /* ----- Drawing ----- */

  /** Whether the felt is too short for the "how to play" tab beside the deck (a big hand): it shrinks to "?" top right. */
  const helpShort = () => !lay.wide && lay.deck.y - lay.felt.y < 18
  const helpRect = (): Rect => {
    const s = label(words().howTo)
    if (helpShort()) return { x: lay.felt.x + lay.felt.w - 20, y: lay.felt.y + 2, w: 18, h: 15 }
    return lay.wide ? { x: lay.felt.x + 4, y: lay.felt.y + lay.felt.h - 18, w: s.width + 8, h: 15 } : { x: lay.felt.x + 2, y: lay.felt.y + 2, w: s.width + 8, h: 15 }
  }

  /** A card drawn at (`x`, `y`) `k` times its size: face or back, dimmed when it can't go down now. */
  const card = (g: CanvasRenderingContext2D, id: number | null, x: number, y: number, k = 1, dim = false) => {
    const art = id === null ? back() : faceOf(id)
    g.drawImage(art, Math.round(x), Math.round(y), CARD.w * k, CARD.h * k)
    if (dim) {
      g.globalAlpha = 0.38
      box(g, Math.round(x), Math.round(y), CARD.w * k, CARD.h * k, '#101018')
      g.globalAlpha = 1
    }
  }

  const drawPanel = (g: CanvasRenderingContext2D, tb: TableView | null, v: UnownView, seated: readonly (Seated | null)[], seat: number, r: Rect, time: number) => {
    const who = seated[seat]
    const on = tb?.phase === 'playing' && v.turn === seat && v.winner === null
    box(g, r.x, r.y, r.w, r.h, INK)
    // A seat nobody holds while the table gathers: an empty chair.
    if (!who) {
      box(g, r.x + 1, r.y + 1, r.w - 2, r.h - 2, '#1e2234')
      centered(g, label('...', '#5a6080'), r.x + r.w / 2, r.y + r.h / 2)
      return
    }
    box(g, r.x + 1, r.y + 1, r.w - 2, r.h - 2, on ? '#3c4870' : '#2a3048')
    if (on) {
      g.globalAlpha = 0.5 + 0.5 * Math.sin(time * 6)
      g.strokeStyle = '#fff8c0'
      g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1)
      g.globalAlpha = 1
    }
    const name = label(clip(who?.name ?? '...', Math.max(3, Math.floor((r.w - 6) / 8))), who?.bot ? '#a8b0c8' : '#f8f8f8')
    g.drawImage(name, r.x + 2, r.y + 1)
    if (who) {
      g.save()
      g.beginPath()
      g.rect(r.x + 1, r.y + 13, Math.min(30, r.w / 2), r.h - 14)
      g.clip()
      const won = wonAt !== null && v.winner === seat
      const hop = won ? Math.round(Math.abs(Math.sin((time - (wonAt ?? 0)) * 9)) * 3) : 0
      drawPokemon(g, sprites(who.dex, who.shiny), 'Idle', 0, time + seat * 0.41, r.x + 1 + Math.min(15, r.w / 4), r.y + r.h - 2 - hop)
      g.restore()
    }
    // Before the deal, no counts.
    if (v === BEFORE) return
    const n = v.counts[seat] ?? 0
    const count = label(`${n}`, n === 1 ? '#f8e070' : '#f8f8f8')
    const cx = r.x + r.w - count.width - 18
    for (let i = Math.min(3, n) - 1; i >= 0; i--) g.drawImage(miniBack(), cx + i * 3, r.y + 18 - i)
    g.drawImage(count, r.x + r.w - count.width - 2, r.y + 18)
    // UNOWN! said with one card left.
    if (n === 1 && (bubbles.get(seat) ?? 0) > clock - 99) {
      const s = label(words().call, INK, '#f8e070')
      box(g, r.x + r.w / 2 - s.width / 2 - 2, r.y + r.h - 7, s.width + 4, 12, '#f8e070')
      centered(g, s, r.x + r.w / 2, r.y + r.h - 1)
    }
    if (on && tb?.leftMs !== null && tb?.leftMs !== undefined) {
      const share = Math.max(0, Math.min(1, tb.leftMs / (unownRules.open?.turnMs ?? 20_000)))
      g.fillStyle = share > 0.5 ? '#58c058' : share > 0.25 ? '#f8c830' : Math.floor(time * 6) % 2 ? '#f85838' : '#f8a088'
      g.fillRect(r.x + 2, r.y + r.h - 3, Math.round((r.w - 4) * share), 1)
    }
  }

  /** The arrows between the rivals' panels: the way play goes. */
  const drawArrows = (g: CanvasRenderingContext2D, v: UnownView) => {
    const s = label(v.dir === 1 ? '>' : '<', '#f8e070')
    for (let i = 0; i < 2; i++) {
      const a = lay.panels[i]!
      centered(g, s, a.x + a.w + 5, a.y + a.h / 2)
    }
  }

  const statusOf = (tb: TableView | null, v: UnownView, seated: readonly (Seated | null)[]) => {
    const w = words()
    if (v.winner !== null && wonAt !== null) return { text: seated[v.winner]?.you ? w.youWin : w.wins(seated[v.winner]?.name ?? '?'), hot: true }
    if (note && clock - note.at < BEAT.note) return { text: note.text, hot: note.hot }
    if (!tb || tb.phase !== 'playing' || v.winner !== null) return { text: '', hot: false }
    const seat = mySeat()
    if (seat !== null && v.turn === seat) {
      if (v.drawn !== null) return { text: w.drewPlayable, hot: true }
      if (v.hand.length === 2 && !armed) return { text: w.callHint, hot: true }
      return { text: `${w.yourTurn} · ${w.match}`, hot: true }
    }
    return { text: w.theirTurn(seated[v.turn]?.name ?? '?'), hot: false }
  }

  const draw = (g: CanvasRenderingContext2D, time: number) => {
    const tb = source.table()
    const live = parse(tb)
    const v = live ?? BEFORE
    const n = handNow(v).length
    W = g.canvas.width
    H = g.canvas.height
    lay = layoutOf(W, H, n)
    const seated = seatedList(tb)
    tableTop(g, W, H)
    const sx = shake > 0 ? (Math.floor(time * 40) % 2 === 0 ? 1 : -1) : 0
    // The rivals.
    for (let seat = 0; seat < UNOWN.seats; seat++) {
      const i = panelOf(seat)
      if (i >= 0) drawPanel(g, tb, v, seated, seat, lay.panels[i]!, time)
    }
    drawArrows(g, v)
    // The felt.
    const f = lay.felt
    box(g, f.x, f.y, f.w, f.h, INK)
    box(g, f.x + 1, f.y + 1, f.w - 2, f.h - 2, '#7a4a28')
    box(g, f.x + 3, f.y + 3, f.w - 6, f.h - 6, '#24603c')
    g.fillStyle = '#205434'
    for (let y = f.y + 6; y < f.y + f.h - 4; y += 3) for (let x = f.x + 5 + (y % 2); x < f.x + f.w - 4; x += 5) g.fillRect(x, y, 1, 1)
    // The game's name in Unown, printed on the felt under the pile when there's room.
    const word = glyphWord()
    const pileBottom = Math.max(lay.pile.y + lay.pile.h, lay.deck.y + lay.deck.h)
    const wk = f.w >= word.width * 2 + 24 && f.y + f.h - pileBottom >= word.height * 2 + 14 ? 2 : 1
    if (f.y + f.h - pileBottom >= word.height * wk + 10) g.drawImage(word, Math.round(f.x + f.w / 2 - (word.width * wk) / 2), f.y + f.h - 6 - word.height * wk, word.width * wk, word.height * wk)
    g.save()
    g.translate(sx, 0)
    // The draw pile: a few backs stacked, its count, pulsing when drawing is the move.
    const mine = myTurn(tb, v)
    const noPlay = mine && v.drawn === null && !v.hand.some((id) => canPlay(v, id))
    const d = lay.deck
    for (let i = Math.min(3, Math.ceil(v.deck / 20)); i > 0; i--) card(g, null, d.x - i, d.y - i)
    card(g, null, d.x, d.y)
    if (noPlay) {
      g.globalAlpha = 0.4 + 0.4 * Math.sin(time * 6)
      g.strokeStyle = '#fff8c0'
      g.strokeRect(d.x - 1.5, d.y - 1.5, CARD.w + 3, CARD.h + 3)
      g.globalAlpha = 1
    }
    const left = label(`${v.deck}`, '#f8f8f8')
    box(g, Math.round(d.x + CARD.w / 2 - left.width / 2 - 1), d.y + CARD.h - 12, left.width + 2, 12, '#24183e')
    centered(g, left, d.x + CARD.w / 2, d.y + CARD.h - 6)
    // The pile: the two below peek out, the top one big.
    const pile = top === null ? v.pile : [...v.pile.filter((id) => id !== top), top]
    const under = pile.slice(-3, -1)
    under.forEach((id, i) => card(g, id, lay.pile.x - (under.length - i) * 2, lay.pile.y + (under.length - i), lay.k))
    if (top !== null) card(g, top, lay.pile.x, lay.pile.y, lay.k)
    // The type in play: a ring in its color round its icon (once a card is up).
    const b = lay.badge
    if (top !== null) {
      const col = TYPE_COLOR[shownType]
      for (let y = 0; y < 22; y++)
        for (let x = 0; x < 22; x++) {
          const r = Math.hypot(x - 10.5, y - 10.5)
          if (r > 11) continue
          g.fillStyle = r > 10 ? INK : r > 8 ? col.mid : r > 7 ? col.dark : '#fbf6ea'
          g.fillRect(b.x + x, b.y + y, 1, 1)
        }
      centered(g, icons()[shownType], b.x + 11, b.y + 11)
    }
    g.restore()

    // What's going on.
    const st = statusOf(tb, v, seated)
    if (st.text) {
      const sr = lay.status
      const ls = wrap(st.text, sr.w - 4).slice(0, lay.wide ? 3 : 2)
      ls.forEach((l, i) => {
        const s = label(l, st.hot ? '#f8e070' : '#f8f8f8')
        if (lay.wide) g.drawImage(s, sr.x, sr.y + 2 + i * 11)
        else centered(g, s, sr.x + sr.w / 2, sr.y + sr.h / 2 + (i - (ls.length - 1) / 2) * 11)
      })
    }

    // The buttons.
    const w = words()
    const seat = mySeat()
    if (seat !== null && live) {
      const callable = v.hand.length === 2 && v.winner === null && tb?.phase === 'playing'
      if (callable)
        button(g, lay.call, label(w.call, armed ? INK : '#ffffff', armed ? '#f8e070' : INK), armed ? { fill: '#f8e070', light: '#fff8c0', dark: '#a88010', down: true } : { fill: '#9050c8', light: '#c090f0', dark: '#502878', glow: mine ? 0.5 + 0.4 * Math.sin(time * 7) : 0 })
      const act = v.drawn !== null ? w.pass : w.draw
      const live = mine
      button(g, lay.act, label(act, live ? '#ffffff' : '#9098b0'), live ? { fill: '#2a5cc8', light: '#78a4f0', dark: '#122c78', glow: noPlay || v.drawn !== null ? 0.4 + 0.4 * Math.sin(time * 5) : 0 } : { fill: '#40465e', light: '#545a74', dark: '#2a2e40' })
    }

    // The hand (our own), or the bottom seat's backs for a spectator.
    if (seat === null) {
      const r = { x: Math.floor(W / 2 - 50), y: lay.hand.y + 2, w: 100, h: 44 }
      drawPanel(g, tb, v, seated, 0, r, time)
    } else {
      const hand = handNow(v)
      const places = handPlaces(lay, hand.length)
      const flyingIds = new Set(flights.map((fl) => fl.id))
      if (mine) {
        g.fillStyle = '#f8e07022'
        g.fillRect(lay.hand.x, lay.hand.y, lay.hand.w, lay.hand.h)
      }
      hand.forEach((id, i) => {
        if (flyingIds.has(id)) return
        const pl = places[i]!
        const ok = mine && canPlay(v, id)
        const lift = held === id ? 7 : ok ? 2 : 0
        const due = arrived.get(id) ?? 0
        const slide = clock < due + 0.2 ? Math.max(0, Math.round((1 - (clock - due) / 0.2) * 30)) : 0
        if (clock < due) return
        card(g, id, pl.x, pl.y - lift * lay.hk + slide, lay.hk, mine && !ok)
        // A card that can go down: a gold rim round the part of it that shows (the next card in its row may cover the rest).
        if (ok && v.drawn !== id) {
          const next = places[i + 1]
          const shows = next && next.y === pl.y && held !== id ? Math.min(CARD.w * lay.hk, next.x - pl.x) : CARD.w * lay.hk
          g.strokeStyle = held === id ? '#fff8c0' : '#f8d030'
          g.strokeRect(pl.x - 0.5, pl.y - lift * lay.hk + slide - 0.5, shows + 1, CARD.h * lay.hk + 1)
        }
        if (v.drawn === id) {
          g.strokeStyle = '#f8e070'
          g.strokeRect(pl.x - 0.5, pl.y - lift * lay.hk - 0.5, CARD.w * lay.hk + 1, CARD.h * lay.hk + 1)
        }
      })
      const me = tb?.leftMs
      if (mine && me !== null && me !== undefined) {
        const share = Math.max(0, Math.min(1, me / (unownRules.open?.turnMs ?? 20_000)))
        g.fillStyle = share > 0.5 ? '#58c058' : share > 0.25 ? '#f8c830' : Math.floor(time * 6) % 2 ? '#f85838' : '#f8a088'
        g.fillRect(lay.hand.x + 2, lay.hand.y + lay.hand.h - 1, Math.round((lay.hand.w - 4) * share), 1)
      }
    }

    // Cards in the air.
    for (const fl of flights) {
      const f2 = Math.max(0, Math.min(1, (clock - fl.t0) / fl.dur))
      if (clock < fl.t0) continue
      const e = 1 - (1 - f2) * (1 - f2)
      const k = f2 > 0.6 ? fl.k : 1
      card(g, fl.id, fl.from.x + (fl.to.x - fl.from.x) * e, fl.from.y + (fl.to.y - fl.from.y) * e - Math.sin(f2 * Math.PI) * 8, k)
    }
    drawBits(g, bits)

    // The wild's type picker.
    if (picker !== null) {
      g.fillStyle = '#10101888'
      g.fillRect(0, 0, W, H)
      const s = label(w.pickType, '#f8e070')
      const rects = pickerRects()
      centered(g, s, W / 2, rects[0]!.y - 10)
      rects.forEach((r, i) => {
        const ty = UNOWN_TYPES[i]!
        const c = TYPE_COLOR[ty]
        button(g, { ...r, x: r.x + 6, w: r.w - 6 }, label(w.types[ty], ty === 'electric' ? INK : '#ffffff', ty === 'electric' ? '#fff8c0' : INK), { fill: c.mid, light: c.light, dark: c.dark })
        box(g, r.x, r.y + Math.floor(r.h / 2) - 7, 14, 14, INK)
        box(g, r.x + 1, r.y + Math.floor(r.h / 2) - 6, 12, 12, '#fbf6ea')
        g.drawImage(icons()[ty], r.x + 2, r.y + Math.floor(r.h / 2) - 5)
      })
    }

    // How to play.
    const hr = helpRect()
    box(g, hr.x, hr.y, hr.w, hr.h, help ? '#f8e070' : '#1c4c30')
    centered(g, label(helpShort() ? '?' : w.howTo, help ? INK : '#c8e8c0', help ? '#f8e070' : INK), hr.x + hr.w / 2, hr.y + hr.h / 2)
    if (help) {
      const lines = w.help.flatMap((l) => wrap(l, Math.min(W - 24, 280) - 10))
      const bw = Math.min(W - 16, 290)
      const bh = lines.length * 11 + 12
      const bx = Math.floor((W - bw) / 2)
      const by = Math.floor((H - bh) / 2)
      box(g, bx - 1, by - 1, bw + 2, bh + 2, INK)
      box(g, bx, by, bw, bh, '#343c5a')
      lines.forEach((l, i) => g.drawImage(label(l), bx + 5, by + 5 + i * 11))
    }
  }

  return { step, draw }
}

export const unown: TableUi = {
  size: { w: 330, h: 220 },
  fluid: fluidSize(150, 330),
  start,
  outro: 2.2,
  feats: featsOf,
}

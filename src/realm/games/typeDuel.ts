import type { Sfx } from '../../engine/audio'
import { playCry, playSfx } from '../../engine/audio'
import { canvasCache, context2d, createCanvas, fromStrings, lazy } from '../../engine/pixelart'
import { locale, t } from '../../i18n'
import type { TableView } from '../../net/realmTables'
import { cryUrl, portraitUrl } from '../../render/sprites'
import type { GameInput, TableUi } from './frame'
import { bankCounts, bankWins, DUEL, DUEL_TYPES, duelWinner, typeDuelRules, type DuelCard, type DuelReveal, type DuelType, type DuelView } from './typeDuel.rules'

/**
 * The type duel's screen (`MINIGAMES.typeDuel`), drawn from the table's view
 * (`typeDuel.rules.ts`): the rival's banks and face-down hand on top, the two
 * picks on the felt, your banks and your hand along the bottom. Tap a card
 * to lift it, tap it again (or Jogar, or drag it up) to play it; keys 1–5,
 * arrows and Enter on a desktop. Each reveal plays out locally (the flip,
 * the clash, the card flying to its bank) while the next round's view is
 * already in, so the screen trails the table by under two seconds.
 *
 * Sized so a phone shows it at twice its pixels held either way (184 × 160).
 */

const W = 184
const H = 160
const CARD = { w: 36, h: 48 } as const
const HAND_Y = 112
const LIFT = 7
const SLOT = { mine: { x: 44, y: 26 }, theirs: { x: 104, y: 26 } } as const
const FELT = { x: 2, y: 17, w: W - 4, h: 80 } as const

/** The reveal's beats (s): the flip, the clash, the result line, the card flying to its bank, the end. */
const BEAT = { flip: 0.2, flipEnd: 0.5, clash: 0.8, say: 1.05, fly: 1.55, end: 1.95 } as const
/** How long a played card takes from the hand to the felt (s). */
const FLIGHT = 0.18

const INK = '#181010'
const TYPE_COLOR: Record<DuelType, { dark: string; mid: string; light: string; glow: string }> = {
  fire: { dark: '#902818', mid: '#e05828', light: '#f8a050', glow: '#f8d870' },
  water: { dark: '#183c90', mid: '#3878e0', light: '#78b8f8', glow: '#c8ecff' },
  grass: { dark: '#1c6420', mid: '#40a838', light: '#8cd860', glow: '#e0f8a0' },
}
const TYPE_SFX: Record<DuelType, Sfx> = { fire: 'pledgeFire', water: 'pledgeWater', grass: 'pledgeGrass' }

/* ---------- Pixel art ---------- */

const ICON_ROWS: Record<DuelType, readonly string[]> = {
  fire: ['....o....', '...oro...', '...orro..', '..oryrro.', '.oryyyro.', '.orywyro.', 'oryywyyro', '.oryyyro.', '..ooooo..'],
  water: ['....o....', '...obo...', '...obo...', '..obbbo..', '.obbbbbo.', '.olbbbbo.', '.owlbbbo.', '..olbbo..', '...ooo...'],
  grass: ['.....ooo.', '...oolllo', '..ollgglo', '.olggdglo', '.olgdggo.', '.ogdggo..', '.odggo...', 'od.oo....', 'o........'],
}
const ICON_PALETTE = { o: INK, r: '#e05828', y: '#f8c040', w: '#fff8c0', b: '#3878e0', l: '#a8d8ff', g: '#58b840', d: '#2c7828' } as const

const icons = lazy(() => ({ fire: fromStrings(ICON_ROWS.fire, ICON_PALETTE), water: fromStrings(ICON_ROWS.water, ICON_PALETTE), grass: fromStrings(ICON_ROWS.grass, ICON_PALETTE) }))

/** Chunky 4×7 digits for the cards' power. */
const DIGITS: readonly (readonly string[])[] = [
  ['0110', '1001', '1001', '1001', '1001', '1001', '0110'],
  ['0010', '0110', '0010', '0010', '0010', '0010', '0111'],
  ['0110', '1001', '0001', '0010', '0100', '1000', '1111'],
  ['1110', '0001', '0001', '0110', '0001', '0001', '1110'],
  ['0010', '0110', '1010', '1010', '1111', '0010', '0010'],
  ['1111', '1000', '1110', '0001', '0001', '1001', '0110'],
  ['0110', '1000', '1000', '1110', '1001', '1001', '0110'],
  ['1111', '0001', '0010', '0010', '0100', '0100', '0100'],
  ['0110', '1001', '1001', '0110', '1001', '1001', '0110'],
  ['0110', '1001', '1001', '0111', '0001', '0001', '0110'],
]
/** A ">" in the same font, for "9 > 5" and "Fire > Grass". */
const GT = ['1000', '1100', '0110', '0011', '0110', '1100', '1000']

/** A number (or ">") in the big digits, outlined, 2 px wide strokes so it reads at a glance. */
const bigText = (text: string, color: string) => {
  const glyphs = [...text].map((c) => (c === '>' ? GT : DIGITS[Number(c)] ?? DIGITS[0]!))
  const w = glyphs.reduce((s, g) => s + g[0]!.length + 2, 0) + 2
  const canvas = createCanvas(w, 9)
  const g = context2d(canvas)
  const plot = (fill: string, dx: number, dy: number) => {
    g.fillStyle = fill
    let ox = 1
    for (const glyph of glyphs) {
      glyph.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) if (row[x] === '1') g.fillRect(ox + x + dx, 1 + y + dy, 2, 1)
      })
      ox += glyph[0]!.length + 2
    }
  }
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]] as const) plot(INK, dx, dy)
  plot(color, 0, 0)
  return canvas
}
const bigTexts = canvasCache<string, HTMLCanvasElement>()
const big = (text: string, color = '#fff') => {
  const key = `${color}|${text}`
  let c = bigTexts.get(key)
  if (!c) bigTexts.set(key, (c = bigText(text, color)))
  return c
}

/** Text in the UI's pixel font (Cubic 11 for Chinese), every pixel on or off, outlined. */
const labels = canvasCache<string, HTMLCanvasElement>()
const label = (text: string, color = '#fff', outline = INK) => {
  const zh = locale() === 'zh'
  const key = `${zh}|${color}|${outline}|${text}`
  const cached = labels.get(key)
  if (cached) return cached
  const size = zh ? 11 : 8
  const font = zh ? `${size}px "Cubic 11", "Press Start 2P", monospace` : `${size}px "Press Start 2P", "Cubic 11", monospace`
  const probe = context2d(createCanvas(1, 1))
  probe.font = font
  const w = Math.ceil(probe.measureText(text).width) + 2
  const h = size + 4
  const mask = createCanvas(w, h)
  const m = mask.getContext('2d', { willReadFrequently: true })!
  m.font = font
  m.textBaseline = 'top'
  m.fillStyle = '#fff'
  m.fillText(text, 1, zh ? 1 : 2)
  const img = m.getImageData(0, 0, w, h)
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i]! >= 110 ? 255 : 0
  m.putImageData(img, 0, 0)
  const tint = (fill: string) => {
    const c = createCanvas(w, h)
    const g = context2d(c)
    g.drawImage(mask, 0, 0)
    g.globalCompositeOperation = 'source-in'
    g.fillStyle = fill
    g.fillRect(0, 0, w, h)
    return c
  }
  const out = createCanvas(w + 2, h + 2)
  const g = context2d(out)
  const ring = tint(outline)
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2], [2, 2]] as const) g.drawImage(ring, dx, dy)
  g.drawImage(tint(color), 1, 1)
  // A font still loading draws nothing worth keeping.
  if (document.fonts.check(font, text)) labels.set(key, out)
  return out
}

const portraits = new Map<number, HTMLImageElement>()
const portrait = (dex: number) => {
  let img = portraits.get(dex)
  if (!img) {
    img = new Image()
    img.src = portraitUrl(dex)
    portraits.set(dex, img)
  }
  return img.complete && img.naturalWidth > 0 ? img : null
}

/** A rectangle with its corners cut by one pixel, the cards' and panels' shape. */
const box = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) => {
  g.fillStyle = fill
  g.fillRect(x + 1, y, w - 2, h)
  g.fillRect(x, y + 1, w, h - 2)
}

/** A card's face: its type's frame lit from the top left, the Pokémon's portrait in a window, its type and power below. */
const faces = canvasCache<string, HTMLCanvasElement>()
const face = (c: DuelCard) => {
  const key = `${c.type}|${c.power}|${c.dex}`
  const cached = faces.get(key)
  if (cached) return cached
  const col = TYPE_COLOR[c.type]
  const canvas = createCanvas(CARD.w, CARD.h)
  const g = context2d(canvas)
  box(g, 0, 0, CARD.w, CARD.h, INK)
  box(g, 1, 1, CARD.w - 2, CARD.h - 2, col.mid)
  g.fillStyle = col.light
  g.fillRect(2, 1, CARD.w - 4, 1)
  g.fillRect(1, 2, 1, CARD.h - 4)
  g.fillStyle = col.dark
  g.fillRect(2, CARD.h - 2, CARD.w - 4, 1)
  g.fillRect(CARD.w - 2, 2, 1, CARD.h - 4)
  // The portrait's window (most of the 40 px portrait), shaded on its top and left edges.
  g.fillStyle = '#f8f0d8'
  g.fillRect(2, 2, 32, 32)
  const img = portrait(c.dex)
  if (img) g.drawImage(img, 4, 2, 32, 32, 2, 2, 32, 32)
  g.fillStyle = col.dark
  g.fillRect(2, 2, 32, 1)
  g.fillRect(2, 3, 1, 31)
  // The type and the power, on a darker band.
  box(g, 2, 35, 32, 11, col.dark)
  g.drawImage(icons()[c.type], 3, 36)
  const p = big(String(c.power))
  g.drawImage(p, 34 - p.width, 36)
  if (img) faces.set(key, canvas)
  return canvas
}

/** A card's back: navy with the type triangle's three dots. */
const back = lazy(() => {
  const canvas = createCanvas(CARD.w, CARD.h)
  const g = context2d(canvas)
  box(g, 0, 0, CARD.w, CARD.h, INK)
  box(g, 1, 1, CARD.w - 2, CARD.h - 2, '#30386c')
  box(g, 3, 3, CARD.w - 6, CARD.h - 6, '#4a5498')
  box(g, 4, 4, CARD.w - 8, CARD.h - 8, '#30386c')
  g.fillStyle = '#5a64a8'
  for (let y = 6; y < CARD.h - 6; y += 4) for (let x = 6 + ((y / 4) % 2) * 2; x < CARD.w - 6; x += 4) g.fillRect(x, y, 1, 1)
  const i = icons()
  g.drawImage(i.fire, 12, 10)
  g.drawImage(i.grass, 18, 22)
  g.drawImage(i.water, 6, 22)
  return canvas
})

/** A small back for the rival's hand. */
const miniBack = lazy(() => {
  const canvas = createCanvas(9, 12)
  const g = context2d(canvas)
  box(g, 0, 0, 9, 12, INK)
  box(g, 1, 1, 7, 10, '#4a5498')
  g.fillStyle = '#30386c'
  g.fillRect(2, 2, 5, 8)
  g.fillStyle = '#f8c040'
  g.fillRect(4, 5, 1, 2)
  return canvas
})

/** The felt: a wooden table with a green top and the type triangle printed faintly in the middle. */
const table = lazy(() => {
  const canvas = createCanvas(W, H)
  const g = context2d(canvas)
  g.fillStyle = '#3a2418'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#4a3020'
  for (let y = 2; y < H; y += 6) g.fillRect(0, y, W, 1)
  box(g, FELT.x, FELT.y, FELT.w, FELT.h, INK)
  box(g, FELT.x + 1, FELT.y + 1, FELT.w - 2, FELT.h - 2, '#7a4a28')
  box(g, FELT.x + 3, FELT.y + 3, FELT.w - 6, FELT.h - 6, '#24603c')
  g.fillStyle = '#2c7046'
  g.fillRect(FELT.x + 4, FELT.y + 4, FELT.w - 8, 1)
  g.fillStyle = '#205434'
  for (let y = FELT.y + 6; y < FELT.y + FELT.h - 4; y += 3) for (let x = FELT.x + 5 + (y % 2); x < FELT.x + FELT.w - 4; x += 5) g.fillRect(x, y, 1, 1)
  // The two slots' outlines.
  for (const s of [SLOT.mine, SLOT.theirs]) {
    g.fillStyle = '#1c4c30'
    for (let x = s.x + 2; x < s.x + CARD.w - 2; x += 3) g.fillRect(x, s.y - 1, 2, 1), g.fillRect(x, s.y + CARD.h, 2, 1)
    for (let y = s.y + 2; y < s.y + CARD.h - 2; y += 3) g.fillRect(s.x - 1, y, 1, 2), g.fillRect(s.x + CARD.w, y, 1, 2)
  }
  // The triangle between the slots: Fire → Grass → Water → Fire.
  g.globalAlpha = 0.7
  const i = icons()
  const cx = W / 2
  g.drawImage(i.fire, cx - 4, 34)
  g.drawImage(i.grass, cx + 1, 46)
  g.drawImage(i.water, cx - 9, 46)
  g.fillStyle = '#c8e8c0'
  g.fillRect(cx + 4, 43, 1, 2)
  g.fillRect(cx - 1, 51, 2, 1)
  g.fillRect(cx - 5, 43, 1, 2)
  g.globalAlpha = 1
  // The HUD bands: the rival's on top, yours above the hand.
  g.fillStyle = '#2a1a10'
  g.fillRect(0, 0, W, 16)
  g.fillRect(0, 98, W, 12)
  return canvas
})

/* ---------- Layout ---------- */

/** A hand card's x: five places across the whole width, the cards filling them from the left. */
const handX = (i: number) => i * (CARD.w + 1)

/** Where a seat's bank slot for a type sits (its icon's top left): yours above the hand, the rival's on top. */
const bankAt = (bottom: boolean, type: DuelType) => ({ x: 4 + DUEL_TYPES.indexOf(type) * 25, y: bottom ? 100 : 3 })

const PLAY_BTN = { x: 62, y: 80, w: 60, h: 14 } as const
/** The line under the picks: what to do, the verdict, the round's result. */
const LINE_Y = 80

/* ---------- The screen ---------- */

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string }

/** The reveal playing out: what turned, from whose side, and its clock (s). */
type Reveal = { r: DuelReveal; t: number; me: number; done: Set<string>; from: Flight | null }

/** A card on its way from the hand to the felt. */
type Flight = { card: DuelCard; x: number; y: number; t0: number }

/** A reveal's card turned by `seat`. */
const cardOf = (r: DuelReveal, seat: number) => (seat === 0 ? r.cards[0] : r.cards[1])

const parse = (table: TableView | null) => (table && table.view !== null ? typeDuelRules.parseView(table.view) : null)

/** What the end sheet claims for a seat: a 3-0 sweep is the perfect duel. */
const featsOf = (table: TableView, seat: number): readonly string[] => {
  const v = parse(table)
  return v && v.over && v.winner === seat && v.banks[1 - seat]!.length === 0 ? ['perfectDuel'] : []
}

export const typeDuel: TableUi = {
  size: { w: W, h: H },
  feats: featsOf,
  start: ({ source }) => {
    let clock = 0
    let sel: number | null = null
    /** The card sent and not yet confirmed by the table (shows in the slot at once). */
    let sent: DuelCard | null = null
    let sentAt = 0
    let flying: Flight | null = null
    /** Where each hand card is drawn: it slides to its place when the hand changes. */
    const shownX = new Map<number, number>()
    let reveal: Reveal | null = null
    let seenRound = 0
    /** Hand cards already shown; a new one is dealt in (it slides up) once the reveal is done. */
    const known = new Map<number, number>()
    let intro = -1
    /** Set once a match is over (and at first): the next fresh match counts down. */
    let armed = true
    let particles: Particle[] = []
    let shake = 0
    let freeze = 0
    let drag: { id: number; x0: number; y0: number; x: number; y: number } | null = null
    let timer: { ms: number; at: number; of: TableView | null } = { ms: 0, at: 0, of: null }
    let lastTick = -1
    let endSaid = false

    const burst = (x: number, y: number, type: DuelType, n: number) => {
      const col = TYPE_COLOR[type]
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = 20 + Math.random() * 60
        particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0.4 + Math.random() * 0.5, color: [col.glow, col.light, col.mid][i % 3]! })
      }
    }

    const mySeat = () => source.seat()
    const bottomSeat = (v: DuelView) => v.you ?? 0

    const handOf = (v: DuelView) => {
      const pick = v.pick?.id ?? sent?.id
      const hidden = reveal !== null
      return v.hand.filter((c) => c.id !== pick && (!hidden || known.has(c.id)))
    }

    const canPick = (v: DuelView, table: TableView) => {
      const seat = mySeat()
      return seat !== null && !v.over && reveal === null && intro < 0 && sent === null && v.pick === null && table.pending.includes(seat) && table.phase === 'playing'
    }

    const send = (v: DuelView, id: number) => {
      const hand = handOf(v)
      const i = hand.findIndex((c) => c.id === id)
      const card = hand[i]
      if (!card) return
      flying = { card, x: drag?.id === id ? drag.x - CARD.w / 2 : handX(i), y: drag?.id === id ? drag.y - CARD.h / 2 : HAND_Y - LIFT, t0: clock }
      sent = card
      sentAt = clock
      sel = null
      source.play(id)
      playSfx('whoosh')
    }

    /** Starts the reveal of a round the table just turned. */
    const onReveal = (v: DuelView, r: DuelReveal) => {
      // A card still flying to the felt lands before the cards turn.
      const lead = flying ? Math.max(0, FLIGHT - (clock - flying.t0)) : 0
      reveal = { r, t: -lead, me: bottomSeat(v), done: new Set(), from: flying }
      seenRound = r.round
      sent = null
      flying = null
      sel = null
      drag = null
    }

    let pointer: GameInput['pointer'] = { x: -1, y: -1, down: false, pressed: false, released: false }

    /** Whether the pointer hovers: it moved while up (a mouse); a touch never does. */
    let hovers = false

    const step = (dt: number, input: GameInput) => {
      clock += dt
      const moved = input.pointer.x !== pointer.x || input.pointer.y !== pointer.y
      if (input.pointer.pressed) hovers = false
      else if (moved && !input.pointer.down && !input.pointer.released) hovers = true
      pointer = input.pointer
      const table = source.table()
      const v = parse(table)
      for (const p of particles) {
        p.life -= dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 140 * dt
      }
      particles = particles.filter((p) => p.life > 0)
      shake = Math.max(0, shake - dt)
      if (!table || !v) return

      // A new match: deal the hand in and count down.
      if (v.over) armed = true
      else if (armed && v.round === 1 && !v.last) {
        armed = false
        intro = 0
        known.clear()
        reveal = null
        seenRound = 0
        sent = null
        endSaid = false
        v.hand.forEach((c, i) => known.set(c.id, clock + 0.5 + i * 0.09))
      }
      if (intro >= 0) {
        const before = intro
        intro += dt
        for (const at of [0, 0.45, 0.9]) if (before <= at && intro > at) playSfx('tick')
        if (before <= 1.35 && intro > 1.35) playSfx('shing')
        if (intro > 1.8) intro = -1
      }

      if (v.last && v.last.round > seenRound) onReveal(v, v.last)
      if (reveal) {
        if (freeze > 0) freeze -= dt
        else reveal.t += dt
        const r = reveal
        const at = (beat: string, time: number, fn: () => void) => {
          if (r.t >= time && !r.done.has(beat)) {
            r.done.add(beat)
            fn()
          }
        }
        at('flip', BEAT.flip, () => playSfx('zip'))
        at('clash', BEAT.clash, () => {
          const w = r.r.winner
          if (w === null) {
            playSfx('thud')
            burst(W / 2, 50, r.r.cards[0].type, 8)
            burst(W / 2, 50, r.r.cards[1].type, 8)
            return
          }
          const card = cardOf(r.r, w)
          const loserBottom = 1 - w === r.me
          const s = loserBottom ? SLOT.mine : SLOT.theirs
          playSfx(TYPE_SFX[card.type])
          playCry(cryUrl(card.dex), 0.22)
          burst(s.x + CARD.w / 2, s.y + CARD.h / 2, card.type, 22)
          shake = 0.25
          freeze = 0.09
        })
        at('say', BEAT.say, () => {
          const seat = mySeat()
          if (r.r.winner === null || seat === null) return
          playSfx(r.r.winner === seat ? 'coin' : 'denied')
        })
        at('fly', BEAT.fly + 0.35, () => {
          if (r.r.winner === null) return
          const won = cardOf(r.r, r.r.winner)
          const b = bankAt(r.r.winner === r.me, won.type)
          burst(b.x + 4, b.y + 4, won.type, 10)
          playSfx('pickup')
        })
        if (r.t >= BEAT.end) {
          reveal = null
          v.hand.forEach((c, i) => {
            if (!known.has(c.id)) {
              known.set(c.id, clock + 0.05 + i * 0.05)
              playSfx('move')
            }
          })
        }
      }
      for (const c of v.hand) if (!known.has(c.id) && reveal === null) known.set(c.id, clock)
      // A pick the table never took (refused, or lost on the way) goes back to the hand.
      if (sent && v.pick === null && reveal === null && clock - sentAt > 3) sent = null

      // The turn's clock, counted down here between the table's updates.
      if (table !== timer.of) timer = { ms: table.leftMs ?? 0, at: clock, of: table }
      const seat = mySeat()
      const myTurn = seat !== null && table.pending.includes(seat) && !v.over && v.pick === null && sent === null
      const left = Math.ceil((timer.ms - (clock - timer.at) * 1000) / 1000)
      if (myTurn && reveal === null && left <= 5 && left > 0 && left !== lastTick) {
        lastTick = left
        playSfx('tick')
      }

      if (v.over && reveal === null && !endSaid) {
        endSaid = true
        const won = seat !== null && v.winner === seat
        playSfx(seat === null ? 'select' : won ? 'levelUp' : v.winner === null ? 'thud' : 'denied')
        if (v.winner !== null) {
          const b = bankAt(v.winner === bottomSeat(v), 'water')
          for (const type of DUEL_TYPES) burst(b.x + 30, b.y + 4, type, 10)
        }
      }

      if (seat !== null)
        handOf(v).forEach((c, i) => {
          const to = handX(i)
          const from = shownX.get(c.id) ?? to
          shownX.set(c.id, Math.abs(to - from) < 0.5 ? to : from + (to - from) * Math.min(1, dt * 16))
        })

      // Input.
      if (!canPick(v, table)) {
        drag = null
        return
      }
      const hand = handOf(v)
      const p = input.pointer
      const cardAt = (x: number, y: number) =>
        hand.find((c, i) => {
          const top = HAND_Y - (c.id === sel ? LIFT : 0)
          const cx = handX(i)
          return x >= cx && x < cx + CARD.w && y >= top && y < H
        })
      if (p.pressed) {
        const inBtn = sel !== null && p.x >= PLAY_BTN.x && p.x < PLAY_BTN.x + PLAY_BTN.w && p.y >= PLAY_BTN.y && p.y < PLAY_BTN.y + PLAY_BTN.h
        if (inBtn && sel !== null) return send(v, sel)
        const c = cardAt(p.x, p.y)
        if (c) drag = { id: c.id, x0: p.x, y0: p.y, x: p.x, y: p.y }
        else if (sel !== null) sel = null
      }
      if (drag && p.down) {
        drag.x = p.x
        drag.y = p.y
      }
      if (drag && p.released) {
        const d = drag
        const pulled = d.y0 - p.y > 18
        if (pulled) send(v, d.id)
        else if (Math.abs(p.x - d.x0) < 10 && Math.abs(p.y - d.y0) < 10) {
          if (sel === d.id) send(v, d.id)
          else {
            sel = d.id
            playSfx('select')
          }
        }
        drag = null
      }
      for (let k = 0; k < hand.length; k++) {
        if (input.pressed(`Digit${k + 1}`)) {
          if (sel === hand[k]!.id) send(v, sel)
          else ((sel = hand[k]!.id), playSfx('select'))
        }
      }
      const at = hand.findIndex((c) => c.id === sel)
      if (input.pressed('ArrowRight') || input.pressed('ArrowLeft')) {
        const dir = input.pressed('ArrowRight') ? 1 : -1
        sel = hand[(at < 0 ? (dir > 0 ? 0 : hand.length - 1) : (at + dir + hand.length) % hand.length)]!.id
        playSfx('select')
      }
      if ((input.pressed('Enter') || input.pressed('Space') || input.pressed('ArrowUp')) && sel !== null) send(v, sel)
    }

    /* ---------- Drawing ---------- */

    /**
     * A seat's banks: per type its icon and three pips. A slot that would win
     * the match with one more card blinks gold, so both sides see the threat.
     */
    const drawBanks = (g: CanvasRenderingContext2D, bank: readonly DuelCard[], bottom: boolean, hidden: DuelCard | null, live: boolean) => {
      const shown = hidden ? bank.filter((c) => c.id !== hidden.id) : bank
      const n = bankCounts(shown)
      const blink = live && Math.floor(clock * 3) % 2 === 0
      const i = icons()
      for (const type of DUEL_TYPES) {
        const b = bankAt(bottom, type)
        const lit = n[type] > 0
        if (blink && bankWins([...shown, { id: -1, type, power: DUEL.power.min, dex: 0 }])) box(g, b.x - 2, b.y - 2, 25, 13, '#f8d040')
        box(g, b.x - 1, b.y - 1, 23, 11, lit ? TYPE_COLOR[type].dark : '#20140c')
        g.globalAlpha = lit ? 1 : 0.35
        g.drawImage(i[type], b.x, b.y)
        g.globalAlpha = 1
        for (let k = 0; k < 3; k++) {
          g.fillStyle = k < n[type] ? TYPE_COLOR[type].glow : '#4a3424'
          g.fillRect(b.x + 11 + k * 3, b.y + 3, 2, 3)
        }
      }
    }

    const drawCard = (g: CanvasRenderingContext2D, c: DuelCard | null, x: number, y: number, flip = 1) => {
      const art = c ? face(c) : back()
      const w = Math.max(1, Math.round(CARD.w * Math.abs(flip)))
      const dx = Math.round(x + (CARD.w - w) / 2)
      g.fillStyle = 'rgba(0,0,0,0.35)'
      g.fillRect(dx + 1, Math.round(y) + CARD.h, w - 1, 2)
      g.drawImage(art, 0, 0, CARD.w, CARD.h, dx, Math.round(y), w, CARD.h)
    }

    const centered = (g: CanvasRenderingContext2D, img: HTMLCanvasElement, cx: number, y: number) => g.drawImage(img, Math.round(cx - img.width / 2), Math.round(y))

    const drawReveal = (g: CanvasRenderingContext2D, r: Reveal) => {
      const tt = r.t
      const bottomCard = cardOf(r.r, r.me)
      const topCard = cardOf(r.r, 1 - r.me)
      const winner = r.r.winner
      const winBottom = winner !== null && winner === r.me
      /** A face-down card turning over: its width and whether its face shows yet. */
      const flip = () => {
        if (tt < BEAT.flip) return { f: 1, up: false }
        const k = Math.min(1, (tt - BEAT.flip) / (BEAT.flipEnd - BEAT.flip))
        return { f: Math.abs(Math.cos(k * Math.PI)), up: k >= 0.5 }
      }
      const top = flip()
      const bot = mySeat() === null ? flip() : { f: 1, up: true }
      // The clash: the winner lunges, the loser shakes.
      const lunge = tt >= BEAT.clash - 0.12 && tt < BEAT.clash + 0.1 ? Math.round(5 * Math.sin(((tt - (BEAT.clash - 0.12)) / 0.22) * Math.PI)) : 0
      const jolt = shake > 0 ? Math.round(Math.sin(clock * 90) * 2) : 0
      const place = (bottom: boolean) => {
        const s = bottom ? SLOT.mine : SLOT.theirs
        const isWinner = winner !== null && winBottom === bottom
        const isLoser = winner !== null && !isWinner
        let x = s.x + (isWinner ? (bottom ? lunge : -lunge) : 0) + (isLoser ? jolt : 0)
        let y: number = s.y
        const f = r.from
        if (bottom && f && clock - f.t0 < FLIGHT) {
          const k = (clock - f.t0) / FLIGHT
          x = f.x + (s.x - f.x) * k
          y = f.y + (s.y - f.y) * k
        }
        let alpha = 1
        if (tt >= BEAT.fly) {
          const k = Math.min(1, (tt - BEAT.fly) / (BEAT.end - BEAT.fly - 0.1))
          if (isWinner) {
            const b = bankAt(bottom, (bottom ? bottomCard : topCard).type)
            x += (b.x - 6 - x) * k * k
            y += (b.y - 18 - y) * k * k
            alpha = 1 - k * 0.6
          } else {
            y += k * 10
            alpha = 1 - k
          }
        }
        return { x, y, alpha }
      }
      const pt = place(false)
      const pb = place(true)
      g.globalAlpha = pt.alpha
      drawCard(g, top.up ? topCard : null, pt.x, pt.y, top.f)
      g.globalAlpha = pb.alpha
      drawCard(g, bot.up ? bottomCard : null, pb.x, pb.y, bot.f)
      g.globalAlpha = 1
      // The round's winner glows from the clash until it flies to its bank.
      if (winner !== null && tt >= BEAT.clash && tt < BEAT.fly) {
        const p = winBottom ? pb : pt
        g.fillStyle = Math.floor(clock * 10) % 2 ? TYPE_COLOR[cardOf(r.r, winner).type].glow : '#fff'
        const x = Math.round(p.x)
        const y = Math.round(p.y)
        g.fillRect(x, y - 2, CARD.w, 1)
        g.fillRect(x, y + CARD.h + 1, CARD.w, 1)
        g.fillRect(x - 2, y, 1, CARD.h)
        g.fillRect(x + CARD.w + 1, y, 1, CARD.h)
      }
      // The verdict under them: "fire > grass", "9 > 5", or "=".
      if (tt >= BEAT.flipEnd && tt < BEAT.say) {
        const a = bottomCard
        const b = topCard
        const i = icons()
        const lineY = LINE_Y + 3
        if (a.type !== b.type) {
          const [w, l] = duelWinner(a, b) === 0 ? [a, b] : [b, a]
          g.drawImage(i[w.type], W / 2 - 17, lineY)
          centered(g, big('>', '#f8d040'), W / 2, lineY)
          g.drawImage(i[l.type], W / 2 + 8, lineY)
        } else {
          const hi = Math.max(a.power, b.power)
          const lo = Math.min(a.power, b.power)
          centered(g, hi === lo ? label('=', '#f8d040') : big(`${hi}>${lo}`, '#f8d040'), W / 2, lineY)
        }
      }
      if (tt >= BEAT.say && tt < BEAT.end) {
        const d = t().minigames.duel
        const seat = mySeat()
        const text = winner === null ? d.tie : seat === null ? d.seatWon(winner + 1) : winner === seat ? d.roundWon : d.roundLost
        const color = winner === null ? '#fff' : seat === null || winner === seat ? '#f8d040' : '#f8a0a0'
        centered(g, label(text, color), W / 2, LINE_Y)
      }
    }

    const draw = (g: CanvasRenderingContext2D) => {
      g.imageSmoothingEnabled = false
      g.drawImage(table(), 0, 0)
      const tv = source.table()
      const v = parse(tv)
      const d = t().minigames.duel
      if (!tv || !v) {
        centered(g, label(d.waiting), W / 2, 50)
        return
      }
      const me = bottomSeat(v)
      const rival = 1 - me
      const seat = mySeat()
      const r = reveal
      const banking = r && r.t < BEAT.fly + 0.35 && r.r.winner !== null ? cardOf(r.r, r.r.winner) : null

      // The HUDs: banks and names, the rival's hand face down.
      drawBanks(g, v.banks[rival]!, false, banking && r?.r.winner === rival ? banking : null, !v.over)
      drawBanks(g, v.banks[me]!, true, banking && r?.r.winner === me ? banking : null, !v.over)
      const rivalName = seat === null ? d.seat(rival + 1) : d.rival
      const meName = seat === null ? d.seat(me + 1) : d.you
      const rn = label(rivalName, '#f8b8a8')
      g.drawImage(rn, 82, 1)
      const mn = label(meName, '#a8d8f8')
      g.drawImage(mn, 82, 98)
      const held = Math.max(0, v.held[rival]! - (v.picked[rival] ? 1 : 0))
      for (let k = 0; k < held; k++) g.drawImage(miniBack(), W - 4 - 9 - k * 7, 2)
      const rd = label(`${Math.min(r ? r.r.round : v.round, DUEL.rounds)}/${DUEL.rounds}`, '#d8c8b0')
      g.drawImage(rd, W - rd.width - 2, 98)

      // The felt: the picks, or the reveal playing out.
      if (r) drawReveal(g, r)
      else if (!v.over && intro < 0) {
        const mine = v.pick ?? sent
        if (flying) {
          const k = Math.min(1, (clock - flying.t0) / FLIGHT)
          drawCard(g, flying.card, flying.x + (SLOT.mine.x - flying.x) * k, flying.y + (SLOT.mine.y - flying.y) * k)
          if (k >= 1) flying = null
        } else if (mine) drawCard(g, mine, SLOT.mine.x, SLOT.mine.y)
        else if (seat === null && v.picked[me]) drawCard(g, null, SLOT.mine.x, SLOT.mine.y)
        if (v.picked[rival]) drawCard(g, null, SLOT.theirs.x, SLOT.theirs.y - Math.round(Math.abs(Math.sin(clock * 3)) * 2))
        else if (tv.phase === 'playing') {
          // The rival thinking: three dots.
          for (let k = 0; k < 3; k++) {
            g.fillStyle = Math.floor(clock * 3) % 3 === k ? '#f8f0d8' : '#3c7c54'
            g.fillRect(SLOT.theirs.x + 11 + k * 5, SLOT.theirs.y + 21, 3, 3)
          }
        }
      } else if (v.last) {
        // The match's last pair stays on the felt behind the end.
        g.globalAlpha = 0.5
        drawCard(g, cardOf(v.last, me), SLOT.mine.x, SLOT.mine.y)
        drawCard(g, cardOf(v.last, rival), SLOT.theirs.x, SLOT.theirs.y)
        g.globalAlpha = 1
      }

      // The line under the picks: what to do now, or the turn's clock.
      const myTurn = seat !== null && tv.pending.includes(seat) && !v.over && v.pick === null && sent === null && !r && intro < 0
      if (!r && intro < 0) {
        if (v.over) {
          const text = seat === null ? (v.winner === null ? d.tie : d.seatWon(v.winner + 1)) : v.winner === seat ? t().minigames.end.win : v.winner === null ? t().minigames.end.draw : t().minigames.end.loss
          const pulse = Math.floor(clock * 3) % 2 === 0
          centered(g, label(text, v.winner === seat ? (pulse ? '#f8d040' : '#fff8c0') : '#fff'), W / 2, LINE_Y)
        } else if (myTurn && sel !== null) {
          box(g, PLAY_BTN.x, PLAY_BTN.y, PLAY_BTN.w, PLAY_BTN.h, INK)
          box(g, PLAY_BTN.x + 1, PLAY_BTN.y + 1, PLAY_BTN.w - 2, PLAY_BTN.h - 2, '#f8c040')
          g.fillStyle = '#fff0a0'
          g.fillRect(PLAY_BTN.x + 2, PLAY_BTN.y + 1, PLAY_BTN.w - 4, 1)
          centered(g, label(d.play, '#fff', '#704010'), W / 2, PLAY_BTN.y + 1)
        } else {
          const text = seat === null ? d.watching : myTurn ? d.pick : d.waiting
          centered(g, label(text, '#e8f0e0'), W / 2, LINE_Y)
        }
      }
      if (myTurn && tv.leftMs !== null) {
        const ms = Math.max(0, timer.ms - (clock - timer.at) * 1000)
        const k = ms / 30_000
        const bw = Math.round(60 * k)
        g.fillStyle = INK
        g.fillRect(61, 95, 62, 3)
        g.fillStyle = ms < 10_000 ? (Math.floor(clock * 6) % 2 ? '#f85030' : '#f8a050') : '#78d058'
        g.fillRect(62, 96, bw, 1)
      }

      // The hand (yours face up; a spectator sees the bottom seat's backs).
      if (seat === null) {
        const n = v.held[me]! - (v.picked[me] ? 1 : 0)
        for (let k = 0; k < n; k++) drawCard(g, null, handX(k), HAND_Y + 4)
      } else {
        const hand = handOf(v)
        const live = myTurn
        hand.forEach((c, i) => {
          const at = known.get(c.id) ?? clock
          const k = Math.min(1, Math.max(0, (clock - at) / 0.22))
          if (k <= 0) return
          let x = Math.round(shownX.get(c.id) ?? handX(i))
          let y = HAND_Y + Math.round((1 - k) * (1 - k) * 50)
          if (c.id === sel) y -= LIFT
          // A mouse over a card lifts it a little (a finger never hovers).
          else if (live && hovers && !pointer.down && pointer.x >= x && pointer.x < x + CARD.w && pointer.y >= HAND_Y && pointer.y < H) y -= 2
          if (drag?.id === c.id && (Math.abs(drag.y - drag.y0) > 4 || Math.abs(drag.x - drag.x0) > 4)) {
            x = Math.round(drag.x - CARD.w / 2)
            y = Math.round(drag.y - CARD.h / 2)
          }
          drawCard(g, c, x, y)
          // Waiting on the rival: the hand rests, a little darker.
          if (!live && !v.over && !r) {
            g.fillStyle = 'rgba(24,16,16,0.3)'
            g.fillRect(x, y, CARD.w, CARD.h)
          }
          if (c.id === sel) {
            g.fillStyle = Math.floor(clock * 4) % 2 ? '#f8d040' : '#fff8c0'
            g.fillRect(x + 1, y - 2, CARD.w - 2, 1)
          }
        })
      }

      // The match's start: 3, 2, 1, Duel!
      if (intro >= 0) {
        g.fillStyle = 'rgba(16,10,6,0.45)'
        g.fillRect(FELT.x + 3, FELT.y + 3, FELT.w - 6, FELT.h - 6)
        const n = intro < 0.45 ? '3' : intro < 0.9 ? '2' : intro < 1.35 ? '1' : null
        if (n) {
          const img = big(n, '#f8d040')
          const s = 3
          g.drawImage(img, Math.round(W / 2 - (img.width * s) / 2), 32, img.width * s, img.height * s)
        } else {
          const img = label(d.duel, '#f8d040')
          g.drawImage(img, Math.round(W / 2 - img.width), 34, img.width * 2, img.height * 2)
        }
        centered(g, label(d.goal, '#e8f0e0'), W / 2, 70)
      }

      for (const p of particles) {
        g.fillStyle = p.color
        g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2)
      }
    }

    return { step, draw }
  },
}

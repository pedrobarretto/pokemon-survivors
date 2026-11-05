import { playSfx } from '../../engine/audio'
import { fromStrings, lazy } from '../../engine/pixelart'
import { hash2 } from '../../engine/rng'
import { drawPokemon, loadSpecies, sprites } from '../../render/sprites'
import {
  COUNT_IN,
  arcadeSize,
  burst,
  drawCount,
  drawFx,
  drawIcon,
  drawText,
  plate,
  secondsLeft,
  shakeOffset,
  stepFx,
  textWidth,
  type Particle,
  type Popup,
} from './arcadeKit'
import { VOLTORB_FINE, WHACK_FEATS, WHACK_ROUND, comboMult, whackFeats, whackPace, whackScore } from './arcadeRules'
import type { GameInput, GameRun, SoloCtx, SoloGame } from './frame'

/**
 * Whack-a-Diglett (`MINIGAMES.whackDiglett`), at the arcade's cabinets: a
 * field of holes (3×3 held sideways, 3×4 upright) where Diglett pop up for
 * shorter and shorter, a quick Dugtrio is the bonus and a Voltorb must be
 * left alone (whacked, it blows up: points and the combo lost). Whacks in a
 * row multiply; one that gets away drops the combo. 60 s.
 *
 * Touch: tap a hole. Keys: Q W E / A S D / Z X C (and 1 2 3 above them upright).
 */

const DEX = { diglett: 50, dugtrio: 51, voltorb: 100 } as const
type MoleKind = keyof typeof DEX

/** What's in a hole: who, how far through its pop-up (`t`, s), how long it stays up, and whether it was whacked (when). */
type Mole = { kind: MoleKind; t: number; up: number; hitAt: number | null }

/** How long a pop-up takes to rise and to sink (s). */
const RISE = 0.12
const SINK = 0.16

/** The rows of keys that whack each row of holes (the top one only on the upright field). */
const KEY_ROWS = [
  ['Digit1', 'Digit2', 'Digit3'],
  ['KeyQ', 'KeyW', 'KeyE'],
  ['KeyA', 'KeyS', 'KeyD'],
  ['KeyZ', 'KeyX', 'KeyC'],
] as const

/** The toy mallet (a red head with a white band on a wooden handle), seen from the side: it strikes with the head's bottom face. */
const MALLET = lazy(() =>
  fromStrings(
    ['.111111.........', '12222221........', '1244442111111111', '1244442155555551', '1244442155555551', '1244442111111111', '12222221........', '13333331........', '.111111.........'],
    { 1: '#382020', 2: '#e85048', 3: '#a82828', 4: '#f8f0e8', 5: '#c89058' },
  ),
)

/** The lines of a whack's impact, either side of the head. */
const IMPACT = lazy(() => fromStrings(['1.......1', '.1.....1.', '.........', '11.....11'], { 1: '#ffffff' }))

/** Little stars circling a whacked Diglett's head. */
const STAR = lazy(() => fromStrings(['.1.', '121', '.1.'], { 1: '#f8d030', 2: '#ffffff' }))

/** The grass field, painted once per screen size and grid. */
const fields = new Map<string, HTMLCanvasElement>()
const field = (w: number, h: number) => {
  const key = `${w}x${h}`
  const hit = fields.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  const grass = ['#8fd068', '#88c862', '#80c05c']
  const dense = ['#74b452', '#6eac4e', '#67a448']
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = hash2(x, y, 7)
      const pal = Math.sin(x / 23 + Math.sin(y / 19) * 2) + Math.sin(y / 17 + x / 41) > 1.1 ? dense : grass
      g.fillStyle = pal[r < 0.7 ? 0 : r < 0.9 ? 1 : 2]!
      g.fillRect(x, y, 1, 1)
    }
  }
  for (let y = 4; y < h; y += 9) {
    for (let x = (y * 7) % 11; x < w; x += 13) {
      if (hash2(x, y, 9) < 0.5) continue
      g.fillStyle = '#5a9a40'
      g.fillRect(x, y, 1, 2)
      g.fillRect(x + 2, y, 1, 2)
      g.fillRect(x + 1, y + 1, 1, 1)
    }
  }
  fields.set(key, c)
  return c
}

/** Fills a pixel ellipse (whole rows, no smoothing). */
const ellipse = (g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string, half: 'all' | 'bottom' = 'all') => {
  g.fillStyle = color
  for (let dy = half === 'bottom' ? 0 : -ry; dy <= ry; dy++) {
    const span = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)))
    g.fillRect(Math.round(cx - span), Math.round(cy + dy), span * 2, 1)
  }
}

/** The field, ×3 on a phone so the Diglett read big: 3×4 holes upright, 3×3 sideways. */
const SIZES = { tall: { w: 120, h: 200 }, wide: { w: 200, h: 104 } } as const

/** The size the frame opened the screen at, which every round in it plays at. */
let shown = arcadeSize(SIZES.tall, SIZES.wide)

const start = (ctx: SoloCtx): GameRun => {
  const { w, h } = shown
  const upright = h > w
  const cols = 3
  const rows = upright ? 4 : 3
  const top = 15
  const cw = w / cols
  const ch = (h - top - 4) / rows
  for (const dex of Object.values(DEX)) void loadSpecies(dex).catch(() => {})

  /** Each hole's middle (its mouth) and the cell a tap whacks it from. */
  const holes = Array.from({ length: cols * rows }, (_, i) => {
    const c = i % cols
    const r = Math.floor(i / cols)
    return { x: Math.round(cw * (c + 0.5)), y: Math.round(top + ch * (r + 0.78)), cell: { x: c * cw, y: top + r * ch, w: cw, h: ch }, key: KEY_ROWS[upright ? r : r + 1]![c]! }
  })
  const rx = Math.min(14, Math.floor(cw * 0.3))
  const moles: (Mole | null)[] = holes.map(() => null)
  const parts: Particle[] = []
  const pops: Popup[] = []
  let clock = 0
  let played = 0
  let score = 0
  let combo = 0
  let bestCombo = 0
  let dugtrios = 0
  let nextPop = 0.4
  let lastHole = -1
  let stun = 0
  let shake = 0
  let flash = 0
  let lastTick = -1
  let mallet: { x: number; y: number; age: number } | null = null
  let ended: number | null = null
  const bragged = new Set<string>()
  const brag = (feat: string) => {
    if (bragged.has(feat)) return
    bragged.add(feat)
    ctx.brag(feat)
  }

  /** How far up a mole is, 0 (in its hole) to 1 (all out). */
  const height = (m: Mole) => {
    if (m.hitAt !== null) return Math.max(0, 1 - Math.max(0, m.t - m.hitAt - 0.22) / SINK)
    if (m.t < RISE) return m.t / RISE
    if (m.t < RISE + m.up) return 1
    return Math.max(0, 1 - (m.t - RISE - m.up) / SINK)
  }

  /** Whether a mole can still be whacked: out and not already hit (the last of its sinking too, for fairness). */
  const whackable = (m: Mole) => m.hitAt === null && m.t < RISE + m.up + SINK * 0.5

  const whack = (i: number) => {
    const hole = holes[i]!
    // The head comes down on the hole's mouth (on a head, if one is out).
    const out = moles[i]
    mallet = { x: hole.x, y: hole.y - 8 - (out && whackable(out) ? Math.round(sprites(DEX[out.kind]).bodyH * height(out) * 0.7) : 0), age: 0 }
    const m = moles[i]
    if (!m || !whackable(m)) {
      burst(parts, hole.x, hole.y, ['#a88050', '#c8a070'], 4, 30)
      playSfx('move')
      return
    }
    m.hitAt = m.t
    if (m.kind === 'voltorb') {
      score = Math.max(0, score - VOLTORB_FINE)
      combo = 0
      stun = 0.5
      shake = 0.4
      flash = 0.12
      burst(parts, hole.x, hole.y - 12, ['#f8d030', '#f87830', '#ffffff', '#e83838'], 26, 110)
      pops.push({ x: hole.x, y: hole.y - 30, text: `-${VOLTORB_FINE}`, color: '#ff6060', age: 0, big: true })
      playSfx('explosion')
      return
    }
    combo += 1
    bestCombo = Math.max(bestCombo, combo)
    const pts = whackScore(m.kind, combo - 1)
    score += pts
    shake = Math.max(shake, 0.08)
    burst(parts, hole.x, hole.y - 10, m.kind === 'dugtrio' ? ['#f8d030', '#ffffff', '#c08048'] : ['#ffffff', '#f8e070', '#c08048'], m.kind === 'dugtrio' ? 16 : 8, 70)
    pops.push({ x: hole.x, y: hole.y - 30, text: `+${pts}`, color: m.kind === 'dugtrio' ? '#f8d030' : '#ffffff', age: 0, big: m.kind === 'dugtrio' })
    playSfx(m.kind === 'dugtrio' ? 'coin' : 'hit')
    if (m.kind === 'dugtrio') {
      dugtrios += 1
      if (dugtrios >= 5) brag(WHACK_FEATS.dugtrio)
    }
    if (comboMult(combo, 5, 5) > comboMult(combo - 1, 5, 5)) {
      playSfx('levelUp')
      pops.push({ x: w / 2, y: top + 14, text: `X${comboMult(combo, 5, 5)}`, color: '#f8d030', age: 0, big: true })
    }
    if (combo >= 30) brag(WHACK_FEATS.combo30)
  }

  const step = (dt: number, input: GameInput) => {
    clock += dt
    stepFx(parts, pops, dt)
    shake = Math.max(0, shake - dt)
    flash = Math.max(0, flash - dt)
    if (mallet) {
      mallet.age += dt
      if (mallet.age > 0.2) mallet = null
    }
    if (ended !== null) {
      ended += dt
      return
    }
    if (clock < COUNT_IN) {
      if (clock - dt < 0.01 || Math.floor(clock / 0.9) !== Math.floor((clock - dt) / 0.9)) playSfx(clock >= 2.7 ? 'select' : 'tick')
      return
    }
    played += dt
    stun = Math.max(0, stun - dt)

    // Whacks: a tap on a hole's cell, or its key.
    if (stun <= 0) {
      if (input.pointer.pressed) {
        const p = input.pointer
        const i = holes.findIndex((o) => p.x >= o.cell.x && p.x < o.cell.x + o.cell.w && p.y >= o.cell.y && p.y < o.cell.y + o.cell.h)
        if (i >= 0) whack(i)
      }
      holes.forEach((o, i) => input.pressed(o.key) && whack(i))
    }

    // Pop-ups come and go.
    for (let i = 0; i < moles.length; i++) {
      const m = moles[i]
      if (!m) continue
      m.t += dt
      const gone = m.hitAt !== null ? m.t > m.hitAt + 0.22 + SINK : m.t > RISE + m.up + SINK
      if (!gone) continue
      if (m.hitAt === null && m.kind !== 'voltorb') {
        if (combo >= 3) pops.push({ x: holes[i]!.x, y: holes[i]!.y - 16, text: '-', color: '#c8c8d0', age: 0, big: false })
        if (combo > 0) playSfx('denied')
        combo = 0
      }
      moles[i] = null
    }
    const pace = whackPace(played)
    nextPop -= dt
    const out = moles.filter((m) => m !== null).length
    if (nextPop <= 0 && out < pace.most) {
      nextPop = pace.every * (0.75 + Math.random() * 0.5)
      const free = moles.flatMap((m, i) => (m === null && i !== lastHole ? [i] : []))
      if (free.length) {
        const i = free[Math.floor(Math.random() * free.length)]!
        const roll = Math.random()
        const kind: MoleKind = roll < pace.voltorb ? 'voltorb' : roll < pace.voltorb + pace.dugtrio ? 'dugtrio' : 'diglett'
        moles[i] = { kind, t: 0, up: pace.up * (kind === 'dugtrio' ? 0.6 : kind === 'voltorb' ? 1.3 : 1) * (0.85 + Math.random() * 0.3), hitAt: null }
        lastHole = i
      }
    }

    const left = secondsLeft(played, WHACK_ROUND)
    if (left <= 10 && left !== lastTick && left > 0) {
      lastTick = left
      playSfx('tick')
    }
    if (played >= WHACK_ROUND) {
      ended = 0
      playSfx('levelUp')
    }
  }

  const drawHole = (g: CanvasRenderingContext2D, i: number) => {
    const o = holes[i]!
    const m = moles[i]
    // The mound, its dark mouth, then whoever is in it, clipped at the mouth's front lip, then the lip.
    ellipse(g, o.x, o.y + 1, rx + 4, 8, '#8a6038')
    ellipse(g, o.x, o.y, rx + 3, 7, '#c8a070')
    ellipse(g, o.x, o.y, rx + 1, 5, '#a88050')
    ellipse(g, o.x, o.y, rx - 1, 4, '#302018')
    if (m) {
      const s = sprites(DEX[m.kind])
      const up = height(m)
      const drop = Math.round((1 - up) * (s.bodyH + 4))
      g.save()
      g.beginPath()
      g.rect(o.x - rx - 10, o.y - 60, rx * 2 + 20, 60 + 1)
      g.clip()
      const hit = m.hitAt !== null
      const blink = m.kind === 'voltorb' && !hit && Math.floor(clock * 8) % 2 === 0
      const squash = hit && m.t - m.hitAt! < 0.08 ? 2 : 0
      drawPokemon(g, s, hit ? 'Hurt' : 'Idle', 0, m.t, o.x, o.y + 2 + drop + squash, hit && m.t - m.hitAt! < 0.06 ? { flash: 0.8 } : blink ? { tint: { color: '#ff3020', amount: 0.35 } } : {})
      g.restore()
      if (hit && m.kind !== 'voltorb' && m.t - m.hitAt! < 0.4) {
        // Stars circling where the head was.
        const head = o.y - s.bodyH + drop
        for (let k = 0; k < 3; k++) {
          const a = clock * 9 + (k * Math.PI * 2) / 3
          g.drawImage(STAR(), Math.round(o.x + Math.cos(a) * 9 - 1), Math.round(head - 2 + Math.sin(a) * 3))
        }
      }
    }
    // The lip in front: the mound's near half drawn again over the sprite's feet.
    g.fillStyle = '#c8a070'
    for (let dy = 1; dy <= 5; dy++) {
      const span = Math.round((rx + 1) * Math.sqrt(Math.max(0, 1 - (dy / 5.5) ** 2)))
      const inner = Math.round((rx - 1) * Math.sqrt(Math.max(0, 1 - (dy / 4.5) ** 2)))
      g.fillRect(o.x - span, o.y + dy, span - inner, 1)
      g.fillRect(o.x + inner, o.y + dy, span - inner, 1)
      if (dy > 4) g.fillRect(o.x - span, o.y + dy, span * 2, 1)
    }
  }

  const draw = (g: CanvasRenderingContext2D) => {
    const off = shakeOffset(shake, 3)
    g.save()
    g.translate(off.x, off.y)
    g.drawImage(field(w, h), 0, 0)
    for (let i = 0; i < holes.length; i++) drawHole(g, i)
    drawFx(g, parts, pops)
    if (mallet) {
      // Raised for a blink, then down on the hole with its impact lines.
      const down = mallet.age >= 0.05
      g.drawImage(MALLET(), Math.round(mallet.x - 3), Math.round(mallet.y + (down ? 0 : -9)))
      if (down && mallet.age < 0.14) g.drawImage(IMPACT(), Math.round(mallet.x - 4), Math.round(mallet.y + 6))
    }
    g.restore()

    const score$ = String(score)
    plate(g, 3, 3, textWidth(score$) + 14, 11)
    drawIcon(g, 'star', 5, 5)
    drawText(g, score$, 13, 5, '#ffffff')
    const mult = comboMult(combo, 5, 5)
    const secs = clock < COUNT_IN ? WHACK_ROUND : secondsLeft(played, WHACK_ROUND)
    const clock$ = String(secs)
    const cwid = textWidth(clock$) + 12
    plate(g, w - 3 - cwid, 3, cwid, 11)
    drawIcon(g, 'clock', w - 1 - cwid, 5)
    drawText(g, clock$, w - cwid + 7, 5, secs <= 10 && Math.floor(clock * 4) % 2 === 0 ? '#ff6060' : '#ffffff')
    if (mult > 1) {
      const m$ = `X${mult}`
      plate(g, Math.round(w / 2 - textWidth(m$) / 2) - 2, 3, textWidth(m$) + 4, 11)
      drawText(g, m$, w / 2, 5, mult >= 4 ? '#f87878' : mult >= 3 ? '#f8a830' : '#f8d030', 'center')
    }
    if (stun > 0) {
      g.fillStyle = 'rgba(255,240,200,0.12)'
      g.fillRect(0, 0, w, h)
    }

    if (clock < COUNT_IN) {
      // The hint: the mallet bouncing over the middle hole.
      const mid = holes[Math.floor(holes.length / 2)]!
      const down = Math.floor(clock * 2.5) % 2 === 0
      g.drawImage(MALLET(), mid.x - 3, mid.y - (down ? 8 : 17))
      if (down) g.drawImage(IMPACT(), mid.x - 4, mid.y - 2)
      drawCount(g, clock, w, h)
    }
    if (flash > 0) {
      g.fillStyle = `rgba(255,255,255,${(flash / 0.12) * 0.6})`
      g.fillRect(0, 0, w, h)
    }
    if (ended !== null) {
      g.fillStyle = `rgba(16,20,32,${Math.min(0.5, ended)})`
      g.fillRect(0, 0, w, h)
      drawText(g, 'TIME!', w / 2, h / 2 - 10, '#f8d030', 'center', 3)
    }
  }

  return {
    step,
    draw,
    over: () => (ended !== null && ended > 1.1 ? { score, feats: whackFeats({ bestCombo, dugtrios }) } : null),
  }
}

/** Whack-a-Diglett at the arcade's cabinets (`MINIGAMES.whackDiglett`); its field fits the way the phone is held. */
export const whackDiglett: SoloGame = {
  get size() {
    return (shown = arcadeSize(SIZES.tall, SIZES.wide))
  },
  start,
}

import { plushForm, plushPiece, type PlushFamily } from '../../data/plushes'
import { playSfx } from '../../engine/audio'
import { formatPokeDollars, t } from '../../i18n'
import type { ClawDropped, ClawPlay, ClawState } from '../../net/realmApi'
import { plushArt } from '../../render/plush'
import { h } from '../../ui/dom'
import { loadSave } from '../../ui/save'
import { isFailure } from '../api'
import { dropClaw, fetchClaw, insertCredit } from '../clawApi'
import { pieceName } from '../furniture'
import { arcadeSize, burst, drawFx, drawIcon, drawText, plate, secondsLeft, stepFx, textWidth, type Particle, type Popup } from './arcadeKit'
import { CLAW, creditPrice, gripNeeded, pitLayout, type PitPoint } from './claw.rules'
import type { GameInput, GameRun, SoloCtx, SoloGame } from './frame'

/**
 * The Máquina de Pelúcias (`MINIGAMES.claw`): the week's six plushes in a
 * glass pit, a claw on two axes against the clock, one drop a credit. The API
 * charges the credit and decides the drop (`clawApi.ts`, `claw.rules.ts`);
 * this only animates the answer. Numbers and the machine are drawn on the
 * canvas, every word lives in the panel over the stage, since the in-world
 * font can't write them all.
 *
 * Touch: the pad (or a finger on the pit) moves the claw, the red button
 * drops it. Keys: arrows or WASD, Space or Enter.
 */

/** The machine, ×2 on a phone held either way. The pit sits at the same place in both: only the controls move. */
const SIZES = { tall: { w: 176, h: 256 }, wide: { w: 300, h: 160 } } as const

/** The pit's floor on the canvas. */
const PIT = { x: 8, y: 36 } as const

/** Where the claw rests, in the pit, and how fast it moves (units a second). */
const HOME: PitPoint = { x: CLAW.pit.w / 2, y: 24 }
const SPEED = 62

/** How far above the floor the claw hangs (px), the gantry's highest row, and a plush's width in the machine. */
const HANG = 52
const RAIL = 21
const PLUSH_W = 30

/** Seconds each step of a drop lasts. */
const TIMES = { lower: 0.7, lift: 0.8, carry: 0.9, fall: 0.45, slip: 0.5 } as const

type Phase = 'load' | 'ready' | 'busy' | 'aim' | 'lower' | 'wait' | 'lift' | 'carry' | 'fall' | 'slip' | 'result'

const FRAME_DARK = '#3a1830'

/** The cabinet and the empty pit, painted once a size. */
const bodies = new Map<number, HTMLCanvasElement>()
const body = (w: number) => {
  const hit = bodies.get(w)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = 160
  const g = c.getContext('2d')!
  const fill = (color: string, x: number, y: number, rw: number, rh: number) => {
    g.fillStyle = color
    g.fillRect(x, y, rw, rh)
  }
  // The cabinet.
  fill(FRAME_DARK, 2, 0, 172, 160)
  fill('#d84868', 3, 1, 170, 158)
  fill('#f08098', 3, 1, 170, 2)
  fill('#a82848', 3, 157, 170, 2)
  // The marquee and its bulbs.
  fill(FRAME_DARK, 12, 4, 152, 12)
  fill('#ffd868', 13, 5, 150, 10)
  fill('#f8a830', 13, 13, 150, 2)
  for (let x = 18; x < 160; x += 12) {
    fill('#e85048', x, 7, 4, 4)
    fill('#ffc8c0', x + 1, 7, 1, 1)
  }
  // The back wall and the floor, from behind the glass.
  fill(FRAME_DARK, PIT.x - 1, 19, CLAW.pit.w + 2, 128)
  fill('#404a78', PIT.x, 20, CLAW.pit.w, 16)
  fill('#4c5890', PIT.x, 20, CLAW.pit.w, 3)
  for (let y = 0; y < CLAW.pit.h; y++) {
    fill(y % 2 === 0 ? '#8088c8' : '#7880c0', PIT.x, PIT.y + y, CLAW.pit.w, 1)
  }
  for (let y = 6; y < CLAW.pit.h - 3; y += 12) {
    for (let x = (y % 24 === 6 ? 6 : 14); x < CLAW.pit.w - 3; x += 16) fill('#9098d8', PIT.x + x, PIT.y + y, 3, 3)
  }
  // The chute: a hole in the floor with a warning band.
  const cx = PIT.x + CLAW.chute.x
  const cy = PIT.y + CLAW.chute.y
  fill('#f8c830', cx - 14, cy - 11, 28, 21)
  for (let x = -14; x < 12; x += 6) fill('#282030', cx + x, cy - 11, 3, 2)
  fill('#181420', cx - 12, cy - 9, 24, 17)
  fill('#302838', cx - 12, cy - 9, 24, 3)
  // The front ledge and the coin slot.
  fill(FRAME_DARK, PIT.x - 1, 146, CLAW.pit.w + 2, 1)
  fill(FRAME_DARK, 150, 149, 16, 7)
  fill('#f8c830', 151, 150, 14, 5)
  fill(FRAME_DARK, 157, 151, 2, 3)
  bodies.set(w, c)
  return c
}

/** The glass over the pit: two slanted streaks of light. */
const drawGlass = (g: CanvasRenderingContext2D) => {
  g.fillStyle = 'rgba(255,255,255,0.09)'
  for (let i = 0; i < 40; i++) {
    g.fillRect(PIT.x + 18 + i * 1.2, PIT.y - 16 + i * 3, 10, 3)
    g.fillRect(PIT.x + 40 + i * 1.2, PIT.y - 16 + i * 3, 4, 3)
  }
}

const circle = (g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) => {
  g.fillStyle = color
  const steps = Math.max(12, Math.round(r * 8))
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2
    g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1)
  }
}

/** The gantry's row for a claw over floor row `y`: near the back wall it stops under the marquee. */
const beamOf = (y: number) => Math.max(RAIL, Math.round(y - HANG - 6))

/** The gantry and its carriage, behind the plushes. */
const drawGantry = (g: CanvasRenderingContext2D, x: number, y: number) => {
  const beam = beamOf(y)
  g.fillStyle = FRAME_DARK
  g.fillRect(PIT.x, beam, CLAW.pit.w, 3)
  g.fillStyle = '#a0a8c0'
  g.fillRect(PIT.x, beam, CLAW.pit.w, 1)
  g.fillStyle = '#e0a830'
  g.fillRect(x - 6, beam - 2, 12, 6)
}

/** The cable and the head, `open` 0 shut to 1 wide. `hangBy`: how far the head sits above the floor point (x, y). */
const drawClaw = (g: CanvasRenderingContext2D, x: number, y: number, hangBy: number, open: number) => {
  const beam = beamOf(y)
  const hang = Math.min(hangBy, y - beam - 11)
  g.fillStyle = '#60687c'
  g.fillRect(x - 1, beam + 3, 2, Math.max(0, y - hang - beam - 8))
  const head = Math.round(y - hang)
  g.fillStyle = FRAME_DARK
  g.fillRect(x - 6, head - 7, 12, 6)
  g.fillStyle = '#c8d0e0'
  g.fillRect(x - 5, head - 6, 10, 4)
  g.fillStyle = '#ffffff'
  g.fillRect(x - 5, head - 6, 10, 1)
  const spread = Math.round(2 + open * 7)
  for (const side of [-1, 1]) {
    const px = x + side * spread
    g.fillStyle = FRAME_DARK
    g.fillRect(Math.min(x + side, px) - (side < 0 ? 1 : 0), head - 2, Math.abs(px - x) + 2, 3)
    g.fillRect(px - 1, head - 1, 3, 9)
    g.fillRect(px - (side > 0 ? 3 : 0), head + 6, 4, 3)
    g.fillStyle = '#c8d0e0'
    g.fillRect(px, head, 1, 7)
  }
}

/** The bar of `misses` a plush carries, ten slots wide, centered on x. */
const drawPips = (g: CanvasRenderingContext2D, x: number, y: number, misses: number) => {
  const w = CLAW.guarantee * 3 + 1
  const left = Math.round(x - w / 2)
  g.fillStyle = 'rgba(16,20,32,0.8)'
  g.fillRect(left, y, w, 4)
  for (let i = 0; i < CLAW.guarantee; i++) {
    g.fillStyle = i < misses ? (i >= CLAW.guarantee - 3 ? '#f8d030' : '#78e080') : '#404860'
    g.fillRect(left + 1 + i * 3, y + 1, 2, 2)
  }
}

const SIZE = () => arcadeSize(SIZES.tall, SIZES.wide)

let shown: { w: number; h: number } = SIZE()

/** The controls' places on the canvas: the pad's center and the drop button's. */
const controlsOf = ({ w, h: ch }: { w: number; h: number }) => (ch > w ? { pad: { x: 48, y: 208 }, drop: { x: 130, y: 208 } } : { pad: { x: 211, y: 84 }, drop: { x: 274, y: 84 } })

const PAD_R = 40
const DROP_R = 22

const start = (ctx: SoloCtx): GameRun => {
  const size = shown
  const controls = controlsOf(size)
  const m = () => t().minigames.claw
  const panel = h('div', { class: 'claw-panel box hidden' })
  ctx.stage.append(panel)

  let phase: Phase = 'load'
  let phaseT = 0
  let clock = 0
  let view: ClawState | null = null
  let play: ClawPlay | null = null
  let result: ClawDropped | null = null
  let timeLeft: number = CLAW.seconds
  let claw: PitPoint = { ...HOME }
  let drop: PitPoint = { ...HOME }
  let depth = 0
  let opened = 1
  let spots: PitPoint[] = []
  let held: number | null = null
  let gone: number | null = null
  /** The plush the grip just let go of, and how high it was. */
  let slipped: { index: number; from: number } | null = null
  let padHeld = { x: 0, y: 0 }
  let dropHeld = false
  let disposed = false
  const parts: Particle[] = []
  const pops: Popup[] = []

  const go = (next: Phase) => {
    phase = next
    phaseT = 0
  }

  /** Where the plushes stand now, by the misses known and the credit in play. */
  const layoutNow = () => (view ? pitLayout(view.week, view.misses, play?.seed ?? 0) : [])

  const place = (snap: boolean) => {
    const layout = layoutNow()
    spots = snap || spots.length !== layout.length ? layout : spots
  }

  const familyAt = (i: number): PlushFamily | null => view?.prizes[i] ?? null

  const nameOf = (i: number) => {
    const f = familyAt(i)
    return f ? plushForm(f).name : ''
  }

  /** The panel's words and buttons; none hides it. */
  const say = (lines: readonly (HTMLElement | false)[], actions: readonly { label: string; run: () => void }[] = []) => {
    panel.classList.toggle('hidden', lines.length === 0 && actions.length === 0)
    panel.replaceChildren(
      ...lines.flatMap((l) => (l ? [l] : [])),
      ...(actions.length > 0 ? [h('div', { class: 'claw-panel-actions' }, ...actions.map((a) => h('button', { class: 'box', type: 'button', onclick: () => (playSfx('select'), a.run()) }, a.label)))] : []),
    )
  }

  const creditAction = () => {
    if (play) return { label: m().resume, run: resume }
    const price = view ? creditPrice(view.used) : null
    if (price === null) return null
    if (price > loadSave().wallet) return null
    return { label: price === 0 ? m().free : m().paid(formatPokeDollars(price)), run: insert }
  }

  /** The line under a panel: the day's credits, or why there's no credit to buy. */
  const dayLine = () => {
    const price = view ? creditPrice(view.used) : null
    if (price === null) return h('p', {}, m().cap)
    if (!play && price > loadSave().wallet) return h('p', {}, m().funds)
    return h('small', {}, m().today(view?.used ?? 0, CLAW.dailyCap))
  }

  const ready = () => {
    held = null
    gone = null
    place(false)
    go('ready')
    const a = creditAction()
    say([h('h3', {}, m().title), h('p', {}, m().rule(CLAW.guarantee)), dayLine()], a ? [a] : [])
  }

  const trouble = (error: string) => {
    go('ready')
    const text = error === 'cap' ? m().cap : error === 'funds' ? m().funds : error === 'profile' ? m().profile : m().failed
    say([h('p', {}, text)], [{ label: m().retry, run: load }])
  }

  const load = async () => {
    go('load')
    say([])
    const got = await fetchClaw()
    if (disposed) return
    if (isFailure(got)) return trouble(got.error)
    view = got
    play = got.open
    place(true)
    ready()
  }

  const aim = () => {
    claw = { ...HOME }
    timeLeft = CLAW.seconds
    depth = 0
    opened = 1
    held = null
    gone = null
    result = null
    say([])
    go('aim')
  }

  const insert = async () => {
    if (!view) return
    go('busy')
    say([])
    const got = await insertCredit(view.used)
    if (disposed) return
    if (isFailure(got)) return trouble(got.error)
    view = { ...view, used: got.used }
    play = got.play
    playSfx('coin')
    aim()
  }

  const resume = () => aim()

  const dropNow = () => {
    if (!play) return
    const credit = play
    drop = { ...claw }
    go('lower')
    playSfx('move')
    void dropClaw(credit, drop).then((got) => {
      if (disposed) return
      if (isFailure(got)) {
        // The credit stays open: the API never decided it.
        depth = 0
        return trouble(got.error)
      }
      result = got
    })
  }

  /** Moves on once the API answered and the claw is down. */
  const decide = () => {
    if (!result) return
    held = result.target
    opened = 0
    playSfx(result.won ? 'item' : 'hit')
    go('lift')
  }

  /** Applies a drop's answer to the machine: the misses, and the credit spent. */
  const settle = () => {
    if (!view || !result) return
    view = { ...view, misses: result.misses }
    play = null
  }

  const finishMiss = () => {
    if (!result) return
    const n = result.misses[result.target] ?? 0
    go('result')
    const a = creditAction()
    say([h('h3', {}, m().miss(nameOf(result.target))), h('p', {}, n >= CLAW.guarantee - 1 ? m().sure : m().progress(n, CLAW.guarantee)), dayLine()], a ? [a] : [])
  }

  const finishWin = () => {
    if (!result) return
    playSfx('levelUp')
    ctx.brag('plush')
    go('result')
    const a = creditAction()
    say([h('h3', {}, m().won(pieceName(plushPiece(result.family)))), h('p', {}, m().wonNote), dayLine()], a ? [a] : [])
  }

  const step = (dt: number, input: GameInput) => {
    clock += dt
    phaseT += dt
    stepFx(parts, pops, dt)
    padHeld = { x: 0, y: 0 }
    dropHeld = false

    // Plushes ease to where the rules put them (a nudge, a credit's shake).
    const layout = layoutNow()
    spots = spots.map((s, i) => {
      const to = layout[i] ?? s
      return { x: s.x + (to.x - s.x) * Math.min(1, dt * 6), y: s.y + (to.y - s.y) * Math.min(1, dt * 6) }
    })

    switch (phase) {
      case 'aim': {
        for (const p of input.pointers) {
          const dx = p.x - controls.pad.x
          const dy = p.y - controls.pad.y
          if (Math.hypot(dx, dy) <= PAD_R) {
            if (Math.abs(dx) > 10) padHeld.x = Math.sign(dx)
            if (Math.abs(dy) > 10) padHeld.y = Math.sign(dy)
          } else if (p.x >= PIT.x && p.x < PIT.x + CLAW.pit.w && p.y >= PIT.y - 16 && p.y < PIT.y + CLAW.pit.h) {
            const tx = p.x - PIT.x - claw.x
            const ty = p.y - PIT.y - claw.y
            if (Math.abs(tx) > 1) padHeld.x = Math.sign(tx)
            if (Math.abs(ty) > 1) padHeld.y = Math.sign(ty)
          }
          if (Math.hypot(p.x - controls.drop.x, p.y - controls.drop.y) <= DROP_R) dropHeld = true
        }
        if (input.held('ArrowLeft') || input.held('KeyA')) padHeld.x = -1
        if (input.held('ArrowRight') || input.held('KeyD')) padHeld.x = 1
        if (input.held('ArrowUp') || input.held('KeyW')) padHeld.y = -1
        if (input.held('ArrowDown') || input.held('KeyS')) padHeld.y = 1
        const pressedDrop = input.pressed('Space') || input.pressed('Enter') || (input.pointer.pressed && dropHeld)
        const norm = padHeld.x !== 0 && padHeld.y !== 0 ? Math.SQRT1_2 : 1
        claw = {
          x: Math.min(CLAW.pit.w, Math.max(0, claw.x + padHeld.x * norm * SPEED * dt)),
          y: Math.min(CLAW.pit.h, Math.max(0, claw.y + padHeld.y * norm * SPEED * dt)),
        }
        const before = secondsLeft(CLAW.seconds - timeLeft, CLAW.seconds)
        timeLeft -= dt
        const now = secondsLeft(CLAW.seconds - timeLeft, CLAW.seconds)
        if (now !== before && now <= 5 && now > 0) playSfx('tick')
        if (pressedDrop || timeLeft <= 0) dropNow()
        break
      }
      case 'lower':
        depth = Math.min(1, phaseT / TIMES.lower)
        if (phaseT >= TIMES.lower) go('wait')
        break
      case 'wait':
        depth = 1
        decide()
        break
      case 'lift': {
        depth = Math.max(0, 1 - phaseT / TIMES.lift)
        // A miss: the grip gives out halfway up, and the plush lands a step nearer the chute.
        if (result && !result.won && phaseT >= TIMES.lift * 0.5 && held !== null) {
          slipped = { index: held, from: HANG * (1 - depth) - 16 }
          held = null
          settle()
          opened = 0.5
          playSfx('denied')
        }
        if (phaseT >= TIMES.lift) {
          if (result?.won) go('carry')
          else go('slip')
        }
        break
      }
      case 'slip':
        if (phaseT >= TIMES.slip) {
          opened = 1
          claw = { ...HOME }
          slipped = null
          finishMiss()
        }
        break
      case 'carry': {
        const k = Math.min(1, phaseT / TIMES.carry)
        claw = { x: drop.x + (CLAW.chute.x - drop.x) * k, y: drop.y + (CLAW.chute.y - drop.y) * k }
        if (k >= 1) {
          gone = held
          held = null
          opened = 1
          settle()
          go('fall')
          playSfx('unlock')
          burst(parts, PIT.x + CLAW.chute.x, PIT.y + CLAW.chute.y - 4, ['#f8d030', '#ffffff', '#f87898', '#78c8f8'], 40, 90)
        }
        break
      }
      case 'fall':
        if (phaseT >= TIMES.fall) {
          claw = { ...HOME }
          finishWin()
        }
        break
      default:
    }
  }

  const drawPlush = (g: CanvasRenderingContext2D, i: number, x: number, y: number) => {
    const f = familyAt(i)
    if (!f) return
    const art = plushArt(plushForm(f).dex, PLUSH_W)
    if (art) g.drawImage(art, Math.round(x - art.width / 2), Math.round(y - art.height))
  }

  /** The plush the claw would go for now, within reach. */
  const focus = () => {
    if (phase !== 'aim') return null
    let best: number | null = null
    let bestD: number = CLAW.reach
    spots.forEach((s, i) => {
      const d = Math.hypot(claw.x - s.x, claw.y - s.y)
      if (d < bestD) {
        best = i
        bestD = d
      }
    })
    return best
  }

  const drawControls = (g: CanvasRenderingContext2D) => {
    const { pad, drop: btn } = controls
    const key = (dx: number, dy: number, lit: boolean, tri: readonly (readonly [number, number])[]) => {
      const x = pad.x + dx - 11
      const y = pad.y + dy - 11
      g.fillStyle = FRAME_DARK
      g.fillRect(x, y, 22, 22)
      g.fillStyle = lit ? '#f8d030' : '#d8dcec'
      g.fillRect(x + 1, y + 1, 20, 20)
      g.fillStyle = lit ? '#c89818' : '#a8b0c8'
      g.fillRect(x + 1, y + 18, 20, 3)
      g.fillStyle = FRAME_DARK
      for (const [tx, ty] of tri) g.fillRect(pad.x + dx + tx, pad.y + dy + ty, 2, 2)
    }
    const arrow = (ax: number, ay: number) =>
      [0, 1, 2, 3].flatMap((row) => Array.from({ length: row * 2 + 1 }, (_, k) => {
        const along = row * 2 - 4
        const across = (k - row) * 2
        return [ax !== 0 ? ax * -along - 1 : across - 1, ay !== 0 ? ay * -along - 1 : across - 1] as const
      }))
    key(0, -26, padHeld.y < 0, arrow(0, -1))
    key(0, 26, padHeld.y > 0, arrow(0, 1))
    key(-26, 0, padHeld.x < 0, arrow(-1, 0))
    key(26, 0, padHeld.x > 0, arrow(1, 0))
    g.fillStyle = FRAME_DARK
    g.fillRect(pad.x - 11, pad.y - 11, 22, 22)
    g.fillStyle = '#b0b8d0'
    g.fillRect(pad.x - 10, pad.y - 10, 20, 20)
    // The drop button, pressed in while held.
    const down = dropHeld ? 2 : 0
    for (let r = DROP_R; r >= 0; r--) {
      g.fillStyle = r === DROP_R ? FRAME_DARK : r > DROP_R - 4 ? '#a82838' : '#e85048'
      const span = Math.round(Math.sqrt(Math.max(0, DROP_R ** 2 - r ** 2)))
      g.fillRect(btn.x - span, btn.y - r + down, span * 2, 1)
      g.fillRect(btn.x - span, btn.y + r + down, span * 2, 1)
    }
    g.fillStyle = '#ffffff'
    g.fillRect(btn.x - 2, btn.y - 10 + down, 4, 12)
    for (let i = 0; i < 6; i++) g.fillRect(btn.x - 6 + i, btn.y + 2 + i + down, 12 - i * 2, 1)
  }

  const draw = (g: CanvasRenderingContext2D) => {
    g.fillStyle = '#1c1830'
    g.fillRect(0, 0, size.w, size.h)
    g.drawImage(body(size.w), 0, 0)

    const f = focus()
    const screen = (p: PitPoint) => ({ x: Math.round(PIT.x + p.x), y: Math.round(PIT.y + p.y) })
    const order = spots.map((_, i) => i).filter((i) => i !== held && i !== gone).sort((a, b) => spots[a]!.y - spots[b]!.y)
    const here = phase === 'lower' || phase === 'wait' || phase === 'lift' || phase === 'slip' ? drop : claw
    const floor = screen(here)
    drawGantry(g, floor.x, floor.y)

    // What the focused plush asks for: the win zone, its size the rules' own.
    if (f !== null && view) {
      const at = screen(spots[f]!)
      circle(g, at.x, at.y, Math.max(1, CLAW.reach * (1 - gripNeeded(view.misses[f] ?? 0))), '#f8d030')
      circle(g, at.x, at.y, CLAW.reach, 'rgba(255,255,255,0.28)')
    }

    for (const i of order) {
      const at = screen(spots[i]!)
      g.fillStyle = 'rgba(24,20,40,0.35)'
      g.fillRect(at.x - 9, at.y - 1, 18, 3)
      // A plush the grip let go of falls the rest of the way down.
      const fall = slipped?.index === i ? Math.max(0, slipped.from * (1 - (phase === 'lift' ? 0 : Math.min(1, phaseT / 0.25)))) : 0
      drawPlush(g, i, at.x, at.y - Math.round(fall))
      const misses = view?.misses[i] ?? 0
      if (misses > 0 || i === f) drawPips(g, at.x, at.y + 3, misses)
    }

    // The claw's point on the floor, then the claw and whatever it holds.
    const aiming = phase === 'aim'
    if (aiming) {
      g.fillStyle = 'rgba(255,255,255,0.8)'
      g.fillRect(floor.x - 4, floor.y, 3, 1)
      g.fillRect(floor.x + 2, floor.y, 3, 1)
      g.fillRect(floor.x, floor.y - 3, 1, 2)
      g.fillRect(floor.x, floor.y + 2, 1, 2)
    }
    const hang = HANG * (1 - depth) + 6
    if (held !== null) drawPlush(g, held, floor.x, floor.y - hang + 22)
    drawClaw(g, floor.x, floor.y, hang, opened)
    if (phase === 'fall' && gone !== null) {
      const k = Math.min(1, phaseT / TIMES.fall)
      drawPlush(g, gone, PIT.x + CLAW.chute.x, PIT.y + CLAW.chute.y - HANG * (1 - k) * 0.8)
    }
    drawGlass(g)
    drawFx(g, parts, pops)

    // The ledge: the focused plush's name and how close it is.
    if (f !== null && view) {
      const name = nameOf(f).toUpperCase()
      plate(g, 8, 148, textWidth(name) + 8, 9)
      drawText(g, name, 12, 149, '#ffffff')
      const misses = view.misses[f] ?? 0
      drawPips(g, 12 + textWidth(name) + 26, 150, misses)
    }

    if (aiming) {
      const secs = secondsLeft(CLAW.seconds - timeLeft, CLAW.seconds)
      const text = String(secs)
      const cw = textWidth(text) + 12
      plate(g, PIT.x + CLAW.pit.w - cw - 2, 22, cw, 11)
      drawIcon(g, 'clock', PIT.x + CLAW.pit.w - cw, 24)
      drawText(g, text, PIT.x + CLAW.pit.w - cw + 9, 24, secs <= 5 && Math.floor(clock * 4) % 2 === 0 ? '#ff6060' : '#ffffff')
      drawControls(g)
    }
  }

  void load()

  return {
    step,
    draw,
    // A session lasts until it's closed: credits, not rounds.
    over: () => null,
    dispose: () => {
      disposed = true
      panel.remove()
    },
  }
}

/** The Máquina de Pelúcias (`MINIGAMES.claw`); the machine fits the way the phone is held. */
export const claw: SoloGame = {
  get size() {
    return (shown = SIZE())
  },
  start,
}

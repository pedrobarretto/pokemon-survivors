import { playSfx } from '../../engine/audio'
import { fromStrings, lazy } from '../../engine/pixelart'
import type { Dir8 } from '../../engine/math'
import { drawPokemon, loadSpecies, sprites } from '../../render/sprites'
import {
  COUNT_IN,
  arcadeSize,
  burst,
  drawCentered,
  drawCount,
  drawFx,
  drawIcon,
  drawText,
  image,
  partnerDex,
  plate,
  secondsLeft,
  shakeOffset,
  stepFx,
  textWidth,
  type Particle,
  type Popup,
} from './arcadeKit'
import {
  BERRIES,
  BERRY_FEATS,
  BERRY_LIVES,
  BERRY_ROUND,
  berryFeats,
  berryPace,
  comboMult,
  goldenGap,
  pickBerry,
  type BerryKind,
} from './arcadeRules'
import type { GameRun, SoloCtx, SoloGame } from './frame'

/**
 * Berry Rain (`MINIGAMES.berryCatch`), at the arcade's cabinets: the
 * player's partner runs along the bottom catching the berries that fall (the
 * official item art) and dodging the Voltorb that fall with them (one hit
 * blows up and takes a life of three). Drops come faster and denser as the
 * 90 s go by, a golden berry now and then is the jackpot, and catches in a
 * row raise a multiplier that a missed berry drops.
 *
 * Touch: hold anywhere and the partner runs under your finger (drag to steer,
 * tap a side to dash there). Keys: ←/→ or A/D.
 */

const VOLTORB = 100

/** A thing falling: a berry or a Voltorb, its middle at (x, y), `sway` its side-to-side phase. */
type Drop = { kind: BerryKind | 'voltorb'; x: number; y: number; vy: number; sway: number; age: number }

/** A Voltorb's blast on the ground, drawn as an expanding ring. */
type Blast = { x: number; y: number; age: number; big: boolean }

/** The colors a caught berry bursts in. */
const JUICE: Record<BerryKind, readonly string[]> = {
  oran: ['#4878e0', '#90b8f8', '#ffffff'],
  pecha: ['#f8a0b0', '#f8d0d8', '#ffffff'],
  razz: ['#e04040', '#f88878', '#40a040'],
  sitrus: ['#f8d848', '#f8f0a0', '#78b040'],
  golden: ['#f8d030', '#fff8c0', '#ffffff', '#e8a020'],
}

/** The popup's color per berry. */
const TINT: Record<BerryKind, string> = { oran: '#a8c8ff', pecha: '#ffc0d0', razz: '#ff9890', sitrus: '#fff080', golden: '#f8d030' }

/** The arrows that blink beside the partner while counting in: run this way. */
const ARROW = lazy(() => fromStrings(['1...', '11..', '121.', '1221', '121.', '11..', '1...'], { 1: '#283040', 2: '#f8f8f8' }))
const ARROW_L = lazy(() => fromStrings(['1...', '11..', '121.', '1221', '121.', '11..', '1...'], { 1: '#283040', 2: '#f8f8f8' }, { mirror: true }))

/** A small cloud drifting over the sky. */
const CLOUD = lazy(() =>
  fromStrings(['....1111.......', '..11222211.111.', '.12222222212221', '122222222222222', '.1333333333331.', '..11111111111..'], { 1: '#c8d8e8', 2: '#ffffff', 3: '#e0ecf4' }),
)

/** The sky, the hills and the grass a round plays over, painted once per screen size. */
const backdrops = new Map<string, HTMLCanvasElement>()
const backdrop = (w: number, h: number, ground: number) => {
  const key = `${w}x${h}`
  const hit = backdrops.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  const bands = ['#70bce8', '#7cc4ec', '#88ccf0', '#94d4f4', '#a2dcf6', '#b0e4f8']
  const band = Math.ceil(ground / bands.length)
  bands.forEach((col, i) => {
    g.fillStyle = col
    g.fillRect(0, i * band, w, band)
  })
  // Two rows of rolling hills, the far one paler.
  for (const [base, amp, period, col, edge] of [
    [ground - 30, 10, 70, '#9cd488', '#84c070'],
    [ground - 14, 8, 46, '#78c060', '#5ea84c'],
  ] as const) {
    for (let x = 0; x < w; x++) {
      const top = Math.round(base - amp * (0.5 + 0.5 * Math.sin((x / period) * Math.PI * 2 + base)))
      g.fillStyle = edge
      g.fillRect(x, top, 1, 1)
      g.fillStyle = col
      g.fillRect(x, top + 1, 1, ground - top)
    }
  }
  // The grass the partner runs on, then the soil under it.
  g.fillStyle = '#5a9a40'
  g.fillRect(0, ground, w, 2)
  g.fillStyle = '#8fd068'
  g.fillRect(0, ground + 2, w, 4)
  g.fillStyle = '#a88050'
  g.fillRect(0, ground + 6, w, h - ground - 6)
  g.fillStyle = '#8a6038'
  for (let x = 0; x < w; x += 7) g.fillRect(x + ((x * 13) % 5), ground + 9 + ((x * 7) % 6), 2, 1)
  for (let x = 0; x < w; x += 5) {
    g.fillStyle = '#4f8e38'
    g.fillRect(x, ground - 1 - ((x * 3) % 2), 1, 2)
  }
  backdrops.set(key, c)
  return c
}

/** Berry Rain's screen, ×2 on a phone: tall for the falls, wide for the runs. */
const SIZES = { tall: { w: 176, h: 304 }, wide: { w: 256, h: 150 } } as const

/** The size the frame opened the screen at (read once as it opens), which every round started in it plays at. */
let shown = arcadeSize(SIZES.tall, SIZES.wide)

const start = (ctx: SoloCtx): GameRun => {
  const { w, h } = shown
  const ground = h - 18
  const dex = partnerDex(ctx.partner)
  void loadSpecies(dex, ctx.shiny).catch(() => {})
  void loadSpecies(VOLTORB).catch(() => {})
  for (const k of Object.keys(BERRIES)) image(`realm/arcade/berry-${k}`)

  const speed = w * 0.95
  const me = { x: w / 2, vx: 0, facing: 0 as Dir8, hurt: 0, safe: 0, target: null as number | null }
  const drops: Drop[] = []
  const blasts: Blast[] = []
  const parts: Particle[] = []
  const pops: Popup[] = []
  let clock = 0
  let played = 0
  let score = 0
  let lives = BERRY_LIVES
  let combo = 0
  let bestCombo = 0
  let goldens = 0
  let nextDrop = 0.6
  let nextGolden = goldenGap(0)
  let freeze = 0
  let shake = 0
  let flash = 0
  let lastTick = -1
  let ended: number | null = null
  const bragged = new Set<string>()
  const brag = (feat: string) => {
    if (bragged.has(feat)) return
    bragged.add(feat)
    ctx.brag(feat)
  }
  const clouds = Array.from({ length: 4 }, (_, i) => ({ x: (i * w) / 3 + Math.random() * 30, y: 10 + Math.random() * (ground * 0.35), v: 3 + Math.random() * 4 }))

  const spawn = (kind: Drop['kind']) => {
    const margin = 12
    drops.push({ kind, x: margin + Math.random() * (w - margin * 2), y: -12, vy: 0, sway: Math.random() * 6, age: 0 })
  }

  /** The partner's catch box: about its body, a little over its head. */
  const body = () => sprites(dex, ctx.shiny)

  const lose = () => {
    lives -= 1
    combo = 0
    me.hurt = 0.55
    me.safe = 1.5
    freeze = 0.12
    shake = 0.4
    flash = 0.12
    playSfx('explosion')
    playSfx('hurt')
    if (lives <= 0) ended = 0
  }

  const catchBerry = (d: Drop) => {
    const kind = d.kind as BerryKind
    combo += 1
    bestCombo = Math.max(bestCombo, combo)
    const mult = comboMult(combo - 1)
    const pts = BERRIES[kind].points * mult
    score += pts
    burst(parts, d.x, d.y, JUICE[kind], kind === 'golden' ? 22 : 9, kind === 'golden' ? 90 : 60)
    pops.push({ x: d.x, y: d.y - 10, text: `+${pts}`, color: TINT[kind], age: 0, big: kind === 'golden' })
    if (kind === 'golden') {
      goldens += 1
      freeze = 0.08
      playSfx('shiny')
      if (goldens >= 3) brag(BERRY_FEATS.goldRush)
    } else playSfx('pickup')
    if (comboMult(combo) > mult) {
      playSfx('levelUp')
      pops.push({ x: me.x, y: ground - 44, text: `X${comboMult(combo)}`, color: '#f8d030', age: 0, big: true })
    }
    if (combo >= 50) brag(BERRY_FEATS.combo50)
  }

  const step = (dt: number, input: Parameters<GameRun['step']>[1]) => {
    clock += dt
    stepFx(parts, pops, dt)
    for (const b of blasts) b.age += dt
    while (blasts.length && blasts[0]!.age > 0.5) blasts.shift()
    for (const c of clouds) c.x = c.x > w + 20 ? -20 : c.x + c.v * dt
    shake = Math.max(0, shake - dt)
    flash = Math.max(0, flash - dt)
    if (ended !== null) {
      ended += dt
      return
    }
    if (clock < COUNT_IN) {
      if (clock - dt < 0.01 || Math.floor(clock / 0.9) !== Math.floor((clock - dt) / 0.9)) playSfx(clock >= 2.7 ? 'select' : 'tick')
      return
    }
    if (freeze > 0) {
      freeze -= dt
      return
    }
    played += dt
    me.hurt = Math.max(0, me.hurt - dt)
    me.safe = Math.max(0, me.safe - dt)

    // Steering: keys run, a held finger pulls the partner under it.
    const left = input.held('ArrowLeft') || input.held('KeyA')
    const right = input.held('ArrowRight') || input.held('KeyD')
    if (input.pointer.down) me.target = input.pointer.x
    else if (input.pointer.released) me.target = input.pointer.x
    let want = 0
    if (left !== right) {
      me.target = null
      want = right ? speed : -speed
    } else if (me.target !== null) {
      const dx = me.target - me.x
      if (Math.abs(dx) < 2) me.target = input.pointer.down ? me.target : null
      else want = Math.sign(dx) * Math.min(speed, Math.abs(dx) * 12)
    }
    if (me.hurt > 0) want *= 0.3
    me.vx += (want - me.vx) * Math.min(1, dt * 18)
    me.x = Math.min(w - 10, Math.max(10, me.x + me.vx * dt))
    if (Math.abs(me.vx) > 8) me.facing = me.vx > 0 ? 2 : 6
    else if (me.target === null) me.facing = 0

    // Drops: a steady rain that thickens, a golden one now and then.
    const pace = berryPace(played)
    nextDrop -= dt
    if (nextDrop <= 0) {
      nextDrop = pace.every * (0.7 + Math.random() * 0.6)
      spawn(Math.random() < pace.voltorb ? 'voltorb' : pickBerry(Math.random()))
    }
    nextGolden -= dt
    if (nextGolden <= 0) {
      nextGolden = goldenGap(played)
      spawn('golden')
    }

    const s = body()
    const top = ground - s.bodyH - 6
    const fall = pace.fall * h
    let k = 0
    for (const d of drops) {
      d.age += dt
      const pull = d.kind === 'golden' ? 1.25 : d.kind === 'voltorb' ? 0.9 : 1
      d.vy += (fall * pull - d.vy) * Math.min(1, dt * 3)
      d.y += d.vy * dt
      if (d.kind !== 'voltorb') d.x += Math.sin(d.age * 3 + d.sway) * 6 * dt
      if (d.kind === 'golden' && Math.random() < dt * 20) burst(parts, d.x, d.y, ['#fff8c0', '#f8d030'], 1, 10, 0)
      const near = Math.abs(d.x - me.x) < (d.kind === 'voltorb' ? 10 : 14)
      if (d.kind === 'voltorb') {
        if (near && d.y > top + 4 && d.y < ground && me.safe <= 0) {
          blasts.push({ x: d.x, y: d.y, age: 0, big: true })
          burst(parts, d.x, d.y, ['#f8d030', '#f87830', '#ffffff', '#e83838'], 26, 110)
          lose()
          continue
        }
        if (d.y >= ground - 6) {
          blasts.push({ x: d.x, y: ground - 4, age: 0, big: false })
          burst(parts, d.x, ground - 4, ['#f8d030', '#f87830', '#a88050'], 12, 70)
          shake = Math.max(shake, 0.12)
          playSfx('break')
          continue
        }
      } else {
        if (near && d.y > top && d.y < ground - 2) {
          catchBerry(d)
          continue
        }
        if (d.y >= ground) {
          burst(parts, d.x, ground, JUICE[d.kind], 5, 40)
          if (combo >= 5) pops.push({ x: d.x, y: ground - 12, text: '-', color: '#c8c8d0', age: 0, big: false })
          if (combo > 0) playSfx('denied')
          combo = 0
          continue
        }
      }
      drops[k++] = d
    }
    drops.length = k

    const left10 = secondsLeft(played, BERRY_ROUND)
    if (left10 <= 10 && left10 !== lastTick && left10 > 0) {
      lastTick = left10
      playSfx('tick')
    }
    if (played >= BERRY_ROUND) {
      ended = 0
      playSfx('levelUp')
      if (lives === BERRY_LIVES) brag(BERRY_FEATS.flawless)
    }
  }

  const drawDrop = (g: CanvasRenderingContext2D, d: Drop) => {
    if (d.kind === 'voltorb') {
      const v = sprites(VOLTORB)
      // It blinks red faster as it nears the ground.
      const near = Math.max(0, (d.y - ground * 0.5) / (ground * 0.5))
      const blink = near > 0 && Math.floor(clock * (6 + near * 14)) % 2 === 0
      drawPokemon(g, v, 'Idle', 0, clock + d.sway, Math.round(d.x), Math.round(d.y + v.bodyH / 2), blink ? { tint: { color: '#ff3020', amount: 0.55 } } : {})
      return
    }
    const img = image(`realm/arcade/berry-${d.kind}`)
    if (img) drawCentered(g, img, d.x, d.y)
    else {
      g.fillStyle = TINT[d.kind]
      g.fillRect(Math.round(d.x - 5), Math.round(d.y - 5), 10, 10)
    }
  }

  const draw = (g: CanvasRenderingContext2D) => {
    const off = shakeOffset(shake, 3)
    g.save()
    g.translate(off.x, off.y)
    g.drawImage(backdrop(w, h, ground), 0, 0)
    for (const c of clouds) g.drawImage(CLOUD(), Math.round(c.x), Math.round(c.y))

    // The partner's shadow, then the drops' (where each will land), then the partner.
    g.fillStyle = 'rgba(20,40,20,0.3)'
    g.fillRect(Math.round(me.x - 7), ground + 1, 14, 2)
    for (const d of drops) {
      const near = d.y / ground
      if (near < 0.4) continue
      g.fillStyle = d.kind === 'voltorb' ? 'rgba(160,20,10,0.35)' : 'rgba(20,40,20,0.22)'
      const r = Math.round(2 + near * 3)
      g.fillRect(Math.round(d.x - r), ground + 1, r * 2, 2)
    }
    const s = body()
    const blinkOut = me.safe > 0 && me.hurt <= 0 && Math.floor(clock * 12) % 2 === 0
    if (!blinkOut) {
      const moving = Math.abs(me.vx) > 8
      drawPokemon(g, s, me.hurt > 0 ? 'Hurt' : moving ? 'Walk' : 'Idle', me.facing, clock, Math.round(me.x), ground + 2, me.hurt > 0.4 ? { flash: 0.7 } : {})
    }
    for (const d of drops) drawDrop(g, d)
    for (const b of blasts) {
      const r = Math.round((b.big ? 22 : 12) * Math.min(1, b.age / 0.25))
      g.strokeStyle = b.age < 0.15 ? '#ffffff' : '#f8d030'
      g.globalAlpha = Math.max(0, 1 - b.age / 0.5)
      g.lineWidth = 2
      g.strokeRect(Math.round(b.x - r), Math.round(b.y - r * 0.6), r * 2, Math.round(r * 1.2))
      g.globalAlpha = 1
    }
    drawFx(g, parts, pops)
    g.restore()

    // HUD: the score and the combo on the left, the clock in the middle, the lives on the right.
    const score$ = String(score)
    plate(g, 3, 3, textWidth(score$) + 14, 11)
    drawIcon(g, 'star', 5, 5)
    drawText(g, score$, 13, 5, '#ffffff')
    const mult = comboMult(combo)
    if (mult > 1) {
      plate(g, 3, 15, textWidth(`X${mult}`) + 4, 11)
      drawText(g, `X${mult}`, 5, 17, mult >= 4 ? '#f87878' : mult >= 3 ? '#f8a830' : '#f8d030')
    }
    const secs = clock < COUNT_IN ? BERRY_ROUND : secondsLeft(played, BERRY_ROUND)
    const clock$ = String(secs)
    const cw = textWidth(clock$) + 12
    plate(g, Math.round(w / 2 - cw / 2), 3, cw, 11)
    drawIcon(g, 'clock', Math.round(w / 2 - cw / 2) + 2, 5)
    drawText(g, clock$, Math.round(w / 2 - cw / 2) + 10, 5, secs <= 10 && Math.floor(clock * 4) % 2 === 0 ? '#ff6060' : '#ffffff')
    plate(g, w - 4 - BERRY_LIVES * 8 - 2, 3, BERRY_LIVES * 8 + 3, 11)
    for (let i = 0; i < BERRY_LIVES; i++) drawIcon(g, i < lives ? 'heart' : 'empty', w - 4 - (BERRY_LIVES - i) * 8, 5)

    if (clock < COUNT_IN) {
      // Which way to go: arrows blinking either side of the partner.
      if (Math.floor(clock * 3) % 2 === 0) {
        g.drawImage(ARROW_L(), Math.round(me.x - 24), ground - 16)
        g.drawImage(ARROW(), Math.round(me.x + 20), ground - 16)
      }
      drawCount(g, clock, w, h)
    }
    if (flash > 0) {
      g.fillStyle = `rgba(255,255,255,${(flash / 0.12) * 0.6})`
      g.fillRect(0, 0, w, h)
    }
    if (ended !== null) {
      g.fillStyle = `rgba(16,20,32,${Math.min(0.5, ended)})`
      g.fillRect(0, 0, w, h)
      drawText(g, lives <= 0 ? 'KO!' : 'TIME!', w / 2, h / 2 - 10, lives <= 0 ? '#ff6060' : '#f8d030', 'center', 3)
    }
  }

  return {
    step,
    draw,
    over: () => (ended !== null && ended > 1.1 ? { score, feats: berryFeats({ livesLost: BERRY_LIVES - lives, finished: lives > 0, goldens, bestCombo }) } : null),
  }
}

/** Berry Rain at the arcade's cabinets (`MINIGAMES.berryCatch`); its screen fits the way the phone is held. */
export const berryCatch: SoloGame = {
  get size() {
    return (shown = arcadeSize(SIZES.tall, SIZES.wide))
  },
  start,
}

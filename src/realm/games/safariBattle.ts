import type { HatchlingId } from '../../data/hatchlings'
import type { SafariHabitat } from '../../data/safari'
import { safariForm } from '../../data/safari'
import { playCry, playSfx } from '../../engine/audio'
import type { Dir8 } from '../../engine/math'
import { blitEllipse, context2d, createCanvas, fromStrings } from '../../engine/pixelart'
import { formatPokeDollars, t } from '../../i18n'
import type { SafariActed, SafariSession } from '../../net/realmApi'
import { cryUrl, drawPokemon, loadSpecies, sprites } from '../../render/sprites'
import { burst, drawFx, stepFx, type Particle, type Popup } from './arcadeKit'
import type { SafariAction } from './safari.rules'
import { drawGrassWipe, paintBackdrop, paintPlatform, type SafariTheme } from './safariArt'

/**
 * One encounter on the Zona Safári's battle screen: the whole scene, flat
 * backdrop, platforms, sprites, ball and particles, is drawn on one small canvas
 * at the sprites' own pixel size (`Grid`) and blown up by a whole factor, so it
 * reads as one pixel grid. The API has already decided everything: this waits
 * for its answer before any ball settles. Words go through `host`, DOM over
 * the canvas in five languages.
 */

/** CSS px the partner's panel takes above the band, for placing what must stay clear of it. */
const PANEL_CLEAR = 74

/** The solid bottom band's height in CSS px: three rows of commands upright, two sideways. */
export const bandPx = (wide: boolean) => (wide ? 112 : 160)

/** How a canvas splits between the scene and the band. */
export type BattleLayout = { W: number; H: number; wide: boolean; sceneH: number; k: number }

export const layoutBattle = (W: number, H: number, k: number): BattleLayout => {
  const wide = W > H
  return { W, H, wide, sceneH: Math.max(60, H - Math.ceil(bandPx(wide) / k)), k }
}

/**
 * The scene's art resolution: `G` screen pixels per art pixel, and where things
 * stand in art pixels. `tallest` is the taller sprite's body, so a big Pokémon
 * lowers the grid for the whole scene and every sprite stays on it.
 */
type Grid = { G: number; w: number; h: number; wild: { x: number; y: number }; near: { x: number; y: number }; farRx: number; nearRx: number }

const gridOf = (L: BattleLayout, tallest: number): Grid => {
  let G = Math.max(2, Math.min(4, Math.floor(Math.min(L.W / 56, L.sceneH / 40))))
  while (G > 1 && tallest > (L.sceneH / G) * 0.62) G -= 1
  const w = Math.ceil(L.W / G)
  const h = Math.ceil(L.sceneH / G)
  const wide = L.wide
  return {
    G,
    w,
    h,
    // Sideways the partner's panel sits under the wild one: its feet stay above the panel's top edge.
    wild: { x: Math.round(w * (wide ? 0.7 : 0.67)), y: Math.round(wide ? Math.min(h * 0.62, (L.sceneH - PANEL_CLEAR / L.k) / G) : h * 0.56) },
    near: { x: Math.round(w * (wide ? 0.25 : 0.17)), y: h + (wide ? 5 : 4) },
    farRx: Math.min(24, Math.round(w * (wide ? 0.16 : 0.34))),
    nearRx: Math.min(36, Math.round(w * (wide ? 0.25 : 0.58))),
  }
}

/* The ball and the berry at scene resolution: this game's own, not the items' art. */
/** The bottom band's color, `--sz-edge` in the stylesheet. */
const BAND_COLOR = '#283040'

const BALL_ROWS = ['...ooooo...', '.oogdygdoo.', '.oyggdggyo.', 'ogdgygdgdgo', 'ogygdgygygo', 'ooooowooooo', 'owwwobowwwo', '.owwwwwwwo.', '.owlwwwlwo.', '..oollloo..', '....ooo....'] as const
const BALL_COLORS = { o: '#20242c', g: '#58a040', d: '#2e6a34', y: '#d0b850', w: '#f4f4f4', l: '#c4c8d0', b: '#f8e080' } as const
const BERRY_ROWS = ['...g...', '..gg...', '.rrrrr.', 'rrprrrr', 'rrrrrrd', 'rrrrrrd', '.rrrrd.', '..rrd..'] as const
const BERRY_COLORS = { g: '#3e8a38', r: '#e0486a', p: '#ffb8c8', d: '#a82c50' } as const

const TIMES = { open: 0.55, silhouette: 0.35, flash: 0.22, sendOut: 0.55, fly: 0.62, recoil: 0.16, absorb: 0.52, drop: 0.62, settle: 0.32, wobble: 0.62, wobbleRest: 0.34, click: 1.15, breakOut: 0.5, toss: 0.55, eat: 1.5, flee: 0.85, away: 0.7, sceneRise: 0.8, calmed: 0.9, repeat: 1.5 } as const

type Phase = 'open' | 'silhouette' | 'flash' | 'sendOut' | 'menu' | 'fly' | 'recoil' | 'absorb' | 'drop' | 'settle' | 'wait' | 'wobble' | 'click' | 'repeat' | 'breakOut' | 'toss' | 'eat' | 'calmed' | 'flee' | 'away' | 'scene' | 'done'

/** What the battle needs from the shell: words, the menu, the API and how it ended. */
export type BattleHost = {
  say: (text: string) => void
  typed: () => boolean
  menu: (on: boolean) => void
  panels: (show: boolean) => void
  calm: (n: number) => void
  send: (action: SafariAction, then: (got: SafariActed) => void) => void
  /** A catch came back: lands the gift; answers how it was received. */
  land: (got: SafariActed) => { fresh: boolean; refund: number; shiny: boolean }
  brag: (feat: string) => void
  /** The encounter is over. */
  end: () => void
  /** A new family's moment wants its button. */
  sceneButton: (show: boolean) => void
}

const easeOut = (k: number) => 1 - (1 - k) ** 3
const easeIn = (k: number) => k * k * k

export type Battle = ReturnType<typeof createBattle>

/**
 * Starts a battle. `session` must hold the encounter. `resumed`: picked up from
 * a session left open, so nothing plays before the menu.
 */
export const createBattle = (opts: { habitat: SafariHabitat; theme: SafariTheme; family: HatchlingId; shiny: boolean; session: SafariSession; partnerDex: number; partnerShiny: boolean; host: BattleHost; resumed: boolean }) => {
  const { theme, family, shiny, partnerDex, partnerShiny, host } = opts
  const form = safariForm(family)
  const m = () => t().minigames.safari
  const name = form.name
  let phase: Phase = 'open'
  let phaseT = 0
  let clock = 0
  let reply: SafariActed | null = null
  let shakesDone = 0
  let shakeAt = 0
  let ballX = 0
  let ballY = 0
  let flash = 0
  let squash = 0
  let wildHidden = false
  let berry: { x: number; y: number } | null = null
  let sceneShiny = false
  const parts: Particle[] = []
  const pops: Popup[] = []

  /* The scene's canvases, remade when the layout changes. */
  let grid: Grid | null = null
  let gridKey = ''
  let art: HTMLCanvasElement | null = null
  let backdrop: HTMLCanvasElement | null = null
  let farPlatform: HTMLCanvasElement | null = null
  let nearPlatform: HTMLCanvasElement | null = null
  const ballArt = fromStrings(BALL_ROWS, BALL_COLORS)
  const berryArt = fromStrings(BERRY_ROWS, BERRY_COLORS)

  void loadSpecies(form.dex, shiny).catch(() => {})
  void loadSpecies(partnerDex, partnerShiny).catch(() => {})

  const go = (next: Phase) => {
    phase = next
    phaseT = 0
  }

  const wild = () => sprites(form.dex, shiny)
  const near = () => sprites(partnerDex, partnerShiny)

  /** The grid for this layout and these sprites, its canvases remade when either changes. */
  const gridFor = (L: BattleLayout): Grid => {
    const tallest = Math.max(wild().bodyH, near().bodyH)
    const key = `${L.W}x${L.H}:${L.sceneH}:${tallest}`
    if (grid && key === gridKey) return grid
    gridKey = key
    grid = gridOf(L, tallest)
    for (const c of [art, backdrop, farPlatform, nearPlatform]) if (c) c.width = 0
    art = createCanvas(grid.w, grid.h)
    backdrop = paintBackdrop(grid.w, grid.h, theme.scene)
    farPlatform = paintPlatform(grid.farRx, Math.max(3, Math.round(grid.farRx * 0.3)), theme.scene)
    nearPlatform = paintPlatform(grid.nearRx, Math.max(4, Math.round(grid.nearRx * 0.3)), theme.scene)
    return grid
  }

  const toMenu = () => {
    go('menu')
    host.say(m().what(name))
    host.panels(true)
    host.menu(true)
  }

  const finish = () => {
    go('done')
    host.menu(false)
    host.end()
  }

  if (opts.resumed) toMenu()
  else host.say('')

  /* ---------------- What the player does ---------------- */

  const playerAct = (action: SafariAction, text: string, sfx: 'safariThrow' | 'escaped', next: Phase) => {
    reply = null
    host.menu(false)
    host.say(text)
    playSfx(sfx)
    host.send(action, (got) => {
      reply = got
      opts.session = got.session
    })
    go(next)
  }

  const throwBall = () => {
    if (phase === 'menu' && opts.session.balls > 0) playerAct({ kind: 'ball' }, m().threw, 'safariThrow', 'fly')
  }

  const giveBerry = () => {
    if (phase === 'menu' && opts.session.berries > 0) playerAct({ kind: 'berry' }, m().gave(name), 'safariThrow', 'toss')
  }

  const run = () => {
    if (phase === 'menu') playerAct({ kind: 'leave' }, m().ran, 'escaped', 'away')
  }

  /* ---------------- Time ---------------- */

  /** A burst in art pixels: the same screen speed whatever the grid. */
  const puff = (A: Grid, x: number, y: number, colors: readonly string[], n: number, speed: number, gravity: number) => burst(parts, x, y, colors, n, speed / A.G, gravity / A.G)

  const breakOut = (A: Grid) => {
    go('breakOut')
    wildHidden = false
    flash = 1
    playSfx('safariBreak')
    puff(A, A.wild.x, A.wild.y - 10, ['#ffffff', '#ff9090', '#ffe0a0'], 22, 120, 120)
    if (reply?.turn.kind === 'ball') {
      const { shakes } = reply.turn
      host.say(shakes === 0 ? m().broke0 : shakes === 1 ? m().broke1 : m().broke2)
    }
  }

  const startFlee = (A: Grid) => {
    go('flee')
    playSfx('safariFlee')
    puff(A, A.wild.x, A.wild.y - 2, [theme.scene.platform[1], theme.scene.platform[0]], 12, 60, 140)
    host.say(m().fled(name))
    host.panels(false)
  }

  const landCatch = (got: SafariActed) => {
    const out = host.land(got)
    if (out.fresh) {
      sceneShiny = out.shiny
      go('scene')
      flash = 1
      parts.length = 0
      playCry(cryUrl(form.dex), 0.5)
      playSfx(out.shiny ? 'shiny' : 'unlock')
      host.brag(out.shiny ? 'shiny' : 'caught')
      host.panels(false)
      host.say(out.shiny ? m().joinedShiny(name) : m().joined(name))
      host.sceneButton(true)
      return
    }
    host.say(out.refund > 0 ? m().repeat(name, formatPokeDollars(out.refund)) : m().repeatNone)
    go('repeat')
  }

  const step = (dt: number, L: BattleLayout) => {
    clock += dt
    phaseT += dt
    flash = Math.max(0, flash - dt * 3.2)
    squash = Math.max(0, squash - dt * 5)
    stepFx(parts, pops, dt)
    const A = gridFor(L)
    const target = { x: A.wild.x, y: A.wild.y - Math.max(8, Math.round(wild().bodyH * 0.55)) }
    const start = { x: A.near.x + 8, y: A.near.y - Math.max(16, Math.round(near().bodyH * 0.9)) }
    const onGround = A.wild.y - 4
    switch (phase) {
      case 'open':
        if (phaseT >= TIMES.open) go('silhouette')
        break
      case 'silhouette':
        if (phaseT >= TIMES.silhouette) {
          go('flash')
          flash = 1
          playCry(cryUrl(form.dex), 0.45)
          if (shiny) {
            playSfx('shiny')
            puff(A, A.wild.x, target.y, ['#ffffff', '#fff0a0', '#a8f0ff', '#ffb8e8'], 34, 95, 30)
          }
          host.say(opts.session.encounter?.sure ? m().wildSure(name) : shiny ? m().wildShiny(name) : m().wild(name))
          host.panels(true)
        }
        break
      case 'flash':
        if (phaseT >= TIMES.flash && host.typed()) {
          go('sendOut')
          playSfx('leap')
        }
        break
      case 'sendOut':
        if (phaseT >= TIMES.sendOut) {
          squash = 1
          playSfx('thud')
          puff(A, A.near.x, A.h - 3, [theme.scene.platform[1], theme.scene.ground[0]], 12, 50, 180)
          toMenu()
        }
        break
      case 'fly': {
        const k = Math.min(1, phaseT / TIMES.fly)
        ballX = start.x + (target.x - start.x) * k
        ballY = start.y + (target.y - start.y) * k - Math.sin(k * Math.PI) * Math.round(A.h * 0.3)
        if (phaseT >= TIMES.fly) {
          flash = 0.6
          playSfx('pokeballOpen')
          puff(A, target.x, target.y, ['#ffffff', '#ffe080', '#a0e8ff'], 22, 110, 90)
          go('recoil')
        }
        break
      }
      case 'recoil': {
        const k = phaseT / TIMES.recoil
        ballX = target.x - 4 * k
        ballY = target.y - 6 * Math.sin(k * Math.PI * 0.6)
        if (phaseT >= TIMES.recoil) go('absorb')
        break
      }
      case 'absorb':
        if (phaseT >= TIMES.absorb) {
          wildHidden = true
          playSfx('safariSnap')
          go('drop')
        }
        break
      case 'drop': {
        // Three hops down onto the platform, each lower than the last.
        const k = Math.min(1, phaseT / TIMES.drop)
        const top = target.y - 6
        const hops = [0, 0.5, 0.78, 1]
        const i = k < hops[1]! ? 0 : k < hops[2]! ? 1 : 2
        const local = (k - hops[i]!) / (hops[i + 1]! - hops[i]!)
        ballX = target.x - 4 + Math.round(k * 4)
        ballY = i === 0 ? top + (onGround - top) * local * local : onGround - Math.sin(local * Math.PI) * (i === 1 ? 7 : 3)
        if (phaseT >= TIMES.drop) {
          ballY = onGround
          ballX = target.x
          playSfx('safariBounce')
          go('settle')
        }
        break
      }
      case 'settle':
        ballX = target.x
        ballY = onGround
        if (phaseT >= TIMES.settle) go('wait')
        break
      case 'wait':
        ballX = target.x
        ballY = onGround
        if (reply?.turn.kind === 'ball') {
          shakesDone = 0
          shakeAt = 0
          go('wobble')
          playSfx('safariWobble')
        }
        break
      case 'wobble': {
        if (reply?.turn.kind !== 'ball') break
        const { shakes } = reply.turn
        const each = TIMES.wobble + TIMES.wobbleRest
        if (shakes === 0) {
          if (phaseT >= TIMES.wobbleRest) breakOut(A)
          break
        }
        if (phaseT - shakeAt >= each) {
          shakesDone += 1
          shakeAt = phaseT
          if (shakesDone < shakes) playSfx('safariWobble')
        }
        if (shakesDone >= shakes && phaseT - shakeAt >= TIMES.wobbleRest * 0.6) {
          if (reply.turn.caught) {
            go('click')
            playSfx('safariClick')
            puff(A, A.wild.x, A.wild.y - 6, ['#ffe080', '#ffffff', '#f8c030'], 26, 90, 120)
            host.say(reply.turn.shiny ? m().caughtShiny(name) : m().caught(name))
          } else breakOut(A)
        }
        break
      }
      case 'click':
        if (phaseT >= TIMES.click && reply && host.typed()) landCatch(reply)
        break
      case 'breakOut':
        if (phaseT >= TIMES.breakOut && host.typed() && reply?.turn.kind === 'ball') {
          if (reply.turn.fled) startFlee(A)
          else if (opts.session.over) finish()
          else toMenu()
        }
        break
      case 'toss': {
        const k = Math.min(1, phaseT / TIMES.toss)
        ballX = start.x + (A.wild.x - 10 - start.x) * k
        ballY = start.y + (A.wild.y - 2 - start.y) * k - Math.sin(k * Math.PI) * Math.round(A.h * 0.24)
        if (phaseT >= TIMES.toss && reply?.turn.kind === 'berry') {
          berry = { x: A.wild.x - 10, y: A.wild.y - 2 }
          host.say(m().eating(name))
          playSfx('safariMunch')
          go('eat')
        }
        break
      }
      case 'eat':
        if (reply?.turn.kind !== 'berry') break
        if (Math.floor(phaseT * 4) !== Math.floor((phaseT - dt) * 4)) {
          playSfx('safariMunch', 200)
          puff(A, A.wild.x - 8, A.wild.y - 4, ['#f07088', '#ffd0d8'], 4, 40, 200)
        }
        if (phaseT >= TIMES.eat && host.typed()) {
          berry = null
          host.calm(reply.turn.calm)
          for (let i = 0; i < 3; i++) pops.push({ x: A.wild.x - 5 + i * 5, y: A.wild.y - Math.round(wild().bodyH) - 4 - i * 2, text: '+', color: '#ff90b0', age: -i * 0.15, big: false })
          if (reply.turn.fled) startFlee(A)
          else if (opts.session.over) finish()
          else {
            host.say(m().calmer(name))
            go('calmed')
          }
        }
        break
      case 'calmed':
        if (phaseT >= TIMES.calmed && host.typed()) toMenu()
        break
      case 'repeat':
        if (phaseT >= TIMES.repeat && host.typed()) finish()
        break
      case 'flee':
        if (phaseT >= TIMES.flee && host.typed()) finish()
        break
      case 'away':
        if (phaseT >= TIMES.away && reply && host.typed()) finish()
        break
      case 'scene':
        if (Math.random() < dt * 20) puff(A, A.w / 2 + (Math.random() * 40 - 20), A.h * 0.5 - Math.random() * 30, sceneShiny ? ['#ffffff', '#ffe878', '#a8f0ff', '#ffa8e0'] : ['#ffe888', '#ffffff'], 2, 26, -20)
        break
      default:
    }
  }

  /* ---------------- The scene, on the small canvas ---------------- */

  const drawWild = (g: CanvasRenderingContext2D, A: Grid, ox: number, sil: boolean) => {
    if (wildHidden) return
    const s = wild()
    const dir: Dir8 = 7
    const x = A.wild.x + ox
    const y = A.wild.y
    if (phase === 'absorb') {
      const k = Math.min(1, phaseT / TIMES.absorb)
      const shrink = 1 - easeIn(k)
      if (shrink <= 0.04) return
      drawPokemon(g, s, 'Idle', dir, clock, x, y - Math.round((1 - shrink) * Math.max(7, s.bodyH * 0.5)), { scale: shrink, flash: 1, alpha: 0.9 })
      return
    }
    if (phase === 'flee') {
      const k = Math.min(1, phaseT / TIMES.flee)
      drawPokemon(g, s, 'Walk', 2, clock * 2.2, x + k * k * (A.w + 20 - A.wild.x), y - Math.abs(Math.sin(k * 12)) * 3)
      return
    }
    const bob = phase === 'eat' ? Math.round(Math.abs(Math.sin(phaseT * 11)) * 2) : 0
    drawPokemon(g, s, 'Idle', dir, clock, x, y - bob, sil ? { tint: { color: '#141c28', amount: 1 } } : { flash: phase === 'breakOut' ? Math.max(0, 1 - phaseT / 0.25) : 0 })
  }

  const drawNear = (g: CanvasRenderingContext2D, A: Grid, ox: number) => {
    if (phase === 'open' || phase === 'silhouette' || phase === 'flash') return
    const s = near()
    let x = A.near.x + ox
    let y = A.near.y
    if (phase === 'sendOut') {
      const k = Math.min(1, phaseT / TIMES.sendOut)
      x -= Math.round((1 - easeOut(k)) * 26)
      y += Math.round((1 - k) * 14 - Math.sin(k * Math.PI) * 18)
    }
    if (phase === 'away') {
      const k = Math.min(1, phaseT / TIMES.away)
      drawPokemon(g, s, 'Walk', 6, clock, x - Math.round(k * k * 50), y)
      return
    }
    drawPokemon(g, s, 'Idle', 4, clock, x, y + (squash > 0.3 ? 1 : 0))
  }

  const drawBall = (g: CanvasRenderingContext2D, x: number, y: number, tilt: number, open: number) => {
    const cx = Math.round(x)
    const cy = Math.round(y)
    if (phase !== 'fly') blitEllipse(g, 4, 1, 'rgba(16,20,30,0.3)', cx, cy + 6)
    g.save()
    g.translate(cx, cy)
    g.rotate(tilt)
    if (open <= 0) g.drawImage(ballArt, -5, -5)
    else {
      // Open: the top half lifted on a hinge at the back.
      g.save()
      g.translate(-5, 0)
      g.rotate(-open * 0.9)
      g.drawImage(ballArt, 0, 0, 11, 5, 0, -5, 11, 5)
      g.restore()
      g.drawImage(ballArt, 0, 5, 11, 6, -5, 0, 11, 6)
    }
    g.restore()
  }

  /** The new family's moment: dark over the scene, a fan of rays, the Pokémon up close. */
  const drawFreshScene = (g: CanvasRenderingContext2D, A: Grid) => {
    const rise = easeOut(Math.min(1, phaseT / TIMES.sceneRise))
    g.fillStyle = 'rgba(8,10,24,0.86)'
    g.fillRect(0, 0, A.w, A.h)
    const cx = Math.round(A.w / 2)
    const cy = Math.round(A.h * 0.66)
    const spin = clock * 0.35
    g.fillStyle = sceneShiny ? '#6a6236' : '#544a26'
    const R = Math.max(A.w, A.h)
    for (let i = 0; i < 10; i++) {
      const a = spin + (i / 10) * Math.PI * 2
      g.beginPath()
      g.moveTo(cx, cy)
      g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
      g.lineTo(cx + Math.cos(a + 0.18) * R, cy + Math.sin(a + 0.18) * R)
      g.closePath()
      g.fill()
    }
    blitEllipse(g, 16, 4, sceneShiny ? '#f8e088' : '#e8c868', cx, cy + 2)
    blitEllipse(g, 11, 2, '#fff4c4', cx, cy + 2)
    drawPokemon(g, wild(), 'Idle', 0, clock, cx, Math.round(cy - (1 - rise) * 8), { scale: A.G >= 3 ? 1 : 2, flash: phaseT < 0.2 ? 1 - phaseT / 0.2 : 0 })
  }

  const draw = (g: CanvasRenderingContext2D, L: BattleLayout) => {
    if (phase === 'done' || !art) return gridFor(L) && undefined
    const A = gridFor(L)
    const c = context2d(art!)
    let ox = 0
    // The camera leans toward what the ball is doing.
    if (phase === 'fly' || phase === 'recoil' || phase === 'absorb') ox = -Math.round(Math.min(1, phaseT / 0.35) * 3)
    else if (phase === 'wobble' || phase === 'wait' || phase === 'drop' || phase === 'settle' || phase === 'click' || phase === 'repeat') ox = -3
    c.drawImage(backdrop!, 0, 0)

    const pull = phase === 'open' ? 1 - easeOut(Math.min(1, phaseT / TIMES.open)) : 0
    const far = farPlatform!
    const nearOval = nearPlatform!
    c.drawImage(far, Math.round(A.wild.x - far.width / 2 + ox - pull * 40), A.wild.y - Math.floor(far.height / 2))
    const silhouetted = phase === 'open' || phase === 'silhouette'
    drawWild(c, A, Math.round(ox - pull * 40), silhouetted)

    c.drawImage(nearOval, Math.round(A.near.x - nearOval.width / 2 + ox + pull * 40), A.near.y - Math.floor(nearOval.height / 2))
    drawNear(c, A, ox)

    // A shiny keeps twinkling while it's on the field.
    if (shiny && !wildHidden && phase !== 'open' && phase !== 'silhouette' && phase !== 'flee') {
      c.fillStyle = '#fff8c8'
      for (let i = 0; i < 4; i++) {
        const a = clock * 1.8 + (i / 4) * Math.PI * 2
        const r = 13 + Math.sin(clock * 3 + i) * 3
        const sx = Math.round(A.wild.x + ox + Math.cos(a) * r)
        const sy = Math.round(A.wild.y - 12 + Math.sin(a) * r * 0.7)
        if (Math.sin(clock * 9 + i * 2) > 0) {
          c.fillRect(sx - 1, sy, 3, 1)
          c.fillRect(sx, sy - 1, 1, 3)
        } else c.fillRect(sx, sy, 1, 1)
      }
    }

    if (phase === 'fly') drawBall(c, ballX, ballY, clock * 16, 0)
    if (phase === 'recoil') drawBall(c, ballX, ballY, 0, phaseT / TIMES.recoil)
    if (phase === 'absorb') {
      const k = Math.min(1, phaseT / TIMES.absorb)
      // A narrow beam from the Pokémon up into the open ball.
      const w = Math.max(1, Math.round(1 + 2 * (1 - k)))
      c.globalAlpha = 0.85
      c.fillStyle = '#ffffff'
      c.fillRect(A.wild.x + ox - w, ballY - 1, w * 2, Math.max(3, A.wild.y - ballY))
      c.globalAlpha = 1
      drawBall(c, ballX + ox, ballY - 6, 0, 1 - k * 0.2)
    }
    if (phase === 'drop') drawBall(c, ballX + ox, ballY, Math.sin(phaseT * 18) * 0.25, 0)
    if (phase === 'settle' || phase === 'wait') drawBall(c, ballX + ox, ballY, 0, 0)
    if (phase === 'wobble' || phase === 'click' || phase === 'repeat') {
      let tilt = 0
      if (phase === 'wobble' && reply?.turn.kind === 'ball') {
        const since = phaseT - shakeAt
        if (shakesDone < reply.turn.shakes && since < TIMES.wobble) tilt = Math.sin((since / TIMES.wobble) * Math.PI * 2) * 0.55
      }
      drawBall(c, ballX + ox, ballY, tilt, 0)
    }
    if ((phase === 'toss' && phaseT < TIMES.toss) || berry) {
      const bx = berry ? berry.x : ballX
      const by = berry ? berry.y : ballY
      const cut = berry ? Math.round(Math.min(1, phaseT / TIMES.eat) * berryArt.height) : 0
      if (cut < berryArt.height) c.drawImage(berryArt, 0, cut, berryArt.width, berryArt.height - cut, Math.round(bx - berryArt.width / 2) + ox, Math.round(by - berryArt.height / 2) + cut, berryArt.width, berryArt.height - cut)
    }

    if (phase === 'scene') drawFreshScene(c, A)

    drawFx(c, parts, pops)

    if (flash > 0) {
      c.globalAlpha = Math.min(1, flash)
      c.fillStyle = '#ffffff'
      c.fillRect(0, 0, A.w, A.h)
      c.globalAlpha = 1
    }

    if (phase === 'open') drawGrassWipe(c, A.w, A.h, 1 - easeOut(Math.min(1, phaseT / TIMES.open)), theme, 3)

    // The scene, blown up onto the real canvas, stopping at the band's top edge. Under the band the canvas is the band's color, in case a pixel of it shows.
    g.fillStyle = BAND_COLOR
    g.fillRect(0, L.sceneH, L.W, L.H - L.sceneH)
    g.drawImage(art!, 0, 0, A.w, A.h, 0, 0, A.w * A.G, A.h * A.G)
  }

  return {
    step,
    draw,
    throwBall,
    giveBerry,
    run,
    phase: () => phase,
    /** The new family's scene was acknowledged. */
    closeScene: () => {
      if (phase !== 'scene') return
      host.sceneButton(false)
      finish()
    },
    release: () => {
      for (const c of [art, backdrop, farPlatform, nearPlatform]) if (c) c.width = 0
      art = backdrop = farPlatform = nearPlatform = null
      grid = null
      gridKey = ''
    },
  }
}

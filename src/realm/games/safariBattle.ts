import type { HatchlingId } from '../../data/hatchlings'
import type { SafariHabitat } from '../../data/safari'
import { safariForm } from '../../data/safari'
import { playCry, playSfx } from '../../engine/audio'
import type { Dir8 } from '../../engine/math'
import { blitEllipse, createCanvas, context2d } from '../../engine/pixelart'
import { cryUrl, drawPokemon, loadSpecies, sprites, type SpeciesSprites } from '../../render/sprites'
import { formatPokeDollars, t } from '../../i18n'
import type { SafariActed, SafariSession } from '../../net/realmApi'
import { burst, drawFx, image, stepFx, type Particle, type Popup } from './arcadeKit'
import type { SafariAction } from './safari.rules'
import { GRASS_CELL, GRASS_VARIANTS, bakeGrass, drawGrassWipe, type SafariTheme } from './safariArt'

/**
 * One encounter on the Zona Safári's battle screen: a composed scene (a far
 * platform with the wild Pokémon facing the camera, the partner from behind on
 * a near one, the habitat's backdrop, the grass in front) and its animation.
 * The API has already decided everything: this waits for its answer before any
 * ball settles. Words go through `host`, DOM over the canvas in five languages.
 */

/** Where things stand for a canvas of this shape. */
const BACKDROP = { horizon: 118, w: 456, h: 252 } as const

export type BattleLayout = { W: number; H: number; wide: boolean; sceneW: number; sceneH: number; wild: { x: number; y: number }; near: { x: number; y: number }; backY: number; moundY: number }

export const layoutBattle = (W: number, H: number): BattleLayout => {
  const wide = W > H
  if (wide) {
    const sceneW = W - Math.round(Math.min(112, W * 0.28))
    const sceneH = H - 40
    return { W, H, wide, sceneW, sceneH, wild: { x: Math.round(sceneW * 0.7), y: Math.round(sceneH * 0.66) }, near: { x: Math.round(sceneW * 0.24), y: Math.round(sceneH * 0.98) }, backY: Math.round(sceneH * 0.32 - BACKDROP.horizon), moundY: Math.round(sceneH * 0.82) }
  }
  const sceneH = H - 104
  return { W, H, wide, sceneW: W, sceneH, wild: { x: Math.round(W * 0.66), y: Math.round(sceneH * 0.47) }, near: { x: Math.round(W * 0.3), y: Math.round(sceneH * 0.97) }, backY: Math.min(0, Math.round(sceneH * 0.74) - BACKDROP.h), moundY: Math.round(sceneH * 0.74) }
}

const TIMES = { open: 0.55, silhouette: 0.35, flash: 0.22, sendOut: 0.55, fly: 0.62, recoil: 0.16, absorb: 0.52, drop: 0.62, settle: 0.32, wobble: 0.62, wobbleRest: 0.34, click: 1.15, breakOut: 0.5, toss: 0.55, eat: 1.5, flee: 0.85, away: 0.7, sceneRise: 0.8, calmed: 0.9, repeat: 1.5 } as const

type Phase = 'open' | 'silhouette' | 'flash' | 'sendOut' | 'menu' | 'fly' | 'recoil' | 'absorb' | 'drop' | 'settle' | 'wait' | 'wobble' | 'click' | 'repeat' | 'breakOut' | 'toss' | 'eat' | 'calmed' | 'flee' | 'away' | 'scene' | 'done'

/** What the battle needs from the shell: words, the menu, the API and how it ended. */
export type BattleHost = {
  say: (text: string) => void
  typed: () => boolean
  menu: (on: boolean) => void
  tags: (show: boolean) => void
  calm: (n: number) => void
  send: (action: SafariAction, then: (got: SafariActed) => void) => void
  /** A catch came back: lands the gift; answers how it was received. */
  land: (got: SafariActed) => { fresh: boolean; refund: number; shiny: boolean }
  brag: (feat: string) => void
  /** The encounter is over (`caught`: it ended in a catch). */
  end: () => void
  /** A new family's moment wants its button. */
  sceneButton: (show: boolean) => void
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const

const easeOut = (k: number) => 1 - (1 - k) ** 3
const easeIn = (k: number) => k * k * k

/** A far or near mound of the habitat's ground, drawn once: a body, a lit top, a dithered rim and tufts. */
const bakePlatform = (theme: SafariTheme, rx: number, ry: number, seed: number) => {
  const w = rx * 2 + 8
  const h = ry * 2 + 14
  const c = createCanvas(w, h)
  const g = context2d(c)
  const cx = w / 2
  const cy = ry + 8
  // The mound's side, then its top in the ground's ramp, lighter toward the middle.
  blitEllipse(g, rx + 2, ry + 3, theme.fore[0], cx, cy + 3)
  blitEllipse(g, rx, ry, theme.fore[1], cx, cy)
  blitEllipse(g, Math.round(rx * 0.8), Math.round(ry * 0.74), theme.fore[2], cx, cy - 1)
  blitEllipse(g, Math.round(rx * 0.5), Math.round(ry * 0.46), theme.fore[3], cx, cy - 2)
  let s = seed
  const next = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  for (let i = 0; i < rx; i++) {
    const a = next() * Math.PI * 2
    const r = 0.25 + next() * 0.72
    const x = Math.round(cx + Math.cos(a) * rx * r)
    const y = Math.round(cy + Math.sin(a) * ry * r)
    g.fillStyle = next() < 0.5 ? theme.tall[1] : theme.tall[2]
    g.fillRect(x, y, 1, 2)
    g.fillRect(x + 2, y + 1, 1, 2)
  }
  // Tufts along the front rim, so the mound sits in the grass and doesn't float.
  for (let i = 0; i < rx * 1.4; i++) {
    const a = Math.PI * (0.06 + next() * 0.88)
    const x = Math.round(cx + Math.cos(a) * (rx + 1))
    const y = Math.round(cy + Math.sin(a) * (ry + 1))
    const tall = 3 + Math.floor(next() * 5)
    g.fillStyle = theme.tall[1 + Math.floor(next() * 2)]!
    g.fillRect(x, y - tall, 1, tall + 3)
    g.fillStyle = theme.tall[3]
    g.fillRect(x, y - tall, 1, 1)
  }
  return c
}

/**
 * The ground the partner stands on, as wide as the canvas: a hillside whose
 * crest wanders across the scene and runs to the bottom of it, dithered from
 * dark to light and dotted with tufts, so the near side reads as closer.
 */
const bakeNearGround = (theme: SafariTheme, w: number, h: number) => {
  const c = createCanvas(w, h)
  const g = context2d(c)
  let s = 31
  const next = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  // The crest wanders enough to read as a rise in the land rather than a seam.
  const crest = new Int16Array(w)
  for (let x = 0; x < w; x++) crest[x] = Math.round(16 + Math.sin(x * 0.016 + 0.6) * 12 + Math.sin(x * 0.07 + 1) * 3)
  for (let x = 0; x < w; x++) {
    for (let y = crest[x]!; y < h; y++) {
      const d = y - crest[x]!
      const n = (Math.sin(x * 0.05 + y * 0.03) + Math.sin(y * 0.11 - x * 0.021) + Math.sin(x * 0.019 + y * 0.17)) / 3
      const dither = (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16 - 0.5
      const lit = d < 2 ? 3 : Math.max(0, Math.min(3, Math.floor(1.8 - d / 110 + n * 1.3 + dither * 0.9)))
      g.fillStyle = theme.fore[lit]!
      g.fillRect(x, y, 1, 1)
    }
  }
  // Tufts along the crest and scattered down the slope.
  for (let i = 0; i < w * 1.5; i++) {
    const x = Math.floor(next() * w)
    const nearCrest = i < w * 0.8
    const y = crest[x]! + (nearCrest ? Math.floor(next() * 5) - 1 : Math.floor(next() * next() * (h - crest[x]!)))
    const tall = 2 + Math.floor(next() * (nearCrest ? 7 : 5))
    g.fillStyle = next() < 0.5 ? theme.tall[1] : theme.tall[2]
    g.fillRect(x, y - tall, 1, tall)
    if (next() < 0.5) {
      g.fillStyle = theme.tall[3]
      g.fillRect(x, y - tall, 1, 1)
    }
  }
  return c
}

/** How tall the near sprite is drawn, in px. */
const NEAR_TARGET = 66

/** Which scale brings a sprite near `target` px tall, whole steps only. */
const scaleFor = (s: SpeciesSprites, target: number) => Math.max(1, Math.min(3, Math.round(target / Math.max(12, s.bodyH))))

export type Battle = ReturnType<typeof createBattle>

/**
 * Starts a battle. `session` must hold the encounter. `resumed`: picked up from
 * a session left open, so nothing plays before the menu.
 */
export const createBattle = (opts: { habitat: SafariHabitat; theme: SafariTheme; family: HatchlingId; shiny: boolean; session: SafariSession; partnerDex: number; partnerShiny: boolean; host: BattleHost; resumed: boolean }) => {
  const { habitat, theme, family, shiny, partnerDex, partnerShiny, host } = opts
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
  let flashColor = '#ffffff'
  let squash = 0
  let wildHidden = false
  const wildAt = { x: 0, y: 0 }
  let berry: { x: number; y: number } | null = null
  let sceneShiny = false
  const parts: Particle[] = []
  const pops: Popup[] = []
  let farPlatform: HTMLCanvasElement | null = null
  let nearGround: HTMLCanvasElement | null = null
  let grass: HTMLCanvasElement | null = null

  void loadSpecies(form.dex, shiny).catch(() => {})
  void loadSpecies(partnerDex, partnerShiny).catch(() => {})

  const go = (next: Phase) => {
    phase = next
    phaseT = 0
  }

  const wild = () => sprites(form.dex, shiny)
  const near = () => sprites(partnerDex, partnerShiny)

  const toMenu = () => {
    go('menu')
    host.say(m().what(name))
    host.tags(true)
    host.menu(true)
  }

  const finish = () => {
    go('done')
    host.menu(false)
    host.end()
  }

  if (opts.resumed) {
    wildHidden = false
    toMenu()
  } else host.say('')

  /* ---------------- What the player does ---------------- */

  const throwBall = () => {
    if (phase !== 'menu' || opts.session.balls === 0) return
    reply = null
    host.menu(false)
    host.say(m().threw)
    playSfx('safariThrow')
    host.send({ kind: 'ball' }, (got) => {
      reply = got
      opts.session = got.session
    })
    go('fly')
  }

  const giveBerry = () => {
    if (phase !== 'menu' || opts.session.berries === 0) return
    reply = null
    host.menu(false)
    host.say(m().gave(name))
    playSfx('safariThrow')
    host.send({ kind: 'berry' }, (got) => {
      reply = got
      opts.session = got.session
    })
    go('toss')
  }

  const run = () => {
    if (phase !== 'menu') return
    reply = null
    host.menu(false)
    host.say(m().ran)
    playSfx('escaped')
    host.send({ kind: 'leave' }, (got) => {
      reply = got
      opts.session = got.session
    })
    go('away')
  }

  /* ---------------- Time ---------------- */

  const step = (dt: number, L: BattleLayout) => {
    clock += dt
    phaseT += dt
    flash = Math.max(0, flash - dt * 3.2)
    squash = Math.max(0, squash - dt * 5)
    stepFx(parts, pops, dt)
    wildAt.x = L.wild.x
    wildAt.y = L.wild.y
    const target = { x: L.wild.x, y: L.wild.y - Math.max(18, Math.round(wild().bodyH * scaleFor(wild(), 58) * 0.55)) }
    switch (phase) {
      case 'open':
        if (phaseT >= TIMES.open) go('silhouette')
        break
      case 'silhouette':
        if (phaseT >= TIMES.silhouette) {
          go('flash')
          flash = 1
          flashColor = '#ffffff'
          playCry(cryUrl(form.dex), 0.45)
          if (shiny) {
            playSfx('shiny')
            burst(parts, L.wild.x, target.y, ['#ffffff', '#fff0a0', '#a8f0ff', '#ffb8e8'], 34, 95, 30)
          }
          host.say(opts.session.encounter?.sure ? m().wildSure(name) : shiny ? m().wildShiny(name) : m().wild(name))
          host.tags(true)
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
          burst(parts, L.near.x, L.near.y - 8, [theme.ground[3], theme.tall[2]], 12, 50, 180)
          toMenu()
        }
        break
      case 'fly': {
        const k = Math.min(1, phaseT / TIMES.fly)
        const start = { x: L.near.x + 14, y: L.near.y - 80 }
        ballX = start.x + (target.x - start.x) * k
        ballY = start.y + (target.y - start.y) * k - Math.sin(k * Math.PI) * 62
        if (phaseT >= TIMES.fly) {
          flash = 0.6
          playSfx('pokeballOpen')
          burst(parts, target.x, target.y, ['#ffffff', '#ffe080', '#a0e8ff'], 22, 110, 90)
          go('recoil')
        }
        break
      }
      case 'recoil': {
        const k = phaseT / TIMES.recoil
        ballX = target.x - 8 * k
        ballY = target.y - 14 * Math.sin(k * Math.PI * 0.6)
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
        // Three hops down onto the mound, each lower than the last.
        const k = Math.min(1, phaseT / TIMES.drop)
        const ground = L.wild.y - 8
        const top = target.y - 14
        const hops = [0, 0.5, 0.78, 1]
        const i = k < hops[1]! ? 0 : k < hops[2]! ? 1 : 2
        const local = (k - hops[i]!) / (hops[i + 1]! - hops[i]!)
        ballX = target.x - 8 + Math.round(k * 8)
        ballY = i === 0 ? top + (ground - top) * local * local : ground - Math.sin(local * Math.PI) * (i === 1 ? 16 : 6)
        if (phaseT >= TIMES.drop) {
          ballY = ground
          ballX = target.x
          playSfx('safariBounce')
          go('settle')
        }
        break
      }
      case 'settle':
        ballX = target.x
        ballY = L.wild.y - 8
        if (phaseT >= TIMES.settle) go('wait')
        break
      case 'wait':
        ballX = target.x
        ballY = L.wild.y - 8
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
          if (phaseT >= TIMES.wobbleRest) breakOut(L)
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
            burst(parts, L.wild.x, L.wild.y - 10, ['#ffe080', '#ffffff', '#f8c030'], 26, 90, 120)
            host.say(reply.turn.shiny ? m().caughtShiny(name) : m().caught(name))
          } else breakOut(L)
        }
        break
      }
      case 'click':
        if (phaseT >= TIMES.click && reply && host.typed()) landCatch(reply)
        break
      case 'breakOut':
        if (phaseT >= TIMES.breakOut && host.typed() && reply?.turn.kind === 'ball') {
          if (reply.turn.fled) startFlee()
          else if (opts.session.over) finish()
          else toMenu()
        }
        break
      case 'toss': {
        const k = Math.min(1, phaseT / TIMES.toss)
        const start = { x: L.near.x + 14, y: L.near.y - 80 }
        ballX = start.x + (L.wild.x - 18 - start.x) * k
        ballY = start.y + (L.wild.y - 4 - start.y) * k - Math.sin(k * Math.PI) * 48
        if (phaseT >= TIMES.toss && reply?.turn.kind === 'berry') {
          berry = { x: L.wild.x - 18, y: L.wild.y - 4 }
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
          burst(parts, L.wild.x - 14, L.wild.y - 8, ['#f07088', '#ffd0d8'], 4, 40, 200)
        }
        if (phaseT >= TIMES.eat && host.typed()) {
          berry = null
          host.calm(reply.turn.calm)
          for (let i = 0; i < 3; i++) pops.push({ x: L.wild.x - 10 + i * 10, y: L.wild.y - 66 - i * 3, text: '+', color: '#ff90b0', age: -i * 0.15, big: false })
          if (reply.turn.fled) startFlee()
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
        if (Math.random() < dt * 20) burst(parts, L.W / 2 + (Math.random() * 90 - 45), L.sceneH * 0.5 - Math.random() * 70, sceneShiny ? ['#ffffff', '#ffe878', '#a8f0ff', '#ffa8e0'] : ['#ffe888', '#ffffff'], 2, 26, -20)
        break
      default:
    }
  }

  const breakOut = (L: BattleLayout) => {
    go('breakOut')
    wildHidden = false
    flash = 1
    playSfx('safariBreak')
    burst(parts, L.wild.x, L.wild.y - 20, ['#ffffff', '#ff9090', '#ffe0a0'], 22, 120, 120)
    if (reply?.turn.kind === 'ball') {
      const shakes = reply.turn.shakes
      host.say(shakes === 0 ? m().broke0 : shakes === 1 ? m().broke1 : m().broke2)
    }
  }

  const startFlee = () => {
    go('flee')
    playSfx('safariFlee')
    burst(parts, wildAt.x, wildAt.y - 4, [theme.fore[3], theme.fore[2]], 12, 60, 140)
    host.say(m().fled(name))
    host.tags(false)
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
      host.tags(false)
      host.say(out.shiny ? m().joinedShiny(name) : m().joined(name))
      host.sceneButton(true)
      return
    }
    host.say(out.refund > 0 ? m().repeat(name, formatPokeDollars(out.refund)) : m().repeatNone)
    go('repeat')
  }

  /* ---------------- The scene ---------------- */

  const drawBackdrop = (g: CanvasRenderingContext2D, L: BattleLayout, ox: number) => {
    const img = image(`safari/${habitat}-sky`)
    g.fillStyle = theme.fore[1]
    g.fillRect(0, 0, L.W, L.H)
    if (!img) return
    const bx = Math.round((L.W - BACKDROP.w) / 2 + ox * 0.35)
    // A sky taller than the art: its top row stretched up.
    if (L.backY > 0) g.drawImage(img, 0, 0, BACKDROP.w, 1, bx, 0, BACKDROP.w, L.backY)
    g.drawImage(img, bx, L.backY)
  }

  const drawWild = (g: CanvasRenderingContext2D, L: BattleLayout, ox: number, sil: boolean) => {
    const s = wild()
    const scale = scaleFor(s, 58)
    const dir: Dir8 = 7
    const x = L.wild.x + ox
    const y = L.wild.y
    if (wildHidden) return
    if (phase === 'absorb') {
      const k = Math.min(1, phaseT / TIMES.absorb)
      const shrink = 1 - easeIn(k)
      if (shrink <= 0.02) return
      const lift = Math.round((1 - shrink) * Math.max(14, s.bodyH * scale * 0.5))
      drawPokemon(g, s, 'Idle', dir, clock, x, y - lift, { scale: scale * shrink, flash: 1, alpha: 0.9 })
      return
    }
    if (phase === 'flee') {
      const k = Math.min(1, phaseT / TIMES.flee)
      drawPokemon(g, s, 'Walk', 2, clock * 2.2, x + k * k * (L.sceneW + 40 - L.wild.x), y - Math.abs(Math.sin(k * 12)) * 6, { scale })
      return
    }
    let bob = 0
    if (phase === 'eat') bob = Math.round(Math.abs(Math.sin(phaseT * 11)) * 3)
    const opts = sil ? { scale, tint: { color: '#141c28', amount: 1 } } : { scale, flash: phase === 'breakOut' ? Math.max(0, 1 - phaseT / 0.25) : 0 }
    drawPokemon(g, s, 'Idle', dir, clock, x, y - bob, opts)
  }

  const drawNear = (g: CanvasRenderingContext2D, L: BattleLayout, ox: number) => {
    const s = near()
    const scale = scaleFor(s, NEAR_TARGET)
    let x = L.near.x + ox
    let y = L.near.y
    if (phase === 'open' || phase === 'silhouette' || phase === 'flash') return
    if (phase === 'sendOut') {
      const k = Math.min(1, phaseT / TIMES.sendOut)
      x -= Math.round((1 - easeOut(k)) * 80)
      y += Math.round((1 - k) * 40 - Math.sin(k * Math.PI) * 46)
    }
    if (phase === 'away') {
      const k = Math.min(1, phaseT / TIMES.away)
      x -= Math.round(k * k * 120)
      drawPokemon(g, s, 'Walk', 6, clock, x, y, { scale })
      return
    }
    const dip = squash > 0 ? Math.round(squash * 3) : 0
    drawPokemon(g, s, 'Idle', 4, clock, x, y + dip, { scale })
  }

  const drawBall = (g: CanvasRenderingContext2D, x: number, y: number, tilt: number, open: number) => {
    const ball = image('safari/ball')
    if (!ball) return
    const cx = Math.round(x)
    const cy = Math.round(y)
    if (phase !== 'fly') blitEllipse(g, 8, 3, 'rgba(16,20,30,0.35)', cx, cy + 13)
    g.save()
    g.translate(cx, cy)
    g.rotate(tilt)
    if (open <= 0) g.drawImage(ball, -13, -13)
    else {
      // Open: the top half lifted on a hinge at the back.
      g.save()
      g.translate(-11, 0)
      g.rotate(-open * 0.9)
      g.drawImage(ball, 0, 0, 26, 13, -2, -13, 26, 13)
      g.restore()
      g.drawImage(ball, 0, 13, 26, 13, -13, 0, 26, 13)
    }
    g.restore()
  }

  const drawBeam = (g: CanvasRenderingContext2D, L: BattleLayout, x: number, y: number) => {
    const k = Math.min(1, phaseT / TIMES.absorb)
    const w = Math.round(6 + 20 * (1 - k))
    g.globalAlpha = 0.55 * (1 - k * 0.6)
    g.fillStyle = '#ffffff'
    g.fillRect(x - w, y - 2, w * 2, Math.max(6, L.wild.y - y))
    g.globalAlpha = 1
  }

  /** The new family's moment: dark over the scene, a fan of rays, the Pokémon up close. */
  const drawFreshScene = (g: CanvasRenderingContext2D, L: BattleLayout) => {
    const rise = easeOut(Math.min(1, phaseT / TIMES.sceneRise))
    g.fillStyle = 'rgba(8,10,24,0.82)'
    g.fillRect(0, 0, L.W, L.H)
    const cx = Math.round(L.sceneW / 2)
    const cy = Math.round(L.sceneH * 0.6)
    const spin = clock * 0.35
    g.fillStyle = sceneShiny ? 'rgba(255,240,180,0.22)' : 'rgba(255,230,140,0.16)'
    const R = Math.max(L.W, L.H)
    for (let i = 0; i < 10; i++) {
      const a = spin + (i / 10) * Math.PI * 2
      g.beginPath()
      g.moveTo(cx, cy)
      g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
      g.lineTo(cx + Math.cos(a + 0.18) * R, cy + Math.sin(a + 0.18) * R)
      g.closePath()
      g.fill()
    }
    blitEllipse(g, 42, 12, sceneShiny ? '#f8e088' : '#e8c868', cx, cy + 4)
    blitEllipse(g, 30, 8, '#fff4c4', cx, cy + 4)
    const s = wild()
    const scale = Math.min(4, scaleFor(s, 96) + (s.bodyH < 20 ? 1 : 0))
    drawPokemon(g, s, 'Idle', 0, clock, cx, Math.round(cy - (1 - rise) * 16), { scale, flash: phaseT < 0.2 ? 1 - phaseT / 0.2 : 0 })
  }

  const draw = (g: CanvasRenderingContext2D, L: BattleLayout) => {
    if (phase === 'done') return
    let ox = 0
    // The camera leans toward what the ball is doing.
    if (phase === 'fly' || phase === 'recoil' || phase === 'absorb') ox = -Math.round(Math.min(1, phaseT / 0.35) * 8)
    else if (phase === 'wobble' || phase === 'wait' || phase === 'drop' || phase === 'settle' || phase === 'click' || phase === 'repeat') ox = -8
    drawBackdrop(g, L, ox)

    if (!farPlatform) farPlatform = bakePlatform(theme, 52, 13, 3)
    if (!nearGround || nearGround.width !== L.W + 40) nearGround = bakeNearGround(theme, L.W + 40, L.H - L.moundY + 34)
    if (!grass) grass = bakeGrass(theme)

    const pullFar = phase === 'open' ? (1 - easeOut(Math.min(1, phaseT / TIMES.open))) * -90 : 0
    const pullNear = phase === 'open' ? (1 - easeOut(Math.min(1, phaseT / TIMES.open))) * 90 : 0

    g.drawImage(farPlatform, Math.round(L.wild.x - farPlatform.width / 2 + ox * 1.0 + pullFar), Math.round(L.wild.y - 8 - 13))
    const silhouetted = phase === 'open' || phase === 'silhouette'
    if (!wildHidden && phase !== 'scene') blitEllipse(g, Math.round(wild().bodyW * 0.9) + 4, 4, 'rgba(16,20,30,0.3)', L.wild.x + ox + pullFar, L.wild.y)
    drawWild(g, L, ox + pullFar, silhouetted)

    g.drawImage(nearGround, Math.round(-20 + ox * 1.6 + pullNear), L.moundY - 24)
    drawNear(g, L, ox * 1.6)

    // A shiny keeps twinkling while it's on the field.
    if (shiny && !wildHidden && phase !== 'open' && phase !== 'silhouette' && phase !== 'flee') {
      g.fillStyle = '#fff8c8'
      for (let i = 0; i < 4; i++) {
        const a = clock * 1.8 + (i / 4) * Math.PI * 2
        const r = 22 + Math.sin(clock * 3 + i) * 5
        const sx = Math.round(L.wild.x + ox + Math.cos(a) * r)
        const sy = Math.round(L.wild.y - 26 + Math.sin(a) * r * 0.7)
        if (Math.sin(clock * 9 + i * 2) > 0) {
          g.fillRect(sx - 2, sy, 5, 1)
          g.fillRect(sx, sy - 2, 1, 5)
        } else g.fillRect(sx, sy, 1, 1)
      }
    }

    // The ball.
    if (phase === 'fly') drawBall(g, ballX, ballY, clock * 16, 0)
    if (phase === 'recoil') drawBall(g, ballX, ballY, 0, phaseT / TIMES.recoil)
    if (phase === 'absorb') {
      const tx = L.wild.x
      drawBeam(g, L, tx + ox, ballY)
      drawBall(g, ballX + ox, ballY - 14, 0, 1 - Math.min(1, phaseT / TIMES.absorb) * 0.2)
    }
    if (phase === 'drop') drawBall(g, ballX + ox, ballY, Math.sin(phaseT * 18) * 0.25, 0)
    if (phase === 'settle' || phase === 'wait') drawBall(g, ballX + ox, ballY, 0, 0)
    if (phase === 'wobble' || phase === 'click' || phase === 'repeat') {
      let tilt = 0
      if (phase === 'wobble' && reply?.turn.kind === 'ball') {
        const since = phaseT - shakeAt
        if (shakesDone < reply.turn.shakes && since < TIMES.wobble) tilt = Math.sin((since / TIMES.wobble) * Math.PI * 2) * 0.55
      }
      drawBall(g, ballX + ox, ballY + (Math.abs(tilt) > 0.2 ? 1 : 0), tilt, 0)
    }
    if ((phase === 'toss' && phaseT < TIMES.toss) || berry) {
      const art = image('safari/berry')
      if (art) {
        const bx = berry ? berry.x : ballX
        const by = berry ? berry.y : ballY
        const eaten = berry ? Math.min(1, phaseT / TIMES.eat) : 0
        if (eaten < 1) g.drawImage(art, 0, Math.round(eaten * art.height), art.width, art.height - Math.round(eaten * art.height), Math.round(bx - art.width / 2) + ox, Math.round(by - art.height / 2 + eaten * art.height), art.width, art.height - Math.round(eaten * art.height))
      }
    }

    // The grass in front of the camera: big blades along the scene's lower edge, swaying, a second row filling what's below it.
    if (grass) {
      const { w, h } = GRASS_CELL
      for (let row = L.wide ? 1 : 0; row < 2; row++) {
        const y = row === 0 ? L.sceneH - h * 2 + 12 : L.H - h * 2 + 14
        for (let i = 0, x = -10 - row * 12; x < L.W; i++, x += 30) {
          const wave = Math.sin(clock * 1.5 + i * 0.9 + row)
          g.drawImage(grass, (wave > 0.3 ? 2 : wave < -0.3 ? 0 : 1) * w, (i % GRASS_VARIANTS) * h, w, h, x + Math.round(ox * 2), y, w * 2, h * 2)
        }
      }
    }

    if (phase === 'scene') drawFreshScene(g, L)

    drawFx(g, parts, pops)

    if (flash > 0) {
      g.globalAlpha = Math.min(1, flash)
      g.fillStyle = flashColor
      g.fillRect(0, 0, L.W, L.H)
      g.globalAlpha = 1
    }

    if (phase === 'open') drawGrassWipe(g, L.W, L.H, 1 - easeOut(Math.min(1, phaseT / TIMES.open)), theme)
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
      for (const c of [farPlatform, nearGround, grass]) if (c) c.width = 0
      farPlatform = nearGround = grass = null
    },
  }
}

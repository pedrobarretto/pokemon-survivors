import { PLAYABLE } from '../../data/hatchlings'
import { playCry, playSfx } from '../../engine/audio'
import { blitEllipse, textSprite } from '../../engine/pixelart'
import { t } from '../../i18n'
import { cryUrl, drawPokemon, fitSprites, loadSpecies, portraitUrl, sprites } from '../../render/sprites'
import {
  BIG_HAUL,
  biteWindow,
  CATCH_DEX,
  CATCHES,
  featsOf,
  fightStep,
  inZone,
  logOf,
  ROUND_SECONDS,
  rollCatch,
  scoreOf,
  startFight,
  zoneOf,
  widthOf,
  type CatchDef,
  type CatchId,
  type Fight,
  type Zone,
} from './fishing.rules'
import { BOBBER, BUOYS, castX, CLOCK, CLOUDS, DECK, EXCLAIM, FISH_ICON, H, JUNK, loadFonts, pixelText, seabedAt, SPARKLE, spriteUrl, SURFACE, W, wrapText, backdrop } from './fishingArt'
import type { GameInput, GameRun, SoloCtx, SoloEnd, SoloGame } from './frame'

/**
 * Fishing off the pier (`MINIGAMES.fishing`), a 90 s round: hold to cast
 * (the longer, up to the peak, the further: a marker shows where it lands
 * and the buoys how far out the rarer catches swim), wait while a shadow
 * comes to the hook and nibbles, tap when the "!" pops, then reel: hold to
 * pull the zone toward the dock, let go to give line, keep the fish inside
 * it and ease off when it runs or the line snaps. A catch leaps out with its
 * name and value and swims off again; the round's catches are the score.
 * The partner stands on the dock with the rod. Rules in `fishing.rules.ts`,
 * art in `fishingArt.ts`.
 */

type Pt = { x: number; y: number }

/**
 * Dev only (`ps.fishing`): the next catch to bite at once, and an autopilot
 * that casts far, hooks and reels on its own, to stage every moment; `phase`
 * reads the round's (for a script waiting on a moment).
 */
export const fishingDev: { next: CatchId | null; auto: boolean; phase: string } = { next: null, auto: false, phase: '' }

/** A fish's shadow under the water: what it is (rolled for the stretch it swims in) and where it's going. */
type Shadow = { x: number; y: number; vx: number; catchId: CatchId; zone: Zone; turn: number; goal: Pt | null; flee: boolean; wiggle: number }

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }

type Floater = { text: string; x: number; y: number; age: number; color: string }

type Phase =
  | { kind: 'countdown'; t: number }
  | { kind: 'aim'; t: number }
  | { kind: 'charge'; t: number; power: number }
  | { kind: 'cast'; t: number; power: number; to: number }
  | { kind: 'wait'; t: number; fish: Shadow | null; nibbles: number; next: number; dip: number }
  | { kind: 'bite'; t: number; window: number; fish: Shadow }
  | { kind: 'fight'; fight: Fight; fish: Shadow; from: number; reel: number }
  | { kind: 'reveal'; t: number; catchId: CatchId; from: Pt }
  | { kind: 'lost'; t: number; why: 'early' | 'away' | 'snapped' }
  | { kind: 'reelIn'; t: number; from: Pt }
  | { kind: 'over'; t: number }

/** Timings (s) and sizes; tune here. */
const T = {
  countdown: 3.6,
  /** Power swings 0 → 1 → 0 over this while held. */
  swing: 1.5,
  flight: 0.55,
  /** A shadow swims to the hook this fast (px/s). */
  approach: 30,
  /** Seconds before a fresh shadow comes when none swims near the cast. */
  arrive: [0.6, 1.8],
  nibbleGap: [0.35, 0.85],
  dip: 0.16,
  lost: 1.2,
  reelIn: 0.35,
  reveal: { rise: 0.45, hover: 1.3, dive: 0.4 },
  over: 1.8,
  /** A cast draws a fish from this far around where it landed (px). */
  reach: 34,
} as const

/** The partner's spot on the dock (its feet), and how wide a body it's fitted to. */
const PARTNER = { x: 22, y: DECK.top, maxW: 34 } as const

/** The card a catch is shown on, over the sea. */
const CARD = { x: 50, y: 22, w: 80, h: 76 } as const

/** The reel's bar during a fight: the sea side on the right, the dock's on the left (holding pulls the zone left). */
const BAR = { x: 36, y: H - 20, w: 120, h: 9 } as const

const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const between = (r: readonly [number, number]) => lerp(r[0], r[1], Math.random())
const ease = (k: number) => 1 - (1 - k) * (1 - k)

const dexOf = (partner: string) => (Object.hasOwn(PLAYABLE, partner) ? PLAYABLE[partner as keyof typeof PLAYABLE].line[0].dex : 25)

/** The partner's sprites, shrunk to fit the dock when it's a big one. */
const partnerSprites = (ctx: SoloCtx) => fitSprites(sprites(dexOf(ctx.partner), ctx.shiny), PARTNER.maxW)

/** Which stretch of water x is in (the screen's mapping of `zoneOf`). */
const zoneAt = (x: number): Zone => zoneOf((x - castX(0)) / (castX(1) - castX(0)))

/** A shadow's radius by the size of what it is. */
const SHADOW_R = [
  { rx: 5, ry: 2 },
  { rx: 7, ry: 3 },
  { rx: 11, ry: 4 },
] as const

const ZONE_X: Record<Zone, readonly [number, number]> = { near: [castX(0), castX(0.38)], mid: [castX(0.38), castX(0.72)], far: [castX(0.72), castX(1)] }

/** A new shadow somewhere in `zone`, swimming at a depth that fits its size. */
const newShadow = (zone: Zone): Shadow => {
  const id = rollCatch(zone, Math.random)
  const [x0, x1] = ZONE_X[zone]
  const deep = CATCHES[id].size === 2 ? 0.75 : 0.35
  return {
    x: between([x0, x1]),
    y: lerp(SURFACE + 18, seabedAt(100) - 10, deep * Math.random() + (1 - deep) * 0.2),
    vx: (Math.random() < 0.5 ? -1 : 1) * between([4, 9]),
    catchId: id,
    zone,
    turn: between([1.5, 4]),
    goal: null,
    flee: false,
    wiggle: Math.random() * 6,
  }
}

/** The text a catch shows: a Pokémon's name, or the junk's in the player's language. */
const catchName = (id: CatchId) => {
  const c: CatchDef = CATCHES[id]
  return c.junk ? t().minigames.fishing.junk[c.junk] : (c.name ?? id)
}

export const fishing: SoloGame = {
  size: { w: W, h: H },
  start: (ctx: SoloCtx): GameRun => {
    const words = () => t().minigames.fishing
    void loadFonts(words().hold)
    void loadSpecies(dexOf(ctx.partner), ctx.shiny).catch(() => {})
    for (const v of CATCH_DEX) if (!v.shiny) void loadSpecies(v.dex).catch(() => {})

    let phase: Phase = { kind: 'countdown', t: 0 }
    let left = ROUND_SECONDS
    let clock = 0
    let pause = 0
    let shake = 0
    let flash = 0
    let lastCast = false
    let hinted = false
    const bragged = new Set<string>()
    const haul: CatchId[] = []
    const shadows: Shadow[] = [newShadow('near'), newShadow('near'), newShadow('mid'), newShadow('mid'), newShadow('far'), newShadow('far')]
    const particles: Particle[] = []
    const ripples: { x: number; age: number; big: boolean }[] = []
    const floaters: Floater[] = []
    let bobber: Pt | null = null
    let reelSound = 0

    const brag = (feat: string) => {
      if (bragged.has(feat)) return
      bragged.add(feat)
      ctx.brag(feat)
    }

    const splash = (x: number, n: number, big = false) => {
      ripples.push({ x, age: 0, big })
      for (let i = 0; i < n; i++)
        particles.push({ x, y: SURFACE - 1, vx: between([-28, 28]), vy: -between([30, big ? 90 : 55]), life: between([0.4, 0.8]), color: i % 3 === 0 ? '#ffffff' : '#a8e0f8', size: big && i % 4 === 0 ? 2 : 1 })
    }

    const sparkles = (x: number, y: number, n: number, color = '#fff0a0') => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        particles.push({ x, y, vx: Math.cos(a) * between([20, 50]), vy: Math.sin(a) * between([20, 50]), life: between([0.5, 0.9]), color, size: 1 })
      }
    }

    const lose = (why: 'early' | 'away' | 'snapped', fish: Shadow | null) => {
      if (fish) fish.flee = true
      phase = { kind: 'lost', t: 0, why }
      playSfx(why === 'snapped' ? 'break' : why === 'early' ? 'denied' : 'escaped')
      if (why === 'snapped') {
        shake = 0.3
        if (bobber) sparkles(bobber.x, bobber.y, 8, '#f8f8f8')
        bobber = null
      }
    }

    /** The round ends as soon as nothing's on the line; a fight going on is let finish ("last cast"). */
    const timeUp = () => {
      if (phase.kind === 'fight' || phase.kind === 'reveal') {
        if (!lastCast && phase.kind === 'fight') floaters.push({ text: words().lastCast, x: W / 2, y: 30, age: 0, color: '#f8d030' })
        lastCast = true
        return
      }
      if (phase.kind !== 'over') {
        phase = { kind: 'over', t: 0 }
        bobber = null
        playSfx(scoreOf(haul) >= BIG_HAUL ? 'unlock' : 'levelUp')
      }
    }

    /** The phase after a catch or a loss: another cast, or the end when the time ran out meanwhile. */
    const next = () => {
      bobber = null
      if (left <= 0) {
        phase = { kind: 'over', t: 0 }
        playSfx(scoreOf(haul) >= BIG_HAUL ? 'unlock' : 'levelUp')
      } else phase = { kind: 'aim', t: 0 }
    }

    const land = (fish: Shadow) => {
      const id = fish.catchId
      const c: CatchDef = CATCHES[id]
      haul.push(id)
      shadows.splice(shadows.indexOf(fish), 1)
      shadows.push(newShadow(fish.zone))
      const at = { x: fish.x, y: SURFACE }
      phase = { kind: 'reveal', t: 0, catchId: id, from: at }
      bobber = null
      pause = 0.12
      shake = c.value >= 100 ? 0.4 : 0.15
      splash(at.x, 18, true)
      playSfx('splash')
      if (c.dex !== null) {
        if (c.shiny) {
          flash = 0.25
          playSfx('shiny')
        } else playSfx('pickup')
        playCry(cryUrl(c.dex))
      } else playSfx('thud')
      for (const feat of featsOf(haul)) {
        if (feat !== 'bigHaul' && feat !== id) continue
        if (!bragged.has(feat)) playSfx('item')
        brag(feat)
      }
    }

    const holding = (input: GameInput) => input.pointer.down || input.held('Space') || input.held('Enter')
    const pressed = (input: GameInput) => input.pointer.pressed || input.pressed('Space') || input.pressed('Enter')

    /** The rod's tip, for the line: where the partner holds the rod and how it's angled now. */
    const rod = (): { hand: Pt; tip: Pt } => {
      const s = partnerSprites(ctx)
      const hand = { x: PARTNER.x + Math.round(s.bodyW * 0.3) + 2, y: PARTNER.y - Math.max(6, Math.round(s.bodyH * 0.4)) }
      let angle = -1.0
      if (phase.kind === 'charge') angle = lerp(-1.05, -2.2, Math.min(1, phase.t / 0.25))
      else if (phase.kind === 'cast') angle = lerp(-2.2, -0.45, ease(Math.min(1, phase.t / 0.12)))
      else if (phase.kind === 'wait' || phase.kind === 'bite') angle = -0.55 + (phase.kind === 'bite' ? 0.18 : phase.dip > 0 ? 0.08 : 0)
      else if (phase.kind === 'fight') angle = -0.3 + Math.sin(clock * 30) * 0.05 * phase.fight.tension + (phase.fight.runs > 0 ? 0.12 : 0)
      const len = 22
      return { hand, tip: { x: Math.round(hand.x + Math.cos(angle) * len), y: Math.round(hand.y + Math.sin(angle) * len) } }
    }

    const step = (dt: number, input: GameInput) => {
      clock += dt
      fishingDev.phase = phase.kind
      for (const p of particles) {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 160 * dt
        p.life -= dt
      }
      for (let i = particles.length - 1; i >= 0; i--) if (particles[i]!.life <= 0 || (particles[i]!.y > SURFACE + 2 && particles[i]!.vy > 0 && particles[i]!.color !== '#f8f8f8')) particles.splice(i, 1)
      for (const r of ripples) r.age += dt
      while (ripples.length && ripples[0]!.age > 1) ripples.shift()
      for (const f of floaters) f.age += dt
      while (floaters.length && floaters[0]!.age > 1.4) floaters.shift()
      shake = Math.max(0, shake - dt)
      flash = Math.max(0, flash - dt)
      if (pause > 0) {
        pause -= dt
        return
      }

      // Shadows wander their stretch; the one at the hook swims there; a frightened one darts off and comes back as another.
      for (const s of shadows) {
        s.wiggle += dt
        if (s.flee) {
          s.x += (s.vx > 0 ? 1 : -1) * 70 * dt
          s.y += 20 * dt
          continue
        }
        if (s.goal) {
          const dx = s.goal.x - s.x
          const dy = s.goal.y - s.y
          const d = Math.hypot(dx, dy)
          if (d > 0.5) {
            const v = Math.min(d, T.approach * dt)
            s.x += (dx / d) * v
            s.y += (dy / d) * v
            s.vx = dx === 0 ? s.vx : Math.sign(dx) * Math.abs(s.vx)
          }
          continue
        }
        s.turn -= dt
        const [x0, x1] = ZONE_X[s.zone]
        if (s.turn <= 0 || s.x < x0 - 6 || s.x > x1 + 6) {
          s.vx = (s.x < x0 ? 1 : s.x > x1 ? -1 : Math.random() < 0.5 ? -1 : 1) * between([4, 10])
          s.turn = between([1.5, 4])
        }
        s.x += s.vx * dt
      }
      for (let i = shadows.length - 1; i >= 0; i--) {
        const s = shadows[i]!
        if (s.flee && (s.x < -20 || s.x > W + 20 || s.y > H)) {
          shadows.splice(i, 1)
          shadows.push(newShadow(s.zone))
        }
      }

      if (phase.kind !== 'countdown' && phase.kind !== 'over') {
        const was = Math.ceil(left)
        left = Math.max(0, left - dt)
        if (left <= 10 && Math.ceil(left) !== was && left > 0) playSfx('tick')
        if (left <= 0) timeUp()
      }

      switch (phase.kind) {
        case 'countdown': {
          const was = Math.ceil(T.countdown - 0.6 - phase.t)
          phase.t += dt
          const now = Math.ceil(T.countdown - 0.6 - phase.t)
          if (now !== was && now >= 1) playSfx('tick')
          if (was >= 1 && now < 1) playSfx('select')
          if (phase.t >= T.countdown) phase = { kind: 'aim', t: 0 }
          return
        }
        case 'aim':
          phase.t += dt
          if (pressed(input) || (holding(input) && phase.t > 0.25) || (fishingDev.auto && phase.t > 0.6)) {
            phase = { kind: 'charge', t: 0, power: 0 }
            playSfx('windup')
          }
          return
        case 'charge': {
          phase.t += dt
          const k = (phase.t / (T.swing / 2)) % 2
          phase.power = k <= 1 ? k : 2 - k
          if (fishingDev.auto ? phase.power > 0.86 : !holding(input)) {
            const power = phase.power
            phase = { kind: 'cast', t: 0, power, to: castX(power) }
            playSfx('whoosh')
          }
          return
        }
        case 'cast': {
          phase.t += dt
          const k = Math.min(1, phase.t / T.flight)
          const from = rod().tip
          bobber = { x: lerp(from.x, phase.to, k), y: lerp(from.y, SURFACE, k) - Math.sin(k * Math.PI) * 26 }
          if (k >= 1) {
            bobber = { x: phase.to, y: SURFACE }
            splash(phase.to, 6)
            playSfx('splash')
            phase = { kind: 'wait', t: 0, fish: null, nibbles: 0, next: between(T.arrive), dip: 0 }
          }
          return
        }
        case 'wait': {
          phase.t += dt
          phase.dip = Math.max(0, phase.dip - dt)
          const at = bobber ?? { x: castX(0.5), y: SURFACE }
          const hook = { x: at.x, y: SURFACE + 7 }
          if (!phase.fish && fishingDev.next) {
            const s = newShadow(zoneAt(at.x))
            s.catchId = fishingDev.next
            fishingDev.next = null
            Object.assign(s, { x: hook.x + 3, y: hook.y + 2 })
            shadows.push(s)
            phase.fish = s
            s.goal = hook
            phase.nibbles = 0
            phase.next = 0.3
          }
          if (!phase.fish) {
            // The nearest shadow of the stretch comes; with none close, a fresh one swims in.
            const zone = zoneAt(at.x)
            const near = shadows.filter((s) => !s.flee && !s.goal && s.zone === zone && Math.abs(s.x - at.x) < T.reach).sort((a, b) => Math.abs(a.x - at.x) - Math.abs(b.x - at.x))[0]
            if (near) phase.fish = near
            else if (phase.t >= phase.next) {
              const s = newShadow(zone)
              s.x = at.x + (Math.random() < 0.5 ? -1 : 1) * T.reach
              s.y = SURFACE + 34
              shadows.push(s)
              phase.fish = s
            }
            if (phase.fish) {
              phase.fish.goal = hook
              const c: CatchDef = CATCHES[phase.fish.catchId]
              phase.nibbles = Math.floor(Math.random() * 3) + (c.fight > 0.5 ? 1 : 0)
              phase.next = between(T.nibbleGap)
            }
          }
          const fish = phase.fish
          const there = fish !== null && Math.hypot(fish.x - hook.x, fish.y - hook.y) < 2
          if (pressed(input)) {
            // Tapping before the "!": a fish at the hook takes fright; otherwise the line just comes back in.
            if (there || phase.dip > 0) {
              floaters.push({ text: words().early, x: at.x, y: SURFACE - 14, age: 0, color: '#f8f8f8' })
              return lose('early', fish)
            }
            if (fish) fish.goal = null
            phase = { kind: 'reelIn', t: 0, from: at }
            playSfx('move')
            return
          }
          if (!there || !fish) return
          phase.next -= dt
          if (phase.next > 0) return
          if (phase.nibbles > 0) {
            phase.nibbles--
            phase.dip = T.dip
            phase.next = between(T.nibbleGap)
            ripples.push({ x: at.x, age: 0, big: false })
            playSfx('bubbles')
            return
          }
          phase = { kind: 'bite', t: 0, window: biteWindow(fish.catchId), fish }
          splash(at.x, 5)
          playSfx('ping')
          return
        }
        case 'bite':
          phase.t += dt
          if (pressed(input) || (fishingDev.auto && phase.t > 0.25)) {
            const fish = phase.fish
            fish.goal = null
            const c: CatchDef = CATCHES[fish.catchId]
            if (c.dex !== null) void loadSpecies(c.dex, c.shiny === true).catch(() => {})
            phase = { kind: 'fight', fight: startFight(fish.catchId), fish, from: fish.x, reel: 0 }
            pause = 0.08
            shake = 0.15
            playSfx('hit')
            return
          }
          if (phase.t >= phase.window) {
            floaters.push({ text: words().away, x: bobber?.x ?? W / 2, y: SURFACE - 14, age: 0, color: '#f8f8f8' })
            lose('away', phase.fish)
          }
          return
        case 'fight': {
          const f = phase.fight
          const hold = fishingDev.auto ? f.runs === 0 && f.fish > f.zone + widthOf(f) / 2 - f.speed * 0.12 : holding(input)
          const end = fightStep(f, hold, dt, Math.random)
          // The fish on the line: pulled toward the dock as the catch comes in, thrashing.
          const fish = phase.fish
          fish.x = lerp(phase.from, DECK.right + 14, f.progress * 0.85)
          fish.y = SURFACE + 8 + Math.sin(clock * (f.runs > 0 ? 22 : 9)) * (f.runs > 0 ? 3 : 1.5) + (1 - f.progress) * 12
          bobber = { x: fish.x, y: fish.y }
          if (hold) {
            phase.reel -= dt
            if (phase.reel <= 0) {
              playSfx('move')
              phase.reel = 0.11
            }
          }
          reelSound -= dt
          if (f.tension > 0.7 && reelSound <= 0) {
            playSfx('tick')
            reelSound = lerp(0.3, 0.08, (f.tension - 0.7) / 0.3)
          }
          if (end === 'landed') return land(fish)
          if (end === 'escaped') {
            floaters.push({ text: words().away, x: fish.x, y: SURFACE - 14, age: 0, color: '#f8f8f8' })
            return lose('away', fish)
          }
          if (end === 'snapped') {
            floaters.push({ text: words().snapped, x: W / 2, y: SURFACE - 16, age: 0, color: '#f87878' })
            return lose('snapped', fish)
          }
          return
        }
        case 'reveal': {
          phase.t += dt
          const r = T.reveal
          // A tap hurries the show along.
          if (pressed(input) && phase.t > r.rise + 0.3 && phase.t < r.rise + r.hover) phase.t = r.rise + r.hover
          if (phase.t - dt < r.rise && phase.t >= r.rise) {
            const c: CatchDef = CATCHES[phase.catchId]
            floaters.push({ text: `+${c.value}`, x: CARD.x + CARD.w / 2, y: CARD.y + CARD.h + 14, age: 0, color: c.value >= 100 ? '#f8d030' : '#ffffff' })
            sparkles(CARD.x + CARD.w / 2, CARD.y + CARD.h / 2, c.value >= 100 ? 18 : 10)
            playSfx('coin')
          }
          if (phase.t - dt < r.rise + r.hover + r.dive && phase.t >= r.rise + r.hover + r.dive) {
            splash(phase.from.x, 10)
            playSfx('splash')
          }
          if (phase.t >= r.rise + r.hover + r.dive + 0.15) next()
          return
        }
        case 'lost':
          phase.t += dt
          if (phase.t >= T.lost) next()
          return
        case 'reelIn': {
          phase.t += dt
          const k = Math.min(1, phase.t / T.reelIn)
          const tip = rod().tip
          bobber = { x: lerp(phase.from.x, tip.x, k), y: lerp(phase.from.y, tip.y, k) - Math.sin(k * Math.PI) * 8 }
          if (k >= 1) next()
          return
        }
        case 'over':
          phase.t += dt
          return
      }
    }

    /* ---------------- Drawing ---------------- */

    const center = (g: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number) => g.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2))

    /** Lines of localized text centered on x, starting at y, on a dark plate so they read over the water. */
    const say = (g: CanvasRenderingContext2D, text: string, x: number, y: number, color = '#ffffff') => {
      const imgs = wrapText(text, W - 20).map((l) => pixelText(l, color))
      const w = Math.max(...imgs.map((i) => i.width))
      const step = imgs[0] ? imgs[0].height - 1 : 12
      g.fillStyle = 'rgba(16,20,32,0.6)'
      g.fillRect(Math.round(x - w / 2) - 3, y - 2, w + 6, step * imgs.length + 3)
      imgs.forEach((img, i) => g.drawImage(img, Math.round(x - img.width / 2), y + i * step))
    }

    /** A line of pixels from a to b (Bresenham), for the rod and the line. */
    const line = (g: CanvasRenderingContext2D, a: Pt, b: Pt, color: string) => {
      let x0 = Math.round(a.x)
      let y0 = Math.round(a.y)
      const x1 = Math.round(b.x)
      const y1 = Math.round(b.y)
      const dx = Math.abs(x1 - x0)
      const dy = -Math.abs(y1 - y0)
      const sx = x0 < x1 ? 1 : -1
      const sy = y0 < y1 ? 1 : -1
      let err = dx + dy
      g.fillStyle = color
      for (let i = 0; i < 400; i++) {
        g.fillRect(x0, y0, 1, 1)
        if (x0 === x1 && y0 === y1) return
        const e2 = 2 * err
        if (e2 >= dy) {
          err += dy
          x0 += sx
        }
        if (e2 <= dx) {
          err += dx
          y0 += sy
        }
      }
    }

    /** The fishing line from the rod's tip to `to`, sagging when slack and taut (and redder) under tension. */
    const fishingLine = (g: CanvasRenderingContext2D, tip: Pt, to: Pt, slack: number, tension: number) => {
      const color = tension > 0.75 ? '#ff8080' : tension > 0.45 ? '#f8e080' : '#f0f4f8'
      const n = Math.max(4, Math.ceil(Math.hypot(to.x - tip.x, to.y - tip.y) / 4))
      let prev = tip
      for (let i = 1; i <= n; i++) {
        const k = i / n
        const p = { x: lerp(tip.x, to.x, k), y: lerp(tip.y, to.y, k) + Math.sin(k * Math.PI) * slack }
        line(g, prev, p, color)
        prev = p
      }
    }

    const drawSea = (g: CanvasRenderingContext2D) => {
      g.drawImage(backdrop(), 0, 0)
      // Clouds drifting.
      CLOUDS.forEach((cloud, i) => {
        const img = cloud()
        const x = ((i * 97 + clock * (3 + i * 2)) % (W + 40)) - 30
        g.drawImage(img, Math.round(x), 6 + i * 11)
      })
      // Light shafts slanting into the water.
      g.fillStyle = 'rgba(255,255,255,0.06)'
      for (let i = 0; i < 3; i++) {
        const x0 = ((i * 67 + clock * 4) % (W + 40)) - 20
        for (let y = SURFACE; y < SURFACE + 70; y += 2) g.fillRect(Math.round(x0 + (y - SURFACE) * 0.35), y, 10, 2)
      }
      // Seaweed swaying on the bottom.
      for (const [x0, hgt, phase] of [[66, 20, 0], [72, 14, 1.3], [104, 18, 2.1], [140, 24, 0.7], [146, 15, 2.6], [174, 18, 1.7]] as const) {
        const base = seabedAt(x0) + 1
        for (let y = 0; y < hgt; y++) {
          const sway = Math.round(Math.sin(clock * 1.6 + phase + y * 0.25) * (y / hgt) * 2.2)
          g.fillStyle = y % 5 === 2 ? '#3a8a38' : '#2c6c2c'
          g.fillRect(x0 + sway, base - y, 2, 1)
          if (y % 4 === 1) {
            g.fillStyle = '#58b048'
            g.fillRect(x0 + sway + (y % 8 === 1 ? 2 : -1), base - y, 1, 1)
          }
        }
      }
      // Shadows of the fish.
      for (const s of shadows) {
        const r = SHADOW_R[CATCHES[s.catchId].size]
        const x = Math.round(s.x)
        const y = Math.round(s.y)
        blitEllipse(g, r.rx, r.ry, 'rgba(8,24,56,0.42)', x, y)
        const back = s.vx > 0 ? -1 : 1
        const flick = Math.round(Math.sin(s.wiggle * 9) * 1)
        blitEllipse(g, Math.max(2, r.ry), Math.max(1, r.ry - 1), 'rgba(8,24,56,0.36)', x + back * (r.rx + 1), y + flick)
      }
      // Surface glints running along.
      g.fillStyle = '#e8f8ff'
      for (let x = 0; x < W; x += 9) {
        const k = (x * 13 + Math.floor(clock * 6)) % 17
        if (k < 3 && x > DECK.right) g.fillRect(x + k, SURFACE + (k === 1 ? 1 : 0), 3, 1)
      }
      // Buoys at the stretches' edges, bobbing.
      for (const [b, p] of [[BUOYS.mid, 0.38], [BUOYS.far, 0.72]] as const) {
        const img = b()
        g.drawImage(img, Math.round(castX(p) - img.width / 2), SURFACE - img.height + 3 + Math.round(Math.sin(clock * 2 + p * 9)))
      }
      // Ripples on the surface.
      for (const r of ripples) {
        const k = r.age
        const rx = Math.round(3 + k * (r.big ? 22 : 12))
        g.globalAlpha = Math.max(0, 1 - k)
        g.fillStyle = '#e8f8ff'
        g.fillRect(Math.round(r.x - rx), SURFACE, 3, 1)
        g.fillRect(Math.round(r.x + rx - 3), SURFACE, 3, 1)
        g.globalAlpha = 1
      }
    }

    const drawAngler = (g: CanvasRenderingContext2D) => {
      const s = partnerSprites(ctx)
      // A crouch while charging, a lunge as the cast goes, a hop on a catch.
      let dy = 0
      let dx = 0
      if (phase.kind === 'charge') dy = 1
      if (phase.kind === 'cast' && phase.t < 0.15) dx = 2
      if (phase.kind === 'reveal' && phase.t < 0.3) dy = -Math.round(Math.sin((phase.t / 0.3) * Math.PI) * 4)
      blitEllipse(g, Math.max(5, Math.round(s.bodyW / 2.5)), 2, 'rgba(40,20,8,0.35)', PARTNER.x, PARTNER.y)
      drawPokemon(g, s, 'Idle', 2, clock, PARTNER.x + dx, PARTNER.y + dy)
      const { hand, tip } = rod()
      // The rod: the grip, then the blank to the tip, a reel by the hand.
      const mid = { x: lerp(hand.x, tip.x, 0.3), y: lerp(hand.y, tip.y, 0.3) }
      line(g, { x: hand.x + dx, y: hand.y + dy }, { x: mid.x + dx, y: mid.y + dy }, '#7a4a20')
      line(g, { x: mid.x + dx, y: mid.y + dy }, { x: tip.x + dx, y: tip.y + dy }, '#384050')
      g.fillStyle = '#c0c8d0'
      g.fillRect(hand.x + dx, hand.y + dy - 1, 2, 2)
      g.fillStyle = '#e8e8f0'
      g.fillRect(tip.x + dx, tip.y + dy, 1, 1)
      if (bobber && phase.kind !== 'reveal') {
        const fight = phase.kind === 'fight' ? phase.fight : null
        const slack = fight ? 0 : phase.kind === 'cast' ? 0 : 6
        fishingLine(g, { x: tip.x + dx, y: tip.y + dy }, bobber, slack, fight?.tension ?? 0)
        if (!fight) {
          const bob = phase.kind === 'wait' ? (phase.dip > 0 ? 2 : Math.round(Math.sin(clock * 3))) : phase.kind === 'bite' ? 4 : 0
          const img = BOBBER()
          g.drawImage(img, Math.round(bobber.x - img.width / 2), Math.round(bobber.y - img.height + 4 + bob))
        }
      } else if (phase.kind === 'aim' || phase.kind === 'charge') {
        // The bobber hanging from the tip, ready.
        const img = BOBBER()
        fishingLine(g, { x: tip.x + dx, y: tip.y + dy }, { x: tip.x + dx, y: tip.y + dy + 7 }, 0, 0)
        g.drawImage(img, tip.x + dx - Math.floor(img.width / 2), tip.y + dy + 6)
      }
    }

    /** Draws packed bitmap text (`textSprite`) `k` times as big, its middle at x. */
    const bigText = (g: CanvasRenderingContext2D, text: string, color: string, x: number, y: number, k: number) => {
      const p = textSprite(text, color)
      g.drawImage(p.canvas, p.x, p.y, p.w, p.h, Math.round(x - (p.w * k) / 2), Math.round(y), p.w * k, p.h * k)
      return p.w * k
    }

    /**
     * A catch's show: it leaps out of the water onto a card (rays turning
     * behind it, gold for a rare one), at twice its size when it's small,
     * its name on the card's plate and its value under it; then it leaps
     * back into the sea.
     */
    const drawReveal = (g: CanvasRenderingContext2D) => {
      if (phase.kind !== 'reveal') return
      const r = T.reveal
      const c: CatchDef = CATCHES[phase.catchId]
      const k = phase.t
      const rare = c.value >= 100
      const s = c.dex !== null ? sprites(c.dex, c.shiny === true) : null
      const scale = s && s.bodyH > 30 ? 1 : 2
      const feet = { x: CARD.x + CARD.w / 2, y: CARD.y + CARD.h - 16 }
      // The card pops in as the catch rises, and away as it dives.
      const open = k < r.rise ? Math.min(1, k / (r.rise * 0.6)) : k < r.rise + r.hover ? 1 : Math.max(0, 1 - (k - r.rise - r.hover) / (r.dive * 0.5))
      if (open > 0) {
        const w = Math.round(CARD.w * (0.6 + 0.4 * open))
        const hh = Math.round(CARD.h * (0.6 + 0.4 * open))
        const x0 = Math.round(CARD.x + (CARD.w - w) / 2)
        const y0 = Math.round(CARD.y + (CARD.h - hh) / 2)
        g.fillStyle = '#181820'
        g.fillRect(x0 - 1, y0, w + 2, hh)
        g.fillRect(x0, y0 - 1, w, hh + 2)
        g.fillStyle = rare ? '#f8d868' : '#f8f8f0'
        g.fillRect(x0, y0, w, hh)
        g.fillStyle = rare ? '#fff0b0' : '#e0f0f8'
        g.fillRect(x0 + 2, y0 + 2, w - 4, hh - 4)
        // Rays turning behind the catch, clipped to the card.
        g.save()
        g.beginPath()
        g.rect(x0 + 2, y0 + 2, w - 4, hh - 4)
        g.clip()
        g.fillStyle = rare ? '#f8e088' : '#c8e4f4'
        const cy = feet.y - 14
        for (let i = 0; i < 10; i++) {
          const a = clock * 0.6 + (i * Math.PI) / 5
          for (let d = 6; d < 60; d += 2) {
            const spread = Math.max(1, Math.round(d / 9))
            g.fillRect(Math.round(feet.x + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), spread, spread)
          }
        }
        g.restore()
        blitEllipse(g, scale === 2 ? 12 : 9, 3, 'rgba(24,32,48,0.28)', feet.x, feet.y)
      }
      // The catch: out of the water onto the card, then back in.
      let x: number
      let y: number
      let k2 = scale
      if (k < r.rise) {
        const a = ease(k / r.rise)
        x = lerp(phase.from.x, feet.x, a)
        y = lerp(phase.from.y + 6, feet.y, a) - Math.sin(a * Math.PI) * 30
        k2 = 1
      } else if (k < r.rise + r.hover) {
        x = feet.x
        y = feet.y - Math.round(Math.abs(Math.sin((k - r.rise) * 4)) * 2)
      } else {
        const a = Math.min(1, (k - r.rise - r.hover) / r.dive)
        x = lerp(feet.x, phase.from.x, a)
        y = lerp(feet.y, SURFACE + 8, a * a) - Math.sin(a * Math.PI) * 18
        k2 = 1
      }
      const shown = k >= r.rise && k < r.rise + r.hover
      if (s) drawPokemon(g, s, shown ? 'Idle' : 'Hurt', 0, clock, Math.round(x), Math.round(y), { scale: k2 })
      else if (c.junk) {
        const img = JUNK[c.junk]()
        const w = img.width * k2
        const hgt = img.height * k2
        g.drawImage(img, Math.round(x - w / 2), Math.round(y - hgt + 2), w, hgt)
      }
      if (!shown) return
      // The name on the card's plate (official names in the pixel font, junk in the player's language).
      const plateY = CARD.y + CARD.h - 14
      // The plate spans the card, or the name when it's longer (junk, named in the player's language).
      const junkName = c.junk ? pixelText(catchName(phase.catchId), '#ffffff') : null
      const pw = Math.max(CARD.w - 4, (junkName?.width ?? 0) + 4)
      g.fillStyle = '#181820'
      g.fillRect(Math.round(feet.x - pw / 2) - 1, plateY - 1, pw + 2, 14)
      g.fillStyle = '#283048'
      g.fillRect(Math.round(feet.x - pw / 2), plateY, pw, 12)
      if (junkName) center(g, junkName, feet.x, plateY + 6)
      else {
        const name = `${c.shiny ? 'SHINY ' : ''}${catchName(phase.catchId).toUpperCase()}`
        const fits = textSprite(name, '#ffffff').w * 2 <= CARD.w - 6
        if (fits) bigText(g, name, rare ? '#f8d030' : '#ffffff', feet.x, plateY + 1, 2)
        else bigText(g, name, rare ? '#f8d030' : '#ffffff', feet.x, plateY + 3, 1)
      }
      // Twinkles around a rare one.
      if (c.value >= 30) {
        const tw = SPARKLE()
        for (let i = 0; i < 4; i++) {
          const a = clock * 1.6 + (i * Math.PI) / 2
          if (Math.sin(clock * 6 + i * 2) > 0) g.drawImage(tw, Math.round(feet.x + Math.cos(a) * 30 - 2), Math.round(feet.y - 20 + Math.sin(a) * 18 - 2))
        }
      }
    }

    const drawHud = (g: CanvasRenderingContext2D) => {
      // Score (top left) and time left (top right), on dark plates.
      const score = String(scoreOf(haul))
      const sw = textSprite(score, '#ffffff').w * 2
      g.fillStyle = 'rgba(16,20,32,0.6)'
      g.fillRect(2, 2, sw + 17, 16)
      g.drawImage(FISH_ICON(), 3, 6)
      bigText(g, score, '#ffffff', 14 + sw / 2, 3, 2)
      const secs = String(Math.ceil(left))
      const tw = textSprite(secs, '#ffffff').w * 2
      g.fillStyle = 'rgba(16,20,32,0.6)'
      g.fillRect(W - tw - 15, 2, tw + 13, 16)
      g.drawImage(CLOCK(), W - tw - 14, 7)
      bigText(g, secs, left <= 10 ? '#ff7070' : '#ffffff', W - 3 - tw / 2, 3, 2)

      if (phase.kind === 'countdown') {
        const n = Math.ceil(T.countdown - 0.6 - phase.t)
        if (n >= 1) {
          const digit = textSprite(String(n), '#f8d030')
          const k = 4
          const pop = phase.t % 1 < 0.1 ? 1 : 0
          g.drawImage(digit.canvas, digit.x, digit.y, digit.w, digit.h, Math.round(W / 2 - (digit.w * (k + pop)) / 2), 60 - pop * 2, digit.w * (k + pop), digit.h * (k + pop))
        } else say(g, words().go, W / 2, 68, '#f8d030')
        say(g, words().hold, W / 2, H - 22)
      }
      if (phase.kind === 'aim' && Math.floor(phase.t * 2.5) % 3 !== 2) say(g, words().hold, W / 2, H - 22)

      if (phase.kind === 'charge') {
        // The power meter by the dock, and where the cast will land.
        const p = phase.power
        g.fillStyle = '#181820'
        g.fillRect(3, 9, 6, 26)
        g.fillStyle = '#404858'
        g.fillRect(4, 10, 4, 24)
        const fill = Math.round(p * 24)
        g.fillStyle = p > 0.72 ? '#f8d030' : p > 0.38 ? '#f05050' : '#78d8f8'
        g.fillRect(4, 34 - fill, 4, fill)
        const x = Math.round(castX(p))
        const arrow = ['0000000', '0111110', '.01110.', '..010..', '...0...']
        const tone = p > 0.72 ? '#f8d030' : p > 0.38 ? '#f86060' : '#ffffff'
        const ay = SURFACE - 12 + Math.round(Math.sin(clock * 10))
        arrow.forEach((row, ry) =>
          [...row].forEach((ch, rx) => {
            if (ch === '.') return
            g.fillStyle = ch === '0' ? '#181820' : tone
            g.fillRect(x - 3 + rx, ay + ry, 1, 1)
          }),
        )
        g.fillStyle = 'rgba(255,255,255,0.7)'
        g.fillRect(x - 4, SURFACE, 9, 1)
      }

      if (phase.kind === 'wait' && phase.t < 2.4 && !hinted) say(g, words().wait, W / 2, H - 22)

      if (phase.kind === 'bite' && bobber) {
        const img = EXCLAIM()
        const pop = phase.t < 0.08 ? 2 : 0
        g.drawImage(img, Math.round(bobber.x - img.width / 2), SURFACE - 26 - pop)
        if (Math.floor(phase.t * 8) % 2 === 0) say(g, words().bite, W / 2, H - 22, '#f8d030')
      }

      if (phase.kind === 'fight') drawBar(g, phase.fight)

      for (const f of floaters) {
        const k = f.age / 1.4
        g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1
        const lines = wrapText(f.text, W - 16)
        const big = f.text.startsWith('+')
        lines.forEach((l, i) => {
          const img = big ? null : pixelText(l, f.color)
          if (img) center(g, img, f.x < 50 ? 50 : f.x > W - 50 ? W - 50 : f.x, f.y - f.age * 10 + i * 12)
        })
        if (big) {
          const txt = textSprite(f.text, f.color)
          const k2 = 2
          g.drawImage(txt.canvas, txt.x, txt.y, txt.w, txt.h, Math.round(f.x - (txt.w * k2) / 2), Math.round(f.y - f.age * 6), txt.w * k2, txt.h * k2)
        }
        g.globalAlpha = 1
      }

      if (phase.kind === 'over') {
        g.fillStyle = `rgba(16,20,32,${Math.min(0.5, phase.t)})`
        g.fillRect(0, 0, W, H)
        say(g, words().time, W / 2, 56, '#f8d030')
        const score = textSprite(String(scoreOf(haul)), '#ffffff')
        const k = 3
        g.drawImage(score.canvas, score.x, score.y, score.w, score.h, Math.round(W / 2 - (score.w * k) / 2), 76, score.w * k, score.h * k)
      }
    }

    /** The reel's bar: the zone (green, red-rimmed when the line strains), the fish on it, the catch coming in, the line's tension. */
    const drawBar = (g: CanvasRenderingContext2D, f: Fight) => {
      const { x, y, w, h } = BAR
      // Holding pulls left, toward the dock: the bar reads right to left.
      const at = (v: number) => Math.round(x + w - v * w)
      g.fillStyle = '#181820'
      g.fillRect(x - 2, y - 2, w + 4, h + 4)
      g.fillStyle = '#1c4c80'
      g.fillRect(x - 1, y - 1, w + 2, h + 2)
      const zw = Math.round(widthOf(f) * w)
      const zx = at(f.zone) - zw
      const inside = inZone(f)
      g.fillStyle = inside ? '#60d060' : '#3a9a48'
      g.fillRect(zx, y, zw, h)
      g.fillStyle = inside ? '#a8f8a0' : '#68c070'
      g.fillRect(zx, y, zw, 1)
      if (f.tension > 0.6 && Math.floor(clock * 12) % 2 === 0) {
        g.fillStyle = '#f84848'
        g.fillRect(zx, y + h - 1, zw, 1)
      }
      const fishImg = FISH_ICON()
      const jit = f.runs > 0 ? Math.round(Math.sin(clock * 50)) : 0
      g.drawImage(fishImg, at(f.fish) - Math.floor(fishImg.width / 2) + jit, y + Math.floor((h - fishImg.height) / 2))
      // Progress, under the bar.
      g.fillStyle = '#181820'
      g.fillRect(x - 2, y + h + 2, w + 4, 4)
      g.fillStyle = '#f8d030'
      g.fillRect(x - 1, y + h + 3, Math.round(f.progress * (w + 2)), 2)
      // Tension, on the left: a gauge filling green to red.
      const gx = x - 14
      g.fillStyle = f.tension > 0.6 && Math.floor(clock * 10) % 2 === 0 ? '#f8f8f8' : '#181820'
      g.fillRect(gx, y - 4, 8, h + 10)
      g.fillStyle = '#2a3448'
      g.fillRect(gx + 1, y - 3, 6, h + 8)
      g.fillStyle = '#3a465c'
      for (let ty = y - 3; ty < y + h + 5; ty += 3) g.fillRect(gx + 1, ty, 6, 1)
      const fill = Math.round(f.tension * (h + 8))
      g.fillStyle = f.tension > 0.75 ? '#f84848' : f.tension > 0.45 ? '#f8c830' : '#60d060'
      g.fillRect(gx + 1, y + h + 5 - fill, 6, fill)
      if (f.tension > 0.75 && Math.floor(clock * 6) % 2 === 0) say(g, words().ease, W / 2, y - 16, '#ff8080')
      else if (!hinted && f.time < 3.5) say(g, words().reel, W / 2, y - 26)
      if (f.time >= 3.5) hinted = true
    }

    const draw = (g: CanvasRenderingContext2D) => {
      g.save()
      if (shake > 0) g.translate(Math.round((Math.random() - 0.5) * 4), Math.round((Math.random() - 0.5) * 3))
      drawSea(g)
      drawAngler(g)
      drawReveal(g)
      for (const p of particles) {
        g.fillStyle = p.color
        g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size)
      }
      g.restore()
      drawHud(g)
      if (flash > 0) {
        g.fillStyle = `rgba(255,255,255,${flash * 2})`
        g.fillRect(0, 0, W, H)
      }
    }

    const end = (): SoloEnd => ({
      score: scoreOf(haul),
      feats: featsOf(haul),
      log: {
        title: words().log,
        lines: logOf(haul).map((l) => {
          const c: CatchDef = CATCHES[l.id]
          return { icon: c.dex !== null ? portraitUrl(c.dex, c.shiny === true) : c.junk ? spriteUrl(JUNK[c.junk]()) : null, label: catchName(l.id), count: l.count, points: l.points }
        }),
      },
    })

    return {
      step,
      draw,
      over: () => (phase.kind === 'over' && phase.t >= T.over ? end() : null),
    }
  },
}

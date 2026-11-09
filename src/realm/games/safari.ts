import { openGift, stageGifts } from '../../account'
import { PLAYABLE, type HatchlingId } from '../../data/hatchlings'
import { habitatPool, safariForm, type SafariHabitat } from '../../data/safari'
import { playCry, playSfx } from '../../engine/audio'
import { formatPokeDollars, t } from '../../i18n'
import type { SafariActed, SafariSession, SafariShape, SafariState } from '../../net/realmApi'
import { cryUrl, drawPokemon, loadSpecies, portraitUrl, sprites } from '../../render/sprites'
import type { Dir8 } from '../../engine/math'
import { h } from '../../ui/dom'
import { loadSave } from '../../ui/save'
import { isFailure } from '../api'
import { actSafari, fetchSafari, startSafari } from '../safariApi'
import { arcadeSize, burst, drawCentered, drawFx, drawIcon, drawText, image, plate, stepFx, type Particle, type Popup } from './arcadeKit'
import type { GameInput, GameRun, SoloCtx, SoloGame } from './frame'
import { SAFARI, sessionPrice, shareOf, type SafariAction } from './safari.rules'

/**
 * The Zona Safári (`MINIGAMES.safari`): the week's habitat, its odds shown up
 * front, then a walk through its bushes. The API charges the session and rolls
 * everything (`safariApi.ts`, `safari.rules.ts`); this only animates the
 * answer, and waits for it before any ball lands. A silhouette is all a bush
 * shows until it's approached. The moment of the feature is the catch: the
 * ball's arc, its shakes, and for a new family a capture scene right here, no
 * egg and no walking. Words live in the panel over the stage, as in the claw.
 *
 * Touch: tap a bush, then the panel's buttons. Keys: arrows pick a bush, Enter
 * or Space walks up to it; in an encounter 1 throws a ball, 2 gives a berry, 3 leaves.
 */

const SIZES = { tall: { w: 176, h: 184 }, wide: { w: 300, h: 160 } } as const

/** Each backdrop is 320 × 176, the top of it the horizon. */
const BACKDROP = { w: 320, h: 176 } as const

/** Where the bushes stand (the bottom middle of each), per layout. */
const BUSHES = {
  tall: [
    { x: 36, y: 104 },
    { x: 140, y: 96 },
    { x: 88, y: 132 },
    { x: 36, y: 168 },
    { x: 140, y: 162 },
  ],
  wide: [
    { x: 46, y: 98 },
    { x: 150, y: 84 },
    { x: 254, y: 98 },
    { x: 98, y: 138 },
    { x: 206, y: 138 },
  ],
} as const

/** Where the Pokémon stands and a ball is thrown from. The wide layout keeps left of the panel. */
const STAGE = {
  tall: { mon: { x: 88, y: 132 }, hand: { x: 88, y: 180 }, floor: 184 },
  wide: { mon: { x: 92, y: 118 }, hand: { x: 92, y: 172 }, floor: 160 },
} as const

/** Seconds each beat lasts. */
const TIMES = { walk: 0.35, reveal: 0.75, fly: 0.55, absorb: 0.3, fall: 0.28, shake: 0.6, click: 0.75, burst: 0.32, flee: 0.7, toss: 0.5, eat: 0.75, repeat: 1.4 } as const

/** How far above the ground a thrown ball peaks. */
const ARC = 58

/** What a bush's reach is for a tap. */
const BUSH_REACH = 30

type Phase = 'load' | 'gate' | 'busy' | 'field' | 'walk' | 'reveal' | 'meet' | 'throw' | 'absorb' | 'fall' | 'wait' | 'shake' | 'click' | 'burst' | 'flee' | 'toss' | 'eat' | 'scene' | 'repeat' | 'over'

const SIZE = () => arcadeSize(SIZES.tall, SIZES.wide)

let shown: { w: number; h: number } = SIZE()

const silhouettes = new Map<string, HTMLCanvasElement>()

/** A shape from the API as a dark cutout, cached by its bits. */
const silhouette = (shape: SafariShape) => {
  const hit = silhouettes.get(shape.bits)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = shape.w + 2
  c.height = shape.h + 2
  const g = c.getContext('2d')!
  const bytes = Uint8Array.from(atob(shape.bits), (ch) => ch.charCodeAt(0))
  const on = (x: number, y: number) => {
    const i = y * shape.w + x
    return x >= 0 && y >= 0 && x < shape.w && y < shape.h && ((bytes[i >> 3]! >> (i & 7)) & 1) === 1
  }
  // A thin light rim first, so the shape reads on the dark habitats too, then the dark body.
  g.fillStyle = 'rgba(232,240,232,0.55)'
  for (let y = -1; y <= shape.h; y++) for (let x = -1; x <= shape.w; x++) if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) g.fillRect(x + 1, y + 1, 1, 1)
  g.fillStyle = '#10161c'
  for (let y = 0; y < shape.h; y++) for (let x = 0; x < shape.w; x++) if (on(x, y)) g.fillRect(x + 1, y + 1, 1, 1)
  silhouettes.set(shape.bits, c)
  return c
}

const start = (ctx: SoloCtx): GameRun => {
  const size = shown
  const layout = size.h > size.w ? 'tall' : 'wide'
  const stage = STAGE[layout]
  const spots = BUSHES[layout]
  const m = () => t().minigames.safari
  const panel = h('div', { class: 'claw-panel safari-panel box hidden' })
  const sheet = h('div', { class: 'safari-sheet hidden' })
  ctx.stage.append(panel, sheet)

  let phase: Phase = 'load'
  let phaseT = 0
  let clock = 0
  let view: SafariState | null = null
  let session: SafariSession | null = null
  /** The answer to the action in flight; null while it's on its way. */
  let reply: SafariActed | null = null
  let family: HatchlingId | null = null
  let shiny = false
  let picked = 0
  let hover: number | null = null
  let shakesDone = 0
  let shakeAt = 0
  /** The bush a Pokémon just came out of, drawn parting. */
  let parted: number | null = null
  let confirmEnd = false
  let disposed = false
  const parts: Particle[] = []
  const pops: Popup[] = []

  const go = (next: Phase) => {
    phase = next
    phaseT = 0
  }

  const habitat = (): SafariHabitat => session?.habitat ?? view?.habitat ?? 'meadow'
  const nameOf = (id: HatchlingId) => safariForm(id).name
  const lacks = (id: HatchlingId) => loadSave().hatched[id] === undefined

  const say = (lines: readonly (HTMLElement | false)[], actions: readonly { label: string; run: () => void; quiet?: boolean; hot?: boolean }[] = [], slim = false) => {
    panel.classList.toggle('hidden', lines.length === 0 && actions.length === 0)
    panel.classList.toggle('safari-slim', slim)
    panel.replaceChildren(
      ...lines.flatMap((l) => (l ? [l] : [])),
      ...(actions.length > 0 ? [h('div', { class: 'claw-panel-actions' }, ...actions.map((a) => h('button', { class: a.hot ? 'box safari-hot' : 'box', type: 'button', onclick: () => (playSfx('select'), a.run()) }, a.label)))] : []),
    )
  }

  const trouble = (error: string) => {
    go('busy')
    const w = m()
    const text = error === 'cap' ? w.cap : error === 'funds' ? w.funds : error === 'profile' ? w.profile : w.failed
    say([h('p', {}, text)], [{ label: w.retry, run: () => void load() }])
  }

  /* ---------------- The gate: the odds, before anything is charged ---------------- */

  const sessionCost = () => (view ? sessionPrice(view.used) : null)

  /** The panel of the odds: each family's share for this partner, the rarest last, those the account lacks tagged. */
  const oddsGrid = (at: SafariHabitat, partner: SafariState['partner']) => {
    const partnerTypes = partner ? PLAYABLE[partner].line[0].types : []
    const rows = shareOf(habitatPool(at), partnerTypes).sort((a, b) => b.share - a.share)
    return h(
      'ul',
      { class: 'safari-odds' },
      ...rows.map((entry) => {
        const form = safariForm(entry.family)
        return h(
          'li',
          { class: `safari-odd safari-odd-${entry.rarity}` },
          h('img', { src: portraitUrl(form.dex), alt: '', width: 40, height: 40, loading: 'lazy' }),
          h('span', { class: 'safari-odd-name' }, form.name),
          h('b', {}, `${(entry.share * 100).toFixed(1)}%`),
          lacks(entry.family) && h('em', {}, m().fresh),
        )
      }),
    )
  }

  const showGate = () => {
    if (!view) return
    const w = m()
    const at = view.habitat
    const price = sessionCost()
    const affordable = price !== null && price <= loadSave().wallet
    const partner = view.partner
    sheet.replaceChildren(
      h(
        'div',
        { class: 'safari-sheet-scroll' },
        h('p', { class: 'safari-eyebrow' }, w.thisWeek),
        h('h3', {}, w.habitats[at].name),
        h('p', {}, w.habitats[at].blurb),
        partner && h('p', { class: 'safari-partner' }, w.partner(PLAYABLE[partner].line[0].name)),
        oddsGrid(at, partner),
        h('p', {}, w.rules(SAFARI.balls, SAFARI.berries)),
        h('p', { class: 'safari-sure' }, view.sure ? w.sureNow : w.sureIn(Math.max(0, SAFARI.guarantee - view.dry))),
        h('small', {}, w.today(view.used, SAFARI.dailyCap)),
      ),
      h(
        'div',
        { class: 'safari-sheet-cta' },
        price === null
          ? h('p', {}, w.cap)
          : !affordable
            ? h('p', {}, w.funds)
            : h('button', { class: 'box safari-hot', type: 'button', onclick: () => (playSfx('select'), void enter()) }, price === 0 ? w.free : w.paid(formatPokeDollars(price))),
      ),
    )
    sheet.classList.remove('hidden')
    say([])
    go('gate')
  }

  const enter = async () => {
    if (!view) return
    sheet.classList.add('hidden')
    go('busy')
    const got = await startSafari(view.used)
    if (disposed) return
    if (isFailure(got)) return trouble(got.error)
    view = { ...view, used: got.used }
    session = got.session
    playSfx('coin')
    toField()
  }

  const load = async () => {
    go('load')
    say([])
    sheet.classList.add('hidden')
    const got = await fetchSafari()
    if (disposed) return
    if (isFailure(got)) return trouble(got.error)
    view = got
    session = got.open
    if (!session) return showGate()
    // A session left open: pick up where it stopped.
    if (session.encounter) meet(session.encounter.family, session.encounter.shiny)
    else toField()
  }

  /* ---------------- The field ---------------- */

  const firstOpen = () => Math.max(0, session?.bushes.findIndex((b) => !b.done) ?? 0)

  const toField = () => {
    if (session?.over) return finish()
    family = null
    parted = null
    picked = firstOpen()
    go('field')
    fieldPanel()
  }

  const fieldPanel = () => {
    const w = m()
    say(
      [h('p', {}, session?.bushes.some((b) => b.sure && !b.done) ? w.pickSure : w.pick)],
      [{ label: confirmEnd ? w.endSure : w.end, run: () => (confirmEnd ? ((confirmEnd = false), doAct({ kind: 'finish' })) : ((confirmEnd = true), fieldPanel())) }],
      true,
    )
  }

  /** Sends an action; `reply` holds the answer when it lands. A failure leaves the session where it was. */
  const send = (action: SafariAction, then?: (got: SafariActed) => void) => {
    if (!session) return
    reply = null
    void actSafari(session, action).then((got) => {
      if (disposed) return
      if (isFailure(got)) return trouble(got.error)
      reply = got
      session = got.session
      then?.(got)
    })
  }

  /** An action with nothing to animate: answers and goes on. */
  const doAct = (action: SafariAction) => {
    go('busy')
    say([])
    send(action, () => toField())
  }

  const approach = (bush: number) => {
    if (phase !== 'field' || !session || session.bushes[bush]?.done) return
    confirmEnd = false
    picked = bush
    parted = bush
    go('walk')
    say([])
    playSfx('move')
    send({ kind: 'approach', bush }, (got) => {
      if (got.turn.kind === 'appear') {
        family = got.turn.family
        shiny = got.turn.shiny
        loadForm(got.turn.family, got.turn.shiny)
      }
    })
  }

  const loadForm = (id: HatchlingId, sh: boolean) => {
    const { dex } = safariForm(id)
    void loadSpecies(dex).catch(() => {})
    if (sh) void loadSpecies(dex, true).catch(() => {})
  }

  /* ---------------- An encounter ---------------- */

  const meet = (id: HatchlingId, sh: boolean) => {
    family = id
    shiny = sh
    loadForm(id, sh)
    go('meet')
    meetPanel()
  }

  const meetPanel = () => {
    if (!family || !session) return
    const w = m()
    const encounter = session.encounter
    const calm = encounter?.calm ?? 0
    say(
      [
        h('h3', {}, shiny ? w.wildShiny(nameOf(family)) : w.wild(nameOf(family))),
        lacks(family) ? h('p', { class: 'safari-sure' }, w.isNew) : h('p', {}, w.owned),
        calm > 0 && h('p', {}, w.calm(calm, SAFARI.maxCalm)),
      ],
      [
        { label: w.ball(session.balls), run: throwBall, hot: true },
        ...(session.berries > 0 ? [{ label: w.berry(session.berries), run: giveBerry }] : []),
        { label: w.leave, run: leaveIt },
      ],
    )
  }

  const throwBall = () => {
    if (phase !== 'meet' || !session || session.balls === 0) return
    go('throw')
    say([])
    playSfx('move')
    send({ kind: 'ball' })
  }

  const giveBerry = () => {
    if (phase !== 'meet' || !session || session.berries === 0) return
    go('toss')
    say([])
    send({ kind: 'berry' })
  }

  const leaveIt = () => {
    if (phase !== 'meet') return
    doAct({ kind: 'leave' })
  }

  /** What's next once a ball broke or a berry was eaten: it runs, the session ran out, or it's the player's move again. */
  const afterTurn = (fled: boolean) => {
    if (fled) {
      go('flee')
      playSfx('denied')
      return say([h('p', {}, m().fled(family ? nameOf(family) : ''))])
    }
    if (session?.over) return toField()
    go('meet')
    meetPanel()
  }

  const finish = () => {
    go('over')
    const w = m()
    const caught = session?.catches ?? []
    sheet.classList.add('hidden')
    say(
      [
        h('h3', {}, w.done),
        h('p', {}, caught.length === 0 ? w.none : w.caughtList(caught.map((c) => nameOf(c.family)).join(', '))),
      ],
      [{ label: w.again, run: () => ((session = null), void load()), hot: true }],
    )
  }

  /** What a catch brings: the gift lands on the save now, and a new family gets its scene. */
  const land = (got: SafariActed) => {
    const out = got.gift ? (stageGifts([got.gift]), openGift(got.gift.id)) : null
    const hatch = out?.status === 'applied' ? out.hatch : null
    if (hatch && !hatch.duplicate) {
      ctx.brag(hatch.shiny ? 'shiny' : 'caught')
      playCry(cryUrl(safariForm(hatch.id).dex), 0.5)
      playSfx(hatch.shiny ? 'shiny' : 'unlock')
      go('scene')
      parts.length = 0
      const w = m()
      say(
        [
          h('h3', {}, hatch.shiny ? w.caughtShiny(nameOf(hatch.id)) : w.caught(nameOf(hatch.id))),
          h('p', {}, w.joined),
        ],
        [{ label: w.ok, run: () => toField(), hot: true }],
      )
      return
    }
    const refund = hatch?.refund ?? 0
    go('repeat')
    pops.push({ x: stage.mon.x, y: stage.mon.y - 60, text: refund > 0 ? `+P${refund}` : m().repeatShort, color: '#ffe080', age: 0, big: true })
    say([h('p', {}, refund > 0 ? m().repeat(nameOf(got.turn.kind === 'ball' ? got.turn.family : family!), formatPokeDollars(refund)) : m().repeatNone)])
  }

  /* ---------------- The loop ---------------- */

  const bushAt = (x: number, y: number) => {
    let best: number | null = null
    let bestD: number = BUSH_REACH
    spots.forEach((s, i) => {
      if (session?.bushes[i]?.done) return
      const d = Math.hypot(x - s.x, y - (s.y - 12))
      if (d < bestD) {
        best = i
        bestD = d
      }
    })
    return best
  }

  const step = (dt: number, input: GameInput) => {
    clock += dt
    phaseT += dt
    stepFx(parts, pops, dt)
    switch (phase) {
      case 'field': {
        hover = bushAt(input.pointer.x, input.pointer.y)
        if (input.pointer.pressed && hover !== null) return approach(hover)
        const open = spots.map((_, i) => i).filter((i) => !session?.bushes[i]?.done)
        const at = open.indexOf(picked)
        if (input.pressed('ArrowRight') || input.pressed('KeyD')) picked = open[(at + 1) % open.length] ?? picked
        if (input.pressed('ArrowLeft') || input.pressed('KeyA')) picked = open[(at - 1 + open.length) % open.length] ?? picked
        if (input.pressed('Enter') || input.pressed('Space')) approach(picked)
        break
      }
      case 'walk':
        if (phaseT >= TIMES.walk && reply && family) {
          go('reveal')
          playCry(cryUrl(safariForm(family).dex), 0.4)
          burst(parts, stage.mon.x, stage.mon.y - 8, ['#a8d868', '#70b040', '#e8f8a0'], 14, 60)
        }
        break
      case 'reveal':
        if (phaseT >= TIMES.reveal && family) {
          go('meet')
          meetPanel()
        }
        break
      case 'meet':
        if (input.pressed('Digit1') || input.pressed('KeyZ')) throwBall()
        else if (input.pressed('Digit2')) giveBerry()
        else if (input.pressed('Digit3') || input.pressed('KeyX')) leaveIt()
        break
      case 'throw':
        if (phaseT >= TIMES.fly) {
          go('absorb')
          playSfx('hit')
          burst(parts, stage.mon.x, stage.mon.y - 20, ['#ffffff', '#ffe080', '#a0e8ff'], 22, 110)
        }
        break
      case 'absorb':
        if (phaseT >= TIMES.absorb) go('fall')
        break
      case 'fall':
        if (phaseT >= TIMES.fall) {
          go('wait')
          playSfx('tick')
        }
        break
      case 'wait':
        // The ball sits still until the API has answered.
        if (reply?.turn.kind === 'ball') {
          shakesDone = 0
          shakeAt = 0
          go('shake')
        }
        break
      case 'shake': {
        if (reply?.turn.kind !== 'ball') break
        const shakes = reply.turn.shakes
        if (shakesDone < shakes && phaseT - shakeAt >= TIMES.shake) {
          shakesDone += 1
          shakeAt = phaseT
          playSfx('tick')
        }
        if (shakesDone >= shakes && phaseT - shakeAt >= TIMES.shake) {
          if (reply.turn.caught) {
            go('click')
            playSfx('unlock')
            burst(parts, stage.mon.x, stage.mon.y - 10, ['#ffe080', '#ffffff', '#f8c030'], 26, 100)
          } else {
            go('burst')
            playSfx('denied')
            burst(parts, stage.mon.x, stage.mon.y - 10, ['#ffffff', '#ff9090', '#ffe0a0'], 22, 120)
          }
        }
        break
      }
      case 'click':
        if (phaseT >= TIMES.click && reply) land(reply)
        break
      case 'burst':
        if (phaseT >= TIMES.burst && reply?.turn.kind === 'ball') {
          afterTurn(reply.turn.fled)
        }
        break
      case 'toss':
        if (phaseT >= TIMES.toss) {
          if (reply?.turn.kind === 'berry') {
            go('eat')
            playSfx('pickup')
            for (let i = 0; i < 4; i++) pops.push({ x: stage.mon.x - 14 + i * 9, y: stage.mon.y - 56 - i * 3, text: '+', color: '#ff90b0', age: -i * 0.12, big: false })
          }
        }
        break
      case 'eat':
        if (phaseT >= TIMES.eat && reply?.turn.kind === 'berry') {
          afterTurn(reply.turn.fled)
        }
        break
      case 'flee':
        if (phaseT >= TIMES.flee) {
                toField()
        }
        break
      case 'repeat':
        if (phaseT >= TIMES.repeat) toField()
        break
      case 'scene':
        if (Math.random() < dt * 22) burst(parts, stage.mon.x + (Math.random() * 60 - 30), stage.mon.y - 20 - Math.random() * 50, shiny ? ['#ffffff', '#ffe878', '#a8f0ff', '#ffa8e0'] : ['#ffe888', '#ffffff'], 2, 26, -20)
        break
      default:
    }
  }

  /* ---------------- Drawing ---------------- */

  const drawBackdrop = (g: CanvasRenderingContext2D) => {
    g.fillStyle = '#20242c'
    g.fillRect(0, 0, size.w, size.h)
    const art = image(`safari/bg-${habitat()}`)
    if (art) g.drawImage(art, Math.round((size.w - BACKDROP.w) / 2), layout === 'tall' ? 0 : size.h - BACKDROP.h)
    if (layout === 'tall') {
      g.fillStyle = '#20242c'
      g.fillRect(0, stage.floor, size.w, size.h - stage.floor)
    }
  }

  /** How far (px) a bush sways now: rustling a bit, more when it's the one picked. */
  const swayOf = (i: number, active: boolean) => {
    const beat = Math.sin(clock * 3 + i * 2) > 0.65
    return beat || active ? Math.round(Math.sin(clock * 22 + i) * (active ? 2 : 1)) : 0
  }

  const drawBush = (g: CanvasRenderingContext2D, i: number) => {
    const b = session?.bushes[i]
    const p = spots[i]
    if (!b || !p) return
    const bush = image(`safari/bush-${habitat()}`)
    const active = phase === 'field' && (i === picked || i === hover)
    const sway = b.done ? 0 : swayOf(i, active)
    const bushH = bush?.height ?? 34
    if (!b.done) {
      const s = silhouette(b.shape)
      // Most of it stands above the leaves, whatever its size.
      g.drawImage(s, Math.round(p.x - s.width / 2) + sway, Math.round(p.y - bushH - s.height * 0.72))
    }
    if (bush) g.drawImage(bush, Math.round(p.x - bush.width / 2) + (b.done ? 0 : sway), Math.round(p.y - bush.height))
    if (b.done) return
    if (b.sure) {
      // The guarantee's bush shines: a gold ring on the ground and sparks twinkling over it.
      g.fillStyle = 'rgba(255,214,90,0.5)'
      for (let k = -24; k <= 24; k++) {
        const up = Math.round(Math.sqrt(1 - (k / 25) ** 2) * 6)
        g.fillRect(p.x + k, p.y - 3 - up, 1, 1)
        g.fillRect(p.x + k, p.y - 3 + up, 1, 1)
      }
      for (let k = 0; k < 5; k++) {
        const lit = Math.floor(clock * 5 + k * 2) % 3 !== 0
        const x = p.x - 24 + k * 12
        const y = p.y - bushH + (k % 2) * 10 - 2
        g.fillStyle = lit ? '#fff0a0' : '#e8b030'
        g.fillRect(x - 1, y, 3, 1)
        g.fillRect(x, y - 1, 1, 3)
      }
    }
    if (active) {
      const y = p.y - bushH - 18 + (Math.floor(clock * 4) % 2)
      g.fillStyle = '#ffffff'
      for (let k = 0; k < 4; k++) g.fillRect(p.x - k, y + k, k * 2 + 1, 1)
    }
  }

  const drawHud = (g: CanvasRenderingContext2D) => {
    if (!session) return
    plate(g, 3, 3, 66, 26)
    const ball = image('safari/ball')
    if (ball) g.drawImage(ball, 5, 5)
    drawText(g, String(session.balls), 30, 12, '#ffffff')
    const berry = image('safari/berry')
    if (berry) g.drawImage(berry, 40, 5)
    drawText(g, String(session.berries), 60, 12, '#ffffff')
  }

  const drawMon = (g: CanvasRenderingContext2D, x: number, y: number, opts: { flash?: number; alpha?: number; scale?: number; anim?: 'Idle' | 'Walk'; dir?: Dir8 } = {}) => {
    if (!family) return
    const { dex } = safariForm(family)
    const s = shiny ? sprites(dex, true) : sprites(dex)
    g.fillStyle = 'rgba(24,20,40,0.4)'
    g.fillRect(Math.round(x - 20), Math.round(y - 2), 40, 5)
    drawPokemon(g, s, opts.anim ?? 'Idle', opts.dir ?? 0, clock, Math.round(x), Math.round(y), { scale: opts.scale ?? 2, flash: opts.flash ?? 0, alpha: opts.alpha ?? 1 })
  }

  /** The thrown ball's place along its arc, at `k` 0..1. */
  const arcAt = (k: number) => {
    const from = stage.hand
    const to = { x: stage.mon.x, y: stage.mon.y - 26 }
    const lift = 4 * ARC * k * (1 - k)
    return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k - lift }
  }

  const drawBall = (g: CanvasRenderingContext2D, x: number, y: number, flipped = false) => {
    const ball = image('safari/ball')
    if (!ball) return
    if (flipped) {
      g.save()
      g.translate(Math.round(x), Math.round(y))
      g.scale(1, -1)
      g.drawImage(ball, Math.round(-ball.width / 2), Math.round(-ball.height / 2))
      g.restore()
    } else drawCentered(g, ball, x, y)
  }

  const drawScene = (g: CanvasRenderingContext2D) => {
    const { mon } = stage
    g.fillStyle = 'rgba(12,14,28,0.7)'
    g.fillRect(0, 0, size.w, stage.floor)
    const grow = Math.min(1, phaseT / 0.5)
    const beam = Math.round(18 + 34 * grow)
    g.fillStyle = 'rgba(255,240,170,0.22)'
    g.fillRect(mon.x - beam, 0, beam * 2, mon.y)
    g.fillStyle = 'rgba(255,248,210,0.3)'
    g.fillRect(mon.x - Math.round(beam * 0.55), 0, Math.round(beam * 1.1), mon.y)
    g.fillStyle = '#f8e088'
    for (let r = 0; r < 34; r++) {
      const span = Math.round(Math.sqrt(1 - (r / 34) ** 2) * 10)
      g.fillRect(mon.x - r, mon.y - span, r * 2, 1)
      if (span > 0) g.fillRect(mon.x - r, mon.y + span, r * 2, 1)
    }
    const hop = phaseT < 0.5 ? Math.round(Math.sin((phaseT / 0.5) * Math.PI) * 14) : 0
    // Small Pokémon stand bigger in the light: the moment should fill the screen.
    const fw = family ? (shiny ? sprites(safariForm(family).dex, true) : sprites(safariForm(family).dex)).anims.Idle?.fw ?? 48 : 48
    drawMon(g, mon.x, mon.y - hop, { flash: phaseT < 0.15 ? 1 : 0, scale: fw <= 40 ? 3 : 2 })
  }

  const draw = (g: CanvasRenderingContext2D) => {
    drawBackdrop(g)
    const { mon, hand } = stage
    const inField = phase === 'field' || phase === 'walk' || phase === 'busy' || phase === 'load' || phase === 'gate'

    if (session && (inField || phase === 'reveal')) for (const i of spots.map((_, k) => k).sort((a, b) => spots[a]!.y - spots[b]!.y)) drawBush(g, i)

    if (phase === 'reveal') {
      const k = Math.min(1, phaseT / TIMES.reveal)
      const from = spots[parted ?? 0]!
      const px = from.x + (mon.x - from.x) * k
      const py = from.y + (mon.y - from.y) * k - Math.sin(k * Math.PI) * 30
      drawMon(g, px, py, { flash: 1 - k, scale: 1 + Math.round(k) })
    }

    if (phase === 'meet' || phase === 'toss' || phase === 'eat') drawMon(g, mon.x, mon.y)

    if (phase === 'throw') {
      drawMon(g, mon.x, mon.y)
      const p = arcAt(Math.min(1, phaseT / TIMES.fly))
      drawBall(g, p.x, p.y, Math.floor(phaseT * 14) % 2 === 0)
    }

    if (phase === 'absorb') {
      if (phaseT < TIMES.absorb * 0.55) drawMon(g, mon.x, mon.y, { flash: 1, alpha: 1 - phaseT / (TIMES.absorb * 0.55) })
      drawBall(g, mon.x, mon.y - 26 - Math.sin((phaseT / TIMES.absorb) * Math.PI) * 6)
    }

    if (phase === 'fall') drawBall(g, mon.x, mon.y - 26 + (22 * phaseT) / TIMES.fall)

    if (phase === 'wait' || phase === 'shake' || phase === 'click') {
      const moving = phase === 'shake' && phaseT - shakeAt < TIMES.shake * 0.5
      const wobble = moving ? Math.round(Math.sin((phaseT - shakeAt) * 26) * 3) : 0
      g.fillStyle = 'rgba(24,20,40,0.4)'
      g.fillRect(mon.x - 9, mon.y - 3, 18, 4)
      drawBall(g, mon.x + wobble, mon.y - 4)
      if (phase === 'click') {
        g.fillStyle = '#ffe080'
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + clock * 3
          g.fillRect(Math.round(mon.x + Math.cos(a) * 18), Math.round(mon.y - 8 + Math.sin(a) * 10), 2, 2)
        }
      }
    }

    if (phase === 'burst') drawMon(g, mon.x, mon.y, { flash: 1 - phaseT / TIMES.burst })

    if (phase === 'flee') {
      const k = phaseT / TIMES.flee
      drawMon(g, mon.x + k * k * 170, mon.y - Math.abs(Math.sin(k * 18)) * 5, { anim: 'Walk', dir: 2, alpha: 1 - k * 0.3 })
    }

    if (phase === 'toss') {
      const k = Math.min(1, phaseT / TIMES.toss)
      const berry = image('safari/berry')
      if (berry) drawCentered(g, berry, hand.x + (mon.x - hand.x) * k, hand.y + (mon.y - 22 - hand.y) * k - 4 * 36 * k * (1 - k))
    }

    if (phase === 'scene') drawScene(g)

    // Calm shows as hearts over the Pokémon.
    if ((phase === 'meet' || phase === 'toss' || phase === 'eat') && session?.encounter && session.encounter.calm > 0) {
      for (let i = 0; i < session.encounter.calm; i++) drawIcon(g, 'heart', mon.x - 8 + i * 9, mon.y - 70)
    }

    drawFx(g, parts, pops)
    if (session && phase !== 'scene' && phase !== 'gate') drawHud(g)
  }

  void load()

  return {
    step,
    draw,
    // A session lasts until it's closed: the frame claims nothing here.
    over: () => null,
    dispose: () => {
      disposed = true
      panel.remove()
      sheet.remove()
    },
  }
}

/** The Zona Safári (`MINIGAMES.safari`); the field fits the way the phone is held. */
export const safari: SoloGame = {
  get size() {
    return (shown = SIZE())
  },
  start,
}

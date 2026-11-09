import { openGift, stageGifts } from '../../account'
import { PLAYABLE, type HatchlingId } from '../../data/hatchlings'
import { habitatPool, safariEntry, safariForm, type SafariHabitat } from '../../data/safari'
import { PLAZA, SAFARI_MAPS, TILE } from '../../data/safariMaps'
import { playSfx } from '../../engine/audio'
import { formatPokeDollars, t } from '../../i18n'
import type { SafariActed, SafariSession, SafariState } from '../../net/realmApi'
import { loadSpecies, portraitUrl } from '../../render/sprites'
import { h } from '../../ui/dom'
import { loadSave } from '../../ui/save'
import { isFailure } from '../api'
import { actSafari, fetchSafari, startSafari } from '../safariApi'
import { image, partnerDex } from './arcadeKit'
import type { GameInput, GameRun, SoloCtx, SoloGame } from './frame'
import { SAFARI, sessionPrice, shareOf, type SafariAction, type SafariRarity } from './safari.rules'
import { THEMES, drawGrassWipe } from './safariArt'
import { createBattle, layoutBattle, type Battle, type BattleHost } from './safariBattle'
import { createField, type Field } from './safariField'
import { buildWorld } from './safariWorld'

/**
 * The Zona Safári (`MINIGAMES.safari`): a preserve the partner walks. The
 * Ranger's booth at the gate takes the session (the API charges it), the notice
 * board shows who lives here, and the tall grass does the rest: a rustle asks
 * the API for the next encounter in line and opens a battle
 * (`safariBattle.ts`), the map being `safariField.ts`. The canvas follows the
 * stage (`fluid`), and every word is DOM over it, sized from the canvas's scale.
 *
 * Touch: a floating stick anywhere on the map, buttons in battle. Keys: arrows
 * or WASD walk; 1, 2, 3 or arrows and Enter pick a command.
 */

type Phase = 'load' | 'lobby' | 'busy' | 'gate' | 'walk' | 'alert' | 'wipeIn' | 'battle' | 'wipeOut' | 'report' | 'trouble'

const WIPE = 0.55
const ALERT = 0.72
const GATE_WALK = 1.05

/** What the dev hooks (`ps.safari`) reach of the running game. */
export const safariDev: { run: { phase: () => Phase; battle: () => string | null; rustle: () => void } | null } = { run: null }

const LEVEL_BASE: Record<SafariRarity, number> = { common: 7, rare: 15, ultra: 24, special: 20 }

/** The level a wild Pokémon wears: only its nameplate reads it. */
const wildLevel = (family: HatchlingId, rarity: SafariRarity, seen: number) => {
  let hash = seen * 31
  for (let i = 0; i < family.length; i++) hash = (hash * 33 + family.charCodeAt(i)) | 0
  return LEVEL_BASE[rarity] + (Math.abs(hash) % 8)
}

const start = (ctx: SoloCtx): GameRun => {
  const m = () => t().minigames.safari
  const dex = partnerDex(ctx.partner)
  const partnerName = Object.hasOwn(PLAYABLE, ctx.partner) ? PLAYABLE[ctx.partner as keyof typeof PLAYABLE].line[0].name : 'Pikachu'

  const textEl = h('p', {})
  const smallEl = h('small', {})
  const face = h('img', { class: 'sz-face hidden', src: portraitUrl(115), alt: '', width: 40, height: 40 })
  const box = h('div', { class: 'sz-text box hidden', onclick: () => finishTyping() }, face, h('div', { class: 'sz-text-body' }, textEl, smallEl))
  const cmds = h('div', { class: 'sz-cmds hidden' })
  const pouch = h('div', { class: 'sz-pouch hidden' })
  const endBtn = h('button', { class: 'sz-end box hidden', type: 'button', onclick: () => endSession() }, '')
  const readBtn = h('button', { class: 'sz-read box hidden', type: 'button', onclick: () => openBoard() }, '')
  const wildTag = h('div', { class: 'sz-tag hidden' })
  const nearTag = h('div', { class: 'sz-tag sz-tag-near hidden' })
  const board = h('div', { class: 'sz-board hidden' })
  const report = h('div', { class: 'sz-report box hidden' })
  const hud = h('div', { class: 'sz-hud' }, pouch, endBtn, readBtn, wildTag, nearTag, box, cmds, board, report)
  ctx.stage.append(hud)

  let phase: Phase = 'load'
  let phaseT = 0
  let view: SafariState | null = null
  let session: SafariSession | null = null
  let field: Field | null = null
  let battle: Battle | null = null
  let habitat: SafariHabitat = 'meadow'
  let said = ''
  let shown = 0
  let disposed = false
  let confirmEnd = false
  let seen = 0
  /** The answer that opens the next battle, and whether its Pokémon's sprites are in. */
  let meeting: { acted: SafariActed; ready: boolean } | null = null
  let canvasK = 2
  let cursor = 0
  let cmdActions: (() => void)[] = []
  let hintLeft = 0
  let lastKey = ''
  let wildCalm = 0

  const go = (next: Phase) => {
    phase = next
    phaseT = 0
  }

  const lacks = (id: HatchlingId) => loadSave().hatched[id] === undefined

  /* ---------------- Words ---------------- */

  const say = (text: string, small = '') => {
    said = text
    shown = 0
    textEl.textContent = ''
    smallEl.textContent = small
    box.classList.toggle('hidden', text === '')
  }
  const typed = () => shown >= said.length
  const finishTyping = () => {
    shown = said.length
    textEl.textContent = said
  }
  const stepWords = (dt: number) => {
    if (shown >= said.length) return
    shown = Math.min(said.length, shown + dt * 46)
    textEl.textContent = said.slice(0, Math.floor(shown))
  }

  /** Puts up command buttons; `actions[i]` runs on a tap or on its number key. */
  const commands = (items: readonly { label: string; icon?: string; run: () => void; hot?: boolean; off?: boolean }[]) => {
    cursor = 0
    cmdActions = items.map((c) => c.run)
    cmds.classList.toggle('hidden', items.length === 0)
    cmds.replaceChildren(
      ...items.map((c, i) =>
        h(
          'button',
          { class: `box${c.hot ? ' sz-hot' : ''}${i === 0 ? ' sz-sel' : ''}`, type: 'button', disabled: c.off === true, onclick: () => (playSfx('select'), c.run()) },
          c.icon ? h('img', { src: c.icon, alt: '', width: 22, height: 22 }) : false,
          c.label,
        ),
      ),
    )
  }

  const moveCursor = (by: number) => {
    const buttons = [...cmds.querySelectorAll('button')]
    if (buttons.length === 0) return
    buttons[cursor]?.classList.remove('sz-sel')
    cursor = (cursor + by + buttons.length) % buttons.length
    buttons[cursor]?.classList.add('sz-sel')
    playSfx('move', 80)
  }

  const trouble = (error: string) => {
    go('trouble')
    const w = m()
    const text = error === 'cap' ? w.cap : error === 'funds' ? w.funds : error === 'profile' ? w.profile : w.failed
    face.classList.add('hidden')
    say(text)
    commands([{ label: w.retry, run: () => void load(), hot: true }])
  }

  /* ---------------- The HUD ---------------- */

  const refreshPouch = () => {
    if (!session) return
    pouch.classList.remove('hidden')
    pouch.replaceChildren(
      h('span', {}, h('img', { src: `${import.meta.env.BASE_URL}assets/safari/ball.png`, alt: '', width: 16, height: 16 }), String(session.balls)),
      h('span', {}, h('img', { src: `${import.meta.env.BASE_URL}assets/safari/berry.png`, alt: '', width: 14, height: 16 }), String(session.berries)),
      h('em', {}, m().left(session.left)),
    )
    endBtn.textContent = confirmEnd ? m().endSure : m().end
  }

  const showWalkHud = (on: boolean) => {
    endBtn.classList.toggle('hidden', !on)
    pouch.classList.toggle('hidden', !on)
    if (on) refreshPouch()
  }

  const endSession = () => {
    if (phase !== 'walk' || !session) return
    if (!confirmEnd) {
      confirmEnd = true
      return refreshPouch()
    }
    confirmEnd = false
    go('busy')
    send({ kind: 'finish' }, () => toReport())
  }

  /* ---------------- The API ---------------- */

  const send = (action: SafariAction, then: (got: SafariActed) => void) => {
    if (!session) return
    void actSafari(session, action).then((got) => {
      if (disposed) return
      if (isFailure(got)) return trouble(got.error)
      session = got.session
      then(got)
    })
  }

  /* ---------------- The way in ---------------- */

  const makeField = (at: SafariHabitat) => {
    if (field && habitat === at) return field
    field?.release()
    habitat = at
    const def = SAFARI_MAPS[at]
    const theme = THEMES[at]
    // A few of the week's residents, picked from the map's seed so a week looks the same.
    const pool = habitatPool(at)
    const residents = [0, 1, 2, 3].map((i) => safariForm(pool[(def.seed * (i + 2) * 7) % pool.length]!.family).dex)
    field = createField({ habitat: at, world: buildWorld(def), theme, dex, shiny: ctx.shiny, mapSeed: def.seed, residents })
    for (const piece of ['kiosk', 'board']) image(`safari/${piece}`)
    image('realm/safari-gate')
    return field
  }

  const showLobby = () => {
    if (!view) return
    const w = m()
    const at = view.habitat
    const price = sessionPrice(view.used)
    const affordable = price !== null && price <= loadSave().wallet
    face.classList.remove('hidden')
    go('lobby')
    showWalkHud(false)
    readBtn.classList.add('hidden')
    say(`${w.welcome(w.habitats[at].name)} ${w.rules(SAFARI.balls, SAFARI.berries)}`, [view.sure ? w.sureNow : w.sureIn(Math.max(0, SAFARI.guarantee - view.dry)), w.today(view.used, SAFARI.dailyCap)].join(' · '))
    commands([
      ...(price === null || !affordable ? [] : [{ label: price === 0 ? w.free : w.paid(formatPokeDollars(price)), run: () => void enter(), hot: true }]),
      { label: w.boardOpen, run: openBoard },
    ])
    if (price === null) say(w.cap)
    else if (!affordable) say(w.funds)
  }

  const enter = async () => {
    if (!view) return
    commands([])
    face.classList.add('hidden')
    go('busy')
    say('')
    const got = await startSafari(view.used)
    if (disposed) return
    if (isFailure(got)) return trouble(got.error)
    view = { ...view, used: got.used }
    session = got.session
    playSfx('coin')
    seen = 0
    go('gate')
    showWalkHud(true)
    hintLeft = 3.2
  }

  const load = async () => {
    go('load')
    say('')
    commands([])
    report.classList.add('hidden')
    const got = await fetchSafari()
    if (disposed) return
    if (isFailure(got)) return trouble(got.error)
    view = got
    session = got.open
    makeField(got.habitat)
    field?.place(PLAZA.spawn.x * TILE, PLAZA.spawn.y * TILE, 4)
    field?.resume()
    if (!session) return showLobby()
    if (session.encounter) return openBattle(session.encounter.family, session.encounter.shiny, true)
    go('walk')
    showWalkHud(true)
  }

  /* ---------------- The notice board ---------------- */

  const openBoard = () => {
    if (!view) return
    const w = m()
    const at = session?.habitat ?? view.habitat
    const partner = view.partner
    const partnerTypes = partner ? PLAYABLE[partner].line[0].types : []
    const rows = shareOf(habitatPool(at), partnerTypes).sort((a, b) => b.share - a.share)
    const tiers = (['common', 'rare', 'ultra', 'special'] as const).map((rarity) => ({ rarity, rows: rows.filter((r) => r.rarity === rarity) })).filter((tier) => tier.rows.length > 0)
    board.replaceChildren(
      h(
        'div',
        { class: 'sz-board-frame' },
        h('h3', {}, w.boardTitle),
        h('small', {}, [w.habitats[at].name, partner ? w.partner(PLAYABLE[partner].line[0].name) : w.boardHint].join(' · ')),
        h(
          'div',
          { class: 'sz-notes' },
          ...tiers.map((tier) =>
            h(
              'section',
              {},
              h('h4', {}, w.tiers[tier.rarity]),
              h(
                'ul',
                {},
                ...tier.rows.map((entry) => {
                  const form = safariForm(entry.family)
                  return h(
                    'li',
                    { class: lacks(entry.family) ? 'sz-note sz-note-new' : 'sz-note', title: lacks(entry.family) ? w.fresh : undefined },
                    h('img', { src: portraitUrl(form.dex), alt: '', width: 40, height: 40, loading: 'lazy' }),
                    h('b', {}, form.name),
                    h('span', {}, `${(entry.share * 100).toFixed(1)}%`),
                  )
                }),
              ),
            ),
          ),
        ),
        h('button', { class: 'box', type: 'button', onclick: closeBoard }, w.ok),
      ),
    )
    board.classList.remove('hidden')
    playSfx('select')
  }

  const closeBoard = () => {
    board.classList.add('hidden')
    playSfx('select')
  }

  const boardOpen = () => !board.classList.contains('hidden')

  /* ---------------- A battle ---------------- */

  const setTags = (family: HatchlingId, shiny: boolean) => {
    const w = m()
    const entry = safariEntry(family)
    wildTag.replaceChildren(
      h('b', {}, `${safariForm(family).name}${shiny ? ' ★' : ''}`),
      h('small', {}, w.level(wildLevel(family, entry.rarity, seen))),
      h('i', { class: 'sz-hearts' }, '♥'.repeat(wildCalm) + '♡'.repeat(Math.max(0, SAFARI.maxCalm - wildCalm))),
      ...(lacks(family) ? [h('em', {}, w.fresh)] : []),
    )
    nearTag.replaceChildren(h('b', {}, partnerName), h('small', {}, w.level(Math.min(100, 5 + Object.keys(loadSave().hatched).length))))
  }

  const battleHost = (family: HatchlingId, shiny: boolean): BattleHost => ({
    say,
    typed,
    menu: (on) => {
      if (!on || !session) return commands([])
      const w = m()
      commands([
        { label: `${w.ballCmd} ×${session.balls}`, icon: `${import.meta.env.BASE_URL}assets/safari/ball.png`, run: () => battle?.throwBall(), hot: true, off: session.balls === 0 },
        { label: `${w.berryCmd} ×${session.berries}`, icon: `${import.meta.env.BASE_URL}assets/safari/berry.png`, run: () => battle?.giveBerry(), off: session.berries === 0 },
        { label: w.runCmd, run: () => battle?.run() },
      ])
    },
    tags: (show) => {
      wildTag.classList.toggle('hidden', !show)
      nearTag.classList.toggle('hidden', !show)
    },
    calm: (n) => {
      wildCalm = n
      setTags(family, shiny)
    },
    send: (action, then) => send(action, then),
    land: (got) => {
      const out = got.gift ? (stageGifts([got.gift]), openGift(got.gift.id)) : null
      const hatch = out?.status === 'applied' ? out.hatch : null
      return { fresh: hatch !== null && hatch !== undefined && !hatch.duplicate, refund: hatch?.refund ?? 0, shiny: hatch?.shiny ?? false }
    },
    brag: ctx.brag,
    end: () => endBattle(),
    sceneButton: (show) => {
      if (show) commands([{ label: m().ok, run: () => battle?.closeScene(), hot: true }])
      else commands([])
    },
  })

  const openBattle = (family: HatchlingId, shiny: boolean, resumed: boolean) => {
    if (!session) return
    const calm = session.encounter?.calm ?? 0
    wildCalm = calm
    seen += 1
    setTags(family, shiny)
    hintLeft = 0
    battle?.release()
    battle = createBattle({ habitat, theme: THEMES[habitat], family, shiny, session, partnerDex: dex, partnerShiny: ctx.shiny, host: battleHost(family, shiny), resumed })
    go('battle')
    showWalkHud(false)
    readBtn.classList.add('hidden')
  }

  const endBattle = () => {
    go('wipeOut')
    wildTag.classList.add('hidden')
    nearTag.classList.add('hidden')
    commands([])
  }

  const toReport = () => {
    go('report')
    const w = m()
    showWalkHud(false)
    readBtn.classList.add('hidden')
    say('')
    commands([])
    const caught = session?.catches ?? []
    const outOf = session?.balls === 0 ? w.outOfBalls : session?.left === 0 ? w.outOfGrass : ''
    report.replaceChildren(
      h('h3', {}, w.done),
      ...(outOf ? [h('p', {}, outOf)] : []),
      caught.length === 0
        ? h('p', {}, w.none)
        : h('ul', { class: 'sz-caught' }, ...caught.map((c) => h('li', {}, h('img', { src: portraitUrl(safariForm(c.family).dex, c.shiny), alt: '', width: 40, height: 40 }), h('b', {}, `${safariForm(c.family).name}${c.shiny ? ' ★' : ''}`)))),
      h('button', { class: 'box sz-hot', type: 'button', onclick: () => ((session = null), void load()) }, w.again),
    )
    report.classList.remove('hidden')
  }

  /* ---------------- The loop ---------------- */

  const startRustle = () => {
    if (phase !== 'walk' || !session || session.left === 0) return
    go('alert')
    confirmEnd = false
    field?.alert()
    playSfx('safariAlert')
    showWalkHud(false)
    say('')
    readBtn.classList.add('hidden')
    meeting = null
    send({ kind: 'grass' }, (got) => {
      if (got.turn.kind !== 'appear') return
      const entry = { acted: got, ready: false }
      meeting = entry
      const { dex: wildDex } = safariForm(got.turn.family)
      void loadSpecies(wildDex, got.turn.shiny)
        .catch(() => {})
        .then(() => (entry.ready = true))
    })
  }

  const step = (dt: number, input: GameInput) => {
    phaseT += dt
    stepWords(dt)
    if (hintLeft > 0) {
      hintLeft -= dt
      if (hintLeft <= 0 && phase === 'walk') say('')
    }
    const k = canvasK
    if (boardOpen()) {
      if (input.pressed('Enter') || input.pressed('Space') || input.pressed('KeyE')) closeBoard()
      field?.step(dt, input, false, k)
      return
    }
    const walking = phase === 'walk'
    const rustled = field?.step(dt, input, walking, k) ?? false
    if (rustled && walking) startRustle()

    // Keys for whatever commands are up.
    if (input.pressed('ArrowRight') || input.pressed('ArrowDown')) if (!cmds.classList.contains('hidden')) moveCursor(1)
    if (input.pressed('ArrowLeft') || input.pressed('ArrowUp')) if (!cmds.classList.contains('hidden')) moveCursor(-1)
    if (!cmds.classList.contains('hidden')) {
      const pick = input.pressed('Digit1') ? 0 : input.pressed('Digit2') ? 1 : input.pressed('Digit3') ? 2 : input.pressed('Enter') || input.pressed('Space') ? cursor : -1
      if (pick >= 0 && cmdActions[pick]) {
        const b = cmds.querySelectorAll('button')[pick]
        if (b && !b.disabled) {
          playSfx('select')
          cmdActions[pick]!()
        }
      }
    }

    switch (phase) {
      case 'gate':
        if (field) {
          field.player.moving = true
          field.player.dir = 4
          field.player.y -= 62 * dt
        }
        if (phaseT >= GATE_WALK) {
          go('walk')
          say(m().walkHint)
          field?.resume()
        }
        break
      case 'walk': {
        const near = field?.nearBoard() ?? false
        readBtn.classList.toggle('hidden', !near)
        readBtn.textContent = m().readBoard
        if (near && input.pressed('KeyE')) openBoard()
        break
      }
      case 'alert':
        if (phaseT >= ALERT) go('wipeIn')
        break
      case 'wipeIn':
        if (phaseT >= WIPE && meeting?.ready && meeting.acted.turn.kind === 'appear') openBattle(meeting.acted.turn.family, meeting.acted.turn.shiny, false)
        break
      case 'battle':
        battle?.step(dt, layoutBattle(lastW, lastH))
        break
      case 'wipeOut':
        if (phaseT >= WIPE) {
          battle?.release()
          battle = null
          if (session?.over) toReport()
          else {
            go('walk')
            field?.resume()
            showWalkHud(true)
          }
        }
        break
      default:
    }
  }

  let canvasEl: HTMLCanvasElement | null = null
  let lastW = 200
  let lastH = 200

  const place = (W: number, H: number) => {
    const key = `${W}x${H}`
    canvasEl ??= ctx.stage.querySelector('canvas')
    const canvas = canvasEl
    if (!canvas) return
    const k = canvas.clientWidth / W
    canvasK = k
    hud.style.left = `${canvas.offsetLeft}px`
    hud.style.top = `${canvas.offsetTop}px`
    hud.style.width = `${canvas.clientWidth}px`
    hud.style.height = `${canvas.clientHeight}px`
    hud.style.setProperty('--k', String(k))
    if (key === lastKey) return
    lastKey = key
    lastW = W
    lastH = H
    const L = layoutBattle(W, H)
    hud.classList.toggle('sz-wide', L.wide)
    hud.classList.toggle('sz-tall', !L.wide)
    hud.style.setProperty('--scene-w', `${L.sceneW}`)
    hud.style.setProperty('--scene-h', `${L.sceneH}`)
    wildTag.style.left = `calc(var(--k) * ${Math.max(4, L.wild.x - (L.wide ? 150 : 124))}px)`
    wildTag.style.top = `calc(var(--k) * ${Math.max(4, L.wild.y - (L.wide ? 66 : 92))}px)`
    nearTag.style.left = `calc(var(--k) * ${L.wide ? L.near.x + 56 : L.W - 92}px)`
    nearTag.style.top = `calc(var(--k) * ${L.wide ? L.sceneH - 34 : L.sceneH - 38}px)`
  }

  const draw = (g: CanvasRenderingContext2D) => {
    const W = g.canvas.width
    const H = g.canvas.height
    place(W, H)
    const theme = THEMES[habitat]
    if (phase === 'battle') battle?.draw(g, layoutBattle(W, H))
    else if (phase === 'wipeOut') {
      const k = Math.min(1, phaseT / WIPE)
      if (k < 0.5) {
        battle?.draw(g, layoutBattle(W, H))
        drawGrassWipe(g, W, H, k * 2, theme)
      } else {
        field?.draw(g, W, H, canvasK)
        drawGrassWipe(g, W, H, (1 - k) * 2, theme)
      }
    } else {
      if (field) field.draw(g, W, H, canvasK, phase === 'lobby' ? (W > H ? 44 : 104) : phase === 'walk' && !box.classList.contains('hidden') ? (W > H ? 40 : 56) : 0)
      else {
        g.fillStyle = '#20242c'
        g.fillRect(0, 0, W, H)
      }
      if (phase === 'wipeIn') drawGrassWipe(g, W, H, Math.min(1, phaseT / WIPE), theme)
      if (phase === 'alert') {
        // Two flashes before the grass closes in.
        const beat = Math.floor(phaseT / 0.11)
        if ((beat === 2 || beat === 4) && phaseT > 0.2) {
          g.fillStyle = 'rgba(255,255,255,0.75)'
          g.fillRect(0, 0, W, H)
        }
      }
    }
  }

  void load()

  if (import.meta.env.DEV) {
    safariDev.run = {
      phase: () => phase,
      battle: () => battle?.phase() ?? null,
      rustle: startRustle,
    }
  }

  return {
    step,
    draw,
    // A session lasts until it's closed: the frame claims nothing here.
    over: () => null,
    dispose: () => {
      disposed = true
      hud.remove()
      field?.release()
      battle?.release()
      if (import.meta.env.DEV) safariDev.run = null
    },
  }
}

/** The widest canvas: the backdrop is 456 px and the camera leans a little. */
const MAX_W = 440

/** The canvas for a stage of this CSS size: as large a pixel as a phone held either way can spare. */
const fluid = (stageW: number, stageH: number) => {
  const dpr = window.devicePixelRatio || 1
  const raw = Math.min(stageW / 190, stageH / 165, 3)
  const k = Math.max(1, Math.floor(raw * dpr) / dpr)
  return { w: Math.min(MAX_W, Math.floor(stageW / k)), h: Math.min(420, Math.floor(stageH / k)) }
}

/** The Zona Safári (`MINIGAMES.safari`); its canvas follows the stage. */
export const safari: SoloGame = {
  size: { w: 224, h: 300 },
  fluid,
  start,
}

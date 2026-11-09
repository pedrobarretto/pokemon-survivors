import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { context2d } from '../engine/pixelart'
import { ARENA_FORMAT_IDS } from '../data/arenaFormats'
import { GAME_MODE_IDS, GAME_MODES, type GameModeId } from '../data/gameModes'
import { PLAYABLE } from '../data/hatchlings'
import { VERSUS_FORMATS } from '../data/versus'
import { RUN_LENGTH } from '../data/waves'
import { TEAM_SIZES } from '../game/coopBoard'
import { shownLegends } from '../game/festival'
import { t } from '../i18n'
import { checkIcon, closeIcon, ribbonIcon } from '../render/art'
import { drawPokemon, fitSprites, loadedSprites, loadSpecies, type Dex } from '../render/sprites'
import { h, later } from './dom'
import { stepGrid, type Step } from './gridNav'
import { challengeToday } from './save'
import type { Screen } from './screens'

const ASSETS = `${import.meta.env.BASE_URL}assets`

/** Panels at least this wide (the desktop layout) draw their Pokémon a pixel size up. */
const BIG_PANEL = 140
/** How long after Enter or Space the click the browser makes for it still counts as that same press. */
const KEY_CLICK_MS = 1000

const ARROWS: Partial<Record<string, Step>> = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' }

/** A Pokémon on a mode's panel: `at` is its share of the panel's width, `small` draws it a pixel size down, `dir` is its facing. */
type Figure = { dex: Dex; at: number; small?: boolean; dir?: 0 | 2 | 6 }
type Tag = { text: string; kind?: 'new' | 'hot' }
export type ModeFacts = { blurb: string; tags: Tag[]; figures: Figure[]; pic?: { src: string; class: string } }

/** What each card says and shows, read when the screen opens: the counts and the day's Pokémon come from the data. */
export const modeFacts = (): Record<GameModeId, ModeFacts> => {
  const m = t().gameModes
  const challenge = challengeToday()
  const formats = ARENA_FORMAT_IDS.map((f) => m.arenaFormat(VERSUS_FORMATS[f].teamSize, VERSUS_FORMATS[f].length / 60))
  return {
    survivors: {
      blurb: m.blurbs.survivors,
      tags: [{ text: m.tags.solo }, { text: m.tags.minutes(RUN_LENGTH / 60) }, { text: m.tags.endless }],
      figures: [{ dex: 19, at: 0.2, small: true }, { dex: 4, at: 0.6 }],
    },
    legends: {
      blurb: m.blurbs.legends,
      tags: [{ text: m.tags.legends(shownLegends(challenge.day).length) }, { text: m.tags.solo }],
      figures: [{ dex: 382, at: 0.5 }],
    },
    challenge: {
      blurb: m.blurbs.challenge,
      tags: [{ text: m.tags.today(PLAYABLE[challenge.starter].name), kind: 'hot' }, { text: m.tags.oneTry }],
      figures: [{ dex: PLAYABLE[challenge.starter].line[0].dex, at: 0.58 }],
      pic: { src: ribbonIcon('gold'), class: 'arc-mode-ribbon' },
    },
    coop: {
      blurb: m.blurbs.coop,
      tags: [{ text: m.tags.players(Math.min(...TEAM_SIZES), Math.max(...TEAM_SIZES)) }],
      figures: [{ dex: 1, at: 0.24, small: true }, { dex: 25, at: 0.52, small: true }, { dex: 7, at: 0.8, small: true }],
    },
    arena: {
      blurb: m.blurbs.arena(formats),
      tags: [{ text: m.tags.bots }, { text: m.tags.casual }, { text: m.tags.ranked }],
      figures: [{ dex: 448, at: 0.25, small: true, dir: 2 }, { dex: 445, at: 0.75, small: true, dir: 6 }],
    },
    dojo: {
      blurb: m.blurbs.dojo,
      tags: [{ text: m.tags.training }, { text: m.tags.builds }],
      figures: [{ dex: 67, at: 0.36, small: true, dir: 2 }],
      pic: { src: `${ASSETS}/dojo/dummy.png`, class: 'arc-mode-dummy' },
    },
    realm: {
      blurb: m.blurbs.realm,
      tags: [],
      figures: [],
      pic: { src: `${ASSETS}/realm/cafe.png`, class: 'arc-mode-scene' },
    },
  }
}

/** The tags on a card: NOVO first, then the mode's own, then what it needs. */
const cardTags = (id: GameModeId, facts: ModeFacts): Tag[] => {
  const m = t().gameModes.tags
  return [...(GAME_MODES[id].fresh ? [{ text: m.fresh, kind: 'new' as const }] : []), ...facts.tags, ...(GAME_MODES[id].needs === 'account' ? [{ text: m.needsAccount }] : [])]
}

const tagEl = (tag: Tag) => h('span', { class: tag.kind ? `arc-tag ${tag.kind}` : 'arc-tag' }, tag.text)

/** Draws a panel's Pokémon, one canvas pixel per CSS pixel of the panel so their pixels stay whole at any layout. */
const paintFigures = (canvas: HTMLCanvasElement, figures: readonly Figure[], time: number) => {
  const { clientWidth: w, clientHeight: tall } = canvas
  if (w === 0 || tall === 0) return
  if (canvas.width !== w || canvas.height !== tall) {
    canvas.width = w
    canvas.height = tall
  }
  const ctx = context2d(canvas)
  ctx.clearRect(0, 0, w, tall)
  const unit = w >= BIG_PANEL ? 3 : 2
  for (const f of figures) {
    const s = loadedSprites(f.dex)
    if (!s) continue
    const scale = f.small ? unit - 1 : unit
    drawPokemon(ctx, fitSprites(s, Math.floor(w / scale) - 4), 'Idle', f.dir ?? 0, time + f.at, Math.round(w * f.at), tall - 6, { scale })
  }
}

/**
 * Modos de jogo: a card per mode with its art, its one line and its tags; the current one wears the gold frame.
 * Tap, click, or arrows and Enter (keyboard or pad) pick; Esc or the ✕ close. A pick moves the frame and calls
 * `onPick`; the screen stays up until `close` or the caller's next `setScreen`, so the caller decides whether a pick
 * also leaves.
 */
export const openGameModes = (root: HTMLElement, input: Input, opts: { current: GameModeId; shown?: readonly GameModeId[]; onPick: (id: GameModeId) => void; close: () => void }): Screen => {
  const m = t().gameModes
  const facts = modeFacts()
  const ids = opts.shown ?? GAME_MODE_IDS
  let selected = opts.current
  let at = ids.indexOf(selected)
  /** The arrows' cursor only shows once they're used: the gold frame already says where the list starts. */
  let cursorShown = false
  let keyedAt = -Infinity
  let closed = false

  for (const id of ids) for (const f of facts[id].figures) void loadSpecies(f.dex).catch(() => {})

  const canvases = ids.map(() => h('canvas', { class: 'arc-mode-figures', 'aria-hidden': 'true' }))
  const cards = ids.map((id, i) => {
    const { blurb, pic } = facts[id]
    const card = h(
      'button',
      {
        class: 'arc-card arc-mode-card',
        type: 'button',
        style: `--mode:${GAME_MODES[id].color};--wash:${GAME_MODES[id].wash}`,
        'data-mode': id,
      },
      h('span', { class: 'arc-mode-art', 'aria-hidden': 'true' }, pic && h('img', { class: pic.class, src: pic.src, alt: '' }), canvases[i]),
      h(
        'span',
        { class: 'arc-mode-text' },
        h('span', { class: 'arc-mode-name' }, m.names[id]),
        h('span', { class: 'arc-mode-blurb' }, blurb),
        h('span', { class: 'arc-tags' }, ...cardTags(id, facts[id]).map(tagEl)),
      ),
      h('span', { class: 'arc-mode-check', 'aria-hidden': 'true' }, h('img', { src: checkIcon(), alt: '' })),
    )
    card.addEventListener('click', (e) => (e.detail > 0 || performance.now() - keyedAt > KEY_CLICK_MS) && pick(i))
    card.addEventListener('focus', () => (at = i))
    return card
  })

  const closeButton = h(
    'button',
    { class: 'arc-icon-btn', type: 'button', 'aria-label': m.close, title: m.close, onclick: () => close() },
    h('img', { class: 'ink-icon', src: closeIcon(), alt: '' }),
  )
  const list = h('div', { class: 'arc-modes-grid' }, ...cards)
  const el = h(
    'div',
    { class: 'screen arc-modes' },
    h('header', { class: 'arc-modes-top' }, h('h2', { class: 'arc-modes-title arc-outline' }, m.title), closeButton),
    h('div', { class: 'arc-modes-scroll' }, list),
  )

  const paint = () =>
    cards.forEach((card, i) => {
      const on = ids[i] === selected
      card.classList.toggle('selected', on)
      card.setAttribute('aria-pressed', String(on))
      card.classList.toggle('arc-cursor', cursorShown && i === at)
    })

  const pick = (i: number) => {
    selected = ids[i]!
    at = i
    playSfx('select')
    paint()
    opts.onPick(selected)
  }

  /** How many cards fit a row now (the grid wraps with the screen). */
  const cols = () => {
    const n = cards.findIndex((card) => card.offsetTop !== cards[0]!.offsetTop)
    return n > 0 ? n : cards.length
  }

  const off = input.onKey((key) => {
    if (key === 'Enter' || key === 'Space') keyedAt = performance.now()
    if (key === 'Escape' || key === 'Backspace') return close()
    const step = ARROWS[key]
    if (step) {
      const next = stepGrid(at, step, cols(), cards.length)
      if (typeof next !== 'number') return
      if (next !== at) playSfx('move')
      at = next
      cursorShown = true
      paint()
      cards[at]!.scrollIntoView({ block: 'nearest' })
    } else if ((key === 'Enter' || key === 'Space') && document.activeElement !== closeButton) pick(at)
    else if (/^Digit[1-7]$/.test(key) && Number(key.slice(5)) <= cards.length) pick(Number(key.slice(5)) - 1)
  })

  const dispose = () => {
    closed = true
    off()
    el.remove()
  }

  function close() {
    if (closed) return
    playSfx('select')
    dispose()
    later(opts.close)
  }

  const tick = (time: number) => ids.forEach((id, i) => facts[id].figures.length > 0 && paintFigures(canvases[i]!, facts[id].figures, time))

  paint()
  root.append(el)
  later(() => cards[at]?.scrollIntoView({ block: 'nearest' }))
  return { el, tick, dispose, dim: 0 }
}

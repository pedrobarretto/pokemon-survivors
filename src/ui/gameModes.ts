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
import { checkIcon, closeIcon, lockIcon } from '../render/art'
import { MODE_SCENES, paintSceneBack, paintSceneFront, sceneArtReady } from '../render/modeScenes'
import { drawPokemon, fitSprites, loadedSprites, loadSpecies, type Dex } from '../render/sprites'
import { h, later } from './dom'
import type { Step } from './gridNav'
import { challengeToday } from './save'
import type { Screen } from './screens'
import { nearestInDirection } from './spatial'

/** The mode that takes the double card. */
const HERO: GameModeId = 'survivors'
/** Cards of at least this many CSS px a slot (the hero's are two) paint their scene a pixel size up. */
const BIG_SLOT = 200
/** How far the backdrop's meadow is darkened. */
const DIM = 0.5
/** The empty rows between a card's text and the top of its nameplate, and between the nameplate and the Pokémon's feet. */
const PLATE_PAD = 16
const GROUND_GAP = 7
/** How long after Enter or Space the click the browser makes for it still counts as that same press. */
const KEY_CLICK_MS = 1000

const ARROWS: Partial<Record<string, Step>> = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' }

type Tag = { text: string; kind?: 'hot' }
export type ModeFacts = { blurb: string; tags: Tag[] }

/** What each card says and shows, read when the screen opens: the counts and the day's Pokémon come from the data. */
export const modeFacts = (): Record<GameModeId, ModeFacts> => {
  const m = t().gameModes
  const challenge = challengeToday()
  const formats = ARENA_FORMAT_IDS.map((f) => m.arenaFormat(VERSUS_FORMATS[f].teamSize, VERSUS_FORMATS[f].length / 60))
  return {
    survivors: {
      blurb: m.blurbs.survivors,
      tags: [{ text: m.tags.solo }, { text: m.tags.minutes(RUN_LENGTH / 60) }, { text: m.tags.endless }],
    },
    legends: {
      blurb: m.blurbs.legends,
      tags: [{ text: m.tags.legends(shownLegends(challenge.day).length) }, { text: m.tags.solo }],
    },
    challenge: {
      blurb: m.blurbs.challenge,
      tags: [{ text: m.tags.today(PLAYABLE[challenge.starter].name), kind: 'hot' }, { text: m.tags.oneTry }],
    },
    coop: {
      blurb: m.blurbs.coop,
      tags: [{ text: m.tags.players(Math.min(...TEAM_SIZES), Math.max(...TEAM_SIZES)) }],
    },
    arena: {
      blurb: m.blurbs.arena(formats),
      tags: [{ text: m.tags.bots }, { text: m.tags.casual }, { text: m.tags.ranked }],
    },
    dojo: {
      blurb: m.blurbs.dojo,
      tags: [{ text: m.tags.training }, { text: m.tags.builds }],
    },
    realm: {
      blurb: m.blurbs.realm,
      tags: [],
    },
  }
}

/** The tags on a card, what it needs first: the row shows as many as fit, and the padlock must be one of them. */
const cardTags = (id: GameModeId, facts: ModeFacts) => {
  const m = t().gameModes.tags
  const tags = facts.tags.map((tag) => h('span', { class: tag.kind ? `arc-tag ${tag.kind}` : 'arc-tag' }, tag.text))
  if (GAME_MODES[id].needs !== 'account') return tags
  return [h('span', { class: 'arc-tag lock', title: m.needsAccount, 'aria-label': m.needsAccount }, h('img', { src: lockIcon(), alt: '' })), ...tags]
}

/** A card's three stacked canvases and the size they were last laid out for. */
type CardArt = { id: GameModeId; hero: boolean; art: HTMLElement; text: HTMLElement; back: HTMLCanvasElement; figures: HTMLCanvasElement; front: HTMLCanvasElement; laid: string; w: number; h: number; ground: number }

/** Paints a card's scene again when its size, its text or its pictures changed. The nameplate is as tall as the text it holds. */
const layCard = (card: CardArt) => {
  const { clientWidth: cssW, clientHeight: cssH } = card.art
  if (cssW === 0 || cssH === 0) return
  const textH = card.text.offsetHeight
  const ready = sceneArtReady(card.id)
  const laid = `${cssW}x${cssH}x${textH}x${ready}`
  if (laid === card.laid) return
  card.laid = laid
  const big = (card.hero ? cssW / 2 : cssW) >= BIG_SLOT
  const unit = (big ? 3 : 2) - (MODE_SCENES[card.id].fine ? 1 : 0)
  card.w = Math.ceil(cssW / unit)
  card.h = Math.ceil(cssH / unit)
  for (const canvas of [card.back, card.figures, card.front]) {
    canvas.width = card.w
    canvas.height = card.h
    canvas.style.width = `${card.w * unit}px`
    canvas.style.height = `${card.h * unit}px`
  }
  const plate = Math.ceil((textH + PLATE_PAD) / unit)
  card.ground = card.h - plate - GROUND_GAP
  paintSceneBack(context2d(card.back), card.id, card.w, card.h, card.ground)
  paintSceneFront(context2d(card.front), card.id, card.w, card.h, card.ground, plate, GAME_MODES[card.id].plate)
}

/** Draws a card's Pokémon at this moment, each at its place on the scene's ground. */
const paintCast = (card: CardArt, today: Dex, time: number) => {
  const ctx = context2d(card.figures)
  ctx.clearRect(0, 0, card.w, card.h)
  for (const f of MODE_SCENES[card.id].cast(card.ground, today)) {
    const s = loadedSprites(f.dex)
    if (!s) continue
    const scale = f.scale ?? 1
    const x = Math.round(card.w * f.at)
    const y = card.ground - (f.rise ?? 0)
    if (!f.floats) {
      const shadow = Math.max(8, Math.round(s.bodyW * scale * 0.8))
      ctx.fillStyle = 'rgba(10,8,30,.4)'
      ctx.fillRect(x - (shadow >> 1) + 1, y - 1, shadow - 2, 3)
    }
    drawPokemon(ctx, fitSprites(s, card.w - 4), 'Idle', f.dir ?? 0, time + f.at, x, y, { scale })
  }
}

/**
 * Modos de jogo: a modal over the lobby's meadow, a card per mode with its scene (`render/modeScenes.ts`), its nameplate and its
 * tags; Survivors takes a double card, which also makes the 7 modes fill the grid. The current one wears the gold frame.
 * Tap, click, or arrows and Enter (keyboard or pad) pick; Esc, the ✕ or a tap outside close. A pick moves the frame and calls
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

  const today = PLAYABLE[challengeToday().starter].line[0].dex
  for (const id of ids) for (const f of MODE_SCENES[id].cast(0, today)) void loadSpecies(f.dex).catch(() => {})

  const arts: CardArt[] = []
  const cards = ids.map((id, i) => {
    const [back, figures, front] = [h('canvas'), h('canvas'), h('canvas')]
    const art = h('span', { class: 'arc-mode-art', 'aria-hidden': 'true' }, back, figures, front)
    const text = h('span', { class: 'arc-mode-text' }, h('span', { class: 'arc-mode-name arc-outline' }, m.names[id]), h('span', { class: 'arc-mode-blurb' }, facts[id].blurb), h('span', { class: 'arc-tags' }, ...cardTags(id, facts[id])))
    const hero = id === HERO
    arts.push({ id, hero, art, text, back, figures, front, laid: '', w: 0, h: 0, ground: 0 })
    const card = h(
      'button',
      { class: hero ? 'arc-card arc-mode-card hero' : 'arc-card arc-mode-card', type: 'button', 'data-mode': id },
      art,
      text,
      GAME_MODES[id].fresh && h('em', { class: 'arc-mode-new' }, t().gameModes.tags.fresh),
      h('span', { class: 'arc-mode-check', 'aria-hidden': 'true' }, h('img', { src: checkIcon(), alt: '' })),
    )
    card.addEventListener('click', (e) => (e.detail > 0 || performance.now() - keyedAt > KEY_CLICK_MS) && pick(i))
    card.addEventListener('focus', () => (at = i))
    return card
  })

  const closeButton = h(
    'button',
    { class: 'arc-icon-btn arc-modes-close', type: 'button', 'aria-label': m.close, title: m.close, onclick: () => close() },
    h('img', { src: closeIcon(), alt: '' }),
  )
  const list = h('div', { class: 'arc-modes-grid' }, ...cards)
  const el = h('div', { class: 'screen arc-modes' }, h('div', { class: 'arc-modes-panel pop' }, h('h2', { class: 'arc-modes-title' }, m.title), closeButton, h('div', { class: 'arc-modes-scroll' }, list)))
  el.addEventListener('click', (e) => e.target === el && close())

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

  const off = input.onKey((key) => {
    if (key === 'Enter' || key === 'Space') keyedAt = performance.now()
    if (key === 'Escape' || key === 'Backspace') return close()
    const step = ARROWS[key]
    if (step) {
      // The double card breaks a regular grid: the arrows go by where the cards are.
      const next = nearestInDirection(cards.map((card) => card.getBoundingClientRect()), at, step)
      if (next < 0) return
      playSfx('move')
      at = next
      cursorShown = true
      paint()
      cards[at]!.scrollIntoView({ block: 'nearest', inline: 'nearest' })
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

  const tick = (time: number) => {
    for (const card of arts) {
      layCard(card)
      paintCast(card, today, time)
    }
  }

  paint()
  root.append(el)
  later(() => cards[at]?.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
  return { el, tick, dispose, dim: DIM }
}

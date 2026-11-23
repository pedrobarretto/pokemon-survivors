import { GAME_MODES, type GameModeId } from '../data/gameModes'
import type { Input } from '../engine/input'
import { context2d } from '../engine/pixelart'
import { t } from '../i18n'
import { MODE_SCENES, paintSceneBack, paintSceneFront, sceneArtReady } from '../render/modeScenes'
import { drawPokemon, fitSprites, loadedSprites, loadSpecies } from '../render/sprites'
import type { Emotion } from './dialogue'
import { h } from './dom'
import { coachMarks, type CoachEnd, type CoachStop } from './spotlight'
import { uiDpr } from './uiScale'
import { guideSpeaker } from './visitors'
import './lobbyTour.css'

/**
 * The lobby tour: once the first real run is over, back in the lobby, Rotom
 * (`data/guide.ts`) points at a few things with the spotlight (`ui/spotlight.ts`).
 * The stops find what they point at by the lobby's `data-tour` anchors
 * (`ui/title.ts`), whatever the layout: one whose anchor this layout doesn't
 * show points at what holds it (a phone's bottom tab), or is left out.
 */

export type LobbyTourEnd = CoachEnd

type StopId = keyof ReturnType<typeof t>['lobbyTour']['stops']

/**
 * The stops, in order, each with the anchors it may point at (the first one shown wins) and Rotom's face.
 * JOGAR first, then what the game has beyond the solo run: the other modes (the least found by new players),
 * Hoje's daily cards, the eggs (how new Pokémon come) and the plaza's shops.
 */
const LOBBY_STOPS = [
  { id: 'play', anchors: ['play'], emotion: 'Happy' },
  { id: 'modes', anchors: ['modes'], emotion: 'Inspired' },
  { id: 'today', anchors: ['today'], emotion: 'Joyous' },
  { id: 'eggs', anchors: ['eggs', 'tab-collection'], emotion: 'Surprised' },
  { id: 'plaza', anchors: ['plaza', 'tab-plaza'], emotion: 'Joyous' },
] as const satisfies readonly { id: StopId; anchors: readonly string[]; emotion: Emotion }[]

/** The modes the reel plays on the modes stop, the least found first; only those the lobby's bar shows. */
const REEL: readonly GameModeId[] = ['arena', 'coop', 'realm', 'dojo', 'legends']
/** How long each mode's scene stays on the reel (s). */
const REEL_TIME = 2.4
/**
 * The reel's pixels: CSS px per scene px (a size down on phones, where the card has less room), its height in scene
 * px (room for a Pokémon over the nameplate), the nameplate's height (CSS px) and the rows between it and the feet.
 */
const REEL_PX = { wide: 2, narrow: 1.5 }
const REEL_ROWS = 52
const PLATE_CSS = 20
const GROUND_GAP = 4

/** Whole device px per scene px, about `css` CSS px; a scene with a big picture (the café) a size down. */
const reelPixel = (css: number, fine: boolean) => Math.max(1, Math.round((fine ? css / 2 : css) * uiDpr()))

let running = false

/** Whether the lobby tour holds the lobby now: its automatic pop-ups (the surveys, the install offer) wait for another visit. */
export const tourRunning = () => running

/** The lobby's element marked `data-tour="<name>"`, while it shows. */
const anchor = (name: string) => {
  const el = document.querySelector<HTMLElement>(`.title-home:not(.hidden) [data-tour="${name}"]`)
  if (!el || el.hidden) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? el : null
}

const firstShown = (names: readonly string[]) => () => names.map(anchor).find((el) => el !== null) ?? null

/**
 * The modes stop's moving picture: each mode's scene from Modos de jogo (`render/modeScenes.ts`)
 * in turn, its Pokémon moving, its name on the nameplate. Zero bytes: it's all drawn by code.
 */
const modeReel = (modes: readonly GameModeId[]) => {
  const [back, figures, front] = [h('canvas'), h('canvas'), h('canvas')]
  const name = h('span', { class: 'tour-reel-name arc-outline' })
  const el = h('div', { class: 'tour-reel', 'aria-hidden': 'true' }, back, figures, front, name)
  const css = matchMedia('(max-width: 759px), (max-height: 500px)').matches ? REEL_PX.narrow : REEL_PX.wide
  el.style.height = `${(REEL_ROWS * reelPixel(css, false)) / uiDpr()}px`
  for (const id of modes) for (const f of MODE_SCENES[id].cast(0, 0)) void loadSpecies(f.dex).catch(() => {})
  let index = 0
  let since = -1
  let laid = ''
  let size = { w: 0, h: 0, ground: 0 }

  /** Paints the scene again when the mode, the reel's size or the scene's pictures changed. */
  const lay = (id: GameModeId) => {
    const { clientWidth: cssW, clientHeight: cssH } = el
    if (cssW === 0 || cssH === 0) return
    const dpr = uiDpr()
    const ready = sceneArtReady(id)
    const key = `${id}:${cssW}x${cssH}:${dpr}:${ready}`
    if (key === laid) return
    laid = key
    const k = reelPixel(css, MODE_SCENES[id].fine === true)
    const w = Math.ceil((cssW * dpr) / k)
    const vh = Math.ceil((cssH * dpr) / k)
    const plate = Math.ceil((PLATE_CSS * dpr) / k)
    size = { w, h: vh, ground: vh - plate - GROUND_GAP }
    for (const canvas of [back, figures, front]) {
      canvas.width = w
      canvas.height = vh
      canvas.style.width = `${(w * k) / dpr}px`
      canvas.style.height = `${(vh * k) / dpr}px`
    }
    paintSceneBack(context2d(back), id, w, vh, size.ground)
    paintSceneFront(context2d(front), id, w, vh, size.ground, plate, GAME_MODES[id].plate)
    name.textContent = t().gameModes.names[id]
  }

  const tick = (time: number) => {
    if (since < 0) since = time
    if (time - since >= REEL_TIME) {
      since = time
      index = (index + 1) % modes.length
    }
    const id = modes[index]!
    lay(id)
    const ctx = context2d(figures)
    ctx.clearRect(0, 0, size.w, size.h)
    for (const f of MODE_SCENES[id].cast(size.ground, 0)) {
      const s = loadedSprites(f.dex)
      if (!s) continue
      const scale = f.scale ?? 1
      const x = Math.round(size.w * f.at)
      const y = size.ground - (f.rise ?? 0)
      if (!f.floats) {
        const shadow = Math.max(8, Math.round(s.bodyW * scale * 0.8))
        ctx.fillStyle = 'rgba(10,8,30,.4)'
        ctx.fillRect(x - (shadow >> 1) + 1, y - 1, shadow - 2, 3)
      }
      drawPokemon(ctx, fitSprites(s, size.w - 4), 'Idle', f.dir ?? 0, time + f.at, x, y, { scale })
    }
  }
  return { el, tick }
}

/** The modes the lobby's bar shows now (`data-mode` on its chips), the reel's order. */
const barModes = () => {
  const shown = new Set([...document.querySelectorAll<HTMLElement>('.title-home [data-tour="modes"] [data-mode]')].map((chip) => chip.dataset.mode))
  return REEL.filter((id) => shown.has(id))
}

/**
 * Starts the tour on the lobby, which must be up by the next frame: call it just
 * before showing the lobby, so its pop-ups already wait (`tourRunning`). `done`
 * runs once, as it ends or is skipped. A tour already running is left alone.
 */
export const startLobbyTour = (root: HTMLElement, input: Input, done: (end: LobbyTourEnd) => void) => {
  if (running) return
  running = true
  const finish = (end: LobbyTourEnd) => {
    running = false
    done(end)
  }
  requestAnimationFrame(() => {
    const words = t().lobbyTour
    const modes = barModes()
    const stops = LOBBY_STOPS.flatMap((s): CoachStop[] => {
      const target = firstShown(s.anchors)
      // A stop with nothing to point at in this layout is left out.
      if (!target()) return []
      const reel = s.id === 'modes' && modes.length > 0 ? modeReel(modes) : null
      return [{ target, line: words.stops[s.id], emotion: s.emotion, extra: reel ?? undefined }]
    })
    if (stops.length === 0) return finish({ how: 'done', stop: 0 })
    coachMarks(root, input, {
      speaker: guideSpeaker(),
      stops,
      words,
      onEnd: finish,
      gone: () => document.querySelector('.title-home:not(.hidden) .lobby') === null,
    })
  })
}

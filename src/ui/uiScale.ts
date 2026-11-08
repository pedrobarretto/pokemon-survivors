import { fitView, pickViewport } from '../engine/viewport'

/**
 * UI size (Settings → Jogo): the menus and the HUD are drawn in fixed CSS px,
 * so on big screens they stay small while the world grows with the viewport.
 * The chosen size zooms `#ui` (CSS `zoom`, see `--ui-zoom` in style.css).
 * `auto` follows the world's pixel scale.
 */
export const UI_SCALES = ['auto', 1, 1.25, 1.5, 1.75, 2] as const

export type UiScale = (typeof UI_SCALES)[number]

const STEP = 0.25
const MAX_ZOOM = 2
/** World scale (CSS px per world px) the UI's px sizes were drawn against: a 1080p screen. */
const BASE_WORLD_SCALE = 3
/**
 * Least room (CSS px) the zoomed UI may be left with. The media queries read the
 * real viewport and switch layouts below 900 × 700, so the zoom never takes the
 * UI under that, and phones and small windows always stay at 100%.
 */
const ROOM = { w: 960, h: 720 }

const stepDown = (v: number) => Math.floor(v / STEP + 1e-6) * STEP

/** The largest zoom a `w` × `h` CSS px viewport has room for (1 when it has none). */
export const maxUiZoom = (w: number, h: number) => Math.max(1, Math.min(MAX_ZOOM, stepDown(Math.min(w / ROOM.w, h / ROOM.h))))

/**
 * The zoom the UI is drawn at for `choice`: `auto` grows with the world's scale
 * (`worldScale`, CSS px per world px) past its 1080p 3×, both clamped to the room
 * the viewport has.
 */
export const uiZoomFor = (choice: UiScale, w: number, h: number, worldScale: number) => {
  const wanted = choice === 'auto' ? stepDown(worldScale / BASE_WORLD_SCALE) : choice
  return Math.min(Math.max(1, wanted), maxUiZoom(w, h))
}

/* ---------------- Live zoom ---------------- */

let zoom = 1

/** The zoom `#ui` is drawn at now. */
export const uiZoom = () => zoom

/**
 * Device px per CSS px inside `#ui`: what pixel-art canvases and images there
 * size by to land on whole device pixels (`devicePixelRatio` times the zoom).
 */
export const uiDpr = () => (window.devicePixelRatio || 1) * zoom

/** The visible viewport in `#ui`'s CSS px (the zoom leaves the UI that much less). */
export const uiViewport = () => {
  const layout = { width: window.innerWidth, height: window.innerHeight }
  const { width, height } = pickViewport(window.visualViewport, layout) ?? layout
  return { w: width / zoom, h: height / zoom }
}

/**
 * Sets the zoom for `choice` and the current viewport on `--ui-zoom`. When it
 * changes, fires a `resize` so everything sized from the viewport (the canvas
 * HUD insets, the logo, the share preview) measures again.
 */
export const applyUiScale = (choice: UiScale) => {
  const w = window.innerWidth
  const h = window.innerHeight
  const next = uiZoomFor(choice, w, h, fitView(w, h, window.devicePixelRatio || 1).cssScale)
  if (next === zoom) return
  zoom = next
  document.documentElement.style.setProperty('--ui-zoom', String(zoom))
  window.dispatchEvent(new Event('resize'))
}

import { context2d, createCanvas } from '../engine/pixelart'
import { createRng } from '../engine/rng'
import { PLACE_LIFT, PLACE_SINK } from '../render/lobbyStage'
import { h } from './dom'

/**
 * The places on the lobby's horizon, as images over the stage's canvas: finer
 * pixels than the world's, as the art was drawn. Each is trimmed to what it
 * draws and baked with its base in the ground (the bottom rows cut in blades of
 * grass that show the real terrain through, a dark band where it meets the
 * ground and a contact shadow), then laid out from the platform outwards: a place
 * that would run into the cast, an arrow or the slot's edge steps down a size,
 * and if none fits it isn't shown.
 */

type PlaceId = 'dojo' | 'stadium' | 'shop' | 'lighthouse'

/** The rows from the platform out, per side. `depth` is the share of full size it wants: a far place stands on the ridge, smaller. */
const ROWS: Readonly<Record<'left' | 'right', readonly { id: PlaceId; depth: number }[]>> = {
  left: [
    { id: 'stadium', depth: 1 },
    { id: 'dojo', depth: 0.5 },
  ],
  right: [
    { id: 'shop', depth: 1 },
    { id: 'lighthouse', depth: 1 },
  ],
}

/** Local CSS px between two places, past the cast, and at the slot's edge. */
const GAP = 24
const CAST_GAP = 16
const EDGE = 6
/** A size under this share of the full one is far: on the ridge instead of the grass. */
const FAR_BELOW = 0.8

/** World px of a far place's base in the ridge, and a shadow's half height (world px): its bake's padding too. */
const FAR_SINK = 3
const SHADOW_RY = 2

type Box = { x: number; y: number; w: number; h: number }

/** What an image actually draws (the shop's art has a wide empty margin). */
const opaqueBox = (img: HTMLImageElement): Box => {
  const canvas = createCanvas(img.naturalWidth, img.naturalHeight)
  const ctx = context2d(canvas)
  ctx.drawImage(img, 0, 0)
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let [left, right, top, bottom] = [width, -1, height, -1]
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! <= 40) continue
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
  }
  return right < 0 ? { x: 0, y: 0, w: width, h: height } : { x: left, y: top, w: right - left + 1, h: bottom - top + 1 }
}

/**
 * Bakes a place standing in the ground. `blade` is one world px in art px, so the
 * cut's blades of grass are as chunky as the world's; `sink` is how many world rows
 * of the art the ground hides. Padded at the sides and below for its shadow.
 */
const bakePlace = (img: HTMLImageElement, box: Box, blade: number, sink: number) => {
  const pad = blade * 3
  const below = blade * (SHADOW_RY + 1)
  const canvas = createCanvas(box.w + pad * 2, box.h + below)
  const ctx = context2d(canvas)
  ctx.drawImage(img, box.x, box.y, box.w, box.h, pad, 0, box.w, box.h)
  const ground = box.h - sink * blade
  // A dark band on the walls just over the ground, on the art's own pixels only.
  ctx.globalCompositeOperation = 'source-atop'
  ctx.fillStyle = 'rgba(24, 32, 40, 0.28)'
  ctx.fillRect(0, ground - blade * 2, canvas.width, blade * 2)
  ctx.fillRect(0, ground - blade, canvas.width, blade)
  // Everything under the cut goes: the grass of the stage itself shows through, in blades.
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = '#000'
  const rng = createRng(box.w * 31 + box.h)
  for (let x = 0; x < canvas.width; x += blade) {
    const tooth = Math.floor(rng() * 3) * blade
    ctx.fillRect(x, ground - tooth, blade, canvas.height)
  }
  // The contact shadow, under what's left of the art.
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = 'rgba(16, 40, 28, 0.3)'
  const [cx, cy, rx, ry] = [canvas.width / 2, ground + blade, box.w / 2 + blade, blade * SHADOW_RY]
  for (let row = -ry; row < ry; row += blade) {
    const k = 1 - ((row + blade / 2) * (row + blade / 2)) / (ry * ry)
    if (k <= 0) continue
    const half = Math.round((rx * Math.sqrt(k)) / blade) * blade
    ctx.fillRect(cx - half, cy + row, half * 2, blade)
  }
  ctx.globalCompositeOperation = 'source-over'
  return { url: canvas.toDataURL(), width: canvas.width, height: canvas.height, pad, below }
}

/** A rectangle in local CSS px: `x` from the slot's middle, `y` over its bottom. */
export type StageBlock = { left: number; right: number; bottom: number; top: number }

/** What the layout depends on, in local CSS px unless said so. */
export type HorizonFrame = {
  /** Over the slot's bottom: where the horizon is. */
  rise: number
  world: number
  dpr: number
  /** The whole device px per art px of a place at full size. */
  full: number
  width: number
  height: number
  /** The cast's half width. */
  cast: number
  blocks: readonly StageBlock[]
}

const sameFrame = (a: HorizonFrame | null, b: HorizonFrame) =>
  a !== null &&
  a.rise === b.rise &&
  a.world === b.world &&
  a.dpr === b.dpr &&
  a.full === b.full &&
  a.width === b.width &&
  a.height === b.height &&
  a.cast === b.cast &&
  a.blocks.length === b.blocks.length &&
  a.blocks.every((x, i) => x.left === b.blocks[i]!.left && x.right === b.blocks[i]!.right && x.top === b.blocks[i]!.top && x.bottom === b.blocks[i]!.bottom)

/** A place's art, for the `file` it's drawn from. */
export const lobbyPlaces = (file: (id: PlaceId) => string, onLoad?: () => void) => {
  type Art = { source: HTMLImageElement; box: Box | null; shown: HTMLImageElement; baked: Map<string, ReturnType<typeof bakePlace>> }
  const arts = new Map<PlaceId, Art>()
  let frame: HorizonFrame | null = null
  let roof = 0
  /** Where the shown places stand (local CSS px from the slot's middle). */
  let spans: { from: number; to: number }[] = []
  const el = h('div', { class: 'lobby-horizon', 'aria-hidden': 'true' })
  for (const id of ['dojo', 'stadium', 'shop', 'lighthouse'] as const) {
    const shown = h('img', { class: 'lobby-place', alt: '', draggable: 'false', style: 'display:none' })
    const source = new Image()
    const art: Art = { source, box: null, shown, baked: new Map() }
    arts.set(id, art)
    source.onload = () => {
      art.box = opaqueBox(source)
      frame = null
      onLoad?.()
    }
    source.src = file(id)
    el.append(shown)
  }

  /** Puts `id` at `x` over the horizon (local CSS px from the slot's middle) at `k` device px per art px. */
  const show = (art: Art, x: number, k: number, far: boolean, f: HorizonFrame) => {
    const box = art.box!
    const css = k / f.dpr
    const blade = Math.max(1, Math.round(f.world / css))
    const sink = far ? FAR_SINK : PLACE_SINK
    const key = `${blade}:${sink}`
    const baked = art.baked.get(key) ?? bakePlace(art.source, box, blade, sink)
    art.baked.set(key, baked)
    if (art.shown.getAttribute('src') !== baked.url) art.shown.src = baked.url
    Object.assign(art.shown.style, {
      display: '',
      width: `${baked.width * css}px`,
      height: `${baked.height * css}px`,
      left: `${x}px`,
      // Its art's bottom row sits `sink` rows into the ground line: on the horizon, or on the ridge when far.
      bottom: `${(far ? PLACE_LIFT : -PLACE_SINK) * f.world - baked.below * css}px`,
    } satisfies Partial<CSSStyleDeclaration>)
  }

  const layout = (f: HorizonFrame) => {
    for (const art of arts.values()) art.shown.style.display = 'none'
    roof = 0
    spans = []
    const inner = f.cast + CAST_GAP
    const outer = f.width / 2 - EDGE
    for (const [side, sign] of [['left', -1], ['right', 1]] as const) {
      let cursor = inner
      for (const { id, depth } of ROWS[side]) {
        const art = arts.get(id)!
        const box = art.box
        if (!box) continue
        placing: for (let k = Math.max(1, Math.round(f.full * depth)); k >= 1; k--) {
          const css = k / f.dpr
          const [w, tall] = [box.w * css, box.h * css]
          const [from, to] = sign < 0 ? [-cursor - w, -cursor] : [cursor, cursor + w]
          if (cursor + w > outer) continue
          // Small sizes stand on the ridge if there's room, on the grass line if not (an arrow overhead).
          for (const far of k / f.full < FAR_BELOW ? [true, false] : [false]) {
            const base = (far ? PLACE_LIFT : -PLACE_SINK) * f.world
            const top = base + tall
            const hits = f.blocks.some((b) => to > b.left - 6 && from < b.right + 6 && top + f.rise > b.bottom - 6 && base + f.rise < b.top + 6)
            if (top + f.rise > f.height - 2 || hits) continue
            show(art, sign * (cursor + w / 2), k, far, f)
            roof = Math.max(roof, top)
            spans.push({ from, to })
            cursor += w + GAP
            break placing
          }
        }
      }
    }
  }

  return {
    el,
    spans: () => spans,
    /** Lays the places out when something they depend on changed. Returns how far over the horizon they reach (local CSS px). */
    tick: (f: HorizonFrame) => {
      const bottom = `${Math.round(f.rise)}px`
      if (el.style.bottom !== bottom) el.style.bottom = bottom
      if (!sameFrame(frame, f)) {
        frame = f
        layout(f)
      }
      return roof
    },
  }
}

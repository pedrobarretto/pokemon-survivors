import type { GameModeId } from '../data/gameModes'
import { artImages } from '../engine/pixelart'
import type { Dex } from './sprites'

/**
 * The places behind the cards of the Modos de jogo screen (`ui/gameModes.ts`): each mode's scene is painted by code on a
 * low-resolution canvas the card upscales by a whole number, so one card holds one pixel size. The scene is painted once;
 * only its Pokémon (`cast`) are drawn every frame, on a canvas between `back` and `front`.
 */

type SceneArt = 'dojo/dummy.png' | 'realm/cafe.png'
type Point = readonly [x: number, y: number]

/** A Pokémon standing in a scene. `at` is its share of the width, `rise` how far above the ground its feet are. */
export type SceneFigure = { dex: Dex; at: number; rise?: number; dir?: 0 | 2 | 6; scale?: 2; floats?: true }

type Paint = ReturnType<typeof painter>
type ModeScene = {
  /** What's behind the Pokémon, down to `ground`, the line their feet stand on. */
  back: (p: Paint, ground: number) => void
  /** What passes in front of them (a wave, a bolt). */
  front?: (p: Paint, ground: number) => void
  /** Who stands there: `today` is the Desafio do dia's Pokémon. */
  cast: (ground: number, today: Dex) => readonly SceneFigure[]
  /** Pictures `back` draws: the scene is painted again as they land. */
  art?: readonly SceneArt[]
  /** Painted a pixel size down, for a picture too large for the cards' pixels (the café). */
  fine?: true
}

const pictures = artImages((name: SceneArt) => `${import.meta.env.BASE_URL}assets/${name}`)
const copies = new Map<SceneArt, HTMLCanvasElement>()

const picture = (name: SceneArt) => {
  const held = copies.get(name)
  if (held) return held
  const copy = pictures.copy(name)
  if (copy) copies.set(name, copy)
  return copy
}

/** A small seeded generator: a scene's stars and grass fall in the same places every time it's painted. */
const seeded = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296

/** Hard-edged drawing on a canvas of `w` by `h` scene pixels. */
const painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const rect = (x: number, y: number, rw: number, rh: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(rw), Math.round(rh))
  }
  /** Sky-like stripes from `top` to `bottom`, each meeting the next on a row of dither. */
  const bands = (top: number, bottom: number, colors: readonly string[]) => {
    const tall = (bottom - top) / colors.length
    colors.forEach((color, i) => {
      const y = top + i * tall
      rect(0, y, w, Math.ceil(tall) + 1, color)
      if (i > 0) for (let x = 0; x < w; x += 2) rect(x, y - 1, 1, 1, color)
    })
  }
  const disc = (cx: number, cy: number, radius: number, color: string) => {
    for (let y = -radius; y <= radius; y++) {
      const half = Math.floor(Math.sqrt(radius * radius - y * y))
      rect(cx - half, cy + y, half * 2 + 1, 1, color)
    }
  }
  /** A range whose foot is off the canvas and whose ridge rolls up to `amp` above `base`. */
  const hills = (base: number, amp: number, color: string, seed: number, freq: number) => {
    for (let x = 0; x < w; x++) {
      const y = base - Math.round((amp * (Math.sin(x * freq + seed) * 0.6 + Math.sin(x * freq * 2.3 + seed * 2) * 0.4 + 1)) / 2)
      rect(x, y, 1, h - y, color)
    }
  }
  /** A filled polygon with no antialiasing, row by row (even-odd). */
  const poly = (points: readonly Point[], color: string) => {
    const ys = points.map(([, y]) => y)
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(h, Math.ceil(Math.max(...ys))); y++) {
      const row = y + 0.5
      const hits: number[] = []
      points.forEach(([ax, ay], i) => {
        const [bx, by] = points[(i + 1) % points.length]!
        if (ay <= row !== by <= row) hits.push(ax + ((row - ay) / (by - ay)) * (bx - ax))
      })
      hits.sort((a, b) => a - b)
      for (let i = 0; i + 1 < hits.length; i += 2) rect(hits[i]!, y, hits[i + 1]! - hits[i]!, 1, color)
    }
  }
  return { ctx, w, h, rect, bands, disc, hills, poly }
}

/** Specks on the ground, from `top` to the canvas' foot. */
const specks = (p: Paint, top: number, seed: number, colors: readonly string[]) => {
  const r = seeded(seed)
  for (let i = 0; i < p.w / 2; i++) p.rect(r() * p.w, top + r() * (p.h - top), 2, 1, colors[i % colors.length]!)
}

/** The Arena's stands along the top: a crowd of dots under a row of floodlights. */
const stands = (p: Paint) => {
  const r = seeded(5)
  for (let y = 8; y < 20; y += 3)
    for (let x = y % 2; x < p.w; x += 2) if (r() > 0.35) p.rect(x, y, 1, 1, r() > 0.5 ? 'rgba(255,255,255,.55)' : 'rgba(10,10,40,.45)')
  p.rect(0, 0, p.w, 7, '#141a48')
  for (let x = 6; x < p.w; x += 16) p.rect(x, 2, 8, 3, '#fff6c8')
}

export const MODE_SCENES: Record<GameModeId, ModeScene> = {
  survivors: {
    back: (p, g) => {
      const r = seeded(7)
      p.bands(0, g, ['#2a123c', '#4a1848', '#7c1f4a', '#b32f42', '#df5238', '#f6823a', '#ffb34d', '#ffd873'])
      p.disc(Math.floor(p.w / 2), g - 6, 30, '#ffe9a0')
      p.disc(Math.floor(p.w / 2), g - 6, 26, '#fff3c4')
      p.hills(g - 7, 14, '#6d1e42', 1.4, 0.06)
      p.hills(g - 2, 10, '#431537', 3.1, 0.11)
      for (let i = 0; i < 7; i++) {
        const x = Math.floor(r() * p.w)
        const tall = 7 + Math.floor(r() * 7)
        p.rect(x, g - tall, 1, tall, '#2a1030')
        p.rect(x - 2, g - tall, 5, 3, '#2a1030')
        p.rect(x - 3, g - tall + 2, 7, 3, '#2a1030')
      }
      p.rect(0, g, p.w, p.h - g, '#3a1a2e')
      specks(p, g, 8, ['#55263a', '#2c1224'])
      for (let i = 0; i < 16; i++) p.rect(p.w * 0.4 + r() * p.w * 0.5, r() * (g - 8), 1, 1, i % 3 ? '#ffc35a' : '#fff')
    },
    // The horde closes in from both sides; the flyers come down as the card gets shorter, so they stay on it.
    cast: (g) => {
      const fly = Math.min(30, g - 32)
      return [
        { dex: 41, at: 0.16, rise: fly, floats: true },
        { dex: 41, at: 0.8, rise: fly + 4, floats: true },
        { dex: 19, at: 0.25, rise: -1, dir: 2 },
        { dex: 19, at: 0.75, rise: -1, dir: 6 },
        { dex: 19, at: 0.08, rise: -5, dir: 2 },
        { dex: 19, at: 0.92, rise: -5, dir: 6 },
        { dex: 16, at: 0.36, rise: -6, dir: 2 },
        { dex: 16, at: 0.65, rise: -6, dir: 6 },
        { dex: 4, at: 0.5, rise: -6, scale: 2 },
      ]
    },
  },
  legends: {
    back: (p, g) => {
      const r = seeded(11)
      p.bands(0, g - 8, ['#140c38', '#20125a', '#301a78', '#472a9a', '#6240c2', '#8a6adf'])
      p.rect(0, 0, p.w, 7, '#2a1a66')
      for (const [at, y, radius] of [[0.2, 10, 11], [0.34, 7, 9], [0.72, 9, 12], [0.9, 6, 9]] as const) p.disc(Math.floor(p.w * at), y, radius, '#2a1a66')
      let x = Math.floor(p.w * 0.84)
      for (let y = 8; y < g - 14; y += 3) {
        const next = x + Math.floor(r() * 5) - 2
        p.rect(Math.min(x, next), y, Math.abs(next - x) + 2, 1, '#fff6b8')
        p.rect(next, y, 2, 3, '#fff6b8')
        x = next
      }
      for (let i = 0; i < 40; i++) p.rect(r() * p.w, r() * (g - 10), 1, 3, '#8f7ee0')
      p.rect(0, g - 8, p.w, p.h - g + 8, '#142a8a')
    },
    // The sea breaks over Kyogre.
    front: (p, g) => {
      p.rect(0, g, p.w, p.h - g, '#16309c')
      for (let row = 0; row < 4; row++)
        for (let x = -4; x < p.w; x += 11) {
          const wave = x + (row % 2 ? 5 : 0)
          const y = g - 2 + row * 3
          p.rect(wave, y, 6, 1, '#7fb4ff')
          p.rect(wave + 1, y - 1, 3, 1, '#e6f2ff')
        }
    },
    cast: () => [{ dex: 382, at: 0.5, rise: -7, floats: true }],
  },
  challenge: {
    back: (p, g) => {
      const cx = p.w / 2
      const cy = g - 16
      p.rect(0, 0, p.w, p.h, '#f5a51e')
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        const b = a + Math.PI / 12
        p.poly([[cx, cy], [cx + Math.cos(a) * 160, cy + Math.sin(a) * 160], [cx + Math.cos(b) * 160, cy + Math.sin(b) * 160]], '#ffc93f')
      }
      p.disc(Math.floor(cx), Math.floor(cy), 21, '#ffdc70')
      p.disc(Math.floor(cx), Math.floor(cy), 17, '#ffe89a')
      const r = seeded(3)
      const confetti = ['#e8402f', '#16a596', '#2f6fe0', '#fff', '#7b55e0']
      for (let i = 0; i < 30; i++) p.rect(r() * p.w, r() * (g - 6), 2, 2, confetti[i % confetti.length]!)
      // The winners' podium.
      p.rect(0, g + 4, p.w, p.h - g, '#8a5206')
      p.rect(cx - 15, g - 7, 30, 2, '#fff6d8')
      p.rect(cx - 15, g - 5, 30, 6, '#7c4a0c')
      p.rect(cx - 13, g - 3, 26, 2, '#a86c08')
      p.rect(cx - 20, g + 1, 40, 2, '#fff6d8')
      p.rect(cx - 20, g + 3, 40, 6, '#5e3708')
      // The ribbon on the wall.
      p.rect(6, 14, 4, 11, '#d83a2c')
      p.rect(13, 14, 4, 11, '#2f6fe0')
      p.disc(11, 11, 7, '#8a5206')
      p.disc(11, 11, 6, '#ffd34d')
      p.disc(11, 11, 4, '#fff2bd')
      p.disc(11, 11, 2, '#f5a51e')
    },
    cast: (_, today) => [{ dex: today, at: 0.5, rise: 7, floats: true }],
  },
  coop: {
    back: (p, g) => {
      const r = seeded(21)
      p.bands(0, g, ['#071d33', '#0a2a44', '#0c3a55', '#0f4e63', '#14696f'])
      for (let i = 0; i < 34; i++) p.rect(r() * p.w, r() * (g - 14), 1, 1, i % 4 ? '#bfe9e2' : '#fff')
      p.disc(Math.floor(p.w * 0.82), 11, 6, '#fff6d8')
      p.disc(Math.floor(p.w * 0.79), 9, 5, '#0a2a44')
      p.hills(g - 3, 10, '#083344', 2, 0.08)
      for (let i = 0; i < 9; i++) {
        const x = Math.floor((i / 8) * p.w + r() * 5)
        const tall = 14 + Math.floor(r() * 8)
        for (let j = 0; j < tall; j++) {
          const half = Math.floor(j / 2.4)
          p.rect(x - half, g - tall + j, half * 2 + 1, 1, '#052636')
        }
      }
      p.rect(0, g, p.w, p.h - g, '#124a42')
      specks(p, g, 22, ['#1a5e50'])
      // The campfire and the light it throws on the grass.
      const fx = Math.floor(p.w * 0.63)
      const fy = g + 3
      for (let dy = -6; dy <= 6; dy++) {
        const half = Math.floor(Math.sqrt(1 - (dy / 6.5) ** 2) * 30)
        for (let x = -half; x <= half; x++) if ((x + dy) & 1 || Math.abs(x) < half * 0.55) p.rect(fx + x, fy + dy, 1, 1, '#2e8467')
      }
      p.rect(fx - 6, fy + 2, 12, 2, '#6a3a1c')
      p.rect(fx - 4, fy + 1, 8, 1, '#8a5228')
      p.disc(fx, fy - 3, 4, '#e8402f')
      p.rect(fx - 2, fy - 10, 4, 7, '#e8402f')
      p.rect(fx - 1, fy - 13, 2, 3, '#e8402f')
      p.disc(fx, fy - 2, 3, '#ffa23c')
      p.rect(fx - 1, fy - 8, 2, 5, '#ffa23c')
      p.disc(fx, fy - 1, 1, '#fff2a8')
    },
    cast: () => [
      { dex: 1, at: 0.15, rise: -5 },
      { dex: 25, at: 0.4, rise: -1 },
      { dex: 7, at: 0.86, rise: -5 },
    ],
  },
  arena: {
    back: (p, g) => {
      p.rect(0, 0, p.w, p.h, '#2152c8')
      p.poly([[p.w * 0.62, 0], [p.w, 0], [p.w, p.h], [p.w * 0.38, p.h]], '#d8362c')
      stands(p)
      p.rect(0, g - 4, p.w, p.h - g + 4, '#3f9a4c')
      for (let x = 0; x < p.w; x += 12) p.rect(x, g - 4, 6, p.h, '#4aa858')
    },
    // The bolt runs from the stands to the grass, however tall the card is. Its points are shares of the width and of that drop.
    front: (p, g) => {
      const bolt = [[0.58, 0.1], [0.46, 0.36], [0.56, 0.36], [0.42, 0.68], [0.53, 0.64], [0.38, 1], [0.5, 0.52]] as const
      p.poly(bolt.map(([x, y]): Point => [p.w * x + 1, g * y + 1]), '#141836')
      p.poly(bolt.map(([x, y]): Point => [p.w * x, g * y]), '#fff6b8')
    },
    cast: () => [
      { dex: 448, at: 0.25, rise: -6, dir: 2 },
      { dex: 445, at: 0.77, rise: -6, dir: 6 },
    ],
  },
  dojo: {
    art: ['dojo/dummy.png'],
    back: (p, g) => {
      p.bands(0, g - 4, ['#7a3e16', '#8b4a1b', '#9c5620', '#ac6226'])
      for (let x = 7; x < p.w; x += 12) p.rect(x, 0, 1, g, '#6a3412')
      // The paper window.
      const [left, wide, tall] = [p.w * 0.55, p.w * 0.36, g - 20]
      p.rect(left, 5, wide, tall, '#fdeccf')
      p.rect(left, 5, wide, 1, '#3f2010')
      p.rect(left, 5 + tall / 2, wide, 1, '#3f2010')
      p.rect(left, 4 + tall, wide, 1, '#3f2010')
      for (const at of [0, 0.5, 1]) p.rect(left + wide * at, 5, 1, tall, '#3f2010')
      // The banner.
      const bx = p.w * 0.12
      p.rect(bx, 0, 18, 28, '#d8362c')
      p.rect(bx, 0, 18, 2, '#3f2010')
      p.rect(bx, 26, 18, 2, '#ffc531')
      p.disc(Math.floor(bx + 9), 13, 5, '#ffc531')
      p.disc(Math.floor(bx + 9), 13, 3, '#d8362c')
      // The tatami.
      p.rect(0, g - 4, p.w, 2, '#3f2010')
      p.rect(0, g - 2, p.w, p.h, '#d9b872')
      for (let y = g + 1; y < p.h; y += 5) p.rect(0, y, p.w, 1, '#b99650')
      for (const at of [0.33, 0.67]) p.rect(p.w * at, g - 2, 1, p.h, '#8c6c30')
      const dummy = picture('dojo/dummy.png')
      if (!dummy) return
      p.rect(p.w * 0.8 - 9, g + 4, 18, 2, 'rgba(40,20,0,.35)')
      p.ctx.drawImage(dummy, Math.round(p.w * 0.8 - dummy.width / 2), g + 5 - dummy.height)
    },
    cast: () => [{ dex: 67, at: 0.3, rise: -5, dir: 2 }],
  },
  realm: {
    art: ['realm/cafe.png'],
    fine: true,
    back: (p, g) => {
      p.bands(0, g, ['#3ea7ee', '#57b8f2', '#74c8f5', '#97d9f8', '#bdeafb'])
      for (const [at, y] of [[0.14, 12], [0.9, 20]] as const) {
        const x = Math.floor(p.w * at)
        p.disc(x, y, 5, '#fff')
        p.disc(x + 8, y + 1, 4, '#fff')
        p.disc(x - 8, y + 1, 4, '#fff')
        p.rect(x - 12, y + 2, 26, 4, '#fff')
      }
      p.rect(0, g, p.w, p.h - g, '#e9d39a')
      // The café stands on the sand; on a short card it goes behind the nameplate, its cup and roof showing.
      const cafe = picture('realm/cafe.png')
      if (cafe) p.ctx.drawImage(cafe, Math.round((p.w - cafe.width) / 2), Math.max(3, g + 3 - cafe.height))
    },
    cast: () => [],
  },
}

/** Whether every picture a scene draws has landed. */
export const sceneArtReady = (id: GameModeId) => (MODE_SCENES[id].art ?? []).every((name) => picture(name) !== null)

/** Paints what's in front of the Pokémon: the scene's own and then the nameplate of `plate` rows in the mode's color, with a dithered top edge. */
export const paintSceneFront = (ctx: CanvasRenderingContext2D, id: GameModeId, w: number, h: number, ground: number, plate: number, color: string) => {
  const p = painter(ctx, w, h)
  MODE_SCENES[id].front?.(p, ground)
  const y = h - plate
  p.rect(0, y, w, plate, color)
  for (let x = 0; x < w; x++) {
    if (x % 2 === 0) p.rect(x, y - 1, 1, 1, color)
    if (x % 4 === 1) p.rect(x, y - 2, 1, 1, color)
  }
}

export const paintSceneBack = (ctx: CanvasRenderingContext2D, id: GameModeId, w: number, h: number, ground: number) => MODE_SCENES[id].back(painter(ctx, w, h), ground)

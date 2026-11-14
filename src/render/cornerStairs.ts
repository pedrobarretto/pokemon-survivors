import { CORNER_STAIRS } from '../data/realmMap'

/**
 * The stairs down to the Rocket Hideout in the Game Corner's floor
 * (`CORNER_STAIRS`), drawn in code on the room's ground: a brass rim with a
 * hazard-striped lip, four concrete treads going down and darker toward the
 * pit's back wall, lit red from below. Opening, two carpet lids slide apart
 * under the rim in a puff of dust (`STAIRS_OPENING` seconds).
 */

/** Seconds the opening takes: the rumble, the lids sliding, the dust settling. */
export const STAIRS_OPENING = 1.6

/** When the lids start sliding and when they're under the rim, seconds into the opening. */
const SLIDE = { from: 0.35, to: 1.15 } as const

const RIM = { line: '#080608', brass: '#c89020', hi: '#f8d040', lo: '#8a5c14' } as const
const HAZARD = ['#f8d040', '#1a1418'] as const
const WALL = { pit: '#1c141a', side: '#2a2026', back: '#120c10' } as const
/** The treads, nearest first: each a face and the lit nosing at its south edge. */
const TREADS = [
  { face: '#8e8088', nose: '#b0a2a8' },
  { face: '#6c5e66', nose: '#867880' },
  { face: '#4c4048', nose: '#5e5058' },
  { face: '#30262e', nose: '#3e3238' },
] as const
const DROP = '#140e12'
const LID = { face: '#6a1420', edge: '#8a2030', seam: '#3c0a12', coin: '#a87024' } as const
const DUST = 'rgba(232,214,184,'

const ease = (p: number) => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - (1 - p) * (1 - p) * (1 - p))

/**
 * Draws the stairwell at its spot on the room's ground (under everyone).
 * `since`: seconds since the lids started opening (`Infinity`: open already),
 * `time` the screen's clock, for the glow's pulse.
 */
export const drawCornerStairs = (ctx: CanvasRenderingContext2D, camX: number, camY: number, since: number, time: number) => {
  const { x: hx, y: hy, w, h } = CORNER_STAIRS.hole
  // The rumble shakes the frame a pixel side to side before the lids give.
  const shake = since < SLIDE.from ? (Math.floor(since * 30) % 2 === 0 ? 1 : -1) : 0
  const ox = Math.round(hx - camX) + shake
  const oy = Math.round(hy - camY)
  const px = (x: number, y: number, pw: number, ph: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(ox + x, oy + y, pw, ph)
  }

  // The pit: its sides, the back wall, then the treads narrowing as they go down.
  const inner = { x: 2, y: 2, w: w - 4, h: h - 5 }
  px(inner.x, inner.y, inner.w, inner.h, WALL.pit)
  px(inner.x, inner.y, inner.w, 4, WALL.back)
  const tread = 3
  const bottom = inner.y + inner.h
  TREADS.forEach((c, k) => {
    const y = bottom - (k + 1) * (tread + 1)
    const inset = 1 + k
    px(inner.x + 1, y, inset - 1, tread + 1, WALL.side)
    px(inner.x + inner.w - inset, y, inset - 1, tread + 1, WALL.side)
    px(inner.x + inset, y, inner.w - inset * 2, 1, DROP)
    px(inner.x + inset, y + 1, inner.w - inset * 2, tread - 1, c.face)
    px(inner.x + inset, y + tread, inner.w - inset * 2, 1, c.nose)
  })
  // The red light from the Hideout below, pulsing on the back wall and the deepest treads.
  const glow = 0.28 + 0.12 * Math.sin(time * 2.4)
  ctx.fillStyle = `rgba(220,40,48,${glow.toFixed(3)})`
  ctx.fillRect(ox + inner.x, oy + inner.y + 1, inner.w, 3)
  ctx.fillStyle = `rgba(220,40,48,${(glow * 0.45).toFixed(3)})`
  ctx.fillRect(ox + inner.x, oy + inner.y + 4, inner.w, 8)

  // The lids, sliding apart under the rim while it opens.
  const open = ease((since - SLIDE.from) / (SLIDE.to - SLIDE.from))
  if (open < 1) {
    const half = inner.w / 2
    const lid = Math.round(half * (1 - open))
    if (lid > 0) {
      px(inner.x, inner.y, lid, inner.h, LID.face)
      px(inner.x + inner.w - lid, inner.y, lid, inner.h, LID.face)
      px(inner.x + lid - 1, inner.y, 1, inner.h, open > 0 ? LID.edge : LID.seam)
      px(inner.x + inner.w - lid, inner.y, 1, inner.h, open > 0 ? LID.edge : LID.seam)
      // A coin of the carpet's pattern on each lid, riding along.
      if (lid > 4) {
        px(inner.x + lid - 6, inner.y + 8, 2, 2, LID.coin)
        px(inner.x + inner.w - lid + 4, inner.y + 10, 2, 2, LID.coin)
      }
    }
    // Before they give, the seam between them flickers gold.
    if (since < SLIDE.from && Math.floor(since * 16) % 2 === 0) px(inner.x + half - 1, inner.y, 2, inner.h, RIM.hi)
  }

  // The rim: brass round the top and the sides, a hazard-striped lip on the near edge.
  px(0, 0, w, 1, RIM.line)
  px(0, 0, 1, h, RIM.line)
  px(w - 1, 0, 1, h, RIM.line)
  px(0, h - 1, w, 1, RIM.line)
  px(1, 1, w - 2, 1, RIM.hi)
  px(1, 2, 1, h - 4, RIM.brass)
  px(w - 2, 2, 1, h - 4, RIM.lo)
  for (let x = 1; x < w - 1; x++) px(x, h - 3, 1, 2, HAZARD[Math.floor((x + 1) / 3) % 2]!)

  // Dust puffs off the rim as the lids slide.
  if (since >= SLIDE.from && since < STAIRS_OPENING) {
    const t = (since - SLIDE.from) / (STAIRS_OPENING - SLIDE.from)
    for (let i = 0; i < 10; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const x0 = side < 0 ? 1 : w - 2
      const x = Math.round(x0 + side * t * (4 + (i % 5) * 2))
      const y = Math.round(4 + ((i * 7) % (h - 6)) - t * (6 + (i % 3) * 3))
      const s = i % 3 === 0 ? 2 : 1
      ctx.fillStyle = `${DUST}${(0.85 * (1 - t)).toFixed(3)})`
      ctx.fillRect(ox + x, oy + y, s, s)
    }
  }
}

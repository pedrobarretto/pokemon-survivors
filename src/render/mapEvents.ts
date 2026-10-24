import { blitCentered, blitEllipse, blitRing, blitRotated, drawPacked, type PixelSprite } from '../engine/pixelart'
import { TAU } from '../engine/math'
import type { BuffId } from '../data/consumables'
import { MAP_EVENTS, type MapEvent, type MapEventKind, type MapEventOf } from '../game/mapEvents'
import { BOMB, CHEST, FADE, FOUNTAIN, MEOWTH_DEX, SPIKES } from '../game/mapEventRules'
import type { Game } from '../game/types'
import { art, lazy, PICKUPS, SPARKLE, toIconUrl } from './art'
import { consumableSprite } from './props'
import { drawPokemon, loadedSprites } from './sprites'
import { dashedRing } from './strokes'
import { tmDisc, TM_FX } from './tmArt'
import { TUTOR } from '../game/tmRules'
import { isMission } from '../game/fieldMissions'
import { drawFieldMission, missionIcon, missionSpot } from './fieldMissions'
import { HURT_TINT } from './flashes'
import { sceneryArt } from './scenery'

/**
 * Map events on the ground (altar, fountain, chest, traps, Meowth, the Move Tutor) and the
 * arrows that point at the important ones from the screen edge.
 */

type Ctx = CanvasRenderingContext2D

/* ---------------- Art ---------------- */

const PEDESTAL = [
  '..1111111..', '.122222221.', '11333333311', '.1111111111', '...13431...', '...13431...',
  '...13331...', '...13431...', '..1333331..', '.122222221.', '13333333331', '11111111111',
]
const CHEST_ART = [
  '.11111111111.', '1222222222221', '1233333333321', '1444444444441', '1222255522221',
  '1222256522221', '1222255522221', '1222222222221', '1444444444441', '1111111111111',
]
const CHEST_OPEN = [
  '.11111111111.', '1666666666661', '1444444444441', '1222222222221', '1222222222221',
  '1222222222221', '1222222222221', '1444444444441', '1111111111111',
]
const BOMB_ART = ['......3.', '.....3..', '...11...', '.111111.', '12211111', '12111111', '11111111', '11111111', '.111111.', '..1111..']
const DROP = ['..1..', '.121.', '.121.', '12231', '12221', '.111.']
const ARROW = ['1......', '121....', '12221..', '1222221', '12221..', '121....', '1......']

const STONE = { 1: '#383048', 2: '#d0c8d8', 3: '#9890a8', 4: '#f8e8a0' }

const ART = lazy(() => ({
  pedestal: art(PEDESTAL, STONE, '#181820'),
  chest: art(CHEST_ART, { 1: '#382010', 2: '#a06030', 3: '#c88848', 4: '#f8c830', 5: '#e0e0e8', 6: '#383848' }, '#181818'),
  chestOpen: art(CHEST_OPEN, { 1: '#382010', 2: '#a06030', 4: '#f8c830', 6: '#fff8c0' }, '#181818'),
  bomb: art(BOMB_ART, { 1: '#383848', 2: '#a0a8c8', 3: '#a08060' }, '#101018'),
  bombLit: art(BOMB_ART, { 1: '#c03028', 2: '#ffb0a0', 3: '#a08060' }, '#101018'),
  drop: art(DROP, { 1: '#2860b0', 2: '#78c0f8', 3: '#ffffff' }, '#101830'),
  // The last one (pink) is the field missions'.
  arrows: ['#f8e8a0', '#78c0f8', '#f8c830', '#f8d030', '#f878a8'].map((c) => art(ARROW, { 1: '#181818', 2: c })),
}))

export const fountainIcon = () => toIconUrl('fountain', () => ART().drop)

const BUFF_COLORS: Record<BuffId, string> = { xAttack: '#f85838', xSpeed: '#58a0f8', maxRepel: '#58d878' }

/* ---------------- Ground ---------------- */

/** Pixel arc of `k` (0..1) of a circle, clockwise from the top: 2 px of `color` with a dark outer edge. */
const progressArc = (ctx: Ctx, x: number, y: number, r: number, k: number, color: string) => {
  const steps = Math.ceil(r * TAU * 1.5)
  for (let i = 0; i <= steps * k; i++) {
    const a = -Math.PI / 2 + (i / steps) * TAU
    const cx = Math.cos(a)
    const cy = Math.sin(a)
    ctx.fillStyle = '#583808'
    ctx.fillRect(Math.round(x + cx * (r + 1)), Math.round(y + cy * (r + 1)), 1, 1)
    ctx.fillStyle = color
    ctx.fillRect(Math.round(x + cx * r), Math.round(y + cy * r), 1, 1)
    ctx.fillRect(Math.round(x + cx * (r - 1)), Math.round(y + cy * (r - 1)), 1, 1)
  }
}

const groundShadow = (ctx: Ctx, x: number, y: number, rx: number) => blitEllipse(ctx, rx, Math.max(1, Math.round(rx * 0.35)), 'rgba(16,40,16,0.3)', x, y)

const drawAltar = (ctx: Ctx, ev: MapEventOf<'altar'>, t: number) => {
  const painted = sceneryArt('pedestal')?.packed
  const sculpted = ART().pedestal
  const pw = painted ? painted.w : sculpted.width
  const ph = painted ? painted.h : sculpted.height
  const color = BUFF_COLORS[ev.state.buff]
  groundShadow(ctx, ev.x, ev.y, 8)
  if (painted) drawPacked(ctx, painted, Math.round(ev.x - pw / 2), Math.round(ev.y - ph + 1))
  else ctx.drawImage(sculpted, Math.round(ev.x - pw / 2), Math.round(ev.y - ph + 1))
  const top = ev.y - ph - 2
  const pulse = Math.sin(t * 4 + ev.id) > 0
  blitEllipse(ctx, 4, 4, color, ev.x, top)
  blitEllipse(ctx, 2, 2, pulse ? '#ffffff' : '#f8f0d0', ev.x - 1, top - 1)
  // The buff on offer floats above, so you can decide from afar.
  const icon = consumableSprite(ev.state.buff)
  blitCentered(ctx, icon, ev.x, top - 12 + Math.round(Math.sin(t * 3 + ev.id) * 1.5))
  if ((t + ev.id * 0.3) % 1.4 < 0.2) blitCentered(ctx, SPARKLE()[1]!, ev.x + 6, top - 16)
  dashedRing(ctx, ev.x, ev.y, 14, t * 2, [color, '#ffffff'], 0.35, 0.5)
}

const drawFountain = (ctx: Ctx, ev: MapEventOf<'fountain'>, t: number) => {
  const r = FOUNTAIN.radius
  const left = ev.state.charges / FOUNTAIN.charges
  blitEllipse(ctx, r, Math.round(r * 0.55), '#383048', ev.x, ev.y)
  blitEllipse(ctx, r - 1, Math.round(r * 0.55) - 1, '#9890a8', ev.x, ev.y - 1)
  blitEllipse(ctx, r - 4, Math.round(r * 0.55) - 3, '#2a3050', ev.x, ev.y)
  // The water shrinks with every sip taken.
  if (left > 0) {
    const wr = Math.max(2, Math.round((r - 5) * (0.35 + 0.65 * left)))
    blitEllipse(ctx, wr, Math.max(1, Math.round(wr * 0.5)), '#3880d8', ev.x, ev.y)
    blitEllipse(ctx, Math.max(1, wr - 3), Math.max(1, Math.round(wr * 0.3)), '#78c0f8', ev.x - 1, ev.y - 1)
    const sx = Math.round(ev.x + Math.sin(t * 2.5 + ev.id) * (wr - 2))
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(sx, Math.round(ev.y - 1), 2, 1)
  }
  // Spout: a little stone column with a bubbling jet.
  ctx.fillStyle = '#383048'
  ctx.fillRect(Math.round(ev.x - 2), Math.round(ev.y - 10), 5, 10)
  ctx.fillStyle = '#c0b8d0'
  ctx.fillRect(Math.round(ev.x - 1), Math.round(ev.y - 9), 3, 9)
  if (left > 0) {
    for (let i = 0; i < 6; i++) {
      const ph = (t * 1.6 + i / 6) % 1
      const side = i % 2 ? 1 : -1
      ctx.fillStyle = i % 3 ? '#a8d8f8' : '#ffffff'
      ctx.fillRect(Math.round(ev.x + side * ph * 7), Math.round(ev.y - 12 - Math.sin(ph * Math.PI) * 6 + ph * 6), 1, 1)
    }
  }
}

const drawChest = (ctx: Ctx, ev: MapEventOf<'chest'>, t: number) => {
  const { chest, chestOpen } = ART()
  const k = ev.state.progress
  dashedRing(ctx, ev.x, ev.y - 4, CHEST.radius, t * 1.5, ['#b88818', '#806010'], 0.3)
  if (k > 0) progressArc(ctx, ev.x, ev.y - 4, CHEST.radius, k, '#fff0a0')
  groundShadow(ctx, ev.x, ev.y, 8)
  const sprite = ev.gone >= 0 ? chestOpen : chest
  // Rattles harder as the lock gives way.
  const shake = k > 0 && ev.gone < 0 ? Math.round(Math.sin(t * 40) * k * 1.5) : 0
  ctx.drawImage(sprite, Math.round(ev.x - sprite.width / 2 + shake), Math.round(ev.y - sprite.height + 1))
  if (ev.gone < 0 && (t + ev.id * 0.4) % 1.8 < 0.2) blitCentered(ctx, SPARKLE()[1]!, ev.x + 6, ev.y - 12)
}

/** Spike tips laid out on the plate (offsets from the center). */
const SPIKE_SPOTS = [
  [-12, 0], [-6, -4], [0, 0], [6, -4], [12, 0], [-6, 4], [6, 4], [0, -7], [0, 7], [-17, -3], [17, -3], [-15, 4], [15, 4],
] as const

const drawSpikes = (ctx: Ctx, ev: MapEventOf<'spikes'>, t: number) => {
  const r = SPIKES.radius
  const phase = ev.state.phase
  blitEllipse(ctx, r, Math.round(r * 0.5), '#383040', ev.x, ev.y)
  blitEllipse(ctx, r - 1, Math.round(r * 0.5) - 1, '#686078', ev.x, ev.y)
  if (phase === 'warn' && Math.floor(t * 12) % 2 === 0) dashedRing(ctx, ev.x, ev.y, r + 2, 0, ['#f04030'], 0.9, 0.5)
  for (const [ox, oy] of SPIKE_SPOTS) {
    const x = Math.round(ev.x + ox)
    const y = Math.round(ev.y + oy * 0.9)
    if (phase === 'down') {
      ctx.fillStyle = '#201820'
      ctx.fillRect(x, y, 2, 1)
    } else if (phase === 'warn') {
      ctx.fillStyle = '#c8c8d8'
      ctx.fillRect(x, y - 1, 2, 1)
    } else {
      ctx.fillStyle = '#9898b0'
      ctx.fillRect(x, y - 4, 2, 4)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x, y - 5, 1, 2)
    }
  }
}

const drawBomb = (ctx: Ctx, ev: MapEventOf<'bomb'>, t: number) => {
  const { bomb, bombLit } = ART()
  const fuse = ev.state.fuse
  const lit = fuse >= 0
  if (lit) {
    const k = Math.min(1, fuse / BOMB.fuse)
    blitEllipse(ctx, Math.max(1, Math.round(BOMB.radius * k)), Math.max(1, Math.round(BOMB.radius * k)), 'rgba(240,64,48,0.22)', ev.x, ev.y)
    // The warning ring blinks faster as the fuse burns down.
    if (Math.floor(fuse * (6 + k * 20)) % 2 === 0) blitRing(ctx, BOMB.radius, 1, '#f04030', ev.x, ev.y)
  } else {
    dashedRing(ctx, ev.x, ev.y, BOMB.radius, t, ['#e05040'], 0.15)
  }
  groundShadow(ctx, ev.x, ev.y, 5)
  const flashing = lit && Math.floor(fuse * (4 + fuse * 10)) % 2 === 0
  const sprite = flashing ? bombLit : bomb
  const jitter = lit ? Math.round(Math.sin(t * 50)) : 0
  ctx.drawImage(sprite, Math.round(ev.x - sprite.width / 2 + jitter), Math.round(ev.y - sprite.height + 1))
  // Spark on the fuse tip.
  const tipX = Math.round(ev.x - sprite.width / 2 + 7 + jitter)
  const tipY = Math.round(ev.y - sprite.height + 1)
  ctx.fillStyle = lit ? (Math.floor(t * 20) % 2 ? '#ffffff' : '#f8d030') : '#585048'
  ctx.fillRect(tipX, tipY, lit ? 2 : 1, lit ? 2 : 1)
}

/** `calm` (Flashes: reduced): a hit tints it dim red instead of white, and it fades instead of blinking as it leaves. */
const drawMeowth = (ctx: Ctx, ev: MapEventOf<'meowth'>, t: number, calm: boolean) => {
  const s = loadedSprites(MEOWTH_DEX)
  if (!s) return
  const fainted = ev.gone >= 0 && ev.state.hp <= 0
  // Blinks in its last seconds, before it escapes.
  const leaving = ev.gone < 0 && ev.ttl - ev.age < 3 && (calm || Math.floor(t * 10) % 2 === 0)
  groundShadow(ctx, ev.x, ev.y, Math.max(4, Math.round(s.bodyW * 0.36)))
  drawPokemon(ctx, s, fainted || ev.state.flash > 0 ? 'Hurt' : 'Walk', ev.state.dir, ev.age * 1.6, ev.x, ev.y, {
    flash: ev.state.flash > 0.1 && !calm ? 0.8 : 0,
    tint: ev.state.flash > 0.1 && calm ? HURT_TINT : undefined,
    alpha: leaving ? (calm ? 0.7 : 0.5) : 1,
  })
  if (ev.gone < 0 && (t + ev.id * 0.2) % 0.9 < 0.15) blitCentered(ctx, PICKUPS.coins()[0]!, ev.x + 7, ev.y - s.bodyH - 4)
}

/**
 * The Move Tutor's striped tent with the old tutor beside it, waving a TM.
 * Standing in the ring fills it; the disc above the tent spins faster as it does.
 */
const drawTutor = (ctx: Ctx, ev: MapEventOf<'tutor'>, t: number) => {
  const k = ev.state.stand / TUTOR.stand
  dashedRing(ctx, ev.x, ev.y - 2, TUTOR.radius, t * 1.5, ['#78c0f8', '#3868b0'], 0.35)
  if (k > 0) progressArc(ctx, ev.x, ev.y - 2, TUTOR.radius, k, '#d8f0ff')
  groundShadow(ctx, ev.x, ev.y + 1, 17)
  const tent = TM_FX.tent()
  ctx.drawImage(tent, Math.round(ev.x - tent.width / 2), Math.round(ev.y - tent.height + 1))
  const tutor = TM_FX.tutor()
  const hop = Math.floor(t * 2 + ev.id) % 4 === 0 ? 1 : 0
  groundShadow(ctx, ev.x - 21, ev.y + 2, 4)
  ctx.drawImage(tutor, Math.round(ev.x - 21 - tutor.width / 2), Math.round(ev.y - tutor.height + 2 - hop))
  // A TM disc bobbing over the tent, in a color that cycles through the types it can teach.
  const colors = ['#f08030', '#6890f0', '#f8d030', '#98d8d8', '#b8a038', '#f85888', '#705898', '#a8a878']
  const color = colors[Math.floor(t * 1.2 + ev.id) % colors.length]!
  const bob = Math.round(Math.sin(t * 3 + ev.id) * 2)
  blitCentered(ctx, tmDisc(color), ev.x, ev.y - tent.height - 6 + bob - Math.round(k * 4))
  if (ev.gone < 0 && (t + ev.id * 0.3) % 1.6 < 0.2) blitCentered(ctx, SPARKLE()[1]!, ev.x + 7, ev.y - tent.height - 10)
}

const near = (g: Game, x: number, y: number, m = 60) =>
  x > g.camera.x - m && x < g.camera.x + g.view.w + m && y > g.camera.y - m && y < g.camera.y + g.view.h + m

const drawEvent = (ctx: Ctx, g: Game, ev: MapEvent, t: number, calm: boolean) => {
  if (isMission(ev)) return drawFieldMission(ctx, g, ev, t, calm)
  switch (ev.kind) {
    case 'altar': return drawAltar(ctx, ev, t)
    case 'fountain': return drawFountain(ctx, ev, t)
    case 'chest': return drawChest(ctx, ev, t)
    case 'spikes': return drawSpikes(ctx, ev, t)
    case 'bomb': return drawBomb(ctx, ev, t)
    case 'meowth': return drawMeowth(ctx, ev, t, calm)
    case 'tutor': return drawTutor(ctx, ev, t)
  }
}

/** Ground layer: every map event near the screen, fading out once spent. `calm`: Flashes reduced (`render/flashes.ts`). */
export const drawMapEvents = (ctx: Ctx, g: Game, t: number, calm: boolean) => {
  for (const ev of g.mapEvents.list) {
    // A collect mission's balls spread far from its center.
    if (!near(g, ev.x, ev.y, ev.kind === 'collect' || ev.kind === 'escort' ? 400 : 60)) continue
    // A popped bomb leaves nothing behind; the rest fade out.
    if (ev.gone >= 0 && ev.kind === 'bomb') continue
    ctx.globalAlpha = ev.gone >= 0 ? Math.max(0, 1 - ev.gone / FADE) : 1
    drawEvent(ctx, g, ev, t, calm)
  }
  ctx.globalAlpha = 1
}

/* ---------------- Off-screen markers ---------------- */

/** Arrow color (index into `ART().arrows`) and icon of every kind with `marker: true`. Altars show their buff. */
const MARKER: Partial<Record<MapEventKind, { arrow: number; icon: () => PixelSprite }>> = {
  altar: { arrow: 0, icon: () => ART().pedestal },
  fountain: { arrow: 1, icon: () => ART().drop },
  chest: { arrow: 2, icon: () => ART().chest },
  meowth: { arrow: 3, icon: () => PICKUPS.coins()[0]! },
  tutor: { arrow: 1, icon: () => tmDisc('#78c0f8') },
  defense: { arrow: 4, icon: () => missionIcon('defense') },
  collect: { arrow: 4, icon: () => missionIcon('collect') },
  escort: { arrow: 4, icon: () => missionIcon('escort') },
}

export type MarkerInsets = { top: number; bottom: number; side: number }

/** World px kept free at each screen edge, so arrows never hide under the HUD. The shell measures it (`setMarkerInsets`). */
let inset: MarkerInsets = { top: 30, bottom: 24, side: 14 }

export const setMarkerInsets = (next: MarkerInsets) => {
  inset = next
}

/** The margins edge arrows keep (the Alphas' too, `render/alphas.ts`). */
export const markerInsets = () => inset

/**
 * Screen layer: an arrow on the screen edge for every important event that's
 * off-screen, with its icon, pointing the way.
 */
export const drawMapEventMarkers = (ctx: Ctx, g: Game, t: number) => {
  const { w, h } = g.view
  const cx = w / 2
  const cy = h / 2
  for (const ev of g.mapEvents.list) {
    const marker = MARKER[ev.kind]
    if (ev.gone >= 0 || !marker || !MAP_EVENTS[ev.kind].marker) continue
    // A mission points at where to go next (the nearest ball, Togepi's nest).
    const at = isMission(ev) ? missionSpot(g, ev) : ev
    const sx = at.x - g.camera.x
    const sy = at.y - 8 - g.camera.y
    if (sx > 4 && sx < w - 4 && sy > 4 && sy < h - 4) continue
    const dx = sx - cx
    const dy = sy - cy
    const kx = dx === 0 ? Infinity : (cx - inset.side) / Math.abs(dx)
    const ky = dy === 0 ? Infinity : (dy > 0 ? h - inset.bottom - cy : cy - inset.top) / Math.abs(dy)
    const k = Math.min(kx, ky)
    const angle = Math.atan2(dy, dx)
    const bob = Math.round(Math.sin(t * 6 + ev.id) * 1.5)
    const ax = cx + dx * k + Math.cos(angle) * (6 + bob)
    const ay = cy + dy * k + Math.sin(angle) * (6 + bob)
    const icon = ev.kind === 'altar' ? consumableSprite(ev.state.buff) : marker.icon()
    const ix = cx + dx * k - Math.cos(angle) * 7
    const iy = cy + dy * k - Math.sin(angle) * 7
    blitEllipse(ctx, 8, 8, 'rgba(16,24,48,0.7)', ix, iy)
    blitRing(ctx, 8, 1, '#f8f8f8', ix, iy)
    blitCentered(ctx, icon, ix, iy)
    blitRotated(ctx, ART().arrows[marker.arrow]!, ax, ay, angle)
  }
}

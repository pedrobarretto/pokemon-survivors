import { blitCentered, blitRotated, context2d, createCanvas, ellipse, onCanvasReset, ring, textSprite } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { COOP } from '../data/coop'
import { formAt } from '../game/branch'
import { fainted } from '../game/coop'
import { heldMega } from '../game/mega'
import { actAs } from '../game/players'
import type { Game, Player } from '../game/types'
import { TEAM_FX, teamArrow, type TeamIcon } from './art'
import { markerInsets, type MarkerInsets } from './mapEvents'
import { drawPokemon, hasSheets, sprites, type SpeciesSprites } from './sprites'
import { dashedRing } from './strokes'

/**
 * Co-op in the world, draw-only: every teammate's Pokémon with a ring at its
 * feet and a name tag in its slot's color, a fainted player's Poké Ball with
 * the revive filling around it, a wrapped-up player (evolving, on a pick
 * screen of their own, transforming) in a see-through bubble with what
 * they're busy with, an away player dimmed with a "Zz", and arrows on the
 * screen edge toward the teammates out of view. `render` calls the passes
 * (`drawTeamGround`, `drawTeammate` in depth order, `drawTeamAir`, `drawTeamMarkers`)
 * only in co-op. Nothing here allocates per frame once the caches are warm.
 */

type Ctx = CanvasRenderingContext2D

/** One color per seat, the same on every screen: name tags, feet rings, arrows, the HUD's cards. Picked to read on grass, cave and snow. */
export const SLOT_COLORS = ['#58b8f8', '#f8d030', '#f870c0', '#f89038'] as const

export const slotColor = (slot: number): string => SLOT_COLORS[slot % SLOT_COLORS.length]!

/**
 * A name as the in-world font writes it (`textSprite`: capitals, digits and a
 * few marks): accents dropped, 8 letters at most, `P2` when nothing is left.
 */
export const tagText = (name: string, slot: number) => {
  const clean = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 .\-_!+]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8)
    .trim()
  return clean || `P${slot + 1}`
}

/** Each slot's tag, worked out once per name. */
const tagNames: string[] = []
const tagTexts: string[] = []
const tagOf = (g: Game, slot: number) => {
  const name = g.coop?.names[slot] ?? ''
  if (tagNames[slot] !== name || tagTexts[slot] === undefined) {
    tagNames[slot] = name
    tagTexts[slot] = tagText(name, slot)
  }
  return tagTexts[slot]!
}

/** Distances (world px / 16, a tile) as text, made once each. */
const distances: string[] = []
const distanceText = (px: number) => {
  const n = Math.min(999, Math.round(px / 16))
  return (distances[n] ??= String(n))
}

/** What a wrapped-up player is busy with (their bubble's icon), or null while they play like everyone. */
export const busyWith = (p: Player): TeamIcon | null => {
  if (p.mega.intro > 0) return 'mega'
  switch (p.phase) {
    case 'playing':
      return null
    case 'evolving':
      return 'evolve'
    case 'tm':
    case 'pokeball':
    case 'curse':
      return p.phase
    default:
      // A level-up, an evolution's branch, the Ability: the bubble types its "…".
      return 'dots3'
  }
}

/** The sheets a player wears: their stage (or branch) and, while it lasts, their Mega form. */
const mateSprites = (g: Game, p: Player): SpeciesSprites => {
  const dex = formAt(p.starter, p.branch, p.stage).dex
  if (p.mega.active <= 0) return sprites(dex, p.shiny)
  const before = actAs(g, p)
  const def = heldMega(g)
  actAs(g, before)
  return sprites(dex, p.shiny, def?.form)
}

/** A Mega SpriteCollab hasn't drawn wears its final stage with a gold outline (the local player's is a rainbow, `megaLook`). */
const megaOutline = (g: Game, p: Player) => {
  if (p.mega.active <= 0) return undefined
  const before = actAs(g, p)
  const def = heldMega(g)
  actAs(g, before)
  return def && !hasSheets(formAt(p.starter, p.branch, p.stage).dex, def.form) ? '#f8d030' : undefined
}

const AWAY_TINT = { color: '#506078', amount: 0.55 }

/** Whether `p` shows as a standing Pokémon (not their Poké Ball, not gone). */
export const showsStanding = (p: Player) => !p.gone && !fainted(p)

/** Whether `p` draws like the solo player (`drawPlayer` on their copy of the game): standing, here and not wrapped up. */
export const showsPlain = (p: Player) => showsStanding(p) && !p.away && busyWith(p) === null

/**
 * A co-op player who doesn't draw like the solo one (`showsPlain`), in depth
 * order with the horde: their Poké Ball when fainted, dimmed while away,
 * see-through and glowing in a bubble while wrapped up. `g` is any copy of
 * the game holding `p`. `calm`: Flashes reduced.
 */
export const drawTeammate = (ctx: Ctx, g: Game, p: Player, t: number, calm: boolean) => {
  if (p.gone) return
  if (fainted(p)) return drawBall(ctx, p, t)
  const s = mateSprites(g, p)
  const busy = busyWith(p)
  const iframes = p.iframes > 0
  const blink = iframes && !calm && Math.floor(p.iframes * 20) % 2 === 0
  const alpha = p.away ? 0.45 : busy ? 0.75 : blink ? 0.45 : calm && iframes ? 0.65 : 1
  const flash =
    busy === 'evolve' ? (calm ? 0.5 : 0.55 + 0.45 * Math.sin(t * 9))
    : busy === 'mega' ? (calm ? 0.5 : 0.8)
    : !calm && p.hurt > 0.2 ? 0.6
    : 0
  // Frozen players aren't stepped (their `animTime` stands): wrapped up they breathe on the clock.
  const still = p.away || busy !== null
  const anim = still ? 'Idle' : p.hurt > 0 ? 'Hurt' : p.moving ? 'Walk' : 'Idle'
  drawPokemon(ctx, s, anim, p.dir, still ? t : p.animTime, p.x, p.y, { alpha, flash, tint: p.away ? AWAY_TINT : undefined, outline: megaOutline(g, p) })
  if (busy) drawWrap(ctx, p.x, p.y - Math.round(s.bodyH / 2), Math.max(9, Math.round(Math.max(s.bodyW, s.bodyH) / 2) + 3), t)
}

/** The see-through bubble a wrapped-up player sits in: nothing reaches them, and nothing of theirs reaches the horde. */
const drawWrap = (ctx: Ctx, x: number, cy: number, r: number, t: number) => {
  blitCentered(ctx, ellipse(r, r, 'rgba(184,224,255,0.22)'), x, cy)
  dashedRing(ctx, x, cy, r, t * 2, ['#ffffff', '#a8d8f8'], 0.7)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(Math.round(x - r * 0.55), Math.round(cy - r * 0.6), 2, 1)
  ctx.fillRect(Math.round(x - r * 0.7), Math.round(cy - r * 0.4), 1, 2)
}

/** A fainted player's Poké Ball, wobbling now and then like a capture; lit while someone revives it. */
const drawBall = (ctx: Ctx, p: Player, t: number) => {
  const reviving = p.revive > 0
  // A wobble every 1.6 s (faster while a teammate is at it): -1, 1, -1, 0 px.
  const beat = (t * (reviving ? 2.4 : 1) + p.slot * 0.37) % 1.6
  const wobble = beat < 0.36 ? (Math.floor(beat / 0.12) % 2 === 0 ? -1 : 1) : 0
  blitCentered(ctx, ellipse(6, 2, 'rgba(16,24,16,0.35)'), p.x, p.y + 1)
  const lit = reviving && Math.floor(t * 8) % 2 === 0
  blitCentered(ctx, lit ? TEAM_FX.ballLit() : TEAM_FX.ball(), p.x + wobble, p.y - 5)
}

/** Pixel arc of `k` (0..1) of a circle, clockwise from the top, 2 px of `color` with a dark outer rim. */
const reviveArc = (ctx: Ctx, x: number, y: number, r: number, k: number, color: string) => {
  const steps = Math.ceil(r * TAU * 1.5)
  const last = Math.floor(steps * k)
  for (let i = 0; i <= last; i++) {
    const a = -Math.PI / 2 + (i / steps) * TAU
    const cx = Math.cos(a)
    const cy = Math.sin(a)
    ctx.fillStyle = '#383008'
    ctx.fillRect(Math.round(x + cx * (r + 1)), Math.round(y + cy * (r + 1)), 1, 1)
    ctx.fillStyle = color
    ctx.fillRect(Math.round(x + cx * r), Math.round(y + cy * r), 1, 1)
    ctx.fillRect(Math.round(x + cx * (r - 1)), Math.round(y + cy * (r - 1)), 1, 1)
  }
}

/**
 * Under everyone: a ring at each standing player's feet in their color (the
 * local one too, so you know yours), and around a fainted player's Poké Ball
 * the spot to stand in, with the revive filling it.
 */
export const drawTeamGround = (ctx: Ctx, g: Game, t: number) => {
  for (const p of g.players) {
    if (p.gone) continue
    const color = slotColor(p.slot)
    if (fainted(p)) {
      const r = COOP.revive.radius
      dashedRing(ctx, p.x, p.y, r, t * 1.5, [color, '#ffffff', color], 0.6)
      if (p.revive > 0) reviveArc(ctx, p.x, p.y, r - 2, Math.min(1, p.revive / COOP.revive.time), '#f8e050')
      continue
    }
    if (p.away) continue
    const s = mateSprites(g, p)
    dashedRing(ctx, p.x, p.y + 1, Math.round(s.bodyW / 2) + 2, 0, [color], 1, 0.4)
  }
}

/** GBA-style HP bar under a teammate's feet, a bit shorter than the local player's. */
const drawMateHp = (ctx: Ctx, p: Player) => {
  const w = 16
  const x = Math.round(p.x - w / 2)
  const y = Math.round(p.y + 4)
  ctx.fillStyle = '#181818'
  ctx.fillRect(x - 1, y - 1, w + 2, 4)
  ctx.fillStyle = '#504848'
  ctx.fillRect(x, y, w, 2)
  const ratio = Math.max(0, p.hp / p.stats.maxHp)
  ctx.fillStyle = ratio > 0.5 ? '#48d048' : ratio > 0.2 ? '#f8c830' : '#f04030'
  ctx.fillRect(x, y, Math.ceil(w * ratio), 2)
}

/**
 * Over the horde, so it never hides: each teammate's name tag and HP bar, and
 * a bubble with what a wrapped-up one is choosing, or the away "Zz". `me` (the
 * client's own player) gets none: their HUD says it all.
 */
export const drawTeamAir = (ctx: Ctx, g: Game, me: Player, t: number) => {
  for (const p of g.players) {
    if (p.gone || p === me) continue
    const down = fainted(p)
    const top = down ? p.y - 12 : p.y - mateSprites(g, p).bodyH
    const tag = textSprite(tagOf(g, p.slot), slotColor(p.slot))
    blitCentered(ctx, tag, p.x, top - 5)
    if (down) continue
    // Standing and here, `drawPlayer` drew their HP bar already.
    if (!showsPlain(p)) drawMateHp(ctx, p)
    const side = Math.round(p.x + tag.width / 2 + 7)
    if (p.away) {
      blitCentered(ctx, TEAM_FX.zz(), side, top - 8 - (Math.floor(t * 2) % 2))
      continue
    }
    const busy = busyWith(p)
    if (!busy) continue
    const bubbles = TEAM_FX.bubbles()
    // The "…" types itself out, a dot at a time. The bubble's tail points down at the tag.
    const icon = busy === 'dots3' ? DOTS[Math.floor(t * 3) % 3]! : busy
    blitCentered(ctx, bubbles[icon], p.x, top - 16)
  }
}

const DOTS = ['dots1', 'dots2', 'dots3'] as const

/** Where an edge marker goes (`edgeSpot` fills it, so drawing allocates nothing). */
export type EdgeSpot = { x: number; y: number; angle: number }

/**
 * Places a marker for the screen point (sx, sy) on the edge of a `w`×`h`
 * screen, `insets` clear of the HUD, along the line from the screen's center.
 * False (and `out` untouched) when the point is on screen.
 */
export const edgeSpot = (w: number, h: number, insets: MarkerInsets, sx: number, sy: number, out: EdgeSpot) => {
  if (sx > 4 && sx < w - 4 && sy > 4 && sy < h - 4) return false
  const cx = w / 2
  const cy = h / 2
  const dx = sx - cx
  const dy = sy - cy
  // A short landscape screen keeps half its height for markers, whatever the HUD takes.
  const top = Math.min(insets.top, h * 0.25) + 8
  const bottom = Math.min(insets.bottom, h * 0.25) + 8
  const kx = dx === 0 ? Infinity : (cx - insets.side - 8) / Math.abs(dx)
  const ky = dy === 0 ? Infinity : (dy > 0 ? h - bottom - cy : cy - top) / Math.abs(dy)
  const k = Math.max(0, Math.min(kx, ky))
  out.x = Math.round(cx + dx * k)
  out.y = Math.round(cy + dy * k)
  out.angle = Math.atan2(dy, dx)
  return true
}

const spot: EdgeSpot = { x: 0, y: 0, angle: 0 }

/**
 * Screen layer: a marker on the screen edge for every teammate out of view, in
 * their color, with how far they are (in tiles) and their tag. A fainted one
 * shows their Poké Ball and pulses red: they need someone to come.
 */
export const drawTeamMarkers = (ctx: Ctx, g: Game, me: Player, camX: number, camY: number, t: number) => {
  const { w, h } = g.view
  const insets = markerInsets()
  for (const p of g.players) {
    if (p.gone || p === me) continue
    const sx = p.x - camX
    const sy = p.y - 8 - camY
    if (!edgeSpot(w, h, insets, sx, sy, spot)) continue
    const down = fainted(p)
    const color = slotColor(p.slot)
    const urgent = down && Math.floor(t * 4) % 2 === 0
    const r = down ? 9 + (Math.floor(t * 4) % 2) : 8
    const cos = Math.cos(spot.angle)
    const sin = Math.sin(spot.angle)
    blitCentered(ctx, ellipse(r, r, 'rgba(16,24,48,0.78)'), spot.x, spot.y)
    blitCentered(ctx, ring(r, 1, urgent ? '#f84838' : color), spot.x, spot.y)
    const dist = distanceText(Math.hypot(p.x - me.x, p.y - me.y))
    if (down) blitCentered(ctx, TEAM_FX.ball(), spot.x, spot.y)
    else blitCentered(ctx, textSprite(dist, color), spot.x, spot.y)
    const bob = Math.round(Math.sin(t * 6 + p.slot) * 1.5)
    blitRotated(ctx, teamArrow(urgent ? '#f84838' : color), spot.x + cos * (r + 5 + bob), spot.y + sin * (r + 5 + bob), spot.angle)
    // The tag sits on the screen's side of the disc, so it never runs off the edge.
    const tag = textSprite(tagOf(g, p.slot), down ? (urgent ? '#f84838' : '#ffffff') : color)
    const ty = sin > 0.5 ? spot.y - r - 6 : spot.y + r + 6
    const tx = Math.min(w - tag.width / 2 - 2, Math.max(tag.width / 2 + 2, spot.x - cos * 4))
    blitCentered(ctx, tag, tx, ty)
    if (down) blitCentered(ctx, textSprite(dist, '#ffffff'), tx, ty + (sin > 0.5 ? -7 : 7))
  }
}

/* ---------------- Teammates' hitboxes ---------------- */

/** How opaque teammates' hitboxes draw: there, but quieter than your own. */
const TEAM_ATTACK_ALPHA = 0.6

let layer: HTMLCanvasElement | null = null
let layerCtx: Ctx | null = null
onCanvasReset(
  () => {
    layer = null
    layerCtx = null
  },
  () => layer,
)

/**
 * A cleared view-sized layer in world coordinates (top-left at the camera)
 * that teammates' hitboxes draw into, then `flushTeamAttacks` lays it over the
 * world see-through. One canvas, reused every frame.
 */
export const teamAttackLayer = (w: number, h: number, camX: number, camY: number): Ctx => {
  if (!layer || !layerCtx || layer.width !== w || layer.height !== h) {
    layer = createCanvas(w, h)
    layerCtx = context2d(layer)
  }
  layerCtx.setTransform(1, 0, 0, 1, 0, 0)
  layerCtx.clearRect(0, 0, w, h)
  layerCtx.setTransform(1, 0, 0, 1, -camX, -camY)
  return layerCtx
}

/** Draws the teammates' layer onto the world (`ctx` translated to the camera). */
export const flushTeamAttacks = (ctx: Ctx, camX: number, camY: number) => {
  if (!layer) return
  ctx.globalAlpha = TEAM_ATTACK_ALPHA
  ctx.drawImage(layer, camX, camY)
  ctx.globalAlpha = 1
}

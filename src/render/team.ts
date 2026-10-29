import { blitCentered, blitPacked, blitRotated, ellipse, ring, textSprite } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { COOP } from '../data/coop'
import { formAt } from '../game/branch'
import { fainted } from '../game/coop'
import { heldMega } from '../game/mega'
import { actAs, localPlayer } from '../game/players'
import type { Game, Player } from '../game/types'
import { TEAM_FX, teamArrow, type TeamIcon } from './art'
import { markerInsets, type MarkerInsets } from './mapEvents'
import { drawPokemon, hasSheets, sprites, type SpeciesSprites } from './sprites'
import { dashedRing } from './strokes'
import { orbGlyph, TEAM_COLORS, TEAM_LIGHT } from './vale'
import { concealed } from './valeGrass'
import { drawPlateTag, plateOf } from './arenaPlates'
import { VERSUS } from '../data/versus'

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
export const tagText = (name: string, slot: number) => cleanTag(name, 8) || `P${slot + 1}`

/** `name` in the in-world font's letters, `max` of them at most. */
const cleanTag = (name: string, max: number) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 .\-_!+]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim()

/**
 * A Versus player's tag: a human's name as `tagText` writes it; a bot's
 * Pokémon (its form now: the HUD's cards say CPU). A human who left keeps their name.
 */
export const versusTag = (name: string, pokemon: string, slot: number) => (name.trim() ? tagText(name, slot) : cleanTag(pokemon, 10) || `P${slot + 1}`)

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

/** Versus tags by slot, kept while the name and form stay the same. */
const versusTags: { name: string; form: string; text: string }[] = []
const versusTagOf = (g: Game, p: Player) => {
  const name = g.coop?.names[p.slot] ?? ''
  const form = formAt(p.starter, p.branch, p.stage).name
  const known = versusTags[p.slot]
  if (known && known.name === name && known.form === form) return known.text
  const text = versusTag(name, form, p.slot)
  versusTags[p.slot] = { name, form, text }
  return text
}

/** Knocked out in a Versus match: off the field until the respawn, drawn nowhere. */
const benched = (p: Player) => p.versus !== undefined && p.hp <= 0

/** Distances (world px / 16, a tile) as text, made once each. */
const distances: string[] = []
const distanceText = (px: number) => {
  const n = Math.min(999, Math.round(px / 16))
  return (distances[n] ??= String(n))
}

/** What a wrapped-up player is busy with (their bubble's icon), or null while they play like everyone. */
export const busyWith = (p: Player): TeamIcon | null => {
  if (p.mega.intro > 0) return 'mega'
  // Versus: pick cards wait while the Pokémon plays on; only an evolution wraps it up.
  if (p.versus) return p.phase === 'evolving' ? 'evolve' : null
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
export const showsPlain = (p: Player) => showsStanding(p) && (!p.away || p.versus !== undefined) && busyWith(p) === null

/**
 * A co-op player who doesn't draw like the solo one (`showsPlain`), in depth
 * order with the horde: their Poké Ball when fainted, dimmed while away,
 * see-through and glowing in a bubble while wrapped up. `g` is any copy of
 * the game holding `p`. `calm`: Flashes reduced.
 */
export const drawTeammate = (ctx: Ctx, g: Game, p: Player, t: number, calm: boolean) => {
  if (p.gone || benched(p)) return
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
  blitPacked(ctx, ellipse(r, r, 'rgba(184,224,255,0.22)'), x, cy)
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
  blitPacked(ctx, ellipse(6, 2, 'rgba(16,24,16,0.35)'), p.x, p.y + 1)
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
  if (g.versus) return drawVersusGround(ctx, g)
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

/** Versus: a ring at every standing Pokémon's feet in its team's color (the local one's too), but a rival hidden in the grass. */
const drawVersusGround = (ctx: Ctx, g: Game) => {
  const me = localPlayer(g)
  for (const p of g.players) {
    if (p.gone || benched(p) || !p.versus || concealed(me, p)) continue
    const r = Math.round(mateSprites(g, p).bodyW / 2) + 2
    const color = TEAM_COLORS[p.versus.team]
    dashedRing(ctx, p.x, p.y + 1, r, 0, [color], 1, 0.4)
    dashedRing(ctx, p.x, p.y + 1, r + 1, 0, [color], 1, 0.4)
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
  ctx.fillStyle = p.versus ? TEAM_COLORS[p.versus.team] : ratio > 0.5 ? '#48d048' : ratio > 0.2 ? '#f8c830' : '#f04030'
  ctx.fillRect(x, y, Math.ceil(w * ratio), 2)
}

/**
 * Over the horde, so it never hides: each teammate's name tag and HP bar, and
 * a bubble with what a wrapped-up one is choosing, or the away "Zz". `me` (the
 * client's own player) gets none: their HUD says it all.
 */
export const drawTeamAir = (ctx: Ctx, g: Game, me: Player, t: number) => {
  if (g.versus) return drawVersusAir(ctx, g, me)
  for (const p of g.players) {
    if (p.gone || p === me) continue
    const down = fainted(p)
    const top = down ? p.y - 12 : p.y - mateSprites(g, p).bodyH
    const tag = textSprite(tagOf(g, p.slot), slotColor(p.slot))
    blitPacked(ctx, tag, p.x, top - 5)
    if (down) continue
    // Standing and here, `drawPlayer` drew their HP bar already.
    if (!showsPlain(p)) drawMateHp(ctx, p)
    const side = Math.round(p.x + tag.w / 2 + 7)
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

/** Energy counts as text, made once each. */
const energies: string[] = []
const energyText = (n: number) => (energies[n] ??= String(n))

/**
 * Versus, over everyone: each other Pokémon's tag in its team's color (a
 * bot's form) on its name plate if it wears one, and over every Pokémon carrying Energy (the local one too) a
 * dark badge with the orb and how much, gold-rimmed when full. HP bars come
 * with `drawPlayer`. A rival hidden in the grass shows none.
 */
const drawVersusAir = (ctx: Ctx, g: Game, me: Player) => {
  for (const p of g.players) {
    if (p.gone || benched(p) || !p.versus || concealed(me, p)) continue
    const top = p.y - mateSprites(g, p).bodyH
    let above = top - 5
    if (p !== me) {
      const tag = textSprite(versusTagOf(g, p), TEAM_LIGHT[p.versus.team])
      // A name plate goes behind it (`render/arenaPlates.ts`).
      const plate = plateOf(p.slot)
      blitPacked(ctx, tag, plate ? drawPlateTag(ctx, plate, p.x, above, tag.w, g.now) : p.x, above)
      above -= plate ? 11 : 9
    }
    const energy = Math.floor(p.versus.energy)
    if (energy <= 0) continue
    const full = energy >= VERSUS.energy.cap
    const text = textSprite(energyText(energy), full ? '#ffffff' : '#f8d848')
    const orb = orbGlyph()
    const w = orb.width + 1 + text.w
    const x0 = Math.round(p.x - w / 2)
    const y0 = Math.round(above - 4)
    // The badge: a dark pill, its corners cut.
    ctx.fillStyle = full ? '#e0b850' : '#181820'
    ctx.fillRect(x0 - 2, y0, w + 3, 9)
    ctx.fillRect(x0 - 3, y0 + 1, w + 5, 7)
    ctx.fillStyle = '#181820'
    if (full) {
      ctx.fillRect(x0 - 1, y0 + 1, w + 1, 7)
      ctx.fillRect(x0 - 2, y0 + 2, w + 3, 5)
    }
    ctx.drawImage(orb, x0, y0 + 2)
    blitPacked(ctx, text, x0 + orb.width + 1 + text.w / 2, y0 + 4.5)
  }
}

/** The markers drawn so far this frame (x, y pairs), for `unstack`. */
const placed: number[] = []
/** How far apart two markers' middles stay (px), across and down: their discs and tags never touch. */
const MARKER_GAP = { x: 40, y: 24 } as const

/** Slides `spot` along the screen's edge, past any marker drawn already this frame, and keeps it. */
const unstack = (w: number, h: number) => {
  const tx = -Math.sin(spot.angle)
  const ty = Math.cos(spot.angle)
  for (let tries = 0; tries < 4; tries++) {
    let hit = false
    for (let i = 0; i < placed.length; i += 2) {
      if (Math.abs(placed[i]! - spot.x) < MARKER_GAP.x && Math.abs(placed[i + 1]! - spot.y) < MARKER_GAP.y) hit = true
    }
    if (!hit) break
    spot.x = Math.min(w - 12, Math.max(12, spot.x + tx * MARKER_GAP.x))
    spot.y = Math.min(h - 12, Math.max(12, spot.y + ty * MARKER_GAP.x))
  }
  placed.push(spot.x, spot.y)
}

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
  const versus = me.versus
  placed.length = 0
  for (const p of g.players) {
    if (p.gone || p === me) continue
    // Versus: only teammates on their feet, in the team's color.
    if (versus && (p.versus?.team !== versus.team || benched(p))) continue
    const sx = p.x - camX
    const sy = p.y - 8 - camY
    if (!edgeSpot(w, h, insets, sx, sy, spot)) continue
    // Versus: teammates walk together, so a marker on one already slides along the edge, its tag clear of the other's.
    if (versus) unstack(w, h)
    const down = fainted(p)
    const color = versus ? TEAM_LIGHT[versus.team] : slotColor(p.slot)
    const urgent = down && Math.floor(t * 4) % 2 === 0
    const r = down ? 9 + (Math.floor(t * 4) % 2) : 8
    const cos = Math.cos(spot.angle)
    const sin = Math.sin(spot.angle)
    blitPacked(ctx, ellipse(r, r, 'rgba(16,24,48,0.78)'), spot.x, spot.y)
    blitPacked(ctx, ring(r, 1, urgent ? '#f84838' : color), spot.x, spot.y)
    const dist = distanceText(Math.hypot(p.x - me.x, p.y - me.y))
    if (down) blitCentered(ctx, TEAM_FX.ball(), spot.x, spot.y)
    else blitPacked(ctx, textSprite(dist, color), spot.x, spot.y)
    const bob = Math.round(Math.sin(t * 6 + p.slot) * 1.5)
    blitRotated(ctx, teamArrow(urgent ? '#f84838' : color), spot.x + cos * (r + 5 + bob), spot.y + sin * (r + 5 + bob), spot.angle)
    // The tag sits on the screen's side of the disc, so it never runs off the edge.
    const tag = textSprite(versus ? versusTagOf(g, p) : tagOf(g, p.slot), down ? (urgent ? '#f84838' : '#ffffff') : color)
    const ty = sin > 0.5 ? spot.y - r - 6 : spot.y + r + 6
    const tx = Math.min(w - tag.w / 2 - 2, Math.max(tag.w / 2 + 2, spot.x - cos * 4))
    blitPacked(ctx, tag, tx, ty)
    if (down) blitPacked(ctx, textSprite(dist, '#ffffff'), tx, ty + (sin > 0.5 ? -7 : 7))
  }
}

import { blitCentered, blitEllipse, blitRing, blitRotated } from '../engine/pixelart'
import { dir8, TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { ENEMIES } from '../data/enemies'
import { domainOf } from '../data/domains'
import { onFloor } from '../game/arenaFloor'
import { parked, safeAt } from '../game/bosses'
import { phasesOf } from '../game/bossFight'
import { arenaPoint, domainHere } from '../game/domain'
import { groundAt, playerTypes } from '../game/terrain'
import { pairFighter } from '../game/domainPair'
import { encounterBeat, REVEAL_AT } from '../game/domainRules'
import type { Enemy, Game, Hazard } from '../game/types'
import type { RiftLegend } from '../data/rifts'
import { art, lazy } from './art'
import { HAZARD_COLORS } from './hazardColors'
import { drawPokemon, formOf, sprites } from './sprites'
import { drawCaptureScene } from './capture'
import { drawScale } from '../game/alphas'
import { ARRIVAL, isWaveLegend, type Arrival } from '../data/legendBosses'
import { ENTRANCE_REVEAL, entranceBeat, LIGHT_CAPTURE } from '../game/legendScene'

type Ctx = CanvasRenderingContext2D

/**
 * The legendary bosses' moments on screen (`game/bosses.ts`, `game/domain.ts`):
 * beams (blinking telegraph lines, then the burn), a dash's lane, a dive's
 * wake, a blast's charge with its safe spots glowing, the phase shift, the
 * encounter's entrance, and an arrow to a legendary off screen.
 */

/** Steps along a beam from (x, y) at `angle` for `len` px every `step` px, calling `dot` with each point. */
const along = (h: Pick<Hazard, 'x' | 'y' | 'angle' | 'len'>, step: number, dot: (x: number, y: number, i: number) => void) => {
  const dx = Math.cos(h.angle)
  const dy = Math.sin(h.angle)
  for (let d = 0, i = 0; d <= h.len; d += step, i++) dot(Math.round(h.x + dx * d), Math.round(h.y + dy * d), i)
}

/**
 * Ground layer of a beam: its warning, a dashed line that fills in and blinks
 * faster as it's about to burn (a dash's lane shows its two edges instead).
 */
export const drawBeamGround = (ctx: Ctx, h: Hazard) => {
  if (h.age >= h.armAt) return
  const k = h.age / h.armAt
  if (Math.floor(h.age * (5 + k * 16)) % 3 === 2) return
  const [line] = HAZARD_COLORS[h.visual]
  const shown = Math.min(1, k * 2.5)
  const nx = -Math.sin(h.angle) * h.r
  const ny = Math.cos(h.angle) * h.r
  const len = h.len * shown
  if (h.damage <= 0) {
    ctx.fillStyle = '#f8f0e0'
    along({ ...h, len }, 5, (x, y) => {
      ctx.fillRect(Math.round(x + nx), Math.round(y + ny), 2, 2)
      ctx.fillRect(Math.round(x - nx), Math.round(y - ny), 2, 2)
    })
    return
  }
  ctx.fillStyle = line
  along({ ...h, len }, 4, (x, y, i) => {
    if (i % 2 === 0) ctx.fillRect(x - 1, y - 1, 2, 2)
  })
  // A sweeping beam also shows where it ends and the arc it burns through, so the safe side reads at a glance.
  if (h.spin !== 0) {
    const end = h.angle + h.spin * (h.disarmAt - h.armAt)
    along({ ...h, angle: end, len }, 4, (x, y, i) => {
      if (i % 2 === 0) ctx.fillRect(x - 1, y - 1, 2, 2)
    })
    // The whole wedge it burns through, dotted every few px (sparser near the tip, where it's narrow).
    const arc = Math.abs(end - h.angle)
    ctx.globalAlpha = 0.55
    for (let r = 16; r <= len; r += 9) {
      const n = Math.max(1, Math.round((arc * r) / 9))
      for (let i = 0; i <= n; i++) {
        const a = h.angle + ((end - h.angle) * i) / n
        ctx.fillRect(Math.round(h.x + Math.cos(a) * r), Math.round(h.y + Math.sin(a) * r), 2, 2)
      }
    }
    ctx.globalAlpha = 1
  }
  // The beam's width, faint, so the player sees how far to step.
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  along({ ...h, len }, 8, (x, y) => {
    ctx.fillRect(Math.round(x + nx), Math.round(y + ny), 1, 1)
    ctx.fillRect(Math.round(x - nx), Math.round(y - ny), 1, 1)
  })
}

/** Stone blades bursting out of the ground along a rock beam (Precipice Blades): they shoot up, stand, then sink as it ends. */
const drawBlades = (ctx: Ctx, h: Hazard, g: Game) => {
  const rise = Math.min(1, (h.age - h.armAt) / 0.1)
  const sink = h.age > h.disarmAt ? Math.max(0, 1 - (h.age - h.disarmAt) / 0.25) : 1
  const tall = Math.round((h.r * 1.6 + 5) * rise * sink)
  if (tall <= 0) return
  const room = g.rift.arena ?? g.place.inside
  along(h, 7, (x, y, i) => {
    // Blades only burst out of the ground, never over the void past it.
    if (room && !onFloor(room.layout.floor, x - room.x, y - room.y)) return
    const t = tall - (i % 3 === 1 ? 4 : 0)
    for (let row = 0; row < t; row++) {
      const half = Math.max(0, Math.round(((t - row) / t) * 4))
      ctx.fillStyle = row === t - 1 ? '#f0d8a0' : '#5a3a20'
      ctx.fillRect(x - half - 1, y - row, half * 2 + 2, 1)
      if (half > 0) {
        ctx.fillStyle = row > t * 0.6 ? '#e0c068' : '#a07840'
        ctx.fillRect(x - half, y - row, half, 1)
        ctx.fillStyle = '#785028'
        ctx.fillRect(x, y - row, half, 1)
      }
    }
  })
}

/** Air layer of a beam once it burns: a colored band with a white core, flickering, fading as it ends (a rock one erupts in stone blades). */
export const drawBeamAir = (ctx: Ctx, h: Hazard, t: number, g: Game) => {
  if (h.age < h.armAt || h.damage <= 0) return
  if (h.visual === 'rock') return drawBlades(ctx, h, g)
  const [line] = HAZARD_COLORS[h.visual]
  const fade = h.age > h.disarmAt ? Math.max(0, 1 - (h.age - h.disarmAt) / 0.25) : 1
  if (fade <= 0) return
  const w = Math.max(2, Math.round(h.r * 2 * (0.85 + 0.15 * Math.sin(t * 40))))
  const core = Math.max(1, Math.round(w * 0.4))
  ctx.globalAlpha = fade
  ctx.fillStyle = line
  along(h, 2, (x, y) => ctx.fillRect(x - (w >> 1), y - 6 - (w >> 1), w, w))
  ctx.fillStyle = '#ffffff'
  along(h, 2, (x, y) => ctx.fillRect(x - (core >> 1), y - 6 - (core >> 1), core, core))
  ctx.globalAlpha = 1
}

/** Ground marks of every boss's script: a dive's wake following the player, the glow of a phase shift. */
export const drawBossGround = (ctx: Ctx, g: Game, t: number) => {
  for (const e of g.enemies) {
    const f = e.fight
    if (!f || e.dying >= 0) continue
    const m = f.motion
    if (m?.kind === 'dive' && m.left > m.lock && (m.visual === 'dragon' || m.visual === 'aero')) {
      // From the sky: its shadow follows the player, growing as it comes down.
      const k = Math.max(0, 1 - (m.left - m.lock) / 1.6)
      const x = Math.round(m.x)
      const y = Math.round(m.y)
      blitEllipse(ctx, Math.round(10 + k * 12), Math.round(4 + k * 5), 'rgba(8,16,24,0.5)', x, y)
      const [line] = HAZARD_COLORS[m.visual]
      const q = (t * 2) % 1
      ctx.globalAlpha = 1 - q
      blitRing(ctx, Math.round(26 - q * 16), 1, line, x, y)
      ctx.globalAlpha = 1
    } else if (m?.kind === 'dive' && m.left > m.lock) {
      const [line, fill] = HAZARD_COLORS[m.visual]
      const x = Math.round(m.x)
      const y = Math.round(m.y)
      blitEllipse(ctx, 16, 7, 'rgba(8,16,40,0.45)', x, y)
      for (let i = 0; i < 3; i++) {
        const k = (t * 1.6 + i / 3) % 1
        const r = Math.round(4 + k * 18)
        ctx.globalAlpha = 1 - k
        blitRing(ctx, r, 1, i % 2 ? line : '#ffffff', x, y)
      }
      ctx.globalAlpha = 1
      blitEllipse(ctx, 6, 3, fill, x, y)
    }
    if (f.guards.length > 0) drawGuardLinks(ctx, g, e, t)
    if (f.shift > 0 && !parked(e)) {
      const k = (t * 2) % 1
      ctx.globalAlpha = 1 - k
      blitRing(ctx, Math.round(e.radius + 6 + k * 30), 2, '#f8f0a0', Math.round(e.x), Math.round(e.y))
      ctx.globalAlpha = 1
    }
  }
}

/** Grid step (px) of the safe-spot dots a blast's warning shows. */
const SAFE_STEP = 7

/**
 * A blast charging, in screen space: the screen dims more and more, the spots
 * it spares glow with dots (the same test the blast lands with), and a ring
 * closes on the boss.
 */
export const drawBlasts = (ctx: Ctx, g: Game, camX: number, camY: number, t: number) => {
  for (const e of g.enemies) {
    const b = e.fight?.blast
    if (!b || e.dying >= 0) continue
    const k = 1 - b.left / b.total
    const { w, h } = g.view
    ctx.fillStyle = `rgba(4,8,32,${(0.18 + k * 0.32).toFixed(2)})`
    ctx.fillRect(0, 0, w, h)
    const blink = Math.floor(t * (4 + k * 10)) % 2 === 0
    ctx.fillStyle = blink ? '#f8fff0' : '#98f8b0'
    // Only floor counts: the void past it isn't anywhere to stand.
    const room = g.rift.arena ?? g.place.inside
    const floor = room ? room.layout.floor : []
    const ox = room?.x ?? 0
    const oy = room?.y ?? 0
    // Burning ground spares no one but Fire types: no dots there.
    const burns = !playerTypes(g).includes('fire')
    const x0 = Math.floor(camX / SAFE_STEP) * SAFE_STEP
    const y0 = Math.floor(camY / SAFE_STEP) * SAFE_STEP
    for (let y = y0; y < camY + h; y += SAFE_STEP) {
      for (let x = x0; x < camX + w; x += SAFE_STEP) {
        if ((!room || onFloor(floor, x - ox, y - oy)) && safeAt(g, b, x, y, g.player.radius) && !(burns && groundAt(g, x, y) === 'lava')) ctx.fillRect(x - camX, y - camY, 2, 2)
      }
    }
    const [line] = HAZARD_COLORS[b.visual]
    // Shelters show their edge, so the player sees how far in to step.
    for (const spot of b.spots) blitRing(ctx, Math.round(b.radius), 1, blink ? '#f8fff0' : '#98f8b0', Math.round(spot.x - camX), Math.round(spot.y - camY))
    const r = Math.round(10 + (1 - k) * 60)
    blitRing(ctx, r, 2, line, Math.round(b.x - camX), Math.round(b.y - 14 - camY))
  }
}

const ARROW = lazy(() => art(['11.....', '1221...', '122221.', '1222221', '122221.', '1221...', '11.....'], { 1: '#f8d0d0', 2: '#d02838' }, '#300810'))

/** In a domain's battle or a wave legendary's fight on the map, an arrow on the screen's edge toward the legendary while it's off screen (or its wake, while it dives). */
export const drawBossMarker = (ctx: Ctx, g: Game, camX: number, camY: number, t: number) => {
  const here = domainHere(g)
  if (here && here.d.act !== 'battle') return
  // On the map: the wave legendary on the HP bar, outside its scenes.
  const boss = here ? pairFighter(g, here.d.pair, here.d.bossId) : g.enemies.find((e) => e.id === (g.legendScene ? -1 : g.bossId) && e.dying < 0 && isWaveLegend(e.kind))
  if (!boss) return
  const m = boss.fight?.motion
  const tx = m?.kind === 'dive' ? m.x : boss.x
  const ty = m?.kind === 'dive' ? m.y : boss.y - boss.radius
  if (parked(boss) && m?.kind !== 'dive') return
  const { w, h } = g.view
  const sx = tx - camX
  const sy = ty - camY
  if (sx > 0 && sx < w && sy > 0 && sy < h) return
  const cx = w / 2
  const cy = h / 2
  const angle = Math.atan2(sy - cy, sx - cx)
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const k = Math.min(dx > 0 ? (w - 14 - cx) / dx : dx < 0 ? (14 - cx) / dx : Infinity, dy > 0 ? (h - 40 - cy) / dy : dy < 0 ? (90 - cy) / dy : Infinity)
  const bob = Math.sin(t * 8) * 2
  blitRotated(ctx, ARROW(), cx + dx * (k + bob), cy + dy * (k + bob), angle, 2)
}

/** The sprite form a boss wears in its phase (`BossPhase.form`), if its species has it. */
export const bossForm = (e: Enemy) => {
  const key = e.fight ? phasesOf(e.kind)?.[e.fight.phase]?.form : undefined
  return formOf(ENEMIES[e.kind].dex, key)
}

/** How a legendary's entrance colors its rings, the tint it rises out of and the spray off its back. */
type EntranceLook = { ring: string; tint: string; spray: string }

const WATER_RISE: EntranceLook = { ring: '#c8e8f8', tint: '#1c4878', spray: '#e8f8ff' }

/** Entrances that don't come out of water (the rest use `WATER_RISE`). */
const ENTRANCE_LOOK: Partial<Record<RiftLegend, EntranceLook>> = {
  groudon: { ring: '#f8a040', tint: '#a02808', spray: '#f8e060' },
  rayquaza: { ring: '#f8f0a0', tint: '#3c9850', spray: '#ffffff' },
  darkrai: { ring: '#58e8f0', tint: '#140c24', spray: '#58e8f0' },
}

/**
 * The legendary's entrance during the encounter, before it's in play: rings
 * spread where it comes, then it rises out of the water (clipped at the
 * surface), drops from the sky with its shadow growing, or fades in.
 */
export const drawEntrance = (ctx: Ctx, g: Game, t: number) => {
  const here = domainHere(g)
  if (!here || here.d.act !== 'encounter' || here.d.scene >= REVEAL_AT) return
  const { arena, d } = here
  const def = domainOf(d.legend)!
  const k = encounterBeat(d.scene).entrance
  const at = arenaPoint(arena, d, def.arena.boss)
  const x = Math.round(at.x)
  const y = Math.round(at.y)
  const look = ENTRANCE_LOOK[d.legend] ?? WATER_RISE
  for (let i = 0; i < 3; i++) {
    const q = (t * 1.2 + i / 3) % 1
    ctx.globalAlpha = (1 - q) * Math.min(1, k * 3 + 0.3)
    blitRing(ctx, Math.round(8 + q * 40), 1, look.ring, x, y)
  }
  ctx.globalAlpha = 1
  if (k <= 0) return
  const s = sprites(ENEMIES[d.legend].dex, arena.shiny)
  const body = s.bodyH
  if (def.entrance === 'swoop') {
    swoopIn(ctx, s, x, y, k, t, -1)
    if (def.partner) {
      const mate = arenaPoint(arena, d, def.partner.at)
      swoopIn(ctx, sprites(ENEMIES[def.partner.id].dex, arena.shiny), Math.round(mate.x), Math.round(mate.y), Math.max(0, k - 0.08), t, 1)
    }
  } else if (def.entrance === 'meteor') {
    meteorIn(ctx, s, x, y, k, t)
  } else if (def.entrance === 'rise') {
    const lift = Math.round((1 - k) * (body + 8))
    ctx.save()
    ctx.beginPath()
    ctx.rect(x - 200, y - 400, 400, 400 + 2)
    ctx.clip()
    drawPokemon(ctx, s, 'Idle', 0, t, x, y + lift, { tint: { color: look.tint, amount: 0.5 * (1 - k) } })
    ctx.restore()
    // Spray (or embers) off its back as it breaks the surface.
    ctx.fillStyle = look.spray
    for (let i = 0; i < 16; i++) {
      const a = hash2(i, 1, 3) * TAU
      const r = (t * 60 + hash2(i, 2, 3) * 40) % 40
      ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y - Math.abs(Math.sin(a)) * r * 0.6), 1, 1)
    }
  } else if (def.entrance === 'descend') {
    blitEllipse(ctx, Math.round(6 + k * 14), Math.round(3 + k * 6), 'rgba(16,8,32,0.45)', x, y)
    drawPokemon(ctx, s, 'Idle', 0, t, x, y - Math.round((1 - k) * 220))
  } else {
    drawPokemon(ctx, s, 'Idle', 0, t, x, y, { alpha: k, flash: 1 - k })
  }
}

/** Streaking in out of invisibility from one side (`side`): a see-through shimmer gliding in on an arc, then taking color as it stops. */
const swoopIn = (ctx: Ctx, s: ReturnType<typeof sprites>, x: number, y: number, k: number, t: number, side: number) => {
  if (k <= 0) return
  const q = Math.min(1, k / 0.75)
  const ease = 1 - (1 - q) * (1 - q) * (1 - q)
  const px = Math.round(x + side * 230 * (1 - ease))
  const py = Math.round(y - 90 * (1 - ease) - Math.sin(q * Math.PI) * 18)
  const shown = k < 0.75 ? 0.2 + 0.1 * Math.sin(t * 30) : 0.2 + ((k - 0.75) / 0.25) * 0.8
  const color = side < 0 ? '#f86078' : '#58a0f8'
  // A trail of glints behind the shimmer.
  ctx.fillStyle = color
  for (let i = 1; i < 8 && q < 1; i++) ctx.fillRect(Math.round(px + side * i * 9), Math.round(py - 10 + Math.sin(i + t * 9) * 2), 2, 1)
  drawPokemon(ctx, s, 'Walk', side < 0 ? 2 : 6, t, px, py, { alpha: Math.min(1, shown), flash: k < 0.75 ? 0.6 : 1 - (k - 0.75) / 0.25, tint: { color, amount: 0.3 * (1 - k) } })
}

const CRYSTAL = lazy(() =>
  art(['...1...', '..121..', '.12321.', '1233321', '1234321', '1233321', '.12321.', '..121..', '...1...'], { 1: '#5c2810', 2: '#f89850', 3: '#f8d0a0', 4: '#ffffff' }),
)

/**
 * Deoxys's entrance: a crystal meteor streaks down to its spot with a fiery
 * tail, crashes (a ring of light), then cracks as Deoxys reforms out of it,
 * motes converging on its body.
 */
const meteorIn = (ctx: Ctx, s: ReturnType<typeof sprites>, x: number, y: number, k: number, t: number) => {
  const fall = Math.min(1, k / 0.45)
  if (k < 0.45) {
    const mx = Math.round(x + 170 * (1 - fall))
    const my = Math.round(y - 8 - 260 * (1 - fall))
    blitEllipse(ctx, Math.round(3 + fall * 9), Math.round(2 + fall * 4), 'rgba(16,8,32,0.45)', x, y)
    for (let i = 1; i < 14; i++) {
      ctx.globalAlpha = 1 - i / 14
      ctx.fillStyle = i < 5 ? '#f8d070' : '#f86830'
      ctx.fillRect(mx + i * 4, my - i * 6, 3, 3)
    }
    ctx.globalAlpha = 1
    blitRotated(ctx, CRYSTAL(), mx, my, t * 6, 2)
    return
  }
  // The crash: a ring of light spreading.
  const crash = (k - 0.45) / 0.2
  if (crash < 1) {
    ctx.globalAlpha = 1 - crash
    blitRing(ctx, Math.round(8 + crash * 50), 2, '#f8d0a0', x, y)
    ctx.globalAlpha = 1
  }
  const form = Math.min(1, (k - 0.5) / 0.5)
  // The crystal shrinks into the new body while the motes come together.
  if (form < 1) {
    blitCentered(ctx, CRYSTAL(), x, Math.round(y - 8 - form * 6))
    ctx.fillStyle = '#f89850'
    for (let i = 0; i < 14; i++) {
      const a = hash2(i, 1, 71) * TAU + t
      const r = (1 - form) * (30 + hash2(i, 2, 71) * 20)
      ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y - 14 + Math.sin(a) * r * 0.7), 2, 2)
    }
  }
  if (form > 0) drawPokemon(ctx, s, 'Idle', 0, t, x, y, { alpha: form, flash: 1 - form, tint: { color: '#f89850', amount: 0.5 * (1 - form) } })
}

/** A boss's barrier (`guard`): a dotted link from each keeper to it, its dots running inward, and a shield ring blinking around it. */
const drawGuardLinks = (ctx: Ctx, g: Game, e: Enemy, t: number) => {
  for (const k of g.enemies) {
    if (!e.fight!.guards.includes(k.id) || k.dying >= 0) continue
    const dx = e.x - k.x
    const dy = e.y - k.y
    const d = Math.hypot(dx, dy) || 1
    for (let s = (t * 30) % 8; s < d; s += 8) {
      ctx.fillStyle = Math.floor(s / 8) % 2 === 0 ? '#f8b070' : '#c8e0f8'
      ctx.fillRect(Math.round(k.x + (dx / d) * s), Math.round(k.y - 8 + (dy / d) * s), 2, 2)
    }
  }
  if (Math.floor(t * 6) % 3 !== 0) blitRing(ctx, Math.round(e.radius + 8), 1, '#c8e0f8', Math.round(e.x), Math.round(e.y - e.radius * 0.6))
}

/**
 * A linked pair's knocked-out one (`game/domainPair.ts`), kneeling where it
 * fell with stars over its head, a ring filling up to its partner's revival,
 * and while the revival is cast, a pulsing beam between the two.
 */
export const drawPairDown = (ctx: Ctx, g: Game, t: number) => {
  const here = domainHere(g)
  const pair = here?.d.pair
  if (!here || !pair || pair.down < 0 || here.d.act !== 'battle') return
  const e = g.enemies.find((k) => k.id === pair.down)
  const rule = here.def.partner?.revive
  if (!e || !rule) return
  const x = Math.round(pair.x)
  const y = Math.round(pair.y)
  const s = sprites(ENEMIES[e.kind].dex, e.shiny, bossForm(e))
  drawPokemon(ctx, s, 'Hurt', 0, 0.3, x, y, { loop: false, alpha: 0.75, tint: { color: '#302040', amount: 0.35 } })
  for (let i = 0; i < 3; i++) {
    const a = t * 4 + (i / 3) * TAU
    ctx.fillStyle = '#f8d030'
    ctx.fillRect(Math.round(x + Math.cos(a) * 12), Math.round(y - s.bodyH - 3 + Math.sin(a) * 3), 2, 2)
  }
  if (pair.revived) return
  // The revival's countdown: dots filling a ring around it.
  const k = Math.min(1, pair.age / rule.after)
  const r = 18
  const steps = Math.ceil(r * TAU * k)
  ctx.fillStyle = pair.casting >= 0 && Math.floor(t * 10) % 2 === 0 ? '#ffffff' : '#98f8b0'
  for (let i = 0; i < steps; i++) {
    const a = -Math.PI / 2 + i / r
    ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y - 8 + Math.sin(a) * r * 0.6), 2, 1)
  }
  if (pair.casting < 0) return
  const healer = g.enemies.find((k2) => k2.id !== e.id && k2.fight?.link === e.id)
  if (!healer || parked(healer)) return
  ctx.fillStyle = Math.floor(t * 12) % 2 === 0 ? '#98f8b0' : '#ffffff'
  const dx = x - healer.x
  const dy = y - healer.y
  const d = Math.hypot(dx, dy) || 1
  for (let q = (t * 60) % 6; q < d; q += 6) ctx.fillRect(Math.round(healer.x + (dx / d) * q), Math.round(healer.y - 12 + (dy / d) * q), 2, 2)
}

/**
 * Phantoms (`swoop`): see-through copies of their Pokémon (the boss's form and
 * shininess when it's in play) fading in at the start of their lane, then
 * streaking down it with afterimages.
 */
export const drawPhantoms = (ctx: Ctx, g: Game, t: number) => {
  for (const h of g.hazards) {
    if (h.phantom <= 0 || h.kind !== 'shot') continue
    const e = g.enemies.find((k) => k.boss && ENEMIES[k.kind].dex === h.phantom)
    const s = sprites(h.phantom, e?.shiny ?? g.rift.arena?.shiny ?? false, e ? bossForm(e) : undefined)
    const [color] = HAZARD_COLORS[h.visual]
    const dir = dir8(h.vx, h.vy)
    const moving = h.age >= h.armAt
    const alpha = moving ? 0.55 + 0.1 * Math.sin(t * 40) : Math.min(0.4, (h.age / h.armAt) * 0.5)
    if (moving) {
      const speed = Math.hypot(h.vx, h.vy) || 1
      for (let i = 2; i >= 1; i--) {
        drawPokemon(ctx, s, 'Walk', dir, t, Math.round(h.x - (h.vx / speed) * i * 12), Math.round(h.y - (h.vy / speed) * i * 12), { alpha: alpha * (0.5 - i * 0.15), tint: { color, amount: 0.7 } })
      }
    }
    drawPokemon(ctx, s, 'Walk', dir, t, Math.round(h.x), Math.round(h.y), { alpha, tint: { color, amount: 0.45 }, flash: moving ? 0.25 : 0.5 })
  }
}

/** The colors a legendary's arrival kicks up: dust out of the ground, sparks out of thin air, wind from the sky. */
const ARRIVAL_DUST = { descend: '#e8f0f8', bound: '#e0d0a8', rise: '#a08860', materialize: '#f8d0f0' } as const satisfies Record<Arrival, string>

/**
 * A wave legendary's scene on the map (`game/legendScene.ts`): before it shows
 * itself, its arrival (rings where it comes, then it drops from the sky with
 * its shadow growing, leaps in from the side, rises out of the cracking ground
 * or fades in); the quick capture where it fell.
 */
export const drawLegendScene = (ctx: Ctx, g: Game, t: number) => {
  const s = g.legendScene
  if (!s) return
  if (s.kind === 'capture') {
    if (s.capture) drawCaptureScene(ctx, g, s.capture, s.t, LIGHT_CAPTURE, t)
    return
  }
  if (s.t >= ENTRANCE_REVEAL || !isWaveLegend(s.enemy)) return
  const boss = g.enemies.find((e) => e.id === s.bossId)
  if (!boss) return
  const k = entranceBeat(s.t).arrive
  const x = Math.round(boss.x)
  const y = Math.round(boss.y)
  const arrival = ARRIVAL[s.enemy]
  const dust = ARRIVAL_DUST[arrival]
  for (let i = 0; i < 3; i++) {
    const q = (t * 1.2 + i / 3) % 1
    ctx.globalAlpha = (1 - q) * Math.min(1, k * 3 + 0.3)
    blitRing(ctx, Math.round(8 + q * 36), 1, dust, x, y)
  }
  ctx.globalAlpha = 1
  if (k <= 0) return
  const sp = sprites(ENEMIES[s.enemy].dex, boss.shiny)
  const scale = drawScale(boss)
  const body = sp.bodyH * scale
  if (arrival === 'descend') {
    blitEllipse(ctx, Math.round(6 + k * 14), Math.round(3 + k * 6), 'rgba(16,8,32,0.45)', x, y)
    drawPokemon(ctx, sp, 'Idle', 0, t, x, y - Math.round((1 - k) * 200), { scale })
  } else if (arrival === 'bound') {
    // In from the side away from the player, in one long leap.
    const side = boss.x >= g.player.x ? 1 : -1
    const hop = Math.sin(k * Math.PI) * 46
    blitEllipse(ctx, Math.round(6 + k * 10), Math.round(3 + k * 4), 'rgba(16,8,32,0.4)', x + Math.round(side * (1 - k) * 110), y)
    drawPokemon(ctx, sp, 'Walk', side > 0 ? 6 : 2, t, x + Math.round(side * (1 - k) * 110), y - Math.round(hop), { scale })
  } else if (arrival === 'rise') {
    ctx.save()
    ctx.beginPath()
    ctx.rect(x - 200, y - 400, 400, 400 + 2)
    ctx.clip()
    drawPokemon(ctx, sp, 'Idle', 0, t, x, y + Math.round((1 - k) * (body + 6)), { scale, tint: { color: '#403020', amount: 0.6 * (1 - k) } })
    ctx.restore()
  } else {
    drawPokemon(ctx, sp, 'Idle', 0, t, x, y, { scale, alpha: k, flash: 1 - k })
  }
  ctx.fillStyle = dust
  for (let i = 0; i < 18; i++) {
    const a = hash2(i, 4, 7) * TAU
    const r = arrival === 'materialize' ? (1 - k) * 60 * (0.4 + hash2(i, 5, 7)) : ((t * 50 + hash2(i, 6, 7) * 40) % 40) * k
    ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y - 6 + Math.sin(a) * r * 0.6), 1, 1)
  }
}

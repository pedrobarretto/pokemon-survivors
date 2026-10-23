import { blitCentered, blitRing, lazy } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import { bodyOf } from '../data/bodies'
import { ENEMIES, type EnemyDef } from '../data/enemies'
import { DARKRAI_DOMAIN, NIGHTMARE } from '../data/domains/darkrai'
import { glowing, LANTERN_COUNT, lanternAt, lanternLit } from '../game/darkraiDomain'
import { domainHere } from '../game/domain'
import { ENCOUNTER_LENGTH } from '../game/domainRules'
import { isAsleep } from '../game/playerSleep'
import type { Game } from '../game/types'
import { art } from './art'
import { HALLOWEEN_ART, drawJack } from './halloweenArt'
import { darkLayer, lightDisc } from './places'
import { ZZZ } from './props'
import { drawPokemon, sprites } from './sprites'

type Ctx = CanvasRenderingContext2D

/**
 * Darkrai's Nightmare on screen (`data/domains/darkrai.ts`,
 * `game/darkraiDomain.ts`): the dark over its domain (a ring of light around
 * each player, wider after passing a lantern; the lanterns, the attacks'
 * telegraphs and the Dark Void's safe circles shine through it; what's out in
 * the dark shows only its eyes), the jack-o'-lanterns, the "Zzz" over a
 * sleeping player, and Cresselia crossing the sky at the capture to break the
 * nightmare with Lunar Wing as the light comes back.
 */

const DARKRAI = 'darkrai'

/** Cresselia's pass over the capture scene, in its seconds: when she crosses, and when the dark lifts behind her. */
const CRESSELIA = { from: 0.1, to: 1.9, lift: 0.9, lifted: 1.6 } as const

/** The domain the team is in, when it is Darkrai's. */
const nightmare = (g: Game) => {
  const here = domainHere(g)
  return here?.d.legend === DARKRAI ? here : null
}

const clamp01 = (k: number) => Math.min(1, Math.max(0, k))
const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/** How dark it is now (`shade`, 0..1) and how far the players' own light reaches (px); null once the nightmare broke. */
const gloom = (g: Game): { shade: number; light: number } | null => {
  const here = nightmare(g)
  if (!here) return null
  const { d } = here
  const { crossing, phases } = NIGHTMARE.dark
  if (d.act === 'crossing') return crossing
  if (d.act === 'encounter') {
    const k = clamp01(d.scene / ENCOUNTER_LENGTH)
    return { shade: lerp(crossing.shade, phases[0].shade, k), light: lerp(crossing.light, phases[0].light, k) }
  }
  const last = phases[phases.length - 1]!
  if (d.act === 'capture') {
    const k = clamp01((d.scene - CRESSELIA.lift) / (CRESSELIA.lifted - CRESSELIA.lift))
    return k >= 1 ? null : { shade: last.shade * (1 - k), light: last.light + k * 200 }
  }
  if (d.act !== 'battle') return null
  // A new phase's dark settles over its first second and a half.
  const now = phases[Math.max(0, Math.min(phases.length - 1, d.phase))]!
  const before = phases[Math.max(0, d.phase - 1)]!
  const k = clamp01(d.phaseAge / 1.5)
  return { shade: lerp(before.shade, now.shade, k), light: lerp(before.light, now.light, k) }
}

/** The eyes of whatever stands out in the dark: Darkrai's (and its clones') cyan, the rest pale yellow. */
const EYES = { darkrai: '#58e8f0', other: '#f8f0a0' } as const

/** Lights cut this frame, (x, y, r) in world px: what stands inside one is seen whole. Reused, never reallocated. */
const lit: number[] = []

/**
 * The nightmare's dark, in screen space over the world (under the weather
 * and the damage numbers): cut around the players, the lanterns, every attack
 * on its way or warned, the Dark Void's safe circles and Cresselia's pass.
 */
export const drawNightmareDark = (ctx: Ctx, g: Game, camX: number, camY: number, t: number) => {
  const dark = gloom(g)
  const here = nightmare(g)
  if (!dark || !here || dark.shade <= 0.02) return
  const { arena, d } = here
  const { w, h } = g.view
  const layer = darkLayer(w, h)
  const c = layer.ctx
  c.globalCompositeOperation = 'source-over'
  c.clearRect(0, 0, w, h)
  c.fillStyle = `rgba(4,2,10,${dark.shade.toFixed(3)})`
  c.fillRect(0, 0, w, h)
  c.globalCompositeOperation = 'destination-out'
  lit.length = 0
  const cut = (x: number, y: number, r: number, sees = true) => {
    const disc = lightDisc(Math.max(4, Math.round(r)))
    c.drawImage(disc, Math.round(x - camX - disc.width / 2), Math.round(y - camY - disc.height / 2))
    if (sees) lit.push(x, y, r * 0.8)
  }
  const glow = glowing(d, g.now) ? NIGHTMARE.dark.glow : 0
  for (const p of g.players) if (!p.gone && p.hp > 0) cut(p.x, p.y - 10, dark.light + glow + Math.round(Math.sin(t * 3) * 1.5))
  for (let i = 0; i < LANTERN_COUNT; i++) {
    const at = lanternAt(arena, d, i)
    if (at.x < camX - 60 || at.y < camY - 60 || at.x > camX + w + 60 || at.y > camY + h + 60) continue
    if (lanternLit(d, i, g.now)) cut(at.x, at.y - 6, NIGHTMARE.dark.lanternLight + Math.round(Math.sin(t * 7 + i) + Math.sin(t * 17 + i * 3)))
    else cut(at.x, at.y - 6, 9, false)
  }
  // Every attack shows through the dark, warned or flying: dodging is the fight.
  for (const hz of g.hazards) {
    if (hz.x < camX - 40 || hz.y < camY - 40 || hz.x > camX + w + 40 || hz.y > camY + h + 40) {
      if (hz.kind !== 'beam') continue
    }
    if (hz.kind === 'beam') {
      const steps = Math.min(40, Math.ceil(hz.len / 14))
      for (let k = 0; k <= steps; k++) cut(hz.x + Math.cos(hz.angle) * (hz.len * k) / steps, hz.y + Math.sin(hz.angle) * (hz.len * k) / steps, hz.r + 6, false)
    } else cut(hz.x, hz.y - (hz.kind === 'shot' ? 4 : 0), hz.kind === 'shot' ? hz.r + 6 : hz.r + 6, false)
  }
  const boss = g.enemies.find((e) => e.id === d.bossId)
  const blast = boss?.fight?.blast
  if (blast) for (const s of blast.spots) cut(s.x, s.y, blast.radius + 8)
  const pass = cresselia(g)
  if (pass) cut(pass.x, pass.y - 20, 56)
  c.globalCompositeOperation = 'source-over'
  ctx.drawImage(layer.canvas, 0, 0)
  // Eyes in the dark: whatever stands outside every light.
  for (const e of g.enemies) {
    if (e.dying >= 0 || e.x < camX - 8 || e.y < camY - 8 || e.x > camX + w + 8 || e.y > camY + h + 40 || e.dir === 4) continue
    if (seen(e.x, e.y - 10)) continue
    if (hash2(e.id, Math.floor(t * 2.5), 5) < 0.12) continue
    const def: EnemyDef = ENEMIES[e.kind]
    const top = Math.round(e.y - bodyOf(def.dex).bodyH * 0.62)
    const facing = e.dir === 2 || e.dir === 1 || e.dir === 3 ? 1 : e.dir === 6 || e.dir === 5 || e.dir === 7 ? -1 : 0
    ctx.fillStyle = def.dex === ENEMIES.darkrai.dex ? EYES.darkrai : EYES.other
    ctx.fillRect(Math.round(e.x - camX - 2 + facing), top - camY, def.dex === ENEMIES.darkrai.dex ? 2 : 1, 1)
    ctx.fillRect(Math.round(e.x - camX + 2 + facing), top - camY, 1, 1)
  }
}

/** Whether (x, y) stands in any light cut this frame. */
const seen = (x: number, y: number) => {
  for (let i = 0; i < lit.length; i += 3) if ((x - lit[i]!) ** 2 + (y - lit[i + 1]!) ** 2 < lit[i + 2]! ** 2) return true
  return false
}

/** The jack-o'-lanterns on the nightmare's floor (world space, under the entities): lit ones flicker on their glow, the rest wait cold. */
export const drawNightmareGround = (ctx: Ctx, g: Game, t: number) => {
  const here = nightmare(g)
  if (!here || here.d.act === 'after') return
  const { arena, d } = here
  const { x: camX, y: camY } = g.camera
  const { w, h } = g.view
  const cold = HALLOWEEN_ART.jack()[1]
  for (let i = 0; i < LANTERN_COUNT; i++) {
    const at = lanternAt(arena, d, i)
    if (at.x < camX - 20 || at.y < camY - 20 || at.x > camX + w + 20 || at.y > camY + h + 30) continue
    if (lanternLit(d, i, g.now)) drawJack(ctx, at.x, at.y, i, t)
    else {
      ctx.globalAlpha = 0.55
      ctx.drawImage(cold, Math.round(at.x - cold.width / 2), Math.round(at.y - cold.height + 2))
      ctx.globalAlpha = 1
    }
  }
}

/** A crescent of Lunar Wing's trail, and a mote of it. */
const CRESCENT = lazy(() => art(['..111.', '.12...', '12....', '12....', '.12...', '..111.'], { 1: '#f8a8d8', 2: '#ffffff' }, '#5c2858'))

/** Where Cresselia is on her pass, in world px, and how far along it (0..1); null outside it. */
const cresselia = (g: Game) => {
  const here = nightmare(g)
  const c = here?.d.capture
  if (!here || !c || here.d.act !== 'capture') return null
  const k = (here.d.scene - CRESSELIA.from) / (CRESSELIA.to - CRESSELIA.from)
  if (k < 0 || k > 1) return null
  const span = g.view.w / 2 + 50
  return { x: c.x - span + k * span * 2, y: c.y - 70 - Math.sin(k * Math.PI) * 26, k }
}

/**
 * Over the entities: the "Zzz" over a sleeping player, and Cresselia's pass at
 * the capture, her Lunar Wing trail of pink crescents and the ring of light that
 * breaks the nightmare as she flies over Darkrai.
 */
export const drawNightmareAir = (ctx: Ctx, g: Game, t: number) => {
  const [big, small] = ZZZ()
  for (const p of g.players) {
    if (!isAsleep(p) || p.gone) continue
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.9 + k / 3) % 1
      ctx.globalAlpha = Math.min(1, (1 - ph) * 2)
      blitCentered(ctx, k === 1 ? small! : big!, p.x + 8 + ph * 8 + Math.sin(ph * 6) * 2, p.y - 30 - ph * 14)
    }
    ctx.globalAlpha = 1
  }
  const pass = cresselia(g)
  if (!pass) return
  const here = nightmare(g)!
  const c = here.d.capture!
  // The trail: crescents left behind along her path, fading.
  const crescent = CRESCENT()
  for (let i = 1; i < 14; i++) {
    const back = pass.k - i * 0.025
    if (back < 0) break
    const span = g.view.w / 2 + 50
    const x = c.x - span + back * span * 2
    const y = c.y - 70 - Math.sin(back * Math.PI) * 26 + Math.sin(i * 1.7 + t * 6) * 3
    ctx.globalAlpha = 1 - (i / 14) * 0.8
    blitCentered(ctx, crescent, x, y - 14 + (hash2(i, 1, 7) - 0.5) * 8)
    if (i % 3 === 0) {
      ctx.fillStyle = i % 2 === 0 ? '#c8a0f8' : '#f8a8d0'
      ctx.fillRect(Math.round(x + (hash2(i, 2, 7) - 0.5) * 16), Math.round(y - 4 + i), 1, 1)
    }
  }
  ctx.globalAlpha = 1
  drawPokemon(ctx, sprites(DARKRAI_DOMAIN.cameo!.dex), 'Walk', 2, t, pass.x, pass.y, { alpha: Math.min(1, pass.k * 6, (1 - pass.k) * 6) })
  // The nightmare breaks: rings of moonlight spread from Darkrai as she passes over it.
  const ring = (here.d.scene - CRESSELIA.lift) / 0.8
  if (ring > 0 && ring < 1) {
    ctx.globalAlpha = 1 - ring
    blitRing(ctx, Math.round(10 + ring * 120), 2, '#f8c8e8', c.x, c.y - 16)
    blitRing(ctx, Math.round(4 + ring * 80), 1, '#ffffff', c.x, c.y - 16)
    ctx.globalAlpha = 1
  }
}

/** How a sleeping player is tinted: the Dark Void's violet. */
export const SLEEP_TINT = { color: '#5838a8', amount: 0.45 } as const

/** A shadow clone flickers now and then (and only then shows itself for what it is); undefined for everyone else. */
export const shadeAlpha = (kind: string, id: number, t: number) => (kind === NIGHTMARE.clones.id && (t * 0.8 + id * 0.37) % 2.2 < 0.12 ? 0.5 : undefined)

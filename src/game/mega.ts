import { MEGA, MEGAS, megasOf, type MegaDef, type MegaId } from '../data/megas'
import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { burst } from './effects'
import { recomputeStats } from './leveling'
import { isAlive } from './queries'
import { SPECIALS } from './special'
import { spawnAttack } from './spawn'
import { applyStatus } from './status'
import type { Game } from './types'
import { setWeather } from './weather'
import * as dm from '../engine/dmath'

/**
 * Mega Evolution in a run. Beating a rift legendary drops the line's Mega
 * Stone (both, for a line with two Megas: the player keeps the one picked up
 * and the other crumbles); from the final stage on, a press (the Mega button, E, gamepad Y)
 * plays the transformation, then the Mega form lasts `MEGA.duration` and
 * recharges for `MEGA.recharge`. The press reaches `step()` as data
 * (`StepInput.mega`), so replays re-simulate it like the special.
 */

export type MegaState = {
  /** The Mega Stone found this run, which picks the Mega (null: none yet). */
  stone: MegaId | null
  /** Seconds left in Mega form (0: not Mega). */
  active: number
  /** Seconds until the next Mega Evolution can start (0: ready, given the stone and the final stage). */
  charge: number
  /** Seconds left of the transformation; the simulation waits meanwhile (`step`). */
  intro: number
  /** Seconds to the next pulse of an aura ability (Shadow Tag). */
  pulse: number
  /** Times it Mega Evolved this run (achievements). */
  count: number
}

export const createMegaState = (): MegaState => ({ stone: null, active: 0, charge: 0, intro: 0, pulse: 0, count: 0 })

/** The final stage of the line: the only one that can Mega Evolve. */
export const isFinalStage = (line: PlayableId, stage: number) => stage >= PLAYABLE[line].line.length - 1

/** What the Mega button shows: nothing (no stone), the stone waiting for the final stage, recharging, ready or in Mega form. */
export type MegaPhase = 'none' | 'locked' | 'charging' | 'ready' | 'active'

export const megaPhase = (s: MegaState, final: boolean): MegaPhase =>
  !s.stone ? 'none'
  : s.active > 0 || s.intro > 0 ? 'active'
  : !final ? 'locked'
  : s.charge > 0 ? 'charging'
  : 'ready'

/** Ticks the Mega form and its recharge. `end` on the tick the form runs out (the recharge starts), `ready` when the recharge is done. */
export const tickMega = (s: Pick<MegaState, 'active' | 'charge'>, dt: number): 'end' | 'ready' | null => {
  if (s.active > 0) {
    s.active = Math.max(0, s.active - dt)
    if (s.active > 0) return null
    s.charge = MEGA.recharge
    return 'end'
  }
  if (s.charge <= 0) return null
  s.charge = Math.max(0, s.charge - dt)
  return s.charge <= 0 ? 'ready' : null
}

/** The Mega the run holds the stone of, or null. */
export const heldMega = (g: Game): MegaDef | null => (g.player.mega.stone ? MEGAS[g.player.mega.stone] : null)

/** Gap between the two stones of a line with two Megas, so the player can walk to just one. */
const STONE_GAP = 40

/**
 * Drops `line`'s Mega Stones around (x, y) (the acting player's line by default):
 * one, or two side by side to choose from. A choice isn't pulled by the magnet
 * (`updatePickups`), it waits to be touched.
 */
export const dropMegaStones = (g: Game, x: number, y: number, line: PlayableId = g.player.starter) => {
  const ids = megasOf(line)
  ids.forEach((mega, i) => {
    const dx = ids.length > 1 ? (i - (ids.length - 1) / 2) * STONE_GAP : 0
    g.pickups.push({ id: g.nextId++, x: x + dx, y, vx: 0, vy: 0, attracted: false, age: 0, kind: 'megaStone', mega })
  })
  if (ids.length > 1) g.events.push({ kind: 'megaChoice' })
}

/** A Mega Stone was picked up: it picks the Mega, the others on the ground crumble, and Mega Evolution is ready from the final stage on. */
export const grantStone = (g: Game, mega: MegaId) => {
  if (g.player.mega.stone || MEGAS[mega].line !== g.player.starter) return
  g.player.mega.stone = mega
  g.player.mega.charge = 0
  for (const k of g.pickups) {
    if (k.kind !== 'megaStone' || k.mega === mega || k.age < 0) continue
    burst(g, k.x, k.y, { colors: ['#a8a0b8', '#686078', '#ffffff'], count: 14, speed: 60, ttl: 0.5, gravity: 60 })
    k.age = -1
  }
  const p = g.player
  burst(g, p.x, p.y - 12, { colors: [...rainbow], count: 40, speed: 120, ttl: 0.7, gravity: -30 })
  g.events.push({ kind: 'megaStone' })
}

/** The keystone's light, from the transformation to the burst. */
export const rainbow = ['#f85858', '#f8a838', '#f8e858', '#68d868', '#58a8f8', '#a878f8'] as const

/** Starts the transformation (the simulation waits for it, see `updateMegaIntro`). */
const startIntro = (g: Game) => {
  g.player.mega.intro = MEGA.intro
  g.events.push({ kind: 'megaStart' })
}

/** The transformation's last tick: the Mega form, its burst, its ability, and a fresh special. */
const transform = (g: Game, def: MegaDef) => {
  const s = g.player.mega
  const p = g.player
  s.intro = 0
  s.active = MEGA.duration
  s.pulse = 0
  s.count++
  recomputeStats(g)
  g.player.special.cooldown = 0
  p.iframes = Math.max(p.iframes, MEGA.iframes)
  const { radius, power, knockback } = MEGA.wave
  spawnAttack(g, {
    move: 'special', type: SPECIALS[def.special].type, visual: 'megaWave', x: p.x, y: p.y,
    shape: { kind: 'circle', r: 8 }, motion: { kind: 'follow', ox: 0, oy: -8 },
    damage: power * p.stats.might * (1 + 0.04 * (p.level - 1)), knockback, ttl: 0.55, activeUntil: 0.3, grow: (radius - 8) / 0.3,
  })
  burst(g, p.x, p.y - 12, { colors: [...rainbow, '#ffffff'], count: 70, speed: 180, ttl: 0.8, size: 2, drag: 3 })
  g.shake = Math.max(g.shake, 8)
  g.flash = Math.max(g.flash, 0.3)
  // Sand Stream, Drought, Swift Swim: the weather lives outside, so a rift arena keeps its clear skies.
  if (def.effect.kind === 'weather' && !g.rift.arena) setWeather(g, def.effect.weather)
  g.events.push({ kind: 'mega', name: def.name })
}

/** The form ran out: back to the final stage, with a puff. */
const revert = (g: Game) => {
  const p = g.player
  recomputeStats(g)
  burst(g, p.x, p.y - 12, { colors: ['#ffffff', '#c8c8f8'], count: 24, speed: 80, ttl: 0.5 })
  g.events.push({ kind: 'megaEnd' })
}

/** Shadow Tag: every `every` seconds, foes in reach get the status (a slow that keeps them close). */
const auraTick = (g: Game, def: MegaDef, dt: number) => {
  const effect = def.effect
  if (effect.kind !== 'aura') return
  const s = g.player.mega
  s.pulse -= dt
  if (s.pulse > 0) return
  s.pulse += effect.every
  const p = g.player
  const reach = dm.sq(effect.radius)
  for (const e of g.enemies) {
    if (isAlive(e) && dm.sq(e.x - p.x) + dm.sq(e.y - p.y) < reach) applyStatus(e.status, effect.status, 0, e.boss, null)
  }
}

/** Runs the transformation while the simulation waits. True while it's still playing. */
export const updateMegaIntro = (g: Game, dt: number) => {
  const def = heldMega(g)
  if (!def || g.player.mega.intro <= 0) return false
  g.player.mega.intro -= dt
  if (g.player.mega.intro <= 0) transform(g, def)
  return true
}

/** Each tick: a press when ready starts the transformation; otherwise the form and its recharge tick on. */
export const updateMega = (g: Game, pressed: boolean, dt: number) => {
  const def = heldMega(g)
  if (!def) return
  const s = g.player.mega
  const final = isFinalStage(g.player.starter, g.player.stage)
  if (pressed && megaPhase(s, final) === 'ready') return startIntro(g)
  const tick = tickMega(s, dt)
  if (tick === 'end') revert(g)
  else if (tick === 'ready' && s.stone && final) g.events.push({ kind: 'megaReady' })
  if (s.active > 0) auraTick(g, def, dt)
}

import { retain, TAU } from '../engine/math'
import { range } from '../engine/rng'
import { DOMAIN_PRESS } from '../data/domains'
import { NIGHTMARE } from '../data/domains/darkrai'
import type { DomainHooks } from './domainHooks'
import { abilityImmune } from './abilities'
import { arenaPoint, type DomainState } from './domain'
import { burst, floatText } from './effects'
import { spawnEnemy } from './enemies'
import { isAsleep } from './playerSleep'
import { standing } from './players'
import type { RiftArena } from './rift'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'

/**
 * Darkrai's Nightmare (`data/domains/darkrai.ts`), what its data can't say:
 * the jack-o'-lanterns a player lights by passing them (their light, and the
 * player's, grow for a while: `render/darkrai.ts` draws the dark), Bad Dreams
 * draining a sleeping player, the full Nightmare's shadow clones (a clone
 * vanishes at the first hit and gives nothing), and Cresselia's Lunar Wing
 * cue as the nightmare breaks. Its state lives in `DomainState.memo`.
 */

const CROSSING = NIGHTMARE.lanterns.crossing.length
const LANTERNS = CROSSING + NIGHTMARE.lanterns.arena.length

/** `memo` slots: each lantern's burn (the `now` it goes out, 0 unlit), the players' widened light, the next clone wave, and Bad Dreams' chunk clock. */
const GLOW = LANTERNS
const CLONES_AT = LANTERNS + 1
const DREAMS = LANTERNS + 2

/** The clones' phase (from 0): the last. */
const CLONE_PHASE = 2

const memoOf = (d: DomainState, slot: number) => d.memo[slot] ?? 0

/** Fills every `memo` slot (0, as unset reads), so lighting a later lantern first never leaves a hole the snapshots can't hold (`game/snapshot.ts`). */
const allSlots = (d: DomainState) => {
  while (d.memo.length <= DREAMS) d.memo.push(0)
}

/** Lantern `i`'s spot in world px: the crossing's are domain px, the arena's arena px. */
export const lanternAt = (arena: RiftArena, d: DomainState, i: number) => {
  const crossing = NIGHTMARE.lanterns.crossing[i]
  if (crossing) return { x: arena.x + crossing[0], y: arena.y + crossing[1] }
  return arenaPoint(arena, d, NIGHTMARE.lanterns.arena[i - CROSSING]!)
}

/** How many lanterns Darkrai's domain has. */
export const LANTERN_COUNT = LANTERNS

/** Whether lantern `i` burns at `now`. */
export const lanternLit = (d: DomainState, i: number, now: number) => memoOf(d, i) > now

/** Whether the players' light is widened by a lantern passed lately. */
export const glowing = (d: DomainState, now: number) => memoOf(d, GLOW) > now

/** A player passing a lantern lights it (again): it burns `burn` s, and their light stays wider for `glow` s. */
const lightLanterns = (g: Game, d: DomainState) => {
  const arena = g.rift.arena
  if (!arena) return
  const { reach, burn, glow } = NIGHTMARE.lantern
  for (let i = 0; i < LANTERNS; i++) {
    const at = lanternAt(arena, d, i)
    for (const p of g.players) {
      if (!standing(g, p) || dm.sq(p.x - at.x) + dm.sq(p.y - at.y) > reach * reach) continue
      if (!lanternLit(d, i, g.now)) burst(g, at.x, at.y - 8, { colors: ['#f8a030', '#f8e070', '#ffffff'], count: 14, speed: 50, ttl: 0.5, gravity: -60 })
      d.memo[i] = g.now + burn
      d.memo[GLOW] = g.now + glow
    }
  }
}

/** Bad Dreams: every `every` s, each sleeping player loses a chunk of their max HP (never the last of it); Magic Guard (`drain`) spares them. */
const badDreams = (g: Game, d: DomainState, dt: number) => {
  const { share, every } = NIGHTMARE.badDreams
  d.memo[DREAMS] = memoOf(d, DREAMS) + dt
  if (memoOf(d, DREAMS) < every) return
  d.memo[DREAMS] = memoOf(d, DREAMS) - every
  const harm = DOMAIN_PRESS[g.difficulty].harm
  const before = g.player
  for (const p of g.players) {
    g.player = p
    if (!isAsleep(p) || !standing(g, p) || abilityImmune(g, 'drain')) continue
    const lost = Math.min(p.hp - 1, dm.round(p.stats.maxHp * share * every * harm))
    if (lost <= 0) continue
    p.hp -= lost
    p.record.taken += lost
    floatText(g, p.x, p.y - 30, String(lost), '#b080f8', true)
    burst(g, p.x, p.y - 14, { colors: ['#7850c8', '#b8a0f8'], count: 4, speed: 30, ttl: 0.4, gravity: -30 })
  }
  g.player = before
}

const isShade = (e: Enemy) => e.kind === NIGHTMARE.clones.id

/** A wave of shadow clones walks out of the dark around Darkrai, as tough-looking as it is. */
const cloneWave = (g: Game, boss: Enemy) => {
  const { count, radius, touch } = NIGHTMARE.clones
  const turn = range(g.rng, 0, TAU)
  for (let i = 0; i < count; i++) {
    const a = turn + (i / count) * TAU
    const e = spawnEnemy(g, NIGHTMARE.clones.id, boss.x + dm.cos(a) * radius, boss.y + dm.sin(a) * radius * 0.8)
    // As much HP as the real one, so nothing tells them apart but the hit; a hit makes it vanish (`clones`).
    e.hp = e.maxHp = boss.maxHp
    e.damage = boss.damage * touch
    burst(g, e.x, e.y - 14, { colors: ['#140c24', '#5c3c8c', '#58e8f0'], count: 18, speed: 70, ttl: 0.45 })
  }
}

/** The clones: any one hit vanishes in a puff; once none is left, the next wave comes `every` s later. */
const clones = (g: Game, d: DomainState, boss: Enemy) => {
  let left = 0
  for (const e of g.enemies) {
    if (!isShade(e)) continue
    if (e.hp < e.maxHp || e.dying >= 0) {
      burst(g, e.x, e.y - 14, { colors: ['#140c24', '#5c3c8c', '#b8a0f8'], count: 20, speed: 90, ttl: 0.4 })
      e.dying = Infinity
    } else left++
  }
  retain(g.enemies, (e) => !isShade(e) || e.dying !== Infinity)
  if (boss.fight?.phase !== CLONE_PHASE || left > 0) return
  const next = memoOf(d, CLONES_AT)
  if (next === 0) d.memo[CLONES_AT] = g.now + NIGHTMARE.clones.every
  else if (g.now >= next) {
    d.memo[CLONES_AT] = 0
    cloneWave(g, boss)
  }
}

export const DARKRAI_HOOKS: DomainHooks = {
  crossing: (g, d) => {
    allSlots(d)
    lightLanterns(g, d)
  },
  battle: (g, d, boss, dt) => {
    allSlots(d)
    lightLanterns(g, d)
    badDreams(g, d, dt)
    clones(g, d, boss)
  },
  // The full Nightmare's first clones walk out as its opening ends.
  phase: (g, d, boss, phase) => {
    allSlots(d)
    if (phase === CLONE_PHASE) d.memo[CLONES_AT] = g.now + (boss.fight?.shift ?? 0)
  },
  // Cresselia comes to break the nightmare (a scene, `render/darkrai.ts`) and wakes whoever sleeps; the capture plays as always.
  fallen: (g) => {
    for (const p of g.players) p.asleep = 0
    g.events.push({ kind: 'domainCue', enemy: 'darkrai', cue: 'lunarWing' })
    return false
  },
}

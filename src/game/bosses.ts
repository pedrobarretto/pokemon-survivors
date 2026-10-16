import { dir8, dirTo, retain, TAU } from '../engine/math'
import { chance, range } from '../engine/rng'
import { BOSS_PATTERNS, BOSS_RAGE, type BossPattern, type HazardVisual } from '../data/bosses'
import { FINALE, fleesFrom } from '../data/waves'
import { attackWait, chainTarget, createFight, fightsInStances, patternLive, shouldEnrage, tickStance } from './bossFight'
import { hurtPlayer } from './combat'
import { burst } from './effects'
import { blastHorde } from './enemies'
import { isAsleep } from './status'
import { actAs, inPlay, nearestPlayer } from './players'
import type { Enemy, Game, Hazard } from './types'
import { HAZARD_TYPES } from './weather'
import * as dm from '../engine/dmath'

type HazardInit = Pick<Hazard, 'kind' | 'visual' | 'x' | 'y' | 'r' | 'damage' | 'ttl'> & Partial<Hazard>

const spawnHazard = (g: Game, init: HazardInit) => {
  g.hazards.push({ id: g.nextId++, vx: 0, vy: 0, age: 0, armAt: 0, disarmAt: Infinity, vanishOnHit: false, ...init })
}

/** How long a strike keeps hurting after it lands. */
const STRIKE_WINDOW = 0.15

const fire = (g: Game, boss: Enemy, pattern: BossPattern) => {
  const p = nearestPlayer(g, boss.x, boss.y)
  switch (pattern.kind) {
    case 'strikes': {
      const center = pattern.target === 'player' ? p : boss
      for (let i = 0; i < pattern.count; i++) {
        // The first strike always aims at the target; the rest scatter around it.
        const a = range(g.rng, 0, TAU)
        const d = i === 0 ? 0 : range(g.rng, pattern.radius, pattern.spread)
        spawnHazard(g, {
          kind: 'strike',
          visual: pattern.visual,
          x: center.x + dm.cos(a) * d,
          y: center.y + dm.sin(a) * d * 0.8,
          r: pattern.radius,
          damage: pattern.damage,
          armAt: pattern.delay,
          disarmAt: pattern.delay + STRIKE_WINDOW,
          ttl: pattern.delay + 0.45,
        })
      }
      return
    }
    case 'ring': {
      const offset = range(g.rng, 0, TAU)
      for (let i = 0; i < pattern.count; i++) {
        const a = offset + (i / pattern.count) * TAU
        spawnHazard(g, {
          kind: 'shot',
          visual: pattern.visual,
          x: boss.x + dm.cos(a) * boss.radius,
          y: boss.y + dm.sin(a) * boss.radius,
          vx: dm.cos(a) * pattern.speed,
          vy: dm.sin(a) * pattern.speed,
          r: pattern.radius,
          damage: pattern.damage,
          ttl: 5,
          vanishOnHit: true,
        })
      }
      return
    }
    case 'trail': {
      spawnHazard(g, {
        kind: 'zone',
        visual: pattern.visual,
        x: boss.x + range(g.rng, -3, 3),
        y: boss.y + range(g.rng, -2, 2),
        r: pattern.radius,
        damage: pattern.damage,
        armAt: 0.15,
        disarmAt: pattern.ttl - 0.3,
        ttl: pattern.ttl,
      })
      return
    }
  }
}

/** How fast a fleeing boss glides off the screen, px/s. */
const FLEE_SPEED = 260

/**
 * A new wave's boss arrives at `at`: earlier wave bosses still around run off
 * (`fleesFrom`). They leave play at once, glide away from the player in a puff
 * of dust and drop nothing; the shell toasts it.
 */
export const chaseOffBosses = (g: Game, at: number) => {
  for (const e of g.enemies) {
    if (!e.boss || e.dying >= 0 || !fleesFrom(e.kind, at)) continue
    const p = nearestPlayer(g, e.x, e.y)
    const d = dirTo(p.x, p.y, e.x, e.y)
    e.dying = 0
    e.fled = true
    e.kx = d.x * FLEE_SPEED
    e.ky = d.y * FLEE_SPEED
    e.dir = dir8(d.x, d.y)
    if (g.bossId === e.id) g.bossId = null
    burst(g, e.x, e.y - e.radius * 0.5, { colors: ['#ffffff', '#e0d8c8', '#b0a890'], count: 36, speed: 120, ttl: 0.6, size: 2, drag: 5 })
    g.events.push({ kind: 'bossFled', enemy: e.kind })
  }
}

/** The finale boss arrives: a psychic shockwave from every player blasts the horde back (`FINALE.push`). */
export const finaleEntrance = (g: Game) => {
  blastHorde(g, FINALE.push)
  for (const p of g.players) {
    if (inPlay(p)) burst(g, p.x, p.y - 8, { colors: ['#f85888', '#f8b0d0', '#ffffff'], count: 90, speed: 320, ttl: 0.55, size: 2, drag: 2 })
  }
  g.shake = Math.max(g.shake, 10)
}

/** How far from the player a boss attacks from (and counts as in the fight, `bossInFight`). */
export const bossReach = (g: Game) => dm.hypot(g.view.w, g.view.h) * 0.6

/** A wave boss under half HP enrages: a red burst, a jolt and a cue for the shell (cry, flash, toast). */
const enrage = (g: Game, e: Enemy) => {
  e.fight!.enraged = true
  burst(g, e.x, e.y - e.radius, { colors: ['#f83020', '#f8a020', '#ffffff'], count: 48, speed: 160, ttl: 0.6, size: 2, drag: 4 })
  g.shake = Math.max(g.shake, 6)
  g.events.push({ kind: 'enrage', enemy: e.kind })
}

/**
 * Ticks every boss's attack patterns. Bosses only attack once they're close
 * enough to be seen. Wave bosses also swap stance (only the live stance's
 * patterns count down; entering one holds its attacks `BOSS_RAGE.open` s) and,
 * once enraged, attack sooner and sometimes chain a second attack.
 */
export const updateBosses = (g: Game, dt: number) => {
  const reach = bossReach(g)
  for (const e of g.enemies) {
    const patterns = BOSS_PATTERNS[e.kind]
    if (!patterns || e.dying >= 0) continue
    if (e.fight === null && fightsInStances(e.kind)) e.fight = createFight(g.rng)
    const fight = e.fight
    if (fight && shouldEnrage(fight, e.hp, e.maxHp)) enrage(g, e)
    // Stunned or asleep bosses hold their attacks (paralysis and the Poké Flute pay off here).
    if (e.status.stun > 0 || isAsleep(e.status)) continue
    if (e.cooldowns.length === 0) e.cooldowns = patterns.map((pt) => pt.every * 0.5)
    if (fight && tickStance(fight, dt, g.rng)) {
      patterns.forEach((pt, i) => {
        if (pt.stance === fight.stance) e.cooldowns[i] = Math.max(e.cooldowns[i]!, BOSS_RAGE.open)
      })
    }
    const target = nearestPlayer(g, e.x, e.y)
    const near = dm.hypot(e.x - target.x, e.y - target.y) < reach
    patterns.forEach((pattern, i) => {
      if (fight && !patternLive(pattern, fight.stance)) return
      e.cooldowns[i]! -= dt
      if (e.cooldowns[i]! > 0 || !near) return
      fire(g, e, pattern)
      e.cooldowns[i]! += attackWait(pattern.every, fight)
      if (!fight?.enraged || pattern.kind === 'trail' || !chance(g.rng, BOSS_RAGE.chain)) return
      const next = chainTarget(patterns, fight.stance, i)
      if (next >= 0) e.cooldowns[next] = Math.min(e.cooldowns[next]!, BOSS_RAGE.gap)
    })
  }
}

const IMPACT: Partial<Record<HazardVisual, { colors: readonly string[]; event: 'thunder' | 'quake' }>> = {
  ice: { colors: ['#98d8f8', '#e0f8ff', '#ffffff'], event: 'quake' },
  fire: { colors: ['#f86830', '#f8c030', '#fff0a0'], event: 'quake' },
  rock: { colors: ['#b8a038', '#786028', '#e0c068'], event: 'quake' },
  slam: { colors: ['#e0c068', '#a8a878', '#ffffff'], event: 'quake' },
  thunder: { colors: ['#f8d030', '#ffffff', '#fff8a0'], event: 'thunder' },
  psychic: { colors: ['#f85888', '#f8b0d0', '#ffffff'], event: 'quake' },
  water: { colors: ['#58a8f8', '#c8e8f8', '#ffffff'], event: 'quake' },
  dragon: { colors: ['#a070f8', '#7038f8', '#f0e0ff'], event: 'quake' },
  steel: { colors: ['#c8e0f8', '#78e0f8', '#ffffff'], event: 'quake' },
  aero: { colors: ['#ffffff', '#d8e8f8', '#a8c8f8'], event: 'quake' },
  grass: { colors: ['#70d048', '#e0f8a0', '#286820'], event: 'quake' },
  judgment: { colors: ['#fff0a0', '#f8d030', '#ffffff'], event: 'thunder' },
}

/** Moves enemy hazards, plays impacts as telegraphs land and hurts the players they touch. */
export const updateHazards = (g: Game, dt: number) => {
  for (const h of g.hazards) {
    const before = h.age
    h.age += dt
    h.x += h.vx * dt
    h.y += h.vy * dt

    const impact = IMPACT[h.visual]
    if (impact && h.kind === 'strike' && before < h.armAt && h.age >= h.armAt) {
      burst(g, h.x, h.y, { colors: impact.colors, count: Math.round(h.r * 0.8), speed: h.r * 5, ttl: 0.4 })
      g.shake = Math.max(g.shake, 2)
      g.events.push({ kind: impact.event })
    }

    if (h.age < h.armAt || h.age > h.disarmAt) continue
    for (const p of g.players) {
      if (!inPlay(p)) continue
      const reach = h.r + p.radius * 0.7
      if (dm.sq(h.x - p.x) + dm.sq(h.y - p.y) >= reach * reach) continue
      actAs(g, p, () => hurtPlayer(g, h.damage, undefined, HAZARD_TYPES[h.visual]))
      if (h.vanishOnHit) {
        h.age = h.ttl
        break
      }
    }
  }
  retain(g.hazards, (h) => h.age < h.ttl)
}

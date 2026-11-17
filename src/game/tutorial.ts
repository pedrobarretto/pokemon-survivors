import * as dm from '../engine/dmath'
import { retain, TAU, type Vec } from '../engine/math'
import { range } from '../engine/rng'
import { ENEMIES, type EnemyId } from '../data/enemies'
import { TRAINING } from '../data/training'
import { spawnAlpha } from './alphas'
import { killEnemy } from './combat'
import { spawnEnemy } from './enemies'
import { gainXp, xpFor } from './leveling'
import { dropPickup } from './pickups'
import { setArchetype } from './terrain'
import { createTraitState } from './traits'
import type { Enemy, Game } from './types'

/**
 * The first visit's training run ("Primeiros passos"): a run on the Dojo's
 * state (`Game.training.tutorial`) that teaches the core loop one lesson at a
 * time, each waiting for the player: walk, let the moves fire on their own,
 * pick up the EXP and choose a level-up card, a small wave, a Poké Ball, then
 * an Alpha with its HP bar. Its tick is `stepTutorial` in `game.ts`; the shell
 * reads `step` for Rotom's lines (`ui/tutorialCoach.ts`). Like the Dojo it's
 * never ranked, banked nor replayed, and it can't be lost: HP never drops under
 * `TUTORIAL.floor`. Every step also has a timeout after which the tutorial
 * does it for the player, so nobody gets stuck.
 */

/** The lessons, in order. The shell's `TutorialEnd.step` is the furthest one reached. */
export const TUTORIAL_STEPS = ['move', 'fight', 'xp', 'wave', 'ball', 'boss', 'end'] as const
export type TutorialStepId = (typeof TUTORIAL_STEPS)[number]

/** A foe's numbers for the lessons, in place of its species' (EXP per foe, px/s). */
type FoeStats = { hp: number; speed: number; damage: number; xp: number }

export const TUTORIAL = {
  /** World px walked that count as having moved. */
  walk: 70,
  /** Seconds a step waits for the player before the tutorial does it for them. */
  timeout: { move: 15, fight: 30, xp: 15, wave: 45, ball: 20, boss: 45 },
  /** The first foes: a few slow, weak Caterpie walking in from ahead, worth one level between them. */
  fight: { kind: 'caterpie', count: 4, hp: 12, speed: 16, damage: 4, xp: 2 },
  /** The wave: packs from all sides, worth one more level between them (`xpFor(2)`, Exp. Charm or not). */
  wave: { kinds: ['caterpie', 'weedle', 'wurmple'], packs: 5, size: 5, every: 3.2, first: 0.8, hp: 16, speed: 26, damage: 5, xp: 0.8 },
  /** The mini-boss: an Alpha Pinsir, slow to fall but never a threat. */
  boss: { kind: 'pinsir', hp: 600, damage: 9 },
  /** HP never drops under this share of max; it climbs back at `regen` of max per second after `calm` s unhurt. */
  floor: 0.35,
  regen: 0.06,
  calm: 2.5,
  /** Seconds Rotom's "don't get touched" line holds after the first hurt. */
  ouch: 4,
} as const satisfies {
  timeout: Record<Exclude<TutorialStepId, 'end'>, number>
  fight: FoeStats & { kind: EnemyId; count: number }
  wave: FoeStats & { kinds: readonly EnemyId[]; packs: number; size: number; every: number; first: number }
  boss: { kind: EnemyId; hp: number; damage: number }
  [k: string]: unknown
}

/** The species the tutorial brings, whose sheets the shell loads before it starts. */
export const TUTORIAL_DEXES = [...new Set([TUTORIAL.fight.kind, ...TUTORIAL.wave.kinds, TUTORIAL.boss.kind].map((id) => ENEMIES[id].dex))]

/** The lesson under way, on the run (`Training.tutorial`; null at the Dojo). */
export type TutorialRun = {
  step: TutorialStepId
  /** Seconds into the step (the timeouts). */
  t: number
  /** World px walked so far, and where the player stood last tick. */
  walked: number
  from: Vec
  /** The step's foes, by enemy id (the wave's and the fight's). */
  foes: number[]
  /** Wave packs still to come, and seconds to the next. */
  packs: number
  next: number
  /** The Alpha's enemy id (-1 before it comes). */
  boss: number
  /** The level the EXP lesson waits past. */
  level: number
  /** HP lost so far (`record.taken`), to notice a hurt; seconds since the last one. */
  taken: number
  calm: number
  /** Seconds left of Rotom's "don't get touched" line (set once, on the first hurt). */
  ouch: number
  hurt: boolean
}

/** What a step's end depends on, read off the game each tick (`factsOf`). */
export type TutorialFacts = {
  walked: number
  /** The step's foes still standing, and the wave's packs still to come. */
  foes: number
  packs: number
  /** The player is past the level the EXP lesson started at. */
  leveled: boolean
  /** The Poké Ball was taken and its screen, if any, closed. */
  ball: boolean
  bossDown: boolean
}

/** The step after `step` once the facts say it's done, or `step` while it isn't. */
export const nextStep = (step: TutorialStepId, f: TutorialFacts): TutorialStepId => {
  switch (step) {
    case 'move':
      return f.walked >= TUTORIAL.walk ? 'fight' : step
    case 'fight':
      return f.foes === 0 ? 'xp' : step
    case 'xp':
      return f.leveled ? 'wave' : step
    case 'wave':
      return f.packs === 0 && f.foes === 0 ? 'ball' : step
    case 'ball':
      return f.ball ? 'boss' : step
    case 'boss':
      return f.bossDown ? 'end' : step
    case 'end':
      return step
  }
}

/** Whether `step` has waited `t` s, long enough for the tutorial to do it for the player. */
export const overdue = (step: TutorialStepId, t: number) => step !== 'end' && t >= TUTORIAL.timeout[step]

/** The player's HP after a hit in the tutorial: never under `TUTORIAL.floor` of max (`hurtPlayer`). */
export const tutorialHp = (hp: number, maxHp: number) => Math.max(hp, maxHp * TUTORIAL.floor)

/** World px from the screen's middle to its edge along the unit direction (`dx`, `dy`), for a `view` of that size. */
export const edgeReach = (view: { w: number; h: number }, dx: number, dy: number) =>
  Math.min(Math.abs(dx) > 1e-6 ? view.w / 2 / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? view.h / 2 / Math.abs(dy) : Infinity)

/** Turns the run into the training run: the Dojo's state with no dummies, the lessons at their first step, on the classic route. */
export const startTutorial = (g: Game) => {
  const p = g.player
  setArchetype(g, 'route')
  const tutorial: TutorialRun = {
    step: 'move', t: 0, walked: 0, from: { x: p.x, y: p.y }, foes: [], packs: 0, next: 0, boss: -1,
    level: p.level, taken: p.record.taken, calm: 0, ouch: 0, hurt: false,
  }
  g.training = { target: TRAINING.target, posts: [], home: { x: p.x, y: p.y }, aim: { x: 1, y: 0, reach: TRAINING.reach }, lens: { x: 0, y: 0 }, shown: { x: 0, y: 0 }, trial: null, tutorial }
}

/** A foe of `kind` with the lesson's numbers, no trait, and a little spread in its pace. */
const spawnFoe = (g: Game, kind: EnemyId, x: number, y: number, s: FoeStats): Enemy => {
  const e = spawnEnemy(g, kind, x, y)
  e.hp = e.maxHp = s.hp
  e.speed = s.speed * range(g.rng, 0.9, 1.1)
  e.damage = s.damage
  e.xp = s.xp
  e.trait = createTraitState(undefined, 0)
  return e
}

/** Where the player looks (a unit vector; right if it's never moved). */
const ahead = (g: Game): Vec => {
  const f = g.player.facing
  const n = dm.hypot(f.x, f.y)
  return n > 1e-6 ? { x: f.x / n, y: f.y / n } : { x: 1, y: 0 }
}

/** The fight's few foes, in an arc ahead of the player, well inside the screen. */
const spawnFight = (g: Game, tut: TutorialRun) => {
  const p = g.player
  const a = ahead(g)
  const s = TUTORIAL.fight
  const base = dm.atan2(a.y, a.x)
  const reach = Math.min(110, edgeReach(g.view, a.x, a.y) * 0.75)
  for (let i = 0; i < s.count; i++) {
    const ang = base + (i - (s.count - 1) / 2) * 0.4
    tut.foes.push(spawnFoe(g, s.kind, p.x + dm.cos(ang) * reach, p.y + dm.sin(ang) * reach, s).id)
  }
}

/** One of the wave's packs, just past the screen's edge on a side drawn from the run's rng. */
const spawnPack = (g: Game, tut: TutorialRun) => {
  const p = g.player
  const s = TUTORIAL.wave
  const ang = range(g.rng, 0, TAU)
  const dx = dm.cos(ang)
  const dy = dm.sin(ang)
  const reach = edgeReach(g.view, dx, dy) + 14
  for (let i = 0; i < s.size; i++) {
    const kind = s.kinds[Math.floor(g.rng() * s.kinds.length)] ?? s.kinds[0]
    // Side by side across the way in, a little staggered.
    const side = (i - (s.size - 1) / 2) * 14
    const back = range(g.rng, 0, 12)
    tut.foes.push(spawnFoe(g, kind, p.x + dx * (reach + back) - dy * side, p.y + dy * (reach + back) + dx * side, s).id)
  }
}

/** The Alpha, walking in from the edge of the screen ahead, its HP on the boss bar. */
const spawnBoss = (g: Game, tut: TutorialRun) => {
  const p = g.player
  const a = ahead(g)
  const reach = edgeReach(g.view, a.x, a.y) * 0.9
  const e = spawnAlpha(g, TUTORIAL.boss.kind, p.x + a.x * reach, p.y + a.y * reach)
  e.hp = e.maxHp = TUTORIAL.boss.hp
  e.damage = TUTORIAL.boss.damage
  tut.boss = e.id
  g.bossId = e.id
}

const standing = (g: Game, id: number) => g.enemies.some((e) => e.id === id && e.dying < 0)

/** What the step's end depends on, now. */
export const factsOf = (g: Game, tut: TutorialRun): TutorialFacts => ({
  walked: tut.walked,
  foes: tut.foes.length,
  packs: tut.packs,
  leveled: g.player.level > tut.level,
  ball: g.phase === 'playing' && !g.pickups.some((k) => k.kind === 'pokeball'),
  bossDown: tut.boss >= 0 && !standing(g, tut.boss),
})

/** Moves on to `step`, setting up what it brings. */
const enter = (g: Game, tut: TutorialRun, step: TutorialStepId) => {
  tut.step = step
  tut.t = 0
  const p = g.player
  switch (step) {
    case 'fight':
      return spawnFight(g, tut)
    case 'wave':
      tut.packs = TUTORIAL.wave.packs
      tut.next = TUTORIAL.wave.first
      return
    case 'ball': {
      const a = ahead(g)
      const reach = Math.min(80, edgeReach(g.view, a.x, a.y) * 0.6)
      return dropPickup(g, p.x + a.x * reach, p.y + a.y * reach, 'pokeball')
    }
    case 'boss':
      return spawnBoss(g, tut)
    case 'end':
      // The Alpha's EXP and prize would open more screens (and its news would point at the prize): the lesson is over, its ₽ sparkle on.
      g.bossId = null
      retain(g.pickups, (k) => k.kind !== 'xp' && k.kind !== 'alphaPrize')
      retain(g.events, (e) => e.kind !== 'alpha' || e.moment !== 'down')
      return
  }
}

/** A step that waited too long: the tutorial does it for the player. */
const hurry = (g: Game, tut: TutorialRun) => {
  const p = g.player
  switch (tut.step) {
    case 'move':
      tut.walked = TUTORIAL.walk
      return
    case 'fight':
    case 'wave':
      tut.packs = 0
      for (const e of g.enemies) if (e.dying < 0 && tut.foes.includes(e.id)) killEnemy(g, e)
      return
    case 'xp': {
      // The EXP on the ground flies in; with none left, the level comes anyway.
      const gems = g.pickups.filter((k) => k.kind === 'xp')
      for (const k of gems) k.attracted = true
      if (gems.length === 0 && p.level <= tut.level) gainXp(g, xpFor(p.level) - p.xp, 1)
      return
    }
    case 'ball':
      for (const k of g.pickups) if (k.kind === 'pokeball') k.attracted = true
      return
    case 'boss': {
      const e = g.enemies.find((x) => x.id === tut.boss && x.dying < 0)
      if (e) killEnemy(g, e)
      return
    }
    case 'end':
      return
  }
}

/**
 * The lessons' every tick (`stepTutorial`, after the moves and pickups): counts
 * the walk, notices the first hurt and holds the HP floor's regen, brings the
 * wave's packs, hurries a step that waited too long and moves on when one is done.
 */
export const updateTutorial = (g: Game, dt: number) => {
  const tut = g.training?.tutorial
  if (!tut) return
  const p = g.player
  tut.t += dt
  tut.walked += dm.hypot(p.x - tut.from.x, p.y - tut.from.y)
  tut.from.x = p.x
  tut.from.y = p.y
  if (p.record.taken > tut.taken) {
    tut.taken = p.record.taken
    tut.calm = 0
    if (!tut.hurt) {
      tut.hurt = true
      tut.ouch = TUTORIAL.ouch
    }
  } else tut.calm += dt
  tut.ouch = Math.max(0, tut.ouch - dt)
  if (tut.calm >= TUTORIAL.calm && p.hp < p.stats.maxHp) p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * TUTORIAL.regen * dt)
  if (tut.step === 'wave' && tut.packs > 0) {
    tut.next -= dt
    if (tut.next <= 0) {
      spawnPack(g, tut)
      tut.packs--
      tut.next = TUTORIAL.wave.every
    }
  }
  retain(tut.foes, (id) => standing(g, id))
  if (overdue(tut.step, tut.t)) hurry(g, tut)
  retain(tut.foes, (id) => standing(g, id))
  const next = nextStep(tut.step, factsOf(g, tut))
  if (next !== tut.step) enter(g, tut, next)
}

/** Dev (`ps.tutorial(step)`): sends the foes away and starts lesson `step` at once. */
export const jumpTutorial = (g: Game, step: TutorialStepId) => {
  const tut = g.training?.tutorial
  if (!tut) return
  g.enemies.length = 0
  for (const a of g.attacks) if (a.motion.kind === 'homing') a.motion.target = null
  g.bossId = null
  tut.foes.length = 0
  tut.packs = 0
  enter(g, tut, step)
}

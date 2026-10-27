import { retain, type Vec } from '../engine/math'
import * as dm from '../engine/dmath'
import { abilitySet, createAbilityState, grantAbility } from './abilities'
import type { AbilityId } from '../data/abilities'
import { BRANCHES, branchesAt, type BranchId } from '../data/branches'
import { evolutionOf, evolvedFrom } from '../data/evolutions'
import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { ITEMS, type ItemId } from '../data/items'
import { TRAINING, type TrainingTarget } from '../data/training'
import type { Build } from './builds'
import { spawnEnemy } from './enemies'
import { runLearnset } from './learnsets'
import { MAX_ITEMS, MAX_MOVES, recomputeStats } from './leveling'
import { LEGENDARY_MOVE_OF } from '../data/legendaryMoves'
import { AWAKEN_AT, isLegend, legendSignature, type LegendId } from '../data/legends'
import { learnable } from './kitRules'
import { forkAt, isLegendary, isManual, maxMoveLevel, withBranch, type MoveId } from './moves'
import { aimScreen, ownAttack } from './players'
import { shelfTms } from './tmShelf'
import { createTraitState } from './traits'
import type { DamageSource, Enemy, Game } from './types'

/**
 * The Dojo: a run with no horde, no clock and no harm, where the player sets
 * their own form, moves, items and ability and tries them on dummies. The
 * tick (`stepTraining` in `game.ts`) runs only the players, their moves and
 * the dummies; the world waits. A training run is never ranked nor banked, so
 * the shell changes it directly through these functions (nothing is recorded:
 * there is no replay to judge). The dummies are wild species standing still
 * at their posts with `TRAINING.hp`, topped up every tick, so they never
 * faint while `Player.damageByMove` counts every hit (the shell's `DpsMeter`
 * reads it).
 */

/** The Dojo's state on the run (`Game.training`; null in every other run). */
export type Training = {
  target: TrainingTarget
  /** Where the dummies stand, by enemy id (a dummy that fainted anyway is replaced at its post). */
  posts: { id: number; x: number; y: number }[]
  /** Where the player started: the dummies stand around it. */
  home: Vec
  /** Where the dummies stand from it: a unit direction and how far (world px), so the shell keeps them clear of its panel. */
  aim: Aim
  /** Where the player stands on screen, from its center (world px): the middle of the field the shell's panel leaves open (`setLens`). */
  lens: Vec
  /** The lens the camera shows now, easing to `lens` (`trainingCamera`). */
  shown: Vec
}

/** Which way from the player's start the dummies stand, and how far. */
export type Aim = { x: number; y: number; reach: number }

const AHEAD: Aim = { x: 1, y: 0, reach: TRAINING.reach }

/** The posts of `count` dummies from `home` along `aim`: one ahead, an arc, a ring around, or a pack ahead for area moves. */
export const dummyPosts = (home: Vec, count: number, aim: Aim = AHEAD): Vec[] => {
  const r = aim.reach
  const along = (d: number, side: number) => ({ x: dm.round(home.x + aim.x * d - aim.y * side), y: dm.round(home.y + aim.y * d + aim.x * side) })
  if (count <= 3) return Array.from({ length: count }, (_, i) => along(r, (i - (count - 1) / 2) * r * 0.6))
  if (count <= 8)
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2
      return { x: home.x + dm.round(dm.cos(a) * r), y: home.y + dm.round(dm.sin(a) * r * 0.8) }
    })
  const cols = Math.ceil(Math.sqrt(count * 1.5))
  const gap = Math.max(12, Math.min(18, r / 3))
  // Rows across the aim, columns along it, starting a little closer than a single dummy.
  return Array.from({ length: count }, (_, i) => along(r * 0.7 + Math.floor(i / cols) * gap, ((i % cols) - (cols - 1) / 2) * gap))
}

/** A dummy: the species standing still (a flyby with no speed and no end, so it never wraps around the player), harmless and worth nothing. */
const spawnDummy = (g: Game, target: TrainingTarget, at: Vec): Enemy => {
  const e = spawnEnemy(g, target, at.x, at.y, { kind: 'flyby', vx: 0, vy: 0, ttl: Infinity })
  e.hp = e.maxHp = TRAINING.hp
  e.speed = 0
  e.damage = 0
  e.xp = 0
  e.trait = createTraitState(undefined, 0)
  return e
}

/** Turns the run into the Dojo, with `count` dummies of `target` around the player, along `aim`. */
export const startTraining = (g: Game, target: TrainingTarget = TRAINING.target, count: number = TRAINING.counts[0], aim: Aim = AHEAD) => {
  const p = g.player
  g.training = { target, posts: [], home: { x: p.x, y: p.y }, aim, lens: { x: 0, y: 0 }, shown: { x: 0, y: 0 } }
  setDummies(g, target, count)
}

/** Sets where the player stands on screen, from its center (world px): the shell keeps them clear of its panel. */
export const setLens = (g: Game, x: number, y: number) => {
  const t = g.training
  if (!t) return
  t.lens.x = x
  t.lens.y = y
}

/** How fast (per second) the camera eases to a new lens: quick enough to follow the panel folding. */
const LENS_EASE = 10

/** The Dojo's camera (`followPlayers`' frame): each player centered on the lens instead of the screen. */
export const trainingCamera = (g: Game, dt: number) => {
  const t = g.training
  if (!t) return false
  const k = Math.min(1, LENS_EASE * dt)
  t.shown.x += (t.lens.x - t.shown.x) * k
  t.shown.y += (t.lens.y - t.shown.y) * k
  const p = g.player
  aimScreen(g, p, p.x - g.view.w / 2 - t.shown.x, p.y - 10 - g.view.h / 2 - t.shown.y)
  return true
}

/** Sends the dummies away and stands `count` of `target` at their posts. */
export const setDummies = (g: Game, target: TrainingTarget, count: number) => {
  const t = g.training
  if (!t) return
  t.target = target
  g.enemies.length = 0
  for (const a of g.attacks) if (a.motion.kind === 'homing') a.motion.target = null
  t.posts = dummyPosts(t.home, count, t.aim).map((at) => ({ ...at, id: spawnDummy(g, target, at).id }))
}

/**
 * The Dojo's every tick, after the moves: the dummies are topped up and slide
 * back to their posts (one that fainted anyway, to an execute, stands again),
 * the player can't be worn down, and nothing drops (no EXP, no level-ups).
 */
export const updateTraining = (g: Game, dt: number) => {
  const t = g.training
  if (!t) return
  for (const p of g.players) p.hp = p.stats.maxHp
  const k = Math.min(1, TRAINING.spring * dt)
  for (const post of t.posts) {
    let e = g.enemies.find((x) => x.id === post.id)
    if (!e || e.dying >= 0) {
      e = spawnDummy(g, t.target, post)
      post.id = e.id
    }
    e.hp = e.maxHp
    e.x += (post.x - e.x) * k
    e.y += (post.y - e.y) * k
  }
  retain(g.enemies, (e) => e.dying < 0 || t.posts.some((p) => p.id === e.id))
  g.pickups.length = 0
}

/* ---------------- The player's loadout ---------------- */

/** Every move the family can carry: its learnset at every stage (the branch's included) and the evolutions of those moves, each right after its base. */
export const trainingMoves = (starter: PlayableId, branch: BranchId | null): MoveId[] => {
  const out: MoveId[] = []
  for (const id of runLearnset(starter, branch)) {
    out.push(id)
    const evo = evolutionOf(id)
    if (evo && !out.includes(evo.to)) out.push(evo.to)
  }
  return out
}

/** The Dojo's shelves of moves: the family's own, every TM (the shop's too) and the legendaries' capstones. */
export const MOVE_SHELVES = ['family', 'tms', 'legendary'] as const
export type MoveShelf = (typeof MOVE_SHELVES)[number]

/** The moves on a shelf; `legends`: the legends the game shows today (`shownLegends`), so a festival's stays secret until announced. */
export const shelfMoves = (shelf: MoveShelf, starter: PlayableId, branch: BranchId | null, legends: readonly LegendId[]): MoveId[] => {
  if (shelf === 'family') return trainingMoves(starter, branch)
  if (shelf === 'tms') return [...shelfTms()]
  return legends.map((id) => LEGENDARY_MOVE_OF[id])
}

/** The move a new one would take the slot of: its base or its evolution, when owned. */
const twinOf = (g: Game, id: MoveId) => {
  const twin = evolutionOf(id)?.to ?? evolvedFrom(id)?.from
  return twin ? g.player.moves.find((m) => m.id === twin) : undefined
}

/**
 * Why a move the player doesn't carry can't be learned now, as in a run: every
 * slot taken, a second manual move (`learnable`) or a second legendary one (a
 * run teaches one legendary TM; a legend's own move doesn't count). Null when it can.
 */
export const moveBlock = (g: Game, id: MoveId): 'full' | 'manual' | 'legendary' | null => {
  const p = g.player
  if (p.moves.some((m) => m.id === id)) return null
  const slot = twinOf(g, id)
  const others = p.moves.filter((m) => m !== slot).map((m) => m.id)
  if (!slot && others.length >= MAX_MOVES) return 'full'
  if (!learnable(others, id, isManual)) return 'manual'
  const own = legendSignature(p.starter)
  if (isLegendary(id) && id !== own && others.some((m) => isLegendary(m) && m !== own)) return 'legendary'
  return null
}

/** Drops a move and whatever it left in play (hitboxes, timed effects, a guard). */
const dropMove = (g: Game, id: MoveId) => {
  const p = g.player
  retain(p.moves, (m) => m.id !== id)
  retain(g.attacks, (a) => !ownAttack(g, a) || a.move !== id)
  retain(p.moveBuffs, (b) => b.move !== id)
  if (p.guard?.move === id) p.guard = null
}

/**
 * Sets a move to `level` (0 drops it), taking a free slot when it's new.
 * A move and its evolution share a slot: setting one swaps the other out.
 * Returns false when a new move can't be learned (`moveBlock`).
 */
export const setMove = (g: Game, id: MoveId, level: number) => {
  const p = g.player
  const lv = Math.max(0, Math.min(maxMoveLevel(id), dm.round(level)))
  if (lv === 0) {
    dropMove(g, id)
    recomputeStats(g)
    return true
  }
  const owned = p.moves.find((m) => m.id === id)
  if (owned) {
    owned.level = lv
    return true
  }
  if (moveBlock(g, id)) return false
  const slot = twinOf(g, id)
  if (slot) dropMove(g, slot.id)
  p.moves.push({ id, level: lv, cooldown: 0.2, path: 0 })
  return true
}

/** Takes branch `branch` (0 or 1) at the move's fork at `level`. */
export const setFork = (g: Game, id: MoveId, level: number, branch: 0 | 1) => {
  const owned = g.player.moves.find((m) => m.id === id)
  if (!owned || !forkAt(id, level)) return
  owned.path = withBranch(owned.path ?? 0, level, branch)
  // A fork's branch can change the move's stats on the spot (its mods): the next cast picks them up.
  owned.cooldown = Math.min(owned.cooldown, 0.2)
}

/** Sets a held item to `level` (0 drops it). Returns false when every slot is taken. */
export const setItem = (g: Game, id: ItemId, level: number) => {
  const p = g.player
  const lv = Math.max(0, Math.min(ITEMS[id].levels.length, dm.round(level)))
  const owned = p.items.find((i) => i.id === id)
  if (lv === 0) retain(p.items, (i) => i.id !== id)
  else if (owned) owned.level = lv
  else if (p.items.length >= MAX_ITEMS) return false
  else p.items.push({ id, level: lv })
  recomputeStats(g)
  return true
}

/**
 * The forms the Dojo offers a family: each stage of its line, the stages that
 * branch as one form per branch. A legend has one stage and awakens instead
 * (`game/legend.ts`): its forms are its awakenings, 0 to 2.
 */
export type TrainingForm = { stage: number; branch: BranchId | null; awakened: number }

export const trainingForms = (starter: PlayableId): TrainingForm[] =>
  isLegend(starter)
    ? Array.from({ length: AWAKEN_AT.length + 1 }, (_, awakened) => ({ stage: 0, branch: null, awakened }))
    : PLAYABLE[starter].line.flatMap((_, stage): TrainingForm[] => {
        const branches = branchesAt(starter, stage)
        return branches.length > 0 ? branches.map((branch) => ({ stage, branch, awakened: 0 })) : [{ stage, branch: null, awakened: 0 }]
      })

/**
 * Evolves (or devolves) the player into a form at once, a legend into its
 * awakening; an ability the new form can't have goes, and so does a legend's
 * before its first awakening (where a run grants it).
 */
export const setForm = (g: Game, stage: number, branch: BranchId | null, awakened = 0) => {
  const p = g.player
  p.stage = stage
  p.branch = branch && BRANCHES[branch].line === p.starter && BRANCHES[branch].stage <= stage ? branch : null
  if (p.legend) p.legend.awakened = Math.max(0, Math.min(AWAKEN_AT.length, awakened))
  const id = p.ability.id
  if (id && (!abilitySet(p.starter, p.branch).includes(id) || p.legend?.awakened === 0)) p.ability = createAbilityState()
  recomputeStats(g)
}

/** Sets the ability (null: none), one of the form's set. */
export const setAbility = (g: Game, id: AbilityId | null) => {
  const p = g.player
  if (id === null) p.ability = createAbilityState()
  else if (abilitySet(p.starter, p.branch).includes(id)) grantAbility(g, id)
  recomputeStats(g)
}

/** Puts a saved build on the player: its form first (the learnset follows it), then the moves and items it fits. */
export const applyBuild = (g: Game, b: Build) => {
  const p = g.player
  setForm(g, Math.min(b.stage, PLAYABLE[p.starter].line.length - 1), b.branch, b.awakened)
  for (const m of [...p.moves]) dropMove(g, m.id)
  p.items.length = 0
  for (const m of b.moves) {
    if (!setMove(g, m.id, m.level)) continue
    const owned = p.moves.find((x) => x.id === m.id)
    if (owned) owned.path = m.path
  }
  for (const i of b.items) setItem(g, i.id, i.level)
  setAbility(g, b.ability)
}

/** Starts the damage count over (the meter's Zerar). */
export const clearDamage = (g: Game) => {
  g.player.damageByMove = {}
}

/* ---------------- The damage meter (the shell's) ---------------- */

/** Damage dealt so far by source, as `Player.damageByMove` keeps it. */
export type DamageTotals = Partial<Record<DamageSource, number>>

/**
 * The Dojo's damage meter: what `damageByMove` held at each sample, kept for
 * `METER.keep` seconds, so a reading can say the damage per second over the
 * last few seconds (by move, too) and since the count started.
 */
export type DpsMeter = { samples: { at: number; totals: DamageTotals }[]; since: number }

export const METER = {
  /** Seconds between samples. */
  every: 0.25,
  /** Seconds the window of a reading spans. */
  window: 5,
} as const

export const createMeter = (now: number): DpsMeter => ({ samples: [], since: now })

const sum = (t: DamageTotals) => Object.values(t).reduce((a: number, v) => a + (v ?? 0), 0)

/** Takes a sample at `now` if one is due, dropping the ones the window no longer needs. */
export const sampleMeter = (m: DpsMeter, now: number, totals: DamageTotals) => {
  const last = m.samples.at(-1)
  if (last && now - last.at < METER.every) return
  m.samples.push({ at: now, totals: { ...totals } })
  while (m.samples.length > 2 && m.samples[1]!.at <= now - METER.window) m.samples.shift()
}

export type MeterReading = {
  /** Damage per second over the window. */
  dps: number
  /** Damage per second since the count started. */
  average: number
  total: number
  /** Each source's damage per second over the window, biggest first (sources that dealt none left out). */
  bySource: { source: DamageSource; dps: number }[]
}

/** What the meter says now: the window's damage per second (overall and by source), the average and the total. */
export const readMeter = (m: DpsMeter): MeterReading => {
  const first = m.samples[0]
  const last = m.samples.at(-1)
  if (!first || !last) return { dps: 0, average: 0, total: 0, bySource: [] }
  const span = last.at - first.at
  const total = sum(last.totals)
  const elapsed = last.at - m.since
  const bySource = (Object.keys(last.totals) as DamageSource[])
    .map((source) => ({ source, dps: span > 0 ? ((last.totals[source] ?? 0) - (first.totals[source] ?? 0)) / span : 0 }))
    .filter((s) => s.dps > 0)
    .sort((a, b) => b.dps - a.dps)
  return { dps: span > 0 ? (total - sum(first.totals)) / span : 0, average: elapsed > 0 ? total / elapsed : 0, total, bySource }
}

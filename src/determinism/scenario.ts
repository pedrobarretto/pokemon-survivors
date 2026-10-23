import { createRng, rngFrom, type SeededRng } from '../engine/rng'
import * as dm from '../engine/dmath'
import { PLAYABLE_IDS, type PlayableId } from '../data/hatchlings'
import { REGULAR_LEGENDS } from '../data/legends'
import { continueEndless } from '../game/endlessSystem'
import { banishOffer, chooseOffer, rerollOffers, skipLevelUp, step } from '../game/game'
import { UPGRADE_IDS, UPGRADES, type Ranks } from '../game/meta'
import { moveCode, moveOf, startGame, TICK, type ReplayStart } from '../game/replay'
import type { Difficulty } from '../game/difficulty'
import type { Game } from '../game/types'

/**
 * Scripted solo runs for the determinism proofs (`snapshot.test.ts`) and the
 * cross-engine harness (`npm run determinism`). A bot plays like a busy
 * player: it kites the horde, walks into rifts, places and map events (and,
 * inside, to a domain's gate, the cave's stairs and chest, the sky's wings),
 * presses the special, the Mega button and the lunge, picks cards (now and
 * then forgetting, rerolling or skipping one), turns the screen once and goes
 * on into endless mode. A scenario can bring what a save brings: a haunted
 * night, Bag items, armed shop TMs, evolution items and Bottle Caps. A guardian tops the player's HP up when it runs low and keeps a
 * revive in the bag, so runs last long enough to reach the late game; it's
 * the harness's hand, not a rule.
 *
 * Everything the bot computes goes through `dmath` and the stick goes through
 * `moveCode`, like the shell's, so every engine feeds the simulation the same
 * inputs. The bot's rng is its own: the game's draws stay the game's.
 */

export type Scenario = {
  seed: number
  starter: PlayableId
  difficulty: Difficulty
  maxRanks: boolean
} & Partial<Pick<ReplayStart, 'halloween' | 'bag' | 'tms' | 'evo' | 'caps'>>

const FULL_RANKS = Object.fromEntries(UPGRADE_IDS.map((id) => [id, UPGRADES[id].maxRank])) as Ranks
const NO_RANKS_SET = Object.fromEntries(UPGRADE_IDS.map((id) => [id, 0])) as Ranks

export const scenarioStart = (s: Scenario): ReplayStart => ({
  seed: s.seed,
  starter: s.starter,
  difficulty: s.difficulty,
  ranks: s.maxRanks ? FULL_RANKS : NO_RANKS_SET,
  shiny: false,
  luckyEgg: true,
  outbreak: null,
  halloween: s.halloween ?? false,
  bag: s.bag ?? ['lure', 'incense'],
  ...(s.tms ? { tms: s.tms } : {}),
  ...(s.evo ? { evo: s.evo } : {}),
  ...(s.caps ? { caps: s.caps } : {}),
  view: { w: 480, h: 270 },
})

/** A run being played by the bot: the game, its tick count and the bot's own state. */
export type Driver = { g: Game; tick: number; bot: SeededRng; angle: number; over: boolean }

export const startScenario = (s: Scenario): Driver => ({ g: startGame(scenarioStart(s)), tick: 0, bot: createRng(s.seed ^ 0x5eed), angle: 0, over: false })

/** The same bot, at the same point, playing `g` (a restored copy of its game): its own rng state goes along. */
export const forkDriver = (d: Driver, g: Game): Driver => ({ ...d, g, bot: rngFrom({ ...d.bot.state }) })

/** Where the bot heads: a rift portal or a place's door on the map, a domain's gate, the cave's stairs or chest, a wing in the sky, else a map event. */
const goalOf = (g: Game): { x: number; y: number } | null => {
  const p = g.player
  const inside = g.place.inside
  const domain = g.rift.arena?.domain
  if (domain?.act === 'crossing') return { x: p.x, y: p.y - 200 }
  if (inside?.id === 'cave') {
    const { stairs, chest } = inside.state
    if (stairs) return { x: inside.x + stairs[0], y: inside.y + stairs[1] }
    if (chest && !chest.open) return { x: inside.x + chest.x, y: inside.y + chest.y }
  }
  if (inside?.id === 'sky') return inside.state.wings[0] ?? null
  if (inside || g.rift.arena) return null
  const door = g.place.entrance?.open ? g.place.entrance : null
  return g.rift.portal ?? door ?? g.mapEvents.list.find((ev) => ev.gone < 0) ?? null
}

/** The bot's stick: away from the foes close by, towards its goal (`goalOf`), plus a wander. */
const stick = (d: Driver) => {
  const { g } = d
  const p = g.player
  d.angle += (d.bot() - 0.5) * 0.3
  let x = dm.cos(d.angle) * 0.6
  let y = dm.sin(d.angle) * 0.6
  for (const e of g.enemies) {
    if (e.dying >= 0) continue
    const dx = p.x - e.x
    const dy = p.y - e.y
    const d2 = dx * dx + dy * dy
    if (d2 > 90 * 90 || d2 < 1) continue
    const k = (e.boss ? 3 : 1) / d2
    x += dx * k * 40
    y += dy * k * 40
  }
  const goal = goalOf(g)
  if (goal) {
    const len = dm.hypot(goal.x - p.x, goal.y - p.y)
    if (len > 4) {
      x += ((goal.x - p.x) / len) * 1.2
      y += ((goal.y - p.y) / len) * 1.2
    }
  }
  const len = dm.hypot(x, y)
  return moveOf(moveCode(len > 1 ? { x: x / len, y: y / len } : { x, y }))
}

/** Answers whatever the run waits on; false when nothing is waiting. */
const decide = (d: Driver) => {
  const { g } = d
  if (g.phase === 'victory') {
    continueEndless(g)
    return true
  }
  if (g.phase === 'gameover') {
    d.over = true
    return true
  }
  if (g.phase === 'playing' || g.phase === 'evolving' || g.player.offers.length === 0) return false
  const roll = d.bot()
  if (g.phase === 'levelup' && roll < 0.04) banishOffer(g, Math.floor(d.bot() * g.player.offers.length))
  else if (g.phase === 'levelup' && roll < 0.06) rerollOffers(g)
  else if (g.phase === 'levelup' && roll < 0.07) skipLevelUp(g)
  const before = { offers: g.player.offers, phase: g.phase }
  chooseOffer(g, g.player.offers[Math.floor(d.bot() * g.player.offers.length)]!)
  // A pick the phase doesn't take would loop: step on.
  return g.player.offers !== before.offers || g.phase !== before.phase
}

/**
 * Plays one tick (answering any picks first, as the shell does between
 * frames). Returns false once the run is over.
 */
export const tickScenario = (d: Driver) => {
  for (let i = 0; i < 16 && !d.over && decide(d); i++);
  if (d.over) return false
  const { g } = d
  if (g.player.hp < g.player.stats.maxHp * 0.5) g.player.hp = g.player.stats.maxHp
  g.player.revives = Math.max(g.player.revives, 1)
  if (d.tick === 1800) {
    g.view.w = 300
    g.view.h = 520
  }
  if (d.tick === 3600) {
    g.view.w = 480
    g.view.h = 270
  }
  const special = d.tick % 300 === 0
  const mega = d.tick % 400 === 100
  const lunge = d.tick % 100 === 50
  step(g, { move: stick(d), special, mega, lunge }, TICK)
  g.events.length = 0
  d.tick++
  return true
}

/**
 * The Pokémon the scenarios draw from: the starters, the hatched families and
 * the regular legends (Legend mode). The event legends stay out so the draw
 * keeps its picks; each plays in the harness's own runs (`harness.ts`).
 */
const PLAYS: readonly PlayableId[] = [...PLAYABLE_IDS, ...REGULAR_LEGENDS]

/** What a save brings along, by turns: nothing but the usual Lure and Incense, a full Bag, armed shop TMs and Bottle Caps, evolution items, an Everstone. */
const SAVES: ReadonlyArray<Partial<Scenario>> = [
  {},
  { bag: ['lure', 'incense', 'rareCandy', 'luckyEgg', 'luckIncense', 'xAttack', 'maxRevive'] },
  { tms: ['payDay', 'thief', 'rainDance', 'swordsDance'], caps: 3 },
  { evo: ['waterStone', 'thunderStone', 'fireStone', 'dawnStone', 'metalCoat', 'kingsRock', 'upgrade'] },
  { bag: ['everstone', 'honey'] },
]

/** A few scenarios that cover the playables (legends included), the difficulties, the Poké Mart, haunted nights and what a save brings. */
export const scenarios = (count: number, first = 1): Scenario[] =>
  Array.from({ length: count }, (_, i) => {
    const seed = first + i * 7919
    return {
      seed,
      starter: PLAYS[(seed * 31) % PLAYS.length]!,
      difficulty: (['normal', 'hard', 'nightmare'] as const)[i % 3]!,
      maxRanks: i % 2 === 0,
      halloween: i % 4 === 1,
      ...SAVES[(seed >> 1) % SAVES.length],
    }
  })

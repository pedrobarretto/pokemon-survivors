import type { EnemyId } from '../data/enemies'
import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { isLegend } from '../data/legends'
import { createRng } from '../engine/rng'
import * as dm from '../engine/dmath'
import type { Vec } from '../engine/math'
import { MAX_ARMED_TMS, MAX_BAG_SLOTS, MAX_CAPS, type EvoItemId } from '../data/shop'
import { parseBagItems, type BagItem } from './bag'
import { parseEvoItems } from './evoItems'
import { parseTmList, type ShelfTm } from './tmShelf'
import { isDifficulty, type Difficulty } from './difficulty'
import { continueEndless } from './endlessSystem'
import { banishOffer, chooseOffer, createGame, rerollOffers, skipLevelUp, step } from './game'
import { UPGRADE_IDS, UPGRADES, type Ranks } from './meta'
import { LEGEND_HORDE } from './legend'
import { isRecord, wholeNumber } from './parse'
import { isOutbreakSpecies, withOutbreak } from './outbreak'
import { withHaunts } from './halloween'
import { biomeWeight, drawRoster } from './roster'
import type { Game, Player } from './types'

/**
 * Replays: a run as its seed plus everything the simulation took from the
 * player, tick by tick, so the server can play it again and check it ends
 * where the player said. The simulation is deterministic at a fixed step: no
 * `Math.random`, seeded rng, hitboxes from data (`bodyOf`) and math that gives
 * the same bits on every engine (`engine/dmath`). Shared by the game (which
 * records) and the API (which re-simulates). Pure.
 */

/** The fixed simulation step, the same in the shell and here. */
export { TICK } from './tick'
import { TICK } from './tick'

/**
 * Version of the rules a replay plays by. Bump it with any change that makes
 * the same inputs end somewhere else (balance, spawns, boss rules, a new
 * random draw): the server only judges replays of its own rules (`rulesStanding`).
 * Replays from before the field existed are rules 1. `rulesGuard.test.ts`
 * pins where a few scripted replays end under this version and fails when the
 * simulation moves them without a bump; bump it, then pin the digests it prints,
 * and run `npm run rules:freeze` so the API keeps the previous rules' simulator
 * for the runs that straddle the deploy (`server/sims/README.md`).
 */
export const RULES_VERSION = 36

/**
 * How this build stands to a replay's rules: it can judge the `same`; a
 * `newer` one waits for the server to catch up; an `older` one can't be
 * re-simulated faithfully anymore.
 */
export const rulesStanding = (rules: number) => (rules === RULES_VERSION ? 'same' : rules > RULES_VERSION ? 'newer' : 'older')

/** What a run starts from besides the seed: the save's side of `createGame`. */
export type ReplayStart = {
  seed: number
  starter: PlayableId
  difficulty: Difficulty
  ranks: Ranks
  /**
   * The run plays shiny from the start (`RunOptions.shiny`): a family hatched
   * shiny, or a shiny starter picked on the select screen. It only changes the
   * colors: the 1/64 roll is still drawn, so the rng stays in step.
   */
  shiny: boolean
  luckyEgg: boolean
  /** The day's outbreak species (`game/outbreak.ts`); the server checks it against the day the run started. */
  outbreak: EnemyId | null
  /** Noite das Bruxas (`game/halloween.ts`): the run is haunted; the server checks it against the day the run started (`halloweenFits`). */
  halloween: boolean
  /** Bag items used up as the run started (`game/bag.ts`), in catalog order; the API lists them with the run. */
  bag: readonly BagItem[]
  /** TMs armed at the Kecleon Shop (`game/tmShelf.ts`), in the order the run's first discs and lessons teach them (`tms.ts`). None when absent. */
  tms?: readonly ShelfTm[]
  /** Evolution items owned (`game/evoItems.ts`): they unlock their branches (`evolutionOffers`); items found in the run come from the simulation, not from here. None when absent. */
  evo?: readonly EvoItemId[]
  /** The Pokémon's Bottle Cap level, 0..`MAX_CAPS` (`runBoost`). 0 when absent. */
  caps?: number
  /** World px the screen showed at the start: spawns and despawns depend on it. */
  view: { w: number; h: number }
}

/**
 * What the shell did to the run at a tick (before that tick's step): the
 * special attack, the Mega button, a manual lunge (Quick Attack), a level-up pick (index into the offers;
 * a fork's branch is a second pick), a reroll or skip, forgetting a card (Esquecer, index into the offers),
 * going on into endless mode, and a new screen size (rotation, resize).
 */
/** The buttons a run steps with (`StepInput`). */
type Press = 'special' | 'mega' | 'lunge'

export type ReplayEvent =
  | readonly [tick: number, kind: Press | 'reroll' | 'skip' | 'endless']
  | readonly [tick: number, kind: 'offer' | 'banish', index: number]
  | readonly [tick: number, kind: 'view', w: number, h: number]

/**
 * A recorded run, under `rules` (`RULES_VERSION` when recorded). `moves` is the
 * stick per tick, run-length encoded as `[code, count, code, count…]` (see
 * `moveCode`); `events` are in tick order.
 */
export type Replay = { rules: number; start: ReplayStart; moves: number[]; events: ReplayEvent[] }

/* ---------------- Movement ---------------- */

const DIRECTIONS = 32
const LEVELS = 7

/** Movement codes 1..224 as vectors (0 stands still), built with `dmath` so every engine agrees. */
const MOVES: readonly Vec[] = [
  { x: 0, y: 0 },
  ...Array.from({ length: DIRECTIONS * LEVELS }, (_, i) => {
    const level = Math.floor(i / DIRECTIONS) + 1
    const angle = ((i % DIRECTIONS) / DIRECTIONS) * Math.PI * 2
    return { x: dm.cos(angle) * (level / LEVELS), y: dm.sin(angle) * (level / LEVELS) }
  }),
]

/**
 * A stick vector (length ≤ 1) as one of 32 directions × 7 speeds, or 0 to
 * stand still. The shell plays the run with `moveOf(moveCode(v))`, so what it
 * records is exactly what its simulation got.
 */
export const moveCode = (v: Vec) => {
  const level = Math.min(LEVELS, Math.round(dm.hypot(v.x, v.y) * LEVELS))
  if (level === 0) return 0
  const dir = ((Math.round((dm.atan2(v.y, v.x) / (Math.PI * 2)) * DIRECTIONS) % DIRECTIONS) + DIRECTIONS) % DIRECTIONS
  return 1 + (level - 1) * DIRECTIONS + dir
}

export const moveOf = (code: number): Vec => MOVES[code] ?? MOVES[0]!

/* ---------------- Recording ---------------- */

/** A replay being written while the run plays. */
export type Recorder = { replay: Replay; tick: number; view: { w: number; h: number } }

export const startRecording = (start: ReplayStart): Recorder => ({ replay: { rules: RULES_VERSION, start, moves: [], events: [] }, tick: 0, view: { ...start.view } })

/** Notes something the shell did to the run, before the next step. */
export const recordEvent = (rec: Recorder, event: ReplayEvent extends readonly [number, ...infer Rest] ? Rest : never) =>
  rec.replay.events.push([rec.tick, ...event] as ReplayEvent)

/**
 * Notes one step: the screen size if it changed, then the stick. Returns the
 * vector the simulation must get for it.
 */
export const recordStep = (rec: Recorder, view: { w: number; h: number }, move: Vec) => {
  if (view.w !== rec.view.w || view.h !== rec.view.h) {
    rec.view = { ...view }
    recordEvent(rec, ['view', view.w, view.h])
  }
  const code = moveCode(move)
  const { moves } = rec.replay
  if (moves.length > 0 && moves[moves.length - 2] === code) moves[moves.length - 1]!++
  else moves.push(code, 1)
  rec.tick++
  return moveOf(code)
}

/* ---------------- Parsing ---------------- */

const isWhole = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

/**
 * The largest screen a replay may declare, in world px. Spawns, despawns and
 * a boss's reach scale with the view's diagonal, so a made-up giant screen
 * would keep the horde out of reach and still re-simulate faithfully. The
 * largest seen in play is 960 × 439 (`fitView` in `engine/viewport.ts`, under a
 * browser's zoom and visual viewport); the limits leave room above it, and the
 * long side for ultrawide and stretched windows.
 */
export const VIEW_LIMIT = { short: 600, long: 2048 } as const

/** A declared screen of `w` × `h` world px, or null when the game couldn't show it. */
export const parseView = (w: unknown, h: unknown) =>
  isWhole(w) && isWhole(h) && w > 0 && h > 0 && Math.min(w, h) <= VIEW_LIMIT.short && Math.max(w, h) <= VIEW_LIMIT.long ? { w, h } : null

/** One event from an untrusted body, or null when its shape is wrong. */
export const parseEvent = (raw: unknown): ReplayEvent | null => {
  if (!Array.isArray(raw) || !isWhole(raw[0])) return null
  const [tick, kind, a, b] = raw
  if (kind === 'offer' || kind === 'banish') return isWhole(a) && a < 8 ? [tick, kind, a] : null
  if (kind === 'view') {
    const view = parseView(a, b)
    return view ? [tick, kind, view.w, view.h] : null
  }
  return kind === 'special' || kind === 'mega' || kind === 'lunge' || kind === 'reroll' || kind === 'skip' || kind === 'endless' ? [tick, kind] : null
}

/** Whether `moves` is a run-length encoded stick (`[code, count…]`, every count above 0). */
export const isMoves = (moves: unknown[]): moves is number[] =>
  moves.length % 2 === 0 && moves.every((n, i) => isWhole(n) && (i % 2 === 1 ? n > 0 : n < MOVES.length))

/**
 * A replay from an untrusted body, or null when its shape is wrong or its
 * screen is bigger than the game shows (`parseView`), or its Bag (or armed
 * TMs, or evolution items) repeats an item or takes more than any shop level
 * allows, or its Bottle Caps go past the top. Ranks are clamped to the
 * Poké Mart's limits; a replay without `rules` predates them (1).
 */
export const parseReplay = (raw: unknown): Replay | null => {
  if (!isRecord(raw) || !isRecord(raw.start) || !Array.isArray(raw.moves) || !Array.isArray(raw.events)) return null
  const s = raw.start
  const view = isRecord(s.view) ? parseView(s.view.w, s.view.h) : null
  if (typeof s.seed !== 'number' || !Number.isFinite(s.seed) || typeof s.starter !== 'string' || !Object.hasOwn(PLAYABLE, s.starter)) return null
  if (!isDifficulty(s.difficulty) || !view) return null
  if (!isMoves(raw.moves)) return null
  const events = raw.events.map(parseEvent)
  if (events.some((e) => e === null) || events.some((e, i) => i > 0 && e![0] < events[i - 1]![0])) return null
  const ranks = isRecord(s.ranks) ? s.ranks : {}
  // Replays from before the Kecleon Shop said `lure` and `incense` apart.
  const bag = parseBagItems([...(Array.isArray(s.bag) ? s.bag : []), ...(s.lure === true ? ['lure'] : []), ...(s.incense === true ? ['incense'] : [])])
  // One of each, and no more than the shop's top level lets a run take.
  if (Array.isArray(s.bag) && (bag.length !== s.bag.length || bag.length > MAX_BAG_SLOTS)) return null
  // The same for the armed TMs and the evolution items: known ones, each once; caps within their levels.
  const tms = parseTmList(s.tms)
  const evo = parseEvoItems(s.evo)
  if (s.tms !== undefined && (!Array.isArray(s.tms) || tms.length !== s.tms.length || tms.length > MAX_ARMED_TMS)) return null
  if (s.evo !== undefined && (!Array.isArray(s.evo) || evo.length !== s.evo.length)) return null
  if (s.caps !== undefined && (!isWhole(s.caps) || s.caps > MAX_CAPS)) return null
  return {
    rules: isWhole(raw.rules) && raw.rules > 0 ? raw.rules : 1,
    start: {
      seed: s.seed,
      starter: s.starter as PlayableId,
      difficulty: s.difficulty,
      ranks: Object.fromEntries(UPGRADE_IDS.map((id) => [id, wholeNumber(ranks[id], UPGRADES[id].maxRank)])) as Ranks,
      shiny: s.shiny === true,
      luckyEgg: s.luckyEgg === true,
      outbreak: isOutbreakSpecies(s.outbreak) ? s.outbreak : null,
      halloween: s.halloween === true,
      bag,
      tms,
      evo,
      caps: isWhole(s.caps) ? s.caps : 0,
      view,
    },
    moves: raw.moves,
    events: events as ReplayEvent[],
  }
}

/* ---------------- Re-simulation ---------------- */

/**
 * The wild cast a run draws from its seed, with the event's ghosts and night
 * bosses and the day's outbreak (the shell draws it ahead to preload its
 * sprites). A legend's run draws its own horde (`LEGEND_HORDE`) and ghosts,
 * without the outbreak: it's a basic.
 */
export const runRoster = (seed: number, outbreak: EnemyId | null, halloween: boolean, legend = false) =>
  legend
    ? withHaunts(drawRoster(createRng(seed), { weight: biomeWeight, ...LEGEND_HORDE }), halloween, seed, true)
    : withOutbreak(withHaunts(drawRoster(createRng(seed), { weight: biomeWeight }), halloween, seed), outbreak)

/** A fresh run from a replay's start, exactly as the shell creates it: it opens on the opening draft. */
export const startGame = (start: ReplayStart, view: Game['view'] = { ...start.view }) =>
  createGame(start.starter, view, start.seed, start.ranks, runRoster(start.seed, start.outbreak, start.halloween, isLegend(start.starter)), {
    draft: true,
    shiny: start.shiny,
    luckyEgg: start.luckyEgg,
    difficulty: start.difficulty,
    outbreak: start.outbreak,
    halloween: start.halloween,
    bag: start.bag,
    tms: start.tms ?? [],
    evo: start.evo ?? [],
    caps: start.caps ?? 0,
  })

const applyEvent = (g: Game, e: ReplayEvent) => {
  switch (e[1]) {
    // Presses reach the next step as input (`resimulate`).
    case 'special':
    case 'mega':
    case 'lunge':
      return
    case 'offer': {
      const offer = g.player.offers[e[2]]
      if (offer) chooseOffer(g, offer)
      return
    }
    case 'banish':
      return banishOffer(g, e[2])
    case 'reroll':
      return rerollOffers(g)
    case 'skip':
      return skipLevelUp(g)
    case 'endless':
      return continueEndless(g)
    case 'view':
      g.view.w = e[2]
      g.view.h = e[3]
  }
}

/**
 * How a re-simulated run ended. `stuck`: its replay ran out on a level-up,
 * waiting on a pick it doesn't make (a run quit there; the API only logs
 * it, `server/src/checks.ts`). `branch`: the branching evolution it
 * took, which the boards trust over the one the game reported.
 */
export type Resimulated = { time: number; kills: number; level: number; branch: Player['branch']; phase: Game['phase']; stuck: boolean }

/**
 * Plays a replay again from its seed, step by step, applying each event at its
 * tick, and returns where the run ended. A tick recorded while the run wasn't
 * playing (older shells kept stepping out the frame a level-up or the
 * faint landed in) passes without a change, as `step` ignores it. `g` is the
 * run it starts from: the replay's own start, unless a test staged one.
 */
export const resimulate = (replay: Replay, g: Game = startGame(replay.start)): Resimulated => {
  const { moves, events } = replay
  let next = 0
  let tick = 0
  /** Applies the events due at this tick; returns the presses among them. */
  const applyDue = () => {
    let special = false
    let mega = false
    let lunge = false
    while (next < events.length && events[next]![0] === tick) {
      const e = events[next++]!
      special ||= e[1] === 'special'
      mega ||= e[1] === 'mega'
      lunge ||= e[1] === 'lunge'
      applyEvent(g, e)
    }
    return { special, mega, lunge }
  }
  for (let i = 0; i < moves.length; i += 2) {
    const move = moveOf(moves[i]!)
    for (let n = 0; n < moves[i + 1]!; n++) {
      const { special, mega, lunge } = applyDue()
      step(g, { move, special, mega, lunge }, TICK)
      g.events.length = 0
      tick++
    }
  }
  applyDue()
  return { time: g.time, kills: g.kills, level: g.player.level, branch: g.player.branch, phase: g.phase, stuck: g.phase === 'levelup' }
}

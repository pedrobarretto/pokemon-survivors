import { COOP } from '../data/coop'
import { VERSUS } from '../data/versus'
import { driveBots } from './versusBots'
import { stepVersus } from './versus'
import { isPingKind, isQuickChat, pingAt, sayQuick, voteSurrender, type PingKind, type QuickChat } from './versusSocial'
import { MEGAS, type MegaId } from '../data/megas'
import { castVote, countAway, leaveRun, setAway, updateVote, worldHeld } from './coop'
import { continueEndless } from './endlessSystem'
import { banishOffer, chooseOffer, openPendingPicks, rerollOffers, skipLevelUp, stepTeam, updateEvolution, type StepInput } from './game'
import { nothingToChoose } from './leveling'
import { grantStone } from './mega'
import { inPlay, setPhase } from './players'
import { moveOf, TICK } from './replay'
import type { Game, Offer, Player, PlayerPhase } from './types'
import { AIM_DIRS, MAX_REACH, PRIORITIES, SKILLS, type Cast, type Skill } from './versusKit'

/**
 * Co-op lockstep: every client applies the same tick entries (stamped into
 * ticks by the relay, which carries them as opaque JSON) in the same order and
 * steps, so every copy of the run stays identical bit for bit. A stick holds
 * between ticks until it changes (`g.coop.held`, part of the state, so a
 * snapshot carries it); presses last one tick; picks quote the round of the
 * screen they were made on. Pure: no clock, no I/O.
 */

/** A pick screen of a player's: a level-up, where an evolution branches, the Ability, a cursed item, a TM, a Poké Ball's prize. */
export type PickScreen = Exclude<PlayerPhase, 'playing' | 'evolving'>

/** Everything a player can do to a run, by their `slot`. */
export type TickEntry =
  /** The stick changed: `moveCode` (0 stands still, 1..224 are 32 directions × 7 speeds). It holds until the next one. */
  | { slot: number; kind: 'move'; code: number }
  /** The special attack, the Mega button and the manual moves (Quick Attack), pressed this tick. */
  | { slot: number; kind: 'special' | 'mega' | 'lunge' }
  /**
   * A card of the pick screen `screen`, shown as `round` (`Player.round`):
   * a level-up's card or a fork's branch, an evolution's branch, an Ability,
   * taking or leaving a cursed item, a TM's card, a move to forget or "pass",
   * a Poké Ball's prize or "pass".
   */
  | { slot: number; kind: 'pick'; screen: PickScreen; round: number; index: number }
  /** A level-up's Poké Mart reroll or skip, on the screen of `round`. */
  | { slot: number; kind: 'reroll' | 'skip'; round: number }
  /** Esquecer: forgets the level-up's card at `index`, on the screen of `round`. */
  | { slot: number; kind: 'banish'; round: number; index: number }
  /** Takes one of the player's Mega Stones on the ground (a choice of two: Charizard, Raichu, Garchomp, Lucario). */
  | { slot: number; kind: 'stone'; mega: MegaId }
  /** The tab went to the background or the connection dropped (`away`), came back (`back`), or the player left for good. */
  | { slot: number; kind: 'away' | 'back' | 'leave' }
  /** A vote on the victory's endless offer. */
  | { slot: number; kind: 'endless'; vote: boolean }
  /** Arena (`versusSocial.ts`): a quick chat line by id, a ping on the map, a vote on the team's surrender (a yes with none running proposes one). */
  | { slot: number; kind: 'chat'; msg: QuickChat }
  | { slot: number; kind: 'ping'; ping: PingKind; x: number; y: number }
  | { slot: number; kind: 'surrender'; vote: boolean }
  /**
   * The Arena kit (`versusKit.ts`), ignored outside a match: a cast of Move 1,
   * Move 2 or the Unite Move (`skill` 0..2) aimed on the client, a direction
   * code (`dir`, 0..127), a reach in px (0..255) and the enemy it picked
   * (`target`, -1 none); the enemy the player locked (-1 lets go); how the
   * player ranks targets (`prio`, a `PRIORITIES` index).
   */
  | { slot: number; kind: 'cast'; skill: Skill; dir: number; reach: number; target: number }
  | { slot: number; kind: 'lock'; target: number }
  | { slot: number; kind: 'prio'; prio: number }

const MAX_CODE = 224
const SCREENS: ReadonlySet<string> = new Set<PickScreen>(['levelup', 'branch', 'ability', 'curse', 'tm', 'pokeball'])

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isIndex = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max
/** A ping's map coordinate: whole px, well past any Arena map's edges either way (the simulation holds it to the map). */
const isCoord = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && Math.abs(v) <= 4096
/** An enemy id, or -1 for none. */
const isTarget = (v: unknown): v is number => v === -1 || isIndex(v, Number.MAX_SAFE_INTEGER)

/**
 * Reads a tick entry from untrusted JSON for a run of `players` slots (a
 * co-op team, or an Arena match's 8 seats): a fresh, well-formed entry, or
 * null for anything else (a wrong kind, a missing field, a slot the run
 * doesn't have, a code out of range). Never throws.
 */
export const parseTickEntry = (raw: unknown, players: number): TickEntry | null => {
  if (!isRecord(raw) || !isIndex(raw.slot, players - 1) || typeof raw.kind !== 'string') return null
  const { slot, kind } = raw
  switch (kind) {
    case 'move':
      return isIndex(raw.code, MAX_CODE) ? { slot, kind, code: raw.code } : null
    case 'special':
    case 'mega':
    case 'lunge':
    case 'away':
    case 'back':
    case 'leave':
      return { slot, kind }
    case 'pick': {
      const { screen, round, index } = raw
      if (typeof screen !== 'string' || !SCREENS.has(screen) || !isIndex(round, Number.MAX_SAFE_INTEGER) || !isIndex(index, 15)) return null
      return { slot, kind, screen: screen as PickScreen, round, index }
    }
    case 'reroll':
    case 'skip':
      return isIndex(raw.round, Number.MAX_SAFE_INTEGER) ? { slot, kind, round: raw.round } : null
    case 'banish':
      return isIndex(raw.round, Number.MAX_SAFE_INTEGER) && isIndex(raw.index, 15) ? { slot, kind, round: raw.round, index: raw.index } : null
    case 'stone':
      return typeof raw.mega === 'string' && Object.hasOwn(MEGAS, raw.mega) ? { slot, kind, mega: raw.mega as MegaId } : null
    case 'endless':
    case 'surrender':
      return typeof raw.vote === 'boolean' ? { slot, kind, vote: raw.vote } : null
    case 'chat':
      return isQuickChat(raw.msg) ? { slot, kind, msg: raw.msg } : null
    case 'ping':
      return isPingKind(raw.ping) && isCoord(raw.x) && isCoord(raw.y) ? { slot, kind, ping: raw.ping, x: raw.x, y: raw.y } : null
    case 'cast': {
      const { skill, dir, reach, target } = raw
      if (!isIndex(skill, SKILLS.length - 1) || !isIndex(dir, AIM_DIRS - 1) || !isIndex(reach, MAX_REACH) || !isTarget(target)) return null
      return { slot, kind, skill: skill as Skill, dir, reach, target }
    }
    case 'lock':
      return isTarget(raw.target) ? { slot, kind, target: raw.target } : null
    case 'prio':
      return isIndex(raw.prio, PRIORITIES.length - 1) ? { slot, kind, prio: raw.prio } : null
    default:
      return null
  }
}

/** Whether a player's phase is one of their pick screens. */
export const onScreen = (p: Player) => SCREENS.has(p.phase)

/** The card a pick screen takes when the timer runs out or the player is away: leave a cursed item, pass on a TM, else the first card. */
const defaultOffer = (p: Player): Offer | undefined => {
  if (p.phase === 'curse') return p.offers.find((o) => o.kind === 'curse' && !o.take) ?? p.offers[0]
  if (p.phase === 'tm') return p.offers.find((o) => o.kind === 'pass') ?? p.offers[0]
  return p.offers[0]
}

/** Closes a screen that can't be picked from (no cards, or a pick that changes nothing): a guard so the team never waits forever. */
const closeScreen = (g: Game, p: Player) => {
  p.pendingLevelUps = 0
  p.offers = []
  p.prize = null
  setPhase(g, 'playing', p)
}

/**
 * Picks for `p` until they're off their screens (a fork's branches, the next
 * level-up, an Ability after an evolution branch…), with each screen's default
 * card. Deterministic: the same state picks the same cards.
 */
export const autoPick = (g: Game, p: Player) => {
  for (let i = 0; i < COOP.pick.chain && onScreen(p); i++) {
    const offer = defaultOffer(p)
    const { phase, offers, pendingLevelUps } = p
    if (offer) chooseOffer(g, offer, p)
    if (!offer || (p.phase === phase && p.offers === offers && p.pendingLevelUps === pendingLevelUps)) closeScreen(g, p)
  }
  if (onScreen(p)) closeScreen(g, p)
}

/**
 * The team's pick screens, every tick: an away player's are picked at once,
 * and so is a level-up of only the Oran Berry; everyone else's run their
 * timer (`COOP.pick.time`, reset while off a screen) and are picked when it
 * runs out. Level-ups waiting on a player who
 * isn't busy open now, so nobody's screen queues behind a teammate's.
 */
const updatePicks = (g: Game, dt: number) => {
  openPendingPicks(g)
  for (const p of g.players) {
    if (!onScreen(p)) {
      p.pickLeft = p.versus ? VERSUS.pickTime : COOP.pick.time
      continue
    }
    // Away players and Versus bots pick at once, and so does a level-up with nothing to choose (only the Oran Berry).
    if (p.away || p.versus?.bot || (p.phase === 'levelup' && nothingToChoose(p.offers))) {
      autoPick(g, p)
      continue
    }
    p.pickLeft -= dt
    if (p.pickLeft <= 0) autoPick(g, p)
  }
}

/** Each player's screen as it was (its phase and cards), to tell a new one. */
type Seen = { phase: PlayerPhase; offers: readonly Offer[] }

const seen = (p: Player): Seen => ({ phase: p.phase, offers: p.offers })

/** A player's screen changed since `before` (or `changed` says so): a new round, and a pick that chained gets time for the next screen. */
const nextRound = (p: Player, before: Seen, changed = false, manual = false) => {
  if (!changed && p.phase === before.phase && p.offers === before.offers) return
  p.round++
  if (manual && onScreen(p)) p.pickLeft = Math.max(p.pickLeft, COOP.pick.next)
}

/** Takes one of `p`'s Mega Stones lying on the ground (a choice of two), as touching it would. */
const takeStone = (g: Game, p: Player, mega: MegaId) => {
  if (!inPlay(p)) return
  const k = g.pickups.find((s) => s.kind === 'megaStone' && s.mega === mega && s.age >= 0 && (s.owner === undefined || s.owner === p.slot))
  if (!k) return
  const before = g.player
  g.player = p
  grantStone(g, mega)
  g.player = before
  if (p.mega.stone === mega) k.age = -1
}

/** A screen entry quotes the player's current round (and screen): anything else came too late and is dropped. */
const current = (p: Player, round: number, screen?: PickScreen) => p.round === round && onScreen(p) && (screen === undefined || p.phase === screen)

/** Applies one entry, ignoring anything that doesn't fit the run as it is (an old round, a gone player, a card that isn't there). */
const applyEntry = (g: Game, e: TickEntry, inputs: StepInput[]) => {
  const coop = g.coop!
  const p = g.players[e.slot]
  const input = inputs[e.slot]
  if (!p || !input || p.gone || g.phase === 'gameover') return
  switch (e.kind) {
    case 'move':
      if (!p.away) coop.held[p.slot] = e.code
      return
    case 'special':
    case 'mega':
    case 'lunge':
      if (!p.away) input[e.kind] = true
      return
    case 'pick': {
      const offer = p.offers[e.index]
      if (!offer || !current(p, e.round, e.screen)) return
      const before = seen(p)
      chooseOffer(g, offer, p)
      return nextRound(p, before, false, true)
    }
    case 'reroll':
    case 'skip': {
      if (!current(p, e.round, 'levelup')) return
      const before = seen(p)
      if (e.kind === 'reroll') rerollOffers(g, p)
      else skipLevelUp(g, p)
      return nextRound(p, before, false, true)
    }
    case 'banish': {
      if (!current(p, e.round, 'levelup')) return
      const before = seen(p)
      const charges = p.banishes
      banishOffer(g, e.index, p)
      return nextRound(p, before, p.banishes !== charges, true)
    }
    case 'stone':
      return takeStone(g, p, e.mega)
    case 'away':
    case 'back':
      return setAway(g, p, e.kind === 'away')
    case 'leave':
      return leaveRun(g, p)
    case 'endless':
      return castVote(g, p, e.vote)
    case 'chat':
      return sayQuick(g, p, e.msg)
    case 'ping':
      return pingAt(g, p, e.ping, e.x, e.y)
    case 'surrender':
      return voteSurrender(g, p, e.vote)
    case 'cast': {
      if (p.away || !p.versus) return
      // One cast per skill a tick (the latest); the Unite Move's presses the special too.
      const casts = (input.casts ??= [])
      const cast: Cast = { skill: e.skill, dir: e.dir, reach: e.reach, target: e.target }
      const i = casts.findIndex((c) => c.skill === e.skill)
      if (i >= 0) casts[i] = cast
      else casts.push(cast)
      if (e.skill === 2) input.special = true
      return
    }
    case 'lock':
      if (!p.versus) return
      p.versus.lock = e.target
      input.locked = true
      return
    case 'prio':
      if (p.versus) p.versus.prio = e.prio
      return
  }
}

/** A tick's input per slot, nothing pressed yet (the stick comes from `held` once the entries are in). */
const inputsOf = (g: Game): StepInput[] => g.players.map(() => ({ move: moveOf(0), special: false, mega: false, lunge: false }))

/**
 * One co-op tick: applies `entries` in order (malformed or stale ones are
 * ignored), then plays the tick. Evolutions play for everyone, the world held
 * or not; while anyone has a pick screen open the world waits and the screens'
 * timers run; while nobody active stands (everyone left standing is away) the
 * world waits for them, up to `COOP.away.hold`; otherwise the team steps. At the victory the endless
 * vote runs instead. A no-op on a solo game.
 */
export const stepTick = (g: Game, entries: readonly TickEntry[]) => {
  const coop = g.coop
  if (coop === null) return
  const inputs = inputsOf(g)
  for (const raw of entries) {
    const e = parseTickEntry(raw, g.players.length)
    if (e) applyEntry(g, e, inputs)
  }
  // `move` entries land in `held`; the step reads them this tick.
  for (const p of g.players) inputs[p.slot]!.move = moveOf(p.away || p.gone ? 0 : coop.held[p.slot] ?? 0)
  // Versus: the simulation plays its bots (and the seats of humans away).
  if (g.versus) driveBots(g, inputs)
  if (g.phase === 'gameover') return
  countAway(g)
  if (g.phase === 'victory') {
    if (updateVote(g, TICK)) continueEndless(g)
    return
  }
  const before = g.players.map(seen)
  for (const p of g.players) {
    if (p.phase !== 'evolving') continue
    const actor = g.player
    g.player = p
    updateEvolution(g, TICK)
    g.player = actor
  }
  updatePicks(g, TICK)
  if (g.phase !== 'playing') coop.paused += TICK
  else if (!worldHeld(g)) {
    // A Versus match runs its own step (`versus.ts`).
    if (g.versus) stepVersus(g, inputs, TICK)
    else stepTeam(g, inputs, TICK)
    // Screens the step opened for away players are picked at once.
    for (const p of g.players) if (p.away && onScreen(p)) autoPick(g, p)
  }
  g.players.forEach((p, i) => nextRound(p, before[i]!))
}

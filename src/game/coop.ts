import { retain } from '../engine/math'
import { COOP } from '../data/coop'
import type { EnemyId } from '../data/enemies'
import type { HitKind } from '../data/abilities'
import { burst } from './effects'
import { toSteps, type EggTier } from './eggs'
import { runBonus, wonRun } from './meta'
import { inPlay, setPhase } from './players'
import { createTally, summarizeRun, type RunSummary } from './tally'
import type { Game, Player, PlayerRecord } from './types'
import type { DexLog } from './dex'
import type { MoveId } from './moves'
import { TICK } from './tick'
import * as dm from '../engine/dmath'

/**
 * Co-op rules (2 to 4 players in one run) the simulation runs. Solo runs have
 * `g.coop === null` and never take these paths, so they play bit for bit as
 * before. The lockstep driver (`lockstep.ts`) applies each tick's entries,
 * runs the team's pick screens and steps the world.
 *
 * - A player whose HP runs out faints: a Poké Ball on the ground, untargetable,
 *   no moves, no heals. A teammate standing by them for `COOP.revive.time`
 *   gets them back up. The run ends when nobody who can still play stands.
 * - Away (tab hidden, connection lost): frozen and untargetable, picks are made
 *   for them at once, and they stop counting for the horde's scaling. Still
 *   standing, they hold the world for up to `COOP.away.hold` seconds.
 * - Gone (left for good): their Pokémon leaves the field and never comes back.
 * - The horde, bosses and ₽ scale with the active players (`coopScale`); every
 *   Exp. Candy reaches the whole team.
 */

/** The endless offer at the victory: each slot's vote (null: not yet), seconds left, and how it went. */
export type EndlessVote = { left: number; votes: (boolean | null)[]; outcome: 'open' | 'endless' | 'over' }

export type CoopState = {
  /** Each slot's held stick (`moveCode`), kept between ticks until it changes (`stepTick`). */
  held: number[]
  /** Players who started the run: the ₽ split's divisor (`coopPayout`), leavers included. */
  joined: number
  /** The names the team sees, by slot. */
  names: string[]
  /** Seconds the world held still for picks or the shared pause menu (a stat for tuning and the end screen). */
  paused: number
  /** The whole run is held by a player's pause menu. */
  manualPause: boolean
  /** Set at the victory while the team votes on the endless mode. */
  vote: EndlessVote | null
  /** Ticks each slot has been away in a row (0 while here), counted by `stepTick`. */
  awayTicks: number[]
  /** Each slot's own forms seen in the run (dex → shiny; `updateSightings`): what their Pokédex marks caught (`playerDexLog`). */
  own: Map<number, boolean>[]
}

export const createCoopState = (players: number): CoopState => ({
  held: Array.from({ length: players }, () => 0),
  joined: players,
  names: Array.from({ length: players }, () => ''),
  paused: 0,
  manualPause: false,
  vote: null,
  awayTicks: Array.from({ length: players }, () => 0),
  own: Array.from({ length: players }, () => new Map<number, boolean>()),
})

/**
 * The run's Pokédex log as player `slot` banks it: the team's sightings and
 * defeats, but only their own Pokémon's forms as caught (`DexLog.own` holds
 * every player's). Solo, the run's log.
 */
export const playerDexLog = (g: Game, slot: number): DexLog => (g.coop === null ? g.dexLog : { ...g.dexLog, own: g.coop.own[slot] ?? new Map() })

export const createRecord = (): PlayerRecord => ({ kills: 0, taken: 0, revives: 0, faints: 0, tally: createTally() })

/** Players who count for the horde: not away and still in the run (fainted ones count, they'll be back). At least 1. */
export const teamSize = (g: Game) => {
  let n = 0
  for (const p of g.players) if (!p.away && !p.gone) n++
  return Math.max(1, n)
}

/** A co-op multiplier: 1 + `per` for each active player past the first (exactly 1 solo). */
export const coopScale = (g: Game, per: number) => (g.coop === null ? 1 : 1 + per * (teamSize(g) - 1))

/** Whether `p` lies fainted, waiting for a teammate (co-op). */
export const fainted = (p: Player) => p.hp <= 0 && !p.gone

/**
 * The acting player's HP ran out in co-op: they faint where they stand
 * (`updateRevives` gets them up). Their hitboxes go at the next upkeep
 * (`clearIdleAttacks`). The run ends here if nobody is left to play.
 */
export const faint = (g: Game, foe: EnemyId | null, hit: HitKind) => {
  const p = g.player
  p.hp = 0
  p.revive = 0
  p.moving = false
  p.vx = 0
  p.vy = 0
  p.guard = null
  p.record.faints++
  burst(g, p.x, p.y - 10, { colors: ['#f83838', '#ffffff', '#202028'], count: 24, speed: 90, ttl: 0.5 })
  g.events.push({ kind: 'fainted', slot: p.slot })
  checkWipe(g, foe, hit)
}

/** Ticks an away player still standing holds the world before counting as down (`COOP.away.hold`). */
const awayHoldTicks = () => dm.round(COOP.away.hold / TICK)

/** An away player who stands and still holds the world for the team: away for less than `COOP.away.hold`. */
const holdsWorld = (g: Game, p: Player) => p.away && !p.gone && p.hp > 0 && (g.coop?.awayTicks[p.slot] ?? 0) < awayHoldTicks()

/**
 * Ends the run when nobody can play on: every player still in the run has
 * fainted, or stands only while away past `COOP.away.hold` (an away player
 * still standing holds the world for that long instead, `worldHeld`, so a
 * dropped connection doesn't cost the run at once). Returns whether it ended.
 */
export const checkWipe = (g: Game, foe: EnemyId | null = null, hit: HitKind = 'hazard') => {
  if (g.coop === null || g.phase === 'gameover' || g.phase === 'victory') return false
  for (const p of g.players) if (!p.gone && p.hp > 0 && (!p.away || holdsWorld(g, p))) return false
  g.phase = 'gameover'
  g.events.push({ kind: 'gameover', foe, hit })
  return true
}

/** No active player stands, but an away one does and still holds the world: it waits for them to come back. */
export const worldHeld = (g: Game) => {
  if (g.coop === null) return false
  let held = false
  for (const p of g.players) {
    if (!p.gone && !p.away && p.hp > 0) return false
    if (holdsWorld(g, p)) held = true
  }
  return held
}

/**
 * While the world waits on away players (`worldHeld`): the one it waits on
 * longest and the seconds left until they stop holding it, for the shell's
 * "waiting for X" line. Null when the world isn't held by an away player.
 */
export const awayHold = (g: Game): { slot: number; left: number } | null => {
  if (!worldHeld(g) || g.coop === null) return null
  let best: { slot: number; left: number } | null = null
  for (const p of g.players) {
    if (!holdsWorld(g, p)) continue
    const left = (awayHoldTicks() - (g.coop.awayTicks[p.slot] ?? 0)) * TICK
    if (!best || left > best.left) best = { slot: p.slot, left }
  }
  return best
}

/** Counts every player's ticks away in a row (once a tick, from `stepTick`). */
export const countAway = (g: Game) => {
  const ticks = g.coop?.awayTicks
  if (!ticks) return
  for (const p of g.players) ticks[p.slot] = p.away && !p.gone ? (ticks[p.slot] ?? 0) + 1 : 0
}

/** Standing next to a fainted teammate fills their revive; walking off drains it. Up, they get `COOP.revive.hp` and i-frames. */
export const updateRevives = (g: Game, dt: number) => {
  const r = COOP.revive
  for (const p of g.players) {
    if (!fainted(p)) continue
    let helper: Player | null = null
    for (const q of g.players) {
      if (q === p || !inPlay(q)) continue
      if (dm.sq(q.x - p.x) + dm.sq(q.y - p.y) < dm.sq(r.radius + q.radius)) {
        helper = q
        break
      }
    }
    p.revive = helper ? p.revive + dt : Math.max(0, p.revive - dt * r.decay)
    if (!helper || p.revive < r.time) continue
    p.revive = 0
    p.hp = Math.max(1, dm.round(p.stats.maxHp * r.hp))
    p.iframes = r.iframes
    p.hurt = 0
    helper.record.revives++
    burst(g, p.x, p.y - 10, { colors: ['#f8d830', '#fff8c0', '#ffffff', '#58e858'], count: 40, speed: 120, ttl: 0.8, gravity: -40 })
    g.events.push({ kind: 'revived', slot: p.slot, by: helper.slot })
  }
}

/** Whether a player's hitboxes stay on the field: theirs while they stand (or evolve), not while fainted, away or gone. */
const fieldsAttacks = (p: Player | undefined) => p !== undefined && p.hp > 0 && !p.away && !p.gone

/** Takes the hitboxes of fainted, away and gone players off the field (their auras, turrets, mines); casts bring them back. */
export const clearIdleAttacks = (g: Game) => {
  for (const p of g.players) {
    if (fieldsAttacks(p)) continue
    retain(g.attacks, (a) => fieldsAttacks(g.players[a.owner]))
    return
  }
}

/** Co-op upkeep at the end of a world tick: idle players' hitboxes go, fainted ones fill their revive, and the run ends on a wipe. */
export const updateCoop = (g: Game, dt: number) => {
  clearIdleAttacks(g)
  updateRevives(g, dt)
  checkWipe(g)
}

/** A player went away (true) or came back. Back, they get a moment of i-frames to find their feet. */
export const setAway = (g: Game, p: Player, away: boolean) => {
  if (p.gone || p.away === away || g.coop === null) return
  p.away = away
  g.coop.held[p.slot] = 0
  p.moving = false
  if (!away) p.iframes = Math.max(p.iframes, COOP.revive.iframes)
  g.events.push({ kind: 'away', slot: p.slot, away })
}

/**
 * A player left the run for good: their Pokémon leaves the field (no Poké Ball
 * to revive), their open picks close, and they stop counting for the horde.
 * The run ends if nobody is left to play.
 */
export const leaveRun = (g: Game, p: Player) => {
  if (p.gone || g.coop === null) return
  p.gone = true
  p.away = false
  p.hp = 0
  p.pendingLevelUps = 0
  p.offers = []
  p.evolution = null
  p.prize = null
  g.coop.held[p.slot] = 0
  setPhase(g, 'playing', p)
  if (g.coop.vote) g.coop.vote.votes[p.slot] = null
  g.events.push({ kind: 'left', slot: p.slot })
  checkWipe(g)
}

/**
 * Runs `drop` once solo; in co-op once as each player still in the run,
 * marking what each call put on the ground as theirs alone (`Pickup.owner`):
 * a boss's TM and Poké Ball, the Alpha's prize. Nobody grabs a teammate's.
 */
export const dropForEach = (g: Game, drop: () => void) => {
  if (g.coop === null) return drop()
  const before = g.player
  for (const p of g.players) {
    if (p.gone) continue
    const from = g.pickups.length
    g.player = p
    drop()
    for (let i = from; i < g.pickups.length; i++) g.pickups[i]!.owner = p.slot
  }
  g.player = before
}

/** Revives every fainted player still in the run (the victory gets the team back up for the endless mode). */
export const reviveAll = (g: Game) => {
  for (const p of g.players) {
    if (!fainted(p)) continue
    p.hp = Math.max(1, dm.round(p.stats.maxHp * COOP.revive.hp))
    p.revive = 0
    p.iframes = COOP.revive.iframes
  }
}

/** The run is won (Mewtwo down, or its capture scene over). Co-op: the team gets back up and votes on the endless mode. */
export const winRun = (g: Game) => {
  g.phase = 'victory'
  g.events.push({ kind: 'victory' })
  if (g.coop === null) return
  reviveAll(g)
  openVote(g)
}

/* ---------------- The endless vote ---------------- */

/** Who votes on the endless mode: players still in the run who aren't away. */
const voters = (g: Game) => g.players.filter((p) => !p.gone && !p.away)

/** Opens the endless vote at the victory (co-op): every voter's vote is open for `COOP.voteTime`. */
export const openVote = (g: Game) => {
  if (g.coop === null || g.coop.vote) return
  g.coop.vote = { left: COOP.voteTime, votes: g.players.map(() => null), outcome: 'open' }
}

/** A player's vote on the endless offer. Away and gone players don't vote; a vote can change until the vote ends. */
export const castVote = (g: Game, p: Player, endless: boolean) => {
  const vote = g.coop?.vote
  if (!vote || vote.outcome !== 'open' || p.gone || p.away) return
  vote.votes[p.slot] = endless
  g.events.push({ kind: 'vote', slot: p.slot, endless })
}

/**
 * How the vote stands: a strict majority of the voters for the endless mode
 * goes on; half of them or more against ends it (a tie ends); otherwise open.
 * With the timer out, whatever isn't a majority for going on ends.
 */
export const voteOutcome = (g: Game, vote: EndlessVote): EndlessVote['outcome'] => {
  const eligible = voters(g)
  let yes = 0
  let no = 0
  for (const p of eligible) {
    const v = vote.votes[p.slot]
    if (v === true) yes++
    else if (v === false) no++
  }
  const n = eligible.length
  if (yes * 2 > n) return 'endless'
  if (no * 2 >= n || vote.left <= 0) return 'over'
  return 'open'
}

/** Ticks the vote on the victory screen; true when it just ended in the endless mode (the caller starts it). */
export const updateVote = (g: Game, dt: number) => {
  const vote = g.coop?.vote
  if (!vote || vote.outcome !== 'open') return false
  vote.left = Math.max(0, vote.left - dt)
  const outcome = voteOutcome(g, vote)
  if (outcome === 'open') return false
  vote.outcome = outcome
  g.events.push({ kind: 'voted', outcome })
  return outcome === 'endless'
}

/** The co-op run is over for good: the team wiped, or the victory's vote ended it. The shell banks then. */
export const coopOver = (g: Game) => g.phase === 'gameover' || (g.phase === 'victory' && g.coop?.vote?.outcome === 'over')

/* ---------------- Stats and payout ---------------- */

/** One player's line on the end screen. */
export type PlayerStats = {
  slot: number
  starter: Player['starter']
  level: number
  stage: number
  /** Damage dealt, in all and by move (the special and the ability included). */
  damage: number
  damageByMove: Player['damageByMove']
  kills: number
  /** HP lost. */
  taken: number
  /** Teammates this player got back up. */
  revives: number
  faints: number
  moves: { id: MoveId; level: number }[]
  gone: boolean
}

export type TeamStats = { players: PlayerStats[]; total: { damage: number; kills: number; taken: number; revives: number; faints: number }; coins: number; time: number; paused: number }

const sumDamage = (byMove: Player['damageByMove']) => {
  let sum = 0
  for (const v of Object.values(byMove)) sum += v ?? 0
  return dm.round(sum)
}

/** The end screen's numbers: each player's line and the team's totals. Pure. */
export const coopStats = (g: Game): TeamStats => {
  const players = g.players.map((p): PlayerStats => ({
    slot: p.slot,
    starter: p.starter,
    level: p.level,
    stage: p.stage,
    damage: sumDamage(p.damageByMove),
    damageByMove: { ...p.damageByMove },
    kills: p.record.kills,
    taken: dm.round(p.record.taken),
    revives: p.record.revives,
    faints: p.record.faints,
    moves: p.moves.map((m) => ({ id: m.id, level: m.level })),
    gone: p.gone,
  }))
  const total = { damage: 0, kills: 0, taken: 0, revives: 0, faints: 0 }
  for (const s of players) {
    total.damage += s.damage
    total.kills += s.kills
    total.taken += s.taken
    total.revives += s.revives
    total.faints += s.faints
  }
  return { players, total, coins: g.coins, time: g.time, paused: g.coop?.paused ?? 0 }
}

/** What a player banks from a co-op run (`coopPayout`). */
export type CoopPayout = {
  /** Their share of the team's ₽: the total divided by the players who started the run, rounded down. */
  coins: number
  /** The end bonus (`runBonus`) on their own kills and greed; the shell adds it when the run pays it. */
  bonus: number
  /** Steps they walked (the incubator walks its eggs with them). */
  steps: number
  /** Every egg the team found, each with the steps this player walked since it was found: every player gets each egg. */
  eggs: { tier: EggTier; steps: number }[]
  /** Their missions' and achievements' view of the run: their Pokémon, their kills, their share. */
  summary: RunSummary
}

/**
 * What the player at `slot` banks from a co-op run (Pedro's rule: the team's
 * ₽ divided by the players who were in it, rounded down). Leavers count in the
 * divisor: a player who leaves banks their share of the total so far on their
 * own client, and nobody's share grows when a teammate goes. Pure; safe to call
 * again later (a victory, then the endless mode's end): the shell banks deltas.
 */
export const coopPayout = (g: Game, slot: number): CoopPayout => {
  const p = g.players[slot] ?? g.players[0]!
  const n = Math.max(1, g.coop?.joined ?? g.players.length)
  const coins = Math.floor(g.coins / n)
  const steps = toSteps(p.walked)
  const eggs = g.eggs.found.map((e) => ({ tier: e.tier, steps: steps - toSteps(e.walked?.[p.slot] ?? e.at) }))
  const before = g.player
  g.player = p
  const team = summarizeRun(g)
  g.player = before
  const t = p.record.tally
  const summary: RunSummary = {
    ...team,
    kills: p.record.kills,
    coins,
    shinyKills: t.shinyKills,
    outbreakKills: t.outbreakKills,
    bossKills: t.bossKills,
    shinyLegends: t.shinyBossKills,
    traitKills: t.traitKills,
    alphaKills: t.alphaKills,
    killsByType: { ...t.killsByType },
    killsByWeather: { ...t.killsByWeather },
    killsByBiome: { ...t.killsByBiome },
    // Locked out of co-op (`COOP_LOCKS`): nothing of theirs to bank. Legendary
    // wins don't count toward captures either (that's solo's progression).
    places: [],
    placeClears: 0,
    landmarks: 0,
    legendWins: {},
    nightBosses: [],
    tms: [...t.tms],
  }
  const bonus = runBonus({ time: g.time, kills: p.record.kills, victory: wonRun(g), greed: p.stats.greed, reaperDefeats: g.endless?.reaperDefeats })
  return { coins, bonus, steps, eggs, summary }
}

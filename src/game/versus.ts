import { retain } from '../engine/math'
import { createRng } from '../engine/rng'
import { ARENA_FEET } from '../data/arenas'
import { ARENA_RANKED } from '../data/arenaRanked'
import { AURA_RANGE, ROLES, VERSUS, VERSUS_FORMATS, VERSUS_PICKS, type Team, type VersusPick } from '../data/versus'
import { floorOf, MAPS, type MapId, type VersusMap } from '../data/versusMaps'
import type { ArenaFormat } from '../data/arenaFormats'
import { updateAttacks } from './attacks'
import { updateBosses, updateHazards } from './bosses'
import { healPlayer } from './combat'
import { clearIdleAttacks } from './coop'
import { updateConsumables } from './consumables'
import { burst, floatText, updateEffects } from './effects'
import { rebuildGrid, spawnEnemy, updateEnemies } from './enemies'
import { createRun, EVOLUTION_TIME, openPendingPicks, stepMoves, stepPlayer, type PlayerSetup, type StepInput } from './game'
import { NO_RANKS } from './meta'
import { actAs, followPlayers, inPlay } from './players'
import { recomputeStats } from './leveling'
import { keepOnFloor, type Room } from './room'
import { updateStatuses } from './statusSystem'
import { footOf, updateTerrain } from './terrain'
import { updateVerbEvolved } from './verbEvolutions'
import { addAvatar, knockOut, roleOf, syncAvatars } from './versusCombat'
import { reveal, updateGrass, usedSpecial } from './versusGrass'
import { channelTime, goalOpen, mapOf, matchMap, rivalTeam, rulesOf, scoreValue, winnerOf } from './versusRules'
import type { Enemy, Game, Player } from './types'
import type { Aim } from './versusBots'
import { fullBucket, updateSocial, type Bucket, type Emote, type Ping, type SurrenderVote, type Talk } from './versusSocial'
import { aimCast, type Focus } from './versusKit'
import { specialReady } from './special'
import * as dm from '../engine/dmath'

/**
 * Versus: a Unite-style match in one of its formats (`VERSUS_FORMATS`: two
 * teams of its size on its map, `data/versusMaps.ts`, on its clock), run by the co-op lockstep like any co-op run (humans
 * by seat; the rest are bots the simulation drives, `versusBots.ts`). The map
 * is a room (`room.ts`), so the world's spawns, weather and map events stay
 * out; `stepVersus` runs only what a match needs. PvP goes through each
 * Pokémon's avatar (`versusCombat.ts`); tall grass hides (`versusGrass.ts`).
 */

/** The lane a seat plays by default (bots follow it, `versusBots.ts`). */
export type Lane = 'north' | 'south' | 'jungle'

/** A player's side of a match (`Player.versus`). */
export type VersusSeat = {
  team: Team
  /** Played by the simulation (a seat no human took, or a human who left). */
  bot: boolean
  lane: Lane
  /** Energy carried, up to `VERSUS.energy.cap`. */
  energy: number
  /** Seconds left until a knocked out Pokémon comes back on its spawn pad (0 while it plays). */
  respawn: number
  /** Seconds of protection on the way back in: rivals' hits do nothing. */
  safe: number
  /** Seconds channeled into the rival goal it stands in (`goal`, -1 none). */
  channel: number
  goal: number
  /** `g.now` of the last rival hit (a channel waits `VERSUS.score.hurtLock` after one), and who landed it. */
  hurtAt: number
  lastBy: number
  /** Drednaw's shield: damage soaked before HP. */
  shield: number
  /** Id of its avatar on the field, -1 while it's out. */
  avatar: number
  /** Pace its avatar's statuses leave it (1 free, 0 frozen), and its whole pace this tick (role, statuses, its own goal). */
  slow: number
  pace: number
  /** A bot's aim (`versusBots.ts`) and the ticks until it thinks again. */
  aim: Aim | null
  think: number
  /** Tall grass (`versusGrass.ts`): the patch it stands in (-1 none), whether the rival team can't see it there, and seconds left of a reveal (a hit, its special). */
  grass: number
  hidden: boolean
  reveal: number
  /**
   * The kit (`versusKit.ts`): the enemy the player locked (-1 none; the basic
   * attack and the assist aim there while it's in reach), how they rank the
   * rest (`PRIORITIES` index), a cast's focus while its move fires (null
   * between ticks), and seconds the Pokémon stays turned to its last cast.
   */
  lock: number
  prio: number
  focus: Focus | null
  hold: number
  /** The kit's pace (`versusPacing.ts`): the slot the level-up on screen teaches (0 a regular one), and the slot an evolution's upgrade waits for (0 none). */
  learn: number
  upgrade: number
  /** Match stats: knockouts dealt, times knocked out, points scored. */
  kos: number
  deaths: number
  scored: number
  /** A human's current stretch without acting (seconds: stick idle and no special, or away) and its longest, the report's AFK (`trackIdle`). */
  still: number
  afk: number
  /**
   * The scoreboard's other stats: assists (a rival it hit within
   * `VERSUS.assist` seconds of their knockout, the knocker aside), damage
   * dealt to and taken from rival Pokémon, HP its moves, Ability and aura
   * healed (the goals' and the pads' don't count), and rival channels its hits
   * interrupted.
   */
  assists: number
  dealt: number
  taken: number
  healed: number
  interrupts: number
  /** `g.now` of each rival's last hit on it, by slot (-99: none since it last came in), for the assists. */
  hitAt: number[]
  /** Its quick chat's, pings' and emotes' rate limits (`versusSocial.ts`). */
  talkBucket: Bucket
  pingBucket: Bucket
  emoteBucket: Bucket
}

/** A goal zone in play: its team, where it is, the points it still takes before it breaks. */
export type GoalState = { team: Team; x: number; y: number; r: number; left: number; max: number; base: boolean; broken: boolean }

/** A camp's wild Pokémon on the field (enemy ids) and when it comes back once cleared. */
export type CampState = { alive: number[]; respawnAt: number }

/** Energy on the ground. */
export type Orb = { id: number; x: number; y: number; vx: number; vy: number; value: number; age: number }

/** The objective in the center: Drednaw mid-match, Zapdos in the last stretch. */
export type Objective = { kind: 'drednaw' | 'zapdos'; id: number }

export type VersusState = {
  /** The match's format and the map it plays (`rulesOf`, `mapOf`). */
  format: ArenaFormat
  map: MapId
  room: Room
  score: [number, number]
  goals: GoalState[]
  camps: CampState[]
  orbs: Orb[]
  stretch: boolean
  /** Seconds left of each team's Zapdos blessing: its scores land at once. */
  blessing: [number, number]
  objective: Objective | null
  /** When Drednaw comes (back) to the center (match seconds). */
  drednawAt: number
  /** Quick chat lines and pings of the last few seconds (`versusSocial.ts`): shown by the shell, read by no rule. */
  talk: Talk[]
  pings: Ping[]
  /** Emotes of the last few seconds (`versusSocial.ts`): which one plays is the seat's look, the shell's (`render/arenaFx.ts`). */
  emotes: Emote[]
  /** Each team's surrender vote while one runs, and the match second its next one may start (after a failed one). */
  surrender: [SurrenderVote | null, SurrenderVote | null]
  surrenderAt: [number, number]
  /** Set when the clock runs out, or a team surrenders (`surrender`: that team, which loses). */
  result: { winner: Team | null; surrender: Team | null } | null
}

/** A human's seat: their Pokémon, the name the room sees and the team they asked for (Blue when left out). */
export type VersusLoadout = { starter: VersusPick; name: string; team?: Team }

/** Each team's lanes, by its seats in order. */
const LANES: readonly Lane[] = ['north', 'south', 'jungle', 'south', 'north']

/**
 * The seats of a match of `size` a side: the humans on the teams they asked
 * for (a full team sends the rest to the other; past both teams they're left
 * out), then bots filling each team with Pokémon nobody on that team plays.
 * Humans keep the first slots, in order (their seats' slots on the relay).
 * Pure: `seed` draws the bots.
 */
export const seatMatch = (seed: number, humans: readonly VersusLoadout[], size: number = VERSUS_FORMATS.standard.teamSize) => {
  const counts = [0, 0]
  const seats = humans.slice(0, size * 2).map((h) => {
    const want: Team = h.team ?? 0
    const team: Team = counts[want]! < size ? want : rivalTeam(want)
    counts[team]!++
    return { starter: h.starter, name: h.name, team, bot: false }
  })
  const rng = createRng(seed ^ 0x5eed)
  for (const team of [0, 1] as const) {
    while (counts[team]! < size) {
      const taken = new Set(seats.filter((s) => s.team === team).map((s) => s.starter))
      const free = VERSUS_PICKS.filter((id) => !taken.has(id))
      const starter = free[Math.floor(rng() * free.length)] ?? VERSUS_PICKS[0]!
      seats.push({ starter, name: '', team, bot: true })
      counts[team]!++
    }
  }
  return seats
}

/** A fresh seat for a match of `players` Pokémon. */
const createSeat = (team: Team, bot: boolean, lane: Lane, players: number): VersusSeat => ({
  team, bot, lane, energy: 0, respawn: 0, safe: 0, channel: 0, goal: -1, hurtAt: -99, lastBy: -1, shield: 0, avatar: -1, slow: 1, pace: 1, aim: null, think: 0, grass: -1, hidden: false, reveal: 0, lock: -1, prio: 0, focus: null, hold: 0, learn: 0, upgrade: 0, kos: 0, deaths: 0, scored: 0, still: 0, afk: 0,
  assists: 0, dealt: 0, taken: 0, healed: 0, interrupts: 0, hitAt: new Array<number>(players).fill(-99), talkBucket: fullBucket(VERSUS.talk), pingBucket: fullBucket(VERSUS.ping),
  emoteBucket: fullBucket(VERSUS.emote),
})

const createRoom = (map: VersusMap): Room => ({
  x: 0,
  y: 0,
  layout: floorOf(map),
  terrain: {
    lake: null,
    solids: map.solids.map((s, i) => {
      const foot = ARENA_FEET[s.piece]
      return { kind: s.piece, x: s.x, y: s.y, variant: i, foot: [{ ...foot, x: s.x + foot.x, y: s.y + foot.y }] }
    }),
  },
})

/** Where the `i`th Pokémon of `team` stands on its spawn pad in match `s`. */
const padSpot = (s: VersusState, team: Team, i: number) => {
  const pad = mapOf(s).spawn[team]
  return { x: pad.x, y: pad.y + (i - (rulesOf(s).teamSize - 1) / 2) * 22 }
}

/**
 * A fresh match of `format` for `humans` (by slot, up to both teams) and the
 * bots that fill the teams (`seatMatch`), on `map` if it's one of the
 * format's, else on one drawn from the seed (`matchMap`). Every client that calls it with the same seed and
 * loadouts gets the same game. Nobody brings anything from their save: no
 * Poké Mart ranks, Bag, TMs or items, and no shiny luck that would change a
 * fight. Each Pokémon opens with the draft (its second move).
 */
export const createVersusGame = (seed: number, humans: readonly VersusLoadout[], format: ArenaFormat = 'standard', asked: MapId | null = null): Game => {
  const rules = VERSUS_FORMATS[format]
  const id = matchMap(format, seed, asked)
  const map = MAPS[id]
  const seats = seatMatch(seed, humans, rules.teamSize)
  const setups: PlayerSetup[] = seats.map((s) => ({ starter: s.starter, ranks: NO_RANKS, shiny: false }))
  const g = createRun({ ...VERSUS.view }, seed, setups, undefined, { draft: true }, true)
  g.coop!.names = seats.map((s) => s.name)
  const s: VersusState = {
    format,
    map: id,
    room: createRoom(map),
    score: [0, 0],
    goals: map.goals.map((d) => ({ team: d.team, x: d.x, y: d.y, r: d.r, left: d.points, max: d.points, base: d.base, broken: false })),
    camps: map.camps.map((c) => ({ alive: [], respawnAt: c.first })),
    orbs: [],
    stretch: false,
    blessing: [0, 0],
    objective: null,
    drednawAt: rules.drednaw.first,
    talk: [],
    pings: [],
    emotes: [],
    surrender: [null, null],
    surrenderAt: [0, 0],
    result: null,
  }
  g.versus = s
  g.events.length = 0
  const placed = [0, 0]
  const before = g.player
  for (const p of g.players) {
    const seat = seats[p.slot]!
    const i = placed[seat.team]!++
    p.versus = createSeat(seat.team, seat.bot, LANES[i % LANES.length]!, g.players.length)
    p.shiny = false
    p.luckyShiny = false
    const spot = padSpot(s, seat.team, i)
    p.x = spot.x
    p.y = spot.y
    p.facing = { x: seat.team === 0 ? 1 : -1, y: 0 }
    g.player = p
    recomputeStats(g)
    p.hp = p.stats.maxHp
    addAvatar(g, p)
  }
  g.player = before
  // The draft's screens hold no one in Versus: the world plays.
  g.phase = 'playing'
  followPlayers(g)
  return g
}

/* ---------------- The step ---------------- */

/** An evolution in Versus plays only its last `VERSUS.evolveTime` seconds. */
const hurryEvolutions = (g: Game) => {
  for (const p of g.players) {
    const evo = p.evolution
    if (evo && evo.t < EVOLUTION_TIME - VERSUS.evolveTime) evo.t = EVOLUTION_TIME - VERSUS.evolveTime
  }
}

/**
 * One tick of a match, in place of `stepTeam`'s: the players walk, the camps
 * and the objective act, the grass hides who stands in it, everyone's moves
 * fire (held in the grass) and land, and the match's rules run (`updateVersus`). The world's spawns, biomes, weather, map events,
 * places, rifts and pickups never run here.
 */
export const stepVersus = (g: Game, inputs: readonly StepInput[], dt: number) => {
  const s = g.versus
  if (!s || g.phase !== 'playing') return
  hurryEvolutions(g)
  g.now += dt
  g.time += dt
  trackIdle(g, inputs, dt)
  const actor = g.player
  for (const p of g.players) {
    if (!inPlay(p)) continue
    g.player = p
    const input = inputs[p.slot] ?? STILL
    const v = p.versus
    if (v) v.hold = Math.max(0, v.hold - dt)
    // The Unite Move goes where its cast aimed: the Pokémon turns that way first, since the special releases along `facing`.
    const unite = v && input.special ? input.casts?.find((c) => c.skill === 2) : undefined
    if (v && unite && (specialReady(p.special) || p.special.window > 0)) v.focus = aimCast(g, p, unite)
    const cooldown = p.special.cooldown
    stepPlayer(g, input, dt)
    if (v) v.focus = null
    // A special shows its user, grass or not.
    if (v && usedSpecial(p.special, cooldown)) reveal(v)
  }
  g.player = actor
  syncAvatars(g)
  updateCamps(g)
  rebuildGrid(g)
  updateEnemies(g, dt)
  updateBosses(g, dt)
  updateHazards(g, dt)
  updateStatuses(g, dt)
  keepEveryoneOn(g, s.room)
  rebuildGrid(g)
  updateGrass(g, dt)
  for (const p of g.players) {
    if (!inPlay(p)) continue
    g.player = p
    stepMoves(g, inputs[p.slot] ?? STILL, dt)
  }
  g.player = actor
  updateAttacks(g, dt)
  updateVerbEvolved(g, dt)
  updateTerrain(g, dt)
  updateEffects(g, dt)
  // The screen flash fades here (no consumables in a match, but the same upkeep).
  updateConsumables(g, dt)
  clearIdleAttacks(g)
  updateVersus(g, dt)
  syncAvatars(g)
  followPlayers(g, dt)
  openPendingPicks(g)
}

const STILL: StepInput = { move: { x: 0, y: 0 }, special: false }

/**
 * Each human's stretch without acting, for Fair Play's AFK: it grows while
 * they don't play, and slower while they're away (a bot plays the seat then;
 * `fairPlay.awayWeight`), and
 * goes back to 0 when they act (`acts`). Knocked out or channeling into a
 * goal (standing still to score), it holds. Never read by the match's rules:
 * only the report's `afk` (its longest) says it.
 */
const trackIdle = (g: Game, inputs: readonly StepInput[], dt: number) => {
  for (const p of g.players) {
    const v = p.versus
    if (!v || v.bot || !inPlay(p) || v.channel > 0) continue
    const i = inputs[p.slot]
    const acting = !p.away && i !== undefined && acts(i)
    v.still = acting ? 0 : v.still + (p.away ? dt * ARENA_RANKED.fairPlay.awayWeight : dt)
    if (v.still > v.afk) v.afk = v.still
  }
}

/**
 * Whether a tick's input is playing, for `trackIdle`: the stick, the special
 * (the Unite Move), Mega, a lunge, a cast of Move 1 or Move 2, a target
 * locked or let go. Quick chat, pings, a surrender vote, the target priority
 * and level-up picks aren't: a player parked at the base can do all of them.
 */
export const acts = (i: StepInput) =>
  i.move.x !== 0 || i.move.y !== 0 || i.special || i.mega === true || i.lunge === true || (i.casts?.length ?? 0) > 0 || i.locked === true

/** Keeps the players and the wild on the map's floor. */
const keepEveryoneOn = (g: Game, room: Room) => {
  const floor = room.layout.floor
  for (const p of g.players) if (p.hp > 0) keepOnFloor(p, room, floor, [], footOf(p))
  for (const e of g.enemies) if (e.dying < 0 && e.behavior.kind !== 'avatar') keepOnFloor(e, room, floor, [], e.radius * 0.8)
}

/* ---------------- Camps and objectives ---------------- */

/** A wild Pokémon of the camp at index `camp` (-1: the objective) at (x, y), with its camp's HP and bite. */
const spawnWild = (g: Game, kind: Enemy['kind'], camp: number, x: number, y: number, hp: number, damage: number, leash: number) => {
  const e = spawnEnemy(g, kind, x, y, { kind: 'camp', camp, x, y, leash, target: -1 })
  e.hp = e.maxHp = hp
  e.damage = damage
  e.xp = 0
  return e
}

/** How far (px) a camp's wild Pokémon follow whoever hit them before walking home. */
const CAMP_LEASH = 150

/** Camps fill up when they're due, and start their clock once the last of them falls. */
const updateCamps = (g: Game) => {
  const s = g.versus!
  const map = mapOf(s)
  map.camps.forEach((def, i) => {
    const camp = s.camps[i]!
    if (camp.alive.length > 0) {
      camp.alive = camp.alive.filter((id) => g.enemies.some((e) => e.id === id && e.dying < 0))
      if (camp.alive.length === 0) camp.respawnAt = g.time + def.respawn
      return
    }
    if (g.time < camp.respawnAt) return
    for (let k = 0; k < def.count; k++) {
      const a = (k / def.count) * Math.PI * 2
      const r = def.count > 1 ? 14 : 0
      const e = spawnWild(g, def.species, i, def.x + dm.cos(a) * r, def.y + dm.sin(a) * r, def.hp, def.damage, CAMP_LEASH)
      camp.alive.push(e.id)
    }
    camp.respawnAt = Infinity
  })
  if (!s.stretch && s.objective === null && g.time >= s.drednawAt) {
    const e = spawnWild(g, 'drednaw', -1, map.center.x, map.center.y, rulesOf(s).drednaw.hp, 14, 120)
    s.objective = { kind: 'drednaw', id: e.id }
    g.events.push({ kind: 'versusObjective', enemy: 'drednaw', team: -1 })
  }
}

/** The last stretch: points count double, Drednaw leaves and Zapdos lands in the center. */
const startStretch = (g: Game) => {
  const s = g.versus!
  s.stretch = true
  if (s.objective) {
    const old = g.enemies.find((e) => e.id === s.objective!.id)
    if (old) old.dying = 0
  }
  const center = mapOf(s).center
  const e = spawnWild(g, 'zapdos', -1, center.x, center.y, rulesOf(s).zapdos.hp, 0, 160)
  e.damage = 30 * VERSUS.zapdos.damage
  s.objective = { kind: 'zapdos', id: e.id }
  g.bossId = e.id
  g.flash = 0.6
  g.events.push({ kind: 'versusStretch' })
  g.events.push({ kind: 'versusObjective', enemy: 'zapdos', team: -1 })
}

/* ---------------- The match's rules ---------------- */

const inside = (p: Player, x: number, y: number, r: number) => dm.sq(p.x - x) + dm.sq(p.y - y) < r * r

/** The goal of `team` that `p` stands in, or -1. */
const goalUnder = (s: VersusState, p: Player, team: Team) => s.goals.findIndex((o) => o.team === team && !o.broken && inside(p, o.x, o.y, o.r))

/** Players back from a knockout, protection wearing off. */
const updateRespawns = (g: Game, dt: number) => {
  const s = g.versus!
  for (const p of g.players) {
    const v = p.versus
    if (!v) continue
    v.safe = Math.max(0, v.safe - dt)
    if (p.hp > 0 || p.gone) continue
    v.respawn -= dt
    if (v.respawn > 0) continue
    v.respawn = 0
    const spot = padSpot(s, v.team, p.slot % rulesOf(s).teamSize)
    p.x = spot.x
    p.y = spot.y
    p.hp = p.stats.maxHp
    p.iframes = VERSUS.respawn.iframes
    v.safe = VERSUS.respawn.iframes
    p.hurt = 0
    addAvatar(g, p)
    burst(g, p.x, p.y - 10, { colors: ['#ffffff', '#f8f0a0', '#78c8f8'], count: 24, speed: 80, ttl: 0.6, gravity: -40 })
    g.events.push({ kind: 'versusBack', slot: p.slot })
  }
}

/** Orbs drift to a stop, are pulled into whoever comes near with room for them, and fade after `VERSUS.energy.ttl`. */
const updateOrbs = (g: Game, dt: number) => {
  const s = g.versus!
  const rest = dm.exp(-5 * dt)
  for (const o of s.orbs) {
    o.age += dt
    o.vx *= rest
    o.vy *= rest
    o.x += o.vx * dt
    o.y += o.vy * dt
    for (const p of g.players) {
      const v = p.versus
      if (!v || !inPlay(p) || v.energy >= VERSUS.energy.cap) continue
      if (!inside(p, o.x, o.y, VERSUS.energy.magnet + p.radius)) continue
      v.energy = Math.min(VERSUS.energy.cap, v.energy + o.value)
      o.age = Infinity
      g.events.push({ kind: 'pickup' })
      break
    }
  }
  retain(s.orbs, (o) => o.age < VERSUS.energy.ttl)
}

/**
 * Scoring: a Pokémon carrying Energy in an open rival goal channels (faster
 * with teammates in it, held while a rival's hit is fresh) and scores it all
 * when the channel fills, at once under a Zapdos blessing. A goal out of
 * points breaks. In its own team's goal a Pokémon heals and runs faster.
 */
const updateGoals = (g: Game, dt: number) => {
  const s = g.versus!
  for (const p of g.players) {
    const v = p.versus
    if (!v || !inPlay(p)) continue
    const own = goalUnder(s, p, v.team)
    if (own >= 0) {
      const before = actAs(g, p)
      healPlayer(g, p.stats.maxHp * VERSUS.ownGoal.heal * dt, null)
      actAs(g, before)
    }
    const at = v.energy > 0 ? goalUnder(s, p, rivalTeam(v.team)) : -1
    const goal = at >= 0 ? s.goals[at]! : null
    if (!goal || !goalOpen(s, goal)) {
      v.channel = 0
      v.goal = -1
      continue
    }
    if (v.goal !== at) v.channel = 0
    v.goal = at
    if (g.now - v.hurtAt < VERSUS.score.hurtLock) {
      v.channel = 0
      continue
    }
    let allies = 0
    for (const q of g.players) if (q !== p && q.versus?.team === v.team && inPlay(q) && inside(q, goal.x, goal.y, goal.r)) allies++
    v.channel += dt
    if (s.blessing[v.team] <= 0 && v.channel < channelTime(v.energy, allies)) continue
    score(g, p, goal, at)
  }
}

/** `p` scores everything they carry into `goal`. */
const score = (g: Game, p: Player, goal: GoalState, at: number) => {
  const s = g.versus!
  const v = p.versus!
  const points = scoreValue(v.energy, s.stretch)
  s.score[v.team] += points
  v.scored += points
  v.energy = 0
  v.channel = 0
  v.goal = -1
  goal.left -= points
  floatText(g, p.x, p.y - 30, `+${points}`, v.team === 0 ? '#78b8f8' : '#f87878')
  burst(g, goal.x, goal.y, { colors: ['#ffffff', '#f8e070', v.team === 0 ? '#78b8f8' : '#f87878'], count: 30, speed: 110, ttl: 0.6, gravity: -30 })
  g.events.push({ kind: 'versusScore', slot: p.slot, team: v.team, points })
  if (goal.left > 0) return
  goal.left = 0
  goal.broken = true
  g.flash = Math.max(g.flash, 0.3)
  g.events.push({ kind: 'versusGoal', team: goal.team, goal: at })
}

/** Each team's spawn pad heals its own and burns a rival who walks in (a knockout there is nobody's). */
const updatePads = (g: Game, dt: number) => {
  const spawn = mapOf(g.versus!).spawn
  const before = g.player
  for (const p of g.players) {
    const v = p.versus
    if (!v || !inPlay(p)) continue
    spawn.forEach((pad, team) => {
      if (!inside(p, pad.x, pad.y, VERSUS.spawnPad.r)) return
      g.player = p
      if (team === v.team) healPlayer(g, p.stats.maxHp * VERSUS.spawnPad.heal * dt, null)
      else {
        p.hp -= p.stats.maxHp * VERSUS.spawnPad.burn * dt
        // A knockout on a rival's pad is nobody's.
        if (p.hp <= 0) knockOut(g, p, -1)
      }
    })
  }
  g.player = before
}

/** Supporters' healing auras on their teammates nearby (the Supporter's healing, on the scoreboard). */
const updateAuras = (g: Game, dt: number) => {
  const before = g.player
  for (const p of g.players) {
    const aura = ROLES[roleOf(p)].aura
    if (aura <= 0 || !inPlay(p)) continue
    for (const q of g.players) {
      if (q === p || q.versus?.team !== p.versus?.team || !inPlay(q) || !inside(q, p.x, p.y, AURA_RANGE)) continue
      g.player = q
      healPlayer(g, q.stats.maxHp * aura * dt, p)
    }
  }
  g.player = before
}

/** Each Pokémon's pace this tick: its role's, what its avatar's statuses leave it, and its own goal's boost. */
const updatePaces = (g: Game) => {
  const s = g.versus!
  for (const p of g.players) {
    const v = p.versus
    if (!v) continue
    v.pace = ROLES[roleOf(p)].pace * v.slow * (goalUnder(s, p, v.team) >= 0 ? VERSUS.ownGoal.pace : 1)
  }
}

/** The clock ran out (the team with more points wins, a draw on a tie), or `surrender` gave up (the other team wins, whatever the score). */
const endMatch = (g: Game, surrender: Team | null = null) => {
  const s = g.versus!
  const winner = surrender === null ? winnerOf(s.score) : rivalTeam(surrender)
  s.result = { winner, surrender }
  g.phase = 'gameover'
  g.events.push({ kind: 'versusEnd', winner, surrender })
}

/** The match's rules after the step: the clock, respawns, Energy, goals, spawn pads, auras and paces; then quick chat, pings and the surrender vote. */
const updateVersus = (g: Game, dt: number) => {
  const s = g.versus!
  const surrendered = updateSocial(g)
  if (surrendered !== null) return endMatch(g, surrendered)
  const rules = rulesOf(s)
  if (!s.stretch && g.time >= rules.length - rules.stretch) startStretch(g)
  updateRespawns(g, dt)
  updateOrbs(g, dt)
  updateGoals(g, dt)
  updatePads(g, dt)
  updateAuras(g, dt)
  updatePaces(g)
  s.blessing[0] = Math.max(0, s.blessing[0] - dt)
  s.blessing[1] = Math.max(0, s.blessing[1] - dt)
  if (g.time >= rules.length) endMatch(g)
}

/** Seconds left on the match clock (0 outside a match). */
export const timeLeft = (g: Game) => (g.versus ? Math.max(0, rulesOf(g.versus).length - g.time) : 0)

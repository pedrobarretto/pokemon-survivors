import { ROLES, VERSUS, VERSUS_FORMATS, type FormatRules, type Role, type Team } from '../data/versus'
import { MAPS, type MapId } from '../data/versusMaps'
import type { ArenaFormat } from '../data/arenaFormats'
import type { PlayerStats } from './stats'
import type { Enemy, Game } from './types'
import type { GoalState, VersusState } from './versus'
import * as dm from '../engine/dmath'
import { createRng, pick } from '../engine/rng'

/**
 * Versus's pure rules (`versus.ts` runs them): the channel to score, the time
 * down after a knockout, a rival's hit, the stats a Pokémon plays with, and
 * who won. No game state: numbers in, numbers out.
 */

/** Seconds standing in a rival goal to score `energy` with `allies` teammates in it too. */
export const channelTime = (energy: number, allies: number) =>
  (VERSUS.score.base + VERSUS.score.perPoint * energy) / (1 + VERSUS.score.allyBoost * allies)

/** Points a score is worth: double in the last stretch. */
export const scoreValue = (energy: number, stretch: boolean) => (stretch ? energy * 2 : energy)

/** What match `s` plays like: its format's rules. */
export const rulesOf = (s: { format: ArenaFormat }) => VERSUS_FORMATS[s.format]

/** The map match `s` plays on. */
export const mapOf = (s: { map: MapId }) => MAPS[s.map]

/** Whether `id` is one of the maps a match of `format` plays on. */
export const formatPlays = (format: ArenaFormat, id: unknown): id is MapId => VERSUS_FORMATS[format].maps.some((m) => m === id)

/**
 * The map a match of `format` plays: `asked` when it's one of the format's
 * (a room's pick), else one drawn from the match's seed, so every client
 * (and the queue's matches, which ask for none) lands on the same one.
 */
export const matchMap = (format: ArenaFormat, seed: number, asked?: MapId | null): MapId => {
  if (formatPlays(format, asked)) return asked
  return pick(createRng(seed ^ 0x6d6170), VERSUS_FORMATS[format].maps)
}

/** Seconds down after a knockout at `level` under `rules`. */
export const respawnTime = (rules: FormatRules, level: number, stretch: boolean) =>
  rules.respawn.base + rules.respawn.perLevel * level + (stretch ? rules.respawn.stretch : 0)

/**
 * A rival's hit of `raw` (the move's damage after type effectiveness) on a
 * Pokémon: cut to PvP scale, tilted by both roles and the target's own damage
 * taken, before armor. At least 1.
 */
export const pvpDamage = (raw: number, by: Role, target: Role, damageTaken: number) =>
  Math.max(1, raw * VERSUS.pvp.damage * ROLES[by].dealt * ROLES[target].taken * damageTaken)

/** Energy left on the ground by a knocked out Pokémon carrying `energy`. */
export const droppedEnergy = (energy: number) => Math.floor(energy * VERSUS.energy.dropShare)

/** The stats a Pokémon plays Versus with: its run stats with more HP (`VERSUS.pvp.hp`). */
export const versusStats = (stats: PlayerStats): PlayerStats => ({ ...stats, maxHp: dm.round(stats.maxHp * VERSUS.pvp.hp) })

/** The winner of a final score, null on a draw. */
export const winnerOf = (score: readonly [number, number]): Team | null => (score[0] > score[1] ? 0 : score[1] > score[0] ? 1 : null)

/** The other team. */
export const rivalTeam = (team: Team): Team => (team === 0 ? 1 : 0)

/** EXP a teammate gets from a faint worth `xp`, standing `d2` px² from it: full within `VERSUS.xpShare.radius`, the remote share past it. */
export const xpShareOf = (xp: number, d2: number) => (d2 <= VERSUS.xpShare.radius * VERSUS.xpShare.radius ? xp : xp * VERSUS.xpShare.remote)

/**
 * Whether `e` is on the acting player's side in Versus: an avatar of their
 * own team (their own body included). Their moves pass through it and never
 * aim at it. Always false outside Versus (no avatars there).
 */
export const isAlly = (g: Game, e: Enemy) => e.behavior.kind === 'avatar' && e.behavior.team === g.player.versus?.team

/**
 * Whether the acting player's moves can't aim at `e` in Versus: a teammate's
 * avatar (`isAlly`), or a rival's hidden in tall grass (`VersusSeat.hidden`).
 * A hitbox that reaches a hidden rival still lands (`collide` skips only
 * allies). Always false outside Versus.
 */
export const unseen = (g: Game, e: Enemy) => {
  const b = e.behavior
  return b.kind === 'avatar' && (b.team === g.player.versus?.team || g.players[b.slot]?.versus?.hidden === true)
}

/** Whether `goal` takes scores now: not broken, and a base goal only once a lane goal of its team is gone. */
export const goalOpen = (s: VersusState, goal: GoalState) =>
  !goal.broken && (!goal.base || s.goals.some((o) => o.team === goal.team && !o.base && o.broken))

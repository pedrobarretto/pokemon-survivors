import type { Game, Player } from './types'
import * as dm from '../engine/dmath'

/**
 * Who's in play, for the systems that run for the whole world (the horde,
 * pickups, map events, spawns). Solo runs have one player and every helper
 * here gives exactly what the old single-player code did; co-op runs pick the
 * nearest or any teammate. Pure queries plus `actAs`.
 */

/** Standing in the run: can move, attack, pick things up and be targeted (not fainted, not gone). */
export const inPlay = (p: Player) => !p.gone && p.down === null

/** Still in the run, fainted or not: their screen counts (spawns stay off it). */
export const present = (p: Player) => !p.gone

/** Players in play right now. */
export const playersInPlay = (g: Game) => g.players.filter(inPlay)

/** How many players are still in the run (co-op scaling counts them). */
export const teamSize = (g: Game) => {
  let n = 0
  for (const p of g.players) if (present(p)) n++
  return n
}

/**
 * The player in play nearest to (x, y): who enemies chase and bosses aim at.
 * When nobody is standing it falls back to the first present player, so
 * callers always get someone (the run is about to end anyway).
 */
export const nearestPlayer = (g: Game, x: number, y: number): Player => {
  let best: Player | null = null
  let bestD = Infinity
  for (const p of g.players) {
    if (!inPlay(p)) continue
    const d = dm.sq(p.x - x) + dm.sq(p.y - y)
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best ?? g.players.find(present) ?? g.players[0]!
}

/** The first player in play whose feet are within `r` (plus their body radius when `body` is set) of (x, y). */
export const playerWithin = (g: Game, x: number, y: number, r: number, body = false): Player | null => {
  for (const p of g.players) {
    if (!inPlay(p)) continue
    const reach = body ? r + p.radius : r
    if (dm.sq(p.x - x) + dm.sq(p.y - y) < reach * reach) return p
  }
  return null
}

/** Where a player's screen sits once they stand at their current spot: the view centered on them, a little above their feet. */
export const screenAt = (g: Game, p: Player) => ({ x: p.x - g.view.w / 2, y: p.y - 10 - g.view.h / 2 })

/** Moves every player's screen to where they stand. Runs at the end of each step, so the next step's checks see where the screens were drawn. */
export const followPlayers = (g: Game) => {
  for (const p of g.players) {
    p.screen.x = p.x - g.view.w / 2
    p.screen.y = p.y - 10 - g.view.h / 2
  }
}

/**
 * Whether (x, y) shows on any present player's screen, grown by `margin` px
 * (shrunk when negative) on every side, `bottom` px at the bottom.
 */
export const onAnyScreen = (g: Game, x: number, y: number, margin = 0, bottom = margin) => {
  for (const p of g.players) {
    if (!present(p)) continue
    const { x: left, y: top } = p.screen
    if (x > left - margin && x < left + g.view.w + margin && y > top - margin && y < top + g.view.h + bottom) return true
  }
  return false
}

/** The screens of everyone still in the run. */
export const screens = (g: Game) => g.players.filter(present).map((p) => p.screen)

/**
 * The player a world event takes turns with (spawn rings, map events): the
 * `turn`-th of the players in play, wrapping. Solo, always the player.
 */
export const anchorPlayer = (g: Game, turn: number): Player => {
  const standing = playersInPlay(g)
  return standing[((turn % standing.length) + standing.length) % standing.length] ?? nearestPlayer(g, 0, 0)
}

/**
 * Runs `fn` as player `p`: per-player code (moves, the special, a pickup's
 * effect, damage taken) reads `g.player`. Events pushed meanwhile get `p`'s
 * slot, so the shell can tell its own news from a teammate's.
 */
export const actAs = <T>(g: Game, p: Player, fn: () => T): T => {
  const before = g.player
  const from = g.events.length
  g.player = p
  const out = fn()
  for (let i = from; i < g.events.length; i++) g.events[i]!.slot ??= p.slot
  g.player = before
  return out
}

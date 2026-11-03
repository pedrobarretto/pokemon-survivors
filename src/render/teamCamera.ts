import { COOP } from '../data/coop'
import { fainted } from '../game/coop'
import type { Game, Player } from '../game/types'

/**
 * The co-op camera, shell state only (never part of the simulation, so it
 * never reaches a snapshot or a hash): it follows this client's player and,
 * while they lie fainted (or have left), a teammate still standing, which a
 * tap or a key cycles (`cycleWatched`). Back on their feet, it returns to
 * them. Switching who it follows eases over instead of cutting. A wave
 * legendary's entrance or capture (`g.legendScene`) holds the world and pans
 * every player's own screen: the camera frames this player's, as
 * `updateDrawView` does.
 */
export type TeamCamera = {
  /** Top-left of the drawn view, in world px. */
  x: number
  y: number
  /** The slot being watched while spectating (null: the client's own player). */
  follow: number | null
  /** The slot the view was on last frame (a switch eases from there); -1 before the first frame, which snaps. */
  on: number
  /** How far the view still is from its target after a switch (world px), shrinking to nothing while the target is followed exactly. */
  off: { x: number; y: number }
}

export const createTeamCamera = (): TeamCamera => ({ x: 0, y: 0, follow: null, on: -1, off: { x: 0, y: 0 } })

/** Whether a teammate can be watched: still in the run, on their feet. Away ones count only if nobody else does. */
const watchable = (p: Player) => !p.gone && !fainted(p)

/** Players worth spectating, in slot order from `me` on: standing first, then away ones. Null if nobody stands. */
const nextWatchable = (g: Game, me: Player, from: number, step: 1 | -1): Player | null => {
  const n = g.players.length
  let fallback: Player | null = null
  for (let i = 1; i <= n; i++) {
    const p = g.players[(((from + step * i) % n) + n) % n]!
    if (p === me || !watchable(p)) continue
    if (!p.away) return p
    fallback ??= p
  }
  return fallback
}

/**
 * Whether the client is spectating: their player is fainted or gone, and a
 * teammate stands to watch. Never in Versus: a knocked out player's camera
 * stays where they fell until they're back on their pad.
 */
export const spectating = (g: Game, me: Player) => g.coop !== null && !g.versus && (me.gone || fainted(me)) && nextWatchable(g, me, me.slot, 1) !== null

/**
 * Who the camera follows: the client's own player while they stand; while
 * spectating, the teammate picked (kept while they stand, else the next one).
 */
export const watched = (cam: TeamCamera, g: Game, me: Player): Player => {
  if (!spectating(g, me)) return me
  const current = cam.follow === null ? undefined : g.players[cam.follow]
  if (current && current !== me && watchable(current) && !current.away) return current
  return nextWatchable(g, me, cam.follow ?? me.slot, 1) ?? me
}

/** Watches the next (or previous) teammate standing. A no-op unless spectating. */
export const cycleWatched = (cam: TeamCamera, g: Game, me: Player, step: 1 | -1 = 1) => {
  if (!spectating(g, me)) return
  const from = watched(cam, g, me)
  const next = nextWatchable(g, me, from.slot, step)
  if (!next || next === from) return
  cam.follow = next.slot
}

/** Share of a switch's distance still to go after a second: most of it goes at first, then it settles. */
const EASE_LEFT = 0.0005

/** Under this (world px) a switch has settled. */
const SETTLED = 0.5

/**
 * Moves the camera onto the player it follows for a `w`×`h` view (centered a
 * little above their feet, as `followPlayers` frames a solo run). A switch
 * eases from where the view was: the distance left shrinks every frame (ease
 * out) until it's under half a pixel, the target followed exactly meanwhile,
 * so it never lags a walking player nor cuts at the end. Call once per drawn
 * frame with the frame's `dt`.
 */
export const updateTeamCamera = (cam: TeamCamera, g: Game, me: Player, w: number, h: number, dt: number) => {
  const scene = g.legendScene !== null
  const target = scene ? me : watched(cam, g, me)
  if (!scene) cam.follow = target === me ? null : target.slot
  // The scene's screen is the simulated view's top-left (`COOP.view`): frame its middle.
  const tx = (scene ? me.screen.x + COOP.view.w / 2 : target.x) - w / 2
  const ty = (scene ? me.screen.y + COOP.view.h / 2 : target.y - 10) - h / 2
  if (cam.on >= 0 && cam.on !== target.slot) {
    cam.off.x = cam.x - tx
    cam.off.y = cam.y - ty
  }
  cam.on = target.slot
  const k = Math.pow(EASE_LEFT, dt)
  cam.off.x *= k
  cam.off.y *= k
  if (Math.hypot(cam.off.x, cam.off.y) < SETTLED) cam.off.x = cam.off.y = 0
  cam.x = tx + cam.off.x
  cam.y = ty + cam.off.y
  return cam
}

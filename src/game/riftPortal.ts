import { TAU } from '../engine/math'
import { range } from '../engine/rng'
import { RIFT, type RiftLegend } from '../data/rifts'
import { burst } from './effects'
import { chargePortal, nextRiftAt, pickLegend, riftDue } from './rift'
import { enterArena } from './riftArena'
import { clearSpot } from './terrain'
import { anchorPlayer, playerWithin } from './players'
import type { Game } from './types'
import * as dm from '../engine/dmath'

/**
 * The map side of a rift: a portal opens past the screen edge, waits a while
 * and sends the player to the arena once they stand in it for `RIFT.enterTime`.
 * Everything arena-related goes through `enterArena`, so any other map
 * system can open the same door.
 */

const PORTAL_COLORS = ['#7850c8', '#c8a8f8', '#ffffff'] as const

/** Opens a portal for `legend` at (x, y), or just past the screen edge in a random direction. */
export const openPortal = (g: Game, legend: RiftLegend = pickLegend(g.rng, g.rift.met), at?: { x: number; y: number }) => {
  const p = anchorPlayer(g, g.rift.met.length)
  const a = range(g.rng, 0, TAU)
  const d = dm.hypot(g.view.w, g.view.h) / 2 + 60
  const { x, y } = at ?? clearSpot(g, { x: p.x + dm.cos(a) * d, y: p.y + dm.sin(a) * d }, RIFT.portalRadius + 4)
  g.rift.portal = { x, y, left: RIFT.portalTime, charge: 0, legend }
  g.rift.met.push(legend)
  g.rift.nextAt = nextRiftAt(g.rift.nextAt, g.time, g.rng)
  g.events.push({ kind: 'riftOpen' })
}

/** Opens portals on schedule, ticks the open one and steps the player in. */
export const updateRiftPortal = (g: Game, dt: number) => {
  const rift = g.rift
  const portal = rift.portal
  if (!portal) {
    const due = riftDue({ time: g.time, nextAt: rift.nextAt, busy: rift.arena !== null, bossAlive: g.bossId !== null, endless: g.endless !== null })
    if (due) openPortal(g)
    return
  }
  portal.left -= dt
  if (portal.left <= 0) {
    rift.portal = null
    burst(g, portal.x, portal.y - 8, { colors: PORTAL_COLORS, count: 24, speed: 60, ttl: 0.5 })
    g.events.push({ kind: 'riftClosed' })
    return
  }
  // Anyone standing in it charges it; the whole team goes through together.
  const inside = playerWithin(g, portal.x, portal.y, RIFT.portalRadius) !== null
  portal.charge = chargePortal(portal.charge, inside, dt)
  // Motes drift up out of the portal; denser while it charges.
  if (g.rng() < (inside ? 0.6 : 0.2)) {
    burst(g, portal.x + range(g.rng, -10, 10), portal.y, { colors: PORTAL_COLORS, count: 1, speed: 12, ttl: 0.8, gravity: -50, drag: 0 })
  }
  if (portal.charge < RIFT.enterTime) return
  rift.portal = null
  enterArena(g, portal.legend, portal.x, portal.y)
}

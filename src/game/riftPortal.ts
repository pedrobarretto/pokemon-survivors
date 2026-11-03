import { TAU } from '../engine/math'
import { range } from '../engine/rng'
import { EVENT_RIFT, isEventRift, RIFT, type RiftLegend } from '../data/rifts'
import { enterDomain } from './domain'
import { burst } from './effects'
import { chargePortal, endlessRiftAt, pickLegend, portalReach, riftAt, riftDomain, riftDue } from './rift'
import { enterArena } from './riftArena'
import { clearSpot } from './terrain'
import { teamLegend } from './legend'
import { anchorPlayer, playerWithin } from './players'
import type { Game } from './types'
import { setWeather } from './weather'
import * as dm from '../engine/dmath'

/**
 * The map side of a rift: when one is due its omen plays (a legendary with a
 * domain takes the sky with its weather), then a portal opens past the screen
 * edge, waits a while and sends the team in once a player stands in it for
 * `RIFT.enterTime`: into the legendary's domain (`enterDomain`) or its old
 * arena (`enterArena`; always in co-op, `riftDomain`). Any other map system can open the same door.
 */

const PORTAL_COLORS = ['#7850c8', '#c8a8f8', '#ffffff'] as const

/** Opens `legend`'s portal at (x, y), or just past a player's screen edge (`anchorPlayer`) in a random direction. */
export const openPortal = (g: Game, legend: RiftLegend, at?: { x: number; y: number }) => {
  const p = anchorPlayer(g)
  const a = range(g.rng, 0, TAU)
  const d = dm.hypot(g.view.w, g.view.h) / 2 + 60
  const { x, y } = at ?? clearSpot(g, { x: p.x + dm.cos(a) * d, y: p.y + dm.sin(a) * d }, portalReach(g, legend) + 4)
  g.rift.portal = { x, y, left: RIFT.portalTime, charge: 0, legend }
  g.events.push({ kind: 'riftOpen' })
}

/**
 * The legendary behind the next rift: one not met yet this run, never the
 * team's own legend (`teamLegend`). In a haunted run (Noite das Bruxas) Darkrai's
 * nightmare takes its place with `EVENT_RIFT.odds`; that roll is the only
 * draw a haunted run adds, so every other run draws as before.
 */
export const drawRiftLegend = (g: Game): RiftLegend => {
  const self = teamLegend(g)?.id
  const drawn = pickLegend(g.rng, g.rift.met, self)
  // Playing Darkrai itself (Legend mode), its nightmare never comes.
  return g.halloween && !(self !== undefined && isEventRift(self)) && g.rng() < EVENT_RIFT.odds ? 'darkrai' : drawn
}

/**
 * The next rift begins: its legendary is drawn (`drawRiftLegend`), its
 * weather takes the sky and holds until the rift is over (`setWeather`, with
 * no next change due), and the one after it is scheduled.
 */
export const startOmen = (g: Game, legend: RiftLegend = drawRiftLegend(g)) => {
  const rift = g.rift
  rift.omen = { legend, left: RIFT.omenTime }
  rift.met.push(legend)
  rift.slot++
  rift.nextAt = g.endless ? endlessRiftAt(g.time, g.rng) : riftAt(rift.slot, g.rng)
  const domain = riftDomain(g, legend)
  if (domain) {
    if (g.weather.id !== domain.omen.weather) setWeather(g, domain.omen.weather)
    g.weather.next = Infinity
  }
  g.events.push({ kind: 'riftOmen', enemy: legend })
}

/** The rift is over without the team going in: a held omen weather moves on soon. */
const releaseSky = (g: Game) => {
  if (g.weather.next === Infinity) g.weather.next = g.time + 4
}

/** Starts omens on schedule, opens their portals, ticks the open one and, once a player stands in it long enough, sends the team in. */
export const updateRiftPortal = (g: Game, dt: number) => {
  // An open portal waits on the map, like the rest of the world, while the team is inside a place.
  if (g.place.inside) return
  const rift = g.rift
  const omen = rift.omen
  if (omen) {
    omen.left -= dt
    if (omen.left > 0) return
    rift.omen = null
    openPortal(g, omen.legend)
    return
  }
  const portal = rift.portal
  if (!portal) {
    // The endless mode picks up its own cadence once the run's slots are used.
    if (g.endless && rift.nextAt === Infinity) rift.nextAt = g.time + RIFT.endlessFirst
    const due = riftDue({ time: g.time, nextAt: rift.nextAt, busy: rift.arena !== null, bossAlive: g.bossId !== null, endless: g.endless !== null })
    if (due) startOmen(g)
    return
  }
  portal.left -= dt
  if (portal.left <= 0) {
    rift.portal = null
    burst(g, portal.x, portal.y - 8, { colors: PORTAL_COLORS, count: 24, speed: 60, ttl: 0.5 })
    releaseSky(g)
    g.events.push({ kind: 'riftClosed' })
    return
  }
  const inside = playerWithin(g, portal.x, portal.y, portalReach(g, portal.legend)) !== null
  portal.charge = chargePortal(portal.charge, inside, dt)
  // Motes drift up out of the portal; denser while it charges.
  if (g.rng() < (inside ? 0.6 : 0.2)) {
    burst(g, portal.x + range(g.rng, -10, 10), portal.y, { colors: PORTAL_COLORS, count: 1, speed: 12, ttl: 0.8, gravity: -50, drag: 0 })
  }
  if (portal.charge < RIFT.enterTime) return
  rift.portal = null
  if (riftDomain(g, portal.legend)) enterDomain(g, portal.legend, portal.x, portal.y)
  else enterArena(g, portal.legend, portal.x, portal.y)
}

import { weightedPick, type Rng } from '../engine/rng'
import { RIFT } from '../data/rifts'
import { ULTRA_BEASTS, WORMHOLE, type UltraBeast } from '../data/ultraBeasts'
import { RUN_LENGTH } from '../data/waves'
import { riftDomain } from './rift'
import { teamLegend } from './legend'
import type { Game } from './types'
import { setWeather } from './weather'

/**
 * The Ultra Wormhole (`data/ultraBeasts.ts`): once a run, at `WORMHOLE.at`,
 * an omen of its own cracks the sky and a wormhole opens on the map. It is a
 * rift in every other way: the same portal, room and capture
 * (`riftPortal.ts`, `domain.ts`), the beast behind it a `RiftLegend`; in
 * co-op its beast is fought in the old arena, like every rift's (`riftDomain`,
 * `COOP_LOCKS`). Its own schedule (`RiftState.wormholeAt`) never moves the
 * rifts' (their slots, their rng draws), and nothing schedules a second one.
 */

/**
 * The beast behind the wormhole: each one alike, the beast of the week
 * (`ultraWeek`) `WORMHOLE.weekly` times as likely, never the one the team
 * plays (Legend mode).
 */
export const drawUltraBeast = (rng: Rng, week: UltraBeast | null, self: string | null = null): UltraBeast =>
  weightedPick(
    rng,
    ULTRA_BEASTS.filter((b) => b !== self).map((b) => [b, b === week ? WORMHOLE.weekly : 1] as const),
  )

/**
 * Whether the wormhole's omen starts now: once its time came, with no rift
 * under way (`busy`); a living boss holds it up to `RIFT.bossWait`, and in a
 * regular run it never starts so late that it would still be open at the
 * finale.
 */
export const wormholeDue = (s: { time: number; at: number; busy: boolean; bossAlive: boolean; endless: boolean }) =>
  s.time >= s.at &&
  !s.busy &&
  (!s.bossAlive || s.time >= s.at + RIFT.bossWait) &&
  (s.endless || s.time + RIFT.omenTime + RIFT.portalTime < RUN_LENGTH)

/**
 * The wormhole begins: its beast is drawn, its omen plays (the clear sky
 * holds while Ultra Space's light cracks it, `render/legendSky.ts`) and no
 * other wormhole comes this run.
 */
export const startWormhole = (g: Game, beast: UltraBeast = drawUltraBeast(g.rng, g.ultraWeek, teamLegend(g)?.id ?? null)) => {
  const rift = g.rift
  rift.omen = { legend: beast, left: RIFT.omenTime }
  rift.met.push(beast)
  rift.wormholeAt = Infinity
  const domain = riftDomain(g, beast)
  if (domain) {
    if (g.weather.id !== domain.omen.weather) setWeather(g, domain.omen.weather)
    g.weather.next = Infinity
  }
  g.events.push({ kind: 'riftOmen', enemy: beast })
}

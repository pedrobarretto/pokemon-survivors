import { pick, range, type Rng } from '../engine/rng'
import { RIFT, RIFT_DRAWS, RIFT_ITEMS, type RiftLegend } from '../data/rifts'
import { RUN_LENGTH } from '../data/waves'
import type { EnemyId } from '../data/enemies'
import { domainOf, DOMAIN_PRESS } from '../data/domains'
import { coopLocked } from '../data/coop'
import { PLACES } from '../data/places'
import type { FloorPlan } from '../data/arenas'
import type { DomainState } from './domain'
import type { Room, Stash } from './room'
import type { Game, Player } from './types'
import * as dm from '../engine/dmath'

/**
 * Pure rules and state of the legendary rifts. The map side (a portal opens,
 * the player steps in) lives in `riftPortal.ts`; the fight in `riftArena.ts`.
 */

/** A portal waiting on the map. `charge` counts the seconds the player has stood in it. */
export type RiftPortal = { x: number; y: number; left: number; charge: number; legend: RiftLegend }

/** A rift's arena: a room (centered where the portal was) whose plan is `ARENA_LAYOUTS[legend]`. */
export type RiftArena = Room & {
  legend: RiftLegend
  shiny: boolean
  layout: FloorPlan
  /** Seconds until the rift collapses. */
  left: number
  age: number
  bossId: number
  /** Seconds left to grab the loot once the legendary falls; null while it stands. */
  loot: number | null
  /** Seconds left on the defeat (the player fainted, the rift throws them out); null while they stand. */
  fall: number | null
  stash: Stash
  /** A legendary with a domain (`data/domains.ts`) plays its four acts here (`game/domain.ts`); null in the old arena. */
  domain: DomainState | null
}

/** The omen before a portal (`RIFT.omenTime`): the legendary's weather takes the sky, then its portal opens. */
export type RiftOmen = { legend: RiftLegend; left: number }

export type RiftState = {
  /** Run time the next omen is due, and which of `RIFT.slots` it is. */
  nextAt: number
  slot: number
  omen: RiftOmen | null
  portal: RiftPortal | null
  arena: RiftArena | null
  /** Legendaries met (portal opened) and beaten this run, in order. */
  met: RiftLegend[]
  cleared: RiftLegend[]
}

export const createRiftState = (): RiftState => ({ nextAt: RIFT.slots[0] - RIFT.omenTime, slot: 0, omen: null, portal: null, arena: null, met: [], cleared: [] })

/**
 * When the omen of rift `slot` (0-based) is due: its slot in `RIFT.slots`
 * minus the omen, give or take `RIFT.jitter`; never, once the run's slots are
 * used up (the endless mode keeps its own cadence, `endlessRiftAt`).
 */
export const riftAt = (slot: number, rng: Rng) => {
  const at = RIFT.slots[slot]
  return at === undefined ? Infinity : at - RIFT.omenTime + range(rng, -RIFT.jitter, RIFT.jitter)
}

/** In endless mode, the next omen after one at `time`. */
export const endlessRiftAt = (time: number, rng: Rng) => time + RIFT.every + range(rng, -RIFT.jitter, RIFT.jitter)

/**
 * Whether an omen starts now. During a boss fight it waits for the boss to
 * fall, for up to `RIFT.bossWait` in a regular run (always for the endless
 * mode's reaper), and in a regular run it never starts so late that its
 * portal would still be open when Mewtwo comes. Inside the rift the run clock
 * stops (`clockRuns`), so the arena's length doesn't count.
 */
export const riftDue = (s: { time: number; nextAt: number; busy: boolean; bossAlive: boolean; endless: boolean }) =>
  s.time >= s.nextAt &&
  !s.busy &&
  (!s.bossAlive || (!s.endless && s.time >= s.nextAt + RIFT.bossWait)) &&
  (s.endless || s.time + RIFT.omenTime + RIFT.portalTime < RUN_LENGTH)

/** The domain behind `legend`'s rift, or undefined for its old arena (`data/arenas.ts`), which co-op keeps (`COOP_LOCKS`). */
export const riftDomain = (g: Pick<Game, 'coop'>, legend: EnemyId) => (coopLocked(g, 'domains') ? undefined : domainOf(legend))

/** Whether the run clock runs: it stops while the player is inside a rift. */
export const clockRuns = (g: Pick<Game, 'rift'>) => g.rift.arena === null

/**
 * A legendary not met yet this run; once all were met, any of them. Latias
 * brings Latios along (`RIFT_DRAWS`). Never `self`, the legend the player plays
 * (Legend mode), nor a domain fighting alongside it (no Eon duo for a Latios).
 */
export const pickLegend = (rng: Rng, met: readonly RiftLegend[], self: string | null = null): RiftLegend => {
  const open = RIFT_DRAWS.filter((l) => l !== self && domainOf(l)?.partner?.id !== self)
  const fresh = open.filter((l) => !met.includes(l))
  return pick(rng, fresh.length > 0 ? fresh : open)
}

/**
 * Standing in the portal (or a place's door) fills it; stepping out drains it
 * at a quarter of that pace, so a move that hops the player out and back on
 * its own (Aqua Step's sway, Zen Headbutt's dash) still lets them in.
 */
export const chargePortal = (charge: number, inside: boolean, dt: number) => (inside ? charge + dt : Math.max(0, charge - dt * 0.25))

/** How far a portal's step-in reaches: a domain's huge tear takes the player in from farther. */
export const portalReach = (g: Pick<Game, 'coop'>, legend: RiftLegend) => (riftDomain(g, legend) ? RIFT.tearRadius : RIFT.portalRadius)

/**
 * Whether `p` stands where a portal or an open place's door is filling: a
 * lunge stops there (`attacks.ts`), so a move that keeps carrying the player
 * (Flame Charge's leaps, Aqua Step's dance) can't hop them out every time.
 * The same reaches `riftPortal.ts` and `placeEntrance.ts` step the team in by.
 */
export const inDoorway = (g: Pick<Game, 'coop' | 'rift' | 'place'>, p: Pick<Player, 'x' | 'y' | 'radius'>) => {
  const portal = g.rift.portal
  if (portal && dm.sq(p.x - portal.x) + dm.sq(p.y - portal.y) < dm.sq(portalReach(g, portal.legend))) return true
  const ent = g.place.entrance
  if (!ent?.open || g.place.inside || g.rift.arena) return false
  return dm.sq(p.x - ent.x) + dm.sq(p.y - ent.y) < dm.sq(PLACES[ent.id].door + p.radius * 0.5)
}

/**
 * Rift legendaries are tuned for the first rift (4:00) and grow with the run
 * clock, like the horde: fast enough that the second rift (10:20) is as hard
 * for the stronger player who reaches it. `damage` scales their touch and, in
 * a domain, their attacks (`domainHarm`).
 */
export const riftScale = (time: number) => {
  const late = Math.max(0, time / 60 - RIFT.slots[0] / 60)
  return { hp: 1 + late * 0.75, damage: 1 + late * 0.09 }
}

/**
 * What a domain's harm to the player is multiplied by: the difficulty's press
 * (`DOMAIN_PRESS`), and its attacks grow with the run clock like the
 * legendary's body does (`riftScale`), so the second rift hits a stronger
 * player as hard as the first. 1 outside a domain. `body`: a touch, already scaled.
 */
export const domainHarm = (g: Game, body: boolean) => {
  if (!g.rift.arena?.domain) return 1
  return DOMAIN_PRESS[g.difficulty].harm * (body ? 1 : riftScale(g.time).damage)
}

/**
 * What beating a rift legendary pays, on top of a regular boss drop (₽ shower
 * and a Poké Ball): EXP, a money bag, extra Poké Balls, items and a heal.
 * A shiny legendary doubles the ₽ and adds a Poké Ball.
 */
export const riftLoot = (time: number, shiny: boolean) => {
  const coins = [250, 50, 50, 50, 50]
  return {
    xp: dm.round(150 + (time / 60) * 40),
    coins: shiny ? [...coins, ...coins] : coins,
    pokeballs: shiny ? 2 : 1,
    items: RIFT_ITEMS,
    /** Fraction of max HP restored. */
    heal: 0.5,
  }
}

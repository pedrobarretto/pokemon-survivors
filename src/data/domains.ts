import type { Difficulty } from '../game/difficulty'
import type { WeatherId } from './biomes'
import type { ArenaPiece, ArenaShape, Circle, FloorPattern, FloorPlan, Pt } from './arenas'
import type { BossPhase } from './bosses'
import type { EnemyId } from './enemies'
import type { ThemeId } from './music'
import type { PokeType } from './types'
import type { RiftLegend } from './rifts'
import { KYOGRE_DOMAIN } from './domains/kyogre'
import { GROUDON_DOMAIN } from './domains/groudon'
import { RAYQUAZA_DOMAIN } from './domains/rayquaza'
import { LUGIA_DOMAIN } from './domains/lugia'
import { HO_OH_DOMAIN } from './domains/hoOh'
import { DIALGA_DOMAIN } from './domains/dialga'
import { LATIS_DOMAIN } from './domains/latis'
import { DEOXYS_DOMAIN } from './domains/deoxys'
import { DARKRAI_DOMAIN } from './domains/darkrai'

/**
 * EPIC RIFTS: a legendary's domain, as data.
 *
 * A rift legendary with an entry in `DOMAINS` gets the four-act rift instead
 * of the old one-room arena (`data/arenas.ts`, still used by the others):
 *
 * 1. Omen (`omen`), on the map: its weather takes over (`weather`, the rules:
 *    rain boosts Water...) under its sky (`sky`, the look, painted by
 *    `render/legendSky.ts`), then a huge tear opens. The run clock stops once
 *    the player steps in and starts again on the way out.
 * 2. Crossing (`crossing`): a floor bigger than the screen, going north from
 *    `start` (domain px; y grows south, as on screen). A `threat` front rises
 *    from the south and pushes the player on; the `retinue` comes from ahead.
 *    Crossing `gate` (a domain y) seals the way back and starts act 3.
 * 3. Encounter: the camera travels to the arena (`arena.at`), the legendary
 *    makes its `entrance` (cry, shake, flash) at `arena.boss`, the title card
 *    shows its epithet (`rifts.domains[legend].epithet` in `src/i18n`) and its
 *    `music` starts. Its weather owns the domain from then on.
 * 4. Battle in `phases` (`BossPhase` in `data/bosses.ts`): each phase has its
 *    patterns, a signature `ultimate` with a readable safe spot (cover, an
 *    island, a gap between lances), how the legendary moves (`steer`), the
 *    sprite form it wears (`form`), and `arena` transforms (flood, lava,
 *    crumble) that land a warning after they show. At 0 HP the capture scene
 *    plays (`render/capture.ts`), then the loot drops as it always did.
 *
 * Authoring a legendary's rift:
 * - Write `data/domains/<legend>.ts` exporting a `LegendDomain` (copy
 *   `kyogre.ts`: its numbers are the reference, tuned at 4:00 on Normal) and
 *   add it to `DOMAINS` below. Coordinates: `crossing` in domain px around the
 *   portal (the player starts at `crossing.start`), `arena` shapes and points in
 *   arena px around `arena.at`. Build floors from `circle`, `poly`, `lane` and
 *   `around` (`data/arenas.ts`); floor everywhere the player may walk, `holes`
 *   where only swimmers and flyers go.
 * - Strings: `rifts.domains.<legend>` in `src/i18n/pt.ts` (then `en.ts`, `es.ts`):
 *   the place, the epithet, the omen line and one line per phase after the first.
 * - Music: a `Score` in `data/music.ts` named after the legendary, set as `music`
 *   (until then use `'boss'`).
 * - Look: the sky (`LegendSky`, `render/legendSky.ts`), the threat
 *   (`ThreatKind`, `render/domain.ts`), new scenery (`ArenaPiece`,
 *   `render/arenaPieces.ts`), floor patterns (`FloorPattern`, `render/rift.ts`).
 * - Phases can also blow the player around (`whirlpool`, `gust`), hold their
 *   shots still (`timeStop`), fly over the arena (`pass` steering), speed time
 *   up (`haste`) or come back from a fall (`rebirth`): see `data/bosses.ts`.
 * - Two legendaries at once: give the domain a `partner` (Latias's Latios).
 * - A rift only an event brings (Darkrai's, `EVENT_RIFTS` in `data/rifts.ts`)
 *   is a domain like any other; it just never comes in `pickLegend`'s draw.
 * - Mechanics the data can't say (Dialga's time skips in its crossing, the
 *   whirlpools set in Lugia's channels, Ho-Oh's tower raining beams) go in a
 *   hook (`DomainHooks`, `game/domainHooks.ts`).
 * - Stage it with `ps.rift('<legend>')` (the whole sequence) and
 *   `ps.riftAct('battle', 2)` (straight to a phase).
 */

/** How a legendary's sky looks over the map in its omen and over its domain (`render/legendSky.ts`). */
export type LegendSky = 'downpour' | 'harshSun' | 'gale' | 'timeWarp' | 'storm' | 'embers' | 'mist' | 'meteors' | 'newMoon'

/** How the threat behind the crossing looks (`render/domain.ts`); its rules are the same for every kind. `magma`: lava chasing up a collapsing tunnel; `crumble`: a floor falling away into the sky. */
export type ThreatKind = 'tide' | 'collapse' | 'fire' | 'void' | 'magma' | 'crumble' | 'storm' | 'time' | 'mist'

/**
 * How the legendary comes in: out of water (`rise`), down from the sky
 * (`descend`), out of thin air (`materialize`), as time stops around it
 * (`warp`: the world greys out and clock rings close on its spot), streaking
 * in out of invisibility (`swoop`, the Eon duo), or reforming out of a crystal
 * meteor that crashes down (`meteor`, Deoxys).
 */
export type DomainEntrance = 'rise' | 'descend' | 'materialize' | 'warp' | 'swoop' | 'meteor'

/** What a retinue member (or a summoned add) does besides walking at the player: aims ahead (`runner`), shoots from a distance (`spitter`), or comes in tougher (`elite`). */
export type RetinueRole = 'runner' | 'spitter' | 'elite'

/**
 * The front that pushes the player through the crossing: it starts at domain
 * y `start`, waits `delay` s, then rises `speed` px/s (`rush` times that while
 * it trails the player by more than `gap` px) and never passes `stop`. Behind
 * it the ground is water (slow; `ground: 'none'` leaves it as it is), the
 * player loses `damage` of their max HP every `every` s and is carried
 * `push` px/s north.
 */
export type Threat = {
  kind: ThreatKind
  start: number
  stop: number
  delay: number
  speed: number
  rush: number
  gap: number
  damage: number
  every: number
  push: number
  /** What the ground behind the front turns into: shallow water (the default) or nothing (lava and crumbling floors hurt through `damage` alone). */
  ground?: 'water' | 'none'
}

/** Who comes at the player in the crossing: `count` every `every` s from `first` on, at most `max` up at once, drawn by `weight`. */
export type Retinue = {
  first: number
  every: number
  count: number
  max: number
  members: readonly { id: EnemyId; weight: number; role?: RetinueRole }[]
}

/** Scenery standing on a floor (cover against shots and blasts). */
export type DomainSolid = { piece: ArenaPiece; x: number; y: number }

export type Crossing = FloorPlan & {
  pattern: FloorPattern
  solids: readonly DomainSolid[]
  start: Pt
  /** Crossing this domain y (northward) starts the encounter. */
  gate: number
  threat: Threat
  retinue: Retinue
  /** What plays while crossing (the battle plays the domain's `music`). */
  theme: ThemeId
}

export type DomainArena = FloorPlan & {
  /** The arena's center, domain px; everything else in it is arena px around it. */
  at: Pt
  pattern: FloorPattern
  solids: readonly DomainSolid[]
  /** Where the legendary appears (its home for `steer`), and where the player stands as the way back seals. */
  boss: Pt
  player: Pt
}

/**
 * A change to the arena in a phase: from `at` s into the phase it shows (the
 * area blinks) for `warn` s, then lands. `flood` turns `area` to water (slow)
 * except the `spare` islands, which count as dry for a `dry` blast; `lava`
 * burns walkers except on `spare`; `crumble` cuts `spare` circles out of the
 * floor (only flyers cross them). A later transform of the same kind replaces
 * the earlier one's spare spots.
 */
export type ArenaTransform = {
  kind: 'flood' | 'lava' | 'crumble'
  at: number
  warn: number
  area: readonly ArenaShape[]
  spare: readonly Circle[]
}

/** A phase of the battle: the boss's side (`BossPhase`) and what it does to the arena. */
export type DomainPhase = BossPhase & { arena?: readonly ArenaTransform[] }

/** What lies past a domain's floor (`render/domain.ts`): open `space` with drifting motes, `cave` rock, dark volcanic `magma` rock, the open `sky` far above the clouds, or the open `sea`. */
export type Backdrop = 'space' | 'cave' | 'sky' | 'magma' | 'sea'

/**
 * A second legendary fighting alongside the domain's own (Latios beside
 * Latias): revealed with it at `at` (arena px), linked so they share one pool
 * of HP and move through the phases together, each with its own patterns
 * (`phases`, as many as the domain's; the arena follows the domain's). One
 * knocked out stays down while the other fights on enraged; `revive.after` s
 * later the survivor brings it back with `revive.hp` of its HP (`revive.move`,
 * once, warned `revive.warn` s before), unless it falls first. Beating both is
 * beating each, and the capture scene throws a ball at each.
 */
export type DomainPartner = {
  id: EnemyId
  at: Pt
  phases: readonly BossPhase[]
  revive: { after: number; warn: number; hp: number; move: string }
}

export type LegendDomain = {
  omen: { weather: WeatherId; sky: LegendSky }
  backdrop: Backdrop
  crossing: Crossing
  arena: DomainArena
  entrance: DomainEntrance
  phases: readonly DomainPhase[]
  /** The battle's theme (`data/music.ts`). */
  music: ThemeId
  /** Multiplies the legendary's HP (on top of `riftScale`): the battle has three phases to get through. */
  hp: number
  /** Seconds the battle may last before the domain collapses and throws the player out. */
  battleTime: number
  /** Multiplies the legendary's contact damage (a flyer brushing past hurts less than its attacks); 1 when absent. */
  touch?: number
  /** Share of max HP its lava burns per touch (`LAVA_BURN` when absent). */
  lavaBurn?: number
  /** Share of the weather's edge the player's attacks keep in here (Groudon's own sun only half-feeds a Fire player); 1 when absent. */
  weatherShare?: number
  /** A second legendary fighting alongside (`DomainPartner`). */
  partner?: DomainPartner
  /** A Pokémon that only shows up in a scene (Cresselia breaking Darkrai's nightmare), never fought: its sheets load with the legendary's (`render/spriteNeeds.ts`) and the site's Pokédex lists it. */
  cameo?: { dex: number; name: string; types: readonly PokeType[] }
  /** Who else its hooks bring in (Darkrai's shadow clones), for the Pokédex's list of who a domain brings. */
  cast?: readonly EnemyId[]
}

/**
 * How each difficulty presses a domain's legendary, on top of its patterns'
 * pace and telegraphs (`BOSS_DIFFICULTY`) and the damage every foe deals
 * (`DIFFICULTIES`): `hp` multiplies its HP, `harm` everything the domain does
 * to the player. Normal is tuned for a player without Poké Mart upgrades and
 * Nightmare for a maxed Mart, so a battle lasts about as long on each.
 */
export const DOMAIN_PRESS = {
  normal: { hp: 0.9, harm: 0.8 },
  hard: { hp: 1.3, harm: 1 },
  nightmare: { hp: 1.8, harm: 0.9 },
} as const satisfies Record<Difficulty, { hp: number; harm: number }>

/** The legendaries whose rift is a domain. The others keep the old arena (`data/arenas.ts`) until theirs is written. */
export const DOMAINS: Partial<Record<RiftLegend, LegendDomain>> = {
  kyogre: KYOGRE_DOMAIN,
  groudon: GROUDON_DOMAIN,
  rayquaza: RAYQUAZA_DOMAIN,
  lugia: LUGIA_DOMAIN,
  hoOh: HO_OH_DOMAIN,
  dialga: DIALGA_DOMAIN,
  latias: LATIS_DOMAIN,
  deoxys: DEOXYS_DOMAIN,
  darkrai: DARKRAI_DOMAIN,
}

/** The domain behind `legend`'s rift, if it has one. */
export const domainOf = (legend: EnemyId): LegendDomain | undefined => (DOMAINS as Partial<Record<EnemyId, LegendDomain>>)[legend]

/** The domain legendaries' phases (and their partners'), for `BOSS_PHASES`. */
export const DOMAIN_PHASES: Partial<Record<EnemyId, readonly BossPhase[]>> = Object.fromEntries(
  Object.entries(DOMAINS).flatMap(([id, d]) => [[id, d.phases], ...(d.partner ? [[d.partner.id, d.partner.phases]] : [])]),
)

/** The legendary that fights beside `legend` in its domain, if any. */
export const partnerOf = (legend: EnemyId) => domainOf(legend)?.partner?.id

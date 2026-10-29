import { ARENA_FORMATS, type ArenaFormat } from './arenaFormats'
import type { StarterId } from './starters'
import type { MapId } from './versusMaps'

/**
 * Versus (`game/versus.ts`): two teams on one map, a Unite-style match, in
 * one of the formats (`VERSUS_FORMATS`: team size, map and clock). Wild Pokémon in camps drop Energy; a player carries it
 * into a goal zone of the rival team and channels to score it. Goals have a
 * capacity and break; the base goal opens once a lane goal on its side is
 * gone. The last `stretch` seconds score double and bring Zapdos to the
 * center. The team with more points when the clock runs out wins. Seats no
 * human takes are bots (`game/versusBots.ts`). Every number here is the
 * mode's own: nothing in solo or co-op reads it.
 */

/** 0: Blue (west), 1: Red (east). */
export type Team = 0 | 1

/** Unite's five roles: they tilt the PvP math and a few stats (`ROLES`). */
export type Role = 'attacker' | 'speedster' | 'allRounder' | 'defender' | 'supporter'

export const VERSUS = {
  /** The simulated view (same as co-op's: every client simulates the same, whatever its window). */
  view: { w: 480, h: 512 },
  energy: {
    /** Most Energy a player carries. */
    cap: 30,
    /** A fainted player drops this share of what they carried. */
    dropShare: 0.5,
    /** Orbs on the ground are pulled in from this far (px, body to orb). */
    magnet: 26,
    /** Orbs lie this long before they fade (s). */
    ttl: 40,
  },
  score: {
    /** Channel time to score: `base + perPoint × energy` seconds. */
    base: 0.45,
    perPoint: 0.045,
    /** Each teammate standing in the same goal speeds the channel by this share. */
    allyBoost: 0.5,
    /** Getting hurt by a rival within this long (s) stops a channel and holds it. */
    hurtLock: 0.6,
  },
  /** Standing in your own team's goal: healing per second (share of max HP) and pace. */
  ownGoal: { heal: 0.04, pace: 1.2 },
  /** Your team's spawn pad heals fast; a rival on it burns (share of max HP per second). */
  spawnPad: { r: 46, heal: 0.25, burn: 0.2 },
  respawn: {
    /** I-frames on the way back in (s). The time down is the format's (`FormatRules.respawn`). */
    iframes: 2,
  },
  pvp: {
    /** Every hit from a rival's move is cut to this share (moves are tuned against hordes). */
    damage: 0.36,
    /** Rivals' hits don't stack i-frames; a hitbox still hits a body once per its own `hitInterval`. A rival's knockback pushes this many px per 100 knockback. */
    shove: 3,
    /** A versus Pokémon has this many times the HP it would have in a run. */
    hp: 2.2,
    /** Defeating a rival: EXP for the knocker's team (× the victim's level). */
    koXp: 6,
    /** The knocker also gets this share of what the victim dropped, straight into their bag (the rest scatters). */
    steal: 0,
  },
  /** A wild faint's EXP reaches every teammate within this radius (px) in full, the others at `xpRemote`. */
  xpShare: { radius: 180, remote: 0.35 },
  /** Level-up cards wait this long for a pick before the first one is taken (s); the Pokémon keeps playing meanwhile. */
  pickTime: 9,
  /** An evolution plays this long in versus (the rest of `EVOLUTION_TIME` is skipped). */
  evolveTime: 1,
  /** Zapdos: arrives at the stretch; its faint gives the last team that hit it Energy each and instant scoring for a while (s). Its HP is the format's. */
  zapdos: { damage: 0.6, energy: 20, blessing: 20 },
  /** Drednaw: the mid-match objective in the center; its faint gives its team a shield (share of max HP) and Energy each. Its HP and times are the format's. */
  drednaw: { energy: 10, shield: 0.25 },
  /**
   * Tall grass (`VersusMap.grass`, `game/versusGrass.ts`): a Pokémon in a patch
   * is hidden from the rival team and its moves hold. A rival within `near` px
   * (or in the same patch) sees it, and so does everyone for `reveal` seconds
   * after it hits or is hit by a rival, or uses its special.
   */
  grass: { near: 40, reveal: 1.5 },
  /** A rival's hit counts toward an assist when the Pokémon it landed on is knocked out within this many seconds (`assistsOf`). */
  assist: 8,
  /**
   * Quick chat and pings (`game/versusSocial.ts`): each player's lines and
   * pings come out of a bucket of `burst` that refills one every `every`
   * seconds (the simulation drops the rest, so every client shows the same);
   * a line shows `keep` seconds, a ping `keep` seconds.
   */
  talk: { burst: 3, every: 4, keep: 6 },
  ping: { burst: 3, every: 2.5, keep: 5 },
  /**
   * Surrender (`game/versusSocial.ts`): a team's human proposes it from
   * `from` of the format's clock on (half-time: 3:30 left in a 4v4, 1:30 in
   * a 3v3; `surrenderFrom`); the team's humans vote for `window` seconds and
   * it passes with two thirds of them (one human alone decides). A vote that
   * fails waits `cooldown` seconds before the team's next.
   */
  surrender: { from: 0.5, window: 20, cooldown: 60 },
} as const

/** What a format plays like (`ARENA_FORMATS` has what the relay needs of it). */
export type FormatRules = {
  /** Pokémon per team; seats no human takes are bots. */
  teamSize: number
  map: MapId
  /** Match length (s). */
  length: number
  /** The last seconds of the match: points count double and Zapdos comes to the center. */
  stretch: number
  /** Every EXP of the match (wild Pokémon, knockouts, objectives) is worth this many times its base. */
  xp: number
  /** Seconds down after a knockout: `base + perLevel × level`, plus `stretch` in the last stretch. */
  respawn: { base: number; perLevel: number; stretch: number }
  /** Drednaw's first arrival and its return after a faint (match s), and its HP. */
  drednaw: { first: number; respawn: number; hp: number }
  zapdos: { hp: number }
}

export const VERSUS_FORMATS = {
  /** 4v4 on the Vale, 7 minutes: Drednaw from 1:40, Zapdos for the last 2:00. */
  standard: {
    teamSize: ARENA_FORMATS.standard.teamSize,
    map: 'vale',
    length: 420,
    stretch: 120,
    xp: 1,
    respawn: { base: 4, perLevel: 0.5, stretch: 3 },
    drednaw: { first: 100, respawn: 120, hp: 2600 },
    zapdos: { hp: 9000 },
  },
  /**
   * 3v3 on the Clareira, 3 minutes: Drednaw from 0:40, Zapdos for the last
   * 1:00. EXP runs at double so the first evolution (Lv 12) lands around the
   * two-minute mark, and knockouts are short so nobody spends a tenth of the
   * match on the bench.
   */
  quick: {
    teamSize: ARENA_FORMATS.quick.teamSize,
    map: 'glade',
    length: 180,
    stretch: 60,
    xp: 2,
    respawn: { base: 3, perLevel: 0.3, stretch: 2 },
    drednaw: { first: 40, respawn: 50, hp: 900 },
    zapdos: { hp: 3800 },
  },
} as const satisfies Record<ArenaFormat, FormatRules>

/** What each role changes: damage dealt and taken in PvP, pace, and a Supporter's healing aura (share of max HP per second, px). */
export const ROLES = {
  attacker: { dealt: 1.15, taken: 1.1, pace: 1, aura: 0 },
  speedster: { dealt: 1.05, taken: 1.05, pace: 1.12, aura: 0 },
  allRounder: { dealt: 1, taken: 0.95, pace: 1.04, aura: 0 },
  defender: { dealt: 0.85, taken: 0.72, pace: 0.96, aura: 0 },
  supporter: { dealt: 0.85, taken: 0.95, pace: 1, aura: 0.015 },
} as const satisfies Record<Role, { dealt: number; taken: number; pace: number; aura: number }>

/** How far a Supporter's healing aura reaches (px). */
export const AURA_RANGE = 80

/** The Pokémon Versus offers and their roles: the 27 starters, free for everyone, so a match is fair from the first day. */
export const VERSUS_ROSTER = {
  bulbasaur: 'supporter',
  charmander: 'attacker',
  squirtle: 'defender',
  chikorita: 'supporter',
  cyndaquil: 'attacker',
  totodile: 'allRounder',
  treecko: 'speedster',
  torchic: 'allRounder',
  mudkip: 'defender',
  turtwig: 'defender',
  chimchar: 'speedster',
  piplup: 'allRounder',
  snivy: 'speedster',
  tepig: 'defender',
  oshawott: 'allRounder',
  chespin: 'defender',
  fennekin: 'attacker',
  froakie: 'speedster',
  rowlet: 'attacker',
  litten: 'allRounder',
  popplio: 'supporter',
  grookey: 'supporter',
  scorbunny: 'speedster',
  sobble: 'attacker',
  sprigatito: 'speedster',
  fuecoco: 'attacker',
  quaxly: 'allRounder',
} as const satisfies Record<StarterId, Role>

export type VersusPick = keyof typeof VERSUS_ROSTER

export const VERSUS_PICKS = Object.keys(VERSUS_ROSTER) as VersusPick[]

export const isVersusPick = (id: string): id is VersusPick => Object.hasOwn(VERSUS_ROSTER, id)

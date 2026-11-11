import { POKE_TYPES, type PokeType } from './types'
import type { EnemyId } from './enemies'

/**
 * Terastal (`game/tera.ts`) and the Tera Raids (`game/teraRaid.ts`) as data.
 * A run's Tera type comes from the Tera Shards it picks up (bosses drop a
 * choice of two, a raid its own type's); the Tera Orb fills with KOs and with
 * time, and a press Terastallizes the Pokémon for `TERA.duration` seconds.
 * Stellar is Terapagos's: every move type boosted once, big.
 */

/** A Tera type: one of the 18, or Stellar (Terapagos's, and the 7★ raids'). */
export type TeraType = PokeType | 'stellar'

export const TERA_TYPES = [...POKE_TYPES, 'stellar'] as const satisfies readonly TeraType[]

export const isTeraType = (v: unknown): v is TeraType => typeof v === 'string' && (TERA_TYPES as readonly string[]).includes(v)

export const TERA = {
  /** KOs that fill the Tera Orb from empty; a boss's counts `bossKo` of it. */
  orbKos: 110,
  bossKo: 0.2,
  /** Seconds that fill it on their own, KOs or not. */
  orbTime: 150,
  /** Seconds a Terastallization lasts, and the transformation (the world waits, solo; co-op wraps the player in crystal). */
  duration: 20,
  intro: 1.6,
  /** Invulnerability after the crystal shatters. */
  iframes: 1.2,
  /** Damage of a move of the Tera type; `stab` when it's also one of the Pokémon's own types. */
  power: 1.3,
  stab: 1.6,
  /** Stellar: each move type's first hit while it lasts lands `stellarFirst` times (once per type), every other hit `stellarRest`. */
  stellarFirst: 3,
  stellarRest: 1.15,
  /**
   * How much of the type chart reaches a Terastallized Pokémon defending as its
   * Tera type (`teraGuard`): half the softened chart's distance from ×1, so a
   * weakness costs ×1.25 and a resistance saves ×0.875, an immunity ×0.75.
   */
  guard: 0.5,
  /** The shatter's shockwave: radius (px), damage per Lv-1 might, knockback. */
  wave: { radius: 70, power: 28, knockback: 260 },
  /** Gap between the two shards of a boss's choice (px), so the player walks to one. */
  shardGap: 34,
  /** A shard waits to be touched (never pulled by the magnet) within this many px of the body. */
  touch: 9,
} as const

/** A raid's star rating, 3..7. 7★ raids are Stellar and Terapagos's. */
export type RaidStars = 3 | 4 | 5 | 6 | 7

/**
 * What each star rating does to a raid boss: `hp` and `damage` on top of the
 * run clock's growth (`raidScale`), the HP shares its Tera shield goes up at,
 * the shield's points as a share of max HP, and the seconds before the den
 * throws the team out. `storm`: seconds between its crystal storms (the
 * raid's own attack, in its Tera type), 0 for none.
 */
export const RAID_STARS = {
  3: { hp: 0.8, damage: 0.9, shields: [0.5], shield: 0.1, time: 90, storm: 0 },
  4: { hp: 1, damage: 1, shields: [0.6], shield: 0.12, time: 100, storm: 9 },
  5: { hp: 1.3, damage: 1.1, shields: [0.7, 0.35], shield: 0.13, time: 120, storm: 8 },
  6: { hp: 1.6, damage: 1.2, shields: [0.75, 0.45], shield: 0.15, time: 135, storm: 7 },
  7: { hp: 2, damage: 1.3, shields: [0.8, 0.55, 0.3], shield: 0.16, time: 150, storm: 6 },
} as const satisfies Record<RaidStars, { hp: number; damage: number; shields: readonly number[]; shield: number; time: number; storm: number }>

export const RAID = {
  /**
   * Dens open on the map around 8:10 (the run's own raid, drawn from its seed)
   * and 13:10 (the raid of the day), clear of the trio's slots and the rifts;
   * in endless mode one every `every` s. A den stays `openTime` s.
   */
  slots: [490, 790],
  jitter: 8,
  every: 300,
  openTime: 45,
  /** Standing in the den this long steps the team in; its mouth is `door` px wide. */
  enterTime: 0.8,
  door: 20,
  /** A den due during a boss fight waits for it, but no longer than this. */
  bossWait: 45,
  /** The run's own raid: its stars by difficulty, one more for each endless den. */
  ownStars: { normal: 4, hard: 5, nightmare: 6 },
  /** While the shield holds, the boss takes this share of a hit; a broken one leaves it stunned and open for `broken` s, taking `open` times. */
  shielded: 0.12,
  broken: 4,
  open: 1.5,
  /** What a hit does to the shield: a super-effective one `weak` times, a resisted one `resisted`, one in the attacker's Tera type `tera` times. */
  weak: 2.5,
  resisted: 0.5,
  tera: 2,
  /** A broken shield fills every player's Tera Orb by this share. */
  orbGift: 0.35,
  /** Seconds to grab the loot once the boss falls, then the den lets the team out. */
  lootTime: 6,
  /** Fainting inside: thrown out after `fallTime` s with `fallHp` of max HP. */
  fallTime: 2.4,
  fallHp: 0.3,
  /** Share of max HP the win heals. */
  heal: 0.5,
  /** ₽ the boss leaves: the bag and the shower, times the stars over 4. */
  coins: [200, 60, 60, 60, 60, 60],
} as const

/**
 * The raid bosses: giant Terastallized Pokémon, each fought with its own kit
 * (`BOSS_PATTERNS`) whatever its Tera type. `terapagos` is the 7★ Stellar one.
 */
export const RAID_BOSSES = [
  'raidCharizard', 'raidBlastoise', 'raidVenusaur', 'raidGengar', 'raidGyarados', 'raidDragonite',
  'raidTyranitar', 'raidGardevoir', 'raidMetagross', 'raidGarchomp', 'raidLucario', 'raidHydreigon',
  'raidVolcarona', 'raidDragapult', 'raidTinkaton',
] as const satisfies readonly EnemyId[]

export type RaidBoss = (typeof RAID_BOSSES)[number] | 'terapagos'

/** A raid: who, in which Tera type, at how many stars. */
export type RaidPick = { boss: RaidBoss; tera: TeraType; stars: RaidStars }

/** The raid of the day's stars, Monday to Sunday: the weekend's are 7★ Stellar, Terapagos's. */
export const RAID_WEEK = [3, 4, 5, 4, 6, 7, 7] as const satisfies readonly RaidStars[]

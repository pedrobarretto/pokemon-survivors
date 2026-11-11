import { RAID, RAID_BOSSES, RAID_STARS, RAID_WEEK, type RaidBoss, type RaidPick, type RaidStars, type TeraType } from '../data/tera'
import type { FloorPlan } from '../data/arenas'
import { circle } from '../data/arenas'
import { POKE_TYPES, type PokeType } from '../data/types'
import { RUN_LENGTH } from '../data/waves'
import { TAU, retain } from '../engine/math'
import { pick, range } from '../engine/rng'
import { onFloor } from './arenaFloor'
import { healPlayer } from './combat'
import { dayNumber, type DayKey } from './day'
import { burst, floatText, setScreenShake, shakeScreen } from './effects'
import { spawnEnemy } from './enemies'
import { dropCoins } from './pickups'
import { bringBack, keepOnFloor, setAside, type Room, type Stash } from './room'
import { chargeOrb, dropShard } from './tera'
import { clearSpot, footOf } from './terrain'
import { anchorPlayer, centerScreen, placeTeam, playerWithin } from './players'
import { spawnHazard } from './bosses'
import { harmBy } from './harm'
import type { HazardVisual } from '../data/bosses'
import { dropForEach } from './coop'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'

/**
 * Tera Raids. A den opens on the map around 8:10 (the run's own raid, its
 * boss and Tera type drawn from the seed) and around 13:10 (the raid of the
 * day, `raidOfDay`: the same boss, type and stars for everyone that day, 7★
 * Stellar Terapagos on weekends); in endless mode one every few minutes, a
 * star harder each time. Standing in it steps the team into its crystal
 * hollow: a room (`room.ts`) with one giant Terastallized boss that defends
 * as its Tera type. Under HP shares set by its stars it raises a Tera shield
 * that soaks most of a hit until broken (`shieldTakes`: hitting its weakness,
 * or hitting as a Terastallized Pokémon of your own Tera type, breaks it
 * faster); broken, the boss reels and takes more. Beating it pays shards of
 * its Tera type, a full Tera Orb and its loot; Terapagos is captured. The run
 * clock stops inside, like in a rift. Solo and co-op alike (the team goes in
 * together), never in the Arena.
 */

/** A raid's Tera shield: up or not, its points, the next HP share it rises at, and seconds left reeling after it broke. */
export type RaidShield = { up: boolean; hp: number; max: number; next: number; broken: number }

/** A den waiting on the map. `day`: it holds the raid of the day. */
export type RaidDen = { x: number; y: number; left: number; charge: number; raid: RaidPick; day: boolean }

export type RaidArena = Room & {
  raid: RaidPick
  day: boolean
  /** Seconds before the den throws the team out. */
  left: number
  age: number
  bossId: number
  shield: RaidShield
  /** Seconds to the boss's next crystal storm. */
  storm: number
  /** Seconds left to grab the loot once the boss falls; null while it stands. */
  loot: number | null
  /** Seconds left on the fall (a player fainted); null while they stand. */
  fall: number | null
  stash: Stash
}

/** A raid beaten this run, for the end screen, the missions and the titles. */
export type RaidWin = { boss: RaidBoss; tera: TeraType; stars: RaidStars; day: boolean }

export type RaidState = {
  /** The run's seed, which times the dens (`slotAt`). */
  seed: number
  /** Run time the next den is due, and which of `RAID.slots` it is. */
  nextAt: number
  slot: number
  den: RaidDen | null
  arena: RaidArena | null
  /** The day whose raid the late den holds (`ReplayStart.raid`); null: the run draws its own there too. */
  day: DayKey | null
  /** Raids entered and beaten this run. */
  entered: number
  cleared: RaidWin[]
}

/** A whole-number hash of `n` and `salt`, the same on every engine (integer math only). */
const mix = (n: number, salt: number) => {
  let h = (n * 374761393 + salt * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

/** When the den of `slot` is due: its slot, give or take `RAID.jitter` (hashed from the seed, so the run's rng isn't drawn for it); never past the run's slots (endless keeps its own cadence). */
const slotAt = (slot: number, seed: number) => {
  const at = RAID.slots[slot]
  return at === undefined ? Infinity : at + (mix(seed, slot + 11) % (RAID.jitter * 2 + 1)) - RAID.jitter
}

export const createRaidState = (seed: number, day: DayKey | null): RaidState => ({
  seed,
  nextAt: slotAt(0, seed),
  slot: 0,
  den: null,
  arena: null,
  day,
  entered: 0,
  cleared: [],
})


/**
 * The raid of the day: its stars from the weekday (`RAID_WEEK`, Monday first),
 * its boss and Tera type from the day itself; a weekend's is Terapagos, Stellar, 7★.
 */
export const raidOfDay = (day: DayKey): RaidPick => {
  const n = dayNumber(day)
  const stars = RAID_WEEK[(n + 3) % 7]!
  if (stars === 7) return { boss: 'terapagos', tera: 'stellar', stars }
  return { boss: RAID_BOSSES[mix(n, 1) % RAID_BOSSES.length]!, tera: POKE_TYPES[mix(n, 2) % POKE_TYPES.length]!, stars }
}

/** Whether a run's raid day fits the day it started (or the one before, a run begun before midnight): what the server checks. */
export const raidDayFits = (day: DayKey | null, started: DayKey, before: DayKey) => day === null || day === started || day === before

/** The run's own raid at the den of `slot`: drawn from the seed, its stars by difficulty and one more per endless den. */
const ownRaid = (g: Game): RaidPick => {
  const base = RAID.ownStars[g.difficulty]
  const stars = Math.min(6, base + Math.max(0, g.raid.slot - 1)) as RaidStars
  return { boss: pick(g.rng, RAID_BOSSES), tera: pick(g.rng, POKE_TYPES), stars }
}

/** Whether `e` is the boss of the raid the team is in. */
export const isRaidBoss = (g: Game, e: Enemy) => g.raid.arena !== null && g.raid.arena.bossId === e.id

/**
 * How a raid boss grows with the run clock, on top of its stars: tuned for a
 * den at 8:10, about a fifth more each minute past it (a third as fast as a rift's).
 */
export const raidScale = (time: number, stars: RaidStars) => {
  const late = Math.max(0, time / 60 - 8)
  const s = RAID_STARS[stars]
  return { hp: (1 + late * 0.22) * s.hp, damage: (1 + late * 0.05) * s.damage }
}

/* ---------------- The den on the map ---------------- */

/** Whether a den opens now: nothing else holding the team's attention, no boss fight (up to `RAID.bossWait`), and never so late a regular run's den would meet Mewtwo. */
const raidDue = (g: Game) => {
  const s = g.raid
  if (g.time < s.nextAt || s.den || s.arena) return false
  if (g.rift.omen || g.rift.portal || g.rift.arena || g.place.inside || g.place.entrance?.open || g.legendScene) return false
  if (g.bossId !== null && (g.endless !== null || g.time < s.nextAt + RAID.bossWait)) return false
  return g.endless !== null || g.time + RAID.openTime < RUN_LENGTH
}

/** Opens a den holding `raid` (the next one due by default) at (x, y), or just past a player's screen edge. */
export const openDen = (g: Game, raid?: RaidPick, at?: { x: number; y: number }) => {
  const s = g.raid
  const day = raid === undefined && s.slot === 1 && s.day !== null
  const held = raid ?? (day ? raidOfDay(s.day!) : ownRaid(g))
  const p = anchorPlayer(g)
  const a = range(g.rng, 0, TAU)
  const d = dm.hypot(g.view.w, g.view.h) / 2 + 60
  const { x, y } = at ?? clearSpot(g, { x: p.x + dm.cos(a) * d, y: p.y + dm.sin(a) * d }, RAID.door + 24)
  s.den = { x: dm.round(x), y: dm.round(y), left: RAID.openTime, charge: 0, raid: held, day }
  s.slot++
  s.nextAt = g.endless ? g.time + RAID.every : slotAt(s.slot, s.seed)
  g.events.push({ kind: 'raidOpen', raid: held, day })
  return s.den
}

/** Opens dens on schedule, ticks the open one and steps the team in once a player stands in its mouth long enough. */
export const updateRaidDen = (g: Game, dt: number) => {
  if (g.versus || g.training !== null || g.place.inside || g.rift.arena) return
  const s = g.raid
  if (s.arena) return
  const den = s.den
  if (!den) {
    // The endless mode keeps its own cadence once the run's slots are used.
    if (g.endless && s.nextAt === Infinity) s.nextAt = g.time + RAID.every / 2
    if (raidDue(g)) openDen(g)
    return
  }
  den.left -= dt
  if (den.left <= 0) {
    s.den = null
    burst(g, den.x, den.y - 8, { colors: ['#f8c8f8', '#c8f0f8', '#ffffff'], count: 24, speed: 60, ttl: 0.5 })
    g.events.push({ kind: 'raidClosed' })
    return
  }
  const inside = playerWithin(g, den.x, den.y, RAID.door) !== null
  den.charge = inside ? den.charge + dt : Math.max(0, den.charge - dt * 0.25)
  if (den.charge < RAID.enterTime) return
  s.den = null
  enterRaid(g, den)
}

/* ---------------- The hollow ---------------- */

/** The hollow's floor: a round crystal cave, 150 px across from its center. */
export const RAID_FLOOR: FloorPlan = { floor: [circle(0, 0, 150)] }

/** Where the boss and the team appear in the hollow (px from its center). */
const BOSS_AT = { x: 0, y: -46 }
const TEAM_AT = { x: 0, y: 84 }

/** Sends the team into a den's hollow, centered where the den was. */
export const enterRaid = (g: Game, den: RaidDen) => {
  const { raid } = den
  const stash = setAside(g)
  const boss = spawnEnemy(g, raid.boss, den.x + BOSS_AT.x, den.y + BOSS_AT.y)
  const scale = raidScale(g.time, raid.stars)
  boss.hp = boss.maxHp = dm.round(boss.maxHp * scale.hp)
  boss.damage *= scale.damage
  // Terastallized, it defends as its Tera type (Stellar keeps its own).
  if (raid.tera !== 'stellar') boss.types = [raid.tera]
  g.bossId = boss.id
  placeTeam(g, den.x + TEAM_AT.x, den.y + TEAM_AT.y)
  for (const p of g.players) centerScreen(g, p, den.x, den.y)
  g.flash = 0.9
  setScreenShake(g, 9, 'team')
  const stars = RAID_STARS[raid.stars]
  g.raid.arena = {
    x: den.x,
    y: den.y,
    layout: RAID_FLOOR,
    terrain: { solids: [], lake: null },
    raid,
    day: den.day,
    left: stars.time,
    age: 0,
    bossId: boss.id,
    shield: { up: false, hp: 0, max: 0, next: 0, broken: 0 },
    storm: stars.storm > 0 ? stars.storm * 0.6 : Infinity,
    loot: null,
    fall: null,
    stash,
  }
  g.raid.entered++
  g.events.push({ kind: 'raidEnter', raid, day: den.day })
}

/** Back out to the map where the den was. */
export const exitRaid = (g: Game, outcome: 'won' | 'timeout' | 'fallen') => {
  const arena = g.raid.arena
  if (!arena) return
  if (outcome === 'timeout') {
    const boss = g.enemies.find((e) => e.id === arena.bossId)
    if (boss) burst(g, boss.x, boss.y - boss.radius, { colors: ['#f8c8f8', '#c8f0f8', '#ffffff'], count: 60, speed: 150, ttl: 0.6 })
  }
  g.raid.arena = null
  placeTeam(g, arena.x, arena.y + 16)
  for (const p of g.players) {
    p.vx = 0
    p.vy = 0
    centerScreen(g, p, p.x, p.y)
  }
  bringBack(g, arena.stash)
  g.flash = 0.6
  g.events.push({ kind: 'raidExit', outcome })
}

/**
 * What a hit of `dmg` (`eff` against the boss's types, of `type` by the
 * acting player) does to a raid boss: with its shield up, the shield takes
 * the hit (more for its weakness and for a Terastallized player's own Tera
 * type, less resisted) and the boss only `RAID.shielded` of it; broken, the
 * reeling boss takes `RAID.open` times. Other foes, and raid bosses with
 * nothing up, take it whole. Returns the HP damage.
 */
export const shieldTakes = (g: Game, e: Enemy, dmg: number, eff: number, type: PokeType | null) => {
  const arena = g.raid.arena
  if (!arena || arena.bossId !== e.id) return dmg
  const sh = arena.shield
  if (sh.broken > 0) return dm.round(dmg * RAID.open)
  if (!sh.up) return dmg
  const tera = g.player.tera
  const own = type !== null && tera.active > 0 && (tera.form === 'stellar' || tera.form === type)
  const weight = (eff > 1 ? RAID.weak : eff < 1 ? RAID.resisted : 1) * (own ? RAID.tera : 1) * (type === null ? 0.5 : 1)
  sh.hp -= dmg * weight
  if (sh.hp <= 0) breakShield(g, e, arena)
  return Math.max(1, dm.round(dmg * RAID.shielded))
}

/** The shield goes up: its points from the boss's max HP and stars. */
const raiseShield = (g: Game, e: Enemy, arena: RaidArena) => {
  const sh = arena.shield
  sh.up = true
  sh.max = sh.hp = dm.round(e.maxHp * RAID_STARS[arena.raid.stars].shield)
  sh.next++
  burst(g, e.x, e.y - e.radius, { colors: ['#ffffff', '#c8f0ff', '#f8c8f8'], count: 40, speed: 120, ttl: 0.6, size: 2, drag: 4 })
  shakeScreen(g, 5, e)
  g.events.push({ kind: 'raidShield', moment: 'up' })
}

/** The shield breaks: the boss reels (stunned, its attacks held), takes more for a while, and every player's orb fills a share. */
const breakShield = (g: Game, e: Enemy, arena: RaidArena) => {
  const sh = arena.shield
  sh.up = false
  sh.hp = 0
  sh.broken = RAID.broken
  e.status.stun = Math.max(e.status.stun, RAID.broken)
  for (const p of g.players) if (!p.gone) chargeOrb(p, RAID.orbGift)
  burst(g, e.x, e.y - e.radius, { colors: ['#ffffff', '#c8f0ff', '#f8c8f8', '#f8f0a0'], count: 90, speed: 220, ttl: 0.8, size: 2, drag: 3, gravity: 120 })
  setScreenShake(g, 9, 'team')
  g.flash = Math.max(g.flash, 0.35)
  g.events.push({ kind: 'raidShield', moment: 'broken' })
}

/** What the crystal storm looks (and hits) like in each Tera type: its hit takes that type's typing (`HAZARD_TYPES`). */
const STORM_LOOK = {
  normal: 'slam', fire: 'fire', water: 'water', grass: 'grass', electric: 'thunder', poison: 'poison', flying: 'aero', bug: 'grass', rock: 'rock',
  ground: 'rock', ghost: 'shadow', fighting: 'slam', psychic: 'psychic', ice: 'ice', steel: 'steel', dark: 'shadow', fairy: 'mist', dragon: 'dragon',
  stellar: 'judgment',
} as const satisfies Record<TeraType, HazardVisual>

/** The crystal storm: the boss's own attack in its Tera type, crystals raining on each player's path. */
const crystalStorm = (g: Game, e: Enemy, arena: RaidArena) => {
  const count = arena.raid.stars >= 6 ? 6 : 4
  for (const p of g.players) {
    if (p.gone || p.hp <= 0) continue
    for (let i = 0; i < count; i++) {
      const lead = count > 1 ? i / (count - 1) : 1
      const delay = 1.25
      spawnHazard(g, {
        kind: 'strike', visual: STORM_LOOK[arena.raid.tera], r: 13, damage: e.damage * 0.8, armAt: delay, disarmAt: delay + 0.15, ttl: delay + 0.4,
        x: p.x + p.vx * delay * lead + range(g.rng, -24, 24), y: p.y + p.vy * delay * lead + range(g.rng, -18, 18), by: harmBy(e, 'Tera Storm'),
      })
    }
  }
  g.events.push({ kind: 'raidStorm' })
}

/** The boss fell: its loot, a shard of its Tera type for each player, every orb full, a heal and the loot window. */
const raidWin = (g: Game, arena: RaidArena, x: number, y: number) => {
  const k = arena.raid.stars / 4
  dropCoins(g, x, y, RAID.coins.map((c) => dm.round(c * k)))
  dropForEach(g, () => dropShard(g, x, y + 14, arena.raid.tera, g.nextId))
  const before = g.player
  for (const p of g.players) {
    if (p.gone) continue
    g.player = p
    chargeOrb(p, 1)
    const heal = dm.round(healPlayer(g, p.stats.maxHp * RAID.heal))
    if (heal > 0) floatText(g, p.x, p.y - 30, `+${heal}`, '#58e858')
  }
  g.player = before
  g.hazards.length = 0
  arena.loot = RAID.lootTime
  g.raid.cleared.push({ boss: arena.raid.boss, tera: arena.raid.tera, stars: arena.raid.stars, day: arena.day })
  g.events.push({ kind: 'raidCleared', raid: arena.raid, day: arena.day })
}

/** A player's HP hit 0 in the hollow (the last one standing, in co-op): the den throws the team out once the fall plays. */
export const fallInRaid = (g: Game) => {
  const arena = g.raid.arena
  if (!arena || arena.fall !== null) return
  arena.fall = RAID.fallTime
  g.player.hp = 0
  shakeScreen(g, 8)
  g.events.push({ kind: 'raidFall' })
}

/** Plays the fall and lands the team back outside. True while it plays (the world waits). */
export const updateRaidFall = (g: Game, dt: number) => {
  const arena = g.raid.arena
  if (!arena || arena.fall === null) return false
  arena.fall -= dt
  if (arena.fall > 0) return true
  for (const p of g.players) {
    if (g.players.length > 1 && (p.hp > 0 || p.gone)) continue
    p.hp = Math.max(1, dm.round(p.stats.maxHp * RAID.fallHp))
    p.revive = 0
    p.hurt = 0
  }
  exitRaid(g, 'fallen')
  return true
}

/** Runs the hollow: keeps everyone on its floor, the shield, the storm, the clock, the win and the loot window. */
export const updateRaid = (g: Game, dt: number) => {
  const arena = g.raid.arena
  if (!arena || arena.fall !== null) return
  arena.age += dt
  const whole = arena.layout.floor
  for (const p of g.players) keepOnFloor(p, arena, whole, [], footOf(p))
  for (const e of g.enemies) if (e.dying < 0) keepOnFloor(e, arena, whole, [], e.radius * 0.6)
  retain(g.hazards, (h) => onFloor(whole, h.x - arena.x, h.y - arena.y, 4))
  if (arena.loot !== null) {
    for (const k of g.pickups) if (k.kind !== 'teraShard') k.attracted = true
    arena.loot -= dt
    if (arena.loot <= 0) exitRaid(g, 'won')
    return
  }
  const boss = g.enemies.find((e) => e.id === arena.bossId)
  if (!boss || boss.dying >= 0) return raidWin(g, arena, boss?.x ?? arena.x, boss?.y ?? arena.y)
  const sh = arena.shield
  const at = RAID_STARS[arena.raid.stars].shields
  if (sh.broken > 0) sh.broken = Math.max(0, sh.broken - dt)
  else if (!sh.up && sh.next < at.length && boss.hp / boss.maxHp <= at[sh.next]!) raiseShield(g, boss, arena)
  // The giant holds its ground in the middle of the hollow.
  const home = { x: arena.x + BOSS_AT.x, y: arena.y + BOSS_AT.y }
  if (dm.sq(boss.x - home.x) + dm.sq(boss.y - home.y) > dm.sq(40)) {
    boss.kx += (home.x - boss.x) * dt * 2
    boss.ky += (home.y - boss.y) * dt * 2
  }
  arena.storm -= dt
  if (arena.storm <= 0 && boss.status.stun <= 0) {
    crystalStorm(g, boss, arena)
    // A shield that holds makes it rage: storms come half again as often.
    arena.storm = RAID_STARS[arena.raid.stars].storm * (sh.up ? 0.66 : 1)
  }
  arena.left -= dt
  if (arena.left <= 0) exitRaid(g, 'timeout')
}

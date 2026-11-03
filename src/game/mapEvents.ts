import { dir8, dirTo, retain, TAU, type Dir8 } from '../engine/math'
import { range, weightedPick } from '../engine/rng'
import { query } from '../engine/spatial'
import { DROP_TABLES, rollDrop, type BuffId } from '../data/consumables'
import { stageIndexAt } from '../data/waves'
import { addBuff } from './buffs'
import { healPlayer, hurtPlayer, killEnemy } from './combat'
import { dropItem } from './consumables'
import { logDefeat } from './dex'
import { burst, damageText, floatText, shakeScreen } from './effects'
import { enemyScale, spawnEnemy } from './enemies'
import { recomputeStats } from './leveling'
import {
  ALTAR, altarDuration, BOMB, CHEST, chestCoins, chestProgress, DIRECTOR, FADE, fleeHeading, FOUNTAIN, fountainSip,
  MEOWTH, MEOWTH_DEX, meowthSpeed, rollAltarBuff, SPIKES, spikePhase, spawnSpot, type SpikePhase,
} from './mapEventRules'
import { awardEgg, dropCoins, dropPickup } from './pickups'
import { touches } from './props'
import { isAlive } from './queries'
import { countNotice } from './tally'
import { openCursedChest } from './curseSystem'
import { clearSpot } from './terrain'
import { createFieldMissions, directMissions, FIELD_MISSIONS, type FieldMissionNotice, type FieldMissionState, type FieldMissionStates } from './fieldMissions'
import { openTutor } from './tms'
import { TUTOR, tutorWeight } from './tmRules'
import { actAs, anchorPlayer, mostHurt, nearestPlayer, phaseOf, playerWithin, standing } from './players'
import type { Game, Player } from './types'
import * as dm from '../engine/dmath'

/**
 * Points of interest the event director scatters around the player during a
 * run (altars, fountains, locked chests, traps, a fleeing Meowth, the Move Tutor),
 * and the field missions, placed by their own director (`fieldMissions.ts`).
 *
 * Adding one: give it a state in `MapEventStates`, a definition in
 * `MAP_EVENTS` (spawn rule, interaction, reward), art in `render/mapEvents.ts`
 * and, if it talks to the player, a `MapEventNotice` handled by `ui/mapEvents.ts`.
 */

/** Per-kind state, rolled by the definition's `create`. */
export type MapEventStates = {
  altar: { buff: BuffId }
  fountain: { charges: number; timer: number; visited: boolean }
  chest: { progress: number; ambushed: boolean }
  spikes: { phase: SpikePhase }
  bomb: { fuse: number }
  meowth: { hp: number; dir: Dir8; flash: number; hitCooldown: number; seed: number }
  /** Seconds stood in its ring so far (0..`TUTOR.stand`, drains outside). */
  tutor: { stand: number }
} & FieldMissionStates

export type MapEventKind = keyof MapEventStates

export type MapEventOf<K extends MapEventKind> = {
  id: number
  kind: K
  x: number
  y: number
  age: number
  /** Age at which it gives up on the player (definitions may extend it). */
  ttl: number
  /** -1 while live; seconds since it was spent (fade-out). */
  gone: number
  state: MapEventStates[K]
}

export type MapEvent = { [K in MapEventKind]: MapEventOf<K> }[MapEventKind]

export type MapEventsState = {
  list: MapEvent[]
  /** Game time of the director's next spawn attempt. */
  next: number
  /** The field missions' own director (`fieldMissions.ts`). */
  missions: FieldMissionState
}

/** What the shell hears about (sounds, toasts), carried by the `mapEvent` GameEvent. */
export type MapEventNotice =
  | { kind: 'altar'; buff: BuffId }
  | { kind: 'fountain' }
  | { kind: 'sip' }
  | { kind: 'chestAmbush' }
  | { kind: 'chestTick' }
  | { kind: 'chestOpen'; coins: number }
  | { kind: 'spikes' }
  | { kind: 'fuse' }
  | { kind: 'boom' }
  | { kind: 'meowth' }
  | { kind: 'meowthHit' }
  | { kind: 'payDay'; coins: number }
  | { kind: 'meowthEscaped' }
  /** A Move Tutor set up its tent nearby, had nothing left to teach, or moved on unvisited. */
  | { kind: 'tutor' }
  | { kind: 'tutorEmpty' }
  | { kind: 'tutorLeft' }
  /** Field missions (`fieldMissions.ts`). */
  | FieldMissionNotice

export type MapEventDef<K extends MapEventKind> = {
  spawn: {
    /** Run time (s) before the director may pick it. */
    from: number
    /** Director weight right now (0 = skip). */
    weight: (g: Game) => number
    /** Max alive at once. */
    max: number
    /** Seconds it waits before vanishing. */
    lifetime: number
    /** Distance range (px) from the player it's placed at. */
    distance: readonly [number, number]
  }
  /** Gets an arrow at the screen edge while it's off-screen. */
  marker: boolean
  create: (g: Game) => MapEventStates[K]
  /** Runs once when it's placed. */
  enter?: (g: Game, ev: MapEventOf<K>) => void
  /** Every tick while live: interaction and reward. Calls `spend` once it's used up. */
  update: (g: Game, ev: MapEventOf<K>, dt: number) => void
  /** When `ttl` runs out before it was used. */
  expire?: (g: Game, ev: MapEventOf<K>) => void
}

export const createMapEvents = (): MapEventsState => ({ list: [], next: DIRECTOR.first, missions: createFieldMissions() })

const notify = (g: Game, notice: MapEventNotice) => {
  countNotice(g.tally, notice)
  g.events.push({ kind: 'mapEvent', notice })
}

const spend = (ev: { gone: number }) => {
  ev.gone = 0
}

/** Whether some player stands within `r` px of (x, y). */
const within = (g: Game, x: number, y: number, r: number) => playerWithin(g, x, y, r) !== null

const neighbors: number[] = []

/**
 * Trap damage on everything within `r` of (x, y): wild Pokémon take `damage`
 * (bosses a slice of their max HP) and get shoved out, each player caught
 * `playerShare` of their max HP.
 */
const trapHit = (g: Game, x: number, y: number, r: number, damage: number, bossShare: number, playerShare: number) => {
  for (const i of query(g.grid, x, y, r + 16, neighbors)) {
    const e = g.enemies[i]
    if (!e || !isAlive(e) || dm.sq(e.x - x) + dm.sq(e.y - y) > dm.sq(r + e.radius)) continue
    const dmg = Math.max(1, dm.round(e.boss ? e.maxHp * bossShare : damage))
    e.hp -= dmg
    e.flash = 0.2
    const away = dirTo(x, y, e.x, e.y)
    e.kx += (away.x * 160) / e.mass
    e.ky += (away.y * 160) / e.mass
    damageText(g, e, dmg, '#f8a040')
    if (e.hp <= 0) killEnemy(g, e)
  }
  const before = g.player
  for (const p of g.players) {
    g.player = p
    if (standing(g, p) && dm.sq(p.x - x) + dm.sq(p.y - y) < dm.sq(r + p.radius)) hurtPlayer(g, p.stats.maxHp * playerShare, undefined, [], 'trap')
  }
  g.player = before
}

/** A ring of wild Pokémon from the current wave closing in on the chest. */
const ambush = (g: Game, x: number, y: number) => {
  const pool = g.roster.stages[stageIndexAt(g.time)] ?? []
  if (pool.length === 0) return
  const count = CHEST.ambush + Math.floor(g.time / 60)
  const offset = range(g.rng, 0, TAU)
  for (let i = 0; i < count; i++) {
    const a = offset + (i / count) * TAU
    spawnEnemy(g, weightedPick(g.rng, pool), x + dm.cos(a) * CHEST.ambushRadius, y + dm.sin(a) * CHEST.ambushRadius)
  }
}

/** A fountain's draw weight: more likely the more hurt `p` is. */
const fountainWeight = (p: Player) => 1 + 3 * (1 - p.hp / p.stats.maxHp)

export const MAP_EVENTS: { [K in MapEventKind]: MapEventDef<K> } = {
  altar: {
    spawn: { from: 20, weight: () => 3, max: 1, lifetime: 50, distance: [150, 260] },
    marker: true,
    create: (g) => ({ buff: rollAltarBuff(g.rng, g.player.buffs) }),
    update: (g, ev) => {
      // The first player to step on it gets the buff.
      const p = playerWithin(g, ev.x, ev.y, ALTAR.radius, true)
      if (!p) return
      const { buff } = ev.state
      addBuff(p.buffs, buff, altarDuration(buff))
      const before = actAs(g, p)
      recomputeStats(g)
      actAs(g, before)
      burst(g, ev.x, ev.y - 14, { colors: ['#ffffff', '#f8e8a0', '#c8a8f8'], count: 40, speed: 110, ttl: 0.8, gravity: -80 })
      notify(g, { kind: 'altar', buff })
      spend(ev)
    },
  },
  fountain: {
    // Shows up more often when a player is hurt.
    spawn: { from: 60, weight: (g) => fountainWeight(mostHurt(g)), max: 1, lifetime: 60, distance: [150, 260] },
    marker: true,
    create: () => ({ charges: FOUNTAIN.charges, timer: 0, visited: false }),
    update: (g, ev, dt) => {
      // Whoever stands in it drinks (the first player solo, standing in it or not).
      const p = playerWithin(g, ev.x, ev.y, FOUNTAIN.radius, true) ?? g.players[0]!
      const s = ev.state
      if (!fountainSip(s, dm.sq(p.x - ev.x) + dm.sq(p.y - ev.y) < dm.sq(FOUNTAIN.radius + p.radius), p.hp < p.stats.maxHp - 0.5, dt)) return
      const before = actAs(g, p)
      const heal = dm.round(healPlayer(g, p.stats.maxHp * FOUNTAIN.heal))
      actAs(g, before)
      floatText(g, p.x, p.y - 30, `+${heal}`, '#58e858')
      burst(g, ev.x, ev.y - 8, { colors: ['#a8d8f8', '#ffffff', '#58a8f0'], count: 10, speed: 50, ttl: 0.6, gravity: -50 })
      notify(g, { kind: s.visited ? 'sip' : 'fountain' })
      s.visited = true
      // Someone is drinking: it waits until it runs dry.
      ev.ttl = Math.max(ev.ttl, ev.age + 5)
      if (s.charges <= 0) spend(ev)
    },
  },
  chest: {
    spawn: { from: 45, weight: () => 2.5, max: 1, lifetime: 60, distance: [170, 280] },
    marker: true,
    create: () => ({ progress: 0, ambushed: false }),
    update: (g, ev, dt) => {
      const s = ev.state
      const opener = playerWithin(g, ev.x, ev.y, CHEST.radius)
      const inside = opener !== null
      if (inside && !s.ambushed) {
        s.ambushed = true
        ambush(g, ev.x, ev.y)
        notify(g, { kind: 'chestAmbush' })
      }
      const before = s.progress
      s.progress = chestProgress(s.progress, inside, dt)
      if (s.progress > before && Math.floor(s.progress * 6) !== Math.floor(before * 6)) notify(g, { kind: 'chestTick' })
      if (s.progress > 0) ev.ttl = Math.max(ev.ttl, ev.age + 4)
      // Its cursed item asks the player, so it opens on a running run only: never over a faint, a win or another screen
      // (the opener's own, in co-op: `phaseOf`).
      if (s.progress < 1 || phaseOf(g, opener ?? g.players[0]!) !== 'playing') return
      const coins = chestCoins(g.time)
      dropCoins(g, ev.x, ev.y - 4, coins)
      dropPickup(g, ev.x + 8, ev.y, 'pokeball')
      dropItem(g, ev.x - 8, ev.y, rollDrop(DROP_TABLES.itemBall, g.time, g.rng))
      awardEgg(g, 'chest', ev.x, ev.y)
      burst(g, ev.x, ev.y - 8, { colors: ['#f8d030', '#fff8c0', '#ffffff', '#c08800'], count: 50, speed: 140, ttl: 0.8, gravity: 60 })
      shakeScreen(g, 3, ev)
      notify(g, { kind: 'chestOpen', coins: coins.reduce((a, b) => a + b, 0) })
      spend(ev)
      // Sometimes there's a cursed item at the bottom: take it or leave it (whoever opened it).
      const actor = actAs(g, opener ?? g.players[0]!)
      openCursedChest(g, ev.x, ev.y)
      actAs(g, actor)
    },
  },
  spikes: {
    spawn: { from: 15, weight: () => 2, max: 2, lifetime: 45, distance: [90, 200] },
    marker: false,
    create: () => ({ phase: 'down' }),
    update: (g, ev) => {
      const phase = spikePhase(ev.age)
      const rising = phase === 'up' && ev.state.phase !== 'up'
      ev.state.phase = phase
      if (!rising) return
      trapHit(g, ev.x, ev.y, SPIKES.radius, SPIKES.damage * enemyScale(g).hp, 0.01, SPIKES.playerDamage)
      if (within(g, ev.x, ev.y, 260)) notify(g, { kind: 'spikes' })
    },
  },
  bomb: {
    spawn: { from: 30, weight: () => 1.5, max: 2, lifetime: 45, distance: [90, 200] },
    marker: false,
    create: () => ({ fuse: -1 }),
    update: (g, ev, dt) => {
      const s = ev.state
      if (s.fuse < 0) {
        const lit =
          playerWithin(g, ev.x, ev.y, BOMB.trigger, true) !== null ||
          query(g.grid, ev.x, ev.y, BOMB.trigger, neighbors).some((i) => {
            const e = g.enemies[i]
            return e !== undefined && isAlive(e) && dm.sq(e.x - ev.x) + dm.sq(e.y - ev.y) < dm.sq(BOMB.trigger)
          })
        if (!lit) return
        s.fuse = 0
        ev.ttl = Infinity
        notify(g, { kind: 'fuse' })
        return
      }
      s.fuse += dt
      if (s.fuse < BOMB.fuse) return
      trapHit(g, ev.x, ev.y, BOMB.radius, BOMB.damage * enemyScale(g).hp, BOMB.bossDamage, BOMB.playerDamage)
      burst(g, ev.x, ev.y - 6, { colors: ['#ffffff', '#f8e858', '#f87830', '#e83030', '#484848'], count: 50, speed: 180, ttl: 0.6 })
      shakeScreen(g, 6, ev)
      notify(g, { kind: 'boom' })
      spend(ev)
    },
  },
  meowth: {
    spawn: { from: 40, weight: () => 1.2, max: 1, lifetime: 15, distance: [110, 150] },
    marker: true,
    create: (g) => ({ hp: MEOWTH.hp, dir: 0, flash: 0, hitCooldown: 0, seed: range(g.rng, 0, TAU) }),
    enter: (g) => notify(g, { kind: 'meowth' }),
    update: (g, ev, dt) => {
      // It runs from the nearest player.
      const p = nearestPlayer(g, ev.x, ev.y)
      const s = ev.state
      const dist = dm.hypot(ev.x - p.x, ev.y - p.y)
      // Left far behind: it escapes right away (`expire`).
      if (dist > MEOWTH.escape) return void (ev.ttl = 0)
      const head = fleeHeading(ev.x, ev.y, p.x, p.y, ev.age, s.seed)
      // Stumbles for a moment after each hit.
      const speed = meowthSpeed(dist) * (s.flash > 0 ? 0.4 : 1)
      ev.x += head.x * speed * dt
      ev.y += head.y * speed * dt
      s.dir = dir8(head.x, head.y)
      s.flash = Math.max(0, s.flash - dt)
      s.hitCooldown -= dt
      if (s.hitCooldown > 0) return
      const hit = g.attacks.some((a) => a.age >= a.activeFrom && a.age <= a.activeUntil && a.age >= 0 && touches(a, ev.x, ev.y - MEOWTH.radius, MEOWTH.radius))
      if (!hit) return
      s.hp--
      s.flash = 0.2
      s.hitCooldown = MEOWTH.hitCooldown
      dropCoins(g, ev.x, ev.y - 6, MEOWTH.hitCoins)
      burst(g, ev.x, ev.y - 10, { colors: ['#f8d030', '#ffffff'], count: 5, speed: 60, ttl: 0.3 })
      if (s.hp > 0) return notify(g, { kind: 'meowthHit' })
      dropCoins(g, ev.x, ev.y - 6, MEOWTH.jackpot)
      logDefeat(g.dexLog, MEOWTH_DEX, false)
      burst(g, ev.x, ev.y - 10, { colors: ['#f8d030', '#fff8c0', '#c08800', '#ffffff'], count: 40, speed: 130, ttl: 0.7, gravity: 80 })
      notify(g, { kind: 'payDay', coins: MEOWTH.jackpot.reduce<number>((a, b) => a + b, 0) })
      spend(ev)
    },
    expire: (g, ev) => {
      burst(g, ev.x, ev.y - 8, { colors: ['#ffffff', '#e8e8f0', '#c8c8d8'], count: 18, speed: 70, ttl: 0.5 })
      notify(g, { kind: 'meowthEscaped' })
    },
  },
  tutor: {
    // Once around minute 3 and maybe again by minute 9 (`tutorWeight`), so the first move from outside the learnset comes early.
    spawn: { from: TUTOR.first.from, weight: (g) => tutorWeight(g.tutors, g.time), max: 1, lifetime: TUTOR.lifetime, distance: [150, 240] },
    marker: true,
    create: () => ({ stand: 0 }),
    enter: (g) => {
      g.tutors++
      notify(g, { kind: 'tutor' })
    },
    update: (g, ev, dt) => {
      const s = ev.state
      const pupil = playerWithin(g, ev.x, ev.y, TUTOR.radius, true)
      s.stand = Math.max(0, Math.min(TUTOR.stand, s.stand + (pupil ? dt : -dt)))
      if (s.stand > 0) ev.ttl = Math.max(ev.ttl, ev.age + 3)
      // One lesson at a time: it waits while another screen is open (the pupil's own, in co-op: `phaseOf`).
      if (s.stand < TUTOR.stand || phaseOf(g, pupil ?? g.players[0]!) !== 'playing') return
      burst(g, ev.x, ev.y - 12, { colors: ['#ffffff', '#f8e8a0', '#78c0f8', '#f87878'], count: 30, speed: 90, ttl: 0.7, gravity: -40 })
      // The lesson is for whoever stands in the tent (the first player solo).
      const before = actAs(g, pupil ?? g.players[0]!)
      const opened = openTutor(g)
      actAs(g, before)
      if (!opened) notify(g, { kind: 'tutorEmpty' })
      spend(ev)
    },
    expire: (g) => notify(g, { kind: 'tutorLeft' }),
  },
  ...FIELD_MISSIONS,
}

/**
 * Whether `p` stands in a ring that fills while they stay (a chest's lock, the
 * Move Tutor's tent): a lunge stops there (`attacks.ts`), like at a doorway,
 * so a move that keeps carrying the player (Aqua Step's dance) can't hop them out every time.
 */
export const inStandRing = (g: Pick<Game, 'mapEvents'>, p: Pick<Player, 'x' | 'y' | 'radius'>) => {
  for (const ev of g.mapEvents.list) {
    if (ev.gone >= 0 || (ev.kind !== 'chest' && ev.kind !== 'tutor')) continue
    const r = ev.kind === 'chest' ? CHEST.radius : TUTOR.radius + p.radius
    if (dm.sq(p.x - ev.x) + dm.sq(p.y - ev.y) < r * r) return true
  }
  return false
}

export const MAP_EVENT_KINDS = Object.keys(MAP_EVENTS) as MapEventKind[]

/** Places an event of `kind` at (x, y). The director calls it; so does `ps.event()` in dev builds. */
export const spawnMapEvent = <K extends MapEventKind>(g: Game, kind: K, x: number, y: number) => {
  const def: MapEventDef<K> = MAP_EVENTS[kind]
  const ev: MapEventOf<K> = { id: g.nextId++, kind, x, y, age: 0, ttl: def.spawn.lifetime, gone: -1, state: def.create(g) }
  // TS can't distribute a generic K over the union; `ev` is exactly the MapEventOf<K> member.
  g.mapEvents.list.push(ev as MapEvent)
  def.enter?.(g, ev)
  return ev
}

const tick = <K extends MapEventKind>(g: Game, ev: MapEventOf<K>, dt: number) => {
  const def: MapEventDef<K> = MAP_EVENTS[ev.kind]
  def.update(g, ev, dt)
  if (ev.gone >= 0 || ev.age < ev.ttl) return
  def.expire?.(g, ev)
  spend(ev)
}

const live = (g: Game, kind?: MapEventKind) => {
  let n = 0
  for (const ev of g.mapEvents.list) if (ev.gone < 0 && (kind === undefined || ev.kind === kind)) n++
  return n
}

/** Every ~30 s, maybe places a new event around a player (`anchorPlayer`): weighted by kind, never crowding the map. */
const direct = (g: Game) => {
  const s = g.mapEvents
  if (g.time < s.next) return
  s.next = g.time + range(g.rng, DIRECTOR.gap[0], DIRECTOR.gap[1])
  if (live(g) >= DIRECTOR.maxAlive) return
  const choices = MAP_EVENT_KINDS.flatMap((kind) => {
    const spawn = MAP_EVENTS[kind].spawn
    return g.time >= spawn.from && live(g, kind) < spawn.max ? [[kind, spawn.weight(g)] as const] : []
  }).filter(([, w]) => w > 0)
  if (choices.length === 0) return
  const kind = weightedPick(g.rng, choices)
  const taken = [...s.list, ...g.props]
  const p = anchorPlayer(g)
  const spot = spawnSpot(g.rng, p.x, p.y, MAP_EVENTS[kind].spawn.distance, taken)
  if (!spot) return
  // Events stand on open ground, never in a lake or against a rock.
  const open = clearSpot(g, spot, 18)
  spawnMapEvent(g, kind, dm.round(open.x), dm.round(open.y))
}

/** Whether some player is within `DIRECTOR.despawn` px (Manhattan) of (x, y). */
const nearSomeone = (g: Game, x: number, y: number) => {
  for (const p of g.players) if (Math.abs(x - p.x) + Math.abs(y - p.y) < DIRECTOR.despawn) return true
  return false
}

/** Runs the director, every live event's interaction, and clears faded events and the ones far from everyone. */
export const updateMapEvents = (g: Game, dt: number) => {
  direct(g)
  directMissions(g, spawnMapEvent)
  for (const ev of g.mapEvents.list) {
    ev.age += dt
    if (ev.gone >= 0) ev.gone += dt
    else tick(g, ev, dt)
  }
  retain(g.mapEvents.list, (ev) => ev.gone < FADE && nearSomeone(g, ev.x, ev.y))
}

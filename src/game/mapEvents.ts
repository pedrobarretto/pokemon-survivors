import { dir8, dirTo, retain, TAU, type Dir8 } from '../engine/math'
import { range, weightedPick } from '../engine/rng'
import { query } from '../engine/spatial'
import { DROP_TABLES, rollDrop, type BuffId } from '../data/consumables'
import { stageIndexAt } from '../data/waves'
import { addBuff } from './buffs'
import { healPlayer, hurtPlayers, killEnemy } from './combat'
import { dropItem } from './consumables'
import { logDefeat } from './dex'
import { burst, damageText, floatText } from './effects'
import { enemyScale, spawnEnemy } from './enemies'
import { recomputeTeam } from './leveling'
import { actAs, anchorPlayer, inPlay, nearestPlayer, playerWithin, present } from './players'
import {
  ALTAR, altarDuration, BOMB, CHEST, chestCoins, chestProgress, DIRECTOR, FADE, fleeHeading, FOUNTAIN, fountainSip,
  MEOWTH, MEOWTH_DEX, meowthSpeed, rollAltarBuff, SPIKES, spikePhase, spawnSpot, type SpikePhase,
} from './mapEventRules'
import { awardEgg, dropCoins, dropPickup } from './pickups'
import { touches } from './props'
import { isAlive } from './queries'
import { countNotice } from './tally'
import { clearSpot } from './terrain'
import type { Game } from './types'
import * as dm from '../engine/dmath'

/**
 * Points of interest the event director scatters around the player during a
 * run (altars, fountains, locked chests, traps, a fleeing Meowth).
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
}

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

export const createMapEvents = (): MapEventsState => ({ list: [], next: DIRECTOR.first })

const notify = (g: Game, notice: MapEventNotice) => {
  countNotice(g.tally, notice)
  g.events.push({ kind: 'mapEvent', notice })
}

const spend = (ev: { gone: number }) => {
  ev.gone = 0
}

/** Whether any player in play stands within `r` of (x, y) (plus their body radius when `body` is set). */
const within = (g: Game, x: number, y: number, r: number, body = false) => playerWithin(g, x, y, r, body) !== null

const neighbors: number[] = []

/**
 * Trap damage on everything within `r` of (x, y): wild Pokémon take `damage`
 * (bosses a slice of their max HP) and get shoved out, players take `playerShare` of their max HP.
 */
const trapHit = (g: Game, x: number, y: number, r: number, damage: number, bossShare: number, playerShare: number) => {
  for (const i of query(g.grid, x, y, r + 16, neighbors)) {
    const e = g.enemies[i]
    if (!e || !isAlive(e) || dm.sq(e.x - x) + dm.sq(e.y - y) > dm.sq(r + e.radius)) continue
    const dmg = Math.max(1, Math.round(e.boss ? e.maxHp * bossShare : damage))
    e.hp -= dmg
    e.flash = 0.2
    const away = dirTo(x, y, e.x, e.y)
    e.kx += (away.x * 160) / e.mass
    e.ky += (away.y * 160) / e.mass
    damageText(g, e, dmg, '#f8a040')
    if (e.hp <= 0) killEnemy(g, e)
  }
  hurtPlayers(g, (p) => dm.sq(p.x - x) + dm.sq(p.y - y) < dm.sq(r + p.radius), (p) => p.stats.maxHp * playerShare)
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

export const MAP_EVENTS: { [K in MapEventKind]: MapEventDef<K> } = {
  altar: {
    spawn: { from: 20, weight: () => 3, max: 1, lifetime: 50, distance: [150, 260] },
    marker: true,
    create: (g) => ({ buff: rollAltarBuff(g.rng, g.buffs) }),
    update: (g, ev) => {
      if (!within(g, ev.x, ev.y, ALTAR.radius, true)) return
      const { buff } = ev.state
      addBuff(g.buffs, buff, altarDuration(buff))
      recomputeTeam(g)
      burst(g, ev.x, ev.y - 14, { colors: ['#ffffff', '#f8e8a0', '#c8a8f8'], count: 40, speed: 110, ttl: 0.8, gravity: -80 })
      notify(g, { kind: 'altar', buff })
      spend(ev)
    },
  },
  fountain: {
    // Shows up more often when someone is hurt.
    spawn: { from: 60, weight: (g) => 1 + 3 * (1 - lowestHealth(g)), max: 1, lifetime: 60, distance: [150, 260] },
    marker: true,
    create: () => ({ charges: FOUNTAIN.charges, timer: 0, visited: false }),
    update: (g, ev, dt) => {
      // The one drinking: a hurt player at the fountain if any, else whoever stands there.
      const near = g.players.filter((q) => inPlay(q) && dm.sq(q.x - ev.x) + dm.sq(q.y - ev.y) < dm.sq(FOUNTAIN.radius + q.radius))
      const p = near.find((q) => q.hp < q.stats.maxHp - 0.5) ?? near[0] ?? g.player
      const s = ev.state
      if (!fountainSip(s, near.length > 0, p.hp < p.stats.maxHp - 0.5, dt)) return
      const heal = Math.round(actAs(g, p, () => healPlayer(g, p.stats.maxHp * FOUNTAIN.heal)))
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
      const inside = within(g, ev.x, ev.y, CHEST.radius)
      if (inside && !s.ambushed) {
        s.ambushed = true
        ambush(g, ev.x, ev.y)
        notify(g, { kind: 'chestAmbush' })
      }
      const before = s.progress
      s.progress = chestProgress(s.progress, inside, dt)
      if (s.progress > before && Math.floor(s.progress * 6) !== Math.floor(before * 6)) notify(g, { kind: 'chestTick' })
      if (s.progress > 0) ev.ttl = Math.max(ev.ttl, ev.age + 4)
      if (s.progress < 1) return
      const coins = chestCoins(g.time)
      dropCoins(g, ev.x, ev.y - 4, coins)
      dropPickup(g, ev.x + 8, ev.y, 'pokeball')
      dropItem(g, ev.x - 8, ev.y, rollDrop(DROP_TABLES.itemBall, g.time, g.rng))
      awardEgg(g, 'chest', ev.x, ev.y)
      burst(g, ev.x, ev.y - 8, { colors: ['#f8d030', '#fff8c0', '#ffffff', '#c08800'], count: 50, speed: 140, ttl: 0.8, gravity: 60 })
      g.shake = Math.max(g.shake, 3)
      notify(g, { kind: 'chestOpen', coins: coins.reduce((a, b) => a + b, 0) })
      spend(ev)
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
          within(g, ev.x, ev.y, BOMB.trigger, true) ||
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
      g.shake = Math.max(g.shake, 6)
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

/** Every ~30 s, maybe places a new event around the player: weighted by kind, never crowding the map. */
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
  const p = anchorPlayer(g, Math.floor(g.time))
  const spot = spawnSpot(g.rng, p.x, p.y, MAP_EVENTS[kind].spawn.distance, taken)
  if (!spot) return
  // Events stand on open ground, never in a lake or against a rock.
  const open = clearSpot(g, spot, 18)
  spawnMapEvent(g, kind, Math.round(open.x), Math.round(open.y))
}

/** Runs the director, every live event's interaction, and clears faded events and ones far from everyone. */
export const updateMapEvents = (g: Game, dt: number) => {
  direct(g)
  for (const ev of g.mapEvents.list) {
    ev.age += dt
    if (ev.gone >= 0) ev.gone += dt
    else tick(g, ev, dt)
  }
  retain(g.mapEvents.list, (ev) => ev.gone < FADE && g.players.some((p) => present(p) && Math.abs(ev.x - p.x) + Math.abs(ev.y - p.y) < DIRECTOR.despawn))
}

/** The lowest HP share among the players in play (1 when nobody is hurt). */
const lowestHealth = (g: Game) => {
  let low = 1
  for (const p of g.players) if (inPlay(p)) low = Math.min(low, p.hp / p.stats.maxHp)
  return low
}

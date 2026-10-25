import { dir8, dirTo, retain } from '../engine/math'
import { clearGrid, insert, query } from '../engine/spatial'
import { ENEMIES, type EnemyDef, type EnemyId } from '../data/enemies'
import { scaling } from '../data/waves'
import { STANCES } from '../data/bosses'
import { hordeScale, runMods } from './legend'
import { bodyOf } from '../data/bodies'
import { fightPace, steerBoss, type Steering } from './bossFight'
import { bumpDamage, hurtPlayer } from './combat'
import { leadTime } from './horde'
import { inView } from './queries'
import { isSpitter, spitBand, spitterStride } from './spitters'
import { CONFUSE_BUMP, CONFUSE_CONTACT, createStatus, isFrozen, statusAttack, statusPace } from './status'
import { enemyGroundPace } from './terrain'
import { createTraitState, isAirborne, traitPace } from './traits'
import { dungeonNav } from './dungeon'
import { underground } from './landmarks'
import { TRAITS } from '../data/traits'
import { actAs, nearestPlayer, nearestSeen, onAnyScreen, ownerOf, standing } from './players'
import { coopScale } from './coop'
import { COOP } from '../data/coop'
import type { DamageSource, Enemy, EnemyBehavior, Game } from './types'
import * as dm from '../engine/dmath'

const neighbors: number[] = []

/** Body radius derived from the sprite so big Pokémon take up more space. */
export const radiusFor = (dex: number) => Math.max(5, dm.round(bodyOf(dex).bodyW * 0.32))

/**
 * How much tougher than its base stats a regular enemy spawning now is: the
 * minutes played (`scaling`), the difficulty and, in the Legend mode, the
 * lifted horde's lean back (`hordeScale`, which sets its EXP too). Bosses only
 * take the difficulty's HP.
 */
export const enemyScale = (g: Game) => {
  const mods = runMods(g)
  const scale = scaling(g.time, mods.ramp)
  const horde = hordeScale(g)
  return { hp: scale.hp * mods.enemyHp * horde.hp, damage: scale.damage * horde.damage, xp: horde.xp }
}

export const spawnEnemy = (g: Game, kind: EnemyId, x: number, y: number, behavior: EnemyBehavior = { kind: 'chase' }) => {
  const def: EnemyDef = ENEMIES[kind]
  const boss = def.boss === true
  const mods = runMods(g)
  const scale = boss ? { hp: mods.enemyHp, damage: 1, xp: 1 } : enemyScale(g)
  // Co-op: the whole team hits it (`coopScale`; exactly 1 solo).
  const hp = dm.round(def.hp * scale.hp * coopScale(g, boss ? COOP.scale.bossHp : COOP.scale.hp))
  const enemy: Enemy = {
    id: g.nextId++,
    kind,
    types: def.types,
    x, y, kx: 0, ky: 0,
    hp, maxHp: hp,
    damage: def.damage * scale.damage,
    speed: def.speed * (boss ? 1 : mods.enemySpeed) * (0.92 + g.rng() * 0.16),
    mass: def.mass,
    radius: radiusFor(def.dex) * (def.scale ?? 1),
    xp: def.xp * scale.xp,
    boss,
    shiny: false,
    elite: false,
    runner: false,
    fight: null,
    bornAt: g.now,
    cooldowns: [],
    behavior,
    dir: 0,
    animTime: g.rng() * 2,
    flash: 0,
    status: createStatus(),
    trait: createTraitState(def.trait, g.rng()),
    dying: -1,
    fled: false,
    thrown: null,
    alpha: null,
  }
  g.enemies.push(enemy)
  return enemy
}

/** Knocks every regular enemy away from the players (Arceus descending, Mewtwo arriving), each from the one nearest to it. */
export const blastHorde = (g: Game, force: number) => {
  for (const e of g.enemies) {
    if (e.boss || e.dying >= 0) continue
    const p = nearestPlayer(g, e.x, e.y)
    const d = dirTo(p.x, p.y, e.x, e.y)
    e.kx += (d.x * force) / e.mass
    e.ky += (d.y * force) / e.mass
  }
}

export const rebuildGrid = (g: Game) => {
  clearGrid(g.grid)
  g.enemies.forEach((e, i) => {
    if (e.dying < 0) insert(g.grid, i, e.x, e.y)
  })
}

/** Pace of a foe that lost track of the player. */
const LOST_PACE = 0.55
/** A thrown foe stops hurting others once its knockback drops under this speed (px/s). */
const THROWN_MIN = 90

/** A thrown foe crashing into `o` (once per throw, passing some of its momentum), or a confused one bumping it. */
const bodyBlow = (g: Game, e: Enemy, o: Enemy) => {
  const t = e.thrown
  if (t) {
    if (t.hit.has(o.id)) return
    t.hit.add(o.id)
    o.kx += e.kx * 0.5 / o.mass
    o.ky += e.ky * 0.5 / o.mass
    return blowAs(g, t.by, o, t.damage, t.move)
  }
  if (e.status.bump > 0) return
  e.status.bump = CONFUSE_BUMP
  blowAs(g, e.status.confuse.by, o, e.damage * CONFUSE_CONTACT, e.status.confuse.move)
}

/** A body blow credited to the player at `slot` (who threw or confused the foe), as them. */
const blowAs = (g: Game, slot: number, o: Enemy, amount: number, move: DamageSource | null) => {
  const before = actAs(g, ownerOf(g, slot))
  bumpDamage(g, o, amount, move)
  actAs(g, before)
}

const FAINT_TIME = 0.4

/** Seconds a fleeing boss takes to glide off and fade out (`chaseOffBosses`). */
export const FLEE_TIME = 0.9

/** Removes an enemy without a faint: no EXP, no drop, gone at the end of this tick's `updateEnemies`. */
export const despawnEnemy = (e: Enemy) => {
  e.dying = FAINT_TIME
}

/** A linked boss's partner while it's in play (`BossFight.link`), for steering in tandem. */
const mateOf = (g: Game, e: Enemy) => {
  const link = e.fight?.link ?? -1
  if (link < 0) return null
  const mate = g.enemies.find((k) => k.id === link)
  return mate && mate.dying < 0 && !mate.fight?.down ? mate : null
}

/** Each player's way through the cave's corridors this tick, by slot (`dungeonNav`), reused every tick. */
const caveNavs: ReturnType<typeof dungeonNav>[] = []
/** Where a walker heads instead of the player (a dungeon's corridor), reused every tick. */
const waypoint = { x: 0, y: 0 }
/** Where a boss with phases heads (`steerBoss`), reused every tick. */
const steering: Steering = { x: 0, y: 0, pace: 1 }

/**
 * Moves the horde: each foe goes after the player nearest to it (or its own
 * errand), then bodies push apart, stay out of the players and hurt the ones
 * they touch.
 */
export const updateEnemies = (g: Game, dt: number) => {
  const recycleDist = dm.hypot(g.view.w, g.view.h) * 0.85
  // In the cave's dungeon, walkers follow the corridors toward their player instead of the wall between them (one map per player, by slot).
  const inside = g.place.inside
  const cave = inside?.id === 'cave' && inside.state.plan ? inside : null
  const plan = cave?.state.plan
  let navs: typeof caveNavs | null = null
  if (cave && plan) {
    navs = caveNavs
    navs.length = g.players.length
    for (let i = 0; i < g.players.length; i++) navs[i] = dungeonNav(plan, g.players[i]!.x - cave.x, g.players[i]!.y - cave.y)
  }
  const band = spitBand(g.view)
  // Knockback fades the same for everyone this tick.
  const damp = dm.exp(-9 * dt)

  for (const e of g.enemies) {
    if (e.dying >= 0) {
      e.dying += dt
      if (e.fled) {
        e.x += e.kx * dt
        e.y += e.ky * dt
      }
      continue
    }
    // A hidden teammate (Dig, a tunnel) is passed over for one the foe can see.
    const p = nearestSeen(g, e.x, e.y)
    const lost = underground(g, p)
    const nav = navs?.[p.slot] ?? null
    const frozen = e.status.stun > 0 || isFrozen(e.status)
    if (!frozen) e.animTime += dt
    e.flash = Math.max(0, e.flash - dt)
    const pace = e.speed * statusPace(e.status) * traitPace(e) * (e.flash > 0 ? 0.35 : 1) * enemyGroundPace(g, e)

    let vx = 0
    let vy = 0
    const confused = e.status.confuse.time > 0
    if (e.behavior.kind === 'chase' && (confused || p.hidden || lost)) {
      // Lost track of the player (confused, or the player burrowed or went into a tunnel): amble about.
      const h = e.status.heading + e.id * 2.4 + (confused ? 0 : g.now * 0.6)
      vx = dm.cos(h) * pace * LOST_PACE
      vy = dm.sin(h) * pace * LOST_PACE
    } else if (e.behavior.kind === 'chase') {
      // Runners head where the player is going; a boss in a fight walks at its stance's pace and a ranged one holds its distance;
      // a spitter walks into sight and holds its band, backing off from a player who comes close.
      let tx = p.x
      let ty = p.y
      let speed = pace
      if (e.runner) {
        const t = leadTime(dm.hypot(p.x - e.x, p.y - e.y), pace)
        tx += p.vx * t
        ty += p.vy * t
      } else if (e.fight && steerBoss(e.fight, e.kind, e, p, g.now, steering, mateOf(g, e))) {
        // A boss with phases moves as its phase says (`BossSteer`), or holds still through its scripts.
        tx = steering.x
        ty = steering.y
        speed = pace * steering.pace
      } else if (e.fight) {
        // It holds still through a phase's opening and its scripts (a dash, a dive) too.
        const hold = STANCES[e.fight.stance].hold
        const still = e.fight.shift > 0 || e.fight.motion !== null || (hold > 0 && dm.sq(p.x - e.x) + dm.sq(p.y - e.y) < hold * hold)
        speed = still ? 0 : pace * fightPace(e.fight)
      } else if (isSpitter(e)) {
        speed = pace * spitterStride(dm.hypot(p.x - e.x, p.y - e.y), inView(g, e.x, e.y, -TRAITS.spitter.inset), band)
      }
      if (nav && cave && nav(e.x - cave.x, e.y - cave.y, waypoint)) {
        tx = cave.x + waypoint.x
        ty = cave.y + waypoint.y
      }
      const d = dirTo(e.x, e.y, tx, ty)
      vx = d.x * speed
      vy = d.y * speed
    } else if (e.behavior.kind === 'raid') {
      // A raider walks to the nest and stays at the egg, unless the player comes close.
      const b = e.behavior
      const onPlayer = dm.sq(p.x - e.x) + dm.sq(p.y - e.y) < b.aggro * b.aggro && !p.hidden
      const tx = onPlayer ? p.x : b.x
      const ty = onPlayer ? p.y : b.y
      const atEgg = !onPlayer && dm.sq(b.x - e.x) + dm.sq(b.y - e.y) < dm.sq(e.radius + 4)
      const d = dirTo(e.x, e.y, tx, ty)
      vx = atEgg ? 0 : d.x * pace
      vy = atEgg ? 0 : d.y * pace
    } else {
      vx = frozen ? 0 : e.behavior.vx
      vy = frozen ? 0 : e.behavior.vy
      e.behavior.ttl -= dt
      if (e.behavior.ttl <= 0) despawnEnemy(e)
    }

    e.x += (vx + e.kx) * dt
    e.y += (vy + e.ky) * dt
    e.kx *= damp
    e.ky *= damp
    if (e.thrown && dm.sq(e.kx) + dm.sq(e.ky) < THROWN_MIN * THROWN_MIN) e.thrown = null
    // A spitter backing off keeps facing the player.
    if (Math.abs(vx) + Math.abs(vy) > 1) e.dir = isSpitter(e) && e.behavior.kind === 'chase' ? dir8(p.x - e.x, p.y - e.y) : dir8(vx, vy)

    // Wrap stragglers back in front of the player instead of letting them get lost (in co-op, never onto a teammate's screen).
    if (e.behavior.kind === 'chase' && !e.boss && Math.abs(e.x - p.x) + Math.abs(e.y - p.y) > recycleDist * 1.3) {
      const x = p.x + (p.x - e.x) * 0.7
      const y = p.y + (p.y - e.y) * 0.7
      if (g.coop === null || !onAnyScreen(g, x, y)) {
        e.x = x
        e.y = y
      }
    }
  }

  // Separation: overlapping enemies push each other apart so hordes form rings, not blobs.
  // A pass over the horde as it stood (as `forEach` walks it): a foe added meanwhile waits for the next tick.
  const horde = g.enemies
  const count = horde.length
  for (let i = 0; i < count; i++) {
    const e = horde[i]
    if (e === undefined || e.dying >= 0 || isAirborne(e)) continue
    for (const j of query(g.grid, e.x, e.y, e.radius * 2, neighbors)) {
      if (j === i) continue
      const o = g.enemies[j]!
      const dx = e.x - o.x
      const dy = e.y - o.y
      const min = (e.radius + o.radius) * 0.8
      const d2 = dx * dx + dy * dy
      // Most of a crowded cell is out of reach: that's settled before looking any closer.
      if (d2 >= min * min || o.dying >= 0 || isAirborne(o)) continue
      if (e.thrown || e.status.confuse.time > 0) bodyBlow(g, e, o)
      if (d2 === 0) continue
      const d = Math.sqrt(d2)
      const push = ((min - d) / d) * (o.mass / (e.mass + o.mass)) * 0.5
      e.x += dx * push
      e.y += dy * push
    }

    // Keep bodies out of the players and deal contact damage.
    for (const p of g.players) {
      if (!standing(g, p)) continue
      const dx = e.x - p.x
      const dy = e.y - p.y
      const reach = e.radius + p.radius
      const d2 = dx * dx + dy * dy
      if (!(d2 < reach * reach)) continue
      const d = Math.sqrt(d2) || 1
      e.x = p.x + (dx / d) * reach
      e.y = p.y + (dy / d) * reach
      const attack = statusAttack(e.status)
      if (attack <= 0) continue
      const before = actAs(g, p)
      hurtPlayer(g, e.damage * attack, e)
      actAs(g, before)
    }
  }

  retain(g.enemies, (e) => e.dying < (e.fled ? FLEE_TIME : FAINT_TIME))
}

import { dir8, dirTo, lerp, TAU } from '../engine/math'
import { range } from '../engine/rng'
import { query } from '../engine/spatial'
import { isSummoner, SUMMONS, TRAITS } from '../data/traits'
import { spawnHazard } from './bosses'
import { hurtPlayer, killEnemy } from './combat'
import { harmBy } from './harm'
import { spawnEnemy } from './enemies'
import { burst, damageText, shakeScreen } from './effects'
import { inView } from './queries'
import { finaleAlive } from './spawner'
import { fanOffset, flavorOf, isSpit, SPITTERS, volleySize, type SpitFlavor } from './spitters'
import { isHeld } from './status'
import {
  absorb,
  blastDamage,
  blastRadius,
  healAmount,
  HEALED_TIME,
  inBlast,
  isHealTarget,
  isWardTarget,
  onBeam,
  summonCount,
  wardAmount,
  type TraitAct,
} from './traits'
import { nearestPlayer, standing } from './players'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'

/**
 * Runs every enemy trait each tick (heal and ward pulses, summons, fuses,
 * beams, leaps, spit). Must run right after a grid rebuild: it queries the grid by
 * index and only appends to `g.enemies`, so indices stay valid all tick.
 */

const neighbors: number[] = []
/** A pulse with nobody to affect checks again this soon instead of waiting a full cooldown. */
const RETRY = 0.5

type Act<K extends TraitAct['kind']> = Extract<TraitAct, { kind: K }>

const onScreen = (g: Game, e: Enemy) => inView(g, e.x, e.y, -8)

/** Damage from a trait (blast), after wards. Fainting through here still drops EXP and items. */
const hurtEnemy = (g: Game, e: Enemy, amount: number, from: Enemy) => {
  const dmg = dm.round(absorb(e.trait, amount))
  const away = dirTo(from.x, from.y, e.x, e.y)
  e.kx += (away.x * 140) / e.mass
  e.ky += (away.y * 140) / e.mass
  e.flash = 0.16
  if (dmg <= 0) return
  e.hp -= dmg
  damageText(g, e, dmg, '#f8a048')
  if (e.hp <= 0) killEnemy(g, e)
}

const heal = (g: Game, e: Enemy, act: Act<'healer'>) => {
  let count = 0
  for (const i of query(g.grid, e.x, e.y, TRAITS.healer.radius, neighbors)) {
    const ally = g.enemies[i]
    if (!ally || !isHealTarget(e, ally)) continue
    ally.hp += healAmount(ally)
    ally.trait.healed = HEALED_TIME
    burst(g, ally.x, ally.y - ally.radius, { colors: ['#78e878', '#c8f8c8', '#ffffff'], count: 4, speed: 26, ttl: 0.5, gravity: -40 })
    count++
  }
  act.cooldown = count > 0 ? TRAITS.healer.every : RETRY
  if (count === 0) return
  act.cast = 0
  g.events.push({ kind: 'trait', trait: 'healer', phase: 'fire' })
}

const ward = (g: Game, e: Enemy, act: Act<'shield'>) => {
  let count = 0
  for (const i of query(g.grid, e.x, e.y, TRAITS.shield.radius, neighbors)) {
    const ally = g.enemies[i]
    if (!ally || !isWardTarget(e, ally)) continue
    ally.trait.ward = Math.max(ally.trait.ward, wardAmount(ally))
    ally.trait.wardTime = TRAITS.shield.duration
    count++
  }
  act.cooldown = count > 0 ? TRAITS.shield.every : RETRY
  if (count === 0) return
  act.cast = 0
  g.events.push({ kind: 'trait', trait: 'shield', phase: 'fire' })
}

const summon = (g: Game, e: Enemy, act: Act<'summoner'>) => {
  act.cooldown = TRAITS.summoner.every
  if (!isSummoner(e.kind)) return
  const alive = g.enemies.reduce((n, o) => n + (o.dying < 0 && o.trait.summoner === e.id ? 1 : 0), 0)
  const count = summonCount(alive)
  if (count === 0) return
  const pool = SUMMONS[e.kind]
  for (let i = 0; i < count; i++) {
    const a = range(g.rng, 0, TAU)
    const x = e.x + dm.cos(a) * (e.radius + 14)
    const y = e.y + dm.sin(a) * (e.radius + 8)
    const minion = spawnEnemy(g, pool[act.called++ % pool.length]!, x, y)
    minion.trait.summoner = e.id
    burst(g, x, y - 4, { colors: ['#c8a0e8', '#ffffff', '#9070b8'], count: 10, speed: 50, ttl: 0.4 })
  }
  act.cast = 0
  g.events.push({ kind: 'trait', trait: 'summoner', phase: 'fire' })
}

const explode = (g: Game, e: Enemy) => {
  const k = TRAITS.kamikaze
  const r = blastRadius(e.radius)
  const dmg = e.damage * k.damage
  const before = g.player
  for (const p of g.players) {
    g.player = p
    if (standing(g, p) && inBlast(e.x, e.y, r, p.x, p.y, p.radius * 0.7)) hurtPlayer(g, dmg, undefined, [], 'blast', harmBy(e))
  }
  g.player = before
  // Self-destruct: it faints without EXP, but whatever the blast takes down drops as usual.
  e.dying = 0
  e.hp = 0
  for (const i of query(g.grid, e.x, e.y, r + 24, neighbors)) {
    const o = g.enemies[i]
    if (o && o !== e && o.dying < 0 && inBlast(e.x, e.y, r, o.x, o.y, o.radius)) hurtEnemy(g, o, blastDamage(o, dmg), e)
  }
  burst(g, e.x, e.y - e.radius, { colors: ['#ffffff', '#f8e858', '#f87830', '#e83030'], count: 28, speed: r * 5, ttl: 0.45 })
  shakeScreen(g, 4, e)
  g.events.push({ kind: 'trait', trait: 'kamikaze', phase: 'fire' })
}

const fuse = (g: Game, e: Enemy, act: Act<'kamikaze'>, dt: number) => {
  const k = TRAITS.kamikaze
  const p = nearestPlayer(g, e.x, e.y)
  if (act.fuse < 0) {
    if (dm.hypot(p.x - e.x, p.y - e.y) - e.radius - p.radius > k.trigger) return
    act.fuse = 0
    g.events.push({ kind: 'trait', trait: 'kamikaze', phase: 'warn' })
    return
  }
  act.fuse += dt
  if (g.rng() < dt * 14) burst(g, e.x + range(g.rng, -e.radius, e.radius), e.y - e.radius * 2, { colors: ['#ffffff', '#f8e030'], count: 1, speed: 60, ttl: 0.15 })
  if (act.fuse >= k.fuse) explode(g, e)
}

const beam = (g: Game, e: Enemy, act: Act<'beam'>, dt: number) => {
  const b = TRAITS.beam
  if (act.phase === 'idle') {
    const p = nearestPlayer(g, e.x, e.y)
    act.cooldown -= dt
    if (act.cooldown > 0 || dm.sq(p.x - e.x) + dm.sq(p.y - e.y) > dm.sq(b.range) || !onScreen(g, e)) return
    // The aim locks now: the line on the ground is exactly where the beam will go.
    const oy = e.y - e.radius
    const aim = dirTo(e.x, oy, p.x, p.y - p.radius)
    act.phase = 'aim'
    act.t = 0
    act.ox = e.x
    act.oy = oy
    act.dx = aim.x
    act.dy = aim.y
    e.dir = dir8(aim.x, aim.y)
    g.events.push({ kind: 'trait', trait: 'beam', phase: 'warn' })
    return
  }
  act.t += dt
  if (act.phase === 'aim') {
    if (act.t < b.aim) return
    act.phase = 'fire'
    act.t = 0
    g.events.push({ kind: 'trait', trait: 'beam', phase: 'fire' })
  }
  const before = g.player
  for (const p of g.players) {
    g.player = p
    if (standing(g, p) && onBeam(act.ox, act.oy, act.dx, act.dy, b.length, b.width / 2, p.x, p.y - p.radius, p.radius * 0.7)) hurtPlayer(g, e.damage * b.damage, undefined, [], 'beam', harmBy(e))
  }
  g.player = before
  if (act.t >= b.fire) {
    act.phase = 'idle'
    act.cooldown = b.every
  }
}

const land = (g: Game, e: Enemy, act: Act<'leaper'>) => {
  const l = TRAITS.leaper
  const before = g.player
  for (const p of g.players) {
    g.player = p
    if (standing(g, p) && inBlast(act.toX, act.toY, l.radius, p.x, p.y, p.radius * 0.7)) hurtPlayer(g, e.damage * l.damage, e)
  }
  g.player = before
  burst(g, act.toX, act.toY, { colors: ['#c8b080', '#a08858', '#f0e0b8'], count: 16, speed: l.radius * 5, ttl: 0.4, drag: 6 })
  shakeScreen(g, 2, { x: act.toX, y: act.toY })
  act.phase = 'idle'
  act.cooldown = l.every
  g.events.push({ kind: 'trait', trait: 'leaper', phase: 'fire' })
}

const leap = (g: Game, e: Enemy, act: Act<'leaper'>, dt: number) => {
  const l = TRAITS.leaper
  if (act.phase === 'idle') {
    const p = nearestPlayer(g, e.x, e.y)
    act.cooldown -= dt
    if (act.cooldown > 0 || !onScreen(g, e)) return
    const d = dm.hypot(p.x - e.x, p.y - e.y)
    if (d < l.min || d > l.max) return
    // The landing spot locks now, where the player stands: the shadow marks it until touchdown.
    act.phase = 'crouch'
    act.t = 0
    act.toX = p.x
    act.toY = p.y
    e.dir = dir8(p.x - e.x, p.y - e.y)
    g.events.push({ kind: 'trait', trait: 'leaper', phase: 'warn' })
    return
  }
  act.t += dt
  if (act.phase === 'crouch') {
    if (act.t < l.crouch) return
    act.phase = 'air'
    act.t = 0
    act.fromX = e.x
    act.fromY = e.y
  }
  const k = Math.min(1, act.t / l.air)
  e.x = lerp(act.fromX, act.toX, k)
  e.y = lerp(act.fromY, act.toY, k)
  e.kx = 0
  e.ky = 0
  if (k >= 1) land(g, e, act)
}

/** Spit shots alive now, against `TRAITS.spitter.shots`. */
const spitShots = (g: Game) => {
  let n = 0
  for (const h of g.hazards) if (h.kind === 'shot' && isSpit(h)) n++
  return n
}

/**
 * A spitter's volley, aimed at where the player nearest to it stands: shots
 * fanned around the aim that fly `TRAITS.spitter.range`, or, with a puddle
 * (sludge), lobbed to that spot, where each leaves a puddle as it lands.
 */
const volley = (g: Game, e: Enemy, flavor: SpitFlavor) => {
  const s = TRAITS.spitter
  if (spitShots(g) >= s.shots) return
  const p = nearestPlayer(g, e.x, e.y)
  const tune = SPITTERS[g.difficulty]
  const aim = dm.atan2(p.y - e.y, p.x - e.x)
  const dist = Math.min(dm.hypot(p.x - e.x, p.y - e.y), s.range)
  const damage = e.damage * s.damage * tune.damage * flavor.damage
  const n = volleySize(flavor, tune.volley, g.rng())
  const by = harmBy(e)
  for (let i = 0; i < n; i++) {
    const a = aim + fanOffset(i, n, flavor.spread)
    const cos = dm.cos(a)
    const sin = dm.sin(a)
    const flight = (flavor.puddle ? dist : s.range) / flavor.speed
    spawnHazard(g, {
      kind: 'shot',
      visual: flavor.visual,
      x: e.x + cos * e.radius,
      y: e.y + sin * e.radius,
      vx: cos * flavor.speed,
      vy: sin * flavor.speed,
      r: flavor.radius,
      damage,
      ttl: flight,
      vanishOnHit: true,
      by,
    })
    if (!flavor.puddle) continue
    const ttl = flight + flavor.puddle.ttl
    spawnHazard(g, {
      kind: 'zone',
      visual: flavor.visual,
      x: e.x + cos * dist,
      y: e.y + sin * dist,
      r: flavor.puddle.radius,
      damage: damage * flavor.puddle.damage,
      armAt: flight,
      disarmAt: ttl - 0.3,
      ttl,
      by,
    })
  }
  g.events.push({ kind: 'trait', trait: 'spitter', phase: 'fire' })
}

/** Glows for its flavor's `charge` once a player is on screen and in reach, then spits. Holds fire during the finale's duel. */
const spit = (g: Game, e: Enemy, act: Act<'spitter'>, dt: number, duel: boolean) => {
  if (act.phase === 'idle') {
    const p = nearestPlayer(g, e.x, e.y)
    act.cooldown -= dt
    if (act.cooldown > 0 || duel || !onScreen(g, e) || dm.sq(p.x - e.x) + dm.sq(p.y - e.y) > dm.sq(TRAITS.spitter.reach)) return
    act.phase = 'charge'
    act.t = 0
    e.dir = dir8(p.x - e.x, p.y - e.y)
    g.events.push({ kind: 'trait', trait: 'spitter', phase: 'warn' })
    return
  }
  act.t += dt
  const flavor = flavorOf(e.types)
  if (act.t < flavor.charge) return
  volley(g, e, flavor)
  act.phase = 'idle'
  act.cooldown = SPITTERS[g.difficulty].every * (0.85 + g.rng() * 0.3)
}

const pulse = (g: Game, e: Enemy, act: Act<'healer' | 'shield' | 'summoner'>, dt: number) => {
  act.cast += dt
  act.cooldown -= dt
  if (act.cooldown > 0 || !onScreen(g, e)) return
  if (act.kind === 'healer') heal(g, e, act)
  else if (act.kind === 'shield') ward(g, e, act)
  else summon(g, e, act)
}

/** Seconds between two explainer toasts, so traits showing up together don't stack them. */
const INTRO_GAP = 4

/** One-time explainer toast the first time each trait is on screen. */
const introduce = (g: Game, e: Enemy, act: TraitAct) => {
  if (g.traits.seen.has(act.kind) || g.time < g.traits.nextIntro || !onScreen(g, e)) return
  g.traits.seen.add(act.kind)
  g.traits.nextIntro = g.time + INTRO_GAP
  g.events.push({ kind: 'traitIntro', enemy: e.kind, trait: act.kind })
}

export const updateTraits = (g: Game, dt: number) => {
  // Summons appended this tick start acting next tick.
  const count = g.enemies.length
  const duel = finaleAlive(g)
  for (let i = 0; i < count; i++) {
    const e = g.enemies[i]!
    const st = e.trait
    if (st.wardTime > 0 && (st.wardTime -= dt) <= 0) st.ward = 0
    st.wardHit += dt
    if (st.healed > 0) st.healed -= dt
    const act = st.act
    if (!act || e.dying >= 0) continue
    introduce(g, e, act)
    // Stunned, asleep or frozen enemies hold their trait, fuses included (paralysis and the Poké Flute pay off).
    if (e.status.stun > 0 || isHeld(e.status)) continue
    switch (act.kind) {
      case 'healer':
      case 'shield':
      case 'summoner':
        pulse(g, e, act, dt)
        break
      case 'kamikaze':
        fuse(g, e, act, dt)
        break
      case 'beam':
        beam(g, e, act, dt)
        break
      case 'leaper':
        leap(g, e, act, dt)
        break
      case 'spitter':
        spit(g, e, act, dt, duel)
        break
    }
  }
}

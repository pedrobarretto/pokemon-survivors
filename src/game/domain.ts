import { retain } from '../engine/math'
import { weightedPick } from '../engine/rng'
import { ARENA_FEET, type FloorPlan, type Pt } from '../data/arenas'
import { domainOf, DOMAIN_PRESS, type ArenaTransform, type LegendDomain, type ThreatKind } from '../data/domains'
import { ENEMIES } from '../data/enemies'
import { ARENAS, isRiftLegend, RIFT, type RiftLegend } from '../data/rifts'
import { onFloor } from './arenaFloor'
import { joinAs, offstage } from './bosses'
import { hurtPlayer, killEnemy } from './combat'
import { DOMAIN_HOOKS } from './domainHooks'
import { pairFighter, revealPartner, updatePair, type PairState } from './domainPair'
import {
  advanceFront, CAPTURE, composePlan, ENCOUNTER_LENGTH, encounterBeat, REVEAL_AT, threatGround, transformStage,
} from './domainRules'
import { burst, setScreenShake, shakeScreen, updateEffects } from './effects'
import { spawnEnemy } from './enemies'
import { riftLoot, riftScale, type RiftArena } from './rift'
import { exitArena, LAVA_BURN, riftWin } from './riftArena'
import { keepOnFloor, setAside } from './room'
import { rollShiny } from './shiny'
import { footOf, groundAt, inSolid, playerTypes, type Solid } from './terrain'
import { actAs, aimScreen, anchorPlayer, centerScreen, placeTeam, standing } from './players'
import type { Enemy, Game, Player } from './types'
import * as dm from '../engine/dmath'

/**
 * A legendary's domain (`data/domains.ts`), played inside a rift: the
 * crossing with its threat and retinue, the encounter scene, the battle in
 * phases with its arena transforms, and the capture scene before the loot.
 * The domain is a rift arena (`RiftArena.domain`), so the room rules (the
 * world set aside, falling out, the stopped clock) are the arena's.
 */

export type DomainAct = 'crossing' | 'encounter' | 'battle' | 'capture' | 'after'

/** A transform of the current phase (`ArenaTransform`) and whether it has landed. */
type Pending = { def: ArenaTransform; landed: boolean }

export type DomainState = {
  legend: RiftLegend
  act: DomainAct
  /** Seconds into the current act. */
  age: number
  /** The threat's front (domain y) and the front the floor was last laid with. */
  front: number
  laidFront: number
  /** Seconds until the threat bites again, and until the next retinue wave. */
  sting: number
  spawn: number
  /** The legendary (and its id once it shows), the phase the arena follows and seconds into it. */
  bossId: number
  phase: number
  phaseAge: number
  pending: Pending[]
  landed: ArenaTransform[]
  /** Seconds into the encounter or capture scene, which hold the world still. */
  scene: number
  /** The fallen legendary the capture scene plays on (and its partner, which gets a ball too), and whether its ball has settled. */
  capture: { kind: Enemy['kind']; x: number; y: number; shiny: boolean; settled: boolean; partner: { kind: Enemy['kind']; x: number; y: number; shiny: boolean } | null } | null
  /** Free numbers a legendary's hooks (`DomainHooks`) keep between ticks; each hook module names its slots. */
  memo: number[]
  /** The partner fighting beside the legendary (`LegendDomain.partner`), once it shows. */
  pair: PairState | null
}

const defOf = (d: DomainState): LegendDomain => domainOf(d.legend)!

/** A point of the arena (arena px) in world px. */
export const arenaPoint = (arena: RiftArena, d: DomainState, [x, y]: Pt) => {
  const at = defOf(d).arena.at
  return { x: arena.x + at[0] + x, y: arena.y + at[1] + y }
}

/** The domain the team is in, if any. */
export const domainHere = (g: Game) => {
  const arena = g.rift.arena
  return arena?.domain ? { arena, d: arena.domain, def: defOf(arena.domain) } : null
}

const solidsOf = (def: LegendDomain, x: number, y: number): Solid[] => {
  const at = def.arena.at
  const all = [...def.crossing.solids, ...def.arena.solids.map((s) => ({ ...s, x: s.x + at[0], y: s.y + at[1] }))]
  return all.map((s, i) => {
    const foot = ARENA_FEET[s.piece]
    return { kind: s.piece, x: x + s.x, y: y + s.y, variant: i, foot: [{ ...foot, x: x + s.x + foot.x, y: y + s.y + foot.y }] }
  })
}

/** How far ahead (north) the camera looks in the crossing, as a share of the view's height. */
const LOOK_AHEAD = 0.16

/** Sends the team into `legend`'s domain, its origin where the portal stood, at the crossing's start (side by side). */
export const enterDomain = (g: Game, legend: RiftLegend, x: number, y: number) => {
  const def = domainOf(legend)
  if (!def) return
  const shiny = rollShiny(g.rng, RIFT.shinyOdds)
  const stash = setAside(g)
  const { crossing } = def
  const d: DomainState = {
    legend,
    act: 'crossing',
    age: 0,
    front: crossing.threat.start,
    laidFront: crossing.threat.start,
    sting: 0,
    spawn: crossing.retinue.first,
    bossId: -1,
    phase: -1,
    phaseAge: 0,
    pending: [],
    landed: [],
    scene: 0,
    capture: null,
    memo: [],
    pair: null,
  }
  placeTeam(g, x + crossing.start[0], y + crossing.start[1])
  for (const p of g.players) {
    p.vx = 0
    p.vy = 0
  }
  for (const p of g.players) aimScreen(g, p, p.x - g.view.w / 2, p.y - 10 - g.view.h * (0.5 + LOOK_AHEAD))
  g.rift.arena = {
    legend,
    shiny,
    x,
    y,
    layout: composePlan(def, false, [], threatGround(crossing.threat, d.front)),
    terrain: { lake: null, solids: solidsOf(def, x, y) },
    weather: def.omen.weather,
    left: def.battleTime,
    age: 0,
    bossId: -1,
    loot: null,
    fall: null,
    stash,
    domain: d,
  }
  g.flash = 0.9
  setScreenShake(g, 9, 'team')
  g.events.push({ kind: 'riftEnter', enemy: legend, shiny })
}

/* ---------------- Crossing ---------------- */

/** Brings in a retinue wave just past the top of a player's screen (they take turns, `anchorPlayer`), on floor clear of scenery. */
const spawnRetinue = (g: Game, arena: RiftArena, def: LegendDomain) => {
  const r = def.crossing.retinue
  let alive = 0
  for (const e of g.enemies) if (e.dying < 0 && !e.boss) alive++
  const n = Math.min(r.count, r.max - alive)
  const screen = anchorPlayer(g).screen
  const row = screen.y - 18
  for (let i = 0; i < n; i++) {
    for (let tries = 0; tries < 8; tries++) {
      const x = screen.x + 12 + g.rng() * (g.view.w - 24)
      const y = row - g.rng() * 30
      if (!onFloor(arena.layout.floor, x - arena.x, y - arena.y, -10) || inSolid(g, x, y, 10)) continue
      const member = weightedPick(g.rng, r.members.map((m) => [m, m.weight] as const))
      const e = spawnEnemy(g, member.id, x, y)
      joinAs(g, e, member.role)
      break
    }
  }
}

/** The splash of the threat biting the player, by its look. */
const STING: Record<ThreatKind, readonly string[]> = {
  tide: ['#c8e8f8', '#58a8f8', '#ffffff'],
  collapse: ['#a08060', '#5a4030', '#ffffff'],
  fire: ['#f86818', '#f8e060', '#ffffff'],
  void: ['#c8a8f8', '#7850c8', '#ffffff'],
  magma: ['#f86818', '#f8e060', '#a02808'],
  crumble: ['#78b088', '#f8e070', '#ffffff'],
  storm: ['#c8d8e8', '#8ca4c8', '#ffffff'],
  time: ['#a8f0f8', '#d0f8ff', '#ffffff'],
  mist: ['#f8c8e0', '#ffffff', '#e8e0f8'],
}

/** The standing player furthest south in the crossing (the threat's front chases them), or furthest north (`lead`: the first to reach the gate). */
const endOfTeam = (g: Game, lead: boolean): Player => {
  let best = g.players[0]!
  for (const p of g.players) if (standing(g, p) && (lead ? p.y < best.y : p.y > best.y)) best = p
  return best
}

const crossingTick = (g: Game, arena: RiftArena, d: DomainState, def: LegendDomain, dt: number) => {
  const { threat, retinue } = def.crossing
  d.front = advanceFront(d.front, endOfTeam(g, false).y - arena.y, d.age, dt, threat)
  if (Math.abs(d.front - d.laidFront) >= 1) {
    d.laidFront = d.front
    arena.layout = composePlan(def, false, [], threatGround(threat, d.front))
  }
  // Behind the front the threat bites and carries the players on (one bite clock for everyone behind it).
  let behind = false
  for (const p of g.players) if (standing(g, p) && p.y - arena.y > d.front) behind = true
  if (behind) {
    d.sting -= dt
    const bite = d.sting <= 0
    if (bite) d.sting = threat.every
    for (const p of g.players) {
      if (!standing(g, p) || p.y - arena.y <= d.front) continue
      p.y -= threat.push * dt
      if (!bite) continue
      const before = actAs(g, p)
      hurtPlayer(g, p.stats.maxHp * threat.damage, undefined, [], 'hazard')
      actAs(g, before)
      burst(g, p.x, p.y - 4, { colors: STING[threat.kind], count: 8, speed: 70, ttl: 0.4, gravity: 120 })
    }
  } else d.sting = 0
  d.spawn -= dt
  if (d.spawn <= 0) {
    d.spawn += retinue.every
    spawnRetinue(g, arena, def)
  }
  DOMAIN_HOOKS[d.legend]?.crossing?.(g, d, dt)
  if (endOfTeam(g, true).y - arena.y < def.crossing.gate && arena.fall === null) startEncounter(g, arena, d, def)
}

/** A player reached the arena: the way back seals, the retinue is left behind, the team gathers at the arena's start and the encounter scene begins. */
const startEncounter = (g: Game, arena: RiftArena, d: DomainState, def: LegendDomain) => {
  d.act = 'encounter'
  d.age = 0
  d.scene = 0
  // Left behind at once: the scene holds the world still, so they couldn't fade out.
  g.enemies.length = 0
  g.hazards.length = 0
  arena.layout = composePlan(def, true, [])
  const start = arenaPoint(arena, d, def.arena.player)
  placeTeam(g, start.x, start.y)
  for (const p of g.players) {
    p.vx = 0
    p.vy = 0
  }
  shakeScreen(g, 7, 'team')
  g.events.push({ kind: 'quake' })
}

/* ---------------- Encounter and capture scenes ---------------- */


/** The legendary shows itself: it's brought in at its spot, with a flash, a jolt and its title card. */
const reveal = (g: Game, arena: RiftArena, d: DomainState, def: LegendDomain) => {
  const at = arenaPoint(arena, d, def.arena.boss)
  const boss = spawnEnemy(g, d.legend, at.x, at.y)
  const scale = riftScale(g.time)
  // The difficulty presses a legendary with its patterns (pace, telegraphs, damage) and with `DOMAIN_PRESS`.
  boss.hp = boss.maxHp = Math.round(ENEMIES[d.legend].hp * scale.hp * def.hp * DOMAIN_PRESS[g.difficulty].hp)
  boss.damage *= scale.damage * (def.touch ?? 1)
  boss.xp = riftLoot(g.time, arena.shiny).xp
  boss.shiny = arena.shiny
  d.bossId = arena.bossId = boss.id
  g.bossId = boss.id
  g.flash = 1
  setScreenShake(g, 12, 'team')
  const theme = ARENAS[d.legend]
  burst(g, at.x, at.y - 10, { colors: ['#ffffff', theme.wall[0], theme.motes], count: 90, speed: 220, ttl: 0.7, size: 2, gravity: 160 })
  if (def.partner) {
    const spot = arenaPoint(arena, d, def.partner.at)
    d.pair = revealPartner(g, def, boss, spot.x, spot.y, arenaPoint(arena, d, [0, 0]))
  }
  g.events.push({ kind: 'riftTitle', enemy: d.legend, shiny: arena.shiny })
  DOMAIN_HOOKS[d.legend]?.reveal?.(g, d, boss)
}

/**
 * Plays the encounter or capture scene with the world held still (the step
 * waits on it, like a Mega's transformation): it moves the camera itself.
 * True while one plays.
 */
export const updateDomainScene = (g: Game, dt: number) => {
  const here = domainHere(g)
  if (!here || here.arena.fall !== null) return false
  const { arena, d, def } = here
  if (d.act !== 'encounter' && d.act !== 'capture') return false
  const before = d.scene
  d.scene += dt
  updateEffects(g, dt)
  g.flash = Math.max(0, g.flash - dt * 1.5)
  if (d.act === 'encounter') {
    if (before < REVEAL_AT && d.scene >= REVEAL_AT) reveal(g, arena, d, def)
    const beat = encounterBeat(d.scene)
    // A pair is framed between its two spots.
    const [bx, by] = def.arena.boss
    const at = arenaPoint(arena, d, def.partner ? [(bx + def.partner.at[0]) / 2, (by + def.partner.at[1]) / 2] : def.arena.boss)
    // The ground rumbles harder as the legendary comes in.
    if (beat.entrance > 0 && beat.entrance < 1) shakeScreen(g, 2 + beat.entrance * 5, 'team')
    for (const p of g.players) centerScreen(g, p, p.x + (at.x - p.x) * beat.camera, p.y + (at.y - p.y) * beat.camera)
    if (d.scene >= ENCOUNTER_LENGTH) {
      d.act = 'battle'
      d.age = 0
    }
    return true
  }
  const c = d.capture!
  // On the legendary, a little low on screen so the news at the top doesn't cover it; the throw comes in from the player's side.
  for (const p of g.players) centerScreen(g, p, c.partner ? (c.x + c.partner.x) / 2 : c.x, (c.partner ? (c.y + c.partner.y) / 2 : c.y) - 50)
  if (before < CAPTURE.settle && d.scene >= CAPTURE.settle) {
    c.settled = true
    g.events.push({ kind: 'riftCapture', enemy: d.legend, shiny: c.shiny })
    if (c.partner && isRiftLegend(c.partner.kind)) g.events.push({ kind: 'riftCapture', enemy: c.partner.kind, shiny: c.partner.shiny })
  }
  if (d.scene < CAPTURE.length) return true
  d.act = 'after'
  d.age = 0
  riftWin(g, arena, c.x, c.y)
  return true
}

/**
 * The legendary fell for good: its adds go, and the capture scene plays where
 * it knelt (and the loot drops there). One that fell off the floor on its
 * script (hidden on a dive, out on a swoop's pass) kneels at its spot instead.
 */
const startCapture = (g: Game, arena: RiftArena, d: DomainState, boss: Enemy | undefined) => {
  const spot = boss && !offstage(boss) ? boss : arenaPoint(arena, d, defOf(d).arena.boss)
  const { x, y } = spot
  const mate = d.pair ? g.enemies.find((e) => e.id === d.pair!.partnerId) : undefined
  const partner = mate ? { kind: mate.kind, x: mate.x, y: mate.y, shiny: mate.shiny } : null
  d.capture = { kind: d.legend, x, y, shiny: arena.shiny, settled: false, partner }
  d.act = 'capture'
  d.scene = 0
  g.hazards.length = 0
  // Its hold on the arena ends with it: the flood drains, lava cools and the floor mends, so the loot can be picked up safely.
  d.pending = []
  d.landed = []
  arena.layout = composePlan(defOf(d), true, [])
  // The legendary's faint and its adds go at once: the scene holds the world still, and draws the legendary itself.
  g.enemies.length = 0
}

/* ---------------- Battle ---------------- */

/** The boss moved on to phase `phase`: its arena transforms are scheduled from now. */
const followPhase = (g: Game, d: DomainState, def: LegendDomain, boss: Enemy, phase: number) => {
  d.phase = phase
  d.phaseAge = 0
  d.pending = (def.phases[phase]?.arena ?? []).map((t) => ({ def: t, landed: false }))
  DOMAIN_HOOKS[d.legend]?.phase?.(g, d, boss, phase)
}

const battleTick = (g: Game, arena: RiftArena, d: DomainState, def: LegendDomain, dt: number) => {
  const boss = g.enemies.find((e) => e.id === d.bossId)
  if (!boss || boss.dying >= 0) {
    if (boss && DOMAIN_HOOKS[d.legend]?.fallen?.(g, d, boss)) return
    return startCapture(g, arena, d, boss)
  }
  arena.left -= dt
  if (arena.left <= 0) return exitArena(g, 'collapse')
  if (d.pair) {
    updatePair(g, d.pair, def, d.bossId, dt)
    if (boss.dying >= 0) return
  }
  // A pair's arena follows whichever of the two got furthest (a knocked-out one waits where it was).
  const mate = d.pair ? g.enemies.find((e) => e.id === d.pair!.partnerId) : undefined
  const phase = Math.max(boss.fight?.phase ?? 0, mate?.fight?.phase ?? 0)
  if (phase !== d.phase) followPhase(g, d, def, boss, phase)
  d.phaseAge += dt
  for (const t of d.pending) {
    if (t.landed || transformStage(t.def, d.phaseAge) !== 'landed') continue
    t.landed = true
    d.landed.push(t.def)
    arena.layout = composePlan(def, true, d.landed)
    shakeScreen(g, 7, 'team')
    g.events.push({ kind: 'quake' })
  }
  DOMAIN_HOOKS[d.legend]?.battle?.(g, d, boss, dt)
}

/**
 * One tick of the domain outside its scenes: the crossing's threat and
 * retinue, the battle's phases and transforms, everyone kept on the floor,
 * lava burning, and the loot window once the legendary is captured.
 */
export const updateDomain = (g: Game, arena: RiftArena, d: DomainState, dt: number) => {
  const def = defOf(d)
  d.age += dt
  if (d.act === 'crossing') crossingTick(g, arena, d, def, dt)
  else if (d.act === 'battle') battleTick(g, arena, d, def, dt)
  if (g.rift.arena !== arena || arena.fall !== null) return
  keepInDomain(g, arena.layout, arena)
  for (const p of g.players) {
    if (groundAt(g, p.x, p.y) !== 'lava') continue
    const before = actAs(g, p)
    if (!playerTypes(g).includes('fire')) hurtPlayer(g, p.stats.maxHp * (def.lavaBurn ?? LAVA_BURN), undefined, ['fire'], 'lava')
    actAs(g, before)
  }
  if (d.act !== 'after' || arena.loot === null) return
  for (const k of g.pickups) k.attracted = true
  arena.loot -= dt
  if (arena.loot <= 0) exitArena(g, 'won')
}

/** Keeps the players on the floor and out of its holes, walkers on the floor (the legendary and the retinue swim the holes), and breaks shots past its edge. */
const keepInDomain = (g: Game, plan: FloorPlan, arena: RiftArena) => {
  for (const p of g.players) keepOnFloor(p, arena, plan.floor, plan.holes ?? [], footOf(p))
  for (const e of g.enemies) if (e.dying < 0 && !offstage(e)) keepOnFloor(e, arena, plan.floor, [], e.boss ? e.radius * 0.5 : e.radius * 0.8)
  retain(g.hazards, (h) => h.kind !== 'shot' || h.phantom > 0 || onFloor(plan.floor, h.x - arena.x, h.y - arena.y, 6))
}

/* ---------------- Camera ---------------- */

/** How far from the view's edges a player always stays while their screen frames the legendary too, px (the HUD sits on top). */
const FRAME = { side: 44, top: 90, bottom: 44 } as const

/**
 * The acting player's screen in a domain (outside its scenes): ahead of them in the
 * crossing, and in the battle on the middle of the player and the
 * legendary, a little low so the HUD doesn't cover the legendary, but never
 * so far the player leaves the frame. It eases there; positions become whole
 * pixels only on screen (`render`).
 */
export const domainCamera = (g: Game, dt: number) => {
  const here = domainHere(g)
  if (!here) return false
  const { d } = here
  const p = g.player
  const { w, h } = g.view
  let x = p.x - w / 2
  let y = p.y - 10 - h / 2 - (d.act === 'crossing' ? h * LOOK_AHEAD : 0)
  const boss = d.act === 'battle' ? pairFighter(g, d.pair, d.bossId) : undefined
  if (boss && !offstage(boss)) {
    x = Math.max(p.x - (w - FRAME.side), Math.min(p.x - FRAME.side, (p.x + boss.x) / 2 - w / 2))
    y = Math.max(p.y - (h - FRAME.bottom), Math.min(p.y - FRAME.top, (p.y + boss.y) / 2 - h / 2 - 24))
  }
  const k = 1 - dm.exp(-5 * dt)
  const s = p.screen
  aimScreen(g, p, s.x + (x - s.x) * k, s.y + (y - s.y) * k)
  return true
}

/* ---------------- Dev ---------------- */

/**
 * Jumps the domain the player is in to an act (the dev console's
 * `ps.riftAct`): `encounter` seals the way and plays the scene, `battle`
 * skips it with the legendary already in, at the top of `phase` (from 1),
 * and `capture` knocks the legendary out for the capture scene.
 */
export const jumpToAct = (g: Game, act: 'crossing' | 'encounter' | 'battle' | 'capture', phase = 1) => {
  const here = domainHere(g)
  if (!here) return
  const { arena, d, def } = here
  if (act === 'crossing') return
  if (d.act === 'crossing') startEncounter(g, arena, d, def)
  if (act === 'encounter') return
  if (d.bossId < 0) reveal(g, arena, d, def)
  d.act = 'battle'
  d.age = 0
  const boss = g.enemies.find((e) => e.id === d.bossId)
  if (!boss) return
  const pair = d.pair ? g.enemies.filter((e) => e.id === d.bossId || e.id === d.pair!.partnerId) : [boss]
  // A jump skips the wait on the phase's ultimate (`BossPhase.hold`).
  for (const e of pair) if (e.fight) e.fight.ultDone = true
  if (act === 'capture') {
    for (const e of pair) {
      if (e.fight?.down && d.pair) Object.assign(e, { x: d.pair.x, y: d.pair.y })
      if (e.fight) Object.assign(e.fight, { phase: def.phases.length - 1, shift: 0, link: -1, down: false })
    }
    for (const e of [...pair].reverse()) killEnemy(g, e)
    return
  }
  const below = def.phases[phase - 1]?.below ?? 1
  for (const e of pair) {
    // From the phase before it, so the next tick enters `phase` with its opening.
    if (e.fight && phase >= 2) e.fight.phase = Math.max(e.fight.phase, phase - 2)
    e.hp = Math.max(1, Math.min(e.maxHp, e.maxHp * below - 1))
  }
}

/** What a domain plays: its crossing's theme until the legendary shows itself, then its own (`LegendDomain.music`). */
export const domainTheme = (d: DomainState) => {
  const def = defOf(d)
  return d.act === 'crossing' || (d.act === 'encounter' && d.scene < REVEAL_AT) ? def.crossing.theme : def.music
}

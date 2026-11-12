import { TAU, dirTo, fromAngle } from '../engine/math'
import * as dm from '../engine/dmath'
import { healPlayer } from './combat'
import { burst, floatText, shakeScreen } from './effects'
import { bonusApplies } from './kitRules'
import { recomputeStats } from './leveling'
import { nearestEnemy } from './queries'
import { barbCharge, barbsOnHurt, bubblesAt, currentBursts, driftAfter, guardStacks, hornReady, KIT_SC, scAt, waxMoon, type ScKit } from './scKitRules'
import { spawnAttack } from './spawn'
import type { Game, Player } from './types'

/**
 * Runs the Safári and Game Corner wave's family mechanics on `Player.kitSC`
 * (the rules and numbers are `scKitRules.ts`). `stepMoves` calls
 * `updateKitSC`, and `hurtPlayer`/`killEnemy` the small hooks below; for
 * anyone without a kit each is one check, so their runs stay bit-identical.
 */

type Kit<K extends ScKit['kind']> = Extract<ScKit, { kind: K }>

/** The player's power at their level, as the abilities and the special grow: what a kit's own hits are scaled by. */
const kitPower = (p: Player, power: number) => power * p.stats.might * (1 + 0.04 * (p.level - 1))

/* ---------------- Nidoran♀: Poison Point's barbs, Nidoqueen's guard ---------------- */

/** A ring of poison barbs flies out all round. */
const barbRing = (g: Game, kit: Kit<'barbs'>) => {
  const p = g.player
  const B = KIT_SC.barbs
  const count = scAt(B.count, p.stage)
  // Each ring turns half a step from the last, so the gaps never line up twice.
  const offset = (g.now * 7.3) % TAU
  for (let i = 0; i < count; i++) {
    const v = fromAngle(offset + (i / count) * TAU, B.speed)
    spawnAttack(g, {
      move: 'sludge', type: 'poison', visual: 'scQuill', x: p.x, y: p.y - 10,
      shape: { kind: 'circle', r: B.r * p.stats.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
      damage: kitPower(p, scAt(B.power, p.stage)), knockback: 30, pierce: 1, status: B.poison, ttl: B.ttl, mod: null,
    })
  }
  kit.charge = 0
  burst(g, p.x, p.y - 10, { colors: ['#c070e0', '#f0d0f8', '#583078'], count: 10, speed: 80, ttl: 0.3 })
  g.events.push({ kind: 'cast', move: 'sludge' })
}

/** Nidoqueen counts the poisoned foes around her now and then, and guards harder for each. */
const queenGuard = (g: Game, kit: Kit<'barbs'>, dt: number) => {
  const p = g.player
  const G = KIT_SC.barbs.guard
  kit.check += dt
  if (scAt(G.cap, p.stage) <= 0 || kit.check < G.every) return
  kit.check -= G.every
  let poisoned = 0
  const r2 = dm.sq(G.near)
  for (const e of g.enemies) if (e.dying < 0 && e.behavior.kind !== 'avatar' && dm.sq(e.x - p.x) + dm.sq(e.y - p.y) <= r2 && bonusApplies('poisoned', e)) poisoned++
  const next = guardStacks(poisoned, p.stage)
  if (next === kit.guard) return
  kit.guard = next
  recomputeStats(g)
}

const stepBarbs = (g: Game, kit: Kit<'barbs'>, dt: number) => {
  queenGuard(g, kit, dt)
  kit.charge = barbCharge(kit.charge, dt, g.player.stage)
  if (kit.charge >= 1) barbRing(g, kit)
}

/* ---------------- Nidoran♂: the horn charge ---------------- */

/** The charge: a horn-first dash through the horde, i-frames all the way. */
const hornCharge = (g: Game, kit: Kit<'horn'>, tx: number, ty: number) => {
  const p = g.player
  const H = KIT_SC.horn
  const d = dirTo(p.x, p.y, tx, ty)
  const speed = scAt(H.speed, p.stage)
  kit.dash = H.time
  kit.dx = d.x
  kit.dy = d.y
  p.iframes = Math.max(p.iframes, H.time + 0.08)
  spawnAttack(g, {
    move: 'furyAttack', type: 'poison', visual: 'scCharge', x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: scAt(H.r, p.stage) * p.stats.area }, motion: { kind: 'lunge', vx: d.x * speed, vy: d.y * speed, left: H.time },
    damage: kitPower(p, scAt(H.power, p.stage)), knockback: H.knockback, status: H.poison, ttl: H.time + 0.06, mod: null,
  })
  burst(g, p.x, p.y - 2, { colors: ['#d8c8a8', '#a89878'], count: 8, speed: 60, ttl: 0.35, gravity: 160 })
  g.events.push({ kind: 'cast', move: 'furyAttack' })
}

/** Nidoking's charge ends in a quake where it stops. */
const hornQuake = (g: Game) => {
  const p = g.player
  const Q = KIT_SC.horn.quake
  const r = scAt(Q.r, p.stage)
  if (r <= 0) return
  spawnAttack(g, {
    move: 'furyAttack', type: 'ground', visual: 'scQuake', x: p.x, y: p.y - 2,
    shape: { kind: 'circle', r: 8 }, motion: { kind: 'static' }, grow: (r * p.stats.area - 8) / 0.18,
    damage: kitPower(p, scAt(Q.power, p.stage)), knockback: Q.knockback, ttl: 0.36, activeUntil: 0.18, mod: null,
  })
  shakeScreen(g, 5)
  g.events.push({ kind: 'quake' })
}

const stepHorn = (g: Game, kit: Kit<'horn'>, dt: number) => {
  const p = g.player
  const H = KIT_SC.horn
  if (kit.dash > 0) {
    kit.dash -= dt
    if (kit.dash > 0) return
    kit.dash = 0
    kit.charge = scAt(H.every, p.stage)
    return hornQuake(g)
  }
  kit.charge = Math.max(0, kit.charge - dt)
  const target = kit.charge <= 0 ? nearestEnemy(g, p.x, p.y, scAt(H.reach, p.stage)) : null
  if (!hornReady(kit.charge, kit.dash, target !== null) || !target) return
  hornCharge(g, kit, target.x, target.y)
}

/* ---------------- Cleffa: the moon ---------------- */

/** Under the full moon, a moonbeam falls on a foe in view. */
const moonbeam = (g: Game) => {
  const p = g.player
  const M = KIT_SC.moon
  const near = g.enemies.filter((e) => e.dying < 0 && e.behavior.kind !== 'avatar' && dm.sq(e.x - p.x) + dm.sq(e.y - p.y) <= dm.sq(M.reach))
  const e = near.length > 0 ? near[Math.floor(g.rng() * near.length)]! : null
  if (!e) return
  const r = scAt(M.r, p.stage) * p.stats.area
  spawnAttack(g, {
    move: 'moonlight', type: 'fairy', visual: 'telegraph', x: e.x, y: e.y,
    shape: { kind: 'circle', r }, motion: { kind: 'static' }, damage: 0, ttl: 0.3, activeFrom: Infinity, mod: null,
  })
  spawnAttack(g, {
    move: 'moonlight', type: 'fairy', visual: 'scMoonbeam', x: e.x, y: e.y,
    shape: { kind: 'circle', r }, motion: { kind: 'static' },
    damage: kitPower(p, scAt(M.power, p.stage)), knockback: 30, age: -0.3, ttl: 0.34, activeUntil: 0.08, mod: null, tier: 2,
  })
}

const stepMoon = (g: Game, kit: Kit<'moon'>, dt: number) => {
  const p = g.player
  const M = KIT_SC.moon
  if (kit.full > 0) {
    kit.full -= dt
    kit.beam -= dt
    if (kit.beam <= 0) {
      kit.beam += scAt(M.beam, p.stage)
      moonbeam(g)
    }
    if (kit.full > 0) return
    kit.full = 0
    kit.fill = 0
    return recomputeStats(g)
  }
  kit.fill = waxMoon(kit.fill, dt, 0)
  if (kit.fill >= scAt(M.full, p.stage)) fullMoon(g, kit)
}

/** The moon turns full: its light falls on the field for a few seconds. */
const fullMoon = (g: Game, kit: Kit<'moon'>) => {
  const p = g.player
  kit.full = scAt(KIT_SC.moon.lasts, p.stage)
  kit.beam = 0
  recomputeStats(g)
  burst(g, p.x, p.y - 30, { colors: ['#fff8d8', '#f8e8a0', '#f8c8e0'], count: 24, speed: 90, ttl: 0.6, size: 2 })
  g.events.push({ kind: 'guard' })
}

/* ---------------- Phione: the warm current ---------------- */

/** Every few tenths of a second, each bubble circling Phione hits what it touches. */
const currentBubbles = (g: Game, kit: Kit<'current'>) => {
  const p = g.player
  const C = KIT_SC.current
  const n = bubblesAt(kit.drift)
  for (let i = 0; i < n; i++) {
    const a = kit.angle + (i / n) * TAU
    const o = fromAngle(a, C.orbit * p.stats.area)
    spawnAttack(g, {
      move: 'dive', type: 'water', visual: 'scHit', x: p.x + o.x, y: p.y - 8 + o.y * 0.7,
      shape: { kind: 'circle', r: C.r * p.stats.area }, motion: { kind: 'static' },
      damage: kitPower(p, C.power), knockback: 20, status: C.slow, ttl: 0.08, mod: null,
    })
  }
}

/** Phione stood still with the current up: the bubbles burst in a warm splash that heals it. */
const currentSplash = (g: Game, kit: Kit<'current'>) => {
  const p = g.player
  const S = KIT_SC.current.splash
  spawnAttack(g, {
    move: 'dive', type: 'water', visual: 'scSplash', x: p.x, y: p.y - 6,
    shape: { kind: 'circle', r: 8 }, motion: { kind: 'static' }, grow: (S.r * p.stats.area - 8) / 0.22,
    damage: kitPower(p, S.power * kit.drift), knockback: 110, ttl: 0.4, activeUntil: 0.22, mod: null, tier: bubblesAt(kit.drift),
  })
  const healed = healPlayer(g, p.stats.maxHp * S.heal * kit.drift)
  if (healed > 0.5) floatText(g, p.x, p.y - 28, `+${dm.round(healed)}`, '#68e868', true)
  burst(g, p.x, p.y - 8, { colors: ['#ffffff', '#a8e0f8', '#58a8e0', '#f8a8c0'], count: 22, speed: 120, ttl: 0.5, gravity: 120, size: 2 })
  g.events.push({ kind: 'heal' })
  kit.drift = 0
}

const stepCurrent = (g: Game, kit: Kit<'current'>, dt: number) => {
  const p = g.player
  const C = KIT_SC.current
  const walked = p.walked - kit.walked
  kit.walked = p.walked
  kit.still = walked > 0 ? 0 : kit.still + dt
  kit.drift = driftAfter(kit.drift, walked)
  const [lo, hi] = C.spin
  kit.angle = (kit.angle + (lo + (hi - lo) * kit.drift) * dt) % TAU
  if (currentBursts(kit.still, kit.drift)) return currentSplash(g, kit)
  kit.hit -= dt
  if (kit.hit > 0) return
  kit.hit += C.every
  currentBubbles(g, kit)
}

/** Per tick, for the acting player: the barbs, the horn, the moon and the current act. */
export const updateKitSC = (g: Game, dt: number) => {
  const kit = g.player.kitSC
  if (!kit) return
  switch (kit.kind) {
    case 'barbs': return stepBarbs(g, kit, dt)
    case 'horn': return stepHorn(g, kit, dt)
    case 'moon': return stepMoon(g, kit, dt)
    case 'current': return stepCurrent(g, kit, dt)
  }
}

/** A hit landed on the acting player (HP already taken): Poison Point fires the barbs early once they're half charged. */
export const kitSCHurt = (g: Game) => {
  const p = g.player
  const kit = p.kitSC
  if (kit?.kind !== 'barbs' || p.hp <= 0 || !barbsOnHurt(kit.charge)) return
  barbRing(g, kit)
}

/** A foe fell to the acting player: the moon waxes. */
export const kitSCKill = (g: Game) => {
  const p = g.player
  const kit = p.kitSC
  if (kit?.kind !== 'moon' || kit.full > 0) return
  kit.fill = waxMoon(kit.fill, 0, 1)
  if (kit.fill >= scAt(KIT_SC.moon.full, p.stage)) fullMoon(g, kit)
}

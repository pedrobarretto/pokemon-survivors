import { ENEMIES } from '../data/enemies'
import type { LegendDomain } from '../data/domains'
import { park } from './bosses'
import { createFight, phasesOf } from './bossFight'
import { killEnemy } from './combat'
import { burst, shakeScreen } from './effects'
import { spawnEnemy } from './enemies'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'

/**
 * Two legendaries fighting as one in a domain (`LegendDomain.partner`, Latias
 * and Latios). Their fights are linked (`BossFight.link`): one pool of HP, the
 * phases together. One whose own HP runs out is knocked out (`down`, parked out
 * of play, drawn kneeling where it fell) and the other fights on enraged; if
 * it isn't brought down in time it revives its partner, once. When both are
 * down they fall together, each its own defeat (`legendBeaten`), and the
 * capture scene throws a ball at each.
 */
export type PairState = {
  partnerId: number
  /** The one knocked out (its id, -1 while both stand), where it fell and how long ago. */
  down: number
  x: number
  y: number
  age: number
  /** The survivor's revival: used up, and seconds left on its warning while it casts (-1 otherwise). */
  revived: boolean
  casting: number
}

const byId = (g: Game, id: number) => g.enemies.find((e) => e.id === id && e.dying < 0)

/**
 * Brings the partner in at (x, y) beside `lead` (just revealed), scaled like
 * it and at its pace, both fights around the same `home` (the arena's center,
 * which they circle) and linked. Returns the pair's state.
 */
export const revealPartner = (g: Game, def: LegendDomain, lead: Enemy, x: number, y: number, home: { x: number; y: number }): PairState | null => {
  const partner = def.partner
  if (!partner) return null
  const e = spawnEnemy(g, partner.id, x, y)
  e.hp = e.maxHp = dm.round(ENEMIES[partner.id].hp * (lead.maxHp / ENEMIES[lead.kind].hp))
  e.damage = ENEMIES[partner.id].damage * (lead.damage / ENEMIES[lead.kind].damage)
  e.speed = lead.speed
  e.shiny = lead.shiny
  e.xp = 0
  lead.fight = createFight(g.rng, g.difficulty, { ...home })
  e.fight = createFight(g.rng, g.difficulty, { ...home })
  lead.fight.link = e.id
  e.fight.link = lead.id
  return { partnerId: e.id, down: -1, x: 0, y: 0, age: 0, revived: false, casting: -1 }
}

/** `e` was knocked out: it goes out of play where it fell, and `other` fights on enraged. */
const knockOut = (g: Game, pair: PairState, e: Enemy, other: Enemy) => {
  const f = e.fight!
  pair.down = e.id
  pair.x = e.x
  pair.y = e.y
  pair.age = 0
  pair.casting = -1
  f.down = true
  f.motion = null
  f.blast = null
  f.ult = null
  e.hp = 1
  park(e, f)
  other.fight!.enraged = true
  burst(g, pair.x, pair.y - 10, { colors: ['#ffffff', '#f86078', '#58a0f8'], count: 60, speed: 180, ttl: 0.6, size: 2 })
  shakeScreen(g, 8, 'team')
  g.flash = Math.max(g.flash, 0.4)
  g.events.push({ kind: 'pairDown', enemy: e.kind, partner: other.kind })
}

/** The survivor brings its partner back where it fell, with a share of its HP; it rejoins at the survivor's phase, with a roar. */
const revive = (g: Game, pair: PairState, def: LegendDomain, downed: Enemy, survivor: Enemy) => {
  const f = downed.fight!
  const rule = def.partner!.revive
  f.down = false
  downed.x = pair.x
  downed.y = pair.y
  downed.hp = Math.max(downed.hp, dm.round(downed.maxHp * rule.hp))
  // One phase back, so it steps into the survivor's own with its opening.
  f.phase = survivor.fight!.phase - 1
  survivor.fight!.enraged = false
  pair.down = -1
  pair.revived = true
  pair.casting = -1
  burst(g, pair.x, pair.y - 10, { colors: ['#ffffff', '#f8f0a0', '#98f8b0'], count: 80, speed: 200, ttl: 0.7, size: 2 })
  g.flash = Math.max(g.flash, 0.5)
  g.events.push({ kind: 'pairRevive', enemy: survivor.kind, partner: downed.kind })
}

/** Both are down: they fall together, each its own defeat, the downed one back where it fell. */
const fallTogether = (g: Game, pair: PairState, a: Enemy, b: Enemy) => {
  for (const e of [a, b]) {
    const f = e.fight!
    if (f.down) {
      e.x = pair.x
      e.y = pair.y
    }
    f.link = -1
    f.down = false
    f.shift = 0
    f.phase = (phasesOf(e.kind)?.length ?? 1) - 1
  }
  pair.down = -1
  killEnemy(g, b)
  killEnemy(g, a)
}

/**
 * One tick of a linked pair in the battle: knock out whoever ran out of HP
 * (both: they fall), count the knocked-out one's time down to the survivor's
 * revival and cast it, and hold the partner's own ultimate while the lead
 * stands (the lead's is the pair's).
 */
export const updatePair = (g: Game, pair: PairState, def: LegendDomain, leadId: number, dt: number) => {
  const lead = byId(g, leadId)
  const partner = byId(g, pair.partnerId)
  if (!lead?.fight || !partner?.fight) return
  for (const [e, other] of [[lead, partner], [partner, lead]] as const) {
    if (e.hp > 1 || e.fight!.down) continue
    if (other.fight!.down) return fallTogether(g, pair, lead, partner)
    knockOut(g, pair, e, other)
  }
  if (!lead.fight.down && partner.fight.ult === null) partner.fight.ultLeft = Math.max(partner.fight.ultLeft, 1)
  if (pair.down < 0) return
  pair.age += dt
  const rule = def.partner!.revive
  const downed = pair.down === lead.id ? lead : partner
  const survivor = downed === lead ? partner : lead
  if (!pair.revived && pair.casting < 0 && pair.age >= rule.after - rule.warn) {
    pair.casting = rule.warn
    g.events.push({ kind: 'bossUltimate', enemy: survivor.kind, move: rule.move })
  }
  if (pair.casting < 0) return
  pair.casting -= dt
  if (pair.casting <= 0) revive(g, pair, def, downed, survivor)
}

/** Which of a pair is in the fight now: the lead, unless it's knocked out. */
export const pairFighter = (g: Game, pair: PairState | null, leadId: number) => {
  const lead = g.enemies.find((e) => e.id === leadId)
  if (!pair || !lead?.fight?.down) return lead
  return g.enemies.find((e) => e.id === pair.partnerId)
}

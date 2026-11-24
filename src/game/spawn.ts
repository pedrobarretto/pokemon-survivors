import * as dm from '../engine/dmath'
import { NO_BONUS } from './kitRules'
import { createModState, stampMods } from './mods'
import type { Attack, Game } from './types'

type AttackInit = Pick<Attack, 'move' | 'type' | 'visual' | 'x' | 'y' | 'shape' | 'motion' | 'damage' | 'ttl'> & Partial<Attack>

/**
 * Creates a hitbox with sensible defaults. A negative `age` delays the attack:
 * it stays dormant (invisible, harmless) until its age crosses zero. It
 * carries the mods of the move being cast, if any (`Player.castMods`), and
 * belongs to the player acting (`Attack.owner`).
 */
export const spawnAttack = (g: Game, init: AttackInit) => {
  const attack: Attack = {
    id: g.nextId++,
    owner: g.player.slot,
    knockback: 0,
    pierce: Infinity,
    hitInterval: Infinity,
    hits: new Map(),
    age: 0,
    activeFrom: 0,
    activeUntil: Infinity,
    grow: 0,
    status: null,
    from: { x: init.x, y: init.y },
    flip: false,
    blast: 0,
    blastVisual: init.visual,
    turret: null,
    mod: createModState(g.player.castMods),
    bonus: NO_BONUS,
    execute: 0,
    drain: 0,
    pull: 0,
    trailer: null,
    sure: false,
    blind: 0,
    tier: 0,
    ignoreWards: false,
    memo: 0,
    ...init,
  }
  if (attack.mod) stampMods(attack)
  g.attacks.push(attack)
  return attack
}

/**
 * Patches of ground one move of one player keeps alive at once (a trail's,
 * `MOD.trail`, or a trailer's, `moveKit.trailer`) before the oldest gives way.
 * Five Fire Spin flames with the trail fork kept ~220 on the same ring, each
 * a hitbox of its own; landing on live ground now refreshes it instead
 * (`PATCH_OVERLAP`), so only ground spread wide gets near the cap.
 */
export const PATCH_CAP = 64

/** A patch landing this close to a live one of its move (× that one's radius) refreshes it instead of stacking. */
export const PATCH_OVERLAP = 0.5

/** Share of its life a patch must have burned before the cap may take it: one cast's fresh ground is never cut. */
export const PATCH_SPENT = 0.5

/** The most patches of a move kept alive at all, fresh or not. */
export const PATCH_CEILING = 4 * PATCH_CAP

/** What a patch still had to deal (its damage times the share of its life left), spread over `ttl`. */
const leftOver = (o: Attack, ttl: number) => (o.damage * Math.max(0, o.ttl - o.age)) / ttl

/**
 * Drops a patch of ground (`spawnAttack`, marked `ground`). Landing on a live
 * patch of its move (`PATCH_OVERLAP`), it refreshes that one instead, which
 * takes the new patch's life and damage plus what it had left to deal. Past
 * `PATCH_CAP` live, the oldest gives way once it has burned `PATCH_SPENT` of
 * its life (any, past `PATCH_CEILING`) and hands the new one what it had left,
 * so a build that blankets the ground deals what it did, with fewer hitboxes,
 * and a single cast's area (a Solar Beam's sweep) stays whole.
 */
export const dropPatch = (g: Game, init: AttackInit) => {
  const owner = g.player.slot
  let live = 0
  let oldest: Attack | null = null
  for (const o of g.attacks) {
    if (!o.ground || o.owner !== owner || o.move !== init.move || o.age >= o.ttl) continue
    if (o.shape.kind === 'circle' && dm.sq(o.x - init.x) + dm.sq(o.y - init.y) < dm.sq(o.shape.r * PATCH_OVERLAP)) {
      o.damage = init.damage + leftOver(o, init.ttl)
      o.age = 0
      o.ttl = init.ttl
      return o
    }
    live++
    if (oldest === null || o.age > oldest.age) oldest = o
  }
  const a = spawnAttack(g, init)
  a.ground = true
  if (oldest === null || live < PATCH_CAP || (oldest.age < oldest.ttl * PATCH_SPENT && live < PATCH_CEILING)) return a
  a.damage += leftOver(oldest, a.ttl)
  // Out at once: harmless for the rest of the tick, gone at its end.
  oldest.ttl = oldest.age
  oldest.activeUntil = -Infinity
  return a
}

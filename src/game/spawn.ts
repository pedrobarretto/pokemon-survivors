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
 * `MOD.trail`, or a trailer's, `moveKit.trailer`). Five Fire Spin flames with
 * the trail fork kept ~220 on the same ring, each a hitbox of its own;
 * builds short of that never reach the cap.
 */
export const PATCH_CAP = 64

/**
 * Drops a patch of ground (`spawnAttack`, marked `ground`). Past
 * `PATCH_CAP` of its move's, the oldest gives way and hands the new one what
 * it had left to deal (its damage times the share of its life still to go),
 * so a build that blankets the ground deals what it did, with fewer
 * hitboxes: the newest patches burn hotter and the oldest go out sooner.
 */
export const dropPatch = (g: Game, init: AttackInit) => {
  const a = spawnAttack(g, init)
  a.ground = true
  let live = 0
  let oldest: Attack | null = null
  for (const o of g.attacks) {
    if (o === a || !o.ground || o.owner !== a.owner || o.move !== a.move || o.age >= o.ttl) continue
    live++
    if (oldest === null || o.age > oldest.age) oldest = o
  }
  if (oldest === null || live < PATCH_CAP) return a
  a.damage += (oldest.damage * Math.max(0, oldest.ttl - oldest.age)) / a.ttl
  // Out at once: harmless for the rest of the tick, gone at its end.
  oldest.ttl = oldest.age
  oldest.activeUntil = -Infinity
  return a
}

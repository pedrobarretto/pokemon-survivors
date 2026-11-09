import * as dm from '../engine/dmath'
import type { Affliction, StatusSpec } from './status'
import type { MoveId } from './moves'

/**
 * Numbers and pure rules of Temporada 1's egg and fossil signatures
 * (`seasonOneEggMoves.ts`), one block per family, tested on their own
 * (`seasonOneEggRules.test.ts`).
 */

/** Snom's Powder Snow: the trail it leaves and the puff at each cast. */
export const SNOW = { every: 16, r: 13, ttl: 1.8, hitInterval: 0.5, share: 0.7, puff: 28 } as const

/** Joltik's Electroweb: how far the first web reaches, the hop between foes (× area) and the web left on each. */
export const WEB = { reach: 180, hop: 84, r: 9, ttl: 1.1, share: 0.35, hitInterval: 0.5 } as const

/** Salandit's Corrosive Gas: the cloud's reach, its size and how it lingers. */
export const GAS = { reach: 170, crowd: 40, r: 24, ttl: 1.3, hitInterval: 0.45 } as const

/** The move whose poison spreads when a poisoned foe falls. */
export const VENOM_MOVE: MoveId = 'corrosiveGas'

/** A fainting foe poisoned by `VENOM_MOVE` passes it to `jumps` foes within `reach`, each jump `decay` as strong, until it's under `floor` per second. */
export const VENOM = { jumps: 2, reach: 72, decay: 0.75, floor: 0.5, minTime: 2 } as const

/** What the poison on a fainting foe becomes when it jumps, or null when it's too weak to go on. */
export const venomJump = (poison: Pick<Affliction, 'time' | 'power'>): StatusSpec | null => {
  const power = poison.power * VENOM.decay
  return power < VENOM.floor ? null : { kind: 'poison', chance: 1, duration: Math.max(poison.time, VENOM.minTime), power }
}

/** Hatenna's Magic Coat: the mirror's radius, the shots a cast can send back, their least speed and the pulse at each cast. */
export const COAT = { r: 30, max: 8, minSpeed: 170, boost: 1.25, ttl: 1.6, pulse: 26, pulseGrow: 70 } as const

/** The velocity a reflected shot leaves with: straight back, faster, never slower than `COAT.minSpeed`. */
export const reflectedVelocity = (vx: number, vy: number) => {
  const speed = dm.hypot(vx, vy)
  if (speed === 0) return { vx: COAT.minSpeed, vy: 0 }
  const k = Math.max(COAT.minSpeed, speed * COAT.boost) / speed
  return { vx: -vx * k, vy: -vy * k }
}

/** Applin's Apple Acid: how far it's lobbed and how long it flies; Flapple's are sharper, Appletun's bigger. */
export const APPLE = {
  reach: 210, lob: 0.42, r: 16,
  flapple: { damage: 1.25, area: 0.85 },
  appletun: { damage: 0.85, area: 1.35 },
} as const

/** Frigibax's Breaking Swipe: the fan's step between shards and how much they brake. */
export const SWIPE = { reach: 220, step: 0.2, drag: 2.6 } as const

/** Cranidos's Head Smash: the charge, and the HP it costs on landing (a share of max HP, never the last point). */
export const SMASH = { reach: 170, length: 120, time: 0.26, recoil: 0.04, retry: 0.35 } as const

/** Shieldon's Iron Defense: the shield's contact share, and how much each point of armor adds to the answer. */
export const SHIELD = { r: 20, share: 0.3, hitInterval: 0.5, perArmor: 0.12, retry: 0.5, wave: 18, waveGrow: 150 } as const

/** How much a retaliation hits for at `armor` (armor below 0 adds nothing). */
export const shieldAnswer = (damage: number, armor: number) => damage * (1 + Math.max(0, armor) * SHIELD.perArmor)

/** Archen's Dual Wingbeat: how far it strikes, the gap between wings, and the burst of speed that carries it away. */
export const WING = { reach: 100, gap: 0.1, haste: 0.22, seconds: 1.1 } as const

/** Tyrunt's Bite: its reach and how much each mark already on the foe adds. Marks stop at 3 (`STATUS_RULES.mark`). */
export const BITE = { reach: 56, perStack: 0.4, retry: 0.3 } as const

/** How hard a bite lands on a foe already holding `stacks` marks. */
export const biteMult = (stacks: number) => 1 + BITE.perStack * Math.min(3, stacks)

/** Amaura's Aurora Veil: the field's base radius and the most it may reach however big the area gets (never the whole screen). */
export const VEIL = { r: 62, maxR: 104, maxFreeze: 0.3, hitInterval: 0.6, slow: { kind: 'slow', chance: 1, duration: 1.2, power: 0.3 } } as const

export const veilRadius = (area: number) => Math.min(VEIL.maxR, VEIL.r * area)

/** The veil's freeze chance, held to `VEIL.maxFreeze` whatever items add. */
export const veilFreeze = (chance: number) => Math.min(VEIL.maxFreeze, chance)

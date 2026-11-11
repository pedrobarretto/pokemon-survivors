import * as dm from '../engine/dmath'
import type { PokeType } from '../data/types'
import type { BranchId } from '../data/branches'
import type { StatusSpec } from './status'

/**
 * Numbers and pure rules of the regional forms' moves (`regionalMoves.ts`),
 * kept apart so they can be tested without a running game.
 */

/** Metal Claw: how far it reaches for a foe, and each sharpened claw's extra damage (stacks of hits taken without being hurt). */
export const CLAW = { reach: 46, retry: 0.25, per: 0.08, max: 6 } as const

/** Metal Claw's hit after `stacks` hits in a row without the player being hurt. */
export const clawMult = (stacks: number) => 1 + CLAW.per * Math.max(0, Math.min(CLAW.max, stacks))

/** Shell Side Arm: within `near` px it slams with the shell, farther it spits a poison bolt that flies `speed` px/s. */
export const SHELL = { near: 44, reach: 190, speed: 190, slam: 1.35, retry: 0.3 } as const

/** Which side Shell Side Arm strikes with: the shell up close, the poison from afar. */
export const shellSide = (distance: number): 'slam' | 'shot' => (distance <= SHELL.near ? 'slam' : 'shot')

/** Obstruct: the guard's share of the cooldown at most, the X's reach and the Defense it breaks (a mark per hit). */
export const OBSTRUCT = { retry: 0.3, r: 46, grow: 70, mark: { kind: 'mark', chance: 1, duration: 4, power: 0.2 } } as const satisfies { retry: number; r: number; grow: number; mark: StatusSpec }

/** Meteor Assault: the leek joust's length and time, and the recharge after it (speed lost for that long). */
export const JOUST = { reach: 150, length: 118, time: 0.26, r: 11, recharge: 0.5, slow: 0.45, retry: 0.3 } as const

/** Chloroblast: the blast's radius and what it costs (a share of max HP, never the last point) when it lands on something. */
export const CHLORO = { r: 44, recoil: 0.05 } as const

/** Poison Sting: barbs fly out all round; Overqwil (the second stage) sprouts more, and poisoned foes take more from them. */
export const BARBS = { speed: 170, ttl: 0.6, r: 4, evolved: 4, poisoned: 1.5 } as const

/** How many barbs a Poison Sting fires at `stage` of the line, with `amount` from levels and items. */
export const barbCount = (amount: number, stage: number) => Math.max(1, dm.round(amount)) + (stage >= 1 ? BARBS.evolved : 0)

/** Toxic: a pool thrown at the thickest crowd; every tick on it adds a poison stack, so the longer they stay the worse it gets. A foe that falls with `chain` stacks or more passes it on. */
export const TOXIC = { reach: 170, r: 26, ttl: 3.4, hitInterval: 0.5, flight: 0.3, chain: 3 } as const

/** Whether a fainting foe's poison jumps on as Toxic's chain: it's Toxic's, and badly enough (`TOXIC.chain` stacks). */
export const toxicSpreads = (poison: { move: string | null; stacks: number }) => poison.move === 'toxic' && poison.stacks >= TOXIC.chain

/** Raging Bull: the charge's reach, length and time; its hit on a boss or elite breaks through harder. */
export const BULL = { reach: 140, length: 92, time: 0.24, r: 13, boss: 1.3, retry: 0.3 } as const

/**
 * Raging Bull's type and what it inflicts, by Paldean Tauros' breed (its
 * branch): Combat's own Fighting, Blaze's burn, Aqua's soaking push.
 */
export const bullBreed = (branch: BranchId | null): { type: PokeType; status: StatusSpec | null } => {
  if (branch === 'taurosBlaze') return { type: 'fire', status: { kind: 'burn', chance: 0.5, duration: 3, power: 0.35 } }
  if (branch === 'taurosAqua') return { type: 'water', status: { kind: 'slow', chance: 0.6, duration: 1.5, power: 0.4 } }
  return { type: 'fighting', status: null }
}

/** Bitter Malice: a spiteful chill on the thickest crowd within `reach`; it saps their strength (weaken) and slows, and hits the afflicted harder. */
export const MALICE = {
  reach: 150, r: 30, afflicted: 1.4,
  weaken: { kind: 'weaken', chance: 1, duration: 3, power: 0.4 },
  slow: { kind: 'slow', chance: 1, duration: 1.6, power: 0.35 },
} as const satisfies { reach: number; r: number; afflicted: number; weaken: StatusSpec; slow: StatusSpec }

/** Aurora Veil in the snow (the only weather it works in, in the games): wider and harder. */
export const VEIL_SNOW = { area: 1.25, damage: 1.3 } as const

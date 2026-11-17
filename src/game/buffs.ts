import { BUFFS, type BuffId } from '../data/consumables'
import type { StatDelta } from './stats'
import type { Buff } from './types'

/**
 * Starts a buff, or extends a running one: the pickup's duration on top of
 * what's left, capped at twice it, and never shorter than it was (a bottle
 * over an altar's longer stack keeps the stack).
 */
export const addBuff = (buffs: Buff[], id: BuffId, duration: number) => {
  const running = buffs.find((b) => b.id === id)
  if (!running) return void buffs.push({ id, left: duration, total: duration })
  running.left = Math.max(running.left, Math.min(running.left + duration, duration * 2))
  running.total = Math.max(running.total, running.left)
}

/** Counts every buff down and removes the expired ones. Returns their ids. */
export const tickBuffs = (buffs: Buff[], dt: number): BuffId[] => {
  const expired: BuffId[] = []
  for (const b of buffs) b.left -= dt
  for (let i = buffs.length - 1; i >= 0; i--) {
    if (buffs[i]!.left > 0) continue
    expired.push(buffs[i]!.id)
    buffs.splice(i, 1)
  }
  return expired
}

export const hasBuff = (buffs: readonly Buff[], id: BuffId) => buffs.some((b) => b.id === id)

/** Stat deltas of the active buffs, folded into the player stats by `recomputeStats`. */
export const buffDeltas = (buffs: readonly Buff[]): StatDelta[] => buffs.map((b) => BUFFS[b.id].stats)

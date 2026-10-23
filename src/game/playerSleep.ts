import { burst } from './effects'
import type { Game, Player } from './types'

/**
 * A player put to sleep (Darkrai's Dark Void, a `sleep` pattern in
 * `data/bosses.ts`): for a moment they can't walk, cast, use their special or
 * Mega Evolve (`stepPlayer`, `stepMoves` in `game.ts`), then a drowsy spell
 * keeps another orb from putting them straight back to sleep. Plain numbers on
 * `Player.asleep`, so co-op snapshots carry it.
 */
export const SLEEP = {
  /** Seconds after waking during which nothing puts them back to sleep. */
  drowsy: 2.2,
} as const

/** Whether player `p` is asleep right now. */
export const isAsleep = (p: Pick<Player, 'asleep'>) => p.asleep > 0

/** Puts player `p` to sleep for `seconds`, unless they're asleep already or still drowsy from the last time. */
export const sleepPlayer = (g: Game, p: Player, seconds: number) => {
  if (p.asleep !== 0 || seconds <= 0) return
  p.asleep = seconds
  p.vx = 0
  p.vy = 0
  burst(g, p.x, p.y - 16, { colors: ['#b8a0f8', '#58e8f0', '#ffffff'], count: 10, speed: 40, ttl: 0.6, gravity: -40 })
  g.events.push({ kind: 'playerSleep' })
}

/** Ticks player `p`'s sleep: asleep counts down to the drowsy spell, which counts back up to awake. */
export const tickSleep = (p: Player, dt: number) => {
  if (p.asleep > 0) p.asleep = p.asleep - dt > 0 ? p.asleep - dt : -SLEEP.drowsy
  else if (p.asleep < 0) p.asleep = Math.min(0, p.asleep + dt)
}

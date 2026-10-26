import { areaStart, FORK } from '../data/biomes'
import { forceFork, runPlan, takeFork } from '../game/route'
import type { Game } from '../game/types'

/**
 * The dev console's `ps.route` (dev builds only): with no command it prints
 * the route (the biomes decided, the plan with the seed's defaults, the fork
 * on the map); `'fork'` puts the next fork's gates up near the player now,
 * `'take'` takes gate `i` (0 is the default), and `'next'` moves the run clock
 * to a second before the next fork goes up on its own.
 */
export const devRoute = (g: Game, cmd?: 'fork' | 'take' | 'next', i = 0) => {
  const r = g.route
  if (cmd === 'fork') return forceFork(g)
  if (cmd === 'take') {
    if (!r.fork || r.fork.chosen >= 0) forceFork(g)
    takeFork(g, i)
    return r.fork
  }
  if (cmd === 'next') {
    g.time = Math.max(g.time, areaStart(r.path.length) - FORK.lead - 1)
    return g.time
  }
  return { path: [...r.path], planned: runPlan(r), fork: r.fork }
}

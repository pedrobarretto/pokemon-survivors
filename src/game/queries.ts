import { onAnyScreen } from './players'
import type { Enemy, Game } from './types'
import { unseen } from './versusRules'
import { focusedEnemy } from './versusKit'
import * as dm from '../engine/dmath'

export const isAlive = (e: Enemy) => e.dying < 0

/**
 * Nearest living enemy within `maxDist`, optionally skipping ids already
 * targeted (and, in Versus, the acting player's own team and the rivals hidden
 * in grass). An Arena cast aims it (`focusedEnemy`): its target, or nobody.
 */
export const nearestEnemy = (g: Game, x: number, y: number, maxDist: number, exclude?: ReadonlySet<number>) => {
  const focused = g.player.versus?.focus ? focusedEnemy(g, x, y, maxDist, exclude) : undefined
  if (focused !== undefined) return focused
  let best: Enemy | null = null
  let bestD = maxDist * maxDist
  for (const e of g.enemies) {
    if (!isAlive(e) || exclude?.has(e.id) || unseen(g, e)) continue
    const d = dm.sq(e.x - x) + dm.sq(e.y - y)
    if (d < bestD) {
      bestD = d
      best = e
    }
  }
  return best
}

/** Whether (x, y) shows on some player's screen, grown by `margin` px (shrunk when negative): what the world checks. */
export const inView = (g: Game, x: number, y: number, margin = 0) => onAnyScreen(g, x, y, margin)

/** Whether (x, y) shows on the acting player's screen, grown by `margin` px: their moves and items aim at what they see. */
export const inSight = (g: Game, x: number, y: number, margin = 0) => {
  const s = g.player.screen
  return x > s.x - margin && x < s.x + g.view.w + margin && y > s.y - margin && y < s.y + g.view.h + margin
}

/** Living foes on the acting player's screen (a little inside its edges; in Versus, not its own team nor the rivals hidden in grass). */
export const enemiesInView = (g: Game) => g.enemies.filter((e) => isAlive(e) && !unseen(g, e) && inSight(g, e.x, e.y, -8))

import { COOP } from '../data/coop'
import { burst } from './effects'
import { actAs, inPlay, playerWithin, teamSize } from './players'
import type { Game, Player } from './types'

/**
 * Co-op rules (2 to 4 players in one run): the horde scales with the team,
 * candies are shared, a fainted player waits for a teammate to stand by them,
 * and the run ends only when nobody is left standing. Level-ups wait for the
 * whole team, with a timer (`pickTime`) so nobody holds the others forever.
 * Solo runs (`g.coop === null`) never take these paths.
 */

export type CoopState = {
  /** Seconds left to pick this round of level-ups (counts only while the team is picking). */
  pickLeft: number
}

export const createCoop = (): CoopState => ({ pickLeft: 0 })

/** A co-op multiplier: 1 + `per` for each teammate past the first (1 solo). */
export const coopScale = (g: Game, per: number) => (g.coop ? 1 + per * Math.max(0, teamSize(g) - 1) : 1)

/** Ends the run when nobody is standing: everyone fainted or left. */
export const checkWipe = (g: Game) => {
  if (g.phase === 'gameover' || g.phase === 'victory' || g.players.some(inPlay)) return
  g.phase = 'gameover'
  g.events.push({ kind: 'gameover' })
}

/** A co-op player's HP ran out: they lie fainted until a teammate revives them (`updateRevives`). Run as them (`actAs`). */
export const faint = (g: Game, p: Player) => {
  p.hp = 0
  p.down = { revive: 0 }
  p.moving = false
  p.vx = 0
  p.vy = 0
  burst(g, p.x, p.y - 10, { colors: ['#f83838', '#ffffff', '#202028'], count: 24, speed: 90, ttl: 0.5 })
  g.events.push({ kind: 'fainted' })
  checkWipe(g)
}

/** A player left the room for good: out of play (their slot stays, empty). */
export const leaveRun = (g: Game, p: Player) => {
  if (p.gone) return
  p.gone = true
  p.pendingLevelUps = 0
  p.offers = []
  p.evolution = null
  actAs(g, p, () => g.events.push({ kind: 'left' }))
  checkWipe(g)
}

/** Standing next to a fainted teammate fills their revive; walking off drains it. */
export const updateRevives = (g: Game, dt: number) => {
  const r = COOP.revive
  for (const p of g.players) {
    if (p.gone || !p.down) continue
    const helper = playerWithin(g, p.x, p.y, r.radius + p.radius)
    p.down.revive = helper ? p.down.revive + dt : Math.max(0, p.down.revive - dt * r.decay)
    if (p.down.revive < r.time) continue
    p.down = null
    p.hp = Math.round(p.stats.maxHp * r.hp)
    p.iframes = r.iframes
    burst(g, p.x, p.y - 10, { colors: ['#f8d830', '#fff8c0', '#ffffff', '#58e858'], count: 40, speed: 120, ttl: 0.8, gravity: -40 })
    actAs(g, p, () => g.events.push({ kind: 'revived' }))
  }
}

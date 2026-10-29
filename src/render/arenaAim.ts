import { blitRing } from '../engine/pixelart'
import { TYPE_COLORS } from '../data/types'
import { VERSUS_KIT } from '../data/versus'
import { MOVES } from '../game/moves'
import { gameSpecial } from '../game/special'
import { aimable, aimableById, autoTarget, type Skill } from '../game/versusKit'
import type { Enemy, Game, Player } from '../game/types'
import { lockOnArt } from './art'

/**
 * The Arena's aim on the world (the controls are `ui/arenaControls.ts`): the
 * lock-on's brackets and pin on the locked target, a lighter pin on the one
 * the basic attack picks without a lock, and while a touch button drags, the
 * skill's reach, the path its aim takes and where it lands (the foe it would
 * snap to bracketed), all grey while the thumb is back over its button (let
 * go: no cast). Drawn in world px, snapped to whole pixels.
 */

/** A drag's aim: the way it points (CSS px), `share` of the reach out, and whether letting go cancels. */
export type ArenaAimView = { skill: Skill; dx: number; dy: number; share: number; cancel: boolean }
/** What the controls show this frame: a drag's aim (or none) and this screen's lock (-1 none). */
export type ArenaOverlay = { aim: ArenaAimView | null; lock: number }

const LOCK = '#f84848'
const AUTO = '#f8f8f8'
const CANCEL = '#8890a0'

/** The brackets around `e`'s body (and its pin, unless `bare`), breathing a pixel in and out. */
const bracket = (ctx: CanvasRenderingContext2D, e: Enemy, color: string, t: number, bare = false) => {
  const art = lockOnArt(color)
  const cx = Math.round(e.x)
  const cy = Math.round(e.y - e.radius)
  const half = Math.round(e.radius + 5 + (Math.floor(t * 4) % 2))
  const [tl, tr, bl, br] = art.corners
  const s = tl.width
  ctx.drawImage(tl, cx - half, cy - half)
  ctx.drawImage(tr, cx + half - s + 1, cy - half)
  ctx.drawImage(bl, cx - half, cy + half - s + 1)
  ctx.drawImage(br, cx + half - s + 1, cy + half - s + 1)
  if (!bare) ctx.drawImage(art.pin, cx - Math.floor(art.pin.width / 2), cy - half - art.pin.height - 2 - (Math.floor(t * 3) % 2))
}

/** The type color of `skill` for `me`. */
const skillColor = (g: Game, me: Player, skill: Skill) => {
  if (skill === 2) return TYPE_COLORS[gameSpecial(g).def.type]
  const o = me.moves[skill + 1]
  return o ? TYPE_COLORS[MOVES[o.id].type] : AUTO
}

/** The foe a cast at (x, y) snaps to (`VERSUS_KIT.snap`), as the run would pick it. */
const snapAt = (g: Game, me: Player, x: number, y: number) => {
  let best: Enemy | null = null
  let bestD = VERSUS_KIT.snap * VERSUS_KIT.snap
  for (const e of g.enemies) {
    if (!aimable(g, me, e) || (e.behavior.kind === 'avatar' && e.behavior.team === me.versus?.team)) continue
    const d = (e.x - x) ** 2 + (e.y - y) ** 2
    if (d < bestD) {
      bestD = d
      best = e
    }
  }
  return best
}

/** The overlay, in world px (the caller has the camera's translate on). `me` is this screen's player. */
export const drawArenaAim = (ctx: CanvasRenderingContext2D, g: Game, me: Player, overlay: ArenaOverlay, t: number) => {
  if (!me.versus || me.hp <= 0) return
  const locked = aimableById(g, me, overlay.lock)
  if (locked) bracket(ctx, locked, LOCK, t)
  else {
    const auto = autoTarget(g, me)
    if (auto) {
      ctx.globalAlpha = 0.75
      const art = lockOnArt(AUTO)
      ctx.drawImage(art.pin, Math.round(auto.x) - Math.floor(art.pin.width / 2), Math.round(auto.y - auto.radius * 2 - 8))
      ctx.globalAlpha = 1
    }
  }
  const aim = overlay.aim
  if (!aim) return
  const color = aim.cancel ? CANCEL : skillColor(g, me, aim.skill)
  const len = Math.hypot(aim.dx, aim.dy) || 1
  const ux = aim.dx / len
  const uy = aim.dy / len
  const reach = VERSUS_KIT.reach * aim.share
  const ox = Math.round(me.x)
  const oy = Math.round(me.y - 8)
  ctx.globalAlpha = 0.3
  blitRing(ctx, VERSUS_KIT.reach, 1, color, ox, oy)
  ctx.globalAlpha = 0.9
  ctx.fillStyle = color
  // The path: a dotted line out to where it lands.
  for (let d = 12; d < reach - 4; d += 7) ctx.fillRect(Math.round(ox + ux * d) - 1, Math.round(oy + uy * d) - 1, 2, 2)
  const ex = ox + ux * reach
  const ey = oy + uy * reach
  blitRing(ctx, 6, 1, color, Math.round(ex), Math.round(ey))
  ctx.fillRect(Math.round(ex), Math.round(ey), 1, 1)
  ctx.globalAlpha = 1
  if (aim.cancel) return
  const snap = snapAt(g, me, me.x + ux * reach, me.y + uy * reach)
  if (snap) bracket(ctx, snap, AUTO, t, true)
}

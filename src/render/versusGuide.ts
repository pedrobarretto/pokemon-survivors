import { blitPacked, blitRotated, textSprite } from '../engine/pixelart'
import { VERSUS } from '../data/versus'
import { goalOpen, mapOf, rivalTeam } from '../game/versusRules'
import type { GoalState } from '../game/versus'
import type { Game, Player } from '../game/types'
import { teamArrow } from './art'
import { markerInsets } from './mapEvents'
import { edgeSpot, type EdgeSpot } from './team'
import { TEAM_LIGHT } from './vale'

/**
 * The Arena's guide, draw-only: where the local player should head now
 * (`guideTarget`, which the coach's words follow too, `ui/versusCoach.ts`)
 * and an arrow to it, on the screen's edge while it's out of view, bobbing
 * over it once it's in view. Carrying Energy: the nearest rival goal that
 * takes scores. Low on HP: home to heal. Empty-handed with an objective up:
 * the objective. Nothing otherwise (farming needs no arrow).
 */

/** Below this share of max HP the guide (and the coach) send the player home. */
export const LOW_HP = 0.3

export type GuideTarget =
  | { kind: 'goal'; x: number; y: number; goal: GoalState }
  | { kind: 'heal'; x: number; y: number }
  | { kind: 'objective'; x: number; y: number }

/** Whether `p` stands inside the circle at (x, y) of radius `r`. */
export const standsIn = (p: Player, x: number, y: number, r: number) => (p.x - x) ** 2 + (p.y - y) ** 2 < r * r

/** Squared distance from `p` to (x, y). */
const d2 = (p: Player, x: number, y: number) => (p.x - x) ** 2 + (p.y - y) ** 2

/** Whether `p` stands where their team heals: one of its standing goals, or its spawn pad. */
export const healing = (g: Game, p: Player) => {
  const s = g.versus
  const v = p.versus
  if (!s || !v) return false
  const pad = mapOf(s).spawn[v.team]
  if (standsIn(p, pad.x, pad.y, VERSUS.spawnPad.r)) return true
  return s.goals.some((goal) => goal.team === v.team && !goal.broken && standsIn(p, goal.x, goal.y, goal.r))
}

/** The objective on the field (Drednaw or Zapdos), or null. */
export const objectiveOf = (g: Game) => {
  const o = g.versus?.objective
  if (!o) return null
  const e = g.enemies.find((e) => e.id === o.id)
  return e && e.hp > 0 ? { kind: o.kind, x: e.x, y: e.y } : null
}

/** Where `me` should head now, or null (on the bench, or nothing better than farming). */
export const guideTarget = (g: Game, me: Player): GuideTarget | null => {
  const s = g.versus
  const v = me.versus
  if (!s || !v || me.hp <= 0 || g.phase !== 'playing') return null
  if (me.hp / me.stats.maxHp < LOW_HP && !healing(g, me)) {
    const pad = mapOf(s).spawn[v.team]
    let best: { x: number; y: number } = pad
    for (const goal of s.goals) if (goal.team === v.team && !goal.broken && d2(me, goal.x, goal.y) < d2(me, best.x, best.y)) best = goal
    return { kind: 'heal', x: best.x, y: best.y }
  }
  if (v.energy > 0) {
    let best: GoalState | null = null
    for (const goal of s.goals) {
      if (goal.team !== rivalTeam(v.team) || !goalOpen(s, goal)) continue
      if (!best || d2(me, goal.x, goal.y) < d2(me, best.x, best.y)) best = goal
    }
    if (best) return { kind: 'goal', x: best.x, y: best.y, goal: best }
  }
  const objective = objectiveOf(g)
  return objective && v.energy === 0 ? { kind: 'objective', x: objective.x, y: objective.y } : null
}

const HEAL = '#78e078'
const OBJECTIVE = '#f8d030'
const spot: EdgeSpot = { x: 0, y: 0, angle: 0 }

/** The guide's arrow in screen space (camera at camX, camY), over everything but the flashes. */
export const drawVersusGuide = (ctx: CanvasRenderingContext2D, g: Game, me: Player, camX: number, camY: number, t: number) => {
  const target = guideTarget(g, me)
  if (!target || !me.versus) return
  const color = target.kind === 'goal' ? TEAM_LIGHT[rivalTeam(me.versus.team)] : target.kind === 'heal' ? HEAL : OBJECTIVE
  const label = target.kind === 'goal' ? String(Math.max(0, Math.round(target.goal.left))) : target.kind === 'heal' ? '+' : '!'
  const arrow = teamArrow(color)
  const bob = Math.round(Math.sin(t * 7) * 2)
  const sx = target.x - camX
  const sy = target.y - camY
  const { w, h } = g.view
  if (edgeSpot(w, h, markerInsets(), sx, sy, spot)) {
    // The mini map takes the top-right corner: an arrow there slides left along the top, or down the right side.
    if (spot.x > w * 0.7 && spot.y < h * 0.45) {
      if (spot.y < h * 0.2) spot.x = Math.round(w * 0.68)
      else spot.y = Math.round(h * 0.47)
    }
    const cos = Math.cos(spot.angle)
    const sin = Math.sin(spot.angle)
    // Two chevrons pointing the way, the label on the screen's side.
    blitRotated(ctx, arrow, spot.x + cos * (4 + bob), spot.y + sin * (4 + bob), spot.angle, 2)
    blitRotated(ctx, arrow, spot.x + cos * (-8 + bob), spot.y + sin * (-8 + bob), spot.angle, 2)
    blitPacked(ctx, textSprite(label, color), spot.x - cos * 20, spot.y - sin * 20)
    return
  }
  // In view: a chevron bobbing over it, above a goal's points.
  const top = target.kind === 'goal' ? target.y - target.goal.r - 18 : target.y - 34
  blitRotated(ctx, arrow, sx, top - camY + bob, Math.PI / 2, 2)
}

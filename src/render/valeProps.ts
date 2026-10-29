import type { Team } from '../data/versus'
import { MAPS, type MapId } from '../data/versusMaps'
import type { Game } from '../game/types'
import { localPlayer } from '../game/players'
import { teamFile, valeArt } from './arenaArt'
import { drawGoalPost, goalPostBox } from './vale'

/**
 * What stands up on an Arena map (`render/vale.ts` lays its floor): the goals'
 * posts, the banner pillars flanking each base's exits and the gates across
 * its carpet. The depth pass sorts them among the Pokémon by their feet
 * (`render/draw.ts`), and each goes faint while this screen's player stands
 * behind it. Draw-only: nothing here stands in anyone's way. Pillars and
 * gates are PixelLab pictures (`render/arenaArt.ts`) and show once loaded.
 */

type Ctx = CanvasRenderingContext2D

/** A standing piece, its feet at (x, y). `goal`: a post's goal (its index in the match's goals), -1 for the rest. */
export type ValeProp = { prop: 'post' | 'pillar' | 'gate'; team: Team; x: number; y: number; goal: number }

/** Each picture's feet: its middle, this many px up from its bottom row. */
const FEET = { pillar: 6, gate: 2 } as const

/** A map's standing pieces: its goals' posts, and each base's pillars by its exits and gates across its carpet's spine (the map's `look`), mirrored east. */
const propsOf = (id: MapId): ValeProp[] => {
  const map = MAPS[id]
  const { pillars, gates, plaza } = map.look
  return [
    ...map.goals.map((goal, i): ValeProp => ({ prop: 'post', team: goal.team, x: goal.x, y: Math.round(goal.y + 4), goal: i })),
    ...([0, 1] as const).flatMap((team) => {
      const sx = team === 0 ? -1 : 1
      return [
        ...pillars.ys.map((y): ValeProp => ({ prop: 'pillar', team, x: sx * pillars.x, y, goal: -1 })),
        ...gates.map((y): ValeProp => ({ prop: 'gate', team, x: sx * plaza.spine, y, goal: -1 })),
      ]
    }),
  ]
}

const props = new Map<MapId, ValeProp[]>()

/** The standing pieces of `map` near the view (`visible`, with a margin for the tall ones), for the depth sort. */
export const valePropsInView = (map: MapId, visible: (x: number, y: number, m?: number) => boolean, out: { push: (p: ValeProp) => unknown }) => {
  let all = props.get(map)
  if (!all) props.set(map, (all = propsOf(map)))
  for (const p of all) if (visible(p.x, p.y, 110)) out.push(p)
}

const pictureOf = (p: ValeProp) => valeArt(p.prop === 'gate' ? `base-gate-${teamFile(p.team)}` : `base-pillar-${teamFile(p.team)}`)

/** A piece's box (top left, size) as drawn now, or null while its picture loads. */
const boxOf = (g: Game, p: ValeProp) => {
  if (p.prop === 'post') return goalPostBox(g, p.goal)
  const art = pictureOf(p)
  if (!art) return null
  return { x: Math.round(p.x) - (art.width >> 1), y: Math.round(p.y) + (p.prop === 'gate' ? FEET.gate : FEET.pillar) - art.height, w: art.width, h: art.height }
}

/** Whether `p` reaches over a body w×h with its feet at (x, y) standing behind it (north of its feet). */
export const valePropCovers = (g: Game, p: ValeProp, x: number, y: number, w: number, h: number) => {
  if (y >= p.y) return false
  const b = boxOf(g, p)
  return b !== null && x + w / 2 > b.x && x - w / 2 < b.x + b.w && y > b.y && y - h < b.y + b.h
}

/** Draws a standing piece, faint while this screen's player (body w×h) stands behind it. */
export const drawValeProp = (ctx: Ctx, g: Game, p: ValeProp, t: number, w: number, h: number) => {
  const me = localPlayer(g)
  const see = valePropCovers(g, p, me.x, me.y, w, h)
  if (p.prop === 'post') return drawGoalPost(ctx, g, p.goal, t, see)
  const b = boxOf(g, p)
  const art = pictureOf(p)
  if (!b || !art) return
  if (see) ctx.globalAlpha = 0.5
  ctx.drawImage(art, b.x, b.y)
  ctx.globalAlpha = 1
}

import { retain } from '../engine/math'
import { hash2, weightedPick } from '../engine/rng'
import type { BiomeId } from '../data/biomes'
import { DROP_TABLES, PROPS, rollDrop, type PropKind } from '../data/consumables'
import { dropItem } from './consumables'
import { burst } from './effects'
import { crackPumpkin, isPumpkinCell } from './halloween'
import { inView } from './queries'
import { isOpen } from './terrain'
import type { Attack, Game, Player } from './types'
import * as dm from '../engine/dmath'

/**
 * Breakable item sources (VS light sources). The world is split into cells
 * and each cell deterministically holds zero or one prop, so the map looks
 * the same when revisited. Only cells around the player are materialized.
 */
export type Prop = {
  id: number
  /** Packed world-cell key; also used to remember broken props. */
  cell: number
  kind: PropKind
  x: number
  y: number
  hp: number
  hitCooldown: number
  /** Seconds of hit wobble left (render only). */
  shake: number
}

export const PROP_CELL = 160
const DENSITY = 0.22
const SEED = 4242
const MARGIN = 24
const KIND_WEIGHTS = (Object.keys(PROPS) as PropKind[]).flatMap((k) => (PROPS[k].weight > 0 ? [[k, PROPS[k].weight] as const] : []))

const cellKey = (cx: number, cy: number) => (cx + 32768) * 65536 + (cy + 32768)

/** The prop living in world cell (cx, cy), if any; a haunted run (`game/halloween.ts`) turns some into jack-o'-lanterns. Pure and deterministic. */
export const propAt = (cx: number, cy: number, haunted = false): { kind: PropKind; x: number; y: number } | null => {
  if (hash2(cx, cy, SEED) >= DENSITY) return null
  const kind = haunted && isPumpkinCell(cx, cy) ? 'pumpkin' : weightedPick(() => hash2(cx, cy, SEED + 1), KIND_WEIGHTS)
  const span = PROP_CELL - MARGIN * 2
  return {
    kind,
    x: dm.round(cx * PROP_CELL + MARGIN + hash2(cx, cy, SEED + 2) * span),
    y: dm.round(cy * PROP_CELL + MARGIN + hash2(cx, cy, SEED + 3) * span),
  }
}

/** Cells (Chebyshev) around each player that hold live props; one ring past the screen so they never pop in. */
const reachCells = (g: Game) => Math.ceil(dm.hypot(g.view.w, g.view.h) / 2 / PROP_CELL) + 1

/** Fills the cells around every player with their props (in slot order, so co-op runs agree on the ids). */
const materialize = (g: Game) => {
  for (const p of g.players) materializeAround(g, p)
}

const materializeAround = (g: Game, p: Player) => {
  const reach = reachCells(g)
  const pcx = Math.floor(p.x / PROP_CELL)
  const pcy = Math.floor(p.y / PROP_CELL)
  for (let cy = pcy - reach; cy <= pcy + reach; cy++) {
    for (let cx = pcx - reach; cx <= pcx + reach; cx++) {
      const cell = cellKey(cx, cy)
      if (g.brokenProps.has(cell) || g.props.some((p) => p.cell === cell)) continue
      const spot = propAt(cx, cy, g.halloween)
      // Breakables never stand in a lake or inside a rock.
      if (spot && isOpen(g, spot.x, spot.y, 14)) g.props.push({ id: g.nextId++, cell, ...spot, hp: PROPS[spot.kind].hp, hitCooldown: 0, shake: 0 })
    }
  }
}

/** Whether an attack's hitbox overlaps a circle of radius `r` at (x, y). */
export const touches = (a: Attack, x: number, y: number, r: number) => {
  if (a.shape.kind === 'circle') return dm.sq(a.x - x) + dm.sq(a.y - y) < dm.sq(a.shape.r + r)
  const cx = Math.max(a.x - a.shape.w / 2, Math.min(x, a.x + a.shape.w / 2))
  const cy = Math.max(a.y - a.shape.h / 2, Math.min(y, a.y + a.shape.h / 2))
  return dm.sq(cx - x) + dm.sq(cy - y) < r * r
}

const PROP_COLORS: Record<PropKind, readonly string[]> = {
  itemBall: ['#e83838', '#ffffff', '#202028'],
  berryTree: ['#48a038', '#88d058', '#3870d8', '#a06838'],
  tallGrass: ['#4f9e48', '#78c060', '#2f7a3a'],
  pumpkin: ['#f88820', '#ffc040', '#583010'],
}

/** Debris where a biome dresses a breakable differently (see `render/props.ts`): rock chips in the cave, snow on Mt. Silver… */
const BIOME_COLORS: Partial<Record<BiomeId, Partial<Record<PropKind, readonly string[]>>>> = {
  forest: { berryTree: ['#2f7a30', '#58a040', '#3870d8', '#a06838'], tallGrass: ['#3a7a38', '#5aa048', '#1c4c24'] },
  cave: { berryTree: ['#c04830', '#f8e8d0', '#e8d8c0'], tallGrass: ['#988870', '#c8b8a0', '#4a3e34'] },
  snow: { berryTree: ['#2f6a50', '#f0f8ff', '#3870d8'], tallGrass: ['#98b8d0', '#ffffff', '#587890'] },
  tower: { berryTree: ['#584870', '#8070a0', '#3870d8'], tallGrass: ['#6c6080', '#9890a8', '#3c3448'] },
}

const hitProp = (g: Game, prop: Prop) => {
  prop.hp--
  prop.hitCooldown = 0.2
  prop.shake = 0.2
  const colors = BIOME_COLORS[g.biome.id]?.[prop.kind] ?? PROP_COLORS[prop.kind]
  burst(g, prop.x, prop.y - 6, { colors, count: 4, speed: 50, ttl: 0.3 })
  if (prop.hp > 0) return
  g.brokenProps.add(prop.cell)
  g.events.push({ kind: 'propBreak' })
  if (prop.kind === 'pumpkin') return crackPumpkin(g, prop.x, prop.y)
  burst(g, prop.x, prop.y - 6, { colors, count: 18, speed: 90, ttl: 0.5, gravity: 80 })
  dropItem(g, prop.x, prop.y - 2, rollDrop(DROP_TABLES[PROPS[prop.kind].table], g.time, g.rng))
}

/** Whether a prop at (x, y) is within `far` px (per axis) of some player. */
const nearAPlayer = (g: Game, x: number, y: number, far: number) => {
  for (const p of g.players) if (Math.abs(x - p.x) < far && Math.abs(y - p.y) < far) return true
  return false
}

/** Spawns/despawns props around the players and lets any active attack break them. */
export const updateProps = (g: Game, dt: number) => {
  // Re-scanning cells 4x per second is plenty: props live a ring past the screen edge.
  if (g.props.length === 0 || Math.floor(g.time * 4) !== Math.floor((g.time - dt) * 4)) {
    const far = (reachCells(g) + 1.5) * PROP_CELL
    retain(g.props, (prop) => nearAPlayer(g, prop.x, prop.y, far))
    materialize(g)
  }

  for (const prop of g.props) {
    prop.shake = Math.max(0, prop.shake - dt)
    prop.hitCooldown -= dt
    if (prop.hitCooldown > 0 || !inView(g, prop.x, prop.y, 24)) continue
    const r = PROPS[prop.kind].radius
    for (const a of g.attacks) {
      if (a.age < a.activeFrom || a.age > a.activeUntil || a.age < 0) continue
      if (!touches(a, prop.x, prop.y - r, r)) continue
      hitProp(g, prop)
      break
    }
  }
  retain(g.props, (prop) => prop.hp > 0)
}

import { DIG_FOSSILS, DIG_TREASURE_IDS, DIG_TREASURES, type DigGroup, type DigPrize, type DigTreasureId, type FossilFamily } from '../../data/digTreasures'
import SHAPES from '../../data/digShapes.generated.json'

/**
 * The Escavação's rules (`MINIGAMES.dig`): pure, shared by the API, which
 * builds every wall from a seed only it knows and answers every hit, and the
 * fake API of the dev console. The client never runs this on a real wall: it
 * draws what the API answers.
 *
 * A wall is a grid of cells, each with `depth` layers of dirt and rock over
 * it. Under it lie treasures in the shape of their own icons
 * (`digShapes.generated.json`). A hit takes one layer off the cells it
 * reaches and fills the crack meter; when the meter is full the wall comes
 * down and only what was dug out completely is kept. Rock and arrangement are
 * uncorrelated with what's below, so the surface tells nothing.
 */

export const DIG = {
  /** The grid, and a cell's size in the game's pixels. */
  cols: 11,
  rows: 8,
  cell: 15,
  /** Walls a Brasília day: the first free, then `price` ₽ each, `dailyCap` in all. */
  free: 1,
  price: 2000,
  dailyCap: 5,
  /** The crack a wall holds before it comes down, and what each tool adds. */
  crack: 80,
  pick: 2,
  hammer: 5,
  /** A bigger hammer's crack. */
  bigHammer: 6,
  /** Rock partners make a wall hold this much longer. */
  rockHold: 14,
  /** Treasures a wall holds, plain and golden. */
  slots: { plain: { min: 3, extra: 2 }, golden: { min: 5, extra: 1 } },
  /** The chance a wall comes out golden, and how much crack it holds (it has far more to dig). */
  golden: { chance: 1 / 20, crack: 40 },
  /** The most layers per cell a wall averages, so a wall is never solid hard rock. */
  hardestMean: 1.9,
  /** Walls without a fossil the account lacks before the next one holds one. */
  fossilGuarantee: 10,
} as const

/** The two tools. */
export type DigTool = 'pick' | 'hammer'

/** What the partner changes (`digPowers`): every wall of the run reads these. */
export type DigPowers = { bigHammer: boolean; hold: number; reveal: boolean; deepPick: boolean }

export const NO_POWERS: DigPowers = { bigHammer: false, hold: 0, reveal: false, deepPick: false }

/**
 * What a partner of these types brings to the wall: Ground swings a bigger
 * hammer (a square instead of a cross, for a little more crack), Rock makes
 * the wall hold longer, Psychic shows one cell of the biggest treasure, Steel
 * picks two layers at once (only worth it in hard rock).
 */
export const digPowers = (types: readonly string[]): DigPowers => ({
  bigHammer: types.includes('ground'),
  hold: types.includes('rock') ? DIG.rockHold : 0,
  reveal: types.includes('psychic'),
  deepPick: types.includes('steel'),
})

/** One treasure's shape: its size in cells, the art's box in px and offset in its cells, and which cells it covers. */
export type DigShape = { cols: number; rows: number; w: number; h: number; ox: number; oy: number; cells: readonly string[] }

/** A treasure's shape. */
export const shapeOf = (id: DigTreasureId): DigShape => (SHAPES as Record<DigTreasureId, DigShape>)[id]

/** Where a cell is in the grid as a single index. */
export const cellIndex = (col: number, row: number) => row * DIG.cols + col

/** The shape's cells, as column and row within it. */
export const shapeCells = (id: DigTreasureId): { col: number; row: number }[] => {
  const shape = shapeOf(id)
  return shape.cells.flatMap((line, row) => [...line].flatMap((c, col) => (c === '#' ? [{ col, row }] : [])))
}

/* ---------------- The week's vein ---------------- */

/** The veins: what the week favors, and by how much. */
export const DIG_VEINS = {
  goldSeam: { group: 'coins', boost: 1.5 },
  gemSeam: { group: 'stone', boost: 2.5 },
  fossilBed: { group: 'fossil', boost: 2 },
  crystalHollow: { group: 'furniture', boost: 3 },
  cachedSupplies: { group: 'bag', boost: 1.5 },
} as const satisfies Record<string, { group: DigGroup; boost: number }>

export type DigVein = keyof typeof DIG_VEINS

export const DIG_VEIN_IDS = Object.keys(DIG_VEINS) as DigVein[]

/** A treasure group's base chance per treasure, and a golden wall's (richer: fewer pebbles, far more that's rare). */
const GROUP_WEIGHTS: Record<'plain' | 'golden', Record<DigGroup, number>> = {
  plain: { coins: 83, bag: 10.4, stone: 0.6, furniture: 2.8, fossil: 3.2 },
  golden: { coins: 42, bag: 26, stone: 10, furniture: 10, fossil: 12 },
}

/** A golden wall skews its nuggets rare. */
const GOLDEN_COINS: Partial<Record<DigTreasureId, number>> = { nugget: 25, bigNugget: 55, relicGold: 20 }

/** A text's 32-bit hash (FNV-1a). */
const hashText = (text: string) => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** A small seeded generator (mulberry32): the next number in 0..1 each call. */
const rngFrom = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const shuffled = <T>(list: readonly T[], next: () => number): T[] => {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    const a = out[i]!
    out[i] = out[j]!
    out[j] = a
  }
  return out
}

/** The week's vein and what it brings: the same for everyone, from the Brasília week's Monday alone. */
export const digVein = (week: string): { vein: DigVein; bag: DigTreasureId[]; stones: DigTreasureId[] } => {
  const next = rngFrom(hashText(`vein:${week}`))
  const vein = DIG_VEIN_IDS[Math.floor(next() * DIG_VEIN_IDS.length)]!
  const inGroup = (group: DigGroup) => DIG_TREASURE_IDS.filter((id) => DIG_TREASURES[id].group === group)
  return { vein, bag: shuffled(inGroup('bag'), next).slice(0, 5), stones: shuffled(inGroup('stone'), next).slice(0, 3) }
}

/** What a treasure could be this week, and its weight, by group and kind of wall. */
const weekPool = (week: string, golden: boolean): { id: DigTreasureId; group: DigGroup; weight: number }[] => {
  const { vein, bag, stones } = digVein(week)
  const groups = golden ? GROUP_WEIGHTS.golden : GROUP_WEIGHTS.plain
  const boost = DIG_VEINS[vein]
  return (Object.keys(groups) as DigGroup[]).flatMap((group) => {
    const groupWeight = groups[group] * (boost.group === group ? boost.boost : 1)
    const ids = DIG_TREASURE_IDS.filter((id) => DIG_TREASURES[id].group === group && (group === 'bag' ? bag.includes(id) : group === 'stone' ? stones.includes(id) : true))
    const rawOf = (id: DigTreasureId) => (golden && group === 'coins' ? (GOLDEN_COINS[id] ?? DIG_TREASURES[id].weight) : DIG_TREASURES[id].weight)
    const total = ids.reduce((sum, id) => sum + rawOf(id), 0)
    return ids.map((id) => ({ id, group, weight: (groupWeight * rawOf(id)) / total }))
  })
}

/**
 * The odds on screen before paying: each thing a treasure can be this week
 * and its share, largest first. The wall builder rolls from this same list.
 */
export const digOdds = (week: string, golden = false): { id: DigTreasureId; group: DigGroup; share: number }[] => {
  const pool = weekPool(week, golden)
  const total = pool.reduce((sum, p) => sum + p.weight, 0)
  return pool.map((p) => ({ id: p.id, group: p.group, share: p.weight / total })).sort((a, b) => b.share - a.share)
}

/** The groups' shares for the odds table, in table order. */
export const digGroupOdds = (week: string, golden = false): { group: DigGroup; share: number }[] => {
  const odds = digOdds(week, golden)
  const groups: DigGroup[] = ['coins', 'bag', 'stone', 'furniture', 'fossil']
  return groups.map((group) => ({ group, share: odds.filter((o) => o.group === group).reduce((sum, o) => sum + o.share, 0) }))
}

/* ---------------- Building a wall ---------------- */

export type DigTreasure = { id: DigTreasureId; x: number; y: number }

export const DIG_PATTERNS = ['strata', 'boulders', 'seam', 'clay', 'terraces'] as const

export type DigPattern = (typeof DIG_PATTERNS)[number]

/** Psychic's sight: one cell of the wall's biggest treasure, shown from the start. */
export type DigHint = { i: number; id: DigTreasureId; col: number; row: number }

export type DigWall = {
  golden: boolean
  pattern: DigPattern
  /** The crack it holds. */
  cap: number
  /** Layers over each cell, `cols × rows` of them, row by row. */
  depths: number[]
  treasures: DigTreasure[]
  hint: DigHint | null
  /** Whether a fossil the account lacked was put in on purpose (the guarantee). */
  guaranteed: boolean
}

/** Who a wall is built for: the week, the partner's powers, the fossils the account lacks, whether its dry streak is due, and what dev forces. */
export type DigWallCtx = {
  week: string
  powers: DigPowers
  lacking: readonly FossilFamily[]
  due: boolean
  force?: { golden?: boolean; fossil?: FossilFamily } | undefined
}

const fossilFamily = (id: DigTreasureId): FossilFamily | null => {
  const prize: DigPrize = DIG_TREASURES[id].prize
  return prize.kind === 'fossil' ? prize.family : null
}

/** A rock pattern's layer count for each cell (1 soft dirt to 3 hard rock), its own seeded look. */
const buildDepths = (pattern: DigPattern, next: () => number): number[] => {
  const { cols, rows } = DIG
  const depths = new Array<number>(cols * rows).fill(1)
  const put = (col: number, row: number, d: number) => {
    if (col >= 0 && col < cols && row >= 0 && row < rows) depths[cellIndex(col, row)] = Math.max(1, Math.min(3, d))
  }
  if (pattern === 'strata') {
    // Horizontal bands, their edges wandering a little per column.
    const bands = Array.from({ length: rows }, () => 1 + Math.floor(next() * 3))
    for (let c = 0; c < cols; c++) {
      const drift = Math.floor(next() * 3) - 1
      for (let r = 0; r < rows; r++) put(c, r, bands[Math.max(0, Math.min(rows - 1, r + drift))]!)
    }
  } else if (pattern === 'boulders') {
    for (let i = 0; i < cols * rows; i++) depths[i] = 1 + (next() < 0.35 ? 1 : 0)
    for (let b = 0; b < 3 + Math.floor(next() * 3); b++) {
      const bc = Math.floor(next() * cols)
      const br = Math.floor(next() * rows)
      const reach = 1 + Math.floor(next() * 2)
      for (let r = -reach; r <= reach; r++) for (let c = -reach; c <= reach; c++) if (Math.abs(c) + Math.abs(r) <= reach) put(bc + c, br + r, 3 - Math.floor((Math.abs(c) + Math.abs(r)) / 2))
    }
  } else if (pattern === 'seam') {
    // A soft diagonal seam runs through rock that hardens away from it.
    const tilt = next() < 0.5 ? 1 : -1
    const start = Math.floor(next() * cols)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const d = Math.abs(c - (start + tilt * r * 0.8))
        put(c, r, d < 1.6 ? 1 : d < 3.5 ? 2 : 3 - (next() < 0.25 ? 1 : 0))
      }
    }
  } else if (pattern === 'clay') {
    for (let i = 0; i < cols * rows; i++) depths[i] = next() < 0.82 ? 1 : next() < 0.75 ? 2 : 3
  } else {
    // Terraces: wide steps left to right, each a touch harder or softer.
    let d = 1 + Math.floor(next() * 3)
    for (let c = 0; c < cols; c++) {
      if (next() < 0.32) d = Math.max(1, Math.min(3, d + (next() < 0.5 ? 1 : -1)))
      for (let r = 0; r < rows; r++) put(c, r, d + (next() < 0.14 ? 1 : 0))
    }
  }
  // No wall is solid hard rock: soften at random until enough of it is workable.
  let total = depths.reduce((sum, d) => sum + d, 0)
  while (total > cols * rows * DIG.hardestMean) {
    const i = Math.floor(next() * depths.length)
    if (depths[i]! > 1) {
      depths[i]!--
      total--
    }
  }
  return depths
}

/** Rolls one treasure from `pool`. */
const roll = (pool: readonly { id: DigTreasureId; weight: number }[], next: () => number): DigTreasureId => {
  const total = pool.reduce((sum, p) => sum + p.weight, 0)
  let at = next() * total
  for (const p of pool) {
    at -= p.weight
    if (at <= 0) return p.id
  }
  return pool[0]!.id
}

type Arrangement = 'scatter' | 'cluster' | 'band' | 'edges'

const ARRANGEMENTS: readonly Arrangement[] = ['scatter', 'cluster', 'band', 'edges']

/** A place to try for a shape of `cols × rows`, by how this wall arranges its treasures. */
const proposer = (arrangement: Arrangement, next: () => number) => {
  const cx = Math.floor(next() * DIG.cols)
  const cy = Math.floor(next() * DIG.rows)
  const near = (center: number, spread: number) => center + Math.round((next() + next() - 1) * spread)
  return (cols: number, rows: number) => {
    const maxX = DIG.cols - cols
    const maxY = DIG.rows - rows
    const x = arrangement === 'edges' ? (next() < 0.5 ? Math.floor(next() * 3) : maxX - Math.floor(next() * 3)) : arrangement === 'cluster' ? near(cx - Math.floor(cols / 2), 4) : Math.floor(next() * (maxX + 1))
    const y = arrangement === 'band' ? near(cy - Math.floor(rows / 2), 2) : arrangement === 'cluster' ? near(cy - Math.floor(rows / 2), 3) : Math.floor(next() * (maxY + 1))
    return { x: Math.max(0, Math.min(maxX, x)), y: Math.max(0, Math.min(maxY, y)) }
  }
}

/** The plan of a wall as buried: each treasure at a free spot, with a gap between them where one fits. */
const place = (ids: readonly DigTreasureId[], arrangement: Arrangement, next: () => number): DigTreasure[] => {
  const taken = new Set<number>()
  const placed: DigTreasure[] = []
  const propose = proposer(arrangement, next)
  const free = (x: number, y: number, cells: readonly { col: number; row: number }[], gap: boolean) =>
    cells.every(({ col, row }) => {
      const cx = x + col
      const cy = y + row
      if (taken.has(cellIndex(cx, cy))) return false
      if (!gap) return true
      return [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => !taken.has(cellIndex(cx + dx!, cy + dy!)))
    })
  for (const id of ids) {
    const shape = shapeOf(id)
    const cells = shapeCells(id)
    let spot: { x: number; y: number } | null = null
    for (let attempt = 0; attempt < 160 && !spot; attempt++) {
      const p = propose(shape.cols, shape.rows)
      if (free(p.x, p.y, cells, attempt < 90)) spot = p
    }
    if (!spot) continue
    for (const { col, row } of cells) taken.add(cellIndex(spot.x + col, spot.y + row))
    placed.push({ id, ...spot })
  }
  return placed
}

/**
 * The wall of seed `seed` for `ctx`. Golden is rolled on the wall's seed
 * alone. The guarantee puts a fossil the account lacks in; other fossils are
 * rolled from the five, so a repeat can come. Treasures are placed biggest
 * first so what's rare always fits.
 */
export const buildWall = (seed: number, ctx: DigWallCtx): DigWall => {
  const next = rngFrom(seed)
  const golden = ctx.force?.golden ?? next() < DIG.golden.chance
  const pattern = DIG_PATTERNS[Math.floor(next() * DIG_PATTERNS.length)]!
  const pool = weekPool(ctx.week, golden)
  const slots = golden ? DIG.slots.golden : DIG.slots.plain
  const count = slots.min + Math.floor(next() * (slots.extra + 1))
  const forcedFamily = ctx.force?.fossil ?? (ctx.due && ctx.lacking.length > 0 ? ctx.lacking[Math.floor(next() * ctx.lacking.length)] : undefined)
  const forced = forcedFamily === undefined ? [] : DIG_FOSSILS.filter((id) => fossilFamily(id) === forcedFamily)
  const rolled = Array.from({ length: Math.max(0, count - forced.length) }, () => roll(pool, next))
  const ids = [...forced, ...rolled].sort((a, b) => shapeCells(b).length - shapeCells(a).length)
  const treasures = place(ids, ARRANGEMENTS[Math.floor(next() * ARRANGEMENTS.length)]!, next)
  const biggest = treasures[0]
  const hint = ctx.powers.reveal && biggest ? cellHint(biggest, next) : null
  return {
    golden,
    pattern,
    cap: DIG.crack + (golden ? DIG.golden.crack : 0) + ctx.powers.hold,
    depths: buildDepths(pattern, next),
    treasures,
    hint,
    guaranteed: forced.length > 0 && ctx.force?.fossil === undefined,
  }
}

const cellHint = (t: DigTreasure, next: () => number): DigHint => {
  const cells = shapeCells(t.id)
  const c = cells[Math.floor(next() * cells.length)]!
  return { i: cellIndex(t.x + c.col, t.y + c.row), id: t.id, col: c.col, row: c.row }
}

/** What a treasure at `at` covers, as grid indexes. */
export const treasureCells = (t: DigTreasure): number[] => shapeCells(t.id).map((c) => cellIndex(t.x + c.col, t.y + c.row))

/* ---------------- Hitting it ---------------- */

/** A wall in progress: the layers left over each cell and the crack so far. */
export type DigProgress = { left: number[]; crack: number }

export const startProgress = (wall: Pick<DigWall, 'depths'>): DigProgress => ({ left: [...wall.depths], crack: 0 })

/** The cells `tool` reaches when it comes down on `cell`: one for the pickaxe, a cross for the hammer, a 3×3 square for Ground's. */
export const toolArea = (tool: DigTool, cell: number, powers: DigPowers): number[] => {
  const col = cell % DIG.cols
  const row = Math.floor(cell / DIG.cols)
  if (tool === 'pick') return [cell]
  const steps = powers.bigHammer ? [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] : [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]
  return steps.flatMap(([dx, dy]) => {
    const c = col + dx!
    const r = row + dy!
    return c >= 0 && c < DIG.cols && r >= 0 && r < DIG.rows ? [cellIndex(c, r)] : []
  })
}

/** What a tool adds to the crack. */
export const toolCrack = (tool: DigTool, powers: DigPowers) => (tool === 'pick' ? DIG.pick : powers.bigHammer ? DIG.bigHammer : DIG.hammer)

/** One cell changed by a hit: its layers left, and what shows if it's dug through to a treasure. */
export type DigCell = { i: number; left: number; tile?: { t: number; id: DigTreasureId; col: number; row: number } }

/** A hit's answer: the cells it changed, the crack now, the treasures it finished and whether it brought the wall down. */
export type DigHit = { progress: DigProgress; cells: DigCell[]; freed: number[]; collapsed: boolean }

/** The treasure and cell under a dug-out index, or null. */
export const tileAt = (wall: DigWall, i: number): DigCell['tile'] | null => {
  for (let t = 0; t < wall.treasures.length; t++) {
    const treasure = wall.treasures[t]!
    const cells = shapeCells(treasure.id)
    const found = cells.find((c) => cellIndex(treasure.x + c.col, treasure.y + c.row) === i)
    if (found) return { t, id: treasure.id, col: found.col, row: found.row }
  }
  return null
}

/** Whether a treasure is dug out, every one of its cells down to 0. */
export const treasureFree = (wall: DigWall, left: readonly number[], t: number): boolean => treasureCells(wall.treasures[t]!).every((i) => (left[i] ?? 0) === 0)

/**
 * A hit on `cell` with `tool`, or null when it would change nothing (a dug
 * cell for the pickaxe, a cross with no layer left). Every cell it reaches
 * loses a layer (two for Steel's pickaxe), crack is added, and the hit that
 * fills the meter still digs before the wall comes down.
 */
export const hitWall = (wall: DigWall, progress: DigProgress, tool: DigTool, cell: number, powers: DigPowers): DigHit | null => {
  if (cell < 0 || cell >= DIG.cols * DIG.rows || progress.crack >= wall.cap) return null
  const area = toolArea(tool, cell, powers)
  if (!area.some((i) => (progress.left[i] ?? 0) > 0)) return null
  const bite = tool === 'pick' && powers.deepPick ? 2 : 1
  const left = [...progress.left]
  const cells: DigCell[] = []
  for (const i of area) {
    if (left[i]! <= 0) continue
    left[i] = Math.max(0, left[i]! - bite)
    const tile = left[i] === 0 ? (tileAt(wall, i) ?? undefined) : undefined
    cells.push({ i, left: left[i]!, ...(tile ? { tile } : {}) })
  }
  const crack = Math.min(wall.cap, progress.crack + toolCrack(tool, powers))
  const before = new Set(wall.treasures.flatMap((_, t) => (treasureFree(wall, progress.left, t) ? [t] : [])))
  const freed = wall.treasures.flatMap((_, t) => (!before.has(t) && treasureFree(wall, left, t) ? [t] : []))
  return { progress: { left, crack }, cells, freed, collapsed: crack >= wall.cap }
}

/** The treasures dug out completely, and those left buried, once a wall ends. */
export const sortOut = (wall: DigWall, left: readonly number[]) => ({
  kept: wall.treasures.flatMap((t, i) => (treasureFree(wall, left, i) ? [t] : [])),
  buried: wall.treasures.filter((_, i) => !treasureFree(wall, left, i)),
})

/** Whether a wall's end leaves the dry streak grown (nothing a lacked fossil in it), reset (a lacked fossil dug out), or as it was (one held, and buried). */
export const fossilStreak = (dry: number, wall: DigWall, left: readonly number[], lacking: readonly FossilFamily[]) => {
  if (lacking.length === 0) return dry
  const heldFossils = wall.treasures.filter((t) => DIG_TREASURES[t.id].group === 'fossil' && DIG_FOSSIL_LACKED(t.id, lacking))
  if (heldFossils.length === 0) return dry + 1
  return heldFossils.some((t) => treasureCells(t).every((i) => (left[i] ?? 0) === 0)) ? 0 : dry
}

const DIG_FOSSIL_LACKED = (id: DigTreasureId, lacking: readonly FossilFamily[]) => {
  const family = fossilFamily(id)
  return family !== null && lacking.includes(family)
}

/** The price of the next wall after `used` today: free, ₽, or null past the day's cap. */
export const wallPrice = (used: number): number | null => (used >= DIG.dailyCap ? null : used < DIG.free ? 0 : DIG.price)

/** What a wall's treasures are worth in all (`worth`), for the economy check. */
export const wallWorth = (wall: Pick<DigWall, 'treasures'>) => wall.treasures.reduce((sum, t) => sum + DIG_TREASURES[t.id].worth, 0)

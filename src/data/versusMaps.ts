import type { ArenaPiece, FloorPlan, Poly } from './arenas'
import type { EnemyId } from './enemies'
import type { Team } from './versus'

/**
 * The Arena's maps (`game/versus.ts` plays them, `render/vale.ts` paints
 * them): each one plain data, mirrored between Blue (west) and Red (east).
 * They share one shape, Unite style: a base at each end, a lane along the
 * north and one along the south, a darker middle (the jungle) with the
 * objective at its center, joined to the lanes by passages and to the bases
 * by a way each. A new map of that shape is an entry in `MAPS`: its rooms,
 * goals, camps and grass for the match, `look` for the painter.
 */

/** An axis-aligned walkable rectangle (map px around the center): the map's floor is their union, and bots route through their overlaps. */
export type Rect = { x0: number; y0: number; x1: number; y1: number }

export const rect = (x0: number, y0: number, x1: number, y1: number): Rect => ({ x0, y0, x1, y1 })

export const toPoly = (r: Rect): Poly => ({ kind: 'poly', pts: [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]] })

/** A goal zone: where the rival team scores. `base` stays shut until a lane goal of its team is gone. */
export type GoalDef = { team: Team; x: number; y: number; r: number; points: number; base: boolean }

/** A camp of wild Pokémon: what stands there, how many, their Energy and EXP each, and when it comes back once cleared. */
export type CampDef = { x: number; y: number; species: EnemyId; count: number; hp: number; damage: number; energy: number; xp: number; first: number; respawn: number }

/**
 * How a map's floor is painted (`render/vale.ts`, `valeProps.ts`, the mini
 * map), west side only (the east mirrors it). Presentation: the match never
 * reads it.
 */
export type MapLook = {
  /** |x| past which the floor is a base's plaza. */
  baseX: number
  /** |y| past which the floor is a lane's (its verges, flowers and chevrons). */
  laneFrom: number
  /** |y| of the middle of each lane's dirt path. */
  laneY: number
  /** The darker middle round the center. */
  jungle: Rect
  /** x of the dirt paths from the lanes down into the jungle, and the |y| in the jungle they start at. */
  passages: readonly number[]
  passageFrom: number
  /** The |x| span of the dirt way from each base into the jungle, along the middle. */
  mouth: readonly [number, number]
  /** Each base's carpet: its north–south spine (|x|) and the |y| of the ball emblems on it. */
  plaza: { spine: number; emblemY: number }
  /** Banners on the hedge behind each base (the |x| of their left edges, their top), lamps round its plaza (|x|, y) and fallen logs (x, y). */
  banners: { xs: readonly number[]; y: number }
  lamps: readonly (readonly [number, number])[]
  logs: readonly (readonly [number, number])[]
  /** The pieces standing up (`render/valeProps.ts`): banner pillars by each base's exits (|x|, their feet's y) and gates across its carpet's spine (their feet's y). */
  pillars: { x: number; ys: readonly number[] }
  gates: readonly number[]
  /** The mini map's scale (world px per map px): the map fits its square. */
  minimap: number
}

export type VersusMap = {
  /** Walkable areas: bases, lanes, the jungle and the passages between them. */
  rects: readonly Rect[]
  /** Cover standing on the floor. */
  solids: readonly { piece: ArenaPiece; x: number; y: number }[]
  /** Each team's spawn pad (players come back here) by team. */
  spawn: readonly [{ x: number; y: number }, { x: number; y: number }]
  goals: readonly GoalDef[]
  camps: readonly CampDef[]
  /** Where Drednaw and Zapdos stand. */
  center: { x: number; y: number }
  /** Tall grass to hide in (`VERSUS.grass`): walkable, clear of goals, pads and camps. */
  grass: readonly Rect[]
  /** |y| past which a spot is in the north or south lane, for the bots' lanes (between them: the jungle). */
  lanes: number
  look: MapLook
}

/** Mirrors a west-side point to the east side. */
const east = <T extends { x: number }>(o: T): T => ({ ...o, x: -o.x })

/** Mirrors a west-side patch to the east side. */
const eastRect = (r: Rect): Rect => rect(-r.x1, r.y0, -r.x0, r.y1)

const camp = (x: number, y: number, species: EnemyId, count: number, hp: number, damage: number, energy: number, xp: number, first: number, respawn: number): CampDef => ({
  x, y, species, count, hp, damage, energy, xp, first, respawn,
})

/** Both teams' goals from the west's (the east's mirror them, Red's). */
const mirrorGoals = (west: readonly GoalDef[]): GoalDef[] => [...west, ...west.map((g): GoalDef => ({ ...east(g), team: 1 }))]

/* ---------------- The Vale (4v4) ---------------- */

const valeGoals: GoalDef[] = [
  { team: 0, x: -420, y: -290, r: 34, points: 60, base: false },
  { team: 0, x: -420, y: 290, r: 34, points: 60, base: false },
  { team: 0, x: -620, y: 0, r: 40, points: 100, base: true },
]

/** One side's camps; the other side mirrors them. */
const valeCamps: CampDef[] = [
  // Lanes: Bunnelby on top, Corphish below, near each team's goals; Aipom in the middle of the lanes.
  camp(-250, -300, 'bunnelby', 2, 260, 6, 3, 9, 8, 30),
  camp(-250, 300, 'corphish', 2, 260, 6, 3, 9, 8, 30),
  // The jungle: Ludicolo, slow and stout, worth a lot.
  camp(-250, -40, 'ludicolo', 1, 1100, 12, 10, 30, 25, 60),
  camp(-160, 120, 'chewtle', 2, 320, 8, 4, 11, 15, 40),
]

/** One side's tall grass, Unite style; the other side mirrors it. */
const valeGrass: Rect[] = [
  // By each lane goal, on the lane's outer verge.
  rect(-372, -370, -306, -330),
  rect(-372, 330, -306, 370),
  // Mid-lane, on the jungle's side of the path.
  rect(-212, -250, -146, -214),
  rect(-212, 214, -146, 250),
  // Flanking the way in from the base to the jungle.
  rect(-468, -114, -420, -62),
  rect(-468, 62, -420, 114),
  // Round the center, beside the middle passages.
  rect(-104, -152, -54, -108),
  rect(-104, 108, -54, 152),
]

/**
 * The Vale: two bases west and east, a lane along the north and one along
 * the south, the jungle in between, joined by passages. 1500 × 760 px.
 */
export const VALE: VersusMap = {
  rects: [
    rect(-750, -380, -540, 380), // west base
    rect(540, -380, 750, 380), // east base
    rect(-560, -380, 560, -210), // north lane
    rect(-560, 210, 560, 380), // south lane
    rect(-470, -160, 470, 160), // jungle
    // Passages between the lanes and the jungle.
    rect(-400, -230, -300, -140),
    rect(-50, -230, 50, -140),
    rect(300, -230, 400, -140),
    rect(-400, 140, -300, 230),
    rect(-50, 140, 50, 230),
    rect(300, 140, 400, 230),
    // From each base into the jungle.
    rect(-560, -50, -450, 50),
    rect(450, -50, 560, 50),
  ],
  solids: [
    ...[
      { piece: 'jadeStump' as const, x: -330, y: -260 },
      { piece: 'jadeStump' as const, x: -120, y: 270 },
      { piece: 'palm' as const, x: -120, y: -60 },
      { piece: 'palm' as const, x: -360, y: 70 },
      { piece: 'seaRock' as const, x: -500, y: -300 },
      { piece: 'seaRock' as const, x: -500, y: 300 },
    ].flatMap((s) => [s, east(s)]),
    { piece: 'column', x: 0, y: -290 },
    { piece: 'column', x: 0, y: 290 },
  ],
  spawn: [{ x: -700, y: 0 }, { x: 700, y: 0 }],
  goals: mirrorGoals(valeGoals),
  camps: [...valeCamps, ...valeCamps.map(east), camp(0, -300, 'aipom', 3, 180, 5, 2, 7, 8, 30), camp(0, 300, 'aipom', 3, 180, 5, 2, 7, 8, 30)],
  center: { x: 0, y: 0 },
  grass: [...valeGrass, ...valeGrass.map(eastRect)],
  lanes: 170,
  look: {
    baseX: 540,
    laneFrom: 210,
    laneY: 295,
    jungle: rect(-470, -160, 470, 160),
    passages: [-350, 0, 350],
    passageFrom: 136,
    mouth: [430, 560],
    plaza: { spine: 645, emblemY: 175 },
    banners: { xs: [585, 705], y: -386 },
    lamps: [[566, 140], [728, 140], [566, -140], [728, -140]],
    logs: [[-96, -132], [92, 126]],
    pillars: { x: 555, ys: [-372, -204, -50, 56, 216, 376] },
    gates: [-74, 146],
    minimap: 28,
  },
}

/* ---------------- The Clareira (3v3) ---------------- */

/** Two lane goals a team, no base goal: a short match is two pushes, not a siege. */
const gladeGoals: GoalDef[] = [
  { team: 0, x: -330, y: -255, r: 34, points: 80, base: false },
  { team: 0, x: -330, y: 255, r: 34, points: 80, base: false },
]

/** One side's camps; the other side mirrors them. Quicker to come back than the Vale's: the whole match is three minutes. */
const gladeCamps: CampDef[] = [
  camp(-195, -255, 'bunnelby', 2, 240, 6, 3, 9, 5, 22),
  camp(-195, 255, 'corphish', 2, 240, 6, 3, 9, 5, 22),
  // The clearing's Ludicolo, by the way in from the base.
  camp(-200, 0, 'ludicolo', 1, 900, 11, 9, 26, 15, 45),
]

/** One side's tall grass; the other side mirrors it. */
const gladeGrass: Rect[] = [
  // Past each lane goal, on the lane's outer verge.
  rect(-290, -316, -236, -286),
  rect(-290, 286, -236, 316),
  // Mid-lane, on the clearing's side of the path.
  rect(-110, -232, -50, -200),
  rect(-110, 200, -50, 232),
  // The clearing's west corners, flanking the way in from the base.
  rect(-296, -126, -248, -82),
  rect(-296, 82, -248, 126),
  // Round the center, between it and the passages.
  rect(-118, -126, -72, -90),
  rect(-118, 90, -72, 126),
]

/**
 * The Clareira: the 3v3 quick map, a clearing in the woods. The Vale's shape
 * pulled in: small bases, two short lanes with a goal each per team, and a
 * round clearing in the middle where Drednaw and then Zapdos come down,
 * reached from both lanes by a passage each side and from each base by a
 * straight way. 1230 × 640 px: from your pad to a rival goal is a dozen
 * seconds' walk, and the objective is never far from anyone. Its bases keep
 * the Vale's width, so the plaza (pillars, carpet, gates, pad) reads the same.
 */
export const GLADE: VersusMap = {
  rects: [
    rect(-615, -320, -410, 320), // west base
    rect(410, -320, 615, 320), // east base
    rect(-430, -320, 430, -190), // north lane
    rect(-430, 190, 430, 320), // south lane
    rect(-300, -130, 300, 130), // the clearing
    // Passages between the lanes and the clearing.
    rect(-215, -210, -125, -110),
    rect(125, -210, 215, -110),
    rect(-215, 110, -125, 210),
    rect(125, 110, 215, 210),
    // From each base into the clearing.
    rect(-430, -45, -280, 45),
    rect(280, -45, 430, 45),
  ],
  solids: [
    ...[
      { piece: 'jadeStump' as const, x: -262, y: -206 },
      { piece: 'jadeStump' as const, x: -262, y: 206 },
      { piece: 'palm' as const, x: -128, y: 54 },
      { piece: 'seaRock' as const, x: -470, y: -285 },
      { piece: 'seaRock' as const, x: -470, y: 285 },
    ].flatMap((s) => [s, east(s)]),
    { piece: 'palm', x: 128, y: -54 },
    { piece: 'palm', x: -128, y: -54 },
    { piece: 'column', x: 0, y: -204 },
    { piece: 'column', x: 0, y: 204 },
  ],
  spawn: [{ x: -565, y: 0 }, { x: 565, y: 0 }],
  goals: mirrorGoals(gladeGoals),
  camps: [...gladeCamps, ...gladeCamps.map(east), camp(0, -262, 'aipom', 3, 170, 5, 2, 7, 5, 22), camp(0, 262, 'aipom', 3, 170, 5, 2, 7, 5, 22)],
  center: { x: 0, y: 0 },
  grass: [...gladeGrass, ...gladeGrass.map(eastRect)],
  lanes: 160,
  look: {
    baseX: 410,
    laneFrom: 190,
    laneY: 255,
    jungle: rect(-300, -130, 300, 130),
    passages: [-170, 170],
    passageFrom: 106,
    mouth: [260, 430],
    plaza: { spine: 515, emblemY: 205 },
    banners: { xs: [455, 570], y: -326 },
    lamps: [[436, 104], [593, 104], [436, -104], [593, -104]],
    logs: [[-150, 84], [134, -100]],
    pillars: { x: 425, ys: [-312, -184, -45, 51, 196, 316] },
    gates: [-74, 146],
    minimap: 23,
  },
}

export const MAPS = { vale: VALE, glade: GLADE } as const satisfies Record<string, VersusMap>

export type MapId = keyof typeof MAPS

/** The floor plan the room keeps everyone on (`game/room.ts`). */
export const floorOf = (map: VersusMap): FloorPlan => ({ floor: map.rects.map(toPoly) })

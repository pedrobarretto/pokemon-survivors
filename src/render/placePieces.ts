import { context2d, createCanvas, type PixelSprite } from '../engine/pixelart'
import type { BiomeId } from '../data/biomes'
import { PLACE_FEET, type PlacePiece } from '../data/places'
import type { Tier } from '../data/terrain'
import { cylinder, grid, lathe, limb, noise, outline, put, sculpt, shade, shard, stamp, toSprite, type Grid, type Ramp } from './sculpt'
import { cliffOf, deadTree, ROCK_SKINS, stalagmites, TOWER_TREE, type Piece } from './terrain'

/**
 * Places' scenery (`data/places.ts`), sculpted in code like the map's
 * terrain: the entrances on the map (a cave mouth in a rocky hill, a
 * graveyard's gate, the updraft's standing stones) and what stands inside.
 * Built on first sight and cached by `render/terrain.ts`.
 */

const piece = (g: Grid, ax: number, ay: number): Piece => ({ sprite: toSprite(g), ax: Math.round(ax), ay: Math.round(ay) })

const MOSS: Ramp = ['#2c5a2a', '#447c38', '#62a048']
const WOOD: Ramp = ['#3c2414', '#5c3c20', '#7c5430', '#9c6c40']
const GRAVE: Ramp = ['#2c2638', '#4a4258', '#6a6280', '#8e86a4', '#b0a8c4']
const IRON: Ramp = ['#14121c', '#2a2634', '#46404e', '#625a6c']

/** The hill the cave's mouth is carved into: the map's mountains in miniature, so it wears each biome's skin. */
const CAVE_HILL: readonly Tier[] = [
  { foot: PLACE_FEET.caveMouth, h: 24 },
  { foot: [{ x: 2, y: -22, rx: 30, ry: 10 }, { x: -16, y: -18, rx: 14, ry: 7 }], h: 12 },
]

/** Draws a grid over a sprite, its (0, 0) at (x, y) of the sprite. */
export const over = (sprite: PixelSprite, g: Grid, x: number, y: number) => {
  const canvas = createCanvas(sprite.width, sprite.height)
  const ctx = context2d(canvas)
  ctx.drawImage(sprite, 0, 0)
  ctx.drawImage(toSprite(g), x, y)
  return canvas
}

/**
 * The cave's mouth: a hill in the biome's skin with an arch carved into its
 * south face, mine beams around it, steps going down into the dark and a
 * signpost showing the stairs. Anchored at the arch's foot.
 */
/**
 * A mine's mouth carved into a hill's face at (cx, foot): a dark arch fading
 * into the rock, `steps` going down (or level ground) and timbers around it.
 */
export const mineArch = (g: Grid, cx: number, foot: number, half = 13, steps = true) => {
  const top = foot - 9
  for (let y = top - half; y <= foot; y++) {
    for (let x = cx - half; x <= cx + half; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - top
      if (y < top && dx * dx + dy * dy > half * half) continue
      const edge = Math.min(half - Math.abs(dx), y < top ? half - Math.sqrt(dx * dx + dy * dy) : Infinity)
      const step = steps && y > foot - 10 && (foot - y) % 3 === 0 && Math.abs(dx) < half - 3
      put(g, x, y, step ? '#3a2e28' : edge < 1.5 ? '#2a201c' : edge < 4 ? '#140e0c' : '#060404')
    }
  }
  for (const px of [cx - half - 2, cx + half + 1]) limb(g, px, foot + 1, px, top - half - 2, 1.6, 1.6, WOOD)
  limb(g, cx - half - 5, top - half - 3, cx + half + 4, top - half - 3, 1.8, 1.8, WOOD)
  for (const px of [cx - half - 2, cx + half + 1]) put(g, px, top - half - 3, '#2c1c10')
  return top - half - 3
}

const caveMouth = (biome: BiomeId): Piece => {
  const hill = cliffOf(biome, CAVE_HILL, 61)
  // A grid the size of the hill, (0, 0) at its top-left, so the arch lines up with the face.
  const g = grid(hill.sprite.width, hill.sprite.height)
  const cx = hill.ax
  const foot = hill.ay - 2
  mineArch(g, cx, foot)
  // The signpost: a plank with PMD's stairs on it.
  const sx = cx - 24
  const sy = hill.ay + 12
  limb(g, sx, sy, sx, sy - 9, 0.9, 0.9, WOOD)
  for (let y = sy - 15; y <= sy - 8; y++) for (let x = sx - 6; x <= sx + 6; x++) put(g, x, y, shade(WOOD, y === sy - 15 ? 0.9 : 0.55, x, y))
  stamp(g, ['1....', '11...', '.11..', '..11.', '...11'], { 1: '#2c1c10' }, sx - 2, sy - 14)
  outline(g, '#140e10')
  return { sprite: over(hill.sprite, g, 0, 0), ax: hill.ax, ay: hill.ay }
}

/** A square stone pillar with a cap and a ball on top, lit from the left. */
const pillar = (g: Grid, cx: number, ground: number, height: number) => {
  for (let y = ground - height; y <= ground; y++) {
    for (let x = cx - 5; x <= cx + 5; x++) {
      const light = x <= cx - 3 ? 0.85 : x >= cx + 3 ? 0.25 : 0.55
      const course = (ground - y) % 7 === 0
      put(g, x, y, shade(GRAVE, course ? light - 0.3 : light + (noise(x, y, 5) - 0.5) * 0.15, x, y))
    }
  }
  for (let y = ground - height - 3; y < ground - height; y++) for (let x = cx - 7; x <= cx + 7; x++) put(g, x, y, shade(GRAVE, y === ground - height - 3 ? 0.95 : x < cx ? 0.7 : 0.4, x, y))
  sculpt(g, [{ x: cx, y: ground - height - 7, rx: 3.5, ry: 3.5 }], GRAVE, { tag: 40 })
}

/**
 * The graveyard's gate: square stone pillars and a wrought iron arch with a
 * crescent, the gates swung open, an iron fence running off both sides and,
 * behind it, dark ground with graves, a bare tree and mist. Anchored at the gate's foot.
 */
const graveGate = (): Piece => {
  const g = grid(176, 96)
  const cx = 88
  const ground = 84
  // The yard behind the fence: dark grass, a band of mist, graves.
  for (let y = ground - 30; y < ground - 1; y++) {
    const half = 86 * Math.sqrt(Math.max(0, 1 - ((y - ground + 1) / 30) ** 2))
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const mist = Math.abs(y - (ground - 12) - Math.sin(x / 9) * 2) < 1.5 && noise(x >> 1, y, 3) < 0.75
      put(g, x, y, mist ? '#6a6084' : noise(x, y, 2) < 0.1 ? '#46584a' : noise(x >> 2, y >> 1, 4) < 0.5 ? '#2c3a30' : '#334437')
    }
  }
  const STONE = ['..111..', '.12221.', '1222221', '1232221', '1222221', '1232321', '1222221', '1222221', '1111111']
  const CROSS = ['.1.', '121', '121', '1211', '12221', '1211', '121', '121', '111']
  for (const [x, y, cross] of [[30, 76, false], [52, 70, true], [70, 64, false], [108, 64, false], [126, 70, true], [146, 76, false]] as const) {
    stamp(g, cross ? CROSS : STONE, { 1: '#141020', 2: GRAVE[3]!, 3: GRAVE[1]! }, x - 3, y - 8)
  }
  limb(g, 160, 66, 159, 40, 2.2, 1.2, TOWER_TREE.trunk)
  limb(g, 159, 48, 148, 36, 1.2, 0.6, TOWER_TREE.trunk)
  limb(g, 159, 44, 169, 33, 1.1, 0.5, TOWER_TREE.trunk)
  // The fence: bars with spear tips on two rails, a thicker post every few bars.
  for (let x = 4; x <= g.w - 5; x++) {
    if (Math.abs(x - cx) < 26) continue
    const bar = x % 4 === 0
    const post = x % 16 === 0
    for (let y = ground - 18; y <= ground; y++) {
      const rail = y === ground - 4 || y === ground - 14
      if (bar || rail || post) put(g, x, y, shade(IRON, post ? 0.9 : bar ? 0.7 : 0.45, x, y))
    }
    if (bar) {
      put(g, x, ground - 19, IRON[3]!)
      put(g, x, ground - 20, IRON[2]!)
    }
  }
  // The open gates, swung in against the pillars.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const x = cx + side * (15 - i * 2)
      for (let y = ground - 24 + i; y <= ground - 1 - i; y++) put(g, x, y, shade(IRON, 0.6, x, y))
    }
  }
  pillar(g, cx - 21, ground, 32)
  pillar(g, cx + 21, ground, 32)
  // The wrought iron arch, scrolls at its feet and a crescent in the middle.
  for (let x = cx - 15; x <= cx + 15; x++) {
    const t = (x - cx) / 15
    const y = Math.round(ground - 32 - 9 * (1 - t * t))
    put(g, x, y, IRON[3]!)
    put(g, x, y + 1, IRON[1]!)
  }
  stamp(g, ['.11', '1..', '1..', '1..', '.11'], { 1: '#e8d898' }, cx - 1, ground - 47)
  stamp(g, ['11', '1.', '.1'], { 1: IRON[3]! }, cx - 15, ground - 33)
  stamp(g, ['11', '.1', '1.'], { 1: IRON[3]! }, cx + 14, ground - 33)
  outline(g, '#0c0814')
  return piece(g, cx, ground)
}

/** One of the updraft's four standing stones: a tall pale menhir with a carved swirl and a ribbon streaming off its top. */
const windStone = (variant: number): Piece => {
  const g = grid(20, 38)
  const cx = 9
  const ground = 35
  const stone: Ramp = ['#3c4458', '#5c6680', '#7e88a0', '#a4acc0', '#d0d6e4']
  lathe(g, cx, ground, 28, (t) => 5 - t * 1.4 - (t > 0.88 ? (t - 0.88) * 26 : 0), stone, { ry: 0.45 })
  stamp(g, ['.11.', '1..1', '1.1.', '1...', '.111'], { 1: '#68d0f8' }, cx - 2, ground - 20)
  // The ribbon, streaming off to one side.
  const ribbon = variant % 2 === 0 ? '#f8f8ff' : '#98d8f8'
  stamp(g, ['111..', '.1111', '..111', '...11', '....1'], { 1: ribbon }, cx + 1, ground - 29)
  outline(g, '#141a28')
  return piece(g, cx, ground)
}

const CAVE_STONE = { stone: ['#1e1614', '#3a2c26', '#5a463c', '#7a6250', '#9a806a'], outline: '#0c0806' }

/** A cluster of glowing crystal shards (the dungeon's light), blue, violet or green. */
const crystal = (variant: number): Piece => {
  const g = grid(22, 24)
  const cx = 11
  const ground = 21
  const hues: readonly Ramp[] = [
    ['#183868', '#2c68b0', '#58a8e8', '#a8e0ff', '#ffffff'],
    ['#3c1868', '#6c34b0', '#a070e8', '#d8b8ff', '#ffffff'],
    ['#185838', '#2c9060', '#58d098', '#b0f8d0', '#ffffff'],
  ]
  const ramp = hues[variant % hues.length]!
  sculpt(g, [{ x: cx, y: ground, rx: 7, ry: 3 }], CAVE_STONE.stone, { facets: 2 })
  shard(g, cx - 4, ground, 9, 3.5, -0.45, ramp)
  shard(g, cx + 4, ground, 8, 3, 0.5, ramp)
  shard(g, cx, ground, 15, 4.5, 0.05, ramp)
  outline(g, '#080810')
  return piece(g, cx, ground)
}

/** The Mystery Dungeon's treasure: a red wooden chest with gold trim (open once looted). */
const chest = (variant: number): Piece => {
  const closed = [
    '..11111111111111..',
    '.1222222222222221.',
    '1233333333333333321',
    '1244444444444444421',
    '1255555555555555521',
    '1111111166111111111',
    '1233333367733333321',
    '1244444467744444421',
    '1244444466644444421',
    '1255555555555555521',
    '1255555555555555521',
    '1111111111111111111',
  ]
  const open = [
    '..1111111111111111..',
    '.122222222222222221.',
    '1233333333333333321.',
    '1111111111111111111.',
    '1888888888888888881.',
    '1899999999999999981.',
    '1233333367733333321.',
    '1244444467744444421.',
    '1244444466644444421.',
    '1255555555555555521.',
    '1255555555555555521.',
    '1111111111111111111.',
  ]
  const rows = variant === 1 ? open : closed
  const g = grid(22, 16)
  stamp(g, rows, { 1: '#2c1008', 2: '#f8d878', 3: '#c83828', 4: '#a02818', 5: '#781c10', 6: '#f8d030', 7: '#7c5000', 8: '#401810', 9: '#f8e8a0' }, 1, 2)
  outline(g, '#140604')
  return piece(g, 10, 14)
}

/** A rounded headstone with an engraved line and moss at its foot; some lean or are chipped. */
const tombstone = (variant: number): Piece => {
  const g = grid(18, 22)
  const cx = 9
  const ground = 19
  const lean = ((variant % 3) - 1) * 0.08
  for (let y = ground - 15; y <= ground; y++) {
    const e = ground - y
    const w = e > 11 ? Math.round(Math.sqrt(Math.max(0, 16 - (e - 11) * (e - 11)))) + 1 : 5
    const ox = Math.round(e * lean * 3)
    for (let dx = -w; dx <= w; dx++) {
      const x = cx + dx + ox
      if (variant % 4 === 3 && e > 12 && dx > 1) continue
      const light = dx < -w + 2 ? 0.85 : dx > w - 2 ? 0.25 : 0.55
      put(g, x, y, shade(GRAVE, light + (noise(x, y, variant) - 0.5) * 0.15, x, y))
    }
  }
  for (const [y, w] of [[ground - 10, 2], [ground - 7, 3]] as const) for (let dx = -w; dx <= w; dx++) put(g, cx + dx + Math.round((ground - y) * lean * 3), y, GRAVE[1]!)
  for (let dx = -6; dx <= 6; dx++) if (noise(dx, variant, 3) < 0.7) put(g, cx + dx, ground + 1, shade(MOSS, 0.4, cx + dx, ground))
  outline(g, '#0c0814')
  return piece(g, cx, ground)
}

/** A stone cross on a little plinth. */
const graveCross = (variant: number): Piece => {
  const g = grid(14, 24)
  const cx = 7
  const ground = 21
  const ramp = variant % 2 === 0 ? GRAVE : WOOD
  for (let y = ground - 17; y <= ground - 2; y++) for (let dx = -1; dx <= 1; dx++) put(g, cx + dx, y, shade(ramp, dx < 0 ? 0.8 : 0.35, cx + dx, y))
  for (let x = cx - 5; x <= cx + 5; x++) for (const y of [ground - 13, ground - 12]) put(g, x, y, shade(ramp, y === ground - 13 ? 0.75 : 0.4, x, y))
  for (let x = cx - 3; x <= cx + 3; x++) for (const y of [ground - 1, ground]) put(g, x, y, shade(GRAVE, 0.45, x, y))
  outline(g, '#0c0814')
  return piece(g, cx, ground)
}

/** The Odd Keystone on a stepped plinth, the spirits' swirl in its face; split open once Spiritomb breaks out. */
const keystone = (variant: number): Piece => {
  const g = grid(36, 44)
  const cx = 18
  const ground = 40
  cylinder(g, cx, ground, 14, 4, GRAVE, { ry: 5 })
  cylinder(g, cx, ground - 4, 10.5, 4, GRAVE, { ry: 4 })
  const stone: Ramp = ['#181420', '#2c2638', '#443c54', '#5c5270', '#7c7090']
  if (variant === 1) {
    sculpt(g, [{ x: cx - 7, y: ground - 11, rx: 5, ry: 3.5 }, { x: cx + 7, y: ground - 10, rx: 4.5, ry: 3 }, { x: cx + 1, y: ground - 9, rx: 3, ry: 2 }], stone, { facets: 2 })
  } else {
    sculpt(g, [{ x: cx, y: ground - 20, rx: 9.5, ry: 11, p: 3 }], stone, { facets: 3, seed: 4 })
    // The swirl of the 108 spirits sealed inside, and the crack across it.
    stamp(g, ['..111..', '.1...1.', '1..2..1', '1.2.2.1', '1..2...', '.1....1', '..1111.'], { 1: '#a890e8', 2: '#e0d0ff' }, cx - 3, ground - 26)
    stamp(g, ['1....', '.1...', '.11..', '...1.', '....1'], { 1: '#0c0814' }, cx + 3, ground - 30)
  }
  outline(g, '#08060c')
  return piece(g, cx, ground)
}

/** Leaves and earth of the grotto's hollow in each biome, so it hides among the biome's own thickets. */
const HOLLOW: Record<BiomeId, { leaves: Ramp; earth: Ramp; outline: string; snow?: Ramp; bloom?: string }> = {
  meadow: { leaves: ['#1a4c20', '#2c7030', '#45983a', '#69b84c', '#94d468'], earth: ['#2c1c10', '#4a3220', '#6a4a2c', '#8a6638'], outline: '#122a12', bloom: '#f8a0c8' },
  forest: { leaves: ['#0c2812', '#163e1c', '#24582a', '#387838', '#56984a'], earth: ['#1c120a', '#30200f', '#4a3218', '#644626'], outline: '#081408', bloom: '#f8e0d0' },
  cave: { leaves: ['#20283a', '#2e4a44', '#3e6a52', '#5a8a62', '#7aa872'], earth: ['#1c1416', '#342a2c', '#4e4244', '#6a5c5c'], outline: '#100a0c' },
  snow: { leaves: ['#0c2420', '#163a34', '#245a4c', '#367a62'], earth: ['#1a2436', '#2e3e56', '#465a78', '#627a9a'], outline: '#0a1820', snow: ['#9cb4d4', '#d0e0f4', '#f0f6ff', '#ffffff'] },
  tower: { leaves: ['#1c1424', '#2c2438', '#3c3450', '#4c4466', '#5c5478'], earth: ['#1c1424', '#2c2438', '#3c3450', '#4c4466'], outline: '#0c0814', bloom: '#b070c8' },
}

/**
 * The Hidden Grotto's way in (Black 2 and White 2): a low mound of earth and
 * roots under clumps of leaves in the biome's own skin, a dark hollow going
 * down at its front with roots hanging over it, a few flowers. From afar it
 * reads as one more thicket. Anchored at the hollow's foot.
 */
const grottoHollow = (biome: BiomeId): Piece => {
  const skin = HOLLOW[biome]
  const g = grid(50, 36)
  const cx = 25
  const ground = 32
  sculpt(g, [{ x: cx - 13, y: ground - 6, rx: 10, ry: 7 }, { x: cx + 13, y: ground - 6, rx: 10, ry: 7 }, { x: cx, y: ground - 10, rx: 15, ry: 9 }], skin.earth, { facets: 2, seed: 7, rough: 0.15 })
  // The hollow: a dark mouth fading into the earth, and roots hanging across its top.
  for (let y = ground - 14; y <= ground; y++) {
    for (let x = cx - 9; x <= cx + 9; x++) {
      const dx = (x + 0.5 - cx) / 9
      const dy = (y + 0.5 - ground) / 14
      if (dx * dx + dy * dy > 1) continue
      const edge = 1 - Math.sqrt(dx * dx + dy * dy)
      put(g, x, y, edge < 0.12 ? skin.earth[0]! : edge < 0.3 ? '#0c0806' : '#030202')
    }
  }
  for (const [x, len] of [[cx - 5, 5], [cx - 1, 3], [cx + 3, 6], [cx + 6, 3]] as const) for (let k = 0; k < len; k++) put(g, x + (k % 3 === 2 ? 1 : 0), ground - 13 + k, skin.earth[2]!)
  // The leaves over it, clumped like a bush, snow on top in the snow.
  sculpt(
    g,
    [
      { x: cx - 16, y: ground - 13, rx: 8, ry: 6 },
      { x: cx + 16, y: ground - 12, rx: 8, ry: 6 },
      { x: cx - 7, y: ground - 20, rx: 10, ry: 7 },
      { x: cx + 8, y: ground - 21, rx: 10, ry: 7 },
      { x: cx, y: ground - 26, rx: 8, ry: 5 },
    ],
    skin.leaves,
    { tag: 10, seed: 3, rough: 0.2, paint: skin.snow ? (x, y, n, light) => (n.y < -0.45 ? shade(skin.snow!, light + 0.15, x, y) : null) : undefined },
  )
  if (skin.bloom) for (const [x, y] of [[cx - 19, ground - 13], [cx + 13, ground - 18], [cx - 4, ground - 24], [cx + 19, ground - 11]] as const) put(g, x, y, skin.bloom)
  outline(g, skin.outline)
  return piece(g, cx, ground)
}

/**
 * The Underground's way down (Diamond and Pearl): a boulder in the biome's
 * stone with a jagged crack splitting its foot, dark inside, gravel spilled
 * in front. The glint on it is drawn live (`render/places.ts`). Anchored at
 * the crack's foot.
 */
const crackedRock = (biome: BiomeId): Piece => {
  const skin = ROCK_SKINS[biome]
  const g = grid(48, 34)
  const cx = 24
  const ground = 30
  sculpt(
    g,
    [
      { x: cx - 9, y: ground - 12, rx: 13, ry: 11 },
      { x: cx + 9, y: ground - 13, rx: 12, ry: 12 },
      { x: cx + 1, y: ground - 20, rx: 12, ry: 9 },
    ],
    skin.stone,
    {
      facets: 2.5,
      seed: 11,
      rough: 0.12,
      paint: (x, y, n, light) => {
        if (skin.snow && n.y < -0.3) return shade(skin.snow, light + 0.2, x, y)
        if (skin.moss && n.y < -0.4 && noise(x, y, 5) < 0.7) return shade(skin.moss, light, x, y)
        return null
      },
    },
  )
  // The crack: a zigzag widening to a dark gap at the foot.
  const zig = [[0, -27], [-2, -23], [1, -19], [-1, -15], [2, -11], [0, -7], [0, 0]] as const
  for (let i = 0; i < zig.length - 1; i++) {
    const [x0, y0] = zig[i]!
    const [x1, y1] = zig[i + 1]!
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
    for (let k = 0; k <= steps; k++) {
      const x = Math.round(cx + x0 + ((x1 - x0) * k) / steps)
      const y = Math.round(ground + y0 + ((y1 - y0) * k) / steps)
      const half = Math.max(0, Math.round((y - (ground - 12)) / 3))
      for (let dx = -half; dx <= half + 1; dx++) put(g, x + dx, y, dx === -half || dx === half + 1 ? skin.stone[0]! : '#050404')
    }
  }
  // Gravel spilled out in front.
  for (const [x, y] of [[cx - 7, ground + 1], [cx - 4, ground + 2], [cx + 5, ground + 1], [cx + 8, ground + 2], [cx + 2, ground + 2]] as const) put(g, x, y, skin.stone[2]!)
  outline(g, skin.outline)
  return piece(g, cx, ground)
}

/** Every piece by kind: `variant` picks a look, and the cave's mouth wears the biome it stands in. */
export const PLACE_PIECES: Record<PlacePiece, (variant: number, biome: BiomeId) => Piece> = {
  caveMouth: (_v, biome) => caveMouth(biome),
  graveGate,
  windStone,
  caveRock: (v) => stalagmites(CAVE_STONE, v + 5),
  crystal,
  chest,
  tombstone,
  graveCross,
  deadTree: () => deadTree(TOWER_TREE),
  keystone,
  grottoHollow: (_v, biome) => grottoHollow(biome),
  crackedRock: (_v, biome) => crackedRock(biome),
}

/** Shadow width of each piece, and which ones are tall enough to go see-through. */
export const PLACE_SHADOW: Record<PlacePiece, number> = {
  caveMouth: 0,
  graveGate: 0,
  windStone: 6,
  caveRock: 8,
  crystal: 7,
  chest: 11,
  tombstone: 7,
  graveCross: 5,
  deadTree: 9,
  keystone: 12,
  grottoHollow: 0,
  crackedRock: 20,
}

export const PLACE_TALL: Record<PlacePiece, boolean> = {
  caveMouth: true,
  graveGate: false,
  windStone: false,
  caveRock: true,
  crystal: false,
  chest: false,
  tombstone: false,
  graveCross: false,
  deadTree: true,
  keystone: false,
  grottoHollow: false,
  crackedRock: false,
}

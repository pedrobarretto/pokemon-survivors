import { cone, cylinder, grid, limb, noise, outline, put, sculpt, shade, stamp, toSprite, type Blob, type Grid, type Ramp } from './sculpt'
import type { Piece } from './terrain'

/**
 * Sculpted scenery of the newer biomes (`data/biomes.ts`): the beach's palms
 * and lighthouse, the Power Plant's machines, pylons and smokestack, the
 * desert's saguaros, and the stand-ins for their painted structures while
 * the pictures load (`render/scenery.ts`: the Mirage Tower for the pyramids,
 * a cinder cone for Mt. Chimney's volcano). Built once per biome and cached
 * by `render/terrain.ts`, like the rest of its skins.
 */

const piece = (g: Grid, ax: number, ay: number): Piece => ({ sprite: toSprite(g), ax: Math.round(ax), ay: Math.round(ay) })

/* ---------------- Beach (Route 109) ---------------- */

const PALM_TRUNK: Ramp = ['#4c3420', '#6c4c2c', '#8c6a3c', '#ac8a54']
const PALM_RINGS: Ramp = ['#3c2814', '#5c3e22', '#7c5830']
export const PALM_LEAVES: Ramp = ['#1c4c24', '#2c6c30', '#45983a', '#6cbc4c', '#9cd868']

/** A palm leaning over the sand: a ringed, curving trunk, drooping fronds and coconuts. */
export const palm = (height: number, seed: number): Piece => {
  const lean = (noise(seed, 1, 5) - 0.5) * 14
  const w = 56
  const h = Math.ceil(height) + 22
  const g = grid(w, h)
  const cx = w / 2
  const ground = h - 3
  const steps = Math.ceil(height / 3)
  let px = cx
  let py = ground
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const x = cx + lean * t * t
    const y = ground - height * t
    limb(g, px, py, x, y, 2.8 - t * 0.9, 2.8 - t * 0.9, i % 2 === 0 ? PALM_RINGS : PALM_TRUNK)
    px = x
    py = y
  }
  const tx = px
  const ty = py
  // Fronds: arcs out from the crown, drooping more the longer they reach, with leaflets down their sides.
  const fronds = [-2.7, -2.2, -1.6, -0.9, -0.3, 0.4, 1.1]
  fronds.forEach((a, i) => {
    const len = 15 + noise(i, seed, 7) * 6
    let fx = tx
    let fy = ty
    for (let s = 1; s <= 8; s++) {
      const t = s / 8
      const nx = tx + Math.cos(a) * len * t
      const ny = ty + Math.sin(a) * len * t * 0.55 + t * t * 9
      limb(g, fx, fy, nx, ny, 1.4 - t * 0.8, 1.4 - t * 0.8, PALM_LEAVES)
      if (s > 1 && s < 8) {
        put(g, Math.round(nx), Math.round(ny + 2), PALM_LEAVES[1]!)
        put(g, Math.round(nx), Math.round(ny + 3), PALM_LEAVES[0]!)
      }
      fx = nx
      fy = ny
    }
  })
  for (const [dx, dy] of [[-2, 2], [2, 3], [0, 4]] as const) stamp(g, ['.11.', '1221', '.11.'], { 1: '#3c2410', 2: '#7c5428' }, tx + dx - 2, ty + dy - 1)
  outline(g, '#102010')
  return piece(g, cx, ground)
}

/** A lighthouse in red and white bands, its lamp lit (the beach's tower). */
export const lighthouse = (): Piece => {
  const g = grid(44, 116)
  const cx = 22
  const ground = 110
  const white: Ramp = ['#7c8494', '#a8b0bc', '#d0d6de', '#eef2f6', '#ffffff']
  const red: Ramp = ['#601414', '#902020', '#c03430', '#e05448']
  cylinder(g, cx, ground, 12, 72, white, {
    top: null,
    paint: (x, y, nx, e, l) => {
      if (e < 10 && Math.abs(nx + 0.05) < 0.24 && !(e === 9 && Math.abs(nx + 0.05) > 0.16)) return '#20140c'
      if (e > 44 && e < 49 && Math.abs(nx + 0.1) < 0.16) return '#20283c'
      return Math.floor(e / 14) % 2 === 1 ? shade(red, l, x, y) : shade(white, l, x, y)
    },
  })
  cylinder(g, cx, ground - 72, 14.5, 3, ['#2c2c34', '#4c4c58', '#6c6c78'], { ry: 5.8 })
  cylinder(g, cx, ground - 75, 7.5, 11, ['#c8a028', '#f8e070', '#fff8c0', '#ffffff'], {
    top: null,
    paint: (x, y, nx, e, l) => (Math.abs(nx) > 0.8 || e > 9 ? shade(['#2c2c34', '#4c4c58', '#6c6c78'], l, x, y) : null),
  })
  cone(g, cx, ground - 86, 10, 12, red, { ry: 4 })
  limb(g, cx, ground - 98, cx, ground - 102, 0.8, 0.5, ['#2c2c34', '#6c6c78'])
  outline(g, '#141018')
  return piece(g, cx, ground)
}

/* ---------------- Power Plant (Kanto) ---------------- */

const STEEL: Ramp = ['#30343c', '#4c525c', '#6c7480', '#8c96a2', '#b0b8c4']
const STEEL_TOP: Ramp = ['#6c7480', '#8c96a2', '#a8b0bc', '#c8d0da']
const HAZARD = ['#f8d030', '#202020'] as const
const BOLT = ['..11', '.11.', '1111', '.11.', '11..']

/** A cuboid seen from the front and above: its lit front face and its top. */
const box = (g: Grid, x0: number, x1: number, ground: number, height: number, depth: number, front: Ramp, top: Ramp, paint?: (x: number, e: number) => string | null) => {
  for (let x = x0; x <= x1; x++) {
    const across = (x - x0) / Math.max(1, x1 - x0)
    for (let e = 0; e < height; e++) {
      const y = ground - e
      put(g, x, y, paint?.(x, e) ?? shade(front, 0.72 - across * 0.32 + (e < 2 ? -0.2 : 0) + (noise(x, e, 3) - 0.5) * 0.08, x, y))
    }
    for (let d = 0; d < depth; d++) put(g, x, ground - height - d, shade(top, 0.8 - d * 0.03 - across * 0.15, x, d))
  }
}

/** The Power Plant's rocks: a generator with vents and a bolt sign, a transformer drum with insulators, a control cabinet with lamps. */
export const machine = (variant: number): Piece => {
  const g = grid(36, 40)
  const ground = 36
  const kind = variant % 3
  if (kind === 0) {
    box(g, 4, 31, ground, 17, 8, STEEL, STEEL_TOP, (x, e) => {
      if (e < 2) return (x >> 1) % 2 === 0 ? HAZARD[0] : HAZARD[1]
      if (e > 9 && e < 15 && x > 18 && x < 29 && e % 2 === 0) return '#20242c'
      return null
    })
    stamp(g, BOLT, { 1: '#f8d030' }, 8, ground - 13)
  } else if (kind === 1) {
    cylinder(g, 18, ground, 11, 18, STEEL, { top: STEEL_TOP, paint: (x, y, nx, e, l) => (Math.round((nx + 1) * 6) % 2 === 0 ? shade(STEEL, l - 0.25, x, y) : e < 2 ? HAZARD[1] : null) })
    for (const dx of [-6, 0, 6]) {
      limb(g, 18 + dx, ground - 20, 18 + dx, ground - 27, 1.4, 1.1, ['#8c5c3c', '#c8b090', '#f0e8dc'])
      put(g, 18 + dx, ground - 28, '#3c3c48')
    }
  } else {
    box(g, 8, 27, ground, 26, 6, STEEL, STEEL_TOP, (x, e) => (e < 2 ? ((x >> 1) % 2 === 0 ? HAZARD[0] : HAZARD[1]) : x === 17 && e < 22 ? '#30343c' : null))
    for (const [x, y, c] of [[11, ground - 21, '#f84030'], [14, ground - 21, '#f8d030'], [20, ground - 21, '#48e060'], [23, ground - 21, '#48e060']] as const) {
      put(g, x, y, c)
      put(g, x + 1, y, c)
    }
    for (let y = ground - 16; y < ground - 6; y += 3) for (let x = 11; x <= 15; x++) put(g, x, y, '#20242c')
  }
  outline(g, '#14161c')
  return piece(g, 18, ground)
}

/** A power pole with two crossarms, ceramic insulators and the wires' first sag (the Power Plant's trees). */
export const pylon = (seed: number): Piece => {
  const g = grid(44, 96)
  const cx = 22
  const ground = 92
  const wood: Ramp = ['#2c2018', '#4a3424', '#6a4c34', '#8a6644']
  limb(g, cx, ground, cx, ground - 80, 2.4, 1.8, wood)
  limb(g, cx - 4, ground, cx - 1, ground - 6, 1, 1.4, wood)
  for (const [y, half] of [[ground - 74, 17], [ground - 62, 12]] as const) {
    limb(g, cx - half, y, cx + half, y, 1.1, 1.1, STEEL)
    for (const x of [cx - half + 1, cx + half - 1, cx - half / 2, cx + half / 2]) {
      stamp(g, ['.1.', '121', '.1.', '121'], { 1: '#8c8c98', 2: '#f0f0f8' }, x - 1, y - 5)
      // The wires leave the frame sagging a little.
      const side = x < cx ? -1 : 1
      for (let k = 0; k < 6; k++) put(g, Math.round(x + side * k), Math.round(y - 5 + (k * k) / 12), '#1c1c24')
    }
  }
  if (noise(seed, 3, 9) < 0.5) stamp(g, ['1111', '1221', '1221', '1111'], { 1: '#1c1c24', 2: '#f8d030' }, cx - 2, ground - 40)
  outline(g, '#121218')
  return piece(g, cx, ground)
}

/** Drums of fuel standing together (the Power Plant's bushes), yellow or blue. */
export const barrels = (variant: number): Piece => {
  const g = grid(30, 24)
  const ground = 21
  const ramps: readonly Ramp[] = [['#6c4c08', '#a87810', '#e0b020', '#f8d850'], ['#102c58', '#1c4c8c', '#3070c0', '#5898e0']]
  const ramp = ramps[variant % ramps.length]!
  const band = (x: number, y: number, _nx: number, e: number, l: number) => (e === 3 || e === 9 ? shade(STEEL, l, x, y) : null)
  cylinder(g, 9, ground - 1, 5.5, 12, ramp, { top: STEEL_TOP, paint: band })
  cylinder(g, 20, ground, 5.5, 12, ramp, { top: STEEL_TOP, paint: band })
  if (variant > 0) stamp(g, ['.1.', '111', '.1.'], { 1: '#202020' }, 19, ground - 9)
  outline(g, '#14161c')
  return piece(g, 15, ground)
}

const RUST: Ramp = ['#3c1c10', '#6c3418', '#9c5424', '#c47838', '#e09c58']
const WEEDS: Ramp = ['#1c2c14', '#2c4420', '#40602c', '#5c7c38', '#7c9848']

/** Weeds sprouting around a piece's foot, `n` tufts across `span` px (the plant gone wild). */
const weeds = (g: Grid, cx: number, ground: number, span: number, n: number, seed: number) => {
  for (let i = 0; i < n; i++) {
    const x = cx - span / 2 + (span * (i + 0.5)) / n + (noise(i, seed, 3) - 0.5) * 3
    const tall = 4 + noise(i, seed, 4) * 6
    limb(g, x, ground, x + (noise(i, seed, 5) - 0.5) * 4, ground - tall, 1.1, 0.4, WEEDS)
  }
}

/** A heap of scrap: rusted plates and drums, pipes and a girder sticking out (the Power Plant's overgrown thickets). */
export const scrapHeap = (seed: number): Piece => {
  const g = grid(42, 38)
  const cx = 21
  const ground = 34
  const flip = noise(seed, 1, 13) < 0.5 ? -1 : 1
  // What sticks out goes in first, so the heap covers its foot.
  limb(g, cx - 6 * flip, ground - 8, cx - 15 * flip, ground - 27, 1.6, 1.4, STEEL)
  limb(g, cx + 4 * flip, ground - 10, cx + 16 * flip, ground - 22, 2.2, 2.2, RUST)
  stamp(g, ['11', '22'], { 1: STEEL[1]!, 2: STEEL[0]! }, cx + 15 * flip - 1, ground - 24)
  const blobs: Blob[] = [
    { x: cx - 9, y: ground - 6, rx: 9, ry: 6.5 },
    { x: cx + 9, y: ground - 6, rx: 9, ry: 6 },
    { x: cx + 1, y: ground - 13, rx: 9, ry: 8 },
    { x: cx - 4, y: ground - 3, rx: 11, ry: 4.5 },
    { x: cx + 7, y: ground - 3, rx: 9, ry: 4 },
  ]
  sculpt(g, blobs, RUST, {
    tag: 10,
    seed,
    facets: 2,
    rough: 0.25,
    // Some plates still steel, the rest rusted through.
    paint: (x, y, _n, light, i) => (noise(i, seed, 7) < 0.4 ? shade(STEEL, light, x, y) : null),
  })
  // A drum lying on the heap and a tire half sunk in it.
  cylinder(g, cx - 7 * flip, ground - 9, 4, 7, ['#6c4c08', '#a87810', '#e0b020', '#f8d850'], { top: STEEL_TOP })
  stamp(g, ['.111.', '1...1', '1...1', '.111.'], { 1: '#1c1c24' }, cx + 4 * flip - 2, ground - 9)
  weeds(g, cx, ground + 1, 34, 6, seed)
  outline(g, '#14161c')
  return piece(g, cx, ground)
}

/** A run of pipes up out of the ground and over in elbows, a valve wheel on one, weeds at their feet. */
export const pipeRun = (seed: number): Piece => {
  const g = grid(40, 50)
  const cx = 20
  const ground = 46
  const paint: Ramp = noise(seed, 2, 13) < 0.5 ? ['#1c3c34', '#2c5c4c', '#3c7c64', '#5c9c80', '#84bca0'] : STEEL
  const legs = [[-9, 30], [0, 38], [9, 24]] as const
  for (const [dx, tall] of legs) {
    cylinder(g, cx + dx, ground, 3.4, tall, paint, { top: null, paint: (x, y, _nx, e, l) => (e < 3 ? shade(RUST, l, x, y) : e % 9 === 4 ? shade(paint, l - 0.3, x, y) : null) })
  }
  // Elbows and the run across the tops.
  limb(g, cx - 9, ground - 31, cx - 9, ground - 36, 3.4, 3.4, paint)
  limb(g, cx - 9, ground - 37, cx + 1, ground - 39, 3.2, 3.2, paint)
  limb(g, cx + 9, ground - 25, cx + 14, ground - 25, 3, 3, paint)
  // The valve wheel.
  stamp(g, ['.111.', '1.1.1', '11211', '1.1.1', '.111.'], { 1: '#c03430', 2: '#f0d0c0' }, cx - 2, ground - 22)
  weeds(g, cx, ground + 1, 30, 7, seed + 4)
  outline(g, '#14161c')
  return piece(g, cx, ground)
}

/** A concrete smokestack with warning bands and a red lamp, a bolt painted on its side (the Power Plant's tower). */
export const smokestack = (): Piece => {
  const g = grid(40, 120)
  const cx = 20
  const ground = 114
  const concrete: Ramp = ['#4c5058', '#6c7078', '#8c9098', '#acb0b8', '#c8ccd4']
  const red: Ramp = ['#601414', '#902020', '#c03430', '#e05448']
  cylinder(g, cx, ground, 11, 92, concrete, {
    top: ['#14161c', '#20242c'],
    paint: (x, y, nx, e, l) => {
      if (e > 78 && Math.floor((e - 78) / 4) % 2 === 0) return shade(red, l, x, y)
      if (e < 8 && Math.abs(nx + 0.05) < 0.22) return '#14161c'
      return Math.floor(e / 6) % 2 === 0 && Math.round((nx + 1) * 8) % 4 === 0 ? shade(concrete, l - 0.2, x, y) : null
    },
  })
  stamp(g, ['...111', '..111.', '.111..', '111111', '..111.', '.111..', '111...'], { 1: '#f8d030' }, cx - 5, ground - 52)
  stamp(g, ['.1.', '121', '.1.'], { 1: '#902020', 2: '#ff6050' }, cx - 1, ground - 98)
  outline(g, '#14161c')
  return piece(g, cx, ground)
}

/* ---------------- Desert (Route 111) ---------------- */

const CACTUS: Ramp = ['#1c3c1c', '#2c5c28', '#3c7834', '#58a040', '#80c058']
const ribs = (x: number, y: number, nx: number, _e: number, l: number) => (Math.round((nx + 1) * 4) % 2 === 0 ? shade(CACTUS, l - 0.22, x, y) : noise(x, y, 4) < 0.04 ? '#e8f0c8' : null)

/** A saguaro with two arms, ribbed and spined, a flower on top (the desert's trees). */
export const saguaro = (seed: number): Piece => {
  const g = grid(34, 56)
  const cx = 17
  const ground = 52
  const tall = 34 + Math.floor(noise(seed, 1, 2) * 8)
  cylinder(g, cx, ground, 4.5, tall, CACTUS, { top: CACTUS, paint: ribs })
  const arms = [[-1, 16 + Math.floor(noise(seed, 2, 2) * 6), 10], [1, 22 + Math.floor(noise(seed, 3, 2) * 6), 9]] as const
  for (const [side, at, up] of arms) {
    const ax = cx + side * 9
    limb(g, cx + side * 3, ground - at, ax, ground - at, 2.6, 2.6, CACTUS)
    cylinder(g, ax, ground - at, 2.6, up, CACTUS, { top: CACTUS, paint: ribs })
  }
  stamp(g, ['1.1', '.2.'], { 1: '#f878a0', 2: '#f8d030' }, cx - 1, ground - tall - 3)
  outline(g, '#102010')
  return piece(g, cx, ground)
}

const PAD: Ramp = ['#1c3c1c', '#2c5c28', '#3c7834', '#58a040', '#80c058']

/** A prickly pear: flat pads grown one on another, spined, fruit on their rims (the desert's scrub in a thicket). */
export const pricklyPear = (seed: number): Piece => {
  const g = grid(36, 38)
  const cx = 18
  const ground = 34
  const lean = noise(seed, 1, 17) < 0.5 ? -1 : 1
  const pads: Blob[] = [
    { x: cx - 7, y: ground - 7, rx: 5.5, ry: 7 },
    { x: cx + 6, y: ground - 8, rx: 5.5, ry: 7.5 },
    { x: cx, y: ground - 17, rx: 6, ry: 7.5 },
    { x: cx - 9 * lean, y: ground - 21, rx: 4.5, ry: 6 },
    { x: cx + 5 * lean, y: ground - 27, rx: 4.5, ry: 5.5 },
  ]
  sculpt(g, pads, PAD, {
    tag: 10,
    seed,
    rough: 0.15,
    paint: (x, y, n, light) => (noise(x, y, seed + 2) < 0.05 && n.z > 0.3 ? '#e8f0c8' : shade(PAD, light, x, y)),
  })
  for (const b of pads.slice(2)) stamp(g, ['1', '2'], { 1: '#f878a0', 2: '#c83c68' }, b.x + 2, b.y - b.ry)
  outline(g, '#102010')
  return piece(g, cx, ground)
}

/** Mirage Tower: a sandstone tower half sunk in the dunes, a band spiraling up it, its top crumbling (the desert's tower). */
export const mirageTower = (): Piece => {
  const g = grid(52, 112)
  const cx = 26
  const ground = 104
  const stone: Ramp = ['#6c4428', '#94603a', '#b8804c', '#d4a064', '#ecc488']
  cylinder(g, cx, ground, 15, 82, stone, {
    top: null,
    paint: (x, y, nx, e, l) => {
      if (e > 82 - Math.floor(noise(x, 0, 6) * 9)) return 'gone'
      const spiral = (e + Math.round((nx + 1) * 10)) % 22
      if (spiral < 3) return shade(stone, l - 0.3, x, y)
      if (e % 6 === 0) return shade(stone, l - 0.15, x, y)
      for (const at of [24, 50, 70]) if (e >= at && e < at + 6 && Math.abs(nx + 0.1) < 0.12) return '#2c1c10'
      return null
    },
  })
  for (let i = 0; i < g.px.length; i++) if (g.px[i] === 'gone') g.px[i] = null
  sculpt(g, [{ x: cx - 13, y: ground + 1, rx: 9, ry: 4 }, { x: cx + 12, y: ground + 2, rx: 10, ry: 4 }, { x: cx, y: ground + 4, rx: 14, ry: 3 }], ['#c49460', '#dcb474', '#ecc488', '#f8dca4'], { tag: 30, rough: 0.1 })
  outline(g, '#24140c')
  return piece(g, cx, ground)
}

/* ---------------- Volcano (Mt. Chimney) ---------------- */

export const BASALT: Ramp = ['#1c1416', '#2e2426', '#423436', '#584848', '#6e5e5c']
export const EMBER: Ramp = ['#802010', '#c83c14', '#f86818', '#f8b040']

/** A smoking cinder cone, lava streaking down from its glowing crater (Mt. Chimney's tower). */
export const cinderCone = (): Piece => {
  const g = grid(72, 104)
  const cx = 36
  const ground = 98
  cone(g, cx, ground, 30, 66, BASALT, { rows: 7, ry: 9 })
  // The crater's rim and the lava in it.
  const top = ground - 66 + 8
  for (let x = -6; x <= 6; x++) for (let y = -2; y <= 2; y++) if ((x / 6) ** 2 + (y / 2) ** 2 <= 1) put(g, cx + x, top + y, y < 0 ? EMBER[3]! : EMBER[2]!)
  // Streaks down the flanks.
  for (const [dx, len, seed] of [[-3, 30, 1], [2, 44, 2], [5, 24, 3]] as const) {
    let x = cx + dx
    for (let k = 0; k < len; k++) {
      const y = top + 2 + k
      x += noise(k >> 2, seed, 11) < 0.5 ? -0.35 : 0.35
      put(g, Math.round(x), y, shade(EMBER, 0.9 - k / len, Math.round(x), y))
    }
  }
  // Smoke above.
  sculpt(g, [{ x: cx - 2, y: top - 8, rx: 6, ry: 4 }, { x: cx + 4, y: top - 15, rx: 7, ry: 5 }, { x: cx - 3, y: top - 22, rx: 6, ry: 4 }], ['#4c4448', '#6c6468', '#8c8488', '#aca4a8'], { tag: 40, rough: 0.2 })
  outline(g, '#0c0808')
  return piece(g, cx, ground)
}

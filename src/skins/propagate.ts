/**
 * Skin propagation: a skin is a Pokémon's sprite sheets redrawn (a suit, a
 * bandana), but only a few frames are drawn by hand, the keyframes. Every
 * other frame takes its keyframe's changes by following the sprite's own
 * motion: each pixel of the target frame is matched, by the colors around it,
 * to the pixel of the keyframe's original it came from, and takes what the
 * artist drew there. A leg that steps forward carries its trouser with it; a
 * pixel the arm now covers stays the arm.
 *
 * Pure math on color-id grids, shared by the Ateliê (`src/atelier`) and
 * `scripts/skins.mjs`.
 */

/** A frame as color ids (0 clear), `w` × `h`, row by row. */
export type Grid = { w: number; h: number; px: Int32Array }

/** A keyframe: the sprite's original frame and the same frame as the artist drew it. */
export type Key = { K: Grid; E: Grid }

/** A propagated frame, and how much each pixel can be trusted (`DOUBT`). */
export type Propagated = { out: Grid; doubt: Uint8Array; cost: number }

/** Why a pixel is marked: the match near an edit was poor, or the cleanup changed it. */
export const DOUBT = { none: 0, match: 1, cleanup: 2 } as const

export const emptyGrid = (w: number, h: number): Grid => ({ w, h, px: new Int32Array(w * h) })

export const at = (g: Grid, x: number, y: number) => (x < 0 || y < 0 || x >= g.w || y >= g.h ? 0 : g.px[y * g.w + x]!)

export const mirrorGrid = (g: Grid): Grid => {
  const px = new Int32Array(g.w * g.h)
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) px[y * g.w + x] = g.px[y * g.w + g.w - 1 - x]!
  return { w: g.w, h: g.h, px }
}

export const sameGrid = (a: Grid, b: Grid) => a.w === b.w && a.h === b.h && a.px.every((v, i) => v === b.px[i])

const SHIFT = 10
/** How far a pixel may move against the global shift. */
const R = 3
/** The matching window's half size. */
const WIN = 2

/**
 * The shift that lays the keyframe's original over the target best
 * (`T(x, y) ≈ K(x - gx, y - gy)`), frames first centered on each other, and its
 * mismatch per opaque pixel: how alike the poses are, which picks the keyframe.
 */
export const globalShift = (T: Grid, K: Grid) => {
  const cx = (K.w - T.w) >> 1
  const cy = (K.h - T.h) >> 1
  let opaque = 0
  for (const v of T.px) if (v) opaque++
  let best = { cost: Infinity, gx: 0, gy: 0 }
  for (let sy = -SHIFT; sy <= SHIFT; sy++) {
    for (let sx = -SHIFT; sx <= SHIFT; sx++) {
      let c = 0.01 * (sx * sx + sy * sy)
      for (let y = 0; y < T.h && c < best.cost * opaque; y++) {
        for (let x = 0; x < T.w; x++) {
          const t = T.px[y * T.w + x]!
          const k = at(K, x + cx - sx, y + cy - sy)
          if (t !== k) c += t && k ? 1 : 2
        }
      }
      if (c / Math.max(1, opaque) < best.cost) best = { cost: c / Math.max(1, opaque), gx: sx - cx, gy: sy - cy }
    }
  }
  return best
}

/** Whether the artist changed anything within `r` px of (x, y) on the keyframe. */
const editedNear = (edit: Uint8Array, w: number, h: number, x: number, y: number, r: number) => {
  for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++) for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) if (edit[yy * w + xx]) return true
  return false
}

/**
 * The target frame `T` dressed by a keyframe: block matching of every pixel
 * near the artist's changes (the global shift, then ±`R` px, smoothed toward
 * its neighbours' motion), a pixel taking the drawn color only from a source
 * of its own original color; pixels drawn outside the original silhouette
 * (a bandana's tails) follow the nearest matched body pixel; a cleanup fills
 * lone pixels the match missed inside the change and drops lone stray ones.
 */
export const propagate = (T: Grid, key: Key, shift = globalShift(T, key.K)): Propagated => {
  const { K, E } = key
  const { gx, gy } = shift
  const n = T.w * T.h
  const edit = new Uint8Array(K.w * K.h)
  for (let i = 0; i < edit.length; i++) edit[i] = E.px[i] !== K.px[i] ? 1 : 0
  const out = Int32Array.from(T.px)
  const doubt = new Uint8Array(n)
  const live = new Uint8Array(n)
  for (let y = 0; y < T.h; y++) for (let x = 0; x < T.w; x++) if (T.px[y * T.w + x] && editedNear(edit, K.w, K.h, x - gx, y - gy, R + WIN + 1)) live[y * T.w + x] = 1

  const cost = (x: number, y: number, ox: number, oy: number) => {
    let c = 0
    for (let wy = -WIN; wy <= WIN; wy++) {
      for (let wx = -WIN; wx <= WIN; wx++) {
        if (at(T, x + wx, y + wy) !== at(K, x + wx - ox, y + wy - oy)) c += wx || wy ? 1 : 50
      }
    }
    return c
  }
  const dx = new Int8Array(n)
  const dy = new Int8Array(n)
  const best = new Float32Array(n)
  for (let q = 0; q < n; q++) {
    if (!live[q]) continue
    const x = q % T.w
    const y = (q / T.w) | 0
    let b = Infinity
    for (let ddy = -R; ddy <= R; ddy++) {
      for (let ddx = -R; ddx <= R; ddx++) {
        const c = cost(x, y, gx + ddx, gy + ddy) + 0.3 * (Math.abs(ddx) + Math.abs(ddy))
        if (c < b) {
          b = c
          dx[q] = ddx
          dy[q] = ddy
        }
      }
    }
    best[q] = b
  }
  // Ties in flat colors go the way the neighbours move.
  for (let it = 0; it < 2; it++) {
    const ndx = Int8Array.from(dx)
    const ndy = Int8Array.from(dy)
    for (let q = 0; q < n; q++) {
      if (!live[q]) continue
      const x = q % T.w
      const y = (q / T.w) | 0
      const xs: number[] = []
      const ys: number[] = []
      for (let wy = -2; wy <= 2; wy++) {
        for (let wx = -2; wx <= 2; wx++) {
          const xx = x + wx
          const yy = y + wy
          if (xx < 0 || yy < 0 || xx >= T.w || yy >= T.h || !live[yy * T.w + xx]) continue
          xs.push(dx[yy * T.w + xx]!)
          ys.push(dy[yy * T.w + xx]!)
        }
      }
      xs.sort((a, b) => a - b)
      ys.sort((a, b) => a - b)
      const mx = xs[xs.length >> 1] ?? 0
      const my = ys[ys.length >> 1] ?? 0
      let b = Infinity
      for (let ddy = -R; ddy <= R; ddy++) {
        for (let ddx = -R; ddx <= R; ddx++) {
          const raw = cost(x, y, gx + ddx, gy + ddy)
          const c = raw + 0.8 * (Math.abs(ddx - mx) + Math.abs(ddy - my))
          if (c < b) {
            b = c
            ndx[q] = ddx
            ndy[q] = ddy
            best[q] = raw
          }
        }
      }
    }
    dx.set(ndx)
    dy.set(ndy)
  }

  // Backward: each target pixel takes its source's drawn color.
  const target = new Int32Array(K.w * K.h).fill(-1)
  for (let q = 0; q < n; q++) {
    if (!live[q]) continue
    const x = q % T.w
    const y = (q / T.w) | 0
    const sx = x - gx - dx[q]!
    const sy = y - gy - dy[q]!
    const k = at(K, sx, sy)
    if (k !== T.px[q]) {
      if (sx >= 0 && sy >= 0 && sx < K.w && sy < K.h && edit[sy * K.w + sx]) doubt[q] = DOUBT.match
      continue
    }
    const s = sy * K.w + sx
    target[s] = q
    if (edit[s]) out[q] = E.px[s]!
    if (best[q]! >= 14 && edit[s]) doubt[q] = DOUBT.match
  }

  // Forward: what was drawn beyond the original silhouette rides the nearest matched pixel.
  for (let ay = 0; ay < K.h; ay++) {
    for (let ax = 0; ax < K.w; ax++) {
      const a = ay * K.w + ax
      if (K.px[a] || !E.px[a]) continue
      let place = -1
      search: for (let r = 1; r <= 3; r++) {
        for (let yy = ay - r; yy <= ay + r; yy++) {
          for (let xx = ax - r; xx <= ax + r; xx++) {
            if (xx < 0 || yy < 0 || xx >= K.w || yy >= K.h) continue
            const q = target[yy * K.w + xx]!
            if (q < 0) continue
            const tx = (q % T.w) + ax - xx
            const ty = ((q / T.w) | 0) + ay - yy
            if (tx >= 0 && ty >= 0 && tx < T.w && ty < T.h) place = ty * T.w + tx
            break search
          }
        }
      }
      if (place < 0) {
        const tx = ax + gx
        const ty = ay + gy
        if (tx >= 0 && ty >= 0 && tx < T.w && ty < T.h) place = ty * T.w + tx
      }
      if (place >= 0 && !T.px[place] && !out[place]) out[place] = E.px[a]!
    }
  }

  // Cleanup: lone unchanged pixels inside the change take the majority around them; a changed pixel alone
  // where the artist drew a patch (not a one-pixel detail) strayed, and goes back.
  const editsAround = (sx: number, sy: number) => {
    let n = 0
    for (let wy = -1; wy <= 1; wy++) for (let wx = -1; wx <= 1; wx++) if (at(K, sx + wx, sy + wy) !== at(E, sx + wx, sy + wy)) n++
    return n
  }
  const changeable = new Set<number>()
  for (let i = 0; i < edit.length; i++) if (edit[i]) changeable.add(K.px[i]!)
  const fixed = Int32Array.from(out)
  const changed = (q: number) => out[q] !== T.px[q]
  for (let y = 0; y < T.h; y++) {
    for (let x = 0; x < T.w; x++) {
      const q = y * T.w + x
      if (!T.px[q] || !live[q]) continue
      const count = new Map<number, number>()
      let near = 0
      let all = 0
      for (let wy = -1; wy <= 1; wy++) {
        for (let wx = -1; wx <= 1; wx++) {
          if (!wx && !wy) continue
          const xx = x + wx
          const yy = y + wy
          if (xx < 0 || yy < 0 || xx >= T.w || yy >= T.h || !T.px[yy * T.w + xx]) continue
          all++
          const k = yy * T.w + xx
          if (changed(k)) {
            near++
            count.set(out[k]!, (count.get(out[k]!) ?? 0) + 1)
          }
        }
      }
      if (!changed(q) && changeable.has(T.px[q]!) && near >= 5) {
        fixed[q] = [...count].sort((a, b) => b[1] - a[1])[0]![0]
        doubt[q] = DOUBT.cleanup
      } else if (changed(q) && near === 0 && all >= 4 && editsAround(x - gx - dx[q]!, y - gy - dy[q]!) > 1) {
        fixed[q] = T.px[q]!
        doubt[q] = DOUBT.cleanup
      }
    }
  }
  return { out: { w: T.w, h: T.h, px: fixed }, doubt, cost: shift.cost }
}

/**
 * The keyframe a target frame follows: the one whose original lies over it
 * best, among its own direction's keyframes and the mirrored ones of the
 * direction across (a mirrored keyframe pays a little more, so a direction's
 * own wins a tie). Null when no keyframe covers the direction.
 */
export const pickKey = <K extends Key & { mirrored: boolean }>(T: Grid, keys: readonly K[]) => {
  let best: { key: K; shift: ReturnType<typeof globalShift> } | null = null
  for (const key of keys) {
    const shift = globalShift(T, key.K)
    const cost = shift.cost * (key.mirrored ? 1.15 : 1)
    if (!best || cost < best.shift.cost * (best.key.mirrored ? 1.15 : 1)) best = { key, shift }
  }
  return best
}

/**
 * Deterministic math for the simulation. JavaScript only promises exact
 * results for + − × ÷ and `Math.sqrt` (IEEE 754); `Math.sin`, `Math.atan2`,
 * `Math.hypot`, `Math.exp` and `**` may differ in the last bit between engines
 * (V8 in Chrome and Node, JavaScriptCore in Safari and every iOS browser), and
 * a run that drifts by one bit drifts for good. Built only from exact
 * operations, these give the same bits everywhere, so a replay re-simulated on
 * the server ends where it ended on the player's phone. Accurate to ~1e-15.
 *
 * `Math.round` is exact by the spec, but JavaScriptCore's optimizing JITs got
 * it wrong until 2026 (`round` below), so it is banned too.
 *
 * `src/game` uses these instead of `Math.*` (and `x * x` instead of `x ** 2`);
 * `src/engine/dmathGuard.test.ts` fails on any banned call in the simulation.
 */

const PI = Math.PI
const HALF_PI = PI / 2
// π/2 split in two (Cody–Waite), so `x - n·π/2` keeps its low bits.
const HALF_PI_HI = 1.5707963267341256
const HALF_PI_LO = 6.077100506506192e-11

/**
 * `Math.round`, bit for bit (−0 included), on every engine. JavaScriptCore's
 * DFG and FTL JITs (Safari, every iOS browser) compiled a hot `Math.round(x)`
 * whose result is used as an integer to `floor(x + 0.5)`, which gives 1 for
 * 0.49999999999999994 (the double just under ½: `x + 0.5` rounds up to 1);
 * fixed in WebKit only in May 2026 (bug 312687). That value is what
 * `atan2(…)/(π/4)` gives for a stick at 22.5° (`dir8`), and a co-op iPhone
 * faced another way than its teammates. Floor and an exact subtraction
 * (`x - floor(x)` loses no bits) can't be miscompiled that way.
 */
export const round = (x: number) => {
  const f = Math.floor(x)
  const r = x - f >= 0.5 ? f + 1 : f
  return r === 0 && x < 0 ? -0 : r
}

/** sin on [-π/4, π/4] (Taylor to x¹⁵). */
const sinKernel = (x: number) => {
  const z = x * x
  return x * (1 + z * (-1 / 6 + z * (1 / 120 + z * (-1 / 5040 + z * (1 / 362880 + z * (-1 / 39916800 + z * (1 / 6227020800 + z * (-1 / 1307674368000))))))))
}

/** cos on [-π/4, π/4] (Taylor to x¹⁶). */
const cosKernel = (x: number) => {
  const z = x * x
  return 1 + z * (-1 / 2 + z * (1 / 24 + z * (-1 / 720 + z * (1 / 40320 + z * (-1 / 3628800 + z * (1 / 479001600 + z * (-1 / 87178291200 + z * (1 / 20922789888000))))))))
}

/** `x` as `n·π/2 + r` with |r| ≤ π/4, and n's quadrant (0..3). */
const reduce = (x: number) => {
  const n = round(x / HALF_PI)
  const r = x - n * HALF_PI_HI - n * HALF_PI_LO
  return { r, quadrant: ((n % 4) + 4) % 4 }
}

export const sin = (x: number) => {
  const { r, quadrant } = reduce(x)
  return quadrant === 0 ? sinKernel(r) : quadrant === 1 ? cosKernel(r) : quadrant === 2 ? -sinKernel(r) : -cosKernel(r)
}

export const cos = (x: number) => {
  const { r, quadrant } = reduce(x)
  return quadrant === 0 ? cosKernel(r) : quadrant === 1 ? -sinKernel(r) : quadrant === 2 ? -cosKernel(r) : sinKernel(r)
}

/** atan on [-tan(π/12), tan(π/12)] (series to x²³, error < 1e-16 there). */
const atanKernel = (x: number) => {
  const z = x * x
  let sum = 0
  for (let k = 11; k >= 0; k--) sum = sum * z + (k % 2 === 0 ? 1 : -1) / (2 * k + 1)
  return x * sum
}

const TAN_PI_12 = 0.2679491924311227
const SQRT3 = 1.7320508075688772

/** atan of any x ≥ 0: folds it under 1, then under tan(π/12) (atan x = π/6 + atan((x√3 − 1)/(x + √3))). */
const atanPositive = (x: number): number => {
  if (x > 1) return HALF_PI - atanPositive(1 / x)
  if (x > TAN_PI_12) return PI / 6 + atanKernel((x * SQRT3 - 1) / (x + SQRT3))
  return atanKernel(x)
}

export const atan = (x: number) => (x < 0 ? -atanPositive(-x) : atanPositive(x))

/** Angle of (x, y), like `Math.atan2(y, x)`. */
export const atan2 = (y: number, x: number) => {
  if (x === 0) return y > 0 ? HALF_PI : y < 0 ? -HALF_PI : 0
  const a = atan(y / x)
  if (x > 0) return a
  return y >= 0 ? a + PI : a - PI
}

/** Length of (x, y). Plain √(x² + y²): game coordinates never come near overflow. */
export const hypot = (x: number, y: number) => Math.sqrt(x * x + y * y)

const LN2 = 0.6931471805599453

/** eˣ: 2ᵏ·eʳ with |r| ≤ ln2/2 (Taylor to r¹⁴), 2ᵏ by exact doubling. */
export const exp = (x: number) => {
  if (x > 700) return Infinity
  if (x < -700) return 0
  const k = round(x / LN2)
  const r = x - k * LN2
  let sum = 1
  for (let n = 14; n >= 1; n--) sum = 1 + (sum * r) / n
  return sum * powInt(2, k)
}

/** ln x for x > 0: x = 2ᵏ·m with m in [√½, √2), ln m = 2·atanh((m − 1)/(m + 1)) (series to z²⁵). */
export const log = (x: number) => {
  if (!(x > 0)) return x === 0 ? -Infinity : NaN
  let m = x
  let k = 0
  while (m >= Math.SQRT2) (m /= 2), k++
  while (m < Math.SQRT1_2) (m *= 2), k--
  const z = (m - 1) / (m + 1)
  const z2 = z * z
  let sum = 0
  for (let n = 12; n >= 0; n--) sum = sum * z2 + 1 / (2 * n + 1)
  return k * LN2 + 2 * z * sum
}

/** `base` to any power, for base > 0. */
export const pow = (base: number, exponent: number) => exp(exponent * log(base))

/** `base` to a whole power `n`, by repeated multiplying (exact for powers of 2). */
export const powInt = (base: number, n: number) => {
  let result = 1
  const b = n < 0 ? 1 / base : base
  for (let i = 0; i < Math.abs(n); i++) result *= b
  return result
}

export const sq = (x: number) => x * x

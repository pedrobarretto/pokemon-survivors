export type Step = 'left' | 'right' | 'up' | 'down'

/**
 * The cell an arrow leads to in a row-major grid of `count` cells, `cols`
 * wide (the partner select's rosters). ← → walk the reading order (spilling
 * into the row before or after) and stop at the ends; ↑ ↓ move a row, and a
 * ↓ into a short last row lands on its last cell. Leaving through the top or
 * the bottom row returns `'above'` / `'below'`, so the screen can move on (the
 * starters' bottom row leads to the eggs, the eggs' top row back).
 */
export const stepGrid = (index: number, step: Step, cols: number, count: number): number | 'above' | 'below' => {
  if (step === 'left') return Math.max(0, index - 1)
  if (step === 'right') return Math.min(count - 1, index + 1)
  if (step === 'up') return index - cols >= 0 ? index - cols : 'above'
  if (index + cols < count) return index + cols
  return Math.floor(index / cols) < Math.floor((count - 1) / cols) ? count - 1 : 'below'
}

/**
 * `stepGrid` over a grid cut into sections (`sizes` cells each, every one
 * starting a new row under a header: the eggs' regular families, then each
 * region's forms). Indexes count every cell in order. ← → walk straight
 * through; ↑ ↓ across a header keep the column, landing on the section's
 * last row going up (its last cell when the row is short) or its first row
 * going down. The first and last sections leave as `stepGrid` does.
 */
export const stepSections = (index: number, step: Step, cols: number, sizes: readonly number[]): number | 'above' | 'below' => {
  const count = sizes.reduce((a, b) => a + b, 0)
  if (step === 'left' || step === 'right') return stepGrid(index, step, cols, count)
  let s = 0
  let start = 0
  while (s < sizes.length - 1 && index >= start + sizes[s]!) start += sizes[s++]!
  const size = sizes[s]!
  const local = index - start
  const col = local % cols
  const r = stepGrid(local, step, cols, size)
  if (typeof r === 'number') return start + r
  if (r === 'above') {
    if (s === 0) return 'above'
    const prev = sizes[s - 1]!
    return start - prev + Math.min(Math.floor((prev - 1) / cols) * cols + col, prev - 1)
  }
  if (s === sizes.length - 1) return 'below'
  return start + size + Math.min(col, sizes[s + 1]! - 1)
}

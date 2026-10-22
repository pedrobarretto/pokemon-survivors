import { describe, expect, it } from 'vitest'
import { toTotals } from './festival'

describe('toTotals', () => {
  it('keeps the sums of known festivals only', () => {
    expect(toTotals([{ festival: 'lanternas', amount: 41_000_000 }, { festival: 'gone', amount: 5 }])).toEqual({ lanternas: 41_000_000 })
    expect(toTotals([])).toEqual({})
  })
})

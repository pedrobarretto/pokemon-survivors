import { describe, expect, it } from 'vitest'
import { CORNER_PRIZE_IDS, CORNER_PRIZES, prizeContent, prizeOnce, prizePrice } from './rocketCorner'

describe('the counter’s shiny prizes', () => {
  const families = CORNER_PRIZE_IDS.flatMap((id) => {
    const def = CORNER_PRIZES[id]
    return def.kind === 'family' ? [def] : []
  })
  const shinyOf = (family: string) => CORNER_PRIZE_IDS.find((id) => CORNER_PRIZES[id].kind === 'shiny' && CORNER_PRIZES[id].family === family)

  it('sells every prize family shiny, once, dearer than the family', () => {
    for (const f of families) {
      const id = shinyOf(f.family)
      expect(id, f.family).toBeDefined()
      if (!id) continue
      expect(prizeOnce(id)).toBe(true)
      expect(CORNER_PRIZES[id].price).toBeGreaterThan(f.price)
      expect(prizeContent(id, null)).toEqual({ kind: 'shinyHatch', family: f.family })
    }
  })

  it('costs only the rest once the family was bought, so either order adds up the same', () => {
    expect(prizePrice('shinyCleffa', [])).toBe(CORNER_PRIZES.shinyCleffa.price)
    expect(prizePrice('shinyCleffa', ['nidoranF', 'shadowCleffa'])).toBe(CORNER_PRIZES.shinyCleffa.price)
    expect(CORNER_PRIZES.cleffa.price + prizePrice('shinyCleffa', ['cleffa'])).toBe(CORNER_PRIZES.shinyCleffa.price)
    expect(prizePrice('cleffa', ['shinyCleffa'])).toBe(CORNER_PRIZES.cleffa.price)
  })
})

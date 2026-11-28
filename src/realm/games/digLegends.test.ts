import { describe, expect, it } from 'vitest'
import { DIG_LEGENDS, legendDue, legendPrize, legendWant, wallLegends } from './digLegends'

describe('the Escavação legends', () => {
  it('is for the legend first, then its shiny, then nothing', () => {
    expect(legendWant({ legend: false, shiny: false })).toBe('legend')
    expect(legendWant({ legend: true, shiny: false })).toBe('shiny')
    expect(legendWant({ legend: true, shiny: true })).toBeNull()
  })

  it('buries a treasure only while it is wanted: by chance, or surely on the guarantee', () => {
    const { every, chance } = DIG_LEGENDS.meltan
    expect(legendDue('meltan', null, every - 1, 0)).toBe(false)
    expect(legendDue('meltan', 'legend', 0, chance - 0.001)).toBe(true)
    expect(legendDue('meltan', 'shiny', 0, chance + 0.001)).toBe(false)
    expect(legendDue('meltan', 'shiny', every - 1, 0.99)).toBe(true)
  })

  it('gives a wall to the legend still lacking before a shiny hunt, Diancie between equals', () => {
    expect(wallLegends({ meltan: 'legend', diancie: 'legend' })).toEqual({ box: false, diamond: true })
    expect(wallLegends({ meltan: 'shiny', diancie: 'shiny' })).toEqual({ box: false, diamond: true })
    expect(wallLegends({ meltan: 'legend', diancie: 'shiny' })).toEqual({ box: true, diamond: false })
    expect(wallLegends({ meltan: 'shiny', diancie: 'legend' })).toEqual({ box: false, diamond: true })
    expect(wallLegends({ meltan: 'shiny', diancie: null })).toEqual({ box: true, diamond: false })
    expect(wallLegends({ meltan: null, diancie: null })).toEqual({ box: false, diamond: false })
  })

  it('brings the legend, shiny under its chance', () => {
    expect(legendPrize('meltan', 'legend', 0.99)).toEqual({ gift: { kind: 'legend', legend: 'meltan' }, shiny: false, coins: 0 })
    expect(legendPrize('meltan', 'legend', DIG_LEGENDS.meltan.shiny - 0.001)).toEqual({ gift: { kind: 'legend', legend: 'meltan', shiny: true }, shiny: true, coins: 0 })
    expect(legendPrize('diancie', 'legend', 0)).toEqual({ gift: { kind: 'legend', legend: 'diancie', shiny: true }, shiny: true, coins: 0 })
  })

  it('brings an owned legend its shiny by the same chance, else ₽, and only ₽ once both are owned', () => {
    expect(legendPrize('diancie', 'shiny', DIG_LEGENDS.diancie.shiny - 0.001)).toEqual({ gift: { kind: 'legend', legend: 'diancie', shiny: true }, shiny: true, coins: 0 })
    expect(legendPrize('diancie', 'shiny', DIG_LEGENDS.diancie.shiny)).toEqual({ gift: { kind: 'coins', amount: DIG_LEGENDS.diancie.coins }, shiny: false, coins: DIG_LEGENDS.diancie.coins })
    expect(legendPrize('meltan', null, 0)).toEqual({ gift: { kind: 'coins', amount: DIG_LEGENDS.meltan.coins }, shiny: false, coins: DIG_LEGENDS.meltan.coins })
  })
})

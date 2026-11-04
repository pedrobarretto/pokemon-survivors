import { describe, expect, it } from 'vitest'
import { winsNeeded } from '../game/capture'
import { addFurniture, trophyFurniture } from './trophies'

describe('trophyFurniture', () => {
  it('gives a doll only for each legend captured, not one on its way', () => {
    expect(trophyFurniture({ legends: {} })).toEqual({})
    const got = trophyFurniture({ legends: { kyogre: winsNeeded('kyogre'), groudon: winsNeeded('groudon') - 1 } })
    expect(got).toEqual({ 'doll:kyogre': 1 })
  })

  it("gives a legend's painting once every legend it shows is captured", () => {
    const got = trophyFurniture({ legends: { kyogre: winsNeeded('kyogre'), groudon: winsNeeded('groudon'), lugia: winsNeeded('lugia') } })
    expect(got).toEqual({ 'doll:kyogre': 1, 'doll:groudon': 1, 'doll:lugia': 1, clashPainting: 1, lugiaPainting: 1 })
  })
})

describe('addFurniture', () => {
  it('sums piece by piece and drops what nothing holds', () => {
    expect(addFurniture({ woodChair: 2, candle: 0 }, { woodChair: 1, 'doll:kyogre': 1 })).toEqual({ woodChair: 3, 'doll:kyogre': 1 })
  })
})

import { describe, expect, it } from 'vitest'
import { winsNeeded } from './capture'
import { unbackedLoadout } from './loadoutBacking'
import { EMPTY_SAVE, NO_RANKS } from './meta'

const save = EMPTY_SAVE
const run = { starter: 'charmander', ranks: NO_RANKS } as const

describe('unbackedLoadout', () => {
  it('backs a starter with nothing bought on an empty save', () => {
    expect(unbackedLoadout(run, save)).toEqual([])
  })

  it('needs the family hatched and the legend captured', () => {
    expect(unbackedLoadout({ ...run, starter: 'gible' }, save)).toEqual(['starter'])
    expect(unbackedLoadout({ ...run, starter: 'gible' }, { ...save, hatched: { gible: { shiny: false } } })).toEqual([])
    expect(unbackedLoadout({ ...run, starter: 'kyogre' }, { ...save, legends: { kyogre: winsNeeded('kyogre') - 1 } })).toEqual(['starter'])
    expect(unbackedLoadout({ ...run, starter: 'kyogre' }, { ...save, legends: { kyogre: winsNeeded('kyogre') } })).toEqual([])
  })

  it('needs at least the ranks, caps, TMs and evolution items the run brought', () => {
    const start = { ...run, ranks: { ...NO_RANKS, protein: 3 }, caps: 2, tms: ['iceBeam'], evo: ['fireStone'] } as const
    expect(unbackedLoadout(start, save)).toEqual(['ranks', 'caps', 'tms', 'evo'])
    const owner = { ...save, ranks: { ...NO_RANKS, protein: 5 }, caps: { charmander: 2 }, tms: { ...save.tms, owned: ['iceBeam'] }, evo: ['fireStone'] } as const
    expect(unbackedLoadout(start, owner)).toEqual([])
  })

  it('backs a Shadow run by the Shadow it owns, purified since or not', () => {
    const shadow = { ...run, variant: 'shadow' } as const
    expect(unbackedLoadout(shadow, save)).toEqual(['variant'])
    expect(unbackedLoadout(shadow, { ...save, shadows: { charmander: { purified: true, steps: 0, pick: true, rev: 1 } } })).toEqual([])
  })

  it('needs the path form open', () => {
    const start = { ...run, starter: 'zygarde', forms: ['zygarde10'] } as const
    const captor = { ...save, legends: { zygarde: winsNeeded('zygarde') } }
    expect(unbackedLoadout(start, captor)).toEqual(['forms'])
    expect(unbackedLoadout(start, { ...captor, paths: { ...save.paths, cells: 10 } })).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { familySource } from './familySource'
import { HATCHLINGS, type HatchlingId } from './hatchlings'
import { SAFARI_ONLY } from './safari'

describe('a family’s source', () => {
  it('is the Safári for its exclusives, the Game Corner for its prizes, else its egg', () => {
    for (const id of SAFARI_ONLY) expect([id, familySource(id)]).toEqual([id, 'safari'])
    const prizes: readonly HatchlingId[] = ['nidoranF', 'cleffa', 'ditto', 'plusle', 'minun']
    expect(prizes.map(familySource)).toEqual(['corner', 'corner', 'corner', 'corner', 'corner'])
    expect(familySource('kabuto')).toBe(HATCHLINGS.kabuto.egg)
  })
})

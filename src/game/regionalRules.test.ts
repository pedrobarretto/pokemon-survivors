import { describe, expect, it } from 'vitest'
import { barbCount, BARBS, bullBreed, CLAW, clawMult, shellSide, SHELL, toxicSpreads, TOXIC } from './regionalRules'

describe("the regional forms' moves", () => {
  it('Metal Claw sharpens with each hit in a row, up to its cap', () => {
    expect(clawMult(0)).toBe(1)
    expect(clawMult(3)).toBeCloseTo(1 + 3 * CLAW.per)
    expect(clawMult(99)).toBe(clawMult(CLAW.max))
  })

  it('Shell Side Arm slams up close and shoots from afar', () => {
    expect(shellSide(SHELL.near)).toBe('slam')
    expect(shellSide(SHELL.near + 1)).toBe('shot')
  })

  it('Poison Sting fires more barbs once Overqwil', () => {
    expect(barbCount(8, 0)).toBe(8)
    expect(barbCount(8, 1)).toBe(8 + BARBS.evolved)
  })

  it("Toxic's poison passes on only from a badly poisoned foe", () => {
    expect(toxicSpreads({ move: 'toxic', stacks: TOXIC.chain })).toBe(true)
    expect(toxicSpreads({ move: 'toxic', stacks: TOXIC.chain - 1 })).toBe(false)
    expect(toxicSpreads({ move: 'sludgeBomb', stacks: 5 })).toBe(false)
  })

  it("Raging Bull hits as Paldean Tauros' breed", () => {
    expect(bullBreed(null)).toEqual({ type: 'fighting', status: null })
    expect(bullBreed('taurosCombat').type).toBe('fighting')
    expect(bullBreed('taurosBlaze')).toMatchObject({ type: 'fire', status: { kind: 'burn' } })
    expect(bullBreed('taurosAqua')).toMatchObject({ type: 'water', status: { kind: 'slow' } })
  })
})

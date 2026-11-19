import { describe, expect, it } from 'vitest'
import { handedSave } from './handoff'

const ours = 'https://www.pokemonsurvivors.com'

describe('handedSave', () => {
  it('takes the save only from our own origin', () => {
    const msg = { kind: 'ps:handoff-save', save: { wallet: 10 } }
    expect(handedSave(msg, ours, ours)).toEqual({ wallet: 10 })
    expect(handedSave(msg, 'https://gggames.cc', ours)).toBeUndefined()
  })

  it('ignores anything not shaped as a handoff', () => {
    expect(handedSave('ps:handoff-ready', ours, ours)).toBeUndefined()
    expect(handedSave({ kind: 'other', save: {} }, ours, ours)).toBeUndefined()
    expect(handedSave({ kind: 'ps:handoff-save' }, ours, ours)).toBeUndefined()
  })
})

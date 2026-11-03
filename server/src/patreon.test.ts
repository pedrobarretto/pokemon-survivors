import { describe, expect, it } from 'vitest'
import { readState, signState } from './patreon'

describe('Patreon link state', () => {
  const link = { userId: 'user_2abc', back: 'https://www.pokemonsurvivors.com/' }

  it('comes back as the link it was signed for, until it runs out', () => {
    const state = signState('secret', link, 1000)
    expect(readState('secret', state, 1000)).toEqual(link)
    expect(readState('secret', state, 1000 + 15 * 60)).toEqual(link)
    expect(readState('secret', state, 1001 + 15 * 60)).toBeNull()
  })

  it('refuses a state signed with another secret, or edited to name someone else', () => {
    const state = signState('secret', link, 1000)
    expect(readState('other', state, 1000)).toBeNull()
    const [, mac] = state.split('.')
    const forged = Buffer.from(JSON.stringify({ u: 'user_victim', b: link.back, e: 99999 })).toString('base64url')
    expect(readState('secret', `${forged}.${mac}`, 1000)).toBeNull()
    expect(readState('secret', undefined, 1000)).toBeNull()
    expect(readState('secret', 'garbage', 1000)).toBeNull()
  })
})

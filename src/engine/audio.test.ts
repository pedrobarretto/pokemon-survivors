import { describe, expect, it } from 'vitest'
import { quietly, sessionType } from './audio'

describe('sessionType', () => {
  it('plays through the ringer switch while the game has music on', () => {
    expect(sessionType({ musicVolume: 0.6, sfxVolume: 1, muted: false })).toBe('playback')
  })

  it("leaves the switch and the player's own music alone with the music off or the game muted", () => {
    expect(sessionType({ musicVolume: 0, sfxVolume: 1, muted: false })).toBe('ambient')
    expect(sessionType({ musicVolume: 0.6, sfxVolume: 1, muted: true })).toBe('ambient')
  })
})

describe('quietly', () => {
  it('takes the undefined an old WebView returns from play() or resume()', () => {
    expect(() => quietly(() => undefined)).not.toThrow()
  })

  it('swallows a call that throws or rejects', async () => {
    expect(() => quietly(() => { throw new TypeError('not a function') })).not.toThrow()
    quietly(() => Promise.reject(new Error('NotAllowedError')))
    await new Promise((r) => setTimeout(r, 0))
  })
})

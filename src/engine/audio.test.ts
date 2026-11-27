import { describe, expect, it } from 'vitest'
import { keepNewest, quietly, sessionType } from './audio'

describe('sessionType', () => {
  it('plays through the ringer switch while the game has music on', () => {
    expect(sessionType({ musicVolume: 0.6, sfxVolume: 1, muted: false, mixOthers: false })).toBe('playback')
  })

  it("leaves the switch and the player's own music alone with the music off or the game muted", () => {
    expect(sessionType({ musicVolume: 0, sfxVolume: 1, muted: false, mixOthers: false })).toBe('ambient')
    expect(sessionType({ musicVolume: 0.6, sfxVolume: 1, muted: true, mixOthers: false })).toBe('ambient')
  })

  it("lets another app's audio play on under the music when the player asks", () => {
    expect(sessionType({ musicVolume: 0.6, sfxVolume: 1, muted: false, mixOthers: true })).toBe('ambient')
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

describe('keepNewest', () => {
  it('drops the oldest entries past the cap, in insertion order', () => {
    const map = new Map([['a', 1], ['b', 2], ['c', 3], ['d', 4]])
    keepNewest(map, 2)
    expect([...map.keys()]).toEqual(['c', 'd'])
  })

  it('keeps a map at or under the cap whole', () => {
    const map = new Map([['a', 1], ['b', 2]])
    keepNewest(map, 2)
    expect([...map.keys()]).toEqual(['a', 'b'])
  })

  it('keeps one re-inserted on use, so the least recently used goes first', () => {
    const map = new Map([['a', 1], ['b', 2], ['c', 3]])
    map.delete('a')
    map.set('a', 1)
    map.set('d', 4)
    keepNewest(map, 3)
    expect([...map.keys()]).toEqual(['c', 'a', 'd'])
  })
})

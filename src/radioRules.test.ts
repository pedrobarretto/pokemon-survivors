import { describe, expect, it } from 'vitest'
import { RADIO_TRACKS } from './data/radio'
import { dequeue, isUnlocked, moveInQueue, NO_RADIO, nextIndex, parseRadio, playNow, previous, radioTheme, trackDone, type RadioState } from './radioRules'

const radio = (patch: Partial<RadioState> = {}): RadioState => ({ ...NO_RADIO, on: true, queue: ['menu', 'run', 'boss'], at: 0, ...patch })
const never = () => 0

describe('the queue', () => {
  it('plays a queued track from its place and puts a new one right after the one playing', () => {
    expect(playNow(radio(), 'boss')).toMatchObject({ at: 2, queue: ['menu', 'run', 'boss'] })
    expect(playNow(radio(), 'forest')).toMatchObject({ at: 1, queue: ['menu', 'forest', 'run', 'boss'] })
    expect(playNow({ ...NO_RADIO }, 'forest')).toMatchObject({ on: true, at: 0, queue: ['forest'] })
  })

  it('keeps the track playing when another moves or leaves', () => {
    expect(moveInQueue(radio({ at: 1 }), 1, -1)).toMatchObject({ queue: ['run', 'menu', 'boss'], at: 0 })
    expect(moveInQueue(radio({ at: 0 }), 1, -1)).toMatchObject({ queue: ['run', 'menu', 'boss'], at: 1 })
    expect(moveInQueue(radio(), 2, 1)).toEqual(radio())
    expect(dequeue(radio({ at: 2 }), 0)).toMatchObject({ queue: ['run', 'boss'], at: 1 })
    expect(dequeue(radio({ at: 1 }), 1)).toMatchObject({ queue: ['menu', 'boss'], at: 1 })
    expect(dequeue(radio({ at: 2 }), 2)).toMatchObject({ queue: ['menu', 'run'], at: null })
  })
})

describe('the next track', () => {
  it('walks the queue and wraps or stops by repeat', () => {
    expect(nextIndex(radio(), false, never)).toBe(1)
    expect(nextIndex(radio({ at: 2, repeat: 'all' }), false, never)).toBe(0)
    expect(nextIndex(radio({ at: 2, repeat: 'off' }), false, never)).toBeNull()
    expect(nextIndex(radio({ at: 2, repeat: 'off' }), true, never)).toBe(0)
  })

  it('repeats one track until skipped', () => {
    expect(nextIndex(radio({ at: 1, repeat: 'one' }), false, never)).toBe(1)
    expect(nextIndex(radio({ at: 1, repeat: 'one' }), true, never)).toBe(2)
  })

  it('shuffles to any other track, never the same one', () => {
    const picks = [0, 0.4, 0.99].map((r) => nextIndex(radio({ at: 1, shuffle: true }), false, () => r))
    expect(picks).toEqual([2, 2, 0])
  })

  it('goes back one, wrapping to the last', () => {
    expect(previous(radio({ at: 0 })).at).toBe(2)
    expect(previous(radio({ at: null })).at).toBe(2)
  })

  it('moves on after whole loops of at least 90 s, never fewer than two', () => {
    expect(trackDone(1, 120)).toBe(false)
    expect(trackDone(2, 40)).toBe(false)
    expect(trackDone(3, 40)).toBe(true)
    expect(trackDone(2, 60)).toBe(true)
  })
})

describe('who picks the music', () => {
  it('leaves the game its music while off or out of tracks', () => {
    expect(radioTheme(radio({ on: false }), 'menu')).toBeNull()
    expect(radioTheme(radio({ at: null }), 'menu')).toBeNull()
  })

  it('plays the menus only, then runs, then fights when asked', () => {
    expect(radioTheme(radio(), 'menu')).toBe('menu')
    expect(radioTheme(radio(), 'run')).toBeNull()
    expect(radioTheme(radio({ where: 'everywhere' }), 'run')).toBe('menu')
    expect(radioTheme(radio({ where: 'everywhere' }), 'fight')).toBeNull()
    expect(radioTheme(radio({ where: 'everywhere', fights: true }), 'fight')).toBe('menu')
  })
})

describe('unlocks', () => {
  const track = (theme: string) => RADIO_TRACKS.find((tr) => tr.theme === theme)!
  const none = { heard: [], seen: () => false, dexOf: () => 0 }

  it('opens the starters, a biome once heard and a legend once seen', () => {
    expect(isUnlocked(track('boss'), none)).toBe(true)
    expect(isUnlocked(track('forest'), none)).toBe(false)
    expect(isUnlocked(track('forest'), { ...none, heard: ['forest'] })).toBe(true)
    expect(isUnlocked(track('latis'), { ...none, seen: (n) => n === 381, dexOf: (id) => (id === 'latios' ? 381 : 380) })).toBe(true)
    expect(isUnlocked(track('kyogre'), { ...none, all: true })).toBe(true)
  })
})

describe('the stored radio', () => {
  it('keeps what is valid and drops the rest', () => {
    expect(parseRadio({ on: true, queue: ['menu', 'nope', 'menu', 'boss'], at: 5, repeat: 'twice', where: 'everywhere', favorites: [3] })).toEqual({
      ...NO_RADIO,
      on: true,
      queue: ['menu', 'boss'],
      at: null,
      where: 'everywhere',
    })
    expect(parseRadio('garbage')).toEqual(NO_RADIO)
  })
})

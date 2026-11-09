import { describe, expect, it } from 'vitest'
import { GAME_MODE_IDS } from '../data/gameModes'
import { lobbyModeIn, modeBeside, parseLobbyMode, shownModes } from './lobbyMode'

describe('parseLobbyMode', () => {
  it('keeps every known mode', () => {
    expect(GAME_MODE_IDS.map(parseLobbyMode)).toEqual(GAME_MODE_IDS)
  })

  it('falls back to Survivors on nothing stored, junk, or an inherited object key', () => {
    expect([null, '', 'tetris', 'constructor'].map(parseLobbyMode)).toEqual(['survivors', 'survivors', 'survivors', 'survivors'])
  })
})

describe('the lobby\'s modes', () => {
  it('hides what this build has no action for, in the bar\'s order', () => {
    expect(shownModes(['coop', 'realm'])).toEqual(['survivors', 'legends', 'challenge', 'arena', 'dojo'])
  })

  it('falls back to Survivors when the saved mode is hidden', () => {
    expect(lobbyModeIn('realm', shownModes(['realm']))).toBe('survivors')
    expect(lobbyModeIn('arena', shownModes(['realm']))).toBe('arena')
  })

  it('wraps at both ends', () => {
    const shown = shownModes([])
    expect(modeBeside(shown, 'survivors', -1)).toBe('realm')
    expect(modeBeside(shown, 'realm', 1)).toBe('survivors')
    expect(modeBeside(shown, 'legends', 1)).toBe('challenge')
  })
})

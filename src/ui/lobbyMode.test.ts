import { describe, expect, it } from 'vitest'
import { GAME_MODE_IDS } from '../data/gameModes'
import { parseLobbyMode } from './lobbyMode'

describe('parseLobbyMode', () => {
  it('keeps every known mode', () => {
    expect(GAME_MODE_IDS.map(parseLobbyMode)).toEqual(GAME_MODE_IDS)
  })

  it('falls back to Survivors on nothing stored, junk, or an inherited object key', () => {
    expect([null, '', 'tetris', 'constructor'].map(parseLobbyMode)).toEqual(['survivors', 'survivors', 'survivors', 'survivors'])
  })
})

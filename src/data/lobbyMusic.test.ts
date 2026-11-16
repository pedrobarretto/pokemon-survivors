import { describe, expect, it } from 'vitest'
import { BIOMES } from './biomes'
import { bandOf, pickLobbyTheme, type LobbyClock } from './lobbyMusic'

const at = (clock: Partial<LobbyClock>): LobbyClock => ({ hour: 9, day: 0, visit: 0, festival: false, halloween: false, ...clock })

describe('pickLobbyTheme', () => {
  it('splits the day into bands, night running past midnight', () => {
    expect([4, 5, 10, 11, 16, 17, 20, 21, 0].map(bandOf)).toEqual(['night', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'night', 'night'])
  })

  it("takes turns in the band's rotation, a step further each day", () => {
    expect(pickLobbyTheme(at({ visit: 0 })).theme).toBe('lobbyMorning')
    expect(pickLobbyTheme(at({ visit: 1 })).theme).toBe('menu')
    expect(pickLobbyTheme(at({ visit: 2 })).theme).toBe('lobbyMorning')
    expect(pickLobbyTheme(at({ day: 1 })).theme).toBe('menu')
    expect(pickLobbyTheme(at({ hour: 23 })).theme).toBe('lobbyNight')
    expect(pickLobbyTheme(at({ hour: 18 })).theme).toBe('lobbyRain')
  })

  it('plays the festival every other pick while one runs', () => {
    const picks = [0, 1, 2, 3].map((visit) => pickLobbyTheme(at({ visit, festival: true })).theme)
    expect(picks).toEqual(['lobbyFestival', 'lobbyMorning', 'lobbyFestival', 'menu'])
  })

  it('keeps the Noite das Bruxas tower over everything on its days', () => {
    expect(pickLobbyTheme(at({ halloween: true, festival: true, hour: 23, visit: 3 }))).toEqual({ theme: BIOMES.tower.theme, why: 'halloween' })
  })
})

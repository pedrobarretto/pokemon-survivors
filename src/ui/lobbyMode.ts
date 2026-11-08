import { DEFAULT_GAME_MODE, GAME_MODE_IDS, type GameModeId } from '../data/gameModes'

/** The mode the lobby stands on, per device: a screen preference, not progress, so it stays out of the save. */
const KEY = 'ps:lobbyMode'

/** A stored value as a mode: anything but a known id is the default. */
export const parseLobbyMode = (stored: string | null): GameModeId => GAME_MODE_IDS.find((id) => id === stored) ?? DEFAULT_GAME_MODE

export const loadLobbyMode = (): GameModeId => {
  try {
    return parseLobbyMode(localStorage.getItem(KEY))
  } catch {
    return DEFAULT_GAME_MODE
  }
}

export const saveLobbyMode = (id: GameModeId) => {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // Storage blocked: the pick lasts until the page closes.
  }
}

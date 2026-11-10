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

/** The modes this build can play, in the bar's order: one whose action is missing (no relay, no API) doesn't show. */
export const shownModes = (hidden: readonly GameModeId[]) => GAME_MODE_IDS.filter((id) => !hidden.includes(id))

/** The mode the lobby stands on: the saved one, or the default when this build hides it. */
export const lobbyModeIn = (saved: GameModeId, shown: readonly GameModeId[]): GameModeId => (shown.includes(saved) ? saved : DEFAULT_GAME_MODE)

/** The mode `step` places away in `shown`, wrapping at both ends (`-1` the previous one, `1` the next). */
export const modeBeside = (shown: readonly GameModeId[], current: GameModeId, step: -1 | 1): GameModeId => shown[(shown.indexOf(current) + step + shown.length) % shown.length]!

import { LOBBY_ROTATION, pickLobbyTheme, type LobbyClock, type LobbyPick } from './data/lobbyMusic'
import { THEMES, type ThemeId } from './data/music'
import { parseTrack } from './engine/score'
import { festivalDay } from './festival'
import { festivalOn } from './game/festival'
import { halloweenToday, today } from './ui/save'

/**
 * Which theme the lobby and the menus play (the results screens too). The
 * rule is `pickLobbyTheme` (`data/lobbyMusic.ts`), pure; this side asks it as
 * the player comes into the menus and holds the pick until a run starts or the
 * theme has looped `HOLD_LOOPS` times, so it never flaps on an hour's edge.
 */

/** A held pick plays this many loops before the lobby picks again. */
const HOLD_LOOPS = 3

/** One loop of a theme, in ms. */
const loopMs = (id: ThemeId) => (parseTrack(THEMES[id].tracks.lead).length * 15_000) / THEMES[id].bpm

/** The device's local day, counted from the epoch. */
const localDay = (d: Date) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / 86_400_000)

const clockNow = (visit: number): LobbyClock => {
  const now = today()
  return { hour: now.getHours(), day: localDay(now), visit, festival: festivalOn(festivalDay()) !== null, halloween: halloweenToday() }
}

let held: (LobbyPick & { until: number }) | null = null
let visits = 0
/** Dev: a theme held until reload (`ps.lobbyTheme`). */
let devTheme: ThemeId | null = null

/** The theme the menus play now: the held pick, or a fresh one once the last ran out. Asked every frame. */
export const lobbyTheme = (): ThemeId => {
  if (devTheme) return devTheme
  const now = performance.now()
  if (held && now >= held.until) leaveLobby()
  if (!held) {
    const pick = pickLobbyTheme(clockNow(visits))
    held = { ...pick, until: now + HOLD_LOOPS * loopMs(pick.theme) }
  }
  return held.theme
}

/** A run is under way: the next time the menus play, they pick again. Cheap and idempotent (every frame). */
export const leaveLobby = () => {
  if (!held) return
  held = null
  visits++
}

/** `ps.lobbyTheme('lobbyNight')` holds a theme until reload (`null` back to the rotation); returns the pick and why. */
export const devLobbyTheme = (id?: ThemeId | null) => {
  if (id !== undefined) devTheme = id !== null && id in THEMES ? id : null
  const clock = clockNow(visits)
  return { playing: devTheme ?? held?.theme ?? null, dev: devTheme, held, next: pickLobbyTheme(clock), clock, rotation: LOBBY_ROTATION }
}

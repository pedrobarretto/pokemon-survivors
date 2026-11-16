import { ENEMIES } from './data/enemies'
import { RADIO_TRACKS } from './data/radio'
import type { ThemeId } from './data/music'
import { currentTheme, loopSeconds, loopsPlayed } from './engine/music'
import { dexStatus } from './game/dex'
import { hear, isUnlocked, NO_RADIO, nowPlaying, parseRadio, radioTheme, skip, trackDone, type MusicPlace, type RadioState } from './radioRules'
import { loadSave } from './ui/save'

/**
 * The Rádio's state on this device (`ps:radio`, rules in `radioRules.ts`, the
 * sheet in `ui/radio.ts`). The shell's music (`themeFor` in `main.ts`) asks
 * `radioOver` every frame which theme the radio plays over the game's own;
 * that also notes what the game would have played (a biome's theme opens its
 * track) and moves the queue on once a track has played its loops.
 */

const KEY = 'ps:radio'

const read = (): RadioState => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? parseRadio(JSON.parse(raw)) : NO_RADIO
  } catch {
    return NO_RADIO
  }
}

let state = read()
/** Every track open, for a look (`ps.radio('unlock')`), until a reload. */
let allOpen = false
/** The radio's theme the last frame played (null: the game's own music). */
let sounding: ThemeId | null = null
/** Loops already counted against the track playing (repeat one keeps the same theme sounding). */
let loopBase = 0
const listeners = new Set<() => void>()

export const radio = (): RadioState => state

/** Replaces the radio's state, persists it and tells the sheet and the pills. */
export const setRadio = (next: RadioState) => {
  if (next === state) return
  const was = nowPlaying(state)
  state = next
  if (nowPlaying(next) !== was) loopBase = 0
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private mode or a full storage: the radio still works until a reload.
  }
  for (const l of listeners) l()
}

/** Calls `fn` on every change of the radio; returns how to stop. */
export const onRadio = (fn: () => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** Whether the radio is what's sounding now (the lobby's and the pause menu's pills). */
export const radioSounding = () => sounding !== null && currentTheme() === sounding

export const unlockAllTracks = () => {
  allOpen = true
  for (const l of listeners) l()
}

/** What opens tracks now: this device's `heard` and the save's Pokédex. */
export const radioUnlocks = () => {
  const dex = loadSave().dex
  return { heard: state.heard, seen: (n: number) => dexStatus(dex, n).seen, dexOf: (id: keyof typeof ENEMIES) => ENEMIES[id].dex, all: allOpen }
}

/** The tracks open now, in the catalog's order. */
export const openTracks = () => {
  const u = radioUnlocks()
  return RADIO_TRACKS.filter((tr) => isUnlocked(tr, u)).map((tr) => tr.theme)
}

/**
 * The theme the radio plays over `auto` (the game's own pick) at `place`, or
 * null for `auto`. Called every frame: cheap unless something changes.
 */
export const radioOver = (auto: ThemeId | null, place: MusicPlace): ThemeId | null => {
  if (auto) {
    const heard = hear(state, auto)
    if (heard !== state) setRadio(heard)
  }
  const theme = radioTheme(state, place)
  sounding = theme
  if (theme && currentTheme() === theme) {
    const loops = loopsPlayed()
    // The theme restarted under the radio (after a fight, say): its loops count from there.
    if (loops < loopBase) loopBase = 0
    if (trackDone(loops - loopBase, loopSeconds())) {
      loopBase = loops
      setRadio(skip(state, false, Math.random))
      return radioTheme(state, place)
    }
  }
  return theme
}

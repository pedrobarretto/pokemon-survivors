import { API_URL, addGameGifts, donateToFestival, refreshInbox, sessionToken, type FestivalDonation } from './account'
import type { Festival, PlazaStage } from './data/festivals'
import { brasiliaDay, type DayKey } from './game/day'
import { capLeft, festivalGifts, festivalOn, latestFestival, parseFestivalStatus, plazaStage, type FestivalStatus, type FestivalTotals } from './game/festival'
import { loadSave, today } from './ui/save'
import { timeoutSignal } from './net/timeout'

/**
 * Festival da Praça on the device: asks the API for the pot (`GET /festival`)
 * in the background, never blocking play (guests too, it's public), turns it
 * into the festival's Mystery Gifts in the lobby's gift box
 * (`festivalGifts`), and donates through the account (`donateFestival`).
 * Nothing is asked while no festival has opened yet. Dev builds can fake the
 * pot and the day (`ps.festival`).
 */

/** Asking again sooner than this (ms) reuses the last answer. */
const REFRESH_MS = 60_000

const TIMEOUT_MS = 12_000

let status: FestivalStatus | null = null
/** When the last ask began (`performance.now()`). */
let lastAsk = -Infinity
let asking: Promise<FestivalStatus | null> | null = null
const listeners = new Set<(s: FestivalView) => void>()

/** Dev overrides: the pot of the festival shown, and the day. */
const fake: { pot: number | null; day: DayKey | null } = { pot: null, day: null }

/** The Brasília day the festival reads (the dev override, else the game's clock). */
export const festivalDay = (): DayKey => fake.day ?? brasiliaDay(today())

/**
 * What the plaza and the festival's sheet show: the festival shown
 * (`latestFestival`: the running one, else the last; null before the first),
 * whether it's running, its pot and plaza stage, the plaque, and the
 * player's own (`mine`, null for guests or before the API answered).
 */
export type FestivalView = {
  day: DayKey
  festival: Festival | null
  running: boolean
  pot: number
  stage: PlazaStage
  top: FestivalStatus['top']
  donors: number
  mine: FestivalStatus['me']
  /** ₽ the player may still give today. */
  capLeft: number
}

/** The pots and the player's totals the gifts follow (the dev pot replacing the shown festival's). */
const totals = (day: DayKey): FestivalTotals => {
  const shown = latestFestival(day)
  const pots = { ...status?.pots, ...(shown && fake.pot !== null ? { [shown.id]: fake.pot } : {}) }
  return { pots, given: status?.me?.given ?? {} }
}

/** The festival as it stands now (`FestivalView`). */
export const festivalView = (): FestivalView => {
  const day = festivalDay()
  const festival = latestFestival(day)
  const pot = festival ? (totals(day).pots[festival.id] ?? 0) : 0
  const mine = status?.me ?? null
  return {
    day,
    festival,
    running: festivalOn(day) !== null,
    pot,
    stage: plazaStage(festival, pot),
    top: status?.festival === festival?.id ? (status?.top ?? []) : [],
    donors: status?.festival === festival?.id ? (status?.donors ?? 0) : 0,
    mine,
    capLeft: capLeft(mine?.today ?? 0),
  }
}

/** Calls `fn` whenever the festival's state changes (an answer from the API, a donation). Returns the unsubscribe. */
export const onFestival = (fn: (view: FestivalView) => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

const changed = () => {
  refreshInbox()
  const view = festivalView()
  listeners.forEach((fn) => fn(view))
}

/**
 * Asks the API for the festival's state (`GET /festival`), with the session's
 * token when signed in (for `me`). At most once per `REFRESH_MS` unless
 * `force`; skipped while no festival has opened, or without an API. Never throws.
 */
export const loadFestival = (force = false): Promise<FestivalStatus | null> => {
  if (!API_URL || !latestFestival(festivalDay())) return Promise.resolve(status)
  if (asking) return asking
  if (!force && performance.now() - lastAsk < REFRESH_MS) return Promise.resolve(status)
  lastAsk = performance.now()
  asking = (async () => {
    try {
      const token = await sessionToken()
      const res = await fetch(`${API_URL}/festival`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: timeoutSignal(TIMEOUT_MS) })
      const next = res.ok ? parseFestivalStatus(await res.json()) : null
      if (next) {
        status = next
        changed()
      }
    } catch (err) {
      console.warn('festival failed', err)
    } finally {
      asking = null
    }
    return status
  })()
  return asking
}

/**
 * Puts `amount` ₽ in the running festival's pot (`donateToFestival`) and asks
 * for the new state. Never throws.
 */
export const donateFestival = async (amount: number): Promise<FestivalDonation> => {
  const done = await donateToFestival(amount)
  if (done.ok) await loadFestival(true)
  return done
}

/**
 * Shows or hides the player's @handle on the plaque (`PUT /festival/public`).
 * Whether it went through; the plaque follows at the next ask. Never throws.
 */
export const setDonorPublic = async (show: boolean): Promise<boolean> => {
  try {
    const token = await sessionToken()
    if (!API_URL || !token) return false
    const res = await fetch(`${API_URL}/festival/public`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ public: show }),
      signal: timeoutSignal(TIMEOUT_MS),
    })
    if (!res.ok) return false
    if (status?.me) status = { ...status, me: { ...status.me, public: show } }
    changed()
    // The plaque itself changes server side (cached up to 30 s); ask again for it.
    void loadFestival(true)
    return true
  } catch (err) {
    console.warn('festival plaque setting failed', err)
    return false
  }
}

/**
 * Boot: the festival's gifts join the gift box, the first ask goes out once
 * the game has loaded, and coming back to the game asks again (at most once
 * per `REFRESH_MS`).
 */
export const startFestival = () => {
  addGameGifts(() => festivalGifts(loadSave(), totals(festivalDay()), festivalDay()))
  setTimeout(() => void loadFestival(), 4000)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void loadFestival())
}

/**
 * Dev: `ps.festival()` prints the state, `('pot', n)` fakes the shown
 * festival's pot (null drops it), `('day', 'YYYY-MM-DD')` fakes the day (null
 * drops it), `('fetch')` asks the API now and `('donate', n)` donates. The
 * shell adds `('open')`, which opens the festival's sheet (`ui/festival.ts`).
 */
export const devFestival = (cmd?: 'pot' | 'day' | 'fetch' | 'donate', arg?: number | string | null) => {
  if (cmd === 'pot') fake.pot = typeof arg === 'number' ? arg : null
  else if (cmd === 'day') fake.day = typeof arg === 'string' ? arg : null
  else if (cmd === 'fetch') return loadFestival(true).then(() => festivalView())
  else if (cmd === 'donate') return donateFestival(typeof arg === 'number' ? arg : 1000)
  if (cmd) changed()
  return { ...festivalView(), status, fake: { ...fake } }
}

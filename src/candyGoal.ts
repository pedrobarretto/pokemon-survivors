import { API_URL } from './account'
import { HALLOWEEN } from './data/halloween'
import { candyGoalAt, parseCandyGoal, setCommunityOpen, type CandyGoal } from './game/communityGoal'
import { brasiliaDay } from './game/day'
import { timeoutSignal } from './net/timeout'
import { today } from './ui/save'

/**
 * Meta da comunidade on the device (`game/communityGoal.ts`): asks the API
 * for the candies counted (`GET /candy-goal`) in the background, never
 * blocking play (guests too, it's public), from the night's first day until
 * the goal is reached. Once it is, Mega Darkrai opens and stays open on this
 * device (`STORAGE`), offline too. Dev builds can fake the count
 * (`ps.candyGoal`).
 */

/** Asking again sooner than this (ms) reuses the last answer (the API caches its sum 2 min). */
const REFRESH_MS = 120_000

const TIMEOUT_MS = 12_000

/** The last answer kept on the device, so the bar shows at once and a reached goal stays reached. */
const STORAGE = 'ps:candyGoal'

const stored = (): CandyGoal | null => {
  try {
    return parseCandyGoal(JSON.parse(localStorage.getItem(STORAGE) ?? 'null'))
  } catch {
    return null
  }
}

let goal: CandyGoal | null = null
let lastAsk = -Infinity
let asking: Promise<CandyGoal | null> | null = null
/** Dev override of the candies counted. */
let fake: number | null = null
const listeners = new Set<(goal: CandyGoal | null, opened: boolean) => void>()

/** The goal as it stands (the dev count replacing the API's), or null before any answer. */
export const candyGoal = (): CandyGoal | null => (fake !== null ? candyGoalAt(fake) : goal)

/**
 * Calls `fn` whenever the goal's state changes; `opened` is true on the
 * change that opened Mega Darkrai on this device. Returns the unsubscribe.
 */
export const onCandyGoal = (fn: (goal: CandyGoal | null, opened: boolean) => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

const changed = (opened: boolean) => {
  const now = candyGoal()
  setCommunityOpen(now?.reached === true)
  listeners.forEach((fn) => fn(now, opened))
}

/** Whether there's anything to ask: an API, the night begun, and the goal not reached yet. */
const worthAsking = () => Boolean(API_URL) && brasiliaDay(today()) >= HALLOWEEN.from && goal?.reached !== true

/** Asks the API for the goal (`GET /candy-goal`), at most once per `REFRESH_MS` unless `force`. Never throws. */
export const loadCandyGoal = (force = false): Promise<CandyGoal | null> => {
  if (!worthAsking()) return Promise.resolve(candyGoal())
  if (asking) return asking
  if (!force && performance.now() - lastAsk < REFRESH_MS) return Promise.resolve(candyGoal())
  lastAsk = performance.now()
  asking = (async () => {
    try {
      const res = await fetch(`${API_URL}/candy-goal`, { signal: timeoutSignal(TIMEOUT_MS) })
      const next = res.ok ? parseCandyGoal(await res.json()) : null
      if (next) {
        const opened = next.reached && goal?.reached !== true
        goal = next
        localStorage.setItem(STORAGE, JSON.stringify(next))
        changed(opened)
      }
    } catch (err) {
      console.warn('candy goal failed', err)
    } finally {
      asking = null
    }
    return candyGoal()
  })()
  return asking
}

/** Boot: the last answer kept on the device opens Mega Darkrai at once; the first ask goes out once the game has loaded, and coming back to the game asks again. */
export const startCandyGoal = () => {
  goal = stored()
  setCommunityOpen(goal?.reached === true)
  setTimeout(() => void loadCandyGoal(), 5000)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void loadCandyGoal())
}

/**
 * Dev: `ps.candyGoal()` prints the goal, `ps.candyGoal(14_990_000)` fakes the
 * candies counted (past the goal opens Mega Darkrai, with the lobby's toast),
 * `ps.candyGoal(null)` drops the fake, `('fetch')` asks the API now and
 * `('reset')` forgets the kept answer (Mega Darkrai locked again until the next one).
 */
export const devCandyGoal = (arg?: number | null | 'fetch' | 'reset') => {
  if (arg === 'fetch') return loadCandyGoal(true)
  if (arg === 'reset') {
    localStorage.removeItem(STORAGE)
    goal = null
    changed(false)
  } else if (arg !== undefined) {
    const was = candyGoal()?.reached === true
    fake = arg
    changed(!was && candyGoal()?.reached === true)
  }
  return candyGoal()
}

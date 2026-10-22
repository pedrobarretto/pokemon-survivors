import { isRecord, wholeNumber } from './game/parse'
import { detail } from './render/quality'

/**
 * Safe mode (Modo leve): after a run the phone killed (the crash watch,
 * `takeCrash` in `bugReport.ts`), this device draws lean for good
 * (`render/quality.ts`), keeps fewer silhouettes and loads alternate forms and
 * shinies only when they show, until a few long runs in a row end cleanly.
 * The player can turn it on or off in Ajustes. Presentation only: the
 * simulation never reads it, so replays and the ranking are untouched.
 */

/** `auto` follows the crashes; `on` and `off` are the player's say (Ajustes, `ps.safeMode`). */
export type SafeChoice = 'auto' | 'on' | 'off'

export type SafeMode = {
  choice: SafeChoice
  /** Crashes this device had, and when the last one was found (ISO). */
  crashes: number
  at: string | null
  /** Long runs in a row that ended cleanly since the last crash. */
  clean: number
  /** Whether the player was told it came on (a toast as the next run starts). */
  told: boolean
}

/** Clean runs in a row that turn auto safe mode off, and the minutes a run needs to count: phones died from the 5:00 boss on. */
export const SAFE_MODE = { cleanRuns: 3, cleanMinutes: 5 } as const

export const NO_CRASHES: SafeMode = { choice: 'auto', crashes: 0, at: null, clean: 0, told: true }

/** Whether safe mode is on. */
export const isSafe = (s: SafeMode) => (s.choice === 'auto' ? s.crashes > 0 && s.clean < SAFE_MODE.cleanRuns : s.choice === 'on')

/** A crash: the clean streak starts over, and a player who had turned safe mode off gets it back (and the toast says so). */
export const afterCrash = (s: SafeMode, at: string): SafeMode => ({
  choice: s.choice === 'off' ? 'auto' : s.choice,
  crashes: s.crashes + 1,
  at,
  clean: 0,
  told: s.choice === 'on',
})

/** A run that ended without the page dying, after `minutes`: a long one counts toward turning auto safe mode off. */
export const afterRun = (s: SafeMode, minutes: number): SafeMode =>
  s.crashes > 0 && s.clean < SAFE_MODE.cleanRuns && minutes >= SAFE_MODE.cleanMinutes ? { ...s, clean: s.clean + 1 } : s

export const parseSafeMode = (v: unknown): SafeMode => {
  if (!isRecord(v)) return NO_CRASHES
  return {
    choice: v.choice === 'on' || v.choice === 'off' ? v.choice : 'auto',
    crashes: wholeNumber(v.crashes),
    at: typeof v.at === 'string' ? v.at : null,
    clean: wholeNumber(v.clean),
    told: v.told !== false,
  }
}

/* ---------------- This device ---------------- */

const KEY = 'ps:safeMode'

let state: SafeMode | null = null

const read = (): SafeMode => {
  try {
    return parseSafeMode(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return NO_CRASHES
  }
}

const current = () => (state ??= read())

const write = (next: SafeMode) => {
  state = next
  detail.safe = isSafe(next)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private mode or a full storage: it holds for this session.
  }
}

/** Reads the stored state into `detail.safe`; the boot calls it before anything draws. */
export const loadSafeMode = () => {
  detail.safe = isSafe(current())
  return current()
}

export const safeModeOn = () => isSafe(current())

/** The boot found a crash (`takeCrash`). */
export const noteCrash = () => write(afterCrash(current(), new Date().toISOString()))

/** A solo run ended on its own terms (not `left`) after `minutes`. */
export const noteCleanRun = (minutes: number) => {
  const next = afterRun(current(), minutes)
  if (next !== current()) write(next)
}

/** The player's say from Ajustes (or `ps.safeMode`): `auto` hands it back to the crashes. */
export const setSafeMode = (choice: SafeChoice) => write({ ...current(), choice, told: true })

/** True once after a crash turned safe mode on: the run starting now tells the player. */
export const takeSafeNotice = () => {
  const s = current()
  if (s.told || !isSafe(s)) return false
  write({ ...s, told: true })
  return true
}

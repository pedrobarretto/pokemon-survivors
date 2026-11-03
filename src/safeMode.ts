import { isRecord, wholeNumber } from './game/parse'
import { detail, type SafeLevel } from './render/quality'

/**
 * Safe mode (Modo leve): after a run the phone killed (the crash watch,
 * `takeCrash` in `bugReport.ts`), this device draws lean for good
 * (`render/quality.ts`), keeps fewer silhouettes and loads the outbreak's shiny
 * only when one shows. Another crash takes it a level further (level 2: fewer
 * silhouettes still, fewer particles and weather drops). A few long runs in a
 * row that end cleanly step it back down a level, so one bad day doesn't pin
 * a good phone for good. The player can turn it on or off in Ajustes.
 * Presentation only: the simulation never reads it, so replays and the ranking are untouched.
 */

/** `auto` follows the crashes; `on` and `off` are the player's say (Ajustes, `ps.safeMode`). */
export type SafeChoice = 'auto' | 'on' | 'off'

export type SafeMode = {
  choice: SafeChoice
  /** Crashes this device had, and when the last one was found (ISO). */
  crashes: number
  at: string | null
  /** The level the crashes set (`auto`): up one per crash, down one per `SAFE_MODE.stepDown` clean runs. */
  level: SafeLevel
  /** Long runs in a row that ended cleanly since the last crash or step down. */
  clean: number
  /** Whether the player was told it came on (a toast as the next run starts). */
  told: boolean
}

/**
 * Clean runs in a row that step each level down (level 1 off after 3, level 2 to 1 after 5),
 * and the minutes a run needs to count: phones died from the 5:00 boss on.
 */
export const SAFE_MODE = { stepDown: { 1: 3, 2: 5 }, cleanMinutes: 5 } as const satisfies { stepDown: Record<Exclude<SafeLevel, 0>, number>; cleanMinutes: number }

export const NO_CRASHES: SafeMode = { choice: 'auto', crashes: 0, at: null, level: 0, clean: 0, told: true }

/** The level the device draws at: the crashes' (`auto`), at least 1 when the player turned it on, 0 when off. */
export const safeLevel = (s: SafeMode): SafeLevel => (s.choice === 'off' ? 0 : s.choice === 'on' && s.level === 0 ? 1 : s.level)

/** Whether safe mode is on. */
export const isSafe = (s: SafeMode) => safeLevel(s) > 0

/** A crash: up a level, the clean streak starts over, and a player who had turned safe mode off gets it back (and the toast says so). */
export const afterCrash = (s: SafeMode, at: string): SafeMode => ({
  choice: s.choice === 'off' ? 'auto' : s.choice,
  crashes: s.crashes + 1,
  at,
  level: s.level === 0 ? 1 : 2,
  clean: 0,
  told: s.choice === 'on',
})

/** A run that ended without the page dying, after `minutes`: a long one counts toward stepping the level down. */
export const afterRun = (s: SafeMode, minutes: number): SafeMode => {
  if (s.level === 0 || minutes < SAFE_MODE.cleanMinutes) return s
  const clean = s.clean + 1
  return clean >= SAFE_MODE.stepDown[s.level] ? { ...s, level: s.level === 2 ? 1 : 0, clean: 0 } : { ...s, clean }
}

const levelOf = (v: unknown): SafeLevel => (v === 2 ? 2 : v === 1 ? 1 : 0)

export const parseSafeMode = (v: unknown): SafeMode => {
  if (!isRecord(v)) return NO_CRASHES
  const crashes = wholeNumber(v.crashes)
  const clean = wholeNumber(v.clean)
  // A state from before the levels: on (level 1) from a crash until 3 clean runs.
  const level = 'level' in v ? levelOf(v.level) : crashes > 0 && clean < SAFE_MODE.stepDown[1] ? 1 : 0
  return {
    choice: v.choice === 'on' || v.choice === 'off' ? v.choice : 'auto',
    crashes,
    at: typeof v.at === 'string' ? v.at : null,
    level,
    clean: level === 0 ? 0 : clean,
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
  detail.safe = safeLevel(next)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private mode or a full storage: it holds for this session.
  }
}

/** Reads the stored state into `detail.safe`; the boot calls it before anything draws. */
export const loadSafeMode = () => {
  detail.safe = safeLevel(current())
  return current()
}

export const safeModeOn = () => isSafe(current())

/** The level drawn now (`detail.safe`), for `run_end` and `run_crash`. */
export const safeModeLevel = () => safeLevel(current())

/** The boot found a crash (`takeCrash`). */
export const noteCrash = () => write(afterCrash(current(), new Date().toISOString()))

/** A solo run ended on its own terms (not `left`) after `minutes`. */
export const noteCleanRun = (minutes: number) => {
  const next = afterRun(current(), minutes)
  if (next !== current()) write(next)
}

/** The player's say from Ajustes (or `ps.safeMode`): `auto` hands it back to the crashes. */
export const setSafeMode = (choice: SafeChoice) => write({ ...current(), choice, told: true })

/** Sets the crashes' level as if they had come (dev: `ps.safeMode(2)`), back to `auto`. */
export const setSafeLevel = (level: SafeLevel) => write({ ...current(), choice: 'auto', level, clean: 0, told: true })

/** True once after a crash turned safe mode on: the run starting now tells the player. */
export const takeSafeNotice = () => {
  const s = current()
  if (s.told || !isSafe(s)) return false
  write({ ...s, told: true })
  return true
}

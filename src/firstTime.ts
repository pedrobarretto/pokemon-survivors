/**
 * The first visit's onboarding, as an A/B test: a new device is drawn into an
 * arm once (`enrol`) and keeps it. Arm `tour` meets Rotom's welcome, the
 * training run (or "Já sei jogar"), the first partner pick among every starter
 * and, after the first real run, the lobby tour; arm `control` keeps the fast
 * lane (`startFirstRun` in main.ts: straight into a run with the saved partner).
 * The rules are pure (`nextFirst`, `tourDue`); the device's state is one
 * `localStorage` entry (`ps:onboarding`), read and written in try/catch.
 */

export const ARMS = ['tour', 'control'] as const

export type Arm = (typeof ARMS)[number]

/** How the training run ended and the furthest step it reached (`TutorialStepId`, a string here so this module stays import-free). */
export type TutorialOutcome = { how: 'finished' | 'skipped'; step: string }

/** How the lobby tour ended. */
export type TourOutcome = 'done' | 'skipped'

/**
 * Where this device is in the onboarding. `arm` is null for a device that
 * wasn't a first visit when this shipped (or came in signed in): it never
 * sees the onboarding.
 */
export type FirstTime = {
  arm: Arm | null
  /** Rotom's welcome was shown (whatever was answered). */
  welcome: boolean
  /** The training run's end, null while it was never played to an end (or "Já sei jogar"). */
  tutorial: TutorialOutcome | null
  /** The first partner pick made (its run started). */
  partner: boolean
  tour: TourOutcome | null
}

export const NOT_ENROLLED: FirstTime = { arm: null, welcome: false, tutorial: null, partner: false, tour: null }

/** The arm a roll in [0, 1) draws: half and half. */
export const drawArm = (roll: number): Arm => (roll < 0.5 ? 'tour' : 'control')

/**
 * The state after this page load's boot: an arm already drawn stays; a first
 * visit by today's rules (`isFirstLoad`, `firstRunDue`: no run banked, not
 * signed in) draws one from `roll`; anyone else stays out of the test.
 */
export const enrol = (s: FirstTime, firstVisit: boolean, signedIn: boolean, roll: number): FirstTime =>
  s.arm !== null || !firstVisit || signedIn ? s : { ...s, arm: drawArm(roll) }

/** What a first run's Play leads to: Rotom's welcome, the first partner pick, or the fast lane. */
export type FirstNext = 'welcome' | 'partner' | 'fastLane'

/**
 * Where "press start" (or JOGAR) takes a device whose first run is due
 * (`firstRunDue`). Arm `tour` meets the welcome once; after it (answered,
 * the training run finished or skipped, or a reload mid-way) the partner pick.
 */
export const nextFirst = (s: FirstTime): FirstNext => (s.arm !== 'tour' ? 'fastLane' : s.welcome ? 'partner' : 'welcome')

/** The lobby tour waits for the first lobby after a first partner pick's run, in arm `tour`, in a save's first runs (a merged account's long save doesn't need it). */
export const TOUR_RUNS = 5

/** Whether the lobby, as it shows now with `runs` banked, gives the tour. */
export const tourDue = (s: FirstTime, runs: number) => s.arm === 'tour' && s.partner && s.tour === null && runs >= 1 && runs <= TOUR_RUNS

const isArm = (v: unknown): v is Arm => v === 'tour' || v === 'control'

/** An object's fields, or null for anything else. */
const fields = (v: unknown): Record<string, unknown> | null => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null)

/** Reads a stored state back, dropping whatever doesn't fit (an older shape, a hand edit). */
export const parseFirstTime = (raw: string | null): FirstTime => {
  if (!raw) return NOT_ENROLLED
  try {
    const o = fields(JSON.parse(raw))
    if (!o) return NOT_ENROLLED
    const t = fields(o.tutorial)
    const how = t?.how
    return {
      arm: isArm(o.arm) ? o.arm : null,
      welcome: o.welcome === true,
      tutorial: how === 'finished' || how === 'skipped' ? { how, step: String(t?.step ?? '') } : null,
      partner: o.partner === true,
      tour: o.tour === 'done' || o.tour === 'skipped' ? o.tour : null,
    }
  } catch {
    return NOT_ENROLLED
  }
}

/* ---------------- The device's state ---------------- */

const KEY = 'ps:onboarding'

/** This device's onboarding state (out of the test when storage can't be read). */
export const firstTime = (): FirstTime => {
  try {
    return parseFirstTime(localStorage.getItem(KEY))
  } catch {
    return NOT_ENROLLED
  }
}

/** Changes this device's state; returns the new one. */
export const updateFirstTime = (change: (s: FirstTime) => FirstTime): FirstTime => {
  const next = change(firstTime())
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {}
  return next
}

/** Forgets the whole onboarding on this device (`ps.onboarding('reset')`). */
export const forgetFirstTime = () => {
  try {
    localStorage.removeItem(KEY)
  } catch {}
}

/** Draws this device's arm at boot if it's due one (`enrol`, with `Math.random`: the test's draw, never the simulation's). */
export const enrolDevice = (firstVisit: boolean, signedIn: boolean) => {
  const s = firstTime()
  const next = enrol(s, firstVisit, signedIn, Math.random())
  if (next !== s) updateFirstTime(() => next)
  return next
}

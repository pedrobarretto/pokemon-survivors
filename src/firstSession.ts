import { accountUserId } from './account'
import { recordReplay, track } from './analytics'
import { firstTime } from './firstTime'
import { answerGate, furthest, isFirstLoad, NO_STEPS, reach, REPLAY_RATE, type FirstStep, type FirstSteps, type GateAnswer } from './firstSteps'
import { hostApp, onOnboarding, type OnboardingStep } from './onboarding'
import { deviceNow } from './telemetry'
import { cdnState } from './assets'
import { framed } from './handoff'

/**
 * A new device's first visit, as one `first_session` event: where it got to
 * (`firstSteps.ts`) and how long each step took. The shell marks the steps
 * with one-line calls (`firstStep`, `firstGate`, `firstRunClock`), which do
 * nothing on any other page load. The onboarding's training run is no first
 * run: while it plays (`holdRunSteps`) its loading, frame and clock mark
 * nothing. The event carries the device's onboarding arm and how its training
 * run ended (`firstTime.ts`). A sample of these loads is also recorded
 * (session replay) until a minute into the first run.
 */

const LOADS_KEY = 'ps:firstLoads'

/** This load's steps; null when it isn't a first visit, or once its event went. */
let steps: FirstSteps | null = null
let load = 0
let replay = false
/** The onboarding moments (`onboarding.ts`: the fast lane, the gate skipped, the save card, the in-app hint) this load went through, each once. */
let moments: OnboardingStep[] = []
/** Set while the training run plays: its loading, first frame and minute aren't the first run's. */
let held = false
/** The steps only a real run marks. */
const RUN_STEPS: readonly FirstStep[] = ['loading', 'firstFrame', 'minute']
/** The first run's opening sheets as they load (`firstSheets`): how many of how many were in when the visit was sent. */
let sheets: { done: number; total: number } | null = null

/**
 * The Pokémon sheets this page fetched (resource timing): how many, the median
 * and slowest in ms, and the KB that came over the network. It tells a slow or
 * lossy route (a first run stuck loading) from a page left before playing.
 */
const spriteFetches = () => {
  const got = performance.getEntriesByType('resource').filter((e): e is PerformanceResourceTiming => e instanceof PerformanceResourceTiming && e.name.includes('/pokemon/'))
  if (got.length === 0) return null
  const ms = got.map((e) => e.duration).sort((a, b) => a - b)
  return { n: got.length, p50: Math.round(ms[ms.length >> 1] ?? 0), max: Math.round(ms[ms.length - 1] ?? 0), kb: Math.round(got.reduce((sum, e) => sum + e.transferSize, 0) / 1024) }
}

/** The browser's guess at the network (Chrome on Android and desktop only): its kind and round trip in ms. */
const network = () => {
  const c = (navigator as Navigator & { connection?: { effectiveType?: string; rtt?: number } }).connection
  return c ? { type: c.effectiveType ?? null, rtt: c.rtt ?? null } : null
}

const loadsBefore = () => {
  try {
    return Number(localStorage.getItem(LOADS_KEY)) || 0
  } catch {
    return 0
  }
}

/** Dev builds record a first load for sure with `localStorage['ps:replay'] = 'on'`, to try the replay without the sample. */
const devReplay = () => {
  try {
    return import.meta.env.DEV && localStorage.getItem('ps:replay') === 'on'
  } catch {
    return false
  }
}

const countLoad = (n: number) => {
  try {
    localStorage.setItem(LOADS_KEY, String(n))
  } catch {}
}

/** Sends the visit, once: a minute into the first run, or as the page hides (by beacon, it may be going away). */
const send = (sent: 'minute' | 'hidden') => {
  const s = steps
  if (!s) return
  steps = null
  if (replay) recordReplay(false)
  const onboarding = firstTime()
  track(
    'first_session',
    {
      ...furthest(s.times),
      seconds: s.times,
      gate: s.gate,
      load,
      sent,
      inApp: hostApp()?.app ?? null,
      moments,
      arm: onboarding.arm,
      tutorial: onboarding.tutorial?.how ?? null,
      tutorialStep: onboarding.tutorial?.step ?? null,
      cdn: cdnState(),
      framed: framed() ? 1 : 0,
      at: Math.round(performance.now() / 100) / 10,
      sheets,
      sprites: spriteFetches(),
      network: network(),
      account: accountUserId() ? 1 : 0,
      replay: replay ? 1 : 0,
      ...deviceNow(),
    },
    { beacon: sent === 'hidden' },
  )
}

/**
 * Starts watching this page load if it's a first visit (`isFirstLoad`, from the save's banked `runs`), and says whether it is.
 * Call once at boot, after `startAnalytics`.
 */
export const startFirstSession = (runs: number): boolean => {
  const before = loadsBefore()
  if (!isFirstLoad(runs, before)) return false
  load = before + 1
  countLoad(load)
  steps = NO_STEPS
  // Room for every sheet a first run fetches (the default keeps 250 entries), so `spriteFetches` sees them all.
  performance.setResourceTimingBufferSize(2000)
  onOnboarding((m) => {
    if (steps && !moments.includes(m)) moments = [...moments, m]
  })
  addEventListener('pagehide', () => send('hidden'))
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && send('hidden'))
  // Only a device's very first load, so a recording is one per device (PostHog's free tier holds 5k a month).
  replay = load === 1 && (Math.random() < REPLAY_RATE || devReplay())
  if (replay) recordReplay(true)
  return true
}

/** Holds the run steps (`loading`, `firstFrame`, `minute`) while the training run plays (`on`), and lets them through again after it. */
export const holdRunSteps = (on: boolean) => {
  held = on
}

/** The visit reached `step` (only the first time counts); `minute` sends it. */
export const firstStep = (step: FirstStep) => {
  if (!steps || (held && RUN_STEPS.includes(step))) return
  steps = reach(steps, step, performance.now() / 1000)
  if (step === 'minute') send('minute')
}

/** The sign-in gate was answered. */
export const firstGate = (answer: GateAnswer) => {
  if (steps) steps = answerGate(steps, answer)
}

/** A run's clock (`g.time`), each frame it's drawn: a minute in is the visit's last step. */
export const firstRunClock = (seconds: number) => {
  if (steps && !held && seconds >= 60) firstStep('minute')
}

/** The first run's opening sheets loaded so far (`loadRunSheets`' progress); the training run's don't count. */
export const firstSheets = (done: number, total: number) => {
  if (steps && !held) sheets = { done, total }
}

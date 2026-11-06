import { accountUserId } from './account'
import { recordReplay, track } from './analytics'
import { answerGate, furthest, isFirstLoad, NO_STEPS, reach, REPLAY_RATE, type FirstStep, type FirstSteps, type GateAnswer } from './firstSteps'
import { hostApp, onOnboarding, type OnboardingStep } from './onboarding'
import { deviceNow } from './telemetry'

/**
 * A new device's first visit, as one `first_session` event: where it got to
 * (`firstSteps.ts`) and how long each step took. The shell marks the steps
 * with one-line calls (`firstStep`, `firstGate`, `firstRunClock`), which do
 * nothing on any other page load. A sample of these loads is also recorded
 * (session replay) until a minute into the first run.
 */

const LOADS_KEY = 'ps:firstLoads'

/** This load's steps; null when it isn't a first visit, or once its event went. */
let steps: FirstSteps | null = null
let load = 0
let replay = false
/** The onboarding moments (`onboarding.ts`: the fast lane, the gate skipped, the save card, the in-app hint) this load went through, each once. */
let moments: OnboardingStep[] = []

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
      account: accountUserId() ? 1 : 0,
      replay: replay ? 1 : 0,
      ...deviceNow(),
    },
    { beacon: sent === 'hidden' },
  )
}

/** Starts watching this page load if it's a first visit (`isFirstLoad`, from the save's banked `runs`). Call once at boot, after `startAnalytics`. */
export const startFirstSession = (runs: number) => {
  const before = loadsBefore()
  if (!isFirstLoad(runs, before)) return
  load = before + 1
  countLoad(load)
  steps = NO_STEPS
  onOnboarding((m) => {
    if (steps && !moments.includes(m)) moments = [...moments, m]
  })
  addEventListener('pagehide', () => send('hidden'))
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && send('hidden'))
  // Only a device's very first load, so a recording is one per device (PostHog's free tier holds 5k a month).
  replay = load === 1 && (Math.random() < REPLAY_RATE || devReplay())
  if (replay) recordReplay(true)
}

/** The visit reached `step` (only the first time counts); `minute` sends it. */
export const firstStep = (step: FirstStep) => {
  if (!steps) return
  steps = reach(steps, step, performance.now() / 1000)
  if (step === 'minute') send('minute')
}

/** The sign-in gate was answered. */
export const firstGate = (answer: GateAnswer) => {
  if (steps) steps = answerGate(steps, answer)
}

/** A run's clock (`g.time`), each frame it's drawn: a minute in is the visit's last step. */
export const firstRunClock = (seconds: number) => {
  if (steps && seconds >= 60) firstStep('minute')
}

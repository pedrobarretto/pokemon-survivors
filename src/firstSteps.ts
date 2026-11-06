/**
 * Where a new device's first visits get to, as plain data (`firstSession.ts`
 * holds it for the page and sends it as `first_session`). Pure, so the rules
 * are tested without a page.
 */

/**
 * The steps a first visit can reach, in the order a first run passes them: the
 * intro's "press start", the lobby, JOGAR, the sign-in gate, the partner
 * select, the run loading, its first frame, and a minute into it. Any of them
 * may be skipped (a link straight to the Boutique, back from signing in, a flow
 * without the gate), so a visit is judged by the furthest it reached.
 */
export const FIRST_STEPS = ['intro', 'lobby', 'play', 'gate', 'select', 'loading', 'firstFrame', 'minute'] as const

export type FirstStep = (typeof FIRST_STEPS)[number]

/** How the sign-in gate was answered: a sign in started (or an account came in), played as a guest, or backed out of. */
export type GateAnswer = 'signIn' | 'guest' | 'back'

/** Seconds into the page load each step was first reached. */
export type StepTimes = Partial<Record<FirstStep, number>>

export type FirstSteps = { times: StepTimes; gate: GateAnswer | null }

export const NO_STEPS: FirstSteps = { times: {}, gate: null }

/**
 * Page loads a device counts as first visits while it has no run: the sign-in
 * round trip is a load of its own (it leaves for Google or Discord and comes
 * back), and a visitor who doesn't play within a couple of loads rarely does
 * (activation is measured over 2 days). Bounds the event to 3 per new device.
 */
export const FIRST_LOADS = 3

/** Share of new devices whose first page load is recorded (session replay), until a minute into their first run. */
export const REPLAY_RATE = 0.05

/** Whether this page load is a first visit: no run banked on the device, and fewer than `FIRST_LOADS` counted before. */
export const isFirstLoad = (runs: number, loadsBefore: number) => runs === 0 && loadsBefore < FIRST_LOADS

/** `step` reached `seconds` into the page load; only the first time counts. */
export const reach = (s: FirstSteps, step: FirstStep, seconds: number): FirstSteps =>
  s.times[step] !== undefined ? s : { ...s, times: { ...s.times, [step]: Math.round(seconds * 10) / 10 } }

/** The gate answered: the last answer counts (backed out, then played as a guest, is a guest). */
export const answerGate = (s: FirstSteps, gate: GateAnswer): FirstSteps => ({ ...s, gate })

/** The furthest step reached and its place in `FIRST_STEPS` (-1 for none), for insights that ask "got past the select?". */
export const furthest = (times: StepTimes): { step: FirstStep | null; stepIndex: number } => {
  const stepIndex = FIRST_STEPS.reduce((at, s, i) => (times[s] !== undefined ? i : at), -1)
  return { step: FIRST_STEPS[stepIndex] ?? null, stepIndex }
}

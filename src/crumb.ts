import { isRecord } from './game/parse'

/**
 * The crash watch's breadcrumb (`bugReport.ts`): what memory the run held and
 * the last key moment before the page died, so `run_crash` can tell a phone
 * killing the tab at a boss's arrival from one running out over a long run.
 * Pure: the shell measures, this shapes and reads it back.
 */

/** Key moments of a run, written to the watch as they happen (`runMoment`) rather than at its next 5 s tick. */
export const CRUMB_MOMENTS = ['boss', 'phase', 'omen', 'rift', 'riftExit', 'biome', 'place', 'pick', 'evolve', 'mega'] as const
export type CrumbMoment = (typeof CRUMB_MOMENTS)[number]

/**
 * How far a run's launch got (`launchStep` in `bugReport.ts`), written as each step starts:
 * `ticket` waiting for the ranked ticket, `sheets` swapping the lobby's sheets for the run's
 * (decoding them), `firstFrame` the run set up and its first frame not drawn yet, `running`
 * past it. Pages died most in a run's first seconds: this says which of them.
 */
export const LAUNCH_STEPS = ['ticket', 'sheets', 'firstFrame', 'running'] as const
export type LaunchStep = (typeof LAUNCH_STEPS)[number]

export type Quality = 'lean' | 'full'

/**
 * What the device holds right now, in MB (w×h×4) with the run's peaks: the downloaded sprite
 * sheets' decoded pixels (`sheetStats`), the canvases the caches keep (`heldCanvases`), and
 * the quality the governor draws at.
 */
export type Memory = {
  sheetMb: number
  peakSheetMb: number
  sheets: number
  canvasMb: number
  peakCanvasMb: number
  canvases: number
  peakCanvases: number
  quality: Quality
}

/**
 * The breadcrumb: the memory as last sampled, the last key moment with the run's second it came
 * at (null before any) and the launch's step (null from a build before it).
 */
export type Crumb = Memory & { moment: CrumbMoment | null; momentAt: number | null; launch: LaunchStep | null }

/** Bytes in MB, to one decimal. */
export const toMb = (bytes: number) => Math.round(bytes / 104_857.6) / 10

const MOMENTS: ReadonlySet<string> = new Set(CRUMB_MOMENTS)
const isMoment = (v: unknown): v is CrumbMoment => typeof v === 'string' && MOMENTS.has(v)
const STEPS: ReadonlySet<string> = new Set(LAUNCH_STEPS)
const isStep = (v: unknown): v is LaunchStep => typeof v === 'string' && STEPS.has(v)

/** A finite number ≥ 0 (rounded to 1 decimal), else 0. */
const amount = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : 0)

/** The breadcrumb as stored in the watch (JSON in localStorage, maybe from an older build or tampered with), or null. */
export const parseCrumb = (v: unknown): Crumb | null => {
  if (!isRecord(v)) return null
  const moment = isMoment(v.moment) ? v.moment : null
  return {
    sheetMb: amount(v.sheetMb),
    peakSheetMb: amount(v.peakSheetMb),
    sheets: Math.round(amount(v.sheets)),
    canvasMb: amount(v.canvasMb),
    peakCanvasMb: amount(v.peakCanvasMb),
    canvases: Math.round(amount(v.canvases)),
    peakCanvases: Math.round(amount(v.peakCanvases)),
    quality: v.quality === 'lean' ? 'lean' : 'full',
    moment,
    momentAt: moment && typeof v.momentAt === 'number' ? Math.round(amount(v.momentAt)) : null,
    launch: isStep(v.launch) ? v.launch : null,
  }
}

/** Android's major version from Client Hints (`platform` `Android`, `platformVersion` `14.0.0`), or null elsewhere. */
export const androidMajor = (platform: unknown, platformVersion: unknown) => {
  if (platform !== 'Android' || typeof platformVersion !== 'string') return null
  const major = Number.parseInt(platformVersion, 10)
  return Number.isFinite(major) && major > 0 ? major : null
}

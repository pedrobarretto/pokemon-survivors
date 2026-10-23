import { androidMajor, toMb, type Memory } from './crumb'
import { heldCanvases } from './engine/pixelart'
import { isRecord } from './game/parse'
import { detail } from './render/quality'
import { sheetStats } from './render/sprites'

/**
 * What `run_end` and `run_crash` say about the device beyond the run: which
 * phone it is, and the memory the game holds (sampled, with the run's peaks).
 */

/** The phone, where the browser tells (Chromium's Client Hints; Android's user agent only says "K"). */
export type DeviceInfo = { deviceModel: string | null; androidVersion: number | null }

/** The slice of `navigator.userAgentData` asked for here (lib.dom doesn't have it). */
type UAData = { getHighEntropyValues: (hints: string[]) => Promise<unknown> }

const isUAData = (v: unknown): v is UAData => isRecord(v) && typeof v.getHighEntropyValues === 'function'

const UNKNOWN: DeviceInfo = { deviceModel: null, androidVersion: null }

/** How long the hints may take before the answer is "unknown" (a `run_crash` waits on it). */
const HINTS_MS = 2000

let device: DeviceInfo = UNKNOWN

/** Asked once per page, at load; the answer lands in `device` for `run_end`, which can't wait (it may go out as the page closes). */
const asked: Promise<DeviceInfo> = (async () => {
  const ua: unknown = Reflect.get(navigator, 'userAgentData')
  if (!isUAData(ua)) return UNKNOWN
  const hints = await Promise.race([ua.getHighEntropyValues(['model', 'platformVersion']).catch(() => null), new Promise<null>((done) => setTimeout(() => done(null), HINTS_MS))])
  if (!isRecord(hints)) return UNKNOWN
  const model = typeof hints.model === 'string' ? hints.model.trim().slice(0, 60) : ''
  device = { deviceModel: model || null, androidVersion: androidMajor(hints.platform, hints.platformVersion) }
  return device
})()

/** The device as known so far (unknown until the hints answer, a moment after load). */
export const deviceNow = (): DeviceInfo => device

/** The device, once the hints answer (or don't, within 2 s). */
export const deviceInfo = () => asked

/** The run's peaks so far, in bytes and canvases (`resetMemoryPeaks` starts them over). */
const peaks = { sheetBytes: 0, canvasBytes: 0, canvases: 0 }

/** Starts the peaks over from what's held now (a run starting). */
export const resetMemoryPeaks = () => {
  peaks.sheetBytes = 0
  peaks.canvasBytes = 0
  peaks.canvases = 0
  sampleMemory()
}

/**
 * Measures what the game holds now and folds it into the run's peaks. Walks every
 * canvas cache, so it runs with the crash watch (every 5 s, and at a run's key moments
 * and end), never per frame: a peak between two samples goes unseen.
 */
export const sampleMemory = (): Memory => {
  const sheets = sheetStats()
  const held = heldCanvases()
  peaks.sheetBytes = Math.max(peaks.sheetBytes, sheets.bytes)
  peaks.canvasBytes = Math.max(peaks.canvasBytes, held.bytes)
  peaks.canvases = Math.max(peaks.canvases, held.canvases)
  return {
    sheetMb: toMb(sheets.bytes),
    peakSheetMb: toMb(peaks.sheetBytes),
    sheets: sheets.sheets,
    canvasMb: toMb(held.bytes),
    peakCanvasMb: toMb(peaks.canvasBytes),
    canvases: held.canvases,
    peakCanvases: peaks.canvases,
    quality: detail.lean ? 'lean' : 'full',
  }
}

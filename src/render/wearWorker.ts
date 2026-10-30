import type { WearableId } from '../data/wearables'
import type { Dir8 } from '../engine/math'
import { mirror, rasterize, type PixelArt } from './wearArt'
import { artDir, isMirrored, yawOf } from './wearFit'
import { WEAR_MODELS, type WearSize } from './wearModels'

/**
 * Renders wearable art off the main thread (`render/wearEngine.ts` posts the
 * jobs): a model takes a few milliseconds, a pair of wings tens on a phone,
 * and a match's looks render as players first turn, so none of it may stall
 * a frame. Pure math in, palette indexes out.
 */

export type ArtJob = { key: string; id: WearableId; size: WearSize; dir: Dir8; frame: number }
export type ArtDone = { key: string; art: PixelArt }

/** One job's art: the art direction's render, flipped for the west-facing rows. */
export const renderJob = ({ id, size, dir, frame }: ArtJob): PixelArt => {
  const raw = rasterize(WEAR_MODELS[id].scene(size, frame), yawOf(artDir(dir)))
  return isMirrored(dir) ? mirror(raw) : raw
}

/** The worker's side of the messages (this module also loads, inert, on the main thread and in tests). */
type Scope = { onmessage: ((e: MessageEvent<ArtJob>) => void) | null; postMessage: (done: ArtDone, transfer: Transferable[]) => void }

if (typeof (globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope !== 'undefined') {
  const scope = globalThis as unknown as Scope
  scope.onmessage = (e) => {
    const art = renderJob(e.data)
    scope.postMessage({ key: e.data.key, art }, [art.px.buffer])
  }
}

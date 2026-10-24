/**
 * A signal that aborts a request after `ms`: `AbortSignal.timeout` where the
 * browser has it, else an `AbortController` on a timer (Safari before 16,
 * Chrome before 103 and the in-app browsers built on them lack it).
 */
export const timeoutSignal = (ms: number): AbortSignal => {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms)
  const controller = new AbortController()
  setTimeout(() => controller.abort(new DOMException('signal timed out', 'TimeoutError')), ms)
  return controller.signal
}

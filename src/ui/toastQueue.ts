/**
 * The toast line as plain data: toasts wait their turn, at most `max` show
 * at once, and each one's clock only runs while it is on screen, so a burst
 * of news (a rift's loot, an evolution, the weather) reads one by one and
 * nothing expires unseen. A toast with a `key` takes the place of an older one
 * with the same key, so repeats don't pile up.
 */
export type QueuedToast<T> = { item: T; key: string | null; left: number; shown: boolean }

/**
 * Lines up a toast lasting `seconds` once shown. Returns the toast it
 * replaced (same key) so the caller can swap it out, or null.
 */
export const pushToast = <T>(queue: QueuedToast<T>[], item: T, seconds: number, key: string | null = null) => {
  const i = key === null ? -1 : queue.findIndex((q) => q.key === key)
  const old = queue[i]
  if (!old) {
    queue.push({ item, key, left: seconds, shown: false })
    return null
  }
  // Same spot in line; one already on screen stays there with a fresh clock.
  queue[i] = { item, key, left: seconds, shown: old.shown }
  return old
}

/**
 * Runs the clocks of the toasts on screen, drops those whose time ran out
 * and brings waiting ones in, in order, up to `max` on screen.
 */
export const stepToasts = <T>(queue: QueuedToast<T>[], dt: number, max: number) => {
  const done: T[] = []
  const shown: T[] = []
  let onScreen = 0
  for (let i = 0; i < queue.length; i++) {
    const q = queue[i]!
    if (q.shown) q.left -= dt
    if (q.shown && q.left <= 0) {
      done.push(q.item)
      queue.splice(i--, 1)
    } else if (q.shown) onScreen++
  }
  for (const q of queue) {
    if (onScreen >= max) break
    if (q.shown) continue
    q.shown = true
    shown.push(q.item)
    onScreen++
  }
  return { shown, done }
}

/** The "Avisos na partida" setting: every toast in a run, only those that warn or ask for something, or none. */
export const RUN_TOASTS = ['all', 'important', 'none'] as const
export type RunToasts = (typeof RUN_TOASTS)[number]

/** Whether a run's toast shows under `setting`: an `important` one at Todos and Só importantes, a minor one (a drop, a shiny spotted) at Todos alone. */
export const runToastShows = (setting: RunToasts, important: boolean) => setting === 'all' || (setting === 'important' && important)

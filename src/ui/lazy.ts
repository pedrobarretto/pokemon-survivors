import { t } from '../i18n'
import { h } from './dom'
import type { Screen } from './screens'
import { toast } from './toasts'

/*
 * Screens whose code is a chunk of their own (modes most players never open,
 * like the Poké Realm or the Arena): a loading line stands in while the
 * chunk downloads (shown only after a moment, so a quick load doesn't flash).
 * Disposed before it lands, nothing goes on. A failed load says so and calls
 * `failed` (where to go instead); a chunk a deploy took away reloads into the
 * new build on its own (`watchDeploys` in `main.ts`).
 */

const waitLine = (root: HTMLElement) => {
  const el = h('div', { class: 'screen lazy-wait' }, h('p', { class: 'loading blink' }, t().loading))
  root.append(el)
  return el
}

/** Goes on with a chunk once it's here: `go` shows what comes next (its `setScreen` drops this one). */
export const lazyStep = <M>(root: HTMLElement, load: () => Promise<M>, go: (m: M) => void, failed: () => void): Screen => {
  let gone = false
  const el = waitLine(root)
  const landed = () => {
    if (gone) return false
    el.remove()
    return true
  }
  load().then(
    (m) => landed() && go(m),
    () => {
      if (!landed()) return
      toast(root, t().loadFailed, 4000, 'lazyFailed')
      failed()
    },
  )
  return {
    el,
    dispose: () => {
      gone = true
      el.remove()
    },
  }
}

/** A screen built from a chunk: `open` builds it in this one's place once the chunk is here. */
export const lazyScreen = <M>(root: HTMLElement, load: () => Promise<M>, open: (m: M) => Screen, failed: () => void): Screen => {
  let inner: Screen | null = null
  let gone = false
  const wait = lazyStep(
    root,
    load,
    (m) => {
      if (gone) return
      inner = open(m)
      self.el = inner.el
      self.dim = inner.dim
      self.scene = inner.scene
    },
    failed,
  )
  const self: Screen = {
    el: wait.el,
    tick: (now) => inner?.tick?.(now),
    dispose: () => {
      gone = true
      wait.dispose()
      inner?.dispose()
    },
  }
  return self
}

import { h } from './dom'
import { pushToast, runToastShows, stepToasts, type QueuedToast, type RunToasts } from './toastQueue'

/**
 * The run's news: toasts in one column under the HUD and big banners for
 * entrances, both fed here and driven by `tickToasts` from the game loop
 * (rules in `toastQueue.ts`). One banner shows at a time and the toasts wait
 * while it's up, since it sits where the column grows.
 */

type Stack = { host: HTMLElement; toasts: QueuedToast<HTMLElement>[]; banners: QueuedToast<HTMLElement>[] }

const MAX_TOASTS = 3
/** Phones held upright get the compact toasts (style.css, same query) and two at a time, so the news never covers the middle of the screen. */
const COMPACT = typeof matchMedia === 'function' ? matchMedia('(max-width: 720px) and (min-height: 501px)') : null
const COMPACT_MAX_TOASTS = 2

const stacks = new WeakMap<HTMLElement, Stack>()

const stackOf = (root: HTMLElement) => {
  const known = stacks.get(root)
  if (known?.host.isConnected) return known
  const stack: Stack = { host: h('div', { class: 'toasts' }), toasts: [], banners: [] }
  root.append(stack.host)
  stacks.set(root, stack)
  return stack
}

/**
 * Room for one more toast: the column, plus one more as tall as its last,
 * fits its CSS `max-height` (which keeps it clear of the Pokémon), so fewer
 * show at once on short screens or when the text wraps.
 */
const hasRoom = (host: HTMLElement) => {
  const last = host.lastElementChild
  if (!(last instanceof HTMLElement)) return true
  const style = getComputedStyle(host)
  const max = parseFloat(style.maxHeight)
  return Number.isNaN(max) || host.scrollHeight + parseFloat(style.rowGap) + last.offsetHeight <= max
}

/** A toast's own look: `shiny` stands out in gold from the white ones. */
export type ToastTone = 'shiny'

/**
 * Lines up a toast for `ms` on screen. Toasts sharing a `key` replace each
 * other, so news that supersedes older news (the weather) says it once.
 */
export const toast = (root: HTMLElement, content: HTMLElement | string, ms = 2600, key: string | null = null, tone: ToastTone | null = null) => {
  const stack = stackOf(root)
  const el = h('div', { class: tone ? `toast box toast-${tone}` : 'toast box' }, content)
  const old = pushToast(stack.toasts, el, ms / 1000, key)
  if (old?.shown) old.item.replaceWith(el)
}

/** The "Avisos na partida" setting, read as each run toast comes; the shell points it at the settings (`readRunToasts`). */
let runToastLevel = (): RunToasts => 'all'
export const readRunToasts = (read: () => RunToasts) => {
  runToastLevel = read
}

/**
 * A run's toast, shown as the setting allows (`runToastShows`). `important`
 * news warns or asks for something (a boss, a rift's omen, a hazard, Meowth
 * to catch); the rest (drops, berries, a shiny spotted, a milestone the
 * screen already shows) is minor. Toasts outside a run go through `toast`.
 */
export const runToast = (
  root: HTMLElement,
  importance: 'important' | 'minor',
  content: HTMLElement | string,
  ms?: number,
  key: string | null = null,
  tone: ToastTone | null = null,
) => {
  if (runToastShows(runToastLevel(), importance === 'important')) toast(root, content, ms, key, tone)
}

/**
 * Big centered announcement (legendary entrances, a new area). Wraps on
 * small screens. A `dismissible` one (a Mystery Gift's, which lists several
 * lines) goes away on a tap instead of letting it through to what's under it.
 */
export const banner = (root: HTMLElement, content: HTMLElement | string, ms = 3600, dismissible = false) => {
  const queue = stackOf(root).banners
  const el = h('div', { class: dismissible ? 'banner box dismissible' : 'banner box' }, content)
  if (dismissible) {
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      const q = queue.find((b) => b.item === el)
      if (q) q.left = 0
    })
  }
  pushToast(queue, el, ms / 1000)
}

/** Steps one line of news, fading out what's done and placing what shows in `into`. */
const advance = (queue: QueuedToast<HTMLElement>[], dt: number, max: number, into: HTMLElement) => {
  const { shown, done } = stepToasts(queue, dt, max)
  for (const el of done) {
    el.classList.add('out')
    setTimeout(() => el.remove(), 400)
  }
  into.append(...shown)
}

/**
 * Advances the news by `dt` seconds. `held` (a menu over the run) hides it
 * with its clocks stopped; `bannersHeld` does that to the banners alone (a
 * dialog over the title menus: a banner would cover it), and the toasts go on.
 */
export const tickToasts = (root: HTMLElement, dt: number, held: boolean, bannersHeld = held) => {
  const stack = stacks.get(root)
  if (!stack) return
  for (const b of stack.banners) if (b.shown) b.item.classList.toggle('held', bannersHeld)
  if (held) return stack.host.classList.add('held')
  if (!bannersHeld) advance(stack.banners, dt, 1, root)
  const bannerUp = !bannersHeld && stack.banners.some((b) => b.shown)
  stack.host.classList.toggle('held', bannerUp)
  if (bannerUp) return
  // One newcomer per frame at most, so each one is measured against the room left.
  const onScreen = stack.toasts.filter((q) => q.shown).length
  const waiting = onScreen < stack.toasts.length
  const max = COMPACT?.matches ? COMPACT_MAX_TOASTS : MAX_TOASTS
  advance(stack.toasts, dt, waiting && hasRoom(stack.host) ? Math.min(max, onScreen + 1) : 0, stack.host)
}

/** Drops all news, on screen or waiting (the run is over). */
export const clearToasts = (root: HTMLElement) => {
  const stack = stacks.get(root)
  if (!stack) return
  stack.host.remove()
  for (const b of stack.banners) b.item.remove()
  stacks.delete(root)
}

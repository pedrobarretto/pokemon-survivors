import type { Input } from '../engine/input'

/** What's steering the menus: arrows or a pad's `keys`, the browser's `tab`, or a `pointer` (a mouse, a finger). */
export type CursorMode = 'keys' | 'tab' | 'pointer'

const MODIFIER = /^(Shift|Control|Alt|Meta)/
/** Keys that move a menu's cursor, as opposed to pressing what the browser's focus holds. */
const STEP = /^(Arrow|Key[WASD]$)/

/** The mode after `key`, from `now`: Enter and the like press the focused control without taking the browser's cursor away. */
export const afterKey = (now: CursorMode, key: string): CursorMode => {
  if (MODIFIER.test(key)) return now
  return now === 'tab' && !STEP.test(key) ? 'tab' : 'keys'
}

/**
 * Keeps `data-cursor` on <html> on the mode in use, which the kit's cursor
 * reads ("The cursor" in style.css). Tab is heard on its own: `Input` leaves
 * out keys pressed in a text field, and tabbing out of one still moves focus.
 */
export const watchCursorMode = (input: Input) => {
  const root = document.documentElement
  const mode = () => root.dataset.cursor as CursorMode
  const set = (next: CursorMode) => void (root.dataset.cursor = next)
  set('pointer')
  input.onKey((key) => key !== 'Tab' && set(afterKey(mode(), key)))
  window.addEventListener('keydown', (e) => e.code === 'Tab' && set('tab'), true)
  window.addEventListener('pointerdown', () => set('pointer'), true)
  // Browsers send a mousemove when the page moves under a still mouse: only a real change of position counts.
  let last: { x: number; y: number } | null = null
  window.addEventListener(
    'pointermove',
    (e) => {
      const moved = last !== null && (last.x !== e.clientX || last.y !== e.clientY)
      last = { x: e.clientX, y: e.clientY }
      if (moved) set('pointer')
    },
    true,
  )
}

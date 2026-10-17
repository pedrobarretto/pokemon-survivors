import { ACTIONS } from '../engine/bindings'
import { boundKey } from './controls'
import { h, setText } from './dom'

/** The keycaps in inverted-T order, with the arrow that moves the same way (it always does, see `RESERVED_KEYS`). */
const KEYS = [
  { action: 'up', arrow: 'ArrowUp' },
  { action: 'left', arrow: 'ArrowLeft' },
  { action: 'down', arrow: 'ArrowDown' },
  { action: 'right', arrow: 'ArrowRight' },
] as const

/**
 * Translucent WASD keys where the fixed joystick sits, for mouse and keyboard
 * players (CSS shows them only there): they show the bound movement keys and
 * light up while one is held, so the corner doubles as a controls hint.
 * `isHeld` is the shared input's.
 */
export const createMovePad = (isHeld: (code: string) => boolean) => {
  const caps = KEYS.map((k) => ({ ...k, el: h('span', { class: `move-key ${k.action}` }) }))
  const el = h('div', { class: 'move-pad', 'aria-hidden': 'true' }, ...caps.map((c) => c.el))

  const update = () => {
    for (const c of caps) {
      setText(c.el, boundKey(c.action))
      c.el.classList.toggle('held', isHeld(ACTIONS[c.action].key) || isHeld(c.arrow))
    }
  }

  return { el, update }
}

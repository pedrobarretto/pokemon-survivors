import type { Action } from '../engine/bindings'
import { padFamily, type PadFamily } from '../engine/gamepad'
import { t } from '../i18n'
import { isPadGlyph, padGlyphIcon } from '../render/art'
import { h } from './dom'
import { keyLayout, printedOn } from './keyLayout'
import { padHint } from './padHint'
import { settings } from './settings'

/* ---------------- Keys ---------------- */

const KEY_NAMES: Partial<Record<string, string>> = {
  Enter: 'ENTER',
  Backspace: 'BKSP',
  Tab: 'TAB',
  CapsLock: 'CAPS',
  ShiftLeft: 'SHIFT',
  ShiftRight: 'SHIFT',
  ControlLeft: 'CTRL',
  ControlRight: 'CTRL',
  AltLeft: 'ALT',
  AltRight: 'ALT',
  MetaLeft: 'META',
  MetaRight: 'META',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  IntlBackslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Comma: ',',
  Period: '.',
  Slash: '/',
}

/** A `KeyboardEvent.code` as printed on the player's key (`KeyW` → W, or Z on AZERTY; `Numpad8` → NUM 8). */
export const keyLabel = (code: string) => {
  if (code === 'Space') return t().spaceKey
  const printed = printedOn(keyLayout(), code)
  if (printed) return printed
  const letter = /^(?:Key|Digit)(.)$/.exec(code)?.[1]
  if (letter) return letter
  if (code.startsWith('Numpad')) return `NUM ${code.slice(6).toUpperCase()}`
  return KEY_NAMES[code] ?? code.toUpperCase()
}

/** The key bound to an action (Space, E, Shift by default), even while a pad is in use: the WASD keycaps, the lobby's stroll hint. */
export const boundKey = (action: Action) => {
  const code = settings().controls.key[action]
  return code === null ? t().controls.unbound : keyLabel(code)
}

/** The four movement keys in a row, as bound and printed (WASD, or ZQSD on AZERTY): the first run's tip. */
export const boundMoveKeys = () => (['up', 'left', 'down', 'right'] as const).map(boundKey).join('')

/**
 * Written shortcuts as the player's keyboard prints them: every lone capital
 * of a hint ("Q E tab · M mode") or chip is the physical key of that name.
 */
export const printedKeys = (text: string) =>
  text
    .split(' ')
    .map((word) => (/^[A-Z]$/.test(word) ? keyLabel(`Key${word}`) : word))
    .join(' ')

/* ---------------- Gamepad buttons ---------------- */

/** Standard-mapping button names as printed on each layout. Nintendo's face buttons sit swapped: the bottom one (0) is B. */
const PAD_NAMES: Readonly<Record<PadFamily, readonly string[]>> = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'LS', 'RS', '↑', '↓', '←', '→', 'XBOX'],
  playstation: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'SHARE', 'OPTIONS', 'L3', 'R3', '↑', '↓', '←', '→', 'PS'],
  nintendo: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '-', '+', 'LS', 'RS', '↑', '↓', '←', '→', 'HOME'],
}

/** The layout of the pad in use, or null on the keyboard (see `setActivePad`). */
let active: PadFamily | null = null

/**
 * Follows the device the player pressed last (`Input.activePad`, every
 * frame): the id of that gamepad, or null for the keyboard. While a pad is
 * in use, `boundLabel` names its buttons and `data-input="pad"` on <html>
 * swaps the keyboard hints for the pad ones (`.keys-only` / `.pad-only`).
 */
export const setActivePad = (id: string | null) => {
  const family = id === null ? null : padFamily(id)
  if (family === active) return
  active = family
  document.documentElement.dataset.input = family ? 'pad' : 'keys'
}

/** A standard-mapping button as printed on `family`'s pads (the pad in use by default, else Xbox). */
export const padLabel = (button: number, family: PadFamily = active ?? 'xbox') => PAD_NAMES[family][button] ?? `#${button}`

/** What triggers an action on the device in use: its key, or its button on the pad the player is on. */
export const boundLabel = (action: Action) => {
  if (!active) return boundKey(action)
  const button = settings().controls.pad[action]
  return button === null ? t().controls.unbound : padLabel(button)
}

/** `padHint` with the bound confirm and back buttons of the pad in use. */
export const boundPadHint = (keys: string) => {
  const { pad } = settings().controls
  return padHint(keys, pad.confirm === null ? null : padLabel(pad.confirm), pad.back === null ? null : padLabel(pad.back))
}

/* ---------------- Glyphs ---------------- */

/**
 * Label text with the glyphs the UI fonts lack: VT323 has ↑ and ↓ but none
 * has ← → (they draw as ↑ turned, `.side-arrow` in CSS) or ✕ ○ □ △ (pixel
 * icons). The system's fallback font drew them as specks a player read as "-".
 */
export const glyphText = (text: string) =>
  text.split(/([←→✕○□△])/).map((part, i) => {
    if (i % 2 === 0) return part
    if (isPadGlyph(part)) return h('img', { class: 'pad-glyph', src: padGlyphIcon(part), alt: part })
    return h('span', { class: part === '←' ? 'side-arrow left' : 'side-arrow right', role: 'img', 'aria-label': part }, '↑')
  })

/** `setText` for label text (`glyphText`): rebuilds only when `text` changed, so per-frame HUD updates stay cheap. */
export const setGlyphText = (el: HTMLElement, text: string) => {
  if (el.dataset.text === text) return
  el.dataset.text = text
  el.replaceChildren(...glyphText(text))
}

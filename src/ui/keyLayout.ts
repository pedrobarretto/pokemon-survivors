/**
 * What's printed on the player's keys, for showing them only: the game reads
 * physical keys (`KeyboardEvent.code`, so W is the key above S on any
 * keyboard) and the simulation never sees a layout.
 */

/** A `KeyboardEvent.code` → the character its key types, as `navigator.keyboard.getLayoutMap()` answers. */
export type KeyLayout = ReadonlyMap<string, string>

const QWERTY: KeyLayout = new Map()

/** The keys an AZERTY keyboard moves, for browsers that can't tell (Firefox and Safari). */
const AZERTY: KeyLayout = new Map([
  ['KeyQ', 'a'],
  ['KeyA', 'q'],
  ['KeyW', 'z'],
  ['KeyZ', 'w'],
  ['Semicolon', 'm'],
  ['KeyM', ','],
])

/** The layout to assume from the browser's language: French keyboards are AZERTY but for Canada's (QWERTY) and Switzerland's (QWERTZ). */
export const guessLayout = (language: string): KeyLayout => (/^fr(?:-(?:FR|BE|LU|MC))?$/i.test(language) ? AZERTY : QWERTY)

/** One character a pixel font can show: anything but a space or a letter of another script (a Zhuyin or Cyrillic keyboard prints Latin letters too). */
const SHOWABLE = /^(?:\p{Script=Latin}|[^\p{L}\s])$/u

/**
 * The label a layout prints on a key, or null to name it by its code. Digits
 * stay digits (AZERTY's need Shift, but the 1 is still printed there), and
 * capitals lose their accents, as key caps print them.
 */
export const printedOn = (layout: KeyLayout, code: string): string | null => {
  const key = code.startsWith('Digit') ? undefined : layout.get(code)
  if (key === undefined || !SHOWABLE.test(key)) return null
  const label = key.toUpperCase().normalize('NFD').replace(/\p{M}/gu, '')
  return [...label].length === 1 ? label : null
}

let layout = QWERTY

/** The player's layout now. */
export const keyLayout = () => layout

/** Finds the player's layout: the language's guess at once, the real one where the browser tells (Chromium). Refused in some frames, where the guess stays. */
export const detectKeyLayout = () => {
  layout = guessLayout(navigator.language)
  const { keyboard } = navigator as Navigator & { keyboard?: { getLayoutMap: () => Promise<KeyLayout> } }
  keyboard
    ?.getLayoutMap()
    .then((map) => {
      layout = map
    })
    .catch(() => {})
}

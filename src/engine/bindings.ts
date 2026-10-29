import { isRecord } from '../game/parse'

/**
 * Remappable controls: shell input only, the simulation never sees a binding
 * (it gets the move vector and the special/Mega/lunge presses, as before).
 *
 * The keyboard works by substitution: the key bound to an action types that
 * action's default key (`key`), which is what every screen already listens to,
 * so the defaults change nothing. A gamepad types `code` for the actions of
 * the current context (`scope`): menus hear confirm/back, a run the special,
 * Mega and lunge, so one button (A) can confirm in menus and fire the special.
 * An Arena match hears its kit instead of a run's buttons (`arena`: Move 1,
 * Move 2, the Unite Move, switching targets), so its keys may be a run's too
 * (E is Mega in a run and Move 2 in a match).
 */
type Scope = 'both' | 'run' | 'menu' | 'arena'

/** What the controls are driving now: a menu, a run, or an Arena match (`inScope`). */
export type Context = 'menu' | 'run' | 'arena'

export const ACTIONS = {
  up: { key: 'KeyW', pad: 12, code: 'ArrowUp', scope: 'both' },
  down: { key: 'KeyS', pad: 13, code: 'ArrowDown', scope: 'both' },
  left: { key: 'KeyA', pad: 14, code: 'ArrowLeft', scope: 'both' },
  right: { key: 'KeyD', pad: 15, code: 'ArrowRight', scope: 'both' },
  special: { key: 'Space', pad: 0, code: 'Space', scope: 'run' },
  mega: { key: 'KeyE', pad: 3, code: 'KeyE', scope: 'run' },
  lunge: { key: 'ShiftLeft', pad: 2, code: 'ShiftLeft', scope: 'run' },
  pause: { key: 'KeyP', pad: 9, code: 'Escape', scope: 'both' },
  confirm: { key: 'Enter', pad: 0, code: 'Enter', scope: 'menu' },
  back: { key: 'Backspace', pad: 1, code: 'Backspace', scope: 'menu' },
  // The Arena's kit (Unite's Switch layout on a pad: R, ZR, ZL; the right stick's click switches targets, a flick too).
  move1: { key: 'KeyQ', pad: 5, code: 'KeyQ', scope: 'arena' },
  move2: { key: 'KeyE', pad: 7, code: 'KeyE', scope: 'arena' },
  unite: { key: 'KeyR', pad: 6, code: 'KeyR', scope: 'arena' },
  target: { key: 'Tab', pad: 11, code: 'Tab', scope: 'arena' },
} as const satisfies Record<string, { key: string; pad: number; code: string; scope: Scope }>

export type Action = keyof typeof ACTIONS
export const ACTION_IDS = Object.keys(ACTIONS) as Action[]

export type Device = 'key' | 'pad'
/** One device's bindings: a key code or a standard-mapping button per action, null when taken by another. */
export type Table<T> = Record<Action, T | null>
export type Bindings = { key: Table<string>; pad: Table<number> }

const tableOf = <T>(pick: (a: Action) => T | null) => Object.fromEntries(ACTION_IDS.map((a) => [a, pick(a)])) as Table<T>

export const DEFAULT_BINDINGS: Bindings = { key: tableOf((a) => ACTIONS[a].key), pad: tableOf((a) => ACTIONS[a].pad) }

/** Keys that always keep their meaning and can't be bound: the arrows move, Esc backs out and cancels a capture. */
export const RESERVED_KEYS: readonly string[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape']

const overlap = (a: Scope, b: Scope) => a === 'both' || b === 'both' || a === b

/** A run and an Arena match never meet: a match has no Mega, lunge or plain special. */
const apart = (a: Scope, b: Scope) => (a === 'run' && b === 'arena') || (a === 'arena' && b === 'run')

/**
 * Whether two actions can't share a key or button. A pad may share across
 * contexts that never meet (A: special and confirm); a key only between a
 * run's and the Arena's (E: Mega and Move 2).
 */
export const clashes = (device: Device, a: Action, b: Action) => {
  const sa = ACTIONS[a].scope
  const sb = ACTIONS[b].scope
  return a !== b && (device === 'key' ? !apart(sa, sb) : overlap(sa, sb))
}

/**
 * Binds `value` to `action`. Actions it clashes with give it up and take
 * `action`'s old value when they can (a swap), or end up unbound. `moved`
 * lists them for the conflict notice.
 */
export const rebind = <T>(table: Table<T>, device: Device, action: Action, value: T) => {
  const old = table[action]
  const next = { ...table, [action]: value }
  const moved: { action: Action; to: T | null }[] = []
  for (const other of ACTION_IDS) {
    if (!clashes(device, action, other) || table[other] !== value) continue
    const fits = old !== null && old !== value && ACTION_IDS.every((c) => next[c] !== old || !clashes(device, other, c))
    next[other] = fits ? old : null
    moved.push({ action: other, to: next[other] })
  }
  return { table: next, moved }
}

/** Whether an action is live in this context. */
export const inScope = (a: Action, context: Context) => {
  const s = ACTIONS[a].scope
  return s === 'both' || s === context
}

/**
 * What a keyboard key types for the game: the default key of the action
 * bound to it (the one live in `context` when two share it), nothing for a
 * default key whose action moved elsewhere, and any other key as itself
 * (arrows, Esc, the screens' own shortcuts).
 */
export const keyCode = (keys: Table<string>, code: string, context: Context = 'menu'): string | null => {
  // A run's actions never type in a match, nor the Arena's in a run.
  const bound = ACTION_IDS.find((a) => keys[a] === code && inScope(a, context)) ?? ACTION_IDS.find((a) => keys[a] === code && !apart(ACTIONS[a].scope, context))
  if (bound) return ACTIONS[bound].key
  return ACTION_IDS.some((a) => ACTIONS[a].key === code) ? null : code
}

const isKey = (v: unknown): v is string => typeof v === 'string' && v !== '' && !RESERVED_KEYS.includes(v)
const isButton = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 32

/**
 * One stored table: every action valid and nothing clashing, or the defaults.
 * An action missing from it (one added since) takes its default, or none when
 * a stored action already holds that key or button.
 */
const parseTable = <T>(raw: unknown, device: Device, valid: (v: unknown) => v is T, defaults: Table<T>): Table<T> => {
  if (!isRecord(raw)) return defaults
  const stored = tableOf((a) => {
    const v = raw[a]
    return v === undefined ? undefined : v === null || valid(v) ? v : defaults[a]
  })
  const table = tableOf((a) => {
    const v = stored[a]
    if (v !== undefined) return v
    const taken = ACTION_IDS.some((b) => stored[b] !== undefined && stored[b] === defaults[a] && clashes(device, a, b))
    return taken ? null : defaults[a]
  })
  const clean = ACTION_IDS.every((a) => ACTION_IDS.every((b) => table[a] === null || table[a] !== table[b] || !clashes(device, a, b)))
  return clean ? table : defaults
}

/** Reads stored bindings device by device; a broken or clashing table falls back to the defaults. */
export const parseBindings = (raw: unknown): Bindings => {
  const data = isRecord(raw) ? raw : {}
  return {
    key: parseTable(data.key, 'key', isKey, DEFAULT_BINDINGS.key),
    pad: parseTable(data.pad, 'pad', isButton, DEFAULT_BINDINGS.pad),
  }
}

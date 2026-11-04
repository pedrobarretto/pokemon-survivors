import type { InputKind } from '../game/bugReport'
import { ACTIONS, keyCode, type Bindings, type Context } from './bindings'
import { padActions, padChanges, readPads, type PadState } from './gamepad'
import type { Vec } from './math'

/**
 * Keyboard + gamepad + pointer (virtual joystick, floating or fixed) input.
 * `readMove` returns a vector with length ≤ 1: analog from the touch joystick
 * and the pad's left stick, 8 directions from keys and the D-pad. `readStick` exposes the joystick
 * (CSS px) so the shell can draw it. Discrete presses are delivered through
 * `onKey` as key codes, after the player's bindings (see `engine/bindings.ts`):
 * a remapped key and a gamepad button arrive as the codes the screens already handle.
 */
export type Input = {
  readMove: () => Vec
  readStick: () => Stick | null
  /** Whether a key or pad direction typing `code` (after the bindings) is held: `KeyW`, `ArrowUp`… */
  isHeld: (code: string) => boolean
  onKey: (handler: (key: string) => void) => () => void
  /** Delivers a key press that didn't come from the keyboard. */
  press: (key: string) => void
  /** Reads the gamepads. Call once per frame; the context (a menu, a run, an Arena match) picks what the keys and buttons mean. */
  poll: (context: Context) => void
  /** The pad's right stick, tilted (length ≤ 1), or null at rest: the Arena aims and switches targets with it. */
  readAim: () => Vec | null
  /** The `Gamepad.id` of the pad the player pressed last, or null since a key was pressed (or before any pad was). */
  activePad: () => string | null
  /** The ids of the gamepads the browser shows the game. A pad only appears after its first press. */
  pads: () => readonly string[]
  /** What the player used last in a run (a match too), or anywhere before the first one; null before any input. For bug reports. */
  lastKind: () => InputKind | null
  /**
   * Hands every raw key and pad button press to `take`, bypassing the bindings
   * and `onKey`, until the returned function is called (the remap screen).
   */
  capture: (take: (press: RawPress) => void) => () => void
}

/** A press before the bindings: a `KeyboardEvent.code` or a standard-mapping button. */
export type RawPress = { device: 'key'; code: string } | { device: 'pad'; button: number }

/** Joystick state in CSS px: where the base sits and where the knob is drawn. */
export type Stick = { origin: Vec; knob: Vec; vec: Vec }

/** `floating` appears under the thumb and follows it; `fixed` waits in a corner (the Controls setting). */
export const STICK_MODES = ['floating', 'fixed'] as const
export type StickMode = (typeof STICK_MODES)[number]

/** Which side the touch action buttons sit on (Settings → Controls); the fixed stick takes the other one. `left` mirrors the bottom of the HUD. */
export const BUTTON_SIDES = ['right', 'left'] as const
export type ButtonSide = (typeof BUTTON_SIDES)[number]

/** How high the fixed stick sits, and how far from the side edge: steps of the CSS in `ui/style.css` (`data-stick-height`, `data-stick-edge`). */
export const STICK_HEIGHTS = ['low', 'mid', 'high'] as const
export type StickHeight = (typeof STICK_HEIGHTS)[number]
export const STICK_EDGES = ['near', 'mid', 'far'] as const
export type StickEdge = (typeof STICK_EDGES)[number]

const MOVE_KEYS: Record<string, Vec> = {
  KeyW: { x: 0, y: -1 },
  ArrowUp: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
}

/** Max knob travel (CSS px). */
export const STICK_RADIUS = 52
/** Thumb jitter below this (CSS px) doesn't move the player. */
const STICK_DEAD_ZONE = 8
/** Full speed is reached at this fraction of the radius, so the edge isn't a precision target. */
const STICK_FULL_AT = 0.75

/** Knob offset → move vector: still inside the dead zone, then speed ramps up to 1. */
const stickVec = (dx: number, dy: number, travel: number): Vec => {
  const speed = Math.min(1, Math.max(0, (travel - STICK_DEAD_ZONE) / (STICK_RADIUS * STICK_FULL_AT - STICK_DEAD_ZONE)))
  return speed > 0 ? { x: (dx / travel) * speed, y: (dy / travel) * speed } : { x: 0, y: 0 }
}

/**
 * Pure joystick rule. Past the max radius the base is dragged along with the
 * thumb (a "floating" stick), so reversing direction is instant. Inside the
 * dead zone the player stands still; beyond it speed ramps up to 1.
 */
export const joystick = (origin: Vec, pointer: Vec): Stick => {
  let dx = pointer.x - origin.x
  let dy = pointer.y - origin.y
  const len = Math.hypot(dx, dy)
  let base = origin
  if (len > STICK_RADIUS) {
    const k = STICK_RADIUS / len
    base = { x: pointer.x - dx * k, y: pointer.y - dy * k }
    dx *= k
    dy *= k
  }
  return { origin: base, knob: { x: base.x + dx, y: base.y + dy }, vec: stickVec(dx, dy, Math.min(len, STICK_RADIUS)) }
}

/** A touch this close to the fixed stick's center grabs it: twice the radius, so a thumb that lands a bit off still counts. */
export const FIXED_STICK_REACH = STICK_RADIUS * 2

/**
 * Fixed joystick rule: the base never moves and the knob stops at its rim, so
 * the stick is always where the thumb expects it. Same dead zone and ramp as
 * the floating one.
 */
export const fixedJoystick = (center: Vec, pointer: Vec): Stick => {
  const dx = pointer.x - center.x
  const dy = pointer.y - center.y
  const len = Math.hypot(dx, dy)
  const k = len > STICK_RADIUS ? STICK_RADIUS / len : 1
  return { origin: center, knob: { x: center.x + dx * k, y: center.y + dy * k }, vec: stickVec(dx * k, dy * k, len * k) }
}

/** The pointer that owns the stick: its id, the fixed center it grabbed (null: floating) and the stick. */
export type Grip = { id: number; anchor: Vec | null; stick: Stick }

/** A pointer going down on the canvas. `primary` is the browser's `isPrimary`: no other pointer of its kind is down. */
export type PointerDown = { id: number; at: Vec; primary: boolean }

/**
 * Who owns the stick after a pointer goes down. The first finger takes it and
 * later fingers leave it alone, unless the new one is primary: then no other
 * finger is down, so the grip held is stale (its pointerup or pointercancel got
 * lost: a system gesture, the app switcher) and the new touch replaces it
 * instead of being ignored while the player walks on. A fixed stick only
 * answers touches within its reach (`fixed`: its center, null when floating).
 */
export const gripDown = (grip: Grip | null, down: PointerDown, fixed: Vec | null): Grip | null => {
  if (grip && !down.primary) return grip
  if (fixed && Math.hypot(down.at.x - fixed.x, down.at.y - fixed.y) > FIXED_STICK_REACH) return null
  return { id: down.id, anchor: fixed, stick: fixed ? fixedJoystick(fixed, down.at) : joystick(down.at, down.at) }
}

/** The owning pointer moved; any other pointer's move changes nothing. */
export const gripMove = (grip: Grip | null, id: number, at: Vec): Grip | null =>
  grip && grip.id === id ? { ...grip, stick: grip.anchor ? fixedJoystick(grip.anchor, at) : joystick(grip.stick.origin, at) } : grip

/** A pointer ended (up, cancel, lost capture): the stick lets go only if it was the owner. */
export const gripUp = (grip: Grip | null, id: number): Grip | null => (grip && grip.id === id ? null : grip)

/**
 * `bindings` is read on every press, so a remap applies at once. `fixedStick`
 * returns the fixed joystick's center (CSS px) while that mode is on, or null
 * for the floating one. It's read on every touch, so the setting and a
 * rotation apply at once.
 */
export const createInput = (target: HTMLElement, bindings: () => Bindings, fixedStick: () => Vec | null = () => null): Input => {
  /** Keys held down, by physical code, with the code they typed (the bindings may change while one is held). */
  const held = new Map<string, string>()
  const handlers = new Set<(key: string) => void>()
  const dispatch = (key: string) => handlers.forEach((h) => h(key))
  let capturing: ((press: RawPress) => void) | null = null
  /** The pointer holding the stick, or null (`gripDown`). */
  let grip: Grip | null = null
  /** Last frame's pads, for edge detection. */
  let pads: PadState[] = []
  let activePad: string | null = null
  /** Codes the pads hold in a run (the directions), read by `readMove` like held keys. */
  let padHeld: string[] = []
  /** The pad's left stick in a run, analog (`stickVector`); zero at rest or in a menu. */
  let padMove: Vec = { x: 0, y: 0 }
  /** The pad's right stick in a run, null at rest. */
  let padAim: Vec | null = null
  /** The context of the last poll: keys type by it too. */
  let context: Context = 'menu'
  /** The input kind used last while playing, and anywhere (`lastKind`). */
  let lastPlay: InputKind | null = null
  let lastAny: InputKind | null = null
  const used = (kind: InputKind) => {
    lastAny = kind
    if (context !== 'menu') lastPlay = kind
  }

  window.addEventListener('keydown', (e) => {
    // Typing in a text field (the profile editor) or a Clerk modal (reverification) is not playing: they keep their keys.
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, .cl-modalBackdrop')) return
    activePad = null
    used('keyboard')
    if (capturing) {
      e.preventDefault()
      if (!e.repeat && e.code) capturing({ device: 'key', code: e.code })
      return
    }
    const code = keyCode(bindings().key, e.code, context)
    if (code === null) return
    // Tab switches targets in a match, not the browser's focus.
    if (code in MOVE_KEYS || code !== e.code || (code === 'Tab' && context === 'arena')) e.preventDefault()
    held.set(e.code, code)
    if (!e.repeat) dispatch(code)
  })
  // macOS swallows the keyups of keys pressed while ⌘ is down, so letting go of ⌘ lets go of everything.
  window.addEventListener('keyup', (e) => (e.key === 'Meta' ? held.clear() : held.delete(e.code)))
  // Wherever a keyup can get lost, forget the held keys; one still down comes back with its next auto-repeat.
  // F11 (the browser's own fullscreen) fires neither `blur` nor `fullscreenchange`, only `resize`.
  const releaseKeys = () => held.clear()
  const releaseAll = () => {
    held.clear()
    grip = null
  }
  window.addEventListener('resize', releaseKeys)
  document.addEventListener('fullscreenchange', releaseKeys)
  window.addEventListener('blur', releaseAll)
  window.addEventListener('pagehide', releaseAll)
  document.addEventListener('visibilitychange', () => document.hidden && releaseAll())

  // The first finger on the canvas owns the stick (`gripDown`); extra fingers are ignored.
  // Capturing the pointer keeps its pointerup coming when a mouse lets go outside the window
  // (touch is captured anyway), and every way a pointer can end lets go of the stick.
  target.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    grip = gripDown(grip, { id: e.pointerId, at: { x: e.clientX, y: e.clientY }, primary: e.isPrimary }, fixedStick())
    if (grip?.id !== e.pointerId) return
    try {
      target.setPointerCapture(e.pointerId)
    } catch {
      // Not an active pointer (a synthetic event): the window's listeners still hear its end.
    }
  })
  // Any press in the page, menus included, says what the player plays with.
  window.addEventListener('pointerdown', (e) => used(e.pointerType === 'mouse' ? 'mouse' : 'touch'), { capture: true, passive: true })
  window.addEventListener('pointermove', (e) => (grip = gripMove(grip, e.pointerId, { x: e.clientX, y: e.clientY })))
  const release = (e: PointerEvent) => (grip = gripUp(grip, e.pointerId))
  window.addEventListener('pointerup', release)
  window.addEventListener('pointercancel', release)
  target.addEventListener('lostpointercapture', release)

  /** Touch wins, then the keys and the D-pad, then the pad's stick: a stick that drifts never locks the keyboard out. */
  const readMove = (): Vec => {
    if (grip) return grip.stick.vec
    let x = 0
    let y = 0
    for (const code of [...held.values(), ...padHeld]) {
      const v = MOVE_KEYS[code]
      if (v) {
        x += v.x
        y += v.y
      }
    }
    const len = Math.hypot(x, y)
    return len > 0 ? { x: x / len, y: y / len } : padMove
  }

  const onKey = (handler: (key: string) => void) => {
    handlers.add(handler)
    return () => void handlers.delete(handler)
  }

  // Edge-detected per button, not per code: a button held across a run/menu switch doesn't press again.
  const poll = (now: Context) => {
    context = now
    const playing = now !== 'menu'
    const { buttons, stick: axes, fresh, freshStick, pressed, move, aim, pads: seen } = padChanges(pads, readPads())
    pads = seen
    if (pressed !== null) activePad = pressed
    // A stick out of its dead zone counts even when it presses nothing: a drifting one is what walks the Pokémon.
    if (pressed !== null || move.x !== 0 || move.y !== 0) used('gamepad')
    const pad = bindings().pad
    padHeld = playing ? padActions(pad, buttons, axes, now).map((a) => ACTIONS[a].code) : []
    padMove = playing ? move : { x: 0, y: 0 }
    padAim = playing && (aim.x !== 0 || aim.y !== 0) ? aim : null
    if (capturing) return fresh.forEach((button) => capturing?.({ device: 'pad', button }))
    padActions(pad, fresh, freshStick, now).forEach((a) => dispatch(ACTIONS[a].code))
  }

  const capture = (take: (press: RawPress) => void) => {
    capturing = take
    held.clear()
    return () => void (capturing === take && (capturing = null))
  }

  /** A fixed stick shows its base even when nobody is touching it. */
  const readStick = (): Stick | null => {
    if (grip) return grip.stick
    const center = fixedStick()
    return center && { origin: center, knob: center, vec: { x: 0, y: 0 } }
  }

  const isHeld = (code: string) => padHeld.includes(code) || [...held.values()].includes(code)

  return {
    readMove,
    readStick,
    isHeld,
    onKey,
    press: dispatch,
    poll,
    readAim: () => padAim,
    activePad: () => activePad,
    pads: () => pads.map((p) => p.id),
    lastKind: () => lastPlay ?? lastAny,
    capture,
  }
}

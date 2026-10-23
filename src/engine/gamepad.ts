import { ACTION_IDS, inScope, type Action, type Table } from './bindings'
import type { Vec } from './math'

/** Left stick deflection that counts as a D-pad press. */
const STICK_PRESS = 0.6

/** The left stick read as the four directions. It always means movement, whatever the D-pad is bound to. */
export const stickActions = (axes: readonly number[]) => {
  const [x = 0, y = 0] = axes
  const held = new Set<Action>()
  if (x < -STICK_PRESS) held.add('left')
  if (x > STICK_PRESS) held.add('right')
  if (y < -STICK_PRESS) held.add('up')
  if (y > STICK_PRESS) held.add('down')
  return held
}

/** Left stick travel (0..1) the player's thumb rests in without moving: worn sticks drift a little. */
const STICK_DEAD_ZONE = 0.2
/** Travel that already means full speed, so the rim (and a square gate's corners) isn't a precision target. */
const STICK_FULL_AT = 0.9

/**
 * The left stick as a move vector (length ≤ 1), any direction: still inside a
 * radial dead zone, then speed ramps up to 1 at `STICK_FULL_AT`. This is how
 * a run reads the stick; menus read it as directions (`stickActions`).
 */
export const stickVector = (axes: readonly number[]): Vec => {
  const [x = 0, y = 0] = axes
  const travel = Math.hypot(x, y)
  const speed = Math.min(1, Math.max(0, (travel - STICK_DEAD_ZONE) / (STICK_FULL_AT - STICK_DEAD_ZONE)))
  return speed > 0 ? { x: (x / travel) * speed, y: (y / travel) * speed } : { x: 0, y: 0 }
}

/**
 * Actions a pad state triggers in this context (`playing`: a run, not a menu):
 * the bound buttons in `buttons` plus the stick directions in `stick`.
 */
export const padActions = (pad: Table<number>, buttons: ReadonlySet<number>, stick: ReadonlySet<Action>, playing: boolean) =>
  ACTION_IDS.filter((a) => inScope(a, playing) && (stick.has(a) || (pad[a] !== null && buttons.has(pad[a]))))

/**
 * One connected pad: its `Gamepad.index` and `id`, the standard-mapping
 * buttons it holds and its left stick, as directions (`stick`) and as a
 * move vector (`move`). `rested`: the stick has sat inside its dead zone at
 * least once since the pad showed up (`padChanges` carries it frame to frame).
 */
export type PadState = { index: number; id: string; buttons: ReadonlySet<number>; stick: ReadonlySet<Action>; move: Vec; rested: boolean }

/** Every connected pad, read now. A pad the browser still lists after unplugging it (`connected: false`) is gone. */
export const readPads = (): PadState[] =>
  (navigator.getGamepads?.() ?? []).flatMap((pad) => {
    if (!pad?.connected) return []
    const move = stickVector(pad.axes)
    return [{ index: pad.index, id: pad.id, buttons: new Set(pad.buttons.flatMap((b, i) => (b.pressed ? [i] : []))), stick: stickActions(pad.axes), move, rested: move.x === 0 && move.y === 0 }]
  })

/**
 * What the pads did since the last frame: the buttons and stick directions
 * held on any pad, the ones just pressed, the id of a pad that pressed
 * something (null if none did) and the first tilted left stick as a move
 * vector (`move`, zero when every stick rests). Presses are edge-detected pad by pad, so a
 * pad that keeps a button down (a second controller, a virtual one) doesn't
 * swallow the same button on the pad the player is using.
 * A stick counts only once it has rested (`PadState.rested`): a device whose
 * axis never sits at the center (a wheel's pedal, a throttle, a broken stick)
 * would otherwise walk the player on its own. `pads` is `now` with that
 * memory, to pass back as the next frame's `before`.
 */
export const padChanges = (before: readonly PadState[], now: readonly PadState[]) => {
  const buttons = new Set<number>()
  const stick = new Set<Action>()
  const fresh = new Set<number>()
  const freshStick = new Set<Action>()
  let pressed: string | null = null
  let move: Vec = { x: 0, y: 0 }
  const pads: PadState[] = []
  for (const read of now) {
    const last = before.find((p) => p.index === read.index && p.id === read.id)
    const pad = last?.rested && !read.rested ? { ...read, rested: true } : read
    pads.push(pad)
    for (const b of pad.buttons) {
      buttons.add(b)
      if (last?.buttons.has(b)) continue
      fresh.add(b)
      pressed = pad.id
    }
    if (!pad.rested) continue
    if (move.x === 0 && move.y === 0) move = pad.move
    for (const a of pad.stick) {
      stick.add(a)
      if (last?.stick.has(a)) continue
      freshStick.add(a)
      pressed = pad.id
    }
  }
  return { buttons, stick, fresh, freshStick, pressed, move, pads }
}

/** Controller layouts, by the names printed on their buttons. Anything unknown reads as Xbox, the most common layout on PC. */
export type PadFamily = 'xbox' | 'playstation' | 'nintendo'

/** The layout of a pad from its `Gamepad.id`: the name the browser gives it, which carries the USB vendor (Sony 054c, Nintendo 057e). */
export const padFamily = (id: string): PadFamily => {
  if (/054c|playstation|dualsense|dualshock/i.test(id)) return 'playstation'
  if (/057e|nintendo|joy-con/i.test(id)) return 'nintendo'
  return 'xbox'
}

/** What a pad is called when its id says nothing readable. */
const BRANDS: Readonly<Record<PadFamily, string>> = { xbox: 'Xbox', playstation: 'PlayStation', nintendo: 'Nintendo' }

/**
 * A pad's name for people: `Gamepad.id` without the browser's extras
 * (Chrome's "(STANDARD GAMEPAD Vendor: …)", Firefox's "045e-02ea-" prefix),
 * or its layout's brand when nothing readable is left (Firefox calls every
 * XInput pad "xinput").
 */
export const padName = (id: string) => {
  const name = id
    .replace(/\s*\(.*$/, '')
    .replace(/^[0-9a-f]{1,4}-[0-9a-f]{1,4}-/i, '')
    .trim()
  return name === '' || /^xinput$/i.test(name) ? BRANDS[padFamily(id)] : name
}

import { describe, expect, it } from 'vitest'
import { DEFAULT_BINDINGS, rebind } from './bindings'
import { padActions, padChanges, padFamily, padName, stickActions, stickVector, type PadState } from './gamepad'

const pad = DEFAULT_BINDINGS.pad
const none = new Set<never>()

describe('padActions', () => {
  it('reads the shared A as confirm in menus and as the special in a run', () => {
    expect(padActions(pad, new Set([0]), none, 'menu')).toEqual(['confirm'])
    expect(padActions(pad, new Set([0]), none, 'run')).toEqual(['special'])
    // A match hears its kit, not a run's buttons.
    expect(padActions(pad, new Set([0, 5, 6]), none, 'arena')).toEqual(['move1', 'unite'])
  })

  it('follows the bindings, while the stick keeps moving', () => {
    const swapped = rebind(pad, 'pad', 'up', 4).table
    expect(padActions(swapped, new Set([4, 12]), none, 'run')).toEqual(['up'])
    expect(padActions(swapped, none, stickActions([0, -0.9]), 'run')).toEqual(['up'])
  })
})

describe('stickActions', () => {
  it('counts only past the threshold', () => {
    expect([...stickActions([0.3, -0.5])]).toEqual([])
    expect([...stickActions([-0.9, 0.8])].sort()).toEqual(['down', 'left'])
  })
})

describe('stickVector', () => {
  it('rests inside a radial dead zone, then keeps any angle and ramps up to full speed short of the rim', () => {
    expect(stickVector([0.1, -0.12])).toEqual({ x: 0, y: 0 })
    const tilted = stickVector([Math.cos(0.35), Math.sin(0.35)])
    expect(Math.atan2(tilted.y, tilted.x)).toBeCloseTo(0.35)
    expect(Math.hypot(tilted.x, tilted.y)).toBeCloseTo(1)
    expect(Math.hypot(...Object.values(stickVector([0.55, 0])))).toBeCloseTo(0.5)
    expect(Math.hypot(...Object.values(stickVector([1, 1])))).toBeCloseTo(1)
  })
})

describe('padChanges', () => {
  const state = (index: number, id: string, buttons: number[]): PadState => ({ index, id, buttons: new Set(buttons), stick: new Set(), move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, rested: true })
  /** A pad read with its stick at `axes`, as `readPads` makes it. */
  const tilted = (axes: number[]): PadState => {
    const move = stickVector(axes)
    return { index: 0, id: 'Wheel', buttons: new Set(), stick: stickActions(axes), move, aim: { x: 0, y: 0 }, rested: move.x === 0 && move.y === 0 }
  }

  it('sees a press on one pad while another pad holds the same button', () => {
    const virtual = state(1, 'Virtual pad', [0, 3])
    const { fresh, pressed } = padChanges([state(0, 'Xbox', []), virtual], [state(0, 'Xbox', [3]), virtual])
    expect([...fresh]).toEqual([3])
    expect(pressed).toBe('Xbox')
  })

  it('ignores a stick that never sat at the center, and keeps one that did', () => {
    const stuck = tilted([0, -1])
    expect(padChanges([], [stuck])).toMatchObject({ move: { x: 0, y: 0 }, stick: new Set(), freshStick: new Set(), pressed: null })
    const { pads } = padChanges([stuck], [tilted([0, 0])])
    const pushed = padChanges(pads, [tilted([0, -1])])
    expect(pushed.move.y).toBeCloseTo(-1)
    expect([...pushed.freshStick]).toEqual(['up'])
    expect(padChanges(pushed.pads, [tilted([0, -1])]).move.y).toBeCloseTo(-1)
  })

  it('presses a held button once', () => {
    const held = [state(0, 'Xbox', [0])]
    expect(padChanges([], held).fresh).toEqual(new Set([0]))
    expect(padChanges(held, held)).toMatchObject({ fresh: new Set(), pressed: null })
  })
})

describe('padFamily and padName', () => {
  it('read the layout and a readable name from the ids browsers give', () => {
    expect(padFamily('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe('xbox')
    expect(padName('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe('Xbox 360 Controller')
    expect(padFamily('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')).toBe('playstation')
    expect(padName('054c-09cc-Wireless Controller')).toBe('Wireless Controller')
    expect(padFamily('057e-2009-Pro Controller')).toBe('nintendo')
    expect(padName('xinput')).toBe('Xbox')
  })
})

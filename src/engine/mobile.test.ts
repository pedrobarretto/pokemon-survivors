import { describe, expect, it } from 'vitest'
import { FIXED_STICK_REACH, fixedJoystick, gripDown, gripMove, gripUp, joystick, STICK_RADIUS } from './input'
import { deviceScale, fitView } from './viewport'

describe('joystick', () => {
  it('ignores jitter inside the dead zone', () => {
    expect(joystick({ x: 100, y: 100 }, { x: 104, y: 103 }).vec).toEqual({ x: 0, y: 0 })
  })

  it('ramps to full speed before the edge and drags the base past it', () => {
    const near = joystick({ x: 0, y: 0 }, { x: STICK_RADIUS * 0.8, y: 0 })
    expect(near.vec.x).toBeCloseTo(1)
    const far = joystick({ x: 0, y: 0 }, { x: STICK_RADIUS + 30, y: 0 })
    expect(far.origin).toEqual({ x: 30, y: 0 })
    expect(far.knob).toEqual({ x: STICK_RADIUS + 30, y: 0 })
    expect(Math.hypot(far.vec.x, far.vec.y)).toBeCloseTo(1)
  })
})

describe('fixedJoystick', () => {
  it('keeps the base in place and stops the knob at the rim', () => {
    const center = { x: 80, y: 700 }
    const far = fixedJoystick(center, { x: 80, y: 700 - STICK_RADIUS - 40 })
    expect(far.origin).toEqual(center)
    expect(far.knob).toEqual({ x: 80, y: 700 - STICK_RADIUS })
    expect(far.vec.y).toBeCloseTo(-1)
  })

  it('uses the same dead zone as the floating stick', () => {
    expect(fixedJoystick({ x: 0, y: 0 }, { x: 3, y: -4 }).vec).toEqual({ x: 0, y: 0 })
  })
})

describe('stick grip', () => {
  const at = { x: 200, y: 600 }
  const dragged = gripMove(gripDown(null, { id: 1, at, primary: true }, null), 1, { x: 300, y: 600 })

  it('keeps the stick with the first finger while a second one comes and goes', () => {
    const second = gripDown(dragged, { id: 2, at: { x: 50, y: 50 }, primary: false }, null)
    expect(second).toBe(dragged)
    expect(gripMove(second, 2, { x: 0, y: 0 })).toBe(dragged)
    expect(gripUp(second, 2)).toBe(dragged)
    expect(gripUp(second, 1)).toBeNull()
  })

  it('lets a new touch replace a grip whose end event got lost', () => {
    expect(dragged?.stick.vec.x).toBeCloseTo(1)
    const fresh = gripDown(dragged, { id: 7, at: { x: 100, y: 500 }, primary: true }, null)
    expect(fresh?.id).toBe(7)
    expect(fresh?.stick.vec).toEqual({ x: 0, y: 0 })
    expect(gripUp(fresh, 7)).toBeNull()
  })

  it('drops a stale grip even when the new touch misses the fixed stick', () => {
    const center = { x: 80, y: 700 }
    const held = gripDown(null, { id: 1, at: center, primary: true }, center)
    expect(held?.anchor).toEqual(center)
    expect(gripDown(held, { id: 2, at: { x: 80 + FIXED_STICK_REACH + 1, y: 700 }, primary: true }, center)).toBeNull()
  })
})

describe('viewport', () => {
  it('keeps the classic desktop view', () => {
    expect(fitView(1920, 1080, 1)).toEqual({ w: 480, h: 270, cssScale: 4 })
  })

  it('shows ~220 world px across a phone and stays integer in device px', () => {
    const portrait = fitView(390, 844, 3)
    expect(portrait.w).toBeGreaterThan(200)
    expect(portrait.w).toBeLessThan(260)
    expect(fitView(844, 390, 3).h).toBe(portrait.w)
    expect(Number.isInteger(deviceScale(412, 915, 2.625))).toBe(true)
  })
})

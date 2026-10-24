import { describe, expect, it } from 'vitest'
import { fixedJoystick, joystick, STICK_RADIUS } from './input'
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

  it('never sizes a side below 1 px, whatever a laying-out webview reports', () => {
    expect(fitView(390, 0, 3)).toMatchObject({ h: 1 })
    expect(fitView(-20, Number.NaN, 2)).toMatchObject({ w: 1, h: 1 })
  })
})

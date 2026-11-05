import { describe, expect, it } from 'vitest'
import { REALM } from '../net/realm'
import { createWalker, pushSample, report, sampleAt, snap, walk, type Ground, type Track } from './interp'

const D = REALM.interpDelayMs
const open: Ground = { w: 400, h: 300, solid: [] }

describe('sampleAt', () => {
  it('draws the delay behind, between the two samples around it', () => {
    const t: Track = []
    pushSample(t, { at: 1000, x: 0, y: 0, facing: 2, moving: true })
    pushSample(t, { at: 1200, x: 20, y: 10, facing: 2, moving: true })
    expect(sampleAt(t, 1100 + D)).toEqual({ x: 10, y: 5, facing: 2, moving: true })
  })

  it('holds the oldest before the track and the newest after it, never guessing ahead', () => {
    const t: Track = []
    pushSample(t, { at: 1000, x: 5, y: 5, facing: 0, moving: true })
    pushSample(t, { at: 1200, x: 25, y: 5, facing: 2, moving: true })
    expect(sampleAt(t, 900 + D)).toMatchObject({ x: 5, y: 5 })
    expect(sampleAt(t, 5000)).toEqual({ x: 25, y: 5, facing: 2, moving: false })
  })

  it('drops a sample older than the newest', () => {
    const t: Track = []
    pushSample(t, { at: 1000, x: 0, y: 0, facing: 0, moving: true })
    pushSample(t, { at: 900, x: 99, y: 99, facing: 0, moving: true })
    expect(t).toHaveLength(1)
  })
})

describe('walk', () => {
  it('walks at the realm speed and faces the step', () => {
    const w = createWalker(100, 100)
    walk(w, { x: 1, y: 0 }, 0.5, open)
    expect(w.x).toBeCloseTo(100 + REALM.speed * 0.5)
    expect(w.facing).toBe(2)
    expect(w.moving).toBe(true)
  })

  it('slides along something solid instead of stopping', () => {
    const ground: Ground = { w: 400, h: 300, solid: [{ kind: 'rect', x: 110, y: 0, w: 20, h: 300 }] }
    const w = createWalker(100, 100)
    walk(w, { x: Math.SQRT1_2, y: Math.SQRT1_2 }, 0.2, ground)
    expect(w.x).toBe(100)
    expect(w.y).toBeGreaterThan(100)
  })

  it('rounds the corner into a doorway a few px aside of a straight walk', () => {
    // Two blocks with a 24 px gap between them (x 100..124), walked straight down from 6 px left of it.
    const ground: Ground = { w: 400, h: 300, solid: [{ kind: 'rect', x: 40, y: 100, w: 60, h: 24 }, { kind: 'rect', x: 124, y: 100, w: 60, h: 24 }] }
    const w = createWalker(98, 80)
    for (let i = 0; i < 90; i++) walk(w, { x: 0, y: 1 }, 1 / 60, ground)
    expect(w.y).toBeGreaterThan(130)
    expect(w.x).toBeGreaterThanOrEqual(104)
  })

  it('stays put against a wide wall with no way past it near', () => {
    const ground: Ground = { w: 400, h: 300, solid: [{ kind: 'rect', x: 0, y: 100, w: 400, h: 24 }] }
    const w = createWalker(200, 80)
    for (let i = 0; i < 60; i++) walk(w, { x: 0, y: 1 }, 1 / 60, ground)
    expect(w.x).toBe(200)
    expect(w.y).toBeLessThan(100)
  })

  it('walks to a tap and stops there', () => {
    const w = createWalker(100, 100)
    w.target = { x: 110, y: 100 }
    for (let i = 0; i < 30; i++) walk(w, { x: 0, y: 0 }, 1 / 60, open)
    expect(w.x).toBeCloseTo(110)
    expect(w.target).toBeNull()
    expect(w.moving).toBe(false)
  })
})

describe('report', () => {
  it('reports at most moveHz while walking, then once when it stops', () => {
    const w = createWalker(100, 100)
    walk(w, { x: 1, y: 0 }, 0.05, open)
    expect(report(w, 0)).toMatchObject({ moving: true })
    walk(w, { x: 1, y: 0 }, 0.05, open)
    expect(report(w, 50)).toBeNull()
    expect(report(w, 1000 / REALM.moveHz)).toMatchObject({ moving: true })
    walk(w, { x: 0, y: 0 }, 0.05, open)
    expect(report(w, 400)).toMatchObject({ moving: false })
    expect(report(w, 800)).toBeNull()
  })

  it('a snap puts the trainer back and counts as what the relay knows', () => {
    const w = createWalker(100, 100)
    w.target = { x: 300, y: 100 }
    walk(w, { x: 0, y: 0 }, 0.1, open)
    snap(w, 90, 100, 500)
    expect(w).toMatchObject({ x: 90, y: 100, target: null, moving: false })
    expect(report(w, 1000)).toBeNull()
  })
})

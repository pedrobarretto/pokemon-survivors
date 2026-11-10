import { describe, expect, it } from 'vitest'
import { afterKey } from './cursorMode'

describe('afterKey', () => {
  it('takes the cursor from the pointer on any real key', () => {
    expect(afterKey('pointer', 'ArrowDown')).toBe('keys')
    expect(afterKey('pointer', 'Enter')).toBe('keys')
  })

  it('leaves the mode alone on a modifier', () => {
    expect(afterKey('pointer', 'MetaLeft')).toBe('pointer')
    expect(afterKey('tab', 'ShiftLeft')).toBe('tab')
  })

  it('keeps the browser focus shown while Enter presses it, until a step moves the menu cursor', () => {
    expect(afterKey('tab', 'Enter')).toBe('tab')
    expect(afterKey('tab', 'ArrowDown')).toBe('keys')
    expect(afterKey('tab', 'KeyW')).toBe('keys')
  })
})

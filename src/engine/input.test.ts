import { describe, expect, it } from 'vitest'
import { dispatchKey } from './input'

describe('dispatchKey', () => {
  it("doesn't hand the press to a handler added while it's dispatched (a screen opened by it)", () => {
    const handlers = new Set<(key: string) => void>()
    const heard: string[] = []
    // A screen whose Esc opens a confirm, whose own Esc would close it and reopen the screen: once per press.
    const screen = (key: string) => {
      heard.push(`screen:${key}`)
      handlers.delete(screen)
      handlers.add(confirm)
    }
    const confirm = (key: string) => {
      heard.push(`confirm:${key}`)
      handlers.delete(confirm)
      handlers.add(screen)
    }
    handlers.add(screen)
    dispatchKey(handlers, 'Escape')
    expect(heard).toEqual(['screen:Escape'])
    dispatchKey(handlers, 'Escape')
    expect(heard).toEqual(['screen:Escape', 'confirm:Escape'])
  })

  it("skips a handler removed by an earlier one in the same press", () => {
    const handlers = new Set<(key: string) => void>()
    const heard: string[] = []
    const second = () => heard.push('second')
    handlers.add(() => (heard.push('first'), handlers.delete(second)))
    handlers.add(second)
    dispatchKey(handlers, 'Enter')
    expect(heard).toEqual(['first'])
  })
})

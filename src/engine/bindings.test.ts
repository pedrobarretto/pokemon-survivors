import { describe, expect, it } from 'vitest'
import { DEFAULT_BINDINGS, keyCode, parseBindings, rebind } from './bindings'

const keys = DEFAULT_BINDINGS.key
const pad = DEFAULT_BINDINGS.pad

describe('rebind', () => {
  it('swaps when the key is taken: the other action gets the old one', () => {
    const { table, moved } = rebind(keys, 'key', 'up', 'KeyS')
    expect(table).toMatchObject({ up: 'KeyS', down: 'KeyW' })
    expect(moved).toEqual([{ action: 'down', to: 'KeyW' }])
  })

  it('takes a free key without touching anything else', () => {
    const { table, moved } = rebind(keys, 'key', 'special', 'KeyJ')
    expect(table).toEqual({ ...keys, special: 'KeyJ' })
    expect(moved).toEqual([])
  })

  it('lets a pad button serve a run action and a menu action, but not two run actions', () => {
    expect(rebind(pad, 'pad', 'back', 3).moved).toEqual([])
    expect(rebind(pad, 'pad', 'mega', 0)).toMatchObject({ table: { mega: 0, special: 3, confirm: 0 }, moved: [{ action: 'special', to: 3 }] })
  })

  it('unbinds the other action when its old button would clash again', () => {
    // Special takes Start from pause; A would land pause on confirm's button, so pause goes empty.
    const { table, moved } = rebind(pad, 'pad', 'special', 9)
    expect(table).toMatchObject({ special: 9, pause: null, confirm: 0 })
    expect(moved).toEqual([{ action: 'pause', to: null }])
  })
})

describe('keyCode', () => {
  it('changes nothing with the defaults', () => {
    for (const code of ['KeyW', 'Space', 'KeyE', 'Enter', 'ArrowUp', 'Escape', 'KeyM']) expect(keyCode(keys, code)).toBe(code)
  })

  it('makes the new key type the action and silences the old one', () => {
    const remapped = rebind(keys, 'key', 'special', 'KeyJ').table
    expect(keyCode(remapped, 'KeyJ')).toBe('Space')
    expect(keyCode(remapped, 'Space')).toBeNull()
  })
})

describe('the Arena kit', () => {
  it('shares keys with the run only: E is Mega in a run and Move 2 in a match', () => {
    expect(keyCode(keys, 'KeyE', 'run')).toBe('KeyE')
    expect(keyCode(keys, 'KeyE', 'arena')).toBe('KeyE')
    const moved = rebind(keys, 'key', 'mega', 'KeyM').table
    expect(moved.move2).toBe('KeyE')
    expect(keyCode(moved, 'KeyE', 'run')).toBeNull()
    expect(keyCode(moved, 'KeyM', 'run')).toBe('KeyE')
    expect(keyCode(moved, 'KeyE', 'arena')).toBe('KeyE')
    // The special doesn't fire in a match: the Unite Move does, on R.
    expect(keyCode(keys, 'Space', 'arena')).toBeNull()
    expect(rebind(keys, 'key', 'move1', 'KeyP').moved).toEqual([{ action: 'pause', to: 'KeyQ' }])
  })

  it('gives a stored table from before the kit its keys, unless one is taken', () => {
    const before = { special: 'KeyR', pause: 'KeyQ' }
    expect(parseBindings({ key: before }).key).toMatchObject({ ...before, unite: 'KeyR', move1: null, move2: 'KeyE', target: 'Tab' })
  })
})

describe('parseBindings (restore defaults)', () => {
  it('falls back to the defaults for missing, broken or clashing tables', () => {
    expect(parseBindings(undefined)).toEqual(DEFAULT_BINDINGS)
    expect(parseBindings({ key: { up: 'Escape' }, pad: { special: 'A' } })).toEqual(DEFAULT_BINDINGS)
    expect(parseBindings({ key: { up: 'KeyS', down: 'KeyS' } }).key).toEqual(keys)
  })

  it('keeps a valid remap and gives the actions missing from it their defaults', () => {
    expect(parseBindings({ key: { special: 'KeyJ' } }).key).toEqual({ ...keys, special: 'KeyJ' })
  })
})

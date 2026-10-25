import { describe, expect, it } from 'vitest'
import { PROTOCOL, homeOf, parseRoomCode } from '../../src/net/protocol'
import { parseCreate, randomCode } from '../src/codes'

describe('room codes', () => {
  it('belong to the relay that made them, told by the first character', () => {
    for (let i = 0; i < 200; i++) {
      for (const home of ['cf', 'sa'] as const) {
        const code = randomCode(home)
        expect(parseRoomCode(code)).toBe(code)
        expect(homeOf(code)).toBe(home)
      }
    }
  })
})

describe('POST /rooms body', () => {
  it('takes a build and a known region, and refuses the rest with the status to answer', () => {
    expect(parseCreate(JSON.stringify({ v: PROTOCOL, build: 'sim-1', region: 'sam' }))).toEqual({ build: 'sim-1', region: 'sam' })
    expect(parseCreate(JSON.stringify({ v: PROTOCOL, build: 'sim-1', region: 'mars' }))).toEqual({ build: 'sim-1', region: 'auto' })
    expect(parseCreate(JSON.stringify({ v: PROTOCOL - 1, build: 'sim-1' }))).toEqual({ error: 'version', status: 426 })
    expect(parseCreate(JSON.stringify({ v: PROTOCOL, build: 'a b' }))).toEqual({ error: 'invalid', status: 400 })
    expect(parseCreate('{')).toEqual({ error: 'invalid', status: 400 })
  })
})

import { describe, expect, it } from 'vitest'
import { commandOf } from './discordCommands'

describe('commandOf', () => {
  it('reads a command’s options', () => {
    const c = commandOf({ name: 'gift', options: [{ type: 3, name: 'player', value: '@ash' }, { type: 4, name: 'amount', value: 500 }] })
    expect(c?.name).toBe('gift')
    expect([...(c?.options ?? [])]).toEqual([['player', '@ash'], ['amount', 500]])
  })

  it('reads a subcommand as `subcommand`, with its options beside it', () => {
    const c = commandOf({ name: 'coop-beta', options: [{ type: 1, name: 'add', options: [{ type: 3, name: 'player', value: '@ash' }] }] })
    expect([...(c?.options ?? [])]).toEqual([['subcommand', 'add'], ['player', '@ash']])
    expect(commandOf({ name: 'coop-beta', options: [{ type: 1, name: 'list' }] })?.options.get('subcommand')).toBe('list')
  })
})

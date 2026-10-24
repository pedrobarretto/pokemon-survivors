import { describe, expect, it } from 'vitest'
import { readChoice } from './staffAgent'
import { toolArgs } from './staffTools'

describe('readChoice', () => {
  it('reads the text and the tool calls of a chat completion', () => {
    const body = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: ' On it ',
            tool_calls: [{ id: 'c1', type: 'function', function: { name: 'send_gift', arguments: '{"who":"@ash","kind":"rare"}' } }, { id: 'c2', function: {} }],
          },
        },
      ],
    }
    const { text, calls } = readChoice(body)
    expect(text).toBe('On it')
    expect(calls).toEqual([{ id: 'c1', name: 'send_gift', args: '{"who":"@ash","kind":"rare"}' }])
    expect(toolArgs(calls[0]!.args)).toEqual({ who: '@ash', kind: 'rare' })
  })

  it('reads nothing from a broken answer', () => {
    expect(readChoice({ error: 'x' })).toMatchObject({ text: '', calls: [] })
    expect(toolArgs('not json')).toEqual({})
  })
})

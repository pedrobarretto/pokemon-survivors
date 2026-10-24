import { describe, expect, it } from 'vitest'
import { ideaPrompt, readIdea } from './ideaWriter'

describe('readIdea', () => {
  it('reads the draft, inside a code fence too', () => {
    const draft = readIdea('```json\n{"title": "Let Forget banish duo cards", "body": "Duo cards only offer skip or take."}\n```')
    expect(draft).toEqual({ title: 'Let Forget banish duo cards', body: 'Duo cards only offer skip or take.' })
  })

  it('finds nothing when the LLM found no suggestion, or broke the board limits', () => {
    expect(readIdea('{"title": null}')).toBeNull()
    expect(readIdea('{"title": "Duo"}')).toBeNull()
    expect(readIdea('not json')).toBeNull()
  })
})

describe('ideaPrompt', () => {
  it('hands the LLM the player messages and the staff note', () => {
    const [, user] = ideaPrompt({ suggestion: ['i can only skip or take', 'duos dont let you forget :/'], note: 'can you include that suggestion?' })
    expect(user?.content).toContain('> duos dont let you forget :/')
    expect(user?.content).toContain('Staff note: can you include that suggestion?')
  })
})

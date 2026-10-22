import { describe, expect, it } from 'vitest'
import { idsByName, suggestionBurst } from './discord'

describe('idsByName', () => {
  it('finds channels by name whatever emoji and separator staff put in front', () => {
    const ids = idsByName([
      { id: '1', name: '🪪》introductions' },
      { id: '2', name: '⚙️》mod-chat' },
      { id: '3', name: 'idea-review' },
      { id: '4', name: 'Trainer' },
    ])
    expect([...ids]).toEqual([['introductions', '1'], ['mod-chat', '2'], ['idea-review', '3'], ['Trainer', '4']])
  })
})

describe('suggestionBurst', () => {
  const at = (minutes: number) => Date.UTC(2026, 9, 22, 10, minutes)
  const m = (id: string, userId: string, minute: number, content = id) => ({ id, userId, bot: false, content, at: at(minute) })

  it('takes the player messages right before the one replied to, oldest first', () => {
    const replied = m('duos dont let you forget', 'lau', 22)
    const before = [m('i can only skip or take', 'lau', 22), m('lol', 'lion', 21), m('older', 'lau', 20)]
    expect(suggestionBurst(replied, before)).toEqual(['i can only skip or take', 'duos dont let you forget'])
  })

  it('stops at a long pause', () => {
    expect(suggestionBurst(m('now', 'lau', 30), [m('earlier', 'lau', 10)])).toEqual(['now'])
  })
})

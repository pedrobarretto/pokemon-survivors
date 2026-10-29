import { describe, expect, it } from 'vitest'
import { parseQueueMessage, queueUrl } from './queue'

describe('queueUrl', () => {
  it("is the relay's origin over WebSocket", () => {
    expect(queueUrl('https://relay.example/')).toBe('wss://relay.example/arena/queue')
    expect(queueUrl('http://localhost:8787')).toBe('ws://localhost:8787/arena/queue')
  })
})

describe('parseQueueMessage', () => {
  it('reads the three messages and refuses the rest', () => {
    expect(parseQueueMessage('{"t":"queued","kind":"ranked","waited":12,"found":3,"botsIn":78}')).toEqual({ t: 'queued', kind: 'ranked', waited: 12, found: 3, botsIn: 78 })
    expect(parseQueueMessage('{"t":"matched","room":"K7QF2","team":1,"ranked":false,"humans":1}')).toEqual({ t: 'matched', room: 'K7QF2', team: 1, ranked: false, humans: 1 })
    expect(parseQueueMessage('{"t":"refused","why":"auth"}')).toEqual({ t: 'refused', why: 'auth' })
    expect(parseQueueMessage('{"t":"refused","why":"nope"}')).toBeNull()
    expect(parseQueueMessage('{"t":"matched","room":"K7QF2","team":2,"ranked":true,"humans":2}')).toBeNull()
    expect(parseQueueMessage('not json')).toBeNull()
  })

  it('reads Fair Play: a hold on the wait and a Ranqueada refused with the score', () => {
    expect(parseQueueMessage('{"t":"queued","kind":"casual","waited":3,"found":1,"botsIn":90,"hold":42}')).toMatchObject({ hold: 42 })
    expect(parseQueueMessage('{"t":"queued","kind":"casual","waited":3,"found":1,"botsIn":90,"hold":0}')).not.toHaveProperty('hold')
    expect(parseQueueMessage('{"t":"refused","why":"fairPlay","fairPlay":64}')).toEqual({ t: 'refused', why: 'fairPlay', fairPlay: 64 })
    expect(parseQueueMessage('{"t":"refused","why":"fairPlay"}')).toBeNull()
  })
})

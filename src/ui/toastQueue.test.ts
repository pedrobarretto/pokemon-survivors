import { describe, expect, it } from 'vitest'
import { pushToast, runToastShows, stepToasts, type QueuedToast } from './toastQueue'

describe('toast queue', () => {
  it('shows at most `max` at once and lets the rest in, in order, as time runs out', () => {
    const q: QueuedToast<string>[] = []
    for (const name of ['loot', 'candy', 'potion', 'evolved']) pushToast(q, name, 2)
    expect(stepToasts(q, 0, 3).shown).toEqual(['loot', 'candy', 'potion'])
    expect(stepToasts(q, 1.5, 3)).toEqual({ shown: [], done: [] })
    expect(stepToasts(q, 0.5, 3)).toEqual({ shown: ['evolved'], done: ['loot', 'candy', 'potion'] })
  })

  it("starts a toast's clock only once it shows, so none expires unseen", () => {
    const q: QueuedToast<string>[] = []
    pushToast(q, 'a', 1)
    pushToast(q, 'b', 1)
    stepToasts(q, 0, 1)
    expect(stepToasts(q, 1, 1)).toEqual({ shown: ['b'], done: ['a'] })
    expect(stepToasts(q, 0.5, 1).done).toEqual([])
  })

  it('lets a toast replace the one sharing its key, in its spot and with a fresh clock', () => {
    const q: QueuedToast<string>[] = []
    pushToast(q, 'rain ended', 2, 'weather')
    stepToasts(q, 1.5, 3)
    expect(pushToast(q, 'snow started', 2, 'weather')).toMatchObject({ item: 'rain ended', shown: true })
    expect(q).toEqual([{ item: 'snow started', key: 'weather', left: 2, shown: true }])
    expect(pushToast(q, 'candy', 2)).toBeNull()
    expect(q).toHaveLength(2)
  })
})

describe('run toasts setting', () => {
  it('shows every toast at all, the important ones at important, none at none', () => {
    expect([runToastShows('all', true), runToastShows('all', false)]).toEqual([true, true])
    expect([runToastShows('important', true), runToastShows('important', false)]).toEqual([true, false])
    expect([runToastShows('none', true), runToastShows('none', false)]).toEqual([false, false])
  })
})

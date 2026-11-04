import { describe, expect, it } from 'vitest'
import { parseRealmModeration } from './moderation'

describe('parseRealmModeration', () => {
  it('needs a reason to ban, for whole days or for good', () => {
    expect(parseRealmModeration({ userId: 'u', action: 'ban', days: 7, reason: '  spam  ' })).toEqual({ action: 'ban', userId: 'u', days: 7, reason: 'spam' })
    expect(parseRealmModeration({ userId: 'u', action: 'ban', reason: 'spam' })).toEqual({ action: 'ban', userId: 'u', days: null, reason: 'spam' })
    expect(parseRealmModeration({ userId: 'u', action: 'ban', days: 7, reason: ' ' })).toBeNull()
    expect(parseRealmModeration({ userId: 'u', action: 'ban', days: 1.5, reason: 'spam' })).toBeNull()
    expect(parseRealmModeration({ userId: 'u', action: 'unban' })).toEqual({ action: 'unban', userId: 'u' })
    expect(parseRealmModeration({ userId: 'u', action: 'reset' })).toBeNull()
  })
})

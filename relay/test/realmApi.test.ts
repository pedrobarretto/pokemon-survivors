import { describe, expect, it } from 'vitest'
import { guestUserId, parseIdentityResponse, parseVisitResponse } from '../src/realmApi'

const ash = { userId: 'u1', handle: 'ash', partner: 'pichu', shiny: true, look: { head: 'crown', bad: 3 }, supporter: 'gold' }

describe('the realm’s API answers', () => {
  it('keeps only well-formed identities of the accounts asked', () => {
    const res = parseIdentityResponse({ identities: { u1: ash, u2: { ...ash, userId: 'u2', handle: 7 }, u3: { ...ash, userId: 'u3' } }, banned: ['u2', 'u9', 5] }, ['u1', 'u2'])
    expect(res).toEqual({ identities: { u1: { ...ash, look: { head: 'crown' } } }, banned: ['u2'] })
    expect(parseIdentityResponse({ identities: { u1: { ...ash, userId: 'u2' } } }, ['u1'])).toEqual({ identities: {}, banned: [] })
    expect(parseIdentityResponse('nope', ['u1'])).toBeNull()
  })

  it('reads a visit’s answer or nothing', () => {
    expect(parseVisitResponse({ allowed: true })).toEqual({ allowed: true })
    expect(parseVisitResponse({ allowed: false, why: 'private' })).toEqual({ allowed: false, why: 'private' })
    expect(parseVisitResponse({ allowed: false, why: 'other' })).toBeNull()
    expect(parseVisitResponse({ allowed: 'yes' })).toBeNull()
  })

  it('names a dev relay’s guests from their token', () => {
    expect(guestUserId('guest:ash_1')).toBe('guest-ash_1')
    expect(guestUserId('guest:')).toBeNull()
    expect(guestUserId('eyJ.a.b')).toBeNull()
  })
})

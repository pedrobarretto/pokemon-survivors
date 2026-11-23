import { describe, expect, it } from 'vitest'
import { guestUserId, parseDeedsAnswer, parseIdentityResponse, parseVisitResponse, postDeeds } from '../src/realmApi'

const ash = { userId: 'u1', handle: 'ash', partner: 'pichu', shiny: true, look: { head: 'crown', skins: ['charmanderSuit'] }, supporter: 'gold', stamps: 3 }

describe('the realm’s API answers', () => {
  it('keeps only well-formed identities of the accounts asked', () => {
    const res = parseIdentityResponse({ identities: { u1: ash, u2: { ...ash, userId: 'u2', handle: 7 }, u3: { ...ash, userId: 'u3' } }, banned: ['u2', 'u9', 5] }, ['u1', 'u2'])
    expect(res).toEqual({ identities: { u1: ash }, banned: ['u2'], friends: {} })
    // A look of the wrong shape (as the relay reads any look, `parseWireLook`) goes bare, the trainer still walks.
    expect(parseIdentityResponse({ identities: { u1: { ...ash, look: { head: 'crown', bad: 3 } } } }, ['u1'])?.identities.u1?.look).toEqual({})
    expect(parseIdentityResponse({ identities: { u1: { ...ash, userId: 'u2' } } }, ['u1'])).toEqual({ identities: {}, banned: [], friends: {} })
    expect(parseIdentityResponse('nope', ['u1'])).toBeNull()
  })

  it('keeps the asked accounts’ friend lists, lower case and well formed', () => {
    const res = parseIdentityResponse({ identities: { u1: ash }, banned: [], friends: { u1: ['Misty', 7, ''], u9: ['brock'] } }, ['u1'])
    expect(res?.friends).toEqual({ u1: ['misty'] })
  })

  it('reads a visit’s answer or nothing', () => {
    expect(parseVisitResponse({ allowed: true })).toEqual({ allowed: true })
    expect(parseVisitResponse({ allowed: false, why: 'private' })).toEqual({ allowed: false, why: 'private' })
    expect(parseVisitResponse({ allowed: false, why: 'other' })).toBeNull()
    expect(parseVisitResponse({ allowed: 'yes' })).toBeNull()
  })

  it('reads an identity from an API before stamps as none', () => {
    const { stamps: _old, ...older } = ash
    expect(parseIdentityResponse({ identities: { u1: older } }, ['u1'])?.identities.u1?.stamps).toBe(0)
  })

  it('keeps only known stamps and sensible errand ids in a deeds answer', () => {
    expect(parseDeedsAnswer({ stamps: { u1: ['firstSteps', 'made-up', 7] }, errands: { u1: ['room:pier:1', 7, ''] } })).toEqual({ stamps: { u1: ['firstSteps'] }, errands: { u1: ['room:pier:1'] } })
    expect(parseDeedsAnswer({})).toEqual({ stamps: {}, errands: {} })
    expect(parseDeedsAnswer('nope')).toBeNull()
  })

  it('answers null, never throwing, when the API fails a deeds report', async () => {
    const api = { url: 'https://api.example', secret: 'shh' }
    expect(await postDeeds(api, { deeds: [] }, () => Promise.reject(new Error('down')))).toBeNull()
    expect(await postDeeds(api, { deeds: [] }, () => Promise.resolve(new Response('no', { status: 500 })))).toBeNull()
    expect(await postDeeds(api, { deeds: [] }, () => Promise.resolve(new Response('{"stamps":{},"errands":{}}', { status: 200 })))).toEqual({ stamps: {}, errands: {} })
  })

  it('names a dev relay’s guests from their token', () => {
    expect(guestUserId('guest:ash_1')).toBe('guest-ash_1')
    expect(guestUserId('guest:')).toBeNull()
    expect(guestUserId('eyJ.a.b')).toBeNull()
  })
})

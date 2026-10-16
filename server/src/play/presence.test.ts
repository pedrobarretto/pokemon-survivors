import { describe, expect, it } from 'vitest'
import { createPresence, INVITE_INTERVAL, invite, reloadFriends, signIn, signOut } from './presence'

const ana = { userId: 'u-ana', handle: 'ana', name: 'Ana' }
const bia = { userId: 'u-bia', handle: 'bia', name: 'Bia' }

/** Ana on connection 1, Bia on 2, mutual friends. */
const friends = () => {
  const p = createPresence()
  signIn(p, 1, ana.userId, ana, [bia], 'x')
  const out = signIn(p, 2, bia.userId, bia, [ana], 'x')
  return { p, out }
}

describe('presence', () => {
  it('welcomes with the online friends and tells them, on the first connection only', () => {
    const { p, out } = friends()
    expect(out).toEqual([
      { to: 2, msg: { t: 'welcome', me: { handle: 'bia', name: 'Bia' }, online: [{ handle: 'ana', name: 'Ana' }] } },
      { to: 1, msg: { t: 'presence', friend: { handle: 'bia', name: 'Bia' }, online: true } },
    ])
    expect(signIn(p, 3, bia.userId, bia, [ana], 'x').filter((o) => o.to === 1)).toEqual([])
    expect(signOut(p, 3)).toEqual([])
    expect(signOut(p, 2)).toEqual([{ to: 1, msg: { t: 'presence', friend: { handle: 'bia', name: 'Bia' }, online: false } }])
  })

  it('welcomes guests without tracking them', () => {
    const p = createPresence()
    expect(signIn(p, 1, null, null, [], 'Guest')).toEqual([{ to: 1, msg: { t: 'welcome', me: null, online: [] } }])
    expect(p.users.size).toBe(0)
  })

  it('introduces friends who just became mutual on a reload', () => {
    const p = createPresence()
    signIn(p, 1, ana.userId, ana, [], 'x')
    signIn(p, 2, bia.userId, bia, [], 'x')
    expect(reloadFriends(p, 1, [bia]).map((o) => o.to)).toEqual([2, 1])
    expect(invite(p, 2, 'ana', 'K7QF2', 0)).toEqual([{ to: 1, msg: { t: 'invited', from: { handle: 'bia', name: 'Bia' }, code: 'K7QF2' } }])
  })
})

describe('invites', () => {
  it('reach a mutual friend online, at most once per interval', () => {
    const { p } = friends()
    expect(invite(p, 1, 'bia', 'K7QF2', 0).map((o) => o.msg.t)).toEqual(['invited'])
    expect(invite(p, 1, 'bia', 'K7QF2', INVITE_INTERVAL - 1)).toEqual([{ to: 1, msg: { t: 'refused', code: 'rate' } }])
    expect(invite(p, 1, 'bia', 'K7QF2', INVITE_INTERVAL).map((o) => o.msg.t)).toEqual(['invited'])
  })

  it('are refused outside a room, to strangers, to friends offline and from guests', () => {
    const { p } = friends()
    const code = (out: ReturnType<typeof invite>) => out.map((o) => (o.msg.t === 'refused' ? o.msg.code : o.msg.t))
    expect(code(invite(p, 1, 'bia', null, 0))).toEqual(['noRoom'])
    expect(code(invite(p, 1, 'cid', 'K7QF2', 0))).toEqual(['notFriend'])
    expect(code(invite(p, 9, 'bia', 'K7QF2', 0))).toEqual(['notFriend'])
    signOut(p, 2)
    expect(code(invite(p, 1, 'bia', 'K7QF2', 0))).toEqual(['offline'])
  })
})

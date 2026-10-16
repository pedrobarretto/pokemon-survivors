import { describe, expect, it } from 'vitest'
import type { ServerMessage } from '../../../src/net/protocol'
import { createRooms, disconnect, handleRoom, ROOM_TIMES, tickRooms, ticksDue, type Conn, type Out, type RoomMessage, type Rooms } from './rooms'

const conn = (id: number, build = 'b1'): Conn => ({ id, name: `p${id}`, handle: null, build })

const setup = () => {
  let n = 0
  const rooms = createRooms({ code: () => `R${n++}`, secret: () => `secret${n++}`, seed: () => 42 })
  const send = (id: number, msg: RoomMessage, now = 0, build = 'b1') => handleRoom(rooms, conn(id, build), msg, now)
  return { rooms, send }
}

type Of<T extends ServerMessage['t']> = Extract<ServerMessage, { t: T }>

/** The messages of kind `t` sent to connection `to`. */
const sent = <T extends ServerMessage['t']>(out: Out[], to: number, t: T) => out.filter((o) => o.to === to && o.msg.t === t).map((o) => o.msg as Of<T>)

/** A room created by connection 1 with `others` joined, everyone ready. */
const lobby = (others: number[]) => {
  const s = setup()
  const code = sent(s.send(1, { t: 'create' }), 1, 'room')[0]!.code
  for (const id of others) {
    s.send(id, { t: 'join', code, secret: null })
    s.send(id, { t: 'ready', ready: true })
  }
  return { ...s, code }
}

/** A room whose clock started at `goAt`. */
const playing = (others: number[], goAt = 1000) => {
  const s = lobby(others)
  s.send(1, { t: 'start' }, goAt)
  for (const id of [1, ...others]) s.send(id, { t: 'loaded' }, goAt)
  return s
}

const secretOf = (rooms: Rooms, code: string, slot: number) => rooms.byCode.get(code)!.seats.find((s) => s.slot === slot)!.secret

describe('joining', () => {
  it('refuses unknown codes, other builds, full rooms and started runs', () => {
    const { send, code } = lobby([2, 3, 4])
    expect(sent(send(9, { t: 'join', code: 'NOPE0', secret: null }), 9, 'refused')).toEqual([{ t: 'refused', code: 'notFound' }])
    expect(sent(send(9, { t: 'join', code, secret: null }, 0, 'b2'), 9, 'refused')).toEqual([{ t: 'refused', code: 'version' }])
    expect(sent(send(9, { t: 'join', code, secret: null }), 9, 'refused')).toEqual([{ t: 'refused', code: 'full' }])
    send(4, { t: 'leave' })
    send(1, { t: 'start' })
    expect(sent(send(9, { t: 'join', code, secret: null }), 9, 'refused')).toEqual([{ t: 'refused', code: 'started' }])
  })

  it('gives the lowest free slot and broadcasts the lobby', () => {
    const { send, code } = lobby([2, 3])
    send(2, { t: 'leave' })
    const out = send(4, { t: 'join', code, secret: null })
    expect(sent(out, 4, 'room')[0]!.slot).toBe(1)
    expect(sent(out, 1, 'lobby')[0]!.members.map((m) => m.slot)).toEqual([0, 1, 2])
  })
})

describe('starting', () => {
  it('is for the host, once every connected member is ready', () => {
    const { send, code } = lobby([2])
    send(3, { t: 'join', code, secret: null })
    expect(sent(send(2, { t: 'start' }), 2, 'refused')).toEqual([{ t: 'refused', code: 'notHost' }])
    expect(sent(send(1, { t: 'start' }), 1, 'refused')).toEqual([{ t: 'refused', code: 'notReady' }])
    send(3, { t: 'ready', ready: true })
    expect(sent(send(1, { t: 'start' }), 3, 'start')[0]).toMatchObject({ seed: 42, members: [{ slot: 0 }, { slot: 1 }, { slot: 2 }] })
  })

  it('lets a solo host start, and compacts slots in join order', () => {
    const solo = lobby([])
    expect(sent(solo.send(1, { t: 'start' }), 1, 'start')).toHaveLength(1)
    const { send } = lobby([2, 3])
    send(2, { t: 'leave' })
    const out = send(1, { t: 'start' })
    expect(sent(out, 3, 'room')[0]!.slot).toBe(1)
    expect(sent(out, 3, 'start')[0]!.members.map((m) => [m.slot, m.name])).toEqual([[0, 'p1'], [1, 'p3']])
  })

  it('starts the clock once everyone loaded, or at the timeout', () => {
    const { rooms, send } = lobby([2])
    send(1, { t: 'start' }, 0)
    expect(send(1, { t: 'loaded' }, 10)).toEqual([])
    expect(tickRooms(rooms, ROOM_TIMES.loadTimeout - 1).filter((o) => o.msg.t === 'go')).toEqual([])
    expect(sent(tickRooms(rooms, ROOM_TIMES.loadTimeout), 2, 'go')).toHaveLength(1)
  })
})

describe('the clock', () => {
  it('emits a tick only once its 1/60 s has passed, and never twice', () => {
    expect([ticksDue(0, 16), ticksDue(0, 16.7), ticksDue(0, 1000)]).toEqual([0, 1, 60])
    const { rooms } = playing([2], 1000)
    expect(tickRooms(rooms, 1016)).toEqual([])
    expect(sent(tickRooms(rooms, 1034), 2, 'frame')).toEqual([{ t: 'frame', first: 0, count: 2, entries: [] }])
    expect(tickRooms(rooms, 1034)).toEqual([])
    expect(sent(tickRooms(rooms, 1100), 1, 'frame')[0]).toMatchObject({ first: 2, count: 4 })
  })

  it('stamps queued inputs into the first tick emitted, keeping the latest move and one of each press', () => {
    const { rooms, send } = playing([2], 1000)
    send(1, { t: 'move', code: 3, sample: 1 })
    send(2, { t: 'press', press: 'special' })
    send(1, { t: 'move', code: 5, sample: 2 })
    send(2, { t: 'press', press: 'special' })
    send(2, { t: 'offer', index: 1, round: 4 })
    expect(sent(tickRooms(rooms, 1050), 1, 'frame')[0]).toEqual({
      t: 'frame',
      first: 0,
      count: 3,
      entries: [
        [0, [1, 'special']],
        [0, [0, 'move', 5, 2]],
        [0, [1, 'offer', 1, 4]],
      ],
    })
  })

  it('ignores inputs outside a run', () => {
    const { rooms, send } = lobby([2])
    send(1, { t: 'move', code: 3, sample: 1 })
    send(1, { t: 'start' }, 0)
    send(1, { t: 'loaded' }, 0)
    send(2, { t: 'loaded' }, 0)
    expect(sent(tickRooms(rooms, 100), 1, 'frame')[0]!.entries).toEqual([])
  })
})

describe('drops and leaves', () => {
  it('stamps away on a drop, and leave once the grace runs out', () => {
    const { rooms } = playing([2], 0)
    disconnect(rooms, 2, 100)
    expect(sent(tickRooms(rooms, 120), 1, 'frame')[0]!.entries).toEqual([[0, [1, 'away']]])
    tickRooms(rooms, 100 + ROOM_TIMES.runGrace - 1)
    const frame = sent(tickRooms(rooms, 100 + ROOM_TIMES.runGrace), 1, 'frame')[0]!
    expect(frame.entries).toEqual([[0, [1, 'leave']]])
  })

  it('stamps leave at once when a player leaves a run', () => {
    const { rooms, send } = playing([2, 3], 0)
    expect(sent(send(2, { t: 'leave' }, 50), 2, 'left')).toEqual([{ t: 'left', reason: 'leave' }])
    expect(sent(tickRooms(rooms, 60), 1, 'frame')[0]!.entries).toEqual([[0, [1, 'leave']]])
  })

  it('catches a rejoining player up with the whole run, then stamps them back', () => {
    const { rooms, send, code } = playing([2], 0)
    send(1, { t: 'move', code: 7, sample: 1 }, 10)
    tickRooms(rooms, 20)
    disconnect(rooms, 2, 30)
    tickRooms(rooms, 100)
    const out = send(5, { t: 'join', code, secret: secretOf(rooms, code, 1) }, 110)
    expect(out.filter((o) => o.to === 5).map((o) => o.msg.t)).toEqual(['room', 'lobby', 'start', 'go', 'frame'])
    expect(sent(out, 5, 'frame')[0]).toEqual({ t: 'frame', first: 0, count: 6, entries: [[0, [0, 'move', 7, 1]], [1, [1, 'away']]] })
    expect(sent(tickRooms(rooms, 120), 5, 'frame')[0]).toMatchObject({ first: 6, entries: [[0, [1, 'back']]] })
  })

  it('drops a lobby member after the grace, unless they come back', () => {
    const { rooms, send, code } = lobby([2, 3])
    disconnect(rooms, 2, 0)
    disconnect(rooms, 3, 0)
    send(9, { t: 'join', code, secret: secretOf(rooms, code, 2) }, ROOM_TIMES.lobbyGrace - 1)
    const out = tickRooms(rooms, ROOM_TIMES.lobbyGrace)
    expect(sent(out, 1, 'lobby').at(-1)!.members.map((m) => m.name)).toEqual(['p1', 'p3'])
  })

  it('hands the host to the lowest slot left', () => {
    const { send } = lobby([2, 3])
    expect(sent(send(1, { t: 'leave' }), 3, 'lobby')[0]!.host).toBe(1)
    expect(sent(send(2, { t: 'kick', slot: 2 }), 3, 'left')).toEqual([{ t: 'left', reason: 'kicked' }])
  })

  it('deletes a room once everyone is gone', () => {
    const { rooms, send } = lobby([2])
    send(1, { t: 'leave' })
    send(2, { t: 'leave' })
    expect(rooms.byCode.size).toBe(0)
  })
})

describe('checksums', () => {
  it('flags the first disagreement once', () => {
    const { rooms, send } = playing([2, 3], 0)
    tickRooms(rooms, 3000)
    send(1, { t: 'sum', tick: 120, sum: 5 })
    expect(send(2, { t: 'sum', tick: 120, sum: 5 })).toEqual([])
    expect(sent(send(3, { t: 'sum', tick: 120, sum: 6 }), 1, 'desync')).toEqual([{ t: 'desync', tick: 120 }])
    tickRooms(rooms, 5000)
    send(1, { t: 'sum', tick: 240, sum: 1 })
    expect(send(2, { t: 'sum', tick: 240, sum: 2 })).toEqual([])
  })

  it('ignores sums for ticks not sent yet', () => {
    const { rooms, send } = playing([2], 0)
    tickRooms(rooms, 1000)
    send(1, { t: 'sum', tick: 120, sum: 5 })
    expect(send(2, { t: 'sum', tick: 120, sum: 6 })).toEqual([])
  })
})

describe('back to the lobby', () => {
  it('is for the host, or anyone once the run is over, and compacts slots', () => {
    const { rooms, send, code } = playing([2, 3], 0)
    send(2, { t: 'leave' })
    expect(send(3, { t: 'lobby' })).toEqual([])
    send(3, { t: 'over' })
    const out = send(3, { t: 'lobby' })
    expect(sent(out, 3, 'room')[0]!.slot).toBe(1)
    expect(sent(out, 1, 'lobby')[0]).toMatchObject({ phase: 'lobby', members: [{ slot: 0, ready: false }, { slot: 1, ready: false }] })
    expect(rooms.byCode.get(code)!.history).toEqual([])
    expect(tickRooms(rooms, 5000)).toEqual([])
  })
})

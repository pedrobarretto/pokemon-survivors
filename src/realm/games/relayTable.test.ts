import { describe, expect, it } from 'vitest'
import type { RealmServerMessage } from '../../net/realm'
import type { TableView } from '../../net/realmTables'
import type { RealmSend } from '../client'
import type { TableSource } from './frame'
import { relayTable, type TableLink } from './relayTable'

/** A realm connection that records what's sent and lets the test speak as the relay. */
const fakeLink = () => {
  const sent: RealmSend[] = []
  let hear: ((m: RealmServerMessage) => void) | null = null
  const link: TableLink = {
    send: (m) => void sent.push(m),
    onMessage: (fn) => {
      hear = fn
      return () => void (hear = null)
    },
  }
  return { link, sent, relay: (m: RealmServerMessage) => hear?.(m), listening: () => hear !== null }
}

const view = (over: Partial<TableView>): TableView => ({ id: 'cafe-1', game: 'fourInRow', seats: [7, null], phase: 'waiting', view: null, pending: [], leftMs: null, result: null, ready: [], ...over })

/** A stand-in for the device's bot table: only says it's the bot's and records a leave. */
const botTable = (log: string[]): TableSource => ({
  vs: 'bot',
  table: () => view({ id: 'solo', seats: [7, -1], phase: 'playing' }),
  seat: () => 0,
  play: () => void log.push('bot:play'),
  ready: () => {},
  frame: () => {},
  leave: () => void log.push('bot:leave'),
})

const open = (initial: TableView | null) => {
  const f = fakeLink()
  const log: string[] = []
  const source = relayTable({ link: f.link, id: 'cafe-1', game: 'fourInRow', you: 7, initial, bot: () => botTable(log) })
  return { ...f, log, source }
}

describe('relayTable', () => {
  it('sits at a free table, and only watches a full one', () => {
    expect(open(null).sent).toEqual([{ t: 'sit', table: 'cafe-1', game: 'fourInRow' }])
    const full = open(view({ seats: [3, 4], phase: 'playing', game: 'typeDuel' }))
    expect(full.sent).toEqual([])
    expect(full.source.seat()).toBeNull()
    expect(full.source.lobby?.()).toBe('watching')
  })

  it('offers the bot while its seat waits, and goes back to the table as someone sits', () => {
    const t = open(null)
    t.relay({ t: 'table', table: view({}) })
    expect(t.source.lobby?.()).toBe('opponent')
    t.source.playBot?.()
    expect(t.source.vs).toBe('bot')
    t.source.play(3)
    expect(t.log).toEqual(['bot:play'])
    expect(t.sent.some((m) => m.t === 'play')).toBe(false)
    t.relay({ t: 'table', table: view({ seats: [7, 9], phase: 'playing', pending: [1], leftMs: 30_000 }) })
    expect(t.source.vs).toBe('human')
    expect(t.log).toContain('bot:leave')
    expect(t.source.lobby?.()).toBe('arrived')
    t.source.play(2)
    expect(t.sent.at(-1)).toEqual({ t: 'play', move: 2 })
  })

  it('runs the turn clock down between the relay’s messages', () => {
    const t = open(null)
    t.source.frame(1000)
    t.relay({ t: 'table', table: view({ seats: [7, 9], phase: 'playing', pending: [0], leftMs: 30_000 }) })
    t.source.frame(5000)
    expect(t.source.table()?.leftMs).toBe(26_000)
  })

  it('takes a seat that frees up, and stands as it leaves', () => {
    const t = open(view({ seats: [3, 4], phase: 'playing' }))
    t.relay({ t: 'table', table: view({ seats: [3, null], phase: 'over' }) })
    expect(t.source.lobby?.()).toBe('seatFree')
    t.source.takeSeat?.()
    expect(t.sent).toEqual([{ t: 'sit', table: 'cafe-1', game: 'fourInRow' }])
    t.relay({ t: 'table', table: view({ seats: [3, 7], phase: 'over', ready: [7] }) })
    expect(t.source.seat()).toBe(1)
    t.source.leave()
    expect(t.sent.at(-1)).toEqual({ t: 'stand' })
    expect(t.listening()).toBe(false)
  })

  it('forgets a table whose seats all stood', () => {
    const t = open(view({ seats: [3, null] }))
    t.relay({ t: 'table', table: view({ seats: [null, null] }) })
    expect(t.source.table()).toBeNull()
  })

  it('gathers an open table: the bot while alone, Começar with two, back to the table as the second sits', () => {
    const f = fakeLink()
    const log: string[] = []
    const source = relayTable({ link: f.link, id: 'cafe-3', game: 'ludo', you: 7, initial: null, open: true, bot: () => botTable(log) })
    const ludo = (over: Partial<TableView>) => view({ id: 'cafe-3', game: 'ludo', seats: [7, null, null, null], ...over })
    f.relay({ t: 'table', table: ludo({}) })
    expect(source.lobby?.()).toBe('opponent')
    source.playBot?.()
    f.relay({ t: 'table', table: ludo({ seats: [7, 9, null, null] }) })
    expect(log).toContain('bot:leave')
    expect(source.lobby?.()).toBe('arrived')
    source.frame(10_000)
    expect(source.lobby?.()).toBe('gather')
    source.ready()
    f.relay({ t: 'table', table: ludo({ seats: [7, 9, null, null], ready: [7] }) })
    expect(source.lobby?.()).toBe('gathered')
    f.relay({ t: 'table', table: ludo({ seats: [7, 9, null, null], phase: 'playing', pending: [2] }) })
    expect(source.lobby?.()).toBeNull()
  })
})


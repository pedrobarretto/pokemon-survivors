import { describe, expect, it, vi } from 'vitest'
import { arenaResult } from '../game/arenaRank'
import { NO_RANKS } from '../game/meta'
import { deflate, restore, snapshot, stateHash } from '../game/snapshot'
import type { ClientMessage, Entry, Frame, RunStart, ServerMessage } from '../net/protocol'
import { advance, createRunner, onFrame, onSnapPart, onSync, stepOne, SYNC_FAR, type RunnerDeps } from './runner'
import { toBase64 } from './wire'

const START: RunStart = {
  id: 1,
  seed: 4242,
  build: 'test',
  settings: { difficulty: 'normal' },
  players: [
    { seat: 0, name: 'Ana', account: false, loadout: { starter: 'pichu', ranks: { ...NO_RANKS }, shiny: false } },
    { seat: 2, name: 'Bia', account: false, loadout: { starter: 'gible', ranks: { ...NO_RANKS }, shiny: false } },
  ],
}

const frame = (from: number, to: number, ticks: [number, Entry[]][] = []): Frame => ({ t: 'frame', from, to, ticks })

/** A clock the test moves; `cost` ms pass on every reading too (a tick's CPU time, for the budget). */
const harness = (cost = 0) => {
  let now = 0
  const sent: ClientMessage[] = []
  const deps: RunnerDeps = { send: (m) => void sent.push(m), now: () => (now += cost) }
  return { deps, sent, tick: (ms: number) => (now += ms), at: () => now }
}

/** The stick of a seat, held from tick `t`: the same entries for everyone. */
const sticks = (t: number): [number, Entry[]][] => (t % 40 === 0 ? [[t, [[0, 'move', (t / 40) % 225, 0], [2, 'move', (t / 40 + 9) % 225, 0]]]] : [])

describe('the lockstep runner', () => {
  it('maps seats to slots and lands two clients on the same state, hashing once a second', () => {
    const h = harness()
    const a = createRunner(START, 'ROOMS', 0)
    const b = createRunner(START, 'ROOMS', 2)
    expect(b.slot).toBe(1)
    for (let t = 0; t < 600; t++) {
      for (const r of [a, b]) onFrame(r, frame(t, t + 1, sticks(t)), h.at(), () => {})
      h.tick(1000 / 60)
      advance(a, 1 / 60, h.deps)
      advance(b, 1 / 60, h.deps)
    }
    // Both stepped everything but their hold.
    expect(a.next).toBeGreaterThan(590)
    while (a.next < 600) advance(a, 1 / 60, h.deps)
    while (b.next < 600) advance(b, 1 / 60, h.deps)
    expect(stateHash(a.game)).toBe(stateHash(b.game))
    expect(h.sent.filter((m) => m.t === 'hash').length).toBe(20)
    // Who pushed each event is noted on the side; the game's state (events drained) snapshots as plain data.
    expect(a.actors.length).toBe(a.events.length)
    a.game.player = a.game.players[1]!
    a.game.events.push({ kind: 'coin' })
    a.game.player = a.game.players[0]!
    expect(a.pushedBy).toEqual([1])
    a.game.events.length = 0
    a.pushedBy.length = 0
    expect(stateHash(restore(snapshot(a.game)))).toBe(stateHash(a.game))
  })

  it('keeps its hold in hand, and catches up smoothly when behind: faster, never all at once', () => {
    const h = harness()
    const r = createRunner(START, 'ROOMS', 0)
    // 120 ticks arrive at once (a stall flushing): too few to sync, so it catches up a few extra per frame.
    onFrame(r, frame(0, 120), h.at(), () => {})
    const runs: number[] = []
    for (let i = 0; i < 60; i++) {
      h.tick(1000 / 60)
      runs.push(advance(r, 1 / 60, h.deps))
    }
    expect(Math.max(...runs)).toBeLessThanOrEqual(3)
    expect(runs.reduce((a, b) => a + b, 0)).toBeGreaterThan(60)
    expect(r.syncing).toBeNull()
    // Never runs into the hold while live frames keep coming.
    expect(r.known - r.next).toBeGreaterThanOrEqual(0)
  })

  it('draws the world at a steady pace under jitter: never a tick jumped or stepped back, even starved', () => {
    const h = harness()
    const r = createRunner(START, 'ROOMS', 0)
    let known = 0
    let shown = -1
    const steps: number[] = []
    for (let i = 0; i < 900; i++) {
      // Frames come in bunches (jitter), then stop for 20 display frames (a stall) halfway.
      const reach = i >= 450 && i < 470 ? known : Math.max(known, i - 4 + ((i * 13) % 7))
      if (reach > known) onFrame(r, frame(known, reach), h.at(), () => {})
      known = reach
      h.tick(1000 / 60)
      advance(r, 1 / 60, h.deps)
      // What the draw shows: the state between the last two ticks, `acc` of the way.
      const at = r.next - 1 + Math.min(1, r.acc * 60)
      if (shown >= 0 && i > 60) steps.push(at - shown)
      shown = at
    }
    expect(Math.min(...steps)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...steps)).toBeLessThan(2)
    expect(r.hold.underruns).toBeGreaterThan(0)
  })

  it('syncs when far behind: as fast as the budget allows, with progress', () => {
    const h = harness(0.4)
    const r = createRunner(START, 'ROOMS', 0)
    onFrame(r, frame(0, SYNC_FAR * 3), h.at(), () => {})
    h.tick(16)
    const first = advance(r, 1 / 60, h.deps)
    expect(r.syncing).not.toBeNull()
    expect(first).toBeLessThan(SYNC_FAR)
    for (let i = 0; i < 2000 && r.syncing; i++) advance(r, 1 / 60, h.deps)
    expect(r.syncing).toBeNull()
    expect(r.known - r.next).toBeLessThanOrEqual(r.hold.hold + 2)
  })

  it('catches up from a sync on a device whose ticks cost more than the budget, while the run goes on', () => {
    // Every clock reading costs 10 ms (a heavy late-game tick on a phone), the display runs at 30 fps and 2 new ticks arrive per frame.
    const h = harness(10)
    const r = createRunner(START, 'ROOMS', 0)
    let known = SYNC_FAR * 2
    onFrame(r, frame(0, known), h.at(), () => {})
    for (let i = 0; i < 1500 && (r.syncing || i === 0); i++) {
      onFrame(r, frame(known, known + 2), h.at(), () => {})
      known += 2
      h.tick(1000 / 30)
      advance(r, 1 / 30, h.deps)
    }
    expect(r.syncing).toBeNull()
  })

  it('keeps real time live on a slow phone whose frames bring more ticks than the floor, instead of falling into syncs', () => {
    // 10 fps (6 ticks per frame) and every clock reading costs 5 ms (a busy fight's ticks on a cheap phone): over the budget every frame.
    const h = harness(5)
    const r = createRunner(START, 'ROOMS', 0)
    let known = 0
    let synced = 0
    for (let i = 0; i < 600; i++) {
      onFrame(r, frame(known, known + 6), h.at(), () => {})
      known += 6
      h.tick(100)
      advance(r, 0.1, h.deps)
      if (r.syncing) synced++
    }
    expect(synced).toBe(0)
    expect(r.known - r.next).toBeLessThan(SYNC_FAR / 4)
  })

  it('plays a snapshot only if it restores to the hash the team agreed on; a bad one is reported and never played', async () => {
    const h = harness()
    const source = createRunner(START, 'ROOMS', 0)
    onFrame(source, frame(0, 600, sticks(0)), h.at(), () => {})
    while (source.next < 600) stepOne(source, h.deps)
    const data = toBase64(await deflate(snapshot(source.game)))
    const join = (label: string) => {
      const failed: string[] = []
      const deps: RunnerDeps = { ...h.deps, onFailed: (_, why) => void failed.push(why) }
      const sync: Extract<ServerMessage, { t: 'sync' }> = { t: 'sync', reason: 'join', run: START, from: 600, to: 600, base: { tick: 600, h: label, parts: 1 } }
      const r = onSync(createRunner(START, 'ROOMS', 2), sync, 'ROOMS', 2, deps)
      if (r === 'rejoin') throw new Error('expected a join')
      onSnapPart(r, { t: 'snapPart', tick: 600, part: 0, data }, deps)
      return { r, failed }
    }
    const good = join(stateHash(source.game))
    await vi.waitFor(() => expect(good.r.pending).toBeNull())
    expect(stateHash(good.r.game)).toBe(stateHash(source.game))
    const bad = join('not-its-hash')
    const seed = bad.r.game
    await vi.waitFor(() => expect(bad.failed).toHaveLength(1))
    expect(h.sent).toContainEqual({ t: 'badSnap', tick: 600 })
    expect(bad.r.game).toBe(seed)
    expect(bad.r.pending).not.toBeNull()
  })

  it('says a gap in the frames (the caller resyncs)', () => {
    const h = harness()
    const r = createRunner(START, 'ROOMS', 0)
    expect(onFrame(r, frame(0, 10), h.at(), () => {})).toBe(true)
    expect(onFrame(r, frame(5, 12), h.at(), () => {})).toBe(true)
    expect(r.known).toBe(12)
    expect(onFrame(r, frame(20, 21), h.at(), () => {})).toBe(false)
  })

  it("says an Arena match's result with its end, as the relay counts it", () => {
    const h = harness()
    const r = createRunner({ ...START, settings: { difficulty: 'normal', mode: 'versus' } }, 'ROOMS', 0)
    r.ticks.set(0, [])
    r.game.versus!.result = { winner: 1, surrender: null }
    r.game.phase = 'gameover'
    stepOne(r, h.deps)
    const over = h.sent.find((m) => m.t === 'over')
    expect(over).toMatchObject({ t: 'over', tick: 1, result: JSON.stringify(arenaResult(r.game)) })
  })
})

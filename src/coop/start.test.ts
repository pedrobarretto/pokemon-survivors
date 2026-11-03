import { describe, expect, it } from 'vitest'
import { dailyCoopChallenge } from '../game/coopBoard'
import { createCoopGame } from '../game/game'
import { NO_RANKS, UPGRADE_IDS } from '../game/meta'
import { stateHash } from '../game/snapshot'
import { COOP } from '../data/coop'
import type { RunStart } from '../net/protocol'
import { parseSettings, settingsOf, startGame } from './start'

const ranked = Object.fromEntries(UPGRADE_IDS.map((id) => [id, 1]))
const loadout = { starter: 'pichu', ranks: ranked, shiny: false } as const
const DUO: RunStart = {
  id: 1,
  seed: 5,
  build: 'test',
  settings: { difficulty: 'nightmare' },
  players: [
    { seat: 0, name: 'Ana', account: true, loadout },
    { seat: 1, name: 'Bia', account: true, loadout },
  ],
}

const DAY = '2026-11-02'

describe('the Desafio co-op do dia in a room', () => {
  it("keeps a run room's challenge day across the wire, and never an Arena room's or a bad one", () => {
    expect(parseSettings(settingsOf({ difficulty: 'hard', challenge: DAY }))).toMatchObject({ difficulty: 'hard', mode: 'run', challenge: DAY })
    expect(parseSettings(settingsOf({ difficulty: 'hard', mode: 'versus', challenge: DAY })).challenge).toBeUndefined()
    expect(parseSettings({ difficulty: 'hard', challenge: 'yesterday' }).challenge).toBeUndefined()
  })

  it("plays the day's seed and difficulty, whatever the relay dealt, with every upgrade off", () => {
    const c = dailyCoopChallenge(DAY)
    const g = startGame({ ...DUO, settings: settingsOf({ difficulty: 'nightmare', challenge: DAY }) })
    expect(g.difficulty).toBe(c.difficulty)
    expect(g.coop?.challenge).toBe(DAY)
    expect(g.players.map((p) => p.ranks)).toEqual([NO_RANKS, NO_RANKS])
    const again = startGame({ ...DUO, seed: 99, settings: settingsOf({ difficulty: 'normal', challenge: DAY }) })
    const expected = createCoopGame(c.seed, DUO.players.map((p) => ({ starter: 'pichu', ranks: { ...NO_RANKS }, shiny: false, name: p.name })), { difficulty: c.difficulty, view: { ...COOP.view }, challenge: DAY })
    expect(stateHash(again)).toBe(stateHash(g))
    expect(stateHash(g)).toBe(stateHash(expected))
  })

  it('plays the relay\'s seed and the ranks without one', () => {
    const g = startGame(DUO)
    expect(g.difficulty).toBe('nightmare')
    expect(g.coop?.challenge).toBeNull()
    expect(g.players[0]!.ranks).toMatchObject(ranked)
  })
})

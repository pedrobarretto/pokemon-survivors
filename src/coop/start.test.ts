import { describe, expect, it } from 'vitest'
import { dailyCoopChallenge } from '../game/coopBoard'
import { createCoopGame } from '../game/game'
import { NO_RANKS, UPGRADE_IDS } from '../game/meta'
import { stateHash } from '../game/snapshot'
import { COOP } from '../data/coop'
import { PLAYABLE_IDS } from '../data/hatchlings'
import type { RunStart } from '../net/protocol'
import { loadoutOf, parseLoadout, parseSettings, runLoadouts, settingsOf, startGame } from './start'

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

describe('the Arena look in a loadout', () => {
  it('rides the wire, drops a malformed one and never reaches the run', () => {
    const pick = { starter: 'charmander', ranks: NO_RANKS, shiny: false, team: 1, look: { head: 'strawHat' } } as const
    expect(parseLoadout(loadoutOf(pick))).toEqual(pick)
    expect(parseLoadout({ ...loadoutOf(pick), look: { head: 42 } })).not.toHaveProperty('look')
    expect(loadoutOf({ ...pick, look: {} })).not.toHaveProperty('look')
    const start: RunStart = { id: 1, seed: 7, build: 'b1', settings: { difficulty: 'normal' }, players: [{ seat: 0, name: 'Ash', account: true, loadout: loadoutOf(pick) }] }
    expect(runLoadouts(start)).toEqual([{ starter: 'charmander', ranks: NO_RANKS, shiny: false, name: 'Ash' }])
  })
})

describe('the Modo Lendário', () => {
  const legendLoadout = (legends?: readonly string[], partner?: string) => ({ starter: 'kyogre', ranks: ranked, shiny: false, ...(partner && { partner }), ...(legends && { legends: [...legends] }) })

  it('rides the wire in a run room only, and gives way to the Desafio co-op do dia', () => {
    expect(parseSettings(settingsOf({ difficulty: 'hard', legend: true }))).toMatchObject({ mode: 'run', legend: true })
    expect(settingsOf({ difficulty: 'hard' })).not.toHaveProperty('legend')
    expect(settingsOf({ difficulty: 'hard', mode: 'versus', legend: true })).not.toHaveProperty('legend')
    expect(parseSettings({ difficulty: 'hard', mode: 'versus', legend: true })).not.toHaveProperty('legend')
    expect(settingsOf({ difficulty: 'hard', legend: true, challenge: DAY })).not.toHaveProperty('legend')
    const both = parseSettings({ difficulty: 'hard', legend: true, challenge: DAY })
    expect(both.challenge).toBe(DAY)
    expect(both).not.toHaveProperty('legend')
    expect(parseSettings({ difficulty: 'hard', legend: 'yes' })).not.toHaveProperty('legend')
  })

  it('seats a legend only in a Legend room and only when the relay vouched for it', () => {
    expect(parseLoadout(legendLoadout(['kyogre', 'mewtwo'], 'gible'), true).starter).toBe('kyogre')
    // Not vouched, vouched for another, or outside a Legend room: the partner plays.
    expect(parseLoadout(legendLoadout(undefined, 'gible'), true).starter).toBe('gible')
    expect(parseLoadout(legendLoadout(['groudon'], 'gible'), true).starter).toBe('gible')
    expect(parseLoadout(legendLoadout(['kyogre'], 'gible'), false).starter).toBe('gible')
    expect(parseLoadout(legendLoadout(['kyogre'], 'gible')).starter).toBe('gible')
    // No partner (or a legend as one): the first starter.
    expect(parseLoadout(legendLoadout(undefined, 'mewtwo'), true).starter).toBe(PLAYABLE_IDS[0])
    expect(parseLoadout(legendLoadout(), true).starter).toBe(PLAYABLE_IDS[0])
    // A regular Pokémon stands in a Legend room too; unknown vouched ids are dropped.
    expect(parseLoadout({ ...loadout, legends: ['kyogre', 'nope'] }, true)).toMatchObject({ starter: 'pichu', legends: ['kyogre'] })
  })

  it("plays the seats' vouched legends at tick 0, the rest their partners", () => {
    const start: RunStart = {
      ...DUO,
      settings: settingsOf({ difficulty: 'normal', legend: true }),
      players: [
        { seat: 0, name: 'Ana', account: true, loadout: legendLoadout(['kyogre'], 'gible') },
        { seat: 1, name: 'Bia', account: true, loadout: { ...legendLoadout(undefined, 'squirtle'), starter: 'raikou' } },
      ],
    }
    expect(runLoadouts(start).map((l) => l.starter)).toEqual(['kyogre', 'squirtle'])
    const g = startGame(start)
    expect(g.players.map((p) => p.legend?.id ?? null)).toEqual(['kyogre', null])
    expect(g.coop?.legend).toBe(true)
    // The same loadouts in a normal room: no legend stands.
    const normal = startGame({ ...start, settings: settingsOf({ difficulty: 'normal' }) })
    expect(normal.players.map((p) => p.starter)).toEqual(['gible', 'squirtle'])
    expect(normal.coop?.legend).toBe(false)
    // Nor with the challenge on.
    expect(startGame({ ...start, settings: { difficulty: 'normal', legend: true, challenge: DAY } }).coop?.legend).toBe(false)
  })
})

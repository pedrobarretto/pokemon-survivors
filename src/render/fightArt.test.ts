import { describe, expect, it } from 'vitest'
import { fightWatch, inFight } from './fightArt'

/** The slice of a game `inFight` reads: no boss, no raid, no rift unless told. */
const game = (over: { bossId?: number | null; raid?: boolean; rift?: boolean } = {}) => ({
  bossId: over.bossId ?? null,
  raid: { arena: over.raid ? {} : null },
  rift: { arena: over.rift ? {} : null },
})

describe('inFight', () => {
  it('is a boss with its HP bar, a raid or a rift', () => {
    expect(inFight(null)).toBe(false)
    expect(inFight(game())).toBe(false)
    expect(inFight(game({ bossId: 7 }))).toBe(true)
    expect(inFight(game({ raid: true }))).toBe(true)
    expect(inFight(game({ rift: true }))).toBe(true)
  })
})

describe('fightWatch', () => {
  it('drops once as each fight ends, never while one goes on', () => {
    let drops = 0
    const watch = fightWatch(() => drops++)
    watch(false)
    watch(true)
    watch(true)
    expect(drops).toBe(0)
    // The boss falls: its art goes once.
    watch(false)
    watch(false)
    expect(drops).toBe(1)
    // A raid, then the run left mid-fight (the lobby has no game: not fighting).
    watch(true)
    watch(false)
    expect(drops).toBe(2)
  })
})

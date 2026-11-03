import { describe, expect, it } from 'vitest'
import { DIAMOND_POLL, POLL, SUPPORTER } from '../data/supporters'
import { EMPTY_SAVE, type Save } from './meta'
import { badgesOf, canWalkWith, donationPoints, effectiveTier, hallOf, hallTier, mayVote, newCode, NO_STANDING, ogTier, parseCode, parseHidden, parseWall, pledgeTier, pollToVote, supporterCount, tiersReached, withVote, type SupporterStatus } from './supporters'

describe('supporter tiers', () => {
  it('counts reais and dollars on one scale', () => {
    expect(donationPoints(1000, 'BRL')).toBe(1000)
    expect(donationPoints(200, 'usd')).toBe(1000)
    // Another currency Stripe charged in counts as dollars.
    expect(donationPoints(200, 'eur')).toBe(1000)
  })

  it('maps a pledge to its tier by the amount kept active', () => {
    expect(pledgeTier(0)).toBeNull()
    expect(pledgeTier(300)).toBeNull()
    expect(pledgeTier(500)).toBe('supporter')
    expect(pledgeTier(999)).toBe('supporter')
    expect(pledgeTier(1000)).toBe('gold')
    expect(pledgeTier(2000)).toBe('diamond')
    expect(pledgeTier(5000)).toBe('diamond')
  })

  it('never makes Gold out of one-time donations adding up', () => {
    // Two months of US$ 5 (or a big one-time donation after Patreon) is still a Supporter.
    expect(effectiveTier({ ...NO_STANDING, points: SUPPORTER.gold * 3 })).toBe('supporter')
    expect(effectiveTier({ ...NO_STANDING, patreon: 'supporter', points: SUPPORTER.gold })).toBe('supporter')
    expect(effectiveTier(NO_STANDING)).toBeNull()
  })

  it('takes the highest of the OG tier and the active pledge', () => {
    expect(effectiveTier({ ...NO_STANDING, points: 6000, og: 'gold' })).toBe('gold')
    expect(effectiveTier({ ...NO_STANDING, points: 6000, og: 'gold', patreon: 'supporter' })).toBe('gold')
    expect(effectiveTier({ ...NO_STANDING, points: 100, og: 'supporter', patreon: 'diamond' })).toBe('diamond')
    // A pledge that ended leaves the one-time donations' tier.
    expect(effectiveTier({ ...NO_STANDING, points: 100, patreonBest: 'diamond' })).toBe('supporter')
  })

  it('freezes what an OG had donated into their tier', () => {
    expect(ogTier(0)).toBeNull()
    expect(ogTier(1)).toBe('supporter')
    expect(ogTier(SUPPORTER.gold - 1)).toBe('supporter')
    expect(ogTier(SUPPORTER.gold)).toBe('gold')
  })

  it('keeps a Supporter patron on the Hall only while the pledge lasts, a Gold one for good', () => {
    expect(hallTier({ ...NO_STANDING, patreon: 'supporter', patreonBest: 'supporter' })).toBe('supporter')
    expect(hallTier({ ...NO_STANDING, patreonBest: 'supporter' })).toBeNull()
    expect(hallTier({ ...NO_STANDING, patreon: 'diamond', patreonBest: 'diamond' })).toBe('diamond')
    // A former Gold or Diamond patron stays among the Gold, without the diamond.
    expect(hallTier({ ...NO_STANDING, patreonBest: 'gold' })).toBe('gold')
    expect(hallTier({ ...NO_STANDING, patreonBest: 'diamond' })).toBe('gold')
    // OGs and one-time donors stay as they are.
    expect(hallTier({ ...NO_STANDING, points: 100, og: 'supporter' })).toBe('supporter')
    expect(hallTier({ ...NO_STANDING, points: 100 })).toBe('supporter')
  })

  it("shows an OG's plate beside whatever tier they have now, and nothing while hidden", () => {
    expect(badgesOf({ ...NO_STANDING, points: 100, og: 'supporter', patreon: 'diamond' }, true)).toEqual({ supporter: 'diamond', og: true })
    expect(badgesOf({ ...NO_STANDING, points: 6000, og: 'gold' }, true)).toEqual({ supporter: 'gold', og: true })
    expect(badgesOf({ ...NO_STANDING, patreon: 'gold' }, true)).toEqual({ supporter: 'gold', og: false })
    expect(badgesOf({ ...NO_STANDING, points: 100, og: 'supporter' }, false)).toEqual({ supporter: null, og: false })
    expect(badgesOf(NO_STANDING, true)).toEqual({ supporter: null, og: false })
  })

  it('reaches each tier once, several at once for a first pledge', () => {
    expect(tiersReached(null, 'supporter')).toEqual(['supporter'])
    expect(tiersReached(null, 'gold')).toEqual(['supporter', 'gold'])
    expect(tiersReached('supporter', 'diamond')).toEqual(['gold', 'diamond'])
    expect(tiersReached('gold', 'supporter')).toEqual([])
    expect(tiersReached('gold', 'gold')).toEqual([])
  })
})

describe('codes', () => {
  it('reads a code however it was typed', () => {
    const code = newCode((b) => b.fill(7))
    expect(code).toMatch(/^PS-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect(parseCode(code.toLowerCase().replace(/-/g, ' '))).toBe(code)
    expect(parseCode(code.slice(3))).toBe(code)
  })

  it('refuses what cannot be a code', () => {
    expect(parseCode('PS-ABCD-EFG')).toBeNull()
    // 0, 1, I, L and O aren't in the alphabet.
    expect(parseCode('PS-ABCD-EFG0')).toBeNull()
    expect(parseCode(42)).toBeNull()
  })
})

describe('canWalkWith', () => {
  it('takes any starter, a family only once hatched, and a shiny only if owned', () => {
    expect(canWalkWith(EMPTY_SAVE, { id: 'charmander', shiny: false }, 'supporter')).toBe(true)
    expect(canWalkWith(EMPTY_SAVE, { id: 'charmander', shiny: true }, 'supporter')).toBe(false)
    expect(canWalkWith(EMPTY_SAVE, { id: 'gible', shiny: false }, 'supporter')).toBe(false)
    const hatched = { ...EMPTY_SAVE, hatched: { gible: { shiny: true } } }
    expect(canWalkWith(hatched, { id: 'gible', shiny: true }, 'supporter')).toBe(true)
  })

  it('walks with nobody without a tier', () => {
    expect(canWalkWith(EMPTY_SAVE, { id: 'charmander', shiny: false }, null)).toBe(false)
  })

  it('takes a captured legend along for Diamond only, shiny if it was caught shiny', () => {
    const caught: Save = { ...EMPTY_SAVE, legends: { kyogre: 3, lugia: 1 }, shinyStarters: { kyogre: true } }
    expect(canWalkWith(caught, { id: 'kyogre', shiny: false }, 'gold')).toBe(false)
    expect(canWalkWith(caught, { id: 'kyogre', shiny: true }, 'diamond')).toBe(true)
    // Lugia isn't captured yet (one win of its three), Mew was never met.
    expect(canWalkWith(caught, { id: 'lugia', shiny: false }, 'diamond')).toBe(false)
    expect(canWalkWith(caught, { id: 'mew', shiny: false }, 'diamond')).toBe(false)
  })
})

describe('the wall', () => {
  const entry = { handle: 'ash', name: 'Ash', tier: 'gold', since: '2026-10-01T12:00:00.000Z' }

  it('reads an API from before the Hall, with no title or Pokémon', () => {
    expect(parseWall([entry])).toEqual([{ ...entry, og: false, title: null, pokemon: null }])
  })

  it('keeps a known title and Pokémon, and drops what it does not know', () => {
    expect(parseWall([{ ...entry, title: 'supporter', pokemon: { id: 'gible', shiny: true } }])[0]).toMatchObject({ title: 'supporter', pokemon: { id: 'gible', shiny: true } })
    expect(parseWall([{ ...entry, title: 'emperor', pokemon: { id: 'missingno' } }])[0]).toMatchObject({ title: null, pokemon: null })
    expect(parseWall([{ ...entry, tier: 'platinum' }, { ...entry, since: 'soon' }, 'ash'])).toEqual([])
  })

  it('counts the supporters off the wall, and none from an API that does not send them', () => {
    expect(parseHidden(undefined)).toEqual({ supporter: 0, gold: 0, diamond: 0 })
    const hidden = parseHidden({ supporter: 2, gold: 1, diamond: 1, platinum: 9 })
    expect(supporterCount({ entries: parseWall([entry]), hidden })).toBe(5)
  })

  it('splits the Hall into Lendas (Diamond, then Gold) and supporters, newest first, and the OGs in the order they came', () => {
    const wall = parseWall([
      { ...entry, handle: 'old', tier: 'supporter', og: true, since: '2026-09-01T00:00:00.000Z' },
      { ...entry, handle: 'gold', og: true, since: '2026-09-15T00:00:00.000Z' },
      { ...entry, handle: 'new', tier: 'supporter', since: '2026-10-10T00:00:00.000Z' },
      { ...entry, handle: 'twin', tier: 'supporter', since: '2026-10-10T00:00:00.000Z' },
      { ...entry, handle: 'gem', tier: 'diamond', since: '2026-11-01T00:00:00.000Z' },
    ])
    const hall = hallOf(wall)
    expect(hall.legends.map((e) => e.handle)).toEqual(['gem', 'gold'])
    expect(hall.supporters.map((e) => e.handle)).toEqual(['new', 'twin', 'old'])
    expect(hall.og.map((e) => e.handle)).toEqual(['old', 'gold'])
  })
})

describe('polls', () => {
  const status = (tier: SupporterStatus['tier']): SupporterStatus => ({ tier, since: null, public: true, og: false, vote: null, diamondVote: null, patreon: null })
  const pick = POLL.options[0].id
  const diamondPick = DIAMOND_POLL.options[0].id

  it('lets anyone see both polls but only Diamond vote in its own', () => {
    expect(mayVote(null, 'diamond')).toBe(false)
    expect(mayVote(status('gold'), 'diamond')).toBe(false)
    expect(mayVote(status('gold'), 'supporters')).toBe(true)
    expect(mayVote(status('diamond'), 'diamond')).toBe(true)
  })

  it('calls a supporter to each poll they may vote in until they do', () => {
    expect(pollToVote(status(null))).toBe(null)
    expect(pollToVote(status('gold'))).toBe('supporters')
    expect(pollToVote(withVote(status('gold'), 'supporters', pick))).toBe(null)
    const diamond = withVote(status('diamond'), 'supporters', pick)
    expect(pollToVote(diamond)).toBe('diamond')
    expect(pollToVote(withVote(diamond, 'diamond', diamondPick))).toBe(null)
  })

  it('ignores a choice outside the poll', () => {
    expect(withVote(status('diamond'), 'diamond', pick).diamondVote).toBe(null)
  })
})

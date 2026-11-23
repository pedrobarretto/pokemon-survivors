import { SAFARI, catchChanceOf, fleeChanceOf, shinyChanceOf, type SafariMood, type SafariRarity } from './safari.rules'

/**
 * The Zona Safári guide's numbers (`safariGuide.ts`), worked out exactly from
 * the rules in `safari.rules.ts`: what a way of playing an encounter comes to,
 * and the shiny odds along a chain. Nothing here rolls: every branch the
 * rules can take is walked with its chance, so the guide shows what the API's
 * dice will average, and a retune of `SAFARI` moves the guide with it.
 */

/** The ways of playing an encounter the guide compares, from the plainest. */
export const SAFARI_PLANS = ['balls', 'berries', 'baitBerries', 'rock'] as const

export type SafariPlan = (typeof SAFARI_PLANS)[number]

type Act = 'ball' | 'berry' | 'rock' | 'bait'

/** An encounter as a plan sees it: the wild one's calm, mood and its turns, the pouch, and the turns played. */
type Spot = { calm: number; mood: SafariMood | null; turns: number; balls: number; berries: number; step: number }

/**
 * What each plan does next: `balls` only throws balls; `berries` calms it all
 * the way first; `baitBerries` throws bait, then calms it while it eats;
 * `rock` throws a rock whenever it isn't angry and a ball while it is.
 */
const PLAY: Record<SafariPlan, (s: Spot) => Act> = {
  balls: () => 'ball',
  berries: (s) => (s.berries > 0 && s.calm < SAFARI.maxCalm ? 'berry' : 'ball'),
  baitBerries: (s) => (s.step === 0 ? 'bait' : s.berries > 0 && s.calm < SAFARI.maxCalm ? 'berry' : 'ball'),
  rock: (s) => (s.mood === 'angry' ? 'ball' : 'rock'),
}

/** A turn has passed for the wild one: its mood wears off a turn (`passTurn` in the rules). */
const passed = (s: Spot): Pick<Spot, 'mood' | 'turns'> => (s.turns > 1 ? { mood: s.mood, turns: s.turns - 1 } : { mood: null, turns: 0 })

/**
 * The chance `plan` catches a Pokémon of `rarity` before it flees or the balls
 * run out, starting with `balls` and `berries` (a fresh session's pouch by
 * default). Mirrors `applyAction`: a berry, a rock or bait spends a turn in
 * which it may flee, already feeling what was thrown; a ball that breaks may
 * be followed by a flight; a rock's or bait's mood lasts 1 to `moodTurns`
 * turns, each as likely.
 */
export const planChance = (rarity: SafariRarity, plan: SafariPlan, balls: number = SAFARI.balls, berries: number = SAFARI.berries): number => {
  const play = PLAY[plan]
  const from = (s: Spot): number => {
    if (s.balls === 0) return 0
    const act = play(s)
    if (act === 'ball') {
      const caught = catchChanceOf(rarity, s.calm, s.mood)
      const stays = 1 - fleeChanceOf(rarity, s.calm, s.mood)
      return caught + (1 - caught) * stays * from({ ...s, ...passed(s), balls: s.balls - 1, step: s.step + 1 })
    }
    if (act === 'berry') {
      const calm = Math.min(s.calm + 1, SAFARI.maxCalm)
      return (1 - fleeChanceOf(rarity, calm, s.mood)) * from({ ...s, ...passed(s), calm, berries: s.berries - 1, step: s.step + 1 })
    }
    const mood: SafariMood = act === 'rock' ? 'angry' : 'eating'
    let after = 0
    for (let turns = 1; turns <= SAFARI.moodTurns; turns++) after += from({ ...s, mood, turns, step: s.step + 1 }) / SAFARI.moodTurns
    return (1 - fleeChanceOf(rarity, s.calm, mood)) * after
  }
  return from({ calm: 0, mood: null, turns: 0, balls, berries, step: 0 })
}

/** The shiny odds as "1 in n" for the 1st to the last boosted of a species in a row (`SAFARI.chainBoost`, the last holding beyond). */
export const chainOdds = (): { n: number; oneIn: number }[] => SAFARI.chainBoost.map((_, i) => ({ n: i + 1, oneIn: Math.round(1 / shinyChanceOf(i + 1)) }))

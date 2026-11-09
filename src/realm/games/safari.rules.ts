/**
 * The Zona Safári's rules (`MINIGAMES.safari`): pure and import-free, shared
 * by the API, which rolls everything, and the client, which draws the answer.
 * A session is a walk through a week's habitat. Its encounters are rolled when
 * it starts and met in order, one each time the client reports a rustle in the
 * tall grass (`grass`), so where and how long a player walks can neither pick
 * one nor roll it again; running from one spends it. In an encounter: throw a
 * ball, give a berry (a calmer Pokémon is easier to catch and flees less, but
 * the berry costs a turn in which it may still flee) or run. Every roll comes
 * through `next`, so the API's dice and the tests' sequences run the same code.
 */

export const SAFARI = {
  /** Sessions a Brasília day: the first free, the rest for `price` ₽, `dailyCap` in all. */
  free: 1,
  price: 3000,
  dailyCap: 5,
  /** What a session starts with. */
  balls: 6,
  berries: 3,
  /** Encounters a session holds: about 3 to 5 minutes of walking, and room to run from a family already owned. */
  encounters: 8,
  /** Sessions in a row without a new family, after which the next one brings a sure catch. */
  guarantee: 10,
  /** Each encounter's chance of a shiny. */
  shinyOdds: 1 / 200,
  /** How much likelier a family sharing a type with the partner is. */
  partnerBoost: 1.6,
  /** How common each rarity is, per encounter (`shareOf`). */
  weights: { common: 10, rare: 5, ultra: 2, special: 6 },
  /** A ball's chance on a Pokémon that hasn't been calmed. */
  catchChance: { common: 0.35, rare: 0.22, ultra: 0.12, special: 0.16 },
  /** The chance it flees after a turn, not calmed. */
  fleeChance: { common: 0.15, rare: 0.25, ultra: 0.35, special: 0.3 },
  /** Berries that still help on one Pokémon, and what each does to the odds. */
  maxCalm: 2,
  calmCatch: 0.5,
  calmFlee: 0.35,
} as const

export type SafariRarity = keyof typeof SAFARI.weights

/** A family a habitat can hold. */
export type SafariEntry<F extends string> = { family: F; rarity: SafariRarity; types: readonly string[] }

/** An encounter rolled in advance: who, whether it's shiny and whether it's the guarantee's. */
export type SafariSlot<F extends string> = { family: F; rarity: SafariRarity; shiny: boolean; sure: boolean }

/** The Pokémon being faced, and how calm it is (berries given). */
export type SafariEncounter<F extends string> = SafariSlot<F> & { calm: number }

export type SafariCatch<F extends string> = { family: F; shiny: boolean }

/** A session as the API keeps it (never sent whole: `queue` knows who is still to come). `met`: how many of the queue have been revealed. */
export type SafariRun<F extends string> = {
  balls: number
  berries: number
  queue: readonly SafariSlot<F>[]
  met: number
  encounter: SafariEncounter<F> | null
  catches: readonly SafariCatch<F>[]
  over: boolean
}

export type SafariAction = { kind: 'grass' } | { kind: 'ball' } | { kind: 'berry' } | { kind: 'leave' } | { kind: 'finish' }

/** What an action came to, as the client animates it. `shakes`: how many a thrown ball made (3 and `caught`: it held). */
export type SafariTurn<F extends string> =
  | { kind: 'appear'; family: F; shiny: boolean; sure: boolean }
  | { kind: 'ball'; family: F; shiny: boolean; shakes: number; caught: boolean; fled: boolean }
  | { kind: 'berry'; calm: number; fled: boolean }
  | { kind: 'left' }
  | { kind: 'finished' }

/** What the next session costs after `used` today: free, ₽, or null past the day's cap. */
export const sessionPrice = (used: number): number | null => (used >= SAFARI.dailyCap ? null : used < SAFARI.free ? 0 : SAFARI.price)

/** Whole weeks since the epoch of a week's Monday (`YYYY-MM-DD`). */
const weekNumber = (week: string) => Math.floor(Date.parse(`${week}T00:00:00Z`) / (7 * 86_400_000))

/** The week's habitat, the same for every player: the list taken in turn, one a Brasília week. */
export const habitatOfWeek = <H>(week: string, habitats: readonly H[]): H => habitats[((weekNumber(week) % habitats.length) + habitats.length) % habitats.length]!

/** An entry's weight for this partner: its rarity's, raised when they share a type. */
const weightOf = <F extends string>(entry: SafariEntry<F>, partnerTypes: readonly string[]) =>
  SAFARI.weights[entry.rarity] * (entry.types.some((type) => partnerTypes.includes(type)) ? SAFARI.partnerBoost : 1)

/** Each entry's chance of being any one encounter, as the screen shows it (they add up to 1). */
export const shareOf = <F extends string>(pool: readonly SafariEntry<F>[], partnerTypes: readonly string[]) => {
  const total = pool.reduce((sum, entry) => sum + weightOf(entry, partnerTypes), 0)
  return pool.map((entry) => ({ ...entry, share: weightOf(entry, partnerTypes) / total }))
}

const pickEntry = <F extends string>(pool: readonly SafariEntry<F>[], partnerTypes: readonly string[], next: () => number) => {
  let left = next() * pool.reduce((sum, entry) => sum + weightOf(entry, partnerTypes), 0)
  for (const entry of pool) {
    left -= weightOf(entry, partnerTypes)
    if (left < 0) return entry
  }
  return pool[pool.length - 1]!
}

const slotOf = <F extends string>({ family, rarity }: SafariEntry<F>, next: () => number, sure: boolean): SafariSlot<F> => ({ family, rarity, shiny: next() < SAFARI.shinyOdds, sure })

/**
 * A new session's encounters: each draws on its own at the odds `shareOf`
 * shows. `sure` (the guarantee's family) comes first, so spending every ball
 * before reaching it can't lose it.
 */
export const rollQueue = <F extends string>(pool: readonly SafariEntry<F>[], partnerTypes: readonly string[], next: () => number, sure: SafariEntry<F> | null): SafariSlot<F>[] => {
  const queue: SafariSlot<F>[] = Array.from({ length: SAFARI.encounters }, () => slotOf(pickEntry(pool, partnerTypes, next), next, false))
  if (sure) queue[0] = slotOf(sure, next, true)
  return queue
}

/** A new session, its encounters from `rollQueue`. */
export const startRun = <F extends string>(queue: readonly SafariSlot<F>[]): SafariRun<F> => ({ balls: SAFARI.balls, berries: SAFARI.berries, queue, met: 0, encounter: null, catches: [], over: false })

/** How many encounters are still to come. */
export const encountersLeft = <F extends string>(run: SafariRun<F>) => run.queue.length - run.met

/** A ball's chance on a Pokémon of `rarity` given `calm` berries. */
export const catchChanceOf = (rarity: SafariRarity, calm: number) => Math.min(1, SAFARI.catchChance[rarity] * (1 + SAFARI.calmCatch * Math.min(calm, SAFARI.maxCalm)))

/** The chance it flees after a turn with `calm` berries. */
export const fleeChanceOf = (rarity: SafariRarity, calm: number) => SAFARI.fleeChance[rarity] * (1 - SAFARI.calmFlee * Math.min(calm, SAFARI.maxCalm))

/** How many of the three shakes a ball holds for: each passes at the cube root of the catch chance, so all three together come to it exactly. */
const rollShakes = (chance: number, next: () => number) => {
  const each = chance ** (1 / 3)
  for (let shake = 0; shake < 3; shake++) if (next() >= each) return shake
  return 3
}

/** Ends the session once nothing is left to do: no balls, or no encounter still to come and none being faced. */
const settle = <F extends string>(run: SafariRun<F>): SafariRun<F> => (run.balls === 0 || (run.encounter === null && encountersLeft(run) === 0) ? { ...run, encounter: null, over: true } : run)

/**
 * One action on a session, with every roll made through `next`. Null when it
 * can't be done now (no encounter to throw at, already facing one, none left,
 * no balls); the guarantee's encounter (`sure`) neither fails nor flees.
 */
export const applyAction = <F extends string>(run: SafariRun<F>, action: SafariAction, next: () => number): { run: SafariRun<F>; turn: SafariTurn<F> } | null => {
  if (run.over) return null
  if (action.kind === 'finish') return { run: { ...run, encounter: null, over: true }, turn: { kind: 'finished' } }
  const { encounter } = run
  if (action.kind === 'grass') {
    const slot = run.queue[run.met]
    if (encounter || !slot) return null
    return { run: { ...run, met: run.met + 1, encounter: { ...slot, calm: 0 } }, turn: { kind: 'appear', family: slot.family, shiny: slot.shiny, sure: slot.sure } }
  }
  if (!encounter) return null
  if (action.kind === 'leave') return { run: settle({ ...run, encounter: null }), turn: { kind: 'left' } }
  if (action.kind === 'berry') {
    if (run.berries === 0) return null
    const calm = Math.min(encounter.calm + 1, SAFARI.maxCalm)
    // The flee roll already feels this berry: calmer now, and still a turn in which it can run.
    const fled = !encounter.sure && next() < fleeChanceOf(encounter.rarity, calm)
    const after = { ...run, berries: run.berries - 1 }
    return { run: fled ? settle({ ...after, encounter: null }) : { ...after, encounter: { ...encounter, calm } }, turn: { kind: 'berry', calm, fled } }
  }
  if (run.balls === 0) return null
  const shakes = encounter.sure ? 3 : rollShakes(catchChanceOf(encounter.rarity, encounter.calm), next)
  const caught = shakes === 3
  const fled = !caught && !encounter.sure && next() < fleeChanceOf(encounter.rarity, encounter.calm)
  const after: SafariRun<F> = {
    ...run,
    balls: run.balls - 1,
    encounter: caught || fled ? null : encounter,
    catches: caught ? [...run.catches, { family: encounter.family, shiny: encounter.shiny }] : run.catches,
  }
  return { run: settle(after), turn: { kind: 'ball', family: encounter.family, shiny: encounter.shiny, shakes, caught, fled } }
}

/**
 * The family the guarantee brings: a Safari-only one the account lacks if
 * any, else any it lacks; null when nothing is left to get. `next` picks.
 */
export const guaranteedEntry = <F extends string>(lacking: readonly SafariEntry<F>[], safariOnly: readonly F[], next: () => number): SafariEntry<F> | null => {
  const special = lacking.filter((entry) => safariOnly.includes(entry.family))
  const from = special.length > 0 ? special : lacking
  return from[Math.floor(next() * from.length)] ?? null
}

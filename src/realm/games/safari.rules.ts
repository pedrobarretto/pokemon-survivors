/**
 * The Zona Safári's rules (`MINIGAMES.safari`): pure and import-free, shared
 * by the API, which rolls everything, and the client, which draws the answer.
 * A session is a walk through a week's habitat: a few bushes with someone in
 * each, seen only as a silhouette; approach one to meet it, then throw a ball,
 * give it a berry (a calmer Pokémon is easier to catch and flees less, but the
 * berry costs a turn in which it may still flee) or leave. Every roll comes
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
  bushes: 5,
  /** Sessions in a row without a new family, after which the next one brings a sure catch. */
  guarantee: 10,
  /** Each encounter's chance of a shiny. */
  shinyOdds: 1 / 200,
  /** How much likelier a family sharing a type with the partner is. */
  partnerBoost: 1.6,
  /** How common each rarity is, per bush (`shareOf`). */
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

/** A bush: who's in it, and whether its encounter is over. `sure`: the guarantee's bush. */
export type SafariBush<F extends string> = { family: F; rarity: SafariRarity; sure: boolean; done: boolean }

/** The Pokémon being faced: its bush, how calm it is (berries given) and whether it's shiny. */
export type SafariEncounter<F extends string> = { bush: number; family: F; rarity: SafariRarity; shiny: boolean; calm: number; sure: boolean }

export type SafariCatch<F extends string> = { family: F; shiny: boolean }

/** A session as the API keeps it (never sent whole: `bushes` knows who hides in them). */
export type SafariRun<F extends string> = {
  balls: number
  berries: number
  bushes: readonly SafariBush<F>[]
  encounter: SafariEncounter<F> | null
  catches: readonly SafariCatch<F>[]
  over: boolean
}

export type SafariAction = { kind: 'approach'; bush: number } | { kind: 'ball' } | { kind: 'berry' } | { kind: 'leave' } | { kind: 'finish' }

/** What an action came to, as the client animates it. `shakes`: how many a thrown ball made (3 and `caught`: it held). */
export type SafariTurn<F extends string> =
  | { kind: 'appear'; bush: number; family: F; shiny: boolean }
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

/** Each entry's chance of being in a given bush, as the screen shows it (they add up to 1). */
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

const hiding = <F extends string>({ family, rarity }: SafariEntry<F>, sure: boolean): SafariBush<F> => ({ family, rarity, sure, done: false })

/**
 * A new session's bushes: each draws on its own at the odds `shareOf` shows.
 * `sure` (the guarantee's family) takes one bush, wherever `next` puts it.
 */
export const fillBushes = <F extends string>(pool: readonly SafariEntry<F>[], partnerTypes: readonly string[], next: () => number, sure: SafariEntry<F> | null): SafariBush<F>[] => {
  const bushes: SafariBush<F>[] = Array.from({ length: SAFARI.bushes }, () => hiding(pickEntry(pool, partnerTypes, next), false))
  if (sure) bushes[Math.floor(next() * SAFARI.bushes)] = hiding(sure, true)
  return bushes
}

/** A new session, filled by `fillBushes`. */
export const startRun = <F extends string>(bushes: readonly SafariBush<F>[]): SafariRun<F> => ({ balls: SAFARI.balls, berries: SAFARI.berries, bushes, encounter: null, catches: [], over: false })

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

const closeBush = <F extends string>(run: SafariRun<F>, bush: number) => run.bushes.map((b, i) => (i === bush ? { ...b, done: true } : b))

/** Ends the session once nothing is left to do: no balls, or no bush still holding anyone. */
const settle = <F extends string>(run: SafariRun<F>): SafariRun<F> => {
  const over = run.balls === 0 || (run.encounter === null && run.bushes.every((b) => b.done))
  return over ? { ...run, encounter: null, over } : run
}

/**
 * One action on a session, with every roll made through `next`. Null when it
 * can't be done now (no encounter to throw at, a bush already walked, no balls
 * left); the guarantee's encounter (`sure`) neither fails nor flees.
 */
export const applyAction = <F extends string>(run: SafariRun<F>, action: SafariAction, next: () => number): { run: SafariRun<F>; turn: SafariTurn<F> } | null => {
  if (run.over) return null
  if (action.kind === 'finish') return { run: { ...run, encounter: null, over: true }, turn: { kind: 'finished' } }
  const { encounter } = run
  if (action.kind === 'approach') {
    const bush = run.bushes[action.bush]
    if (encounter || !bush || bush.done) return null
    const shiny = next() < SAFARI.shinyOdds
    return { run: { ...run, encounter: { bush: action.bush, family: bush.family, rarity: bush.rarity, shiny, calm: 0, sure: bush.sure } }, turn: { kind: 'appear', bush: action.bush, family: bush.family, shiny } }
  }
  if (!encounter) return null
  if (action.kind === 'leave') return { run: settle({ ...run, encounter: null, bushes: closeBush(run, encounter.bush) }), turn: { kind: 'left' } }
  if (action.kind === 'berry') {
    if (run.berries === 0) return null
    const calm = Math.min(encounter.calm + 1, SAFARI.maxCalm)
    // The flee roll already feels this berry: calmer now, and still a turn in which it can run.
    const fled = !encounter.sure && next() < fleeChanceOf(encounter.rarity, calm)
    const after = { ...run, berries: run.berries - 1 }
    return { run: fled ? settle({ ...after, encounter: null, bushes: closeBush(run, encounter.bush) }) : { ...after, encounter: { ...encounter, calm } }, turn: { kind: 'berry', calm, fled } }
  }
  if (run.balls === 0) return null
  const shakes = encounter.sure ? 3 : rollShakes(catchChanceOf(encounter.rarity, encounter.calm), next)
  const caught = shakes === 3
  const fled = !caught && !encounter.sure && next() < fleeChanceOf(encounter.rarity, encounter.calm)
  const balls = run.balls - 1
  const done = caught || fled
  const after: SafariRun<F> = {
    ...run,
    balls,
    encounter: done ? null : encounter,
    bushes: done ? closeBush(run, encounter.bush) : run.bushes,
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

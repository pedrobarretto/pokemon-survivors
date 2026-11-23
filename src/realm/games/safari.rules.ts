/**
 * The Zona Safári's rules (`MINIGAMES.safari`): pure and import-free, shared
 * by the API, which rolls everything, and the client, which draws the answer.
 * A session is a walk through a week's habitat. Its encounters are rolled when
 * it starts. Most hide in the tall grass and are met in order, one each time
 * the client reports a rustle (`grass`), so where and how long a player walks
 * can neither pick one nor roll it again. A few wander in the open
 * (`visible`): the client is told who they are, and sneaking up on one
 * (`stalk`) meets it a little calmer; one scared off still hides in the grass
 * and comes after the rest. Running from one spends it. In an encounter:
 * throw a ball, give a berry (calmer for good, but the berry costs a turn in
 * which it may still flee), throw a rock (angry for a few turns: easier to
 * catch, quicker to run), throw bait (eating for a few turns: harder to
 * catch, slower to run) or run. Meeting the same species again and again
 * builds a chain that raises the shiny odds, rolled as each one shows.
 * Every roll comes through `next`, so the API's dice and the tests'
 * sequences run the same code.
 *
 * The Concurso de Insetos (`mode: 'contest'`) is a session of Bug types only
 * on the contest days (`isContestDay`), its catches scored (`contestScore`);
 * the best one is the entry's score on the week's board.
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
  /** Of those, how many wander in the open, never the guarantee's. */
  visible: 3,
  /** Sessions in a row without a new family, after which the next one brings a sure catch. */
  guarantee: 10,
  /** Each encounter's chance of a shiny, before the chain. */
  shinyOdds: 1 / 200,
  /** The shiny odds' multiplier for the n-th of the same species in a row (the last holds beyond). */
  chainBoost: [1, 1.5, 2, 3, 4, 5],
  /**
   * The chance an encounter repeats the one before it in the queue, so chains
   * happen. Repeating or drawing afresh at the shares keeps every encounter
   * at the shares `shareOf` shows.
   */
  repeat: 0.3,
  /** How much likelier a family sharing a type with the partner is. */
  partnerBoost: 1.6,
  /**
   * How common each rarity is, per encounter (`shareOf`). A habitat's Safari-only
   * families split theirs (`specialWeight`): each weighs `weights.special` alone,
   * and every other one adds `specialSplit` of that to the habitat's total, so a
   * habitat with five exclusives meets one more often than a habitat with one,
   * but each of the five less often.
   */
  weights: { common: 10, rare: 5, ultra: 2, special: 6 },
  specialSplit: 0.5,
  /** How much likelier a Safari-only family the account still lacks is (`SafariEntry.lacking`). */
  lackingBoost: 2,
  /** A ball's chance on a Pokémon that hasn't been calmed. */
  catchChance: { common: 0.35, rare: 0.22, ultra: 0.12, special: 0.16 },
  /** The chance it flees after a turn, not calmed. */
  fleeChance: { common: 0.15, rare: 0.25, ultra: 0.35, special: 0.3 },
  /** Berries that still help on one Pokémon, and what each does to the odds. */
  maxCalm: 2,
  calmCatch: 0.5,
  calmFlee: 0.35,
  /** The calm a Pokémon sneaked up on starts with: as much as one berry. */
  stalkCalm: 1,
  /** A rock's and bait's effect on the odds while it lasts, and how many turns it lasts (1 to `moodTurns`). */
  mood: { angry: { catch: 1.8, flee: 2 }, eating: { catch: 0.6, flee: 0.35 } },
  moodTurns: 3,
  /** A wild Pokémon's level: its rarity's base plus up to `levelSpread - 1`. */
  levelBase: { common: 7, rare: 15, ultra: 24, special: 20 },
  levelSpread: 8,
} as const

export const CONTEST = {
  /** The contest's days of the week (0 Sunday): Tuesday, Thursday and Saturday, Brasília. */
  days: [2, 4, 6],
  /** Entries a contest day: free, besides the day's sessions. */
  entries: 1,
  /** What a catch scores: its rarity's points, its level's, and a shiny's. */
  points: { common: 40, rare: 70, ultra: 100, special: 100 },
  perLevel: 2,
  shiny: 100,
} as const

export type SafariRarity = keyof typeof SAFARI.weights

export type SafariMode = 'safari' | 'contest'

export type SafariMood = keyof typeof SAFARI.mood

/** The time of day at the player's place: it picks who's about (`data/safari.ts`), never the odds. */
export type SafariDaypart = 'dawn' | 'day' | 'dusk' | 'night'

/** A family a habitat can hold. */
export type SafariEntry<F extends string> = { family: F; rarity: SafariRarity; types: readonly string[]; lacking?: boolean }

/** An encounter rolled in advance: who, its level and whether it's the guarantee's. Whether it's shiny is rolled when it shows. */
export type SafariSlot<F extends string> = { family: F; rarity: SafariRarity; level: number; sure: boolean }

/** The Pokémon being faced: shiny or not, how calm (berries), its mood and its turns left, its place in the chain and whether it was sneaked up on. */
export type SafariEncounter<F extends string> = SafariSlot<F> & { shiny: boolean; calm: number; mood: SafariMood | null; moodTurns: number; chain: number; stalked: boolean }

export type SafariCatch<F extends string> = { family: F; shiny: boolean; level: number; score: number }

/**
 * A session as the API keeps it (never sent whole: `queue` knows who is still
 * to come). `seen`: which of the queue have shown, `visible` which wander in
 * the open, `chain` the species met last and how many times in a row.
 */
export type SafariRun<F extends string> = {
  mode: SafariMode
  balls: number
  berries: number
  queue: readonly SafariSlot<F>[]
  seen: readonly boolean[]
  visible: readonly number[]
  encounter: SafariEncounter<F> | null
  catches: readonly SafariCatch<F>[]
  chain: { family: F; n: number } | null
  over: boolean
}

export type SafariAction = { kind: 'grass' } | { kind: 'stalk'; slot: number } | { kind: 'ball' } | { kind: 'berry' } | { kind: 'rock' } | { kind: 'bait' } | { kind: 'leave' } | { kind: 'finish' }

export const SAFARI_ACTIONS = ['grass', 'stalk', 'ball', 'berry', 'rock', 'bait', 'leave', 'finish'] as const satisfies readonly SafariAction['kind'][]

/** What an action came to, as the client animates it. `shakes`: how many a thrown ball made (3 and `caught`: it held). */
export type SafariTurn<F extends string> =
  | { kind: 'appear'; family: F; shiny: boolean; sure: boolean; level: number; chain: number; stalked: boolean }
  | { kind: 'ball'; family: F; shiny: boolean; shakes: number; caught: boolean; fled: boolean; score: number }
  | { kind: 'berry'; calm: number; fled: boolean }
  | { kind: 'rock'; turns: number; fled: boolean }
  | { kind: 'bait'; turns: number; fled: boolean }
  | { kind: 'left' }
  | { kind: 'finished' }

/** What the next session costs after `used` today: free, ₽, or null past the day's cap. */
export const sessionPrice = (used: number): number | null => (used >= SAFARI.dailyCap ? null : used < SAFARI.free ? 0 : SAFARI.price)

/** Whole weeks since the epoch of a week's Monday (`YYYY-MM-DD`). */
const weekNumber = (week: string) => Math.floor(Date.parse(`${week}T00:00:00Z`) / (7 * 86_400_000))

/** The week's habitat, the same for every player: the list taken in turn, one a Brasília week. */
export const habitatOfWeek = <H>(week: string, habitats: readonly H[]): H => habitats[((weekNumber(week) % habitats.length) + habitats.length) % habitats.length]!

/** The day of the week of a day key (0 Sunday), at noon UTC so no time zone moves it. */
const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay()

/** Whether the Brasília day `day` holds the Concurso de Insetos. */
export const isContestDay = (day: string) => (CONTEST.days as readonly number[]).includes(weekdayOf(day))

/** Most minutes a place is from UTC either way (UTC−12 to UTC+14). */
export const OFFSET_RANGE = { min: -12 * 60, max: 14 * 60 } as const

/** Whether `v` is a UTC offset a client may send: whole minutes east of UTC, within `OFFSET_RANGE`. */
export const isUtcOffset = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= OFFSET_RANGE.min && v <= OFFSET_RANGE.max

/** The hour (0 to 23) at the player's place: `now` in ms, `offset` minutes east of UTC. */
export const localHour = (now: number, offset: number) => Math.floor((((now + offset * 60_000) % 86_400_000) + 86_400_000) % 86_400_000 / 3_600_000)

/** The time of day at an hour: dawn 5 to 7, day to 17, dusk to 19, night the rest. */
export const daypartOf = (hour: number): SafariDaypart => (hour >= 5 && hour < 7 ? 'dawn' : hour >= 7 && hour < 17 ? 'day' : hour >= 17 && hour < 19 ? 'dusk' : 'night')

/** One Safari-only family's weight in a pool holding `n` of them: `weights.special` shared out (`SAFARI.specialSplit`). */
export const specialWeight = (n: number) => (SAFARI.weights.special * (1 + SAFARI.specialSplit * (Math.max(1, n) - 1))) / Math.max(1, n)

/** Each entry's weight for this partner: its rarity's (a Safari-only one's split, boosted while lacking), raised when they share a type. */
const weightsOf = <F extends string>(pool: readonly SafariEntry<F>[], partnerTypes: readonly string[]) => {
  const special = specialWeight(pool.filter((e) => e.rarity === 'special').length)
  return pool.map((entry) => {
    const base = entry.rarity === 'special' ? special * (entry.lacking ? SAFARI.lackingBoost : 1) : SAFARI.weights[entry.rarity]
    return base * (entry.types.some((type) => partnerTypes.includes(type)) ? SAFARI.partnerBoost : 1)
  })
}

/** Each entry's chance of being any one encounter, as the screen shows it (they add up to 1). */
export const shareOf = <F extends string>(pool: readonly SafariEntry<F>[], partnerTypes: readonly string[]) => {
  const weights = weightsOf(pool, partnerTypes)
  const total = weights.reduce((sum, w) => sum + w, 0)
  return pool.map((entry, i) => ({ ...entry, share: weights[i]! / total }))
}

const pickEntry = <F extends string>(pool: readonly SafariEntry<F>[], weights: readonly number[], next: () => number) => {
  let left = next() * weights.reduce((sum, w) => sum + w, 0)
  for (let i = 0; i < pool.length; i++) {
    left -= weights[i]!
    if (left < 0) return pool[i]!
  }
  return pool[pool.length - 1]!
}

const slotOf = <F extends string>({ family, rarity }: SafariEntry<F>, next: () => number, sure: boolean): SafariSlot<F> => ({
  family,
  rarity,
  level: SAFARI.levelBase[rarity] + Math.min(SAFARI.levelSpread - 1, Math.floor(next() * SAFARI.levelSpread)),
  sure,
})

/**
 * A new session's encounters at the odds `shareOf` shows: each repeats the
 * one before it at `SAFARI.repeat`, else draws afresh, which keeps every one
 * at the shares and lets chains form. `sure` (the guarantee's family) comes
 * first, so spending every ball before reaching it can't lose it.
 */
export const rollQueue = <F extends string>(pool: readonly SafariEntry<F>[], partnerTypes: readonly string[], next: () => number, sure: SafariEntry<F> | null): SafariSlot<F>[] => {
  const queue: SafariSlot<F>[] = []
  const weights = weightsOf(pool, partnerTypes)
  let last: SafariEntry<F> | null = null
  for (let i = 0; i < SAFARI.encounters; i++) {
    const entry: SafariEntry<F> = last && next() < SAFARI.repeat ? last : pickEntry(pool, weights, next)
    queue.push(slotOf(entry, next, false))
    last = entry
  }
  if (sure) queue[0] = slotOf(sure, next, true)
  return queue
}

/** Which slots wander in the open: `SAFARI.visible` of them, drawn by `next`, never the guarantee's. */
export const pickVisible = <F extends string>(queue: readonly SafariSlot<F>[], next: () => number): number[] => {
  const open = queue.flatMap((slot, i) => (slot.sure ? [] : [i]))
  const picked: number[] = []
  while (picked.length < SAFARI.visible && open.length > 0) picked.push(open.splice(Math.floor(next() * open.length), 1)[0]!)
  return picked.sort((a, b) => a - b)
}

/** A new session, its encounters from `rollQueue` and its wanderers from `pickVisible`. */
export const startRun = <F extends string>(queue: readonly SafariSlot<F>[], visible: readonly number[], mode: SafariMode = 'safari'): SafariRun<F> => ({
  mode,
  balls: SAFARI.balls,
  berries: SAFARI.berries,
  queue,
  seen: queue.map(() => false),
  visible,
  encounter: null,
  catches: [],
  chain: null,
  over: false,
})

/** How many encounters are still to come. */
export const encountersLeft = <F extends string>(run: SafariRun<F>) => run.seen.filter((s) => !s).length

/** The slot the next rustle in the grass brings: the first unseen one hiding there, else a wanderer that was scared into it. -1 when none is left. */
export const nextInGrass = <F extends string>(run: SafariRun<F>) => {
  const hidden = run.seen.findIndex((s, i) => !s && !run.visible.includes(i))
  return hidden >= 0 ? hidden : run.seen.findIndex((s) => !s)
}

/** The wanderers still out in the open, by slot, as the client is told them. */
export const wanderersOf = <F extends string>(run: SafariRun<F>) => run.visible.filter((i) => !run.seen[i]).map((slot) => ({ slot, family: run.queue[slot]!.family }))

/** The shiny odds of the `n`-th of a species in a row. */
export const shinyChanceOf = (n: number) => SAFARI.shinyOdds * SAFARI.chainBoost[Math.min(Math.max(n, 1), SAFARI.chainBoost.length) - 1]!

/** A ball's chance on a Pokémon of `rarity` given `calm` berries and its mood. */
export const catchChanceOf = (rarity: SafariRarity, calm: number, mood: SafariMood | null = null) =>
  Math.min(1, SAFARI.catchChance[rarity] * (1 + SAFARI.calmCatch * Math.min(calm, SAFARI.maxCalm)) * (mood ? SAFARI.mood[mood].catch : 1))

/** The chance it flees after a turn with `calm` berries and its mood. */
export const fleeChanceOf = (rarity: SafariRarity, calm: number, mood: SafariMood | null = null) =>
  Math.min(1, SAFARI.fleeChance[rarity] * (1 - SAFARI.calmFlee * Math.min(calm, SAFARI.maxCalm)) * (mood ? SAFARI.mood[mood].flee : 1))

/** What a catch scores in the Concurso de Insetos. */
export const contestScore = (rarity: SafariRarity, level: number, shiny: boolean) => CONTEST.points[rarity] + level * CONTEST.perLevel + (shiny ? CONTEST.shiny : 0)

/** An entry's score: its best catch's, 0 with none. */
export const bestCatch = <F extends string>(catches: readonly SafariCatch<F>[]): SafariCatch<F> | null => catches.reduce<SafariCatch<F> | null>((best, c) => (!best || c.score > best.score ? c : best), null)

/** How many of the three shakes a ball holds for: each passes at the cube root of the catch chance, so all three together come to it exactly. */
const rollShakes = (chance: number, next: () => number) => {
  const each = chance ** (1 / 3)
  for (let shake = 0; shake < 3; shake++) if (next() >= each) return shake
  return 3
}

/** Ends the session once nothing is left to do: no balls, or no encounter still to come and none being faced. */
const settle = <F extends string>(run: SafariRun<F>): SafariRun<F> => (run.balls === 0 || (run.encounter === null && encountersLeft(run) === 0) ? { ...run, encounter: null, over: true } : run)

/** A turn has passed for the one being faced: its mood wears off a turn. */
const passTurn = <F extends string>(e: SafariEncounter<F>): SafariEncounter<F> => (e.moodTurns > 1 ? { ...e, moodTurns: e.moodTurns - 1 } : { ...e, mood: null, moodTurns: 0 })

/** Meets slot `i`: rolls its shiny at the chain's odds and moves the chain. */
const meet = <F extends string>(run: SafariRun<F>, i: number, stalked: boolean, next: () => number): { run: SafariRun<F>; turn: SafariTurn<F> } => {
  const slot = run.queue[i]!
  const n = run.chain?.family === slot.family ? run.chain.n + 1 : 1
  const shiny = next() < shinyChanceOf(n)
  const encounter: SafariEncounter<F> = { ...slot, shiny, calm: stalked ? SAFARI.stalkCalm : 0, mood: null, moodTurns: 0, chain: n, stalked }
  return {
    run: { ...run, seen: run.seen.map((s, j) => s || j === i), encounter, chain: { family: slot.family, n } },
    turn: { kind: 'appear', family: slot.family, shiny, sure: slot.sure, level: slot.level, chain: n, stalked },
  }
}

/**
 * One action on a session, with every roll made through `next`. Null when it
 * can't be done now (no encounter to act on, already facing one, none left,
 * no balls, a wanderer already met); the guarantee's encounter (`sure`)
 * neither fails nor flees.
 */
export const applyAction = <F extends string>(run: SafariRun<F>, action: SafariAction, next: () => number): { run: SafariRun<F>; turn: SafariTurn<F> } | null => {
  if (run.over) return null
  if (action.kind === 'finish') return { run: { ...run, encounter: null, over: true }, turn: { kind: 'finished' } }
  const { encounter } = run
  if (action.kind === 'grass') {
    const i = nextInGrass(run)
    return encounter || i < 0 ? null : meet(run, i, false, next)
  }
  if (action.kind === 'stalk') {
    const i = action.slot
    return encounter || !run.visible.includes(i) || run.seen[i] !== false ? null : meet(run, i, true, next)
  }
  if (!encounter) return null
  if (action.kind === 'leave') return { run: settle({ ...run, encounter: null }), turn: { kind: 'left' } }
  if (action.kind === 'berry' || action.kind === 'rock' || action.kind === 'bait') {
    if (action.kind === 'berry' && run.berries === 0) return null
    const calm = action.kind === 'berry' ? Math.min(encounter.calm + 1, SAFARI.maxCalm) : encounter.calm
    const turns = action.kind === 'berry' ? 0 : 1 + Math.min(SAFARI.moodTurns - 1, Math.floor(next() * SAFARI.moodTurns))
    const mood: SafariMood | null = action.kind === 'rock' ? 'angry' : action.kind === 'bait' ? 'eating' : encounter.mood
    // The flee roll already feels what was thrown: calmer, angrier or eating now, and still a turn in which it can run.
    const fled = !encounter.sure && next() < fleeChanceOf(encounter.rarity, calm, mood)
    const after = { ...run, berries: action.kind === 'berry' ? run.berries - 1 : run.berries }
    const faced: SafariEncounter<F> = action.kind === 'berry' ? passTurn({ ...encounter, calm }) : { ...encounter, mood, moodTurns: turns }
    const turn: SafariTurn<F> = action.kind === 'berry' ? { kind: 'berry', calm, fled } : { kind: action.kind, turns, fled }
    return { run: fled ? settle({ ...after, encounter: null }) : { ...after, encounter: faced }, turn }
  }
  if (run.balls === 0) return null
  const shakes = encounter.sure ? 3 : rollShakes(catchChanceOf(encounter.rarity, encounter.calm, encounter.mood), next)
  const caught = shakes === 3
  const fled = !caught && !encounter.sure && next() < fleeChanceOf(encounter.rarity, encounter.calm, encounter.mood)
  const score = contestScore(encounter.rarity, encounter.level, encounter.shiny)
  const after: SafariRun<F> = {
    ...run,
    balls: run.balls - 1,
    encounter: caught || fled ? null : passTurn(encounter),
    catches: caught ? [...run.catches, { family: encounter.family, shiny: encounter.shiny, level: encounter.level, score }] : run.catches,
  }
  return { run: settle(after), turn: { kind: 'ball', family: encounter.family, shiny: encounter.shiny, shakes, caught, fled, score } }
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

/** The contest's prizes by place: the champion's, the podium's and the rest of the top's. */
export type ContestPrize = 'champion' | 'podium' | 'top'

export const CONTEST_PRIZES = {
  /** Places that earn a prize at most, and at most this share of the entrants, so a thin week rewards a few. */
  top: 10,
  share: 1 / 2,
  /** A week with fewer entrants than this isn't a race: nobody earns a prize. */
  minField: 3,
} as const

/** The prize a place earns on a week's board of `field` entrants, or null. */
export const contestPrize = (rank: number, field: number): ContestPrize | null => {
  if (field < CONTEST_PRIZES.minField) return null
  const cut = Math.min(CONTEST_PRIZES.top, Math.max(1, Math.floor(field * CONTEST_PRIZES.share)))
  if (rank < 1 || rank > cut) return null
  return rank === 1 ? 'champion' : rank <= 3 ? 'podium' : 'top'
}

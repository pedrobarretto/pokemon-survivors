import type { TableRules } from '../../net/realmTables'

/**
 * The type duel's rules (`MINIGAMES.typeDuel`): pure, run by the relay and
 * the local table. Import only `net/realmTables.ts`.
 *
 * Each seat gets a deck dealt from the seed: Fire, Water and Grass cards with
 * a power (2–12) and a Pokémon to show (stronger cards, evolved Pokémon).
 * Both seats hold `HAND` cards and pick one at once; when both have picked
 * the cards turn: the type triangle decides (Fire beats Grass, Grass beats
 * Water, Water beats Fire), the same type goes to the higher power, and an
 * equal card wins for nobody. The winner banks its own card by type. Three
 * banked of one type, or one of each, wins the match; after `ROUNDS` rounds
 * without that, the most banked wins (equal: a draw).
 *
 * A seat's view hides the rival's hand and pick until they turn; the last
 * reveal is shown to both seats and to whoever watches.
 */

export const DUEL_TYPES = ['fire', 'water', 'grass'] as const
export type DuelType = (typeof DUEL_TYPES)[number]

/** A card: `id` is unique within its seat's deck (a move names it). `dex` is the Pokémon on it. */
export type DuelCard = { id: number; type: DuelType; power: number; dex: number }

/** One reveal: the card each seat turned, and who won it (null: nobody). */
export type DuelReveal = { round: number; cards: readonly [DuelCard, DuelCard]; winner: number | null }

type Seat = { deck: readonly DuelCard[]; hand: readonly DuelCard[]; pick: DuelCard | null; bank: readonly DuelCard[] }

export type DuelState = { seats: readonly [Seat, Seat]; round: number; last: DuelReveal | null; winner: number | null; over: boolean }

/**
 * What a seat (or a spectator, `you: null`) sees: its own hand and pick, how
 * many cards the rival holds and whether it has picked, both banks, the last
 * reveal, and the end.
 */
export type DuelView = {
  you: number | null
  round: number
  hand: readonly DuelCard[]
  pick: DuelCard | null
  picked: readonly [boolean, boolean]
  held: readonly [number, number]
  banks: readonly [readonly DuelCard[], readonly DuelCard[]]
  last: DuelReveal | null
  winner: number | null
  over: boolean
}

export const DUEL = {
  hand: 5,
  deck: 20,
  /** Rounds before the match is settled by the most banked. */
  rounds: 15,
  power: { min: 2, max: 12 },
} as const

/**
 * The Pokémon a card shows, by type and by power tier (2–4, 5–7, 8–10,
 * 11–12): starters and common Pokémon first, their evolutions up the tiers.
 * Every one has a SpriteCollab portrait.
 */
export const DUEL_SPECIES: Record<DuelType, readonly (readonly number[])[]> = {
  fire: [
    [4, 155, 255, 37, 390],
    [5, 156, 256, 58, 77],
    [126, 136, 229, 38, 78],
    [6, 157, 257, 59],
  ],
  water: [
    [7, 158, 258, 60, 183, 129],
    [8, 159, 259, 120, 116],
    [134, 121, 55, 131],
    [9, 160, 260, 130],
  ],
  grass: [
    [1, 152, 252, 43, 69, 187],
    [2, 153, 253, 102, 285],
    [470, 114, 45, 71],
    [3, 154, 254, 103],
  ],
}

const tierOf = (power: number) => (power <= 4 ? 0 : power <= 7 ? 1 : power <= 10 ? 2 : 3)

/** Mulberry32: the rules' only randomness, from a seed. */
const rng = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let x = Math.imul(a ^ (a >>> 15), 1 | a)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

const pickOf = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)]!

/**
 * A seat's deck from the seed: a near-even split of the three types (7, 7,
 * 6, the extra types drawn), powers spread over the range so every hand has
 * strong and weak cards, shuffled.
 */
export const dealDeck = (seed: number): DuelCard[] => {
  const r = rng(seed)
  const types: DuelType[] = []
  for (let i = 0; i < DUEL.deck; i++) types.push(DUEL_TYPES[i % 3]!)
  const span = DUEL.power.max - DUEL.power.min + 1
  const cards = types.map((type, i): DuelCard => {
    // Powers walk the range per type (every 3rd card), jittered by ±1, so no type is all weak.
    const step = Math.floor(i / 3)
    const base = DUEL.power.min + Math.floor((step * span) / Math.ceil(DUEL.deck / 3))
    const power = Math.max(DUEL.power.min, Math.min(DUEL.power.max, base + Math.floor(r() * 3) - 1))
    return { id: 0, type, power, dex: pickOf(r, DUEL_SPECIES[type][tierOf(power)]!) }
  })
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[cards[i], cards[j]] = [cards[j]!, cards[i]!]
  }
  return cards.map((c, id) => ({ ...c, id }))
}

/** Whether type `a` beats type `b` on the triangle. */
export const beats = (a: DuelType, b: DuelType) => (a === 'fire' && b === 'grass') || (a === 'grass' && b === 'water') || (a === 'water' && b === 'fire')

/** Which of two cards wins: 0, 1 or null (the same type and power). */
export const duelWinner = (a: DuelCard, b: DuelCard): 0 | 1 | null =>
  beats(a.type, b.type) ? 0 : beats(b.type, a.type) ? 1 : a.power > b.power ? 0 : b.power > a.power ? 1 : null

/** Cards banked per type. */
export const bankCounts = (bank: readonly DuelCard[]): Record<DuelType, number> => {
  const n = { fire: 0, water: 0, grass: 0 }
  for (const c of bank) n[c.type]++
  return n
}

/** Whether a bank wins the match: three of one type, or one of each. */
export const bankWins = (bank: readonly DuelCard[]) => {
  const n = bankCounts(bank)
  return DUEL_TYPES.some((t) => n[t] >= 3) || DUEL_TYPES.every((t) => n[t] >= 1)
}

const seatOf = (seed: number): Seat => {
  const deck = dealDeck(seed)
  return { deck: deck.slice(DUEL.hand), hand: deck.slice(0, DUEL.hand), pick: null, bank: [] }
}

const startDuel = (seed: number): DuelState => ({
  seats: [seatOf(seed ^ 0x51ed), seatOf((seed ^ 0xa3c5) + 7919)],
  round: 1,
  last: null,
  winner: null,
  over: false,
})

/** Turns both picks: the winner banks its card, both draw, and the match ends on a winning bank or after the last round. */
const reveal = (s: DuelState, a: Seat, b: Seat): DuelState => {
  const pa = a.pick!
  const pb = b.pick!
  const winner = duelWinner(pa, pb)
  const after = (seat: Seat, card: DuelCard, won: boolean): Seat => {
    const hand = seat.hand.filter((c) => c.id !== card.id)
    const [draw, ...deck] = seat.deck
    return { deck, hand: draw ? [...hand, draw] : hand, pick: null, bank: won ? [...seat.bank, card] : seat.bank }
  }
  const seats = [after(a, pa, winner === 0), after(b, pb, winner === 1)] as const
  const last: DuelReveal = { round: s.round, cards: [pa, pb], winner }
  if (winner !== null && bankWins(seats[winner].bank)) return { seats, round: s.round, last, winner, over: true }
  const outOfCards = seats.some((x) => x.hand.length === 0)
  if (s.round >= DUEL.rounds || outOfCards) {
    const d = seats[0].bank.length - seats[1].bank.length
    return { seats, round: s.round, last, winner: d > 0 ? 0 : d < 0 ? 1 : null, over: true }
  }
  return { seats, round: s.round + 1, last, winner: null, over: false }
}

const play = (s: DuelState, seat: number, id: number): DuelState | null => {
  if (s.over || (seat !== 0 && seat !== 1)) return null
  const me = s.seats[seat]!
  if (me.pick !== null) return null
  const card = me.hand.find((c) => c.id === id)
  if (!card) return null
  const picked: Seat = { ...me, pick: card }
  const seats = (seat === 0 ? [picked, s.seats[1]] : [s.seats[0], picked]) as readonly [Seat, Seat]
  if (seats[0].pick && seats[1].pick) return reveal(s, seats[0], seats[1])
  return { ...s, seats }
}

/* ---------- The bot ---------- */

/** How much banking a card of `type` is worth to a bank: winning outright most, a type it lacks next, a third of one after. */
const need = (bank: readonly DuelCard[], type: DuelType) => {
  if (bankWins([...bank, { id: -1, type, power: 0, dex: 0 }])) return 4
  const n = bankCounts(bank)[type]
  return n === 0 ? 1.5 : n === 1 ? 1.2 : 0.8
}

/**
 * The bot's pick: guesses the rival's type from what the rival's bank needs
 * (a rival a card from winning plays that type more), scores each card by
 * its chance to win times what banking it is worth (and what it denies),
 * keeps strong cards when type alone wins, and adds seeded noise so it isn't
 * read like a book.
 */
const botPick = (s: DuelState, seat: number, seed: number): number => {
  const r = rng(seed)
  const me = s.seats[seat]!
  const rival = s.seats[1 - seat]!
  const weights = DUEL_TYPES.map((t) => 1 + need(rival.bank, t))
  const total = weights.reduce((a, b) => a + b, 0)
  let best = me.hand[0]!
  let bestScore = -Infinity
  for (const c of me.hand) {
    let win = 0
    let deny = 0
    DUEL_TYPES.forEach((t, i) => {
      const p = weights[i]! / total
      // Against the same type, the chance a rival's card (2–12, about even) is weaker.
      const chance = beats(c.type, t) ? 1 : beats(t, c.type) ? 0 : (c.power - DUEL.power.min) / (DUEL.power.max - DUEL.power.min + 1)
      win += p * chance
      deny += p * chance * need(rival.bank, t)
    })
    const score = win * need(me.bank, c.type) + 0.35 * deny - 0.012 * c.power * win + r() * 0.35
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  return best.id
}

/* ---------- Wire ---------- */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)
const isType = (v: unknown): v is DuelType => v === 'fire' || v === 'water' || v === 'grass'
const isSeatOrNull = (v: unknown): v is number | null => v === null || v === 0 || v === 1

const parseCard = (v: unknown): DuelCard | null =>
  isRecord(v) && isInt(v.id) && isType(v.type) && isInt(v.power) && v.power >= DUEL.power.min && v.power <= DUEL.power.max && isInt(v.dex) && v.dex > 0
    ? { id: v.id, type: v.type, power: v.power, dex: v.dex }
    : null

const parseCards = (v: unknown, max: number): DuelCard[] | null => {
  if (!Array.isArray(v) || v.length > max) return null
  const out: DuelCard[] = []
  for (const c of v) {
    const card = parseCard(c)
    if (!card) return null
    out.push(card)
  }
  return out
}

const parsePair = <T>(v: unknown, read: (x: unknown) => T | null): readonly [T, T] | null => {
  if (!Array.isArray(v) || v.length !== 2) return null
  const a = read(v[0])
  const b = read(v[1])
  return a === null || b === null ? null : [a, b]
}

const parseReveal = (v: unknown): DuelReveal | null => {
  if (!isRecord(v) || !isInt(v.round) || !isSeatOrNull(v.winner)) return null
  const cards = parsePair(v.cards, parseCard)
  return cards ? { round: v.round, cards, winner: v.winner } : null
}

const parseView = (v: unknown): DuelView | null => {
  if (!isRecord(v) || !isSeatOrNull(v.you) || !isInt(v.round) || !isSeatOrNull(v.winner) || typeof v.over !== 'boolean') return null
  const hand = parseCards(v.hand, DUEL.hand)
  const pick = v.pick === null ? null : parseCard(v.pick)
  const picked = parsePair(v.picked, (x) => (typeof x === 'boolean' ? x : null))
  const held = parsePair(v.held, (x) => (isInt(x) && x >= 0 && x <= DUEL.hand ? x : null))
  const banks = parsePair(v.banks, (x) => parseCards(x, DUEL.deck))
  const last = v.last === null ? null : parseReveal(v.last)
  if (!hand || (v.pick !== null && !pick) || !picked || !held || !banks || (v.last !== null && !last)) return null
  return { you: v.you, round: v.round, hand, pick, picked, held, banks, last, winner: v.winner, over: v.over }
}

export const typeDuelRules: TableRules<DuelState, number, DuelView> = {
  seats: 2,
  start: startDuel,
  parseMove: (v) => (isInt(v) && v >= 0 && v < DUEL.deck ? v : null),
  play,
  pending: (s) => (s.over ? [] : [0, 1].filter((i) => s.seats[i]!.pick === null)),
  result: (s) => (s.over ? { winner: s.winner, forfeit: null } : null),
  view: (s, seat) => {
    const mine = seat === 0 || seat === 1 ? s.seats[seat] : null
    return {
      you: mine ? seat : null,
      round: s.round,
      hand: mine ? mine.hand : [],
      pick: mine ? mine.pick : null,
      picked: [s.seats[0].pick !== null, s.seats[1].pick !== null],
      held: [s.seats[0].hand.length, s.seats[1].hand.length],
      banks: [s.seats[0].bank, s.seats[1].bank],
      last: s.last,
      winner: s.winner,
      over: s.over,
    }
  },
  parseView,
  bot: botPick,
}

import type { TableRules } from '../../net/realmTables'

/**
 * Unown's rules (`MINIGAMES.unown`), a shedding card game for 4 seats: be
 * the first to play every card in your hand.
 *
 * - The deck: 4 types (Fire, Water, Grass, Electric) × 9 Unown letters
 *   (A B C F J K N O U), two of each; per type two each of Protect (the next
 *   seat is skipped), Trick Room (the turn order turns round) and Double
 *   Kick (the next seat draws 2 and is skipped); and 4 Ditto (wild: pick the
 *   type) and 4 Mew (wild: pick the type, the next seat draws 4 and is
 *   skipped). 104 cards; each seat is dealt 7, and the first card turned up
 *   is a letter.
 * - On your turn, play a card of the type in play or with the top card's
 *   letter (or move, Protect on Protect), or a wild. Can't (or won't)? Draw
 *   one: if it plays, you may play it at once; else the turn passes.
 * - Playing down to one card, tap UNOWN! first (`call`): forget, and the
 *   table catches you: 2 cards drawn on the spot.
 * - First seat with no cards wins.
 *
 * Pure, and imports only `net/realmTables.ts`: the relay and the local table
 * both run it. Hands are hidden: a seat's view holds only its own (a
 * spectator's none), the deck's order never leaves the state.
 */

export const UNOWN_TYPES = ['fire', 'water', 'grass', 'electric'] as const
export type UnownType = (typeof UNOWN_TYPES)[number]

/** The Unown letters on the number cards, in the deck's order (each one an Unown form). */
export const UNOWN_LETTERS = ['A', 'B', 'C', 'F', 'J', 'K', 'N', 'O', 'U'] as const
export type UnownLetter = (typeof UNOWN_LETTERS)[number]

/** The moves on the action cards, and the two wilds. */
export const UNOWN_ACTIONS = ['protect', 'trickRoom', 'doubleKick'] as const
export type UnownAction = (typeof UNOWN_ACTIONS)[number]
export type UnownWild = 'ditto' | 'mew'

/** A card: a typed letter, a typed move, or a wild (no type until played). */
export type UnownCard =
  | { id: number; type: UnownType; face: UnownLetter }
  | { id: number; type: UnownType; face: UnownAction }
  | { id: number; type: null; face: UnownWild }

export const UNOWN = {
  seats: 4,
  hand: 7,
  /** Copies of each typed letter and each typed move. */
  copies: 2,
  wilds: 4,
  /** Cards Double Kick, Mew and a missed call draw. */
  kick: 2,
  mew: 4,
  missedCall: 2,
  /** A match past this many moves ends with the smallest hand (a guard; play never gets near). */
  maxMoves: 900,
} as const

/** The whole deck, by id. */
export const DECK: readonly UnownCard[] = (() => {
  const out: UnownCard[] = []
  for (const type of UNOWN_TYPES) {
    for (const face of UNOWN_LETTERS) for (let k = 0; k < UNOWN.copies; k++) out.push({ id: out.length, type, face })
    for (const face of UNOWN_ACTIONS) for (let k = 0; k < UNOWN.copies; k++) out.push({ id: out.length, type, face })
  }
  for (const face of ['ditto', 'mew'] as const) for (let k = 0; k < UNOWN.wilds; k++) out.push({ id: out.length, type: null, face })
  return out
})()

export const cardOf = (id: number): UnownCard => DECK[id]!

export const isWild = (c: UnownCard): c is Extract<UnownCard, { type: null }> => c.type === null

/** What happened, for the screen to play out (a seat's own draws carry the cards it drew; others see only how many). */
export type UnownEvent =
  | { n: number; k: 'play'; seat: number; card: number; as: UnownType; called: boolean }
  | { n: number; k: 'draw'; seat: number; count: number; why: 'draw' | 'kick' | 'mew' | 'caught'; cards: readonly number[] }
  | { n: number; k: 'pass'; seat: number }
  | { n: number; k: 'skip'; seat: number }
  | { n: number; k: 'reverse'; seat: number }

export type UnownState = {
  hands: readonly (readonly number[])[]
  /** The draw pile, top last. Never in a view. */
  deck: readonly number[]
  /** The discard pile, top last. */
  pile: readonly number[]
  /** The type in play (a wild's pick, else the top card's). */
  type: UnownType
  turn: number
  /** 1 clockwise, -1 after a Trick Room. */
  dir: 1 | -1
  /** After drawing a card that plays: the turn's seat may play it or pass. */
  drawn: number | null
  winner: number | null
  moves: number
  events: readonly UnownEvent[]
  /** The shuffles' generator. Never in a view. */
  rng: number
}

/**
 * What a seat sees: its own hand (none for a spectator), everyone's card
 * counts, the pile's top few, the type in play, whose turn and which way,
 * the draw pile's size, its own drawn card, and the events (a draw's cards
 * only for the seat that drew them).
 */
export type UnownView = {
  you: number | null
  hand: readonly number[]
  counts: readonly number[]
  pile: readonly number[]
  type: UnownType
  turn: number
  dir: 1 | -1
  deck: number
  drawn: number | null
  winner: number | null
  moves: number
  events: readonly UnownEvent[]
}

export type UnownMove = { k: 'play'; card: number; as?: UnownType; call?: boolean } | { k: 'draw' } | { k: 'pass' }

const EVENTS_KEPT = 8
const PILE_SHOWN = 4

/* ---------------- Shuffles ---------------- */

/** Mulberry32: the next generator state and a number in [0, 1). */
const next = (rng: number): [number, number] => {
  const s = (rng + 0x6d2b79f5) >>> 0
  let x = Math.imul(s ^ (s >>> 15), s | 1)
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
  return [s, ((x ^ (x >>> 14)) >>> 0) / 4294967296]
}

/** A Fisher–Yates shuffle of `cards` from `rng`: the shuffled cards and the generator after. */
const shuffle = (cards: readonly number[], rng: number): [number[], number] => {
  const out = cards.slice()
  let r = rng
  for (let i = out.length - 1; i > 0; i--) {
    const [r2, u] = next(r)
    r = r2
    const j = Math.floor(u * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return [out, r]
}

/* ---------------- Play ---------------- */

const topOf = (s: { pile: readonly number[] }) => cardOf(s.pile[s.pile.length - 1]!)

/** Whether `card` may go on the pile now: a wild, the type in play, or the top card's letter or move. */
export const playable = (s: { pile: readonly number[]; type: UnownType }, card: number): boolean => {
  const c = cardOf(card)
  return isWild(c) || c.type === s.type || c.face === topOf(s).face
}

const seats = (s: UnownState) => s.hands.length

/** The seat `steps` turns on from `from`, the way play goes. */
const after = (s: UnownState, from: number, steps = 1, dir: 1 | -1 = s.dir) => (((from + dir * steps) % seats(s)) + seats(s)) % seats(s)

/** An event without its number (`push` numbers it). */
type Unnumbered = UnownEvent extends infer E ? (E extends UnownEvent ? Omit<E, 'n'> : never) : never

const push = (s: UnownState, events: readonly Unnumbered[]): UnownEvent[] => [...s.events, ...events.map((e, i) => ({ ...e, n: s.moves * 4 + i }))].slice(-EVENTS_KEPT)

/** Draws `count` for `seat`: off the deck, the pile (all but its top) shuffled back in when the deck runs out. */
const draw = (s: UnownState, seat: number, count: number): { s: UnownState; cards: number[] } => {
  let deck = s.deck.slice()
  let pile = s.pile.slice()
  let rng = s.rng
  const cards: number[] = []
  for (let i = 0; i < count; i++) {
    if (deck.length === 0 && pile.length > 1) {
      const top = pile.pop()!
      ;[deck, rng] = shuffle(pile, rng)
      pile = [top]
    }
    const c = deck.pop()
    if (c === undefined) break
    cards.push(c)
  }
  const hands = s.hands.map((h, i) => (i === seat ? [...h, ...cards] : h))
  return { s: { ...s, deck, pile, rng, hands }, cards }
}

/** The seat with the fewest cards (the guard's winner). */
const fewest = (s: UnownState) => s.hands.reduce((best, h, i) => (h.length < s.hands[best]!.length ? i : best), 0)

/** Ends the move: the next turn (or the guard's end). */
const settle = (s: UnownState): UnownState => (s.moves >= UNOWN.maxMoves && s.winner === null ? { ...s, winner: fewest(s) } : s)

/** Plays `card` from `seat`'s hand (`as` picks a wild's type, `call` is the UNOWN! tapped before). */
export const play = (s: UnownState, seat: number, card: number, as?: UnownType, call = false): UnownState | null => {
  if (s.winner !== null || seat !== s.turn) return null
  const hand = s.hands[seat]!
  if (!hand.includes(card) || (s.drawn !== null && card !== s.drawn) || !playable(s, card)) return null
  const c = cardOf(card)
  if (isWild(c) && as === undefined) return null
  const type = isWild(c) ? as! : c.type
  const left = hand.filter((x) => x !== card)
  let out: UnownState = { ...s, hands: s.hands.map((h, i) => (i === seat ? left : h)), pile: [...s.pile, card], type, drawn: null, moves: s.moves + 1 }
  const events: Unnumbered[] = [{ k: 'play', seat, card, as: type, called: call }]
  if (left.length === 0) return { ...out, winner: seat, events: push(s, events) }
  // Down to one without the call: the table catches it.
  if (left.length === 1 && !call) {
    const d = draw(out, seat, UNOWN.missedCall)
    out = d.s
    events.push({ k: 'draw', seat, count: d.cards.length, why: 'caught', cards: d.cards })
  }
  let dir = s.dir
  let turn = after(out, seat, 1, dir)
  if (c.face === 'trickRoom') {
    dir = dir === 1 ? -1 : 1
    turn = after(out, seat, 1, dir)
    events.push({ k: 'reverse', seat })
  } else if (c.face === 'protect') {
    events.push({ k: 'skip', seat: turn })
    turn = after(out, turn, 1, dir)
  } else if (c.face === 'doubleKick' || c.face === 'mew') {
    const victim = turn
    const d = draw(out, victim, c.face === 'mew' ? UNOWN.mew : UNOWN.kick)
    out = d.s
    events.push({ k: 'draw', seat: victim, count: d.cards.length, why: c.face === 'mew' ? 'mew' : 'kick', cards: d.cards }, { k: 'skip', seat: victim })
    turn = after(out, victim, 1, dir)
  }
  return settle({ ...out, dir, turn, events: push(s, events) })
}

/** Draws one for the seat on turn: if it plays, the seat may play it (`drawn`); else the turn passes. */
export const drawOne = (s: UnownState, seat: number): UnownState | null => {
  if (s.winner !== null || seat !== s.turn || s.drawn !== null) return null
  const d = draw(s, seat, 1)
  const got = d.cards[0]
  const events: Unnumbered[] = [{ k: 'draw', seat, count: d.cards.length, why: 'draw', cards: d.cards }]
  const base: UnownState = { ...d.s, moves: s.moves + 1 }
  if (got !== undefined && playable(base, got)) return settle({ ...base, drawn: got, events: push(s, events) })
  events.push({ k: 'pass', seat })
  return settle({ ...base, turn: after(base, seat), events: push(s, events) })
}

/** Keeps the card just drawn: the turn passes. */
export const passTurn = (s: UnownState, seat: number): UnownState | null => {
  if (s.winner !== null || seat !== s.turn || s.drawn === null) return null
  return settle({ ...s, drawn: null, turn: after(s, seat), moves: s.moves + 1, events: push(s, [{ k: 'pass', seat }]) })
}

/** The start of a match: shuffled, 7 each, a letter turned up, a seeded seat first. */
export const startUnown = (seed: number): UnownState => {
  let [deck, rng] = shuffle(
    DECK.map((c) => c.id),
    seed >>> 0,
  )
  const hands = Array.from({ length: UNOWN.seats }, () => deck.splice(deck.length - UNOWN.hand, UNOWN.hand))
  // The first card up is a letter: anything else goes to the bottom.
  while (!UNOWN_LETTERS.some((l) => l === cardOf(deck[deck.length - 1]!).face)) deck.unshift(deck.pop()!)
  const first = deck.pop()!
  const [rng2, u] = next(rng)
  rng = rng2
  const c = cardOf(first)
  return { hands, deck, pile: [first], type: c.type ?? 'fire', turn: Math.floor(u * UNOWN.seats), dir: 1, drawn: null, winner: null, moves: 0, events: [], rng }
}

/* ---------------- The bot ---------------- */

/** A seeded number in [0, 1) from `seed` and `k`. */
const unit = (seed: number, k: number) => next((seed ^ Math.imul(k + 1, 0x9e3779b9)) >>> 0)[1]

/** The type `hand` holds most of (ties by the order of `UNOWN_TYPES`), for a wild's pick. */
export const favoriteType = (hand: readonly number[]): UnownType => {
  const counts = UNOWN_TYPES.map((t) => hand.filter((id) => cardOf(id).type === t).length)
  return UNOWN_TYPES[counts.indexOf(Math.max(...counts))]!
}

/**
 * The bot's move for `seat` (it sees only its own view): a typed card before
 * a wild, a move card when the next seat is close to winning, the type it
 * holds most; Mew only when nothing else plays or the next seat is down to
 * one or two. It draws when nothing plays, plays a drawn card that does, and
 * calls UNOWN! — mostly (`seed`: about one time in seven it forgets).
 */
export const botMove = (v: UnownView, seat: number, seed: number): UnownMove => {
  const hand = v.hand
  if (v.drawn !== null) return playable(v, v.drawn) ? { k: 'play', card: v.drawn, as: favoriteType(hand.filter((c) => c !== v.drawn)), call: hand.length === 2 ? unit(seed, 9) > 0.15 : false } : { k: 'pass' }
  const options = hand.filter((c) => playable(v, c))
  if (options.length === 0) return { k: 'draw' }
  const nextSeat = (((seat + v.dir) % v.counts.length) + v.counts.length) % v.counts.length
  const threat = v.counts[nextSeat] ?? 7
  const fav = favoriteType(hand)
  const score = (id: number) => {
    const c = cardOf(id)
    if (c.face === 'mew') return threat <= 2 ? 40 : -30
    if (c.face === 'ditto') return -20
    let s = c.type === fav ? 6 : 0
    if (c.face === 'doubleKick' || c.face === 'protect') s += threat <= 2 ? 30 : 4
    if (c.face === 'trickRoom') s += threat <= 2 ? 20 : 2
    // Keep the type's run going: more of the same type behind it is better.
    s += hand.filter((x) => x !== id && cardOf(x).type === c.type).length
    return s + unit(seed, id)
  }
  const card = options.reduce((best, id) => (score(id) > score(best) ? id : best), options[0]!)
  const rest = hand.filter((c) => c !== card)
  return { k: 'play', card, as: isWild(cardOf(card)) ? favoriteType(rest) : undefined, call: hand.length === 2 ? unit(seed, 9) > 0.15 : false }
}

/* ---------------- The wire ---------------- */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi
const isSeat = (v: unknown): v is number => isInt(v, 0, UNOWN.seats - 1)
const isCard = (v: unknown): v is number => isInt(v, 0, DECK.length - 1)
const isType = (v: unknown): v is UnownType => UNOWN_TYPES.some((t) => t === v)
const cards = (v: unknown, max: number): number[] | null => (Array.isArray(v) && v.length <= max && v.every(isCard) ? v.filter(isCard) : null)

const DRAW_WHY = ['draw', 'kick', 'mew', 'caught'] as const

const parseEvent = (v: unknown): UnownEvent | null => {
  if (!isRecord(v) || !isInt(v.n, 0, UNOWN.maxMoves * 4 + 8) || !isSeat(v.seat)) return null
  const { n, seat } = { n: v.n, seat: v.seat }
  if (v.k === 'play') return isCard(v.card) && isType(v.as) && typeof v.called === 'boolean' ? { n, k: 'play', seat, card: v.card, as: v.as, called: v.called } : null
  if (v.k === 'draw') {
    const got = cards(v.cards, UNOWN.mew)
    const why = DRAW_WHY.find((w) => w === v.why)
    return got && why && isInt(v.count, 0, UNOWN.mew) ? { n, k: 'draw', seat, count: v.count, why, cards: got } : null
  }
  if (v.k === 'pass' || v.k === 'skip' || v.k === 'reverse') return { n, k: v.k, seat }
  return null
}

/** Reads a view off the wire, checking every field. */
export const parseUnown = (v: unknown): UnownView | null => {
  if (!isRecord(v) || !(v.you === null || isSeat(v.you)) || !isType(v.type) || !isSeat(v.turn) || (v.dir !== 1 && v.dir !== -1)) return null
  const hand = cards(v.hand, DECK.length)
  const pile = cards(v.pile, PILE_SHOWN)
  if (!hand || !pile || pile.length === 0 || !Array.isArray(v.counts) || v.counts.length !== UNOWN.seats || !v.counts.every((n) => isInt(n, 0, DECK.length))) return null
  if (!isInt(v.deck, 0, DECK.length) || !(v.drawn === null || isCard(v.drawn)) || !(v.winner === null || isSeat(v.winner)) || !isInt(v.moves, 0, UNOWN.maxMoves + 1) || !Array.isArray(v.events)) return null
  const events = v.events.map(parseEvent)
  if (events.some((e) => e === null)) return null
  return {
    you: v.you,
    hand,
    counts: v.counts.filter((n): n is number => typeof n === 'number'),
    pile,
    type: v.type,
    turn: v.turn,
    dir: v.dir,
    deck: v.deck,
    drawn: v.drawn,
    winner: v.winner,
    moves: v.moves,
    events: events.filter((e): e is UnownEvent => e !== null),
  }
}

/** `seat`'s view of the state (null: a spectator's): its own hand and its own draws' cards, nothing else hidden. */
export const viewUnown = (s: UnownState, seat: number | null): UnownView => ({
  you: seat,
  hand: seat === null ? [] : s.hands[seat]!,
  counts: s.hands.map((h) => h.length),
  pile: s.pile.slice(-PILE_SHOWN),
  type: s.type,
  turn: s.turn,
  dir: s.dir,
  deck: s.deck.length,
  drawn: seat !== null && seat === s.turn ? s.drawn : null,
  winner: s.winner,
  moves: s.moves,
  events: s.events.map((e) => (e.k === 'draw' && e.seat !== seat ? { ...e, cards: [] } : e)),
})

const parseMove = (v: unknown): UnownMove | null => {
  if (!isRecord(v)) return null
  if (v.k === 'draw' || v.k === 'pass') return { k: v.k }
  if (v.k !== 'play' || !isCard(v.card) || !(v.as === undefined || isType(v.as)) || !(v.call === undefined || typeof v.call === 'boolean')) return null
  return { k: 'play', card: v.card, ...(v.as !== undefined && { as: v.as }), ...(v.call === true && { call: true }) }
}

/** Unown's rules (`MINIGAMES.unown`): an open table of 4, pure, run by the relay and the local table. Import only `net/realmTables.ts`. */
export const unownRules: TableRules<UnownState, UnownMove, UnownView> = {
  seats: UNOWN.seats,
  open: { turnMs: 20_000, botMs: 1100 },
  start: startUnown,
  parseMove,
  play: (s, seat, m) => (m.k === 'draw' ? drawOne(s, seat) : m.k === 'pass' ? passTurn(s, seat) : play(s, seat, m.card, m.as, m.call ?? false)),
  pending: (s) => (s.winner !== null ? [] : [s.turn]),
  result: (s) => (s.winner !== null ? { winner: s.winner, forfeit: null } : null),
  view: viewUnown,
  parseView: parseUnown,
  bot: (s, seat, seed) => botMove(viewUnown(s, seat), seat, seed),
}

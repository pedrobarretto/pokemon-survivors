import type { Rng } from '../engine/rng'
import { evolvedFrom, neverEvolves } from '../data/evolutions'
import type { BranchId } from '../data/branches'
import type { PlayableId } from '../data/hatchlings'
import type { PokeType } from '../data/types'
import { runLearnset } from './learnsets'
import { learnable } from './kitRules'
import { MAX_MOVES } from './leveling'
import { isManual, maxMoveLevel, MOVE_IDS, MOVES, type MoveId } from './moves'
import { isTmMove, tmMoveIds } from './tmMoves'
import type { ItemId } from '../data/items'
import { TUTOR_AFFINITY } from '../data/tms'
import type { Offer, OwnedMove, TmOffer } from './types'

/**
 * Pure rules of the TMs (`tms.ts` runs them in a game): moves from outside the
 * learnset, Pokémon style. A TM is a choice between learning its move (Lv 1,
 * or one level up if owned) and passing; with every slot taken, learning asks
 * which move to forget, and "pass" keeps the moves. TMs ignore the learnset
 * (that's the point) but keep the one-manual-move rule.
 */

/**
 * Where a TM came from: a defeated wave boss's own disc, the disc of a TM armed
 * at the Kecleon Shop (any boss may leave it, so it isn't that boss's own), a
 * Move Tutor's lesson or a rift legendary's (gold) disc.
 */
export type TmSource = 'boss' | 'armed' | 'tutor' | 'legendary'

/** ₽ a disc turns into when its move is already mastered. */
export const TM_REFUND = 250

/**
 * The Move Tutor (a map event): when the first and the second tent may show
 * up (run seconds), the ring to stand in and for how long, how many moves it
 * offers and what a lesson costs from the run's ₽ (the first one is free).
 */
export const TUTOR = {
  first: { from: 170, until: 480 },
  second: { from: 330, until: 540 },
  weight: { first: 12, second: 4 },
  radius: 26,
  stand: 0.6,
  offers: 2,
  price: 300,
  lifetime: 75,
} as const

/** What a lesson costs after `lessons` taken this run. */
export const tutorPrice = (lessons: number) => (lessons === 0 ? 0 : TUTOR.price)

/** The director's weight for a tutor, `tutors` met so far at `time` (0: not now). */
export const tutorWeight = (tutors: number, time: number) => {
  const slot = tutors === 0 ? TUTOR.first : tutors === 1 ? TUTOR.second : null
  if (!slot || time < slot.from || time > slot.until) return 0
  return tutors === 0 ? TUTOR.weight.first : TUTOR.weight.second
}

/** The TM card for `id`: Lv 1 for a new move, the next level for an owned one, null when it's mastered. */
export const tmCard = (moves: readonly OwnedMove[], id: MoveId, source: TmSource, price = 0): TmOffer | null => {
  const owned = moves.find((m) => m.id === id)
  if (owned && owned.level >= maxMoveLevel(id)) return null
  return { kind: 'tm', id, level: owned ? owned.level + 1 : 1, source, price }
}

/** The screen a TM opens: a card per move it still teaches, then "pass". Empty when it teaches nothing. */
export const tmChoice = (moves: readonly OwnedMove[], ids: readonly MoveId[], source: TmSource, price = 0): Offer[] => {
  const cards = ids.flatMap((id) => tmCard(moves, id, source, price) ?? [])
  return cards.length > 0 ? [...cards, { kind: 'pass' }] : []
}

/** Whether learning a new `id` needs a move forgotten: every slot is taken, or it'd be a second manual move. */
export const needsForget = (moves: readonly OwnedMove[], id: MoveId) =>
  !moves.some((m) => m.id === id) && (moves.length >= MAX_MOVES || !learnable(moves.map((m) => m.id), id, isManual))

/**
 * Which moves can make room for `tm`: any of them, or only the manual one when
 * the TM's move is manual too (one manual move at a time). Then "pass", which keeps them all.
 */
export const forgetChoice = (moves: readonly OwnedMove[], tm: TmOffer): Offer[] => {
  const clash = isManual(tm.id) && moves.some((m) => isManual(m.id))
  const options = clash ? moves.filter((m) => isManual(m.id)) : moves
  return [...options.map((m): Offer => ({ kind: 'forget', id: m.id, tm })), { kind: 'pass' }]
}

let known: readonly MoveId[] | null = null

/**
 * What a Move Tutor knows: the TM moves and every regular base move. No
 * evolved moves, nor the ones that never evolve by design (signatures only
 * their own Pokémon learn, legendary and duo moves). Built on first use: this
 * module is reached while `MOVES` is still being built.
 */
export const tutorMoves = (): readonly MoveId[] => {
  known ??= MOVE_IDS.filter((id) => isTmMove(id) || (!evolvedFrom(id) && !neverEvolves(id)))
  return known
}

/** What a tutor's pick depends on: the run's family, the types of the form it's in and the moves held. */
export type TutorLoadout = {
  starter: PlayableId
  branch: BranchId | null
  types: readonly PokeType[]
  moves: readonly OwnedMove[]
  banished?: ReadonlySet<MoveId | ItemId>
}

/** The move types a tutor teaches a form: its own types and their `TUTOR_AFFINITY`. */
export const tutorTypes = (types: readonly PokeType[]): ReadonlySet<PokeType> => new Set<PokeType>([...types, ...types.flatMap((t) => TUTOR_AFFINITY[t])])

/**
 * The moves a tutor can teach this player: of a type that suits the form
 * (`tutorTypes`), never one the family learns anyway; not owned (nor evolved
 * from), not forgotten with Esquecer, and learnable next to the moves held
 * (one manual move).
 */
export const tutorPool = ({ starter, branch, types, moves, banished }: TutorLoadout): MoveId[] => {
  const learnset = runLearnset(starter, branch)
  const owned = moves.map((m) => m.id)
  const suits = tutorTypes(types)
  const evolvedBases = new Set(moves.flatMap((m) => evolvedFrom(m.id)?.from ?? []))
  return tutorMoves().filter(
    (id) =>
      suits.has(MOVES[id].type) && !learnset.includes(id) && !owned.includes(id) && !evolvedBases.has(id) && !banished?.has(id) && learnable(owned, id, isManual),
  )
}

/** A TM move weighs this much in a tutor's draw (a base move weighs 1). */
const TM_WEIGHT = 2

/** Up to `count` moves of `pool`, of different types, drawn with the run's rng (TM moves weigh more). */
export const tutorPicks = (pool: readonly MoveId[], rng: Rng, count: number = TUTOR.offers): MoveId[] => {
  const tms: ReadonlySet<MoveId> = new Set<MoveId>(tmMoveIds())
  const left = [...pool]
  const picked: MoveId[] = []
  while (picked.length < count && left.length > 0) {
    const total = left.reduce((s, id) => s + (tms.has(id) ? TM_WEIGHT : 1), 0)
    let roll = rng() * total
    const index = Math.max(0, left.findIndex((id) => (roll -= tms.has(id) ? TM_WEIGHT : 1) <= 0))
    const id = left[index]!
    picked.push(id)
    const type = MOVES[id].type
    for (let i = left.length - 1; i >= 0; i--) if (MOVES[left[i]!].type === type) left.splice(i, 1)
  }
  return picked
}

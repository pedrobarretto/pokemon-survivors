import { retain } from '../engine/math'
import { range } from '../engine/rng'
import { TYPE_COLORS } from '../data/types'
import { BOSS_TMS, LEGENDARY_TMS } from '../data/tms'
import { MYTHICALS } from '../data/waves'
import type { RiftLegend } from '../data/rifts'
import { playerForm } from './branch'
import { dropItem } from './consumables'
import { burst, floatText } from './effects'
import { applyOffer, branchOffers, recomputeStats } from './leveling'
import { forkAt, MOVES, type MoveId } from './moves'
import { forgetChoice, needsForget, TM_REFUND, tmChoice, TUTOR, tutorPicks, tutorPool, tutorPrice, type TmSource } from './tmRules'
import { ownAttack, setPhase } from './players'
import type { Enemy, Game, Offer, Pickup, TmOffer } from './types'

/**
 * TMs in a run: the discs bosses and rift legendaries leave, the Move Tutor's
 * lessons and the screen they open (`Phase` 'tm'). Picks go through
 * `chooseOffer` like a level-up's, so the replay records them as `offer`
 * events: a TM card, a move to forget, or "pass". The pure rules live in
 * `tmRules.ts`, the screen in `ui/tmPick.ts`.
 */

/**
 * A player's TMs: lessons taken from Move Tutors (`lessons`; the tutors met
 * are the run's, `Game.tutors`), whether they learned their legendary TM, the
 * TMs they armed at the Kecleon Shop still waiting for a disc (`armed`,
 * `ReplayStart.tms`), the ₽ coins their Pay Day knocked loose (`coins`) and
 * the foes their Thief already robbed (`stolen`, by id).
 */
export type TmState = { lessons: number; legendary: boolean; armed: MoveId[]; coins: number; stolen: Set<number> }

export const createTmState = (armed: readonly MoveId[] = []): TmState => ({ lessons: 0, legendary: false, armed: [...armed], coins: 0, stolen: new Set() })

/** Puts a TM disc on the ground at (x, y). */
export const dropTm = (g: Game, x: number, y: number, move: MoveId, source: TmSource) => {
  g.pickups.push({ id: g.nextId++, x, y, vx: range(g.rng, -20, 20), vy: range(g.rng, -40, -20), attracted: false, age: 0, kind: 'tm', move, source })
}

/**
 * The armed TMs' hook: the run's first TM discs (a wave boss's) and Move
 * Tutor lessons teach the TMs armed at the shop, in order, one each, instead
 * of what they'd teach. Rift legendaries' gold discs are never swapped. Pure
 * bookkeeping on `TmState.armed`, so the replay re-simulates it.
 */
const takeArmed = (g: Game): MoveId | null => g.player.tm.armed.shift() ?? null

/** A defeated wave boss leaves its TM (`BOSS_TMS`), or the next armed one; a mythical of the finale its legendary TM. */
export const dropBossTm = (g: Game, e: Enemy) => {
  const table: Partial<Record<Enemy['kind'], MoveId>> = BOSS_TMS
  const move = table[e.kind]
  if (move) dropTm(g, e.x - 10, e.y + 2, takeArmed(g) ?? move, 'boss')
  else if (MYTHICALS.some((id) => id === e.kind)) dropLegendaryTm(g, e.kind, e.x - 10, e.y + 2)
}

/**
 * A beaten legendary offers its legendary TM, until every player has learned
 * one. When everyone still missing one already knows this move (a legend
 * played in the Legend mode starts with its own, so its clone teaches
 * nothing) it leaves a Rare Candy instead. Rift arenas call it when won. In
 * co-op it runs as each player (`dropForEach`) and drops for the acting player
 * alone while they still lack one.
 */
export const dropLegendaryTm = (g: Game, legend: RiftLegend | Enemy['kind'], x: number, y: number) => {
  const move = LEGENDARY_TMS[legend]
  const lacking = g.coop === null ? g.players : [g.player]
  if (!move || lacking.every((p) => p.tm.legendary)) return
  if (lacking.every((p) => p.tm.legendary || p.moves.some((m) => m.id === move))) dropItem(g, x, y, 'rareCandy')
  else dropTm(g, x, y, move, 'legendary')
}

/**
 * Opens the TM screen with `ids` to choose from (and "pass"). False when none
 * of them teaches anything new (all mastered): nothing opens.
 */
export const openTm = (g: Game, ids: readonly MoveId[], source: TmSource, price = 0) => {
  const offers = tmChoice(g.player.moves, ids, source, price)
  if (offers.length === 0) return false
  setPhase(g, 'tm')
  g.player.offers = offers
  g.events.push({ kind: 'tm', source })
  return true
}

/** A TM disc touched: its choice opens, or a mastered move's disc turns into ₽. */
export const collectTm = (g: Game, pickup: Extract<Pickup, { kind: 'tm' }>) => {
  if (openTm(g, [pickup.move], pickup.source)) return
  const p = g.player
  const coins = Math.round(TM_REFUND * p.stats.greed)
  g.coins += coins
  floatText(g, p.x, p.y - 30, `₽${coins}`, '#f8d030')
  g.events.push({ kind: 'tmMastered', move: pickup.move, coins })
}

/**
 * A Move Tutor's lesson: two moves of types that suit the player's form, paid
 * from the run's ₽ after the first; an armed TM still waiting takes the first
 * card. False when it has nothing to teach.
 */
export const openTutor = (g: Game) => {
  const p = g.player
  const pool = tutorPool({ starter: p.starter, branch: p.branch, types: playerForm(g).types, moves: p.moves, banished: p.banished })
  const picks = tutorPicks(pool, g.rng)
  const armed = takeArmed(g)
  return openTm(g, armed ? [armed, ...picks.filter((id) => id !== armed)].slice(0, TUTOR.offers) : picks, 'tutor', tutorPrice(p.tm.lessons))
}

/** Takes a move out of the loadout, with what it left on the field and on the player (Whirlpool's aura, a guard, a buff). */
export const forgetMove = (g: Game, id: MoveId) => {
  const p = g.player
  retain(p.moves, (m) => m.id !== id)
  retain(g.attacks, (a) => !ownAttack(g, a) || a.move !== id)
  if (p.guard?.move === id) p.guard = null
  if (p.moveBuffs.some((b) => b.move === id)) {
    retain(p.moveBuffs, (b) => b.move !== id)
    recomputeStats(g)
  }
}

/**
 * Learns (or raises) a TM card's move, paying a tutor's lesson, and celebrates.
 * A move learned anew grows like any other, even one a duo fusion spent or
 * Esquecer forgot earlier in the run: the disc takes it off `banished`.
 */
const learn = (g: Game, tm: TmOffer, forgot: MoveId | null) => {
  const p = g.player
  const owned = p.moves.find((m) => m.id === tm.id)
  if (owned) owned.level = tm.level
  else {
    p.moves.push({ id: tm.id, level: 1, cooldown: 0.3, path: 0 })
    p.banished.delete(tm.id)
  }
  pay(g, tm)
  if (!g.tally.tms.includes(tm.id)) g.tally.tms.push(tm.id)
  // Co-op: each player's own, for their summary (`coopPayout`).
  if (g.coop !== null && !p.record.tally.tms.includes(tm.id)) p.record.tally.tms.push(tm.id)
  celebrate(g, tm, forgot)
}

const pay = (g: Game, tm: TmOffer) => {
  if (tm.source === 'tutor') {
    g.coins -= tm.price
    g.player.tm.lessons++
  }
  if (tm.source === 'legendary') g.player.tm.legendary = true
}

const celebrate = (g: Game, tm: TmOffer, forgot: MoveId | null) => {
  const p = g.player
  const color = TYPE_COLORS[MOVES[tm.id].type]
  burst(g, p.x, p.y - 12, { colors: [color, '#ffffff', tm.source === 'legendary' ? '#f8d030' : '#d8e0f0'], count: 44, speed: 140, ttl: 0.8, size: 2, drag: 3 })
  burst(g, p.x, p.y - 12, { colors: ['#ffffff', color], count: 18, speed: 50, ttl: 1, gravity: -60 })
  g.events.push({ kind: 'tmLearned', move: tm.id, level: tm.level, forgot, source: tm.source })
}

/**
 * A pick on the TM screen. Returns true when the screen is done (the run
 * moves on with `advancePhase`), false when it changed to a next step: the
 * moves to forget, or a fork's two branches. A lesson the player can't pay
 * for is ignored (the screen never offers it).
 */
export const pickTm = (g: Game, offer: Offer): boolean => {
  switch (offer.kind) {
    case 'pass':
      return true
    case 'tm': {
      if (offer.price > g.coins) return false
      const owned = g.player.moves.find((m) => m.id === offer.id)
      if (owned && forkAt(offer.id, offer.level)) {
        // The step up is a fork: its two branches stand in for the card, paid now (they have no "pass").
        pay(g, offer)
        g.player.offers = branchOffers({ kind: 'move', id: offer.id, level: offer.level })
        return false
      }
      if (needsForget(g.player.moves, offer.id)) {
        g.player.offers = forgetChoice(g.player.moves, offer)
        return false
      }
      learn(g, offer, null)
      return true
    }
    case 'branch': {
      applyOffer(g, offer)
      celebrate(g, { kind: 'tm', id: offer.id, level: offer.level, source: 'boss', price: 0 }, null)
      return true
    }
    case 'forget': {
      if (offer.tm.price > g.coins) return false
      forgetMove(g, offer.id)
      learn(g, offer.tm, offer.id)
      return true
    }
    default:
      return false
  }
}

import { retain } from '../engine/math'
import type { Rng } from '../engine/rng'
import { evolvedFrom, readyEvolutions } from '../data/evolutions'
import { ITEM_IDS, ITEMS, type ItemDef, type ItemId } from '../data/items'
import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { MEGAS } from '../data/megas'
import { TYPE_COLORS, type PokeType } from '../data/types'
import { buffDeltas } from './buffs'
import { actAs } from './players'
import { healPlayer } from './combat'
import { burst } from './effects'
import { rankDeltas } from './meta'
import { maxMoveLevel, MOVES, type MoveId } from './moves'
import { stanceStats } from './stance'
import { applyDeltas, BASE_STATS, type StatDelta } from './stats'
import { COOP } from '../data/coop'
import { coopScale } from './coop'
import type { Game, Offer, OwnedItem, OwnedMove, Player } from './types'

export const MAX_MOVES = 6
export const MAX_ITEMS = 6

/** EXP needed to go from `level` to `level + 1`. */
export const xpFor = (level: number) =>
  Math.floor(5 + (level - 1) * 9 + Math.max(0, level - 20) * 6 + Math.max(0, level - 40) * 10)

/**
 * Adds EXP. Solo, times the player's growth. In co-op the team shares one
 * level: every player gets the same EXP, times the team's average growth and
 * split by `COOP.xp`, so everyone levels up together.
 */
export const gainXp = (g: Game, amount: number) => {
  const team = g.coop ? g.players.filter((p) => !p.gone) : [g.player]
  const growth = team.reduce((sum, p) => sum + p.stats.growth, 0) / team.length
  const gained = (amount * growth) / coopScale(g, COOP.xp)
  for (const p of team) {
    p.xp += gained
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext
      p.level++
      p.xpNext = xpFor(p.level)
      p.pendingLevelUps++
    }
  }
}

export type Loadout = { starter: PlayableId; moves: readonly OwnedMove[]; items: readonly OwnedItem[] }

export const loadout = (g: Game): Loadout => ({ starter: g.player.starter, moves: g.player.moves, items: g.player.items })

/** Every upgrade the player could pick right now, with selection weights. */
export const offerPool = ({ starter, moves, items }: Loadout): Array<readonly [Offer, number]> => {
  const ownedMoves = new Map(moves.map((m) => [m.id, m.level]))
  const ownedItems = new Map(items.map((i) => [i.id, i.level]))
  const learnset: readonly MoveId[] = PLAYABLE[starter].learnset
  const learnsetTypes = new Set<PokeType>(learnset.map((id) => MOVES[id].type))
  // A base move whose evolution is already owned must not come back as a new move.
  const evolvedBases = new Set(moves.flatMap((m) => evolvedFrom(m.id)?.from ?? []))

  const moveOffers = learnset.flatMap((id): Array<readonly [Offer, number]> => {
    const level = ownedMoves.get(id)
    if (level === undefined) return moves.length < MAX_MOVES && !evolvedBases.has(id) ? [[{ kind: 'move', id, level: 1 }, 1]] : []
    return level < maxMoveLevel(id) ? [[{ kind: 'move', id, level: level + 1 }, 1.3]] : []
  })

  const itemOffers = ITEM_IDS.flatMap((id: ItemId): Array<readonly [Offer, number]> => {
    const level = ownedItems.get(id)
    const def: ItemDef = ITEMS[id]
    if (level === undefined && def.boosts && !learnsetTypes.has(def.boosts)) return []
    if (level === undefined) return items.length < MAX_ITEMS ? [[{ kind: 'item', id, level: 1 }, 0.8]] : []
    return level < ITEMS[id].levels.length ? [[{ kind: 'item', id, level: level + 1 }, 1]] : []
  })

  return [...moveOffers, ...itemOffers]
}

/**
 * Ready move evolutions come first, then weighted sampling without replacement.
 * Falls back to a healing berry when maxed out.
 */
export const rollOffers = (loadout: Loadout, rng: Rng, count = 3): Offer[] => {
  const pool = [...offerPool(loadout)]
  const picked: Offer[] = readyEvolutions(loadout)
    .slice(0, count)
    .map(({ from, to }) => ({ kind: 'evolution', from, to }))
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((s, [, w]) => s + w, 0)
    let roll = rng() * total
    const index = Math.max(0, pool.findIndex(([, w]) => (roll -= w) <= 0))
    picked.push(pool[index]![0])
    pool.splice(index, 1)
  }
  return picked.length > 0 ? picked : [{ kind: 'berry' }]
}

/** Stat deltas a playable Pokémon has at an evolution stage, before held items. */
const starterDeltas = (id: PlayableId, stage: number): StatDelta[] => {
  const starter = PLAYABLE[id]
  return [starter.stats, ...starter.line.slice(0, stage + 1).map((s) => s.bonus)]
}

/** Player stats of a playable Pokémon at an evolution stage, without items (used by the inspect panel). */
export const starterStats = (id: PlayableId, stage: number) => applyDeltas(BASE_STATS, starterDeltas(id, stage))

/** Rebuilds player stats from starter, Poké Mart ranks, evolution stage, held items, buffs, the Mega form and Aegislash's stance. */
export const recomputeStats = (g: Game) => {
  const p = g.player
  const before = p.stats.maxHp
  const deltas = applyDeltas(BASE_STATS, [
    ...starterDeltas(g.player.starter, p.stage),
    ...rankDeltas(g.player.ranks),
    ...p.items.flatMap((i) => ITEMS[i.id].levels.slice(0, i.level)),
    ...buffDeltas(g.buffs),
    ...(g.player.mega.active > 0 && g.player.mega.stone ? [MEGAS[g.player.mega.stone].stats] : []),
  ])
  p.stats = stanceStats(deltas, g.player.special.stance)
  if (p.stats.maxHp > before) p.hp += p.stats.maxHp - before
  p.hp = Math.min(p.hp, p.stats.maxHp)
}

/** Rebuilds every player's stats (a team buff started or ran out). */
export const recomputeTeam = (g: Game) => {
  for (const p of g.players) actAs(g, p, () => recomputeStats(g))
}

export const applyOffer = (g: Game, offer: Offer) => {
  const p = g.player
  switch (offer.kind) {
    case 'move': {
      const owned = p.moves.find((m) => m.id === offer.id)
      if (owned) owned.level = offer.level
      else p.moves.push({ id: offer.id, level: 1, cooldown: 0.2 })
      break
    }
    case 'item': {
      const owned = p.items.find((i) => i.id === offer.id)
      if (owned) owned.level = offer.level
      else p.items.push({ id: offer.id, level: 1 })
      recomputeStats(g)
      break
    }
    case 'berry':
      healPlayer(g, 40)
      g.events.push({ kind: 'heal' })
      break
    case 'evolution':
      evolveMove(g, offer.from, offer.to)
      break
  }
}

/** Swaps a move for its evolved form in the same slot, with a celebratory burst. */
const evolveMove = (g: Game, from: MoveId, to: MoveId) => {
  const p = g.player
  const owned = p.moves.find((m) => m.id === from)
  if (!owned) return
  owned.id = to
  owned.level = 1
  owned.cooldown = 0.3
  // Drop lingering hitboxes of the old move (e.g. Whirlpool's permanent aura).
  retain(g.attacks, (a) => a.move !== from || a.owner !== p)
  const colors = [TYPE_COLORS[MOVES[to].type], '#ffffff', '#ffd830']
  burst(g, p.x, p.y - 10, { colors, count: 70, speed: 170, ttl: 0.9, size: 2, drag: 3 })
  burst(g, p.x, p.y - 10, { colors: ['#ffffff', '#fff8c0'], count: 30, speed: 60, ttl: 1.2, gravity: -50 })
  g.shake = Math.max(g.shake, 5)
  g.events.push({ kind: 'moveEvolved', from, to })
}

/** A player's next evolution (the acting player's by default), if their level has reached it. */
export const pendingEvolution = (g: Game, p: Player = g.player) => {
  const line = PLAYABLE[p.starter].line
  const stage = line[p.stage]
  const next = line[p.stage + 1]
  return stage && next && 'evolveAt' in stage && p.level >= stage.evolveAt ? { from: stage.dex, to: next.dex } : null
}

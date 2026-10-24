import { retain } from '../engine/math'
import type { Rng } from '../engine/rng'
import { evolvedFrom, readyEvolutions } from '../data/evolutions'
import { ITEM_IDS, ITEMS, type ItemDef, type ItemId } from '../data/items'
import type { BranchId } from '../data/branches'
import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { MEGAS } from '../data/megas'
import { TYPE_COLORS, type PokeType } from '../data/types'
import { abilityDeltas } from './abilities'
import { formAt } from './branch'
import { FRESH_WEIGHT, runLearnset, unlockedAt } from './learnsets'
import { buffDeltas } from './buffs'
import { wingDeltas } from './place'
import { CURSES, type CurseId } from '../data/curses'
import { legendSignature } from '../data/legends'
import { blocksNewMoves } from './curses'
import { readyDuos } from './duoRules'
import { healPlayer } from './combat'
import { burst, shakeScreen } from './effects'
import { rankDeltas } from './meta'
import { learnable } from './kitRules'
import { forkAt, isManual, maxMoveLevel, MOVES, withBranch, type MoveId } from './moves'
import { stanceStats } from './stance'
import { awakeningDeltas } from './legend'
import { applyDeltas, BASE_STATS, boostStats, type StatDelta } from './stats'
import { bagDeltas } from './bag'
import { BAG_ITEMS } from '../data/shop'
import { ownAttack, setPhase } from './players'
import type { Game, Offer, OwnedItem, OwnedMove, PrizeSource, Rarity } from './types'

export const MAX_MOVES = 6
export const MAX_ITEMS = 6
/** Selection weight of a level-up for a move already owned (new moves weigh 1, new items 0.8). */
const UPGRADE_WEIGHT = 1.3

/** EXP needed to go from `level` to `level + 1`. */
export const xpFor = (level: number) =>
  Math.floor(5 + (level - 1) * 9 + Math.max(0, level - 20) * 6 + Math.max(0, level - 40) * 10)

export const gainXp = (g: Game, amount: number, growth = g.player.stats.growth) => {
  const p = g.player
  p.xp += amount * growth
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext
    p.level++
    p.xpNext = xpFor(p.level)
    g.player.pendingLevelUps++
  }
}

/**
 * What the level-up offers depend on. `stage`: how far the line evolved,
 * which unlocks its stages' moves (every stage when left out). `branch`: where
 * a branching evolution went, which adds its moves to the learnset. `fresh`:
 * whether the moves the last evolution unlocked still weigh double.
 * `banished`: moves and items forgotten this run (Esquecer) or fused into a
 * duo move, never offered again. `curses`: the cursed items held (Choice Band
 * stops new moves).
 */
export type Loadout = {
  starter: PlayableId
  moves: readonly OwnedMove[]
  items: readonly OwnedItem[]
  stage?: number
  branch?: BranchId | null
  fresh?: boolean
  banished?: ReadonlySet<MoveId | ItemId>
  curses?: readonly CurseId[]
}

export const loadout = (g: Game): Loadout => ({
  starter: g.player.starter,
  moves: g.player.moves,
  items: g.player.items,
  stage: g.player.stage,
  branch: g.player.branch,
  fresh: g.player.freshMoves > 0,
  banished: g.player.banished,
  curses: g.player.curses.held,
})

/** Every upgrade the player could pick right now, with selection weights. */
export const offerPool = ({ starter, moves, items, stage, branch = null, fresh, banished, curses }: Loadout): Array<readonly [Offer, number]> => {
  const ownedMoves = new Map(moves.map((m) => [m.id, m.level]))
  const ownedItems = new Map(items.map((i) => [i.id, i.level]))
  const learnset = runLearnset(starter, branch, stage)
  // Type items follow the whole line, so a Charcoal can wait for the fire moves an evolution brings.
  const learnsetTypes = new Set<PokeType>(runLearnset(starter, branch).map((id) => MOVES[id].type))
  const unlocked = fresh && stage !== undefined ? unlockedAt(starter, branch, stage) : []
  // A base move whose evolution is already owned must not come back as a new move.
  const evolvedBases = new Set(moves.flatMap((m) => evolvedFrom(m.id)?.from ?? []))
  const ownedIds = moves.map((m) => m.id)

  const moveOffers = learnset.flatMap((id): Array<readonly [Offer, number]> => {
    if (banished?.has(id)) return []
    const level = ownedMoves.get(id)
    if (level === undefined)
      return moves.length < MAX_MOVES && !blocksNewMoves(curses) && !evolvedBases.has(id) && learnable(ownedIds, id, isManual)
        ? [[{ kind: 'move', id, level: 1 }, unlocked.includes(id) ? FRESH_WEIGHT : 1]]
        : []
    return level < maxMoveLevel(id) ? [[{ kind: 'move', id, level: level + 1 }, UPGRADE_WEIGHT]] : []
  })
  // Owned moves from outside the learnset (evolved ones) keep growing in the slot they took.
  const grownOffers = moves.flatMap((m): Array<readonly [Offer, number]> =>
    !learnset.includes(m.id) && !banished?.has(m.id) && m.level < maxMoveLevel(m.id) ? [[{ kind: 'move', id: m.id, level: m.level + 1 }, UPGRADE_WEIGHT]] : [],
  )

  const itemOffers = ITEM_IDS.flatMap((id: ItemId): Array<readonly [Offer, number]> => {
    if (banished?.has(id)) return []
    const level = ownedItems.get(id)
    const def: ItemDef = ITEMS[id]
    if (level === undefined && def.boosts && !learnsetTypes.has(def.boosts)) return []
    if (level === undefined) return items.length < MAX_ITEMS ? [[{ kind: 'item', id, level: 1 }, 0.8]] : []
    return level < ITEMS[id].levels.length ? [[{ kind: 'item', id, level: level + 1 }, 1]] : []
  })

  return [...moveOffers, ...grownOffers, ...itemOffers]
}

/** Odds of a level-up card coming out rare (two levels at once) or shiny (a free pick); the Shiny Charm doubles the shiny ones. */
export const OFFER_RARITY = { rare: 0.1, shiny: 1 / 64 } as const

/** Shiny card odds for a run with `shinyCharm` ranks. */
export const shinyOfferOdds = (shinyCharm: number) => OFFER_RARITY.shiny * (shinyCharm > 0 ? 2 : 1)

export type RollOptions = {
  /** Roll each card's rarity, with these shiny odds; without it every card is common (the Poké Ball, the opening draft). */
  shiny?: number
  /** Extra odds of a rare card on top of `OFFER_RARITY.rare` (a lucky ability). */
  rare?: number
  /** Leave out upgrades that land on a fork: the Poké Ball picks on its own, and a fork is the player's call. */
  forks?: boolean
  /** Leave out duo fusions (`duoRules.ts`): the Poké Ball picks on its own, and fusing two moves is the player's call. */
  duos?: boolean
  /** Cards already on the table (a slot drawn again): their moves, items and evolutions aren't drawn twice. */
  shown?: readonly Offer[]
}

/** The move or item a card is about, if any (berries and evolutions have none to forget). */
export const offerSubject = (offer: Offer): MoveId | ItemId | null =>
  offer.kind === 'duo' ? offer.to :
  offer.kind === 'move' || offer.kind === 'item' || offer.kind === 'branch' ? offer.id : null

/** The level a card would take its move or item to if it came out rare, or null when it can't. */
const rareLevel = (offer: Offer) => {
  if (offer.kind === 'item') return offer.level + 1 <= ITEMS[offer.id].levels.length ? offer.level + 1 : null
  if (offer.kind !== 'move') return null
  // Two levels at once, but never through a fork: that one is the player's pick.
  const next = offer.level + 1
  return next <= maxMoveLevel(offer.id) && !forkAt(offer.id, offer.level) && !forkAt(offer.id, next) ? next : null
}

/** A card's rarity, from one roll in [0, 1): shiny, then rare (`OFFER_RARITY.rare` plus `rare`), else common. Only moves and items can be lucky. */
export const withRarity = (offer: Offer, roll: number, shinyOdds: number, rare = 0): Offer => {
  if (offer.kind !== 'move' && offer.kind !== 'item') return offer
  if (roll < shinyOdds) return { ...offer, rarity: 'shiny' }
  const level = roll < shinyOdds + OFFER_RARITY.rare + rare ? rareLevel(offer) : null
  return level === null ? offer : { ...offer, level, rarity: 'rare' }
}

/**
 * A prize level-up opens at once (an Alpha's gem, a field mission): every card
 * that can be rare is (two levels; never a fork, that one is the player's
 * call) and, with `shinyFirst`, the first card is shiny (a free pick).
 */
export const openPrizeLevelUp = (g: Game, source: PrizeSource, shinyFirst = false) => {
  g.player.offers = rollOffers(loadout(g), g.rng, 3, { forks: false }).map((o, i) => withRarity(o, 0, shinyFirst && i === 0 ? 1 : 0))
  g.player.pendingLevelUps++
  setPhase(g, 'levelup')
  g.player.prize = source
  g.events.push({ kind: 'levelup' })
}

/**
 * Ready move evolutions come first, then ready duo fusions, then weighted sampling without replacement,
 * then each card's rarity (one roll per card, in order, so replays agree).
 * Falls back to a healing berry when maxed out.
 */
export const rollOffers = (loadout: Loadout, rng: Rng, count = 3, opts: RollOptions = {}): Offer[] => {
  const shown = opts.shown ?? []
  const taken = new Set(shown.map((o) => (o.kind === 'evolution' ? o.to : offerSubject(o))))
  const duos: Offer[] = opts.duos === false ? [] : readyDuos(loadout.moves, legendSignature(loadout.starter), loadout.banished).filter(({ to }) => !taken.has(to)).map(({ from, to }) => ({ kind: 'duo', from, to }))
  const pool = offerPool(loadout).filter(([o]) => !taken.has(offerSubject(o)) && (opts.forks !== false || o.kind !== 'move' || !forkAt(o.id, o.level)))
  const evolutions: Offer[] = readyEvolutions(loadout)
    .filter(({ to }) => !taken.has(to))
    .map(({ from, to }) => ({ kind: 'evolution', from, to }))
  const picked: Offer[] = [...evolutions, ...duos].slice(0, count)
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((s, [, w]) => s + w, 0)
    let roll = rng() * total
    const index = Math.max(0, pool.findIndex(([, w]) => (roll -= w) <= 0))
    picked.push(pool[index]![0])
    pool.splice(index, 1)
  }
  const shinyOdds = opts.shiny
  const offers = shinyOdds === undefined ? picked : picked.map((o) => withRarity(o, rng(), shinyOdds, opts.rare))
  return offers.length > 0 ? offers : [{ kind: 'berry' }]
}

/**
 * The opening draft: up to `count` moves of the first stage's list the player
 * doesn't have yet (and hasn't forgotten), drawn evenly, to pick the second move.
 */
export const draftOffers = ({ starter, moves, banished }: Loadout, rng: Rng, count = 3): Offer[] => {
  const owned = new Set(moves.map((m) => m.id))
  const pool = PLAYABLE[starter].learnset[0].filter((id) => !owned.has(id) && !banished?.has(id))
  const picked: Offer[] = []
  while (picked.length < count && pool.length > 0) {
    const [id] = pool.splice(Math.floor(rng() * pool.length), 1)
    picked.push({ kind: 'move', id: id!, level: 1 })
  }
  return picked.length > 0 ? picked : [{ kind: 'berry' }]
}

/** Whether a level-up has nothing to choose: every card is the Oran Berry (moves and items all maxed out). */
export const nothingToChoose = (offers: readonly Offer[]) => offers.length > 0 && offers.every((o) => o.kind === 'berry')

/** The two cards of a fork, standing in for the move card that reached it (its rarity carries over). */
export const branchOffers = (offer: Extract<Offer, { kind: 'move' }>): Offer[] =>
  ([0, 1] as const).map((branch) => ({ kind: 'branch', id: offer.id, level: offer.level, branch, ...(offer.rarity && { rarity: offer.rarity }) }))

/** Whether a card is a rare or shiny one. */
export const rarityOf = (offer: Offer): Rarity | null => ('rarity' in offer && offer.rarity) || null

/** Stat deltas a playable Pokémon has at an evolution stage (along a branch, when it took one), before held items. */
const starterDeltas = (id: PlayableId, stage: number, branch: BranchId | null = null): StatDelta[] => [
  PLAYABLE[id].stats,
  ...PLAYABLE[id].line.slice(0, stage + 1).map((_, i) => formAt(id, branch, i).bonus),
]

/** Player stats of a playable Pokémon at an evolution stage, without items (used by the inspect panel). */
export const starterStats = (id: PlayableId, stage: number, branch: BranchId | null = null) => applyDeltas(BASE_STATS, starterDeltas(id, stage, branch))

/**
 * Rebuilds player stats from starter (and branch), a legend's awakenings, Poké Mart ranks, evolution stage,
 * held items, buffs, the ability, the Mega form, cursed items and the stance (Aegislash, Deoxys).
 */
export const recomputeStats = (g: Game) => {
  const p = g.player
  const before = p.stats.maxHp
  const deltas = applyDeltas(BASE_STATS, [
    ...starterDeltas(p.starter, p.stage, p.branch),
    ...(p.legend ? awakeningDeltas(p.legend.id, p.legend.awakened) : []),
    ...rankDeltas(p.ranks),
    ...p.items.flatMap((i) => ITEMS[i.id].levels.slice(0, i.level)),
    ...buffDeltas(p.buffs),
    ...wingDeltas(p.wings),
    ...g.player.moveBuffs.map((b) => b.stats),
    ...abilityDeltas(g, MAX_ITEMS - p.items.length),
    ...(p.mega.active > 0 && p.mega.stone ? [MEGAS[p.mega.stone].stats] : []),
    ...p.curses.held.map((id) => CURSES[id].stats),
    ...bagDeltas(p.bag),
  ])
  // A held evolution (no item for any branch yet) is as strong as with an Everstone.
  p.stats = boostStats(stanceStats(deltas, p.special.stance), p.boost + (p.evoHeld ? BAG_ITEMS.everstone.effect.everstone : 0))
  if (p.stats.maxHp > before) p.hp += p.stats.maxHp - before
  p.hp = Math.min(p.hp, p.stats.maxHp)
}

export const applyOffer = (g: Game, offer: Offer) => {
  const p = g.player
  switch (offer.kind) {
    case 'move': {
      const owned = p.moves.find((m) => m.id === offer.id)
      if (owned) owned.level = offer.level
      else p.moves.push({ id: offer.id, level: offer.level, cooldown: 0.2, path: 0 })
      break
    }
    case 'branch': {
      const owned = p.moves.find((m) => m.id === offer.id)
      if (!owned) break
      owned.level = offer.level
      owned.path = withBranch(owned.path ?? 0, offer.level, offer.branch)
      break
    }
    case 'item': {
      const owned = p.items.find((i) => i.id === offer.id)
      if (owned) owned.level = offer.level
      else p.items.push({ id: offer.id, level: offer.level })
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
    case 'duo':
      fuseMoves(g, offer.from, offer.to)
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
  // The evolved move's upgrades are its own: the old forks' path doesn't apply.
  owned.path = 0
  owned.echo = 0
  // Drop lingering hitboxes of the old move (e.g. Whirlpool's permanent aura).
  retain(g.attacks, (a) => !ownAttack(g, a) || a.move !== from)
  const colors = [TYPE_COLORS[MOVES[to].type], '#ffffff', '#ffd830']
  burst(g, p.x, p.y - 10, { colors, count: 70, speed: 170, ttl: 0.9, size: 2, drag: 3 })
  burst(g, p.x, p.y - 10, { colors: ['#ffffff', '#fff8c0'], count: 30, speed: 60, ttl: 1.2, gravity: -50 })
  shakeScreen(g, 5)
  g.events.push({ kind: 'moveEvolved', from, to })
}

/**
 * Fuses two moves into a duo move: the first one's slot takes it at Lv1, the
 * second's frees up. Both (and the base moves of evolved ones) never come back
 * as offers. A two-colored burst and a white flash mark it.
 */
const fuseMoves = (g: Game, from: readonly [MoveId, MoveId], to: MoveId) => {
  const p = g.player
  const slot = p.moves.find((m) => m.id === from[0])
  if (!slot || !p.moves.some((m) => m.id === from[1])) return
  Object.assign(slot, { id: to, level: 1, cooldown: 0.4, path: 0, echo: 0, stacks: 0 })
  retain(p.moves, (m) => m.id !== from[1])
  for (const id of from) {
    g.player.banished.add(id)
    const base = evolvedFrom(id)?.from
    if (base) g.player.banished.add(base)
  }
  // Their lingering hitboxes, timed effects and windows go with them.
  retain(g.attacks, (a) => !ownAttack(g, a) || (a.move !== from[0] && a.move !== from[1]))
  retain(p.moveBuffs, (b) => b.move !== from[0] && b.move !== from[1])
  if (p.guard && from.includes(p.guard.move)) p.guard = null
  recomputeStats(g)
  const [a, b] = from.map((id) => TYPE_COLORS[MOVES[id].type])
  burst(g, p.x - 6, p.y - 10, { colors: [a!, '#ffffff'], count: 50, speed: 160, ttl: 0.9, size: 2, drag: 3 })
  burst(g, p.x + 6, p.y - 10, { colors: [b!, '#ffffff'], count: 50, speed: 160, ttl: 0.9, size: 2, drag: 3 })
  burst(g, p.x, p.y - 10, { colors: ['#ffffff', '#fff8c0', '#ffd830'], count: 40, speed: 70, ttl: 1.3, gravity: -50 })
  shakeScreen(g, 6)
  g.flash = Math.max(g.flash, 0.5)
  g.events.push({ kind: 'duoFused', from, to })
}

/** The next evolution, if the player's level has reached it (into the branch picked, for a branching one; `advancePhase` asks where, or holds it without items). */
export const pendingEvolution = (g: Game) => {
  const p = g.player
  // An Everstone holds the Pokémon in its first form.
  if (p.everstone || p.stage + 1 >= PLAYABLE[p.starter].line.length) return null
  const stage = formAt(p.starter, p.branch, p.stage)
  const next = formAt(p.starter, p.branch, p.stage + 1)
  return stage.evolveAt !== undefined && p.level >= stage.evolveAt ? { from: stage.dex, to: next.dex } : null
}

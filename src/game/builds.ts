import { ABILITY_IDS, type AbilityId } from '../data/abilities'
import { BRANCHES, isBranch, type BranchId } from '../data/branches'
import { evolvedFrom } from '../data/evolutions'
import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { ITEMS, type ItemId } from '../data/items'
import { MAX_ITEMS, MAX_MOVES } from './leveling'
import { branchAt, maxMoveLevel, MOVES, type MoveId } from './moves'
import { isRecord, wholeNumber } from './parse'
import { isPlayable } from './ranking'
import type { Offer, Player } from './types'

/**
 * Builds planned at the Dojo (`game/training.ts`): per Pokémon family, the
 * moves (with their level and the branch taken at each fork), the held
 * items, the ability and the form it was tried in. They never change a run:
 * the level-up screen only marks the cards that follow the plan (`planned`).
 */

export type BuildMove = { id: MoveId; level: number; path: number }
export type BuildItem = { id: ItemId; level: number }

export type Build = {
  moves: readonly BuildMove[]
  items: readonly BuildItem[]
  ability: AbilityId | null
  /** The stage the build was tried at, and the branch when the family branches there. */
  stage: number
  branch: BranchId | null
}

/** The save's builds, one per family. Synced whole, the newer device's winning per family (`mergeSaves`). */
export type Builds = Partial<Record<PlayableId, Build>>

/** What the player carries now, as a build of their family. */
export const buildOf = (p: Player): Build => ({
  moves: p.moves.map((m) => ({ id: m.id, level: m.level, path: m.path ?? 0 })),
  items: p.items.map((i) => ({ id: i.id, level: i.level })),
  ability: p.ability.id,
  stage: p.stage,
  branch: p.branch,
})

/** Whether a build holds nothing worth marking. */
export const emptyBuild = (b: Build) => b.moves.length === 0 && b.items.length === 0 && b.ability === null && b.branch === null

/** The level a build plans for a move (an evolved move counts its base at max level), or 0. */
const plannedLevel = (b: Build, id: MoveId) => {
  for (const m of b.moves) {
    if (m.id === id) return m.level
    if (evolvedFrom(m.id)?.from === id) return maxMoveLevel(id)
  }
  return 0
}

/**
 * Whether a level-up (or TM, ability, form) card follows the build: a move or
 * item up to its planned level, a fork's planned branch, the planned move
 * evolution, duo move, ability or form.
 */
export const planned = (b: Build | undefined, offer: Offer): boolean => {
  if (!b) return false
  switch (offer.kind) {
    case 'move':
    case 'tm':
      return offer.level <= plannedLevel(b, offer.id)
    case 'branch': {
      const m = b.moves.find((x) => x.id === offer.id)
      return m !== undefined && offer.level <= m.level && branchAt(m.path, offer.level - 2) === offer.branch
    }
    case 'item':
      return b.items.some((i) => i.id === offer.id && offer.level <= i.level)
    case 'evolution':
    case 'duo':
      return b.moves.some((m) => m.id === offer.to)
    case 'ability':
      return b.ability === offer.id
    case 'form':
      return b.branch === offer.id
    default:
      return false
  }
}

/* ---------------- Save ---------------- */

const parseMoves = (raw: unknown): BuildMove[] => {
  if (!Array.isArray(raw)) return []
  const out: BuildMove[] = []
  for (const m of raw) {
    if (!isRecord(m) || typeof m.id !== 'string' || !Object.hasOwn(MOVES, m.id) || out.some((o) => o.id === m.id)) continue
    const id = m.id as MoveId
    out.push({ id, level: Math.max(1, wholeNumber(m.level, maxMoveLevel(id))), path: wholeNumber(m.path, 255) })
  }
  return out.slice(0, MAX_MOVES)
}

const parseItems = (raw: unknown): BuildItem[] => {
  if (!Array.isArray(raw)) return []
  const out: BuildItem[] = []
  for (const i of raw) {
    if (!isRecord(i) || typeof i.id !== 'string' || !Object.hasOwn(ITEMS, i.id) || out.some((o) => o.id === i.id)) continue
    const id = i.id as ItemId
    out.push({ id, level: Math.max(1, wholeNumber(i.level, ITEMS[id].levels.length)) })
  }
  return out.slice(0, MAX_ITEMS)
}

/** A saved build of `family`, or null when it isn't one; a branch of another family is dropped. */
const parseBuild = (family: PlayableId, raw: unknown): Build | null => {
  if (!isRecord(raw)) return null
  const ability = ABILITY_IDS.find((id) => id === raw.ability) ?? null
  const branch = isBranch(raw.branch) && BRANCHES[raw.branch].line === family ? raw.branch : null
  return { moves: parseMoves(raw.moves), items: parseItems(raw.items), ability, stage: wholeNumber(raw.stage, PLAYABLE[family].line.length - 1), branch }
}

/** Saved builds, keeping only real families and what parses. */
export const parseBuilds = (raw: unknown): Builds => {
  if (!isRecord(raw)) return {}
  const out: Builds = {}
  for (const [id, b] of Object.entries(raw)) {
    if (!isPlayable(id)) continue
    const build = parseBuild(id, b)
    if (build) out[id] = build
  }
  return out
}

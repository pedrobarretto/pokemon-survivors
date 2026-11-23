import { evolutionOf } from '../data/evolutions'
import type { ItemId } from '../data/items'
import { burst } from './effects'
import { MAX_ITEMS, recomputeStats } from './leveling'
import { maxMoveLevel } from './moves'
import { actAs } from './players'
import type { Game, Offer, OwnedItem, OwnedMove, Player } from './types'

/**
 * Largar item: a player lets go of a held item mid-run, from the pause menu
 * or to swap it for the one a level-up card or a Poké Ball brings when every
 * slot is taken. No refund: the item and its levels are gone, and the slot is
 * free. The shell records it (`drop` in `replay.ts`, a `drop` tick entry in
 * co-op) and the Dojo drops through `setItem` instead.
 */

/**
 * Level-ups a dropped item sits out of the offers: the slot it frees is for
 * something new, so the next cards don't hand the same item straight back
 * (it would be the likeliest card, and a wasted pick). Later it comes again from Lv 1.
 */
export const DROP_REST = 5

/** The items a player dropped that the offers still leave out (`DROP_REST`). */
export const restingItems = (p: Pick<Player, 'dropped' | 'level'>): ItemId[] => p.dropped.flatMap((d) => (d.until > p.level ? [d.id] : []))

/**
 * Items a full build may still be offered, as a swap: the paired item of a
 * base move it holds at max level (`EVOLUTIONS`), so a move evolution is never
 * out of reach because the slots filled first.
 */
export const swapItems = (moves: readonly OwnedMove[], items: readonly OwnedItem[]): ItemId[] =>
  items.length < MAX_ITEMS ? [] : moves.flatMap((m) => {
    const item = evolutionOf(m.id)?.item
    return item && m.level >= maxMoveLevel(m.id) && !items.some((i) => i.id === item) ? [item] : []
  })

/** Whether taking `offer` needs an item dropped first: a new item with every slot taken. */
export const needsSwap = (p: { items: readonly OwnedItem[] }, offer: Offer | undefined) =>
  offer?.kind === 'item' && p.items.length >= MAX_ITEMS && !p.items.some((i) => i.id === offer.id)

/** Keeps `id` out of the offers for `DROP_REST` level-ups from now. */
const rest = (p: Player, id: ItemId) => {
  const held = p.dropped.find((d) => d.id === id)
  if (held) held.until = p.level + DROP_REST
  else p.dropped.push({ id, until: p.level + DROP_REST })
}

/**
 * A pick screen closed with swap cards on it that weren't taken (a level-up's
 * other card, a Poké Ball left): those items rest like a dropped one, so a
 * full build that keeps its items isn't asked again every level.
 */
export const restTurnedDown = (p: Player, offers: readonly Offer[], picked: Offer) => {
  for (const o of offers) if (o !== picked && o.kind === 'item' && needsSwap(p, o)) rest(p, o.id)
}

/**
 * Drops the player's held item at `index`: it leaves the build (stats follow
 * at once) and sits out the offers for `DROP_REST` level-ups. Not in an Arena
 * match (its kit holds no items), nor for a player who left.
 */
export const dropItem = (g: Game, index: number, p: Player = g.player) => {
  const item = p.items[index]
  if (!item || p.gone || p.versus) return
  const before = actAs(g, p)
  p.items.splice(index, 1)
  rest(p, item.id)
  recomputeStats(g)
  burst(g, p.x, p.y - 10, { colors: ['#a8a8b8', '#ffffff', '#686878'], count: 14, speed: 70, ttl: 0.45, gravity: 120 })
  g.events.push({ kind: 'itemDropped', id: item.id })
  actAs(g, before)
}

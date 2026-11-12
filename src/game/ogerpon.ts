import { OGERPON_MASK_IDS, OGERPON_MASKS, maskOf, type OgerponMask } from '../data/mythicals'
import { TERA } from '../data/tera'
import type { LegendForm } from '../data/legends'
import type { PokeType } from '../data/types'
import { pick } from '../engine/rng'
import { burst, floatText } from './effects'
import type { Game, Player } from './types'

/**
 * Ogerpon in the Legend mode (`data/mythicals.ts`): Terastal is its kit. Its
 * mask is the run's Tera type among its four (it starts in the Teal Mask,
 * Grass), a boss's shards offer it two other masks instead of the usual pair,
 * and a shard of any other type leaves its mask alone. Its types follow the
 * mask (`legendStage`), and so does Ivy Cudgel's (`legendaryMoves4.ts`).
 * Terastallizing is its Embody Aspect: the mask's crystal sheets, the mask's
 * stat (`OGERPON_MASKS[mask].embody`) while it lasts, and Ivy Cudgel's slams
 * bursting in the mask's element.
 */

/** Whether a player plays Ogerpon. */
export const playsOgerpon = (p: Pick<Player, 'legend'>) => p.legend?.id === 'ogerpon'

/** The mask a player's Ogerpon wears now: the type it Terastallized into while it lasts, else the run's Tera type's. */
export const ogerponMask = (p: Pick<Player, 'tera'>): OgerponMask => maskOf(p.tera.form ?? p.tera.type)

/** The sheets a player's Ogerpon wears: its mask's, Terastallized while the crystal holds. Undefined for the Teal Mask's own. */
export const ogerponLook = (p: Pick<Player, 'tera'>): LegendForm | undefined => {
  const def = OGERPON_MASKS[ogerponMask(p)]
  if (p.tera.active > 0) return def.tera
  return def.form ?? undefined
}

/** Ogerpon's types with a mask: Grass, and the mask's own type (the Teal Mask's is Grass alone). */
export const maskTypes = (mask: OgerponMask): readonly PokeType[] => (mask === 'teal' ? ['grass'] : ['grass', OGERPON_MASKS[mask].type])

/**
 * The acting player's Ogerpon Terastallized: its Embody Aspect raises the
 * mask's stat for as long as the crystal holds (a timed effect on Ivy Cudgel's
 * slot, folded into the stats like any move's).
 */
export const embodyAspect = (g: Game) => {
  const p = g.player
  const mask = ogerponMask(p)
  const def = OGERPON_MASKS[mask]
  const i = p.moveBuffs.findIndex((b) => b.move === 'ivyCudgel')
  if (i >= 0) p.moveBuffs.splice(i, 1)
  p.moveBuffs.push({ move: 'ivyCudgel', left: TERA.duration, stats: def.embody, applied: false })
  burst(g, p.x, p.y - 14, { colors: [...def.colors, '#ffffff'], count: 36, speed: 130, ttl: 0.7, size: 2, gravity: -20 })
  floatText(g, p.x, p.y - 38, '✦', def.colors[1])
  g.events.push({ kind: 'embodyAspect', mask })
}

/**
 * A boss fell and the acting player plays Ogerpon: its choice of two shards
 * is two masks it doesn't wear, drawn from the run's rng (only Ogerpon's runs
 * draw it). `drop` places one.
 */
export const maskShards = (g: Game, drop: (type: PokeType, side: -1 | 1) => void) => {
  const now = ogerponMask(g.player)
  const others = OGERPON_MASK_IDS.filter((m) => m !== now)
  const first = pick(g.rng, others)
  const second = pick(g.rng, others.filter((m) => m !== first))
  drop(OGERPON_MASKS[first].type, -1)
  drop(OGERPON_MASKS[second].type, 1)
}

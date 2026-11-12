import type { PlayableId } from '../data/hatchlings'
import type { StatDelta } from './stats'

/**
 * Pure numbers and rules of the Grande Atualização's Mega families
 * (`data/gaMegaFamiliesA.ts`: Kangaskhan, Pinsir, Skarmory, Drilbur and
 * Drampa, each brought in for its Mega). `gaKitMASystem.ts` runs them on
 * `Player.kitMA`; nothing here touches the game, so each rule is tested on its
 * own (`gaKitMARules.test.ts`). As in the other batches every bonus is capped
 * and every clock is fixed (the cooldown stat never shrinks one). Kangaskhan,
 * Pinsir, Skarmory and Drampa are one stage: their mechanics grow with the
 * level instead of an evolution.
 */
export const KIT_MA = {
  /**
   * Kangaskhan's baby (Parental Bond): when its mother lands a hit the baby hops out of the pouch onto that
   * foe and punches it for `share` of the hit, growing up with the level (`babyShare`), at most once every
   * `every` s. Mega Kangaskhan's baby is out for good: `mega` adds to the share, `megaEvery` its pace and its
   * punch lands in a small ring.
   */
  baby: { share: 0.3, perLevel: 0.012, cap: 0.65, every: 0.42, mega: 0.3, megaEvery: 0.16, hop: 0.16, r: 9, megaR: 18 },
  /**
   * Pinsir's pincers snap shut in front every `every` s (Mega `megaEvery`) at the nearest foe within `reach`:
   * what they catch is clamped (a mark: every hit takes more), and a regular foe at or under `cut` of its HP
   * is cut in two. Mega Pinsir (Aerilate) flies: each snap also throws a gust blade ahead.
   */
  pincers: { every: 1.8, megaEvery: 1.05, reach: 64, dist: 20, r: 15, power: 9, cut: 0.22, clamp: { kind: 'mark', chance: 1, duration: 2.5, power: 0.25 }, gust: { power: 8, speed: 210, r: 8, pierce: 6, ttl: 0.9 } },
  /**
   * Skarmory sheds a razor feather every `gap` px it walks, onto the ground behind it, while fewer than `cap`
   * lie there (more with the level, `featherCap`); a foe that steps on one is cut and slowed, and it breaks
   * after `pierce` foes. They lie `life` s. Mega Skarmory (Stalwart) lies them twice as thick, and they cut harder.
   */
  feathers: {
    gap: 30, cap: 5, perLevels: 8, maxCap: 9, megaCap: 2, life: 10, r: 8, power: 8, megaPower: 1.4, pierce: 2, megaPierce: 4,
    slow: { kind: 'slow', chance: 1, duration: 1.5, power: 0.45 },
  },
  /**
   * Drilbur's line digs: Drill Run goes under the ground (`under` s, the burrow's immunity) and opens a hole
   * where it dives and where it comes up. A hole trips the foes that cross it (a slow and a tap every
   * `trip` s) for `life` s, `holes` at most. From Excadrill on, the tunnel between the two holes caves in
   * `collapse` s after it comes up: a fault line of `segments` hits. Every `findEvery` tunnels turn up a find
   * (Exp. worth `find` × the level). Mega Excadrill's drill (Piercing Drill) goes through wards.
   */
  dig: {
    under: [0.28, 0.34], holes: [3, 5], life: 9, r: [10, 13], trip: 0.6, tripPower: 3, slow: { kind: 'slow', chance: 1, duration: 1.2, power: 0.6 },
    collapse: 0.35, segments: 6, segR: 13, power: [0, 14], findEvery: 6, find: 3, minTunnel: 24,
  },
  /**
   * Drampa's Berserk: from `from` of its HP down to `to`, its rage climbs (`rageAt`), in `steps` steps, each
   * adding a share of `might`, `area` and `haste`. Falling under `roarAt` of its HP lets out a roar (once every
   * `roar.cooldown` s): a ring that throws the horde back, with a moment of i-frames. Mega Drampa never rages
   * under `megaFloor`, and roars more often.
   */
  berserk: {
    from: 0.75, to: 0.15, steps: 10, might: 0.5, area: 0.15, haste: -0.12, megaFloor: 0.5,
    roar: { at: 0.5, cooldown: 18, megaCooldown: 10, r: 92, power: 18, knockback: 260, iframes: 1 },
  },
} as const

/** What the families' hitboxes look like (`render/gaKitMAFx.ts`). */
export type GaKitMAVisual =
  | 'maComet' | 'maBaby' | 'maThrow' | 'maSnap' | 'maGust' | 'maCutter' | 'maFeather' | 'maDrill' | 'maHole' | 'maFault' | 'maVoice' | 'maRoar'

/** Each family's running state on `Player.kitMA`; absent for anyone else, so their runs hash the same. */
export type GaKitMA =
  | { kind: 'baby'; ready: number }
  | { kind: 'pincers'; snap: number }
  | { kind: 'feathers'; walked: number }
  | { kind: 'dig'; dive: { x: number; y: number } | null; tunnels: number }
  | { kind: 'berserk'; rage: number; roar: number; above: boolean }

const CREATE = {
  kangaskhan: () => ({ kind: 'baby', ready: 0 }),
  pinsir: () => ({ kind: 'pincers', snap: KIT_MA.pincers.every / 2 }),
  skarmory: () => ({ kind: 'feathers', walked: 0 }),
  drilbur: () => ({ kind: 'dig', dive: null, tunnels: 0 }),
  drampa: () => ({ kind: 'berserk', rage: 0, roar: 0, above: true }),
} as const satisfies Partial<Record<PlayableId, () => GaKitMA>>

const hasKit = (id: PlayableId): id is keyof typeof CREATE => id in CREATE

/** The fresh state of a family's mechanic, or null for anyone without one (`createPlayer` then leaves the field out). */
export const createKitMA = (starter: PlayableId): GaKitMA | null => (hasKit(starter) ? CREATE[starter]() : null)

/** A by-stage number at `stage`, the last one past the end. */
export const atStage = <T>(values: readonly T[], stage: number): T => values[Math.min(Math.max(0, stage), values.length - 1)]!

/** The share of its mother's hit the baby punches for: it grows up with the level, and Mega Kangaskhan's is out of the pouch. */
export const babyShare = (level: number, mega: boolean) => {
  const B = KIT_MA.baby
  return Math.min(B.cap, B.share + B.perLevel * Math.max(0, level - 1)) + (mega ? B.mega : 0)
}

/** Seconds between two of the baby's punches. */
export const babyEvery = (mega: boolean) => (mega ? KIT_MA.baby.megaEvery : KIT_MA.baby.every)

/** Seconds between two snaps of Pinsir's pincers. */
export const snapEvery = (mega: boolean) => (mega ? KIT_MA.pincers.megaEvery : KIT_MA.pincers.every)

/** How many feathers may lie at once: one more every `perLevels` levels, up to `maxCap`, twice that for Mega Skarmory. */
export const featherCap = (level: number, mega: boolean) => {
  const F = KIT_MA.feathers
  const cap = Math.min(F.maxCap, F.cap + Math.floor(Math.max(0, level - 1) / F.perLevels))
  return mega ? cap * F.megaCap : cap
}

/** Feathers to shed after walking from `before` to `after` px (one per `gap`). */
export const feathersShed = (before: number, after: number) => Math.max(0, Math.floor(after / KIT_MA.feathers.gap) - Math.floor(before / KIT_MA.feathers.gap))

/** Whether a tunnel this long caves in (Excadrill on; a dive that barely moved leaves only the hole). */
export const tunnelCaves = (stage: number, length: number) => stage >= 1 && length >= KIT_MA.dig.minTunnel

/** Whether this tunnel (1-based count) turns up a find. */
export const tunnelFinds = (tunnels: number) => tunnels > 0 && tunnels % KIT_MA.dig.findEvery === 0

/** Drampa's rage at an HP share, 0 to 1 in `steps` steps (none above `from`, all under `to`); Mega Drampa's never under `megaFloor`. */
export const rageAt = (hpShare: number, mega: boolean) => {
  const B = KIT_MA.berserk
  const raw = Math.max(0, Math.min(1, (B.from - hpShare) / (B.from - B.to)))
  const stepped = Math.floor(raw * B.steps + 1e-9) / B.steps
  return mega ? Math.max(B.megaFloor, stepped) : stepped
}

/** Whether Drampa roars: it just fell under `roar.at` of its HP and the roar is ready. */
export const roars = (above: boolean, hpShare: number, ready: number) => above && hpShare < KIT_MA.berserk.roar.at && ready <= 0

/** The family's bonuses right now, on top of its other stats (`recomputeStats`). */
export const kitMADeltas = (kit: GaKitMA | undefined): readonly StatDelta[] => {
  if (kit?.kind !== 'berserk' || kit.rage <= 0) return []
  const B = KIT_MA.berserk
  return [{ might: B.might * kit.rage, area: B.area * kit.rage, cooldown: B.haste * kit.rage }]
}

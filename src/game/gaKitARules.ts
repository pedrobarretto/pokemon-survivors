import type { BranchId } from '../data/branches'
import type { PlayableId } from '../data/hatchlings'
import { effectiveness, type PokeType } from '../data/types'
import type { StatDelta } from './stats'

/**
 * Pure numbers and rules of the big update's first 15 families
 * (`data/gaFamiliesA.ts`). `gaKitASystem.ts` runs them on `Player.kitA`; nothing
 * here touches the game, so each rule is tested on its own
 * (`gaKitARules.test.ts`). As with Temporada 1's kits, every bonus is capped
 * and every protection has a fixed cooldown the cooldown stat can't shrink.
 * Arrays indexed by stage hold the last value for later stages (`atStage`).
 */
export const GA_KIT = {
  /** Jangmo-o's line, Clangorous Soul: at or over `minHp` and recharged, it pays `cost` of max HP for `left` s of every stat. */
  soul: { minHp: 0.7, cost: 0.18, left: 10, cooldown: 26, might: [0.15, 0.25, 0.35], speed: [4, 6, 8], area: [0.05, 0.1, 0.15], haste: [-0.04, -0.06, -0.08], wave: 1.3 },
  /** Axew's line, Dragon Dance: a stack every `every` s untouched (a hit takes half), each adding might and speed; Haxorus spends a full dance on a Guillotine. */
  dance: { every: 3.5, cap: [3, 4, 5], might: 0.05, speed: 1.5, execute: 0.2, boss: 1.6, reach: 1.5 },
  /** Lapras afloat (on a lake, frozen or not): its regen and pace on water, how far Sing carries there, and how close a teammate rides along (co-op). */
  ferry: { regen: 1.5, speed: 8, sing: 1.35, carry: 30 },
  /** Sneasel's line, the hunt: kills less than `window` s apart chain, each link adding might and speed; Beat Up gets a strike per `perStrike` links. */
  hunt: { window: 2.2, cap: [6, 10], might: 0.02, speed: 1, strikes: 2, perStrike: 3, maxStrikes: 5 },
  /** Heracross: Horn Attack's hits gather sap (a berry fills it), and a full gauge is `rush` s of Sap Rush. */
  sap: { need: 14, rush: 8, might: 0.25, speed: 6, fling: 1.5 },
  /** Sableye: gems (Exp. pickups) eaten before a Power Gem burst, its shards, and Mega Sableye's gem mirror. */
  hoard: { need: 25, megaNeed: 15, shards: 10, power: 16, speed: 170, gap: 2, mirror: { r: 26, perSecond: 6 } },
  /** Spiritomb: spirits it binds (doubled in the dark), how many make a wisp, what a hit lets loose, and the wisps' orbit and touch. */
  spirits: { cap: 108, per: 12, dark: 2, leak: 3, orbit: 30, r: 6, power: 5, hitInterval: 0.5, might: 0.02 },
  /** Croagunk's line: Poison Jab cashes in up to `cash` s of a foe's poison; `need` cash-ins inflate the sacs into a croak. */
  sacs: { need: 5, cash: 4, share: 0.9, r: 64, small: 0.75, power: 22, poison: { kind: 'poison', chance: 1, duration: 4, power: 0.25 } },
  /** Sinistea's line: a spill when hurt (`gap` s apart), the puddles and their heal budget; the Antique Form's tea is the real thing. */
  tea: { gap: 2, r: 13, share: 0.5, hitInterval: 0.5, ttl: 3.2, antiqueTtl: 4.8, heal: 0.012, antiqueHeal: 0.024, puddles: [2, 4], antiquePuddles: 3 },
  /** Impidimp's line: confused or weakened foes within `reach` feed its mischief; full, its hair coils for `left` s. */
  mischief: { need: 30, left: 8, lockout: 10, reach: 130, every: 0.5, maxPerTick: 4, might: [0.15, 0.25, 0.4], armor: [1, 1, 2] },
  /** Pawmi's line: px walked to fill the fur, what a punch adds, the burst a full fur lets go and Pawmot's Revival Blessing. */
  fur: { full: 1000, punch: 60, r: 56, power: 18, fullMight: 0.15, blessing: { min: 0.5, base: 0.25, perCharge: 0.5, iframes: 2 } },
  /** Rookidee's line: armor plates by stage, the fixed regrow, the share of a hit one soaks and the shards it breaks into. */
  plates: { cap: [1, 2, 3], regrow: 7, soak: 0.6, shards: 6, power: 10, speed: 160 },
  /** Elekid's line: cables by stage, how near one latches and how far it snaps, and the shock it carries. */
  cables: { count: [1, 1, 2], reach: 76, snap: 110, relink: 0.6, every: 0.45, power: 6 },
  /** Magby's line: heat per cast up to `need` (by stage), what each point adds, and the vent at the top. */
  heat: { need: [16, 20, 24], might: 0.012, r: 70, power: 26, vent: 3, ventCooldown: 0.35 },
  /** Electivire and Magmortar near each other in co-op: rivals push each other. */
  rivalry: { reach: 160, might: 0.1, every: 1 },
  /** Nincada's shell (Shedinja beside Ninjask): how it trails, how often it claws, and Shedinja's own Wonder Guard. */
  shell: { follow: 22, every: 0.9, reach: 64, power: 8, r: 9, through: 0.15 },
} as const

/** What the families' hitboxes look like (`render/gaKitAFx.ts`). */
export type GaKitAVisual =
  | 'gaRing' | 'gaSing' | 'gaChop' | 'gaGuillotine' | 'gaClaw' | 'gaHorn' | 'gaShadow' | 'gaGem' | 'gaWisp' | 'gaJab' | 'gaCroak'
  | 'gaTea' | 'gaBow' | 'gaSpark' | 'gaWing' | 'gaPunch' | 'gaZap' | 'gaFlame' | 'gaFlameSplash' | 'gaBite' | 'gaPlate' | 'gaShedClaw'

/** A value from a per-stage table: the stage's, or the last one past its end. */
export const atStage = <T>(table: readonly T[], stage: number): T => table[Math.max(0, Math.min(stage, table.length - 1))]!

/** Shedinja beside Ninjask: where it floats and the seconds to its next claw. */
export type GaShed = { x: number; y: number; claw: number }

/** Each family's running state on `Player.kitA`; absent for anyone else, so their runs hash the same. */
export type GaKitA =
  | { kind: 'soul'; left: number; cooldown: number }
  | { kind: 'dance'; stacks: number; calm: number }
  | { kind: 'ferry'; afloat: boolean }
  | { kind: 'hunt'; stacks: number; left: number }
  | { kind: 'sap'; sap: number; rush: number }
  | { kind: 'hoard'; gems: number; wait: number; mirror: number }
  | { kind: 'spirits'; spirits: number; wisps: number; tick: number }
  | { kind: 'sacs'; sacs: number }
  | { kind: 'tea'; spill: number; heal: number; at: number }
  | { kind: 'mischief'; meter: number; left: number; lockout: number; tick: number }
  | { kind: 'fur'; charge: number; walked: number; blessed: boolean }
  | { kind: 'plates'; plates: number; regrow: number }
  | { kind: 'cables'; links: number[]; relink: number; tick: number; rival: boolean; check: number }
  | { kind: 'heat'; heat: number; vent: number; rival: boolean; check: number }
  | { kind: 'shell'; shed: GaShed | null }

const CREATE = {
  jangmoo: () => ({ kind: 'soul', left: 0, cooldown: 0 }),
  axew: () => ({ kind: 'dance', stacks: 0, calm: 0 }),
  lapras: () => ({ kind: 'ferry', afloat: false }),
  sneasel: () => ({ kind: 'hunt', stacks: 0, left: 0 }),
  heracross: () => ({ kind: 'sap', sap: 0, rush: 0 }),
  sableye: () => ({ kind: 'hoard', gems: 0, wait: 0, mirror: 0 }),
  spiritomb: () => ({ kind: 'spirits', spirits: 0, wisps: 0, tick: 0 }),
  croagunk: () => ({ kind: 'sacs', sacs: 0 }),
  sinistea: () => ({ kind: 'tea', spill: 0, heal: 0, at: 0 }),
  impidimp: () => ({ kind: 'mischief', meter: 0, left: 0, lockout: 0, tick: 0 }),
  pawmi: () => ({ kind: 'fur', charge: 0, walked: 0, blessed: false }),
  rookidee: () => ({ kind: 'plates', plates: 1, regrow: GA_KIT.plates.regrow }),
  elekid: () => ({ kind: 'cables', links: [], relink: 0, tick: 0, rival: false, check: 0 }),
  magby: () => ({ kind: 'heat', heat: 0, vent: 0, rival: false, check: 0 }),
  nincada: () => ({ kind: 'shell', shed: null }),
} as const satisfies Partial<Record<PlayableId, () => GaKitA>>

const hasKit = (id: PlayableId): id is keyof typeof CREATE => id in CREATE

/** The fresh state of a family's mechanic, or null for anyone else. */
export const createGaKitA = (starter: PlayableId): GaKitA | null => (hasKit(starter) ? CREATE[starter]() : null)

/** Clangorous Soul goes off: healthy enough, recharged and not already running. */
export const soulReady = (hpShare: number, left: number, cooldown: number) => left <= 0 && cooldown <= 0 && hpShare >= GA_KIT.soul.minHp

/** The dance after a hit: half the stacks, rounded down. */
export const danceHit = (stacks: number) => Math.floor(stacks / 2)

/** The dance after `dt` untouched: a stack each `every` s, up to the stage's cap; `calm` carries the seconds toward the next. */
export const danceStep = (stacks: number, calm: number, dt: number, stage: number) => {
  const cap = atStage(GA_KIT.dance.cap, stage)
  if (stacks >= cap) return { stacks: cap, calm: 0 }
  const next = calm + dt
  return next >= GA_KIT.dance.every ? { stacks: stacks + 1, calm: next - GA_KIT.dance.every } : { stacks, calm: next }
}

/** Haxorus's Guillotine: the last stage with a full dance. */
export const guillotineReady = (stacks: number, stage: number) => stage >= 2 && stacks >= atStage(GA_KIT.dance.cap, stage)

/** The hunt after a kill: a link more while the chain holds (`left` > 0), else a fresh one, up to the stage's cap. */
export const huntKill = (stacks: number, left: number, stage: number) => Math.min(atStage(GA_KIT.hunt.cap, stage), left > 0 ? stacks + 1 : 1)

/** Beat Up's strikes with `stacks` links. */
export const beatUpStrikes = (stacks: number) => Math.min(GA_KIT.hunt.maxStrikes, GA_KIT.hunt.strikes + Math.floor(stacks / GA_KIT.hunt.perStrike))

/** Spirits bound after a kill: two in the dark, up to the cap. */
export const bindSpirit = (spirits: number, dark: boolean) => Math.min(GA_KIT.spirits.cap, spirits + (dark ? GA_KIT.spirits.dark : 1))

/** The wisps `spirits` make. */
export const wispsOf = (spirits: number) => Math.floor(spirits / GA_KIT.spirits.per)

/** What Poison Jab cashes in from a foe's poison: its damage per second over what's left, up to `cash` s. */
export const poisonCash = (dps: number, timeLeft: number) => dps * Math.min(GA_KIT.sacs.cash, Math.max(0, timeLeft)) * GA_KIT.sacs.share

/** The tea's heal budget `elapsed` s after it held `left`, for `maxHp` at `rate`: at most one second's worth. */
export const teaRefill = (left: number, elapsed: number, maxHp: number, rate: number) => {
  const cap = maxHp * rate
  return Math.min(cap, left + elapsed * cap)
}

/** Puddles a Teatime pours: by stage, three for the Antique Form. */
export const teaPuddles = (stage: number, branch: BranchId | null) => (branch === 'polteageistAntique' ? GA_KIT.tea.antiquePuddles : atStage(GA_KIT.tea.puddles, stage))

/** Mischief after a feeding tick with `foes` confused or weakened in reach: nothing while the coil runs or rests. */
export const mischiefFed = (meter: number, foes: number, left: number, lockout: number) =>
  left > 0 || lockout > 0 ? meter : Math.min(GA_KIT.mischief.need, meter + Math.min(GA_KIT.mischief.maxPerTick, foes))

/** The fur's charge after `walked` px more (0..1). */
export const furCharged = (charge: number, walked: number) => Math.min(1, charge + Math.max(0, walked) / GA_KIT.fur.full)

/** Pawmot keeps a full fur (its Revival Blessing) until that's spent; the others let it go. */
export const furHolds = (stage: number, blessed: boolean) => stage >= 2 && !blessed

/** Revival Blessing: Pawmot, not spent, with at least half a charge. The HP share it rises with, or null. */
export const blessingHp = (stage: number, blessed: boolean, charge: number) =>
  stage >= 2 && !blessed && charge >= GA_KIT.fur.blessing.min ? GA_KIT.fur.blessing.base + GA_KIT.fur.blessing.perCharge * charge : null

/** A hit after a plate soaks it (the plate breaks), or untouched without one. */
export const plateSoak = (amount: number, plates: number) => (plates > 0 ? amount * (1 - GA_KIT.plates.soak) : amount)

/** Heat after a cast: the stage's top vents it (`vented`). */
export const heatCast = (heat: number, stage: number) => {
  const need = atStage(GA_KIT.heat.need, stage)
  return heat + 1 >= need ? { heat: 0, vented: true } : { heat: heat + 1, vented: false }
}

/** The types Wonder Guard lets through: those super effective on Bug/Ghost. A typeless hit (lava, a hazard) always does. */
export const wonderGuardHolds = (types: readonly PokeType[]) => types.length > 0 && !types.some((t) => effectiveness(t, ['bug', 'ghost']) > 1)

/** Whether Shedinja floats beside the player: Ninjask (the line's way or its branch), never Shedinja itself. */
export const shellOut = (stage: number, branch: BranchId | null) => stage >= 1 && branch !== 'shedinja'

/** The family's bonuses right now, on top of its other stats (`recomputeStats`). */
export const gaKitADeltas = (k: GaKitA | undefined, stage: number): readonly StatDelta[] => {
  if (!k) return []
  switch (k.kind) {
    case 'soul':
      return k.left > 0 ? [{ might: atStage(GA_KIT.soul.might, stage), speed: atStage(GA_KIT.soul.speed, stage), area: atStage(GA_KIT.soul.area, stage), cooldown: atStage(GA_KIT.soul.haste, stage) }] : []
    case 'dance': return k.stacks > 0 ? [{ might: k.stacks * GA_KIT.dance.might, speed: k.stacks * GA_KIT.dance.speed }] : []
    case 'ferry': return k.afloat ? [{ regen: GA_KIT.ferry.regen, speed: GA_KIT.ferry.speed }] : []
    case 'hunt': return k.stacks > 0 ? [{ might: k.stacks * GA_KIT.hunt.might, speed: k.stacks * GA_KIT.hunt.speed }] : []
    case 'sap': return k.rush > 0 ? [{ might: GA_KIT.sap.might, speed: GA_KIT.sap.speed }] : []
    case 'spirits': return k.wisps > 0 ? [{ might: k.wisps * GA_KIT.spirits.might }] : []
    case 'mischief': return k.left > 0 ? [{ might: atStage(GA_KIT.mischief.might, stage), armor: atStage(GA_KIT.mischief.armor, stage) }] : []
    case 'fur': return furHolds(stage, k.blessed) && k.charge >= 1 ? [{ might: GA_KIT.fur.fullMight }] : []
    case 'cables': return k.rival ? [{ might: GA_KIT.rivalry.might }] : []
    case 'heat':
      return [
        ...(k.heat > 0 ? [{ might: k.heat * GA_KIT.heat.might }] : []),
        ...(k.vent > 0 ? [{ cooldown: GA_KIT.heat.ventCooldown }] : []),
        ...(k.rival ? [{ might: GA_KIT.rivalry.might }] : []),
      ]
    default: return []
  }
}

/** What a kit's meter reads for the bar under the HP (0..1), or null for a family without one. */
export const gaKitAMeter = (k: GaKitA | undefined, stage: number): { fill: number; on: boolean; color: string } | null => {
  if (!k) return null
  switch (k.kind) {
    case 'soul': return k.left > 0 ? { fill: k.left / GA_KIT.soul.left, on: true, color: '#f8d048' } : { fill: 1 - k.cooldown / GA_KIT.soul.cooldown, on: false, color: '#c8a048' }
    case 'sap': return k.rush > 0 ? { fill: k.rush / GA_KIT.sap.rush, on: true, color: '#e8a838' } : { fill: k.sap / GA_KIT.sap.need, on: false, color: '#c88828' }
    case 'mischief': return k.left > 0 ? { fill: k.left / GA_KIT.mischief.left, on: true, color: '#e870a8' } : { fill: k.meter / GA_KIT.mischief.need, on: false, color: k.lockout > 0 ? '#606878' : '#c05878' }
    case 'fur': return { fill: k.charge, on: k.charge >= 1, color: '#f8d030' }
    case 'heat': return { fill: k.vent > 0 ? k.vent / GA_KIT.heat.vent : k.heat / atStage(GA_KIT.heat.need, stage), on: k.vent > 0, color: '#f87838' }
    default: return null
  }
}

import { PLAYABLE_IDS, type PlayableId } from '../data/hatchlings'
import { LEGEND_IDS } from '../data/legends'
import { isRecord } from './parse'
import type { StatDelta } from './stats'

/**
 * Shadow Pokémon: a variant tier beside shiny, made by Team Rocket. A Shadow
 * hits harder and takes harder hits (as in GO), decided as the run starts
 * (`ReplayStart.variant`, so the server re-simulates it). Walking purifies it,
 * the way eggs hatch in the incubator: every run's steps fill each Shadow's
 * heart gauge, and once full the player may purify it into a Purified Pokémon,
 * which keeps a small mark and a little more HP. The Game Corner's prize
 * counter and the Rocket Hideout give them (`data/rocketCorner.ts`,
 * `data/rocketHideout.ts`); the look is code-drawn (`render/shadowAura.ts`),
 * save for the species with real Shadow sheets (`SHADOW_SHEETS`).
 *
 * Pure; shared with the API through the save.
 */
export type ShadowVariant = 'shadow' | 'purified'

export const SHADOW = {
  /** A Shadow's might and the damage it takes, on top of everything else. */
  shadow: { might: 0.2, damageTaken: 0.2 },
  /** A Purified Pokémon's thanks. */
  purified: { maxHp: 10 },
  /** Steps (`EGGS.stepPx` world px each) a Shadow walks before it can be purified; a legend's heart is harder to open. */
  steps: 9000,
  legendSteps: 18000,
} as const

/**
 * Species SpriteCollab draws as Shadows (their form key in `FORMS`,
 * scripts/dex.mjs): those wear their own sheets, everyone else the aura.
 * Shadow Lugia's sheets exist too ('0249/0001'): a later event adds it here.
 */
export const SHADOW_SHEETS: Readonly<Partial<Record<number, 'shadow'>>> = { 150: 'shadow' }

/** The run's stat changes for its variant. */
export const variantDeltas = (variant: ShadowVariant | undefined): readonly StatDelta[] =>
  variant === 'shadow' ? [SHADOW.shadow] : variant === 'purified' ? [SHADOW.purified] : []

export const isShadowVariant = (v: unknown): v is ShadowVariant => v === 'shadow' || v === 'purified'

/* ---------------- The save's side ---------------- */

/** One Shadow the player owns: purified or not, the steps its gauge has walked and whether runs play it (the Normal/Shadow pick). */
export type ShadowEntry = { purified: boolean; steps: number; pick: boolean }

export type ShadowSave = Readonly<Partial<Record<PlayableId, ShadowEntry>>>

export const NO_SHADOWS: ShadowSave = {}

/** Every Pokémon that can be a Shadow: the regular cast and the legends (Shadow Mewtwo). */
const OWNERS: readonly PlayableId[] = [...PLAYABLE_IDS, ...LEGEND_IDS]

const isLegendId = (id: PlayableId) => (LEGEND_IDS as readonly PlayableId[]).includes(id)

/** Steps `id`'s heart gauge needs. */
export const purifySteps = (id: PlayableId) => (isLegendId(id) ? SHADOW.legendSteps : SHADOW.steps)

/** Gives `id` as a Shadow, picked (the player just met it). One already owned stays as it is. */
export const grantShadow = (shadows: ShadowSave, id: PlayableId): ShadowSave =>
  shadows[id] ? shadows : { ...shadows, [id]: { purified: false, steps: 0, pick: true } }

/** Every Shadow not yet purified walks `steps` more, up to its gauge. */
export const walkShadows = (shadows: ShadowSave, steps: number): ShadowSave => {
  if (steps <= 0) return shadows
  const out: Partial<Record<PlayableId, ShadowEntry>> = {}
  for (const id of OWNERS) {
    const e = shadows[id]
    if (!e) continue
    out[id] = e.purified ? e : { ...e, steps: Math.min(purifySteps(id), e.steps + Math.floor(steps)) }
  }
  return out
}

/** Whether `id` is a Shadow whose gauge is full. */
export const canPurify = (shadows: ShadowSave, id: PlayableId) => {
  const e = shadows[id]
  return e !== undefined && !e.purified && e.steps >= purifySteps(id)
}

/** Purifies `id` when its gauge is full (its pick stays); otherwise nothing changes. */
export const purify = (shadows: ShadowSave, id: PlayableId): ShadowSave => {
  const e = shadows[id]
  return e && canPurify(shadows, id) ? { ...shadows, [id]: { ...e, purified: true } } : shadows
}

/** Sets whether runs play `id`'s Shadow (or Purified) form. */
export const pickShadow = (shadows: ShadowSave, id: PlayableId, pick: boolean): ShadowSave => {
  const e = shadows[id]
  return e && e.pick !== pick ? { ...shadows, [id]: { ...e, pick } } : shadows
}

/** The variant a run with `id` plays from this save, or null for the plain one. */
export const runVariant = (shadows: ShadowSave, id: PlayableId): ShadowVariant | null => {
  const e = shadows[id]
  return e?.pick ? (e.purified ? 'purified' : 'shadow') : null
}

/**
 * Both in one: every key on either side; purified wins (it never goes back),
 * the further gauge wins, and `incoming`'s pick when it has the key (a
 * setting, like the shiny pick).
 */
export const mergeShadows = (base: ShadowSave, incoming: ShadowSave): ShadowSave => {
  const out: Partial<Record<PlayableId, ShadowEntry>> = {}
  for (const id of OWNERS) {
    const a = base[id]
    const b = incoming[id]
    if (!a && !b) continue
    out[id] = { purified: (a?.purified ?? false) || (b?.purified ?? false), steps: Math.max(a?.steps ?? 0, b?.steps ?? 0), pick: b ? b.pick : (a?.pick ?? false) }
  }
  return out
}

/** The save's `shadows`: unknown Pokémon and malformed entries are dropped. */
export const parseShadows = (raw: unknown): ShadowSave => {
  if (!isRecord(raw)) return NO_SHADOWS
  const out: Partial<Record<PlayableId, ShadowEntry>> = {}
  for (const id of OWNERS) {
    const e = raw[id]
    if (!isRecord(e)) continue
    const steps = typeof e.steps === 'number' && Number.isFinite(e.steps) ? Math.max(0, Math.min(purifySteps(id), Math.floor(e.steps))) : 0
    out[id] = { purified: e.purified === true, steps, pick: e.pick === true }
  }
  return out
}

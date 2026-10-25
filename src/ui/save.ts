import type { TitleId } from '../data/achievements'
import type { EnemyId } from '../data/enemies'
import { mergeAttempts, parseAttempt, type Attempt } from '../game/attempt'
import { dailyChallenge } from '../game/challenge'
import { brasiliaDay } from '../game/day'
import { vitrineOf } from '../game/shop'
import { outbreakAt } from '../game/outbreak'
import { isHalloweenDay } from '../game/halloween'
import { depositEggs, type Egg } from '../game/eggs'
import { parseSave, recordHatch, recordRun, type Save } from '../game/meta'
import type { RunSummary } from '../game/tally'
import { STICK_MODES, type StickMode } from '../engine/input'
import { DAMAGE_NUMBERS, type DamageNumbers } from '../render/damageNumbers'
import { FLASH_MODES, type Flashes } from '../render/flashes'
import { RUN_TOASTS, type RunToasts } from './toastQueue'
import { DEFAULT_BINDINGS, parseBindings, type Bindings } from '../engine/bindings'
import { UI_SCALES, type UiScale } from './uiScale'

const KEY = 'ps:save'

/** Reads the meta save. Storage errors (private mode, quota) fall back to an empty save. */
export const loadSave = (): Save => {
  try {
    return parseSave(localStorage.getItem(KEY))
  } catch {
    return parseSave(null)
  }
}

export const writeSave = (save: Save) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(save))
  } catch {
    // Storage full or blocked: progress just won't persist this session.
  }
}

/** Applies `change` to the stored save and writes it back. */
export const updateSave = (change: (save: Save) => Save) => writeSave(change(loadSave()))

/** Adds run earnings to the wallet and returns the new balance. */
export const depositPokeDollars = (amount: number) => {
  const save = loadSave()
  const next = { ...save, wallet: save.wallet + Math.max(0, Math.round(amount)) }
  writeSave(next)
  return next.wallet
}

/**
 * Banks a run into the incubator: incubating eggs walk `steps`, new eggs take
 * the free slots and the rest are paid in ₽ (see `depositEggs`).
 */
export const bankEggs = (steps: number, found: readonly Egg[]) => {
  const { save, converted, refund } = depositEggs(loadSave(), steps, found)
  writeSave(save)
  return { converted, refund }
}

/* ---------------- Missions and achievements ---------------- */

/** Dev-only shift of the missions' clock (`ps.date`), in ms. */
let clockOffset = 0

/** `halloweenToday`'s answer and the minute it was worked out for. */
let haunted = { minute: -1, on: false }

/** The date missions are drawn for: the local clock, unless the dev console moved it. */
export const today = () => new Date(Date.now() + clockOffset)

export const setToday = (date: Date | null) => {
  clockOffset = date ? date.getTime() - Date.now() : 0
  haunted = { minute: -1, on: false }
}

/** Dev-only outbreak held instead of the day's (`ps.outbreak`). */
let outbreakOverride: EnemyId | null = null

/**
 * The outbreak of the day (Brasília) on the missions' clock, unless the dev
 * console holds another. A ranked run passes the one the API dealt with its
 * ticket (`dealt`), which a wrong device clock can't move.
 */
export const outbreakToday = (dealt: EnemyId | null = null): EnemyId => outbreakOverride ?? dealt ?? outbreakAt(today())

export const setOutbreak = (id: EnemyId | null) => {
  outbreakOverride = id
}

/**
 * Whether today (Brasília, on the missions' clock) is a Noite das Bruxas day:
 * runs are haunted and the lobby dresses for it. Asked every frame (the
 * menus' music), so it's worked out once a minute. A ranked run passes the
 * answer the API dealt with its ticket (`dealt`), which a wrong device clock
 * can't move, unless the dev console moved the clock (`ps.halloween`).
 */
export const halloweenToday = (dealt: boolean | null = null) => {
  if (dealt !== null && clockOffset === 0) return dealt
  const now = today()
  const minute = Math.floor(now.getTime() / 60_000)
  if (haunted.minute !== minute) haunted = { minute, on: isHalloweenDay(brasiliaDay(now)) }
  return haunted.on
}

/** Today's Desafio do dia (Brasília day, on the missions' clock). */
export const challengeToday = () => dailyChallenge(brasiliaDay(today()))

/** Where the attempt lived before it joined the save. Still written: it keeps the device's own attempt through a sync with an API that doesn't know the field yet. */
const ATTEMPT_KEY = 'ps:challenge'

const deviceAttempt = (): Attempt | null => {
  try {
    return parseAttempt(JSON.parse(localStorage.getItem(ATTEMPT_KEY) ?? 'null'))
  } catch {
    return null
  }
}

/**
 * The last official challenge attempt finished (`Attempt`): the save's, which
 * the account syncs from the other devices, or this device's own if later.
 * Only a hint for the screens: the API decides which run is official (`nextIsOfficial`).
 */
export const loadAttempt = (): Attempt | null => mergeAttempts(loadSave().attempt, deviceAttempt())

export const saveAttempt = (attempt: Attempt | null) => {
  updateSave((save) => ({ ...save, attempt }))
  try {
    if (attempt) localStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempt))
    else localStorage.removeItem(ATTEMPT_KEY)
  } catch {
    // Storage blocked: the save still has it.
  }
}

/** Today's Vitrine do dia (Brasília day, on the missions' clock). */
export const vitrineToday = () => vitrineOf(brasiliaDay(today()))

/**
 * Records a run into the missions and achievements, pays their rewards and saves.
 * `before` is the snapshot already recorded for this run and `eggRoom` the
 * reward eggs it can still take (see `recordRun`).
 */
export const recordRunProgress = (summary: RunSummary, before: RunSummary | null, eggRoom: number) => {
  const record = recordRun(loadSave(), summary, before, today(), eggRoom)
  writeSave(record.save)
  return record
}

/** Saves a hatched egg (`hatchEgg`'s save) with what it did for the missions and achievements. */
export const saveHatch = (save: Save, shiny: boolean) => {
  const record = recordHatch(save, shiny, today())
  writeSave(record.save)
  return record
}

/** Shows `title` on the title and results screens (null hides it). */
export const equipTitle = (title: TitleId | null) => writeSave({ ...loadSave(), title })

/* ---------------- Settings ---------------- */

const SETTINGS_KEY = 'ps:settings'
/** Mute flag from before the settings screen existed. */
const LEGACY_MUTE_KEY = 'ps:muted'

/** The HUD's mini map (`render/minimap.ts`): its shape, or off. */
export const MINIMAP_MODES = ['square', 'round', 'off'] as const
export type MinimapMode = (typeof MINIMAP_MODES)[number]

/** Player preferences. Language lives in `i18n` (`ps:lang`). Volumes go from 0 to 1. */
export type Settings = {
  musicVolume: number
  sfxVolume: number
  muted: boolean
  /** `reduced` keeps the biggest few on a crowded screen (`render/damageNumbers.ts`). */
  damageNumbers: DamageNumbers
  screenShake: boolean
  /** `reduced` drops white screen flashes, white hit flashes and fast flicker (`render/flashes.ts`). */
  flashes: Flashes
  /** How opaque your moves draw, 0.1 to 1 (`render/attackLayers.ts`): lower to see the foes and their attacks through a full build. */
  attackOpacity: number
  /** The same for teammates' moves in co-op. */
  teamAttackOpacity: number
  /** Which toasts a run shows (`toastQueue.ts`): all, the important ones, or none. Per device: a phone may want fewer than the PC. */
  runToasts: RunToasts
  /** Remapped keys and gamepad buttons. Per device, so they stay out of the synced save. */
  controls: Bindings
  /** Touch joystick: follows the thumb (the default) or waits in the bottom-left corner. */
  joystick: StickMode
  /** Menus and HUD size (`ui/uiScale.ts`). Per device, like the controls. */
  uiScale: UiScale
  /** The HUD's mini map (`render/minimap.ts`): square, round or off. */
  minimap: MinimapMode
}

export const DEFAULT_SETTINGS: Settings = {
  musicVolume: 0.6,
  sfxVolume: 1,
  muted: false,
  damageNumbers: 'reduced',
  screenShake: true,
  flashes: 'normal',
  attackOpacity: 1,
  teamAttackOpacity: 0.6,
  runToasts: 'all',
  controls: DEFAULT_BINDINGS,
  joystick: 'floating',
  uiScale: 'auto',
  minimap: 'square',
}

const volume = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback)
/** The lowest move opacity: a move never vanishes outright, or a player could lose track of their own build. */
export const MIN_ATTACK_OPACITY = 0.1
const opacity = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(MIN_ATTACK_OPACITY, v)) : fallback)
const flag = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
/** The old on/off flag maps to `reduced` (on was the default, never a choice) or `off`. */
const damageMode = (v: unknown, fallback: DamageNumbers): DamageNumbers =>
  typeof v === 'boolean' ? (v ? 'reduced' : 'off') : (DAMAGE_NUMBERS.find((m) => m === v) ?? fallback)

/** Parses stored settings field by field: anything missing or malformed falls back to `defaults`. */
export const parseSettings = (raw: string | null, defaults = DEFAULT_SETTINGS): Settings => {
  let data: Partial<Record<keyof Settings, unknown>> = {}
  try {
    const parsed: unknown = raw === null ? null : JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) data = parsed
  } catch {
    // Corrupt JSON: start from the defaults.
  }
  return {
    musicVolume: volume(data.musicVolume, defaults.musicVolume),
    sfxVolume: volume(data.sfxVolume, defaults.sfxVolume),
    muted: flag(data.muted, defaults.muted),
    damageNumbers: damageMode(data.damageNumbers, defaults.damageNumbers),
    screenShake: flag(data.screenShake, defaults.screenShake),
    flashes: FLASH_MODES.find((m) => m === data.flashes) ?? defaults.flashes,
    attackOpacity: opacity(data.attackOpacity, defaults.attackOpacity),
    teamAttackOpacity: opacity(data.teamAttackOpacity, defaults.teamAttackOpacity),
    runToasts: RUN_TOASTS.find((m) => m === data.runToasts) ?? defaults.runToasts,
    controls: parseBindings(data.controls),
    joystick: STICK_MODES.find((m) => m === data.joystick) ?? defaults.joystick,
    uiScale: UI_SCALES.find((s) => s === data.uiScale) ?? defaults.uiScale,
    minimap: MINIMAP_MODES.find((m) => m === data.minimap) ?? defaults.minimap,
  }
}

export const loadSettings = (): Settings => {
  try {
    const legacyMuted = localStorage.getItem(LEGACY_MUTE_KEY) === '1'
    return parseSettings(localStorage.getItem(SETTINGS_KEY), { ...DEFAULT_SETTINGS, muted: legacyMuted })
  } catch {
    return DEFAULT_SETTINGS
  }
}

export const writeSettings = (settings: Settings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Storage blocked: the settings just last this session.
  }
}

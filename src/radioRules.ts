import type { EnemyId } from './data/enemies'
import { RADIO, RADIO_TRACKS, type RadioEntry, type RadioThemeId } from './data/radio'

/**
 * The Rádio's rules, pure (the state lives in `src/radio.ts`, the sheet in
 * `ui/radio.ts`): the queue's edits, what plays next with shuffle and repeat,
 * which tracks are open, and whether the radio or the game picks the music
 * (`radioTheme`). Shell-only: the shuffle takes its dice as an argument and
 * never touches a run's seeded rng.
 */

/** Where the radio plays: only on the menus (runs keep their biome and boss music) or in runs too. */
export const RADIO_WHERE = ['menus', 'everywhere'] as const
export type RadioWhere = (typeof RADIO_WHERE)[number]

export const RADIO_REPEAT = ['off', 'all', 'one'] as const
export type RadioRepeat = (typeof RADIO_REPEAT)[number]

/**
 * The radio, a device preference (`ps:radio`). `at` is the queue's track
 * playing (null: the queue ran out, the game's own music plays). `fights`:
 * with `everywhere`, boss fights and legend domains play the queue too.
 * `heard`: themes heard on this device, which open the biomes' tracks.
 */
export type RadioState = {
  readonly on: boolean
  readonly where: RadioWhere
  readonly fights: boolean
  readonly queue: readonly RadioThemeId[]
  readonly at: number | null
  readonly shuffle: boolean
  readonly repeat: RadioRepeat
  readonly favorites: readonly RadioThemeId[]
  readonly heard: readonly RadioThemeId[]
}

export const NO_RADIO: RadioState = { on: false, where: 'menus', fights: false, queue: [], at: null, shuffle: false, repeat: 'all', favorites: [], heard: [] }

const IDS: ReadonlySet<string> = new Set(RADIO_TRACKS.map((tr) => tr.theme))

export const isRadioTheme = (v: unknown): v is RadioThemeId => typeof v === 'string' && IDS.has(v)

export const trackOf = (id: RadioThemeId): RadioEntry => RADIO_TRACKS.find((tr) => tr.theme === id)!

/* ---------------- Unlocks ---------------- */

/** What opens tracks: the device's `heard` list and the save's Pokédex (`seen(dex)`). `all`: every track open (`ps.radio('unlock')`). */
export type RadioUnlocks = { heard: readonly RadioThemeId[]; seen: (dex: number) => boolean; dexOf: (id: EnemyId) => number; all?: boolean }

export const isUnlocked = (track: RadioEntry, u: RadioUnlocks): boolean => {
  const un = track.unlock
  if (u.all || un.kind === 'open' || u.heard.includes(track.theme)) return true
  return un.kind === 'legend' && un.ids.some((id) => u.seen(u.dexOf(id)))
}

/* ---------------- The queue ---------------- */

/** The track playing now, or null. */
export const nowPlaying = (s: RadioState): RadioThemeId | null => (s.at === null ? null : (s.queue[s.at] ?? null))

/** Plays `id` now: from its place in the queue, or put in right after the one playing. Turns the radio on. */
export const playNow = (s: RadioState, id: RadioThemeId): RadioState => {
  const found = s.queue.indexOf(id)
  if (found >= 0) return { ...s, on: true, at: found }
  const at = s.at === null ? s.queue.length : s.at + 1
  return { ...s, on: true, queue: [...s.queue.slice(0, at), id, ...s.queue.slice(at)], at }
}

/** Adds `id` at the end of the queue (once). */
export const enqueue = (s: RadioState, id: RadioThemeId): RadioState => (s.queue.includes(id) ? s : { ...s, queue: [...s.queue, id] })

/** Takes the queue's `index` out; the one playing keeps playing, or the next one takes its place. */
export const dequeue = (s: RadioState, index: number): RadioState => {
  if (index < 0 || index >= s.queue.length) return s
  const queue = s.queue.filter((_, i) => i !== index)
  const at = s.at === null || queue.length === 0 ? null : index < s.at ? s.at - 1 : index === s.at ? (s.at < queue.length ? s.at : null) : s.at
  return { ...s, queue, at }
}

/** Moves the queue's `index` one place up (`-1`) or down (`1`); the one playing stays the one playing. */
export const moveInQueue = (s: RadioState, index: number, dir: -1 | 1): RadioState => {
  const to = index + dir
  if (index < 0 || to < 0 || to >= s.queue.length) return s
  const queue = [...s.queue]
  ;[queue[index], queue[to]] = [queue[to]!, queue[index]!]
  const at = s.at === index ? to : s.at === to ? index : s.at
  return { ...s, queue, at }
}

/** The queue replaced by `ids` (the favorites, every open track), from its first. */
export const playList = (s: RadioState, ids: readonly RadioThemeId[]): RadioState => (ids.length === 0 ? s : { ...s, on: true, queue: [...new Set(ids)], at: 0 })

/**
 * The queue's next index. `manual` (the ⏭ press) skips even on repeat one;
 * a track that ran its loops on repeat one plays again. Shuffle draws any
 * other track with `rand` (0..1); past the end, repeat all starts over and
 * otherwise the queue is done (null).
 */
export const nextIndex = (s: RadioState, manual: boolean, rand: () => number): number | null => {
  const n = s.queue.length
  if (n === 0) return null
  if (s.at === null) return 0
  if (s.repeat === 'one' && !manual) return s.at
  if (s.shuffle && n > 1) return (s.at + 1 + Math.floor(rand() * (n - 1))) % n
  if (s.at + 1 < n) return s.at + 1
  return s.repeat === 'off' && !manual ? null : 0
}

export const skip = (s: RadioState, manual: boolean, rand: () => number): RadioState => ({ ...s, at: nextIndex(s, manual, rand) })

/** ⏮: the track before (the last one from the first, the queue wrapping). */
export const previous = (s: RadioState): RadioState => {
  const n = s.queue.length
  if (n === 0) return s
  return { ...s, at: s.at === null ? n - 1 : (s.at - 1 + n) % n }
}

export const toggleFavorite = (s: RadioState, id: RadioThemeId): RadioState => ({
  ...s,
  favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [...s.favorites, id],
})

export const cycleRepeat = (r: RadioRepeat): RadioRepeat => RADIO_REPEAT[(RADIO_REPEAT.indexOf(r) + 1) % RADIO_REPEAT.length]!

/** Notes a theme heard on this device; the same state when it was already. */
export const hear = (s: RadioState, id: string): RadioState => (isRadioTheme(id) && !s.heard.includes(id) ? { ...s, heard: [...s.heard, id] } : s)

/* ---------------- Who picks the music ---------------- */

/** What the screen is: a menu (the lobby, the realm, the results), a run, or a fight in it (a boss, a rift, a legend's domain). */
export type MusicPlace = 'menu' | 'run' | 'fight'

/** The theme the radio plays here, or null when the game's own music plays (radio off, the queue done, a run on Só nos menus, a fight). */
export const radioTheme = (s: RadioState, place: MusicPlace): RadioThemeId | null => {
  const track = s.on ? nowPlaying(s) : null
  if (!track) return null
  if (place === 'menu') return track
  if (s.where !== 'everywhere') return null
  return place === 'run' || s.fights ? track : null
}

/** Whether a track that has looped `loops` times, `loopSeconds` each, is done (`RADIO`). */
export const trackDone = (loops: number, loopSeconds: number) => loops >= Math.max(RADIO.loops, Math.ceil(RADIO.seconds / Math.max(loopSeconds, 1)))

/* ---------------- Persisting ---------------- */

const themes = (v: unknown): RadioThemeId[] => (Array.isArray(v) ? [...new Set(v.filter(isRadioTheme))] : [])

const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => list.find((x) => x === v) ?? fallback

/** Reads a stored radio, keeping what's valid (a theme dropped from the catalog leaves the queue). */
export const parseRadio = (raw: unknown): RadioState => {
  if (typeof raw !== 'object' || raw === null) return NO_RADIO
  const r: Record<string, unknown> = { ...raw }
  const queue = themes(r.queue)
  const at = typeof r.at === 'number' && Number.isInteger(r.at) && r.at >= 0 && r.at < queue.length ? r.at : null
  return {
    on: r.on === true,
    where: oneOf(RADIO_WHERE, r.where, NO_RADIO.where),
    fights: r.fights === true,
    queue,
    at,
    shuffle: r.shuffle === true,
    repeat: oneOf(RADIO_REPEAT, r.repeat, NO_RADIO.repeat),
    favorites: themes(r.favorites),
    heard: themes(r.heard),
  }
}

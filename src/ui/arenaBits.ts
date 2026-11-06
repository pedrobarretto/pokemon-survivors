import { parseArenaFormat, type ArenaFormat } from '../data/arenaFormats'
import { isVersusPick, type Role, type VersusPick } from '../data/versus'
import { seasonAt } from '../game/arenaRank'
import { formAt } from '../game/branch'
import type { Game, GameEvent } from '../game/types'
import { t } from '../i18n'
import { arenaIconUrl, ROLE_ICONS } from '../render/arenaArt'
import { h } from './dom'

/**
 * The Arena's small pieces that the lobby, co-op rooms and the shell use
 * without a match: the device's pick and format, the role chips, the hub's
 * tabs, the season's clock and the seats' names. The Arena's screens (its
 * hub, queue, match HUD and end screen) are a chunk of their own (`arenaMode.ts`).
 */

/** Each team's color, the world's (`render/vale.ts`): the HUD, the room and the end screen use the same. */
export { teamColor } from '../render/vale'

/** Unite's role colors, for the chips. */
export const ROLE_COLORS = {
  attacker: '#f08030',
  speedster: '#3898f8',
  allRounder: '#a060e0',
  defender: '#48b040',
  supporter: '#e0a818',
} as const satisfies Record<Role, string>

export const ROLE_IDS = Object.keys(ROLE_COLORS) as Role[]

/** A role's icon, for an `<img>` beside its name. */
export const roleIcon = (role: Role, cls = 'arena-role-icon') => h('img', { class: cls, src: arenaIconUrl(ROLE_ICONS[role]), alt: '' })

/** A role as a colored chip: its icon and its name in this language. */
export const roleChip = (role: Role) => h('span', { class: 'arena-role', style: `--role:${ROLE_COLORS[role]}` }, roleIcon(role), t().versus.roles[role])

const PICK_KEY = 'ps:arenaPick'

/** The Pokémon this device last took into the Arena; `fallback` (the lobby's partner, when it's a starter) the first time. */
export const arenaPick = (fallback: string): VersusPick => {
  try {
    const kept = localStorage.getItem(PICK_KEY)
    if (kept && isVersusPick(kept)) return kept
  } catch {
    // Storage blocked: the fallback.
  }
  return isVersusPick(fallback) ? fallback : 'charmander'
}

export const keepArenaPick = (id: VersusPick) => {
  try {
    localStorage.setItem(PICK_KEY, id)
  } catch {
    // Storage blocked: the pick lasts this page.
  }
}

const FORMAT_KEY = 'ps:arenaFormat'

/** The format this device last picked on the Arena screen (the standard 4v4 the first time). */
export const arenaFormat = (): ArenaFormat => {
  try {
    return parseArenaFormat(localStorage.getItem(FORMAT_KEY))
  } catch {
    return 'standard'
  }
}

export const keepArenaFormat = (format: ArenaFormat) => {
  try {
    localStorage.setItem(FORMAT_KEY, format)
  } catch {
    // Storage blocked: the format lasts this page.
  }
}

/** The name a seat goes by in a match: a human's, or a bot's Pokémon with "CPU" (a human who left keeps theirs). */
export const versusName = (g: Game, slot: number) => {
  const p = g.players[slot]
  if (!p) return '?'
  const name = g.coop?.names[slot]?.trim()
  if (name) return name
  return `${formAt(p.starter, p.branch, p.stage).name} ${t().versus.cpu}`
}

/** Whether an event is one of the match's own (`versusFeedback` shows it). */
export const isVersusEvent = (e: GameEvent): e is Extract<GameEvent, { kind: `versus${string}` }> => e.kind.startsWith('versus')

/** The Arena hub's tabs, in order; Loja leads into the Boutique. */
export const ARENA_HUB_TABS = ['profile', 'shop', 'locker', 'season', 'ranking', 'history', 'rules'] as const
export type ArenaHubTab = (typeof ARENA_HUB_TABS)[number]
export const isArenaHubTab = (x: unknown): x is ArenaHubTab => typeof x === 'string' && (ARENA_HUB_TABS as readonly string[]).includes(x)

let staged: boolean | null = null

/** Dev (`ps.arena('season', …)`): the screens act as in the pre-season (true) or in a season (false) whatever the date; null goes back to the clock. */
export const stagePreseason = (on: boolean | null) => {
  staged = on
}

/** Whether it's still the pre-season: before season 1 starts, ranked matches are stored unrated. */
export const preseason = (now = Date.now()) => staged ?? seasonAt(now) === null

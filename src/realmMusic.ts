import type { TownRoomId } from './data/realmMap'
import type { ThemeId } from './engine/music'

/**
 * The Poké Realm's music, in layers the realm's screens set and the shell's
 * music (`themeFor` in `main.ts`) reads: the realm lives in its own chunk, so
 * the layers live out here. The first one set wins (`themeFor` asks for the jukebox first, before the Rádio): a base's music piece (a
 * jukebox, a piano, a DJ booth, set every frame by `ui/realm.ts`), the mini
 * game open (`MINIGAMES[id].theme`, set by `realm/games/frame.ts`; a game may
 * change it as it plays, as the Safári does for its battles), then the room
 * the trainer stands in. All null outside the realm, so the lobby's music
 * comes back.
 */

/** What each town room plays; a secret base without a music piece plays the town's. */
const ROOM_THEMES = {
  plaza: 'realmTown',
  pier: 'fishing',
  cafe: 'cafe',
  trail: 'realmTown',
  arcade: 'arcade',
  gameCorner: 'gameCorner',
  base: 'realmTown',
} as const satisfies Record<TownRoomId | 'base', ThemeId>

let jukebox: ThemeId | null = null
let game: ThemeId | null = null
let room: ThemeId | null = null

/** The theme a base's music piece plays for this trainer now, null for the room's. */
export const setRealmJukebox = (theme: ThemeId | null) => {
  jukebox = theme
}

/** The mini game's theme while its screen is open (outside the realm too: `ps.minigame`), null once it closes. */
export const setRealmGame = (theme: ThemeId | null) => {
  game = theme
}

/** The room the trainer is in (`'base'`: anyone's secret base), null once out of the realm. */
export const setRealmRoom = (at: TownRoomId | 'base' | null) => {
  room = at === null ? null : ROOM_THEMES[at]
}

/** The base's music piece playing for this trainer, null for none: it wins over the Rádio too. */
export const realmJukebox = (): ThemeId | null => jukebox

/** The open mini game's theme, null for none: the Rádio counts it as a fight (`musicPlace` in `main.ts`). */
export const realmGame = (): ThemeId | null => game

/** The theme the realm wants under a base's music piece: the mini game open, else the room; null when nothing of it is open. */
export const realmTheme = (): ThemeId | null => game ?? room

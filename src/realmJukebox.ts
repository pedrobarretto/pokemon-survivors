import type { ThemeId } from './engine/music'

/**
 * The theme a secret base's music piece (a jukebox, a piano, a DJ booth)
 * plays for this trainer now, null for the realm's usual music. The realm's
 * screen (`ui/realm.ts`, in its own chunk) sets it every frame; the shell's
 * music (`themeFor` in `main.ts`) reads it, so it lives outside that chunk.
 */
let jukebox: ThemeId | null = null

export const setRealmJukebox = (theme: ThemeId | null) => {
  jukebox = theme
}

export const realmJukebox = () => jukebox

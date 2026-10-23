import type { Locale } from '../i18n'

export type Translator = {
  /** The language they reviewed. */
  locale: Locale
  name: string
  /** Their in-game @handle: the credit links to its public profile. */
  handle: string
  /** Their Discord username. */
  discord: string
}

/**
 * Players who reviewed a translation, credited in Settings → About, on the site's
 * legal page and in CREDITS.md (`scripts/credits.mjs`).
 */
export const TRANSLATORS = [{ locale: 'es', name: 'LauKhaos', handle: 'laukhaos', discord: 'laukhaos' }] as const satisfies readonly Translator[]

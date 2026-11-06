import { en } from './en'
import { es } from './es'
import { fr } from './fr'
import type { Locale } from './index'
import { pt, type Messages } from './pt'
import { zh } from './zh'

/** Every language's messages at once, for the site's pages rendered at build time (the game loads one, `loadLocale`). */
export const MESSAGES: Record<Locale, Messages> = { pt, en, es, fr, zh }

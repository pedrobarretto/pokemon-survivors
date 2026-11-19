import type { Locale } from '../i18n'
import { hans } from '../i18n/hans'

/**
 * The same text in every language, for the changelog. Portuguese, English and Spanish are required (the type makes a
 * missing one a compile error); French and Chinese came later, so older updates fall back to English there (Simplified
 * Chinese is never written: it's the Traditional, converted). Its own
 * module so the game can read the newest update without bundling the whole changelog (`ui/news.ts`).
 */
export type Localized = Readonly<Record<'pt' | 'en' | 'es', string>> & Readonly<Partial<Record<Locale, string>>>

/** A changelog text in `locale`, English where it has none. Simplified Chinese is the Traditional, converted (`i18n/hans.ts`). */
export const localized = (text: Localized, locale: Locale) => {
  const own = text[locale]
  if (own !== undefined) return own
  return locale === 'zhHans' && text.zh !== undefined ? hans(text.zh) : text.en
}

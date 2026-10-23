import type { Locale } from '../i18n'

/**
 * The same text in every language, for the changelog. Portuguese, English and Spanish are required (the type makes a
 * missing one a compile error); French and Chinese came later, so older updates fall back to English there. Its own
 * module so the game can read the newest update without bundling the whole changelog (`ui/news.ts`).
 */
export type Localized = Readonly<Record<'pt' | 'en' | 'es', string>> & Readonly<Partial<Record<Locale, string>>>

/** A changelog text in `locale`, English where it has none. */
export const localized = (text: Localized, locale: Locale) => text[locale] ?? text.en

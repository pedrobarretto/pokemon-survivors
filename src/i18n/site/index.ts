import type { Locale } from '..'
import { siteEn } from './en'
import { siteEs } from './es'
import { sitePt, type SiteMessages } from './pt'
import { siteTr } from './tr'

export type { SiteMessages }

/** Copy of the static site pages per language. Only `src/site` (build time) reads it; the game never loads it. */
export const SITE_MESSAGES = { pt: sitePt, en: siteEn, es: siteEs, tr: siteTr } as const satisfies Record<Locale, SiteMessages>

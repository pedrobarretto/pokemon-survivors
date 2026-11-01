import type { Locale } from '..'
import { siteEn } from './en'
import { siteEs } from './es'
import { siteFr } from './fr'
import { sitePt, type SiteMessages } from './pt'
import { siteZh } from './zh'
import { siteTr } from './tr'

export type { SiteMessages }

/** Copy of the static site pages per language. Only `src/site` (build time) reads it; the game never loads it. */
export const SITE_MESSAGES = { pt: sitePt, en: siteEn, es: siteEs, fr: siteFr, zh: siteZh, tr: siteTr } as const satisfies Record<Locale, SiteMessages>

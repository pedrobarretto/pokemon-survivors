import type { Locale } from '..'
import '../hansNow'
import { hansDeep } from '../hans'
import { siteEn } from './en'
import { siteEs } from './es'
import { siteFr } from './fr'
import { sitePt, type SiteMessages } from './pt'
import { siteZh } from './zh'

export type { SiteMessages }

/** Copy of the static site pages per language. Only `src/site` (build time) reads it; the game never loads it. */
export const SITE_MESSAGES = {
  pt: sitePt,
  en: siteEn,
  es: siteEs,
  fr: siteFr,
  zh: siteZh,
  // Made from the Traditional (`i18n/hans.ts`), under its own language tag.
  zhHans: { ...hansDeep(siteZh), lang: { tag: 'zh-Hans', og: 'zh_CN', short: '简中', switchTo: '以简体中文查看' } },
} as const satisfies Record<Locale, SiteMessages>

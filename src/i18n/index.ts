import { hansDeep, loadHans } from './hans'
import type { Messages } from './pt'

export type { Messages }

/** Supported languages, in menu order. `name` is always shown in its own language. */
export const LOCALES = {
  pt: { name: 'Português', short: 'PT', tag: 'pt-BR' },
  en: { name: 'English', short: 'EN', tag: 'en-US' },
  es: { name: 'Español', short: 'ES', tag: 'es-419' },
  fr: { name: 'Français', short: 'FR', tag: 'fr-FR' },
  zh: { name: '繁體中文', short: '繁中', tag: 'zh-TW' },
  zhHans: { name: '简体中文', short: '简中', tag: 'zh-CN' },
} as const satisfies Record<string, { name: string; short: string; tag: string }>

export type Locale = keyof typeof LOCALES

/** The languages text tables are written in: Simplified Chinese is made from the Traditional (`hans.ts`). */
export type Written = Exclude<Locale, 'zhHans'>

/**
 * Each language's messages in a chunk of its own: the game downloads only the
 * one it shows (the site's build-time pages read them all from `./messages`).
 */
const CATALOGS: Record<Locale, () => Promise<Messages>> = {
  pt: () => import('./pt').then((m) => m.pt),
  en: () => import('./en').then((m) => m.en),
  es: () => import('./es').then((m) => m.es),
  fr: () => import('./fr').then((m) => m.fr),
  zh: () => import('./zh').then((m) => m.zh),
  zhHans: async () => {
    const [{ zh }] = await Promise.all([import('./zh'), loadHans()])
    return hansDeep(zh)
  },
}

const loaded: Partial<Record<Locale, Messages>> = {}

/** Loads a language's messages once (a failed load, a stale chunk after a deploy, can be retried: nothing is kept until it lands). */
export const loadLocale = async (l: Locale): Promise<Messages> => (loaded[l] ??= await CATALOGS[l]())

export const LOCALE_IDS = Object.keys(LOCALES) as Locale[]

const KEY = 'ps:lang'

const isLocale = (v: unknown): v is Locale => typeof v === 'string' && v in LOCALES

/**
 * A language tag's locale (`pt-PT` → pt, `es-MX` → es), or null. Chinese goes by script: Traditional for
 * `Hant` and Taiwan, Hong Kong and Macau, Simplified for the rest (`zh-CN`, `zh-SG`, `zh-Hans`). A locale id
 * (a page's `data-locale`) is itself: a bare `zh` is the Traditional page's.
 */
const localeOfTag = (tag: string): Locale | null => {
  if (isLocale(tag)) return tag
  const [lang = '', ...rest] = tag.toLowerCase().split(/[-_]/)
  if (lang === 'zh') return rest.some((p) => p === 'hant' || p === 'tw' || p === 'hk' || p === 'mo') ? 'zh' : 'zhHans'
  return isLocale(lang) ? lang : null
}

/** Saved choice first, then the first browser language we support, else English. */
export const detectLocale = (saved: string | null, languages: readonly string[]): Locale =>
  isLocale(saved) ? saved : (languages.map(localeOfTag).find((l) => l !== null) ?? 'en')

const readSaved = () => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/**
 * A localized page (`/es/` sets `data-locale`) beats the browser language: search visitors play in the language they searched in.
 * `/en/` doesn't set it: it's the x-default page, which search shows a Spanish browser when `/es/` doesn't rank, so the browser decides there.
 */
const preferredLanguages = (): readonly string[] => {
  const page = globalThis.document?.documentElement.dataset.locale
  return page ? [page] : (globalThis.navigator?.languages ?? [])
}

let current: Locale = detectLocale(readSaved(), preferredLanguages())

export const locale = () => current

/**
 * Messages of the current language. Call it at render time, so a language switch shows up on the next render.
 * Empty until `loadShownLocale()` lands: `main.ts` waits for it before booting. Never wait for it with a
 * top-level `await` here: Safari 26 ran the importers while this module was still suspended, with its exports undefined.
 */
export const t = (): Messages => loaded[current]!

/**
 * The languages the boot tries, in order, when `l`'s chunk won't load (a flaky phone network, a chunk a deploy dropped):
 * Simplified Chinese reads the Traditional next (its OpenCC converter is a chunk of its own), then English, then Portuguese.
 */
export const fallbacksOf = (l: Locale): Locale[] => [...new Set<Locale>([l, ...(l === 'zhHans' ? (['zh'] as const) : []), 'en', 'pt'])]

const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))

/** The first of `order` that `load` lands, each tried `tries` times `pause` ms apart; throws the last error once none does. */
export const firstLoaded = async <L>(order: readonly L[], load: (l: L) => Promise<unknown>, tries = 2, pause = (ms: number) => wait(ms)): Promise<L> => {
  let last: unknown = new Error('nothing to load')
  for (const l of order) {
    for (let attempt = 0; attempt < tries; attempt++) {
      if (attempt > 0) await pause(400 * attempt)
      try {
        await load(l)
        return l
      } catch (e) {
        last = e
      }
    }
  }
  throw last
}

/**
 * Loads the language on show before the boot. Its chunk failing once left the page dark for good (the boot never ran): now it
 * falls back (`fallbacksOf`) and shows the first that lands, for this page only (the saved choice stays, the next load tries it again).
 */
export const loadShownLocale = async (): Promise<Locale> => (current = await firstLoaded(fallbacksOf(current), loadLocale))

/** Loads a language, then switches to it and remembers it. Screens re-render themselves (see `main.ts`). */
export const setLocale = async (next: Locale) => {
  await loadLocale(next)
  current = next
  document.documentElement.lang = LOCALES[next].tag
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // Storage blocked: the choice just lasts this session.
  }
}

/** The language after `l`, wrapping around: the menus cycle through them. */
export const nextLocale = (l: Locale) => LOCALE_IDS[(LOCALE_IDS.indexOf(l) + 1) % LOCALE_IDS.length]!

const numberFormats = new Map<string, Intl.NumberFormat>()

/**
 * Whole number with the current language's thousands separator (`1.250`, `1,250`).
 * The HUD formats the run's ₽ every frame, so each language's formatter is built once.
 */
export const formatNumber = (n: number) => {
  const tag = LOCALES[current].tag
  let format = numberFormats.get(tag)
  if (!format) numberFormats.set(tag, (format = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 })))
  return format.format(Math.round(n))
}

/** A number with up to `digits` decimals in the current language (`1,25` in pt and es, `1.25` in English). */
export const formatDecimal = (n: number, digits = 1) => n.toLocaleString(LOCALES[current].tag, { maximumFractionDigits: digits })

/** A `YYYY-MM-DD` day as day and month in the current language (`15/10`, `10/15`). */
export const formatDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString(LOCALES[current].tag, { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}

export const formatPokeDollars = (amount: number) => `₽ ${formatNumber(amount)}`

/** Big ₽ in short (`₽ 41,2M`, `₽ 50k`; below 1,000 in full), for the festival's pot and its milestones. */
export const formatPokeDollarsShort = (amount: number) =>
  amount >= 1_000_000 ? `₽ ${formatDecimal(Math.floor(amount / 100_000) / 10)}M` : amount >= 1_000 ? `₽ ${formatDecimal(Math.floor(amount / 100) / 10)}k` : formatPokeDollars(amount)

/** Whether the language on show is Chinese, either script (the CJK font, character wrapping). */
export const cjk = () => current === 'zh' || current === 'zhHans'

/** The language a text table is read in: Simplified Chinese reads the Traditional, converted (`inLanguage`). */
const written = (l: Locale): Written => (l === 'zhHans' ? 'zh' : l)

/** A table's text in the language on show, for tables read outside `t()`: Simplified Chinese gets the Traditional, converted. */
export const inLanguage = <T>(table: Readonly<Record<Written, T>>): T => (current === 'zhHans' ? hansDeep(table.zh) : table[written(current)])

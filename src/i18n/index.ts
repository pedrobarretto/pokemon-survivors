import { en } from './en'
import { es } from './es'
import { pt, type Messages } from './pt'

export type { Messages }

/** Supported languages, in menu order. `name` is always shown in its own language. */
export const LOCALES = {
  pt: { name: 'Português', short: 'PT', tag: 'pt-BR', messages: pt },
  en: { name: 'English', short: 'EN', tag: 'en-US', messages: en },
  es: { name: 'Español', short: 'ES', tag: 'es-419', messages: es },
} as const satisfies Record<string, { name: string; short: string; tag: string; messages: Messages }>

export type Locale = keyof typeof LOCALES

export const LOCALE_IDS = Object.keys(LOCALES) as Locale[]

const KEY = 'ps:lang'

const isLocale = (v: unknown): v is Locale => typeof v === 'string' && v in LOCALES

/** Saved choice first, then the first browser language we support (`pt-PT` → pt, `es-MX` → es), else English. */
export const detectLocale = (saved: string | null, languages: readonly string[]): Locale =>
  isLocale(saved) ? saved : (languages.map((l) => l.slice(0, 2).toLowerCase()).find(isLocale) ?? 'en')

const readSaved = () => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** A localized page (`/en/` and `/es/` set `data-locale`) beats the browser language: search visitors play in the language they searched in. */
const preferredLanguages = (): readonly string[] => {
  const page = globalThis.document?.documentElement.dataset.locale
  return page ? [page] : (globalThis.navigator?.languages ?? [])
}

let current: Locale = detectLocale(readSaved(), preferredLanguages())

export const locale = () => current

/** Messages of the current language. Call it at render time, so a language switch shows up on the next render. */
export const t = (): Messages => LOCALES[current].messages

/** Switches language and remembers it. Screens re-render themselves (see `main.ts`). */
export const setLocale = (next: Locale) => {
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

/** Whole number with the current language's thousands separator (`1.250`, `1,250`). */
export const formatNumber = (n: number) => Math.round(n).toLocaleString(LOCALES[current].tag)

/** A number with up to `digits` decimals in the current language (`1,25` in pt and es, `1.25` in English). */
export const formatDecimal = (n: number, digits = 1) => n.toLocaleString(LOCALES[current].tag, { maximumFractionDigits: digits })

/** A `YYYY-MM-DD` day as day and month in the current language (`15/10`, `10/15`). */
export const formatDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString(LOCALES[current].tag, { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}

export const formatPokeDollars = (amount: number) => `₽ ${formatNumber(amount)}`

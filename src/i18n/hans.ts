import type { ConverterFunction } from 'opencc-js/core'

/**
 * Simplified Chinese (`zhHans`, mainland China, Singapore, Malaysia) is made
 * from the Traditional Chinese text, never written by hand: OpenCC turns
 * Taiwan's words and characters into the mainland's (`twp` → `cn`: 登入 → 登录,
 * 伺服器 → 服务器), and `HANS_FIXES` says what its dictionary misses for the
 * game. The game loads the converter only for Simplified Chinese (`loadLocale`,
 * its own chunk); the site's pages convert at build time (`hansNow`).
 */

/**
 * Taiwan words OpenCC leaves as they are, or turns into the wrong mainland word, where the game uses them
 * (傳送門 is a portal, not a "sending door"; a Mewtwo 複製體 is a clone, not a copy).
 */
const HANS_FIXES: readonly [string, string][] = [
  ['帳號', '账号'],
  ['帳戶', '账户'],
  ['預設', '默认'],
  ['回饋', '反馈'],
  ['回報', '反馈'],
  ['登出', '退出登录'],
  ['傳送', '传送'],
  ['複製', '复制'],
  ['存檔', '存档'],
  ['空白鍵', '空格键'],
  ['手把', '手柄'],
  ['全螢幕', '全屏'],
  ['暱稱', '昵称'],
  ['智慧型手機', '智能手机'],
]

type OpenCC = typeof import('opencc-js/t2cn')

/** The converter, built from OpenCC's module. */
export const converterOf = (o: OpenCC): ConverterFunction => {
  const fix = o.CustomConverter(HANS_FIXES)
  const main = o.Converter({ from: 'twp', to: 'cn' })
  return (s) => main(fix(s))
}

let convert: ConverterFunction | null = null

/** Known strings, so text read every frame (a HUD's) converts once; cleared when it grows past `CACHE_MAX`. */
const cache = new Map<string, string>()
const CACHE_MAX = 20_000

/** Uses `c` from now on (the game once its chunk lands, the site's build at once). */
export const useConverter = (c: ConverterFunction) => {
  convert = c
  cache.clear()
}

/** Loads the converter's chunk, once. */
export const loadHans = async () => {
  if (!convert) useConverter(converterOf(await import('opencc-js/t2cn')))
}

/** `s` in Simplified Chinese (unchanged before the converter loads, and for text with nothing to convert). */
export const hans = (s: string): string => {
  if (!convert || !/[㐀-鿿豈-﫿]/.test(s)) return s
  const known = cache.get(s)
  if (known !== undefined) return known
  if (cache.size >= CACHE_MAX) cache.clear()
  const out = convert(s)
  cache.set(s, out)
  return out
}

const plain = (v: object) => {
  const proto: unknown = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

const done = new WeakMap<object, unknown>()

/**
 * A Traditional Chinese text table in Simplified Chinese: every string converted,
 * every function answering converted (it may build its text from its arguments),
 * arrays and plain objects walked. Anything else (numbers, ids) stays as it is.
 */
export const hansDeep = <T>(value: T): T => {
  if (typeof value === 'string') return hans(value) as T
  if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => unknown
    return ((...args: unknown[]) => hansDeep(fn(...args))) as T
  }
  if (typeof value !== 'object' || value === null) return value
  const seen = done.get(value)
  if (seen !== undefined) return seen as T
  const out = Array.isArray(value) ? value.map(hansDeep) : plain(value) ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, hansDeep(v)])) : value
  done.set(value, out)
  return out as T
}

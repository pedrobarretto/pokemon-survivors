import '../i18n/hansNow'
import { hans } from '../i18n/hans'

/** `from` swapped for `to`, every time it appears; throws when it's missing, so a change to the Traditional page that this no longer fits fails the build. */
const swap = (html: string, from: string | RegExp, to: string | ((m: string) => string)) => {
  const re = typeof from === 'string' ? new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g') : from
  if (!re.test(html)) throw new Error(`hansGamePage: ${String(from)} not found in zh-tw/index.html`)
  re.lastIndex = 0
  return typeof to === 'string' ? html.replace(re, to) : html.replace(re, to)
}

const TRAD_LINK = '<a href="https://www.pokemonsurvivors.com/zh-tw/" hreflang="zh-Hant">以繁體中文遊玩</a>'
const HANS_LINK = '<a href="https://www.pokemonsurvivors.com/zh-cn/" hreflang="zh-Hans">以简体中文游玩</a>'

/**
 * The Simplified Chinese game page (`/zh-cn/`, mainland China, Singapore,
 * Malaysia), made at build time from the Traditional one (`zh-tw/index.html`)
 * rather than kept by hand: its text through OpenCC (`i18n/hans.ts`), then its
 * own language, address, locale, manifest and currency. The links to the
 * Traditional page (its hreflang alternate, the footer's) stay on `/zh-tw/`.
 */
export const hansGamePage = (zhTw: string) => {
  let html = hans(zhTw)
  html = swap(html, /<!-- Traditional Chinese entry[^>]*-->/, '<!-- Simplified Chinese entry (mainland China, Singapore, Malaysia): made at build time from zh-tw/index.html (src/site/hansPage.ts), never edited by hand. -->')
  html = swap(html, '<html lang="zh-Hant" data-locale="zh">', '<html lang="zh-Hans" data-locale="zhHans">')
  html = swap(html, HANS_LINK, TRAD_LINK)
  html = swap(html, '/zh-tw/', '/zh-cn/')
  html = swap(html, /<(?:link|a)\b[^>]*hreflang="zh-Hant"[^>]*>/g, (tag) => tag.replace('/zh-cn/', '/zh-tw/'))
  html = swap(html, '<meta property="og:locale" content="zh_TW" />', '<meta property="og:locale" content="zh_CN" />')
  html = swap(html, '<meta property="og:locale:alternate" content="zh_CN" />', '<meta property="og:locale:alternate" content="zh_TW" />')
  html = swap(html, '/manifest.zh.webmanifest', '/manifest.zhHans.webmanifest')
  return swap(html, '"priceCurrency": "TWD"', '"priceCurrency": "CNY"')
}

/**
 * Social apps' own browsers (a link tapped inside Instagram opens in its
 * WebView), where Google sign-in refuses to run and activation is lowest.
 */
export type InAppBrowser = 'instagram' | 'facebook' | 'tiktok' | 'x' | 'snapchat' | 'line' | 'discord' | 'reddit' | 'telegram' | 'webview'

/** What each app writes into its WebView's user agent, Instagram before Facebook (Instagram's can carry Facebook's marks too). */
const MARKS: readonly (readonly [InAppBrowser, RegExp])[] = [
  ['instagram', /\bInstagram\b/i],
  ['facebook', /\bFBAN\/|\bFBAV\/|\bFB_IAB\/|\bFBIOS\b|\bFB4A\b|\bMessenger/],
  ['tiktok', /musical_ly|BytedanceWebview|\bTikTok\b|\btrill_/i],
  ['x', /\bTwitter/i],
  ['snapchat', /\bSnapchat\b/i],
  ['line', /\bLine\/\d/],
  ['discord', /\bDiscord\//],
  ['reddit', /\bReddit\//],
  ['telegram', /\bTelegram\b/i],
]

/**
 * The in-app browser `ua` belongs to, or null for a browser of its own. Any
 * other Android WebView (`; wv)`) or iOS WebView (WebKit without Safari's
 * token) is `webview`; `standalone` (an installed iOS web app, whose agent
 * lacks Safari's token too) never is.
 */
export const inAppBrowser = (ua: string, standalone = false): InAppBrowser | null => {
  const named = MARKS.find(([, mark]) => mark.test(ua))
  if (named) return named[0]
  if (/; wv\)/.test(ua)) return 'webview'
  if (!standalone && /\b(iPhone|iPad|iPod)\b/.test(ua) && /AppleWebKit/.test(ua) && !/Safari\//.test(ua)) return 'webview'
  return null
}

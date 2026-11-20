/**
 * The production domains, the only ones that send analytics (the game's
 * `analytics.ts` and the site's `site/siteAnalytics.ts`), unless a device
 * sets `ps:analytics` to `on` for testing. Plain data: the site imports it.
 */
export const LIVE_HOSTS = ['www.pokemonsurvivors.com', 'www.pokemonsurvivors.com.br']

/** Whether this page may send analytics: a key, and a production domain or the testing switch. */
export const analyticsLive = (key: string | undefined) => {
  if (!key) return false
  if (LIVE_HOSTS.includes(location.hostname)) return true
  try {
    return localStorage.getItem('ps:analytics') === 'on'
  } catch {
    return false
  }
}

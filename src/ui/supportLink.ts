import { accountState } from '../account'
import { locale } from '../i18n'
import { ROUTES } from '../site/routes'

/**
 * The support page (`/apoie/`), carrying the player's handle so a donation
 * goes to their account, and where in the game they came from (`from`, read
 * by the page's analytics, `site/siteAnalytics.ts`).
 */
export const supportPageUrl = (from: 'hall' | 'ask' | 'victory' | 'gems') => {
  const s = accountState()
  const handle = s.kind === 'signedIn' ? s.handle : null
  const params = new URLSearchParams({ ...(handle ? { u: handle } : {}), from })
  return `${ROUTES.support[locale()]}?${params}`
}

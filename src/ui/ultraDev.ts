import { isUltraBeast, ULTRA_BEASTS, type UltraBeast } from '../data/ultraBeasts'
import { brasiliaDay } from '../game/day'
import { ultraOfWeek, ultraWeekEnd } from '../game/ultraWeek'
import type { Game } from '../game/types'
import { startWormhole } from '../game/wormhole'
import { setUltra, today, ultraToday } from './save'

/**
 * Dev console for the Ultra Wormholes (`game/wormhole.ts`): `ps.wormhole()`
 * starts the run's wormhole omen now, its beast drawn as the run would
 * (`ps.wormhole('kartana')` that one; then `ps.riftAct('battle', 2)` and
 * `ps.riftAct('capture')` once inside, like any rift), and `ps.ultra('guzzlord')`
 * holds that beast as the week's until a reload (the lobby's card, the
 * partner select's ring and the next runs' odds; `ps.ultra(null)` back to
 * the calendar, `ps.ultra()` prints the week's and the next ones;
 * `ps.ultra('select')` opens the partner select on the Lendários tab, the
 * Ultra Beasts under the legends).
 */
export const ultraDevTools = (game: () => Game | undefined, legends: () => void) => ({
  wormhole: (beast?: UltraBeast) => {
    const g = game()
    if (!g) return 'ps: start a run first'
    if (beast !== undefined && !isUltraBeast(beast)) return `Ultra Beasts: ${ULTRA_BEASTS.join(', ')}`
    g.rift.omen = null
    g.rift.portal = null
    startWormhole(g, beast)
    return g.rift.omen
  },
  ultra: (beast?: UltraBeast | null | 'select') => {
    if (beast === 'select') return legends()
    if (beast === null || isUltraBeast(beast)) setUltra(beast)
    else if (beast !== undefined) return `Ultra Beasts: ${ULTRA_BEASTS.join(', ')}`
    const day = brasiliaDay(today())
    const weeks = Array.from({ length: 4 }, (_, i) => {
      const d = new Date(today().getTime() + i * 7 * 86_400_000)
      const k = brasiliaDay(d)
      return `${ultraWeekEnd(k)}: ${ultraOfWeek(k)}`
    })
    return { held: ultraToday(), week: ultraOfWeek(day), until: ultraWeekEnd(day), next: weeks }
  },
})

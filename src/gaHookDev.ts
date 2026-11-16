import { isVivillonPattern, VIVILLON_PATTERN_IDS } from './data/vivillon'
import { devicePattern, forcePattern } from './vivillonRegion'
import { fighterNow } from './game/gaHookSystem'
import { recomputeStats } from './game/leveling'
import type { Game } from './game/types'

/**
 * Dev-console stage for the hook families (`game/gaHookRules.ts`): `ps.kitH()`
 * prints the running player's kit (and Tyrogue's build), `ps.kitH({ charge: 23 })`
 * merges fields into it (and recomputes the stats); `ps.vivillon('polar')`
 * wears a pattern on this device from now on (`ps.vivillon(null)` back to
 * its region's, `ps.vivillon()` prints it and the list). Wired in `main.ts`
 * for dev builds only.
 */
export const gaHookDevTools = (game: () => Game | undefined) => ({
  kitH: (patch?: Readonly<Record<string, number | boolean>>) => {
    const g = game()
    const k = g?.player.kitH
    if (!g || !k) return console.warn('ps: start a run with one of the hook families (scatterbug, minior, tyrogue, plusle, minun)')
    if (patch) {
      Object.assign(k, patch)
      recomputeStats(g)
    }
    const build = fighterNow(g.player)
    return build ? { ...k, build } : { ...k }
  },
  vivillon: (pattern?: string | null) => {
    if (pattern === undefined) return { wearing: devicePattern(), patterns: VIVILLON_PATTERN_IDS }
    if (pattern !== null && !isVivillonPattern(pattern)) return console.warn(`ps: one of ${VIVILLON_PATTERN_IDS.join(', ')}`)
    forcePattern(pattern)
    return devicePattern()
  },
})

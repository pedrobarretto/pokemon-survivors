import { recomputeStats } from './leveling'
import type { Game } from './types'

/**
 * Dev-console stage for the big update's first 15 families (`gaKitARules.ts`):
 * `ps.kitA()` prints the running player's kit, `ps.kitA({ stacks: 5 })` merges
 * fields into it (and recomputes the stats), so a mechanic can be staged at its
 * peak. Wired in `main.ts` for dev builds only.
 */
export const gaKitADevTools = (game: () => Game | undefined) => ({
  kitA: (patch?: Readonly<Record<string, number | boolean>>) => {
    const g = game()
    const k = g?.player.kitA
    if (!g || !k) return console.warn('ps: start a run with one of the big update’s families (jangmoo, axew, lapras, sneasel, heracross, sableye, spiritomb, croagunk, sinistea, impidimp, pawmi, rookidee, elekid, magby, nincada)')
    if (patch) {
      Object.assign(k, patch)
      recomputeStats(g)
    }
    return { ...k }
  },
})

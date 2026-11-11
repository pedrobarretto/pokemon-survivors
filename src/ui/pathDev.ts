import { COSMOG, MELTAN, TRIALS, ZYGARDE, type PathId, type TrialId } from '../data/legendPaths'
import type { PlayableId } from '../data/hatchlings'
import { spawnMapEvent } from '../game/mapEvents'
import { NO_COSMOG } from '../game/legendPaths'
import type { Game } from '../game/types'
import { loadSpecies } from '../render/sprites'
import { loadSave, writeSave } from './save'

/**
 * Dev console helpers for the legend paths (`ps.*` in dev builds): stage a
 * run's Zygarde pieces and Regigigas's temple, and set each path's progress.
 */
export const pathDevTools = (game: () => Game | undefined, open: { menu: (id: PlayableId) => void; sheet: (path: PathId) => void }) => {
  const playing = (fn: (g: Game) => unknown) => {
    const g = game()
    if (!g) return console.warn('ps: start a run first')
    return fn(g)
  }
  const setPaths = (patch: Partial<ReturnType<typeof loadSave>['paths']>) => {
    const save = loadSave()
    writeSave({ ...save, paths: { ...save.paths, ...patch } })
    return loadSave().paths
  }
  return {
    /** `ps.cell()` puts a Zygarde Cell 60 px to the right of the player (`ps.cell('core')` a Core). */
    cell: (kind: 'cell' | 'core' = 'cell') => playing((g) => spawnMapEvent(g, kind === 'core' ? 'zygardeCore' : 'zygardeCell', g.player.x + 60, g.player.y)),
    /** `ps.temple()` raises Regigigas's temple 90 px to the right of the player; walk up to it to wake it. */
    temple: () =>
      playing((g) => {
        void loadSpecies(486).catch(() => {})
        return spawnMapEvent(g, 'regiTemple', g.player.x + 90, g.player.y)
      }),
    /** `ps.cube(50, 2)` sets the Zygarde Cube's Cells and Cores (`ps.cube()` fills it). */
    cube: (cells: number = ZYGARDE.cells, cores: number = ZYGARDE.cores) => setPaths({ cells, cores }),
    /** `ps.nuts(399)` sets Meltan's Hex Nuts (`ps.nuts()`: enough for Melmetal). */
    nuts: (n: number = MELTAN.nuts) => setPaths({ nuts: n }),
    /** `ps.cosmog(10, 7)` finishes Cosmog's research and sets its counted runs and how many were by day (`ps.cosmog('reset')` takes it back). */
    cosmog: (runs: number | 'reset' = 0, sun: number = 0) =>
      setPaths({ cosmog: runs === 'reset' ? NO_COSMOG : { research: [...COSMOG.research], runs, sun: Math.min(sun, runs), moon: Math.max(0, runs - sun), raised: loadSave().paths.cosmog.raised } }),
    /** `ps.paths('zygarde')` opens a path's sheet (`zygarde`, `cosmog`, `kubfu`, `meltan`, `regigigas`); `ps.paths('zygarde', 'menu')` the partner select's Lendários tab on that legend instead. */
    paths: (path: PathId = 'zygarde', where: 'sheet' | 'menu' = 'sheet') => {
      if (where === 'sheet') return open.sheet(path)
      open.menu(path === 'cosmog' ? 'solgaleo' : path)
    },
    /** `ps.trials('fist', 'crowd')` sets the Torre's trials cleared (none without an argument). */
    trials: (...ids: TrialId[]) => setPaths({ trials: ids.filter((id) => id in TRIALS) }),
  }
}

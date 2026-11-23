import { COSMOG, MELTAN, TRIALS, ZYGARDE, type PathId, type TrialId } from '../data/legendPaths'
import type { PlayableId } from '../data/hatchlings'
import { ENEMIES } from '../data/enemies'
import { RUINS_LEGENDS, type RuinsRegi } from '../data/legends'
import { spawnMapEvent } from '../game/mapEvents'
import { NO_COSMOG } from '../game/legendPaths'
import type { Game } from '../game/types'
import { loadSpecies } from '../render/sprites'
import { loadSave, writeSave } from './save'

/**
 * Dev console helpers for the legend paths (`ps.*` in dev builds): stage a
 * run's Zygarde pieces, Regigigas's temple and the Ruínas da Decisão, and set each path's progress.
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
    /** `ps.ruins()` raises the Ruínas da Decisão 110 px above the player, both Regis free (`ps.ruins('regidrago')` with only that one: the other's ruin stands dark); walk into a ruin's gate to wake its Regi. */
    ruins: (...free: RuinsRegi[]) =>
      playing((g) => {
        g.paths.ruinsFree = free.length > 0 ? RUINS_LEGENDS.filter((r) => free.includes(r)) : [...RUINS_LEGENDS]
        for (const r of g.paths.ruinsFree) void loadSpecies(ENEMIES[r].dex).catch(() => {})
        return spawnMapEvent(g, 'splitRuins', g.player.x, g.player.y - 110)
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

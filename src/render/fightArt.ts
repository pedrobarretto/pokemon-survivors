import { dropFightArt } from '../engine/pixelart'

/** What `inFight` reads of a game (`Game`'s boss, raid and rift). */
type FightView = { bossId: number | null; raid: { arena: object | null }; rift: { arena: object | null } }

/** Whether a fight is on: a boss with its HP bar (a wave's, a rift's), a Tera Raid or a rift's arena or domain. */
export const inFight = (g: FightView | null) => g !== null && (g.bossId !== null || g.raid.arena !== null || g.rift.arena !== null)

/**
 * Calls `drop` each time a fight ends: told whether one is on, it drops once on the way out (and
 * when the run is left mid-fight, told `false`), never while one goes on nor twice in a row.
 */
export const fightWatch = (drop: () => void) => {
  let was = false
  return (fighting: boolean) => {
    if (was && !fighting) drop()
    was = fighting
  }
}

/**
 * The shell's watch (`warmScenery`): as a boss wave, a raid or a rift ends, the fights' art goes
 * (`dropFightArt`: the big shapes, the raid's floor and crystals, the bosses' lanes).
 */
export const watchFights = fightWatch(dropFightArt)

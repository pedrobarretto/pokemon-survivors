import { PLAYABLE_IDS } from '../data/hatchlings'
import { COOP } from '../data/coop'
import { parseDifficulty, type Difficulty } from '../game/difficulty'
import { createCoopGame, type CoopLoadout } from '../game/game'
import { NO_RANKS, UPGRADE_IDS, UPGRADES, type Ranks, type UpgradeId } from '../game/meta'
import { isRecord } from '../game/parse'
import type { Game } from '../game/types'
import { parseWireLook, type Loadout, type RunStart, type Settings, type WireLook } from '../net/protocol'
import { isVersusPick, VERSUS_PICKS, type Team } from '../data/versus'
import { parseArenaFormat, type ArenaFormat } from '../data/arenaFormats'
import { createVersusGame } from '../game/versus'

/**
 * A co-op run's tick 0 from what the relay sends (`RunStart`): the seed, the
 * host's settings and each seat's loadout, all opaque JSON to the relay, read
 * here the same way on every client. Part of the simulation's build id.
 */

/**
 * What a player sends as their loadout: their Pokémon (a starter or a hatched
 * family, `PLAYABLE_IDS`: the Legend mode stays solo, `COOP_LOCKS`), Poké Mart
 * ranks, whether it plays shiny and, in a Versus room, the team they asked for
 * and the Arena look they wear (`look`: shape only here, the shell reads it
 * with `parseLook`; never the simulation's, so `startGame` leaves it out).
 */
export type CoopPick = { starter: (typeof PLAYABLE_IDS)[number]; ranks: Ranks; shiny: boolean; team?: Team; look?: WireLook }

/**
 * What a room plays: a co-op run against the horde, or a Versus match (`game/versus.ts`):
 * two teams on one map, the seats nobody takes played by bots.
 */
export type RoomMode = 'run' | 'versus'

/** The room's settings as the host sets them; `format` only matters in a Versus room (`data/arenaFormats.ts`, the standard 4v4 when left out). */
export type CoopSettings = { difficulty: Difficulty; mode?: RoomMode; format?: ArenaFormat }

export const loadoutOf = (pick: CoopPick): Loadout => ({
  starter: pick.starter,
  ranks: { ...pick.ranks },
  shiny: pick.shiny,
  ...(pick.team !== undefined && { team: pick.team }),
  ...(pick.look && Object.keys(pick.look).length > 0 && { look: { ...pick.look } }),
})

/** The settings on the wire: a Versus room says its format only when it isn't the standard (so a standard room's are what they always were). */
export const settingsOf = (s: CoopSettings): Settings => ({
  difficulty: s.difficulty,
  ...(s.mode === 'versus' && { mode: 'versus' }),
  ...(s.mode === 'versus' && s.format !== undefined && s.format !== 'standard' && { format: s.format }),
})

const rankOf = (raw: unknown, max: number) => (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? Math.min(raw, max) : 0)

/** A loadout from the wire: an unknown Pokémon (or a legend) falls back to the first starter, ranks are clamped to the Poké Mart's. */
export const parseLoadout = (raw: Loadout): CoopPick => {
  const starter = PLAYABLE_IDS.find((id) => id === raw.starter) ?? PLAYABLE_IDS[0]!
  const r = raw.ranks
  const ranks: Record<UpgradeId, number> = { ...NO_RANKS }
  if (isRecord(r)) for (const id of UPGRADE_IDS) ranks[id] = rankOf(r[id], UPGRADES[id].maxRank)
  const team = raw.team === 0 || raw.team === 1 ? raw.team : undefined
  const look = parseWireLook(raw.look)
  return { starter, ranks, shiny: raw.shiny === true, ...(team !== undefined && { team }), ...(look && { look }) }
}

export const parseSettings = (raw: Settings): CoopSettings => ({ difficulty: parseDifficulty(raw.difficulty), mode: raw.mode === 'versus' ? 'versus' : 'run', format: parseArenaFormat(raw.format) })

/** The loadouts of a run, by slot (`RunStart.players` order), with each player's name. */
export const runLoadouts = (start: RunStart): CoopLoadout[] =>
  start.players.map((p) => {
    const { starter, ranks, shiny } = parseLoadout(p.loadout)
    return { starter, ranks, shiny, name: p.name }
  })

/**
 * The run's game at tick 0: every client builds the same one. A Versus room
 * starts a match of its format: each seat plays its Pokémon if Versus offers
 * it (else the first of the roster) on the team it asked for.
 */
export const startGame = (start: RunStart): Game => {
  const settings = parseSettings(start.settings)
  if (settings.mode === 'versus') {
    const humans = start.players.map((p) => {
      const pick = parseLoadout(p.loadout)
      return { starter: isVersusPick(pick.starter) ? pick.starter : VERSUS_PICKS[0]!, name: p.name, ...(pick.team !== undefined && { team: pick.team }) }
    })
    return createVersusGame(start.seed, humans, settings.format)
  }
  return createCoopGame(start.seed, runLoadouts(start), { difficulty: settings.difficulty, view: { ...COOP.view } })
}

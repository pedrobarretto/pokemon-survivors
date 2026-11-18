import { PLAYABLE_IDS, type PlayableId } from '../data/hatchlings'
import { isLegend, type LegendId } from '../data/legends'
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
import { MAPS, type MapId } from '../data/versusMaps'
import { dailyCoopChallenge } from '../game/coopBoard'
import { isDayKey, type DayKey } from '../game/day'

/**
 * A co-op run's tick 0 from what the relay sends (`RunStart`): the seed, the
 * host's settings and each seat's loadout, all opaque JSON to the relay, read
 * here the same way on every client. Part of the simulation's build id.
 */

/** A regular Pokémon: a starter or a hatched family (`PLAYABLE_IDS`), never a legend. */
export type RegularId = (typeof PLAYABLE_IDS)[number]

/**
 * What a player sends as their loadout: their Pokémon (a starter or a hatched
 * family, `PLAYABLE_IDS`; in a Legend room, one of their captured legends),
 * Poké Mart ranks, whether it plays shiny and, in a Versus room, the team they
 * asked for and the Arena look they wear (`look`: shape only here, the shell
 * reads it with `parseLook`; never the simulation's, so `startGame` leaves it
 * out). `partner`: the regular Pokémon a legend seat plays when its legend
 * doesn't stand (`parseLoadout`). `legends`: the legends the API vouched the
 * account captured, written by the relay as the run starts (it strips any the
 * client sent); a legend starter stands only when it's among them.
 */
export type CoopPick = { starter: PlayableId; ranks: Ranks; shiny: boolean; team?: Team; look?: WireLook; partner?: RegularId; legends?: readonly LegendId[] }

/**
 * What a room plays: a co-op run against the horde, or a Versus match (`game/versus.ts`):
 * two teams on one map, the seats nobody takes played by bots.
 */
export type RoomMode = 'run' | 'versus'

/**
 * The room's settings as the host sets them; `format` and `map` only matter
 * in a Versus room (`data/arenaFormats.ts`, the standard 4v4 when left out;
 * the map one of the format's, drawn from the seed when left out: Random).
 * `challenge` only in a run room: it plays that day's Desafio co-op do dia
 * (`dailyCoopChallenge`), whose difficulty replaces `difficulty`. `raid`: the day
 * whose Tera Raid the run's late den holds (`raidOfDay`), set by the host's Start.
 * `legend`: the Modo Lendário, only in a run room and never with `challenge`:
 * each seat plays one of its captured legends (`parseLoadout`).
 */
export type CoopSettings = { difficulty: Difficulty; mode?: RoomMode; format?: ArenaFormat; map?: MapId; challenge?: DayKey; raid?: DayKey; legend?: true }

export const loadoutOf = (pick: CoopPick): Loadout => ({
  starter: pick.starter,
  ranks: { ...pick.ranks },
  shiny: pick.shiny,
  ...(pick.team !== undefined && { team: pick.team }),
  ...(pick.look && Object.keys(pick.look).length > 0 && { look: { ...pick.look } }),
  ...(pick.partner !== undefined && { partner: pick.partner }),
  ...(pick.legends && pick.legends.length > 0 && { legends: [...pick.legends] }),
})

/**
 * The settings on the wire: a Versus room says its format only when it isn't
 * the standard (so a standard room's are what they always were), and its map
 * only when the host picked one. A run room says `legend` only when on, and
 * never beside a challenge (the Desafio co-op do dia plays the normal mode).
 */
export const settingsOf = (s: CoopSettings): Settings => ({
  difficulty: s.difficulty,
  ...(s.mode === 'versus' && { mode: 'versus' }),
  ...(s.mode === 'versus' && s.format !== undefined && s.format !== 'standard' && { format: s.format }),
  ...(s.mode === 'versus' && s.map !== undefined && { map: s.map }),
  ...(s.mode !== 'versus' && s.challenge !== undefined && { challenge: s.challenge }),
  ...(s.mode !== 'versus' && s.raid !== undefined && { raid: s.raid }),
  ...(s.mode !== 'versus' && s.legend === true && s.challenge === undefined && { legend: true }),
})

const rankOf = (raw: unknown, max: number) => (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? Math.min(raw, max) : 0)

const regularOf = (raw: unknown): RegularId | undefined => PLAYABLE_IDS.find((id) => id === raw)

/** The vouched legends on the wire (the relay's), known ids only, each once. */
const legendsOf = (raw: unknown): LegendId[] => (Array.isArray(raw) ? [...new Set(raw.filter(isLegend))] : [])

/**
 * A loadout from the wire, the same on every client (it's the run's tick 0).
 * A regular Pokémon stands; a legend stands only in a Legend room
 * (`legendRoom`) and only when the relay vouched it (`legends`), else the seat
 * plays its `partner`, else the first starter (so does an unknown Pokémon).
 * Ranks are clamped to the Poké Mart's.
 */
export const parseLoadout = (raw: Loadout, legendRoom = false): CoopPick => {
  const legends = legendsOf(raw.legends)
  const partner = regularOf(raw.partner)
  const legend = isLegend(raw.starter) ? raw.starter : null
  const starter: PlayableId = legend !== null && legendRoom && legends.includes(legend) ? legend : (regularOf(raw.starter) ?? partner ?? PLAYABLE_IDS[0]!)
  const r = raw.ranks
  const ranks: Record<UpgradeId, number> = { ...NO_RANKS }
  if (isRecord(r)) for (const id of UPGRADE_IDS) ranks[id] = rankOf(r[id], UPGRADES[id].maxRank)
  const team = raw.team === 0 || raw.team === 1 ? raw.team : undefined
  const look = parseWireLook(raw.look)
  return {
    starter,
    ranks,
    shiny: raw.shiny === true,
    ...(team !== undefined && { team }),
    ...(look && { look }),
    ...(partner !== undefined && { partner }),
    ...(legends.length > 0 && { legends }),
  }
}

/** Settings from the wire: an unknown map is Random (left out), a challenge that isn't a day is none, and a challenge wins over the Modo Lendário. */
export const parseSettings = (raw: Settings): CoopSettings => {
  const map = (Object.keys(MAPS) as MapId[]).find((id) => id === raw.map)
  const mode = raw.mode === 'versus' ? 'versus' : 'run'
  const challenge = mode === 'run' && isDayKey(raw.challenge) ? raw.challenge : undefined
  const raid = mode === 'run' && isDayKey(raw.raid) ? raw.raid : undefined
  const legend = mode === 'run' && raw.legend === true && !challenge
  return {
    difficulty: parseDifficulty(raw.difficulty),
    mode,
    format: parseArenaFormat(raw.format),
    ...(map && { map }),
    ...(challenge && { challenge }),
    ...(raid && { raid }),
    ...(legend && { legend: true }),
  }
}

/** The loadouts of a run, by slot (`RunStart.players` order), with each player's name; legends stand only in a Legend room (`parseLoadout`). */
export const runLoadouts = (start: RunStart): CoopLoadout[] => {
  const legendRoom = parseSettings(start.settings).legend === true
  return start.players.map((p) => {
    const { starter, ranks, shiny } = parseLoadout(p.loadout, legendRoom)
    return { starter, ranks, shiny, name: p.name }
  })
}

/**
 * The run's game at tick 0: every client builds the same one. A Versus room
 * starts a match of its format, on its map (drawn from the seed when the host
 * left it Random or picked one the format doesn't play): each seat plays its
 * Pokémon if Versus offers it (else the first of the roster) on the team it
 * asked for. A run room in the Modo Lendário plays each seat's vouched legend
 * (`runLoadouts`); the Desafio co-op do dia never does.
 */
export const startGame = (start: RunStart): Game => {
  const settings = parseSettings(start.settings)
  if (settings.mode === 'versus') {
    const humans = start.players.map((p) => {
      const pick = parseLoadout(p.loadout)
      return { starter: isVersusPick(pick.starter) ? pick.starter : VERSUS_PICKS[0]!, name: p.name, ...(pick.team !== undefined && { team: pick.team }) }
    })
    return createVersusGame(start.seed, humans, settings.format, settings.map)
  }
  if (settings.challenge) {
    // The Desafio co-op do dia: the day's seed and difficulty, whatever the relay dealt, and every upgrade off.
    const c = dailyCoopChallenge(settings.challenge)
    const loadouts = runLoadouts(start).map((l) => ({ ...l, ranks: { ...NO_RANKS } }))
    return createCoopGame(c.seed, loadouts, { difficulty: c.difficulty, view: { ...COOP.view }, challenge: c.day, ...(settings.raid && { raidDay: settings.raid }) })
  }
  return createCoopGame(start.seed, runLoadouts(start), { difficulty: settings.difficulty, view: { ...COOP.view }, ...(settings.raid && { raidDay: settings.raid }) })
}

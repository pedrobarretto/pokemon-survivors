import { createRng, type SeededRng } from '../engine/rng'
import * as dm from '../engine/dmath'
import type { PlayableId } from '../data/hatchlings'
import { createCoopGame, type CoopLoadout } from '../game/game'
import { stepTick, onScreen, type TickEntry } from '../game/lockstep'
import { NO_RANKS, UPGRADE_IDS, UPGRADES, type Ranks } from '../game/meta'
import { moveCode } from '../game/replay'
import type { Difficulty } from '../game/difficulty'
import type { Game, Player } from '../game/types'

/**
 * Scripted co-op runs for the cross-engine harness (`npm run determinism`):
 * a team of bots fed to `stepTick` as tick entries, the way the relay stamps
 * them, so every engine plays the co-op simulation on the very same inputs.
 * Each bot kites the horde, heads into an open rift, goes to a fainted teammate, picks its cards a
 * beat after they show (as the round it saw), presses its special, goes away
 * and comes back once, and votes against the endless mode. A guardian keeps
 * the first bot's HP up so runs reach the late game (the others faint and get
 * revived); it's the harness's hand.
 * Everything goes through `dmath`, `moveCode` and the bots' own rng.
 */

export type CoopScenario = {
  seed: number
  /** Each slot's Pokémon (a starter, a hatched family or, as a Legend room seats them, a legend). */
  team: readonly PlayableId[]
  difficulty: Difficulty
  maxRanks: boolean
}

const FULL_RANKS = Object.fromEntries(UPGRADE_IDS.map((id) => [id, UPGRADES[id].maxRank])) as Ranks

/** A co-op run being played: the game, its tick and the bots' rng and pending picks. */
export type CoopDriver = { g: Game; tick: number; bot: SeededRng; picks: (number | null)[]; over: boolean }

export const startCoopScenario = (s: CoopScenario): CoopDriver => {
  const loadouts: CoopLoadout[] = s.team.map((starter, i) => ({ starter, ranks: s.maxRanks ? FULL_RANKS : NO_RANKS, shiny: i === 1, name: `bot${i}` }))
  return { g: createCoopGame(s.seed, loadouts, { difficulty: s.difficulty }), tick: 0, bot: createRng(s.seed ^ 0xc00b), picks: s.team.map(() => null), over: false }
}

/** A bot's stick: away from the foes close by, toward a fainted teammate within reach, plus a slow circle. */
const stickOf = (g: Game, p: Player, t: number) => {
  let x = dm.cos(t / 240 + p.slot * 1.7) * 0.5
  let y = dm.sin(t / 240 + p.slot * 1.7) * 0.5
  for (const e of g.enemies) {
    if (e.dying >= 0) continue
    const dx = p.x - e.x
    const dy = p.y - e.y
    const d2 = dx * dx + dy * dy
    if (d2 > 90 * 90 || d2 < 1) continue
    const k = (e.boss ? 3 : 1) / d2
    x += dx * k * 40
    y += dy * k * 40
  }
  // An open rift: the team heads in (its old arena in co-op).
  const portal = g.rift.portal
  if (portal) {
    const d = dm.hypot(portal.x - p.x, portal.y - p.y)
    if (d > 4) {
      x += ((portal.x - p.x) / d) * 1.2
      y += ((portal.y - p.y) / d) * 1.2
    }
  }
  for (const q of g.players) {
    if (q === p || q.gone || q.hp > 0) continue
    const d = dm.hypot(q.x - p.x, q.y - p.y)
    if (d < 260 && d > 4) {
      x = (q.x - p.x) / d
      y = (q.y - p.y) / d
    }
  }
  const len = dm.hypot(x, y)
  return moveCode(len > 1 ? { x: x / len, y: y / len } : { x, y })
}

/** This tick's entries for every bot. */
const entriesOf = (d: CoopDriver): TickEntry[] => {
  const { g, tick } = d
  const out: TickEntry[] = []
  for (const p of g.players) {
    const slot = p.slot
    if (p.gone) continue
    // Slot 1 goes away for 3 s at 2:00 (a locked phone) and comes back.
    if (slot === 1 && tick === 7200) out.push({ slot, kind: 'away' })
    if (slot === 1 && tick === 7380) out.push({ slot, kind: 'back' })
    if ((tick + slot * 5) % 15 === 0) out.push({ slot, kind: 'move', code: stickOf(g, p, tick) })
    if ((tick + slot * 37) % 300 === 0) out.push({ slot, kind: 'special' })
    if ((tick + slot * 53) % 400 === 100) out.push({ slot, kind: 'mega' })
    if (onScreen(p) && p.offers.length > 0) {
      const due = d.picks[slot] ?? null
      if (due === null) d.picks[slot] = tick + 20 + Math.floor(d.bot() * 90)
      else if (tick >= due) {
        out.push({ slot, kind: 'pick', screen: p.phase as Extract<TickEntry, { kind: 'pick' }>['screen'], round: p.round, index: Math.floor(d.bot() * p.offers.length) })
        d.picks[slot] = null
      }
    } else d.picks[slot] = null
    const vote = g.coop?.vote
    if (vote?.outcome === 'open' && vote.votes[slot] === null && (tick + slot) % 120 === 0) out.push({ slot, kind: 'endless', vote: false })
  }
  return out
}

/** Plays one tick. Returns false once the run is over (the wipe, or the victory's vote ended it). */
export const tickCoopScenario = (d: CoopDriver) => {
  const { g } = d
  if (g.phase === 'gameover' || (g.phase === 'victory' && g.coop?.vote?.outcome !== 'open')) d.over = true
  if (d.over) return false
  const guarded = g.players[0]!
  if (guarded.hp > 0 && guarded.hp < guarded.stats.maxHp * 0.5) guarded.hp = guarded.stats.maxHp
  stepTick(g, entriesOf(d))
  g.events.length = 0
  d.tick++
  return true
}

import { retain } from '../engine/math'
import { VERSUS, type Team } from '../data/versus'
import { MAPS, type MapId } from '../data/versusMaps'
import { rulesOf } from './versusRules'
import type { VersusState } from './versus'
import type { Game, Player } from './types'

/**
 * The Arena's social side: quick chat, pings and the surrender vote. All
 * three ride the lockstep as tick entries (`lockstep.ts`), so every client
 * applies them in the same order and the simulation, not the client, holds
 * the rate limits: a line or a ping past its player's bucket is dropped
 * everywhere alike. Lines and pings are plain data on the match
 * (`VersusState.talk`, `pings`) that no rule reads, kept a few seconds for
 * the shell to show (bubbles, the feed, markers); the vote ends the match.
 * Never the rng or the clock. Pure helpers first, then the match's side.
 */

/** The quick chat's lines, by id: a client sends the id and each screen reads it in its own language (`t().versus.chat`). */
export const QUICK_CHAT = ['go', 'retreat', 'help', 'objective', 'defend', 'jungle', 'thanks', 'gg'] as const
export type QuickChat = (typeof QUICK_CHAT)[number]

/** Lines both teams hear ("Bom jogo"); the rest stay with the sender's team. */
export const TO_ALL: ReadonlySet<QuickChat> = new Set<QuickChat>(['gg'])

/** What a ping on the map says: attack here, danger, on my way, the objective. */
export const PING_KINDS = ['attack', 'danger', 'omw', 'objective'] as const
export type PingKind = (typeof PING_KINDS)[number]

export const isQuickChat = (v: unknown): v is QuickChat => typeof v === 'string' && (QUICK_CHAT as readonly string[]).includes(v)
export const isPingKind = (v: unknown): v is PingKind => typeof v === 'string' && (PING_KINDS as readonly string[]).includes(v)

/** The scoreboard's stats, in its columns' order: each a number on `VersusSeat` (and on the match's result, `ArenaSeatResult`). */
export const BOARD_STATS = ['kos', 'assists', 'deaths', 'scored', 'dealt', 'taken', 'healed', 'interrupts'] as const
export type BoardStat = (typeof BOARD_STATS)[number]

/* ---------------- Rate limits ---------------- */

/** A token bucket: tokens left and when (s) they were last counted. */
export type Bucket = { tokens: number; at: number }
export type BucketRule = { readonly burst: number; readonly every: number }

export const fullBucket = (rule: BucketRule): Bucket => ({ tokens: rule.burst, at: 0 })

/**
 * Takes a token from `b` at `now` (s), refilling one every `rule.every`
 * seconds up to `rule.burst` first. False, with nothing taken, when it's
 * empty. The simulation runs it on `g.now`; the shell on its own clock, to
 * grey the buttons out before the simulation would drop the press.
 */
export const takeToken = (b: Bucket, now: number, rule: BucketRule) => {
  b.tokens = Math.min(rule.burst, b.tokens + Math.max(0, now - b.at) / rule.every)
  b.at = now
  if (b.tokens < 1) return false
  b.tokens -= 1
  return true
}

/* ---------------- The surrender vote ---------------- */

/** Yes votes a surrender needs from `voters` humans: two thirds, rounded up (1 of 1, 2 of 2, 2 of 3, 3 of 4). */
export const surrenderNeed = (voters: number) => Math.ceil((voters * 2) / 3)

export type VoteState = 'open' | 'passed' | 'failed'

/**
 * Where a vote stands with `yes` and `no` among `voters` humans: passed once
 * the yes reach `surrenderNeed`, failed when the time is up or the no leave
 * too few to reach it (or nobody is left to vote), open otherwise.
 */
export const voteState = (yes: number, no: number, voters: number, timeUp: boolean): VoteState => {
  const need = surrenderNeed(voters)
  if (voters > 0 && yes >= need) return 'passed'
  if (voters === 0 || timeUp || voters - no < need) return 'failed'
  return 'open'
}

/** A team's surrender vote: who proposed it, when it closes (match seconds) and the slots that voted each way. */
export type SurrenderVote = { by: number; ends: number; yes: number[]; no: number[] }

/**
 * The humans a surrender of `team` is counted among: on it, not a bot and not
 * gone (bots never vote). One away (a locked screen, a dropped link) still
 * counts without having voted, so the ones present can't give up for them.
 */
export const voters = (g: Game, team: Team) => g.players.filter((p) => p.versus?.team === team && !p.versus.bot && !p.gone)

/** The match second from which a team may propose its surrender: `VERSUS.surrender.from` of its format's clock. */
export const surrenderFrom = (s: Pick<VersusState, 'format'>) => rulesOf(s).length * VERSUS.surrender.from

/**
 * Whether `p` can propose their team's surrender now (`ready`), and if not
 * why: too early in the match, the team's cooldown after a failed vote (both
 * until the match second `until`), a vote already running, or they don't vote
 * (a bot, gone, away, the match over). Read by the shell's menu button.
 */
export const surrenderGate = (g: Game, p: Player): { state: 'ready' | 'early' | 'cooldown' | 'running' | 'no'; until: number } => {
  const s = g.versus
  const v = p.versus
  if (!s || !v || s.result || v.bot || p.gone || p.away) return { state: 'no', until: 0 }
  if (s.surrender[v.team]) return { state: 'running', until: 0 }
  const from = surrenderFrom(s)
  if (g.time < from) return { state: 'early', until: from }
  if (g.time < s.surrenderAt[v.team]) return { state: 'cooldown', until: s.surrenderAt[v.team] }
  return { state: 'ready', until: 0 }
}

/* ---------------- On the match ---------------- */

/** A quick chat line said at `at` (`g.now`), for both teams when `all`. */
export type Talk = { slot: number; msg: QuickChat; at: number; all: boolean }

/** A ping on the map at (x, y), made at `at` (`g.now`). Only the pinger's team sees it. */
export type Ping = { slot: number; kind: PingKind; x: number; y: number; at: number }

/** How many lines and pings the match keeps at most, whatever their age (a burst from eight players). */
const KEPT = 24

/** Whether `p` can speak in the match: a human seat still in it. */
const speaks = (p: Player) => !!p.versus && !p.versus.bot && !p.gone

/** `p` says quick chat line `msg`: kept and announced (`versusTalk`) unless their bucket is empty. */
export const sayQuick = (g: Game, p: Player, msg: QuickChat) => {
  const s = g.versus
  const v = p.versus
  if (!s || !v || !speaks(p) || !takeToken(v.talkBucket, g.now, VERSUS.talk)) return
  s.talk.push({ slot: p.slot, msg, at: g.now, all: TO_ALL.has(msg) })
  if (s.talk.length > KEPT) s.talk.shift()
  g.events.push({ kind: 'versusTalk', slot: p.slot, msg })
}

/** Each map's bounds (map px around the center), where a ping may land. */
const BOUNDS = Object.fromEntries(
  Object.entries(MAPS).map(([id, map]) => [id, map.rects.reduce((b, r) => ({ x0: Math.min(b.x0, r.x0), y0: Math.min(b.y0, r.y0), x1: Math.max(b.x1, r.x1), y1: Math.max(b.y1, r.y1) }), { x0: 0, y0: 0, x1: 0, y1: 0 })]),
) as Record<MapId, { x0: number; y0: number; x1: number; y1: number }>

/** `p` pings `kind` at (x, y), held to the map: kept and announced (`versusPing`) unless their bucket is empty. */
export const pingAt = (g: Game, p: Player, kind: PingKind, x: number, y: number) => {
  const s = g.versus
  const v = p.versus
  if (!s || !v || !speaks(p) || !takeToken(v.pingBucket, g.now, VERSUS.ping)) return
  const box = BOUNDS[s.map]
  const at = { x: Math.min(box.x1, Math.max(box.x0, x)), y: Math.min(box.y1, Math.max(box.y0, y)) }
  s.pings.push({ slot: p.slot, kind, x: at.x, y: at.y, at: g.now })
  if (s.pings.length > KEPT) s.pings.shift()
  g.events.push({ kind: 'versusPing', slot: p.slot, ping: kind, x: at.x, y: at.y })
}

/**
 * `p` votes on their team's surrender: a yes with no vote running proposes
 * one (from `surrenderFrom` on, and not while the team's cooldown
 * runs), counting as the proposer's yes; otherwise the first vote of each
 * player counts. The vote is counted each tick (`updateSurrender`).
 */
export const voteSurrender = (g: Game, p: Player, yes: boolean) => {
  const s = g.versus
  const v = p.versus
  if (!s || !v || s.result || !speaks(p) || p.away) return
  const team = v.team
  const vote = s.surrender[team]
  if (!vote) {
    if (!yes || g.time < surrenderFrom(s) || g.time < s.surrenderAt[team]) return
    s.surrender[team] = { by: p.slot, ends: g.time + VERSUS.surrender.window, yes: [p.slot], no: [] }
    g.events.push({ kind: 'versusSurrender', team, slot: p.slot, state: 'open' })
    return
  }
  if (vote.yes.includes(p.slot) || vote.no.includes(p.slot)) return
  ;(yes ? vote.yes : vote.no).push(p.slot)
}

/**
 * Each tick of a match: lines and pings past their time go, and each team's
 * vote is counted among its voters now (one who left the match no longer
 * counts; one away still does, without a vote). Returns the team whose surrender just passed (the match ends as
 * its loss), or null. A failed vote starts the team's cooldown.
 */
export const updateSocial = (g: Game): Team | null => {
  const s = g.versus
  if (!s) return null
  const now = g.now
  retain(s.talk, (l) => now - l.at < VERSUS.talk.keep)
  retain(s.pings, (p) => now - p.at < VERSUS.ping.keep)
  for (const team of [0, 1] as const) {
    const vote = s.surrender[team]
    if (!vote) continue
    const slots = voters(g, team).map((p) => p.slot)
    const yes = vote.yes.filter((slot) => slots.includes(slot)).length
    const no = vote.no.filter((slot) => slots.includes(slot)).length
    const state = voteState(yes, no, slots.length, g.time >= vote.ends)
    if (state === 'open') continue
    s.surrender[team] = null
    g.events.push({ kind: 'versusSurrender', team, slot: vote.by, state })
    if (state === 'passed') return team
    s.surrenderAt[team] = g.time + VERSUS.surrender.cooldown
  }
  return null
}

/* ---------------- Assists ---------------- */

/**
 * The slots credited with an assist on a knockout at `now`: everyone whose
 * last hit on the fallen Pokémon (`hitAt`, by slot) landed within `window`
 * seconds, but the one credited with the knockout itself (`credit`).
 */
export const assistsOf = (hitAt: readonly number[], now: number, window: number, credit: number) => {
  const out: number[] = []
  hitAt.forEach((at, slot) => {
    if (slot !== credit && now - at <= window) out.push(slot)
  })
  return out
}

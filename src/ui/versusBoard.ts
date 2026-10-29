import type { Team } from '../data/versus'
import { formAt } from '../game/branch'
import type { Game, Player } from '../game/types'
import { BOARD_STATS, type BoardStat } from '../game/versusSocial'
import { t } from '../i18n'
import { portraitUrl } from '../render/sprites'
import { teamColor } from './arena'
import { h } from './dom'
import { goalOrder, versusName } from './versusHud'
import { titleChip } from './arenaTitle'
import { lookOf } from '../render/arenaLooks'

/**
 * The Arena's scoreboard: one table per team, each Pokémon with its KOs,
 * assists, falls, points, damage dealt to and taken from rivals, healing and
 * interrupts (`VersusSeat`, `BOARD_STATS`), and its player's Arena title. The end screen shows it with the
 * match's medals; during the match it opens over the field while its key is
 * held, or from the score bar (`createLiveBoard`).
 */

/** A stat as a seat carries it now (whole numbers: damage and healing accumulate fractions). */
export const statOf = (p: Player, stat: BoardStat) => Math.round(p.versus?.[stat] ?? 0)

/** A stat compact enough for a phone's column: 1234 → 1.2k, 12345 → 12k. */
export const compact = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

/** A seat's name on the board, "(Você)" after this player's own. */
const boardName = (g: Game, me: Player, p: Player) => {
  const you = t().versus.you
  const name = versusName(g, p.slot)
  return p === me && name !== you ? `${name} (${you})` : name
}

export type BoardOptions = {
  /** Chips after a seat's name (the end screen's medals). */
  chips?: (p: Player) => HTMLElement[]
  /** Order of the rows: the end screen's best first; the live board by slot. */
  order?: (a: Player, b: Player) => number
  /** The live board: a knocked out Pokémon's row dims with its countdown. */
  live?: boolean
}

/** A team's goals as they stand (`goalOrder`: the map's layout): open with their points left, or broken. */
const goalPips = (g: Game, team: Team) => {
  const s = g.versus
  if (!s) return null
  const m = t().versus.hud.goals
  return h(
    'span',
    { class: 'vs-goals', style: `--team:${teamColor(team)}` },
    ...goalOrder(s, team).map(({ i, pos }) => {
      const goal = s.goals[i]!
      return h('i', { class: `vs-goal ${pos} ${goal.broken ? 'broken' : 'open'}`, title: m[pos] }, goal.broken ? '' : String(Math.max(0, Math.round(goal.left))))
    }),
  )
}

/** `team`'s table: its score and goals in the head, a row per Pokémon, a column per stat (each header naming it in full on hover). */
export const boardTable = (g: Game, me: Player, team: Team, opts: BoardOptions = {}) => {
  const m = t().versus.board
  const players = g.players.filter((p) => p.versus?.team === team)
  if (opts.order) players.sort(opts.order)
  const rows = players.map((p) => {
    const down = opts.live && p.hp <= 0 && (p.versus?.respawn ?? 0) > 0
    return h(
      'tr',
      { class: `${p === me ? 'me' : ''}${down ? ' down' : ''}` },
      h(
        'td',
        { class: 'vs-end-who' },
        h('img', { src: portraitUrl(formAt(p.starter, p.branch, p.stage).dex), alt: '' }),
        h(
          'span',
          { class: 'vs-end-name' },
          h('span', {}, boardName(g, me, p)),
          titleChip(lookOf(p.slot).title),
          ...(opts.live ? [h('small', { class: 'vs-board-level' }, down ? m.down(Math.ceil(p.versus?.respawn ?? 0)) : t().level(p.level))] : []),
          ...(opts.chips?.(p) ?? []),
        ),
      ),
      ...BOARD_STATS.map((stat) => h('td', { class: `vs-stat ${stat}` }, compact(statOf(p, stat)))),
    )
  })
  return h(
    'div',
    { class: `vs-end-team team${team}`, style: `--team:${teamColor(team)}` },
    h('div', { class: 'vs-end-team-head' }, h('b', {}, t().versus.teams[team]), goalPips(g, team), h('span', {}, String(g.versus?.score[team] ?? 0))),
    h(
      'div',
      { class: 'vs-board-scroll' },
      h(
        'table',
        {},
        h('thead', {}, h('tr', {}, h('th', {}, t().versus.end.pokemon), ...BOARD_STATS.map((stat) => h('th', { class: `vs-stat ${stat}`, title: m.full[stat], 'aria-label': m.full[stat] }, m.cols[stat])))),
        h('tbody', {}, ...rows),
      ),
    ),
  )
}

/** Both teams' tables, this player's team first. */
export const boardTables = (g: Game, me: Player, opts: BoardOptions = {}) => {
  const mine = me.versus?.team ?? 0
  const teams = mine === 0 ? ([0, 1] as const) : ([1, 0] as const)
  return h('div', { class: 'vs-end-tables' }, ...teams.map((team) => boardTable(g, me, team, opts)))
}

/** How often (s) the open live board rebuilds: the stats move a few times a second at most. */
const REFRESH = 0.25

/**
 * The scoreboard over the field during a match: `set(true)` shows it (its key
 * held, or the score bar tapped), and `update` rebuilds it a few times a
 * second while it shows. Taps on it close it (a phone has no key to let go).
 */
export const createLiveBoard = (root: HTMLElement, onTap: () => void) => {
  const body = h('div', { class: 'vs-board-body' })
  const el = h('div', { class: 'vs-board box hidden', role: 'dialog', 'aria-label': t().versus.board.title }, h('b', { class: 'vs-board-title' }, t().versus.board.title), body)
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onTap()
  })
  root.append(el)
  let open = false
  let built = -Infinity
  const set = (on: boolean) => {
    if (on === open) return
    open = on
    built = -Infinity
    el.classList.toggle('hidden', !on)
  }
  const update = (g: Game, me: Player) => {
    if (!open) return
    const now = performance.now() / 1000
    if (now - built < REFRESH) return
    built = now
    body.replaceChildren(boardTables(g, me, { live: true }))
  }
  return { el, set, update, isOpen: () => open, dispose: () => el.remove() }
}

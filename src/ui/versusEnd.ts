import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import type { Team } from '../data/versus'
import { formAt } from '../game/branch'
import type { Game, Player } from '../game/types'
import { t } from '../i18n'
import { arenaIconUrl, type ArenaIcon } from '../render/arenaArt'
import { portraitUrl } from '../render/sprites'
import { teamColor } from './arena'
import { h, later } from './dom'
import { menu, type Screen } from './screens'
import { goalOrder, versusName } from './versusHud'
import { formatChip } from './arenaQueue'
import { countArenaMatch } from './versusCoach'
import type { MatchKind } from '../data/arenaRanked'
import type { RpChange } from '../arenaApi'
import { tierBadge, tierName } from './arenaHub'

/**
 * A Versus match's end: Vitória, Derrota or Empate from this player's team,
 * the final score, the match's MVP, and a table per team (each Pokémon, its
 * KOs, falls, points and damage, best scorer first, with the match's medals). "Jogar de novo" starts the next
 * match (the shell's: a new one against bots, or the room's next run) and
 * says so while it gets ready; "Voltar ao lobby" leaves.
 */

export type VersusEndActions = { again: () => void; lobby: () => void }

/**
 * What the match did to the ranking: a quick match against bots is practice,
 * a friends' room and Casual move no RP, and Ranqueada waits on the API's
 * rating (`rp`, "Calculando…" until it answers).
 */
export type EndRank = { kind: MatchKind; rp: Promise<RpChange | null> | null }

/** The ranking line under the score. */
const rankLine = (rank: EndRank) => {
  const m = t().versus.end.rank
  if (rank.kind !== 'ranked' || !rank.rp) return h('p', { class: `vs-end-rank ${rank.kind}` }, rank.kind === 'ranked' ? m.late : m[rank.kind])
  const el = h('p', { class: 'vs-end-rank ranked waiting' }, h('span', { class: 'blink' }, m.calculating))
  void rank.rp.then((change) => {
    el.classList.remove('waiting')
    if (!change) return el.replaceChildren(m.late)
    const hub = t().versus.hub
    const view = change.profile?.tier ?? null
    el.classList.add(change.rp >= 0 ? 'up' : 'down')
    el.replaceChildren(
      ...(view ? [tierBadge(view)] : []),
      h('b', { class: 'vs-end-rp' }, hub.delta(change.rp)),
      ...(view && change.profile ? [h('span', {}, `${tierName(view)} · ${hub.rp(change.profile.rating.rp)}`)] : []),
    )
    if (change.rp > 0) playSfx('levelUp')
  })
  return el
}

/** Damage a player dealt in the match (the wild's and the rivals'). */
const damageOf = (p: Player) => Math.round(Object.values(p.damageByMove).reduce((a, b) => a + (b ?? 0), 0))

/** Best of the match first: points, then KOs, then damage. */
const better = (a: Player, b: Player) => (b.versus?.scored ?? 0) - (a.versus?.scored ?? 0) || (b.versus?.kos ?? 0) - (a.versus?.kos ?? 0) || damageOf(b) - damageOf(a)

type Medal = 'points' | 'kos' | 'damage'

/** The match's medals: who scored most, knocked out most and dealt most damage (none for a zero). Ties go to the better player. */
const medalsOf = (g: Game) => {
  const ranked = g.players.filter((p) => p.versus).sort(better)
  const top = (of: (p: Player) => number) => ranked.reduce<Player | null>((best, p) => (of(p) > 0 && (!best || of(p) > of(best)) ? p : best), null)
  const medals = new Map<Player, Medal[]>()
  const give = (p: Player | null, medal: Medal) => p && medals.set(p, [...(medals.get(p) ?? []), medal])
  give(top((p) => p.versus!.scored), 'points')
  give(top((p) => p.versus!.kos), 'kos')
  give(top(damageOf), 'damage')
  return { mvp: ranked[0] ?? null, medals }
}

const MEDAL_ICONS = { points: 'medalPoints', kos: 'medalKos', damage: 'medalDamage' } as const satisfies Record<Medal, ArenaIcon>

const medalChip = (medal: Medal) => h('em', { class: `vs-medal ${medal}` }, h('img', { src: arenaIconUrl(MEDAL_ICONS[medal]), alt: '' }), t().versus.end.medals[medal])

/** A seat's name on this screen, "(Você)" after this player's own. */
const endName = (g: Game, me: Player, p: Player) => (p === me && versusName(g, p.slot) !== t().versus.you ? `${versusName(g, p.slot)} (${t().versus.you})` : versusName(g, p.slot))

/** The match's best player: big portrait in their team's color, name and line. */
const mvpCard = (g: Game, me: Player, p: Player) => {
  const v = p.versus!
  const m = t().versus.end
  return h(
    'div',
    { class: 'vs-mvp', style: `--team:${teamColor(v.team)}` },
    h('img', { src: portraitUrl(formAt(p.starter, p.branch, p.stage).dex), alt: '' }),
    h('div', { class: 'vs-mvp-text' }, h('b', { class: 'vs-mvp-tag' }, h('img', { src: arenaIconUrl('mvp'), alt: '' }), m.mvp), h('span', { class: 'vs-mvp-name' }, endName(g, me, p)), h('small', {}, m.mvpLine(v.scored, v.kos, damageOf(p)))),
  )
}

/** A team's goals as they ended (`goalOrder`: the map's layout): standing with their points left, or broken. */
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

/** One team's table, best scorer first, each row with its medals. */
const teamTable = (g: Game, me: Player, team: Team, medals: ReadonlyMap<Player, readonly Medal[]>) => {
  const m = t().versus.end
  const rows = g.players
    .filter((p) => p.versus?.team === team)
    .sort(better)
    .map((p) => {
      const v = p.versus!
      return h(
        'tr',
        { class: p === me ? 'me' : '' },
        h(
          'td',
          { class: 'vs-end-who' },
          h('img', { src: portraitUrl(formAt(p.starter, p.branch, p.stage).dex), alt: '' }),
          h('span', { class: 'vs-end-name' }, h('span', {}, endName(g, me, p)), ...(medals.get(p) ?? []).map(medalChip)),
        ),
        h('td', {}, String(v.kos)),
        h('td', {}, String(v.deaths)),
        h('td', { class: 'vs-end-points' }, String(v.scored)),
        h('td', {}, String(damageOf(p))),
      )
    })
  return h(
    'div',
    { class: `vs-end-team team${team}`, style: `--team:${teamColor(team)}` },
    h('div', { class: 'vs-end-team-head' }, h('b', {}, t().versus.teams[team]), goalPips(g, team), h('span', {}, String(g.versus?.score[team] ?? 0))),
    h(
      'table',
      {},
      h('thead', {}, h('tr', {}, h('th', {}, m.pokemon), h('th', {}, m.kos), h('th', {}, m.deaths), h('th', {}, m.points), h('th', {}, m.damage))),
      h('tbody', {}, ...rows),
    ),
  )
}

export const versusEnd = (root: HTMLElement, input: Input, g: Game, me: Player, actions: VersusEndActions, rank: EndRank | null = null): Screen => {
  const m = t().versus.end
  const s = g.versus
  const mine = me.versus?.team ?? 0
  const winner = s?.result?.winner ?? null
  const outcome = winner === null ? 'draw' : winner === mine ? 'victory' : 'defeat'
  const status = h('p', { class: 'vs-end-status', role: 'status' })
  const again = h('button', { class: 'btn confirm', type: 'button' }, m.playAgain)
  const lobby = h('button', { class: 'btn', type: 'button' }, m.lobby)
  let asked = false
  const nav = menu(
    input,
    [again, lobby],
    (i) => {
      playSfx('select')
      if (i === 1) return later(actions.lobby)
      if (asked) return
      asked = true
      again.disabled = true
      status.textContent = m.again
      later(actions.again)
    },
    { horizontal: true, guard: 900 },
  )
  // Your team's table first.
  const teams = mine === 0 ? ([0, 1] as const) : ([1, 0] as const)
  const { mvp, medals } = medalsOf(g)
  countArenaMatch()
  const el = h(
    'div',
    { class: 'screen dim vs-end' },
    h(
      'div',
      { class: `dialog box pop vs-end-box ${outcome}`, style: `--team:${teamColor(mine)}` },
      h('div', { class: 'vs-end-title' }, m[outcome]),
      h(
        'div',
        { class: 'vs-end-score' },
        h('b', { style: `color:${teamColor(0)}` }, String(s?.score[0] ?? 0)),
        h('span', {}, ':'),
        h('b', { style: `color:${teamColor(1)}` }, String(s?.score[1] ?? 0)),
      ),
      s ? h('div', { class: 'vs-end-format' }, formatChip(s.format), h('span', { class: 'arena-format-chip map' }, t().versus.maps[s.map])) : null,
      rank && rankLine(rank),
      mvp && mvpCard(g, me, mvp),
      h('div', { class: 'vs-end-tables' }, ...teams.map((team) => teamTable(g, me, team, medals))),
      status,
      h('div', { class: 'buttons' }, again, lobby),
    ),
  )
  root.append(el)
  return { el, dim: 0.6, dispose: () => (nav.off(), el.remove()) }
}

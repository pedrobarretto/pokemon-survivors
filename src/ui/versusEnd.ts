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
import { versusName } from './versusHud'
import { formatChip } from './arenaQueue'
import { countArenaMatch } from './versusCoach'
import type { MatchKind } from '../data/arenaRanked'
import type { RpChange } from '../arenaApi'
import { preseason, season1Date, tierBadge, tierName } from './arenaHub'
import { boardTables } from './versusBoard'
import { victoryPose } from '../render/arenaFx'
import { ARENA_RANKED } from '../data/arenaRanked'

/**
 * A Versus match's end: Vitória, Derrota or Empate from this player's team
 * (a win with their equipped emote playing over it) and who surrendered,
 * when a team did, the final score, the match's MVP,
 * and the scoreboard (`versusBoard.ts`), best scorer first, with the match's
 * medals. "Jogar de novo" starts the next match (the shell's: a new one
 * against bots, or the room's next run: "Revanche", with how many of the room
 * are ready) and says so while it gets ready; a public queue's match adds
 * "Revanche com o time" (back to the queue as a party with the teammates who
 * press it too); "Voltar ao lobby" leaves.
 */

export type VersusEndActions = {
  again: () => void
  lobby: () => void
  /** A friends' room: "Revanche", and how many of the room online are ready for it (the host counts). */
  ready?: () => { ready: number; total: number }
  /** A public queue's match: requeue as a party with the teammates who also press it. */
  team?: () => void
}

/**
 * What the match did to the ranking: a quick match against bots is practice,
 * a friends' room and Casual move no RP, and Ranqueada waits on the API's
 * rating (`rp`, "Calculando…" until it answers; "Proteção usada!" when the
 * meter took the loss). Before season 1 a Ranqueada is kept without RP, and
 * the line says so instead.
 */
export type EndRank = { kind: MatchKind; rp: Promise<RpChange | null> | null }

/** The ranking line under the score. */
const rankLine = (rank: EndRank) => {
  const m = t().versus.end.rank
  if (rank.kind === 'ranked' && preseason()) return h('p', { class: 'vs-end-rank ranked preseason' }, m.preseason(season1Date()))
  if (rank.kind !== 'ranked' || !rank.rp) return h('p', { class: `vs-end-rank ${rank.kind}` }, rank.kind === 'ranked' ? m.late : m[rank.kind])
  const el = h('p', { class: 'vs-end-rank ranked waiting' }, h('span', { class: 'blink' }, m.calculating))
  void rank.rp.then((change) => {
    el.classList.remove('waiting')
    if (!change) return el.replaceChildren(m.late)
    const hub = t().versus.hub
    const view = change.profile?.tier ?? null
    el.classList.add(change.protected ? 'shield' : change.rp >= 0 ? 'up' : 'down')
    el.replaceChildren(
      ...(view ? [tierBadge(view)] : []),
      h('b', { class: 'vs-end-rp' }, hub.delta(change.rp)),
      ...(change.protected ? [h('span', { class: 'vs-end-shield' }, m.protected)] : []),
      ...(view && change.profile ? [h('span', {}, `${tierName(view)} · ${hub.rp(change.profile.rating.rp)}`)] : []),
    )
    if (change.rp > 0 || change.protected) playSfx('levelUp')
  })
  return el
}

/** How long (ms) a room's "Revanche" count refreshes while the screen shows. */
const READY_EVERY = 500

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

const medalChip = (medal: Medal): HTMLElement => h('em', { class: `vs-medal ${medal}` }, h('img', { src: arenaIconUrl(MEDAL_ICONS[medal]), alt: '' }), t().versus.end.medals[medal])

/** A seat's name on this screen, "(Você)" after this player's own. */
const endName = (g: Game, me: Player, p: Player) => (p === me && versusName(g, p.slot) !== t().versus.you ? `${versusName(g, p.slot)} (${t().versus.you})` : versusName(g, p.slot))

/** The line under the title when a team surrendered, from this player's side. */
const surrenderLine = (g: Game, mine: Team) => {
  const gave = g.versus?.result?.surrender
  if (gave === null || gave === undefined) return null
  const m = t().versus.end
  return h('p', { class: 'vs-end-surrender' }, gave === mine ? m.surrendered : m.theySurrendered)
}

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

export const versusEnd = (root: HTMLElement, input: Input, g: Game, me: Player, actions: VersusEndActions, rank: EndRank | null = null): Screen => {
  const m = t().versus.end
  const s = g.versus
  const mine = me.versus?.team ?? 0
  const winner = s?.result?.winner ?? null
  const outcome = winner === null ? 'draw' : winner === mine ? 'victory' : 'defeat'
  const status = h('p', { class: 'vs-end-status', role: 'status' })
  const room = actions.ready
  const again = h('button', { class: 'btn confirm', type: 'button' }, room ? m.rematch : m.playAgain)
  const team = actions.team && h('button', { class: 'btn', type: 'button' }, m.rematchTeam)
  const lobby = h('button', { class: 'btn', type: 'button' }, m.lobby)
  const buttons = [again, ...(team ? [team] : []), lobby]
  let asked = false
  /** A room's "Revanche": who's ready, refreshed while the screen shows. */
  const readyLine = () => {
    const r = room?.()
    if (r && r.total > 1) status.textContent = `${asked ? `${m.again} · ` : ''}${m.readyCount(r.ready, r.total)}`
  }
  const timer = room ? setInterval(readyLine, READY_EVERY) : null
  const nav = menu(
    input,
    buttons,
    (i) => {
      playSfx('select')
      const pressed = buttons[i]
      if (pressed === lobby) return later(actions.lobby)
      if (asked) return
      asked = true
      for (const b of buttons) if (b !== lobby) b.disabled = true
      if (pressed === team && actions.team) {
        status.textContent = m.rematchNote(ARENA_RANKED.queue.partyGrace)
        return later(actions.team)
      }
      status.textContent = m.again
      readyLine()
      later(actions.again)
    },
    { horizontal: true, guard: 900 },
  )
  const { mvp, medals } = medalsOf(g)
  // A win shows off the equipped emote (`render/arenaFx.ts`).
  const pose = outcome === 'victory' ? victoryPose(me) : null
  countArenaMatch()
  const el = h(
    'div',
    { class: 'screen dim vs-end' },
    h(
      'div',
      { class: `dialog box pop vs-end-box ${outcome}`, style: `--team:${teamColor(mine)}` },
      pose?.el,
      h('div', { class: 'vs-end-title' }, m[outcome]),
      surrenderLine(g, mine),
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
      boardTables(g, me, { order: better, chips: (p) => (medals.get(p) ?? []).map(medalChip) }),
      status,
      h('div', { class: 'buttons' }, ...buttons),
    ),
  )
  root.append(el)
  readyLine()
  return { el, dim: 0.6, dispose: () => (nav.off(), timer !== null && clearInterval(timer), pose?.dispose(), el.remove()) }
}

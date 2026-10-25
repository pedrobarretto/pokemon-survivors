import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { formatTime } from '../engine/math'
import { ABILITIES } from '../data/abilities'
import { COOP } from '../data/coop'
import { TYPE_COLORS } from '../data/types'
import { formAt } from '../game/branch'
import { awayHold, coopPayout, coopStats, type PlayerStats } from '../game/coop'
import { MOVES } from '../game/moves'
import { localPlayer, phaseOf } from '../game/players'
import { resolveSpecial } from '../game/special'
import type { DamageSource, Game, GameEvent, Player } from '../game/types'
import { formatNumber, formatPokeDollars, locale, LOCALES, t } from '../i18n'
import { abilityIcon } from '../render/abilityArt'
import { coinIcon, moveIcon, sparkleIcon, teamBallIcon } from '../render/art'
import { specialIcon } from '../render/specialFx'
import { portraitUrl } from '../render/sprites'
import { slotColor } from '../render/team'
import { h, later, rich, setStyle, setText } from './dom'
import { difficultyTag, menu, type Screen } from './screens'
import { teamAwards } from './teamAwards'
import { seatName } from './teamHud'
import { runToast } from './toasts'

/**
 * Co-op screens and banners: the team's wait while a teammate picks a
 * level-up, the clock on every pick screen, the spectator's banner, the
 * victory's endless vote and the end screen with everyone's numbers. They read
 * the run (`Game`) and act through the callbacks the shell gives them (`send`,
 * play again, lobby): nothing here touches the simulation.
 */

/** Seconds left on a pick screen, rounded up as the clock shows them. */
const secondsLeft = (p: Player) => Math.max(0, Math.ceil(p.pickLeft))

/** A small portrait chip framed in a seat's color. */
const face = (p: Player, cls = 'team-chip-face') => {
  const dex = formAt(p.starter, p.branch, p.stage).dex
  return h('img', { class: cls, src: portraitUrl(dex, p.shiny), alt: '', style: `--slot:${slotColor(p.slot)}` })
}

/** Whether `p` is still on the team's level-up (the pause that holds the world). */
const onLevelUp = (g: Game, p: Player) => !p.gone && phaseOf(g, p) === 'levelup'

type Chip = { el: HTMLElement; state: HTMLElement }

/** One chip per teammate still in the run: their face and name, and ✓ or a countdown. `update` rewrites the states. */
const teamChips = (g: Game, skip: Player | null) => {
  const chips = new Map<number, Chip>()
  const el = h('div', { class: 'team-chips' })
  for (const p of g.players) {
    if (p === skip || p.gone) continue
    const state = h('span', { class: 'team-chip-state' })
    const chip = h('span', { class: 'team-chip', style: `--slot:${slotColor(p.slot)}` }, face(p), h('span', { class: 'team-chip-name' }, seatName(g, p.slot)), state)
    chips.set(p.slot, { el: chip, state })
    el.append(chip)
  }
  const update = () => {
    for (const p of g.players) {
      const chip = chips.get(p.slot)
      if (!chip) continue
      const picking = onLevelUp(g, p)
      chip.el.classList.toggle('done', !picking)
      setText(chip.state, picking ? `${secondsLeft(p)}s` : '✓')
    }
  }
  update()
  return { el, update }
}

/** A draining bar for `left` of `total` seconds. */
const clockBar = () => {
  const fill = h('div', { class: 'team-bar-fill' })
  const el = h('div', { class: 'team-bar' }, fill)
  return { el, set: (left: number, total: number) => setStyle(fill, 'width', `${Math.round(Math.max(0, Math.min(1, left / total)) * 100)}%`) }
}

/**
 * The world held by teammates' level-ups after this player picked (or had
 * none): who's still choosing, their seconds, and the longest clock left.
 * Not modal: it goes right after the team's cards (`after`), and CSS puts it
 * under them on a phone held upright, under the timer elsewhere.
 */
export const teamWait = (after: HTMLElement, g: Game, me: Player) => {
  const chips = teamChips(g, me)
  const bar = clockBar()
  const el = h('div', { class: 'team-wait box pop' }, h('div', { class: 'team-wait-title' }, t().team.waiting), chips.el, bar.el)
  after.after(el)
  const update = () => {
    chips.update()
    let left = 0
    for (const p of g.players) if (onLevelUp(g, p)) left = Math.max(left, p.pickLeft)
    bar.set(left, COOP.pick.time)
  }
  update()
  return { el, update, dispose: () => el.remove() }
}

/**
 * The world held for an away teammate (a locked phone, a dropped
 * connection): who it waits on and how long it still will (`awayHold`, m:ss),
 * after which the run goes on without them. Placed like `teamWait`.
 */
export const awayWait = (after: HTMLElement, g: Game) => {
  const title = h('div', { class: 'team-wait-title' })
  const el = h('div', { class: 'team-wait box pop' }, title)
  after.after(el)
  let shown = ''
  const update = () => {
    const hold = awayHold(g)
    const s = hold ? Math.ceil(hold.left) : 0
    const text = hold ? t().team.awayWait(seatName(g, hold.slot), `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`) : ''
    if (text === shown) return
    shown = text
    title.replaceChildren(rich(text))
  }
  update()
  return { el, update, dispose: () => el.remove() }
}

/**
 * The clock every co-op pick screen wears (`decorate`): "auto pick in 12s"
 * with a draining bar; the team's level-up adds who already picked.
 */
export const pickClock = (g: Game, me: Player, withTeam: boolean) => {
  const label = h('span', { class: 'pick-clock-label' })
  const bar = clockBar()
  const chips = withTeam && g.players.some((p) => p !== me && !p.gone) ? teamChips(g, me) : null
  const el = h('div', { class: 'pick-clock' }, h('div', { class: 'pick-clock-row' }, label, bar.el), chips?.el)
  let shown = -1
  const update = () => {
    const s = secondsLeft(me)
    if (s !== shown) {
      shown = s
      label.replaceChildren(rich(t().team.auto(s)))
      el.classList.toggle('urgent', s <= 5)
    }
    bar.set(me.pickLeft, COOP.pick.time)
    chips?.update()
  }
  update()
  return { el, update }
}

/**
 * While this player lies fainted and a teammate stands: who the camera
 * watches, and a tap (or Tab, Q, the special) to switch. `next` cycles.
 */
export const spectatorBanner = (root: HTMLElement, next: () => void) => {
  const m = t().team
  const watching = h('span', { class: 'spectate-watch' })
  const el = h(
    'button',
    { class: 'spectate box pop hidden', type: 'button' },
    h('img', { class: 'spectate-ball', src: teamBallIcon(), alt: '' }),
    h('span', { class: 'spectate-text' }, h('b', {}, m.fainted), h('small', {}, m.reviveHint), watching, h('small', { class: 'spectate-hint' }, h('span', { class: 'keys-only' }, m.nextKeys), h('span', { class: 'touch-only' }, m.nextTouch))),
  )
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    playSfx('move')
    next()
  })
  root.append(el)
  let name = ''
  const show = (watched: string | null) => {
    el.classList.toggle('hidden', watched === null)
    if (watched === null || watched === name) return
    name = watched
    watching.replaceChildren(rich(m.watching(watched)))
  }
  return { el, show, dispose: () => el.remove() }
}

/* ---------------- The end: endless vote and results ---------------- */

/** Where "Jogar de novo" stands: whether this player asked for it, and how many of the room's members online are ready. */
export type AgainState = { asked: boolean; host: boolean; ready: number; total: number }

/**
 * What the end screen does: vote on the endless offer (sent as a tick entry),
 * play again with the same team (`again` says how far that got), or back to the lobby.
 */
export type EndActions = { vote: (endless: boolean) => void; playAgain: () => void; lobby: () => void; again: () => AgainState }

/** How long the end screen ignores confirms (the fight's last presses), as the solo results do. */
const END_GUARD_MS = 900

/** A big number in short form for the cards (12,3 mil · 12.3K). */
const compact = (n: number) =>
  n < 10000 ? formatNumber(n) : new Intl.NumberFormat(LOCALES[locale()].tag, { notation: 'compact', maximumFractionDigits: 1 }).format(n)

/** Icon and name of a damage source of `s`'s (their own special and Ability, not the local player's). */
const sourceOf = (g: Game, s: PlayerStats, id: DamageSource) => {
  const p = g.players[s.slot]!
  if (id === 'ability') return p.ability.id ? { icon: abilityIcon(p.ability.id), name: ABILITIES[p.ability.id].name, color: '#a8a878' } : { icon: sparkleIcon(), name: t().ability.results, color: '#a8a878' }
  if (id === 'special') {
    const r = resolveSpecial(p.starter, p.stage, null, p.branch)
    return { icon: specialIcon(r.id), name: r.tier.name, color: TYPE_COLORS[r.def.type] }
  }
  return { icon: moveIcon(id), name: MOVES[id].name, color: TYPE_COLORS[MOVES[id].type] }
}

/** A player's three best moves by damage, with a bar against their best. */
const topMoves = (g: Game, s: PlayerStats) => {
  const entries = (Object.entries(s.damageByMove) as Array<[DamageSource, number]>).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const top = entries[0]?.[1] ?? 1
  return h(
    'div',
    { class: 'team-moves' },
    ...entries.map(([id, dmg]) => {
      const src = sourceOf(g, s, id)
      return h(
        'div',
        { class: 'team-move', title: src.name },
        h('img', { src: src.icon, alt: '' }),
        h('div', { class: 'team-move-bar' }, h('div', { style: `width:${Math.max(6, Math.round((dmg / top) * 100))}%;--type:${src.color}` })),
        h('b', {}, compact(dmg)),
      )
    }),
  )
}

const statRow = (label: string, value: string) => h('div', { class: 'team-stat' }, h('span', {}, label), h('b', {}, value))

/** A player's card on the end screen. */
const resultCard = (g: Game, s: PlayerStats, me: Player, award: string | null, teamDamage: number) => {
  const m = t().team.results
  const p = g.players[s.slot]!
  const form = formAt(p.starter, p.branch, p.stage)
  const pay = coopPayout(g, s.slot)
  const share = teamDamage > 0 ? s.damage / teamDamage : 0
  const mine = p === me
  return h(
    'div',
    { class: `team-result${mine ? ' mine' : ''}${s.gone ? ' gone' : ''}`, style: `--slot:${slotColor(s.slot)}` },
    h('div', { class: 'team-award' }, award ? `★ ${award}` : mine ? t().team.you : ' '),
    h(
      'div',
      { class: 'team-result-head' },
      h('div', { class: 'team-result-face' }, h('img', { src: portraitUrl(form.dex, p.shiny), alt: '' }), p.shiny && h('img', { class: 'shiny-badge', src: sparkleIcon(), alt: 'Shiny' })),
      h(
        'div',
        { class: 'team-result-who' },
        h('div', { class: 'team-result-line' }, h('b', { class: 'team-result-name' }, seatName(g, s.slot)), h('span', { class: 'team-result-level' }, t().levelShort(s.level))),
        h('span', {}, form.name),
        s.gone && h('span', { class: 'tag' }, m.left),
      ),
    ),
    h('div', { class: 'team-share', title: `${Math.round(share * 100)}%` }, h('div', { style: `width:${Math.round(share * 100)}%` })),
    h(
      'div',
      { class: 'team-stats' },
      statRow(m.damage, compact(s.damage)),
      statRow(m.kills, formatNumber(s.kills)),
      statRow(m.taken, compact(s.taken)),
      statRow(m.revives, formatNumber(s.revives)),
      statRow(m.faints, formatNumber(s.faints)),
    ),
    topMoves(g, s),
    h('div', { class: 'team-pay', title: m.payout(formatPokeDollars(pay.coins), formatPokeDollars(pay.bonus)) }, mine && h('small', {}, m.share), h('img', { src: coinIcon(1), alt: '' }), h('b', {}, `+${formatPokeDollars(pay.coins + pay.bonus)}`)),
  )
}

/** The endless vote at the victory: everyone's vote as it comes in, the clock and the rule; this player's two buttons. */
const voteView = (input: Input, g: Game, me: Player, actions: EndActions) => {
  const m = t().team.vote
  const yes = h('button', { class: 'btn confirm' }, m.yes)
  const no = h('button', { class: 'btn' }, m.no)
  const states = new Map<number, HTMLElement>()
  const chips = h(
    'div',
    { class: 'team-chips vote-chips' },
    ...g.players
      .filter((p) => !p.gone)
      .map((p) => {
        const state = h('span', { class: 'team-chip-state' })
        states.set(p.slot, state)
        return h('span', { class: 'team-chip', style: `--slot:${slotColor(p.slot)}` }, face(p), h('span', { class: 'team-chip-name' }, seatName(g, p.slot)), state)
      }),
  )
  const bar = clockBar()
  const seconds = h('span', { class: 'vote-seconds' })
  const canVote = !me.gone && !me.away
  const el = h(
    'div',
    { class: 'dialog box pop team-vote' },
    h('div', { class: 'dialog-title' }, m.title),
    h('p', { class: 'vote-question' }, m.question),
    chips,
    h('div', { class: 'vote-clock' }, bar.el, seconds),
    h('p', { class: 'profile-note small' }, m.rule),
    canVote && h('div', { class: 'buttons' }, yes, no),
  )
  const nav = canVote ? menu(input, [yes, no], (i) => (playSfx('select'), actions.vote(i === 0)), { horizontal: true, guard: END_GUARD_MS }) : null
  const update = () => {
    const vote = g.coop?.vote
    if (!vote) return
    for (const p of g.players) {
      const state = states.get(p.slot)
      if (!state) continue
      const v = vote.votes[p.slot]
      setText(state, p.away ? 'Zz' : v === true ? '✓' : v === false ? '✕' : '…')
      state.parentElement!.classList.toggle('yes', v === true)
      state.parentElement!.classList.toggle('no', v === false)
    }
    const mine = vote.votes[me.slot]
    yes.classList.toggle('picked', mine === true)
    no.classList.toggle('picked', mine === false)
    bar.set(vote.left, COOP.voteTime)
    setText(seconds, `${Math.ceil(vote.left)}s`)
  }
  update()
  return { el, update, dispose: () => nav?.off() }
}

/** The end screen: the team's numbers, a card per player with a superlative, and play again or back to the lobby. */
const resultsView = (input: Input, g: Game, me: Player, actions: EndActions) => {
  const m = t().team.results
  const stats = coopStats(g)
  const awards = teamAwards(stats.players)
  const names = t().team.results.awards
  const victory = g.phase === 'victory'
  const again = h('button', { class: 'btn confirm' }, m.playAgain)
  const lobby = h('button', { class: 'btn' }, m.lobby)
  const nav = menu(input, [again, lobby], (i) => (playSfx('select'), later(i === 0 ? actions.playAgain : actions.lobby)), { horizontal: true, guard: END_GUARD_MS })
  // After "Jogar de novo": who's ready, and who starts it.
  const status = h('p', { class: 'team-again hidden' })
  let said = ''
  const update = () => {
    const a = actions.again()
    again.classList.toggle('picked', a.asked)
    const text = a.asked ? (a.host ? m.againHost(a.ready, a.total) : m.againGuest) : ''
    if (text === said) return
    said = text
    status.classList.toggle('hidden', text === '')
    setText(status, text)
  }
  const joined = g.coop?.joined ?? g.players.length
  const el = h(
    'div',
    { class: 'dialog box pop wide team-results' },
    h('div', { class: 'dialog-title' }, g.endless ? m.endless : victory ? m.victory : m.wipe),
    h(
      'div',
      { class: 'team-summary' },
      difficultyTag(g.difficulty),
      h('span', {}, h('small', {}, m.time), h('b', {}, formatTime(stats.time))),
      h('span', {}, h('small', {}, m.kills), h('b', {}, formatNumber(stats.total.kills))),
      h('span', {}, h('small', {}, m.damage), h('b', {}, compact(stats.total.damage))),
      h('span', {}, h('small', {}, m.revives), h('b', {}, formatNumber(stats.total.revives))),
    ),
    h('div', { class: `team-grid n${stats.players.length}` }, ...stats.players.map((s, i) => resultCard(g, s, me, awards[i] ? names[awards[i]!] : null, stats.total.damage))),
    h('p', { class: 'team-split' }, h('img', { src: coinIcon(2), alt: '' }), m.split(formatPokeDollars(stats.coins), joined, formatPokeDollars(Math.floor(stats.coins / Math.max(1, joined))))),
    h('div', { class: 'buttons result-buttons' }, again, lobby),
    status,
  )
  update()
  return { el, update, dispose: () => nav.off() }
}

/**
 * The co-op run's last screen, one overlay for the phase `victory` or
 * `gameover`: at a victory the endless vote first (it goes away by itself if
 * the team goes on, the run playing again), then the results once the run is
 * over for good. `tick` (every frame) refreshes the vote and makes the switch.
 */
export const teamEnd = (root: HTMLElement, input: Input, g: Game, me: Player, actions: EndActions): Screen => {
  const el = h('div', { class: 'screen dim team-end' })
  let view: { el: HTMLElement; update?: () => void; dispose: () => void } | null = null
  let showing: 'vote' | 'results' | null = null
  const sync = () => {
    const want = g.phase === 'victory' && g.coop?.vote?.outcome === 'open' ? 'vote' : 'results'
    if (want !== showing) {
      showing = want
      view?.dispose()
      view = want === 'vote' ? voteView(input, g, me, actions) : resultsView(input, g, me, actions)
      el.replaceChildren(view.el)
    }
    view?.update?.()
  }
  sync()
  root.append(el)
  return { el, tick: sync, dispose: () => (view?.dispose(), el.remove()) }
}

/* ---------------- Feedback ---------------- */

/** Sounds and toasts for the team's moments (`GameEvent`s the run pushes): a faint, a revive, someone away, back or gone, the vote. */
export const teamFeedback = (root: HTMLElement, g: Game, me: Player, e: Extract<GameEvent, { kind: 'fainted' | 'revived' | 'left' | 'away' | 'vote' | 'voted' }>) => {
  const m = t().team.toast
  switch (e.kind) {
    case 'fainted':
      if (e.slot === me.slot) return playSfx('gameOver')
      playSfx('hurt')
      return runToast(root, 'important', rich(m.fainted(seatName(g, e.slot))), 3200, `fainted${e.slot}`)
    case 'revived':
      playSfx('heal')
      playSfx('unlock')
      return runToast(root, 'important', rich(e.slot === me.slot ? m.revivedYou(seatName(g, e.by)) : e.by === me.slot ? m.youRevived(seatName(g, e.slot)) : m.revived(seatName(g, e.slot), seatName(g, e.by))), 2600, `fainted${e.slot}`)
    case 'left':
      playSfx('escaped')
      return runToast(root, 'minor', rich(m.left(seatName(g, e.slot))), 3000)
    case 'away':
      if (e.slot === me.slot) return
      return runToast(root, 'minor', rich(e.away ? m.away(seatName(g, e.slot)) : m.back(seatName(g, e.slot))), 2400, `away${e.slot}`)
    case 'vote':
      return playSfx('select')
    case 'voted':
      return playSfx(e.outcome === 'endless' ? 'evolve' : 'item')
  }
}

/**
 * A teammate's own big moments (`slot` pushed it), as a short toast with
 * their face and name, quieter than the solo ones (their sounds stay
 * theirs): an evolution, a Mega Evolution, a duo move.
 */
export const teamMoment = (root: HTMLElement, g: Game, slot: number, e: GameEvent) => {
  const p = g.players[slot]
  if (!p || p.slot === localPlayer(g).slot) return
  const m = t().team.toast
  const name = seatName(g, slot)
  const say = (text: string) => runToast(root, 'minor', h('span', { class: 'item-toast team-moment' }, face(p), rich(text)), 3000)
  switch (e.kind) {
    case 'evolved':
      return say(m.evolved(name, formAt(p.starter, p.branch, p.stage - 1).name, formAt(p.starter, p.branch, p.stage).name))
    case 'mega':
      return say(m.mega(name, e.name))
    case 'duoFused':
      return say(m.duo(name, MOVES[e.to].name))
  }
}

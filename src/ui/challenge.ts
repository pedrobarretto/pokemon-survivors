import { accountState } from '../account'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { formatTime } from '../engine/math'
import { context2d } from '../engine/pixelart'
import { ENEMIES } from '../data/enemies'
import { PLAYABLE } from '../data/hatchlings'
import { nextIsOfficial } from '../game/attempt'
import type { Challenge } from '../game/challenge'
import { msToNextDay } from '../game/day'
import { isUnlocked } from '../game/eggs'
import { runArchetype } from '../game/terrain'
import { playsShiny } from '../game/shinyPicks'
import type { ChallengeBoard } from '../game/ranking'
import { dailyCoopChallenge, TEAM_SIZE_KEYS, TEAM_SIZES, type CoopChallengeBoard, type TeamSize } from '../game/coopBoard'
import { formatDay, t } from '../i18n'
import { coopIcon, ribbonIcon, sparkleIcon } from '../render/art'
import { drawPokemon, loadedSprites, loadSpecies } from '../render/sprites'
import { coopBoardsFaked, fetchChallengeBoard, fetchCoopChallengeBoard, rankingEnabled } from '../ranking'
import { h, later } from './dom'
import { teamRow } from './ranking'
import { challengeToday, loadAttempt, loadSave, today } from './save'
import { difficultyTag, hint, menu, typeBadge, type Screen } from './screens'

export type ChallengeActions = {
  /** Starts the challenge run, saying whether the screen called it official (the API decides; this is what the run announces). */
  play: (c: Challenge, official: boolean) => void
  /** Opens the challenge board over this screen; closing it must come back here. No action (no API), no button. */
  board?: () => void
  /** Into co-op with the Desafio co-op do dia on (the co-op hub, its room made with it). No action (no relay), no Co-op side. */
  coop?: () => void
  /** Opens the day's co-op board at that team size over this screen; closing it must come back here. */
  coopBoard?: (size: TeamSize) => void
  onClose: () => void
}

/** The screen's sides: the solo challenge and the Desafio co-op do dia. */
export type ChallengeSide = 'solo' | 'coop'

/** How many teams the co-op side previews (the board has the rest). */
const PREVIEW = 3

/** Whether the player plays `c`'s Pokémon shiny: an owned shiny not switched to Normal. */
export const challengeShiny = (c: Challenge) => playsShiny(loadSave(), c.starter)

/** `h:mm:ss` until the next challenge. */
const countdown = () => {
  const s = Math.max(0, Math.ceil(msToNextDay(today()) / 1000))
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Desafio do dia: the day's Pokémon walking, its difficulty and outbreak,
 * what's off, whether the next run is the official attempt or practice (this
 * device's attempt, confirmed by the API when signed in), the attempt's place
 * and the countdown to the next challenge. Play, the challenge board and
 * Back; Esc or Backspace close it. At midnight it turns to the new day.
 *
 * With co-op (`actions.coop`), a Co-op side (Q/E, or its tab): the Desafio
 * co-op do dia's difficulty and rules (any Pokémon, upgrades off, free tries),
 * the top of the day's board by team size (T, or the size tabs; guests read
 * it too) and Jogar em co-op. `side` opens on that side.
 */
export const challengeScreen = (root: HTMLElement, input: Input, actions: ChallengeActions, side: ChallengeSide = 'solo'): Screen => {
  const el = h('div', { class: 'screen dim challenge-screen' })
  const sprite = h('canvas', { class: 'challenge-sprite', width: 72, height: 72, 'aria-hidden': 'true' })
  const clock = h('b', {})
  let c = challengeToday()
  let server: ChallengeBoard | null = null
  /** Whether the player plays it shiny, read at each render (not every frame). */
  let shiny = challengeShiny(c)
  let nav: ReturnType<typeof menu> | null = null
  let closed = false
  let opening = true
  let view: ChallengeSide = actions.coop ? side : 'solo'
  let size: TeamSize = 2
  /** The day's co-op board at `size`: loading, out of reach, or the answer. */
  let teams: CoopChallengeBoard | 'loading' | 'offline' = 'loading'
  let teamsAsked = 0

  const signedIn = () => accountState().kind === 'signedIn'
  const boardsReachable = () => rankingEnabled || coopBoardsFaked()

  /** The Solo / Co-op tabs, when co-op is on. */
  const sides = () =>
    actions.coop &&
    h(
      'div',
      { class: 'region-tabs rank-tabs challenge-sides', role: 'tablist' },
      ...(['solo', 'coop'] as const).map((s) => h('button', { class: s === view ? 'region-tab rank-tab selected' : 'region-tab rank-tab', onclick: () => setView(s) }, t().challenge.tabs[s])),
    )

  const render = () => (view === 'coop' ? renderCoop() : renderSolo())

  /** The Desafio co-op do dia: its difficulty and rules, the top of the day's board at `size`, and the way into co-op. */
  const renderCoop = () => {
    const m = t().challenge
    const r = t().ranking
    const day = dailyCoopChallenge(c.day)
    const actionsList = [() => actions.coop?.(), ...(actions.coopBoard ? [() => actions.coopBoard?.(size)] : []), close]
    const buttons = [
      h('button', { class: 'btn confirm' }, m.coopPlay),
      ...(actions.coopBoard ? [h('button', { class: 'btn' }, m.board)] : []),
      h('button', { class: 'btn' }, m.back),
    ]
    nav?.off()
    nav = menu(input, buttons, (i) => (playSfx('select'), later(actionsList[i]!)), { horizontal: true, initial: 0 })
    const status = (text: string, cls = '') => h('p', { class: `rank-status ${cls}` }, text)
    const board = teams === 'loading' || teams === 'offline' ? null : teams
    const mine = board?.me ?? null
    const preview: Node[] = board
      ? board.entries.length === 0
        ? [status(m.coopEmpty)]
        : board.entries.slice(0, PREVIEW).map((e) => teamRow(e, e.run === mine?.run, false).el)
      : [status(teams === 'loading' ? r.loading : m.coopOffline, teams === 'loading' ? 'blink' : '')]
    el.replaceChildren(
      h(
        'div',
        { class: opening ? 'dialog box pop challenge challenge-coop' : 'dialog box challenge challenge-coop' },
        h('div', { class: 'dialog-title' }, m.title),
        sides(),
        h(
          'div',
          { class: 'challenge-head' },
          h('img', { class: 'challenge-coop-icon', src: coopIcon(), alt: '' }),
          h(
            'div',
            { class: 'challenge-id' },
            h('small', {}, m.coopDay(formatDay(c.day))),
            h('b', { class: 'challenge-name' }, m.coopName),
            h('div', { class: 'types' }, difficultyTag(day.difficulty)),
          ),
        ),
        h('p', { class: 'challenge-rules' }, `${m.coopSame} ${m.coopOff}`),
        boardsReachable() &&
          h(
            'div',
            { class: 'challenge-teams' },
            h(
              'div',
              { class: 'region-tabs rank-tabs rank-sizes', role: 'tablist' },
              ...TEAM_SIZES.map((n) => h('button', { class: n === size ? 'region-tab rank-tab selected' : 'region-tab rank-tab', onclick: () => setSize(n) }, r.sizes[TEAM_SIZE_KEYS[n]])),
            ),
            h('div', { class: 'rank-list challenge-preview' }, ...preview),
            mine && h('p', { class: 'challenge-attempt' }, m.coopMine(mine.rank, formatTime(mine.time))),
          ),
        h('p', { class: 'challenge-note' }, h('img', { src: coopIcon(), alt: '' }), m.coopBoards),
        h('p', { class: 'challenge-clock' }, m.next(''), clock),
        h('div', { class: 'buttons' }, ...buttons),
        hint(m.coopHintKeys, m.hintTouch),
      ),
    )
    opening = false
  }

  /** The day's co-op board at `size` (public: guests read it too), then a redraw. */
  const askTeams = async () => {
    if (!boardsReachable()) return
    const id = ++teamsAsked
    teams = 'loading'
    if (view === 'coop') render()
    const board = await fetchCoopChallengeBoard(c.day, size)
    if (closed || id !== teamsAsked) return
    teams = board ?? 'offline'
    if (view === 'coop') render()
  }

  const setView = (next: ChallengeSide) => {
    if (next === view || !actions.coop) return
    view = next
    playSfx('move')
    render()
  }

  const setSize = (next: TeamSize) => {
    if (next === size) return
    size = next
    playSfx('move')
    void askTeams()
  }

  const renderSolo = () => {
    const m = t().challenge
    const form = PLAYABLE[c.starter].line[0]
    shiny = challengeShiny(c)
    const local = loadAttempt()
    const official = nextIsOfficial(c.day, local, server?.attempted ?? null)
    const mine = server?.me ?? null
    const attempt = mine?.time ?? (local?.day === c.day ? local.time : null)
    void loadSpecies(form.dex, shiny).catch(() => {})
    const actionsList = [() => actions.play(c, official), ...(actions.board ? [actions.board] : []), close]
    const buttons = [
      h('button', { class: 'btn confirm' }, official ? m.play : m.practicePlay),
      ...(actions.board ? [h('button', { class: 'btn' }, m.board)] : []),
      h('button', { class: 'btn' }, m.back),
    ]
    nav?.off()
    nav = menu(input, buttons, (i) => (playSfx('select'), later(actionsList[i]!)), { horizontal: true, initial: 0 })
    el.replaceChildren(
      h(
        'div',
        { class: opening ? 'dialog box pop challenge' : 'dialog box challenge', style: `--accent:${PLAYABLE[c.starter].color}` },
        h('div', { class: 'dialog-title' }, m.title),
        sides(),
        h(
          'div',
          { class: 'challenge-head' },
          sprite,
          h(
            'div',
            { class: 'challenge-id' },
            h('small', {}, m.day(formatDay(c.day))),
            h('b', { class: 'challenge-name' }, PLAYABLE[c.starter].name, shiny && h('img', { src: sparkleIcon(), alt: 'Shiny' })),
            h('div', { class: 'types' }, ...form.types.map(typeBadge), difficultyTag(c.difficulty)),
            h('small', { class: 'challenge-outbreak' }, m.outbreak(ENEMIES[c.outbreak].name)),
            // The day's seed draws everyone the same map (`data/mapArchetypes.ts`).
            h('small', { class: 'challenge-map' }, `${t().maps.label}: ${t().maps.names[runArchetype(c.seed)]}`),
          ),
        ),
        h(
          'div',
          { class: official ? 'challenge-status official' : 'challenge-status' },
          h('b', {}, official ? m.official : m.practice),
          h('span', {}, official ? m.officialHint : m.practiceHint),
          attempt !== null && h('span', { class: 'challenge-attempt' }, m.attempt(formatTime(attempt)), mine ? ` · ${m.place(mine.rank, server?.total ?? mine.rank)}` : ''),
        ),
        h('p', { class: 'challenge-rules' }, `${m.same} ${m.off}`),
        !isUnlocked(loadSave().hatched, c.starter) && h('p', { class: 'challenge-note' }, m.locked),
        h('p', { class: 'challenge-note' }, h('img', { src: ribbonIcon('gold'), alt: '' }), signedIn() ? m.ribbons : m.guest),
        h('p', { class: 'challenge-clock' }, m.next(''), clock),
        h('div', { class: 'buttons' }, ...buttons),
        hint(m.hintKeys, m.hintTouch),
      ),
    )
    opening = false
  }

  /** The API's word on the player's attempt and place (signed in), then a redraw. Offline keeps the device's. */
  const ask = async () => {
    if (!rankingEnabled || !signedIn()) return
    const day = c.day
    const board = await fetchChallengeBoard(day)
    if (closed || day !== c.day || !board) return
    server = board
    render()
  }

  const offKeys = input.onKey((key) => {
    if (key === 'Escape' || key === 'Backspace') return close()
    if (key === 'KeyQ' || key === 'KeyE' || key === 'PageUp' || key === 'PageDown') return setView(view === 'solo' ? 'coop' : 'solo')
    if (key === 'KeyT' && view === 'coop') setSize(TEAM_SIZES[(TEAM_SIZES.indexOf(size) + 1) % TEAM_SIZES.length]!)
  })

  const dispose = () => {
    closed = true
    nav?.off()
    offKeys()
    el.remove()
  }

  function close() {
    if (closed) return
    playSfx('select')
    dispose()
    later(actions.onClose)
  }

  const tick = (time: number) => {
    clock.textContent = countdown()
    // Midnight in Brasília: the next challenge is up.
    if (challengeToday().day !== c.day) {
      c = challengeToday()
      server = null
      render()
      void ask()
      if (actions.coop) void askTeams()
    }
    const ctx = context2d(sprite)
    ctx.clearRect(0, 0, sprite.width, sprite.height)
    const dex = PLAYABLE[c.starter].line[0].dex
    const s = (shiny && loadedSprites(dex, true)) || loadedSprites(dex)
    // Twice the size when it fits the canvas (most first stages do).
    const scale = s && Math.max(s.bodyW, s.bodyH) * 2 <= sprite.width - 12 ? 2 : 1
    if (s) drawPokemon(ctx, s, 'Walk', 0, time, sprite.width / 2, sprite.height - 6, { scale })
  }

  render()
  clock.textContent = countdown()
  root.append(el)
  void ask()
  if (actions.coop) void askTeams()
  return { el, dispose, tick, dim: 0.5 }
}

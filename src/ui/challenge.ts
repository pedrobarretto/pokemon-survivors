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
import { formatDay, t } from '../i18n'
import { ribbonIcon, sparkleIcon } from '../render/art'
import { drawPokemon, loadedSprites, loadSpecies } from '../render/sprites'
import { fetchChallengeBoard, rankingEnabled } from '../ranking'
import { h, later } from './dom'
import { challengeToday, loadAttempt, loadSave, today } from './save'
import { difficultyTag, hint, menu, typeBadge, type Screen } from './screens'

export type ChallengeActions = {
  /** Starts the challenge run, saying whether the screen called it official (the API decides; this is what the run announces). */
  play: (c: Challenge, official: boolean) => void
  /** Opens the challenge board over this screen; closing it must come back here. No action (no API), no button. */
  board?: () => void
  onClose: () => void
}

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
 */
export const challengeScreen = (root: HTMLElement, input: Input, actions: ChallengeActions): Screen => {
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

  const signedIn = () => accountState().kind === 'signedIn'

  const render = () => {
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

  const offKeys = input.onKey((key) => (key === 'Escape' || key === 'Backspace') && close())

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
  return { el, dispose, tick, dim: 0.5 }
}

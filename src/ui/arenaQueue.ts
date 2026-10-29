import { playSfx } from '../engine/audio'
import { formatTime } from '../engine/math'
import type { Input } from '../engine/input'
import { VERSUS_ROSTER, type Team, type VersusPick } from '../data/versus'
import { ARENA_FORMATS, type ArenaFormat } from '../data/arenaFormats'
import { t } from '../i18n'
import type { QueueKind } from '../data/arenaRanked'
import type { QueueServerMessage } from '../net/arena'
import { arenaIcon, pokeballIcon } from '../render/art'
import { arenaIconUrl } from '../render/arenaArt'
import { portraitUrl } from '../render/sprites'
import { firstForm, roleChip, teamColor } from './arena'
import { h, later } from './dom'
import { hint, type Screen } from './screens'

/**
 * The Partida rápida's matchmaking screen (and, below, the public queue's:
 * `arenaQueueLive`): "Procurando partida…" with the
 * time searched, the format's seats (Azul × Vermelho) with this player on
 * Blue's first and the others filling in one by one as CPUs, then "Partida
 * encontrada!". There's no public queue yet, and the screen says so: the
 * seats are bots. It runs while the shell sets the in-page relay up
 * (`playArenaBots`), for at least `MIN_SEARCH` so it reads, never longer
 * than the work.
 */

/** The search shows at least this long (s), and "Partida encontrada!" this long after it. */
const MIN_SEARCH = 2.4
const FOUND = 0.8

/** The format a match plays, as a small chip: "3v3 · 3:00" (the queue screens and the splash wear it). */
export const formatChip = (format: ArenaFormat) => {
  const f = t().versus.formats[format]
  return h('span', { class: `arena-format-chip ${format}` }, h('b', {}, f.size), f.clock)
}

/** One seat of a lineup: a Pokémon's portrait (or a Poké Ball for a CPU still unknown), its name and role, in its team's color. */
export const lineupSeat = (team: Team, seat: { dex?: number; name: string; pick?: VersusPick; me?: boolean; cpu?: boolean } | null) => {
  const q = t().versus.queue
  if (!seat) {
    return h('div', { class: 'arena-slot seeking', style: `--team:${teamColor(team)}` }, h('img', { class: 'arena-slot-face', src: pokeballIcon(), alt: '' }), h('span', { class: 'arena-slot-name' }, q.seeking))
  }
  return h(
    'div',
    { class: `arena-slot${seat.me ? ' me' : ''}${seat.cpu ? ' cpu' : ''}`, style: `--team:${teamColor(team)}` },
    h('img', { class: 'arena-slot-face', src: seat.dex !== undefined ? portraitUrl(seat.dex) : pokeballIcon(), alt: '' }),
    h('span', { class: 'arena-slot-text' }, h('b', { class: 'arena-slot-name' }, seat.name), seat.pick ? roleChip(VERSUS_ROSTER[seat.pick]) : null),
  )
}

export type ArenaQueue = Screen & {
  /** Resolves once the search has shown long enough and every seat is filled. */
  filled: () => Promise<void>
  /** "Partida encontrada!" for a moment; resolves when it's time to start. */
  found: () => Promise<void>
}

/** `name` and `pick`: this player's seat; `format`: the match's (its seats). `cancel`: back out (the shell drops the relay). */
export const arenaQueue = (root: HTMLElement, input: Input, me: { name: string; pick: VersusPick }, format: ArenaFormat, cancel: () => void): ArenaQueue => {
  const m = t().versus
  const q = m.queue
  const half = ARENA_FORMATS[format].teamSize
  const since = performance.now()
  const title = h('b', { class: 'arena-queue-title' }, q.searching)
  const clock = h('span', { class: 'arena-queue-clock' }, formatTime(0))
  const others = 2 * half - 1
  /** When each other seat fills (s after the start): spread over the search, a little uneven. */
  const fillAt = Array.from({ length: others }, (_, i) => 0.35 + ((i + 0.4 + Math.random() * 0.5) / others) * (MIN_SEARCH - 0.5))
  const columns = ([0, 1] as const).map((team) => h('div', { class: `arena-lineup team${team}`, style: `--team:${teamColor(team)}` }, h('b', { class: 'arena-lineup-head' }, m.teams[team])))
  const seats: HTMLElement[] = []
  for (let i = 0; i < 2 * half; i++) {
    const team: Team = i < half ? 0 : 1
    const seat = i === 0 ? lineupSeat(0, { dex: firstForm(me.pick).dex, name: me.name, pick: me.pick, me: true }) : lineupSeat(team, null)
    seats.push(seat)
    columns[team]!.append(seat)
  }
  const cancelButton = h('button', { class: 'btn selected arena-queue-cancel', type: 'button' }, q.cancel)
  const box = h(
    'div',
    { class: 'dialog box pop arena-queue' },
    h('div', { class: 'arena-queue-head' }, h('img', { class: 'arena-queue-spin', src: arenaIcon(), alt: '' }), title, formatChip(format), clock),
    h('p', { class: 'arena-queue-honest' }, q.honest),
    h('div', { class: 'arena-lineups' }, columns[0]!, h('span', { class: 'arena-vs' }, 'VS'), columns[1]!),
    h('div', { class: 'buttons' }, cancelButton),
    hint(q.hintKeys, q.hintTouch),
  )
  const el = h('div', { class: 'screen dim arena-queue-screen' }, box)

  let done = false
  let filledCount = 0
  let timer = 0
  let ready: (() => void) | null = null
  const filledP = new Promise<void>((res) => (ready = res))
  const tick = () => {
    if (done) return
    const s = (performance.now() - since) / 1000
    clock.textContent = formatTime(Math.floor(s))
    while (filledCount < others && s >= fillAt[filledCount]!) {
      const i = filledCount + 1
      const team: Team = i < half ? 0 : 1
      const seat = lineupSeat(team, { name: m.cpu, cpu: true })
      seat.classList.add('in')
      seats[i]!.replaceWith(seat)
      seats[i] = seat
      filledCount++
      playSfx('move', 0)
    }
    if (filledCount === others && s >= MIN_SEARCH) ready?.()
    timer = requestAnimationFrame(tick)
  }
  timer = requestAnimationFrame(tick)

  const back = () => {
    if (done) return
    done = true
    playSfx('select')
    later(cancel)
  }
  cancelButton.addEventListener('click', back)
  const off = input.onKey((key) => {
    if (key === 'Escape' || key === 'Backspace' || key === 'Enter') back()
  })

  const found = () => {
    done = true
    cancelAnimationFrame(timer)
    title.textContent = q.found
    box.classList.add('found')
    cancelButton.disabled = true
    playSfx('levelUp')
    return new Promise<void>((res) => setTimeout(res, FOUND * 1000))
  }

  root.append(el)
  return {
    el,
    dim: 0.6,
    filled: () => filledP,
    found,
    dispose: () => {
      done = true
      cancelAnimationFrame(timer)
      off()
      el.remove()
    },
  }
}

/* ---------------- The public queue ---------------- */

export type LiveQueue = Screen & {
  /** The matchmaker's word on the wait (`queued`). */
  update: (m: Extract<QueueServerMessage, { t: 'queued' }>) => void
  /** A match: the lineup fills (`humans` trainers, the rest CPUs), "Partida encontrada!", and a note when a ranked ticket plays as casual. */
  found: (m: Extract<QueueServerMessage, { t: 'matched' }>) => void
}

/**
 * Casual and Ranqueada's queue: the same lineups, with the real wait from the
 * matchmaker (`arena/queue.ts`): the time searched, how many trainers the
 * forming match has (they fill Blue's and Red's seats as Poké Balls), the
 * seconds until bots fill the rest, and what the kind means. On a match,
 * "Partida encontrada!" stays up while the shell joins the room, whose
 * match starts by itself. `cancel`: back out.
 */
export const arenaQueueLive = (root: HTMLElement, input: Input, me: { name: string; pick: VersusPick }, kind: QueueKind, format: ArenaFormat, cancel: () => void): LiveQueue => {
  const m = t().versus
  const q = m.queue
  const half = ARENA_FORMATS[format].teamSize
  let since = performance.now()
  let botsAt: number | null = null
  let found = 1
  let matched = false
  const title = h('b', { class: 'arena-queue-title' }, q.connecting)
  const clock = h('span', { class: 'arena-queue-clock' }, formatTime(0))
  const chip = h('span', { class: `arena-queue-kind ${kind}` }, h('img', { src: arenaIconUrl(kind === 'ranked' ? 'queueRanked' : 'queueCasual'), alt: '' }), q.kinds[kind])
  const count = h('b', { class: 'arena-queue-count' })
  const bots = h('span', { class: 'arena-queue-bots' })
  const note = h('p', { class: 'arena-queue-honest' }, kind === 'ranked' ? q.rankedNote : q.casualNote)
  const columns = ([0, 1] as const).map((team) => h('div', { class: `arena-lineup team${team}`, style: `--team:${teamColor(team)}` }, h('b', { class: 'arena-lineup-head' }, m.teams[team])))
  const size = 2 * half
  const seats: HTMLElement[] = []
  for (let i = 0; i < size; i++) {
    const team: Team = i < half ? 0 : 1
    const seat = i === 0 ? lineupSeat(0, { dex: firstForm(me.pick).dex, name: me.name, pick: me.pick, me: true }) : lineupSeat(team, null)
    seats.push(seat)
    columns[team]!.append(seat)
  }
  /** Seat `i` (past this player's) as a trainer found, a CPU, or still sought. */
  const fill = (i: number, as: 'player' | 'cpu' | null) => {
    const team: Team = i < half ? 0 : 1
    const was = seats[i]!.dataset.as ?? null
    if (was === as) return
    const seat = as === null ? lineupSeat(team, null) : lineupSeat(team, { name: as === 'cpu' ? m.cpu : q.player, cpu: as === 'cpu' })
    if (as) seat.dataset.as = as
    if (as) seat.classList.add('in')
    seats[i]!.replaceWith(seat)
    seats[i] = seat
  }
  /** Seats in order Blue, Red, Blue, Red… past this player's, as the forming match fills. */
  const order = Array.from({ length: size - 1 }, (_, k) => (k % 2 === 0 ? half + Math.floor(k / 2) : 1 + Math.floor(k / 2)))
  const paintSeats = (humans: number, cpus: boolean) => order.forEach((i, k) => fill(i, k < humans - 1 ? 'player' : cpus ? 'cpu' : null))

  const cancelButton = h('button', { class: 'btn selected arena-queue-cancel', type: 'button' }, q.cancel)
  const box = h(
    'div',
    { class: `dialog box pop arena-queue live ${kind}` },
    h('div', { class: 'arena-queue-head' }, h('img', { class: 'arena-queue-spin', src: arenaIcon(), alt: '' }), title, chip, formatChip(format), clock),
    h('div', { class: 'arena-queue-status' }, count, bots),
    note,
    h('div', { class: 'arena-lineups' }, columns[0]!, h('span', { class: 'arena-vs' }, 'VS'), columns[1]!),
    h('div', { class: 'buttons' }, cancelButton),
    hint(q.hintKeys, q.hintTouch),
  )
  const el = h('div', { class: 'screen dim arena-queue-screen' }, box)

  let timer = 0
  const paintCount = () => {
    count.textContent = q.players(found, size)
    if (matched) return
    const left = botsAt === null ? null : Math.ceil((botsAt - performance.now()) / 1000)
    bots.textContent = left === null ? '' : left > 0 ? q.botsIn(left) : q.botsNow
  }
  const tick = () => {
    if (!matched) clock.textContent = formatTime(Math.floor((performance.now() - since) / 1000))
    paintCount()
    timer = requestAnimationFrame(tick)
  }
  timer = requestAnimationFrame(tick)

  let left = false
  const back = () => {
    if (left || matched) return
    left = true
    playSfx('select')
    later(cancel)
  }
  cancelButton.addEventListener('click', back)
  const off = input.onKey((key) => {
    if (key === 'Escape' || key === 'Backspace' || key === 'Enter') back()
  })

  const update: LiveQueue['update'] = (msg) => {
    if (matched) return
    title.textContent = q.searching
    since = performance.now() - msg.waited * 1000
    botsAt = performance.now() + msg.botsIn * 1000
    if (msg.found !== found) playSfx('move', 0)
    found = Math.max(1, Math.min(size, msg.found))
    paintSeats(found, false)
  }

  const foundMatch: LiveQueue['found'] = (msg) => {
    if (matched) return
    matched = true
    found = Math.max(1, Math.min(size, msg.humans))
    paintSeats(found, true)
    title.textContent = q.found
    bots.textContent = q.joining
    box.classList.add('found')
    cancelButton.disabled = true
    // A ranked ticket whose match came short of trainers plays as casual: said plainly, where the kind's note was.
    if (kind === 'ranked' && !msg.ranked) {
      note.textContent = q.downgraded
      note.classList.add('downgraded')
      chip.className = 'arena-queue-kind casual'
      chip.replaceChildren(h('img', { src: arenaIconUrl('queueCasual'), alt: '' }), q.kinds.casual)
    }
    playSfx('levelUp')
  }

  root.append(el)
  return {
    el,
    dim: 0.6,
    update,
    found: foundMatch,
    dispose: () => {
      left = true
      cancelAnimationFrame(timer)
      off()
      el.remove()
    },
  }
}

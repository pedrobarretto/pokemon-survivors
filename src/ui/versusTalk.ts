import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import type { Vec } from '../engine/math'
import { fromStrings, lazy } from '../engine/pixelart'
import type { SeatEntry } from '../coop/driver'
import { VERSUS, type Team } from '../data/versus'
import { localPlayer } from '../game/players'
import type { Game, Player } from '../game/types'
import { concealed } from '../render/valeGrass'
import { arenaMapAt, MINIMAP } from '../render/minimap'
import { PING_COLORS, pingIconUrl, seesPing } from '../render/valePings'
import { fullBucket, PING_KINDS, QUICK_CHAT, surrenderNeed, takeToken, TO_ALL, voters, type PingKind, type QuickChat } from '../game/versusSocial'
import { t } from '../i18n'
import { teamColor } from './arena'
import { h, setStyle, setText } from './dom'
import { boundLabel } from './inputLabels'
import { settings } from './settings'
import { uiZoom } from './uiScale'
import { createLiveBoard } from './versusBoard'
import { versusName } from './versusHud'

/**
 * A match's social layer over the field (`game/versusSocial.ts` holds the
 * rules): quick chat (a menu of ready-made lines; T, or the chat button),
 * pings (a four-way wheel at a spot of the field or the mini map; G at the
 * cursor, Alt+click or a middle click, a click or a long press on the mini
 * map, or the ping button at your feet), the line feed and the bubbles over
 * the speakers, the surrender vote's prompt (Y / N), and the live scoreboard
 * (held on its key, or the score bar or its button tapped). Everything is
 * sent as tick entries and read back from the match's state, so every screen
 * shows what the simulation kept. The shell also holds a rate limit of its
 * own, the simulation's, so a spammed button says "wait" instead of sending
 * what would be dropped. `toScreen` and `toWorld` map world px to the
 * viewport's CSS px and back (the drawn camera).
 */

export type TalkDeps = {
  send: (e: SeatEntry) => void
  toScreen: (x: number, y: number) => Vec
  toWorld: (x: number, y: number) => Vec
  /** The field's canvas: a click on it aims a ping. */
  canvas: HTMLElement
}

/** How long a menu waits untouched before it closes itself (s). */
const IDLE_CLOSE = 6
/** The feed's lines at most. */
const FEED_LINES = 4
/** How long a touch holds the mini map before the wheel opens there (ms). */
const LONG_PRESS = 350
/** How far (CSS px) the wheel's signs sit from its middle. */
const WHEEL_R = 50
/** World px above a Pokémon's feet where its bubble's tail points. */
const HEAD = 30

/** The social buttons' icons, 11×11 pixel strings (`o` outline, `w` white, `k` dark). */
const ICONS = lazy(() => {
  const icon = (rows: readonly string[]) => fromStrings(rows, { o: '#101020', w: '#f8f8f8', k: '#101020', y: '#f8d030' }).toDataURL()
  return {
    chat: icon(['.ooooooooo.', 'owwwwwwwwwo', 'owwwwwwwwwo', 'owwkwwkwwko', 'owwkwwkwwko', 'owwwwwwwwwo', '.ooowwooooo', '...owo.....', '...oo......', '...........', '...........']),
    ping: icon(['...ooooo...', '..oyyyyyo..', '.oyyykyyyo.', '.oyyykyyyo.', '.oyyykyyyo.', '.oyyyyyyyo.', '..oyykyyo..', '...oyyyo...', '....oyo....', '.....o.....', '...........']),
    board: icon(['ooooooooooo', 'owwwwwwwwwo', 'okkkkkkkkko', 'owwwwwwwwwo', 'owkkwkkwkko', 'owwwwwwwwwo', 'owkkwkkwkko', 'owwwwwwwwwo', 'owkkwkkwkko', 'owwwwwwwwwo', 'ooooooooooo']),
  }
})

/** Where an element goes inside the zoomed `#ui`, from viewport px. */
const unzoom = (px: number) => Math.round(px / uiZoom())

export const createVersusTalk = (root: HTMLElement, input: Input, deps: TalkDeps) => {
  const m = t().versus
  /** The game and player of the last frame, for the keys and the clicks between frames. */
  let game: Game | null = null
  let me: Player | null = null
  /** The match plays and no menu covers it: the keys and buttons work. */
  let active = false
  const talkBucket = fullBucket(VERSUS.talk)
  const pingBucket = fullBucket(VERSUS.ping)
  const clock = () => performance.now() / 1000

  /* ---------------- The buttons ---------------- */

  const socialButton = (kind: 'chat' | 'ping' | 'board', label: string, press: () => void) => {
    const key = h('span', { class: 'vs-social-key keys-only' })
    const b = h('button', { class: `vs-social-btn ${kind}`, type: 'button', 'aria-label': label, title: label }, h('img', { src: ICONS()[kind], alt: '' }), key)
    // pointerdown, not click: it lands at once, the other thumb still on the stick, and never starts the floating stick.
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (active) press()
    })
    return { b, key, kind }
  }
  const buttons = [
    socialButton('chat', m.chat.title, () => toggleChat()),
    socialButton('ping', m.ping.title, () => (wheelOpen() ? closeWheel() : openWheelAtMe())),
    socialButton('board', m.board.title, () => board.set(!board.isOpen())),
  ]
  const column = h('div', { class: 'vs-social' }, ...buttons.map((x) => x.b))

  /* ---------------- Quick chat ---------------- */

  const chatNote = h('small', { class: 'vs-chat-note' })
  const lines = QUICK_CHAT.map((msg, i) =>
    h(
      'button',
      {
        class: 'vs-chat-line',
        type: 'button',
        onpointerdown: (e) => {
          e.preventDefault()
          e.stopPropagation()
          say(msg)
        },
      },
      h('span', { class: 'vs-chat-num keys-only' }, String(i + 1)),
      h('span', { class: 'vs-chat-text' }, m.chat.lines[msg]),
      TO_ALL.has(msg) ? h('em', { class: 'vs-chat-all' }, m.chat.all) : null,
    ),
  )
  const chat = h('div', { class: 'vs-chat box hidden', role: 'menu' }, h('b', { class: 'vs-chat-title' }, m.chat.title), ...lines, chatNote)
  let chatAt = 0
  const chatOpen = () => !chat.classList.contains('hidden')
  const closeChat = () => chat.classList.add('hidden')
  const toggleChat = () => {
    if (chatOpen()) return closeChat()
    closeWheel()
    chatNote.textContent = settings().quickChat ? '' : m.chat.muted
    chatAt = clock()
    chat.classList.remove('hidden')
    playSfx('select', 0)
  }
  /** Sends a line, unless this screen's bucket is empty (the simulation would drop it). */
  const say = (msg: QuickChat) => {
    if (!active) return
    if (!takeToken(talkBucket, clock(), VERSUS.talk)) {
      chatNote.textContent = m.chat.wait
      chatAt = clock()
      return playSfx('denied', 0)
    }
    deps.send({ kind: 'chat', msg })
    closeChat()
  }

  /* ---------------- Pings ---------------- */

  const wheelHint = h('small', { class: 'vs-wheel-hint' }, m.ping.hint)
  const signs = PING_KINDS.map((kind, i) =>
    h(
      'button',
      {
        class: `vs-wheel-sign ${kind}`,
        type: 'button',
        style: `--ping:${PING_COLORS[kind]}`,
        onpointerdown: (e) => {
          e.preventDefault()
          e.stopPropagation()
          ping(kind)
        },
      },
      h('img', { src: pingIconUrl(kind), alt: '' }),
      h('span', {}, h('i', { class: 'keys-only' }, `${i + 1} `), m.ping.kinds[kind]),
    ),
  )
  const close = h('button', {
    class: 'vs-wheel-close',
    type: 'button',
    'aria-label': t().versus.back,
    onpointerdown: (e) => {
      e.preventDefault()
      e.stopPropagation()
      closeWheel()
    },
  }, '×')
  const wheel = h('div', { class: 'vs-wheel hidden' }, ...signs, close, wheelHint)
  /** Where the open wheel pings (world px), and when it opened. */
  let wheelAt: Vec | null = null
  let wheelOpenedAt = 0
  const wheelOpen = () => wheelAt !== null
  const closeWheel = () => {
    wheelAt = null
    wheel.classList.add('hidden')
  }
  /** Opens the wheel on the viewport point (sx, sy), pinging the world spot `at`. */
  const openWheel = (sx: number, sy: number, at: Vec, hint: boolean) => {
    if (!active) return
    closeChat()
    wheelAt = { x: Math.round(at.x), y: Math.round(at.y) }
    wheelOpenedAt = clock()
    const pad = WHEEL_R + 48
    const x = Math.min(window.innerWidth - pad, Math.max(pad, sx))
    const y = Math.min(window.innerHeight - pad, Math.max(pad, sy))
    wheel.style.left = `${unzoom(x)}px`
    wheel.style.top = `${unzoom(y)}px`
    wheelHint.classList.toggle('hidden', !hint)
    wheel.classList.remove('hidden')
    playSfx('select', 0)
  }
  /** The ping button: the wheel at this player's feet (the hint says how to ping elsewhere). */
  const openWheelAtMe = () => {
    if (!me) return
    const at = deps.toScreen(me.x, me.y)
    openWheel(at.x, at.y, { x: me.x, y: me.y }, true)
  }
  const ping = (kind: PingKind) => {
    const at = wheelAt
    if (!active || !at) return
    closeWheel()
    if (!takeToken(pingBucket, clock(), VERSUS.ping)) return playSfx('denied', 0)
    deps.send({ kind: 'ping', ping: kind, x: at.x, y: at.y })
  }

  /** The mouse over the field, for G (a ping where it points). */
  let mouse: { x: number; y: number; over: boolean } = { x: 0, y: 0, over: false }
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') mouse = { x: e.clientX, y: e.clientY, over: e.target === deps.canvas }
  }
  /** Alt+click or a middle click on the field: the wheel there. Caught before the field's stick takes the press. */
  const onFieldDown = (e: PointerEvent) => {
    if (e.target !== deps.canvas || e.pointerType !== 'mouse' || !active) return
    if (e.button !== 1 && !(e.button === 0 && e.altKey)) return
    e.preventDefault()
    e.stopImmediatePropagation()
    openWheel(e.clientX, e.clientY, deps.toWorld(e.clientX, e.clientY), false)
  }
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerdown', onFieldDown, { capture: true })
  // A middle click scrolls the page otherwise.
  const noAutoscroll = (e: MouseEvent) => e.button === 1 && e.target === deps.canvas && e.preventDefault()
  window.addEventListener('mousedown', noAutoscroll)

  /** The mini map (the run HUD's): a click, or a long press on a touch screen, opens the wheel on its spot. */
  let minimap: HTMLCanvasElement | null = null
  let press: { id: number; timer: number } | null = null
  const mapSpot = (map: HTMLCanvasElement, e: PointerEvent) => {
    const r = map.getBoundingClientRect()
    const s = game?.versus
    return s ? arenaMapAt(s, ((e.clientX - r.left) / r.width) * MINIMAP.size, ((e.clientY - r.top) / r.height) * MINIMAP.size) : null
  }
  const watchMinimap = () => {
    const map = root.querySelector<HTMLCanvasElement>('.hud .minimap canvas')
    if (!map || map === minimap) return
    minimap = map
    map.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const at = mapSpot(map, e)
      if (!at) return
      if (e.pointerType === 'mouse') return openWheel(e.clientX, e.clientY, at, false)
      if (press) clearTimeout(press.timer)
      press = { id: e.pointerId, timer: window.setTimeout(() => ((press = null), openWheel(e.clientX, e.clientY, at, false)), LONG_PRESS) }
    })
    const cancel = (e: PointerEvent) => {
      if (press?.id !== e.pointerId) return
      clearTimeout(press.timer)
      press = null
    }
    map.addEventListener('pointerup', cancel)
    map.addEventListener('pointercancel', cancel)
    map.addEventListener('pointerleave', cancel)
  }

  /* ---------------- The feed and the bubbles ---------------- */

  const feed = h('div', { class: 'vs-feed', 'aria-live': 'polite' })
  const bubbles = h('div', { class: 'vs-bubbles' })
  const bubbleOf = new Map<number, { el: HTMLElement; at: number }>()
  let feedKey = ''

  /** Whether this screen shows `slot`'s line: its team's (or both teams'), and not muted (your own always). */
  const hears = (g: Game, slot: number, all: boolean) => {
    const mine = localPlayer(g)
    if (slot === mine.slot) return true
    if (!settings().quickChat) return false
    return all || g.players[slot]?.versus?.team === mine.versus?.team
  }

  const updateFeed = (g: Game) => {
    const s = g.versus!
    type Line = { slot: number; at: number; text: string; ping: PingKind | null; all: boolean }
    const shown: Line[] = []
    for (const l of s.talk) if (hears(g, l.slot, l.all)) shown.push({ slot: l.slot, at: l.at, text: m.chat.lines[l.msg], ping: null, all: l.all })
    for (const p of s.pings) if (seesPing(g, p)) shown.push({ slot: p.slot, at: p.at, text: m.ping.kinds[p.kind], ping: p.kind, all: false })
    shown.sort((a, b) => a.at - b.at)
    const last = shown.slice(-FEED_LINES)
    const key = last.map((l) => `${l.slot}:${l.at}:${l.ping ?? ''}`).join('|')
    if (key === feedKey) return
    feedKey = key
    feed.replaceChildren(
      ...last.map((l) => {
        const team = g.players[l.slot]?.versus?.team ?? 0
        return h(
          'div',
          { class: `vs-feed-line${l.ping ? ' ping' : ''}`, style: `--team:${teamColor(team)}${l.ping ? `;--ping:${PING_COLORS[l.ping]}` : ''}` },
          l.ping ? h('img', { src: pingIconUrl(l.ping), alt: '' }) : null,
          h('b', {}, versusName(g, l.slot)),
          h('span', {}, l.text),
          l.all ? h('em', {}, m.chat.all) : null,
        )
      }),
    )
  }

  /** Each speaker's latest line over their head while it lasts, if they're on screen (and not hidden from this one in the grass). */
  const updateBubbles = (g: Game) => {
    const s = g.versus!
    const mine = localPlayer(g)
    const latest = new Map<number, (typeof s.talk)[number]>()
    for (const l of s.talk) if (hears(g, l.slot, l.all)) latest.set(l.slot, l)
    for (const [slot, b] of bubbleOf) {
      if (latest.get(slot)?.at === b.at) continue
      b.el.remove()
      bubbleOf.delete(slot)
    }
    for (const [slot, l] of latest) {
      const p = g.players[slot]
      if (!p || p.hp <= 0 || concealed(mine, p)) {
        bubbleOf.get(slot)?.el.classList.add('hidden')
        continue
      }
      let b = bubbleOf.get(slot)
      if (!b) {
        const team: Team = p.versus?.team ?? 0
        b = { el: h('div', { class: 'vs-bubble', style: `--team:${teamColor(team)}` }, m.chat.lines[l.msg]), at: l.at }
        bubbleOf.set(slot, b)
        bubbles.append(b.el)
      }
      const at = deps.toScreen(p.x, p.y - HEAD)
      const off = at.x < 0 || at.y < 0 || at.x > window.innerWidth || at.y > window.innerHeight
      b.el.classList.toggle('hidden', off)
      b.el.classList.toggle('fading', g.now - l.at > VERSUS.talk.keep - 1)
      setStyle(b.el, 'transform', `translate(${unzoom(at.x)}px, ${unzoom(at.y)}px)`)
    }
  }

  /* ---------------- The surrender vote ---------------- */

  const voteTitle = h('b', { class: 'vs-vote-title' })
  const voteTally = h('span', { class: 'vs-vote-tally' })
  const voteFill = h('i', { class: 'vs-vote-fill' })
  const yesKey = h('i', { class: 'keys-only' }, ' (Y)')
  const noKey = h('i', { class: 'keys-only' }, ' (N)')
  const cast = (yes: boolean) => {
    if (!active || !me || !game) return
    const vote = game.versus?.surrender[me.versus?.team ?? 0]
    if (!vote || vote.yes.includes(me.slot) || vote.no.includes(me.slot) || sent === vote.ends) return
    sent = vote.ends
    deps.send({ kind: 'surrender', vote: yes })
    playSfx('select', 0)
  }
  const voteButton = (yes: boolean) =>
    h(
      'button',
      {
        class: `btn small ${yes ? 'confirm' : ''}`,
        type: 'button',
        onpointerdown: (e) => {
          e.preventDefault()
          e.stopPropagation()
          cast(yes)
        },
      },
      yes ? m.surrender.yes : m.surrender.no,
      yes ? yesKey : noKey,
    )
  const voteButtons = h('div', { class: 'vs-vote-buttons' }, voteButton(true), voteButton(false))
  const voteDone = h('small', { class: 'vs-vote-done hidden' }, m.surrender.voted)
  const voteBox = h('div', { class: 'vs-vote box hidden', role: 'alertdialog' }, voteTitle, voteTally, h('span', { class: 'vs-vote-bar' }, voteFill), voteButtons, voteDone)
  /** The vote this screen voted on (its `ends`), until the state shows the vote. */
  let sent = -1

  const updateVote = (g: Game, p: Player) => {
    const vote = g.versus!.surrender[p.versus?.team ?? 0]
    voteBox.classList.toggle('hidden', !vote || g.phase !== 'playing')
    if (!vote) return
    const team = voters(g, p.versus?.team ?? 0).map((q) => q.slot)
    const yes = vote.yes.filter((slot) => team.includes(slot)).length
    setText(voteTitle, vote.by === p.slot ? m.surrender.mine : m.surrender.title(versusName(g, vote.by)))
    setText(voteTally, m.surrender.tally(yes, surrenderNeed(team.length)))
    setStyle(voteFill, 'width', `${Math.round(Math.max(0, Math.min(1, (vote.ends - g.time) / VERSUS.surrender.window)) * 100)}%`)
    const voted = vote.yes.includes(p.slot) || vote.no.includes(p.slot) || sent === vote.ends || !team.includes(p.slot)
    voteButtons.classList.toggle('hidden', voted)
    voteDone.classList.toggle('hidden', !voted)
  }

  /* ---------------- The scoreboard ---------------- */

  const board = createLiveBoard(root, () => board.set(false))
  /** The scoreboard was opened by a tap (the score bar or its button), not held on its key. */
  let boardHeld = false

  /* ---------------- Keys ---------------- */

  const offKey = input.onKey((key) => {
    if (!active) return
    if (key === 'KeyT') return toggleChat()
    if (key === 'KeyG') {
      if (wheelOpen()) return closeWheel()
      if (mouse.over) return openWheel(mouse.x, mouse.y, deps.toWorld(mouse.x, mouse.y), false)
      return openWheelAtMe()
    }
    if (key === 'Escape') {
      closeChat()
      closeWheel()
      return
    }
    if (key === 'KeyY' || key === 'KeyN') return cast(key === 'KeyY')
    const n = key.startsWith('Digit') ? Number(key.slice(5)) : NaN
    if (!(n >= 1)) return
    if (chatOpen() && QUICK_CHAT[n - 1]) return say(QUICK_CHAT[n - 1]!)
    if (wheelOpen() && PING_KINDS[n - 1]) return ping(PING_KINDS[n - 1]!)
  })

  /** The score bar (the match HUD's) opens and closes the scoreboard, a phone's way to it. */
  const onScoreTap = (e: Event) => {
    if (!active) return
    e.preventDefault()
    e.stopPropagation()
    board.set(!board.isOpen())
  }
  let scoreBar: HTMLElement | null = null
  const watchScore = () => {
    const bar = root.querySelector<HTMLElement>('.versus-hud .vs-score')
    if (!bar || bar === scoreBar) return
    scoreBar = bar
    bar.addEventListener('pointerdown', onScoreTap)
  }

  /* ---------------- Placing ---------------- */

  const stack = h('div', { class: 'vs-talk-stack' }, voteBox, feed)
  // The chat menu opens beside its button, left of the column.
  column.append(chat)
  const el = h('div', { class: 'vs-talk' }, bubbles, stack, column, wheel)
  root.append(el)
  // The scoreboard over the bubbles and the feed.
  root.append(board.el)
  let placedAt = -Infinity
  /** The stack (vote, feed) goes under whatever runs across the top: the score, the coach's line when it's up there, a phone's row of teammates. */
  const place = () => {
    let bottom = 0
    for (const sel of ['.versus-hud .vs-score', '.versus-hud .vs-coach', '.hud .team-hud']) {
      const r = root.querySelector<HTMLElement>(sel)?.getBoundingClientRect()
      if (!r || r.height === 0 || r.top > window.innerHeight / 2) continue
      // The teammates' column down the left edge (a wide screen) isn't across the top.
      if (sel === '.hud .team-hud' && r.height > r.width) continue
      bottom = Math.max(bottom, r.bottom)
    }
    stack.style.top = `${unzoom(bottom + 6)}px`
    const map = minimap?.getBoundingClientRect()
    column.style.top = `${unzoom((map && map.height > 0 ? map.bottom : bottom) + 8)}px`
  }

  /**
   * Every frame, with this player on the draw copy: `held` while the co-op
   * menu or a screen covers the match (the keys and buttons rest, the menus
   * close). The scoreboard shows while its key is held or it was tapped open.
   */
  const update = (g: Game, p: Player, held: boolean) => {
    game = g
    me = p
    const s = g.versus
    active = !!s && g.phase === 'playing' && !held
    el.classList.toggle('off', !active)
    if (!active) {
      closeChat()
      closeWheel()
    }
    if (!s) return
    watchMinimap()
    watchScore()
    const now = clock()
    if (now - placedAt > 0.5) {
      placedAt = now
      place()
      for (const x of buttons) setText(x.key, boundLabel(x.kind))
    }
    if (chatOpen() && now - chatAt > IDLE_CLOSE) closeChat()
    if (wheelOpen() && now - wheelOpenedAt > IDLE_CLOSE) closeWheel()
    const holding = active && input.isHeld('Backquote')
    if (holding) boardHeld = true
    else if (boardHeld) {
      boardHeld = false
      board.set(false)
    }
    if (holding) board.set(true)
    // The scoreboard sits over the HUD: a menu or the end closes it.
    if (!active) board.set(false)
    board.update(g, p)
    updateFeed(g)
    updateBubbles(g)
    updateVote(g, p)
  }

  /** Whether a menu of this layer takes the number keys now (the level-up tray leaves them alone). */
  const busy = () => chatOpen() || wheelOpen()

  const dispose = () => {
    offKey()
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerdown', onFieldDown, { capture: true })
    window.removeEventListener('mousedown', noAutoscroll)
    scoreBar?.removeEventListener('pointerdown', onScoreTap)
    if (press) clearTimeout(press.timer)
    board.dispose()
    el.remove()
  }
  return { el, update, busy, dispose }
}

export type VersusTalk = ReturnType<typeof createVersusTalk>

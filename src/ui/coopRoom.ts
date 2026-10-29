import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { PLAYABLE } from '../data/hatchlings'
import type { CoopClient } from '../coop/client'
import { memberState, readiness } from '../coop/lobby'
import { parseLoadout, parseSettings } from '../coop/start'
import { roomLink } from '../coopShell'
import { DIFFICULTY_IDS, type Difficulty } from '../game/difficulty'
import { t } from '../i18n'
import { parseRoomCode, ROOM_CODE_LENGTH, MAX_PLAYERS, type Member } from '../net/protocol'
import { arenaIcon, coopIcon, crownIcon, pokeballIcon } from '../render/art'
import { slotColor } from '../render/team'
import { portraitUrl } from '../render/sprites'
import { h, later } from './dom'
import { confirmDialog, difficultyTag, hint, type Screen } from './screens'
import { toast } from './toasts'
import { roleChip, teamColor } from './arena'
import { isVersusPick, VERSUS_ROSTER, type Team } from '../data/versus'
import { ARENA_FORMAT_IDS, ARENA_FORMATS } from '../data/arenaFormats'

/**
 * Co-op outside a run: the hub (create a room, or join one by code) and the
 * room (`coopRoom`): its code and link, the seats with their Pokémon and
 * state, the host's difficulty, kick and start, the ready toggle, inviting
 * friends and leaving. The room screen redraws on every change the client
 * hears; the run starting is the shell's (`startCoopRun` replaces it).
 */

/* ---------------- Keys ---------------- */

/**
 * Arrow keys over the screen's buttons (`[data-nav]`, in page order), Enter
 * presses the highlighted one. Taps and clicks go to the buttons' own
 * handlers, so a redraw never swallows one. The highlight follows the
 * button's `data-nav` key across redraws.
 */
const keyNav = (input: Input, el: HTMLElement, back: () => void) => {
  let current: string | null = null
  /** Where `focus` asked the highlight to be: it goes there once that button is enabled, until the player moves it. */
  let wanted: string | null = null
  const buttons = () => [...el.querySelectorAll<HTMLButtonElement>('[data-nav]')].filter((b) => !b.disabled && b.offsetParent !== null)
  const paint = () => {
    const all = buttons()
    if (wanted && all.some((b) => b.dataset.nav === wanted)) current = wanted
    if (!all.some((b) => b.dataset.nav === current)) current = all[0]?.dataset.nav ?? null
    for (const b of el.querySelectorAll<HTMLElement>('[data-nav]')) b.classList.toggle('selected', b.dataset.nav === current)
  }
  const step = (dir: 1 | -1) => {
    const all = buttons()
    if (all.length === 0) return
    const i = all.findIndex((b) => b.dataset.nav === current)
    current = all[(i + dir + all.length) % all.length]!.dataset.nav ?? null
    wanted = null
    playSfx('move')
    paint()
  }
  const off = input.onKey((k) => {
    if (k === 'ArrowLeft' || k === 'ArrowUp') step(-1)
    else if (k === 'ArrowRight' || k === 'ArrowDown') step(1)
    else if (k === 'Enter' || k === 'Space') buttons().find((b) => b.dataset.nav === current)?.click()
    else if (k === 'Escape' || k === 'Backspace') back()
  })
  return { paint, off, focus: (key: string) => ((wanted = current = key), paint()) }
}

/** A button the arrows reach as `key`, its sound and its action after this press is dispatched. */
const navButton = (key: string, label: string, run: () => void, cls = 'btn') =>
  h('button', { class: cls, type: 'button', 'data-nav': key, onclick: () => (playSfx('select'), later(run)) }, label)

const field = (label: string, control: HTMLElement) => h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), h('span', { class: 'field-box' }, control))

/** A co-op screen's title, with the co-op icon (the Arena's in an Arena room). */
const coopTitle = (text: string, arena = false) => h('div', { class: 'dialog-title coop-title' }, h('img', { src: arena ? arenaIcon() : coopIcon(), alt: '' }), h('span', {}, text))

/* ---------------- The hub ---------------- */

export type HubActions = {
  /** Creates a room and joins it: null when it went through (the shell shows the room), else what went wrong. */
  create: () => Promise<string | null>
  /** Joins room `code` the same way. */
  join: (code: string) => Promise<string | null>
  /** Friends (signed in), or null (a dev build without accounts). */
  friends: (() => void) | null
  back: () => void
}

/** Jogar junto (signed in: the team sees the account's @handle): create a room, or join one by its code (`code` prefills it). */
export const coopHub = (root: HTMLElement, input: Input, actions: HubActions, code: string | null = null): Screen => {
  const m = t().coop.hub
  const codeInput = h('input', { class: 'field-input coop-code-input', type: 'text', maxlength: ROOM_CODE_LENGTH, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', enterkeyhint: 'go', placeholder: 'K7QF2' })
  if (code) codeInput.value = code
  const status = h('p', { class: 'field-message coop-status', role: 'status' })
  let busy = false

  const say = (text: string, error = false) => {
    status.textContent = text
    status.classList.toggle('error', error)
  }

  const attempt = async (pending: string, go: () => Promise<string | null>) => {
    if (busy) return
    busy = true
    el.classList.add('busy')
    say(pending)
    const failed = await go()
    busy = false
    el.classList.remove('busy')
    if (failed) {
      playSfx('denied')
      say(failed, true)
    }
  }

  const join = () => {
    const parsed = parseRoomCode(codeInput.value)
    if (!parsed) {
      playSfx('denied')
      say(m.badCode, true)
      return codeInput.focus()
    }
    codeInput.value = parsed
    void attempt(m.joining, () => actions.join(parsed))
  }
  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') join()
    if (e.key === 'Escape') codeInput.blur()
  })
  codeInput.addEventListener('input', () => (codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '')))

  const el = h(
    'div',
    { class: 'screen dim profile-screen coop-screen' },
    h(
      'div',
      { class: 'dialog box pop profile coop-hub' },
      coopTitle(m.title),
      h(
        'div',
        { class: 'invite-body coop-body' },
        h('p', { class: 'invite-tip' }, m.intro),
        navButton('create', m.create, () => void attempt(m.creating, actions.create), 'btn confirm coop-create'),
        h('p', { class: 'coop-or' }, m.or),
        h('div', { class: 'coop-join' }, field(m.code, codeInput), navButton('join', m.join, join)),
        status,
        actions.friends ? navButton('friends', m.friends, actions.friends) : null,
      ),
      h('div', { class: 'buttons' }, navButton('back', m.back, actions.back)),
      hint(m.hintKeys, m.hintTouch),
    ),
  )
  const nav = keyNav(input, el, () => (playSfx('select'), later(actions.back)))
  root.append(el)
  nav.focus(code ? 'join' : 'create')
  return { el, dim: 0.5, dispose: () => (nav.off(), el.remove()) }
}

/* ---------------- The room ---------------- */

export type RoomActions = {
  /** Opens the partner select for this player's Pokémon in the room. */
  partner: () => void
  /** In an Arena room: the Arena's picker instead (the 27 starters). */
  arena: () => void
  /** Friends to invite (signed in), or null. */
  friends: (() => void) | null
  /** Leaves the room for good (asked first here). */
  leave: () => void
  /** Back into the run the team is playing (this player left its screen). Null: none to go back to. */
  rejoin: (() => void) | null
}

/** Phones and tablets share through the system sheet; computers copy. */
const sheet = () => typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches

const shareRoom = async (root: HTMLElement, code: string) => {
  const m = t().coop.lobby
  const url = roomLink(code)
  try {
    if (sheet()) return await navigator.share({ text: `${m.shareText} ${url}` })
    await navigator.clipboard.writeText(url)
    playSfx('unlock')
    toast(root, m.copied, 2400, 'coopLink')
  } catch {
    // Dismissed, or no clipboard: show the link to copy by hand.
    if (!sheet()) toast(root, url, 6000, 'coopLink')
  }
}

/**
 * A seat's card: their Pokémon's portrait in the seat's color, name, crown,
 * partner and what they're up to; the host can remove them. In an Arena room
 * (`team` set, the card in its team's column) the color is their team's, with the Pokémon's role.
 */
const seatCard = (member: Member, index: number, me: boolean, kick: (() => void) | null, team: Team | null = null) => {
  const m = t().coop.lobby
  const pick = member.loadout ? parseLoadout(member.loadout) : null
  const form = pick ? PLAYABLE[pick.starter].line[0] : null
  const state = memberState(member)
  const role = team !== null && pick && isVersusPick(pick.starter) ? roleChip(VERSUS_ROSTER[pick.starter]) : null
  return h(
    'div',
    { class: `coop-seat ${state}${me ? ' me' : ''}${team !== null ? ` arena-seat team${team}` : ''}`, style: `--slot:${team !== null ? teamColor(team) : slotColor(index)}` },
    h('img', { class: 'coop-seat-portrait', src: form && pick ? portraitUrl(form.dex, pick.shiny) : pokeballIcon(), alt: '' }),
    h(
      'div',
      { class: 'coop-seat-text' },
      h('b', { class: 'coop-seat-name' }, member.host ? h('img', { class: 'coop-crown', src: crownIcon(), alt: m.host, title: m.host }) : null, h('span', {}, member.name)),
      h('span', { class: 'coop-seat-partner' }, form?.name ?? '…', role, me ? h('em', { class: 'coop-you' }, m.you) : null),
      h('span', { class: `coop-seat-state ${state}` }, m.state[state]),
    ),
    kick ? navButton(`kick:${member.seat}`, m.kick, kick, 'btn small coop-kick') : null,
  )
}

/**
 * The room before (and between) runs. `client` is the tab's co-op client:
 * the screen reads its state and redraws on its room, status and denied
 * events; the host's controls call it directly.
 */
export const coopRoom = (root: HTMLElement, input: Input, client: CoopClient, actions: RoomActions): Screen => {
  const el = h('div', { class: 'screen dim profile-screen coop-screen' })
  /** A confirmation open over the room. */
  let sub: Screen | null = null
  /** A refusal to say for a few seconds (the start denied), over the waiting line. */
  let notice: { text: string; until: number } | null = null

  const ask = (text: string, yes: string, then: () => void) => {
    nav.off()
    sub = confirmDialog(root, input, text, (ok) => {
      sub?.dispose()
      sub = null
      nav = keyNav(input, el, confirmLeave)
      render()
      if (ok) then()
    }, { yes, no: t().mart.no })
  }

  const confirmLeave = () => ask(t().coop.lobby.leaveConfirm, t().coop.lobby.leave, actions.leave)

  let nav = keyNav(input, el, confirmLeave)

  const render = () => {
    if (sub) return
    const m = t().coop.lobby
    const st = client.state()
    const room = st.room
    if (!room) {
      el.replaceChildren(h('div', { class: 'dialog box profile coop-room' }, coopTitle(t().coop.hub.title), h('p', { class: 'invite-note blink' }, t().coop.hub.joining)))
      return nav.paint()
    }
    const me = room.members.find((x) => x.seat === st.seat) ?? null
    const host = me?.host ?? false
    const lobby = room.phase !== 'playing'
    const settings = parseSettings(room.settings)
    const arena = settings.mode === 'versus'
    const ready = readiness(room)
    const v = t().versus
    const mine = me?.loadout ? parseLoadout(me.loadout) : null
    const teamOf = (member: Member): Team | null => (arena ? (member.loadout ? (parseLoadout(member.loadout).team ?? 0) : 0) : null)

    const kickOf = (member: Member) => (host && lobby && member.seat !== st.seat ? () => ask(m.kickConfirm(member.name), m.kick, () => client.kick(member.seat)) : null)
    const seats = Array.from({ length: MAX_PLAYERS }, (_, i) => {
      const member = room.members[i]
      if (member) return seatCard(member, i, member.seat === st.seat, kickOf(member), teamOf(member))
      return h(
        'div',
        { class: 'coop-seat empty' },
        h('span', { class: 'coop-seat-empty' }, m.empty),
        actions.friends && i === room.members.length ? navButton(`invite:${i}`, m.invite, actions.friends, 'btn small') : null,
      )
    })

    /** The host's Horda / Arena switch: what the room plays next. */
    const mode = host && lobby
      ? h(
          'div',
          { class: 'shell-seg coop-mode', role: 'radiogroup', 'aria-label': v.room.mode },
          ...(['run', 'versus'] as const).map((id) =>
            h(
              'button',
              { class: `shell-seg-option${(id === 'versus') === arena ? ' on' : ''}`, type: 'button', 'data-nav': `mode:${id}`, 'aria-pressed': String((id === 'versus') === arena), onclick: () => (id === 'versus') !== arena && (playSfx('move'), client.setSettings({ difficulty: settings.difficulty, mode: id, format: settings.format })) },
              v.room.modes[id],
            ),
          ),
        )
      : h('span', { class: 'coop-difficulty-read' }, v.room.modes[arena ? 'versus' : 'run'], h('small', {}, m.hostPicks))

    /**
     * An Arena room's format, the host's switch: 4v4 on the Vale or 3v3 on
     * the Clareira (the relay keeps a room of more trainers than the 3v3
     * seats on the 4v4).
     */
    const format = settings.format ?? 'standard'
    const formatPick = host && lobby
      ? h(
          'div',
          { class: 'shell-seg coop-format', role: 'radiogroup', 'aria-label': v.room.format },
          ...ARENA_FORMAT_IDS.map((id) =>
            h(
              'button',
              {
                class: `shell-seg-option${id === format ? ' on' : ''}`,
                type: 'button',
                'data-nav': `format:${id}`,
                'aria-pressed': String(id === format),
                disabled: id !== format && room.members.length > ARENA_FORMATS[id].teamSize * 2,
                onclick: () => id !== format && (playSfx('move'), client.setSettings({ difficulty: settings.difficulty, mode: 'versus', format: id })),
              },
              `${v.formats[id].size} ${v.formats[id].name}`,
            ),
          ),
        )
      : h('span', { class: 'coop-difficulty-read' }, `${v.formats[format].size} ${v.formats[format].name}`, h('small', {}, m.hostPicks))
    const teamSize = ARENA_FORMATS[format].teamSize

    /**
     * Arena: the seats in two columns, Azul and Vermelho, each with its
     * players and, for the rest of the format's team, the bots that will take them (the
     * first one on your side invites, when there are friends to ask). Your
     * column's head switches you to the other side (a full side sends the
     * rest to the other when the match starts).
     */
    const myTeam: Team = mine?.team ?? 0
    const columns = arena
      ? ([0, 1] as const).map((team) => {
          const members = room.members.filter((member) => teamOf(member) === team)
          const open = Math.max(0, teamSize - members.length)
          const other: Team = team === 0 ? 1 : 0
          const switcher = lobby && mine && team === myTeam
            ? h('button', { class: 'btn small arena-switch', type: 'button', style: `--team:${teamColor(other)}`, 'data-nav': 'team', onclick: () => (playSfx('move'), client.setLoadout({ ...mine, team: other })) }, v.room.switchTo(v.teams[other]!))
            : null
          return h(
            'div',
            { class: `arena-room-team team${team}${team === myTeam ? ' mine' : ''}`, style: `--team:${teamColor(team)}` },
            h('div', { class: 'arena-room-head' }, h('b', {}, v.teams[team]), h('span', {}, `${members.length}/${teamSize}`), switcher),
            ...members.map((member) => seatCard(member, room.members.indexOf(member), member.seat === st.seat, kickOf(member), team)),
            ...Array.from({ length: open }, (_, i) =>
              h(
                'div',
                { class: 'coop-seat arena-bot-seat', style: `--slot:${teamColor(team)}` },
                h('img', { class: 'coop-seat-portrait', src: pokeballIcon(), alt: '' }),
                h('div', { class: 'coop-seat-text' }, h('b', { class: 'coop-seat-name' }, v.room.open), h('span', { class: 'coop-seat-partner' }, v.room.bot)),
                actions.friends && lobby && team === myTeam && i === 0 && room.members.length < MAX_PLAYERS ? navButton(`invite:${team}`, m.invite, actions.friends, 'btn small') : null,
              ),
            ),
          )
        })
      : null

    const difficulty = host && lobby
      ? h(
          'div',
          { class: 'shell-seg coop-difficulty', role: 'radiogroup', 'aria-label': m.difficulty },
          ...DIFFICULTY_IDS.map((d: Difficulty) =>
            h(
              'button',
              { class: `shell-seg-option ${d}${d === settings.difficulty ? ' on' : ''}`, type: 'button', 'data-nav': `diff:${d}`, 'aria-pressed': String(d === settings.difficulty), onclick: () => d !== settings.difficulty && (playSfx('move'), client.setSettings({ difficulty: d })) },
              t().difficulty.names[d],
            ),
          ),
        )
      : h('span', { class: 'coop-difficulty-read' }, difficultyTag(settings.difficulty), h('small', {}, m.hostPicks))

    const connecting = st.status.kind === 'connecting'
    // The room moving to the relay best for the group (the host's Start): a moment, then the run.
    const moving = st.moving !== null
    const waiting = moving
      ? m.choosing
      : connecting
        ? m.reconnecting
        : !lobby
          ? m.playing
          : host
            ? room.members.length === 1
              ? m.alone
              : ready.all
                ? m.allReady
                : m.waitAll(ready.ready, ready.total)
            : me?.ready
              ? m.waitHost
              : m.getReady
    const said = notice && notice.until > performance.now() ? notice.text : waiting

    const main = !lobby
      ? actions.rejoin && navButton('rejoin', m.rejoin, actions.rejoin, 'btn confirm')
      : host
        ? h('button', { class: 'btn confirm', type: 'button', 'data-nav': 'start', disabled: !ready.all || connecting || moving, onclick: () => (playSfx('select'), client.start()) }, m.start)
        : navButton('ready', me?.ready ? m.unready : m.ready, () => client.setReady(!me?.ready), me?.ready ? 'btn' : 'btn confirm')

    el.replaceChildren(
      h(
        'div',
        { class: 'dialog box profile coop-room' },
        coopTitle(arena ? `${v.title} · ${v.formats[format].size} ${v.formats[format].name}` : t().coop.hub.title, arena),
        h(
          'div',
          { class: 'invite-body coop-body' },
          h(
            'div',
            { class: 'coop-code' },
            h('span', { class: 'coop-code-label' }, m.code),
            h('b', { class: 'coop-code-value' }, room.code),
            navButton('share', sheet() ? m.share : m.copy, () => void shareRoom(root, room.code), 'btn small'),
          ),
          columns ? h('div', { class: 'arena-room-teams' }, columns[0]!, h('span', { class: 'arena-vs' }, 'VS'), columns[1]!) : h('div', { class: 'coop-seats' }, ...seats),
          h('div', { class: 'coop-settings' }, h('span', { class: 'field-label' }, v.room.mode), mode),
          arena && h('div', { class: 'coop-settings' }, h('span', { class: 'field-label' }, v.room.format), formatPick),
          !arena && h('div', { class: 'coop-settings' }, h('span', { class: 'field-label' }, m.difficulty), difficulty),
          arena
            ? h('ol', { class: 'arena-room-steps' }, ...v.room.steps.map((step, i) => h('li', {}, h('span', { class: 'arena-step-n' }, String(i + 1)), h('span', {}, step))))
            : h('p', { class: 'invite-tip coop-rules' }, `${t().coop.hub.intro} ${m.rules}`),
        ),
        h('p', { class: `coop-wait${notice && notice.until > performance.now() ? ' error' : ''}`, role: 'status' }, said),
        h(
          'div',
          { class: 'buttons coop-buttons' },
          lobby ? navButton('partner', arena ? v.room.pokemon : m.partner, arena ? actions.arena : actions.partner) : null,
          main,
          actions.friends ? navButton('friends', m.friends, actions.friends) : null,
          navButton('leave', m.leave, confirmLeave),
        ),
        hint(m.hintKeys, m.hintTouch),
      ),
    )
    nav.paint()
  }

  const off = client.on((e) => {
    if (e.kind === 'denied') {
      playSfx('denied')
      notice = { text: t().coop.denied[e.why], until: performance.now() + 4000 }
      setTimeout(render, 4100)
    }
    if (e.kind === 'room' || e.kind === 'status' || e.kind === 'denied' || e.kind === 'moving') render()
  })
  root.append(el)
  render()
  // The highlight starts on what the player came to do: start (the host) or get ready.
  nav.focus(client.state().room?.members.some((x) => x.seat === client.state().seat && x.host) ? 'start' : 'ready')
  return { el, dim: 0.5, dispose: () => (off(), nav.off(), sub?.dispose(), el.remove()) }
}

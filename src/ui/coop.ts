import { accountState } from '../account'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { PLAYABLE } from '../data/hatchlings'
import { DIFFICULTY_IDS } from '../game/difficulty'
import type { Game } from '../game/types'
import { t } from '../i18n'
import { connection, onConnection, playerName, setPlayerName } from '../net/client'
import { parseRoomCode, ROOM_CODE_LENGTH, setupOf, type Member } from '../net/protocol'
import { isHost, kick, onRoom, room, setDifficulty, setReady, startRun } from '../net/room'
import { roomUrl } from '../ranking'
import { slotColor } from '../render/coop'
import { portraitUrl } from '../render/sprites'
import { h, later, setText } from './dom'
import { difficultyTag, hint, menu, type Screen } from './screens'
import { toast } from './toasts'

/**
 * Co-op screens: the hub (create a room, join one by code, friends), the
 * room's lobby (who's in, their Pokémon, ready, the host's difficulty and
 * start, the link to share) and the team's wait while level-ups are picked.
 */

const field = (label: string, control: HTMLElement) =>
  h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), h('span', { class: 'field-box' }, control))

/** A line under the buttons for the connection and refusals. Returns the element and its disposer. */
const statusLine = () => {
  const el = h('p', { class: 'profile-note coop-status' })
  const show = () => {
    const c = connection()
    setText(el, c === 'connecting' ? t().coop.connecting : c === 'off' ? t().coop.offline : '')
  }
  show()
  const offConn = onConnection(show)
  const offRoom = onRoom((e) => {
    if (e.t === 'refused') {
      playSfx('hurt')
      setText(el, t().coop.refused[e.code])
    }
  })
  return { el, dispose: () => (offConn(), offRoom()) }
}

export type HubActions = { create: () => void; join: (code: string) => void; friends: (() => void) | null; back: () => void }

/** The co-op hub: create a room, join one by code, open friends. Guests set the name teammates see. */
export const coopHub = (root: HTMLElement, input: Input, actions: HubActions, code?: string): Screen => {
  const m = t().coop
  const signedIn = accountState().kind === 'signedIn'
  const nameInput = h('input', { class: 'field-input', type: 'text', maxlength: 24, autocomplete: 'nickname', spellcheck: 'false', enterkeyhint: 'done' })
  nameInput.value = playerName()
  nameInput.addEventListener('change', () => (nameInput.value = setPlayerName(nameInput.value) ?? playerName()))
  const codeInput = h('input', { class: 'field-input code-input', type: 'text', maxlength: ROOM_CODE_LENGTH, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', enterkeyhint: 'go', placeholder: 'K7QF2' })
  const status = statusLine()
  if (code) codeInput.value = code

  const join = () => {
    const code = parseRoomCode(codeInput.value)
    if (!code) {
      codeInput.focus()
      return playSfx('hurt')
    }
    actions.join(code)
  }
  codeInput.addEventListener('keydown', (e) => e.key === 'Enter' && join())

  const items = [
    { label: m.create, run: actions.create },
    { label: m.join, run: join },
    ...(actions.friends ? [{ label: m.friends, run: actions.friends }] : []),
    { label: m.back, run: actions.back },
  ]
  const buttons = items.map((i) => h('button', { class: 'btn' }, i.label))
  // Arriving from a room link, Join is the move.
  const nav = menu(input, buttons, (i) => (playSfx('select'), later(items[i]!.run)), { initial: code ? 1 : 0 })
  const offEsc = input.onKey((k) => (k === 'Escape' || k === 'Backspace') && later(actions.back))

  const el = h(
    'div',
    { class: 'screen dim' },
    h(
      'div',
      { class: 'dialog box pop coop-hub' },
      h('div', { class: 'dialog-title' }, m.title),
      h('p', { class: 'profile-note' }, m.intro),
      signedIn ? null : field(m.name, nameInput),
      h('div', { class: 'coop-join' }, field(m.code, codeInput), buttons[1]!),
      h('div', { class: 'buttons' }, buttons[0]!, ...buttons.slice(2)),
      status.el,
      hint(m.hintKeys, m.hintTouch),
    ),
  )
  root.append(el)
  return { el, dispose: () => (nav.off(), offEsc(), status.dispose(), el.remove()) }
}

/** A member's card: their Pokémon's portrait in their slot color, name and what they're up to. */
const memberCard = (member: Member, you: boolean, host: boolean, canKick: boolean) => {
  const m = t().coop
  const setup = setupOf(member)
  const dex = PLAYABLE[setup.starter].line[0].dex
  // The host starts the run when they're ready: their card just says who they are.
  const state = !member.online ? m.reconnecting : host ? '' : member.ready ? m.ready : m.picking
  return h(
    'div',
    { class: `slot-card${member.ready ? ' ready' : ''}${member.online ? '' : ' offline'}`, style: `--slot:${slotColor(member.slot)}` },
    h('img', { class: 'slot-portrait', src: portraitUrl(dex, setup.shiny), alt: '' }),
    h('b', { class: 'slot-name' }, member.name),
    h('span', { class: 'slot-mon' }, PLAYABLE[setup.starter].name),
    h('span', { class: 'slot-tags' }, you && h('span', { class: 'tag' }, m.you), host && h('span', { class: 'tag tag-new' }, m.host)),
    h('span', { class: 'slot-state' }, member.ready && !host ? `✓ ${state}` : state),
    canKick && h('button', { class: 'slot-kick', type: 'button', onclick: () => (playSfx('select'), kick(member.slot)) }, m.kick),
  )
}

export type LobbyActions = {
  /** Opens the Pokémon select for this player's loadout. */
  change: () => void
  /** Opens friends to invite (signed in), or null. */
  invite: (() => void) | null
  leave: () => void
}

/**
 * The room's lobby, redrawn whenever the room changes: the code and its link,
 * up to four member cards (open slots invite friends), the difficulty (the
 * host picks it), and Change Pokémon, Ready, Start (host) and Leave.
 */
export const lobbyScreen = (root: HTMLElement, input: Input, actions: LobbyActions): Screen => {
  const el = h('div', { class: 'screen dim' })
  const status = statusLine()
  let nav: ReturnType<typeof menu> | null = null

  const share = async (code: string) => {
    const url = roomUrl(code)
    try {
      if (navigator.share) return await navigator.share({ title: 'Pokémon Survivors', text: t().coop.shareText, url })
    } catch {
      // Dismissed or not allowed: copy instead.
    }
    await copy(code)
  }

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(roomUrl(code))
      playSfx('unlock')
      toast(root, t().coop.copied, 2000, 'room-link')
    } catch {
      toast(root, roomUrl(code), 5000, 'room-link')
    }
  }

  const render = () => {
    const r = room()
    const m = t().coop
    if (!r || !r.lobby) {
      nav?.off()
      nav = null
      return el.replaceChildren(h('div', { class: 'dialog box coop-hub' }, h('p', { class: 'profile-note blink' }, m.connecting), status.el))
    }
    const lobby = r.lobby
    const host = isHost(r)
    const mine = lobby.members.find((x) => x.slot === r.slot)
    const everyoneReady = lobby.members.every((x) => x.ready || !x.online || x.slot === r.slot)
    const cards = Array.from({ length: 4 }, (_, i) => {
      const member = lobby.members[i]
      if (member) return memberCard(member, member.slot === r.slot, member.slot === lobby.host, host && member.slot !== r.slot)
      return h('div', { class: 'slot-card empty' }, h('span', { class: 'slot-empty' }, m.empty), actions.invite && h('button', { class: 'slot-invite', type: 'button', onclick: () => (playSfx('select'), later(actions.invite!)) }, m.invite))
    })
    const difficulties = DIFFICULTY_IDS.map((d) =>
      h(
        'button',
        { class: `difficulty-pick${d === lobby.difficulty ? ' picked' : ''}`, type: 'button', disabled: !host, onclick: () => host && (playSfx('select'), setDifficulty(d)) },
        difficultyTag(d),
      ),
    )
    const items = [
      { label: m.change, run: actions.change },
      ...(host ? [{ label: m.start, run: startRun }] : [{ label: mine?.ready ? m.unready : m.setReady, run: () => setReady(!mine?.ready) }]),
      { label: m.copyLink, run: () => void copy(r.code) },
      { label: m.shareLink, run: () => void share(r.code) },
      { label: m.leave, run: actions.leave },
    ]
    const buttons = items.map((i) => h('button', { class: i.label === m.start ? 'btn confirm' : 'btn' }, i.label))
    if (host && !everyoneReady) buttons[1]!.setAttribute('disabled', '')
    const at = Math.min(nav?.index ?? 1, buttons.length - 1)
    nav?.off()
    nav = menu(input, buttons, (i) => (playSfx('select'), later(items[i]!.run)), { horizontal: true, initial: at })
    el.replaceChildren(
      h(
        'div',
        { class: 'dialog box wide lobby' },
        h('div', { class: 'dialog-title' }, m.room(r.code)),
        h('div', { class: 'slot-grid' }, ...cards),
        h('div', { class: 'difficulty-row' }, h('span', { class: 'field-label' }, t().difficulty.label), ...difficulties),
        h('p', { class: 'profile-note small' }, m.rules),
        h('div', { class: 'buttons lobby-buttons' }, ...buttons),
        h('p', { class: 'profile-note small' }, host ? (everyoneReady ? '' : m.waitReady) : m.waitHost),
        status.el,
      ),
    )
  }

  render()
  const off = onRoom((e) => (e.t === 'lobby' || e.t === 'room' || e.t === 'closed') && render())
  const offEsc = input.onKey((k) => k === 'Escape' && later(actions.leave))
  root.append(el)
  return { el, dispose: () => (nav?.off(), off(), offEsc(), status.dispose(), el.remove()) }
}

/**
 * While the team picks level-ups and this player already did (or has none):
 * who's still picking and the seconds left before the game picks for them.
 */
export const teamWait = (root: HTMLElement, g: Game, names: readonly string[]): Screen => {
  const m = t().coop
  const who = h('div', { class: 'dialog-title' })
  const timer = h('p', { class: 'team-timer' })
  const el = h('div', { class: 'screen team-wait' }, h('div', { class: 'dialog box pop' }, h('p', { class: 'tag tag-new' }, m.picked), who, timer))
  const tick = () => {
    const picking = g.players.filter((p) => !p.gone && p.pendingLevelUps > 0).map((p) => names[p.slot] ?? `P${p.slot + 1}`)
    setText(who, m.picks(picking.join(', ')))
    setText(timer, m.timer(Math.max(0, Math.ceil(g.coop?.pickLeft ?? 0))))
  }
  tick()
  root.append(el)
  return { el, tick, dispose: () => el.remove() }
}

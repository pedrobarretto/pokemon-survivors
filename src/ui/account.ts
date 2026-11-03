import { accountState, onAccountChange, signIn, type AccountState } from '../account'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { t } from '../i18n'
import { h, later } from './dom'
import { hint, menu, type Screen } from './screens'

type Action = { label: string; run: () => void }

/** What a gate says: its title, the pitch, a note under it, and (with a guest option) the guest's note. */
type GateText = { title: string; pitch: string; note: string; guestNote: string | null }

type GateActions = {
  play: () => void
  /** Playing as a guest instead, or null where only an account will do (co-op). */
  guest: (() => void) | null
  back: () => void
  /** Whether a signed-in account can go on (co-op waits for its @handle); until then the gate says it's busy. */
  ready?: (s: AccountState) => boolean
}

/**
 * A sign-in gate: Google or Discord (which also creates the account), and,
 * with `guest`, playing as a guest. `lead` lines go above the pitch. Signing
 * in leaves for the provider; an account already open in another tab links
 * right away and goes on to `play` once `ready`. Back, Esc or Backspace call `back`.
 */
const gate = (root: HTMLElement, input: Input, text: GateText, actions: GateActions, lead: readonly string[] = []): Screen => {
  const el = h('div', { class: 'screen dim' })
  let nav: ReturnType<typeof menu> | null = null
  const ready = actions.ready ?? ((s: AccountState) => s.kind === 'signedIn')
  const guest = actions.guest

  const build = (s: AccountState, opening: boolean) => {
    const m = t().account
    const busy = s.kind === 'busy' || (s.kind === 'signedIn' && !ready(s))
    const failed = s.kind === 'guest' && s.failed
    const all: Action[] = busy
      ? [{ label: m.back, run: () => leave(actions.back) }]
      : [
          { label: m.google, run: () => void signIn() },
          { label: t().discord.signIn, run: () => void signIn('discord') },
          ...(guest ? [{ label: m.playAsGuest, run: () => leave(guest) }] : []),
        ]
    const buttons = all.map((a) => h('button', { class: 'btn' }, a.label))
    nav?.off()
    nav = menu(input, buttons, (i) => (playSfx('select'), later(all[i]!.run)))
    const line = (text: string, cls = '') => h('p', { class: `account-line ${cls}` }, text)
    el.replaceChildren(
      h(
        'div',
        { class: opening ? 'dialog box pop account' : 'dialog box account' },
        h('div', { class: 'dialog-title' }, text.title),
        ...lead.map((l) => line(l, 'account-lead')),
        busy ? line(m.busy, 'blink') : line(text.pitch),
        ...(failed ? [line(m.failed, 'account-error')] : []),
        ...(busy ? [] : [line(text.note, 'account-note')]),
        h('div', { class: 'buttons account-buttons' }, ...buttons),
        ...(busy || text.guestNote === null ? [] : [line(text.guestNote, 'account-note')]),
        hint(m.hintKeys, m.hintTouch),
      ),
    )
  }

  const offState = onAccountChange((s) => (s.kind === 'signedIn' && ready(s) ? leave(actions.play) : build(s, false)))
  const offKeys = input.onKey((key) => (key === 'Escape' || key === 'Backspace') && (playSfx('select'), leave(actions.back)))

  const dispose = () => (nav?.off(), offState(), offKeys(), el.remove())

  let left = false
  /** Closes the gate and runs `next` after the current key dispatch. */
  const leave = (next: () => void) => {
    if (left) return
    left = true
    dispose()
    later(next)
  }

  build(accountState(), true)
  root.append(el)
  return { el, dispose }
}

/**
 * Asked when a guest taps Play (accounts on): sign in with Google or Discord,
 * which also creates the account, or play as a guest. Signing in leaves for the provider; an
 * account already open in another tab links right away and goes on to `play`.
 * Back, Esc or Backspace call `onBack`.
 */
export const playGate = (root: HTMLElement, input: Input, actions: { play: () => void; guest: () => void; back: () => void }): Screen => {
  const m = t().account
  return gate(root, input, { title: m.gateTitle, pitch: m.gatePitch, note: m.gateNewAccount, guestNote: m.gateGuestNote }, actions)
}

/**
 * "Entre para jogar junto": co-op is for accounts, so a guest opening the
 * Co-op tile or a room link (`room`, and `invitedBy`: the @handle that sent
 * it) signs in here, with no guest option. It goes on to `play` once the
 * account is in and its handle is known (the shell asks for one if it has
 * none). Leaving for the provider, the shell keeps where to come back.
 */
export const coopGate = (root: HTMLElement, input: Input, where: { room: string | null; invitedBy: string | null }, actions: { play: () => void; back: () => void }): Screen => {
  const m = t().coop.gate
  const lead = where.invitedBy ? [m.invited(`@${where.invitedBy}`)] : where.room ? [m.room(where.room)] : []
  return gate(root, input, { title: m.title, pitch: m.pitch, note: m.note, guestNote: null }, { ...actions, guest: null, ready: (s) => s.kind === 'signedIn' && s.handle !== undefined }, lead)
}

/**
 * The Arena's public queue (Casual, Ranqueada) is for accounts with a
 * handle, like co-op: a guest signs in here, with no guest option (the
 * Partida rápida against bots stays open to guests). Goes on to `play` once
 * the account is in and its handle is known.
 */
export const arenaGate = (root: HTMLElement, input: Input, actions: { play: () => void; back: () => void }): Screen => {
  const m = t().versus.gate
  return gate(root, input, { title: m.title, pitch: m.pitch, note: m.note, guestNote: null }, { ...actions, guest: null, ready: (s) => s.kind === 'signedIn' && s.handle !== undefined })
}

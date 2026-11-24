import { accountState, emailHere, onAccountChange, signIn, type AccountState } from '../account'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { cjk, t } from '../i18n'
import { h, later } from './dom'
import { emailSheet, type EmailSheet } from './emailSignIn'
import { hint, menu, type Screen } from './screens'
import { keepSignInPlace, type SignInPlace } from '../signInPlace'

type Action = { label: string; run: () => void }

/** What a gate says: its title, the pitch, a note under it, and (with a guest option) the guest's note and button (`playAsGuest` by default). */
type GateText = { title: string; pitch: string; note: string; guestNote: string | null; guestLabel?: string }

type GateActions = {
  play: () => void
  /** Playing as a guest instead, or null where only an account will do (co-op). */
  guest: (() => void) | null
  back: () => void
  /** Whether a signed-in account can go on (co-op waits for its @handle); until then the gate says it's busy. */
  ready?: (s: AccountState) => boolean
  /** A Google, Discord or email button pressed, before leaving for the provider (or opening the email sheet). */
  signingIn?: () => void
  /** Opens on the email sheet (a tab a portal's frame opened for it, `handoff.ts`). */
  email?: boolean
  /** Opens over the screen on show instead of in its place: that screen keeps its look and hears no keys meanwhile (`Input.layer`). */
  over?: boolean
}

/**
 * A sign-in gate: Google, Discord or a code by email (each also creates the
 * account; Chinese first offers email, as Google and Discord are blocked in
 * mainland China), and, with `guest`, playing as a guest. `lead` lines go
 * above the pitch. Google and Discord leave for the provider; email opens its
 * sheet in the gate (`emailSheet`; inside a portal's frame, on a tab of the
 * site, `emailHere`). An account already open in another tab links right
 * away and goes on to `play` once `ready`. Back, Esc or Backspace call `back`
 * (on the email sheet, they go back to the other ways).
 */
const gate = (root: HTMLElement, base: Input, text: GateText, actions: GateActions, lead: readonly string[] = []): Screen => {
  const layer = actions.over ? base.layer() : null
  const input = layer?.input ?? base
  const el = h('div', { class: actions.over ? 'screen dim account-over' : 'screen dim' })
  let nav: ReturnType<typeof menu> | null = null
  const ready = actions.ready ?? ((s: AccountState) => s.kind === 'signedIn')
  const guest = actions.guest
  /** The email sheet while it's open in place of the gate's buttons. */
  let email: EmailSheet | null = null

  const openEmail = () => {
    actions.signingIn?.()
    if (!emailHere()) return
    email ??= emailSheet(closeEmail)
    build(accountState(), false)
    email.focus()
  }

  const closeEmail = () => {
    email?.dispose()
    email = null
    build(accountState(), false)
  }

  const build = (s: AccountState, opening: boolean) => {
    const m = t().account
    const busy = s.kind === 'busy' || (s.kind === 'signedIn' && !ready(s))
    const failed = s.kind === 'guest' && s.failed
    const providers: Action[] = [
      { label: m.google, run: () => (actions.signingIn?.(), void signIn()) },
      { label: t().discord.signIn, run: () => (actions.signingIn?.(), void signIn('discord')) },
    ]
    const byEmail: Action = { label: m.email.button, run: openEmail }
    const all: Action[] = busy
      ? [{ label: m.back, run: () => leave(actions.back) }]
      : email
        ? []
        : [
            ...(cjk() ? [byEmail, ...providers] : [...providers, byEmail]),
            ...(guest ? [{ label: text.guestLabel ?? m.playAsGuest, run: () => leave(guest) }] : []),
          ]
    const buttons = all.map((a) => h('button', { class: 'btn' }, a.label))
    nav?.off()
    nav = buttons.length > 0 ? menu(input, buttons, (i) => (playSfx('select'), later(all[i]!.run))) : null
    const line = (text: string, cls = '') => h('p', { class: `account-line ${cls}` }, text)
    const body = busy
      ? [line(m.busy, 'blink'), h('div', { class: 'buttons account-buttons' }, ...buttons)]
      : email
        ? [email.el]
        : [
            line(text.pitch),
            ...(failed ? [line(m.failed, 'account-error')] : []),
            line(text.note, 'account-note'),
            h('div', { class: 'buttons account-buttons' }, ...buttons),
            ...(text.guestNote === null ? [] : [line(text.guestNote, 'account-note')]),
          ]
    el.replaceChildren(
      h(
        'div',
        { class: opening ? 'dialog box pop account' : 'dialog box account' },
        h('div', { class: 'dialog-title' }, text.title),
        ...lead.map((l) => line(l, 'account-lead')),
        ...body,
        email && !busy ? null : hint(m.hintKeys, m.hintTouch),
      ),
    )
  }

  const offState = onAccountChange((s) => (s.kind === 'signedIn' && ready(s) ? leave(actions.play) : build(s, false)))
  const offKeys = input.onKey((key) => {
    if (key !== 'Escape' && key !== 'Backspace') return
    playSfx('select')
    if (email && accountState().kind === 'guest') closeEmail()
    else leave(actions.back)
  })

  const dispose = () => (nav?.off(), email?.dispose(), offState(), offKeys(), layer?.close(), el.remove())

  let left = false
  /** Closes the gate and runs `next` after the current key dispatch. */
  const leave = (next: () => void) => {
    if (left) return
    left = true
    dispose()
    later(next)
  }

  if (actions.email) email = emailSheet(closeEmail)
  build(accountState(), true)
  root.append(el)
  email?.focus()
  return { el, dispose }
}

/**
 * Asked when a guest taps Play (accounts on): sign in with Google, Discord or
 * a code by email, which also creates the account, or play as a guest. Signing in leaves for the provider; an
 * account already open in another tab links right away and goes on to `play`.
 * Back, Esc or Backspace call `onBack`; `signingIn` hears a sign in start.
 */
export const playGate = (root: HTMLElement, input: Input, actions: { play: () => void; guest: () => void; back: () => void; signingIn?: () => void }): Screen => {
  const m = t().account
  return gate(root, input, { title: m.gateTitle, pitch: m.gatePitch, note: m.gateNewAccount, guestNote: m.gateGuestNote }, actions)
}

/**
 * "Já joga?": the installed app's first Play on a device with no save
 * (`nextFirst` in `firstTime.ts`). A home screen app keeps its own storage,
 * so an existing player signs in here (in this same window, the redirect
 * coming back into the app) to bring the save back, and goes on to `play`
 * (the lobby) once in; "Sou novo aqui" (`fresh`) goes the first run's way,
 * which never waits on the network. Back, Esc or Backspace call `back`.
 */
export const installedGate = (root: HTMLElement, input: Input, actions: { play: () => void; fresh: () => void; back: () => void; signingIn?: () => void }): Screen => {
  const m = t().account
  return gate(
    root,
    input,
    { title: m.installedTitle, pitch: m.installedPitch, note: m.installedNote, guestNote: m.installedNewNote, guestLabel: m.installedNew },
    { play: actions.play, guest: actions.fresh, back: actions.back, signingIn: actions.signingIn },
  )
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

/** "Entre para entrar no Poké Realm": the realm is for accounts with a @handle, like co-op; goes on to `play` once the account is in and its handle known. */
export const realmGate = (root: HTMLElement, input: Input, actions: { play: () => void; back: () => void }): Screen => {
  const m = t().realm
  return gate(root, input, { title: m.name, pitch: m.gate.pitch, note: m.gate.text, guestNote: null }, { ...actions, guest: null, ready: (s) => s.kind === 'signedIn' && s.handle !== undefined })
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

/**
 * "Entrar com e-mail" on its own: the tab a portal's frame opened to sign in
 * by email (`continueOnSite('email')`, `handoff.ts`), the frame's progress
 * already merged in. Goes on to `play` once in, or `back` (the sheet's own
 * Voltar shows the gate's other ways).
 */
export const emailGate = (root: HTMLElement, input: Input, actions: { play: () => void; back: () => void }): Screen => {
  const m = t().account
  return gate(root, input, { title: m.gateTitle, pitch: m.gatePitch, note: m.gateNewAccount, guestNote: null }, { ...actions, guest: null, email: true })
}

/**
 * The one way every button that asks a guest for an account goes (the
 * Boutique, the Trainer Card, Amigos, the results' save card…): the gates'
 * choice of Google, Discord or a code by email (email first in Chinese), over
 * the screen that asked, which keeps its place and hears no keys meanwhile.
 * `why` says what the account is for there. Back, Esc or Backspace close it
 * (`back`); once in, it closes too (`done`, `back` without one) and the screen
 * under it follows the account as it always does. A provider's round trip
 * comes back to a bare page: `place` is where the shell lands it then
 * (`signInPlace.ts`; null, the lobby).
 */
export const askSignIn = (root: HTMLElement, input: Input, ask: { why: string; place: SignInPlace | null; back?: () => void; done?: () => void }): Screen => {
  const m = t().account
  const leave = (next: (() => void) | undefined) => () => (keepSignInPlace(null), next?.())
  return gate(
    root,
    input,
    { title: m.ask.title, pitch: ask.why, note: m.gateNewAccount, guestNote: null },
    { play: leave(ask.done ?? ask.back), back: leave(ask.back), guest: null, over: true, signingIn: () => keepSignInPlace(ask.place) },
  )
}

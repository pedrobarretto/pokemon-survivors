import { accountState, accountsEnabled, linkDiscord, onAccountChange, type AccountState } from '../account'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { t } from '../i18n'
import { HATCHLINGS } from '../data/hatchlings'
import { DISCORD_GIFT } from '../game/gifts'
import { discordIcon } from '../render/art'
import { DISCORD_INVITE } from '../site/routes'
import { discordStatus } from './discordStatus'
import { h, later, rich } from './dom'
import { contentLine } from './gifts'
import { hint, menu, type Screen } from './screens'

/** Opens the server in a new tab (or the Discord app). */
export const openDiscordServer = () => window.open(DISCORD_INVITE, '_blank', 'noopener')

type Action = { label: string; run: () => void; tone?: 'discord' }

/**
 * The Discord screen (the lobby's Discord button, the Trainer Card's row):
 * what the community server is, and by where the player stands
 * (`discordStatus`) a way in: "Sign in with Discord" for a guest (it creates
 * the account and links both), "Link Discord" for an account (leaves for
 * Discord and comes back linked: `linkDiscord`), the linked username once it
 * is, and the server's invite for everyone. Until it's linked, the gift
 * linking brings (`DISCORD_GIFT`) shows above the buttons. It follows the account state.
 * Back, Esc or Backspace call `onClose` after the key dispatch.
 */
export const discordScreen = (root: HTMLElement, input: Input, onClose: () => void): Screen => {
  const el = h('div', { class: 'screen dim' })
  let nav: ReturnType<typeof menu> | null = null

  const build = (s: AccountState, opening: boolean) => {
    const m = t().discord
    const status = discordStatus(s, accountsEnabled)
    const join: Action = { label: status.kind === 'linked' ? m.openServer : m.join, run: openDiscordServer }
    const back: Action = { label: m.back, run: close }
    const all: Action[] =
      status.kind === 'busy'
        ? [back]
        : status.kind === 'guest'
          ? [{ label: m.signIn, run: () => void linkDiscord(), tone: 'discord' }, join, back]
          : status.kind === 'link'
            ? [{ label: m.link, run: () => void linkDiscord(), tone: 'discord' }, join, back]
            : [{ ...join, tone: 'discord' }, back]
    const buttons = all.map((a) => h('button', { class: a.tone ? 'btn discord-btn' : 'btn' }, a.tone && h('img', { src: discordIcon(), alt: '' }), a.label))
    nav?.off()
    nav = menu(input, buttons, (i) => (playSfx('select'), later(all[i]!.run)))
    const line = (text: string, cls = '') => h('p', { class: `account-line ${cls}` }, text)
    const unlinked = status.kind === 'guest' || status.kind === 'link'
    const failed = unlinked && status.failed
    const gift = contentLine({ content: DISCORD_GIFT })
    el.replaceChildren(
      h(
        'div',
        { class: opening ? 'dialog box pop account discord-dialog' : 'dialog box account discord-dialog' },
        h('div', { class: 'dialog-title discord-title' }, h('img', { src: discordIcon(), alt: '' }), m.title),
        line(m.pitch),
        status.kind === 'linked' && h('p', { class: 'account-line discord-linked' }, h('b', {}, `✓ ${m.connected(status.name)}`)),
        status.kind === 'link' && line(m.linkPitch, 'account-note'),
        status.kind === 'guest' && line(m.guestPitch, 'account-note'),
        unlinked && h('p', { class: 'account-line discord-gift' }, h('img', { src: gift.src, alt: '' }), rich(m.gift(HATCHLINGS[DISCORD_GIFT.family].name))),
        status.kind === 'busy' && line(m.busy, 'blink'),
        failed && line(m.failed, 'account-error'),
        h('div', { class: 'buttons account-buttons' }, ...buttons),
        hint(t().account.hintKeys, t().account.hintTouch),
      ),
    )
  }

  const offState = onAccountChange((s) => build(s, false))
  const offKeys = input.onKey((key) => (key === 'Escape' || key === 'Backspace') && close())

  let closed = false
  const dispose = () => {
    closed = true
    nav?.off()
    offState()
    offKeys()
    el.remove()
  }

  const close = () => {
    if (closed) return
    playSfx('select')
    dispose()
    later(onClose)
  }

  build(accountState(), true)
  root.append(el)
  return { el, dispose }
}

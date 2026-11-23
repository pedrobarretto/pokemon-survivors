import { accountState } from '../account'
import { fetchMyCreator, knownCreator, sendCreatorRequest } from '../creator'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { LOCALES, locale, t } from '../i18n'
import { CREATOR, CREATOR_PLATFORMS, type CreatorLink, type CreatorRequest } from '../net/creatorTag'
import { h, later } from './dom'
import type { Screen } from './screens'

/**
 * The content creator's tag on screen (`net/creatorTag.ts`): the STREAMER
 * tag, a creator's channel links (only approved ones ever reach here from
 * others: the API and the relay vouch for them) and the request sheet the
 * Trainer Card opens.
 */

/** The STREAMER tag beside a name. */
export const streamerTag = (cls = '') => h('span', { class: `streamer-tag${cls ? ` ${cls}` : ''}` }, t().creatorTag.tag)

/** A link as people read it: its host and path, the path's escapes decoded (`twitch.tv/ana`, `youtube.com/@寶可夢`). */
export const creatorLinkLabel = (link: CreatorLink) => {
  const bare = link.url.replace(/^https:\/\//, '')
  try {
    return decodeURIComponent(bare)
  } catch {
    return bare
  }
}

/** A creator's channels as links out (a new tab, no opener, no referrer), each with its platform's name. */
export const creatorLinks = (links: readonly CreatorLink[], cls = '') =>
  h(
    'div',
    { class: `creator-links${cls ? ` ${cls}` : ''}` },
    ...links.map((l) =>
      h(
        'a',
        { class: `creator-link ${l.platform}`, href: l.url, target: '_blank', rel: 'noopener noreferrer' },
        h('b', {}, CREATOR_PLATFORMS[l.platform].name),
        h('span', {}, creatorLinkLabel(l)),
        h('i', { 'aria-hidden': 'true' }, '↗'),
      ),
    ),
  )

/** The Trainer Card's row label for the account's request now. */
export const creatorRowLabel = () => {
  const m = t().creatorTag.row
  const status = knownCreator()?.status
  return status === 'pending' ? m.pending : status === 'approved' ? m.approved : m.ask
}

const day = (iso: string) => new Date(iso).toLocaleDateString(LOCALES[locale()].tag, { day: '2-digit', month: '2-digit', year: 'numeric' })

/**
 * The request sheet (from the Trainer Card): what the tag brings, the last
 * request's status, and, when a new one may go (none yet, or the last
 * rejected or revoked), up to `CREATOR.links` channel fields to send. An
 * approved account sees its channels as everyone does. Esc or Back close it
 * and call `onClose`.
 */
export const creatorScreen = (root: HTMLElement, input: Input, onClose: () => void): Screen => {
  const m = t().creatorTag
  const body = h('div', { class: 'creator-body' })
  const message = h('p', { class: 'field-message' })
  const back = h('button', { class: 'btn', type: 'button', onclick: () => close() }, m.back)
  let closed = false
  let busy = false

  const say = (text: string, error = false) => {
    message.textContent = text
    message.classList.toggle('error', error)
  }

  const statusLine = (r: CreatorRequest | null) => {
    if (!r) return null
    const text = r.status === 'pending' ? m.status.pending(day(r.at)) : m.status[r.status]
    return h('p', { class: `creator-status ${r.status}` }, r.status === 'approved' ? streamerTag() : null, h('span', {}, text))
  }

  /** The fields, prefilled with the last request's links (a rejected one gets fixed and sent again). */
  const form = (r: CreatorRequest | null) => {
    const fields = Array.from({ length: CREATOR.links }, (_, i) =>
      h('input', {
        class: 'field-input',
        type: 'url',
        inputmode: 'url',
        maxlength: CREATOR.urlMax + 40,
        autocapitalize: 'none',
        autocorrect: 'off',
        autocomplete: 'off',
        spellcheck: 'false',
        placeholder: m.placeholder,
        enterkeyhint: i === CREATOR.links - 1 ? 'send' : 'next',
        value: r?.links[i]?.url ?? '',
      }),
    )
    const send = h('button', { class: 'btn confirm', type: 'submit' }, m.send)
    const submit = async (e: Event) => {
      e.preventDefault()
      if (busy) return
      busy = true
      send.textContent = m.sending
      const out = await sendCreatorRequest(fields.map((f) => f.value))
      busy = false
      send.textContent = m.send
      if (closed) return
      if (out.ok) return (playSfx('unlock'), draw(out.request))
      playSfx('hurt')
      if (out.error === 'invalid') {
        fields[out.index]?.focus()
        return say(m.errors.invalid(out.index + 1), true)
      }
      say(m.errors[out.error], true)
    }
    for (const f of fields) f.addEventListener('input', () => say(m.hint))
    say(m.hint)
    return h(
      'form',
      { class: 'creator-form', novalidate: true, onsubmit: (e: Event) => void submit(e) },
      ...fields.map((f, i) => h('label', { class: 'field' }, h('span', { class: 'field-label' }, m.field(i + 1)), h('span', { class: 'field-box' }, f))),
      message,
      h('div', { class: 'buttons' }, send),
    )
  }

  const draw = (r: CreatorRequest | null) => {
    const open = !r || r.status === 'rejected' || r.status === 'revoked'
    body.replaceChildren(
      ...[
        statusLine(r),
        r && r.status !== 'rejected' && r.status !== 'revoked' ? creatorLinks(r.links) : null,
        open ? form(r) : null,
      ].filter((n) => n !== null),
    )
  }

  const load = async () => {
    const s = accountState()
    if (s.kind !== 'signedIn' || !s.handle) return body.replaceChildren(h('p', { class: 'profile-note' }, m.signIn))
    body.replaceChildren(h('p', { class: 'profile-note blink' }, m.loading))
    const r = await fetchMyCreator()
    if (closed) return
    if (r === 'offline') return body.replaceChildren(h('p', { class: 'field-message error' }, m.errors.offline))
    draw(r)
  }

  const dialog = h('div', { class: 'dialog box pop creator-sheet' }, h('div', { class: 'dialog-title' }, m.title), h('p', { class: 'profile-note' }, m.intro), body, h('div', { class: 'buttons' }, back))
  // Inside the fields the game's keys are off (see `createInput`), so Esc is caught here.
  dialog.addEventListener('keydown', (e) => e.key === 'Escape' && close())
  const offKeys = input.onKey((key) => key === 'Escape' && close())
  const el = h('div', { class: 'screen dim' }, dialog)
  const dispose = () => (offKeys(), el.remove())

  function close() {
    if (closed) return
    closed = true
    playSfx('select')
    dispose()
    later(onClose)
  }

  root.append(el)
  void load()
  return { el, dispose, dim: 0.5 }
}

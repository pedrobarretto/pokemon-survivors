import { resendEmailCode, sendEmailCode, verifyEmailCode, type EmailAnswer } from '../account'
import { cleanCode, CODE_LENGTH, resendIn, startFlow, stepFlow, type EmailEvent, type EmailFlow } from '../emailCode'
import { playSfx } from '../engine/audio'
import { t } from '../i18n'
import { h } from './dom'

export type EmailSheet = { el: HTMLElement; focus: () => void; dispose: () => void }

/** Whether a keyboard pops up on its own only where there's a physical one (focusing a field on a phone would cover the sheet). */
const physicalKeyboard = () => matchMedia('(hover: hover) and (pointer: fine)').matches

/**
 * The sign-in gate's email side (`gate` in `ui/account.ts`): the address,
 * then the 6-digit code sent to it (typed, pasted or filled in by the phone,
 * sent on its own once whole), with a resend after `RESEND_AFTER_MS` and a
 * way back to fix the address. One sheet for both: an address with an account
 * signs in to it, a new one makes it (`sendEmailCode`). Once in, the account's
 * change closes the gate; `back` leaves for the gate's other ways (Esc too).
 */
export const emailSheet = (back: () => void): EmailSheet => {
  let flow: EmailFlow = startFlow()
  let closed = false
  /** A line to show over the problems: a code sent again, the Account Portal opening. */
  let notice: string | null = null

  const emailInput = h('input', {
    class: 'field-input',
    type: 'email',
    inputmode: 'email',
    autocomplete: 'email',
    autocapitalize: 'none',
    autocorrect: 'off',
    spellcheck: 'false',
    enterkeyhint: 'send',
    maxlength: 254,
  })
  const codeInput = h('input', {
    class: 'field-input email-code-input',
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'one-time-code',
    pattern: '[0-9]*',
    enterkeyhint: 'go',
    spellcheck: 'false',
  })
  const fieldLabel = h('span', { class: 'field-label' })
  const emailField = h('label', { class: 'field' }, fieldLabel, h('span', { class: 'field-box' }, emailInput))
  const codeLabel = h('span', { class: 'field-label' })
  const codeField = h('label', { class: 'field email-code-field' }, codeLabel, h('span', { class: 'field-box' }, codeInput))
  const lead = h('p', { class: 'account-line' })
  const sentTo = h('b', { class: 'email-sent-to' })
  const message = h('p', { class: 'field-message email-message', role: 'status', 'aria-live': 'polite' })
  const submit = h('button', { class: 'btn confirm', type: 'submit' })
  const resend = h('button', { class: 'btn', type: 'button', onclick: () => void again() })
  const other = h('button', { class: 'btn', type: 'button', onclick: () => (playSfx('select'), flow.step === 'code' ? change() : back()) })
  const spam = h('p', { class: 'account-line account-note' })

  const render = () => {
    const m = t().account.email
    const onCode = flow.step === 'code'
    lead.textContent = onCode ? m.sent : m.pitch
    sentTo.textContent = flow.email
    sentTo.hidden = !onCode
    fieldLabel.textContent = m.label
    emailInput.placeholder = m.placeholder
    codeLabel.textContent = m.codeLabel
    emailField.hidden = onCode
    codeField.hidden = !onCode
    emailInput.disabled = flow.busy
    codeInput.disabled = flow.busy
    submit.textContent = onCode ? (flow.busy ? m.verifying : m.verify) : flow.busy ? m.sending : m.send
    submit.disabled = flow.busy
    const wait = resendIn(flow, Date.now())
    resend.hidden = !onCode
    resend.textContent = wait > 0 ? m.resendIn(wait) : m.resend
    resend.disabled = flow.busy || wait > 0
    other.textContent = onCode ? m.change : t().account.back
    other.disabled = flow.busy
    spam.textContent = m.spam
    spam.hidden = !onCode
    const problem = flow.problem && m.problems[flow.problem]
    message.textContent = problem ?? notice ?? ''
    message.classList.toggle('error', problem !== null)
    message.hidden = message.textContent === ''
  }

  const step = (e: EmailEvent) => {
    flow = stepFlow(flow, e)
    if (e.kind !== 'sent') notice = null
    render()
  }

  /** What Clerk answered: a code sent (the code's field next), in (the gate closes on the account's change), away (the portal loads), or a problem. */
  const heard = (answer: EmailAnswer) => {
    if (closed) return
    if (answer === 'sent') return
    if (answer === 'in') return playSfx('unlock')
    if (answer === 'away') return ((notice = t().account.email.away), render())
    playSfx('hurt')
    step({ kind: 'failed', problem: answer })
    const field = flow.step === 'code' ? codeInput : emailInput
    field.focus()
    field.select()
  }

  const send = async () => {
    step({ kind: 'send', email: emailInput.value })
    if (!flow.busy) return (playSfx('hurt'), emailInput.focus())
    emailInput.value = flow.email
    const answer = await sendEmailCode(flow.email)
    if (closed) return
    if (answer === 'sent') {
      step({ kind: 'sent', at: Date.now() })
      codeInput.value = ''
      if (physicalKeyboard()) codeInput.focus()
    }
    heard(answer)
  }

  const verify = async () => {
    const code = cleanCode(codeInput.value)
    if (code.length !== CODE_LENGTH) return step({ kind: 'failed', problem: 'code' })
    step({ kind: 'verify' })
    if (!flow.busy) return
    heard(await verifyEmailCode(code))
  }

  const again = async () => {
    step({ kind: 'resend', at: Date.now() })
    if (!flow.busy) return
    playSfx('select')
    const answer = await resendEmailCode()
    if (closed) return
    if (answer === 'sent') {
      step({ kind: 'sent', at: Date.now() })
      notice = t().account.email.resent
      codeInput.value = ''
      render()
    }
    heard(answer)
  }

  const change = () => {
    step({ kind: 'change' })
    emailInput.value = flow.email
    emailInput.focus()
  }

  // Typed, pasted or filled in by the phone: only digits stay, and a whole code goes at once.
  codeInput.addEventListener('input', () => {
    const code = cleanCode(codeInput.value)
    if (codeInput.value !== code) codeInput.value = code
    if (flow.problem !== null) step({ kind: 'edit' })
    if (code.length === CODE_LENGTH && !flow.busy) void verify()
  })
  emailInput.addEventListener('input', () => flow.problem !== null && step({ kind: 'edit' }))

  const el = h(
    'form',
    {
      class: 'email-sheet',
      novalidate: true,
      onsubmit: (e: Event) => {
        e.preventDefault()
        void (flow.step === 'code' ? verify() : send())
      },
    },
    lead,
    sentTo,
    emailField,
    codeField,
    message,
    h('div', { class: 'buttons account-buttons email-buttons' }, submit, resend, other),
    spam,
  )
  // Inside the fields the game's keys are off (`createInput`), so Esc is caught here.
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    e.stopPropagation()
    if (flow.busy) return
    playSfx('select')
    if (flow.step === 'code') change()
    else back()
  })
  // The resend's countdown.
  const clock = setInterval(() => flow.step === 'code' && render(), 1000)

  render()
  return {
    el,
    focus: () => physicalKeyboard() && (flow.step === 'code' ? codeInput : emailInput).focus(),
    dispose: () => {
      closed = true
      clearInterval(clock)
    },
  }
}

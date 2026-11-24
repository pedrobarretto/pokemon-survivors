import { describe, expect, it } from 'vitest'
import { cleanCode, cleanEmail, emailValid, problemOf, RESEND_AFTER_MS, resendIn, startFlow, stepFlow, type EmailFlow } from './emailCode'

const onCode = (sentAt = 0): EmailFlow => ({ step: 'code', email: 'ash@pallet.town', busy: false, problem: null, sentAt })

describe('email code rules', () => {
  it('folds what Chinese keyboards type into a plain address and code', () => {
    expect(cleanEmail(' ａｓｈ＠ｑｑ．ｃｏｍ ')).toBe('ash@qq.com')
    expect(cleanCode('Code: １２３ 456')).toBe('123456')
    expect(cleanCode('1234567')).toBe('123456')
  })

  it('tells an address from something else', () => {
    expect(emailValid('ash.ketchum@163.com')).toBe(true)
    expect(emailValid('ash@qq')).toBe(false)
    expect(emailValid('ash@@qq.com')).toBe(false)
    expect(emailValid('ash@.com')).toBe(false)
  })

  it("names Clerk's errors", () => {
    expect(problemOf(['form_code_incorrect'])).toBe('code')
    expect(problemOf(['verification_expired'])).toBe('expired')
    expect(problemOf(['verification_failed'])).toBe('tries')
    expect(problemOf(['user_locked'])).toBe('tries')
    expect(problemOf(['too_many_requests'])).toBe('rate')
    expect(problemOf(['form_param_format_invalid'])).toBe('email')
    expect(problemOf([])).toBe('failed')
  })
})

describe('email code flow', () => {
  it('sends only an address that looks like one', () => {
    expect(stepFlow(startFlow(), { kind: 'send', email: 'ash' })).toEqual({ step: 'email', email: 'ash', busy: false, problem: 'email' })
    const sending = stepFlow(startFlow(), { kind: 'send', email: ' ash@pallet.town ' })
    expect(sending).toEqual({ step: 'email', email: 'ash@pallet.town', busy: true, problem: null })
    expect(stepFlow(sending, { kind: 'sent', at: 5 })).toEqual(onCode(5))
  })

  it('keeps the code step on a wrong code, and a press while busy does nothing', () => {
    const verifying = stepFlow(onCode(), { kind: 'verify' })
    expect(stepFlow(verifying, { kind: 'verify' })).toBe(verifying)
    expect(stepFlow(verifying, { kind: 'change' })).toBe(verifying)
    expect(stepFlow(verifying, { kind: 'failed', problem: 'code' })).toEqual({ ...onCode(), problem: 'code' })
  })

  it('sends another code only after the cooldown, from then on', () => {
    expect(resendIn(onCode(0), 1)).toBe(RESEND_AFTER_MS / 1000)
    expect(stepFlow(onCode(0), { kind: 'resend', at: RESEND_AFTER_MS - 1 })).toEqual(onCode(0))
    const again = stepFlow({ ...onCode(0), problem: 'expired' }, { kind: 'resend', at: RESEND_AFTER_MS })
    expect(again).toEqual({ ...onCode(0), busy: true })
    expect(stepFlow(again, { kind: 'sent', at: RESEND_AFTER_MS })).toEqual(onCode(RESEND_AFTER_MS))
  })

  it('forgets a problem once the field is typed in again', () => {
    expect(stepFlow({ ...onCode(), problem: 'code' }, { kind: 'edit' })).toEqual(onCode())
  })

  it('goes back to the address, keeping it to fix', () => {
    expect(stepFlow(onCode(), { kind: 'change' })).toEqual(startFlow('ash@pallet.town'))
  })
})

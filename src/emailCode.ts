/**
 * Signing in with a one-time code sent by email: the rules of the sheet's two
 * steps (the address, then the code), apart from Clerk (`emailSignIn` and
 * friends in `account.ts`) and the screen (`ui/emailSignIn.ts`). The way in
 * where Google and Discord are blocked (mainland China).
 */

/** Digits in the code Clerk sends. */
export const CODE_LENGTH = 6

/** How long (ms) after a code went out the sheet offers to send another. */
export const RESEND_AFTER_MS = 30_000

/**
 * What went wrong, for the sheet to say: a bad address, a wrong code, a code
 * past its life, too many tries (the code's, or the account locked), the
 * server asking to slow down, and anything else (offline, Clerk down).
 */
export type EmailProblem = 'email' | 'code' | 'expired' | 'tries' | 'rate' | 'failed'

/**
 * The sheet's state: the address being typed, or the code for the address it
 * went to (`sentAt`: when the last one went out). `busy` while Clerk is asked.
 */
export type EmailFlow =
  | { step: 'email'; email: string; busy: boolean; problem: EmailProblem | null }
  | { step: 'code'; email: string; busy: boolean; problem: EmailProblem | null; sentAt: number }

export type EmailEvent =
  /** The address submitted: on its way if it looks like one. */
  | { kind: 'send'; email: string }
  /** A code went out (the first, or another), at `at`. */
  | { kind: 'sent'; at: number }
  /** Another code asked for, at `at`: only once `RESEND_AFTER_MS` passed. */
  | { kind: 'resend'; at: number }
  /** A whole code submitted. */
  | { kind: 'verify' }
  | { kind: 'failed'; problem: EmailProblem }
  /** Back to the address, to fix it. */
  | { kind: 'change' }
  /** The field typed in again: the problem it showed is gone. */
  | { kind: 'edit' }

/**
 * An address as typed, ready to send: full-width characters from a Chinese
 * or Japanese keyboard folded to ASCII (＠ to @, ． to .), spaces dropped.
 */
export const cleanEmail = (raw: string) => raw.normalize('NFKC').replace(/\s+/g, '')

/** Whether an address is worth sending (Clerk has the last word). */
export const emailValid = (email: string) => email.length <= 254 && /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(email)

/** The digits of a code as typed or pasted ("123 456", "Code: 123456", full-width digits), at most `CODE_LENGTH`. */
export const cleanCode = (raw: string) => raw.normalize('NFKC').replace(/\D/g, '').slice(0, CODE_LENGTH)

/** The problem a Clerk error's codes describe (`errors[].code` of its API response). */
export const problemOf = (codes: readonly string[]): EmailProblem => {
  const has = (...known: string[]) => codes.some((c) => known.includes(c))
  if (has('form_code_incorrect')) return 'code'
  if (has('verification_expired')) return 'expired'
  if (has('verification_failed', 'user_locked', 'too_many_attempts')) return 'tries'
  if (has('too_many_requests')) return 'rate'
  if (has('form_param_format_invalid', 'form_identifier_invalid', 'form_param_nil', 'form_email_address_blocked', 'not_allowed_access', 'form_identifier_not_allowed')) return 'email'
  return 'failed'
}

/** A fresh sheet on the address step (keeping `email` when coming back to fix it). */
export const startFlow = (email = ''): EmailFlow => ({ step: 'email', email, busy: false, problem: null })

/** Seconds until another code may be asked for (0: now). */
export const resendIn = (f: EmailFlow, now: number) => (f.step === 'code' ? Math.max(0, Math.ceil((f.sentAt + RESEND_AFTER_MS - now) / 1000)) : 0)

/** The sheet after `e`. Anything pressed while Clerk is busy, or out of its step, changes nothing. */
export const stepFlow = (f: EmailFlow, e: EmailEvent): EmailFlow => {
  switch (e.kind) {
    case 'send': {
      if (f.step !== 'email' || f.busy) return f
      const email = cleanEmail(e.email)
      return emailValid(email) ? { ...f, email, busy: true, problem: null } : { ...f, email, problem: 'email' }
    }
    case 'sent':
      return f.busy ? { step: 'code', email: f.email, busy: false, problem: null, sentAt: e.at } : f
    case 'resend':
      return f.step === 'code' && !f.busy && resendIn(f, e.at) === 0 ? { ...f, busy: true, problem: null } : f
    case 'verify':
      return f.step === 'code' && !f.busy ? { ...f, busy: true, problem: null } : f
    case 'failed':
      return { ...f, busy: false, problem: e.problem }
    case 'change':
      return f.busy ? f : startFlow(f.email)
    case 'edit':
      return f.problem === null || f.busy ? f : { ...f, problem: null }
  }
}

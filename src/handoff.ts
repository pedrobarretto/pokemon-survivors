import { mergeSaves } from './game/sync'
import { parseSaveData, type Save } from './game/meta'
import { loadSave } from './ui/save'

/**
 * The game played inside another site's page (a games portal's frame, as
 * gggames.cc shows it). There Google, Discord and Stripe refuse to open, and the
 * frame's storage is the portal's own copy of ours, so signing in moves to a
 * tab of its own on the site (`continueOnSite`) and the progress goes along:
 * the new tab asks the frame for it by message and merges it into its own save
 * (`takeHandoff`), then signs in as asked.
 */

/** Query parameter of a tab the frame opened to sign in: the way to sign in (`SignInWay`). */
const PARAM = 'entrar'

const READY = 'ps:handoff-ready'
const SAVE = 'ps:handoff-save'

/** How long a new tab waits for the frame's save before signing in without it. */
const WAIT_MS = 3000

/** How a player signs in: with Google or Discord (`Provider`, a redirect), or a code by email (`emailCode.ts`). */
export type SignInWay = 'google' | 'discord' | 'email'
export type Provider = Exclude<SignInWay, 'email'>

const isWay = (v: string | null): v is SignInWay => v === 'google' || v === 'discord' || v === 'email'

/** Whether this page is inside another page (a portal's frame). */
export const framed = () => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

/** The save in a message the frame sent: only from this site's own origin, and only one shaped as a save handoff. */
export const handedSave = (data: unknown, origin: string, ours: string): unknown =>
  origin === ours && typeof data === 'object' && data !== null && 'kind' in data && data.kind === SAVE && 'save' in data ? data.save : undefined

/**
 * Opens the game on the site in a new tab that signs in `way` (the email sheet open there for `email`), and
 * hands it this frame's save once it asks. False when the browser blocked the
 * tab: the frame then leaves for the site itself (the save stays in the frame).
 */
export const continueOnSite = (way: SignInWay): boolean => {
  const url = new URL(`${location.origin}${location.pathname}`)
  url.searchParams.set(PARAM, way)
  const tab = window.open(url, '_blank')
  if (!tab) {
    window.open(url, '_top')
    return false
  }
  const answer = (e: MessageEvent) => {
    if (e.source !== tab || e.origin !== location.origin || e.data !== READY) return
    removeEventListener('message', answer)
    tab.postMessage({ kind: SAVE, save: loadSave() }, location.origin)
  }
  addEventListener('message', answer)
  return true
}

/**
 * In a tab `continueOnSite` opened: merges the frame's save into this one's
 * (`land` writes it and lets the screens know), cleans the URL and resolves to
 * the way to sign in. Null on any other load. Without an answer within
 * `WAIT_MS` it resolves anyway, so the sign in never hangs on the frame.
 */
export const takeHandoff = (land: (save: Save) => void): Promise<SignInWay | null> => {
  const params = new URLSearchParams(location.search)
  const asked = params.get(PARAM)
  if (!isWay(asked)) return Promise.resolve(null)
  params.delete(PARAM)
  const rest = params.toString()
  history.replaceState(history.state, '', `${location.pathname}${rest ? `?${rest}` : ''}${location.hash}`)
  const frame = window.opener as Window | null
  if (!frame) return Promise.resolve(asked)
  return new Promise((done) => {
    const finish = () => {
      removeEventListener('message', take)
      clearTimeout(timer)
      done(asked)
    }
    const take = (e: MessageEvent) => {
      if (e.source !== frame) return
      const save = handedSave(e.data, e.origin, location.origin)
      if (save === undefined) return
      land(mergeSaves(loadSave(), parseSaveData(save)))
      finish()
    }
    const timer = setTimeout(finish, WAIT_MS)
    addEventListener('message', take)
    frame.postMessage(READY, location.origin)
  })
}

/** Leaves for an outside page (a checkout, Patreon, Discord): inside a portal's frame, where those refuse to open, in a new tab. */
export const leaveTo = (url: string | URL) => {
  if (!framed() || !window.open(url, '_blank')) location.assign(url)
}

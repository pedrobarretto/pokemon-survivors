import { describe, expect, it } from 'vitest'
import { countVisit, INSTALL_NUDGE, installNudgeDue, installOffer, isIos } from './installOffer'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'

describe('installOffer', () => {
  it('offers nothing once the game runs installed, prompt or not', () => {
    expect(installOffer({ installed: true, prompt: true, ios: false })).toBeNull()
    expect(installOffer({ installed: true, prompt: false, ios: true })).toBeNull()
  })

  it("prefers the browser's prompt, then the iOS how-to", () => {
    expect(installOffer({ installed: false, prompt: true, ios: true })).toBe('prompt')
    expect(installOffer({ installed: false, prompt: false, ios: true })).toBe('ios')
    expect(installOffer({ installed: false, prompt: false, ios: false })).toBeNull()
  })
})

describe('isIos', () => {
  it('spots iPhones, and iPads that claim to be a Mac', () => {
    expect(isIos(IPHONE, 5)).toBe(true)
    expect(isIos(MAC, 5)).toBe(true)
  })

  it('leaves out Macs and Android', () => {
    expect(isIos(MAC, 0)).toBe(false)
    expect(isIos(ANDROID, 5)).toBe(false)
  })
})

describe('the lobby install offer', () => {
  const gap = INSTALL_NUDGE.gapMinutes * 60_000

  it('counts a new visit only after a while away', () => {
    expect(countVisit(null, 0)).toEqual({ count: 1, last: 0 })
    expect(countVisit({ count: 1, last: 0 }, gap - 1)).toEqual({ count: 1, last: gap - 1 })
    expect(countVisit({ count: 1, last: 0 }, gap)).toEqual({ count: 2, last: gap })
  })

  const due = { offer: 'prompt' as const, inApp: false, asked: false, sessions: 1, runs: 0 }

  it('asks once the player came back or played a few runs', () => {
    expect(installNudgeDue(due)).toBe(false)
    expect(installNudgeDue({ ...due, sessions: INSTALL_NUDGE.sessions })).toBe(true)
    expect(installNudgeDue({ ...due, runs: INSTALL_NUDGE.runs })).toBe(true)
  })

  it('never asks twice, in an app, or with nothing to offer', () => {
    const ready = { ...due, runs: 10 }
    expect(installNudgeDue({ ...ready, asked: true })).toBe(false)
    expect(installNudgeDue({ ...ready, inApp: true })).toBe(false)
    expect(installNudgeDue({ ...ready, offer: null })).toBe(false)
  })
})

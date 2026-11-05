import { describe, expect, it } from 'vitest'
import { answerGate, furthest, isFirstLoad, NO_STEPS, reach } from './firstSteps'
import { inAppBrowser } from './inApp'

describe('first visit steps', () => {
  it('keeps the first time a step is reached, to a tenth of a second', () => {
    const s = reach(reach(NO_STEPS, 'lobby', 3.14159), 'lobby', 40)
    expect(s.times).toEqual({ lobby: 3.1 })
  })

  it('judges a visit by its furthest step, skipped ones and all', () => {
    expect(furthest({})).toEqual({ step: null, stepIndex: -1 })
    // Back from signing in: no intro, no gate, straight to the select.
    expect(furthest({ lobby: 1, select: 4 })).toEqual({ step: 'select', stepIndex: 4 })
    // Reached out of order (a co-op link draws a frame before any lobby): the order of the steps decides.
    expect(furthest({ firstFrame: 2, lobby: 9 })).toEqual({ step: 'firstFrame', stepIndex: 6 })
  })

  it('takes the last answer at the gate', () => {
    expect(answerGate(answerGate(NO_STEPS, 'back'), 'guest').gate).toBe('guest')
  })

  it('counts only the first few loads of a device with no run', () => {
    expect(isFirstLoad(0, 0)).toBe(true)
    expect(isFirstLoad(0, 2)).toBe(true)
    expect(isFirstLoad(0, 3)).toBe(false)
    expect(isFirstLoad(1, 0)).toBe(false)
  })
})

describe('inAppBrowser', () => {
  const ios = (tail: string) => `Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ${tail}`
  const android = (tail: string) => `Mozilla/5.0 (Linux; Android 14; SM-A146M Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 ${tail}`

  it('names the social apps', () => {
    expect(inAppBrowser(ios('Instagram 352.0.0.20.82 (iPhone14,7; iOS 17_5; pt_BR)'))).toBe('instagram')
    expect(inAppBrowser(android('[FB_IAB/FB4A;FBAV/482.0.0.48.86;]'))).toBe('facebook')
    expect(inAppBrowser(ios('[FBAN/FBIOS;FBAV/482.0;FBBV/1]'))).toBe('facebook')
    expect(inAppBrowser(android('musical_ly_2023508030 BytedanceWebview/d8a21c6'))).toBe('tiktok')
    expect(inAppBrowser(android('TwitterAndroid'))).toBe('x')
  })

  it('tells other WebViews from browsers and installed apps', () => {
    expect(inAppBrowser(android(''))).toBe('webview')
    expect(inAppBrowser(ios(''))).toBe('webview')
    expect(inAppBrowser(ios(''), true)).toBeNull()
    expect(inAppBrowser(ios('Version/17.5 Safari/604.1'))).toBeNull()
    expect(inAppBrowser(ios('CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1'))).toBeNull()
    expect(inAppBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')).toBeNull()
  })
})

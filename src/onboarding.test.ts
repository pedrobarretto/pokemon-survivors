import { describe, expect, it } from 'vitest'
import { chromeIntent, firstRunDue, GUEST_GATE_PAUSE, guestGateDue, inAppBrowser, savePromptDue } from './onboarding'

const UA = {
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  safariIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  desktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  instagramIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 345.0.0.32.97 (iPhone15,2; iOS 17_5; pt_BR; pt; scale=3.00; 1179x2556; 634108168)',
  instagramAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-A536E Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 Instagram 350.0.0.42.84 Android (33/13; 450dpi; 1080x2177; samsung; SM-A536E; a53x; s5e8825; pt_BR; 634108168)',
  facebookAndroid:
    'Mozilla/5.0 (Linux; Android 12; moto g(60) Build/S2RIS32.32-20-9; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/484.0.0.62.109;]',
  facebookIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/484.0.0.40.109;FBBV/650000000;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/pt_BR;FBOP/5]',
  threadsIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 350.0.0.20.94 (iPhone15,2; iOS 17_5; pt_BR; pt)',
  tiktokAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-G991B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 musical_ly_2023709030 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/37.0.3 ByteLocale/pt-BR',
  xIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/10.60',
  lineIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.12.0',
  otherWebView: 'Mozilla/5.0 (Linux; Android 11; Redmi Note 9 Build/RP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36',
}

describe('inAppBrowser', () => {
  it('leaves real browsers alone', () => {
    expect(inAppBrowser(UA.chromeAndroid)).toBeNull()
    expect(inAppBrowser(UA.safariIos)).toBeNull()
    expect(inAppBrowser(UA.desktop)).toBeNull()
  })

  it('names the app and the OS of in-app browsers', () => {
    expect(inAppBrowser(UA.instagramIos)).toEqual({ app: 'instagram', os: 'ios' })
    expect(inAppBrowser(UA.instagramAndroid)).toEqual({ app: 'instagram', os: 'android' })
    expect(inAppBrowser(UA.facebookAndroid)).toEqual({ app: 'facebook', os: 'android' })
    expect(inAppBrowser(UA.facebookIos)).toEqual({ app: 'facebook', os: 'ios' })
    expect(inAppBrowser(UA.threadsIos)).toEqual({ app: 'threads', os: 'ios' })
    expect(inAppBrowser(UA.tiktokAndroid)).toEqual({ app: 'tiktok', os: 'android' })
    expect(inAppBrowser(UA.xIos)).toEqual({ app: 'x', os: 'ios' })
    expect(inAppBrowser(UA.lineIos)).toEqual({ app: 'line', os: 'ios' })
    expect(inAppBrowser(UA.otherWebView)).toEqual({ app: 'webview', os: 'android' })
  })
})

describe('chromeIntent', () => {
  it('keeps the path, the query and the hash', () => {
    expect(chromeIntent(new URL('https://pokemonsurvivors.com/en/?ref=ash#x'))).toBe('intent://pokemonsurvivors.com/en/?ref=ash#x#Intent;scheme=https;package=com.android.chrome;end')
  })
})

describe('onboarding thresholds', () => {
  it('fast-lanes only a guest that never finished a run', () => {
    expect(firstRunDue(0, false)).toBe(true)
    expect(firstRunDue(0, true)).toBe(false)
    expect(firstRunDue(1, false)).toBe(false)
  })

  it('asks a guest again once the pause is over', () => {
    const now = 1_800_000_000_000
    expect(guestGateDue(null, now)).toBe(true)
    expect(guestGateDue(now - 1000, now)).toBe(false)
    expect(guestGateDue(now - GUEST_GATE_PAUSE, now)).toBe(true)
    // A clock set back doesn't hold the gate forever.
    expect(guestGateDue(now + 1000, now)).toBe(true)
  })

  it('shows the save card in the first runs only', () => {
    expect([0, 1, 2, 3, 4].map(savePromptDue)).toEqual([false, true, true, true, false])
  })
})

import { describe, expect, it } from 'vitest'
import { chromiumMajor, jitGoesStale } from './staleJit'

// The user agents behind the `Cannot read properties of null` reports of 2026-11-21..24, and a few that never had them.
const UA = {
  win360: 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  huawei: 'Mozilla/5.0 (Linux; Android 10; HarmonyOS; BLA-AL00; HMSCore 6.16.4.362) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.6834.79 HuaweiBrowser/17.9.2.301 Mobile Safari/537.36',
  chromeOs129: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  edge158: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36 Edg/158.0.0.0',
  chrome128: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0',
}

describe('jitGoesStale', () => {
  it('reads the Chromium major, and none off Chromium', () => {
    expect(chromiumMajor(UA.huawei)).toBe(132)
    expect(chromiumMajor(UA.iosChrome)).toBeNull()
    expect(chromiumMajor(UA.firefox)).toBeNull()
  })

  it('holds for the engines the reports came from, not the ones around them', () => {
    expect([UA.win360, UA.huawei, UA.chromeOs129].map(jitGoesStale)).toEqual([true, true, true])
    expect([UA.edge158, UA.chrome128, UA.iosChrome, UA.firefox].map(jitGoesStale)).toEqual([false, false, false, false])
  })
})

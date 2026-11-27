import { describe, expect, it } from 'vitest'
import { detectLocale, fallbacksOf, firstLoaded, LOCALE_IDS, nextLocale, type Locale } from '.'

describe('detectLocale', () => {
  it('keeps a saved choice over the browser language', () => {
    expect(detectLocale('en', ['pt-BR'])).toBe('en')
  })

  it('picks the first supported browser language, any region', () => {
    expect(detectLocale(null, ['pt-PT', 'en-US'])).toBe('pt')
    expect(detectLocale(null, ['es-MX', 'en-US'])).toBe('es')
    expect(detectLocale(null, ['fr-CA', 'en-US'])).toBe('fr')
    expect(detectLocale(null, ['zh-HK', 'en-US'])).toBe('zh')
    expect(detectLocale(null, ['de-DE', 'en-GB', 'pt-BR'])).toBe('en')
  })

  it('tells Chinese apart by script: Traditional for Taiwan, Hong Kong and Macau, Simplified for the rest', () => {
    for (const tag of ['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant', 'zh-Hant-HK']) expect(detectLocale(null, [tag])).toBe('zh')
    for (const tag of ['zh-CN', 'zh-SG', 'zh-Hans', 'zh-Hans-CN']) expect(detectLocale(null, [tag])).toBe('zhHans')
    // A page's own language (`data-locale`) is a locale id: the /zh-tw/ page's `zh`, the /zh-cn/ page's `zhHans`.
    expect(detectLocale(null, ['zh'])).toBe('zh')
    expect(detectLocale(null, ['zhHans'])).toBe('zhHans')
  })

  it('falls back to English for unknown saves and languages', () => {
    expect(detectLocale('klingon', ['ja-JP'])).toBe('en')
  })
})

describe('nextLocale', () => {
  it('visits every language once, then wraps around', () => {
    let l: Locale = 'pt'
    const seen = LOCALE_IDS.map(() => (l = nextLocale(l)))
    expect(new Set(seen).size).toBe(LOCALE_IDS.length)
    expect(seen.at(-1)).toBe('pt')
  })
})

describe('fallbacksOf', () => {
  it('tries the language first, then English and Portuguese, once each', () => {
    expect(fallbacksOf('fr')).toEqual(['fr', 'en', 'pt'])
    expect(fallbacksOf('en')).toEqual(['en', 'pt'])
    expect(fallbacksOf('pt')).toEqual(['pt', 'en'])
  })

  it('reads Simplified Chinese in the Traditional when its converter will not load', () => {
    expect(fallbacksOf('zhHans')).toEqual(['zhHans', 'zh', 'en', 'pt'])
  })
})

describe('firstLoaded', () => {
  const noPause = async () => {}

  it('retries a language that failed once before moving on', async () => {
    const calls: string[] = []
    let failures = 1
    const load = async (l: string) => {
      calls.push(l)
      if (l === 'zhHans' && failures-- > 0) throw new Error('chunk')
    }
    expect(await firstLoaded(['zhHans', 'zh'], load, 2, noPause)).toBe('zhHans')
    expect(calls).toEqual(['zhHans', 'zhHans'])
  })

  it('falls back to the next language when one never loads', async () => {
    const load = async (l: string) => {
      if (l === 'zhHans') throw new Error('chunk')
    }
    expect(await firstLoaded(['zhHans', 'zh', 'en'], load, 2, noPause)).toBe('zh')
  })

  it('throws the last error once none loads, so the page can say so', async () => {
    const load = async (l: string) => {
      throw new Error(`no ${l}`)
    }
    await expect(firstLoaded(['zh', 'en'], load, 2, noPause)).rejects.toThrow('no en')
  })
})

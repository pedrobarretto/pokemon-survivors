import { describe, expect, it } from 'vitest'
import { detectLocale, LOCALE_IDS, nextLocale, type Locale } from '.'

describe('detectLocale', () => {
  it('keeps a saved choice over the browser language', () => {
    expect(detectLocale('en', ['pt-BR'])).toBe('en')
  })

  it('picks the first supported browser language, any region', () => {
    expect(detectLocale(null, ['pt-PT', 'en-US'])).toBe('pt')
    expect(detectLocale(null, ['es-MX', 'en-US'])).toBe('es')
    expect(detectLocale(null, ['tr-TR', 'en-US'])).toBe('tr')
    expect(detectLocale(null, ['fr-FR', 'en-GB', 'pt-BR'])).toBe('en')
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

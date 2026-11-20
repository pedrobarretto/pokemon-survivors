import { describe, expect, it } from 'vitest'
import { siteRedirects } from './siteRules'

describe('siteRedirects', () => {
  it('sends each page to its slash, one rule for a folder of pages only', () => {
    const files = [
      'index.html',
      'og.png',
      'guia/index.html',
      'en/index.html',
      'en/guide/index.html',
      'pokedex/index.html',
      'pokedex/pikachu/index.html',
      'pokedex/zubat/index.html',
      'pokedex/zubat/art.png',
    ]
    expect(siteRedirects(files)).toEqual({
      fixed: ['/en /en/ 308', '/guia /guia/ 308', '/pokedex /pokedex/ 308', '/en/index.html /en/ 308', '/pokedex/index.html /pokedex/ 308'],
      dynamic: ['/en/:page /en/:page/ 308', '/pokedex/:page /pokedex/:page/ 308'],
    })
  })

  it('keeps fixed rules where a placeholder would catch a file', () => {
    const files = ['legal/index.html', 'legal/terms.pdf', 'legal/privacy/index.html']
    expect(siteRedirects(files)).toEqual({ fixed: ['/legal /legal/ 308', '/legal/privacy /legal/privacy/ 308'], dynamic: [] })
  })
})

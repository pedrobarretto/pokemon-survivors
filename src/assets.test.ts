import { describe, expect, it } from 'vitest'
import { assetGroup, assetUrl, cdnDownHolds, siteCopy } from './assets'

describe('assetGroup', () => {
  it('versions a species or a skin by its folder, forms, shinies and portraits included', () => {
    expect(assetGroup('pokemon/6/Walk.png')).toBe('pokemon/6')
    expect(assetGroup('pokemon/6/megaX/shiny/Idle.png')).toBe('pokemon/6')
    expect(assetGroup('skins/charmanderSuit/5/shiny/Walk.png')).toBe('skins/charmanderSuit')
  })

  it('versions everything else by its top folder', () => {
    expect(assetGroup('items/rareCandy.png')).toBe('items')
    expect(assetGroup('shop/icons/stamp.png')).toBe('shop')
  })
})

describe('assetUrl', () => {
  it('serves a group the CDN lacks from the site, as before', () => {
    expect(assetUrl('pokemon/25/Walk.png')).toBe('/assets/pokemon/25/Walk.png')
  })
})

describe('siteCopy', () => {
  const origin = 'https://cdn.example'
  it("maps a CDN URL to the site's copy, without its version or retry", () => {
    expect(siteCopy(`${origin}/assets/pokemon/25/Walk.png?v=abc&retry=2`, origin, '/')).toBe('/assets/pokemon/25/Walk.png')
  })
  it('leaves the site\'s own URLs and other origins alone', () => {
    expect(siteCopy('/assets/pokemon/25/Walk.png', origin, '/')).toBeNull()
    expect(siteCopy('https://other.example/assets/a.png', origin, '/')).toBeNull()
    expect(siteCopy(`${origin}/assets/a.png`, '', '/')).toBeNull()
  })
})

describe('cdnDownHolds', () => {
  const day = 24 * 60 * 60 * 1000
  it('holds a give-up for a day', () => {
    expect(cdnDownHolds('1000', 1000 + day - 1)).toBe(true)
    expect(cdnDownHolds('1000', 1000 + day)).toBe(false)
  })
  it('ignores nothing stored, junk or a time ahead of the clock', () => {
    expect(cdnDownHolds(null, 5000)).toBe(false)
    expect(cdnDownHolds('soon', 5000)).toBe(false)
    expect(cdnDownHolds('9000', 5000)).toBe(false)
  })
})

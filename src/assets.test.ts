import { describe, expect, it } from 'vitest'
import { assetGroup, assetUrl } from './assets'

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

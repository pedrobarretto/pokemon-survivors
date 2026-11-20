import { describe, expect, it } from 'vitest'
import { hansGamePage } from './hansPage'

const ZH_TW: Record<string, string> = import.meta.glob('/zh-tw/index.html', { query: '?raw', import: 'default', eager: true })
const page = hansGamePage(ZH_TW['/zh-tw/index.html']!)

describe('hansGamePage', () => {
  it('is the Simplified Chinese page at /zh-cn/', () => {
    expect(page).toContain('<html lang="zh-Hans" data-locale="zhHans">')
    expect(page).toContain('<link rel="canonical" href="https://www.pokemonsurvivors.com/zh-cn/" />')
    expect(page).toContain('/manifest.zhHans.webmanifest')
    expect(page).toContain('宝可梦生存战')
    expect(page).not.toContain('寶可夢')
  })

  it('keeps pointing at the Traditional page where it means it', () => {
    expect(page).toContain('<link rel="alternate" hreflang="zh-Hant" href="https://www.pokemonsurvivors.com/zh-tw/" />')
    expect(page).toContain('<a href="https://www.pokemonsurvivors.com/zh-tw/" hreflang="zh-Hant">以繁體中文遊玩</a>')
    expect(page).not.toContain('href="https://www.pokemonsurvivors.com/zh-cn/" hreflang="zh-Hans">以简体中文游玩')
  })
})

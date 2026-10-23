import { describe, expect, it } from 'vitest'
import { CHANGELOG } from './changelog'
import { SITE_PAGES, sitemap } from '.'
import { LOCALE_IDS } from '../i18n'
import { absolute, HREFLANG, ROUTE_IDS, ROUTES } from './routes'
import { dexPages } from './pokedex'
import { LEGEND_IDS } from '../data/legends'

describe('site pages', () => {
  it('render with their own canonical and hreflang links to every language', () => {
    for (const page of SITE_PAGES) {
      const doc = page.render()
      expect(doc).toContain(`<link rel="canonical" href="${absolute(page.path)}" />`)
      for (const l of LOCALE_IDS) expect(doc).toContain(`hreflang="${HREFLANG[l]}" href="${absolute(page.paths[l])}"`)
      expect(doc.match(/<h1>/g)).toHaveLength(1)
    }
  })

  it('are all in the sitemap, along with the game pages', () => {
    const xml = sitemap()
    for (const id of ROUTE_IDS) for (const path of Object.values(ROUTES[id])) expect(xml).toContain(`<loc>${absolute(path)}</loc>`)
    for (const page of SITE_PAGES) expect(xml).toContain(`<loc>${absolute(page.path)}</loc>`)
  })

  it('give every playable family and every legend a page of its own, under its own path', () => {
    const pages = dexPages()
    expect(pages.filter((p) => p.kind === 'legend')).toHaveLength(LEGEND_IDS.length)
    expect(new Set(pages.map((p) => p.slug)).size).toBe(pages.length)
    for (const p of pages) expect(p.entries.length, p.slug).toBeGreaterThan(0)
  })
})

describe('changelog', () => {
  it('is one update per day, newest first, with ISO dates', () => {
    const dates = CHANGELOG.map((u) => u.date)
    for (const d of dates) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect([...new Set(dates)].sort().reverse()).toEqual(dates)
  })

  it('gives every update 3 to 5 highlights and at least one change', () => {
    for (const u of CHANGELOG) {
      expect(u.highlights.length, u.date).toBeGreaterThanOrEqual(3)
      expect(u.highlights.length, u.date).toBeLessThanOrEqual(5)
      expect(u.changes.length, u.date).toBeGreaterThan(0)
    }
  })
})

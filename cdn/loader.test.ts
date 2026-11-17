import { describe, expect, it } from 'vitest'
import { withCdnLoader } from './loader'

const page = `<!doctype html><html><head>
    <title>x</title>
    <link rel="icon" href="/assets/pokemon/4/portrait.png" />
    <script type="module" crossorigin src="/assets/preload-helper-A.js"></script>
    <script type="module" crossorigin src="/assets/main-B.js"></script>
    <link rel="modulepreload" crossorigin href="/assets/dom-C.js">
    <link rel="stylesheet" crossorigin href="/assets/main-D.css">
  </head><body><canvas id="game"></canvas></body></html>`

describe('withCdnLoader', () => {
  const html = withCdnLoader(page, 'https://cdn.example') ?? ''

  it("swaps Vite's tags for one loader where they were, the entry last", () => {
    expect(html).not.toMatch(/crossorigin (src|href)="\/assets\//)
    expect(html).toContain('("https://cdn.example", ["/assets/main-D.css"], ["/assets/preload-helper-A.js","/assets/dom-C.js"], "/assets/main-B.js")')
    expect(html.indexOf('<script>')).toBeGreaterThan(html.indexOf('portrait.png'))
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('</head>'))
  })

  it('keeps the stylesheets on the site for browsers without scripts', () => {
    expect(html).toContain('<noscript><link rel="stylesheet" href="/assets/main-D.css"></noscript>')
  })

  it('leaves a page without an entry alone', () => {
    expect(withCdnLoader('<html><head></head></html>', 'https://cdn.example')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { absolute } from '../src/site/routes'
import { OG_PATH, SITE_OG, withCdnOgImage } from './og'

describe('withCdnOgImage', () => {
  it('names the address the site pages write', () => {
    expect(SITE_OG).toBe(absolute(OG_PATH))
  })

  it("points og:image and the JSON-LD image at the CDN's copy, and nothing else", () => {
    const page = `<meta property="og:image" content="${SITE_OG}" />
<meta property="og:image:width" content="1200" />
<link rel="canonical" href="https://www.pokemonsurvivors.com/" />
<script type="application/ld+json">{"image": "${SITE_OG}"}</script>`
    const html = withCdnOgImage(page, 'https://cdn.example')
    expect(html).not.toContain(SITE_OG)
    expect(html.match(/https:\/\/cdn\.example\/og\.png/g)).toHaveLength(2)
    expect(html).toContain('content="1200"')
    expect(html).toContain('href="https://www.pokemonsurvivors.com/"')
  })
})

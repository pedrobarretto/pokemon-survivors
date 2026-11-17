/**
 * The share image (`public/og.png`, 1200×630): the pages name the site's copy (`SITE_OG`), every CDN deploy
 * carries one at `OG_PATH` (`cdn/build.mjs`), and `vercel.json` redirects the site's to it, so the link
 * previews that hotlink it cost Vercel a redirect instead of the file. `cdn/deploy.mjs` points the pages at
 * the CDN's copy once a deploy put it there, and refuses a Vercel build whose redirect names a missing file.
 */

/** Where the image sits, on the site and on the CDN. */
export const OG_PATH = '/og.png'

/** The image's address in the pages' og:image and JSON-LD (`absolute(OG_PATH)` in `src/site/routes.ts`). */
export const SITE_OG = `https://www.pokemonsurvivors.com${OG_PATH}`

/** A built page whose share image is the copy on the CDN at `origin`. */
export const withCdnOgImage = (html: string, origin: string) => html.replaceAll(SITE_OG, `${origin}${OG_PATH}`)

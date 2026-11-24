/**
 * The rules the site's Worker (`worker/wrangler.jsonc`) serves `dist/` with, written into it by
 * `worker/site.mjs`: Cloudflare's `_headers` and `_redirects`, which the assets layer applies
 * without running the script.
 */

const DAY_SWR = 'public, max-age=86400, stale-while-revalidate=604800'

/**
 * `_headers`: the cache rules, plus HSTS and an open CORS header on every file.
 * Pages and anything unlisted keep Cloudflare's default, `public, max-age=0, must-revalidate`.
 * Rules must not overlap on a header: Cloudflare joins the values of every rule that matches.
 * - `/assets/:file`: the chunks (Vite hashes their names; the only files at that level);
 * - `/assets/:dir/*`: `public/assets/` (sprites, cries, art), whose URLs don't change with their bytes;
 * - the favicon and the share image;
 * - `builds.json`, read by the next deploy (`worker/site.mjs`).
 */
export const SITE_HEADERS = `/*
  Access-Control-Allow-Origin: *
  Strict-Transport-Security: max-age=63072000

/assets/:file
  Cache-Control: public, max-age=31536000, immutable

/assets/:dir/*
  Cache-Control: ${DAY_SWR}

/fonts/*
  Cache-Control: ${DAY_SWR}

/icons/*
  Cache-Control: ${DAY_SWR}

/favicon.ico
  Cache-Control: ${DAY_SWR}

/creators/*
  Cache-Control: ${DAY_SWR}

/og.png
  Cache-Control: ${DAY_SWR}

/builds.json
  Cache-Control: no-cache
`

/** The most `_redirects` rules Cloudflare takes: fixed paths and ones with placeholders. */
export const REDIRECT_LIMITS = { fixed: 2000, dynamic: 100 } as const

const parentOf = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf('/')))

/**
 * `_redirects` for `dist/`'s `files` (`/`-separated paths): every page (a folder with an `index.html`)
 * asked for without its slash gets a 308 to it (Cloudflare's own `html_handling` would answer 307). A folder holding only pages (no file but its own `index.html`, like
 * `pokedex/`) takes one rule with a placeholder for all of them, so the Pokédex can grow past the fixed
 * rules' limit; its `index.html` goes to its folder too, so the placeholder never sends it to `index.html/`.
 * Fixed rules come first: Cloudflare applies the first that matches.
 */
export const siteRedirects = (files: readonly string[]) => {
  const pages = files.filter((f) => f.endsWith('/index.html')).map(parentOf)
  const isPage = new Set(pages)
  const others = new Set(files.filter((f) => !f.endsWith('/index.html') && f !== 'index.html').map(parentOf))
  const grouped = (dir: string) => dir !== '' && !others.has(dir)
  const groups = [...new Set(pages.map(parentOf).filter(grouped))].sort()
  const fixed = [
    ...pages.filter((p) => !grouped(parentOf(p))).sort().map((p) => `/${p} /${p}/ 308`),
    ...groups.filter((g) => isPage.has(g)).map((g) => `/${g}/index.html /${g}/ 308`),
  ]
  const dynamic = groups.map((g) => `/${g}/:page /${g}/:page/ 308`)
  return { fixed, dynamic }
}

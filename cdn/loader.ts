/**
 * The pages' loader: once a build's chunks are on the asset CDN (`cdn/deploy.mjs`), each built page
 * (`dist/**\/*.html`) swaps the tags Vite wrote for its entry, its stylesheets and the chunks they
 * import for one inline script that asks the CDN for them, so a visit costs Vercel only its HTML.
 *
 * The site still ships every file, and the loader falls back to it:
 * - a device that gave up on the CDN in the last day (`ps:cdnDown`, the key `src/assets.ts` keeps) asks the site only;
 * - a stylesheet the CDN fails takes the site's copy, and an entry it fails to load (a blocked network, a build
 *   it doesn't have) runs from the site, whose chunks then load from the site too (`renderBuiltUrl` in `vite.config.ts`);
 * - where the CDN hangs (`*.workers.dev` in mainland China), nothing from it in `STALL_MS` gives it up for
 *   the day and reloads the page, rather than load the site's copy next to a CDN load that may still land and run twice.
 *
 * The entry runs once the document is parsed, as a module script would.
 */

/** How long a page waits for a first file from the CDN before it gives up on it (as `CDN_STALL_MS` in `src/assets.ts`). */
const STALL_MS = 10_000

/** The tags Vite writes for a page's chunks, all on the site (`/assets/...`). */
const TAGS = /<script type="module" crossorigin src="(\/assets\/[^"]+)"><\/script>\s*|<link rel="(stylesheet|modulepreload)" crossorigin href="(\/assets\/[^"]+)">\s*/g

/**
 * The inline script that loads a page from the CDN at `origin`: its stylesheets, the chunks to fetch
 * ahead and its entry (site paths). The stylesheets are written into the head as it's parsed, so they
 * hold the first paint as Vite's tags did. Inline handlers mark the CDN reached (`__psCdnOk`).
 */
export const bootScript = (origin: string, css: readonly string[], preload: readonly string[], entry: string) => `(function (cdn, css, preload, entry) {
  var down = false
  try {
    var at = Number(localStorage.getItem('ps:cdnDown'))
    down = at > 0 && at <= Date.now() && Date.now() - at < 864e5
  } catch (e) {}
  var base = down ? '' : cdn
  var waiting = !!base
  window.__psCdnOk = function () { waiting = false }
  var ok = base ? ' onload="__psCdnOk()"' : ''
  document.write(css.map(function (p) {
    return '<link rel="stylesheet" crossorigin href="' + base + p + '"' + ok + (base ? ' onerror="this.onerror=this.onload=null;this.href=\\'' + p + '\\'"' : '') + '>'
  }).concat(preload.map(function (p) {
    return '<link rel="modulepreload" crossorigin href="' + base + p + '"' + ok + '>'
  })).join(''))
  document.addEventListener('DOMContentLoaded', function () {
    import(base + entry).then(function () { waiting = false }, function (e) {
      waiting = false
      // A module graph that didn't load ran nothing of it: the site's copy can run. An error it threw is the game's.
      if (base && /dynamically imported module|Importing a module script failed/.test(String(e && e.message))) return import(entry)
      throw e
    })
  })
  if (base) setTimeout(function () {
    if (!waiting) return
    try {
      localStorage.setItem('ps:cdnDown', String(Date.now()))
      location.reload()
    } catch (e) {}
  }, ${STALL_MS})
})(${[origin, css, preload, entry].map((v) => JSON.stringify(v)).join(', ')})`

/**
 * A built page loading its chunks from the CDN at `origin`: Vite's tags for them replaced by the loader
 * (where the first one was), plus the stylesheets for browsers without scripts. Null for a page without an entry.
 */
export const withCdnLoader = (html: string, origin: string) => {
  const css: string[] = []
  const scripts: string[] = []
  const preload: string[] = []
  let at = -1
  const rest = html.replace(TAGS, (_tag: string, script: string | undefined, rel: string | undefined, href: string | undefined, offset: number) => {
    if (at < 0) at = offset
    if (script) scripts.push(script)
    else if (href) (rel === 'stylesheet' ? css : preload).push(href)
    return ''
  })
  // Vite lists the entry's static imports ahead of it: importing the entry runs them all, in order.
  const entry = scripts.pop()
  if (entry === undefined) return null
  const noscript = css.length ? `<noscript>${css.map((p) => `<link rel="stylesheet" href="${p}">`).join('')}</noscript>` : ''
  const loader = `<script>${bootScript(origin, css, [...scripts, ...preload], entry)}</script>${noscript}\n`
  return rest.slice(0, at) + loader + rest.slice(at)
}

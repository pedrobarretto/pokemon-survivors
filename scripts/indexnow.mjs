// Tells Bing (and the other IndexNow engines: Yandex, Seznam, Naver) which pages changed, so they
// recrawl them now instead of whenever. Bing's index feeds ChatGPT search and Copilot, so this is how
// a new page reaches AI answers quickly. Reads the live sitemap, so run it after a deploy:
//
//   node scripts/indexnow.mjs          # the newest update's pages: the sitemap URLs with the latest <lastmod> (the game, the changelog)
//   node scripts/indexnow.mjs --all    # every URL in the sitemap (after adding pages)
//
// `.github/workflows/indexnow.yml` runs the first after each production deploy. The key is public by
// design: IndexNow checks it at `KEY_LOCATION`, which proves the site sent the ping.
const SITE = 'https://www.pokemonsurvivors.com'
const KEY = 'dc1786117f82447dcee99fe732eac967'
const KEY_LOCATION = `${SITE}/${KEY}.txt`

const xml = await (await fetch(`${SITE}/sitemap.xml`)).text()
const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, url]) => ({
  loc: url.match(/<loc>(.*?)<\/loc>/)?.[1],
  lastmod: url.match(/<lastmod>(.*?)<\/lastmod>/)?.[1],
}))
const latest = entries.map((e) => e.lastmod ?? '').sort().at(-1)
const urls = entries.filter((e) => e.loc && (process.argv.includes('--all') || (latest && e.lastmod === latest))).map((e) => e.loc)
if (urls.length === 0) throw new Error('No URLs to submit: is the sitemap up?')

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: KEY_LOCATION, urlList: urls }),
})
// 200 and 202 both mean accepted (202: the key is still being checked).
if (!res.ok) throw new Error(`IndexNow answered ${res.status}: ${await res.text()}`)
console.log(`IndexNow accepted ${urls.length} URLs (${res.status})`)

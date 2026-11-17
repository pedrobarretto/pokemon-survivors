/**
 * Where the files under `public/assets/` (sprites, cries, the shops' and the
 * scenery's art) are fetched from. With `VITE_ASSET_ORIGIN` set at build time,
 * from the asset CDN (`cdn/`, a Cloudflare Worker serving a copy of them, whose
 * requests and bandwidth are free), else from the site itself, as before.
 *
 * Each URL carries its group's version (`?v=`, a hash of the group's files, so
 * the CDN caches them for a year and a changed file is a new URL). The build
 * only points a group at the CDN when the CDN serves that same version
 * (`cdn/versions.mjs`, `vite.config.ts`): a group changed in a commit the CDN
 * hasn't deployed yet stays on the site until a build that finds it there.
 *
 * The CDN is never the only way: some networks can't reach it at all
 * (`*.workers.dev` is blocked in mainland China, where its requests hang), so an
 * image from it that fails or stalls loads the site's copy instead
 * (`assetImage`, `watchAssetImages` for the page's own `<img>`s), and a CDN that
 * no image reached is given up on for a day on this device (`CDN_DOWN_KEY`):
 * every URL is the site's from then on.
 *
 * Import-free on purpose: the site's clients and the Node scripts load it too.
 */

/** The group a file (`path`, under `public/assets/`) is versioned in: a species' or a skin's folder (`pokemon/25`), else its top folder (`items`). */
export const assetGroup = (path: string) => {
  const [top = '', sub] = path.split('/', 2)
  return (top === 'pokemon' || top === 'skins') && sub !== undefined ? `${top}/${sub}` : top
}

type AssetCdn = { origin: string; versions: Readonly<Record<string, string | undefined>> }
/** The CDN's origin and the groups it serves as built, each with its version; set by `vite.config.ts`, absent where it doesn't build (Node scripts, the server). */
declare const __ASSET_CDN__: AssetCdn
const CDN: AssetCdn = typeof __ASSET_CDN__ === 'undefined' ? { origin: '', versions: {} } : __ASSET_CDN__

/** How long an image may take on the CDN before the site's copy is asked for instead. */
const CDN_STALL_MS = 10_000
/** How long an image may take in all (the CDN's try and the site's) before `loadAssetImage` gives up on it. */
const GIVE_UP_MS = 45_000
/** Where this device keeps when it gave up on the CDN (ms since the epoch); the site serves it for `CDN_DOWN_MS` after. */
const CDN_DOWN_KEY = 'ps:cdnDown'
const CDN_DOWN_MS = 24 * 60 * 60 * 1000

/** Whether a stored give-up (`CDN_DOWN_KEY`'s value) still holds at `now`. */
export const cdnDownHolds = (stored: string | null, now: number) => {
  const at = Number(stored)
  return stored !== null && Number.isFinite(at) && at <= now && now - at < CDN_DOWN_MS
}

const storedDown = () => {
  try {
    return CDN.origin !== '' && cdnDownHolds(localStorage.getItem(CDN_DOWN_KEY), Date.now())
  } catch {
    return false
  }
}

/** The CDN's state on this page: `off` without one, `down` once given up on, `ok` once an image came from it, else `unknown`. */
let cdn: 'off' | 'unknown' | 'ok' | 'down' = CDN.origin === '' ? 'off' : storedDown() ? 'down' : 'unknown'
export const cdnState = () => cdn

/** No image reached the CDN and one failed or stalled: everything comes from the site from now on, here and for a day on this device. */
const giveUpCdn = () => {
  if (cdn !== 'unknown') return
  cdn = 'down'
  try {
    localStorage.setItem(CDN_DOWN_KEY, String(Date.now()))
  } catch {}
}

/** The site's copy of `url` when `url` is on the CDN at `origin` (its path under `/assets/`, without the version), else null. */
export const siteCopy = (url: string, origin: string, base: string) => {
  if (origin === '' || !url.startsWith(`${origin}/assets/`)) return null
  const path = url.slice(origin.length + '/assets/'.length).split(/[?#]/, 1)[0]
  return `${base}assets/${path}`
}

const siteOf = (url: string) => siteCopy(url, CDN.origin, import.meta.env.BASE_URL)

/** The URL of a file under `public/assets/` (`path` relative to it, e.g. `pokemon/25/Walk.png`). */
export const assetUrl = (path: string) => {
  const version = CDN.versions[assetGroup(path)]
  return version && cdn !== 'down' ? `${CDN.origin}/assets/${path}?v=${version}` : `${import.meta.env.BASE_URL}assets/${path}`
}

/**
 * An image of an asset (`url` from `assetUrl`), asked for with CORS, so a
 * canvas that draws it from the CDN stays readable (`getImageData`,
 * `toDataURL`): `crossOrigin` must be set before `src`. From the CDN, a load
 * that fails or takes over `CDN_STALL_MS` switches to the site's copy (same
 * origin, so the canvas stays readable too); the CDN's failure is never told to
 * the caller's own `error` listeners, which hear only the site's.
 */
export const assetImage = (url: string) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  const site = siteOf(url)
  if (site === null || cdn === 'down') {
    img.src = site ?? url
    return img
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const done = () => {
    clearTimeout(timer)
    img.removeEventListener('load', loaded)
    img.removeEventListener('error', failed)
  }
  const loaded = () => {
    done()
    if (cdn === 'unknown') cdn = 'ok'
  }
  const toSite = (event?: Event) => {
    done()
    event?.stopImmediatePropagation()
    giveUpCdn()
    img.src = site
  }
  const failed = (event: Event) => toSite(event)
  img.addEventListener('load', loaded)
  img.addEventListener('error', failed)
  timer = setTimeout(() => toSite(), CDN_STALL_MS)
  img.src = url
  return img
}

/**
 * Loads an asset's image (`assetImage`, CDN fallback included) and settles once
 * it has loaded, or rejects when it fails on the site too or takes over
 * `GIVE_UP_MS` in all: a loading screen waiting on it never waits forever.
 */
export const loadAssetImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = assetImage(url)
    const timer = setTimeout(() => {
      img.removeAttribute('src')
      reject(new Error(`Timed out loading ${url}`))
    }, GIVE_UP_MS)
    img.addEventListener('load', () => {
      clearTimeout(timer)
      resolve(img)
    })
    img.addEventListener('error', () => {
      clearTimeout(timer)
      reject(new Error(`Failed to load ${url}`))
    })
  })

/**
 * The page's own `<img>`s with CDN URLs (in the menus' and the site's markup)
 * fall back to the site's copy when they fail, and tell the CDN's state as
 * `assetImage`'s do. Called once as the page starts.
 */
export const watchAssetImages = () => {
  if (CDN.origin === '' || typeof window === 'undefined') return
  const target = (event: Event) => (event.target instanceof HTMLImageElement ? event.target : null)
  window.addEventListener(
    'load',
    (event) => {
      const img = target(event)
      if (img && cdn === 'unknown' && siteOf(img.currentSrc || img.src) !== null) cdn = 'ok'
    },
    true,
  )
  const fallBack = (img: HTMLImageElement) => {
    const site = siteOf(img.currentSrc || img.src)
    if (!site) return
    giveUpCdn()
    img.src = site
  }
  window.addEventListener(
    'error',
    (event) => {
      const img = target(event)
      if (img) fallBack(img)
    },
    true,
  )
  // The ones that failed before this ran (the markup's, ahead of the script).
  for (const img of document.images) if (img.complete && img.naturalWidth === 0) fallBack(img)
}

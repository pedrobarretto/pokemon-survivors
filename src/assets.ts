/**
 * The files under `public/assets/` (sprites, cries, the shops' and the
 * scenery's art), served by the site at `/assets/`.
 */

/** How long an image may take before `loadAssetImage` gives up on it. */
const GIVE_UP_MS = 45_000

/** The URL of a file under `public/assets/` (`path` relative to it, e.g. `pokemon/25/Walk.png`). */
export const assetUrl = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`

/**
 * Loads an image (`url` from `assetUrl`) and settles once it has loaded, or
 * rejects when it fails or takes over `GIVE_UP_MS`: a loading screen waiting
 * on it never waits forever.
 */
export const loadAssetImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
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
    img.src = url
  })

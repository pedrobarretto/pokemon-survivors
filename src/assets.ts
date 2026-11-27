/**
 * The files under `public/assets/` (sprites, cries, the shops' and the
 * scenery's art), served by the site at `/assets/`.
 */

/** How long an image may take before `loadAssetImage` gives up on it. */
const GIVE_UP_MS = 45_000

/** The URL of a file under `public/assets/` (`path` relative to it, e.g. `pokemon/25/Walk.png`). */
export const assetUrl = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`

/** Whether this browser decodes downloaded files into bitmaps (`loadAssetBitmap`): Safari before 15 doesn't. */
export const canDecodeBitmaps = () => typeof createImageBitmap === 'function' && typeof fetch === 'function'

/**
 * Downloads an image (`url` from `assetUrl`) and decodes it off the main thread into a bitmap the
 * caller owns: its pixels are decoded once, here, and go the moment it's `close`d. An `<img>` drawn
 * on a canvas keeps its decoded pixels in the browser's image cache instead, past the image itself.
 * Rejects when it fails, isn't an image or takes over `GIVE_UP_MS`.
 */
export const loadAssetBitmap = async (url: string) => {
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), GIVE_UP_MS)
  try {
    const res = await fetch(url, { signal: abort.signal })
    if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`)
    const bitmap = await createImageBitmap(await res.blob())
    if (bitmap.width > 0 && bitmap.height > 0) return bitmap
    bitmap.close()
    throw new Error(`Empty image ${url}`)
  } finally {
    clearTimeout(timer)
  }
}

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

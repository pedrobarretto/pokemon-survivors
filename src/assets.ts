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

/** The URL of a file under `public/assets/` (`path` relative to it, e.g. `pokemon/25/Walk.png`). */
export const assetUrl = (path: string) => {
  const version = CDN.versions[assetGroup(path)]
  return version ? `${CDN.origin}/assets/${path}?v=${version}` : `${import.meta.env.BASE_URL}assets/${path}`
}

/**
 * An image of an asset (`url` from `assetUrl`), asked for with CORS, so a
 * canvas that draws it from the CDN stays readable (`getImageData`,
 * `toDataURL`): `crossOrigin` must be set before `src`.
 */
export const assetImage = (url: string) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = url
  return img
}

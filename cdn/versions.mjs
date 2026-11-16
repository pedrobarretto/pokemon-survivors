// The versions of `public/assets/`'s groups (`assetGroup` in src/assets.ts): what the CDN's
// `versions.json` lists (`cdn/build.mjs`) and what the game's build compares it with (`vite.config.ts`).
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { assetGroup } from '../src/assets.ts'

export const ASSETS_DIR = join(import.meta.dirname, '..', 'public', 'assets')

/** Every file under `dir`, as `/`-separated paths relative to it, sorted. */
export const filesUnder = (dir) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith('.'))
    .map((e) => relative(dir, join(e.parentPath, e.name)).split(sep).join('/'))
    .sort()

/** Each group's version: 8 base64url characters (48 bits) of a SHA-256 over its files' paths and bytes. */
export const assetVersions = (dir = ASSETS_DIR) => {
  const hashes = new Map()
  for (const file of filesUnder(dir)) {
    const group = assetGroup(file)
    const hash = hashes.get(group) ?? createHash('sha256')
    hash.update(`${file}\0`).update(readFileSync(join(dir, file))).update('\0')
    hashes.set(group, hash)
  }
  return Object.fromEntries([...hashes].map(([group, hash]) => [group, hash.digest('base64url').slice(0, 8)]))
}

/**
 * The groups the CDN at `origin` serves as they are here (its `versions.json`), with their versions:
 * the ones a build may point at it. None when it can't be read, so a build never waits on it or breaks.
 */
export const servedVersions = async (origin, local = assetVersions()) => {
  try {
    const res = await fetch(`${origin}/versions.json`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const served = await res.json()
    const same = Object.entries(local).filter(([group, v]) => served[group] === v)
    const behind = Object.keys(local).length - same.length
    if (behind) console.warn(`[assets] ${behind} asset groups differ from the CDN's (${origin}): those load from the site until it deploys them.`)
    return Object.fromEntries(same)
  } catch (error) {
    console.warn(`[assets] Couldn't read ${origin}/versions.json (${error}): every asset loads from the site.`)
    return {}
  }
}

import manifest from './sprites.generated.json'

/** A sprite's opaque body on its first Walk frame, in px (`npm run bodies` measures it from the PNGs). */
export type Body = { bodyW: number; bodyH: number; footY: number }

type Entry = { body?: Body; shiny?: { body?: Body }; forms?: Record<string, { body?: Body }> }

const MANIFEST: Record<string, Entry> = manifest

/** For a species without sprites: about a starter's size. */
const FALLBACK: Body = { bodyW: 18, bodyH: 20, footY: 6 }

/**
 * Body of a species form. Hitboxes are sized from it, so they're the same on
 * every device and server whether or not the sprite has downloaded.
 */
export const bodyOf = (dex: number, shiny = false): Body =>
  (shiny ? MANIFEST[String(dex)]?.shiny?.body : undefined) ?? MANIFEST[String(dex)]?.body ?? FALLBACK

/** SpriteCollab has the species' shiny colors (read from data, so the server agrees). */
export const hasShinySprite = (dex: number) => MANIFEST[String(dex)]?.shiny !== undefined

/** Body of a species' alternate form (a Wishiwashi School), from the manifest; undefined without one. Hitboxes read this, never loaded sprites. */
export const formBodyOf = (dex: number, form: string): Body | undefined => MANIFEST[String(dex)]?.forms?.[form]?.body

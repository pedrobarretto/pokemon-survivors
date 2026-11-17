/**
 * The site builds whose chunks the asset CDN keeps (`builds.json` on it, `cdn/build.mjs`). A deploy
 * replaces the CDN's whole set of files, and a page opened before it keeps loading the chunks of
 * its own build on demand for hours, so each deploy carries the previous builds' chunks along.
 */

/** A build on the CDN: its id (the commit), when it was deployed (ms since the epoch) and its files (`assets/main-x.js`). */
export type CdnBuild = { id: string; at: number; files: string[] }

/** Builds older than this go (but the newest two), and never more than `max` of them. */
export const KEEP = { days: 7, max: 30 } as const

/**
 * The builds the CDN serves once `next` is deployed (null: none new, an assets-only deploy): newest
 * first, `next` always, the newest two whatever their age, the rest while younger than `KEEP.days`,
 * up to `KEEP.max`, and only while their files together stay within `budget`.
 */
export const keptBuilds = (live: readonly CdnBuild[], next: CdnBuild | null, now: number, budget: number) => {
  const older = live.filter((b) => b.id !== next?.id).sort((a, b) => b.at - a.at)
  const kept: CdnBuild[] = next ? [next] : []
  const files = new Set(next?.files)
  for (const build of older) {
    if (kept.length >= KEEP.max) break
    if (kept.length >= 2 && now - build.at > KEEP.days * 86_400_000) break
    const more = build.files.filter((f) => !files.has(f))
    if (files.size + more.length > budget) break
    for (const f of more) files.add(f)
    kept.push(build)
  }
  return kept
}

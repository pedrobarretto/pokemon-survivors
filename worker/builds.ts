/**
 * The site builds whose chunks the site's Worker keeps (`builds.json` on it, `worker/site.mjs`). A deploy
 * replaces the Worker's whole set of files, and a page opened before it keeps loading the chunks of
 * its own build on demand for hours, so each deploy carries the previous builds' chunks along.
 */

/** A build on the Worker: its id (the commit), when it was deployed (ms since the epoch) and its files (`assets/main-x.js`). */
export type SiteBuild = { id: string; at: number; files: string[] }

/** Builds older than this go (but the newest two), and never more than `max` of them. */
export const KEEP = { days: 7, max: 30 } as const

/**
 * The builds the Worker serves once `next` is deployed: newest first, `next` always, the newest two whatever their age, the rest while younger than `KEEP.days`,
 * up to `KEEP.max`, and only while their files together stay within `budget`.
 */
export const keptBuilds = (live: readonly SiteBuild[], next: SiteBuild, now: number, budget: number) => {
  const older = live.filter((b) => b.id !== next.id).sort((a, b) => b.at - a.at)
  const kept = [next]
  const files = new Set(next.files)
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

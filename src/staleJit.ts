/**
 * Chromium's TurboFan from 129 to `STALE_JIT.to` keeps code optimized for one run's shapes after
 * the next run changes them: a field that held an object in the last run (`g.coop` in co-op,
 * `quests.roam` with a roamer, `player.legend` in Legend mode) still reads as set once it's null,
 * so the next run throws (`Cannot read properties of null`, frame after frame) or takes the wrong
 * branch, and its replay parts from the server's. A fresh page starts from fresh code, so on those
 * engines (360 and Huawei's browsers ship Chromium 132) the lobby reloads between runs (`main.ts`).
 * `npm run determinism` doesn't see it: each engine there is a current one.
 */
export const STALE_JIT = { from: 129, to: 132 } as const

/** The Chromium major in a user agent (Chrome, Edge, Opera, Samsung and the Chinese browsers all say `Chrome/<major>`), or null (Firefox, Safari, Chrome on iOS). */
export const chromiumMajor = (ua: string) => {
  const m = /\bChrome\/(\d+)\./.exec(ua)
  return m ? Number(m[1]) : null
}

/** Whether this engine's optimized code can go stale between runs (`STALE_JIT`). */
export const jitGoesStale = (ua: string) => {
  const major = chromiumMajor(ua)
  return major !== null && major >= STALE_JIT.from && major <= STALE_JIT.to
}

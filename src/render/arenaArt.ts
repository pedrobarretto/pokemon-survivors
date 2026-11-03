import type { TierId } from '../data/arenaRanked'
import type { Role, Team } from '../data/versus'
import type { MapTheme } from '../data/versusMaps'
import { canvasCache, context2d, createCanvas, drawable } from '../engine/pixelart'

/**
 * The Arena's painted art (made with PixelLab, `public/assets/arena/`): each
 * scenery's goal posts, spawn pads, banner pillars, gates and grass clumps
 * (the meadow's at the folder's top, the coast's in `coast/`), and the mode's
 * 32 px icons (`icons/`, with the official PokéAPI Poké Ball sprites for the
 * ranked tiers). A scenery's world pieces load on demand, once a match on it
 * or the Arena screen asks (`loadValeArt`), and the map draws its code look
 * until each one lands (`valeArt` is null meanwhile). Presentation only.
 */

const TEAM_FILES = ['blue', 'red'] as const satisfies readonly [string, string]
type TeamFile = (typeof TEAM_FILES)[number]

export type PostLook = 'open' | 'locked' | 'broken'
/** The three grass clumps, each with a sway frame and a rustle frame (someone moving inside). */
export const CLUMPS = ['a', 'b', 'c'] as const
export type Clump = (typeof CLUMPS)[number]
export type ClumpFrame = '' | '-sway' | '-rustle'

/** A world picture, by its file name (in its scenery's folder). */
export type ValeArt =
  | `goal-post-${TeamFile}-${PostLook}`
  | `spawn-pad-${TeamFile}`
  | `base-pillar-${TeamFile}`
  | `base-gate-${TeamFile}`
  | `grass-${Clump}${ClumpFrame}`

const VALE_ART: readonly ValeArt[] = [
  ...TEAM_FILES.flatMap((t) => [
    ...(['open', 'locked', 'broken'] as const).map((l): ValeArt => `goal-post-${t}-${l}`),
    `spawn-pad-${t}` as const,
    `base-pillar-${t}` as const,
    `base-gate-${t}` as const,
  ]),
  ...CLUMPS.flatMap((c) => (['', '-sway', '-rustle'] as const).map((f): ValeArt => `grass-${c}${f}`)),
]

/** A scenery's folder under `assets/arena/` ('' for the meadow, the first). */
const folderOf = (theme: MapTheme) => (theme === 'meadow' ? '' : `${theme}/`)

const THEMES = ['meadow', 'coast'] as const satisfies readonly MapTheme[]

/** Every world picture's file (its folder and name), for the test that checks they all exist. */
export const valeArtFiles = () => THEMES.flatMap((theme) => VALE_ART.map((id) => `${folderOf(theme)}${id}`))

/** A team's file name in the art's names. */
export const teamFile = (team: Team): TeamFile => TEAM_FILES[team]

const images = new Map<MapTheme, Map<ValeArt, HTMLImageElement>>()

/** Starts loading a scenery's pictures (once each): about 60 KB, a match's or the Arena screen's first frame asks. */
export const loadValeArt = (theme: MapTheme) => {
  if (images.has(theme)) return
  const set = new Map<ValeArt, HTMLImageElement>()
  for (const id of VALE_ART) {
    const img = new Image()
    img.src = `${import.meta.env.BASE_URL}assets/arena/${folderOf(theme)}${id}.png`
    set.set(id, img)
  }
  images.set(theme, set)
}

/** A world picture of `theme`, or null while it loads (it starts loading the lot). */
export const valeArt = (id: ValeArt, theme: MapTheme): HTMLImageElement | null => {
  loadValeArt(theme)
  const img = images.get(theme)!.get(id)!
  return drawable(img) ? img : null
}

const mirrored = canvasCache<string, HTMLCanvasElement>()

/** A world picture flipped left to right (the grass clumps vary that way), or null while it loads. */
export const valeArtMirrored = (id: ValeArt, theme: MapTheme): HTMLCanvasElement | null => {
  const key = `${theme}:${id}`
  const hit = mirrored.get(key)
  if (hit) return hit
  const img = valeArt(id, theme)
  if (!img) return null
  const canvas = createCanvas(img.width, img.height)
  const ctx = context2d(canvas)
  ctx.scale(-1, 1)
  ctx.drawImage(img, -img.width, 0)
  mirrored.set(key, canvas)
  return canvas
}

/* ---------------- Icons ---------------- */

/** The Arena's icons by id: the roles, Energy, MVP, the medals, the queues, the Arena hub's tabs and the ranked tiers. */
export const ARENA_ICONS = {
  roleAttacker: 'role-attacker',
  roleSpeedster: 'role-speedster',
  roleAllRounder: 'role-allrounder',
  roleDefender: 'role-defender',
  roleSupporter: 'role-supporter',
  energy: 'energy',
  mvp: 'mvp',
  medalPoints: 'medal-points',
  medalKos: 'medal-kos',
  medalDamage: 'medal-damage',
  queueCasual: 'queue-casual',
  queueRanked: 'queue-ranked',
  tabProfile: 'tab-profile',
  tabSeason: 'tab-season',
  tabRanking: 'tab-ranking',
  tabHistory: 'tab-history',
  tabRules: 'tab-rules',
  tierPoke: 'tier-poke-ball',
  tierGreat: 'tier-great-ball',
  tierUltra: 'tier-ultra-ball',
  tierMaster: 'tier-master-ball',
} as const satisfies Record<string, string>

export type ArenaIcon = keyof typeof ARENA_ICONS

/** An icon's URL, for an `<img>` (the browser fetches it when the screen shows it). */
export const arenaIconUrl = (id: ArenaIcon) => `${import.meta.env.BASE_URL}assets/arena/icons/${ARENA_ICONS[id]}.png`

/** Each role's icon. */
export const ROLE_ICONS = {
  attacker: 'roleAttacker',
  speedster: 'roleSpeedster',
  allRounder: 'roleAllRounder',
  defender: 'roleDefender',
  supporter: 'roleSupporter',
} as const satisfies Record<Role, ArenaIcon>

/** Each ranked tier's ball: the official item sprites (PokeAPI), 18 px. */
const TIER_ICONS = { poke: 'tierPoke', great: 'tierGreat', ultra: 'tierUltra', master: 'tierMaster' } as const satisfies Record<TierId, ArenaIcon>

/** A ranked tier's ball, for an `<img>`. */
export const tierBallUrl = (tier: TierId) => arenaIconUrl(TIER_ICONS[tier])

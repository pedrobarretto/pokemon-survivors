/**
 * Vivillon's wing patterns (`data/gaFamiliesHook.ts`): a look only, never the
 * simulation's. Each is a SpriteCollab form of #666 (`FORMS` in
 * `scripts/dex.mjs`, the key its form's), but Meadow, the species' own sheets;
 * `colors` tint the scales its powder sheds (`render/gaHookFx.ts`), light to
 * dark. Which one a player wears is their device's region
 * (`src/vivillonRegion.ts`); teammates' ride their co-op loadout. Fancy and
 * Poké Ball are event patterns in the games, with no region, so none is drawn
 * here (their sheets aren't fetched). Names stay official English.
 */
export const VIVILLON_PATTERNS = {
  meadow: { name: 'Meadow', colors: ['#f8f0f0', '#f878a8', '#d83878'] },
  icySnow: { name: 'Icy Snow', colors: ['#f8f8f8', '#c0c8d8', '#8890a8'] },
  polar: { name: 'Polar', colors: ['#f8f8f8', '#88b8e8', '#3868b8'] },
  tundra: { name: 'Tundra', colors: ['#e8f0f8', '#a8c8e8', '#6088c0'] },
  continental: { name: 'Continental', colors: ['#f8d848', '#f89838', '#d05030'] },
  garden: { name: 'Garden', colors: ['#c8e888', '#78c058', '#407830'] },
  elegant: { name: 'Elegant', colors: ['#f8e0f0', '#c878d8', '#7840a0'] },
  modern: { name: 'Modern', colors: ['#f8d838', '#f08838', '#d83830'] },
  marine: { name: 'Marine', colors: ['#f0f0f0', '#78a8e8', '#2860c0'] },
  archipelago: { name: 'Archipelago', colors: ['#f8d050', '#f08838', '#58a840'] },
  highPlains: { name: 'High Plains', colors: ['#f8d080', '#f0a038', '#b86820'] },
  sandstorm: { name: 'Sandstorm', colors: ['#f0e0b8', '#d0b078', '#8a6a40'] },
  river: { name: 'River', colors: ['#f0d860', '#98b048', '#9a6838'] },
  monsoon: { name: 'Monsoon', colors: ['#e8e8f0', '#a0a8c0', '#4858a0'] },
  savanna: { name: 'Savanna', colors: ['#f8b040', '#4890e0', '#48a048'] },
  sun: { name: 'Sun', colors: ['#f8e048', '#f8a030', '#e03830'] },
  ocean: { name: 'Ocean', colors: ['#f8b040', '#f878a0', '#3890e8'] },
  jungle: { name: 'Jungle', colors: ['#f0a040', '#78c8a0', '#288868'] },
} as const satisfies Record<string, { name: string; colors: readonly [string, string, string] }>

export type VivillonPattern = keyof typeof VIVILLON_PATTERNS

export const VIVILLON_PATTERN_IDS = Object.keys(VIVILLON_PATTERNS) as VivillonPattern[]

export const isVivillonPattern = (v: unknown): v is VivillonPattern => typeof v === 'string' && Object.hasOwn(VIVILLON_PATTERNS, v)

/** Vivillon's dex: the stage that wears a pattern (Scatterbug and Spewpa look the same everywhere). */
export const VIVILLON_DEX = 666

/** Minior's Core colors, SpriteCollab's seven core forms of #774 (`FORMS`), and the light and dark of each for its effects. */
export const MINIOR_CORES = {
  red: ['#f89878', '#e83030'],
  orange: ['#f8c078', '#f07818'],
  yellow: ['#f8f088', '#e8c018'],
  green: ['#a8f0a0', '#38b048'],
  blue: ['#98d8f8', '#2888e0'],
  indigo: ['#a8b0f8', '#4050c8'],
  violet: ['#e0a8f8', '#9040c8'],
} as const satisfies Record<string, readonly [string, string]>

export type MiniorCore = keyof typeof MINIOR_CORES

export const MINIOR_CORE_IDS = Object.keys(MINIOR_CORES) as MiniorCore[]

export const MINIOR_DEX = 774

import type { BiomeId } from './biomes'
import type { EnemyId } from './enemies'
import type { ThemeId } from './music'
import { ULTRA_BEASTS } from './ultraBeasts'

/**
 * THE RÁDIO's catalog (`ui/radio.ts`, rules in `src/radioRules.ts`): the
 * game's own chiptune themes (`THEMES` in `data/music.ts`) a player can pick
 * to play, in the order the sheet lists them, each in its group and with how
 * it unlocks. A new theme is one line here plus its name in every language
 * (`tracks` in `i18n/radio.ts`, which the type checker holds to this list).
 *
 * - `open`: from the start.
 * - `biome`: once the player has heard it on this device, which walking in
 *   that biome does (the radio notes the theme the game would have played,
 *   even while it plays something else); the lock names the biome.
 * - `legend`: once any of `ids` is in the Pokédex (seen or caught), or heard.
 * - `heard`: only by hearing it once (a Realm room's or a mini game's own theme, say).
 */
export type RadioUnlock =
  | { readonly kind: 'open' }
  | { readonly kind: 'biome'; readonly biome: BiomeId }
  | { readonly kind: 'legend'; readonly ids: readonly EnemyId[] }
  | { readonly kind: 'heard' }

export const RADIO_GROUPS = ['menus', 'realm', 'biomes', 'bosses', 'legends'] as const

export type RadioGroup = (typeof RADIO_GROUPS)[number]

export type RadioTrack = { readonly theme: ThemeId; readonly group: RadioGroup; readonly unlock: RadioUnlock }

const open = { kind: 'open' } as const
const biome = (id: BiomeId) => ({ kind: 'biome', biome: id }) as const
const legend = (...ids: readonly EnemyId[]) => ({ kind: 'legend', ids }) as const

export const RADIO_TRACKS = [
  { theme: 'menu', group: 'menus', unlock: open },
  { theme: 'lobbyMorning', group: 'menus', unlock: open },
  { theme: 'lobbyAfternoon', group: 'menus', unlock: open },
  { theme: 'lobbyNight', group: 'menus', unlock: open },
  { theme: 'lobbyRain', group: 'menus', unlock: open },
  { theme: 'lobbyFestival', group: 'menus', unlock: { kind: 'heard' } },
  { theme: 'realmTown', group: 'realm', unlock: open },
  { theme: 'cafe', group: 'realm', unlock: { kind: 'heard' } },
  { theme: 'fishing', group: 'realm', unlock: { kind: 'heard' } },
  { theme: 'arcade', group: 'realm', unlock: { kind: 'heard' } },
  { theme: 'gameCorner', group: 'realm', unlock: { kind: 'heard' } },
  { theme: 'dig', group: 'realm', unlock: { kind: 'heard' } },
  { theme: 'safariField', group: 'realm', unlock: { kind: 'heard' } },
  { theme: 'safariBattle', group: 'realm', unlock: { kind: 'heard' } },
  { theme: 'contest', group: 'realm', unlock: { kind: 'heard' } },
  { theme: 'run', group: 'biomes', unlock: open },
  { theme: 'forest', group: 'biomes', unlock: biome('forest') },
  { theme: 'beach', group: 'biomes', unlock: biome('beach') },
  { theme: 'cave', group: 'biomes', unlock: biome('cave') },
  { theme: 'plant', group: 'biomes', unlock: biome('plant') },
  { theme: 'desert', group: 'biomes', unlock: biome('desert') },
  { theme: 'snow', group: 'biomes', unlock: biome('snow') },
  { theme: 'volcano', group: 'biomes', unlock: biome('volcano') },
  { theme: 'tower', group: 'biomes', unlock: biome('tower') },
  { theme: 'dojo', group: 'biomes', unlock: { kind: 'heard' } },
  { theme: 'kubfuTower', group: 'biomes', unlock: { kind: 'heard' } },
  { theme: 'boss', group: 'bosses', unlock: open },
  { theme: 'teraRaid', group: 'bosses', unlock: { kind: 'heard' } },
  { theme: 'birds', group: 'bosses', unlock: legend('articuno', 'zapdos', 'moltres') },
  { theme: 'beasts', group: 'bosses', unlock: legend('raikou', 'entei', 'suicune', 'zeraora') },
  { theme: 'regis', group: 'bosses', unlock: legend('regirock', 'regice', 'registeel', 'regigigas', 'regieleki', 'regidrago') },
  { theme: 'mewtwo', group: 'bosses', unlock: legend('mewtwo', 'mew', 'celebi', 'jirachi') },
  { theme: 'arceus', group: 'bosses', unlock: legend('arceus') },
  { theme: 'lugia', group: 'legends', unlock: legend('lugia') },
  { theme: 'hoOh', group: 'legends', unlock: legend('hoOh') },
  { theme: 'kyogre', group: 'legends', unlock: legend('kyogre') },
  { theme: 'groudon', group: 'legends', unlock: legend('groudon') },
  { theme: 'rayquaza', group: 'legends', unlock: legend('rayquaza') },
  { theme: 'latis', group: 'legends', unlock: legend('latias', 'latios') },
  { theme: 'deoxys', group: 'legends', unlock: legend('deoxys') },
  { theme: 'dialga', group: 'legends', unlock: legend('dialga') },
  { theme: 'palkia', group: 'legends', unlock: legend('palkia') },
  { theme: 'ultraSpace', group: 'legends', unlock: legend(...ULTRA_BEASTS) },
] as const satisfies readonly RadioTrack[]

/** One of the catalog's lines. */
export type RadioEntry = (typeof RADIO_TRACKS)[number]

/** A theme the radio can play: one of the catalog's. */
export type RadioThemeId = RadioEntry['theme']

/**
 * When a track moves on: after whole loops adding up to at least `seconds`,
 * and never fewer than `loops` (a short tune isn't over after 20 s).
 */
export const RADIO = { loops: 2, seconds: 90 } as const

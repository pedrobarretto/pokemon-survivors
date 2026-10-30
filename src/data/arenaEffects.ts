import type { CosmeticBase, CosmeticSlot } from './cosmetics'
import type { PokeType } from './types'

/**
 * The cosmetics that aren't worn (`data/cosmetics.ts` spreads them into the
 * catalog): a follower that trots after the Pokémon, a trail, titles and
 * name plates, in every mode; the spawn, KO and goal effects and emotes, in
 * the Arena (`SLOT_MODES`). Pure presentation, drawn by the shell
 * (`render/arenaFx.ts`) from what the simulation already says happened (a
 * goal, a KO), never feeding back into it. Only the emote reaches the match, as a tick entry with no payload
 * (`versusSocial.ts`): every screen plays the emote the seat's look names.
 *
 * - `follower`: a small Pokémon (`dex`, SpriteCollab's sheets; `float`: it
 *   hovers) trotting after its trainer like the supporters' companion. Its
 *   `name` and `types` list it in the site's Pokédex when nothing else does.
 * - `trail`: particles left while moving (`TrailKind`).
 * - `spawn`, `ko`, `goal`: a one-shot effect (`BurstKind`) where the Pokémon
 *   (re)spawns, on a rival it knocked out, at the goal it scored in.
 * - `emote`: one of the extra SpriteCollab animations (`anims`, the first
 *   the species has; `EMOTE_ANIMS` in scripts/dex.mjs downloads them for the
 *   Arena's roster) with a code-drawn `flourish` around it; a `sequence`
 *   plays every one of them the species has in turn, a loop each; `once`
 *   plays it a single time and holds its last frame (a pose).
 * - `title`: its name is the title, shown under the player's name.
 * - `plate`: the colors, border and emblem of the name tag and HP bar.
 */

/** A trail's particles. */
export type TrailKind = 'spark' | 'petal' | 'bubble' | 'ember' | 'snow' | 'heart' | 'star' | 'rainbow'

/** A one-shot effect of the spawn, KO and goal slots. */
export type BurstKind =
  | 'beam'
  | 'leaves'
  | 'splash'
  | 'thunder'
  | 'pokeball'
  | 'stars'
  | 'puff'
  | 'ghost'
  | 'lightning'
  | 'supernova'
  | 'confetti'
  | 'coins'
  | 'balloons'
  | 'hearts'
  | 'rainbow'

/** The extra SpriteCollab animations an emote may play (front row only: `scripts/fetch-emotes.mjs`). */
export const EMOTE_ANIMS = ['Hop', 'Rotate', 'Sleep', 'Charge', 'Pose'] as const
export type EmoteAnim = (typeof EMOTE_ANIMS)[number]

/** What an emote draws around the Pokémon while it plays. */
export type Flourish = 'confetti' | 'sparkles' | 'zz' | 'aura' | 'notes' | 'fireworks'

/** A name plate's small mark, left of the name. */
export type PlateEmblem = 'bolt' | 'leaf' | 'drop' | 'flame' | 'star' | 'master'

/** A name plate: its fill, its 1 px border, the light along its top and the emblem's colors. */
export type PlateStyle = { fill: string; edge: string; light: string; emblem: PlateEmblem; ink: readonly [string, string] }

type Base<S extends CosmeticSlot> = CosmeticBase & { slot: S }
type Burst<S extends 'spawn' | 'ko' | 'goal'> = Base<S> & { burst: BurstKind }

export type ArenaEffectDef =
  | (Base<'follower'> & { dex: number; name: string; types: readonly PokeType[]; float?: boolean })
  | (Base<'trail'> & { trail: TrailKind })
  | Burst<'spawn'>
  | Burst<'ko'>
  | Burst<'goal'>
  | (Base<'emote'> & { anims: readonly [EmoteAnim, ...EmoteAnim[]]; flourish: Flourish; sequence?: boolean; once?: boolean })
  | Base<'title'>
  | (Base<'plate'> & { plate: PlateStyle })

export const ARENA_EFFECTS = {
  // Followers: cute and small, none of them in the Arena's roster.
  pichuFollower: { slot: 'follower', rarity: 'common', dex: 172, name: 'Pichu', types: ['electric'] },
  togepiFollower: { slot: 'follower', rarity: 'common', dex: 175, name: 'Togepi', types: ['fairy'] },
  azurillFollower: { slot: 'follower', rarity: 'common', dex: 298, name: 'Azurill', types: ['normal', 'fairy'] },
  swabluFollower: { slot: 'follower', rarity: 'rare', dex: 333, name: 'Swablu', types: ['normal', 'flying'], float: true },
  togedemaruFollower: { slot: 'follower', rarity: 'rare', dex: 777, name: 'Togedemaru', types: ['electric', 'steel'] },
  dedenneFollower: { slot: 'follower', rarity: 'rare', dex: 702, name: 'Dedenne', types: ['electric', 'fairy'] },
  eeveeFollower: { slot: 'follower', rarity: 'epic', dex: 133, name: 'Eevee', types: ['normal'] },
  snomFollower: { slot: 'follower', rarity: 'epic', dex: 872, name: 'Snom', types: ['ice', 'bug'] },
  mimikyuFollower: { slot: 'follower', rarity: 'epic', dex: 778, name: 'Mimikyu', types: ['ghost', 'fairy'] },
  mewFollower: { slot: 'follower', rarity: 'legendary', dex: 151, name: 'Mew', types: ['psychic'], float: true },

  sparkTrail: { slot: 'trail', rarity: 'common', trail: 'spark' },
  petalTrail: { slot: 'trail', rarity: 'common', trail: 'petal' },
  bubbleTrail: { slot: 'trail', rarity: 'common', trail: 'bubble' },
  emberTrail: { slot: 'trail', rarity: 'rare', trail: 'ember' },
  snowTrail: { slot: 'trail', rarity: 'rare', trail: 'snow' },
  heartTrail: { slot: 'trail', rarity: 'rare', trail: 'heart' },
  starTrail: { slot: 'trail', rarity: 'epic', trail: 'star' },
  rainbowTrail: { slot: 'trail', rarity: 'legendary', trail: 'rainbow' },

  spawnBeam: { slot: 'spawn', rarity: 'common', burst: 'beam' },
  spawnLeaves: { slot: 'spawn', rarity: 'common', burst: 'leaves' },
  spawnSplash: { slot: 'spawn', rarity: 'rare', burst: 'splash' },
  spawnThunder: { slot: 'spawn', rarity: 'epic', burst: 'thunder' },
  spawnPokeball: { slot: 'spawn', rarity: 'legendary', burst: 'pokeball' },

  koStars: { slot: 'ko', rarity: 'common', burst: 'stars' },
  koPuff: { slot: 'ko', rarity: 'common', burst: 'puff' },
  koGhost: { slot: 'ko', rarity: 'rare', burst: 'ghost' },
  koLightning: { slot: 'ko', rarity: 'epic', burst: 'lightning' },
  koSupernova: { slot: 'ko', rarity: 'legendary', burst: 'supernova' },

  goalConfetti: { slot: 'goal', rarity: 'common', burst: 'confetti' },
  goalCoins: { slot: 'goal', rarity: 'rare', burst: 'coins' },
  goalBalloons: { slot: 'goal', rarity: 'rare', burst: 'balloons' },
  goalHearts: { slot: 'goal', rarity: 'epic', burst: 'hearts' },
  goalRainbow: { slot: 'goal', rarity: 'legendary', burst: 'rainbow' },

  cheerEmote: { slot: 'emote', rarity: 'common', anims: ['Hop'], flourish: 'confetti' },
  spinEmote: { slot: 'emote', rarity: 'common', anims: ['Rotate'], flourish: 'sparkles' },
  napEmote: { slot: 'emote', rarity: 'common', anims: ['Sleep'], flourish: 'zz' },
  powerEmote: { slot: 'emote', rarity: 'rare', anims: ['Charge'], flourish: 'aura' },
  danceEmote: { slot: 'emote', rarity: 'epic', anims: ['Hop', 'Rotate'], flourish: 'notes', sequence: true },
  victoryEmote: { slot: 'emote', rarity: 'legendary', anims: ['Pose', 'Charge'], flourish: 'fireworks', once: true },

  rookieTitle: { slot: 'title', rarity: 'common' },
  teamTitle: { slot: 'title', rarity: 'common' },
  goalTitle: { slot: 'title', rarity: 'rare' },
  wallTitle: { slot: 'title', rarity: 'rare' },
  jungleTitle: { slot: 'title', rarity: 'rare' },
  unstoppableTitle: { slot: 'title', rarity: 'epic' },
  legendTitle: { slot: 'title', rarity: 'legendary' },

  plateSteel: { slot: 'plate', rarity: 'common', plate: { fill: '#283038', edge: '#8890a8', light: '#c8d0e0', emblem: 'bolt', ink: ['#f8d030', '#fff8c0'] } },
  plateLeaf: { slot: 'plate', rarity: 'common', plate: { fill: '#183018', edge: '#58b838', light: '#a8e870', emblem: 'leaf', ink: ['#58b838', '#c8f8a0'] } },
  plateWave: { slot: 'plate', rarity: 'rare', plate: { fill: '#102850', edge: '#4878e8', light: '#a8d8f8', emblem: 'drop', ink: ['#6890f0', '#e8f8ff'] } },
  plateFlame: { slot: 'plate', rarity: 'rare', plate: { fill: '#401810', edge: '#e85018', light: '#f8b030', emblem: 'flame', ink: ['#f07020', '#fff0a0'] } },
  plateGold: { slot: 'plate', rarity: 'epic', plate: { fill: '#403010', edge: '#e0b850', light: '#fff0a0', emblem: 'star', ink: ['#f8d030', '#ffffff'] } },
  plateMaster: { slot: 'plate', rarity: 'legendary', plate: { fill: '#281848', edge: '#a058e0', light: '#f070c0', emblem: 'master', ink: ['#7838c8', '#f8a8e0'] } },
} as const satisfies Record<string, ArenaEffectDef>

export type ArenaEffectId = keyof typeof ARENA_EFFECTS

export const isArenaEffectId = (v: unknown): v is ArenaEffectId => typeof v === 'string' && Object.hasOwn(ARENA_EFFECTS, v)

/** The effects of one slot, by id. */
export type EffectOf<S extends ArenaEffectDef['slot']> = Extract<ArenaEffectDef, { slot: S }>

/** `id`'s entry when it's an effect of `slot`, else null (an id of another slot, or a worn cosmetic). */
export const effectIn = <S extends ArenaEffectDef['slot']>(slot: S, id: string | undefined): EffectOf<S> | null => {
  if (!isArenaEffectId(id)) return null
  const def: ArenaEffectDef = ARENA_EFFECTS[id]
  return def.slot === slot ? (def as EffectOf<S>) : null
}

/** The followers' species, for the asset pipeline (`FOLLOWERS` in scripts/dex.mjs must hold them) and preloading. */
export const FOLLOWER_DEX = Object.values(ARENA_EFFECTS).flatMap((d: ArenaEffectDef) => (d.slot === 'follower' ? [d.dex] : []))

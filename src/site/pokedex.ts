import manifest from '../data/sprites.generated.json'
import { ENEMIES, type EnemyDef, type EnemyId } from '../data/enemies'
import { BRANCHES, branchesOf, branchStage, type BranchId } from '../data/branches'
import { HATCHLING_IDS, PLAYABLE, type HatchlingId, type PlayableId } from '../data/hatchlings'
import { REGIONS, STARTER_IDS, type Region, type StarterId } from '../data/starters'
import type { PokeType } from '../data/types'
import { isRiftLegend, RIFT, type RiftLegend } from '../data/rifts'
import { DOMAINS } from '../data/domains'
import { GRAVEYARD, PLACE, PLACE_IDS, PLACES, type PlaceId } from '../data/places'
import { SUMMONS } from '../data/traits'
import { bossCandidates, EVENTS, nightCandidates, RUN_LENGTH, STAGES, TRIO_IDS, TRIOS, type TrioId } from '../data/waves'
import { NIGHT_BOSSES } from '../data/halloween'
import { ENDLESS, REAPER } from '../game/endless'
import { MEOWTH_DEX } from '../game/mapEventRules'
import { SPECIAL_COMPANION_IDS, SPECIAL_COMPANIONS, type SpecialCompanionId } from '../data/companions'
import { LEGEND_IDS, type LegendId } from '../data/legends'

/**
 * The site's Pokédex model: every species the game uses, derived from
 * `data/*` (never written by hand), so a new starter or boss shows up here on
 * the next build.
 */

export const ROLES = ['starter', 'egg', 'enemy', 'boss', 'legendary', 'event'] as const

export type Role = (typeof ROLES)[number]

export type Sheet = { frameWidth: number; frameHeight: number; durations: readonly number[] }

type ManifestAnims = { Idle?: Sheet; Walk?: Sheet }
type ManifestEntry = { anims: ManifestAnims; portrait?: boolean; shiny?: { anims: ManifestAnims; portrait: boolean } }

const MANIFEST: Record<string, ManifestEntry> = manifest

export type SpriteSet = { idle: Sheet; walk: Sheet }

export type Sprites = { normal: SpriteSet; shiny: SpriteSet | null; portrait: boolean; shinyPortrait: boolean }

export type DexEntry = {
  /** Anchor id, e.g. `charizard`. */
  slug: string
  dex: number
  name: string
  types: readonly PokeType[]
  role: Role
  region: Region
  sprites: Sprites
  /**
   * `starter`: playable, a starter or an egg family (`role: 'egg'`); `wild` set when the species also roams the horde,
   * `branch` when it's a stage a branching evolution can go to (`data/branches.ts`).
   * `event`: met at a map event (the fleeing Meowth), not in the horde.
   * `companion`: a gift-only companion (`data/companions.ts`), listed as an event Pokémon.
   */
  source:
    | { kind: 'starter'; id: PlayableId; stage: number; wild?: EnemyId; branch?: BranchId }
    | { kind: 'wild'; id: EnemyId }
    | { kind: 'event' }
    | { kind: 'companion'; id: SpecialCompanionId }
    /** `cameo`: seen only in a domain's scene (Cresselia breaking Darkrai's nightmare, `LegendDomain.cameo`), never fought. */
    | { kind: 'cameo'; by: RiftLegend }
}

/** Last national dex number of each generation, in `REGIONS` order. */
const LAST_DEX = [151, 251, 386, 493, 649, 721, 809, 905, 1025] as const

/** Main-series region a species debuted in, from its national dex number. */
export const regionOf = (dex: number): Region => REGIONS.find((r) => dex <= (LAST_DEX[r.gen - 1] ?? Infinity)) ?? REGIONS[REGIONS.length - 1]!

export const slugOf = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace('♀', '-f')
    .replace('♂', '-m')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const spriteSet = (anims: ManifestAnims | undefined): SpriteSet | null =>
  anims?.Idle && anims.Walk ? { idle: anims.Idle, walk: anims.Walk } : null

/** Sprite sheets of a species; every species the game loads ships Idle and Walk (see `scripts/fetch-assets.mjs`). */
export const spritesOf = (dex: number): Sprites => {
  const entry = MANIFEST[String(dex)]
  const normal = spriteSet(entry?.anims)
  if (!entry || !normal) throw new Error(`No Idle/Walk sprites for dex ${dex}`)
  return {
    normal,
    shiny: spriteSet(entry.shiny?.anims),
    portrait: entry.portrait === true,
    shinyPortrait: entry.shiny?.portrait === true,
  }
}

const base = (dex: number, name: string, types: readonly PokeType[]) => ({
  slug: slugOf(name),
  dex,
  name,
  types,
  region: regionOf(dex),
  sprites: spritesOf(dex),
})

/** The first enemy of each species: the horde's own, ahead of a night boss of the same species (`HALLOWEEN.bosses`), which shares its card. */
const wildByDex = (Object.keys(ENEMIES) as EnemyId[]).reduce((byDex, id) => (byDex.has(ENEMIES[id].dex) ? byDex : byDex.set(ENEMIES[id].dex, id)), new Map<number, EnemyId>())

/** The Noite das Bruxas night boss of a species, if it has one: its card shows that boss's attacks. */
export const nightBossOf = (dex: number): EnemyId | null => NIGHT_BOSSES.find((id) => ENEMIES[id].dex === dex) ?? null

/** A playable line's stages, then the branches its evolution can take (Eevee's eight, Gallade…), each at the stage it replaces. */
const playableEntries = (id: PlayableId, role: Role): DexEntry[] => {
  const branchOf = new Map<number, BranchId>(branchesOf(id).map((b) => [BRANCHES[b].dex, b]))
  const stages = PLAYABLE[id].line.map((stage, i) => ({ stage, i }))
  const branches = [...branchOf.values()].map((b) => ({ stage: branchStage(b), i: BRANCHES[b].stage }))
  const seen = new Set<number>()
  return [...stages, ...branches].flatMap(({ stage, i }) => {
    if (seen.has(stage.dex)) return []
    seen.add(stage.dex)
    const branch = branchOf.get(stage.dex)
    const source = { kind: 'starter', id, stage: i, wild: wildByDex.get(stage.dex), ...(branch ? { branch } : {}) } as const
    return [{ ...base(stage.dex, stage.name, stage.types), role, source } satisfies DexEntry]
  })
}

const wildEntry = (id: EnemyId): DexEntry => {
  const e = ENEMIES[id]
  const role: Role = 'legendary' in e ? 'legendary' : 'boss' in e ? 'boss' : 'enemy'
  return { ...base(e.dex, e.name, e.types), role, source: { kind: 'wild', id } }
}

const eventEntry = (): DexEntry => ({ ...base(MEOWTH_DEX, 'Meowth', ['normal']), role: 'event', source: { kind: 'event' } })

const companionEntry = (id: SpecialCompanionId): DexEntry => {
  const c = SPECIAL_COMPANIONS[id]
  return { ...base(c.dex, c.name, c.types), role: 'event', source: { kind: 'companion', id } }
}

/** The domains' cameos (`LegendDomain.cameo`), listed as event Pokémon. */
const cameoEntries = (): DexEntry[] =>
  (Object.keys(DOMAINS) as RiftLegend[]).flatMap((by) => {
    const c = DOMAINS[by]?.cameo
    return c ? [{ ...base(c.dex, c.name, c.types), role: 'event' as const, source: { kind: 'cameo' as const, by } }] : []
  })

const byDex = (a: DexEntry, b: DexEntry) => a.dex - b.dex

/**
 * The in-game Pokédex, in national dex order: every species a run can bring,
 * so exactly what the save may hold (`GAME_SPECIES`). The Pokédex screen, the
 * Caixa do PC, the Trainer Card and the profile count these. Egg families that
 * also roam the horde get one card, the playable one; a night boss shares its
 * species' card.
 */
export const gameDex = (): DexEntry[] => {
  const playable = [...STARTER_IDS.flatMap((id) => playableEntries(id, 'starter')), ...HATCHLING_IDS.flatMap((id) => playableEntries(id, 'egg'))]
  const listed = new Set(playable.map((e) => e.dex))
  const wild = [...wildByDex].filter(([dex]) => !listed.has(dex)).map(([, id]) => wildEntry(id))
  return [...playable, ...wild, eventEntry()].sort(byDex)
}

/** The site's Pokédex: every species the game loads, `gameDex()` plus the gift-only companions and the domains' cameos (never met in a run, so never counted in game). */
export const pokedex = (): DexEntry[] => [...gameDex(), ...SPECIAL_COMPANION_IDS.map(companionEntry), ...cameoEntries()].sort(byDex)

/* ---------------- When a wild Pokémon shows up ---------------- */

export type Appearance =
  /** May be drawn into the regular spawn pool between two run times (seconds). */
  | { kind: 'horde'; from: number; until: number }
  /** May lead a swarm or ring (each run draws its own). */
  /** `fixed`: the event always brings this species instead of drawing one from the run's horde. */
  | { kind: 'swarm' | 'ring'; at: number; count: number; fixed?: boolean }
  /** `chance` is 1 for bosses that always come (a rare slot drawn among several splits its chance). */
  | { kind: 'boss'; at: number; chance: number }
  /** A Noite das Bruxas night boss (`HALLOWEEN.bosses`): takes the boss slot at `at` in haunted runs, drawn among its pool (`chance` each). */
  | { kind: 'night'; at: number; chance: number }
  /** A trio slot's boss, in the runs that draw `trio`. */
  | { kind: 'trio'; at: number; trio: TrioId }
  /** Waits behind a legendary rift, which first opens at `from`. */
  | { kind: 'rift'; from: number }
  /** Hunts the player in endless mode from `at`. */
  | { kind: 'reaper'; at: number }
  /** Lives in a place (`data/places.ts`), coming out from `from`; `boss` for the place's own boss. */
  | { kind: 'place'; place: PlaceId; from: number; boss: boolean }
  /** Called in by a summoner (Nidoqueen's Nidoran). */
  | { kind: 'summoned'; by: EnemyId }
  /** Comes at the player in a legendary's domain (`by`'s rift): its crossing's retinue, adds it calls in or keepers of its barrier. */
  | { kind: 'retinue'; by: EnemyId }

/**
 * When an enemy can show up: the spawn-pool windows of the stages with a slot
 * of its tier (contiguous stages merged), the swarms (flyers only) and rings of
 * its tier or naming it, its boss events (a night boss's haunted slot too), rifts, the reaper, places and summons.
 */
export const appearances = (id: EnemyId): Appearance[] => {
  const def: EnemyDef = ENEMIES[id]
  const windows = STAGES.reduce<Array<{ kind: 'horde'; from: number; until: number }>>((acc, stage, i) => {
    if (def.tier === undefined || !stage.cast.includes(def.tier)) return acc
    const from = STAGES[i - 1]?.until ?? 0
    const until = Math.min(stage.until, RUN_LENGTH)
    const last = acc[acc.length - 1]
    if (last && last.until === from) last.until = until
    else acc.push({ kind: 'horde', from, until })
    return acc
  }, [])
  const events = EVENTS.flatMap((e): Appearance[] => {
    if (e.kind === 'boss') {
      // A night boss, and the horde's own of its species, show its haunted slot.
      const night = nightCandidates(e)
      const haunted: Appearance[] = night.some((n) => ENEMIES[n].dex === def.dex) ? [{ kind: 'night', at: e.at, chance: 1 / night.length }] : []
      const candidates = bossCandidates(e)
      if (!candidates.includes(id)) return haunted
      const trio = 'trio' in e ? TRIO_IDS.find((t) => TRIOS[t][e.trio] === id) : undefined
      return trio ? [{ kind: 'trio', at: e.at, trio }] : [{ kind: 'boss', at: e.at, chance: (e.chance ?? 1) / candidates.length }]
    }
    if ('enemy' in e) return e.enemy === id ? [{ kind: e.kind, at: e.at, count: e.count, fixed: true }] : []
    if (e.tier !== def.tier || (e.kind === 'swarm' && !def.types.includes('flying'))) return []
    return [{ kind: e.kind, at: e.at, count: e.count }]
  })
  const rift: Appearance[] = isRiftLegend(id) ? [{ kind: 'rift', from: RIFT.slots[0] }] : []
  const reaper: Appearance[] = id === REAPER ? [{ kind: 'reaper', at: ENDLESS.reaperAt }] : []
  // A place's dwellers come out once the run's stage has their tier (never before the first entrance).
  const placed = PLACE_IDS.flatMap((place): Appearance[] => {
    if (place === 'graveyard' && id === GRAVEYARD.boss) return [{ kind: 'place', place, from: PLACE.firstAt, boss: true }]
    const species: readonly EnemyId[] = PLACES[place].species
    if (!species.includes(id)) return []
    const stage = STAGES.findIndex((s) => s.cast.includes(def.tier ?? 1))
    return [{ kind: 'place', place, from: Math.max(PLACE.firstAt, STAGES[stage - 1]?.until ?? 0), boss: false }]
  })
  const summoned = (Object.keys(SUMMONS) as Array<keyof typeof SUMMONS>)
    .filter((by) => SUMMONS[by].includes(id))
    .map((by): Appearance => ({ kind: 'summoned', by }))
  const retinue = (Object.keys(DOMAINS) as RiftLegend[])
    .filter((by) => domainCast(by).includes(id))
    .map((by): Appearance => ({ kind: 'retinue', by }))
  return [...windows, ...events, ...rift, ...reaper, ...placed, ...summoned, ...retinue]
}

/** Everyone a legendary's domain brings besides its legendaries: the crossing's retinue, its adds and its barrier's keepers. */
const domainCast = (legend: RiftLegend): readonly EnemyId[] => {
  const d = DOMAINS[legend]
  if (!d) return []
  const phases = [...d.phases, ...(d.partner?.phases ?? [])]
  const patterns = phases.flatMap((ph) => ph.patterns)
  return [
    ...d.crossing.retinue.members.map((m) => m.id),
    ...patterns.flatMap((p) => (p.kind === 'summon' || p.kind === 'guard' ? p.enemies : [])),
    ...(d.cast ?? []),
  ]
}

/** `m:ss` run clock, as shown on the HUD. */
export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`

/* ---------------- Pokémon pages ---------------- */

/**
 * A Pokémon with a page of its own (`/pokedex/<slug>/`): each playable family,
 * its stages and branches together, and each legend. One big Pokédex can't rank
 * for one Pokémon ("garchomp pokemon survivors") or be quoted by an AI chat; these can.
 */
export type DexPage =
  | { kind: 'family'; id: StarterId | HatchlingId; slug: string; entries: readonly DexEntry[] }
  | { kind: 'legend'; id: LegendId; slug: string; entries: readonly DexEntry[] }

let pages: readonly DexPage[] | null = null

/** Every Pokémon page: the starters, then the egg families, then the legends, in the game's order. */
export const dexPages = (): readonly DexPage[] => {
  if (pages) return pages
  const entries = pokedex()
  const families = [...STARTER_IDS, ...HATCHLING_IDS].map((id): DexPage => {
    const own = entries.filter((e) => e.source.kind === 'starter' && e.source.id === id)
    const stage = (e: DexEntry) => (e.source.kind === 'starter' ? e.source.stage : 0)
    return { kind: 'family', id, slug: slugOf(PLAYABLE[id].line[0].name), entries: own.sort((a, b) => stage(a) - stage(b) || a.dex - b.dex) }
  })
  const legends = LEGEND_IDS.map((id): DexPage => {
    const entry = entries.find((e) => e.source.kind === 'wild' && e.source.id === id)
    if (!entry) throw new Error(`No Pokédex entry for legend ${id}`)
    return { kind: 'legend', id, slug: entry.slug, entries: [entry] }
  })
  return (pages = [...families, ...legends])
}

/** The page a Pokédex entry belongs to, by species: its family's or its own (a legend). */
export const pageOf = (entry: DexEntry): DexPage | undefined =>
  dexPages().find((p) => p.entries.some((e) => e.dex === entry.dex))

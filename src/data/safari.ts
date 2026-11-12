import { HATCHLINGS, HATCHLING_IDS, type HatchlingId } from './hatchlings'
import type { GiftContent } from '../game/gifts'
import type { ContestPrize, SafariDaypart, SafariEntry, SafariMode, SafariRarity } from '../realm/games/safari.rules'
import { regionFamilies, regionOfWeek } from '../game/travel'
import { isRegion } from './regionalForms'
import type { LegendId } from './legends'

/**
 * The Zona Safári's habitats and who lives in them (`realm/games/safari.rules.ts`
 * has the rules, `server/src/safari.ts` the dice). A habitat is a type theme
 * over the regular egg families, plus the Safari-only families it shelters
 * (`only`, no egg brings them) and the families of the week's trip
 * (`regionOfWeek`, `game/travel.ts`). A Safari-only family behind a legend
 * (`SAFARI_GATED`) only lives there for the accounts that own the legend.
 */

/**
 * Regular egg families the Safari leaves out because their shiny is someone's
 * reward: Togepi (the Festival's top prize), Gastly (the Halloween jar), Noibat
 * (the Discord gift) and Dratini (bringing 10 friends). Munchlax, the invite's
 * family, isn't a regular egg's at all.
 */
const PROMISED: ReadonlySet<HatchlingId> = new Set(['togepi', 'gastly', 'noibat', 'dratini'])

const REGULAR = HATCHLING_IDS.filter((id) => (['common', 'rare', 'ultra'] as const).some((tier) => tier === HATCHLINGS[id].egg) && !PROMISED.has(id))

/** The habitats, in the weekly order (`habitatOfWeek`). A new Safari-only family is one more id in its habitat's `only`. */
export const SAFARI_HABITATS = {
  meadow: { types: ['normal', 'flying', 'grass', 'bug', 'fairy'], only: ['tandemaus', 'kangaskhan', 'pinsir', 'buneary', 'flabebe'] },
  marsh: { types: ['ghost', 'dark', 'poison', 'psychic'], only: ['mimikyu', 'meditite', 'skrelp'] },
  ridge: { types: ['electric', 'rock', 'ground', 'steel', 'fighting', 'fire', 'dragon'], only: ['morpeko', 'skarmory', 'drilbur', 'drampa', 'numel'] },
  cove: { types: ['water', 'ice'], only: ['lapras', 'phione'] },
} as const satisfies Record<string, { types: readonly string[]; only: readonly HatchlingId[] }>

export type SafariHabitat = keyof typeof SAFARI_HABITATS

export const SAFARI_HABITAT_IDS = Object.keys(SAFARI_HABITATS) as SafariHabitat[]

export const isSafariHabitat = (v: unknown): v is SafariHabitat => typeof v === 'string' && Object.hasOwn(SAFARI_HABITATS, v)

/** The families only the Safari brings, every habitat's `only` in the habitats' order. */
export const SAFARI_ONLY: readonly HatchlingId[] = SAFARI_HABITAT_IDS.flatMap((habitat) => SAFARI_HABITATS[habitat].only)

/**
 * Safari-only families that live in their habitat only for an account owning
 * a legend: Phione comes to the cove once Manaphy hatched (the API reads it
 * from the stored save, `server/src/safari.ts`). They never count in their
 * habitat's Pokédex, so the Pokédex that brings the legend can be filled
 * without them.
 */
export const SAFARI_GATED: Readonly<Partial<Record<HatchlingId, LegendId>>> = { phione: 'manaphy' }

/** The gated families an account has opened: those whose legend `owns` says it has. */
export const openGated = (owns: (legend: LegendId) => boolean): ReadonlySet<HatchlingId> =>
  new Set(SAFARI_ONLY.filter((id) => {
    const legend = SAFARI_GATED[id]
    return legend !== undefined && owns(legend)
  }))

const NONE: ReadonlySet<HatchlingId> = new Set()

/** Whether a family lives in the Safari for an account with `open` gated families. */
const allowed = (id: HatchlingId, open: ReadonlySet<HatchlingId>) => SAFARI_GATED[id] === undefined || open.has(id)

const typesOf = (id: HatchlingId): readonly string[] => HATCHLINGS[id].line[0].types

const rarityOf = (id: HatchlingId): SafariRarity => {
  if (SAFARI_ONLY.includes(id)) return 'special'
  const tier = HATCHLINGS[id].egg
  // The trip's visitors are as rare as a rare egg's.
  if (isRegion(tier)) return 'rare'
  return tier === 'ultra' ? 'ultra' : tier === 'rare' ? 'rare' : 'common'
}

/** A family as the Safari weighs it (the guarantee can bring one from outside the week's pool). */
export const safariEntry = (id: HatchlingId): SafariEntry<HatchlingId> => ({ family: id, rarity: rarityOf(id), types: typesOf(id) })

/** Every family a Safari can hold: the regular eggs' and the Safari-only ones. */
export const SAFARI_FAMILIES: readonly HatchlingId[] = [...REGULAR, ...SAFARI_ONLY]

/** A habitat's Safari-only families an account with `open` gated ones meets there. */
export const habitatOnly = (habitat: SafariHabitat, open: ReadonlySet<HatchlingId> = NONE): readonly HatchlingId[] =>
  (SAFARI_HABITATS[habitat].only as readonly HatchlingId[]).filter((id) => allowed(id, open))

/** A habitat's own residents, at any time of day: its types' families and its Safari-only ones (`poolAt` keeps who's about at one). */
const residentPool = (habitat: SafariHabitat, open: ReadonlySet<HatchlingId>): SafariEntry<HatchlingId>[] => {
  const { types } = SAFARI_HABITATS[habitat]
  return [...REGULAR.filter((id) => typesOf(id).some((type) => (types as readonly string[]).includes(type))), ...habitatOnly(habitat, open)].map(safariEntry)
}

/** Who can turn up in a habitat's tall grass in the week starting on `week`, at any time of day: its residents and the trip's region's families. */
export const habitatPool = (habitat: SafariHabitat, week: string, open: ReadonlySet<HatchlingId> = NONE): SafariEntry<HatchlingId>[] =>
  [...residentPool(habitat, open), ...regionFamilies(regionOfWeek(week)).map(safariEntry)]

/*
 * Day and night (`daypartOf` in `safari.rules.ts`, from the player's own
 * clock): who's about changes, never the odds. Night owls come out only after
 * dark, early birds sleep through it, and each habitat has its night visitors,
 * families of other types that wander in after dark. Dawn and dusk hold both.
 */

/** Families seen only by night, wherever their types put them. */
const NIGHT_ONLY: ReadonlySet<HatchlingId> = new Set(['zubat', 'zorua', 'houndour', 'shuppet', 'honedge', 'deino', 'dreepy', 'sableye', 'sneasel'])

/** Families asleep by night. */
const DAY_ONLY: ReadonlySet<HatchlingId> = new Set(['starly', 'pidgey', 'swablu', 'budew', 'larvesta', 'ponyta', 'spheal', 'applin'])

/** The families that wander into a habitat after dark, besides its own night owls. */
export const NIGHT_VISITORS = {
  meadow: ['zorua', 'shuppet'],
  marsh: ['joltik'],
  ridge: ['zubat', 'shuppet', 'sableye', 'sneasel'],
  cove: ['zubat', 'shuppet'],
} as const satisfies Record<SafariHabitat, readonly HatchlingId[]>

/** When a family is about: by day, by night, or both. */
export type SafariWhen = 'day' | 'night' | 'any'

export const whenAbout = (id: HatchlingId): SafariWhen => (NIGHT_ONLY.has(id) ? 'night' : DAY_ONLY.has(id) ? 'day' : 'any')

const aboutAt = (id: HatchlingId, part: SafariDaypart) => {
  const when = whenAbout(id)
  return when === 'any' || part === 'dawn' || part === 'dusk' || (part === 'day' ? when === 'day' : when === 'night')
}

/** Who can turn up in a habitat's tall grass at a time of day in the week starting on `week`: its residents and the trip's visitors about then, and its night visitors after dark (dawn and dusk too). */
export const poolAt = (habitat: SafariHabitat, part: SafariDaypart, week: string, open: ReadonlySet<HatchlingId> = NONE): SafariEntry<HatchlingId>[] => {
  const own = habitatPool(habitat, week, open).filter((e) => aboutAt(e.family, part))
  const visitors: readonly HatchlingId[] = part === 'day' ? [] : NIGHT_VISITORS[habitat]
  return [...own, ...visitors.filter((id) => !own.some((e) => e.family === id)).map(safariEntry)]
}

/**
 * Everyone who lives in a habitat, by day or by night: its Pokédex (`habitatDexDone`), in the board's order. The week's
 * trip's visitors aren't residents, so the Pokédex holds still; nor are the gated families (`SAFARI_GATED`).
 */
export const habitatResidents = (habitat: SafariHabitat): SafariEntry<HatchlingId>[] => {
  const own = residentPool(habitat, NONE)
  return [...own, ...(NIGHT_VISITORS[habitat] as readonly HatchlingId[]).filter((id) => !own.some((e) => e.family === id)).map(safariEntry)]
}

/** Whether `caught` (the families caught there) completes a habitat's Pokédex. */
export const habitatDexDone = (habitat: SafariHabitat, caught: readonly string[]) => habitatResidents(habitat).every((e) => caught.includes(e.family))

/**
 * Whether a habitat counts as completed: its Pokédex full now, or its reward
 * already sent (`rewarded`, the API's word), so a habitat completed before
 * its residents grew stays completed.
 */
export const habitatDone = (habitat: SafariHabitat, caught: readonly string[], rewarded: readonly string[]) => rewarded.includes(habitat) || habitatDexDone(habitat, caught)

/** The Concurso de Insetos's grass: every Bug family the Safari holds, whatever the habitat and the hour. */
export const CONTEST_POOL: readonly SafariEntry<HatchlingId>[] = SAFARI_FAMILIES.filter((id) => typesOf(id).includes('bug')).map(safariEntry)

/** A session's pool: the contest's bugs, or the habitat's at that time of day in the week starting on `week` (with the gated families `open`). */
export const sessionPool = (mode: SafariMode, habitat: SafariHabitat, part: SafariDaypart, week: string, open: ReadonlySet<HatchlingId> = NONE) =>
  mode === 'contest' ? [...CONTEST_POOL] : poolAt(habitat, part, week, open)

/** The pool with the Safari-only families `lacks` says the account still lacks marked (`SafariEntry.lacking`: they weigh more). */
export const markLacking = (pool: readonly SafariEntry<HatchlingId>[], lacks: (id: HatchlingId) => boolean): SafariEntry<HatchlingId>[] =>
  pool.map((e) => (e.rarity === 'special' && lacks(e.family) ? { ...e, lacking: true } : e))

/** The contest's prizes by place (`contestPrize`): the champion's title and frame, the podium's frame, Honey for the rest of the top. */
export const CONTEST_GIFTS = {
  champion: [
    { kind: 'title', title: 'bugChampion' },
    { kind: 'style', style: { slot: 'frame', id: 'bugContest' } },
    { kind: 'bag', item: 'honey', count: 3 },
  ],
  podium: [
    { kind: 'style', style: { slot: 'frame', id: 'bugContest' } },
    { kind: 'bag', item: 'honey', count: 2 },
  ],
  top: [{ kind: 'bag', item: 'honey', count: 1 }],
} as const satisfies Record<ContestPrize, readonly GiftContent[]>

/** A habitat's Pokédex filled: an Ultra egg. Every habitat's: the Guarda-Parque title. */
export const DEX_GIFT = { kind: 'egg', tier: 'ultra' } as const satisfies GiftContent
export const DEX_ALL_GIFT = { kind: 'title', title: 'safariWarden' } as const satisfies GiftContent

/** The Ovo de Manaphy: the cove's Pokédex brings it, and Manaphy hatches from it (`ui/manaphyEgg.ts`). */
export const SAFARI_EGG = { kind: 'legend', legend: 'manaphy' } as const satisfies GiftContent

/**
 * What filling each habitat's Pokédex brings besides `DEX_GIFT`, each under a
 * key of its own (`dexRewardKey`): the habitat's title, a sure shiny of its
 * first exclusive, and the cove's Ovo de Manaphy. The board shows them.
 */
export const HABITAT_REWARDS = {
  meadow: [{ kind: 'title', title: 'safariMeadow' }, { kind: 'shinyHatch', family: 'tandemaus' }],
  marsh: [{ kind: 'title', title: 'safariMarsh' }, { kind: 'shinyHatch', family: 'mimikyu' }],
  ridge: [{ kind: 'title', title: 'safariRidge' }, { kind: 'shinyHatch', family: 'morpeko' }],
  cove: [{ kind: 'title', title: 'safariCove' }, { kind: 'shinyHatch', family: 'lapras' }, SAFARI_EGG],
} as const satisfies Record<SafariHabitat, readonly GiftContent[]>

/** The gift key of a habitat's `i`-th reward (`HABITAT_REWARDS`); `DEX_GIFT` keeps the habitat's own key, `safariDex:<habitat>`. */
export const dexRewardKey = (habitat: SafariHabitat, i: number) => `safariDex:${habitat}:${i}`

/** The Safari families an account still lacks, given what it hatched, the family gifts it already has waiting and the gated families it opened. */
export const lackingFamilies = (hatched: Readonly<Record<string, unknown>>, gifted: readonly string[], open: ReadonlySet<HatchlingId> = NONE) =>
  SAFARI_FAMILIES.filter((id) => allowed(id, open) && hatched[id] === undefined && !gifted.includes(id)).map(safariEntry)

/** A family's first form, the one met in the grass. */
export const safariForm = (family: HatchlingId) => HATCHLINGS[family].line[0]

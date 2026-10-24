import { readFileSync } from 'node:fs'
import { ABILITIES, type AbilityId } from '../../src/data/abilities'
import { BRANCHES, branchesOf, type BranchId } from '../../src/data/branches'
import { ENEMIES, type EnemyDef, type EnemyId } from '../../src/data/enemies'
import { evolutionOf, evolvedFrom, neverEvolves } from '../../src/data/evolutions'
import { HATCHLINGS, isHatchling, isStarter, PLAYABLE, type PlayableId } from '../../src/data/hatchlings'
import { ITEMS, type ItemId } from '../../src/data/items'
import { isLegend, LEGENDS, type LegendUnlock } from '../../src/data/legends'
import { MEGAS, type MegaId } from '../../src/data/megas'
import { EVO_ITEMS } from '../../src/data/shop'
import { MOVES, type MoveDef, type MoveId } from '../../src/game/moves'
import { en } from '../../src/i18n/en'
import { CHANGELOG } from '../../src/site/changelog'

/**
 * What the staff bot knows about the game (`staffAgent.ts`): the public
 * overview (`public/llms.txt`) and the newest changelog highlights, read once
 * at boot, and `gameLookup`, which answers from the game's own data (Pokémon,
 * moves, held items, Abilities, wild Pokémon, Megas), in English.
 */

/** A name as the lookup compares it: lower case, letters and digits only (`Ho-Oh` → `hooh`). */
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '')

const keys = <K extends string>(o: Record<K, unknown>) => Object.keys(o) as K[]

const moveName = (id: MoveId) => MOVES[id].name

const stat = (o: object) =>
  Object.entries(o)
    .map(([k, v]) => `${k} ${typeof v === 'number' && v > 0 ? '+' : ''}${String(v)}`)
    .join(', ') || 'none'

/** How a player gets to play `id`. */
const howToGet = (id: PlayableId) => {
  if (isStarter(id)) return 'a starter, open from the start'
  if (isHatchling(id)) return `hatches from the ${en.eggs.tiers[HATCHLINGS[id].egg]}`
  if (isLegend(id)) {
    const u: LegendUnlock = LEGENDS[id].unlock
    return `a legend for Legend Mode, caught after ${u.wins} win${u.wins === 1 ? '' : 's'} against it as a boss${u.endless ? ' in endless mode' : ''}${u.event ? ` (only during the ${u.event} event)` : ''}`
  }
  return 'unknown'
}

/** A branching evolution: its stage, types and what opens it (`EVO_ITEMS`; a `free` one also comes without). */
const branchLine = (id: BranchId) => {
  const b: { name: string; stage: number; types: readonly string[]; free?: true } = BRANCHES[id]
  const items = keys(EVO_ITEMS).filter((i) => EVO_ITEMS[i].branches.some((x) => x === id)).map((i) => EVO_ITEMS[i].name)
  const how = items.length ? `${b.free ? 'free, or picked with' : 'needs'} ${items.join(' or ')}` : 'free'
  return `${b.name} (${b.types.join('/')}, replaces stage ${b.stage + 1}, ${how})`
}

const playableFacts = (id: PlayableId) => {
  const p = PLAYABLE[id]
  const stages = p.line.map((s) => `${s.name} (${s.types.join('/')})${'evolveAt' in s && s.evolveAt ? ` → Lv ${s.evolveAt}` : ''}`).join(', then ')
  const learnset = p.learnset.map((moves, i) => `stage ${i + 1}: ${moves.map(moveName).join(', ')}`).join('; ')
  const megas = keys(MEGAS).filter((m) => MEGAS[m].line === id).map((m) => `${MEGAS[m].name} (${MEGAS[m].stone}, ${MEGAS[m].ability})`)
  return [
    `Playable: ${p.name} (id ${id}), ${howToGet(id)}.`,
    `Line: ${stages}.`,
    branchesOf(id).length ? `Branching evolutions (the run's items decide which open): ${branchesOf(id).map(branchLine).join('; ')}.` : '',
    `Starting stats: ${stat(p.stats)}. Signature move: ${moveName(p.signature)}.`,
    `Learnset (each evolution adds a list): ${learnset}.`,
    megas.length ? `Megas: ${megas.join(', ')}.` : '',
  ].filter(Boolean)
}

const upgradeLine = (u: string | { fork: readonly { name: string; desc: string }[] }, level: number) =>
  typeof u === 'string' ? `Lv ${level}: ${u}` : `Lv ${level}: fork, ${u.fork.map((f) => `${f.name} (${f.desc})`).join(' or ')}`

const moveFacts = (id: MoveId) => {
  const m = MOVES[id]
  const text = en.moves[id]
  const into = evolutionOf(id)
  const from = evolvedFrom(id)
  const learners = keys(PLAYABLE).filter((p) => PLAYABLE[p].learnset.some((list) => list.some((x) => x === id)))
  const def: MoveDef = m
  const kind = def.duo ? 'a duo move (fused from two maxed moves)' : def.legendary ? 'a legendary move' : from ? `the evolution of ${moveName(from.from)} (+ ${ITEMS[from.item].name})` : 'a regular move'
  return [
    `Move: ${m.name} (id ${id}), ${m.type} type, ${kind}. ${text.description}`,
    `Levels: ${text.upgrades.map((u, i) => upgradeLine(u, i + 2)).join('; ')}.`,
    into ? `Evolves into ${moveName(into.to)} when maxed and holding ${ITEMS[into.item].name}.` : neverEvolves(id) || from || def.duo ? 'Never evolves.' : '',
    learners.length
      ? `Learned by: ${learners.slice(0, 20).map((p) => PLAYABLE[p].name).join(', ')}${learners.length > 20 ? ` and ${learners.length - 20} more` : ''}.`
      : from || def.duo
        ? ''
        : 'In no learnset (it comes from a TM, a tutor, a branch or a legendary).',
  ].filter(Boolean)
}

const itemFacts = (id: ItemId) => [`Held item: ${ITEMS[id].name} (id ${id}), up to Lv ${ITEMS[id].levels.length}. ${en.items[id]}`]

const abilityFacts = (id: AbilityId) => [`Ability: ${ABILITIES[id].name} (id ${id}). ${en.abilities[id]}`]

const enemyFacts = (id: EnemyId) => {
  const e: EnemyDef = ENEMIES[id]
  return [`Wild Pokémon: ${e.name} (${e.types.join('/')}), ${e.boss ? 'a boss' : `tier ${e.tier ?? '?'}`}${e.trait ? `, trait ${e.trait}` : ''}: ${e.hp} HP, ${e.damage} contact damage, ${e.speed} px/s.`]
}

const megaFacts = (id: MegaId) => {
  const m = MEGAS[id]
  return [`${m.name}: Mega Evolution of ${PLAYABLE[m.line].name}'s line at its final stage, with ${m.stone}. Ability: ${m.ability}.`]
}

/** Every entry the lookup can find: the names it answers to and its facts. */
const ENTRIES: readonly { names: string[]; facts: () => string[] }[] = [
  ...keys(PLAYABLE).map((id) => ({ names: [id, ...PLAYABLE[id].line.map((s) => s.name)], facts: () => playableFacts(id) })),
  ...keys(MOVES).map((id) => ({ names: [id, MOVES[id].name], facts: () => moveFacts(id) })),
  ...keys(ITEMS).map((id) => ({ names: [id, ITEMS[id].name], facts: () => itemFacts(id) })),
  ...keys(ABILITIES).map((id) => ({ names: [id, ABILITIES[id].name], facts: () => abilityFacts(id) })),
  ...keys(MEGAS).map((id) => ({ names: [id, MEGAS[id].name], facts: () => megaFacts(id) })),
  ...keys(ENEMIES).map((id) => ({ names: [id, ENEMIES[id].name], facts: () => enemyFacts(id) })),
].map((e) => ({ ...e, names: e.names.map(norm) }))

/** Entries a lookup returns at most. */
const LOOKUP_MAX = 4

/**
 * The game's data about `query` (a Pokémon, move, held item, Ability or
 * Mega by name or id), exact names first, then names that contain it. Empty
 * when nothing matches.
 */
export const gameLookup = (query: string): string[] => {
  const q = norm(query)
  if (q.length < 2) return []
  const exact = ENTRIES.filter((e) => e.names.includes(q))
  const partial = ENTRIES.filter((e) => !exact.includes(e) && e.names.some((n) => n.includes(q)))
  return [...exact, ...partial].slice(0, LOOKUP_MAX).flatMap((e) => [...e.facts(), ''])
}

/** `public/llms.txt`, where it sits beside the API's bundle (`/app/llms.txt` in the image) or in the repository. */
const LLMS_PATHS = [new URL('../llms.txt', import.meta.url), new URL('../../public/llms.txt', import.meta.url)]

/** The newest updates the knowledge pack carries. */
const UPDATES = 3

/** The overview and the newest highlights, as the system prompt carries them. Read once: call it at boot. */
export const loadKnowledge = () => {
  const overview = LLMS_PATHS.flatMap((p) => {
    try {
      return [readFileSync(p, 'utf8')]
    } catch {
      return []
    }
  })[0]
  if (!overview) console.warn('discord: no llms.txt, so the staff bot knows only the data lookups')
  const news = CHANGELOG.slice(0, UPDATES).map((u) => `${u.date}, ${u.title.en}:\n${u.highlights.map((h) => `- ${h.en}`).join('\n')}`)
  return [overview ?? '', `Newest updates:\n${news.join('\n\n')}`].join('\n\n')
}

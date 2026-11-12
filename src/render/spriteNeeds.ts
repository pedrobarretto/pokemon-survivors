import { domainOf, partnerOf } from '../data/domains'
import { ENEMIES, type EnemyId } from '../data/enemies'
import { GRAVEYARD, hiddenCast } from '../data/places'
import { isSummoner, SUMMONS } from '../data/traits'
import { EVENTS, STAGES, stageIndexAt, stageStart } from '../data/waves'
import { phaseForm, phasesOf } from '../game/bossFight'
import { maskOf, OGERPON_MASK_IDS, OGERPON_MASKS } from '../data/mythicals'
import { ENDLESS, REAPER } from '../game/endless'
import { playerDex } from '../game/game'
import { formAfter } from '../game/legend'
import { atMegaBase, heldMega } from '../game/mega'
import { placePool } from '../game/place'
import { actAs } from '../game/players'
import { bossSummons, type Roster } from '../game/roster'
import { STANCES } from '../game/stance'
import type { Game } from '../game/types'
import { sheetForm, type Dex, type KeepSprites, type Variant } from './sprites'

/**
 * Which species' sheets a run holds: the shell streams the ones it needs now
 * and next (`streamSprites`) and sweeps the rest (`sweepSprites`), so memory
 * stays flat over a run instead of growing with every species it met.
 * Alternate forms and shiny colors load only once they can show up soon
 * (`extraSprites`), never a whole family's or a legendary's at once.
 * Presentation only: the simulation never reads any of it.
 */

/** A species a run may draw from `from` to `until` (run seconds). */
export type SpriteNeed = { dex: Dex; from: number; until: number }

/** Seconds an event's species stays wanted after it comes; the enemies it brought are kept while they live. */
const EVENT_TAIL = 30

/** Seconds ahead of the reaper's hunt its sheets start loading. */
const REAPER_LEAD = 60

const stageEnd = (i: number) => STAGES[i]?.until ?? Infinity

/**
 * Every species of a run's cast with the window it shows up in: each stage's
 * pool (and what its summoners call in) and its spitter while the stage lasts,
 * each event's species (swarm, ring, boss and who it summons) from its time. `extras` (the fleeing
 * Meowth, the escort's Togepi) are wanted from their time on.
 */
export const castNeeds = (roster: Roster, extras: readonly { dex: Dex; at: number }[] = []): SpriteNeed[] => [
  ...roster.stages.flatMap((pool, i) => {
    const spitter = roster.spitters[i]
    const ids = [...pool.flatMap(([id]) => [id, ...(isSummoner(id) ? SUMMONS[id] : [])]), ...(spitter ? [spitter] : [])]
    return ids.map((id) => ({ dex: ENEMIES[id].dex, from: stageStart(i), until: stageEnd(i) }))
  }),
  ...EVENTS.flatMap((e, i) => {
    const id = roster.events[i]
    return id ? [id, ...(e.kind === 'boss' ? bossSummons(id) : [])].map((need) => ({ dex: ENEMIES[need].dex, from: e.at, until: e.at + EVENT_TAIL })) : []
  }),
  ...extras.map(({ dex, at }) => ({ dex, from: at, until: Infinity })),
]

/** Seconds into a run before it streams what doesn't show yet: its first frames come while the phone still decodes the run's own sheets. */
export const RUN_SETTLE = 8

/** Seconds ahead the cast streams at safe mode level 2 (`render/quality.ts`), instead of the whole next stage. */
const NEAR_LEAD = 20

/**
 * Up to which run second the cast streams at `time`: the end of the stage after the one playing,
 * only what shows now in the run's first seconds (`RUN_SETTLE`), and `NEAR_LEAD` ahead when `near`.
 */
export const streamHorizon = (time: number, near = false) => (time < RUN_SETTLE ? time : near ? time + NEAR_LEAD : stageEnd(stageIndexAt(time) + 1))

/** The needs due by `horizon` (by default the end of the stage after the one playing at `time`) and not over yet, soonest first, each species once. */
export const dueNeeds = (needs: readonly SpriteNeed[], time: number, horizon = stageEnd(stageIndexAt(time) + 1)): Dex[] => {
  const due = needs.filter((n) => n.from <= horizon && n.until > time).sort((a, b) => a.from - b.from)
  return [...new Set(due.map((n) => n.dex))]
}

/** The rift's legendary (and its partner) from its omen to the end of its arena. */
const riftLegends = (g: Game): EnemyId[] => {
  const legend = riftLegend(g)
  const partner = legend && partnerOf(legend)
  return [...(legend ? [legend] : []), ...(partner ? [partner] : [])]
}

const riftLegend = (g: Game) => g.rift.omen?.legend ?? g.rift.portal?.legend ?? g.rift.arena?.legend

/** A domain's cameo (Cresselia, breaking Darkrai's nightmare), wanted with its legendary. */
const riftCameo = (g: Game): Dex[] => {
  const legend = riftLegend(g)
  const cameo = legend && domainOf(legend)?.cameo
  return cameo ? [cameo.dex] : []
}

/** A place's dwellers (the ones its pool has now) once its entrance opens, Spiritomb with the graveyard's, a hidden zone's own, the run's roaming lake legend and Sword while they may still come (`game/quests.ts`), and the reaper as its hunt nears in the endless mode. */
const visitors = (g: Game): Dex[] => {
  const place = g.place.inside?.id ?? g.place.entrance?.id
  const raidBoss = g.raid.den?.raid.boss ?? g.raid.arena?.raid.boss
  const { roam, duel } = g.quests
  return [
    ...(roam && !roam.caught ? [ENEMIES[roam.legend].dex] : []),
    ...(duel && duel.stage !== 'done' ? [ENEMIES[duel.sword].dex] : []),
    ...(place ? placePool(place, g.time).map(([id]) => ENEMIES[id].dex) : []),
    ...(place === 'graveyard' ? [ENEMIES[GRAVEYARD.boss].dex] : []),
    // The Rocket Hideout's lair bosses: Giovanni's Persian and Mewtwo.
    ...(place === 'hideout' ? [ENEMIES.giovanniPersian.dex, ENEMIES.shadowMewtwo.dex] : []),
    // A hidden zone's lucky ones and rare dweller, from its entrance on (found or not: loading shows nothing).
    ...(place ? hiddenCast(place).map((id) => ENEMIES[id].dex) : []),
    ...(g.endless && g.time >= ENDLESS.reaperAt - REAPER_LEAD ? [ENEMIES[REAPER].dex] : []),
    // A Tera Raid's giant, from its den's opening on.
    ...(raidBoss ? [ENEMIES[raidBoss].dex] : []),
  ]
}

/** The forms each kit family may turn into mid-run (`seasonKitForm`), and Tatsugiri's Dondozo. */
const KIT_FORMS: Record<string, readonly string[]> = { school: ['school'], hero: ['hero'], hunger: ['hangry'], forecast: ['sunny', 'rainy', 'snowy'], zen: ['zen'], disguise: ['busted'], none: [] }
const DONDOZO = 977
/** The shell Nincada leaves behind: Shedinja floats beside Ninjask (`render/gaKitAFx.ts`). */
const SHEDINJA = 292

/** Every stance's name: the ones that are a form of the species (Aegislash's Blade, Deoxys's formes) load, the rest (Shield, Normal) are no form. */
const STANCE_NAMES = Object.keys(STANCES)

const OGERPON_DEX = ENEMIES.ogerpon.dex

/**
 * The forms each player may wear soon: their Mega once the stone is in hand at
 * the final stage, a legend's awakened form from its first awakening on, and
 * every stance of a stance changer (it swaps them at will).
 */
export const playerForms = (g: Game): Variant[] =>
  g.players.flatMap((p) => {
    const before = actAs(g, p)
    const dex = playerDex(g)
    const mega = atMegaBase(p) ? heldMega(g) : null
    actAs(g, before)
    // A legend's looks from its first awakening on (from the start with a path's forms: Zygarde 50%, Urshifu): the one it wears and the next.
    // Terapagos's Stellar Form wears its Terastal Form's sheets (`sheetForm`).
    const s = p.legend
    const looks = s && (s.awakened >= 1 || s.forms.length > 0) ? [formAfter(s.id, s.awakened, s.forms), formAfter(s.id, s.awakened + 1, s.forms) ?? formAfter(s.id, 2, s.forms)] : []
    // Ogerpon swaps masks (and Terastallizes) at any time: every mask's sheets, all along.
    const masks = s?.id === 'ogerpon' ? OGERPON_MASK_IDS.flatMap((m) => [OGERPON_MASKS[m].form, OGERPON_MASKS[m].tera]).flatMap((form) => (form ? [{ dex: OGERPON_DEX, shiny: p.shiny, form }] : [])) : []
    const legend = [...looks.flatMap((l) => (l ? [{ dex: l.dex, shiny: p.shiny, ...(l.key && { form: sheetForm(l.key) }) }] : [])), ...masks]
    const forms = [...(mega ? [mega.form] : []), ...(p.special.stance !== null ? STANCE_NAMES : []), ...(KIT_FORMS[p.kit?.kind ?? 'none'] ?? [])]
    return [...forms.map((form) => ({ dex, shiny: p.shiny, form })), ...legend, ...(p.kit?.kind === 'commander' ? [{ dex: DONDOZO, shiny: false }] : []), ...(p.kitA?.kind === 'shell' && p.stage >= 1 ? [{ dex: SHEDINJA, shiny: p.shiny }] : [])]
  })

/**
 * The rift's sheets beyond its legendary's normal colors: from the omen, the form
 * it starts its battle in; inside, its shiny colors when it is shiny; and in the
 * battle, the form of every phased boss's phase, of the one before (its form
 * change shows the old form a moment) and of the next one, so a phase's form is
 * ready when the phase comes instead of all of them at the crossing.
 */
export const bossForms = (g: Game): Variant[] => {
  const shiny = g.rift.arena?.shiny ?? false
  const rift = riftLegends(g).flatMap((id) => {
    const dex = ENEMIES[id].dex
    const form = phasesOf(id)?.[0]?.form
    return [...(form ? [{ dex, shiny, form }] : []), ...(shiny ? [{ dex, shiny }] : [])]
  })
  const fights = g.enemies.flatMap((e) => {
    const phases = e.fight ? phasesOf(e.kind) : null
    if (!phases || !e.fight) return []
    const d = e.fight.difficulty
    const forms = [phaseForm(phases[e.fight.phase - 1], d), phaseForm(phases[e.fight.phase], d), phaseForm(phases[e.fight.phase + 1], d)]
    return forms.flatMap((form) => (form ? [{ dex: ENEMIES[e.kind].dex, shiny: e.shiny, form }] : []))
  })
  // Ogerpon's raid giant wears its mask Terastallized (`bossForm`), from its den's opening on.
  const raid = g.raid.den?.raid ?? g.raid.arena?.raid
  const ogerpon = raid?.boss === 'ogerpon' ? [{ dex: ENEMIES.ogerpon.dex, shiny: false, form: OGERPON_MASKS[maskOf(raid.tera)].tera }] : []
  // Shadow Mewtwo wears SpriteCollab's Shadow sheets from the Hideout's door on (`data/rocketHideout.ts`).
  const hideout = g.place.inside?.id === 'hideout' || g.place.entrance?.id === 'hideout' ? [{ dex: ENEMIES.shadowMewtwo.dex, shiny: false, form: 'shadow' as const }] : []
  return [...rift, ...fights, ...hideout, ...ogerpon]
}

/**
 * What a run streams and keeps right now. It streams what the next moments
 * bring outside the cast (`riftLegends`, `visitors`), then this stage's and the
 * next one's cast by when they come; `extras` are the forms and shiny colors
 * that can show up soon (`playerForms`, `bossForms`), which all have a stand-in
 * (the base form, the normal colors). It keeps those, every enemy alive (on
 * screen or not), and with every variant (shiny, forms) `always` (the player's
 * line, the companion, the outbreak), the rift's legendary, shiny enemies and bosses.
 * `near`: the cast streams only a little ahead (`streamHorizon`), for safe mode level 2.
 */
export const runSprites = (g: Game, needs: readonly SpriteNeed[], always: readonly Dex[], near = false): { stream: Variant[]; extras: Variant[]; keep: KeepSprites } => {
  const legends = [...riftLegends(g).map((id) => ENEMIES[id].dex), ...riftCameo(g)]
  const order = [...new Set([...legends, ...visitors(g), ...dueNeeds(needs, g.time, streamHorizon(g.time, near))])]
  const species = new Set(order)
  const variants = new Set([...always, ...legends])
  for (const e of g.enemies) {
    const dex = ENEMIES[e.kind].dex
    species.add(dex)
    if (e.shiny || e.boss) variants.add(dex)
    // A boss outliving its event's window still calls in its summons.
    if (!e.boss) continue
    for (const id of bossSummons(e.kind)) {
      const called = ENEMIES[id].dex
      if (species.has(called)) continue
      species.add(called)
      order.push(called)
    }
  }
  return { stream: order.map((dex) => ({ dex, shiny: false })), extras: [...playerForms(g), ...bossForms(g)], keep: { species, variants } }
}

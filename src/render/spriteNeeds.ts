import { domainOf, partnerOf } from '../data/domains'
import { ENEMIES, type EnemyId } from '../data/enemies'
import { GRAVEYARD } from '../data/places'
import { isSummoner, SUMMONS } from '../data/traits'
import { EVENTS, STAGES, stageIndexAt, stageStart } from '../data/waves'
import { phasesOf } from '../game/bossFight'
import { ENDLESS, REAPER } from '../game/endless'
import { playerDex } from '../game/game'
import { formAfter } from '../game/legend'
import { heldMega, isFinalStage } from '../game/mega'
import { placePool } from '../game/place'
import { actAs } from '../game/players'
import { bossSummons, type Roster } from '../game/roster'
import { STANCES } from '../game/stance'
import type { Game } from '../game/types'
import type { Dex, KeepSprites, Variant } from './sprites'

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

/** The needs due by the end of the stage after the one playing at `time` and not over yet, soonest first, each species once. */
export const dueNeeds = (needs: readonly SpriteNeed[], time: number): Dex[] => {
  const horizon = stageEnd(stageIndexAt(time) + 1)
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

/** A place's dwellers (the ones its pool has now) once its entrance opens, Spiritomb with the graveyard's, and the reaper as its hunt nears in the endless mode. */
const visitors = (g: Game): Dex[] => {
  const place = g.place.inside?.id ?? g.place.entrance?.id
  return [
    ...(place ? placePool(place, g.time).map(([id]) => ENEMIES[id].dex) : []),
    ...(place === 'graveyard' ? [ENEMIES[GRAVEYARD.boss].dex] : []),
    ...(g.endless && g.time >= ENDLESS.reaperAt - REAPER_LEAD ? [ENEMIES[REAPER].dex] : []),
  ]
}

/** Every stance's name: the ones that are a form of the species (Aegislash's Blade, Deoxys's formes) load, the rest (Shield, Normal) are no form. */
const STANCE_NAMES = Object.keys(STANCES)

/**
 * The forms each player may wear soon: their Mega once the stone is in hand at
 * the final stage, a legend's awakened form from its first awakening on, and
 * every stance of a stance changer (it swaps them at will).
 */
export const playerForms = (g: Game): Variant[] =>
  g.players.flatMap((p) => {
    const before = actAs(g, p)
    const dex = playerDex(g)
    const mega = isFinalStage(p.starter, p.stage) ? heldMega(g) : null
    actAs(g, before)
    const legend = p.legend && p.legend.awakened >= 1 ? formAfter(p.legend.id, 2)?.key : undefined
    const forms = [...(mega ? [mega.form] : []), ...(legend ? [legend] : []), ...(p.special.stance !== null ? STANCE_NAMES : [])]
    return forms.map((form) => ({ dex, shiny: p.shiny, form }))
  })

/**
 * The rift's sheets beyond its legendary's normal colors: from the omen, the form
 * it starts its battle in; inside, its shiny colors when it is shiny; and in the
 * battle, the form of every phased boss's phase and of the next one, so a phase's
 * form is ready when the phase comes instead of all of them at the crossing.
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
    const forms = [phases[e.fight.phase]?.form, phases[e.fight.phase + 1]?.form]
    return forms.flatMap((form) => (form ? [{ dex: ENEMIES[e.kind].dex, shiny: e.shiny, form }] : []))
  })
  return [...rift, ...fights]
}

/**
 * What a run streams and keeps right now. It streams what the next moments
 * bring outside the cast (`riftLegends`, `visitors`), then this stage's and the
 * next one's cast by when they come; `extras` are the forms and shiny colors
 * that can show up soon (`playerForms`, `bossForms`), which all have a stand-in
 * (the base form, the normal colors). It keeps those, every enemy alive (on
 * screen or not), and with every variant (shiny, forms) `always` (the player's
 * line, the companion, the outbreak), the rift's legendary, shiny enemies and bosses.
 */
export const runSprites = (g: Game, needs: readonly SpriteNeed[], always: readonly Dex[]): { stream: Variant[]; extras: Variant[]; keep: KeepSprites } => {
  const legends = [...riftLegends(g).map((id) => ENEMIES[id].dex), ...riftCameo(g)]
  const order = [...new Set([...legends, ...visitors(g), ...dueNeeds(needs, g.time)])]
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

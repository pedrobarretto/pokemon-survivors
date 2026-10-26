import { ACHIEVEMENT_IDS, ACHIEVEMENTS, MEDAL_EGG, MEDAL_REWARD, MEDALS, TITLE_IDS, type AchievementDef, type AchievementId } from '../../data/achievements'
import { DAILY_POOL, MISSION_SLOTS, WEEKLY_POOL, type MissionTemplate } from '../../data/missions'
import { AREAS, areaStart, BIOME_IDS, BIOME_LENGTH, BIOMES, ROUTE, WEATHER_IDS, type BiomeId, type WeatherId } from '../../data/biomes'
import { BOSS_DIFFICULTY, BOSS_PATTERNS, BOSS_RAGE } from '../../data/bosses'
import { DROP_TABLES, ENEMY_BERRY_CHANCE, ENEMY_DROP_CHANCE, FLUTE_SLEEP, PROPS, type Drop, type DropSource } from '../../data/consumables'
import { ENEMIES, type EnemyDef, type EnemyId } from '../../data/enemies'
import { EVOLUTIONS, neverEvolves } from '../../data/evolutions'
import { CURSE_IDS, CURSES } from '../../data/curses'
import { CURSE } from '../../game/curses'
import { DUO_RECIPES } from '../../game/duoRules'
import { ITEM_IDS, ITEMS } from '../../data/items'
import { REGIONS, STARTER_IDS, STARTERS } from '../../data/starters'
import { WEATHER, WEATHER_CHIP } from '../../data/weather'
import { effectiveness, POKE_TYPES } from '../../data/types'
import { MEGA, MEGA_IDS, MEGA_LINES, MEGAS, megasOf, type MegaDef } from '../../data/megas'
import { RIFT, RIFT_LEGENDS, type RiftLegend } from '../../data/rifts'
import { DOMAINS, partnerOf } from '../../data/domains'
import { ABILITIES } from '../../data/abilities'
import { COOP } from '../../data/coop'
import { AWAKEN_AT, LEGEND_IDS, legendFestival, LEGENDS, REGULAR_LEGENDS, type LegendId } from '../../data/legends'
import { legendSource } from '../../game/capture'
import { legendMods } from '../../game/legend'
import { CAVE, GRAVEYARD, PLACE, PLACE_IDS, PLACES, SKY, WING_IDS, WINGS } from '../../data/places'
import { TIER_FLOORS, TIERS } from '../../data/roster'
import { BOSS_FIGHT, bossCandidates, ELITE, EVENTS, FINALE, MYTHICALS, RUN_LENGTH, RUNNER, scaling, STAGES, stageStart, TRIO_IDS, TRIOS, type BossEvent } from '../../data/waves'
import { createRng } from '../../engine/rng'
import { DIFFICULTIES, DIFFICULTY_IDS } from '../../game/difficulty'
import { ENDLESS, REAPER, reaperHp } from '../../game/endless'
import { CONSUMABLES } from '../../game/consumables'
import { EGG_SOURCES, EGG_TIER_IDS, EGG_TIERS, EGGS, hatchPool, MAX_SLOTS, type EggSource } from '../../game/eggs'
import { INCUBATOR } from '../../data/shop'
import { HATCHLING_IDS, HATCHLINGS, PLAYABLE } from '../../data/hatchlings'
import { MAP_EVENTS } from '../../game/mapEvents'
import { TUTOR } from '../../game/tmRules'
import { clearOfBosses, FIELD, FIELD_TUNING } from '../../game/fieldMissionRules'
import { formatTime } from '../../engine/math'
import { ALTAR, BOMB, CHEST, chestCoins, DIRECTOR, FOUNTAIN, MEOWTH } from '../../game/mapEventRules'
import { MAX_ITEMS, MAX_MOVES, OFFER_RARITY } from '../../game/leveling'
import { COIN_VALUES, runBonus, UPGRADE_IDS, UPGRADES, upgradePrice } from '../../game/meta'
import { maxMoveLevel, MOVE_IDS, MOVES, type MoveDef, type MoveId } from '../../game/moves'
import { SHINY_BUFF, SHINY_ODDS } from '../../game/shiny'
import { AFFINITY_ODDS, drawRoster, seedWeight, TRAIT_ALIVE, TRAIT_CAP, TRAIT_FROM } from '../../game/roster'
import { MIN_SPECIAL_COOLDOWN, resolveSpecial, SPECIAL_IDS, specialOfType, SPECIALS } from '../../game/special'
import { riftScale } from '../../game/rift'
import { placeBossScale, wingAmount } from '../../game/place'
import { LANDMARK, LANDMARK_IDS, LANDMARK_LOOT, TUNNEL, type LandmarkLoot, type TreasureLandmark } from '../../data/landmarks'
import { BURN_ATTACK, FREEZE_SHATTER, SEED_HEAL, STATUS_KINDS, STATUS_RULES, type StatusKind } from '../../game/status'
import { SEED_JUMPS } from '../../game/kitRules'
import { LOCALES, type Locale } from '../../i18n'
import { SITE_MESSAGES, type SiteMessages } from '../../i18n/site'
import { html, type Child, type Html } from '../html'
import { layout } from '../layout'
import { clock, gameDex, slugOf } from '../pokedex'
import { ROUTES } from '../routes'
import { bossAttacks, patternText, traitText, typeBadge } from './pokedex'

type Section = keyof SiteMessages['guide']['sections']

const table = (head: readonly Child[], rows: readonly (readonly Child[])[]) =>
  html`<div class="table-wrap"><table>
    <thead><tr>${head.map((h) => html`<th scope="col">${h}</th>`)}</tr></thead>
    <tbody>${rows.map((r) => html`<tr>${r.map((c, i) => (i === 0 ? html`<th scope="row">${c}</th>` : html`<td>${c}</td>`))}</tr>`)}</tbody>
  </table></div>`

const paragraphs = (texts: readonly string[]) => texts.map((t) => html`<p>${t}</p>`)

const portrait = (dex: number) => html`<img class="mini" src="/assets/pokemon/${dex}/portrait.png" width="40" height="40" loading="lazy" alt="" />`

/** Anchor of a species in the Pokédex. */
const dexLink = (locale: Locale, name: string) => `${ROUTES.pokedex[locale]}#${slugOf(name)}`

const bossName = (locale: Locale, enemy: keyof typeof ENEMIES) =>
  html`<a class="with-mini" href="${dexLink(locale, ENEMIES[enemy].name)}">${portrait(ENEMIES[enemy].dex)}${ENEMIES[enemy].name}</a>`

/** A legend's name and portrait, linked to its Pokédex entry. */
const legendName = (locale: Locale, id: LegendId) => {
  const { dex, name } = LEGENDS[id].line[0]
  return html`<a class="with-mini" href="${dexLink(locale, name)}">${portrait(dex)}${name}</a>`
}

const controls = (m: SiteMessages) => {
  const c = m.guide.controls
  return html`${table([c.head.action, c.head.keyboard, c.head.gamepad, c.head.touch], c.rows)}${paragraphs(c.notes)}`
}

const run = (locale: Locale, m: SiteMessages) => {
  const r = m.guide.run
  const num = (v: number) => v.toLocaleString(m.lang.tag, { maximumFractionDigits: 2 })
  const scale = [5, 10, 15].map((min) => {
    const s = scaling(min * 60)
    return [clock(min * 60), num(s.hp), num(s.damage)] as const
  })
  const events = EVENTS.map((e) => {
    if (e.kind === 'swarm') return [clock(e.at), m.roster.swarm(e.count, e.tier)]
    if (e.kind === 'ring') {
      if (!('enemy' in e)) return [clock(e.at), m.roster.ring(e.count, e.tier)]
      const name = ENEMIES[e.enemy].name
      return [clock(e.at), html`<a href="${dexLink(locale, name)}">${m.roster.ringOf(e.count, name)}</a>`]
    }
    const names = bossCandidates(e).map((id) => ENEMIES[id].name)
    const text = 'trio' in e ? r.bossTrio(m.trios.either(names)) : e.chance !== undefined ? r.bossChance(m.trios.either(names), e.chance * 100) : r.boss(names[0]!)
    return [clock(e.at), names.length > 1 ? text : html`<a href="${dexLink(locale, names[0]!)}">${text}</a>`]
  })
  const names = LOCALES[locale].messages.difficulty.names
  const times = (v: number) => `${num(v)}x`
  const levels = DIFFICULTY_IDS.map((id) => {
    const d = DIFFICULTIES[id]
    return [names[id], times(d.enemyHp), times(d.enemyDamage), times(d.spawnRate), times(d.enemySpeed), times(d.ramp), times(d.healing)]
  })
  return html`${paragraphs(r.paragraphs(RUN_LENGTH / 60, STARTER_IDS.length))}
    <p>${r.scaling(scale)}</p>
    <h3>${r.difficulty}</h3>
    <p>${r.difficultyIntro}</p>
    ${table(r.difficultyHead, levels)}
    <h3>${r.timeline}</h3>
    ${table([r.timeHead, r.eventHead], events)}`
}

const world = (locale: Locale, m: SiteMessages) => {
  const w = m.guide.world
  const game = LOCALES[locale].messages.world
  const pct = (v: number) => Math.round(v * 1000) / 10
  // One row per biome an area can be: Route 1, then the two of each fork's tier.
  const areas: readonly (readonly BiomeId[])[] = [[ROUTE.start], ...ROUTE.tiers]
  const biomes = areas.flatMap((ids, i) =>
    ids.map((id) => {
      const odds: Partial<Record<WeatherId, number>> = BIOMES[id].weather
      const likely = WEATHER_IDS.filter((wid) => (odds[wid] ?? 0) > 0).sort((a, b) => odds[b]! - odds[a]!)
      return [clock(areaStart(i)), game.biomes[id], html`${BIOMES[id].affinity.map((type) => typeBadge(type, m))}`, likely.map((wid) => game.weather[wid]).join(', ')]
    }),
  )
  const routes = ROUTE.tiers.reduce((n, tier) => n * tier.length, 1)
  // Every effect is read from the weather rules, so the guide follows any rebalance.
  const effect = (id: Exclude<WeatherId, 'clear'>) => {
    const def = WEATHER[id]
    const parts = [
      ...POKE_TYPES.flatMap((type) => {
        const mult = def.power?.[type]
        return mult === undefined ? [] : [w.power(m.types[type], mult)]
      }),
      ...(def.chip
        ? [w.chip(pct(WEATHER_CHIP.enemy), pct(WEATHER_CHIP.boss), pct(WEATHER_CHIP.player), WEATHER_CHIP.every, pct(WEATHER_CHIP.playerFloor), def.chip.immune.map((t) => m.types[t]))]
        : []),
      ...(def.sight !== undefined ? [w.fog] : []),
    ]
    return parts.join('; ')
  }
  const weather = WEATHER_IDS.flatMap((id) => (id === 'clear' ? [] : [[game.weather[id], effect(id)]]))
  return html`${paragraphs(w.paragraphs(AREAS, BIOME_LENGTH / 60, AFFINITY_ODDS, BIOME_IDS.length, routes))}
    ${table([w.timeHead, w.biomeHead, w.hordeHead, w.weatherHead], biomes)}
    <h3>${w.weatherTitle}</h3>
    ${table([w.weatherCol, w.effectHead], weather)}`
}

/** Wild species that can be drawn, by tier, in dex order. */
const tiered = TIERS.map((tier) =>
  Object.values<EnemyDef>(ENEMIES)
    .filter((e) => e.tier === tier)
    .sort((a, b) => a.dex - b.dex),
)

/** `count` species spread over the tier's dex range, so the examples span generations. */
const spread = <T>(items: readonly T[], count: number) =>
  items.length <= count ? items : Array.from({ length: count }, (_, i) => items[Math.floor(((i + 0.5) * items.length) / count)]!)

const horde = (locale: Locale, m: SiteMessages) => {
  const r = m.roster
  const perRun = new Set(drawRoster(createRng(1), { weight: seedWeight(1) }).stages.flatMap((pool) => pool.map(([id]) => id))).size
  const tiers = TIERS.map((tier, i) => [
    r.tierOf(tier),
    r.total(TIER_FLOORS[i - 1] ?? 0, TIER_FLOORS[i] === undefined ? null : TIER_FLOORS[i] - 1),
    tiered[i]!.length,
    html`<span class="minis">${spread(tiered[i]!, 4).map((e) => html`<a class="with-mini" href="${dexLink(locale, e.name)}">${portrait(e.dex)}${e.name}</a>`)}</span>`,
  ])
  const stages = STAGES.map((stage, i) => {
    const groups = TIERS.flatMap((tier) => {
      const count = stage.cast.filter((t) => t === tier).length
      return count > 0 ? [[tier, count] as const] : []
    })
    const end = Math.min(stage.until, RUN_LENGTH)
    return [`${clock(stageStart(i))}–${clock(end)}`, r.cast(groups, stage.fresh)]
  })
  const special = r.special({ fill: ELITE.fill, share: ELITE.share, hp: ELITE.hp, damage: ELITE.damage, from: clock(stageStart(RUNNER.from)), speed: RUNNER.speed, frail: RUNNER.hp, lead: RUNNER.lead })
  return html`${paragraphs(r.paragraphs(tiered.flat().length, perRun))}
    <p>${r.formula}</p>
    ${paragraphs(special)}
    <h3>${r.tiersTitle}</h3>
    ${table([r.tierHead, r.totalHead, r.speciesHead, r.examplesHead], tiers)}
    <h3>${r.stagesTitle}</h3>
    ${table([r.timeHead, r.castHead], stages)}`
}

const levels = (locale: Locale, m: SiteMessages) => {
  const l = m.guide.levels
  const game = LOCALES[locale].messages
  const [first, second] = STARTERS.charmander.line
  const baseMove = MOVE_IDS.find((id) => MOVES[id].upgrades.length > 0) ?? 'ember'
  const items = ITEM_IDS.map((id) => [ITEMS[id].name, game.items[id], ITEMS[id].levels.length])
  return html`${paragraphs(l.paragraphs(MAX_MOVES, MAX_ITEMS, maxMoveLevel(baseMove)))}
    ${paragraphs(l.choices(OFFER_RARITY.rare * 100, Math.round(1 / OFFER_RARITY.shiny)))}
    <p>${l.evolution(first.evolveAt, second.evolveAt)}</p>
    <p>${l.abilities}</p>
    <h3>${l.itemsTitle}</h3>
    ${table([l.itemHead, l.effectHead, l.levelsHead], items)}`
}

const moveEvolutions = (locale: Locale, m: SiteMessages) => {
  const e = m.guide.moveEvolutions
  const game = LOCALES[locale].messages
  const rows = EVOLUTIONS.map((evo) => [
    html`${MOVES[evo.from].name} <small>(${LOCALES[locale].messages.level(maxMoveLevel(evo.from))})</small>`,
    ITEMS[evo.item].name,
    html`<b>${MOVES[evo.to].name}</b> ${typeBadge(MOVES[evo.to].type, m)}<br /><small>${game.moves[evo.to].description}</small>`,
  ])
  const evolving = new Set<MoveId>(EVOLUTIONS.flatMap((evo) => [evo.from, evo.to]))
  // Signature, TM, legendary and duo moves never evolve by design (`neverEvolves`; duos listed below).
  const without = MOVE_IDS.filter((id) => !evolving.has(id) && !neverEvolves(id)).map((id) => MOVES[id].name)
  const duos = DUO_RECIPES.map((r) => {
    const made = 'alt' in r ? [r.to, r.alt] : [r.to]
    return [
      html`${typeBadge(r.types[0], m)} + ${typeBadge(r.types[1], m)}`,
      html`${made.map((id, i) => html`${i > 0 ? html`<br />` : ''}<b>${MOVES[id].name}</b> ${typeBadge(MOVES[id].type, m)}<br /><small>${game.moves[id].description}</small>`)}`,
    ]
  })
  const curses = CURSE_IDS.map((id) => [html`<b>${CURSES[id].name}</b>`, game.curses[id].upside, game.curses[id].downside])
  return html`${paragraphs(e.paragraphs)}
    ${table([e.moveHead, e.itemHead, e.resultHead], rows)}
    ${without.length > 0 ? html`<p class="note">${e.noEvolution(without.join(', '))}</p>` : ''}
    <p class="note">${e.neverEvolves}</p>
    <h3>${e.duoTitle}</h3>
    ${paragraphs(e.duoParagraphs)}
    ${table([e.duoTypesHead, e.duoHead], duos)}
    <h3>${e.cursedTitle}</h3>
    ${paragraphs(e.cursedParagraphs(CURSE.from / 60, CURSE.chance, CURSE.max))}
    ${table([e.itemHead, e.cursedUpHead, e.cursedDownHead], curses)}`
}

const special = (locale: Locale, m: SiteMessages) => {
  const s = m.guide.special
  const game = LOCALES[locale].messages
  // One special per type (a Pokémon uses its first type's, so some have no user yet), then the per-species ones.
  const byType = POKE_TYPES.map(specialOfType)
  const ids = [...byType, ...SPECIAL_IDS.filter((id) => !byType.includes(id))]
  const rows = ids.map((id) => {
    const def = SPECIALS[id]
    // Mega specials list the line whose Mega form uses them.
    const users = [...STARTER_IDS, ...HATCHLING_IDS].filter((p) => PLAYABLE[p].line.some((_, stage) => resolveSpecial(p, stage).id === id) || megasOf(p).some((mega) => MEGAS[mega].special === id))
    const name = def.base.name === def.final.name ? def.final.name : `${def.base.name} → ${def.final.name}`
    return [
      typeBadge(def.type, m),
      html`<b>${name}</b><br /><small>${game.specials[id]}</small>`,
      `${def.cooldown}s`,
      users.length > 0
        ? html`<span class="minis">${users.map((p) => html`<span class="with-mini">${portrait(PLAYABLE[p].line[0].dex)}${PLAYABLE[p].line[0].name}</span>`)}</span>`
        : s.noUsers,
    ]
  })
  return html`${paragraphs(s.paragraphs(MIN_SPECIAL_COOLDOWN))}${table([s.typeHead, s.moveHead, s.cooldownHead, s.usersHead], rows)}`
}

const types = (m: SiteMessages) => {
  const t = m.guide.types
  const num = (v: number) => v.toLocaleString(m.lang.tag)
  // Sample matchups through the real damage rule, so the text follows any rebalance.
  const chart = t.chart(
    num(effectiveness('water', ['fire'])),
    num(effectiveness('water', ['rock', 'ground'])),
    num(effectiveness('fire', ['water'])),
    num(effectiveness('normal', ['ghost'])),
  )
  const movesBy = (kind: StatusKind) =>
    MOVE_IDS.filter((id) => {
      const def: MoveDef = MOVES[id]
      return def.status?.kind === kind
    }).map((id) => MOVES[id].name)
  const effect = (kind: StatusKind) => {
    switch (kind) {
      case 'burn':
        return t.effects.burn(BURN_ATTACK)
      case 'poison':
        return t.effects.poison(STATUS_RULES.poison.maxStacks)
      case 'paralysis':
        return t.effects.paralysis(STATUS_RULES.paralysis.boss)
      case 'slow':
        return t.effects.slow(STATUS_RULES.slow.boss)
      case 'sleep':
        return t.effects.sleep(FLUTE_SLEEP, STATUS_RULES.sleep.boss)
      case 'freeze':
        return t.effects.freeze(FREEZE_SHATTER, STATUS_RULES.freeze.boss)
      case 'mark':
        return t.effects.mark(STATUS_RULES.mark.maxStacks)
      case 'confuse':
        return t.effects.confuse()
      case 'seed':
        return t.effects.seed(SEED_HEAL, SEED_JUMPS)
      case 'weaken':
        return t.effects.weaken(STATUS_RULES.weaken.boss)
    }
  }
  // Only conditions something inflicts: a move, or the Poké Flute for sleep.
  const rows = STATUS_KINDS.flatMap((kind) => {
    const moves = movesBy(kind)
    if (moves.length === 0 && kind !== 'sleep') return []
    return [[t.names[kind], moves.length > 0 ? moves.join(', ') : t.flute, effect(kind)]]
  })
  return html`<p>${chart}</p>
    <p>${t.statusIntro}</p>
    ${table([t.statusHead, t.movesHead, t.effectHead], rows)}
    <p class="note">${t.itemsNote}</p>`
}

const bosses = (locale: Locale, m: SiteMessages) => {
  const b = m.guide.bosses
  const pct = (v: number) => Math.round(v * 1000) / 10
  /** One row per boss an event may bring: a trio slot lists each trio's member, a rare slot splits its chance. */
  const rowsOf = (e: BossEvent) => {
    const candidates = bossCandidates(e)
    return candidates.map((id, i) => [
      e.chance !== undefined ? `${clock(e.at)} (${pct(e.chance / candidates.length)}%)` : clock(e.at),
      'trio' in e ? html`${bossName(locale, id)} <small>${m.trios.names[TRIO_IDS[i]!]}</small>` : bossName(locale, id),
      ENEMIES[id].hp.toLocaleString(m.lang.tag),
      bossAttacks(id, m),
    ])
  }
  const rows = EVENTS.flatMap((e) => (e.kind === 'boss' ? rowsOf(e) : []))
  const rules = { ...BOSS_RAGE, fight: BOSS_FIGHT.rate, window: BOSS_FIGHT.duration, finale: FINALE.rate, press: BOSS_DIFFICULTY }
  const trioTimes = EVENTS.flatMap((e) => (e.kind === 'boss' && 'trio' in e ? [clock(e.at)] : []))
  const rare = EVENTS.find((e): e is BossEvent => e.kind === 'boss' && 'mythical' in e)
  const trios = TRIO_IDS.map((id) => `${m.trios.names[id]} (${TRIOS[id].map((enemy) => ENEMIES[enemy].name).join(', ')})`)
  const mythicals = m.trios.either(MYTHICALS.map((id) => ENEMIES[id].name))
  return html`${paragraphs(b.paragraphs(rules))}${paragraphs(b.trios(trioTimes, trios, mythicals, pct(rare?.chance ?? 0)))}${table([b.timeHead, b.bossHead, b.hpHead, b.attacksHead], rows)}`
}

const rifts = (locale: Locale, m: SiteMessages) => {
  const r = m.guide.rifts
  const places: Partial<Record<RiftLegend, { place: string }>> = LOCALES[locale].messages.rifts.domains
  const num = (v: number) => v.toLocaleString(m.lang.tag)
  const attacks = (id: keyof typeof ENEMIES) => bossAttacks(id, m)
  /** Latios fights in Latias's domain, so his row names hers. */
  const host = (id: RiftLegend) => (DOMAINS[id] ? id : RIFT_LEGENDS.find((l) => partnerOf(l) === id))
  const domain = (id: RiftLegend | typeof REAPER) => {
    const at = id === REAPER ? undefined : host(id)
    return (at && places[at]?.place) ?? r.endlessTitle
  }
  const battle = Math.round(Math.min(...Object.values(DOMAINS).map((d) => d.battleTime)) / 60)
  const rows = [...RIFT_LEGENDS, REAPER].map((id) => [
    bossName(locale, id),
    domain(id),
    html`${ENEMIES[id].types.map((type) => typeBadge(type, m))}`,
    num(id === REAPER ? reaperHp(0) : ENEMIES[id].hp),
    attacks(id),
  ])
  const bonus = (time: number) => runBonus({ time, kills: 0, victory: true, greed: 1 })
  const growth = Math.round((riftScale(RIFT.slots[0] + 60).hp - 1) * 100)
  return html`${paragraphs(r.paragraphs({ first: clock(RIFT.slots[0]), second: clock(RIFT.slots[1]), bossWait: RIFT.bossWait, portal: RIFT.portalTime, enter: RIFT.enterTime, battle, fallHp: Math.round(RIFT.fallHp * 100), shiny: Math.round(1 / RIFT.shinyOdds) }))}
    ${table([r.legendHead, r.domainHead, r.typesHead, r.hpHead, r.attacksHead], rows)}
    <p class="note">${r.hpNote(growth)}</p>
    <h3>${r.endlessTitle}</h3>
    ${paragraphs(
      r.endless({
        every: ENDLESS.eventEvery,
        reaper: clock(ENDLESS.reaperAt),
        hp: num(reaperHp(0)),
        returns: ENDLESS.reaperReturn / 60,
        perMinute: bonus(RUN_LENGTH + 60) - bonus(RUN_LENGTH),
        reaperBonus: num(ENDLESS.reaperBonus),
      }),
    )}`
}

/** The Legend mode: how each legend is captured (`game/capture.ts`) and what it plays with. */
const legends = (locale: Locale, m: SiteMessages) => {
  const g = m.guide.legends
  // A festival legend (Cresselia) is a surprise for now: its row comes with its festival's announcement.
  const rows = LEGEND_IDS.filter((id) => !legendFestival(id)).map((id) => [
    legendName(locale, id),
    g.where[legendSource(id)],
    String(LEGENDS[id].unlock.wins),
    ABILITIES[LEGENDS[id].innate.ability].name,
    MOVES[LEGENDS[id].signature].name,
  ])
  const names = LOCALES[locale].messages.difficulty.names
  const times = (v: number) => `${v.toLocaleString(m.lang.tag, { maximumFractionDigits: 2 })}x`
  const pressure = DIFFICULTY_IDS.map((id) => {
    const d = legendMods(id)
    return [names[id], times(d.enemyHp), times(d.enemyDamage), times(d.spawnRate), times(d.enemySpeed), times(d.ramp), times(d.healing)]
  })
  return html`${paragraphs(g.paragraphs({ count: REGULAR_LEGENDS.length, awaken: AWAKEN_AT }))}
    ${table([g.legendHead, g.whereHead, g.winsHead, g.innateHead, g.opensHead], rows)}
    <p>${g.eventNote}</p>
    <h3>${g.pressureTitle}</h3>
    <p>${g.pressure}</p>
    ${table(m.guide.run.difficultyHead, pressure)}`
}

/** The co-op scalings the guide's table lists, in its order (`COOP.scale`; the EXP split is in the prose). */
const COOP_SCALES = ['spawn', 'cap', 'hp', 'bossHp', 'coins'] as const satisfies readonly (keyof typeof COOP.scale)[]

const coop = (m: SiteMessages) => {
  const c = m.guide.coop
  const rows = COOP_SCALES.map((k) => [c.scale[k], `+${Math.round(COOP.scale[k] * 100)}%`])
  return html`${paragraphs(c.paragraphs({ players: COOP.maxPlayers, revive: COOP.revive.time, reviveHp: Math.round(COOP.revive.hp * 100), pick: COOP.pick.time, vote: COOP.voteTime }))}
    <h3>${c.scaleTitle}</h3>
    ${table([c.whatHead, c.perHead], rows)}`
}

const places = (locale: Locale, m: SiteMessages) => {
  const p = m.guide.places
  const num = (v: number) => v.toLocaleString(m.lang.tag)
  const pct = (v: number) => Math.round(v * 100)
  const rows = PLACE_IDS.map((id) => [
    p.names[id],
    p.seconds(PLACES[id].time),
    html`${PLACES[id].species.map((e) => html`<a class="with-mini" href="${dexLink(locale, ENEMIES[e].name)}" title="${ENEMIES[e].name}">${portrait(ENEMIES[e].dex)}</a>`)}`,
  ])
  const spiritomb = GRAVEYARD.boss
  const attacks = html`<ul class="list">${(BOSS_PATTERNS[spiritomb] ?? []).map((pt) => html`<li>${patternText(pt, m)}</li>`)}</ul>`
  return html`${paragraphs(p.paragraphs({ first: clock(PLACE.firstAt), every: PLACE.every / 60, bossWait: PLACE.bossWait, open: PLACE.openTime, enter: num(PLACE.enterTime), rescue: pct(PLACE.fallHp) }))}
    ${table([p.placeHead, p.timeHead, p.speciesHead], rows)}
    <h3>${p.names.cave}</h3>
    ${paragraphs(
      p.cave({
        floors: CAVE.floors,
        light: CAVE.light,
        fire: CAVE.fireLight,
        electric: CAVE.electricLight,
        time: PLACES.cave.time,
        wind: new Intl.ListFormat(m.lang.tag, { type: 'conjunction' }).format(CAVE.wind.map((s) => `${s}s`)),
        house: CAVE.monsterHouse,
        egg: pct(EGG_SOURCES.place.chance),
      }),
    )}
    <h3>${p.names.graveyard}</h3>
    ${paragraphs(
      p.graveyard({
        spirits: GRAVEYARD.spirits,
        time: PLACES.graveyard.time,
        shiny: Math.round(1 / GRAVEYARD.shinyOdds),
        hp: num(Math.round(ENEMIES[spiritomb].hp * placeBossScale(90).hp)),
        egg: pct(EGG_SOURCES.place.chance),
      }),
    )}
    ${table([m.guide.bosses.bossHead, m.guide.bosses.attacksHead], [[bossName(locale, spiritomb), attacks]])}
    <h3>${p.names.sky}</h3>
    ${paragraphs(p.sky({ time: PLACES.sky.time, tailwind: pct(SKY.tailwind - 1), every: SKY.wings.every, flock: SKY.flock.every }))}
    ${table([p.wingHead, p.effectHead], WING_IDS.map((id) => [WINGS[id].name, p.wings[id](wingAmount(id))]))}`
}

/** The map's landmarks: how often they stand, what each one is and what its treasure holds (`data/landmarks.ts`). */
const landmarks = (_locale: Locale, m: SiteMessages) => {
  const l = m.guide.landmarks
  const coins = (n: number) => `₽${(n * COIN_VALUES[1]).toLocaleString(m.lang.tag)}+`
  const rows = LANDMARK_IDS.map((id) => {
    const loot: LandmarkLoot | null = id in LANDMARK_LOOT ? LANDMARK_LOOT[id as TreasureLandmark] : null
    return [
      html`<b>${l.names[id]}</b>`,
      l.what[id],
      loot
        ? l.loot({ coins: coins(loot.coins), items: loot.drops.length, berries: loot.berries ?? 0, xp: Math.round((loot.xp ?? 0) * 100), egg: loot.egg ? Math.round(EGG_SOURCES.chest.chance * 100) : 0 })
        : l.noLoot,
    ]
  })
  return html`${paragraphs(l.paragraphs({ block: LANDMARK.block, odds: Math.round(LANDMARK.odds * 100), open: LANDMARK.openTime.toLocaleString(m.lang.tag), tunnel: TUNNEL.enterTime.toLocaleString(m.lang.tag) }))}
    ${table([l.placeHead, l.whatHead, l.lootHead], rows)}`
}

const megas = (locale: Locale, m: SiteMessages) => {
  const g = m.guide.megas
  const game = LOCALES[locale].messages
  const rows = MEGA_IDS.map((id) => {
    const def: MegaDef = MEGAS[id]
    const final = PLAYABLE[def.line].line.at(-1)!
    const special = SPECIALS[def.special]
    return [
      html`<span class="with-mini">${portrait(final.dex)}${def.name}</span>`,
      def.stone,
      html`<b>${def.ability}</b><br /><small>${game.mega.effects[id]}</small>`,
      html`${typeBadge(special.type, m)} <b>${special.final.name}</b><br /><small>${game.specials[def.special]}</small>`,
    ]
  })
  const twins = MEGA_LINES.filter((line) => megasOf(line).length > 1).map((line) => PLAYABLE[line].line.at(-1)!.name)
  const paras = g.paragraphs({
    lines: MEGA_LINES.length,
    twins: new Intl.ListFormat(m.lang.tag, { type: 'conjunction' }).format(twins),
    duration: MEGA.duration,
    recharge: MEGA.recharge,
    intro: MEGA.intro.toLocaleString(m.lang.tag),
  })
  return html`${paragraphs(paras)}
    ${table([g.megaHead, g.stoneHead, g.abilityHead, g.specialHead], rows)}`
}

const traits = (locale: Locale, m: SiteMessages) => {
  const t = m.guide.traits
  const rows = (Object.keys(ENEMIES) as EnemyId[]).flatMap((id) => {
    const { trait }: EnemyDef = ENEMIES[id]
    return trait ? [[bossName(locale, id), m.traits.names[trait], html`${traitText(trait, id, m)} <em>${m.traits.tips[trait]}</em>`]] : []
  })
  return html`${paragraphs(t.paragraphs(clock(stageStart(TRAIT_FROM)), TRAIT_CAP, TRAIT_ALIVE))}${table([t.pokemonHead, t.traitHead, t.effectHead], rows)}`
}

const shinies = (locale: Locale, m: SiteMessages) => {
  const s = m.guide.shinies
  return html`${paragraphs(s.paragraphs(Math.round(1 / SHINY_ODDS.enemy), SHINY_BUFF.hp, SHINY_BUFF.xp, Math.round(1 / SHINY_ODDS.player), Math.round(1 / RIFT.shinyOdds), gameDex().length))}
    <p><a class="btn-link" href="${ROUTES.pokedex[locale]}">★ ${s.seeAll}</a></p>`
}

const eggs = (locale: Locale, m: SiteMessages) => {
  const e = m.guide.eggs
  const tiers = LOCALES[locale].messages.eggs.tiers
  const num = (v: number) => v.toLocaleString(m.lang.tag)
  const pct = (v: number) => `${Math.round(v * 100)}%`
  const tierRows = EGG_TIER_IDS.map((tier) => [
    tiers[tier],
    num(EGG_TIERS[tier].steps),
    `₽${num(EGG_TIERS[tier].refund)}`,
    html`<span class="minis">${hatchPool(tier, {}).map(([id]) => html`<span class="with-mini">${portrait(HATCHLINGS[id].line[0].dex)}${HATCHLINGS[id].name}</span>`)}</span>`,
  ])
  const sourceRows = (Object.keys(EGG_SOURCES) as EggSource[]).map((source) => {
    const odds: Partial<Record<(typeof EGG_TIER_IDS)[number], number>> = EGG_SOURCES[source].odds
    const total = EGG_TIER_IDS.reduce((sum, tier) => sum + (odds[tier] ?? 0), 0)
    const rarity = EGG_TIER_IDS.flatMap((tier) => (odds[tier] ? [`${tiers[tier]} ${pct(odds[tier] / total)}`] : [])).join(' · ')
    // The field mission rolls its own odds per difficulty before the egg's.
    const chance = source === 'mission' ? DIFFICULTY_IDS.map((d) => pct(FIELD_TUNING[d].reward.egg)).join(' / ') : pct(EGG_SOURCES[source].chance)
    return [e.sources[source], chance, rarity]
  })
  const shop = LOCALES[locale].messages.shop
  const upgrades = e.incubator({
    max: MAX_SLOTS,
    slots: INCUBATOR.slots.map((s, i) => ({ n: EGGS.slots + i + 1, price: `₽${num(s.price)}`, level: shop.level(shop.levels[s.minLevel], s.minLevel) })),
    quick: `₽${num(INCUBATOR.quick.price)}`,
    speed: INCUBATOR.quick.speed,
  })
  const texts = e.paragraphs(STARTER_IDS.length, HATCHLING_IDS.length, EGGS.slots, EGGS.perRun, EGGS.stepPx, Math.round(1 / EGGS.shinyOdds), EGGS.newWeight)
  // The incubator's upgrades right after the paragraph about its slots.
  return html`${paragraphs([...texts.slice(0, 2), upgrades, ...texts.slice(2)])}
    ${table([e.sourceHead, e.chanceHead, e.oddsHead], sourceRows)}
    ${table([e.tierHead, e.stepsHead, e.refundHead, e.familiesHead], tierRows)}`
}

const items = (m: SiteMessages) => {
  const i = m.guide.items
  const sources = Object.keys(DROP_TABLES) as DropSource[]
  const drops = [...new Set(sources.flatMap((src) => DROP_TABLES[src].map((e) => e.drop)))]
  const nameOf = (drop: Drop) => (drop === 'oranBerry' ? 'Oran Berry' : CONSUMABLES[drop].name)
  const where = (drop: Drop) =>
    sources.filter((src) => DROP_TABLES[src].some((e) => e.drop === drop && Math.max(e.early, e.late) > 0)).map((src) => i.sources[src])
  // The jack-o'-lantern only stands in for a breakable during the Noite das Bruxas.
  const props = (Object.keys(PROPS) as Array<keyof typeof PROPS>).flatMap((id) => (id === 'pumpkin' ? [] : [[i.sources[id], PROPS[id].hp]]))
  return html`<p>${i.intro}</p>
    ${table([i.sourceHead, i.hitsHead], props)}
    <p class="note">${i.enemyNote(ENEMY_BERRY_CHANCE * 100, ENEMY_DROP_CHANCE * 100)}</p>
    ${table([i.itemHead, i.effectHead, i.whereHead], drops.map((d) => [nameOf(d), i.effects[d], where(d).join(', ')]))}`
}

const mapEvents = (m: SiteMessages) => {
  const e = m.guide.mapEvents
  const money = (coins: readonly number[]) => `₽${coins.reduce((a, b) => a + b, 0).toLocaleString(m.lang.tag)}`
  const rows = [
    [e.altar.name, e.altar.how, e.altar.reward(ALTAR.boost)],
    [e.fountain.name, e.fountain.how(FOUNTAIN.charges, FOUNTAIN.interval), e.fountain.reward(FOUNTAIN.heal * 100)],
    [e.chest.name, e.chest.how(CHEST.unlock), e.chest.reward(money(chestCoins(0)))],
    [e.spikes.name, e.spikes.how, e.spikes.reward],
    [e.bomb.name, e.bomb.how(BOMB.fuse), e.bomb.reward],
    [e.meowth.name, e.meowth.how(MAP_EVENTS.meowth.spawn.lifetime), e.meowth.reward(money(MEOWTH.jackpot))],
    [e.tutor.name, e.tutor.how(Math.round(TUTOR.first.from / 60), Math.round(TUTOR.first.until / 60)), e.tutor.reward(money([TUTOR.price]))],
    [e.field.name, e.field.how(formatTime(clearOfBosses(FIELD.first)), Math.round((FIELD.gap[0] + FIELD.gap[1]) / 120 * 2) / 2), e.field.reward],
  ]
  const gap = Math.round((DIRECTOR.gap[0] + DIRECTOR.gap[1]) / 2)
  return html`<p>${e.intro(DIRECTOR.first, gap, DIRECTOR.maxAlive)}</p>
    ${table([e.eventHead, e.howHead, e.rewardHead], rows)}`
}

const mart = (locale: Locale, m: SiteMessages) => {
  const k = m.guide.mart
  const game = LOCALES[locale].messages
  const bonus = (run: Partial<Parameters<typeof runBonus>[0]>) => runBonus({ time: 0, kills: 0, victory: false, greed: 1, ...run })
  const perKill = bonus({ kills: 1000 }) / 1000
  const rows = UPGRADE_IDS.map((id) => [
    UPGRADES[id].name,
    game.upgrades[id],
    Array.from({ length: UPGRADES[id].maxRank }, (_, r) => `₽${upgradePrice(id, r).toLocaleString(m.lang.tag)}`).join(' · '),
  ])
  return html`${paragraphs(k.paragraphs(COIN_VALUES, bonus({ time: 60 }), Math.round(1 / perKill), bonus({ victory: true })))}
    ${table([k.upgradeHead, k.effectHead, k.pricesHead], rows)}`
}

const missions = (locale: Locale, m: SiteMessages) => {
  const k = m.guide.missions
  const a = LOCALES[locale].messages.achievements
  const money = (v: number) => `₽${v.toLocaleString(m.lang.tag)}`
  const rewards = (pool: readonly MissionTemplate[]) => {
    const all = pool.flatMap((t) => t.tiers.map(([, reward]) => reward))
    return `${money(Math.min(...all))}–${money(Math.max(...all))}`
  }
  const medals = MEDALS.map((medal) => {
    const egg = MEDAL_EGG[medal]
    return `${k.medals[medal]} ${money(MEDAL_REWARD[medal])}${egg ? ` + ${LOCALES[locale].messages.eggs.tiers[egg]}` : ''}`
  }).join(', ')
  const goal = (id: AchievementId) => {
    const def: AchievementDef = ACHIEVEMENTS[id]
    if (def.stat === 'region') return a.region(REGIONS.find((r) => r.gen === def.gen)?.name ?? '')
    return a.goals[def.stat](def.stat === 'coins' ? money(def.target) : def.target.toLocaleString(m.lang.tag))
  }
  const titleOf = (id: AchievementId) => TITLE_IDS.find((t) => t === id)
  const rows = ACHIEVEMENT_IDS.map((id) => {
    const title = titleOf(id)
    return [a.names[id], k.medals[ACHIEVEMENTS[id].medal], goal(id), title ? a.titles[title] : '—']
  })
  return html`${paragraphs(k.paragraphs(MISSION_SLOTS.daily, MISSION_SLOTS.weekly, rewards(DAILY_POOL), rewards(WEEKLY_POOL), medals))}
    ${table([k.nameHead, k.medalHead, k.goalHead, k.titleHead], rows)}`
}

const settings = (m: SiteMessages) => {
  const s = m.guide.settings
  return html`${paragraphs(s.paragraphs)}${table([s.optionHead, s.effectHead], s.rows)}`
}

const SECTIONS: Record<Section, (locale: Locale, m: SiteMessages) => Html> = {
  controls: (_, m) => controls(m),
  run,
  world,
  horde,
  levels,
  moveEvolutions,
  special,
  types: (_, m) => types(m),
  bosses,
  traits,
  rifts,
  legends,
  coop: (_, m) => coop(m),
  places,
  landmarks,
  megas,
  shinies,
  eggs,
  items: (_, m) => items(m),
  mapEvents: (_, m) => mapEvents(m),
  mart,
  missions,
  settings: (_, m) => settings(m),
}

/** `/guia/`: how to play, with every number and table read from the game's data. */
export const guidePage = (locale: Locale) => {
  const m = SITE_MESSAGES[locale]
  const ids = Object.keys(SECTIONS) as Section[]
  const main = html`<div class="page-head">
    <h1>${m.guide.h1}</h1>
    <p class="lead">${m.guide.intro}</p>
  </div>
  <div class="doc">
    <nav class="toc box" aria-labelledby="toc-title">
      <h2 id="toc-title">${m.guide.toc}</h2>
      <ol>${ids.map((id) => html`<li><a href="#${slugOf(m.guide.sections[id])}">${m.guide.sections[id]}</a></li>`)}</ol>
    </nav>
    <div class="doc-body">
      ${ids.map(
        (id) => html`<section class="box doc-section" id="${slugOf(m.guide.sections[id])}" aria-labelledby="${slugOf(m.guide.sections[id])}-title">
        <h2 id="${slugOf(m.guide.sections[id])}-title">${m.guide.sections[id]}</h2>
        ${SECTIONS[id](locale, m)}
      </section>`,
      )}
      <p class="cta"><a class="btn-play" href="${ROUTES.play[locale]}">▶ ${m.guide.cta}</a></p>
    </div>
  </div>`
  return layout({ id: 'guide', locale, title: m.guide.title, description: m.guide.description }, main)
}

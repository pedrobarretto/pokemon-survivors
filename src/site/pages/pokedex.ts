import { BOSS_PATTERNS, BOSS_PHASES, bossKit, type BossPattern } from '../../data/bosses'
import { ENEMIES, type EnemyDef, type EnemyId } from '../../data/enemies'
import { RIFT, RIFT_LEGENDS } from '../../data/rifts'
import { TIERS } from '../../data/roster'
import { isSummoner, SUMMONS, TRAITS, type TraitId } from '../../data/traits'
import { SPIT_FLAVORS } from '../../game/spitters'
import { HATCHLINGS, isHatchling, PLAYABLE } from '../../data/hatchlings'
import { REGIONS, type PlayableDef } from '../../data/starters'
import { POKE_TYPES, TYPE_COLORS, type PokeType } from '../../data/types'
import { RUN_LENGTH } from '../../data/waves'
import { EVENT_LEGENDS, isLegend, LEGENDS, type LegendId, type LegendUnlock } from '../../data/legends'
import { BRANCHES, branchesAt, branchStage, familyDex } from '../../data/branches'
import { ABILITIES, isHidden, type AbilitySet } from '../../data/abilities'
import { abilitySet } from '../../game/abilities'
import { formLine } from '../../game/branch'
import { branchNeeds } from '../../game/evoItems'
import { EVO_ITEMS } from '../../data/shop'
import { unlockedAt } from '../../game/learnsets'
import { starterStats } from '../../game/leveling'
import { MOVES, type MoveId } from '../../game/moves'
import { resolveSpecial } from '../../game/special'
import { LOCALES, type Locale } from '../../i18n'
import { SITE_MESSAGES, type SiteMessages } from '../../i18n/site'
import { STAT_BARS, statRatio } from '../../ui/statBars'
import { html, type Html } from '../html'
import { layout } from '../layout'
import { appearances, clock, nightBossOf, pageOf, pokedex, ROLES, slugOf, spritesOf, type Appearance, type DexEntry, type Role, type SpriteSet } from '../pokedex'
import { absolute, dexPaths, ROUTES } from '../routes'
import { createSpriteCss, spriteScale } from '../spriteCss'

export type SpriteCss = ReturnType<typeof createSpriteCss>

const asset = (dex: number, file: string, shiny = false) => `/assets/pokemon/${dex}/${shiny ? 'shiny/' : ''}${file}`

const dexNo = (dex: number) => `#${String(dex).padStart(3, '0')}`

export const typeBadge = (type: PokeType, m: SiteMessages) =>
  html`<span class="type-badge" style="--type:${TYPE_COLORS[type]}">${m.types[type]}</span>`

/** Filter roles of a card: legendaries also count as bosses. */
const filterRoles = (role: Role): readonly Role[] => (role === 'legendary' ? ['boss', 'legendary'] : [role])

const sheetsOf = (dex: number) => {
  const { normal, shiny } = spritesOf(dex)
  return [normal, ...(shiny ? [shiny] : [])].flatMap((set) => [set.idle, set.walk])
}

/** Species drawn at the same zoom: a whole evolution line, so Charmeleon never looks smaller than Charmander. */
const family = (entry: DexEntry) => (entry.source.kind === 'starter' ? familyDex(entry.source.id) : [entry.dex])

/**
 * Up to four stacked sheets (idle/walk × normal/shiny); CSS shows one at a time.
 * Hidden sheets aren't fetched until shown, so walk and shiny cost nothing until asked for.
 */
const stage = (entry: DexEntry, css: SpriteCss, m: SiteMessages) => {
  const { normal, shiny } = entry.sprites
  const sets: Array<readonly [SpriteSet, boolean]> = [[normal, false], ...(shiny ? [[shiny, true] as const] : [])]
  const scale = spriteScale(family(entry).flatMap(sheetsOf))
  const layer = (set: SpriteSet, isShiny: boolean, anim: 'idle' | 'walk') =>
    html`<span class="sp sp-${isShiny ? 's' : ''}${anim === 'idle' ? 'i' : 'w'} ${css.classFor(set[anim], scale)}" style="background-image:url(${asset(entry.dex, anim === 'idle' ? 'Idle.png' : 'Walk.png', isShiny)})"></span>`
  return html`<div class="stage" role="img" aria-label="${m.pokedex.sprite(entry.name)}">${sets.map(([set, isShiny]) => [layer(set, isShiny, 'idle'), layer(set, isShiny, 'walk')])}</div>`
}

const statBars = (entry: DexEntry & { source: { kind: 'starter' } }, locale: Locale) => {
  const stats = starterStats(entry.source.id, entry.source.stage, entry.source.branch ?? null)
  const labels = LOCALES[locale].messages.stats
  return html`<dl class="bars">${STAT_BARS.map(
    (b) =>
      html`<div><dt>${labels[b.label]}</dt><dd><span class="bar"><i style="width:${Math.round(statRatio(b.get(stats), b.min, b.max) * 100)}%"></i></span><b>${b.fmt(b.get(stats))}</b></dd></div>`,
  )}</dl>`
}

const moveChip = (id: MoveId, m: SiteMessages) => html`<li style="--type:${TYPE_COLORS[MOVES[id].type]}" title="${m.types[MOVES[id].type]}">${MOVES[id].name}</li>`

/**
 * The learnset by stage: what the family starts with, then what each
 * evolution unlocks. At a branching stage the branch taken shows its own
 * moves; before one is taken, every branch gets a row.
 */
const learnRows = (source: DexEntry['source'] & { kind: 'starter' }, locale: Locale) => {
  const m = SITE_MESSAGES[locale]
  const s: PlayableDef = PLAYABLE[source.id]
  const branch = source.branch ?? null
  const row = (name: string, when: string, moves: readonly MoveId[]) =>
    moves.length > 0 && html`<dt>${name} <small>${when}</small></dt><dd><ul class="chips">${moves.map((mv) => moveChip(mv, m))}</ul></dd>`
  return html`<dl class="learn">${formLine(source.id, branch).map((st, k) => {
    const item = st.item ? ` · ${EVO_ITEMS[st.item].name}` : ''
    const when = k === 0 ? m.pokedex.learnStart : `${m.pokedex.evolvesAt(s.line[k - 1]!.evolveAt ?? 0)}${item}`
    const options = branch === null ? branchesAt(source.id, k) : []
    if (options.length === 0) return row(st.name, when, unlockedAt(source.id, branch, k))
    const shared = unlockedAt(source.id, null, k)
    return [
      row(options.length > 2 ? LOCALES[locale].messages.branch.choose(options.length) : options.map((b) => BRANCHES[b].name).join(' / '), when, shared),
      options.map((b) => {
        // A branch that needs an item names it beside the level.
        const item = branchNeeds(b)
        return row(BRANCHES[b].name, item ? `${when} · ${EVO_ITEMS[item].name}` : when, unlockedAt(source.id, b, k).filter((mv) => !shared.includes(mv)))
      }),
    ]
  })}</dl>`
}

/** A family's (or branch's) abilities, the Hidden one marked, with what each does in a run. */
const abilityList = (set: AbilitySet, locale: Locale) => {
  const a = LOCALES[locale].messages
  return html`<ul class="list">${set.map((id, i) => html`<li><b>${ABILITIES[id].name}</b>${isHidden(set, i) && html` <small>(${a.ability.hiddenLong})</small>`}: ${a.abilities[id]}</li>`)}</ul>
    <p class="note">${a.ability.note}</p>`
}

const starterBody = (entry: DexEntry & { source: { kind: 'starter' } }, locale: Locale) => {
  const m = SITE_MESSAGES[locale]
  const game = LOCALES[locale].messages
  const { id, stage: i, wild, branch = null } = entry.source
  const s: PlayableDef = PLAYABLE[id]
  const signature = MOVES[s.signature]
  const special = resolveSpecial(id, i, null, branch)
  const final = special.final
  const last = resolveSpecial(id, s.line.length - 1, null, branch)
  // A stage a branching evolution decides shows every branch it can take.
  const line = formLine(id, branch).map((st, k) => {
    const options = branchesAt(id, k)
    const forms = options.length > 0 ? options.map(branchStage) : [st]
    // A step that needs an item (Porygon2's Up-Grade) names it under the level.
    const item = st.item ? html`<br />${EVO_ITEMS[st.item].name}` : ''
    return html`${k > 0 && html`<li class="evo-arrow">${m.pokedex.evolvesAt(s.line[k - 1]!.evolveAt ?? 0)}${item}<br /><span aria-hidden="true">▶</span></li>`}<li>${forms.map(
      (f) => html`<a href="#${slugOf(f.name)}"${f.dex === entry.dex ? html` aria-current="true"` : ''}><img src="${asset(f.dex, 'portrait.png')}" width="40" height="40" loading="lazy" alt="" />${f.name}</a>`,
    )}</li>`
  })
  // A 2-stage line's second stage is already the final one.
  const stageName = m.pokedex.stageOf(i > 0 && i === s.line.length - 1 ? 2 : i)
  return html`<p class="blurb">${stageName} · ${game.blurbs[id]}</p>
    ${isHatchling(id) && html`<p class="note">${m.pokedex.hatchNote(game.eggs.tiers[HATCHLINGS[id].egg])}</p>`}
    <h3>${m.pokedex.stats}</h3>
    ${statBars(entry, locale)}
    <h3>${m.pokedex.evolution}</h3>
    <ol class="evo">${line}</ol>
    <h3>${m.pokedex.signature}</h3>
    <p class="move"><b>${signature.name}</b> ${typeBadge(signature.type, m)}<br />${game.moves[s.signature].description}</p>
    <h3>${m.pokedex.special}</h3>
    <p class="move"><b>${special.tier.name}</b> ${typeBadge(special.def.type, m)}${!final && html` <small>(${m.pokedex.specialFinal}: ${last.tier.name})</small>`}<br />${game.specials[special.id]}</p>
    <h3>${m.pokedex.learnset}</h3>
    ${learnRows(entry.source, locale)}
    <h3>${game.ability.section}</h3>
    ${abilityList(abilitySet(id, branch), locale)}
    ${wild && html`<h3>${m.pokedex.appears}</h3><ul class="list">${appearances(wild).map((a) => html`<li>${appearance(a, m)}</li>`)}</ul>`}`
}

export const appearance = (a: Appearance, m: SiteMessages) => {
  switch (a.kind) {
    case 'horde':
      return a.until >= RUN_LENGTH ? m.pokedex.hordeEnd(clock(a.from)) : m.pokedex.horde(clock(a.from), clock(a.until))
    case 'swarm':
      return m.pokedex.swarm(clock(a.at), a.count)
    case 'ring':
      return a.fixed ? m.pokedex.ringFixed(clock(a.at), a.count) : m.pokedex.ring(clock(a.at), a.count)
    case 'boss':
      return a.chance < 1 ? m.pokedex.bossChance(clock(a.at), a.chance * 100) : m.pokedex.boss(clock(a.at))
    case 'trio':
      return m.pokedex.trio(clock(a.at), m.trios.names[a.trio])
    case 'night':
      return m.pokedex.night(clock(a.at), a.chance * 100)
    case 'rift':
      return m.pokedex.rift(clock(a.from))
    case 'eventRift':
      return m.pokedex.eventRift(clock(a.from))
    case 'reaper':
      return m.pokedex.reaper(clock(a.at))
    case 'place':
      return a.boss ? m.pokedex.placeBoss(m.pokedex.places[a.place], clock(a.from)) : m.pokedex.place(m.pokedex.places[a.place], clock(a.from))
    case 'summoned':
      return m.pokedex.summoned(ENEMIES[a.by].name)
    case 'retinue':
      return m.pokedex.retinue(ENEMIES[a.by].name)
  }
}

/** What a trait does, with its numbers from `data/traits.ts`. `id` picks the summoner's summons. */
export const traitText = (trait: TraitId, id: keyof typeof ENEMIES, m: SiteMessages) => {
  const e = m.traits.effects
  switch (trait) {
    case 'healer':
      return e.healer(TRAITS.healer.every, TRAITS.healer.heal * 100)
    case 'shield':
      return e.shield(TRAITS.shield.every, TRAITS.shield.ward * 100, TRAITS.shield.duration)
    case 'summoner': {
      const names = isSummoner(id) ? [...new Set(SUMMONS[id].map((s) => ENEMIES[s].name))] : []
      return e.summoner(TRAITS.summoner.every, TRAITS.summoner.perCast, TRAITS.summoner.max, names)
    }
    case 'kamikaze':
      return e.kamikaze(TRAITS.kamikaze.fuse, TRAITS.kamikaze.damage, TRAITS.kamikaze.enemyDamage * 100)
    case 'beam':
      return e.beam(TRAITS.beam.aim, TRAITS.beam.damage)
    case 'leaper':
      return e.leaper(TRAITS.leaper.crouch + TRAITS.leaper.air, TRAITS.leaper.damage)
    case 'spitter':
      return e.spitter(SPIT_FLAVORS.orb.charge, TRAITS.spitter.damage)
  }
}

const attackText = (p: BossPattern, m: SiteMessages) => {
  switch (p.kind) {
    case 'strikes':
      if (p.target === 'self') return m.patterns.strikesSelf(p.every, p.damage)
      if (p.leap) return m.patterns.leap(p.every, p.damage)
      return p.lead !== undefined ? m.patterns.path(p.count, p.every, p.damage) : m.patterns.strikesPlayer(p.count, p.every, p.damage)
    case 'ring':
      return p.around !== undefined ? m.patterns.closing(p.count, p.every, p.damage) : m.patterns.ring(p.count, p.every, p.damage)
    case 'trail':
      return m.patterns.trail(p.ttl, p.damage)
    case 'volley':
      return m.patterns.volley(p.count, p.every, p.damage)
    case 'beam':
      return p.source === 'edge' ? m.patterns.lances(p.count, p.every, p.damage) : m.patterns.beam(p.count, p.every, p.damage)
    case 'dash':
      return m.patterns.dash(p.count, p.every, p.damage)
    case 'dive':
      return m.patterns.dive(p.every, p.damage)
    case 'teleport':
      return m.patterns.teleport(p.every, p.damage)
    case 'blast':
      return m.patterns.blast(p.safe, p.damage)
    case 'cage':
      return m.patterns.cage(p.every, p.damage)
    case 'summon':
      return m.patterns.summon(p.every)
    case 'swoop':
      return m.patterns.swoop(p.count, p.every, p.damage)
    case 'whirlpool':
      return m.patterns.whirlpool(p.count, p.every, p.damage)
    case 'gust':
      return m.patterns.gust(p.count, p.every, p.damage)
    case 'timeStop':
      return m.patterns.timeStop(p.every, p.duration)
    case 'phantoms':
      return m.patterns.phantoms(p.count, p.every, p.damage)
    case 'guard':
      return m.patterns.guard(new Intl.ListFormat(m.lang.tag, { type: 'conjunction' }).format(p.enemies.map((id) => ENEMIES[id].name)), p.every)
  }
}

/**
 * A boss's attacks for the guide and the Pokédex: a flat list, or for a boss
 * with phases (`BOSS_PHASES`) one list per phase with its ultimate's steps
 * (which come back with the ultimate, so they show its `every`).
 */
export const bossAttacks = (id: EnemyId, m: SiteMessages) => {
  const phases = BOSS_PHASES[id]
  if (!phases) return html`<ul class="list">${(BOSS_PATTERNS[id] ?? []).map((p) => html`<li>${patternText(p, m)}</li>`)}</ul>`
  return html`<ul class="list">${phases.map(
    (ph, i) => html`<li><b>${ph.rebirth !== undefined ? m.patterns.reborn(i, Math.round(ph.rebirth * 100)) : m.patterns.phase(i, Math.round(ph.below * 100))}</b><ul class="list">
      ${ph.patterns.map((p) => html`<li>${patternText(p, m)}</li>`)}
      ${ph.ultimate && html`<li>${m.patterns.ultimate(ph.ultimate.move, ph.ultimate.every)} ${ph.ultimate.steps.map((s) => patternText({ ...s.pattern, every: ph.ultimate!.every }, m)).join('; ')}</li>`}
    </ul></li>`,
  )}</ul>`
}

/** When a gated attack fires (`PatternGate`): keeping away, under some HP, on harder difficulties. */
const gateText = (p: BossPattern, m: SiteMessages) =>
  [p.far !== undefined && m.patterns.far, p.below !== undefined && m.patterns.below(Math.round(p.below * 100)), p.from !== undefined && m.patterns.from[p.from]].filter((s) => s !== false)

/** One boss attack, led by its stance when it only fires in one (`BossStance`) and followed by its gates. */
export const patternText = (p: BossPattern, m: SiteMessages) => {
  const gates = gateText(p, m)
  const text = gates.length > 0 ? `${attackText(p, m)}, ${gates.join(', ')}` : attackText(p, m)
  return p.stance ? `${m.patterns.stance[p.stance]}: ${text}` : text
}

/** A legendary's card: how it's captured for the Legend mode, its innate and the move it opens with (`data/legends.ts`). */
const legendSection = (id: LegendId, m: SiteMessages) => {
  const def = LEGENDS[id]
  const unlock: LegendUnlock = def.unlock
  const opener = MOVES[def.learnset[0][0]!]
  return html`<h3>${m.pokedex.legendMode}</h3>
    <ul class="list">
      <li>${unlock.event ? m.pokedex.captureEvent(unlock.wins) : unlock.last ? m.pokedex.captureLast : m.pokedex.capture(unlock.wins)}</li>
      <li>${m.pokedex.innate(ABILITIES[def.innate.ability].name)}</li>
      <li>${m.pokedex.opens(opener.name)} ${typeBadge(opener.type, m)}</li>
    </ul>
    <p class="note">★ ${m.pokedex.captureShiny}</p>`
}

const wildBody = (entry: DexEntry & { source: { kind: 'wild' } }, m: SiteMessages) => {
  const e: EnemyDef = ENEMIES[entry.source.id]
  const kit = bossKit(entry.source.id)
  // A species with a night boss (`HALLOWEEN.bosses`) shows that boss's attacks.
  const night = kit.length > 0 ? null : nightBossOf(entry.dex)
  const fights = night ?? entry.source.id
  const s = m.pokedex.wildStats
  const shiny = entry.sprites.shiny ? shinyNote(entry.source.id, kit.length > 0, m) : null
  return html`<dl class="facts">
      ${e.tier !== undefined && html`<div><dt>${m.roster.tier}</dt><dd>${e.tier}</dd></div>`}
      <div><dt>${s.hp}</dt><dd>${e.hp}</dd></div>
      <div><dt>${s.damage}</dt><dd>${e.damage}</dd></div>
      <div><dt>${s.speed}</dt><dd>${e.speed}</dd></div>
      <div><dt>${s.xp}</dt><dd>${e.xp}</dd></div>
    </dl>
    <p class="note">${m.pokedex.wildNote}</p>
    ${e.trait && html`<h3>${m.pokedex.behavior}</h3><p><b>${m.traits.names[e.trait]}.</b> ${traitText(e.trait, entry.source.id, m)}</p>`}
    <h3>${m.pokedex.appears}</h3>
    <ul class="list">${appearances(entry.source.id).map((a) => html`<li>${appearance(a, m)}</li>`)}</ul>
    ${bossKit(fights).length > 0 && html`<h3>${night ? m.pokedex.nightAttacks : m.pokedex.attacks}</h3>${bossAttacks(fights, m)}`}
    ${isLegend(entry.source.id) && legendSection(entry.source.id, m)}
    ${shiny && html`<p class="note">★ ${shiny}</p>`}`
}

/** How a wild card's shiny shows up: a rift legendary by the rift's odds, the map's bosses never, the horde at the wild odds. */
const shinyNote = (id: EnemyId, boss: boolean, m: SiteMessages) =>
  ([...RIFT_LEGENDS, ...EVENT_LEGENDS] as readonly EnemyId[]).includes(id) ? m.pokedex.riftShinyNote(Math.round(1 / RIFT.shinyOdds)) : boss ? null : m.pokedex.shinyNote

/** Horde tier of a wild card, for the tier filter. */
const tierOf = (entry: DexEntry) => {
  if (entry.source.kind !== 'wild') return undefined
  const def: EnemyDef = ENEMIES[entry.source.id]
  return def.tier
}

/** One species' card. `page` links its name to the Pokémon's own page: the Pokédex's cards do, that page's own cards don't. */
export const card = (entry: DexEntry, locale: Locale, css: SpriteCss, page?: string) => {
  const m = SITE_MESSAGES[locale]
  const { dex, name, slug, sprites, types, role, region } = entry
  const tier = tierOf(entry)
  return html`<article class="dex-card box role-${role}" id="${slug}" data-region="${region.name.toLowerCase()}" data-types="${types.join(' ')}" data-roles="${filterRoles(role).join(' ')}"${tier !== undefined ? html` data-tier="${tier}"` : ''} data-search="${slug} ${dex} ${String(dex).padStart(3, '0')}">
  <div class="card-top">
    <span class="dex-no">${dexNo(dex)}</span>
    <span class="role">${m.pokedex.roles[role]}</span>
    <span class="region">${region.name}</span>
    <a class="anchor" href="#${slug}" aria-label="${m.pokedex.link(name)}">#</a>
  </div>
  <div class="card-art">
    ${stage(entry, css, m)}
    ${sprites.portrait && html`<img class="portrait" src="${asset(dex, 'portrait.png')}"${sprites.shinyPortrait ? html` data-shiny-src="${asset(dex, 'portrait.png', true)}"` : ''} width="80" height="80" loading="lazy" alt="${m.pokedex.portrait(name)}" />`}
    ${sprites.shiny && html`<button class="shiny-btn" type="button" aria-pressed="false" aria-label="${m.pokedex.shinyToggle(name)}" title="${m.pokedex.shinyToggle(name)}">★</button>`}
  </div>
  <h2>${page ? html`<a href="${page}" title="${m.dexPage.page(name)}">${name}</a>` : name}</h2>
  <div class="types">${types.map((t) => typeBadge(t, m))}</div>
  ${entry.source.kind === 'starter' ? starterBody({ ...entry, source: entry.source }, locale) : entry.source.kind === 'wild' ? wildBody({ ...entry, source: entry.source }, m) : html`<p class="note">${entry.source.kind === 'companion' ? m.pokedex.companionNote : entry.source.kind === 'cameo' ? m.pokedex.cameoNote : entry.source.kind === 'arena' ? m.pokedex.arenaNote : entry.source.kind === 'lobby' ? m.pokedex.lobbyNote : m.pokedex.eventNote}</p>`}
</article>`
}

const filters = (entries: readonly DexEntry[], m: SiteMessages) => {
  const types = POKE_TYPES.filter((t) => entries.some((e) => e.types.includes(t)))
  return html`<form class="dex-filters" id="dex-filters" role="search" aria-label="${m.pokedex.filters}">
    <label class="field field-search">${m.pokedex.search}<input type="search" name="q" placeholder="${m.pokedex.searchPlaceholder}" autocomplete="off" /></label>
    <label class="field">${m.pokedex.region}<select name="region"><option value="">${m.pokedex.allRegions}</option>${REGIONS.map(
      (r) => html`<option value="${r.name.toLowerCase()}">${r.name}</option>`,
    )}</select></label>
    <label class="field">${m.pokedex.type}<select name="type"><option value="">${m.pokedex.all}</option>${types.map(
      (t) => html`<option value="${t}">${m.types[t]}</option>`,
    )}</select></label>
    <label class="field">${m.roster.tier}<select name="tier"><option value="">${m.roster.allTiers}</option>${TIERS.map(
      (t) => html`<option value="${t}">${m.roster.tierOf(t)}</option>`,
    )}</select></label>
    <fieldset class="roles"><legend>${m.pokedex.role}</legend>
      <label><input type="radio" name="role" value="" checked /><span>${m.pokedex.all}</span></label>
      ${ROLES.map((r) => html`<label><input type="radio" name="role" value="${r}" /><span>${m.pokedex.roleFilter[r]}</span></label>`)}
    </fieldset>
    <label class="shiny-all"><input type="checkbox" name="shiny" /><span>★ ${m.pokedex.shinyAll}</span></label>
    <p class="dex-count" aria-live="polite" data-one="${m.pokedex.results(1)}" data-other="${m.pokedex.results(2)}">${m.pokedex.results(entries.length)}</p>
  </form>
  <p class="dex-empty" hidden>${m.pokedex.empty} <button type="reset" form="dex-filters">${m.pokedex.clear}</button></p>`
}

/** `/pokedex/`: every Pokémon in the game, generated from `data/*`, with CSS-animated sprites and client-side filters. */
export const pokedexPage = (locale: Locale) => {
  const m = SITE_MESSAGES[locale]
  const entries = pokedex()
  const css = createSpriteCss()
  const pageUrl = (e: DexEntry) => {
    const page = pageOf(e)
    return page && dexPaths(page.slug)[locale]
  }
  const cards = entries.map((e) => card(e, locale, css, pageUrl(e)))
  const url = absolute(ROUTES.pokedex[locale])
  const main: Html = html`<div class="page-head">
    <h1>${m.pokedex.h1}</h1>
    <p class="lead">${m.pokedex.intro(entries.length)}</p>
    <p class="lead-link"><a href="${ROUTES.tierList[locale]}">★ ${m.pokedex.tierLink} →</a></p>
  </div>
  ${filters(entries, m)}
  <div class="dex-grid">${cards}</div>`
  return layout(
    {
      id: 'pokedex',
      locale,
      title: m.pokedex.title,
      description: m.pokedex.description,
      css: css.css(),
      schema: [
        {
          '@type': 'ItemList',
          '@id': `${url}#list`,
          name: m.pokedex.h1,
          numberOfItems: entries.length,
          itemListElement: entries.map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: e.name, url: absolute(`${pageUrl(e) ?? ROUTES.pokedex[locale]}#${e.slug}`) })),
        },
      ],
    },
    main,
  )
}

import { branchesAt, branchesOf, branchStage } from '../../data/branches'
import { HATCHLINGS, isHatchling, isStarter, PLAYABLE, type PlayableId } from '../../data/hatchlings'
import { LEGEND_IDS, LEGENDS, type LegendId, type LegendUnlock } from '../../data/legends'
import { MEGAS, megasOf } from '../../data/megas'
import { STARTER_IDS, type PlayableDef } from '../../data/starters'
import { formLine } from '../../game/branch'
import { branchNeeds } from '../../game/evoItems'
import { MOVES } from '../../game/moves'
import { LOCALES, type Locale } from '../../i18n'
import { SITE_MESSAGES, type SiteMessages } from '../../i18n/site'
import { html, type Html } from '../html'
import { layout } from '../layout'
import { appearances, dexPages, type DexEntry, type DexPage } from '../pokedex'
import { dexPaths, ROUTES } from '../routes'
import { createSpriteCss } from '../spriteCss'
import { appearance, card } from './pokedex'

/** A question and its answer, shown on the page and repeated in its `FAQPage` JSON-LD. */
type Qa = { q: string; a: string }

/** What a family's page and its search snippet are called: its stages, or the first one "and its evolutions" past three (Eevee). */
const namesOf = (page: DexPage, m: SiteMessages) => {
  const names = page.entries.map((e) => e.name)
  return names.length > 3 ? [m.dexPage.family(names[0]!)] : names
}

const typesOf = (entry: DexEntry, m: SiteMessages) => entry.types.map((t) => m.types[t])

/** Each evolution of a line: the form (or the forms a branching one picks from) and its level. */
const evolutionSteps = (id: PlayableId, m: SiteMessages) => {
  const s: PlayableDef = PLAYABLE[id]
  return s.line.slice(1).map((stage, i) => {
    const options = branchesAt(id, i + 1)
    const names = options.length > 0 ? options.map((b) => branchStage(b).name) : [stage.name]
    return m.dexPage.step(names, s.line[i]!.evolveAt ?? 0)
  })
}

const familyFaq = (id: PlayableId, base: DexEntry, m: SiteMessages, locale: Locale): Qa[] => {
  const name = base.name
  const game = LOCALES[locale].messages
  const steps = evolutionSteps(id, m)
  const needsItem = formLine(id, null).some((st) => st.item) || branchesOf(id).some((b) => branchNeeds(b))
  const megas = megasOf(id).map((mega) => MEGAS[mega].name)
  const unlock = isHatchling(id) ? m.dexPage.eggA(name, game.eggs.tiers[HATCHLINGS[id].egg]) : m.dexPage.starterA(name)
  return [
    { q: m.dexPage.unlockQ(name), a: unlock },
    ...(steps.length > 0 ? [{ q: m.dexPage.evolveQ(name), a: `${m.dexPage.evolveA(steps)}${needsItem ? ` ${m.dexPage.evolveItem}` : ''}` }] : []),
    { q: m.dexPage.signatureQ(name), a: m.dexPage.signatureA(name, MOVES[PLAYABLE[id].signature].name) },
    ...(megas.length > 0 ? [{ q: m.dexPage.megaQ(name), a: m.dexPage.megaA(megas) }] : []),
  ]
}

const legendFaq = (id: LegendId, entry: DexEntry, m: SiteMessages): Qa[] => {
  const def = LEGENDS[id]
  const rule: LegendUnlock = def.unlock
  const unlock = rule.last ? m.pokedex.captureLast : m.pokedex.capture(rule.wins)
  const form = 'form' in def ? m.dexPage.awakens(def.form.name) : ''
  const where = entry.source.kind === 'wild' ? appearances(entry.source.id).map((a) => appearance(a, m)) : []
  return [
    { q: m.dexPage.catchQ(entry.name), a: [unlock, form, m.pokedex.captureShiny].filter(Boolean).join(' ') },
    ...(where.length > 0 ? [{ q: m.dexPage.whereQ(entry.name), a: `${where.join('; ')}.` }] : []),
  ]
}

/** The page's opening: what the Pokémon is in the game, in one sentence, then its blurb from the game. */
const intro = (page: DexPage, m: SiteMessages, locale: Locale) => {
  const base = page.entries[0]!
  const blurb = LOCALES[locale].messages.blurbs[page.id]
  if (page.kind === 'legend') return `${m.dexPage.legend(base.name, typesOf(base, m), LEGEND_IDS.length)} ${blurb}`
  const what = isStarter(page.id) ? m.dexPage.starter(base.name, typesOf(base, m), base.region.name, STARTER_IDS.length) : m.dexPage.egg(base.name, typesOf(base, m))
  return `${what} ${blurb}`
}

const megaSection = (id: PlayableId, m: SiteMessages) => {
  const megas = megasOf(id)
  return (
    megas.length > 0 &&
    html`<section class="box doc-section"><h2>${m.dexPage.mega}</h2><ul class="list">${megas.map(
      (mega) => html`<li><b>${MEGAS[mega].name}</b>: ${m.dexPage.megaLine(MEGAS[mega].stone, MEGAS[mega].ability)}</li>`,
    )}</ul></section>`
  )
}

/** Links to every other Pokémon page, by group, so each page leads to the rest. */
const others = (current: DexPage, locale: Locale, m: SiteMessages) => {
  const group = (p: DexPage) => (p.kind === 'legend' ? 'legendary' : isStarter(p.id) ? 'starter' : 'egg')
  const groups = (['starter', 'egg', 'legendary'] as const).map((g) => ({ g, pages: dexPages().filter((p) => group(p) === g) }))
  return html`<nav class="box doc-section dex-others" aria-label="${m.dexPage.others}">
    <h2>${m.dexPage.others}</h2>
    ${groups.map(
      ({ g, pages }) => html`<h3>${m.dexPage.groups[g]}</h3><p>${pages.map(
        (p, i) => html`${i > 0 && ' · '}<a href="${dexPaths(p.slug)[locale]}"${p === current ? html` aria-current="page"` : ''}>${p.entries[0]!.name}</a>`,
      )}</p>`,
    )}
    <p><a class="btn-link" href="${ROUTES.pokedex[locale]}">★ ${m.dexPage.back}</a></p>
  </nav>`
}

/** `/pokedex/<slug>/`: one Pokémon's page, its cards from the Pokédex and the answers people search for, generated from `data/*`. */
export const dexPage = (page: DexPage, locale: Locale) => {
  const m = SITE_MESSAGES[locale]
  const base = page.entries[0]!
  const names = page.kind === 'legend' ? [base.name] : namesOf(page, m)
  const css = createSpriteCss()
  const faq = page.kind === 'legend' ? legendFaq(page.id, base, m) : familyFaq(page.id, base, m, locale)
  const play = page.kind === 'legend' ? m.playCta : m.dexPage.play(base.name)
  const main: Html = html`<div class="page-head">
    <h1>${m.dexPage.h1(names)}</h1>
    <p class="lead">${intro(page, m, locale)}</p>
  </div>
  <p class="cta"><a class="btn-play" href="${ROUTES.play[locale]}">▶ ${play}</a></p>
  <div class="dex-grid">${page.entries.map((e) => card(e, locale, css))}</div>
  <div class="doc-body narrow dex-page">
    ${page.kind === 'family' && megaSection(page.id, m)}
    <section class="box doc-section"><h2>${m.dexPage.faq}</h2>${faq.map(({ q, a }) => html`<h3>${q}</h3><p>${a}</p>`)}</section>
    ${others(page, locale, m)}
  </div>`
  return layout(
    {
      id: 'pokedex',
      locale,
      title: page.kind === 'legend' ? m.dexPage.legendTitle(base.name) : m.dexPage.title(names),
      description: page.kind === 'legend' ? m.dexPage.legendDescription(base.name) : m.dexPage.description(base.name, MOVES[PLAYABLE[page.id].signature].name),
      css: css.css(),
      sub: { name: names.join(', '), paths: dexPaths(page.slug) },
      schema: [
        {
          '@type': 'FAQPage',
          mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
        },
      ],
    },
    main,
  )
}

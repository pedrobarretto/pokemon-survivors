import { PLAYABLE } from '../../data/hatchlings'
import { TIER_SNAPSHOT } from '../../data/tierRuns'
import { LOCALES, type Locale } from '../../i18n'
import { SITE_MESSAGES, type SiteMessages } from '../../i18n/site'
import { html, type Html } from '../html'
import { layout } from '../layout'
import { dexPages } from '../pokedex'
import { absolute, dexPaths, ROUTES } from '../routes'
import { currentTierList, TIER_DIFFICULTIES, TIER_RULES, TIERS, type FamilyId, type RankedFamily, winPercent } from '../tierList'

const nameOf = (id: FamilyId) => PLAYABLE[id].line[0].name

/** A family's Pokémon page (`/pokedex/<slug>/`) in `locale`. */
const familyUrl = (id: FamilyId, locale: Locale) => {
  const page = dexPages().find((p) => p.kind === 'family' && p.id === id)
  return page ? dexPaths(page.slug)[locale] : ROUTES.pokedex[locale]
}

const portrait = (id: FamilyId, size: number) =>
  html`<img src="/assets/pokemon/${PLAYABLE[id].line[0].dex}/portrait.png" width="${size}" height="${size}" loading="lazy" alt="" />`

const longDate = (iso: string, m: SiteMessages) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(m.lang.tag, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

const mon = (id: FamilyId, locale: Locale) =>
  html`<li><a href="${familyUrl(id, locale)}">${portrait(id, 48)}<span>${nameOf(id)}</span></a></li>`

/** The board: one row per tier, best first, then the families still short of runs. */
const board = (locale: Locale, m: SiteMessages) => {
  const list = currentTierList()
  return html`<ol class="tier-board" aria-label="${m.tierList.tiers}">
    ${TIERS.map(
      (tier) => html`<li class="tier-row tier-${tier}">
        <p class="tier-label" title="${m.tierList.tier(tier)}">${tier}</p>
        <ul class="tier-mons">${list.ranked.filter((f) => f.tier === tier).map((f) => mon(f.id, locale))}</ul>
      </li>`,
    )}
    ${list.unranked.length > 0 &&
    html`<li class="tier-row tier-none">
      <p class="tier-label" title="${m.tierList.noData}">?</p>
      <div><ul class="tier-mons">${list.unranked.map((f) => mon(f.id, locale))}</ul><p class="tier-none-note">${m.tierList.noDataNote(TIER_RULES.minRuns)}</p></div>
    </li>`}
  </ol>`
}

/** Every ranked family's numbers: tier, score, win % and runs per difficulty, average minute. */
const numbers = (locale: Locale, m: SiteMessages) => {
  const { ranked } = currentTierList()
  const fmt = (v: number, digits: number) => v.toLocaleString(m.lang.tag, { minimumFractionDigits: digits, maximumFractionDigits: digits })
  const difficulty = LOCALES[locale].messages.difficulty.names
  const h = m.tierList.head
  const row = (f: RankedFamily, i: number) => html`<tr>
    <td>${i + 1}</td>
    <th scope="row"><a class="with-mini" href="${familyUrl(f.id, locale)}">${portrait(f.id, 32)}${nameOf(f.id)}</a></th>
    <td><span class="tier-chip tier-${f.tier}">${f.tier}</span></td>
    <td>${fmt(f.score, 2)}×</td>
    ${TIER_DIFFICULTIES.map((d) => html`<td>${winPercent(f.cells[d])}% <small>(${f.cells[d].runs.toLocaleString(m.lang.tag)})</small></td>`)}
    <td>${fmt(f.minute, 1)}</td>
  </tr>`
  return html`<div class="table-wrap tier-table"><table>
    <thead><tr>
      <th scope="col">${h.rank}</th><th scope="col">${h.pokemon}</th><th scope="col">${h.tier}</th><th scope="col">${h.score}</th>
      ${TIER_DIFFICULTIES.map((d) => html`<th scope="col">${difficulty[d]}</th>`)}
      <th scope="col">${h.minute}</th>
    </tr></thead>
    <tbody>${ranked.map(row)}</tbody>
  </table></div>`
}

/** The family most played on Normal, for the selection-bias caveat. */
const mostPlayed = () => {
  const { ranked } = currentTierList()
  return ranked.reduce((top, f) => (f.cells.normal.runs > top.cells.normal.runs ? f : top), ranked[0]!)
}

/**
 * `/tier-list/`: the starters and egg families from S to D, ranked from real
 * runs (`site/tierList.ts`, snapshot in `data/tierRuns.ts`), with every
 * family's numbers, the method and its caveats. The intro names the current
 * top picks from the data, so it stays true as the snapshot is refreshed.
 */
export const tierListPage = (locale: Locale) => {
  const m = SITE_MESSAGES[locale]
  const list = currentTierList()
  const top = list.ranked.slice(0, 3).map((f) => nameOf(f.id))
  const popular = mostPlayed()
  const percent = (w: number) => Math.round(w * 100)
  const method = m.tierList.method({
    days: TIER_SNAPSHOT.days,
    runs: list.runs,
    prior: TIER_RULES.prior,
    minRuns: TIER_RULES.minRuns,
    weights: { normal: percent(TIER_RULES.weights.normal), hard: percent(TIER_RULES.weights.hard), nightmare: percent(TIER_RULES.weights.nightmare) },
    cuts: TIER_RULES.cuts,
  })
  const url = absolute(ROUTES.tierList[locale])
  const main: Html = html`<div class="page-head">
    <h1>${m.tierList.h1}</h1>
    <p class="lead">${m.tierList.best(top, list.runs, TIER_SNAPSHOT.days)}</p>
    <p class="lead">${m.tierList.intro}</p>
    <p class="tier-updated"><time datetime="${TIER_SNAPSHOT.date}">${m.tierList.updated(longDate(TIER_SNAPSHOT.date, m), TIER_SNAPSHOT.days)}</time></p>
  </div>
  ${board(locale, m)}
  <p class="cta"><a class="btn-play" href="${ROUTES.play[locale]}">▶ ${m.playCta}</a></p>
  <div class="doc-body narrow">
    <section class="box doc-section"><h2>${m.tierList.tableTitle}</h2><p>${m.tierList.tableNote}</p>${numbers(locale, m)}</section>
    <section class="box doc-section"><h2>${m.tierList.methodTitle}</h2>${method.map((p) => html`<p>${p}</p>`)}</section>
    <section class="box doc-section"><h2>${m.tierList.caveatsTitle}</h2><ul class="tier-caveats">${m.tierList
      .caveats(nameOf(popular.id), popular.cells.normal.runs)
      .map((c) => html`<li>${c}</li>`)}</ul></section>
  </div>`
  return layout(
    {
      id: 'tierList',
      locale,
      title: m.tierList.title,
      description: m.tierList.description,
      schema: [
        {
          '@type': 'ItemList',
          '@id': `${url}#list`,
          name: m.tierList.h1,
          itemListOrder: 'https://schema.org/ItemListOrderDescending',
          numberOfItems: list.ranked.length,
          itemListElement: list.ranked.map((f, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: `${nameOf(f.id)} (${m.tierList.tier(f.tier)})`,
            url: absolute(familyUrl(f.id, locale)),
          })),
        },
      ],
    },
    main,
  )
}

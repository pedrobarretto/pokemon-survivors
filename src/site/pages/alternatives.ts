import type { Locale } from '../../i18n'
import { SITE_MESSAGES } from '../../i18n/site'
import { html } from '../html'
import { layout } from '../layout'
import { OURS, RIVALS, RIVALS_CHECKED, type RivalId } from '../rivals'
import { absolute, ROUTES } from '../routes'
import { faqBody, faqSchema, longDate } from './compare'

type GameId = 'ours' | RivalId

/** The list's order: ours first (the page says so), then the closest to it. */
const ORDER = ['ours', 'pokesurvivor', 'burst', 'pokerogue'] as const satisfies readonly GameId[]

/** A game's name, maker and link: ours is this site, the others come from `RIVALS`. */
const gameOf = (id: GameId, locale: Locale) =>
  id === 'ours' ? { name: 'Pokémon Survivors', maker: 'Pedro Barretto', url: absolute(ROUTES.play[locale]), ours: true } : { ...RIVALS[id], ours: false }

/**
 * `/pokemon-games-like-vampire-survivors/`: the Pokémon survivors-likes (and
 * PokeRogue, the best-known Pokémon roguelite) in one list, ours first with the
 * bias said out loud, for the "pokemon vampire survivors" and "games like
 * PokéSurvivor" searches. An ItemList schema names each game.
 */
export const alternativesPage = (locale: Locale) => {
  const m = SITE_MESSAGES[locale]
  const a = m.alternatives
  const g = a.glance
  const faq = a.faq.items(OURS)
  const facts = (id: GameId) => {
    const t = a.games[id]
    return {
      ...t,
      roster: typeof t.roster === 'function' ? t.roster(OURS) : t.roster,
      about: typeof t.about === 'function' ? t.about(OURS) : t.about,
    }
  }
  // `data-label` names each cell where a phone stacks the table (site.css).
  const glance = html`<div class="table-wrap stack-table"><table>
      <thead><tr><th scope="col">${g.game}</th><th scope="col">${g.plays}</th><th scope="col">${g.style}</th><th scope="col">${g.coop}</th><th scope="col">${g.roster}</th></tr></thead>
      <tbody>${ORDER.map((id) => {
        const f = facts(id)
        return html`<tr><th scope="row"><a href="#${id}">${gameOf(id, locale).name}</a></th><td data-label="${g.plays}">${f.plays}</td><td data-label="${g.style}">${f.style}</td><td data-label="${g.coop}">${f.coop}</td><td data-label="${g.roster}">${f.roster}</td></tr>`
      })}</tbody>
    </table></div>`
  const entry = (id: GameId, i: number) => {
    const game = gameOf(id, locale)
    const f = facts(id)
    const link = game.ours ? html`<a class="btn-play" href="${ROUTES.play[locale]}">▶ ${a.cta}</a>` : html`<a class="btn-link" href="${game.url}" rel="nofollow noopener">${a.visit(game.name)}</a>`
    return html`<section class="box doc-section" id="${id}" aria-labelledby="${id}-title">
      <h2 id="${id}-title">${i + 1}. ${game.name}</h2>
      <dl class="defs"><dt>${a.madeBy}</dt><dd>${game.maker}</dd><dt>${g.plays}</dt><dd>${f.plays}</dd><dt>${g.coop}</dt><dd>${f.coop}</dd></dl>
      ${f.about.map((p) => html`<p>${p}</p>`)}
      <p><b>${a.bestFor}:</b> ${f.bestFor}</p>
      <p>${link}</p>
    </section>`
  }
  const list = {
    '@type': 'ItemList',
    name: a.h1,
    itemListElement: ORDER.map((id, i) => {
      const game = gameOf(id, locale)
      return { '@type': 'ListItem', position: i + 1, item: { '@type': 'VideoGame', name: game.name, url: game.url, author: game.maker } }
    }),
  }
  const main = html`<div class="page-head"><h1>${a.h1}</h1><p class="lead">${a.lead}</p></div>
  <div class="doc-body narrow">
    <p class="note">${a.disclosure(longDate(RIVALS_CHECKED, m))}</p>
    <section class="box doc-section" id="glance" aria-labelledby="glance-title"><h2 id="glance-title">${g.title}</h2>${glance}</section>
    ${ORDER.map(entry)}
    <section class="box doc-section" id="faq" aria-labelledby="faq-title"><h2 id="faq-title">${a.faq.title}</h2>${faqBody(faq)}</section>
    <p><a class="btn-link" href="${ROUTES.compare[locale]}">★ ${a.compareLink}</a></p>
  </div>`
  return layout({ id: 'alternatives', locale, title: a.title, description: a.description, schema: [list, faqSchema(faq)] }, main)
}

import type { Locale } from '../../i18n'
import { SITE_MESSAGES, type SiteMessages } from '../../i18n/site'
import { html, type Html } from '../html'
import { layout } from '../layout'
import { OURS, RIVALS, RIVALS_CHECKED } from '../rivals'
import { REPO_URL, ROUTES } from '../routes'

type Faq = readonly { q: string; a: string }[]

/** `2026-10-28` as the page's language writes it. */
export const longDate = (iso: string, m: SiteMessages) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(m.lang.tag, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

const section = (id: string, title: string, body: Html) =>
  html`<section class="box doc-section" id="${id}" aria-labelledby="${id}-title"><h2 id="${id}-title">${title}</h2>${body}</section>`

/** Questions as `<h3>` + answer, the same text the FAQPage schema carries. */
export const faqBody = (faq: Faq) => faq.map((f) => html`<h3>${f.q}</h3><p>${f.a}</p>`)

/** schema.org FAQPage of `faq`, for answer engines that quote Q&A. */
export const faqSchema = (faq: Faq) => ({
  '@type': 'FAQPage',
  mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
})

/**
 * `/pokemon-survivors-vs-pokesurvivor/`: answers the "are they the same game?"
 * that search engines and AI chats get wrong, then sets both games side by side,
 * names the look-alikes and says who each one suits. Facts about PokéSurvivor
 * are dated (`RIVALS_CHECKED`), ours come from the data (`OURS`).
 */
export const comparePage = (locale: Locale) => {
  const m = SITE_MESSAGES[locale]
  const c = m.compare
  const them = RIVALS.pokesurvivor
  const faq = c.faq.items(OURS)
  const table = html`<div class="table-wrap stack-table"><table>
      <thead><tr><th scope="col">${c.table.feature}</th><th scope="col">Pokémon Survivors</th><th scope="col">${them.name}</th></tr></thead>
      <tbody>${c.rows(OURS).map(([label, ours, theirs]) => html`<tr><th scope="row">${label}</th><td>${ours}</td><td>${theirs}</td></tr>`)}</tbody>
    </table></div>`
  const names = html`<dl class="defs">${c.names.items.map((n) => html`<dt>${n.name}</dt><dd>${n.text}</dd>`)}</dl>`
  const main = html`<div class="page-head"><h1>${c.h1}</h1>${c.lead.map((p) => html`<p class="lead">${p}</p>`)}</div>
  <div class="doc-body narrow">
    ${section('side-by-side', c.table.title, table)}
    ${section('names', c.names.title, names)}
    ${section('pick-ours', c.pickOurs.title, html`<ul>${c.pickOurs.items(OURS).map((i) => html`<li>${i}</li>`)}</ul>`)}
    ${section('pick-theirs', c.pickTheirs.title, html`<ul>${c.pickTheirs.items.map((i) => html`<li>${i}</li>`)}</ul><p><a href="${them.url}" rel="nofollow noopener">${them.url}</a></p>`)}
    ${section('faq', c.faq.title, html`${faqBody(faq)}`)}
    <p class="note">${c.checked(longDate(RIVALS_CHECKED, m))} <a href="${REPO_URL}/issues">${c.report}</a></p>
    <p><a class="btn-link" href="${ROUTES.alternatives[locale]}">★ ${c.alternatives}</a></p>
    <p class="cta"><a class="btn-play" href="${ROUTES.play[locale]}">▶ ${c.cta}</a></p>
  </div>`
  return layout({ id: 'compare', locale, title: c.title, description: c.description, schema: [faqSchema(faq)] }, main)
}

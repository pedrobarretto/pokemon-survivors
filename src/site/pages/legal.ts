import type { Locale } from '../../i18n'
import { SITE_MESSAGES } from '../../i18n/site'
import { html, type Html } from '../html'
import { layout } from '../layout'
import { TRANSLATORS } from '../../data/translators'
import { REPO_URL, ROUTES } from '../routes'

const section = (id: string, title: string, body: Html) =>
  html`<section class="box doc-section" id="${id}" aria-labelledby="${id}-title"><h2 id="${id}-title">${title}</h2>${body}</section>`

const paragraphs = (texts: readonly string[]) => texts.map((t) => html`<p>${t}</p>`)

/** `/legal/`: fan-game disclaimer, the Arena gems' terms, licenses and credits, privacy (localStorage, optional accounts) and takedown contact. */
export const legalPage = (locale: Locale) => {
  const m = SITE_MESSAGES[locale]
  const l = m.legal
  const s = l.sections
  const licenses = html`<dl class="defs">
      <dt>${l.licenses.code}</dt><dd>${l.licenses.codeText} <a href="${REPO_URL}/blob/main/LICENSE">LICENSE</a></dd>
      <dt>${l.licenses.sprites}</dt><dd>${l.licenses.spritesText} <a href="https://sprites.pmdcollab.org">PMD SpriteCollab</a> · <a href="https://creativecommons.org/licenses/by-nc/4.0/">CC BY-NC 4.0</a></dd>
      <dt>${l.licenses.cries}</dt><dd><a href="https://github.com/PokeAPI/cries">${l.licenses.criesText}</a></dd>
      <dt>${l.licenses.fonts}</dt><dd>${l.licenses.fontsText} <a href="https://openfontlicense.org">OFL</a></dd>
      <dt>${l.licenses.translation}</dt><dd>${TRANSLATORS.map(
        // `?u=` opens their public profile (`PROFILE_PARAM` in ranking.ts, which the build can't import: it pulls the account shell in).
        (tr) => html`${l.licenses.reviewedBy(l.licenses.languages[tr.locale], tr.name, tr.discord)} <a href="${ROUTES.play[tr.locale]}?u=${tr.handle}">@${tr.handle}</a>`,
      )}</dd>
      <dt>${l.licenses.inspiration}</dt><dd><a href="https://poncle.itch.io/vampire-survivors">${l.licenses.inspirationText}</a></dd>
    </dl>
    <p class="note">${l.licenses.nonCommercial}</p>
    <p><a class="btn-link" href="${REPO_URL}/blob/main/CREDITS.md">${l.licenses.creditsLink}</a></p>`
  const privacy = html`${paragraphs(l.privacy)}
    <dl class="defs">${Object.entries(l.storage).map(([key, text]) => html`<dt><code>${key}</code></dt><dd>${text}</dd>`)}</dl>
    ${paragraphs(l.account)}
    ${paragraphs(l.privacyAfter)}`
  const contact = html`${paragraphs(l.contact)}
    <p class="links"><a class="btn-link" href="${REPO_URL}/issues">${l.issues}</a> <a class="btn-link" href="${REPO_URL}">${l.source}</a></p>`
  const main = html`<div class="page-head"><h1>${l.h1}</h1></div>
  <div class="doc-body narrow">
    ${section('fan-game', s.fanGame, html`${paragraphs(l.fanGame)}`)}
    ${section('free', s.free, html`${paragraphs(l.free)}`)}
    ${section('gems', s.gems, html`${paragraphs(l.gems)}`)}
    ${section('licenses', s.licenses, licenses)}
    ${section('privacy', s.privacy, privacy)}
    ${section('contact', s.contact, contact)}
  </div>`
  return layout({ id: 'legal', locale, title: l.title, description: l.description }, main)
}

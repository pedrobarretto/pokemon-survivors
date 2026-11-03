import { DONATION } from '../../data/donations'
import { PATREON_URL } from '../../data/supporters'
import type { Locale } from '../../i18n'
import { SITE_MESSAGES } from '../../i18n/site'
import { html, raw } from '../html'
import { layout } from '../layout'
import { STRIPE_DONATION_URL } from '../routes'

/**
 * `/apoie/`: the monthly tiers on Patreon (`PATREON_URL`) up top, then one-time
 * donations, two ways side by side. From Brazil, a preset or any
 * amount in reais opens an AbacatePay checkout (Pix or card) through the API;
 * from elsewhere, the Stripe Payment Link (card, Apple Pay, Google Pay in US$).
 * Portuguese lists Brazil first; `client.ts` reorders by the device's time zone
 * and wires the form. Above them, the @ of the account that gets the rewards
 * (filled from the game's `?u=` or this browser's account); under them, what
 * donors get and the supporters' wall. Both checkouts come back with
 * `?thanks=<ref>`, and the page says where the rewards went, or shows the code.
 */
export const supportPage = (locale: Locale) => {
  const m = SITE_MESSAGES[locale]
  const s = m.support
  const br = html`<section class="box donate-way" id="donate-br" aria-labelledby="donate-br-title">
      <p class="donate-guess">${s.suggested}</p>
      <h2 id="donate-br-title">${s.br.title}</h2>
      <p>${s.br.methods}</p>
      <form id="donate-form" data-cta="${s.br.cta(DONATION.preset)}" data-loading="${s.br.loading}" data-error="${s.br.error}">
        <fieldset class="roles donate-amounts"><legend>${s.br.amount}</legend>
          ${DONATION.presets.map((v) => html`<label><input type="radio" name="preset" value="${v}"${v === DONATION.preset ? html` checked` : ''} /><span>R$ ${v}</span></label>`)}
        </fieldset>
        <label class="donate-other"><span>${s.br.other}</span><input type="number" name="other" min="${DONATION.min}" max="${DONATION.max}" step="1" inputmode="numeric" placeholder="R$" /></label>
        <p class="note">${s.br.range(DONATION.min, DONATION.max)}</p>
        <button class="btn-play" type="submit">${s.br.cta(DONATION.preset)}</button>
        <p class="donate-error" role="alert" hidden></p>
      </form>
      <p class="note">${s.br.via}</p>
    </section>`
  const intl = html`<section class="box donate-way" id="donate-intl" aria-labelledby="donate-intl-title">
      <p class="donate-guess">${s.suggested}</p>
      <h2 id="donate-intl-title">${s.intl.title}</h2>
      <p>${s.intl.methods}</p>
      <p><a class="btn-play" href="${STRIPE_DONATION_URL}">${s.intl.cta}</a></p>
      <p class="note">${s.intl.via}</p>
    </section>`
  const account = html`<section class="box donate-account" id="donate-account" aria-labelledby="donate-account-title">
      <h2 id="donate-account-title">${s.account.title}</h2>
      <label class="donate-handle"><span>${s.account.label}</span><span class="donate-handle-box"><b>@</b><input type="text" name="handle" maxlength="21" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="${s.account.placeholder}" data-checking="${s.account.checking}" data-found="${s.account.found('{name}')}" data-missing="${s.account.missing}" /></span></label>
      <p class="donate-handle-status" role="status"></p>
      <p class="note">${s.account.hint}</p>
    </section>`
  const perks = html`<section class="box donate-perks" aria-labelledby="donate-perks-title">
      <h2 id="donate-perks-title">${s.perks.title}</h2>
      <ul>${s.perks.items.map((item) => html`<li>${item}</li>`)}</ul>
      <p class="note">${s.perks.note}</p>
    </section>`
  // The tiers' lines carry their own <b> (our copy, never a player's).
  const monthly = html`<section class="box donate-perks donate-monthly" id="donate-monthly" aria-labelledby="donate-monthly-title">
      <h2 id="donate-monthly-title">${s.monthly.title}</h2>
      <p>${s.monthly.lead}</p>
      <ul>${s.monthly.tiers.map((tier) => html`<li>${raw(tier)}</li>`)}</ul>
      <p><a class="btn-play" href="${PATREON_URL}" target="_blank" rel="noopener">${s.monthly.cta}</a></p>
      <p class="note">${s.monthly.note}</p>
    </section>`
  const wall = html`<section class="box donate-wall" id="donate-wall" aria-labelledby="donate-wall-title" data-empty="${s.wall.empty}" hidden>
      <h2 id="donate-wall-title">${s.wall.title}</h2>
      <ul class="donate-wall-names"></ul>
    </section>`
  const st = s.status
  const main = html`<div class="page-head"><h1>${s.h1}</h1><p class="lead">${s.lead}</p></div>
  <div class="doc-body narrow">
    <div class="box donate-thanks" id="donate-thanks" role="status" hidden data-pending="${st.pending}" data-late="${st.late}" data-sent="${st.sent('{handle}')}" data-used="${st.used}" data-copied="${st.copied}">
      <p><b>${s.thanks}</b></p>
      <p class="donate-status"></p>
      <div class="donate-code" hidden><p>${st.code}</p><p class="donate-code-row"><code></code><button class="btn-play" type="button">${st.copy}</button></p><p class="note">${st.codeHint}</p></div>
    </div>
    ${monthly}
    ${account}
    <div class="donate-ways" id="donate-ways" role="group" aria-label="${s.pick}">
      ${locale === 'pt' ? [br, intl] : [intl, br]}
    </div>
    ${perks}
    ${wall}
  </div>`
  return layout({ id: 'support', locale, title: s.title, description: s.description }, main)
}

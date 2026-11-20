import { DONATION } from '../../data/donations'
import { GEM_PATREON } from '../../data/gems'
import { PATREON_URL } from '../../data/supporters'
import type { Locale } from '../../i18n'
import { SITE_MESSAGES } from '../../i18n/site'
import { html, raw } from '../html'
import { layout } from '../layout'

/**
 * `/apoie/`: the monthly tiers on Patreon (`PATREON_URL`) up top, with the
 * gems each brings a month (`GEM_PATREON`), then one-time donations: a preset
 * or any amount in reais opens a Stripe Checkout through the API (Pix and
 * cards; abroad, Adaptive Pricing shows the donor's own currency), wired by
 * `client.ts`. Above it, the @ of the account that gets the rewards (filled
 * from the game's `?u=` or this browser's account); under it, what donors get
 * and the supporters' wall. The checkout comes back with `?thanks=<ref>`, and
 * the page says where the rewards went, or shows the code.
 */
export const supportPage = (locale: Locale) => {
  const m = SITE_MESSAGES[locale]
  const s = m.support
  const once = s.once
  const donate = html`<section class="box donate-way" id="donate-once" aria-labelledby="donate-once-title">
      <h2 id="donate-once-title">${once.title}</h2>
      <p>${once.methods}</p>
      <form id="donate-form" data-locale="${locale}" data-cta="${once.cta(DONATION.preset)}" data-loading="${once.loading}" data-error="${once.error}">
        <fieldset class="roles donate-amounts"><legend>${once.amount}</legend>
          ${DONATION.presets.map((v) => html`<label><input type="radio" name="preset" value="${v}"${v === DONATION.preset ? html` checked` : ''} /><span>R$ ${v}</span></label>`)}
        </fieldset>
        <label class="donate-other"><span>${once.other}</span><input type="number" name="other" min="${DONATION.min}" max="${DONATION.max}" step="1" inputmode="numeric" placeholder="R$" /></label>
        <p class="note">${once.range(DONATION.min, DONATION.max)}</p>
        <button class="btn-play" type="submit">${once.cta(DONATION.preset)}</button>
        <p class="donate-error" role="alert" hidden></p>
      </form>
      <noscript><p class="note">${once.noJs}</p></noscript>
      <p class="note">${once.via}</p>
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
      <ul>${s.monthly.tiers(GEM_PATREON).map((tier) => html`<li>${raw(tier)}</li>`)}</ul>
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
    ${donate}
    ${perks}
    ${wall}
  </div>`
  return layout({ id: 'support', locale, title: s.title, description: s.description }, main)
}

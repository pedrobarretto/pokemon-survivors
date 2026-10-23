import type { Locale } from '../../i18n'
import { SITE_MESSAGES } from '../../i18n/site'
import { CHANGELOG } from '../changelog'
import { localized } from '../localized'
import { html } from '../html'
import { layout } from '../layout'

/**
 * `/novidades/`: the changelog, in every language, from `site/changelog.ts`.
 * One card per update: its date and title, the highlights, then every change
 * folded under a `<details>` (open on the newest). Each card's id is its date,
 * so the lobby's Novidades links straight to it.
 */
export const changelogPage = (locale: Locale) => {
  const m = SITE_MESSAGES[locale]
  const longDate = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(m.lang.tag, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const main = html`<div class="page-head">
    <h1>${m.changelog.h1}</h1>
    <p class="lead">${m.changelog.intro}</p>
  </div>
  <div class="doc-body narrow">
    ${CHANGELOG.map(
      (update, i) => html`<article class="box doc-section changelog-update" id="${update.date}">
      <p class="changelog-date"><time datetime="${update.date}">${longDate(update.date)}</time></p>
      <h2>${localized(update.title, locale)}</h2>
      <ul class="changelog-highlights">${update.highlights.map((line) => html`<li>${localized(line, locale)}</li>`)}</ul>
      <details${i === 0 && html` open`}>
        <summary>${m.changelog.changes(update.changes.length)}</summary>
        ${update.changes.map(
          (change) => html`<section class="changelog-change">
          <h3>${localized(change.title, locale)}</h3>
          <ul>${change.notes.map((note) => html`<li>${localized(note, locale)}</li>`)}</ul>
        </section>`,
        )}
      </details>
    </article>`,
    )}
  </div>`
  return layout({ id: 'changelog', locale, title: m.changelog.title, description: m.changelog.description }, main)
}

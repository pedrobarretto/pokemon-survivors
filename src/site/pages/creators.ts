import { CREATOR_IDS, creatorOf, creatorUrl, PLATFORMS, type CreatorId } from '../../data/creators'
import type { Locale } from '../../i18n'
import { SITE_MESSAGES, type SiteMessages } from '../../i18n/site'
import { html } from '../html'
import { layout } from '../layout'
import { spritesOf } from '../pokedex'
import { DISCORD_INVITE } from '../routes'
import { createSpriteCss, spriteScale } from '../spriteCss'

type SpriteCss = ReturnType<typeof createSpriteCss>

/**
 * A creator's card: their partner Pokémon walking on a patch of grass, their
 * name, platform, @ and language, and a button to their channel. `client.ts`
 * marks the ones live now (`GET /creators/live`): a red AO VIVO, the button
 * pointing at the live, the card first.
 */
const creatorCard = (id: CreatorId, css: SpriteCss, m: SiteMessages) => {
  const c = creatorOf(id)
  const platform = PLATFORMS[c.platform].name
  const { normal, shiny } = spritesOf(c.partner.dex)
  const set = c.partner.shiny && shiny ? shiny : normal
  const sprite = `/assets/pokemon/${c.partner.dex}/${c.partner.shiny && shiny ? 'shiny/' : ''}Walk.png`
  return html`<li class="creator-card box" id="${id}" data-creator="${id}" data-live-url="${creatorUrl(id, true)}">
      <div class="creator-art">
        <span class="creator-live-badge" aria-hidden="true">${m.creators.live}</span>
        <span class="platform-chip ${c.platform}">${platform}</span>
        <div class="creator-stage" role="img" aria-label="${m.creators.partner(c.partner.name)}"><span class="sp ${css.classFor(set.walk, spriteScale([set.walk]))}" style="background-image:url(${sprite})"></span></div>
      </div>
      <h2>${c.name}</h2>
      <p class="creator-handle">@${c.handle}</p>
      <p class="creator-lang"><span>${m.creators.langLabel}</span> <b lang="${c.lang}">${c.lang.toUpperCase()}</b> ${m.creators.lang[c.lang]}</p>
      <a class="btn-play creator-watch" href="${creatorUrl(id, false)}" target="_blank" rel="noopener" data-watch="${m.creators.watchLive}">${m.creators.visit(platform)}</a>
    </li>`
}

/**
 * `/criadores/`: the content creators (`data/creators.ts`), a banner over
 * them while one is live (`client.ts` fills it), and how to join: the steps,
 * what creators get and the Discord's #creators.
 */
export const creatorsPage = (locale: Locale) => {
  const m = SITE_MESSAGES[locale]
  const c = m.creators
  const css = createSpriteCss()
  const cards = CREATOR_IDS.map((id) => creatorCard(id, css, m))
  const schema = [
    {
      '@type': 'ItemList',
      name: c.h1,
      itemListElement: CREATOR_IDS.map((id, i) => {
        const creator = creatorOf(id)
        const url = creatorUrl(id, false)
        return { '@type': 'ListItem', position: i + 1, item: { '@type': 'Person', name: creator.name, alternateName: `@${creator.handle}`, url, sameAs: [url] } }
      }),
    },
  ]
  const main = html`<div class="page-head"><h1>${c.h1}</h1><p class="lead">${c.lead}</p></div>
  <div class="creators-body">
    <section class="live-now box" id="live-now" hidden aria-labelledby="live-now-title" data-banner="${c.liveBanner('{name}', '{platform}')}">
      <span class="live-now-sprite" aria-hidden="true"></span>
      <div class="live-now-text">
        <h2 id="live-now-title"><span class="live-dot" aria-hidden="true"></span>${c.liveNow}</h2>
        <p></p>
      </div>
      <a class="btn-play live-now-watch" href="#" target="_blank" rel="noopener">${c.watchLive}</a>
    </section>
    <ul class="creator-grid" id="creator-grid">${cards}</ul>
    <section class="box creators-join" aria-labelledby="creators-join-title">
      <h2 id="creators-join-title">${c.join.title}</h2>
      <p>${c.join.lead}</p>
      <ol class="creators-steps">
        ${c.join.steps.map((step) => html`<li><b>${step.title}</b><span>${step.text}</span></li>`)}
      </ol>
      <h3>${c.join.perksTitle}</h3>
      <ul class="creators-perks">${c.join.perks.map((perk) => html`<li>${perk}</li>`)}</ul>
      <p><a class="btn-play discord" href="${DISCORD_INVITE}" target="_blank" rel="noopener">${c.join.cta}</a></p>
    </section>
  </div>`
  return layout({ id: 'creators', locale, title: c.title, description: c.description, schema, css: css.css() }, main)
}

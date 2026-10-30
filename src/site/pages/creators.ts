import { CREATOR_IDS, CREATOR_VIDEOS, creatorOf, embedUrl, PLATFORM_IDS, PLATFORMS, videoOf, type Creator } from '../../data/creators'
import { VIDEO_META } from '../../data/creatorVideos.generated'
import type { Locale } from '../../i18n'
import { SITE_MESSAGES } from '../../i18n/site'
import { html } from '../html'
import { layout } from '../layout'
import { absolute, DISCORD_INVITE } from '../routes'
import { longDate } from './compare'

/** Every video with what `npm run creators` fetched of it, newest first (a video it hasn't fetched yet stays off). */
export const creatorVideos = () =>
  CREATOR_VIDEOS.flatMap(({ creator, url }) => {
    const video = videoOf(url)
    const meta = video && VIDEO_META[video.id]
    return video && meta ? [{ creator, url, video, meta }] : []
  }).sort((a, b) => (b.meta.date ?? '').localeCompare(a.meta.date ?? ''))

/**
 * `/criadores/`: videos about the game, playing right on the page (the
 * thumbnail links to the video; `client.ts` swaps in the player on a tap, so
 * nothing loads from the platform before that), then who makes them with
 * their channels, then how to get on the page and the reward for it. Data in
 * `data/creators.ts`; JSON-LD lists the videos as `VideoObject`s.
 */
export const creatorsPage = (locale: Locale) => {
  const m = SITE_MESSAGES[locale]
  const c = m.creators
  const videos = creatorVideos()
  const platformLinks = (links: Creator['links']) =>
    PLATFORM_IDS.flatMap((id) => {
      const href = links[id]
      return href ? [html`<a class="btn-link" href="${href}" rel="noopener" target="_blank">${PLATFORMS[id].name} ↗</a>`] : []
    })
  const videoCards = videos.map(({ creator, url, video, meta }) => {
    const who = creatorOf(creator)
    return html`<article class="box video-card${video.vertical ? ' is-vertical' : ''}">
      <a class="video-play" href="${url}" target="_blank" rel="noopener" data-embed="${embedUrl(video)}" aria-label="${c.play(meta.title)}">
        <img src="${meta.thumb}" alt="" loading="lazy" decoding="async" /><span class="video-play-icon" aria-hidden="true"></span>
      </a>
      <h3 lang="${SITE_MESSAGES[who.lang].lang.tag}">${meta.title}</h3>
      <p class="video-by"><img src="/assets/pokemon/${who.partner.dex}/portrait.png" width="24" height="24" alt="" /> <b>${who.name}</b> · ${c.langs[who.lang]}</p>
      <p class="video-foot">${meta.date && html`<time class="note" datetime="${meta.date}">${longDate(meta.date.slice(0, 10), m)}</time>`}<a href="${url}" target="_blank" rel="noopener">${c.watchOn(PLATFORMS[video.platform].name)} ↗</a></p>
    </article>`
  })
  const creatorCards = CREATOR_IDS.map((id) => {
    const who = creatorOf(id)
    return html`<li class="box creator-card">
      <img class="portrait" src="/assets/pokemon/${who.partner.dex}/portrait.png" width="64" height="64" alt="${who.partner.name}" />
      <div><h3>${who.name}</h3><p class="note">${c.langs[who.lang]}</p><p class="links">${platformLinks(who.links)}</p></div>
    </li>`
  })
  const main = html`<div class="page-head"><h1>${c.h1}</h1><p class="lead">${c.lead}</p></div>
  <div class="doc-body">
    <section aria-labelledby="videos-title"><h2 class="section-title" id="videos-title">${c.videos}</h2><div class="video-grid">${videoCards}</div></section>
    <section aria-labelledby="people-title"><h2 class="section-title" id="people-title">${c.people}</h2><ul class="creator-grid">${creatorCards}</ul></section>
    <section class="box doc-section creator-join" id="join" aria-labelledby="join-title">
      <h2 id="join-title">${c.join.title}</h2>
      <p>${c.join.lead}</p>
      <ol>${c.join.steps.map((s) => html`<li>${s}</li>`)}</ol>
      <p><a class="btn-play" href="${DISCORD_INVITE}" target="_blank" rel="noopener">${c.join.cta}</a></p>
    </section>
  </div>`
  const schema = {
    '@type': 'ItemList',
    name: c.videos,
    itemListElement: videos.map(({ creator, url, video, meta }, i) => {
      const who = creatorOf(creator)
      const channel = Object.values(who.links)[0]
      return {
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'VideoObject',
          name: meta.title,
          description: c.videoAbout(who.name),
          thumbnailUrl: absolute(meta.thumb),
          ...(meta.date && { uploadDate: meta.date }),
          ...(meta.duration && { duration: meta.duration }),
          url,
          embedUrl: embedUrl(video).replace(/\?.*/, ''),
          inLanguage: SITE_MESSAGES[who.lang].lang.tag,
          creator: { '@type': 'Person', name: who.name, ...(channel && { url: channel }) },
          about: { '@id': `${absolute('/')}#game` },
        },
      }
    }),
  }
  return layout({ id: 'creators', locale, title: c.title, description: c.description, schema: [schema] }, main)
}

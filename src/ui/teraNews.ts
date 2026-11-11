import { ENEMIES } from '../data/enemies'
import type { RaidPick, TeraType } from '../data/tera'
import { t } from '../i18n'
import { crownIcon, STELLAR, TERA_RAMPS } from '../render/teraArt'
import { shardIcon, starIcon } from '../render/teraFx'
import { h, rich, setStyle } from './dom'
import { teraName } from './teraText'

/**
 * Terastal's and the Tera Raids' words on screen (`main.ts` plays the
 * sounds): the Terastal banner, in the game's banner box re-cut in the type's
 * crystal (its crown, the Pokémon's name over the type's), the raid's title
 * card with its stars, and the shard toasts.
 */

/** Sets a type's crystal colors on an element, for the CSS (`--tera-dark`, `--tera-mid`, `--tera-light`). */
const tint = (el: HTMLElement, type: TeraType) => {
  const r = TERA_RAMPS[type]
  setStyle(el, '--tera-dark', r.o)
  setStyle(el, '--tera-mid', r[2])
  setStyle(el, '--tera-light', r[3])
  if (type === 'stellar') el.classList.add('stellar')
  return el
}

const stars = (n: number) =>
  h('span', { class: 'tera-stars', 'aria-label': `${n}★` }, ...Array.from({ length: n }, (_, i) => h('img', { src: starIcon(n === 7 ? STELLAR[i % STELLAR.length]! : '#f8d038'), alt: '' })))

/** After `banner` put `content` in its box: the box takes the content's crystal colors (call it right after). */
export const dressBanner = (content: HTMLElement) => {
  const box = content.parentElement
  if (!box) return
  box.classList.add('tera-box')
  for (const v of ['--tera-dark', '--tera-mid', '--tera-light']) box.style.setProperty(v, content.style.getPropertyValue(v))
}

/** The banner as the crystal shatters: the crown, the Pokémon's name, "Tera <type>". */
export const teraBanner = (name: string, type: TeraType) =>
  tint(
    h(
      'span',
      { class: 'tera-banner' },
      h('img', { class: 'tera-crown', src: crownIcon(type), alt: '' }),
      h('span', { class: 'tera-lines' }, h('small', { class: 'tera-kicker' }, `${t().tera.kicker} · ${name}`), h('span', { class: 'tera-type' }, t().tera.banner(teraName(type)))),
    ),
    type,
  )

/** The raid's title card as the team steps into the hollow. */
export const raidBanner = (raid: RaidPick) =>
  tint(
    h(
      'span',
      { class: 'tera-banner' },
      h('img', { class: 'tera-crown', src: crownIcon(raid.tera), alt: '' }),
      h('span', { class: 'tera-lines' }, stars(raid.stars), h('span', { class: 'tera-type' }, t().raid.title(ENEMIES[raid.boss].name, teraName(raid.tera)))),
    ),
    raid.tera,
  )

/** A shard picked up: its icon and the Tera type it set (from which, when it changed one). */
export const shardToast = (type: TeraType, from: TeraType | null) =>
  h(
    'span',
    { class: 'item-toast' },
    h('img', { src: shardIcon(type), alt: '' }),
    rich(from && from !== type ? t().tera.shardFrom(teraName(from), teraName(type)) : t().tera.shard(teraName(type))),
  )

/** A den's news: its crown, then the raid in words. */
export const denToast = (raid: RaidPick, day: boolean) =>
  h(
    'span',
    { class: 'item-toast' },
    h('img', { src: crownIcon(raid.tera), alt: '' }),
    rich((day ? t().raid.openDay : t().raid.open)(raid.stars, ENEMIES[raid.boss].name, teraName(raid.tera))),
  )

export { stars as raidStars }
